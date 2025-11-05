// --- MAIN FORM LOGIC ---

// This file controls the "Clinical Entry" tab, including:
// - All form UI logic (showing/hiding sections)
// - Form validation
// - Adding, updating, and removing lesions
// - Saving the final procedure to a .json file
// - Generating the text for the output notes
// - Controlling the Pathology and Orientation modals

function updateFormUI(event) {
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

    document.querySelectorAll('.form-section').forEach(el => el.style.display = 'none');
    dynamicOptionsContainer.style.display = procedure ? 'block' : 'none';

    if (!procedure) {
        checkLesionFormCompleteness();
        return;
    }
    
    // Show fields based on mode
    if (isBillingOnlyMode) {
        finalDefectSizeContainer.style.display = 'block';
    } else {
        // Full clinical mode
        getEl('full-clinical-fields').style.display = 'block';
        orientationInputContainer.style.display = 'block';
    }


    switch (procedure) {
        case 'Excision':
            excisionOptions.style.display = 'block'; // Always show closure for billing
            if (!isBillingOnlyMode) {
                lesionSizeContainer.style.display = 'block';
                marginContainer.style.display = 'block';
                graftTypeContainer.style.display = (excisionClosure === 'Graft Repair' || excisionClosure === 'Graft + Flap') ? 'block' : 'none';
                justificationContainer.style.display = (excisionClosure === 'Graft Repair' || excisionClosure === 'Flap Repair' || excisionClosure === 'Graft + Flap') ? 'block' : 'none';
                closureDetailsContainer.style.display = (excisionClosure !== 'Secondary Intention') ? 'block' : 'none';
            }
            break;
        case 'Punch':
            punchOptions.style.display = 'block'; // Always show punch type for billing
            if (!isBillingOnlyMode) {
                closureDetailsContainer.style.display = 'block';
                if (punchType === 'Punch Biopsy') {
                    punchSizeContainer.style.display = 'block';
                } else {
                    lesionSizeContainer.style.display = 'block';
                    marginContainer.style.display = 'block';
                }
            }
            break;
        case 'Shave':
             if (!isBillingOnlyMode) {
                lesionSizeContainer.style.display = 'block';
                marginContainer.style.display = 'block';
            }
            // No other options for Shave
            break;
    }
    
    checkLesionFormCompleteness();
}

