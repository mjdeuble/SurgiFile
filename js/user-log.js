/* One finished clinic copy plus one small file per save, per signed-in user.
   A save writes only that record. It does not copy the earlier saves.
   Older clinics may still have those saves in records.additions.log.
   A tidy on sign-in rewrites the finished copy when the additions have
   grown, or when notes and bills are due to be removed. The previous
   finished copy is kept until the new one has been read back. */

const USER_LOG_KINDS = ['lesion', 'chart', 'billing', 'visit', 'consent'];
const USER_LOG_SNAPSHOT = 'records.snapshot.json.enc';
const USER_LOG_SNAPSHOT_PREV = 'records.snapshot.prev.json.enc';
const USER_LOG_SNAPSHOT_NEXT = 'records.snapshot.next.json.enc';
const USER_LOG_ADDITIONS = 'records.additions.log';
const USER_LOG_ADDITIONS_DIR = 'records.additions';
const USER_LOG_TIDY_BYTES = 1536 * 1024;
const USER_LOG_TIDY_COUNT = 40;
const USER_LOG_DAMAGED = 'The additions file has a damaged entry. Later saves were left unloaded.';

let userLogActive = false;
let userLogNextSeq = 1;
let userLogAdditionsBytes = 0;
let userLogAdditionsCount = 0;
let userLogDirHandle = null;
let userLogAdditionsHandle = null;

function userLogIsActive() {
    return userLogActive;
}

function userLogResetSession() {
    userLogActive = false;
    userLogNextSeq = 1;
    userLogAdditionsBytes = 0;
    userLogAdditionsCount = 0;
    userLogDirHandle = null;
    userLogAdditionsHandle = null;
}

function userLogUtf8Length(text) {
    const value = String(text || '');
    if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(value).length;
    if (typeof Buffer !== 'undefined') return Buffer.byteLength(value);
    return value.length;
}

function userLogEncode(text) {
    const value = String(text || '');
    if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(value);
    return Uint8Array.from(Buffer.from(value));
}

function userLogDecode(bytes) {
    if (typeof TextDecoder !== 'undefined') return new TextDecoder().decode(bytes);
    return Buffer.from(bytes).toString();
}

function emptyUserLogRecords() {
    return { lesion: [], chart: [], billing: [], visit: [], consent: [] };
}

function frameUserLogEntry(seq, envelopeJson) {
    const body = String(envelopeJson || '');
    return 'DR1 ' + String(seq) + ' ' + userLogUtf8Length(body) + '\n' + body + '\n';
}

function parseUserLogAdditions(text) {
    const bytes = userLogEncode(text || '');
    const entries = [];
    let i = 0;
    let tornTail = false;
    let damaged = '';
    let completeBytes = 0;
    while (i < bytes.length) {
        let lineEnd = i;
        while (lineEnd < bytes.length && bytes[lineEnd] !== 10) lineEnd += 1;
        if (lineEnd >= bytes.length) {
            tornTail = true;
            break;
        }
        const header = userLogDecode(bytes.subarray(i, lineEnd)).trim();
        if (!header) {
            i = lineEnd + 1;
            completeBytes = i;
            continue;
        }
        const parts = header.split(' ');
        const lengthOk = parts.length === 3 && parts[0] === 'DR1' && /^\d+$/.test(parts[1]) && /^\d+$/.test(parts[2]);
        if (!lengthOk) {
            damaged = USER_LOG_DAMAGED;
            break;
        }
        const len = Number(parts[2]);
        const bodyStart = lineEnd + 1;
        const bodyEnd = bodyStart + len;
        if (bodyEnd >= bytes.length || bytes[bodyEnd] !== 10) {
            tornTail = true;
            break;
        }
        const json = userLogDecode(bytes.subarray(bodyStart, bodyEnd));
        try {
            JSON.parse(json);
        } catch (err) {
            damaged = USER_LOG_DAMAGED;
            break;
        }
        entries.push({ seq: Number(parts[1]), json });
        i = bodyEnd + 1;
        completeBytes = i;
    }
    return {
        entries,
        tornTail,
        damaged,
        completeBytes,
        count: entries.length
    };
}

