// --- MAIN FORM LOGIC ---

// This file controls the "Clinical Entry" and "Manual Billing" tabs, including:
// - All form UI logic (showing/hiding sections)
// - Form validation
// - Adding, updating, and removing lesions
// - Saving the final procedure to a .json file
// - Generating the text for the output notes

/**
 * Updates the visibility of form sections based on dropdown selections
 * and the current mode (Clinical vs. Billing-Only)
 */
window.updateFormUI = function(event) {
    if (event && event.target.id === 'procedureType') {
        const currentProcedure = procedureTypeEl.value;
        // Don't reset the whole form, just the lesion part
        resetLesionForm(false); // Pass false to not reset procedureType
        procedureTypeEl.value = currentProcedure;
        updateOrientationButtons();
    }

    const procedure = procedureTypeEl.value;
    const excisionClosure = excisionClosureTypeEl.value;
    const punchType = punchTypeEl.value;

    // Hide all dynamic sections first
    document.querySelectorAll('.form-section').forEach(el => el.style.display = 'none');
    
    if (!procedure) {
        dynamicOptionsContainer.style.display = 'none';
        checkLesionFormCompleteness(); // Run check to ensure styles are up to date
        return;
    }
    
    // Show the main dynamic container
    dynamicOptionsContainer.style.display = 'block';

    // --- Mode-Specific Field Visibility ---
    if (isBillingOnlyMode) {
        // --- MANUAL BILLING MODE ---
        // Show only the bare minimum for billing
        finalDefectSizeContainer.style.display = 'block';
        
        if (procedure === 'Excision') {
            excisionOptions.style.display = 'block';
            graftTypeContainer.style.display = (excisionClosure === 'Graft Repair' || excisionClosure === 'Graft + Flap') ? 'block' : 'none';
        } else if (procedure === 'Punch') {
            punchOptions.style.display = 'block';
        }
        
    } else {
        // --- FULL CLINICAL NOTE MODE ---
        getEl('full-clinical-fields').style.display = 'block';
        orientationInputContainer.style.display = 'block';

        switch (procedure) {
            case 'Excision':
                excisionOptions.style.display = 'block';
                lesionSizeContainer.style.display = 'block';
                marginContainer.style.display = 'block';
                graftTypeContainer.style.display = (excisionClosure === 'Graft Repair' || excisionClosure === 'Graft + Flap') ? 'block' : 'none';
                justificationContainer.style.display = (excisionClosure === 'Graft Repair' || excisionClosure === 'Flap Repair' || excisionClosure === 'Graft + Flap') ? 'block' : 'none';
                closureDetailsContainer.style.display = (excisionClosure !== 'Secondary Intention') ? 'block' : 'none';
                break;
            case 'Punch':
                punchOptions.style.display = 'block';
                closureDetailsContainer.style.display = 'block';
                if (punchType === 'Punch Biopsy') {
                    punchSizeContainer.style.display = 'block';
                } else {
                    lesionSizeContainer.style.display = 'block';
                    marginContainer.style.display = 'block';
                }
                break;
            case 'Shave':
                lesionSizeContainer.style.display = 'block';
                marginContainer.style.display = 'block';
                break;
            case 'Wedge Excision':
                 lesionSizeContainer.style.display = 'block';
                 marginContainer.style.display = 'block';
                 closureDetailsContainer.style.display = 'block';
                 break;
        }
    }
    
    // Show/hide clinical audit fields (Exclude NMSC, Dermoscopy)
    // We find the parent container and toggle it
    if (clinicalAuditFields) {
        clinicalAuditFields.style.display = isBillingOnlyMode ? 'none' : 'block';
    }
    
    // Show/hide pathology container
    if (pathologyContainer) {
        pathologyContainer.style.display = isBillingOnlyMode ? 'none' : 'block';
    }

    checkLesionFormCompleteness();
}

/**
 * Checks if all required fields are filled.
 * Highlights missing fields with visual cues.
 * @returns {boolean} True if valid, False if missing fields.
 */
