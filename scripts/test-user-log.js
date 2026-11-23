/* Finished clinic copy plus additions: framing, replay, tidy, and migration. */
const {
    deriveVaultKey,
    encryptJson,
    decryptJson
} = require('../js/crypto.js');
const log = require('../js/user-log.js');

let failed = 0;
function eq(actual, expected, label) {
    const ok = JSON.stringify(actual) === JSON.stringify(expected);
    if (!ok) {
        failed += 1;
        console.error('FAIL', label, { actual, expected });
    } else {
        console.log('ok', label);
    }
}

function memoryDir() {
    const files = new Map();
    const dirs = new Map();
    return {
        files,
        write(name, text) { files.set(name, String(text)); },
        read(name) {
            if (!files.has(name)) {
                const err = new Error('missing');
                err.name = 'NotFoundError';
                throw err;
            }
            return files.get(name);
        },
        async getDirectoryHandle(name, opts) {
            if (!dirs.has(name)) {
                if (!(opts && opts.create)) {
                    const err = new Error('missing');
                    err.name = 'NotFoundError';
                    throw err;
                }
                dirs.set(name, memoryDir());
            }
            return dirs.get(name);
        },
        async *entries() {
            for (const name of files.keys()) yield [name, { kind: 'file' }];
            for (const name of dirs.keys()) yield [name, { kind: 'directory' }];
        }
    };
}

const put = frame => log.frameUserLogEntry(4, frame);
const sample = JSON.stringify({ v: 1, alg: 'TEST' });
const framed = log.frameUserLogEntry(4, sample);
const parsed = log.parseUserLogAdditions(framed);
eq(parsed.count, 1, 'a complete addition is read');
eq(parsed.tornTail, false, 'a complete addition is not a torn tail');
eq(parsed.damaged, '', 'a complete addition is not damaged');
eq(parsed.entries[0].json, sample, 'the sealed addition is kept whole');

const torn = log.parseUserLogAdditions(framed + 'DR1 5 20\n{"cut":');
eq(torn.count, 1, 'a torn tail leaves the earlier addition');
eq(torn.tornTail, true, 'an unfinished addition is a torn tail');
eq(torn.damaged, '', 'a torn tail is not treated as a damaged middle');

const later = log.frameUserLogEntry(6, JSON.stringify({ ok: true }));
const damaged = log.parseUserLogAdditions(framed + 'NOT-A-FRAME\n' + later);
eq(damaged.count, 1, 'entries after a damaged one are left unread');
eq(damaged.damaged, log.USER_LOG_DAMAGED, 'a damaged middle is reported');
eq(damaged.entries.some((entry) => entry.seq === 6), false, 'the addition after the damage is not applied');

const base = { lesion: [{ id: 'a', location: 'arm', n: 1 }], chart: [], billing: [], visit: [], consent: [] };
const replay = log.applyUserLogEntries(base, [
    { op: 'put', kind: 'lesion', id: 'a', seq: 2, record: { id: 'a', location: 'arm', n: 2 } },
    { op: 'put', kind: 'lesion', id: 'b', seq: 3, record: { id: 'b', location: 'leg' } },
    { op: 'delete', kind: 'lesion', id: 'b', seq: 4 }
]);
eq(replay.lesion.map((item) => item.n || item.id), [2], 'a later copy replaces the lesion and a delete removes one');
const twice = log.applyUserLogEntries(replay, [
    { op: 'put', kind: 'lesion', id: 'a', seq: 2, record: { id: 'a', location: 'arm', n: 2 } }
]);
eq(log.userLogSameRecords(replay, twice), true, 'replaying an addition that is already in the copy leaves the records unchanged');

eq(log.userLogNeedsTidy({ bytes: 10, count: 1 }, { lesion: [], chart: [], billing: [], visit: [], consent: [] }, Date.now()).needed, false, 'a short additions file does not need a tidy');
eq(log.userLogNeedsTidy({ bytes: 10, count: log.USER_LOG_TIDY_COUNT }, { lesion: [], chart: [], billing: [], visit: [], consent: [] }, Date.now()).needed, true, 'many additions need a tidy');
eq(log.userLogNeedsTidy({ bytes: log.USER_LOG_TIDY_BYTES, count: 1 }, { lesion: [], chart: [], billing: [], visit: [], consent: [] }, Date.now()).needed, true, 'a large additions file needs a tidy');

global.visitNoteIsExpired = (note) => note && note.expired === true;
const expired = log.userLogNeedsTidy({ bytes: 0, count: 0 }, {
    lesion: [],
    chart: [],
    billing: [],
    visit: [{ id: 'n1', expired: true }],
    consent: []
}, Date.now());
eq(expired.needed, true, 'a note that is due to be removed needs a tidy');
eq(expired.records.visit.length, 0, 'the tidy copy drops the expired note');
eq(log.userLogShouldMigrate({ snapshot: false, prev: false, additions: false }), true, 'a folder with no record files is copied across');
eq(log.userLogShouldMigrate({ snapshot: false, prev: false, additions: true }), false, 'additions without a finished copy are not replaced from the old files');