function applyUserLogEntries(base, entries) {
    const records = emptyUserLogRecords();
    const index = {};
    USER_LOG_KINDS.forEach((kind) => {
        index[kind] = new Map();
        (base && base[kind] ? base[kind] : []).forEach((record) => {
            if (!record || !record.id) return;
            index[kind].set(String(record.id), records[kind].length);
            records[kind].push(record);
        });
    });
    (entries || []).forEach((entry) => {
        if (!entry || USER_LOG_KINDS.indexOf(entry.kind) === -1) return;
        const id = String(entry.id || (entry.record && entry.record.id) || '');
        if (!id) return;
        const map = index[entry.kind];
        if (entry.op === 'delete') {
            if (!map.has(id)) return;
            records[entry.kind][map.get(id)] = null;
            map.delete(id);
            return;
        }
        if (entry.op !== 'put' || !entry.record) return;
        if (map.has(id)) records[entry.kind][map.get(id)] = entry.record;
        else {
            map.set(id, records[entry.kind].length);
            records[entry.kind].push(entry.record);
        }
    });
    USER_LOG_KINDS.forEach((kind) => {
        records[kind] = records[kind].filter(Boolean);
    });
    return records;
}

function userLogCanonical(records) {
    const out = {};
    USER_LOG_KINDS.forEach((kind) => {
        out[kind] = (records && records[kind] ? records[kind] : [])
            .filter((record) => record && record.id)
            .map((record) => JSON.stringify(record))
            .sort();
    });
    return JSON.stringify(out);
}

function userLogSameRecords(left, right) {
    return userLogCanonical(left) === userLogCanonical(right);
}

function userLogNextSequence(snapshot, entries) {
    let max = Number(snapshot && snapshot.seq) || 0;
    (entries || []).forEach((entry) => {
        const seq = Number(entry && entry.seq) || 0;
        if (seq > max) max = seq;
    });
    return max + 1;
}

function userLogRecordExpired(kind, record, now) {
    if (!record) return false;
    if (kind === 'visit' && typeof visitNoteIsExpired === 'function') return visitNoteIsExpired(record, now);
    if (kind === 'consent' && typeof consentDocIsExpired === 'function') return consentDocIsExpired(record);
    if (kind === 'billing' && typeof billingIsProcessedExpired === 'function') return billingIsProcessedExpired(record);
    return false;
}

function userLogDropExpired(records, now) {
    const next = emptyUserLogRecords();
    let expired = 0;
    USER_LOG_KINDS.forEach((kind) => {
        (records && records[kind] ? records[kind] : []).forEach((record) => {
            if (userLogRecordExpired(kind, record, now)) {
                expired += 1;
                return;
            }
            next[kind].push(record);
        });
    });
    return { records: next, expired };
}

function userLogNeedsTidy(info, records, now) {
    const reasons = [];
    const bytes = Number(info && info.bytes) || 0;
    const count = Number(info && info.count) || 0;
    if (bytes >= USER_LOG_TIDY_BYTES) reasons.push('size');
    if (count >= USER_LOG_TIDY_COUNT) reasons.push('count');
    const dropped = userLogDropExpired(records, now);
    if (dropped.expired) reasons.push('expired');
    return { needed: reasons.length > 0, reasons, expired: dropped.expired, records: dropped.records };
}

function userLogShouldMigrate(found) {
    return !(found && (found.snapshot || found.prev || found.additions));
}

function userLogClone(value) {
    return JSON.parse(JSON.stringify(value));
}

function userLogSnapshotBody(records, seq) {
    return {
        v: 1,
        kind: 'snapshot',
        seq: Number(seq) || 0,
        savedAt: new Date().toISOString(),
        records: userLogClone(records || emptyUserLogRecords())
    };
}

