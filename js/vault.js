/* Clinic folder via the File System Access API. User handles persist in IndexedDB. */

const VAULT_IDB_NAME = 'dermrecord-vault';
const VAULT_IDB_STORE = 'handles';
const VAULT_IDB_KEY = 'clinicFolder';

let vaultRootHandle = null;

function vaultFsSupported() {
    return typeof window.showDirectoryPicker === 'function';
}

function openVaultIdb() {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(VAULT_IDB_NAME, 1);
        req.onupgradeneeded = () => {
            const db = req.result;
            if (!db.objectStoreNames.contains(VAULT_IDB_STORE)) db.createObjectStore(VAULT_IDB_STORE);
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

function folderErrorMessage(err) {
    if (!err) return 'Could not open that folder.';
    const name = err.name || '';
    const detail = err.message || String(err);
    if (name === 'AbortError') return 'No folder was selected.';
    if (name === 'NotAllowedError') {
        return 'Write access was not granted. Select the folder again and allow editing when the browser asks.';
    }
    if (name === 'SecurityError') {
        return 'This window cannot keep a clinic folder. Open DermRecord in Chrome or Edge (or the installed app), not an embedded preview.';
    }
    if (name === 'NotFoundError') return 'That folder was not found after it was selected. Choose it again.';
    if (name === 'DataCloneError') return 'The folder opened, but this browser could not remember it for next time.';
    return detail;
}

async function saveClinicFolderHandle(handle) {
    const db = await openVaultIdb();
    await new Promise((resolve, reject) => {
        const tx = db.transaction(VAULT_IDB_STORE, 'readwrite');
        tx.objectStore(VAULT_IDB_STORE).put(handle, VAULT_IDB_KEY);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error || new Error('Could not remember the clinic folder.'));
    });
    db.close();
}

async function loadClinicFolderHandle() {
    const db = await openVaultIdb();
    const handle = await new Promise((resolve, reject) => {
        const tx = db.transaction(VAULT_IDB_STORE, 'readonly');
        const req = tx.objectStore(VAULT_IDB_STORE).get(VAULT_IDB_KEY);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => reject(req.error);
    });
    db.close();
    return handle;
}

async function ensureFolderPermission(handle, interactive) {
    if (!handle) return false;
    const opts = { mode: 'readwrite' };
    let state = await handle.queryPermission(opts);
    if (state === 'granted') return true;
    if (!interactive) return false;
    state = await handle.requestPermission(opts);
    return state === 'granted';
}

const vaultWriteQueues = new Map();
const pendingVaultWrites = new Set();
let lastVaultWriteErrorToastAt = 0;

function vaultWriteQueueKey(dirHandle, name) {
    const dirName = dirHandle && dirHandle.name ? String(dirHandle.name) : 'dir';
    return dirName + '\0' + String(name || '');
}

function enqueueVaultWrite(dirHandle, name, task) {
    const key = vaultWriteQueueKey(dirHandle, name);
    const prev = vaultWriteQueues.get(key) || Promise.resolve();
    const next = prev.then(() => task(), () => task());
    vaultWriteQueues.set(key, next.then(() => undefined, () => undefined));
    return next;
}

function toastVaultWriteError(message) {
    const now = Date.now();
    if (now - lastVaultWriteErrorToastAt < 8000) return;
    lastVaultWriteErrorToastAt = now;
    if (typeof showToast === 'function') showToast(message);
}

function warnVaultWriteFailure(err, message) {
    console.warn(message, err);
    toastVaultWriteError(message);
}

function vaultPayloadLooksComplete(text) {
    const t = String(text || '').trim();
    if (t.length < 20) return false;
    if (t[0] !== '{' && t[0] !== '[') return false;
    try {
        JSON.parse(t);
        return true;
    } catch (err) {
        return false;
    }
}

async function closeWritableSafely(writable) {
    if (!writable) return;
    try {
        await writable.close();
    } catch (err) {
        try { await writable.abort(); } catch (abortErr) { /* already failed */ }
        throw err;
    }
}

async function writeTextFileNow(dirHandle, name, text) {
    const tmpName = String(name) + '.tmp';
    const tmpHandle = await dirHandle.getFileHandle(tmpName, { create: true });
    const tmpWritable = await tmpHandle.createWritable();
    try {
        await tmpWritable.write(text);
        await closeWritableSafely(tmpWritable);
    } catch (err) {
        try { await tmpWritable.abort(); } catch (abortErr) { /* tmp left for recovery */ }
        throw err;
    }
    const destHandle = await dirHandle.getFileHandle(name, { create: true });
    const destWritable = await destHandle.createWritable();
    try {
        await destWritable.write(text);
        await closeWritableSafely(destWritable);
    } catch (err) {
        try { await destWritable.abort(); } catch (abortErr) { /* dest may be truncated; tmp is complete */ }
        throw err;
    }
    await deleteTextFile(dirHandle, tmpName);
}

async function writeTextFile(dirHandle, name, text) {
    const run = enqueueVaultWrite(dirHandle, name, () => writeTextFileNow(dirHandle, name, text));
    pendingVaultWrites.add(run);
    try {
        return await run;
    } finally {
        pendingVaultWrites.delete(run);
    }
}

async function waitForPendingVaultWrites() {
    for (let i = 0; i < 6; i += 1) {
        const snapshot = [...pendingVaultWrites];
        if (!snapshot.length) return;
        await Promise.all(snapshot.map((p) => p.then(() => undefined, () => undefined)));
    }
}

async function recoverIncompleteVaultWrites(dirHandle) {
    if (!dirHandle) return;
    const tmpNames = [];
    for await (const [name, handle] of dirHandle.entries()) {
        if (handle.kind === 'file' && String(name).endsWith('.tmp')) tmpNames.push(name);
    }
    for (const tmpName of tmpNames) {
        const destName = String(tmpName).replace(/\.tmp$/, '');
        if (!destName || destName === tmpName) continue;
        try {
            const tmpText = await readTextFile(dirHandle, tmpName);
            const tmpOk = vaultPayloadLooksComplete(tmpText);
            let destOk = false;
            try {
                destOk = vaultPayloadLooksComplete(await readTextFile(dirHandle, destName));
            } catch (err) {
                destOk = false;
            }
            if (!destOk && tmpOk) {
                await enqueueVaultWrite(dirHandle, destName, async () => {
                    const destHandle = await dirHandle.getFileHandle(destName, { create: true });
                    const destWritable = await destHandle.createWritable();
                    try {
                        await destWritable.write(tmpText);
                        await closeWritableSafely(destWritable);
                    } catch (err) {
                        try { await destWritable.abort(); } catch (abortErr) { /* tmp is still the complete copy */ }
                        throw err;
                    }
                    await deleteTextFile(dirHandle, tmpName);
                });
            } else if (destOk) {
                await deleteTextFile(dirHandle, tmpName);
            }
        } catch (err) {
            console.warn('Could not recover incomplete vault write', tmpName, err);
        }
    }
}

async function readTextFile(dirHandle, name) {
    const fileHandle = await dirHandle.getFileHandle(name);
    const file = await fileHandle.getFile();
    return file.text();
}

async function fileExists(dirHandle, name) {
    try {
        await dirHandle.getFileHandle(name);
        return true;
    } catch (err) {
        return false;
    }
}

async function ensureVaultLayout(rootHandle) {
    const usersDir = await rootHandle.getDirectoryHandle('users', { create: true });
    try {
        await writeTextFile(rootHandle, 'dermrecord.json', JSON.stringify({
            app: 'DermRecord',
            version: 1,
            note: 'Encrypted records live under users/<username>/. Chart, note, and consent filenames are random ids (not name or DOB). Notes and consents kept 7 days; processed billing 14 days; idle charts deleted 14 days after work is finished. Last-open chart id in ui-session.json.enc'
        }, null, 2));
    } catch (err) {
        /* Marker file is optional; the users/ directory is what login needs. */
        console.warn('Could not write dermrecord.json', err);
    }
    return usersDir;
}

async function requestFolderWriteAccess(handle) {
    if (!handle) return false;
    const opts = { mode: 'readwrite' };
    try {
        if (typeof handle.queryPermission === 'function') {
            const current = await handle.queryPermission(opts);
            if (current === 'granted') return true;
        }
        if (typeof handle.requestPermission === 'function') {
            const next = await handle.requestPermission(opts);
            return next === 'granted';
        }
    } catch (err) {
        console.warn('Folder permission check failed', err);
    }
    return true;
}

async function openDirectoryPicker() {
    const options = { id: 'dermrecord-clinic', mode: 'readwrite', startIn: 'documents' };
    try {
        return await window.showDirectoryPicker(options);
    } catch (err) {
        if (err && err.name === 'TypeError') {
            return await window.showDirectoryPicker();
        }
        throw err;
    }
}

async function pickClinicFolder() {
    if (!vaultFsSupported()) {
        throw new Error('This browser cannot open a clinic folder. Use Chrome or Edge, or install DermRecord as a PWA.');
    }
    const handle = await openDirectoryPicker();
    await requestFolderWriteAccess(handle);
    try {
        await ensureVaultLayout(handle);
    } catch (err) {
        const extra = folderErrorMessage(err);
        throw new Error('The folder was selected, but DermRecord could not create files in it. ' + extra + ' Pick a local folder you can edit.');
    }
    vaultRootHandle = handle;
    try {
        await saveClinicFolderHandle(handle);
    } catch (err) {
        console.warn('Could not persist clinic folder handle', err);
    }
    if (typeof loadClinicProfile === 'function') await loadClinicProfile();
    if (typeof loadClinicSupplies === 'function') await loadClinicSupplies();
    if (typeof loadClinicPdtPrices === 'function') await loadClinicPdtPrices();
    return handle;
}

async function restoreClinicFolder(interactive) {
    const handle = await loadClinicFolderHandle();
    if (!handle) return null;
    const ok = await ensureFolderPermission(handle, interactive);
    if (!ok) return null;
    await ensureVaultLayout(handle);
    vaultRootHandle = handle;
    if (typeof loadClinicProfile === 'function') await loadClinicProfile();
    if (typeof loadClinicSupplies === 'function') await loadClinicSupplies();
    if (typeof loadClinicPdtPrices === 'function') await loadClinicPdtPrices();
    return handle;
}

function getUsersDir() {
    if (!vaultRootHandle) throw new Error('No clinic folder connected.');
    return vaultRootHandle.getDirectoryHandle('users', { create: true });
}

async function listVaultUsernames() {
    const usersDir = await getUsersDir();
    const names = [];
    for await (const [name, handle] of usersDir.entries()) {
        if (handle.kind === 'directory') names.push(name);
    }
    return names.sort();
}

async function getUserDir(username, create) {
    const usersDir = await getUsersDir();
    return usersDir.getDirectoryHandle(username, { create: !!create });
}

async function getUserLesionsDir(username, create) {
    const userDir = await getUserDir(username, create);
    return userDir.getDirectoryHandle('lesions', { create: !!create });
}

async function getUserBillingDir(username, create) {
    const userDir = await getUserDir(username, create);
    return userDir.getDirectoryHandle('billing', { create: !!create });
}

async function getUserChartsDir(username, create) {
    const userDir = await getUserDir(username, create);
    return userDir.getDirectoryHandle('charts', { create: !!create });
}

async function getUserNotesDir(username, create) {
    const userDir = await getUserDir(username, create);
    return userDir.getDirectoryHandle('notes', { create: !!create });
}

async function getUserConsentsDir(username, create) {
    const userDir = await getUserDir(username, create);
    return userDir.getDirectoryHandle('consents', { create: !!create });
}

function toastVaultDeleteFailure(what) {
    toastVaultWriteError('Could not delete expired ' + what + ' from the clinic folder. It will stay until the folder allows deletes.');
}

async function deleteTextFile(dirHandle, name) {
    try {
        await dirHandle.removeEntry(name);
        return true;
    } catch (err) {
        if (err && (err.name === 'NotFoundError' || err.name === 'NotFound')) return true;
        console.warn('Could not delete file', name, err);
        return false;
    }
}

function opaqueIdStem(prefix, fallback) {
    return String(prefix || fallback || 'id').replace(/[^a-z0-9]+/gi, '').toLowerCase() || (fallback || 'id');
}

function newOpaqueIdToken() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
    return Date.now() + '-' + Math.random().toString(16).slice(2);
}

