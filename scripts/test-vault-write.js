/* Node checks: one finished write per changed record, and a failed close is retried. */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

function loadScript(rel) {
    const file = path.join(__dirname, '..', rel);
    vm.runInThisContext(fs.readFileSync(file, 'utf8'), { filename: file });
}

loadScript('js/crypto.js');
loadScript('js/vault.js');

let failed = 0;
function eq(actual, expected, label) {
    const ok = Object.is(actual, expected)
        || (actual && expected && typeof actual === 'object' && JSON.stringify(actual) === JSON.stringify(expected));
    if (!ok) {
        failed += 1;
        console.error('FAIL', label, { actual, expected });
    } else {
        console.log('ok', label);
    }
}

function mockDir(name) {
    const files = new Map();
    const log = [];
    const dir = {
        name,
        log,
        failNextClose: false,
        async getFileHandle(fileName) {
            log.push('get:' + fileName);
            if (!files.has(fileName)) files.set(fileName, '');
            return {
                async createWritable() {
                    log.push('writable:' + fileName);
                    let pending = '';
                    return {
                        async write(text) {
                            pending = String(text);
                            log.push('write:' + fileName);
                        },
                        async close() {
                            if (dir.failNextClose) {
                                dir.failNextClose = false;
                                throw new Error('close failed');
                            }
                            files.set(fileName, pending);
                            log.push('close:' + fileName);
                        },
                        async abort() {
                            log.push('abort:' + fileName);
                        }
                    };
                }
            };
        },
        text(fileName) {
            return files.get(fileName) || '';
        }
    };
    return dir;
}

function writableCount(dir) {
    return dir.log.filter((line) => line.startsWith('writable:')).length;
}

(async () => {
    const same = { id: 'lesion-1', location: 'Forearm', updatedAt: 't1', fileName: 'old.json.enc' };
    const before = vaultRecordPlaintext(same);
    same.updatedAt = 't2';
    same.fileName = 'new.json.enc';
    eq(vaultRecordPlaintext(same), before, 'a time stamp and file name do not change the saved text');
    same.location = 'Scalp';
    eq(vaultRecordPlaintext(same) === before, false, 'a clinical change does change the saved text');

    const key = await crypto.subtle.generateKey(
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt']
    );
    const dir = mockDir('lesions');
    const record = { id: 'lesion-1', location: 'Forearm', updatedAt: '2026-11-03T00:00:00.000Z', fileName: 'lesion-1.json.enc' };

    const first = await writeEncryptedJsonFile(dir, 'lesion-1.json.enc', record, 'lesion', key);
    eq(first, true, 'the first save writes the file');
    eq(writableCount(dir), 1, 'the first save opens the file once');
    eq(dir.log.some((line) => line.includes('.tmp')), false, 'the save does not use a temporary copy');
    eq(dir.log.filter((line) => line.startsWith('get:')).every((line) => line === 'get:lesion-1.json.enc'), true, 'the save uses the real file name');
    const stored = JSON.parse(dir.text('lesion-1.json.enc'));
    const roundTrip = await decryptJson(key, stored);
    eq(roundTrip.location, 'Forearm', 'the written file decrypts to the lesion');

    record.updatedAt = '2026-11-03T01:00:00.000Z';
    const skipped = await writeEncryptedJsonFile(dir, 'lesion-1.json.enc', record, 'lesion', key);
    eq(skipped, false, 'an unchanged lesion is not written again');
    eq(writableCount(dir), 1, 'the skipped save does not open the file');

    record.location = 'Scalp';
    const changed = await writeEncryptedJsonFile(dir, 'lesion-1.json.enc', record, 'lesion', key);
    eq(changed, true, 'a changed lesion is written again');
    eq(writableCount(dir), 2, 'the changed lesion opens the file once more');
    const changedStored = await decryptJson(key, JSON.parse(dir.text('lesion-1.json.enc')));
    eq(changedStored.location, 'Scalp', 'the later write replaces the site');

    const forced = await writeEncryptedJsonFile(dir, 'lesion-1.json.enc', record, 'lesion', key, { force: true });
    eq(forced, true, 'a forced save writes even when the lesion is unchanged');
    eq(writableCount(dir), 3, 'the forced save opens the file');

    const otherKind = await writeEncryptedJsonFile(dir, 'lesion-1.json.enc', record, 'billing', key);
    eq(otherKind, true, 'a billing row with the same number is still written');

    vaultWriteForget('lesion', record.id);
    const afterForget = await writeEncryptedJsonFile(dir, 'lesion-1.json.enc', record, 'lesion', key);
    eq(afterForget, true, 'deleting the file makes the next identical save write again');

    const retryDir = mockDir('charts');
    retryDir.failNextClose = true;
    const chart = { id: 'chart-1', name: 'Robin Plancheck', updatedAt: 't1' };
    let threw = false;
    try {
        await writeEncryptedJsonFile(retryDir, 'chart-1.json.enc', chart, 'chart', key);
    } catch (err) {
        threw = err && err.message === 'close failed';
    }
    eq(threw, true, 'a close that fails is reported');
    eq(retryDir.text('chart-1.json.enc'), '', 'a failed close leaves the previous file');
    eq(retryDir.log.includes('abort:chart-1.json.enc'), true, 'a failed close aborts the new copy');
    const retried = await writeEncryptedJsonFile(retryDir, 'chart-1.json.enc', chart, 'chart', key);
    eq(retried, true, 'the same chart is written on the next try');
    const retriedChart = await decryptJson(key, JSON.parse(retryDir.text('chart-1.json.enc')));
    eq(retriedChart.name, 'Robin Plancheck', 'the retry stores the chart');

    if (failed) {
        console.error(failed + ' failed');
        process.exit(1);
    }
    console.log('all vault write checks passed');
})().catch((err) => {
    console.error(err);
    process.exit(1);
});