function checkLesionFormCompleteness() {
    // Helper to validate a single field and highlight it if invalid
    const validateAndHighlight = (element, isRequired) => {
        let isValid = true;
        if (isRequired) {
            // Check for value, or for a select, check it's not the default "" value
            if (!element.value || (element.tagName === 'SELECT' && element.value === "")) {
                element.classList.add('missing-field');
                isValid = false;
            } else {
                element.classList.remove('missing-field');
            }
        } else {
             element.classList.remove('missing-field');
        }
        return isValid;
    };

    let isAllValid = true;
    const getVal = (id) => getEl(id).value;
    const procedure = getVal('procedureType');

    // --- NEW: Check for selected doctor ---
    // If in Doctor mode, a doctor must be selected.
    // currentDoctor is from main.js
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

    // Validate common fields
    isAllValid &= validateAndHighlight(getEl('lesionLocation'), true);
    isAllValid &= validateAndHighlight(getEl('anatomicalRegion'), true);
    isAllValid &= validateAndHighlight(getEl('provisionalDiagnoses'), true);
    isAllValid &= validateAndHighlight(getEl('dermoscopyUsed'), true);
    
    if (isBillingOnlyMode) {
        // --- Billing-Only Mode Validation ---
        isAllValid &= validateAndHighlight(getEl('finalDefectSize'), true);
        
        // Closure type is still needed for billing
         if (procedure === 'Excision') {
            const excisionClosure = getVal('excisionClosureType');
            const isComplexClosure = excisionClosure === 'Graft Repair' || excisionClosure === 'Flap Repair' || excisionClosure === 'Graft + Flap';
            justificationContainer.style.display = isComplexClosure ? 'block' : 'none';
            // Justification is optional for billing-only
            // isAllValid &= validateAndHighlight(getEl('flapGraftJustification'), isComplexClosure);
            graftTypeContainer.style.display = (excisionClosure === 'Graft Repair' || excisionClosure === 'Graft + Flap') ? 'block' : 'none';
            if (excisionClosure === 'Graft Repair' || excisionClosure === 'Graft + Flap') {
                 isAllValid &= validateAndHighlight(getEl('graftType'), true);
            }
         }

    } else {
        // --- Full Clinical Mode Validation ---
        isAllValid &= validateAndHighlight(getEl('localAnesthetic'), true);

        switch (procedure) {
            case 'Excision':
                isAllValid &= validateAndHighlight(getEl('lesionLength'), true);
                isAllValid &= validateAndHighlight(getEl('lesionWidth'), true);
                isAllValid &= validateAndHighlight(getEl('margin'), true);
                const isComplexClosure = getVal('excisionClosureType') === 'Graft Repair' || getVal('excisionClosureType') === 'Flap Repair' || getVal('excisionClosureType') === 'Graft + Flap';
                isAllValid &= validateAndHighlight(getEl('flapGraftJustification'), isComplexClosure);
                if (getVal('excisionClosureType') === 'Graft Repair' || getVal('excisionClosureType') === 'Graft + Flap') {
                    isAllValid &= validateAndHighlight(getEl('graftType'), true);
                }
                if (getVal('excisionClosureType') !== 'Secondary Intention') {
                     // Check if at least one suture type is selected
                    if (!getEl('useNonDissolvable').checked && !getEl('useDissolvable').checked) {
                        getEl('useNonDissolvable').classList.add('missing-field');
                        getEl('useDissolvable').classList.add('missing-field');
                        isAllValid = false;
                    } else {
                        getEl('useNonDissolvable').classList.remove('missing-field');
                        getEl('useDissolvable').classList.remove('missing-field');
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
                 // Check if at least one suture type is selected
                if (!getEl('useNonDissolvable').checked && !getEl('useDissolvable').checked) {
                    getEl('useNonDissolvable').classList.add('missing-field');
                    getEl('useDissolvable').classList.add('missing-field');
                    isAllValid = false;
                } else {
                    getEl('useNonDissolvable').classList.remove('missing-field');
                    getEl('useDissolvable').classList.remove('missing-field');
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
function addOrUpdateLesion() {
    const isUpdating = editingLesionId !== null;
    const getVal = id => getEl(id).value;
    const getChecked = id => getEl(id).checked;
    
    // Calculate defect size
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
            defectSize = Math.max(length, width) + (2 * margin);
        }
    }


    const lesionData = {
        id: isUpdating ? editingLesionId : ++lesionCounter,
        procedure: getVal('procedureType'),
        excisionClosureType: getVal('excisionClosureType'),
        punchType: getVal('punchType'),
        graftType: getVal('graftType'),
        justification: getVal('flapGraftJustification'),
        location: getVal('lesionLocation'),
        anatomicalRegion: getVal('anatomicalRegion'),
        anesthetic: getVal('localAnesthetic'),
        pathology: getVal('provisionalDiagnoses'),
        excludeNMSC: getChecked('excludeNMSC'),
        excludeMelanoma: getChecked('excludeMelanoma'),
        dermoscopyUsed: getVal('dermoscopyUsed'),
        length: getVal('lesionLength'),
        width: getVal('lesionWidth'),
        margin: getVal('margin'),
        punchSize: getVal('punchSize'),
        defectSize: defectSize, // Save the calculated defect size
        orientationType: getVal('orientationType'),
        orientationDescription: getVal('orientationDescription'),
        useDeepSuture: getChecked('useDeepSuture'),
        deepSutureSize: getVal('deepSutureSize'),
        deepSutureType: getVal('deepSutureType'),
        
        // NEW Suture Logic
        skinSutureSize: getChecked('useNonDissolvable') ? getVal('skinSutureSize') : (getChecked('useDissolvable') ? getVal('skinSutureSizeDissolvable') : null),
        skinSutureType: getChecked('useNonDissolvable') ? getVal('skinSutureType') : (getChecked('useDissolvable') ? getVal('skinSutureTypeDissolvable') : 'None'),
        skinSutureRemoval: getChecked('useNonDissolvable') ? getVal('removalOfSkinSutures') : null,
        useDissolvable: getChecked('useDissolvable'), // Store this flag

        // NEW: Add billing-only flag
        billingOnly: isBillingOnlyMode
    };


    if (isUpdating) {
        const index = lesions.findIndex(l => l.id === editingLesionId);
        lesions[index] = lesionData;
    } else {
        lesions.push(lesionData);
    }

    updateAllOutputs();
    resetLesionForm();
}

async function saveProcedure() {
    const patientName = patientNameEl.value.trim();
    
    // --- NEW: Get doctor from the correct mode ---
    // currentAppMode and currentDoctor are global vars from main.js
    let doctorDisplayName = '';
    if (currentAppMode === 'PM') {
        // In PM mode, saving is complex. For now, let's block it.
        alert("Please switch to 'Doctor' mode to save a new procedure.");
        return;
    } else {
        doctorDisplayName = currentDoctor; // e.g., "Firstname Lastname"
    }

    if (!doctorDisplayName || doctorDisplayName === "No doctors found") {
        alert("No doctor selected. Please select a doctor from the dropdown.");
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
        procedureId: editingLesionId ? editingLesionId : Date.now(), // Reuse ID if editing
        doctorCode: doctorDisplayName, // The display name, e.g., "Firstname Lastname"
        patientName: patientName,
        procedureDate: new Date().toISOString(),
        lesions: lesions, // The array of lesion objects
        status: 'Unprocessed' // Default status for the manager app
    };

    // Generate filename
    const timestamp = procedureRecord.procedureId;
    // Filename uses folder-safe name
    const doctorFolderName = doctorDisplayName.replace(/\s+/g, '_'); 
    const filename = `${doctorFolderName}_${timestamp}.json`;

    try {
        if (editingLesionId && editingLesionDoctor) {
            // This is an edit of an *existing* file from the billing page
            // We must overwrite the original file
            
            // Check if the doctor was changed
            if (editingLesionDoctor !== doctorDisplayName) {
                // This is complex: it means moving the file *and* deleting the old one.
                // For now, let's just save as a *new* file and alert the user.
                // A true "move" is complex and risky.
                // Let's create a NEW record instead.
                procedureRecord.procedureId = Date.now(); // Brand new ID
                const newFilename = `${doctorFolderName}_${procedureRecord.procedureId}.json`;
                await saveFileToFolder(procedureRecord, newFilename, doctorDisplayName);
                alert(`Doctor was changed. A new procedure file has been created for ${doctorDisplayName}. The original file for ${editingLesionDoctor} is unmodified.`);
                
            } else {
                // Simple overwrite
                await overwriteFile(currentBillingFile.handle, procedureRecord, editingLesionDoctor, 'Unprocessed');
                alert(`Procedure for ${patientName} has been updated.`);
            }

        } else {
            // This is a brand new procedure
            await saveFileToFolder(procedureRecord, filename, doctorDisplayName);
            alert(`Procedure for ${patientName} saved to billing for Dr. ${doctorDisplayName}.`);
        }
        
        resetAll(); // Clear the form
        // Switch to billing tab to see the new file
        switchTab('billing');

    } catch (err) {
        console.warn('Could not save to folder.', err.message);
        alert(`Error: ${err.message}\n\nCould not save to default folder.`);
    }
}


function downloadJSON(data, filename) {
    const jsonString = JSON.stringify(data, null, 2); // Pretty print JSON
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    
    URL.revokeObjectURL(url);
}

function updateAllOutputs() {
    updateLesionsList();
    const requestText = generateClinicalRequest();
    const noteText = generateEntryNote();
    clinicalRequestOutputEl.value = requestText;
    entryNoteOutputEl.value = noteText;
    updateOutputVisibility();
}

function generateClinicalRequest() {
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

        if (lesion.billingOnly) {
            // Billing only mode
            diameter = lesion.defectSize;
        }
        else if (lesion.procedure === 'Punch' && lesion.punchType === 'Punch Biopsy') {
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

function generateEntryNote() {
    if (lesions.length === 0) {
        return 'Your generated note will appear here...';
    }
    
    const patientName = patientNameEl.value.trim();
    // --- NEW: Get doctor from global state ---
    const doctorCode = (currentAppMode === 'Doctor') ? currentDoctor : 'Practice Manager';

    let header = "PATIENT: " + (patientName || "N/A") + "\n";
    header += "DOCTOR: " + (doctorCode || "N/A") + "\n\n";

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

        switch (lesion.procedure) {
            case 'Excision':
                procedureTitle = `Excision with ${lesion.excisionClosureType}`;
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
                    // NEW: Check for dissolvable vs. non-dissolvable
                    if (lesion.useDissolvable) {
                         closureParts.push(`Skin closed with ${lesion.skinSutureSize} ${lesion.skinSutureType}.`);
                    } else { // non-dissolvable
                         closureParts.push(`Skin closed with ${lesion.skinSutureSize} ${lesion.skinSutureType}.`);
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
                // NEW: Check for dissolvable vs. non-dissolvable
                if (lesion.useDissolvable) {
                    closureParts.push(`Skin closed with ${lesion.skinSutureSize} ${lesion.skinSutureType}.`);
                } else { // non-dissolvable
                    closureParts.push(`Skin closed with ${lesion.skinSutureSize} ${lesion.skinSutureType}.`);
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

        // Get the full text of the selected anatomical region
        let regionText = "N/A";
        if (lesion.anatomicalRegion) {
            const option = Array.from(anatomicalRegionEl.options).find(opt => opt.value === lesion.anatomicalRegion);
            if (option) {
                regionText = option.text;
            }
        }

        return `
PROCEDURE ${lesion.id}: ${procedureTitle} of the ${lesion.location}
- Anatomical Region: ${regionText}
- Consent: Obtained after discussion of risks, benefits, and alternatives.
- Anesthetic: ${lesion.anesthetic} administered.
- Prep: Site prepped and draped in a sterile manner.
- Findings: ${findingsParts.join(' ')}
- Closure: ${closureParts.join(' ')}
- Specimen: ${specimenText}
`.trim();
    }).join('\n\n');

    const planItems = [];
    clinicalLesions.forEach(l => {
        if (l.billingOnly) return; // Skip plan for billing-only entries

        let needsPlan = false;
        let planText = '';

        if (l.procedure === 'Excision' && l.excisionClosureType !== 'Secondary Intention') needsPlan = true;
        if (l.procedure === 'Punch') needsPlan = true;
        
        if(needsPlan) {
             if (l.useDissolvable) {
                 planText = `- Wound for lesion ${l.id} (${l.location}) closed with dissolvable skin sutures which do not require removal.`;
             } else if (l.skinSutureRemoval) { // This implies non-dissolvable
                 planText = `- Sutures for lesion ${l.id} (${l.location}) to be removed in ${l.skinSutureRemoval} days.`;
             }
             if(planText) planItems.push(planText);
        }
    });
    
    const openWoundLesions = clinicalLesions.filter(l => !l.billingOnly && (l.procedure === 'Shave' || (l.procedure === 'Excision' && l.excisionClosureType === 'Secondary Intention')));
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
window.startEditLesion = function(id) {
    const lesion = lesions.find(l => l.id === id);
    if (!lesion) return;

    // If this is an *existing* file from the billing page,
    // we must lock the app to "Doctor Mode" and select the correct doctor.
    if (currentBillingFile.handle) {
        setAppMode('Doctor');
        navDoctorDropdown.value = currentBillingFile.fromDoctor;
        handleDoctorChange(); // Update state
        
        // Disable mode/doctor switching
        modeBtnDoctor.disabled = true;
        modeBtnPM.disabled = true;
        navDoctorDropdown.disabled = true;
        
        editingLesionDoctor = currentBillingFile.fromDoctor; // Store original doctor
        editingLesionId = currentBillingFile.data.procedureId; // Use file ID
    } else {
        // This is just editing a lesion from the temporary list
        editingLesionId = id;
    }


    const setVal = (elId, val) => getEl(elId).value = val;
    const setChecked = (elId, val) => getEl(elId).checked = val;

    // --- NEW: Set Billing Mode ---
    // Manually set mode before calling updateFormUI
    isBillingOnlyMode = lesion.billingOnly;
    entryFormContainer.classList.toggle('billing-only-mode', isBillingOnlyMode);
    if (isBillingOnlyMode) {
        billingOnlyModeBtn.textContent = 'Enter Full Clinical Mode';
        billingOnlyModeBtn.classList.remove('bg-amber-500', 'hover:bg-amber-600');
        billingOnlyModeBtn.classList.add('bg-green-600', 'hover:bg-green-700');
        entryViewSubtitle.textContent = 'Part 1: Enter minimal data for billing purposes only.';
    } else {
        billingOnlyModeBtn.textContent = 'Enter Billing-Only Mode';
        billingOnlyModeBtn.classList.remove('bg-green-600', 'hover:bg-green-700');
        billingOnlyModeBtn.classList.add('bg-amber-500', 'hover:bg-amber-600');
        entryViewSubtitle.textContent = 'Part 1: Enter clinical data and generate the operation note.';
    }
    setVal('finalDefectSize', lesion.defectSize);
    // ---

    setVal('procedureType', lesion.procedure);
    updateFormUI(); // Update UI before setting sub-options
    setVal('excisionClosureType', lesion.excisionClosureType);
    setVal('punchType', lesion.punchType);
    setVal('graftType', lesion.graftType);
    setVal('flapGraftJustification', lesion.justification);
    
    // Reselect justification buttons
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

    setChecked('useDeepSuture', lesion.useDeepSuture);
    setVal('deepSutureSize', lesion.deepSutureSize);
    setVal('deepSutureType', lesion.deepSutureType);
    
    // NEW: Handle dissolvable/non-dissolvable
    const isDissolvable = lesion.useDissolvable;
    setChecked('useDissolvable', isDissolvable);
    setChecked('useNonDissolvable', !isDissolvable);

    deepSutureContainer.classList.toggle('hidden', !lesion.useDeepSuture);
    skinSutureDetails.classList.toggle('hidden', isDissolvable);
    skinSutureDetailsDissolvable.classList.toggle('hidden', !isDissolvable);

    if(isDissolvable) {
        setVal('skinSutureSizeDissolvable', lesion.skinSutureSize);
        setVal('skinSutureTypeDissolvable', lesion.skinSutureType);
    } else {
        setVal('skinSutureSize', lesion.skinSutureSize);
        setVal('skinSutureType', lesion.skinSutureType);
        setVal('removalOfSkinSutures', lesion.skinSutureRemoval);
    }
    
    updateFormUI(); // Re-run to ensure visibility is correct after setting all values
    
    // Use the file procedure ID if we have it, otherwise the lesion list ID
    const displayId = editingLesionId || id;
    formTitle.textContent = `Editing Lesion ${displayId}`;
    addLesionBtn.textContent = 'Update Lesion';
    saveProcedureBtn.textContent = 'Update Procedure in Billing';
    cancelEditBtn.style.display = 'block';
    clearProcedureBtn.style.display = 'none';
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function cancelEdit() {
    resetLesionForm();
    
    // Re-enable UI if we were editing a file
    modeBtnDoctor.disabled = false;
    modeBtnPM.disabled = false;
    navDoctorDropdown.disabled = false;
    editingLesionDoctor = null;
    currentBillingFile = { handle: null, data: null, fromFolder: '', fromDoctor: '' }; // Clear file
}

/**
 * Resets just the lesion-specific form fields, not the patient info.
 * @param {boolean} [resetProcType=true] - Whether to reset the procedureType dropdown.
 */
function resetLesionForm(resetProcType = true) {
    editingLesionId = null;

    // Manually reset fields inside the dynamic container
    const dynamicFields = ['lesionLocation', 'anatomicalRegion', 'lesionLength', 'lesionWidth', 'margin', 'punchSize', 'finalDefectSize', 'flapGraftJustification', 'provisionalDiagnoses', 'dermoscopyUsed', 'orientationType', 'orientationDescription'];
    dynamicFields.forEach(id => getEl(id).value = '');
    
    // Reset checkboxes
    const checkboxes = ['excludeNMSC', 'excludeMelanoma', 'useDeepSuture', 'useDissolvable'];
    checkboxes.forEach(id => getEl(id).checked = false);
    getEl('useNonDissolvable').checked = true; // Default

    // Manually sync container visibility with the reset checkbox states
    deepSutureContainer.classList.add('hidden'); // Syncs with useDeepSuture = false
    skinSutureDetails.classList.remove('hidden'); // Syncs with useNonDissolvable = true
    skinSutureDetailsDissolvable.classList.add('hidden'); // Syncs with useDissolvable = false

    // Reset selects to their default
    if(resetProcType) getEl('procedureType').selectedIndex = 0;
    getEl('excisionClosureType').selectedIndex = 0;
    getEl('punchType').selectedIndex = 0;
    getEl('graftType').selectedIndex = 0;
    getEl('localAnesthetic').selectedIndex = 0;
    getEl('deepSutureSize').value = '4/0';
    getEl('deepSutureType').selectedIndex = 0; // Will be set to first item in dynamic list
    getEl('skinSutureSize').value = '5/0';
    getEl('skinSutureType').selectedIndex = 0; // Will be set to first item in dynamic list
    getEl('removalOfSkinSutures').value = '';
    getEl('skinSutureSizeDissolvable').value = '5/0';
    getEl('skinSutureTypeDissolvable').selectedIndex = 0;
    getEl('anatomicalRegion').selectedIndex = 0;

    // Reset display elements
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
    
    // Re-run UI and validation logic
    updateFormUI();
    checkLesionFormCompleteness();
}

function updateOrientationButtons() {
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

function resetAll() {
    lesions = [];
    lesionCounter = 0;
    patientNameEl.value = '';
    patientNameEl.classList.remove('missing-field');
    
    // Re-enable UI if we were editing a file
    modeBtnDoctor.disabled = false;
    modeBtnPM.disabled = false;
    navDoctorDropdown.disabled = false;
    editingLesionDoctor = null;
    currentBillingFile = { handle: null, data: null, fromFolder: '', fromDoctor: '' }; // Clear file
    
    resetLesionForm(); // Resets the lesion part of the form
    updateAllOutputs(); // Clears outputs and lesion list
}

function updateLesionsList() {
    lesionsListEl.innerHTML = '';
    if (lesions.length === 0) {
        lesionsListEl.innerHTML = `<p class="text-slate-500 italic">No lesions added yet.</p>`;
        return;
    }
    
    lesions.forEach(lesion => {
        const listItem = document.createElement('div');
        listItem.className = 'bg-slate-100 p-3 rounded-lg flex justify-between items-center transition-all';
        
        // Get the prefix of the anatomical region for display
        let regionText = 'No Region';
        if (lesion.anatomicalRegion) {
            const option = Array.from(anatomicalRegionEl.options).find(opt => opt.value === lesion.anatomicalRegion);
            if (option) {
                regionText = option.text.split(':')[0];
            }
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


window.removeLesion = function(id) {
    // Cannot remove a lesion if we are editing a file from billing
    if (editingLesionId && currentBillingFile.handle) {
        alert("You cannot remove lesions when editing a saved procedure. Please cancel the edit first.");
        return;
    }

    lesions = lesions.filter(l => l.id !== id);
    // Renumber the remaining lesions
    lesions.forEach((lesion, index) => {
        lesion.id = index + 1;
    });
    // Update the global counter
    lesionCounter = lesions.length;
    // Update the form title for the next entry
    formTitle.textContent = `Enter Lesion ${lesionCounter + 1} Details`;

    if (editingLesionId === id) cancelEdit();
    updateAllOutputs();
}

function copyToClipboard(elementId, buttonTextElement) {
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

function setOutputStyle(style) {
    localStorage.setItem('medicalNoteGeneratorOutputStyle', style);
    updateOutputVisibility();
}

function updateOutputVisibility() {
    const style = localStorage.getItem('medicalNoteGeneratorOutputStyle') || 'combined';
    
    outputBtnCombined.classList.toggle('selected', style === 'combined');
    outputBtnSeparate.classList.toggle('selected', style === 'separate');

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
        const requestText = request.startsWith('Your') ? '' : `\n\n---\n\CLINICAL REQUEST:\n${request}`;
        
        if (noteText || requestText) {
            entryNoteOutputEl.value = noteText + requestText;
        } else {
            entryNoteOutputEl.value = 'Your clinical request and note will appear here...';
        }
    }
}


// --- MODAL & CLOCK LOGIC ---

function openOrientationModal() {
    if (modalSelectedLocationElement) modalSelectedLocationElement.classList.remove('selected');
    
    const currentDescription = getEl('orientationDescription').value;
    if(currentDescription) {
        const currentLocationEl = modalLocationSelector.querySelector(`[data-value="${currentDescription}"]`);
        if(currentLocationEl) {
            currentLocationEl.classList.add('selected');
            modalSelectedLocationElement = currentLocationEl;
        }
    }
    
    orientationModal.classList.remove('hidden');
}


// --- PATHOLOGY MODAL ---
function openPathologyModal() {
    const selected = (getEl('provisionalDiagnoses').value || '').split(';').filter(Boolean);
    pathologyCheckboxesEl.querySelectorAll('input').forEach(input => {
        input.checked = selected.includes(input.value);
    });
    const otherValue = selected.find(s => !pathologyOptions[s]);
    otherPathologyInput.value = otherValue || '';
    pathologyModal.classList.remove('hidden');
}

function confirmPathologySelection() {
    const selected = [];
    pathologyCheckboxesEl.querySelectorAll('input:checked').forEach(input => {
        selected.push(input.value);
    });
    const otherValue = otherPathologyInput.value.trim();
    if (otherValue) {
        selected.push(otherValue);
    }
    
    getEl('provisionalDiagnoses').value = selected.join(';');
    
    if (selected.length > 0) {
        pathologyDisplayEl.textContent = selected.join(', ');
        pathologyDisplayEl.classList.remove('italic', 'text-slate-500');
    } else {
        pathologyDisplayEl.textContent = 'Click to select...';
        pathologyDisplayEl.classList.add('italic', 'text-slate-500');
    }
    
    pathologyModal.classList.add('hidden');
    checkLesionFormCompleteness();
}