window.checkLesionFormCompleteness = function() {
    // Helper to validate a single field
    const validateAndHighlight = (element, isRequired) => {
        let isValid = true;
        if (isRequired) {
            // Special check for patient name (only required for *first* lesion)
             if (element.id === 'patientName' && lesions.length === 0) {
                 if (!element.value) {
                    element.classList.add('missing-field');
                    isValid = false;
                 } else {
                    element.classList.remove('missing-field');
                 }
             // Standard check for all other fields
             } else if (element.id !== 'patientName') {
                 if (!element.value || (element.tagName === 'SELECT' && element.value === "")) {
                    element.classList.add('missing-field');
                    isValid = false;
                } else {
                    element.classList.remove('missing-field');
                }
            }
        } else {
             element.classList.remove('missing-field');
        }
        return isValid;
    };

    let isAllValid = true;
    const getVal = (id) => getEl(id).value;
    const procedure = getVal('procedureType');

    // --- Check for selected doctor ---
    if (currentAppMode === 'Doctor' && (!currentDoctor || currentDoctor === "No doctors found")) {
        isAllValid = false;
        navDoctorDropdown.classList.add('missing-field');
    } else {
        navDoctorDropdown.classList.remove('missing-field');
    }

    if (!procedure) {
        // We don't disable the button anymore, but we return false status
        return false;
    }
    
    // Validate patient name
    isAllValid &= validateAndHighlight(getEl('patientName'), true);

    // --- Validate common fields (required in both modes) ---
    isAllValid &= validateAndHighlight(getEl('lesionLocation'), true);
    isAllValid &= validateAndHighlight(getEl('anatomicalRegion'), true);
    
    if (isBillingOnlyMode) {
        // --- Billing-Only Mode Validation ---
        isAllValid &= validateAndHighlight(getEl('finalDefectSize'), true);
        
         if (procedure === 'Excision') {
            const excisionClosure = getVal('excisionClosureType');
            if (excisionClosure === 'Graft Repair' || excisionClosure === 'Graft + Flap') {
                 isAllValid &= validateAndHighlight(getEl('graftType'), true);
            }
         }

    } else {
        // --- Full Clinical Mode Validation ---
        isAllValid &= validateAndHighlight(getEl('provisionalDiagnoses'), true); // Only required here
        isAllValid &= validateAndHighlight(getEl('localAnesthetic'), true);
        isAllValid &= validateAndHighlight(getEl('dermoscopyUsed'), true);

        switch (procedure) {
            case 'Excision':
            case 'Wedge Excision':
                isAllValid &= validateAndHighlight(getEl('lesionLength'), true);
                isAllValid &= validateAndHighlight(getEl('lesionWidth'), true);
                isAllValid &= validateAndHighlight(getEl('margin'), true);
                const isComplexClosure = getVal('excisionClosureType') === 'Graft Repair' || getVal('excisionClosureType') === 'Flap Repair' || getVal('excisionClosureType') === 'Graft + Flap';
                isAllValid &= validateAndHighlight(getEl('flapGraftJustification'), isComplexClosure);
                if (getVal('excisionClosureType') === 'Graft Repair' || getVal('excisionClosureType') === 'Graft + Flap') {
                    isAllValid &= validateAndHighlight(getEl('graftType'), true);
                }
                if (getVal('excisionClosureType') !== 'Secondary Intention') {
                    // Skin sutures are optional (but checked by default).
                    if (getEl('useSkinSuture').checked) {
                        isAllValid &= validateAndHighlight(getEl('skinSutureSize'), true);
                        isAllValid &= validateAndHighlight(getEl('skinSutureType'), true);
                        
                        // Check if removal is required
                        const skinSutureType = getVal('skinSutureType');
                        if (skinSutureType && appSettings.sutures && appSettings.sutures.skin_dissolvable) {
                             const isDissolvable = appSettings.sutures.skin_dissolvable.includes(skinSutureType);
                             if (!isDissolvable) {
                                 isAllValid &= validateAndHighlight(getEl('removalOfSkinSutures'), true);
                             }
                        } else if (!skinSutureType) {
                            isAllValid = false; // Force false if type not selected
                        }
                    }
                }
                break;
            case 'Punch':
                if (getVal('punchType') === 'Punch Biopsy') {
                    isAllValid &= validateAndHighlight(getEl('punchSize'), true);
                } else { // Punch Excision
                    isAllValid &= validateAndHighlight(getEl('lesionLength'), true);
                    isAllValid &= validateAndHighlight(getEl('lesionWidth'), true);
                    isAllValid &= validateAndHighlight(getEl('margin'), true);
                }
                if (getEl('useSkinSuture').checked) {
                    isAllValid &= validateAndHighlight(getEl('skinSutureSize'), true);
                    isAllValid &= validateAndHighlight(getEl('skinSutureType'), true);
                    
                    // Check if removal is required
                    const skinSutureType = getVal('skinSutureType');
                     if (skinSutureType && appSettings.sutures && appSettings.sutures.skin_dissolvable) {
                         const isDissolvable = appSettings.sutures.skin_dissolvable.includes(skinSutureType);
                         if (!isDissolvable) {
                             isAllValid &= validateAndHighlight(getEl('removalOfSkinSutures'), true);
                         }
                    } else if (!skinSutureType) {
                         isAllValid = false; // Force false if type not selected
                    }
                }
                break;
            case 'Shave':
                isAllValid &= validateAndHighlight(getEl('lesionLength'), true);
                isAllValid &= validateAndHighlight(getEl('lesionWidth'), true);
                isAllValid &= validateAndHighlight(getEl('margin'), true);
                break;
        }
    }
    
    // CHANGE: We no longer disable the button. We let the user click it to trigger validation feedback.
    // addLesionBtn.disabled = !isAllValid;
    return isAllValid;
}


// --- DATA LOGIC ---

/**
 * Collects data from the form and adds or updates a lesion in the `lesions` array.
 */
window.addOrUpdateLesion = function() {
    // --- NEW: Validation Check & Guidance ---
    if (!checkLesionFormCompleteness()) {
        // Validation failed. Find the first missing field.
        const firstMissing = document.querySelector('.missing-field');
        if (firstMissing) {
            // Scroll to it
            firstMissing.scrollIntoView({ behavior: 'smooth', block: 'center' });
            firstMissing.focus();
            
            // Shake animation
            firstMissing.classList.add('shake');
            setTimeout(() => firstMissing.classList.remove('shake'), 500);
            
            showAppAlert("Please complete the highlighted required fields.", "error");
        } else {
            showAppAlert("Please select a Procedure Type.", "error");
        }
        return; // Stop execution
    }
    // --- End Validation ---

    const isUpdating = editingLesionId !== null;
    const getVal = id => getEl(id).value;
    const getChecked = id => getEl(id).checked;
    
    // --- Defect Size Calculation ---
    let defectSize = 0;
    if (isBillingOnlyMode) {
        defectSize = parseFloat(getVal('finalDefectSize')) || 0;
    } else {
        const length = parseFloat(getVal('lesionLength')) || 0;
        const width = parseFloat(getVal('lesionWidth')) || 0;
        const margin = parseFloat(getVal('margin')) || 0;
        if (getVal('procedureType') === 'Punch' && getVal('punchType') === 'Punch Biopsy') {
            defectSize = parseFloat(getVal('punchSize')) || 0;
        } else {
            // Defect size is the longest axis of the lesion + 2x margin
            defectSize = Math.max(length, width) + (2 * margin);
        }
    }
    
    // --- Suture Logic ---
    let skinSutureDetails = {};
    if (!isBillingOnlyMode) {
        const skinSutureType = getVal('skinSutureType');
        const isSkinSutureDissolvable = appSettings.sutures.skin_dissolvable.includes(skinSutureType);
        
        skinSutureDetails = {
            useDeepSuture: getChecked('useDeepSuture'),
            deepSutureSize: getVal('deepSutureSize'),
            deepSutureType: getVal('deepSutureType'),
            useSkinSuture: getChecked('useSkinSuture'),
            useDissolvable: isSkinSutureDissolvable, // This is a derived flag
            skinSutureSize: getChecked('useSkinSuture') ? getVal('skinSutureSize') : null,
            skinSutureType: getChecked('useSkinSuture') ? skinSutureType : 'None',
            skinSutureRemoval: getChecked('useSkinSuture') && !isSkinSutureDissolvable ? getVal('removalOfSkinSutures') : null,
        };
    }

    const lesionData = {
        id: isUpdating ? editingLesionId : ++lesionCounter,
        billingOnly: isBillingOnlyMode, // Set the flag
        procedure: getVal('procedureType'),
        excisionClosureType: getVal('excisionClosureType'),
        punchType: getVal('punchType'),
        graftType: getVal('graftType'),
        justification: isBillingOnlyMode ? '' : getVal('flapGraftJustification'),
        location: getVal('lesionLocation'),
        anatomicalRegion: getVal('anatomicalRegion'),
        anesthetic: isBillingOnlyMode ? '' : getVal('localAnesthetic'),
        pathology: isBillingOnlyMode ? 'Manual Billing Entry' : getVal('provisionalDiagnoses'),
        excludeNMSC: isBillingOnlyMode ? false : getChecked('excludeNMSC'),
        excludeMelanoma: isBillingOnlyMode ? false : getChecked('excludeMelanoma'),
        dermoscopyUsed: isBillingOnlyMode ? 'N' : getVal('dermoscopyUsed'),
        length: isBillingOnlyMode ? '' : getVal('lesionLength'),
        width: isBillingOnlyMode ? '' : getVal('lesionWidth'),
        margin: isBillingOnlyMode ? '' : getVal('margin'),
        punchSize: isBillingOnlyMode ? '' : getVal('punchSize'),
        defectSize: defectSize, // Save the calculated defect size
        orientationType: isBillingOnlyMode ? 'None' : getVal('orientationType'),
        orientationDescription: isBillingOnlyMode ? '' : getVal('orientationDescription'),
        ...skinSutureDetails
    };


    if (isUpdating) {
        const index = lesions.findIndex(l => l.id === editingLesionId);
        lesions[index] = lesionData;
    } else {
        lesions.push(lesionData);
    }
    
    // Clear patient name red border after adding first lesion
    patientNameEl.classList.remove('missing-field');

    updateAllOutputs();
    resetLesionForm();
    saveDraft(); // <-- SAVE DRAFT ON SUCCESSFUL ADD/UPDATE
}

