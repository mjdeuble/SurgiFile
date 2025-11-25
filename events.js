// --- APPLICATION EVENT LISTENERS ---

// This file attaches all event listeners to the DOM elements
// once the page has fully loaded.

document.addEventListener('DOMContentLoaded', () => {
    
    // --- Connect Tab Navigation ---
    if(tabClinicalNoteBtn) tabClinicalNoteBtn.addEventListener('click', () => performSafeAction(() => switchTab('clinical-note')));
    if(tabManualBillingBtn) tabManualBillingBtn.addEventListener('click', () => performSafeAction(() => switchTab('manual-billing')));
    if(tabBillingBtn) tabBillingBtn.addEventListener('click', () => performSafeAction(() => switchTab('billing')));
    if(tabSettingsBtn) tabSettingsBtn.addEventListener('click', () => performSafeAction(() => switchTab('settings'))); // Cogwheel

    // --- Connect Nav Bar Listeners ---
    // New Toggle Switch Listener (on settings page)
    if(pmModeToggleSettings) {
        pmModeToggleSettings.addEventListener('change', () => {
            performSafeAction(() => {
                if (pmModeToggleSettings.checked) {
                    setAppMode('PM');
                } else {
                    setAppMode('Doctor');
                }
            });
        });
    }
    
    if(navDoctorDropdown) navDoctorDropdown.addEventListener('change', handleDoctorChange);


    // --- Connect Entry View Listeners ---
    if(lesionForm) {
        lesionForm.addEventListener('change', updateFormUI);
        lesionForm.addEventListener('input', checkLesionFormCompleteness);
    }
    
    if(addLesionBtn) addLesionBtn.addEventListener('click', addOrUpdateLesion);
    if(cancelEditBtn) cancelEditBtn.addEventListener('click', cancelEdit);

    if(saveProcedureBtn) saveProcedureBtn.addEventListener('click', saveProcedure);
    if(clearProcedureBtn) clearProcedureBtn.addEventListener('click', () => resetAll(true));

    // Copy Buttons
    if(getEl('copy-request-btn')) getEl('copy-request-btn').addEventListener('click', () => copyToClipboard('clinicalRequestOutput', getEl('copy-request-btn-text')));
    if(getEl('copy-note-btn')) getEl('copy-note-btn').addEventListener('click', () => copyToClipboard('entryNoteOutput', getEl('copy-note-btn-text')));
    
    // Suture Logic Listeners
    if(useDeepSutureEl) {
        useDeepSutureEl.addEventListener('change', () => {
            deepSutureContainer.classList.toggle('hidden', !useDeepSutureEl.checked);
            checkLesionFormCompleteness();
        });
    }
    if(useSkinSutureEl) {
        useSkinSutureEl.addEventListener('change', () => {
            skinSutureDetails.classList.toggle('hidden', !useSkinSutureEl.checked);
            checkLesionFormCompleteness();
        });
    }
 
    // Suture Type Dropdown (to show/hide removal box)
    if(skinSutureTypeEl) {
        skinSutureTypeEl.addEventListener('change', () => {
            const removalBox = getEl('skin-suture-removal-container');
            // Check if the selected suture is in the 'skin_dissolvable' list from settings
            const isDissolvable = appSettings.sutures && appSettings.sutures.skin_dissolvable 
                ? appSettings.sutures.skin_dissolvable.includes(skinSutureTypeEl.value)
                : false;
            
            // FIX: Ensure removalBox exists before trying to access style
            if (removalBox) {
                // Show removal box only if a non-dissolvable suture is selected
                if (skinSutureTypeEl.value && !isDissolvable) {
                     removalBox.style.display = 'block';
                     removalBox.classList.remove('hidden');
                } else {
                     removalBox.style.display = 'none';
                     removalBox.classList.add('hidden');
                }
            }
            checkLesionFormCompleteness(); 
        });
    }

    // Output Style Buttons
    if(outputBtnCombined) outputBtnCombined.addEventListener('click', () => setOutputStyle('combined'));
    if(outputBtnSeparate) outputBtnSeparate.addEventListener('click', () => setOutputStyle('separate'));
    
    // Justification Buttons (Event Delegation)
    if(justificationButtons) {
        justificationButtons.addEventListener('click', (e) => {
            if(e.target.classList.contains('justification-btn')) {
                e.target.classList.toggle('selected');
                const selectedButtons = justificationButtons.querySelectorAll('.justification-btn.selected');
                const justifications = Array.from(selectedButtons).map(btn => btn.dataset.text);
                flapGraftJustificationInput.value = justifications.join(' ');
                checkLesionFormCompleteness();
            }
        });
    }

    // Dermoscopy Buttons (Event Delegation)
    if(dermoscopyBtnContainer) {
        dermoscopyBtnContainer.addEventListener('click', (e) => {
            const target = e.target.closest('.dermoscopy-btn');
            if (!target) return;
            getEl('dermoscopyUsed').value = target.dataset.value;
            dermoscopyBtnContainer.querySelectorAll('.dermoscopy-btn').forEach(btn => btn.classList.remove('selected'));
            target.classList.add('selected');
            checkLesionFormCompleteness();
        });
    }

    // --- Connect Billing View Listeners ---
    if(loadFilesBtn) {
        loadFilesBtn.addEventListener('click', async () => {
            // "Refresh Database" re-scans for new doctors first
            if (saveFolderHandle) {
                const doctors = await getDoctorListFromFolders();
                appSettings.doctorList = doctors;
                populateDoctorDropdown(doctors);
            }
            // populateDoctorDropdown already triggers loadBillingFiles via handleDoctorChange
        });
    }
    
    // Search Bars
    if(searchBar) searchBar.addEventListener('input', () => renderFileLists()); // Main search
    if(archiveSearch) archiveSearch.addEventListener('input', () => renderFileLists()); // Archive-only search

    // Collapsible Headers
    if(unprocessedHeader) unprocessedHeader.addEventListener('click', () => unprocessedList.classList.toggle('collapsed'));
    if(billedHeader) billedHeader.addEventListener('click', () => billedList.classList.toggle('collapsed'));
    if(archiveHeader) archiveHeader.addEventListener('click', () => archiveList.classList.toggle('collapsed'));

    // PM Batch Archive
    if(selectAllBtn) selectAllBtn.addEventListener('click', toggleSelectAll);
    if(batchArchiveBtn) batchArchiveBtn.addEventListener('click', archiveBatchFiles);
    
    // Print Buttons
    if(printBilledListBtn) printBilledListBtn.addEventListener('click', window.printBilledList);
    if(printUnprocessedListBtn) printUnprocessedListBtn.addEventListener('click', window.printUnprocessedList); // <-- NEW LISTENER
    
    // Billing Panel Buttons
    if(closeBillingPanelBtn) closeBillingPanelBtn.addEventListener('click', () => billingPanel.classList.add('hidden'));
    if(saveAsBilledBtn) saveAsBilledBtn.addEventListener('click', saveBilledFile);
    if(deleteProcedureBtn) deleteProcedureBtn.addEventListener('click', deleteBillingFile);
    if(moveToArchiveBtn) moveToArchiveBtn.addEventListener('click', archiveBilledFile);
    if(sendBackBtn) sendBackBtn.addEventListener('click', sendBackToDoctor);
    
    // 'No Consult Item' toggle button
    // FIX: Safely access global noConsultBtn using window
    if(window.noConsultBtn) {
        window.noConsultBtn.addEventListener('click', () => {
            const isSelected = window.noConsultBtn.classList.toggle('selected');
            if (isSelected) {
                // Button is ON ("No Consult Item")
                billingConsultItem.value = '';
                billingConsultItem.disabled = true;
                window.noConsultBtn.textContent = 'No Consult Item';
            } else {
                // Button is OFF (User wants to add one)
                billingConsultItem.disabled = false;
                billingConsultItem.focus();
                window.noConsultBtn.textContent = 'Clear Consult Item';
            }
            validateBillingPanel();
        });
    }

    // Listener for consult item input
    if(billingConsultItem) {
        billingConsultItem.addEventListener('input', () => {
             // If user types, deselect the 'No Consult' button
            if (billingConsultItem.value.trim() !== '') {
                if(window.noConsultBtn) {
                    window.noConsultBtn.classList.remove('selected');
                    window.noConsultBtn.textContent = 'Clear Consult Item';
                }
                billingConsultItem.disabled = false;
            }
            validateBillingPanel();
        });
    }
    
    if(editProcedureBtn) {
        editProcedureBtn.addEventListener('click', () => {
            // Get the first lesion from the file and switch to the entry tab to edit
            if (currentBillingFile.data && currentBillingFile.data.lesions.length > 0) {
                lesions = currentBillingFile.data.lesions; // Load all lesions
                patientNameEl.value = currentBillingFile.data.patientName;
                // This function (window.startEditLesion) is defined in entry-view.js
                startEditLesion(lesions[0].id); // Start edit with the first lesion
                billingPanel.classList.add('hidden'); // Close panel
            } else {
                showAppAlert("Error: Cannot find lesion data in this file.", "error");
            }
        });
    }


    // --- Connect Settings View Listeners ---
    if(setSaveFolderBtn) setSaveFolderBtn.addEventListener('click', setSaveFolder);
    if(saveAppSettingsBtn) saveAppSettingsBtn.addEventListener('click', saveAppSettings);
    if(resetAppSettingsBtn) resetAppSettingsBtn.addEventListener('click', resetAppSettings);
    if(addDoctorBtn) {
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
    }

    // --- Connect Modal Listeners ---
    if(pathologyDisplayEl) pathologyDisplayEl.addEventListener('click', openPathologyModal);
    if(confirmPathologyBtn) confirmPathologyBtn.addEventListener('click', confirmPathologySelection);
    
    // Orientation: Main Form Buttons
    if(mainMarkerBtnContainer) {
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
    }

    // Orientation: Modal Buttons (Clock and Directions)
    if(modalLocationSelector) {
        modalLocationSelector.addEventListener('click', (e) => {
            const target = e.target.closest('.direction-btn, .hour-text');
            if (!target) return;

            getEl('orientationDescription').value = target.dataset.value;
            updateOrientationButtons();
            orientationModal.classList.add('hidden');
        });
    }
    if(cancelOrientationBtn) cancelOrientationBtn.addEventListener('click', () => orientationModal.classList.add('hidden'));

    // --- Global Key Press Listeners ---
    document.addEventListener('keydown', (event) => {
        // Check for Ctrl+P (Windows/Linux) or Cmd+P (Mac)
        if ((event.ctrlKey || event.metaKey) && event.key === 'p') {
            
            // Check if we are on the Billing tab
            const isBillingTabActive = billingView.classList.contains('active');
            
            if (isBillingTabActive) {
                // We are on the billing page, so *always* prevent the default browser print dialog.
                event.preventDefault();
                
                // Check Mode to decide which print function to call
                if (currentAppMode === 'PM') {
                    // PM Mode -> Print Ready/Billed List
                    window.printBilledList();
                } else {
                    // Doctor Mode -> Print Unprocessed List
                    window.printUnprocessedList();
                }
            }
            // If not on the billing tab (e.g., Settings, Entry), we do nothing
            // and allow the default browser behavior.
        }
    });


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
    // This call is already happening in db.js onsuccess
    
    // 5. Final UI setup
    updateOutputVisibility();
    updateFormUI();
    formTitle.textContent = `Enter Lesion ${lesionCounter + 1} Details`;
});
