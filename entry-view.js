// --- AUTOSAVE LOGIC ---

/**
 * Saves the current procedure state (patient, doctor, lesions) to localStorage.
 */
function autosaveProcedure() {
    const procedureData = {
        patientName: patientNameEl.value,
        doctorCode: doctorCodeEl.value,
        lesions: lesions,
        lesionCounter: lesionCounter
    };
    localStorage.setItem('autosavedProcedure', JSON.stringify(procedureData));
    console.log("Procedure autosaved.");
}

/**
 * Loads the autosaved procedure from localStorage on startup.
 */
function loadAutosavedProcedure() {
    const savedData = localStorage.getItem('autosavedProcedure');
    if (savedData) {
        try {
            const data = JSON.parse(savedData);
            // Don't load if a procedure is actively being edited from the billing tab
            if (localStorage.getItem('procedureToEdit')) {
                localStorage.removeItem('autosavedProcedure'); // Clear autosave
                return;
            }

            patientNameEl.value = data.patientName || '';
            doctorCodeEl.value = data.doctorCode || '';
            lesions = data.lesions || [];
            lesionCounter = data.lesionCounter || 0;

            if (lesions.length > 0) {
                console.log("Loaded autosaved procedure.");
                updateAllOutputs();
            }
        } catch (e) {
            console.error("Error loading autosaved data:", e);
            localStorage.removeItem('autosavedProcedure');
        }
    }
}

/**
 * Checks localStorage for a procedure sent from the billing tab to edit.
 */
