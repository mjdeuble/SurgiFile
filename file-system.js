// --- PWA FILE SYSTEM LOGIC ---

async function setSaveFolder() {
    try {
        const handle = await window.showDirectoryPicker({ mode: 'readwrite' });
        if (await verifyFolderPermission(handle, true)) { // Request permission
            
            // --- NEW: Create folder-per-doctor structure ---
            const doctorsToCreate = appSettings.doctorList.filter(
                doc => doc.code !== appSettings.pmIdentifier && doc.code.trim() !== ''
            );

            if (doctorsToCreate.length === 0) {
                throw new Error("No doctor codes found in settings. Please add doctors in the Settings tab first.");
            }

            for (const doctor of doctorsToCreate) {
                const doctorDirHandle = await handle.getDirectoryHandle(doctor.code, { create: true });
                await doctorDirHandle.getDirectoryHandle('Unprocessed', { create: true });
                await doctorDirHandle.getDirectoryHandle('Billed', { create: true });
                await doctorDirHandle.getDirectoryHandle('Archive', { create: true });
            }
            // --- End of new logic ---

            await dbSet('saveFolderHandle', handle);
            saveFolderHandle = handle;
            
            console.log('Save folder set:', handle.name);
            folderStatusMsg.textContent = `Status: Saving to "${handle.name}". Doctor subfolders have been created.`;
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

/**
 * Saves a new file to the 'Unprocessed' folder.
 * @param {object} data - The procedure data to save.
 * @param {string} filename - The name for the new file.
 */
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

/**
 * Saves a new file to the correct doctor's 'Unprocessed' folder.
 * @param {object} data - The procedure data to save.
 * @param {string} filename - The name for the new file.
 * @param {string} doctorCode - The doctor's code (to determine the folder).
 */
async function saveFileToFolder(data, filename, doctorCode) {
    if (!saveFolderHandle) {
        throw new Error("No default folder is set.");
    }
    if (!doctorCode || doctorCode === appSettings.pmIdentifier) {
        throw new Error("A valid doctor must be selected to save a new procedure.");
    }
    if (!(await verifyFolderPermission(saveFolderHandle, true))) { // Re-request if needed
        throw new Error("Permission to save folder was denied.");
    }

    const doctorDir = await saveFolderHandle.getDirectoryHandle(doctorCode, { create: true }); // Get or create doctor folder
    const unprocessedDir = await doctorDir.getDirectoryHandle('Unprocessed', { create: true });
    const fileHandle = await unprocessedDir.getFileHandle(filename, { create: true });
    
    const writable = await fileHandle.createWritable();
    const jsonString = JSON.stringify(data, null, 2);
    await writable.write(jsonString);
    await writable.close();
    
    console.log(`File ${filename} saved to ${doctorCode}/Unprocessed folder.`);
}

/**
 * Overwrites an existing file in its original folder.
 * @param {object} data - The updated procedure data.
 * @param {string} filename - The original name of the file to overwrite.
 * @param {string} folderName - The name of the subfolder (e.g., "Unprocessed").
 * @param {string} doctorCode - The doctor's code (to determine the folder).
 */
async function overwriteFile(data, filename, folderName, doctorCode) {
    if (!saveFolderHandle) {
        throw new Error("No default folder is set.");
    }
    if (!doctorCode) {
        throw new Error("Doctor code is missing. Cannot save edits.");
    }
    if (!(await verifyFolderPermission(saveFolderHandle, true))) {
        throw new Error("Permission to save folder was denied.");
    }

    const doctorDir = await saveFolderHandle.getDirectoryHandle(doctorCode);
    const dirHandle = await doctorDir.getDirectoryHandle(folderName);
    const fileHandle = await dirHandle.getFileHandle(filename, { create: true }); // { create: true } will overwrite
    
    const writable = await fileHandle.createWritable();
    await writable.write(JSON.stringify(data, null, 2));
    await writable.close();

    console.log(`File ${filename} overwritten in ${doctorCode}/${folderName} folder.`);
}


/**
 * Moves a file from one subfolder to another (e.g., Unprocessed -> Billed).
 * @param {string} fromDir - The source folder name.
 * @param {string} toDir - The destination folder name.
 * @param {FileSystemFileHandle} fileHandle - The handle of the file to move.
 * @param {object} newData - The (potentially updated) data to write in the new location.
 * @param {string} doctorCode - The doctor's code (to determine the folder).
 */
async function moveFile(fromDir, toDir, fileHandle, newData, doctorCode) {
    try {
        if (!doctorCode) {
            throw new Error("Doctor code is missing. Cannot move file.");
        }
        const doctorDir = await saveFolderHandle.getDirectoryHandle(doctorCode);
        const fromDirHandle = await doctorDir.getDirectoryHandle(fromDir);
        const toDirHandle = await doctorDir.getDirectoryHandle(toDir);
        
        // 1. Write the new/updated file to the destination
        const newFileHandle = await toDirHandle.getFileHandle(fileHandle.name, { create: true });
        const writable = await newFileHandle.createWritable();
        await writable.write(JSON.stringify(newData, null, 2));
        await writable.close();

        // 2. Delete the old file from the source
        await fromDirHandle.removeEntry(fileHandle.name);

        console.log(`Moved ${fileHandle.name} from ${doctorCode}/${fromDir} to ${doctorCode}/${toDir}`);
    } catch (e) {
        console.error('Error moving file:', e);
        alert(`Error moving file: ${e.message}`);
    }
}