/**
 * Saves the entire procedure (patient info + all lesions) to a .json file.
 */
window.saveProcedure = async function() {
    // --- Check for unsaved lesion in progress ---
    if (procedureTypeEl.value !== '') {
        if (!await showAppConfirm("You have an unsaved lesion in progress. Do you want to save the procedure without adding this last lesion?", "warning")) {
            return; // User wants to finish the lesion first
        }
    }

    const patientName = patientNameEl.value.trim();
    
    let doctorDisplayName = '';
    if (currentAppMode === 'PM') {
        console.error("Save button was clicked in PM mode. This shouldn't happen.");
        return;
    } else {
        doctorDisplayName = currentDoctor;
    }

    if (!doctorDisplayName || doctorDisplayName === "No doctors found") {
        showAppAlert("No doctor selected. Please select a doctor from the dropdown in the top navigation bar.", "error");
        navDoctorDropdown.classList.add('missing-field');
        return;
    } else {
        navDoctorDropdown.classList.remove('missing-field');
    }
    
    let isValid = true;
    if (!patientName) {
        patientNameEl.classList.add('missing-field');
        isValid = false;
    } else {
        patientNameEl.classList.remove('missing-field');
    }

    if (lesions.length === 0) {
        showAppAlert('Please add at least one lesion before saving.', "error");
        isValid = false;
    }

    if (!isValid) return;
    
    // --- NEW: Combine Patient Name and DOB ---
    const patientDOB = patientDOBEl.value;
    let finalPatientName = patientName;
    if (patientDOB) {
        // Store DOB in formatted AU string for consistency if needed, or keep raw
        // For the filename/display, we append it
        finalPatientName = `${patientName} (${window.formatDateToAU(patientDOB)})`; 
    }
    // --- End NEW ---

    // --- Determine Procedure Date ---
    let procedureDateStr = new Date().toISOString(); // Default to now
    if (isBillingOnlyMode) {
        const manualDateInput = getEl('procedureDate');
        if (manualDateInput && manualDateInput.value) {
            // Use the date from the input, but keep the current time
            const datePart = manualDateInput.value;
            // Create date object to ensure local time is respected or use ISO string simply
            // Ideally we want YYYY-MM-DD from input
            const timePart = new Date().toISOString().split('T')[1];
            procedureDateStr = `${datePart}T${timePart}`;
        }
    }

    const procedureRecord = {
        procedureId: editingProcedureFile ? editingProcedureFile.data.procedureId : Date.now(),
        doctorCode: doctorDisplayName,
        patientName: finalPatientName, // Use the combined name
        procedureDate: procedureDateStr, // Use the determined date
        lesions: lesions,
        status: 'Unprocessed'
    };

    const filename = `${doctorDisplayName.replace(/\s+/g, '_')}_${procedureRecord.procedureId}.json`;

    try {
        if (editingProcedureFile) {
            if (editingProcedureFile.fromDoctor !== doctorDisplayName) {
                procedureRecord.procedureId = Date.now(); // Brand new ID
                const newFilename = `${doctorDisplayName.replace(/\s+/g, '_')}_${procedureRecord.procedureId}.json`;
                await saveFileToFolder(procedureRecord, newFilename, doctorDisplayName);
                showAppAlert(`Doctor was changed. A new procedure file has been created for ${doctorDisplayName}. The original file for ${editingProcedureFile.fromDoctor} is unmodified.`, "success");
            } else {
                await overwriteFile(editingProcedureFile.handle, procedureRecord, editingProcedureFile.fromDoctor, editingProcedureFile.fromFolder);
                showAppAlert(`Procedure for ${finalPatientName} has been updated.`, "success");
            }
        } else {
            await saveFileToFolder(procedureRecord, filename, doctorDisplayName);
            showAppAlert(`Procedure for ${finalPatientName} saved to "Unprocessed" billing for Dr. ${doctorDisplayName}.`, "success");
        }
        
        clearDraft(); // <-- CLEAR DRAFT ON SUCCESSFUL SAVE
        resetAll(false); // Pass false to NOT ask for confirmation
        switchTab('billing');

    } catch (err) {
        console.warn('Could not save to folder.', err.message);
        showAppAlert(`Error: ${err.message}\n\nCould not save to default folder.`, "error");
    }
}


/**
 * Generates the clinical request text (for pathology).
 * @returns {string} The formatted text.
 */