function checkAndLoadProcedureForEditing() {
    const dataString = localStorage.getItem('procedureToEdit');
    const contextString = localStorage.getItem('editContext');

    if (dataString && contextString) {
        try {
            const data = JSON.parse(dataString);
            const context = JSON.parse(contextString);

            resetAll(); // Clear the form completely first

            // Load data into the form
            patientNameEl.value = data.patientName;
            doctorCodeEl.value = data.doctorCode;
            lesions = data.lesions;
            lesionCounter = data.lesions.length;

            updateAllOutputs(); // Re-render lesions list and note outputs

            // Change UI to "Edit Mode"
            saveProcedureBtn.textContent = 'Save Edits to Original File';
            clearProcedureBtn.textContent = 'Cancel Edit';

            // Store the edit context in the form's dataset
            lesionForm.dataset.isEditingFile = 'true';
            lesionForm.dataset.originalFilename = context.filename;
            lesionForm.dataset.originalFromFolder = context.fromFolder;
            lesionForm.dataset.originalProcedureId = data.procedureId; // Store original ID
            lesionForm.dataset.originalDoctorCode = data.doctorCode; // Store original doctor

            // Clear the local storage items
            localStorage.removeItem('procedureToEdit');
            localStorage.removeItem('editContext');
            localStorage.removeItem('autosavedProcedure'); // Clear any autosave

            console.log(`Loaded procedure ${context.filename} for editing.`);
            alert(`Loaded procedure for ${data.patientName} for editing. Make your changes and click "Save Edits to Original File".`);

        } catch (e) {
            console.error("Error loading procedure for editing:", e);
            localStorage.removeItem('procedureToEdit');
            localStorage.removeItem('editContext');
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

function drawClock() {
    const radius = 90;
    const center = 100;
    const face = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    face.setAttribute('cx', center);
    face.setAttribute('cy', center);
    face.setAttribute('r', radius);
    face.classList.add('clock-face');
    clock.appendChild(face);
    for (let i = 1; i <= 12; i++) {
        const angle = (i - 3) * (Math.PI / 6);
        const textX = center + (radius - 22) * Math.cos(angle);
        const textY = center + (radius - 22) * Math.sin(angle);
        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        text.setAttribute('x', textX);
        text.setAttribute('y', textY);
        text.textContent = i;
        text.classList.add('hour-text');
        text.dataset.value = `${i} O'Clock`;
        clock.appendChild(text);
    }
    const centerDot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    centerDot.setAttribute('cx', center);
    centerDot.setAttribute('cy', center);
    centerDot.setAttribute('r', 4);
    centerDot.classList.add('center-dot');
    clock.appendChild(centerDot);
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

// --- MAIN FORM LOGIC ---
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
    }
    
    checkLesionFormCompleteness();
}

function checkLesionFormCompleteness() {
    // Helper to validate a single field and highlight it if invalid
    const validateAndHighlight = (element, isRequired) => {
        let isValid = true;
        if (isRequired) {
            if (!element.value.trim()) {
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

    if (!procedure) {
        addLesionBtn.disabled = true;
        return;
    }

    // Validate common fields
    isAllValid &= validateAndHighlight(getEl('lesionLocation'), true);
    isAllValid &= validateAndHighlight(getEl('anatomicalRegion'), true);
    isAllValid &= validateAndHighlight(getEl('provisionalDiagnoses'), true);
    isAllValid &= validateAndHighlight(getEl('dermoscopyUsed'), true);
    
    // Validate procedure-specific fields
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
            if (getVal('excisionClosureType') !== 'Secondary Intention' && getEl('useNonDissolvable').checked) {
                isAllValid &= validateAndHighlight(getEl('removalOfSkinSutures'), false); // Optional
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
             if (getEl('useNonDissolvable').checked) {
                isAllValid &= validateAndHighlight(getEl('removalOfSkinSutures'), false); // Optional
            }
            break;
        case 'Shave':
            isAllValid &= validateAndHighlight(getEl('lesionLength'), true);
            isAllValid &= validateAndHighlight(getEl('lesionWidth'), true);
            isAllValid &= validateAndHighlight(getEl('margin'), true);
            break;
    }
    
    addLesionBtn.disabled = !isAllValid;
}


// --- DATA LOGIC ---
function addOrUpdateLesion() {
    const isUpdating = editingLesionId !== null;
    const getVal = id => getEl(id).value;
    const getChecked = id => getEl(id).checked;
    
    // Calculate defect size
    const length = parseFloat(getVal('lesionLength')) || 0;
    const width = parseFloat(getVal('lesionWidth')) || 0;
    const margin = parseFloat(getVal('margin')) || 0;
    let defectSize = 0;
    if (getVal('procedureType') === 'Punch' && getVal('punchType') === 'Punch Biopsy') {
        defectSize = parseFloat(getVal('punchSize')) || 0;
    } else {
        defectSize = Math.max(length, width) + (2 * margin);
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
        skinSutureSize: getVal('skinSutureSize'),
        skinSutureType: getChecked('useNonDissolvable') ? getVal('skinSutureType') : 'Dissolvable',
        skinSutureRemoval: getChecked('useNonDissolvable') ? getVal('removalOfSkinSutures') : null
    };

    if (isUpdating) {
        const index = lesions.findIndex(l => l.id === editingLesionId);
        lesions[index] = lesionData;
    } else {
        lesions.push(lesionData);
    }

    updateAllOutputs();
    resetLesionForm();
    autosaveProcedure(); // Call autosave
}

async function saveProcedure() {
    const patientName = patientNameEl.value.trim();
    const doctorCode = doctorCodeEl.value.trim();
    
    // Validation
    let isValid = true;
    if (!patientName) {
        patientNameEl.classList.add('missing-field');
        isValid = false;
    } else {
        patientNameEl.classList.remove('missing-field');
    }

    if (!doctorCode || doctorCode === appSettings.pmIdentifier) { // PM cannot create new files
        doctorCodeEl.classList.add('missing-field');
        if (doctorCode === appSettings.pmIdentifier) {
            alert('Practice Managers cannot create new procedures. Please select a doctor.');
        }
        isValid = false;
    } else {
        doctorCodeEl.classList.remove('missing-field');
    }

    if (lesions.length === 0) {
        alert('Please add at least one lesion before saving.');
        isValid = false;
    }

    if (!isValid) return;

    // Check if we are saving an edit or a new file
    const isEditing = lesionForm.dataset.isEditingFile === 'true';

    // Create the procedure record
    const procedureRecord = {
        // Use the original ID if editing, or a new timestamp if creating
        procedureId: isEditing ? parseInt(lesionForm.dataset.originalProcedureId, 10) : Date.now(),
        doctorCode: doctorCode,
        patientName: patientName,
        procedureDate: new Date().toISOString(), // Always update to current date
        lesions: lesions, // The array of lesion objects
        // Use the original folder's status if editing, or 'Unprocessed' if new
        status: isEditing ? (lesionForm.dataset.originalFromFolder === 'Billed' ? 'Billed' : 'Archived' ? 'Archived' : 'Unprocessed') : 'Unprocessed'
    };

    if (isEditing) {
        // --- This is an EDIT, so OVERWRITE the original file ---
        const originalFilename = lesionForm.dataset.originalFilename;
        const originalFromFolder = lesionForm.dataset.originalFromFolder;
        const originalDoctorCode = lesionForm.dataset.originalDoctorCode; // Get original doctor code

        try {
            // Pass the original doctor code to find the correct folder
            await overwriteFile(procedureRecord, originalFilename, originalFromFolder, originalDoctorCode);
            alert(`Procedure for ${patientName} successfully updated!`);
            resetAll(); // This will also clear autosave
        } catch (err) {
            console.error('Could not save edits to file:', err.message);
            alert(`Error saving edits: ${err.message}\n\nYour data is still safe in the form.`);
        }

    } else {
        // --- This is a NEW procedure, so SAVE to Unprocessed ---
        const timestamp = procedureRecord.procedureId;
        const filename = `${doctorCode}_${timestamp}.json`;

        try {
            // Pass the new doctor code to save in the correct folder
            await saveFileToFolder(procedureRecord, filename, doctorCode);
            alert(`Procedure for ${patientName} saved directly to your default folder!`);
            resetAll(); // This will also clear autosave
        } catch (err) {
            console.warn('Could not save to folder, falling back to download.', err.message);
            downloadJSON(procedureRecord, filename);
            alert(`Procedure for ${patientName} saved.\nFile: ${filename}\n\n(Could not save to default folder. Please save this file manually.)`);
            resetAll(); // This will also clear autosave
        }
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

function generateEntryNote() {
    if (lesions.length === 0) {
        return 'Your generated note will appear here...';
    }
    
    const patientName = patientNameEl.value.trim();
    const doctorCode = doctorCodeEl.value.trim();
    let header = "PATIENT: " + (patientName || "N/A") + "\n";
    header += "DOCTOR: " + (doctorCode || "N/A") + "\n\n";

    const procedureDetails = lesions.map(lesion => {
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
                    closureParts.push(`Skin closed with ${lesion.skinSutureSize} ${lesion.skinSutureType}.`);
                }
                break;
            case 'Punch':
                procedureTitle = lesion.punchType;
                if (lesion.punchType === 'Punch Biopsy') {
                    findingsParts.push(`A ${lesion.punchSize}mm punch biopsy was taken from the lesion site.`);
                } else { // Punch Excision
                    findingsParts.push(`A ${lesion.length}x${lesion.width}mm lesion was excised via punch technique with a ${lesion.margin}mm margin.`);
                }
                closureParts.push(`Skin closed with ${lesion.skinSutureSize} ${lesion.skinSutureType}.`);
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

        // Get the full text of the selected anatomical region from the lesion data
        let regionText = "N/A";
        if (lesion.anatomicalRegion) {
            const option = Array.from(getEl('anatomicalRegion').options).find(opt => opt.value === lesion.anatomicalRegion);
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
    lesions.forEach(l => {
        let needsPlan = false;
        let planText = '';

        if (l.procedure === 'Excision' && l.excisionClosureType !== 'Secondary Intention') needsPlan = true;
        if (l.procedure === 'Punch') needsPlan = true;
        
        if(needsPlan) {
             if (l.skinSutureType === 'Dissolvable') {
                 planText = `- Wound for lesion ${l.id} (${l.location}) closed with dissolvable skin sutures which do not require removal.`;
             } else if (l.skinSutureRemoval) {
                 planText = `- Sutures for lesion ${l.id} (${l.location}) to be removed in ${l.skinSutureRemoval} days.`;
             }
             if(planText) planItems.push(planText);
        }
    });
    
    const openWoundLesions = lesions.filter(l => l.procedure === 'Shave' || (l.procedure === 'Excision' && l.excisionClosureType === 'Secondary Intention'));
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
    editingLesionId = id;

    const setVal = (elId, val) => getEl(elId).value = val;
    const setChecked = (elId, val) => getEl(elId).checked = val;

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
    
    const isNonDissolvable = lesion.skinSutureType !== 'Dissolvable';
    setChecked('useNonDissolvable', isNonDissolvable);
    
    // *** BUG FIX: Manually sync visibility when loading for edit ***
    deepSutureContainer.classList.toggle('hidden', !lesion.useDeepSuture);
    skinSutureDetails.classList.toggle('hidden', !isNonDissolvable);

    if(isNonDissolvable) {
        setVal('skinSutureSize', lesion.skinSutureSize);
        setVal('skinSutureType', lesion.skinSutureType);
        setVal('removalOfSkinSutures', lesion.skinSutureRemoval);
    }
    
    updateFormUI(); // Re-run to ensure visibility is correct after setting all values
    
    formTitle.textContent = `Editing Lesion ${id}`;
    addLesionBtn.textContent = 'Update Lesion';
    cancelEditBtn.style.display = 'block';
    clearProcedureBtn.style.display = 'none';
    window.scrollTo({ top: 0, behavior: 'smooth' });
}
    
function cancelEdit() {
    resetLesionForm();
}

/**
 * Resets just the lesion-specific form fields, not the patient info.
 * @param {boolean} [resetProcType=true] - Whether to reset the procedureType dropdown.
 */
function resetLesionForm(resetProcType = true) {
    editingLesionId = null;

    // Manually reset fields inside the dynamic container
    const dynamicFields = ['lesionLocation', 'anatomicalRegion', 'lesionLength', 'lesionWidth', 'margin', 'punchSize', 'flapGraftJustification', 'provisionalDiagnoses', 'dermoscopyUsed', 'orientationType', 'orientationDescription'];
    dynamicFields.forEach(id => getEl(id).value = '');
    
    // Reset checkboxes
    const checkboxes = ['excludeNMSC', 'excludeMelanoma', 'useDeepSuture'];
    checkboxes.forEach(id => getEl(id).checked = false);
    getEl('useNonDissolvable').checked = true; // Default

    // *** BUG FIX HERE ***
    // Manually sync container visibility with the reset checkbox states
    deepSutureContainer.classList.add('hidden'); // Syncs with useDeepSuture = false
    skinSutureDetails.classList.remove('hidden'); // Syncs with useNonDissolvable = true

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
    getEl('anatomicalRegion').selectedIndex = 0;

    // Reset display elements
    pathologyDisplayEl.textContent = 'Click to select...';
    pathologyDisplayEl.classList.add('italic', 'text-slate-500');
    document.querySelectorAll('.dermoscopy-btn, .justification-btn').forEach(btn => btn.classList.remove('selected'));
    
    getEl('orientationType').value = 'None';
    updateOrientationButtons();
    
    formTitle.textContent = `Enter Lesion ${lesionCounter + 1} Details`;
    addLesionBtn.textContent = 'Add Lesion';
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
    doctorCodeEl.classList.remove('missing-field');
    
    resetLesionForm(); // Resets the lesion part of the form
    updateAllOutputs(); // Clears outputs and lesion list

    // NEW: Reset edit mode state
    lesionForm.dataset.isEditingFile = 'false';
    lesionForm.dataset.originalFilename = '';
    lesionForm.dataset.originalFromFolder = '';
    lesionForm.dataset.originalProcedureId = '';
    lesionForm.dataset.originalDoctorCode = '';
    saveProcedureBtn.textContent = 'Save Procedure';
    clearProcedureBtn.textContent = 'Clear Procedure';
    
    // NEW: Clear autosave
    localStorage.removeItem('autosavedProcedure');
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
        // Find the region text from the *lesion data* when rebuilding the list
        if (lesion.anatomicalRegion) {
            const option = Array.from(getEl('anatomicalRegion').options).find(opt => opt.value === lesion.anatomicalRegion);
            if (option) {
                regionText = option.text.split(':')[0];
            }
        }

        listItem.innerHTML = `
            <div>
                <p class="font-semibold text-slate-700">${lesion.id}. ${lesion.location} <span class="text-blue-600 font-medium ml-2">[${regionText}]</span></p>
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
    autosaveProcedure(); // Call autosave
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
