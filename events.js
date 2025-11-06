// --- APPLICATION EVENT LISTENERS ---

// This file attaches all event listeners to the DOM elements
// once the page has fully loaded.

document.addEventListener('DOMContentLoaded', () => {
    
    // --- Connect Tab Navigation ---
    tabClinicalNoteBtn.addEventListener('click', () => switchTab('clinical-note'));
    tabManualBillingBtn.addEventListener('click', () => switchTab('manual-billing'));
    tabBillingBtn.addEventListener('click', () => switchTab('billing'));
    tabSettingsBtn.addEventListener('click', () => switchTab('settings'));

    // --- Connect Nav Bar Listeners ---
    modeBtnDoctor.addEventListener('click', () => setAppMode('Doctor'));
    modeBtnPM.addEventListener('click', () => setAppMode('PM'));
    navDoctorDropdown.addEventListener('change', handleDoctorChange);


    // --- Connect Entry View Listeners ---
    lesionForm.addEventListener('change', updateFormUI);
    lesionForm.addEventListener('input', checkLesionFormCompleteness);
    
    addLesionBtn.addEventListener('click', addOrUpdateLesion);
    cancelEditBtn.addEventListener('click', cancelEdit);

    saveProcedureBtn.addEventListener('click', saveProcedure);
    clearProcedureBtn.addEventListener('click', resetAll);

    // Copy Buttons
    getEl('copy-request-btn').addEventListener('click', () => copyToClipboard('clinicalRequestOutput', getEl('copy-request-btn-text')));
    getEl('copy-note-btn').addEventListener('click', () => copyToClipboard('entryNoteOutput', getEl('copy-note-btn-text')));
    
    // Suture Checkbox Logic
    useNonDissolvableEl.addEventListener('change', () => {
        skinSutureDetails.classList.remove('hidden');
        skinSutureDetailsDissolvable.classList.add('hidden');
        useDissolvableEl.checked = false;
        checkLesionFormCompleteness();
    });
    useDissolvableEl.addEventListener('change', () => {
        skinSutureDetails.classList.add('hidden');
        skinSutureDetailsDissolvable.classList.remove('hidden');
        useNonDissolvableEl.checked = false;
        checkLesionFormCompleteness();
    });

    // Output Style Buttons
    outputBtnCombined.addEventListener('click', () => setOutputStyle('combined'));
    outputBtnSeparate.addEventListener('click', () => setOutputStyle('separate'));
    
    // Justification Buttons (Event Delegation)
    justificationButtons.addEventListener('click', (e) => {
        if(e.target.classList.contains('justification-btn')) {
            e.target.classList.toggle('selected');
            const selectedButtons = justificationButtons.querySelectorAll('.justification-btn.selected');
            const justifications = Array.from(selectedButtons).map(btn => btn.dataset.text);
            flapGraftJustificationInput.value = justifications.join(' ');
            checkLesionFormCompleteness();
        }
    });

    // Dermoscopy Buttons (Event Delegation)
    dermoscopyBtnContainer.addEventListener('click', (e) => {
        const target = e.target.closest('.dermoscopy-btn');
        if (!target) return;
        getEl('dermoscopyUsed').value = target.dataset.value;
        dermoscopyBtnContainer.querySelectorAll('.dermoscopy-btn').forEach(btn => btn.classList.remove('selected'));
        target.classList.add('selected');
        checkLesionFormCompleteness();
    });

    // --- Connect Billing View Listeners ---
    loadFilesBtn.addEventListener('click', async () => {
        // "Refresh Database" re-scans for new doctors first
        if (saveFolderHandle) {
            const doctors = await getDoctorListFromFolders();
            appSettings.doctorList = doctors;
            populateDoctorDropdown(doctors);
        }
        // populateDoctorDropdown already triggers loadBillingFiles via handleDoctorChange
    });
    
    // Search Bars
    searchBar.addEventListener('input', () => renderFileLists()); // Main search
    archiveSearch.addEventListener('input', () => renderFileLists()); // Archive-only search

    // Collapsible Headers
    unprocessedHeader.addEventListener('click', () => unprocessedList.classList.toggle('collapsed'));
    billedHeader.addEventListener('click', () => billedList.classList.toggle('collapsed'));
    archiveHeader.addEventListener('click', () => archiveList.classList.toggle('collapsed'));

    // PM Batch Archive
    batchArchiveBtn.addEventListener('click', archiveBatchFiles);
    
    // Print Button
    printBilledListBtn.addEventListener('click', printBilledList);
    
    // Billing Panel Buttons
    closeBillingPanelBtn.addEventListener('click', () => billingPanel.classList.add('hidden'));
    saveAsBilledBtn.addEventListener('click', saveBilledFile);
    deleteProcedureBtn.addEventListener('click', deleteBillingFile);
    moveToArchiveBtn.addEventListener('click', archiveBilledFile);
    editProcedureBtn.addEventListener('click', () => {
        // Get the first lesion from the file and switch to the entry tab to edit
        if (currentBillingFile.data && currentBillingFile.data.lesions.length > 0) {
            lesions = currentBillingFile.data.lesions; // Load all lesions
            patientNameEl.value = currentBillingFile.data.patientName;
            // This function (window.startEditLesion) is defined in entry-view.js
            startEditLesion(lesions[0].id); // Start edit with the first lesion
            billingPanel.classList.add('hidden'); // Close panel
        } else {
            alert("Error: Cannot find lesion data in this file.");
        }
    });


    // --- Connect Settings View Listeners ---
    setSaveFolderBtn.addEventListener('click', setSaveFolder);
    saveAppSettingsBtn.addEventListener('click', saveAppSettings);
    resetAppSettingsBtn.addEventListener('click', resetAppSettings);
    addDoctorBtn.addEventListener('click', async () => {
        // This just connects the button to the function in file-system.js
        const newName = newDoctorNameInput.value.trim();
        if (!newName) {
            addDoctorStatus.textContent = "Error: Doctor name cannot be empty.";
            addDoctorStatus.className = "text-sm mt-2 text-red-600";
            return;
        }

        try {
            addDoctorStatus.textContent = "Creating folders...";
            addDoctorStatus.className = "text-sm mt-2 text-slate-600";
            
            const result = await addNewDoctorFolder(newName);
            
            addDoctorStatus.textContent = `${result} Please refresh the app.`;
            addDoctorStatus.className = "text-sm mt-2 text-green-600";
            newDoctorNameInput.value = '';

            // Refresh the doctor list in the app state
            const doctors = await getDoctorListFromFolders();
            appSettings.doctorList = doctors;
            populateDoctorDropdown(doctors);

        } catch (e) {
            addDoctorStatus.textContent = `Error: ${e.message}`;
            addDoctorStatus.className = "text-sm mt-2 text-red-600";
        }
    });

    // --- Connect Modal Listeners ---
    pathologyDisplayEl.addEventListener('click', openPathologyModal);
    confirmPathologyBtn.addEventListener('click', confirmPathologySelection);
    
    // Orientation: Main Form Buttons
    mainMarkerBtnContainer.addEventListener('click', (e) => {
        const target = e.target.closest('.main-marker-btn');
        if (!target) return;

        const markerType = target.dataset.value;
        getEl('orientationType').value = markerType;

        if (markerType === 'None') {
            getEl('orientationDescription').value = '';
            updateOrientationButtons();
        } else {
            openOrientationModal();
        }
    });

    // Orientation: Modal Buttons (Clock and Directions)
    modalLocationSelector.addEventListener('click', (e) => {
        const target = e.target.closest('.direction-btn, .hour-text');
        if (!target) return;

        getEl('orientationDescription').value = target.dataset.value;
        updateOrientationButtons();
        orientationModal.classList.add('hidden');
    });
    cancelOrientationBtn.addEventListener('click', () => orientationModal.classList.add('hidden'));


    // --- INITIAL APP LOAD ---
    
    // 1. Load settings from localStorage (or defaults)
    loadAppSettings(); 
    
    // 2. Populate modals with data from settings
    populatePathologyModal();
    drawOrientationClock();
    
    // 3. Restore saved app mode (Doctor/PM)
    const savedMode = localStorage.getItem('appMode') || 'Doctor';
    setAppMode(savedMode);
    
    // 4. Load saved folder handle from IndexedDB
    // This is now called from db.js's onsuccess event, so it's already running.
    // It will, in turn, call populateDoctorDropdown().
    
    // 5. Final UI setup
    updateOutputVisibility();
    updateFormUI();
    formTitle.textContent = `Enter Lesion ${lesionCounter + 1} Details`;
});
