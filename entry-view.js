// --- MAIN FORM LOGIC ---

// ... existing code ...
// - Generating the text for the output notes

/**
 * Updates the visibility of form sections based on dropdown selections
 * and the current mode (Clinical vs. Billing-Only)
 */
// *** FIX: Make function global by attaching to window ***
window.updateFormUI = function(event) {
    if (event && event.target.id === 'procedureType') {
// ... existing code ...
    checkLesionFormCompleteness();
}

/**
 * Checks if all required fields are filled and enables/disables the Add Lesion button.
 * Highlights missing fields.
 */
// *** FIX: Make function global by attaching to window ***
window.checkLesionFormCompleteness = function() {
    // Helper to validate a single field
// ... existing code ...
    addLesionBtn.disabled = !isAllValid;
}


// --- DATA LOGIC ---

/**
 * Collects data from the form and adds or updates a lesion in the `lesions` array.
 */
// *** FIX: Make function global by attaching to window ***
window.addOrUpdateLesion = function() {
    const isUpdating = editingLesionId !== null;
// ... existing code ...
    updateAllOutputs();
    resetLesionForm();
}

/**
 * Saves the entire procedure (patient info + all lesions) to a .json file.
 */
// *** FIX: Make function global by attaching to window ***
window.saveProcedure = async function() {
    const patientName = patientNameEl.value.trim();
// ... existing code ...
    } catch (err) {
        console.warn('Could not save to folder.', err.message);
        alert(`Error: ${err.message}\n\nCould not save to default folder.`);
    }
}


/**
 * Generates the clinical request text (for pathology).
 * @returns {string} The formatted text.
 */
// *** FIX: Make function global by attaching to window ***
window.generateClinicalRequest = function() {
    if (lesions.length === 0) {
// ... existing code ...
    }).join('\n');
}

/**
 * Generates the full operation note text.
 * @returns {string} The formatted text.
 */
// *** FIX: Make function global by attaching to window ***
window.generateEntryNote = function() {
    if (lesions.length === 0) {
// ... existing code ...
    const doctorCode = (currentAppMode === 'Doctor') ? currentDoctor : 'Practice Manager';

    let header = "PATIENT: " + (patientName || "N/A") + "\n";
    // *** SYNTAX ERROR FIX: Removed stray underscore ***
    header += "DOCTOR: " + (doctorCode || "N/A") + "\n\n";

    // Filter out billing-only lesions
// ... existing code ...
    return note.trim().replace(/^\s+/gm, '');
}

// --- FORM MANAGEMENT ---
// ... existing code ...
 * @param {number} id - The ID of the lesion to edit.
 */
window.startEditLesion = function(id) {
// ... existing code ...
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

/**
 * Cancels the edit and resets the form.
 */
// *** FIX: Make function global by attaching to window ***
window.cancelEdit = function() {
    resetLesionForm();
// ... existing code ...
    currentBillingFile = { handle: null, data: null, fromFolder: '', fromDoctor: '' };
}

/**
 * Resets just the lesion-specific form fields.
 * @param {boolean} [resetProcType=true] - Whether to reset the procedureType dropdown.
 */
// *** FIX: Make function global by attaching to window ***
window.resetLesionForm = function(resetProcType = true) {
    editingLesionId = null;
// ... existing code ...
    updateFormUI();
    checkLesionFormCompleteness();
}

/**
 * Resets the entire form, including patient info and all lesions.
 */
// *** FIX: Make function global by attaching to window ***
window.resetAll = function() {
    lesions = [];
// ... existing code ...
    resetLesionForm();
    updateAllOutputs();
}

/**
 * Updates the list of lesions added to the current procedure.
 */
// *** FIX: Make function global by attaching to window ***
window.updateLesionsList = function() {
    lesionsListEl.innerHTML = '';
// ... existing code ...
    lesionsListEl.appendChild(listItem);
    });
}

/**
// ... existing code ...
 * @param {number} id - The ID of the lesion to remove.
 */
window.removeLesion = function(id) {
// ... existing code ...
    if (editingLesionId === id) cancelEdit();
    updateAllOutputs();
}

/**
 * Updates both output textareas and the lesion list.
 */
// *** FIX: Make function global by attaching to window ***
window.updateAllOutputs = function() {
    updateLesionsList();
// ... existing code ...
    entryNoteOutputEl.value = noteText;
    updateOutputVisibility();
}

/**
 * Copies text from a textarea to the clipboard.
 * @param {string} elementId - The ID of the textarea.
 * @param {HTMLElement} buttonTextElement - The <span> inside the copy button.
 */
// *** FIX: Make function global by attaching to window ***
window.copyToClipboard = function(elementId, buttonTextElement) {
    const outputElement = getEl(elementId);
// ... existing code ...
    window.getSelection().removeAllRanges();
}

/**
 * Sets the output style (combined or separate) in localStorage.
 * @param {string} style - "combined" or "separate".
 */
// *** FIX: Make function global by attaching to window ***
window.setOutputStyle = function(style) {
    localStorage.setItem('medicalNoteGeneratorOutputStyle', style);
    updateOutputVisibility();
}

/**
 * Shows/hides the output textareas based on the selected style.
 */
// *** FIX: Make function global by attaching to window ***
window.updateOutputVisibility = function() {
    const style = localStorage.getItem('medicalNoteGeneratorOutputStyle') || 'combined';
// ... existing code ...
    }
}

/**
 * Updates the orientation buttons based on form values.
 */
// *** FIX: Make function global by attaching to window ***
window.updateOrientationButtons = function() {
    const type = getEl('orientationType').value;
// ... existing code ...
        }
    });
}
