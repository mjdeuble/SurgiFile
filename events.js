// --- APPLICATION EVENT LISTENERS ---

// This file attaches all event listeners to the DOM elements
// once the page has fully loaded.

document.addEventListener('DOMContentLoaded', () => {
    
    // --- Connect Tab Navigation ---
    if(tabClinicalNoteBtn) tabClinicalNoteBtn.addEventListener('click', () => performSafeAction(() => switchTab('clinical-note')));
    if(tabManualBillingBtn) tabManualBillingBtn.addEventListener('click', () => performSafeAction(() => switchTab('manual-billing')));
    if(tabBillingBtn) tabBillingBtn.addEventListener('click', () => performSafeAction(() => switchTab('billing')));
    if(tabSettingsBtn) tabSettingsBtn.addEventListener('click', () => performSafeAction(() => switchTab('settings'))); 

    // --- Connect Nav Bar Listeners ---
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
        
        // Combined Input Listener: Validation + Auto-Save
        let draftSaveTimeout;
        lesionForm.addEventListener('input', () => {
            checkLesionFormCompleteness();

            clearTimeout(draftSaveTimeout);
            draftSaveTimeout = setTimeout(() => {
                if (typeof window.saveDraft === 'function') {
                    window.saveDraft();
                }
            }, 1000);
        });
    }
    
    if(addLesionBtn) addLesionBtn.addEventListener('click', addOrUpdateLesion);
    if(cancelEditBtn) cancelEditBtn.addEventListener('click', cancelEdit);

    if(saveProcedureBtn) saveProcedureBtn.addEventListener('click', saveProcedure);
    if(clearProcedureBtn) clearProcedureBtn.addEventListener('click', () => resetAll(true));

    // Copy Buttons
    if(getEl('copy-request-btn')) getEl('copy-request-btn').addEventListener('click', () => copyToClipboard('clinicalRequestOutput', getEl('copy-request-btn-text')));
    if(getEl('copy-note-btn')) getEl('copy-note-btn').addEventListener('click', () => copyToClipboard('entryNoteOutput', getEl('copy-note-btn-text')));
    
    // Suture Logic
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
 
    // Suture Type Dropdown
    if(skinSutureTypeEl) {
        skinSutureTypeEl.addEventListener('change', () => {
            const removalBox = getEl('skin-suture-removal-container');
            const isDissolvable = appSettings.sutures && appSettings.sutures.skin_dissolvable 
                ? appSettings.sutures.skin_dissolvable.includes(skinSutureTypeEl.value)
                : false;
            
            if (removalBox) {
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
    
    // Justification Buttons
    if(justificationButtons) {
        justificationButtons.addEventListener('click', (e) => {
            if(e.target.classList.contains('justification-btn')) {
                e.target.classList.toggle('selected');
                const selectedButtons = justificationButtons.querySelectorAll('.justification-btn.selected');
                const justifications = Array.from(selectedButtons).map(btn => btn.dataset.text);
                flapGraftJustificationInput.value = justifications.join(' ');
                checkLesionFormCompleteness();
                if (typeof window.saveDraft === 'function') window.saveDraft();
            }
        });
    }

    // Dermoscopy Buttons
    if(dermoscopyBtnContainer) {
        dermoscopyBtnContainer.addEventListener('click', (e) => {
            const target = e.target.closest('.dermoscopy-btn');
            if (!target) return;
            getEl('dermoscopyUsed').value = target.dataset.value;
            dermoscopyBtnContainer.querySelectorAll('.dermoscopy-btn').forEach(btn => btn.classList.remove('selected'));
            target.classList.add('selected');
            checkLesionFormCompleteness();
            if (typeof window.saveDraft === 'function') window.saveDraft();
        });
    }

    // --- Connect Billing View Listeners ---
    if(loadFilesBtn) {
        loadFilesBtn.addEventListener('click', async () => {
            if (saveFolderHandle) {
                const doctors = await getDoctorListFromFolders();
                appSettings.doctorList = doctors;
                populateDoctorDropdown(doctors);
            }
        });
    }
    
    // Search Bars
    if(searchBar) searchBar.addEventListener('input', () => renderFileLists()); 
    if(archiveSearch) archiveSearch.addEventListener('input', () => renderFileLists()); 

    // Collapsible Headers
    if(unprocessedHeader) unprocessedHeader.addEventListener('click', () => unprocessedList.classList.toggle('collapsed'));
    if(billedHeader) billedHeader.addEventListener('click', () => billedList.classList.toggle('collapsed'));
    if(archiveHeader) archiveHeader.addEventListener('click', () => archiveList.classList.toggle('collapsed'));

    // PM Batch Archive
    if(selectAllBtn) selectAllBtn.addEventListener('click', toggleSelectAll);
    if(batchArchiveBtn) batchArchiveBtn.addEventListener('click', archiveBatchFiles);
    
    // Print Buttons
    if(printBilledListBtn) printBilledListBtn.addEventListener('click', window.printBilledList);
    if(printUnprocessedListBtn) printUnprocessedListBtn.addEventListener('click', window.printUnprocessedList);
    
    // Billing Panel Buttons
    if(closeBillingPanelBtn) closeBillingPanelBtn.addEventListener('click', () => billingPanel.classList.add('hidden'));
    if(saveAsBilledBtn) saveAsBilledBtn.addEventListener('click', saveBilledFile);
    if(deleteProcedureBtn) deleteProcedureBtn.addEventListener('click', deleteBillingFile);
    if(moveToArchiveBtn) moveToArchiveBtn.addEventListener('click', archiveBilledFile);
    if(sendBackBtn) sendBackBtn.addEventListener('click', sendBackToDoctor);
    
    // --- UPDATED: Robust Consult Toggle Listener ---
    // We fetch the element directly to ensure we have the right one
    const toggleEl = document.getElementById('consult-toggle');
    if(toggleEl) {
        toggleEl.addEventListener('change', () => {
            window.updateConsultUI();
            if (typeof validateBillingPanel === 'function') {
                validateBillingPanel();
            }
        });
    }

    // Listener for consult item input
    if(billingConsultItem) {
        billingConsultItem.addEventListener('input', () => {
            if (typeof validateBillingPanel === 'function') {
                validateBillingPanel();
            }
        });
    }
    
    if(editProcedureBtn) {
        editProcedureBtn.addEventListener('click', () => {
            if (currentBillingFile.data && currentBillingFile.data.lesions.length > 0) {
                lesions = currentBillingFile.data.lesions; 
                patientNameEl.value = currentBillingFile.data.patientName;
                startEditLesion(lesions[0].id); 
                billingPanel.classList.add('hidden'); 
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
    
    // Orientation Buttons
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
            if (typeof window.saveDraft === 'function') window.saveDraft();
        });
    }

    if(modalLocationSelector) {
        modalLocationSelector.addEventListener('click', (e) => {
            const target = e.target.closest('.direction-btn, .hour-text');
            if (!target) return;

            getEl('orientationDescription').value = target.dataset.value;
            updateOrientationButtons();
            orientationModal.classList.add('hidden');
            if (typeof window.saveDraft === 'function') window.saveDraft();
        });
    }
    if(cancelOrientationBtn) cancelOrientationBtn.addEventListener('click', () => orientationModal.classList.add('hidden'));

    // --- Global Key Press Listeners ---
    document.addEventListener('keydown', (event) => {
        if ((event.ctrlKey || event.metaKey) && event.key === 'p') {
            const isBillingTabActive = billingView.classList.contains('active');
            
            if (isBillingTabActive) {
                event.preventDefault();
                if (currentAppMode === 'PM') {
                    window.printBilledList();
                } else {
                    window.printUnprocessedList();
                }
            }
        }
    });


    // --- INITIAL APP LOAD ---
    if(typeof loadAppSettings === 'function') loadAppSettings(); 
    if(typeof populatePathologyModal === 'function') populatePathologyModal();
    if(typeof drawOrientationClock === 'function') drawOrientationClock();
    
    const savedMode = localStorage.getItem('appMode') || 'Doctor';
    setAppMode(savedMode);
    
    updateOutputVisibility();
    updateFormUI();
    if(formTitle) formTitle.textContent = `Enter Lesion ${lesionCounter + 1} Details`;

    // Check for Auto-Save Draft
    setTimeout(() => {
        if (typeof window.checkForDraft === 'function') {
            window.checkForDraft();
        }
    }, 500);
});

// --- HELPER: Update Consult UI State ---
// Defined globally so billing-view.js can call it
window.updateConsultUI = function() {
    // Fetch elements robustly
    const toggle = document.getElementById('consult-toggle');
    const input = document.getElementById('billing-consult-item');
    const msg = document.getElementById('consult-disabled-msg');

    if (!toggle || !input) return;

    if (toggle.checked) {
        // ON: User wants to bill a consult
        input.style.display = 'block';
        input.disabled = false;
        if (msg) msg.classList.add('hidden');
        // Optional: Focus if empty (can be annoying on open, so maybe skip)
        // if (!input.value) input.focus();
    } else {
        // OFF: User explicitly says NO consult
        input.style.display = 'none';
        input.disabled = true;
        input.value = ''; // Clear value
        input.classList.remove('missing-field'); // Clear error
        if (msg) msg.classList.remove('hidden');
    }
}