window.generateClinicalRequest = function() {
    if (lesions.length === 0) {
        return 'Your clinical request will appear here...';
    }

    return lesions.map(lesion => {
        // --- UPDATED: Show summary even for billing-only ---
        // if (lesion.billingOnly) {
        //     return `Lesion ${lesion.id} (${lesion.location}) was entered for billing-only. No clinical note.`;
        // }

        const auditParts = [];
        auditParts.push(lesion.location);
        auditParts.push(lesion.pathology);

        if (lesion.excludeNMSC) auditParts.push('ex NMSC');
        if (lesion.excludeMelanoma) auditParts.push('ex MEL');

        let managementCode = 'O'; // Default to Other
        switch (lesion.procedure) {
            case 'Excision':
                switch (lesion.excisionClosureType) {
                    case 'Ellipse': managementCode = 'E'; break;
                    case 'Flap Repair': managementCode = 'F'; break;
                    case 'Graft Repair': managementCode = lesion.graftType === 'Split-Skin Graft (SSG)' ? 'SSG' : 'FTG'; break;
                    case 'Graft + Flap': managementCode = (lesion.graftType === 'Split-Skin Graft (SSG)' ? 'SSG' : 'FTG') + '+F'; break;
                    case 'Secondary Intention': managementCode = 'NC'; break;
                }
                break;
            case 'Punch':
                managementCode = lesion.punchType === 'Punch Biopsy' ? 'PS' : 'PR';
                break;
            case 'Shave':
                managementCode = 'SxEx';
                break;
            case 'Wedge Excision':
                managementCode = 'Wedge';
                break;
        }
        auditParts.push(managementCode);
        
        if (lesion.dermoscopyUsed) {
            auditParts.push(`D=${lesion.dermoscopyUsed}`);
        }
        
        const dimensionParts = [];
        let diameter = 0;
        
        let procedureNameFull = lesion.procedure;
        if (lesion.procedure === 'Excision') procedureNameFull = `Excision (${lesion.excisionClosureType})`;
        if (lesion.procedure === 'Punch') procedureNameFull = lesion.punchType;
        if (lesion.procedure === 'Shave') procedureNameFull = 'Shave Excision';
        dimensionParts.push(procedureNameFull);

        if (lesion.procedure === 'Punch' && lesion.punchType === 'Punch Biopsy') {
            dimensionParts.push(`Punch: ${lesion.punchSize}mm`);
            diameter = parseFloat(lesion.punchSize);
        } else if (lesion.billingOnly) {
             // For billing-only, we just have the final defect size
             diameter = lesion.defectSize;
        } else {
            dimensionParts.push(`${lesion.length}x${lesion.width}mm`);
            dimensionParts.push(`Margin: ${lesion.margin}mm`);
            diameter = lesion.defectSize; // Use pre-calculated defect size
        }

        if (diameter > 0) {
            dimensionParts.push(`Dia: ${diameter.toFixed(2)}mm`);
        }

        if (lesion.orientationType && lesion.orientationType !== 'None') {
            dimensionParts.push(`${lesion.orientationType}: ${lesion.orientationDescription}`);
        }
        
        const dimensionString = `[${dimensionParts.join(', ')}]`;

        return `${lesion.id}. ${auditParts.join('; ')} ${dimensionString}`;
    }).join('\n');
}

/**
 * Generates the full operation note text.
 * @returns {string} The formatted text.
 */
window.generateEntryNote = function() {
    if (lesions.length === 0) {
        return 'Your generated note will appear here...';
    }
    
    // --- UPDATED: Use new combined name ---
    const patientName = patientNameEl.value.trim();
    const patientDOB = patientDOBEl.value;
    let finalPatientName = patientName;
    if (patientDOB) {
        finalPatientName = `${patientName} (${window.formatDateToAU(patientDOB)})`;
    }
    // --- End Update ---
    
    const doctorCode = (currentAppMode === 'Doctor') ? currentDoctor : 'Practice Manager';

    let header = "PATIENT: " + (finalPatientName || "N/A") + "\n";
    header += "DOCTOR: " + (doctorCode || "N/A") + "\n\n";

    // Filter out billing-only lesions
    const clinicalLesions = lesions.filter(l => !l.billingOnly);
    
    if (clinicalLesions.length === 0) {
        return `${header}No clinical note to generate. All entries are for billing-only.`;
    }

    const procedureDetails = clinicalLesions.map(lesion => {
        let procedureTitle = '';
        let findingsStr = '';
        const closureParts = [];
        const findingsParts = [];

        if (lesion.useDeepSuture) {
            closureParts.push(`Deep closure with ${lesion.deepSutureSize} ${lesion.deepSutureType}.`);
        }
        
        if (lesion.useSkinSuture) {
             closureParts.push(`Skin closed with ${lesion.skinSutureSize} ${lesion.skinSutureType}.`);
        }

        switch (lesion.procedure) {
            case 'Excision':
            case 'Wedge Excision':
                procedureTitle = `${lesion.procedure} with ${lesion.excisionClosureType}`;
                findingsParts.push(`A ${lesion.length}x${lesion.width}mm lesion excised with ${lesion.margin}mm clinical margins.`);
                if (lesion.justification) {
                    findingsParts.push(`Justification for complex closure: ${lesion.justification}`);
                }
                if (lesion.excisionClosureType === 'Secondary Intention') {
                    closureParts.push('Wound left to heal by secondary intention.');
                } else {
                     if (lesion.excisionClosureType === 'Graft Repair' || lesion.excisionClosureType === 'Graft + Flap') {
                         closureParts.push(`Defect repaired with a ${lesion.graftType}.`);
                     }
                     if (lesion.excisionClosureType === 'Flap Repair' || lesion.excisionClosureType === 'Graft + Flap') {
                         if (!closureParts.some(p => p.includes('repaired with'))) {
                             closureParts.push(`Defect repaired with a flap.`);
                         } else {
                             closureParts[closureParts.length - 1] += ' and a flap.';
                         }
                     }
                }
                break;
            case 'Punch':
                procedureTitle = lesion.punchType;
                if (lesion.punchType === 'Punch Biopsy') {
                    findingsParts.push(`A ${lesion.punchSize}mm punch biopsy was taken from the lesion site.`);
                } else { // Punch Excision
                    findingsParts.push(`A ${lesion.length}x${lesion.width}mm lesion was excised via punch technique with a ${lesion.margin}mm margin.`);
                }
                break;
            case 'Shave':
                procedureTitle = 'Shave Excision';
                findingsParts.push(`A ${lesion.length}x${lesion.width}mm lesion was removed via shave technique with ${lesion.margin}mm clinical margins.`);
                closureParts.push('Hemostasis achieved. Left to heal by secondary intention.');
                break;
        }
        
        let specimenText = `Sent for histopathology, labelled as "${lesion.id}. ${lesion.location}".`;
        if (lesion.orientationType && lesion.orientationType !== 'None') {
            specimenText += ` Orientation marker (${lesion.orientationType}) at ${lesion.orientationDescription}.`;
        }

        let regionText = "N/A";
        if (lesion.anatomicalRegion) {
            const option = Array.from(anatomicalRegionEl.options).find(opt => opt.value === lesion.anatomicalRegion);
            if (option) regionText = option.text;
        }

        return `
PROCEDURE ${lesion.id}: ${procedureTitle} of the ${lesion.location}
- Anatomical Region: ${regionText}
- Consent: Obtained after discussion of risks, benefits, and alternatives.
- Anesthetic: ${lesion.anesthetic} administered.
- Prep: Site prepped and draped in a sterile manner.
- Findings: ${findingsParts.join(' ')}
- Closure: ${closureParts.length > 0 ? closureParts.join(' ') : 'N/A'}
- Specimen: ${specimenText}
`.trim();
    }).join('\n\n');

    const planItems = [];
    clinicalLesions.forEach(l => {
        let needsPlan = false;
        let planText = '';

        if (l.procedure === 'Excision' && l.excisionClosureType !== 'Secondary Intention') needsPlan = true;
        if (l.procedure === 'Wedge Excision') needsPlan = true;
        if (l.procedure === 'Punch') needsPlan = true;
        
        if(needsPlan && l.useSkinSuture) {
             if (l.useDissolvable) {
                 planText = `- Wound for lesion ${l.id} (${l.location}) closed with dissolvable skin sutures which do not require removal.`;
             } else if (l.skinSutureRemoval) { // This implies non-dissolvable
                 planText = `- Sutures for lesion ${l.id} (${l.location}) to be removed in ${l.skinSutureRemoval} days.`;
             }
             if(planText) planItems.push(planText);
        }
    });
    
    const openWoundLesions = clinicalLesions.filter(l => (l.procedure === 'Shave' || (l.procedure === 'Excision' && l.excisionClosureType === 'Secondary Intention')));
    if (openWoundLesions.length > 0) {
         planItems.push('- For open wounds, advised to keep clean and apply antiseptic/dressing as needed.');
    }

    const note = `
${header}OBJECTIVE:
${procedureDetails}

Follow up:
${planItems.length > 0 ? planItems.join('\n') : '- General wound care advice given.'}
- Discussed signs of infection (redness, swelling, discharge, increasing pain) and to seek review if these occur.
- Follow-up for results and further management as required.
    `;

    return note.trim().replace(/^\s+/gm, '');
}