function newOpaqueRecordId(prefix) {
    return opaqueIdStem(prefix, 'id') + '-' + newOpaqueIdToken();
}

function isOpaqueIdToken(token) {
    const rest = String(token || '');
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(rest)) return true;
    return /^\d{10,}-[0-9a-f]{4,}$/i.test(rest);
}

function isOpaqueRecordId(id, prefix) {
    const s = String(id || '');
    const stem = opaqueIdStem(prefix, '');
    if (!stem || !s.startsWith(stem + '-')) return false;
    return isOpaqueIdToken(s.slice(stem.length + 1));
}

function newOpaqueEncFileName(prefix) {
    return opaqueIdStem(prefix, 'file') + '-' + newOpaqueIdToken() + '.json.enc';
}

function isOpaqueEncFileName(name, prefix) {
    const n = String(name || '');
    const stem = String(prefix || '').replace(/[^a-z0-9]+/gi, '').toLowerCase();
    const suffix = '.json.enc';
    if (!stem || !n.startsWith(stem + '-') || !n.endsWith(suffix)) return false;
    const id = n.slice(stem.length + 1, -suffix.length);
    return isOpaqueIdToken(id);
}

async function migrateIdentifyingRecordIds(records, prefix, writeOne) {
    let changed = 0;
    for (const record of records || []) {
        if (!record || isOpaqueRecordId(record.id, prefix)) continue;
        record.id = newOpaqueRecordId(prefix);
        try {
            if (typeof writeOne === 'function') await writeOne(record);
            changed += 1;
        } catch (err) {
            console.warn('Could not rewrite identifying record id', prefix, err);
        }
    }
    return changed;
}