async function roundTrip() {
    const key = await deriveVaultKey('correct-horse-battery', new TextEncoder().encode('salt-1234'));
    const dir = memoryDir();
    global.writeTextFile = async (folder, name, text) => folder.write(name, text);
    global.readTextFile = (folder, name) => folder.read(name);
    global.deleteTextFile = async (folder, name) => { folder.files.delete(name); return true; };
    global.appendTextFile = async (folder, name, text) => {
        const prev = folder.files.has(name) ? folder.files.get(name) : '';
        folder.files.set(name, prev + text);
    };
    global.encryptJson = encryptJson;
    global.decryptJson = decryptJson;
    global.vaultAuth = { username: 'doctor', key };
    global.getUserDir = async () => dir;
    global.isVaultLoggedIn = () => true;
    global.showToast = () => {};
    global.vaultLoadBeginStage = () => {};
    global.managedLesions = [{ id: 'spot-1', location: 'Left cheek', updatedAt: '2026-11-01T00:00:00.000Z' }];
    global.managedCharts = [{ id: 'jane|01011970', name: 'Jane', dob: '01/01/1970' }];
    global.managedBillings = [];
    global.managedVisitNotes = [];
    global.managedConsents = [];

    log.userLogResetSession();
    const migrated = await log.migrateClinicToUserLog();
    eq(migrated, true, 'existing records are copied into the clinic file');
    eq(dir.files.has('records.snapshot.json.enc'), true, 'the finished copy is written');
    eq(dir.files.has('records.snapshot.prev.json.enc'), false, 'the first copy does not invent a previous file');
    eq(dir.files.get('records.additions.log'), '', 'the additions file starts empty');
    eq(log.userLogIsActive(), true, 'saves go to the clinic file after the copy');

    await log.appendUserLogPut('lesion', { id: 'spot-1', location: 'Left cheek', updatedAt: '2026-11-02T00:00:00.000Z', plan: 'Monitor' });
    await log.appendUserLogPut('lesion', { id: 'spot-2', location: 'Right arm', updatedAt: '2026-11-02T01:00:00.000Z' });
    const additions = await dir.getDirectoryHandle('records.additions');
    const savedNames = [];
    for await (const [name, handle] of additions.entries()) {
        if (handle.kind === 'file') savedNames.push(name);
    }
    eq(savedNames.length, 2, 'each save writes its own small file');
    eq(dir.files.get('records.additions.log'), '', 'a save does not copy the older additions log');
    const loaded = await log.loadClinicFromUserLog();
    eq(loaded, true, 'sign-in reads the finished copy and the additions');
    eq(global.managedLesions.map((item) => item.id).sort(), ['spot-1', 'spot-2'], 'additions are applied on top of the finished copy');
    eq(global.managedLesions.find((item) => item.id === 'spot-1').plan, 'Monitor', 'the newer copy of a lesion replaces the one in the finished file');
    eq(global.managedCharts.length, 1, 'charts from the finished copy are kept');

    additions.write('00000050.log', 'DR1 50 8\n{"cut":');
    await log.appendUserLogPut('lesion', { id: 'spot-3', location: 'Shin', updatedAt: '2026-11-03T00:00:00.000Z' });
    await log.loadClinicFromUserLog();
    eq(additions.files.has('00000050.log'), false, 'an unfinished small save is removed');
    eq(global.managedLesions.some((item) => item.id === 'spot-3'), true, 'a later save is kept when an earlier small file is unfinished');

    dir.write('records.additions.log', dir.files.get('records.additions.log') + 'DR1 8 30\n{"cut":');
    await log.loadClinicFromUserLog();
    eq(String(dir.files.get('records.additions.log')).includes('{"cut"'), false, 'an unfinished addition is removed after it is left out');
    eq(global.managedLesions.some((item) => item.id === 'spot-2'), true, 'finished additions stay after the unfinished one is removed');

    const broken = dir.files.get('records.additions.log') + 'BROKEN\n' + log.frameUserLogEntry(99, JSON.stringify(await encryptJson(key, {
        v: 1, op: 'put', kind: 'lesion', id: 'spot-9', seq: 99, record: { id: 'spot-9', location: 'Hidden' }
    })));
    dir.write('records.additions.log', broken);
    await log.loadClinicFromUserLog();
    eq(global.managedLesions.some((item) => item.id === 'spot-9'), false, 'a lesion after a damaged addition is not loaded');

    dir.write('records.snapshot.json.enc', 'not-json');
    let threw = false;
    try {
        await log.loadClinicFromUserLog();
    } catch (err) {
        threw = !!(err && err.userLogUnreadable);
    }
    eq(threw, true, 'an unreadable clinic file is not replaced with the old separate files');
}

roundTrip().then(() => {
    if (failed) {
        console.error(failed + ' failed');
        process.exit(1);
    }
    console.log('user log checks passed');
}).catch((err) => {
    console.error(err);
    process.exit(1);
});
