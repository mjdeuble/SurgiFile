// --- PWA FILE SYSTEM LOGIC ---

/**
 * NEW: Scans the root save folder for directories and returns them as the doctor list.
 * It also formats the names (underscores to spaces) for display.
 */
async function getDoctorListFromFolders() {
    if (!saveFolderHandle) {
        console.warn("Cannot get doctor list: No save folder set.");
        return [];
    }

    let doctorList = [appSettings.pmIdentifier]; // Start with the PM
    
    for await (const entry of saveFolderHandle.values()) {
        // We only care about directories (folders)
        if (entry.kind === 'directory') {
            // Replaces underscores with spaces for display in the dropdown
            const displayName = entry.name.replace(/_/g, ' ');
            // We store the *display name* in the list now
            if (displayName !== appSettings.pmIdentifier) {
                doctorList.push(displayName);
            }
        }
    }
    
    // Sort doctors alphabetically, keeping PM at the top
    const pm = doctorList.shift();
    doctorList.sort();
    doctorList.unshift(pm);

    return doctorList;
}

/**
 * NEW: Creates the folder structure for a new doctor.
 * Called from the "Settings" tab.
 * @param {string} doctorName - The display name (e.g., "Firstname Lastname").
 */
async function addNewDoctorFolder(doctorName) {
    if (!saveFolderHandle) {
        throw new Error("No default folder is set. Cannot add new doctor.");
    }
    if (!doctorName || doctorName.trim() === "") {
        throw new Error("Doctor name cannot be empty.");
    }
    if (doctorName.trim() === appSettings.pmIdentifier) {
        throw new Error("Cannot create a folder for the Practice Manager.");
    }

    // Convert display name to folder name (e.g., "Firstname Lastname" -> "Firstname_Lastname")
    const folderName = doctorName.trim().replace(/\s+/g, '_');

    try {
        // Check if folder already exists
        await saveFolderHandle.getDirectoryHandle(folderName);
        // If the above line doesn't throw an error, the folder exists
        throw new Error(`A folder for "Dr. ${doctorName}" already exists.`);

    } catch (e) {
        // If the error is "NotFoundError", that's good! We can create it.
        if (e.name === 'NotFoundError') {
            // Create the new doctor's main folder
            const doctorDirHandle = await saveFolderHandle.getDirectoryHandle(folderName, { create: true });
            // Create the subfolders
            await doctorDirHandle.getDirectoryHandle('Unprocessed', { create: true });
            await doctorDirHandle.getDirectoryHandle('Billed', { create: true });
            await doctorDirHandle.getDirectoryHandle('Archive', { create: true });
            
            return `Successfully created folders for "Dr. ${doctorName}".`;
        } else {
            // Another error occurred (like the "already exists" error)
            throw e;
        }
    }
}


