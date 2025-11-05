// --- PWA FILE SYSTEM LOGIC ---

// This file handles all interactions with the File System Access API:
// - Getting/verifying folder permissions
// - Dynamically scanning for doctor folders
// - Adding new doctor folders
// - Reading, writing, and moving procedure .json files

async function setSaveFolder() {
    try {
        const handle = await window.showDirectoryPicker({ mode: 'readwrite' });
        
        // We only need to request permission and save the handle.
        // The "addNewDoctorFolder" function will create subfolders.
        if (await verifyFolderPermission(handle, true)) { // Request permission
            
            await dbSet('saveFolderHandle', handle);
            saveFolderHandle = handle;
            
            console.log('Save folder set:', handle.name);
            folderStatusMsg.textContent = `Status: Saving to "${handle.name}".`;
            folderStatusMsg.classList.remove('text-slate-500', 'text-red-600');
            folderStatusMsg.classList.add('text-green-600');

            // After setting the folder, do an initial scan
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

                // *** THIS IS THE FIX ***
                // Folder is loaded, so scan it for doctors
                appSettings.doctorList = await getDoctorListFromFolders();

            } else {
                console.log('Permission for saved folder was revoked.');
                folderStatusMsg.textContent = 'Status: Permission for saved folder was revoked. Please set it again.';
                folderStatusMsg.classList.add('text-red-600');
                saveFolderHandle = null;
                await dbDel('saveFolderHandle');

                // *** THIS IS THE FIX ***
                // No folder is loaded, so only show the PM
                appSettings.doctorList = [appSettings.pmIdentifier];
            }
        } else {
            // *** THIS IS THE FIX ***
            // No handle was ever saved, so this is a true first load.
            // Only show the PM.
            appSettings.doctorList = [appSettings.pmIdentifier];
        }
    } catch (err) {
        console.error('Error loading saved folder:', err);
        // Fallback in case of other errors
        appSettings.doctorList = [appSettings.pmIdentifier];
    }

    // After all checks, populate the dropdown with the correct list
    populateDoctorDropdown();
}


async function getDoctorListFromFolders() {
    // *** THIS IS THE FIX ***
    // Always start with a fresh list containing *only* the PM
    let dynamicDoctorList = [appSettings.pmIdentifier];

    if (!saveFolderHandle) {
        console.warn("getDoctorListFromFolders: No save folder handle.");
        return dynamicDoctorList; // Return list with just PM
    }

    try {
        for await (const entry of saveFolderHandle.values()) {
            // We only care about directories, and we skip "system" folders
            if (entry.kind === 'directory' && !entry.name.startsWith('.')) {
                // Convert folder name back to display name
                const displayName = entry.name.replace(/_/g, ' ');
                dynamicDoctorList.push(displayName);
            }
        }
        return dynamicDoctorList;
    } catch (e) {
        console.error("Error scanning for doctor folders:", e);
        return dynamicDoctorList; // Return list with just PM on error
    }
}

async function addNewDoctorFolder(doctorDisplayName) {
    if (!saveFolderHandle) {
        throw new Error("Please set the Default Save Folder first.");
    }
    if (doctorDisplayName === appSettings.pmIdentifier) {
        throw new Error("Cannot create a folder for 'Practice Manager'.");
    }

    const folderName = doctorDisplayName.replace(/\s+/g, '_'); // e.g., "Firstname Lastname" -> "Firstname_Lastname"

    try {
        // Check if folder already exists
        await saveFolderHandle.getDirectoryHandle(folderName, { create: false });
        // If the above line *doesn't* throw an error, the folder exists.
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

async function saveFileToFolder(data, filename, doctorDisplayName) {
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

async function overwriteFile(fileHandle, data, doctorDisplayName, fromFolder) {
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

async function moveFile(fromDir, toDir, fileHandle, newData, doctorDisplayName) {
    if (!saveFolderHandle) {
        throw new Error("No default folder is set.");
    }

    const doctorFolderName = doctorDisplayName.replace(/\s+/g, '_');

    try {
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
