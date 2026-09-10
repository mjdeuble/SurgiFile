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

async function writeTextFile(dirHandle, name, text) {
    const fileHandle = await dirHandle.getFileHandle(name, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(text);
    await writable.close();
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
            note: 'Encrypted lesion records live under users/<username>/lesions/; billing under billing/; patient charts under charts/; visit notes under notes/; consents under consents/ (notes and consents kept 7 days)'
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

async function deleteTextFile(dirHandle, name) {
    try {
        await dirHandle.removeEntry(name);
    } catch (err) {
        /* File may already be gone. */
    }
}