function userLogTell(message) {
    if (!message) return;
    if (typeof showToast === 'function') showToast(message);
    else console.warn(message);
}

function userLogStage(label, start, end) {
    if (typeof vaultLoadBeginStage === 'function') vaultLoadBeginStage(label, start, end);
}

async function userLogReadOptional(dir, name) {
    try {
        return { found: true, text: await readTextFile(dir, name) };
    } catch (err) {
        if (err && (err.name === 'NotFoundError' || err.name === 'NotFound')) return { found: false, text: '' };
        throw err;
    }
}

function userLogAdditionName(seq) {
    return String(seq).padStart(8, '0') + '.log';
}

function userLogMissing(err) {
    return !!(err && (err.name === 'NotFoundError' || err.name === 'NotFound'));
}

async function userLogOpenAdditionsDir(dir, create) {
    try {
        return await dir.getDirectoryHandle(USER_LOG_ADDITIONS_DIR, { create: !!create });
    } catch (err) {
        if (userLogMissing(err)) return null;
        throw err;
    }
}

async function userLogListAdditionNames(additionsDir) {
    const names = [];
    if (!additionsDir || typeof additionsDir.entries !== 'function') return names;
    for await (const [name, handle] of additionsDir.entries()) {
        if (handle && handle.kind === 'file' && /\.log$/i.test(name)) names.push(name);
    }
    names.sort();
    return names;
}

async function clearUserLogAdditionFiles(dir) {
    const additionsDir = await userLogOpenAdditionsDir(dir, false);
    if (!additionsDir || typeof deleteTextFile !== 'function') return;
    const names = await userLogListAdditionNames(additionsDir);
    for (const name of names) {
        await deleteTextFile(additionsDir, name);
    }
}

async function readUserLogAdditionPieces(dir) {
    const additionsDir = await userLogOpenAdditionsDir(dir, false);
    if (!additionsDir) return { entries: [], bytes: 0, count: 0, damaged: '', torn: 0 };
    const names = await userLogListAdditionNames(additionsDir);
    const entries = [];
    let bytes = 0;
    let damaged = '';
    let torn = 0;
    for (const name of names) {
        let text = '';
        try {
            text = await readTextFile(additionsDir, name);
        } catch (err) {
            damaged = USER_LOG_DAMAGED;
            continue;
        }
        const parsed = parseUserLogAdditions(text);
        if (parsed.entries.length) {
            entries.push.apply(entries, parsed.entries);
            bytes += parsed.completeBytes;
            if (parsed.tornTail && typeof writeTextFile === 'function') {
                const kept = userLogDecode(userLogEncode(text).subarray(0, parsed.completeBytes));
                try { await writeTextFile(additionsDir, name, kept); } catch (err) { /* the good entry is still loaded */ }
            }
        } else if (parsed.tornTail && typeof deleteTextFile === 'function') {
            torn += 1;
            try { await deleteTextFile(additionsDir, name); } catch (err) { /* an unfinished save is left out */ }
        }
        if (parsed.damaged) damaged = parsed.damaged;
    }
    return { entries, bytes, count: entries.length, damaged, torn };
}

async function userLogDecryptSnapshot(text, key) {
    const envelope = JSON.parse(text);
    const body = await decryptJson(key, envelope);
    if (!body || body.kind !== 'snapshot' || !body.records) {
        throw new Error('Not a clinic record copy.');
    }
    return body;
}

function takeUserLogSeq() {
    const seq = userLogNextSeq;
    userLogNextSeq += 1;
    return seq;
}

function assignUserLogMemory(records) {
    const next = records || emptyUserLogRecords();
    managedLesions = (next.lesion || []).slice().sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));
    managedCharts = (next.chart || []).slice().sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'en', { sensitivity: 'base' }));
    managedBillings = (next.billing || []).slice().sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));
    managedVisitNotes = (next.visit || []).slice().sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));
    managedConsents = (next.consent || []).slice().sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
}