function preferOpaqueVaultRecord(a, b, prefix) {
    const aOp = isOpaqueEncFileName(a?.fileName, prefix) ? 1 : 0;
    const bOp = isOpaqueEncFileName(b?.fileName, prefix) ? 1 : 0;
    if (aOp !== bOp) return aOp ? a : b;
    return String(b?.updatedAt || b?.createdAt || '') >= String(a?.updatedAt || a?.createdAt || '') ? b : a;
}

async function dedupeVaultRecordsById(records, prefix, dirHandle) {
    const byId = new Map();
    for (const item of records || []) {
        const id = String(item?.id || '');
        if (!id) continue;
        const existing = byId.get(id);
        if (!existing) {
            byId.set(id, item);
            continue;
        }
        const winner = preferOpaqueVaultRecord(existing, item, prefix);
        const loser = winner === existing ? item : existing;
        byId.set(id, winner);
        if (dirHandle && loser.fileName && loser.fileName !== winner.fileName) {
            await deleteTextFile(dirHandle, loser.fileName);
        }
    }
    return [...byId.values()];
}

async function writeOpaqueEncryptedJson(dirHandle, record, prefix, key) {
    if (!dirHandle || !record) return '';
    const oldName = record.fileName;
    if (!isOpaqueEncFileName(oldName, prefix)) {
        record.fileName = newOpaqueEncFileName(prefix);
    }
    const payload = await encryptJson(key, record);
    await writeTextFile(dirHandle, record.fileName, JSON.stringify(payload));
    if (oldName && oldName !== record.fileName) {
        await deleteTextFile(dirHandle, oldName);
    }
    return record.fileName;
}

async function migrateIdentifyingEncFilenames(records, prefix, dirHandle, key) {
    let changed = 0;
    for (const record of records || []) {
        if (isOpaqueEncFileName(record?.fileName, prefix)) continue;
        try {
            await writeOpaqueEncryptedJson(dirHandle, record, prefix, key);
            changed += 1;
        } catch (err) {
            console.warn('Could not rename identifying vault file', record?.fileName, err);
        }
    }
    return changed;
}