// --- FORM MANAGEMENT ---

/**
 * Populates the form to edit a lesion.
 * @param {number} id - The ID of the lesion to edit.
 */
window.startEditLesion = function(id) {
    const lesion = lesions.find(l => l.id === id);
    if (!lesion) return;

    if (currentBillingFile.handle) {
        setAppMode('Doctor');
        navDoctorDropdown.value = currentBillingFile.fromDoctor;
        handleDoctorChange(); // Update state
        
        // --- UPDATED: Lock new toggle ---
        pmModeToggleSettings.checked = false;
        pmModeToggleSettings.disabled = true;
        navDoctorDropdown.disabled = true;
        
        editingProcedureFile = {
            handle: currentBillingFile.handle,
            data: currentBillingFile.data,
            fromFolder: currentBillingFile.fromFolder,
            fromDoctor: currentBillingFile.fromDoctor
        };
        editingLesionId = id;
    } else {
        editingLesionId = id;
    }
    
    // --- NEW: Populate Patient Name and DOB ---
    const rawPatientName = currentBillingFile.data.patientName || patientNameEl.value; // Get name from file or form
    
    // Extract DOB from "Name (DD/MM/YYYY)" format
    const dobMatch = rawPatientName.match(/\(([^)]+)\)$/); // Regex to find content in last parentheses
    
    if (dobMatch) {
        // Found a DOB string like "25/12/1980"
        const dobStr = dobMatch[1];
        
        // We need to convert "DD/MM/YYYY" back to "YYYY-MM-DD" for the HTML input
        const parts = dobStr.split('/');
        if (parts.length === 3) {
             patientDOBEl.value = `${parts[2]}-${parts[1]}-${parts[0]}`;
        } else {
             patientDOBEl.value = ''; // Could not parse
        }
        
        patientNameEl.value = rawPatientName.substring(0, dobMatch.index).trim(); // Set name field
    } else {
        // No DOB found
        patientNameEl.value = rawPatientName;
        patientDOBEl.value = ''; // Clear DOB field
    }
    // --- End NEW ---

    const setVal = (elId, val) => getEl(elId).value = val;
    const setChecked = (elId, val) => getEl(elId).checked = val;

    isBillingOnlyMode = lesion.billingOnly;
    if (isBillingOnlyMode) {
        switchTab('manual-billing');
    } else {
        switchTab('clinical-note');
    }
    setVal('finalDefectSize', lesion.defectSize);

    setVal('procedureType', lesion.procedure);
    updateFormUI(); 
    setVal('excisionClosureType', lesion.excisionClosureType);
    setVal('punchType', lesion.punchType);
    setVal('graftType', lesion.graftType);
    setVal('flapGraftJustification', lesion.justification);
    
    justificationButtons.querySelectorAll('.justification-btn').forEach(btn => {
        if (lesion.justification && lesion.justification.includes(btn.dataset.text)) {
            btn.classList.add('selected');
        } else {
            btn.classList.remove('selected');
        }
    });

    setVal('lesionLocation', lesion.location);
    setVal('anatomicalRegion', lesion.anatomicalRegion);
    setVal('localAnesthetic', lesion.anesthetic);
    
    setVal('provisionalDiagnoses', lesion.pathology);
    if (lesion.pathology && lesion.pathology !== 'Manual Billing Entry') {
        pathologyDisplayEl.textContent = lesion.pathology.replace(/;/g, ', ');
        pathologyDisplayEl.classList.remove('italic', 'text-slate-500');
    }
    
    setVal('lesionLength', lesion.length);
    setVal('lesionWidth', lesion.width);
    setVal('margin', lesion.margin);
    setVal('punchSize', lesion.punchSize);
    setVal('orientationType', lesion.orientationType);
    setVal('orientationDescription', lesion.orientationDescription);
    updateOrientationButtons();
    
    setChecked('excludeNMSC', lesion.excludeNMSC);
    setChecked('excludeMelanoma', lesion.excludeMelanoma);
    setVal('dermoscopyUsed', lesion.dermoscopyUsed);
    document.querySelectorAll('#dermoscopy-btn-container .dermoscopy-btn').forEach(btn => {
        btn.classList.toggle('selected', btn.dataset.value === lesion.dermoscopyUsed);
    });

    if (!isBillingOnlyMode) {
        setChecked('useDeepSuture', lesion.useDeepSuture);
        setVal('deepSutureSize', lesion.deepSutureSize);
        setVal('deepSutureType', lesion.deepSutureType);
        
        setChecked('useSkinSuture', lesion.useSkinSuture);
        
        deepSutureContainer.classList.toggle('hidden', !lesion.useDeepSuture);
        skinSutureDetails.classList.toggle('hidden', !lesion.useSkinSuture);

        if(lesion.useSkinSuture) {
            setVal('skinSutureSize', lesion.skinSutureSize);
            setVal('skinSutureType', lesion.skinSutureType);
            
            const isDissolvable = appSettings.sutures.skin_dissolvable.includes(lesion.skinSutureType);
            const removalBox = getEl('skin-suture-removal-container');
            // --- FIX: Use style.display to show/hide ---
            removalBox.style.display = (lesion.skinSutureType && !isDissolvable) ? 'block' : 'none';
            setVal('removalOfSkinSutures', lesion.skinSutureRemoval);
        }
    }
    
    updateFormUI(); 
    
    formTitle.textContent = `Editing Lesion ${id}`;
    addLesionBtn.textContent = 'Update Lesion';
    saveProcedureBtn.textContent = 'Update Procedure in Billing';
    cancelEditBtn.style.display = 'block';
    clearProcedureBtn.style.display = 'none';
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