function collectUserLogMemory() {
    return {
        lesion: (typeof managedLesions !== 'undefined' ? managedLesions : []).slice(),
        chart: (typeof managedCharts !== 'undefined' ? managedCharts : []).slice(),
        billing: (typeof managedBillings !== 'undefined' ? managedBillings : []).slice(),
        visit: (typeof managedVisitNotes !== 'undefined' ? managedVisitNotes : []).slice(),
        consent: (typeof managedConsents !== 'undefined' ? managedConsents : []).slice()
    };
}

async function decodeUserLogFrames(frames, key) {
    const decoded = [];
    let damaged = '';
    for (const frame of frames || []) {
        try {
            const plain = await decryptJson(key, JSON.parse(frame.json));
            if (!plain || (plain.op !== 'put' && plain.op !== 'delete') || USER_LOG_KINDS.indexOf(plain.kind) === -1) {
                damaged = USER_LOG_DAMAGED;
                break;
            }
            decoded.push(plain);
        } catch (err) {
            damaged = USER_LOG_DAMAGED;
            break;
        }
    }
    return { decoded, damaged };
}

async function writeUserLogSnapshotFile(dir, name, records, seq, key) {
    const body = userLogSnapshotBody(records, seq);
    const envelope = await encryptJson(key, body);
    const text = JSON.stringify(envelope);
    await writeTextFile(dir, name, text);
    const back = await userLogReadOptional(dir, name);
    if (!back.found) throw new Error('The clinic record copy could not be read back.');
    const check = await userLogDecryptSnapshot(back.text, key);
    if (!userLogSameRecords(check.records, body.records) || Number(check.seq) !== Number(body.seq)) {
        throw new Error('The clinic record copy did not match what was written.');
    }
    return { body, text };
}

async function activateUserLog(records, seq, additionsBytes, additionsCount) {
    assignUserLogMemory(records);
    userLogActive = true;
    userLogNextSeq = (Number(seq) || 0) + 1;
    userLogAdditionsBytes = additionsBytes || 0;
    userLogAdditionsCount = additionsCount || 0;
}

async function publishUserLogSnapshot(dir, records, seq, key) {
    const current = await userLogReadOptional(dir, USER_LOG_SNAPSHOT);
    if (current.found && current.text) {
        await writeTextFile(dir, USER_LOG_SNAPSHOT_PREV, current.text);
    }
    const written = await writeUserLogSnapshotFile(dir, USER_LOG_SNAPSHOT_NEXT, records, seq, key);
    await writeTextFile(dir, USER_LOG_SNAPSHOT, written.text);
    const live = await userLogReadOptional(dir, USER_LOG_SNAPSHOT);
    if (!live.found) throw new Error('The clinic record copy could not be read back.');
    const check = await userLogDecryptSnapshot(live.text, key);
    if (!userLogSameRecords(check.records, written.body.records)) {
        throw new Error('The clinic record copy did not match what was written.');
    }
    await writeTextFile(dir, USER_LOG_ADDITIONS, '');
    await clearUserLogAdditionFiles(dir);
    if (typeof deleteTextFile === 'function') await deleteTextFile(dir, USER_LOG_SNAPSHOT_NEXT);
    await activateUserLog(written.body.records, written.body.seq, 0, 0);
    return written.body;
}