async function setSaveFolder() {
    try {
        const handle = await window.showDirectoryPicker({ mode: 'readwrite' });
        if (await verifyFolderPermission(handle, true)) { // Request permission
            
            // This function is now much simpler.
            // It just saves the handle. Folder creation is done by addNewDoctorFolder.
            
            await dbSet('saveFolderHandle', handle);
            saveFolderHandle = handle;
            
            console.log('Save folder set:', handle.name);
            folderStatusMsg.textContent = `Status: Saving to "${handle.name}".`;
            folderStatusMsg.classList.remove('text-slate-500', 'text-red-600');
            folderStatusMsg.classList.add('text-green-600');

            // After setting the folder, immediately scan it for doctors
            appSettings.doctorList = await getDoctorListFromFolders();
            populateDoctorDropdown();

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

                // After loading the folder, immediately scan it for doctors
                appSettings.doctorList = await getDoctorListFromFolders();
                populateDoctorDropdown();

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
 * Saves a new file to the correct doctor's 'Unprocessed' folder.
 * @param {object} data - The procedure data to save.
 * @param {string} filename - The name for the new file.
 * @param {string} doctorName - The doctor's *display name* (e.g., "Firstname Lastname").
 */
async function saveFileToFolder(data, filename, doctorName) {
    if (!saveFolderHandle) {
        throw new Error("No default folder is set.");
    }
    if (!doctorName || doctorName === appSettings.pmIdentifier) {
        throw new Error("A valid doctor must be selected to save a new procedure.");
    }
    if (!(await verifyFolderPermission(saveFolderHandle, true))) { // Re-request if needed
        throw new Error("Permission to save folder was denied.");
    }

    // Convert display name to folder name
    const folderName = doctorName.replace(/\s+/g, '_');

    const doctorDir = await saveFolderHandle.getDirectoryHandle(folderName, { create: false }); // Do not create here, must exist
    const unprocessedDir = await doctorDir.getDirectoryHandle('Unprocessed', { create: true });
    const fileHandle = await unprocessedDir.getFileHandle(filename, { create: true });
    
    const writable = await fileHandle.createWritable();
    const jsonString = JSON.stringify(data, null, 2);
    await writable.write(jsonString);
    await writable.close();
    
    console.log(`File ${filename} saved to ${folderName}/Unprocessed folder.`);
}

/**
 * Overwrites an existing file in its original folder.
 * @param {object} data - The updated procedure data.
 * @param {string} filename - The original name of the file to overwrite.
 *ax {string} folderName - The name of the subfolder (e.g., "Unprocessed").
 * @param {string} doctorName - The doctor's *display name* (e.g., "Firstname Lastname").
 */
async function overwriteFile(data, filename, folderName, doctorName) {
    if (!saveFolderHandle) {
        throw new Error("No default folder is set.");
    }
    if (!doctorName) {
        throw new Error("Doctor code is missing. Cannot save edits.");
    }
    if (!(await verifyFolderPermission(saveFolderHandle, true))) {
        throw new Error("Permission to save folder was denied.");
    }

    // Convert display name to folder name
    const doctorFolderName = doctorName.replace(/\s+/g, '_');

    const doctorDir = await saveFolderHandle.getDirectoryHandle(doctorFolderName);
    const dirHandle = await doctorDir.getDirectoryHandle(folderName);
    const fileHandle = await dirHandle.getFileHandle(filename, { create: true }); // { create: true } will overwrite
    
    const writable = await fileHandle.createWritable();
    await writable.write(JSON.stringify(data, null, 2));
    await writable.close();

    console.log(`File ${filename} overwritten in ${doctorFolderName}/${folderName} folder.`);
}


/**
 * Moves a file from one subfolder to another (e.g., Unprocessed -> Billed).
 * @param {string} fromDir - The source folder name.
 * @param {string} toDir - The destination folder name.
 * @param {FileSystemFileHandle} fileHandle - The handle of the file to move.
 * @param {object} newData - The (potentially updated) data to write in the new location.
 * @param {string} doctorName - The doctor's *display name* (e.g., "Firstname Lastname").
 */
async function moveFile(fromDir, toDir, fileHandle, newData, doctorName) {
    try {
        if (!doctorName) {
            throw new Error("Doctor name is missing. Cannot move file.");
        }
        
        // Convert display name to folder name
        const doctorFolderName = doctorName.replace(/\s+/g, '_');

        const doctorDir = await saveFolderHandle.getDirectoryHandle(doctorFolderName);
        const fromDirHandle = await doctorDir.getDirectoryHandle(fromDir);
        const toDirHandle = await doctorDir.getDirectoryHandle(toDir);
        
        // 1. Write the new/updated file to the destination
        const newFileHandle = await toDirHandle.getFileHandle(fileHandle.name, { create: true });
        const writable = await newFileHandle.createWritable();
        await writable.write(JSON.stringify(newData, null, 2));
        await writable.close();

        // 2. Delete the old file from the source
        await fromDirHandle.removeEntry(fileHandle.name);

        console.log(`Moved ${fileHandle.name} from ${doctorFolderName}/${fromDir} to ${doctorFolderName}/${toDir}`);
    } catch (e) {
        console.error('Error moving file:', e);
        alert(`Error moving file: ${e.message}`);
    }
}