/**
 * Cancels the edit and resets the form.
 */
window.cancelEdit = async function() {
    if (editingProcedureFile && hasUnsavedChanges()) {
        if (!await showAppConfirm("You have made changes to this lesion. Cancelling will discard them. Are you sure?", "warning")) {
            return;
        }
    }

    resetLesionForm();
    
    // --- NEW: Clear patient fields on cancel ---
    patientNameEl.value = '';
    patientDOBEl.value = '';
    
    pmModeToggleSettings.disabled = false;
    navDoctorDropdown.disabled = false;
    
    editingLesionId = null;
    editingProcedureFile = null; 
    currentBillingFile = { handle: null, data: null, fromFolder: '', fromDoctor: '' };
    
    clearDraft(); // <-- CLEAR DRAFT
}

/**
 * Resets just the lesion-specific form fields.
 */
window.resetLesionForm = function(resetProcType = true) {
    editingLesionId = null;

    const dynamicFields = ['lesionLocation', 'anatomicalRegion', 'lesionLength', 'lesionWidth', 'margin', 'punchSize', 'finalDefectSize', 'flapGraftJustification', 'provisionalDiagnoses', 'dermoscopyUsed', 'orientationType', 'orientationDescription', 'removalOfSkinSutures'];
    dynamicFields.forEach(id => {
        if (getEl(id)) getEl(id).value = '';
    });
    
    const checkboxes = ['excludeNMSC', 'excludeMelanoma', 'useDeepSuture'];
    checkboxes.forEach(id => {
        if (getEl(id)) getEl(id).checked = false;
    });
    if (getEl('useSkinSuture')) getEl('useSkinSuture').checked = true; // Default

    if (getEl('deepSutureContainer')) deepSutureContainer.classList.add('hidden');
    if (getEl('skinSutureDetails')) skinSutureDetails.classList.remove('hidden');
    if (getEl('skin-suture-removal-container')) skinSutureRemovalContainer.style.display = 'none'; 

    if(resetProcType && getEl('procedureType')) getEl('procedureType').selectedIndex = 0;
    if (getEl('excisionClosureType')) getEl('excisionClosureType').selectedIndex = 0;
    if (getEl('punchType')) getEl('punchType').selectedIndex = 0;
    if (getEl('graftType')) getEl('graftType').selectedIndex = 0;
    if (getEl('localAnesthetic')) getEl('localAnesthetic').selectedIndex = 0;
    if (getEl('deepSutureSize')) getEl('deepSutureSize').value = '4/0';
    if (getEl('deepSutureType')) getEl('deepSutureType').selectedIndex = 0;
    if (getEl('skinSutureSize')) getEl('skinSutureSize').value = '5/0';
    if (getEl('skinSutureType')) getEl('skinSutureType').value = ''; 
    if (getEl('anatomicalRegion')) getEl('anatomicalRegion').selectedIndex = 0;

    if (getEl('pathologyDisplay')) {
        pathologyDisplayEl.textContent = 'Click to select...';
        pathologyDisplayEl.classList.add('italic', 'text-slate-500');
    }
    if (getEl('dermoscopy-btn-container')) {
        document.querySelectorAll('.dermoscopy-btn').forEach(btn => btn.classList.remove('selected'));
    }
    if (getEl('justification-buttons')) {
         document.querySelectorAll('.justification-btn').forEach(btn => btn.classList.remove('selected'));
    }
    
    if (getEl('orientationType')) {
        getEl('orientationType').value = 'None';
        updateOrientationButtons();
    }
    
    formTitle.textContent = `Enter Lesion ${lesionCounter + 1} Details`;
    addLesionBtn.textContent = 'Add Lesion';
    saveProcedureBtn.textContent = 'Save Procedure to Billing';
    cancelEditBtn.style.display = 'none';
    clearProcedureBtn.style.display = 'block';
    
    updateFormUI();
    checkLesionFormCompleteness();
    saveDraft(); // <-- UPDATE DRAFT
}

/**
 * Resets the entire form, including patient info and all lesions.
 * @param {boolean} [askConfirmation=true] - Whether to ask for user confirmation if data exists.
 */
window.resetAll = async function(askConfirmation = true) {
    if (askConfirmation && hasUnsavedChanges()) {
        if (!await showAppConfirm("Are you sure you want to clear all procedure details? This cannot be undone.", "warning")) {
            return;
        }
    }

    lesions = [];
    lesionCounter = 0;
    patientNameEl.value = '';
    patientDOBEl.value = ''; // <-- ADDED
    patientNameEl.classList.remove('missing-field');
    
    pmModeToggleSettings.disabled = false;
    navDoctorDropdown.disabled = false;

    editingLesionId = null;
    editingProcedureFile = null; 
    currentBillingFile = { handle: null, data: null, fromFolder: '', fromDoctor: '' };
    
    clearDraft(); // <-- CLEAR DRAFT
    resetLesionForm();
    updateAllOutputs();
}