async function appendUserLogEntry(entry) {
    if (!userLogActive || typeof getUserDir !== 'function' || typeof vaultAuth === 'undefined' || !vaultAuth.key) return;
    if (!userLogDirHandle) userLogDirHandle = await getUserDir(vaultAuth.username, true);
    const dir = userLogDirHandle;
    const seq = takeUserLogSeq();
    const plain = Object.assign({}, entry, { v: 1, seq });
    if (plain.record) plain.record = userLogClone(plain.record);
    const envelope = await encryptJson(vaultAuth.key, plain);
    const frame = frameUserLogEntry(seq, JSON.stringify(envelope));
    if (!userLogAdditionsHandle) userLogAdditionsHandle = await userLogOpenAdditionsDir(dir, true);
    const additionsDir = userLogAdditionsHandle;
    if (!additionsDir) throw new Error('The clinic additions folder could not be opened.');
    try {
        await writeTextFile(additionsDir, userLogAdditionName(seq), frame, { fresh: true });
    } catch (err) {
        userLogDirHandle = null;
        userLogAdditionsHandle = null;
        throw err;
    }
    userLogAdditionsBytes += userLogUtf8Length(frame);
    userLogAdditionsCount += 1;
}

async function appendUserLogPut(kind, record) {
    if (!record || !record.id) return;
    await appendUserLogEntry({ op: 'put', kind, id: String(record.id), record });
}

async function appendUserLogDelete(kind, id) {
    if (!id) return;
    await appendUserLogEntry({ op: 'delete', kind, id: String(id) });
}

async function maybeTidyUserLog(dir, key) {
    const decision = userLogNeedsTidy({
        bytes: userLogAdditionsBytes,
        count: userLogAdditionsCount
    }, collectUserLogMemory(), Date.now());
    if (!decision.needed) return false;
    userLogStage('Tidying records…', 0.2, 0.42);
    const seq = Math.max(0, userLogNextSeq - 1);
    await publishUserLogSnapshot(dir, decision.records, seq, key);
    userLogTell('Tidied the clinic records. The next sign-in skips today\u2019s additions.');
    return true;
}

async function loadClinicFromUserLog() {
    userLogResetSession();
    if (typeof isVaultLoggedIn !== 'function' || !isVaultLoggedIn()) return false;
    if (typeof getUserDir !== 'function' || typeof readTextFile !== 'function') return false;
    const dir = await getUserDir(vaultAuth.username, true);
    if (typeof deleteTextFile === 'function') {
        try { await deleteTextFile(dir, USER_LOG_SNAPSHOT_NEXT); } catch (err) { /* an unfinished tidy is discarded */ }
    }
    const snapshotFile = await userLogReadOptional(dir, USER_LOG_SNAPSHOT);
    const prevFile = await userLogReadOptional(dir, USER_LOG_SNAPSHOT_PREV);
    const additionsFile = await userLogReadOptional(dir, USER_LOG_ADDITIONS);
    let snapshot = null;
    let usedPrev = false;
    if (snapshotFile.found && snapshotFile.text) {
        try {
            snapshot = await userLogDecryptSnapshot(snapshotFile.text, vaultAuth.key);
        } catch (err) {
            snapshot = null;
        }
    }
    if (!snapshot && prevFile.found && prevFile.text) {
        try {
            snapshot = await userLogDecryptSnapshot(prevFile.text, vaultAuth.key);
            usedPrev = true;
        } catch (err) {
            snapshot = null;
        }
    }
    const pieces = await readUserLogAdditionPieces(dir);
    if (!snapshot) {
        if (snapshotFile.found || prevFile.found || additionsFile.found || pieces.count) {
            const err = new Error('The clinic record file could not be read. The older separate files were left unused so a newer save is not replaced by an old copy.');
            err.userLogUnreadable = true;
            throw err;
        }
        return false;
    }
    userLogStage('Loading the clinic record…', 0.16, 0.5);
    const parsed = parseUserLogAdditions(additionsFile.found ? additionsFile.text : '');
    if (parsed.tornTail && !parsed.damaged && additionsFile.found && typeof writeTextFile === 'function') {
        const kept = userLogDecode(userLogEncode(additionsFile.text).subarray(0, parsed.completeBytes));
        try { await writeTextFile(dir, USER_LOG_ADDITIONS, kept); } catch (err) { /* the good entries are still loaded */ }
    }
    const combined = parsed.entries.concat(pieces.entries).sort((a, b) => a.seq - b.seq);
    const decoded = await decodeUserLogFrames(combined, vaultAuth.key);
    const records = applyUserLogEntries(snapshot.records, decoded.decoded);
    const seq = userLogNextSequence(snapshot, decoded.decoded);
    await activateUserLog(records, seq - 1, parsed.completeBytes + pieces.bytes, parsed.count + pieces.count);
    if (usedPrev) userLogTell('The newest record copy could not be read. Opened the previous copy.');
    if (!additionsFile.found && !pieces.count) userLogTell('The additions file is missing. Showing records as of the last tidy.');
    if (parsed.damaged || pieces.damaged || decoded.damaged) userLogTell(parsed.damaged || pieces.damaged || decoded.damaged);
    else if (parsed.tornTail || pieces.torn) userLogTell('The last save was incomplete and was left out.');
    try {
        await maybeTidyUserLog(dir, vaultAuth.key);
    } catch (err) {
        console.warn('Could not tidy clinic records', err);
        userLogTell('Records could not be tidied. They are still saved.');
    }
    return true;
}

