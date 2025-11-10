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
        checkLesionFormCompleteness();
        return;
    }
    
    // Show the main dynamic container
    dynamicOptionsContainer.style.display = 'block';

    // --- Mode-Specific Field Visibility ---
    if (isBillingOnlyMode) {
        // --- MANUAL BILLING MODE ---
        // Show only the bare minimum for billing
        finalDefectSizeContainer.style.display = 'block';
        pathologyContainer.style.display = 'none'; // Hide PDx container
        
        if (procedure === 'Excision') {
            excisionOptions.style.display = 'block';
            graftTypeContainer.style.display = (excisionClosure === 'Graft Repair' || excisionClosure === 'Graft + Flap') ? 'block' : 'none';
            // Justification is NOT shown in billing-only mode
        } else if (procedure === 'Punch') {
            punchOptions.style.display = 'block';
            // Punch size/lesion size is NOT shown, only finalDefectSize
        }
        // Shave needs no extra options
        
    } else {
        // --- FULL CLINICAL NOTE MODE ---
        getEl('full-clinical-fields').style.display = 'block';
        orientationInputContainer.style.display = 'block';
        pathologyContainer.style.display = 'block'; // Show PDx container

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
                // No other options for Shave
                break;
            case 'Wedge Excision':
                 lesionSizeContainer.style.display = 'block';
                 marginContainer.style.display = 'block';
                 closureDetailsContainer.style.display = 'block';
                 break;
        }
    }
    
    checkLesionFormCompleteness();
}

/**
 * Checks if all required fields are filled and enables/disables the Add Lesion button.
 * Highlights missing fields.
 */