/**
 * Copies text from a textarea to the clipboard.
 * @param {string} elementId - The ID of the textarea.
 * @param {HTMLElement} buttonTextElement - The <span> inside the copy button.
 */
window.copyToClipboard = function(elementId, buttonTextElement) {
    const outputElement = getEl(elementId);
    if (!outputElement.value || outputElement.value.startsWith('Your')) return;
    
    outputElement.select();
    outputElement.setSelectionRange(0, 99999);
    
    try {
        document.execCommand('copy');
        const originalText = buttonTextElement.textContent;
        buttonTextElement.textContent = 'Copied!';
        setTimeout(() => {
            buttonTextElement.textContent = originalText;
        }, 2000);
    } catch (err) {
        console.error('Failed to copy text: ', err);
    }
    window.getSelection().removeAllRanges();
}

/**
 * Sets the output style (combined or separate) in localStorage.
 * @param {string} style - "combined" or "separate".
 */
window.setOutputStyle = function(style) {
    localStorage.setItem('medicalNoteGeneratorOutputStyle', style);
    updateOutputVisibility();
}

/**
 * Shows/hides the output textareas based on the selected style.
 */
window.updateOutputVisibility = function() {
    const style = localStorage.getItem('medicalNoteGeneratorOutputStyle') || 'combined';
    
    outputBtnCombined.classList.toggle('selected', style === 'combined');
    outputBtnSeparate.classList.toggle('selected', style === 'separate');

    if (style === 'separate') {
        clinicalRequestWrapper.style.display = 'block';
        generatedNoteWrapper.style.display = 'block';
        entryNoteOutputEl.value = generateEntryNote();
        clinicalRequestOutputEl.value = generateClinicalRequest();
    } else { // Combined
        clinicalRequestWrapper.style.display = 'none';
        generatedNoteWrapper.style.display = 'block';
        
        const note = generateEntryNote();
        const request = generateClinicalRequest();

        const noteText = note.startsWith('Your') ? '' : note;
        // --- FIX: Typo 'F' was here ---
        const requestText = request.startsWith('Your') ? '' : `\n\n---\nCLINICAL REQUEST:\n${request}`;
        
        if (noteText || requestText) {
            entryNoteOutputEl.value = noteText + requestText;
        } else {
            entryNoteOutputEl.value = 'Your clinical request and note will appear here...';
        }
    }
    
    // Final check to hide note box in manual billing mode
    if (isBillingOnlyMode) {
        clinicalRequestWrapper.style.display = 'none';
        generatedNoteWrapper.style.display = 'none';
        outputStyleBtnContainer.style.display = 'none';
    }
}

/**
 * Updates the orientation buttons based on form values.
 */
window.updateOrientationButtons = function() {
    const type = getEl('orientationType').value;
    const desc = getEl('orientationDescription').value;

    mainMarkerBtnContainer.querySelectorAll('.main-marker-btn').forEach(btn => {
        const btnType = btn.dataset.value;
        btn.classList.remove('selected');
        btn.textContent = btnType; // Reset text

        if (btnType === type) {
            btn.classList.add('selected');
            if (type !== 'None' && desc) {
                btn.textContent = `${type}: ${desc}`;
            }
        }
    });
}

/**
 * Updates the list of lesions added to the current procedure.
 */
window.updateLesionsList = function() {
    lesionsListEl.innerHTML = '';
    if (lesions.length === 0) {
        lesionsListEl.innerHTML = `<p class="text-slate-500 italic">No lesions added yet.</p>`;
        return;
    }
    
    const regionOptions = Array.from(anatomicalRegionEl.options);
    
    lesions.forEach(lesion => {
        const listItem = document.createElement('div');
        listItem.className = 'bg-slate-100 p-4 rounded-lg flex justify-between items-center transition-all';
        
        // --- Build new detailed summary ---
        let summaryHTML = `<div class="text-sm space-y-1">`;
        
        // 1. Procedure
        let procText = `<strong>Procedure:</strong> ${lesion.procedure}`;
        if (lesion.procedure === 'Excision') procText += ` (${lesion.excisionClosureType})`;
        if (lesion.procedure === 'Punch') procText += ` (${lesion.punchType})`;
        summaryHTML += `<p>${procText}</p>`;

        // 2. Region
        let regionText = 'N/A';
        const regionOption = regionOptions.find(opt => opt.value === lesion.anatomicalRegion);
        if (regionOption) regionText = regionOption.text.split(':')[0]; // Get "Area 1" from "Area 1: ..."
        summaryHTML += `<p><strong>Region:</strong> ${regionText}</p>`;
        
        // 3. Defect
        summaryHTML += `<p><strong>Defect:</strong> ${lesion.defectSize.toFixed(1)}mm</p>`;

        // 4. Clinical-Only Details
        if (!lesion.billingOnly) {
            // PDx
            if (lesion.pathology) {
                summaryHTML += `<p><strong>PDx:</strong> ${lesion.pathology.replace(/;/g, ', ')}</p>`;
            }
            
            // Dimensions
            let dimText = 'N/A';
            if (lesion.procedure === 'Punch' && lesion.punchType === 'Punch Biopsy') {
                dimText = `${lesion.punchSize}mm Punch`;
            } else if (lesion.length && lesion.width) {
                dimText = `${lesion.length}x${lesion.width}mm (Margin: ${lesion.margin}mm)`;
            }
            summaryHTML += `<p><strong>Dimensions:</strong> ${dimText}</p>`;
            
            // Orientation
            if (lesion.orientationType && lesion.orientationType !== 'None') {
                summaryHTML += `<p><strong>Orientation:</strong> ${lesion.orientationType} at ${lesion.orientationDescription}</p>`;
            }
            
            // Sutures
            let sutureParts = [];
            if (lesion.useDeepSuture) {
                sutureParts.push(`Deep (${lesion.deepSutureSize} ${lesion.deepSutureType})`);
            }
            if (lesion.useSkinSuture) {
                let skinText = `Skin (${lesion.skinSutureSize} ${lesion.skinSutureType}`;
                if (lesion.skinSutureRemoval) {
                    skinText += `, remove ${lesion.skinSutureRemoval} days`;
                }
                skinText += ')';
                sutureParts.push(skinText);
            }
            if (sutureParts.length > 0) {
                 summaryHTML += `<p><strong>Sutures:</strong> ${sutureParts.join(', ')}</p>`;
            }
        }
        
        summaryHTML += `</div>`;
        // --- End of summary ---

        listItem.innerHTML = `
            <div>
                <p class="font-semibold text-slate-700 mb-2">${lesion.id}. ${lesion.location}</p>
                ${summaryHTML}
            </div>
            <div class="flex items-center gap-2">
                <button onclick="startEditLesion(${lesion.id})" class="text-blue-500 hover:text-blue-700 p-1 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2" aria-label="Edit lesion ${lesion.id}">
                     <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="currentColor" viewBox="0 0 16 16"><path d="M15.502 1.94a.5.5 0 0 1 0 .706L14.459 3.69l-2-2L13.502.646a.5.5 0 0 1 .707 0l1.293 1.293zm-1.75 2.456-2-2L4.939 9.21a.5.5 0 0 0-.121.196l-.805 2.414a.25.25 0 0 0 .316.316l2.414-.805a.5.5 0 0 0 .196-.12l6.813-6.814z"/><path fill-rule="evenodd" d="M1 13.5A1.5 1.5 0 0 0 2.5 15h11a1.5 1.5 0 0 0 1.5-1.5v-6a.5.5 0 0 0-1 0v6a.5.5 0 0 1-.5.5h-11a.5.5 0 0 1-.5-.5v-11a.5.5 0 0 1 .5-.5H9a.5.5 0 0 0 0-1H2.5A1.5 1.5 0 0 0 1 2.5v11z"/></svg>
                </button>
                <button onclick="window.removeLesion(${lesion.id})" class="text-red-500 hover:text-red-700 p-1 rounded-full focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2" aria-label="Remove lesion ${lesion.id}">
                     <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 16 16"><path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16z"/><path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8 8.707l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708z"/></svg>
                </button>
            </div>
        `;
        lesionsListEl.appendChild(listItem);
    });
}

