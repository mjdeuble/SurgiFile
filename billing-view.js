// --- BILLING VIEW LOGIC ---

// ... existing code ...
 * and the selected doctor.
 */
// *** FIX: Make function global by attaching to window ***
window.loadBillingFiles = async function() {
    if (!saveFolderHandle || !(await verifyFolderPermission(saveFolderHandle, true))) {
// ... existing code ...
    renderFileLists();
}

/**
 * Recursively scans folders (for Archive)
 */
// *** FIX: Make function global by attaching to window ***
async function scanFolderRecursive(dirHandle, fileList, doctorName, fromFolder) {
    for await (const entry of dirHandle.values()) {
// ... existing code ...
            await scanFolderRecursive(entry, fileList, doctorName, fromFolder);
        }
    }
}


/**
 * Renders the file lists to the UI based on search terms
 */
// *** FIX: Make function global by attaching to window ***
window.renderFileLists = function() {
    const mainSearchTerm = searchBar.value.toLowerCase();
// ... existing code ...
    billedCountDash.textContent = bCount;
    archiveCountDash.textContent = aCount;
}

/**
 * Creates a single file list item div
// ... existing code ...
 * @returns {HTMLElement} The created div element
 */
// *** FIX: Make function global by attaching to window ***
window.createFileListItem = function(item, addCheckbox = false) {
    const { data, fileHandle, fromFolder, fromDoctor } = item;
// ... existing code ...
    el.addEventListener('click', (e) => {
        // Don't open panel if the checkbox was clicked
        if (e.target.type === 'checkbox') return;
        openBillingPanel(item);
    });
    return el;
}

// --- BILLING ASSISTANT LOGIC ---

/**
 * Opens the slide-in billing panel for a specific file
 * @param {object} item - The file object (data, fileHandle, fromFolder, fromDoctor)
 */
// *** FIX: Make function global by attaching to window ***
window.openBillingPanel = function(item) {
    const { data, fileHandle, fromFolder, fromDoctor } = item;
// ... existing code ...
    billingPanel.classList.remove('hidden');
}

/**
 * Handles clicks on the Step 1 (Histology) buttons
 */
// *** FIX: Make function global by attaching to window ***
window.handleHistoClick = function(event, lesion) {
    const target = event.target.closest('.billing-btn');
// ... existing code ...
    // 3. Update final text box
    updateFinalCode(lesion.id);
}

/**
 * Finds the correct excision code from appSettings
 */
// *** FIX: Make function global by attaching to window ***
window.findExcisionCode = function(histoType, region, size) {
    const codes = appSettings.excisions[histoType]?.[region];
// ... existing code ...
    return matchingCodes;
}

/**
 * Creates the HTML for a billing suggestion
 */
// *** FIX: Make function global by attaching to window ***
window.createBillingSuggestion = function(item, desc, type, isRecommended = false, isDisabled = false, reason = '') {
    const suggestionEl = document.createElement('div');
// ... existing code ...
    `;
    return suggestionEl;
}

/**
 * Handles clicks on the "Confirm" / "Added" buttons
 */
// *** FIX: Make function global by attaching to window ***
window.handleConfirmClick = function(event, lesionId, groupType) {
    const target = event.target.closest('.confirm-btn');
// ... existing code ...
    updateFinalCode(lesionId);
}

/**
 * Updates the final item code text box
 */
// *** FIX: Make function global by attaching to window ***
window.updateFinalCode = function(lesionId) {
    const confirmedItems = [];
// ... existing code ...
    const finalCode = confirmedItems.filter(Boolean).join(', ');
    getEl(`lesion-item-${lesionId}`).value = finalCode;
}

// --- FILE ACTIONS (SAVE, DELETE, ARCHIVE) ---

// *** FIX: Make function global by attaching to window ***
window.saveBilledFile = async function() {
    // 1. Get new data from panel
// ... existing code ...
    billingPanel.classList.add('hidden');
    loadBillingFiles();
}

// *** FIX: Make function global by attaching to window ***
window.deleteBillingFile = async function() {
    if (!confirm('Are you sure you want to delete this unprocessed procedure? This cannot be undone.')) {
// ... existing code ...
    billingPanel.classList.add('hidden');
    loadBillingFiles();
}

/**
 * Archives a single file from the billing panel
 */
// *** FIX: Make function global by attaching to window ***
window.archiveBilledFile = async function() {
    if (!confirm('Are you sure you want to archive this item?')) {
// ... existing code ...
    billingPanel.classList.add('hidden');
    loadBillingFiles();
}

/**
 * Archives all selected files in a batch
 */
// *** FIX: Make function global by attaching to window ***
window.archiveBatchFiles = async function() {
    const checkboxes = billedList.querySelectorAll('.batch-checkbox:checked');
// ... existing code ...
    // Refresh the lists
    loadBillingFiles();
}


/**
 * Generates and triggers the print dialog
 */
// *** FIX: Make function global by attaching to window ***
window.printBilledList = function() {
    const mainSearchTerm = searchBar.value.toLowerCase();
// ... existing code ...
    // Use the print-specific stylesheet to show the report
    window.print();
}
