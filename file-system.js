// --- PWA FILE SYSTEM LOGIC ---

// This file handles all interactions with the File System Access API:
// - Getting/verifying folder permissions
// - Dynamically scanning for doctor folders
// - Adding new doctor folders
// - Reading, writing, and moving procedure .json files

/**
 * Prompts the user to select a directory for saving files.
 * Stores the handle in IndexedDB.
 */
window.setSaveFolder = async function() {
    try {
        const handle = await window.showDirectoryPicker({ mode: 'readwrite' });
        
        // We only need to request permission and save the handle.
        if (await verifyFolderPermission(handle, true)) { // Request permission
            
            await dbSet('saveFolderHandle', handle);
            saveFolderHandle = handle;
            
            console.log('Save folder set:', handle.name);
            folderStatusMsg.textContent = `Status: Saving to "${handle.name}".`;
            folderStatusMsg.classList.remove('text-slate-500', 'text-red-600');
            folderStatusMsg.classList.add('text-green-600');

            // After setting the folder, do an initial scan
            const doctors = await getDoctorListFromFolders();
            appSettings.doctorList = doctors; // Update global state
            populateDoctorDropdown(doctors); // Repopulate and select

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

/**
 * Loads the saved folder handle from IndexedDB on app start.
 */
window.loadSavedFolder = async function() {
    let doctors = [];
    try {
        const handle = await dbGet('saveFolderHandle');
        if (handle) {
            if (await verifyFolderPermission(handle)) { // Just check, don't re-request
                console.log('Loaded saved folder handle:', handle.name);
                saveFolderHandle = handle;
                folderStatusMsg.textContent = `Status: Saving to "${handle.name}".`;
                folderStatusMsg.classList.remove('text-slate-500', 'text-red-600');
                folderStatusMsg.classList.add('text-green-600');

                // Folder is loaded, so scan it for doctors
                doctors = await getDoctorListFromFolders();

            } else {
                console.log('Permission for saved folder was revoked.');
                folderStatusMsg.textContent = 'Status: Permission for saved folder was revoked. Please set it again.';
                folderStatusMsg.classList.add('text-red-600');
                saveFolderHandle = null;
                await dbDel('saveFolderHandle');
                // No folder is loaded, so the list is empty
            }
        } else {
            // No handle was ever saved.
            folderStatusMsg.textContent = 'Status: No default save folder set.';
            folderStatusMsg.classList.add('text-amber-600');
        }
    } catch (err) {
        console.error('Error loading saved folder:', err);
    }
    
    // Update global doctor list and populate dropdown
    appSettings.doctorList = doctors;
    populateDoctorDropdown(doctors);
}


/**
 * Scans the save folder handle for directories (doctors).
 * @returns {Promise<string[]>} A list of doctor display names.
 */
window.getDoctorListFromFolders = async function() {
    let dynamicDoctorList = [];

    if (!saveFolderHandle) {
        console.warn("getDoctorListFromFolders: No save folder handle.");
        return dynamicDoctorList; // Return empty list
    }

    try {
        for await (const entry of saveFolderHandle.values()) {
            if (entry.kind === 'directory' && !entry.name.startsWith('.')) {
                // Convert folder name back to display name
                const displayName = entry.name.replace(/_/g, ' ');
                dynamicDoctorList.push(displayName);
            }
        }
        return dynamicDoctorList;
    } catch (e) {
        console.error("Error scanning for doctor folders:", e);
        return dynamicDoctorList; // Return empty list on error
    }
}

/**
 * Creates a new set of folders for a new doctor.
 * @param {string} doctorDisplayName - The display name (e.g., "Firstname Lastname")
 */
window.addNewDoctorFolder = async function(doctorDisplayName) {
    if (!saveFolderHandle) {
        throw new Error("Please set the Default Save Folder first.");
    }

    const folderName = doctorDisplayName.replace(/\s+/g, '_'); // "Firstname_Lastname"

    try {
        // Check if folder already exists
        await saveFolderHandle.getDirectoryHandle(folderName, { create: false });
        return `Folder for 'Dr. ${doctorDisplayName}' already exists.`;

    } catch (e) {
        // Folder does not exist, so create it and its subfolders
        if (e.name === 'NotFoundError') {
            const doctorDir = await saveFolderHandle.getDirectoryHandle(folderName, { create: true });
            await doctorDir.getDirectoryHandle('Unprocessed', { create: true });
            await doctorDir.getDirectoryHandle('Billed', { create: true });
            await doctorDir.getDirectoryHandle('Archive', { create: true });
            return `Successfully created folders for 'Dr. ${doctorDisplayName}'.`;
        } else {
            // Different error (e.g., permissions)
            throw e;
        }
    }
}

/**
 * Verifies read/write permission for a folder handle.
 * @param {FileSystemDirectoryHandle} handle - The folder handle to check.
 * @param {boolean} [requestIfNeeded=false] - Whether to prompt the user if permission isn't granted.
 * @returns {Promise<boolean>} True if permission is granted.
 */
window.verifyFolderPermission = async function(handle, requestIfNeeded = false) {
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
 * Saves a new procedure file to the correct "Unprocessed" folder.
 * @param {object} data - The procedure data object.
 * @param {string} filename - The new file's name.
 * @param {string} doctorDisplayName - The doctor to save under.
 */
window.saveFileToFolder = async function(data, filename, doctorDisplayName) {
    if (!saveFolderHandle) {
        throw new Error("No default folder is set.");
    }
    if (!(await verifyFolderPermission(saveFolderHandle, true))) { // Re-request if needed
        throw new Error("Permission to save folder was denied.");
    }

    const folderName = doctorDisplayName.replace(/\s+/g, '_');

    try {
        const doctorDir = await saveFolderHandle.getDirectoryHandle(folderName, { create: false });
        const unprocessedDir = await doctorDir.getDirectoryHandle('Unprocessed', { create: true });
        const fileHandle = await unprocessedDir.getFileHandle(filename, { create: true });
        
        const writable = await fileHandle.createWritable();
        const jsonString = JSON.stringify(data, null, 2);
        await writable.write(jsonString);
        await writable.close();
        
        console.log(`File ${filename} saved to ${folderName}/Unprocessed folder.`);
    } catch (e) {
        console.error(`Error saving file to doctor folder ${folderName}:`, e);
        throw new Error(`Could not find or write to folder for ${doctorDisplayName}.`);
    }
}

/**
 * Overwrites an existing file in its current location.
 * @param {FileSystemFileHandle} fileHandle - The handle of the file to overwrite.
 * @param {object} data - The new data to write.
 * @param {string} doctorDisplayName - The display name of the doctor.
 * @param {string} fromFolder - The folder the file is in (e.g., "Unprocessed").
 */
window.overwriteFile = async function(fileHandle, data, doctorDisplayName, fromFolder) {
     if (!saveFolderHandle) {
        throw new Error("No default folder is set.");
    }
    if (!(await verifyFolderPermission(saveFolderHandle, true))) {
        throw new Error("Permission to save folder was denied.");
    }

    const doctorFolderName = doctorDisplayName.replace(/\s+/g, '_');

    try {
        const doctorDir = await saveFolderHandle.getDirectoryHandle(doctorFolderName);
        const sourceDir = await doctorDir.getDirectoryHandle(fromFolder);
        
        // Use the *existing* fileHandle to overwrite
        const writable = await fileHandle.createWritable();
        await writable.write(JSON.stringify(data, null, 2));
        await writable.close();

        console.log(`Overwrote file ${fileHandle.name} in ${doctorFolderName}/${fromFolder}`);
    } catch (e) {
        console.error('Error overwriting file:', e);
        alert(`Error overwriting file: ${e.message}`);
    }
}

/**
 * Moves a file from one folder to another, writing new data.
 * If toDir is "Archive", it creates Year/Month subfolders.
 * @param {string} fromDir - "Unprocessed" or "Billed"
 * @param {string} toDir - "Billed" or "Archive"
 * @param {FileSystemFileHandle} fileHandle - The original file handle.
 * @param {object} newData - The updated data to save.
 * @param {string} doctorDisplayName - The doctor's display name.
 */
window.moveFile = async function(fromDir, toDir, fileHandle, newData, doctorDisplayName) {
    if (!saveFolderHandle) {
        throw new Error("No default folder is set.");
    }

    const doctorFolderName = doctorDisplayName.replace(/\s+/g, '_');

    try {
        const doctorDir = await saveFolderHandle.getDirectoryHandle(doctorFolderName);
        const fromDirHandle = await doctorDir.getDirectoryHandle(fromDir);
        
        let targetDirHandle;

        // --- NEW ARCHIVE LOGIC ---
        if (toDir === 'Archive') {
            const now = new Date();
            const year = now.getFullYear().toString(); // "2025"
            const month = (now.getMonth() + 1).toString().padStart(2, '0'); // "11"
            const monthName = now.toLocaleString('default', { month: 'short' }); // "Nov"
            const monthFolderName = `${month}-${monthName}`; // "11-Nov"

            // Get/create /Archive
            const archiveDir = await doctorDir.getDirectoryHandle('Archive', { create: true });
            // Get/create /Archive/2025
            const yearDir = await archiveDir.getDirectoryHandle(year, { create: true });
            // Get/create /Archive/2025/11-Nov
            targetDirHandle = await yearDir.getDirectoryHandle(monthFolderName, { create: true });
            
            console.log(`Archiving to: ${doctorFolderName}/Archive/${year}/${monthFolderName}`);

        } else {
            // Standard move (e.g., to "Billed")
            targetDirHandle = await doctorDir.getDirectoryHandle(toDir, { create: true });
        }
        // --- END NEW LOGIC ---
        
        // 1. Write the new/updated file to the destination
        const newFileHandle = await targetDirHandle.getFileHandle(fileHandle.name, { create: true });
        const writable = await newFileHandle.createWritable();
        await writable.write(JSON.stringify(newData, null, 2));
        await writable.close();

        // 2. Delete the old file from the source
        await fromDirHandle.removeEntry(fileHandle.name);

        console.log(`Moved ${fileHandle.name} from ${doctorFolderName}/${fromDir} to ${targetDirHandle.name}`);
    } catch (e) {
        console.error('Error moving file:', e);
        alert(`Error moving file: ${e.message}`);
    }
}