/**
 * Removes a lesion from the temporary list.
 * @param {number} id - The ID of the lesion to remove.
 */
window.removeLesion = async function(id) {
    if (editingProcedureFile) {
        showAppAlert("You cannot remove lesions when editing a saved procedure. Please cancel the edit first.", "warning");
        return;
    }

    lesions = lesions.filter(l => l.id !== id);
    lesions.forEach((lesion, index) => {
        lesion.id = index + 1;
    });
    lesionCounter = lesions.length;
    formTitle.textContent = `Enter Lesion ${lesionCounter + 1} Details`;

    if (editingLesionId === id) await cancelEdit();
    updateAllOutputs();
    saveDraft(); // <-- UPDATE DRAFT
}

/**
 * Updates both output textareas and the lesion list.
 */
window.updateAllOutputs = function() {
    updateLesionsList();
    const requestText = generateClinicalRequest();
    const noteText = generateEntryNote();
    clinicalRequestOutputEl.value = requestText;
    entryNoteOutputEl.value = noteText;
    updateOutputVisibility();
}

// --- AUTO-SAVE DRAFT LOGIC ---

const DRAFT_KEY = 'surgifile_draft_v1';

window.saveDraft = function() {
    // Don't auto-save if we are editing an existing file (too complex to sync state)
    if (editingProcedureFile) return;

    const draft = {
        patientName: patientNameEl.value,
        patientDOB: patientDOBEl.value,
        lesions: lesions,
        lesionCounter: lesionCounter,
        isBillingOnlyMode: isBillingOnlyMode,
        doctor: currentDoctor,
        // Save current form inputs to restore "work in progress" lesion
        currentForm: {
            procedureType: getEl('procedureType').value,
            location: getEl('lesionLocation').value,
            region: getEl('anatomicalRegion').value,
            length: getEl('lesionLength').value,
            width: getEl('lesionWidth').value,
            // ... add other fields if critical, but these are the basics
        },
        timestamp: Date.now()
    };
    
    // Only save if there's actually data
    if (draft.patientName || draft.lesions.length > 0 || draft.currentForm.location) {
        localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    }
}

window.restoreDraft = function() {
    try {
        const draftStr = localStorage.getItem(DRAFT_KEY);
        if (!draftStr) return;
        
        const draft = JSON.parse(draftStr);
        
        // Restore Global State
        lesions = draft.lesions || [];
        lesionCounter = draft.lesionCounter || 0;
        isBillingOnlyMode = draft.isBillingOnlyMode || false;
        
        // Restore UI State
        if (draft.isBillingOnlyMode) {
            switchTab('manual-billing');
        } else {
            switchTab('clinical-note');
        }
        
        // Restore Inputs
        patientNameEl.value = draft.patientName || '';
        patientDOBEl.value = draft.patientDOB || '';
        
        if (draft.currentForm) {
            getEl('procedureType').value = draft.currentForm.procedureType || '';
            // Trigger UI update for procedure type
            updateFormUI(); 
            
            getEl('lesionLocation').value = draft.currentForm.location || '';
            getEl('anatomicalRegion').value = draft.currentForm.region || '';
            getEl('lesionLength').value = draft.currentForm.length || '';
            getEl('lesionWidth').value = draft.currentForm.width || '';
        }
        
        // Restore Doctor if possible
        if (draft.doctor && navDoctorDropdown) {
            navDoctorDropdown.value = draft.doctor;
            currentDoctor = draft.doctor;
        }

        updateAllOutputs();
        showAppAlert("Draft restored successfully.", "success");
        
    } catch (e) {
        console.error("Failed to restore draft", e);
        clearDraft();
    }
}

window.clearDraft = function() {
    localStorage.removeItem(DRAFT_KEY);
}

window.checkForDraft = async function() {
    const draftStr = localStorage.getItem(DRAFT_KEY);
    if (draftStr && !editingProcedureFile) {
        const draft = JSON.parse(draftStr);
        // Simple validity check: needs a patient name or lesions
        if (draft.patientName || (draft.lesions && draft.lesions.length > 0)) {
            const date = new Date(draft.timestamp).toLocaleString();
            if (await showAppConfirm(`Unsaved draft found from ${date}. Would you like to restore it?`, "info")) {
                restoreDraft();
            } else {
                clearDraft();
            }
        }
    }
}