window.checkLesionFormCompleteness = function() {
    // Helper to validate a single field
    const validateAndHighlight = (element, isRequired) => {
        let isValid = true;
        if (isRequired) {
            if (element.id === 'patientName' && lesions.length === 0) {
                 // Only require patient name when adding the *first* lesion
                 if (!element.value) {
                    element.classList.add('missing-field');
                    isValid = false;
                 } else {
                    element.classList.remove('missing-field');
                 }
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
    }

    let isAllValid = true;
    const getVal = (id) => getEl(id).value;
    const procedure = getVal('procedureType');

    // --- Check for selected doctor ---
    // In Doctor mode, a doctor must be selected.
    if (currentAppMode === 'Doctor' && (!currentDoctor || currentDoctor === "No doctors found")) {
        isAllValid = false;
        navDoctorDropdown.classList.add('missing-field');
    } else {
        navDoctorDropdown.classList.remove('missing-field');
    }

    if (!procedure) {
        addLesionBtn.disabled = true;
        return;
    }
    
    // Validate patient name
    isAllValid &= validateAndHighlight(getEl('patientName'), true);

    // --- Validate common fields (required in both modes) ---
    isAllValid &= validateAndHighlight(getEl('lesionLocation'), true);
    isAllValid &= validateAndHighlight(getEl('anatomicalRegion'), true);
    // Only validate PDx if NOT in billing-only mode
    if (!isBillingOnlyMode) {
        isAllValid &= validateAndHighlight(getEl('provisionalDiagnoses'), true);
    }
    
    if (isBillingOnlyMode) {
        // --- Billing-Only Mode Validation ---
        isAllValid &= validateAndHighlight(getEl('finalDefectSize'), true);
        isAllValid &= validateAndHighlight(getEl('dermoscopyUsed'), true); // Still needed for audit
        
         if (procedure === 'Excision') {
            const excisionClosure = getVal('excisionClosureType');
            if (excisionClosure === 'Graft Repair' || excisionClosure === 'Graft + Flap') {
                 isAllValid &= validateAndHighlight(getEl('graftType'), true);
            }
         }

    } else {
        // --- Full Clinical Mode Validation ---
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
    
    addLesionBtn.disabled = !isAllValid;
}


// --- DATA LOGIC ---

/**
 * Collects data from the form and adds or updates a lesion in the `lesions` array.
 */
window.addOrUpdateLesion = function() {
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
            useDissolvable: isSkinSutureDissolvable,
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
        excludeNMSC: getChecked('excludeNMSC'), // Still need this for audit
        excludeMelanoma: getChecked('excludeMelanoma'), // Still need this for audit
        dermoscopyUsed: getVal('dermoscopyUsed'), // Still need this for audit
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
}

/**
 * Saves the entire procedure (patient info + all lesions) to a .json file.
 */
window.saveProcedure = async function() {
    // --- NEW: Check for unsaved lesion in progress ---
    if (procedureTypeEl.value !== '') {
        if (!confirm("You have an unsaved lesion currently being entered. Do you want to save the procedure without adding this last lesion?")) {
            return; // User wants to finish the lesion first
        }
    }

    const patientName = patientNameEl.value.trim();
    
    // currentAppMode and currentDoctor are global vars from app.js
    let doctorDisplayName = '';
    if (currentAppMode === 'PM') {
        // This should be impossible, as the tab is hidden
        console.error("Save button was clicked in PM mode. This shouldn't happen.");
        return;
    } else {
        doctorDisplayName = currentDoctor;
    }

    if (!doctorDisplayName || doctorDisplayName === "No doctors found") {
        alert("No doctor selected. Please select a doctor from the dropdown in the top navigation bar.");
        navDoctorDropdown.classList.add('missing-field');
        return;
    } else {
        navDoctorDropdown.classList.remove('missing-field');
    }
    
    // Validation
    let isValid = true;
    if (!patientName) {
        patientNameEl.classList.add('missing-field');
        isValid = false;
    } else {
        patientNameEl.classList.remove('missing-field');
    }

    if (lesions.length === 0) {
        alert('Please add at least one lesion before saving.');
        isValid = false;
    }

    if (!isValid) return;

    // Create the procedure record
    const procedureRecord = {
        procedureId: editingProcedureFile ? editingProcedureFile.data.procedureId : Date.now(), // Reuse ID if editing
        doctorCode: doctorDisplayName,
        patientName: patientName,
        procedureDate: new Date().toISOString(),
        lesions: lesions, // The array of lesion objects
        status: 'Unprocessed' // Default status
    };

    // Generate filename
    const filename = `${doctorDisplayName.replace(/\s+/g, '_')}_${procedureRecord.procedureId}.json`;

    try {
        if (editingProcedureFile) {
            // This is an edit of an *existing* file from the billing page
            // We must overwrite the original file
            
            // Check if the doctor was changed
            if (editingProcedureFile.fromDoctor !== doctorDisplayName) {
                // This is complex. For now, just save as a *new* file.
                // A true "move" is complex and risky.
                procedureRecord.procedureId = Date.now(); // Brand new ID
                const newFilename = `${doctorDisplayName.replace(/\s+/g, '_')}_${procedureRecord.procedureId}.json`;
                await saveFileToFolder(procedureRecord, newFilename, doctorDisplayName);
                alert(`Doctor was changed. A new procedure file has been created for ${doctorDisplayName}. The original file for ${editingProcedureFile.fromDoctor} is unmodified.`);
                
            } else {
                // Simple overwrite in the same folder
                await overwriteFile(editingProcedureFile.handle, procedureRecord, editingProcedureFile.fromDoctor, editingProcedureFile.fromFolder);
                alert(`Procedure for ${patientName} has been updated.`);
            }

        } else {
            // This is a brand new procedure
            await saveFileToFolder(procedureRecord, filename, doctorDisplayName);
            alert(`Procedure for ${patientName} saved to "Unprocessed" billing for Dr. ${doctorDisplayName}.`);
        }
        
        // --- NEW: Pass true to NOT ask for confirmation since we just saved ---
        resetAll(false); 
        // Switch to billing tab to see the new file
        switchTab('billing');

    } catch (err) {
        console.warn('Could not save to folder.', err.message);
        alert(`Error: ${err.message}\n\nCould not save to default folder.`);
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
    
    const patientName = patientNameEl.value.trim();
    const doctorCode = (currentAppMode === 'Doctor') ? currentDoctor : 'Practice Manager';

    let header = "PATIENT: " + (patientName || "N/A") + "\n";
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
        
        // *** FIX: Replaced old locking code with new toggle locking ***
        // Force toggle to unchecked (Doctor mode)
        pmModeToggle.checked = false;
        // Disable the toggle so user can't switch while editing
        pmModeToggle.disabled = true;
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
    pathologyDisplayEl.textContent = lesion.pathology.replace(/;/g, ', ');
    pathologyDisplayEl.classList.remove('italic', 'text-slate-500');
    
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
window.cancelEdit = function() {
    // --- NEW: Check for unsaved data when cancelling an edit ---
    if (editingProcedureFile && hasUnsavedChanges()) {
        if (!confirm("You have made changes to this lesion. Cancelling will discard them. Are you sure?")) {
            return;
        }
    }

    resetLesionForm();
    
    // *** FIX: Re-enable the toggle and dropdown ***
    pmModeToggle.disabled = false;
    navDoctorDropdown.disabled = false;
    
    editingLesionId = null;
    editingProcedureFile = null; 
    currentBillingFile = { handle: null, data: null, fromFolder: '', fromDoctor: '' };
}

/**
 * Resets just the lesion-specific form fields.
 */
window.resetLesionForm = function(resetProcType = true) {
    editingLesionId = null;

    const dynamicFields = ['lesionLocation', 'anatomicalRegion', 'lesionLength', 'lesionWidth', 'margin', 'punchSize', 'finalDefectSize', 'flapGraftJustification', 'provisionalDiagnoses', 'dermoscopyUsed', 'orientationType', 'orientationDescription', 'removalOfSkinSutures'];
    dynamicFields.forEach(id => getEl(id).value = '');
    
    const checkboxes = ['excludeNMSC', 'excludeMelanoma', 'useDeepSuture'];
    checkboxes.forEach(id => getEl(id).checked = false);
    getEl('useSkinSuture').checked = true; // Default

    deepSutureContainer.classList.add('hidden');
    skinSutureDetails.classList.remove('hidden');
    getEl('skin-suture-removal-container').style.display = 'none'; 

    if(resetProcType) getEl('procedureType').selectedIndex = 0;
    getEl('excisionClosureType').selectedIndex = 0;
    getEl('punchType').selectedIndex = 0;
    getEl('graftType').selectedIndex = 0;
    getEl('localAnesthetic').selectedIndex = 0;
    getEl('deepSutureSize').value = '4/0';
    getEl('deepSutureType').selectedIndex = 0;
    getEl('skinSutureSize').value = '5/0';
    getEl('skinSutureType').value = ''; 
    getEl('anatomicalRegion').selectedIndex = 0;

    pathologyDisplayEl.textContent = 'Click to select...';
    pathologyDisplayEl.classList.add('italic', 'text-slate-500');
    document.querySelectorAll('.dermoscopy-btn, .justification-btn').forEach(btn => btn.classList.remove('selected'));
    
    getEl('orientationType').value = 'None';
    updateOrientationButtons();
    
    formTitle.textContent = `Enter Lesion ${lesionCounter + 1} Details`;
    addLesionBtn.textContent = 'Add Lesion';
    saveProcedureBtn.textContent = 'Save Procedure to Billing';
    cancelEditBtn.style.display = 'none';
    clearProcedureBtn.style.display = 'block';
    
    updateFormUI();
    checkLesionFormCompleteness();
}

/**
 * Resets the entire form, including patient info and all lesions.
 * @param {boolean} [askConfirmation=true] - Whether to ask for user confirmation if data exists.
 */
window.resetAll = function(askConfirmation = true) {
    // --- NEW: Check for unsaved data before clearing ---
    if (askConfirmation && hasUnsavedChanges()) {
        if (!confirm("Are you sure you want to clear all procedure details? This cannot be undone.")) {
            return;
        }
    }

    lesions = [];
    lesionCounter = 0;
    patientNameEl.value = '';
    patientNameEl.classList.remove('missing-field');
    
    // *** FIX: Re-enable the toggle and dropdown ***
    pmModeToggle.disabled = false;
    navDoctorDropdown.disabled = false;

    editingLesionId = null;
    editingProcedureFile = null; 
    currentBillingFile = { handle: null, data: null, fromFolder: '', fromDoctor: '' };
    
    resetLesionForm();
    updateAllOutputs();
}

// --- RESTORED MISSING FUNCTIONS ---

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
        // Use execCommand as a fallback for iframe environments
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

    // Ensure elements exist before trying to style them (they might be hidden in Manual mode)
    if (clinicalRequestContainer && entryNoteContainer) {
        if (style === 'separate') {
            clinicalRequestContainer.style.display = 'block';
            entryNoteContainer.style.display = 'block';
            entryNoteOutputEl.value = generateEntryNote();
            clinicalRequestOutputEl.value = generateClinicalRequest();
        } else { // Combined
            clinicalRequestContainer.style.display = 'none';
            entryNoteContainer.style.display = 'block';
            
            const note = generateEntryNote();
            const request = generateClinicalRequest();

            const noteText = note.startsWith('Your') ? '' : note;
            const requestText = request.startsWith('Your') ? '' : `\n\n---\nCLINICAL REQUEST:\n${request}`;
            
            if (noteText || requestText) {
                entryNoteOutputEl.value = noteText + requestText;
            } else {
                entryNoteOutputEl.value = 'Your clinical request and note will appear here...';
            }
        }
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
    
    lesions.forEach(lesion => {
        const listItem = document.createElement('div');
        listItem.className = 'bg-slate-100 p-3 rounded-lg flex justify-between items-center transition-all';
        
        let regionText = 'No Region';
        if (lesion.anatomicalRegion) {
            const option = Array.from(anatomicalRegionEl.options).find(opt => opt.value === lesion.anatomicalRegion);
            if (option) regionText = option.text.split(':')[0];
        }
        
        const billingOnlyText = lesion.billingOnly ? '<span class="text-amber-600 font-medium ml-2">[Billing-Only]</span>' : '';

        listItem.innerHTML = `
            <div>
                <p class="font-semibold text-slate-700">${lesion.id}. ${lesion.location} <span class="text-blue-600 font-medium ml-2">[${regionText}]</span> ${billingOnlyText}</p>
                <p class="text-sm text-slate-500">${lesion.pathology.replace(/;/g, ', ')}</p>
            </div>
            <div class="flex items-center gap-2">
                <button onclick="startEditLesion(${lesion.id})" class="text-blue-500 hover:text-blue-700 p-1 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2" aria-label="Edit lesion ${lesion.id}">
                     <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="currentColor" viewBox="0 0 16 16"><path d="M15.502 1.94a.5.5 0 0 1 0 .706L14.459 3.69l-2-2L13.502.646a.5.5 0 0 1 .707 0l1.293 1.293zm-1.75 2.456-2-2L4.939 9.21a.5.5 0 0 0-.121.196l-.805 2.414a.25.25 0 0 0 .316.316l2.414-.805a.5.5 0 0 0 .196-.12l6.813-6.814z"/><path fill-rule="evenodd" d="M1 13.5A1.5 1.5 0 0 0 2.5 15h11a1.5 1.5 0 0 0 1.5-1.5v-6a.5.5 0 0 0-1 0v6a.5.5 0 0 1-.5.5h-11a.5.5 0 0 1-.5-.5v-11a.5.5 0 0 1 .5-.5H9a.5.5 0 0 0 0-1H2.5A1.5 1.5 0 0 0 1 2.5v11z"/></svg>
                </button>
                <button onclick="window.removeLesion(${lesion.id})" class="text-red-500 hover:text-red-700 p-1 rounded-full focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2" aria-label="Remove lesion ${lesion.id}">
                     <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 16 16"><path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16z"/><path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708z"/></svg>
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
window.removeLesion = function(id) {
    if (editingProcedureFile) {
        alert("You cannot remove lesions when editing a saved procedure. Please cancel the edit first.");
        return;
    }

    lesions = lesions.filter(l => l.id !== id);
    lesions.forEach((lesion, index) => {
        lesion.id = index + 1;
    });
    lesionCounter = lesions.length;
    formTitle.textContent = `Enter Lesion ${lesionCounter + 1} Details`;

    if (editingLesionId === id) cancelEdit();
    updateAllOutputs();
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