async function migrateClinicToUserLog() {
    if (userLogActive || typeof isVaultLoggedIn !== 'function' || !isVaultLoggedIn()) return false;
    if (typeof getUserDir !== 'function') return false;
    const records = collectUserLogMemory();
    const total = USER_LOG_KINDS.reduce((sum, kind) => sum + records[kind].length, 0);
    userLogStage('Copying records into the clinic file…', 0.9, 0.96);
    const dir = await getUserDir(vaultAuth.username, true);
    try {
        await publishUserLogSnapshot(dir, records, 0, vaultAuth.key);
    } catch (err) {
        if (!userLogActive) userLogResetSession();
        console.warn('Could not copy clinic records into the record file', err);
        userLogTell('Could not copy records into the clinic file. The existing files are still in use.');
        return false;
    }
    if (total) userLogTell('Copied existing records into the clinic file. The old files are still in the folder.');
    return true;
}

async function repairClinicLoadedFromUserLog() {
    if (typeof convertManagedLesionsToSchemaV2 === 'function') await convertManagedLesionsToSchemaV2();
    if (typeof repairLesionsStuckAwaitingAfterResult === 'function') await repairLesionsStuckAwaitingAfterResult();
    if (typeof repairStuckReexcisionLesions === 'function') await repairStuckReexcisionLesions();
    for (const item of managedLesions || []) {
        if (typeof sanitizeOpenReexcisionChild === 'function' && sanitizeOpenReexcisionChild(item) && typeof writeManagedLesion === 'function') {
            try { await writeManagedLesion(item); } catch (err) { /* in-memory sanitise still applies */ }
        }
    }
    if (typeof repairMisattachedLesionCharts === 'function') await repairMisattachedLesionCharts();
    if (typeof pruneExpiredVisitNotes === 'function') await pruneExpiredVisitNotes();
    if (typeof pruneExpiredConsentDocs === 'function') await pruneExpiredConsentDocs();
    if (typeof migrateEmbeddedBillingFromLesions === 'function') await migrateEmbeddedBillingFromLesions();
    if (typeof pruneExpiredIdleCharts === 'function') await pruneExpiredIdleCharts();
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        USER_LOG_KINDS,
        USER_LOG_TIDY_BYTES,
        USER_LOG_TIDY_COUNT,
        USER_LOG_DAMAGED,
        frameUserLogEntry,
        parseUserLogAdditions,
        applyUserLogEntries,
        userLogSameRecords,
        userLogCanonical,
        userLogNextSequence,
        userLogNeedsTidy,
        userLogDropExpired,
        userLogShouldMigrate,
        userLogSnapshotBody,
        userLogUtf8Length,
        userLogResetSession,
        userLogIsActive,
        loadClinicFromUserLog,
        migrateClinicToUserLog,
        appendUserLogPut,
        appendUserLogDelete
    };
}
