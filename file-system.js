// --- PWA FILE SYSTEM LOGIC ---
// This file handles all interactions with the File System Access API.
// It depends on 'db.js' for storing the folder handle and
// 'main.js' for DOM element references (e.g., folderStatusMsg).

// Note: 'saveFolderHandle' and 'folderStatusMsg' are defined in 'main.js'

async function setSaveFolder() {
    try {
        const handle = await window.showDirectoryPicker({ mode: 'readwrite' });
        if (await verifyFolderPermission(handle, true)) { // Request permission
            // Create the 3 subfolders
            await handle.getDirectoryHandle('Unprocessed', { create: true });
            await handle.getDirectoryHandle('Billed', { create: true });
            await handle.getDirectoryHandle('Archive', { create: true });

            await dbSet('saveFolderHandle', handle);
            saveFolderHandle = handle;
            
            console.log('Save folder set:', handle.name);
            folderStatusMsg.textContent = `Status: Saving to "${handle.name}". Subfolders (Unprocessed, Billed, Archive) are ready.`;
            folderStatusMsg.classList.remove('text-slate-500', 'text-red-600');
            folderStatusMsg.classList.add('text-green-600');
        } else {
             throw new Error('Permission to write to folder was not granted.');
        }
    } catch (err) {
        console.error('Error setting save folder:', err);
        if (err.name !== 'AbortError') { // Don't show error if user just cancelled
            folderStatusMsg.textContent = `Error: ${err.message}`;
            folderStatusMsg.classList.remove('text-green-600');
            folderStatusMsg.classList.add('text-red-600');
        }
    }
}

async function loadSavedFolder() {
    // This function is called from main.js after the DOM is loaded
    try {
        const handle = await dbGet('saveFolderHandle');
        if (handle) {
            if (await verifyFolderPermission(handle)) { // Just check, don't re-request
                console.log('Loaded saved folder handle:', handle.name);
                saveFolderHandle = handle;
                folderStatusMsg.textContent = `Status: Saving to "${handle.name}".`;
                folderStatusMsg.classList.remove('text-slate-500', 'text-red-600');
                folderStatusMsg.classList.add('text-green-600');
            } else {
                console.log('Permission for saved folder was revoked.');
                folderStatusMsg.textContent = 'Status: Permission for saved folder was revoked. Please set it again.';
                folderStatusMsg.classList.add('text-red-600');
                saveFolderHandle = null;
                await dbDel('saveFolderHandle');
            }
        }
    } catch (err) {
        console.error('Error loading saved folder:', err);
    }
}

async function verifyFolderPermission(handle, requestIfNeeded = false) {
    const options = { mode: 'readwrite' };
    if (await handle.queryPermission(options) === 'granted') {
        return true;
    }
    if (requestIfNeeded) {
        if (await handle.requestPermission(options) === 'granted') {
            return true;
        }
    }
    return false;
}

async function saveFileToFolder(data, filename) {
    if (!saveFolderHandle) {
        throw new Error("No default folder is set.");
    }
    if (!(await verifyFolderPermission(saveFolderHandle, true))) { // Re-request if needed
        throw new Error("Permission to save folder was denied.");
    }

    const unprocessedDir = await saveFolderHandle.getDirectoryHandle('Unprocessed', { create: true });
    const fileHandle = await unprocessedDir.getFileHandle(filename, { create: true });
    
    const writable = await fileHandle.createWritable();
    const jsonString = JSON.stringify(data, null, 2);
    await writable.write(jsonString);
    await writable.close();
    
    console.log(`File ${filename} saved to Unprocessed folder.`);
}

async function moveFile(fromDir, toDir, fileHandle, newData) {
    try {
        if (!saveFolderHandle) {
            throw new Error("No save folder set to move files.");
        }
        
        const fromDirHandle = await saveFolderHandle.getDirectoryHandle(fromDir);
        const toDirHandle = await saveFolderHandle.getDirectoryHandle(toDir);
        
        // 1. Write the new/updated file to the destination
        const newFileHandle = await toDirHandle.getFileHandle(fileHandle.name, { create: true });
        const writable = await newFileHandle.createWritable();
        await writable.write(JSON.stringify(newData, null, 2));
        await writable.close();

        // 2. Delete the old file from the source
        await fromDirHandle.removeEntry(fileHandle.name);

        console.log(`Moved ${fileHandle.name} from ${fromDir} to ${toDir}`);
    } catch (e) {
        console.error('Error moving file:', e);
        // Use a modal or non-blocking notification in production
        alert(`Error moving file: ${e.message}`);
    }
}
