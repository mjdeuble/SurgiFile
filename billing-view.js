// --- BILLING VIEW LOGIC ---

// This file manages all logic for the "Billing & Processing" tab:
// - Loading files from the doctor folders
// - Rendering the Unprocessed, Ready to Bill, and Archive lists
// - Handling search/filtering
// - Opening and managing the Billing Panel (assistant)
// - Moving files between folders (save as billed, archive, send back)
// - Batch processing and printing

/**
 * Loads all billing files based on the current app mode (Doctor or PM)
 * and the selected doctor.
 */
window.loadBillingFiles = async function() {
    if (!saveFolderHandle || !(await verifyFolderPermission(saveFolderHandle, true))) {
        if (currentAppMode === 'Doctor' && !currentDoctor) {
            // This is fine, just means no folder is set
        }
        // Even if no folder, we must clear the lists
        allFiles = { unprocessed: [], billed: [], archive: [] };
        renderFileLists(); // Render empty lists
        return;
    }

    allFiles = { unprocessed: [], billed: [], archive: [] }; // Reset global state

    // Determine which doctors to scan
    let doctorsToScan = [];
    if (currentAppMode === 'PM') {
        doctorsToScan = appSettings.doctorList || [];
    } else if (currentDoctor) {
        doctorsToScan = [currentDoctor];
    }

    for (const doctorDisplayName of doctorsToScan) {
        const doctorFolderName = doctorDisplayName.replace(/\s+/g, '_');
        try {
            const doctorDir = await saveFolderHandle.getDirectoryHandle(doctorFolderName, { create: false });

            // 1. Load Unprocessed
            try {
                const unprocessedDir = await doctorDir.getDirectoryHandle('Unprocessed');
                for await (const entry of unprocessedDir.values()) {
                    if (entry.kind === 'file' && entry.name.endsWith('.json')) {
                        const fileHandle = await unprocessedDir.getFileHandle(entry.name);
                        const file = await fileHandle.getFile();
                        const data = JSON.parse(await file.text());
                        allFiles.unprocessed.push({ data, fileHandle, fromFolder: 'Unprocessed', fromDoctor: doctorDisplayName });
                    }
                }
            } catch (e) { console.error(`No 'Unprocessed' folder for ${doctorDisplayName}?`, e); }

            // 2. Load Billed
            try {
                const billedDir = await doctorDir.getDirectoryHandle('Billed');
                for await (const entry of billedDir.values()) {
                    if (entry.kind === 'file' && entry.name.endsWith('.json')) {
                        const fileHandle = await billedDir.getFileHandle(entry.name);
                        const file = await fileHandle.getFile();
                        const data = JSON.parse(await file.text());
                        allFiles.billed.push({ data, fileHandle, fromFolder: 'Billed', fromDoctor: doctorDisplayName });
                    }
                }
            } catch (e) { console.error(`No 'Billed' folder for ${doctorDisplayName}?`, e); }

            // 3. Load Archive (scans all sub-folders, Year/Month)
            try {
                const archiveDir = await doctorDir.getDirectoryHandle('Archive');
                // Pass true for recursive scan
                await scanFolderRecursive(archiveDir, allFiles.archive, doctorDisplayName, 'Archive');
            } catch (e) { console.error(`No 'Archive' folder for ${doctorDisplayName}?`, e); }

        } catch (e) {
            console.error(`Could not find folder for doctor: ${doctorDisplayName}`, e);
        }
    }


    // Sort files
    // Unprocessed: Newest first
    allFiles.unprocessed.sort((a, b) => b.data.procedureId - a.data.procedureId);
    
    // Billed ("Ready to Bill"):
    if (currentAppMode === 'PM') {
        // PM Mode: Sort by Doctor, then Patient
        allFiles.billed.sort((a, b) => {
            if (a.data.doctorCode < b.data.doctorCode) return -1;
            if (a.data.doctorCode > b.data.doctorCode) return 1;
            // If doctors are same, sort by patient name
            if (a.data.patientName < b.data.patientName) return -1;
            if (a.data.patientName > b.data.patientName) return 1;
            return 0;
        });
    } else {
        // Doctor Mode: Newest first
        allFiles.billed.sort((a, b) => b.data.procedureId - a.data.procedureId);
    }

    // Archive: Newest first
    allFiles.archive.sort((a, b) => b.data.procedureId - a.data.procedureId);

    renderFileLists();
}

/**
 * Recursively scans folders (for Archive)
 */
async function scanFolderRecursive(dirHandle, fileList, doctorName, fromFolder) {
    for await (const entry of dirHandle.values()) {
        if (entry.kind === 'file' && entry.name.endsWith('.json')) {
            const file = await entry.getFile();
            const data = JSON.parse(await file.text());
            fileList.push({ data, fileHandle: entry, fromFolder: fromFolder, fromDoctor: doctorName });
        } else if (entry.kind === 'directory') {
            // This is a sub-folder (e.g., "2025" or "01-Jan")
            // Recurse into it
            await scanFolderRecursive(entry, fileList, doctorName, fromFolder);
        }
    }
}


/**
 * Renders the file lists to the UI based on search terms
 */
window.renderFileLists = function() {
    const mainSearchTerm = searchBar.value.toLowerCase();
    const archiveSearchTerm = archiveSearch.value.toLowerCase(); // Separate search for archive
    
    // Show/hide batch archive button
    batchArchiveBtn.style.display = (currentAppMode === 'PM' && allFiles.billed.length > 0) ? 'flex' : 'none';
    selectAllBtn.style.display = (currentAppMode === 'PM' && allFiles.billed.length > 0) ? 'flex' : 'none';
    selectAllBtn.textContent = 'Select All'; // Reset button text
    
    // --- FIX: Safe access to print buttons ---
    const uBtn = document.getElementById('print-unprocessed-list-btn');
    const bBtn = document.getElementById('print-billed-list-btn');

    if (currentAppMode === 'Doctor') {
        if (uBtn) uBtn.style.display = 'inline-flex';
        if (bBtn) bBtn.style.display = 'none';
    } else { // PM
        if (uBtn) uBtn.style.display = 'none';
        if (bBtn) bBtn.style.display = 'inline-flex';
    }

    const filterAndRender = (listEl, data, searchTerm, isBilledList = false) => {
        listEl.innerHTML = '';
        let count = 0;
        const itemsToRender = data.filter(item => 
            item.data.patientName.toLowerCase().includes(searchTerm) ||
            item.data.doctorCode.toLowerCase().includes(searchTerm)
        );

        if (itemsToRender.length === 0) {
             listEl.innerHTML = `<p class="text-slate-500 italic p-2">No files found.</p>`;
        } else {
            itemsToRender.forEach(item => {
                // Pass true to add a checkbox if it's the Billed list in PM mode
                listEl.appendChild(createFileListItem(item, (isBilledList && currentAppMode === 'PM')));
                count++;
            });
        }
        return count;
    };
    
    const uCount = filterAndRender(unprocessedList, allFiles.unprocessed, mainSearchTerm);
    // Pass true for the isBilledList flag
    const bCount = filterAndRender(billedList, allFiles.billed, mainSearchTerm, true);
    // Use the separate archive search term
    const aCount = filterAndRender(archiveList, allFiles.archive, archiveSearchTerm);

    unprocessedCountDash.textContent = uCount;
    billedCountDash.textContent = bCount;
    archiveCountDash.textContent = aCount;
}

/**
 * Creates a single file list item div
 * @param {object} item - The file object (data, fileHandle, fromFolder, fromDoctor)
 * @param {boolean} addCheckbox - Whether to add a batch-process checkbox
 * @returns {HTMLElement} The created div element
 */
function createFileListItem(item, addCheckbox = false) {
    const { data, fileHandle, fromFolder, fromDoctor } = item;
    const el = document.createElement('div');
    el.className = 'file-list-item bg-white p-3 rounded-lg shadow border border-slate-200';
    
    // Use helper for Australian Date
    const date = window.formatDateToAU(data.procedureDate);
    
    let codes = data.consultItem || '';
    if (data.lesions) {
        codes += ' ' + data.lesions.map(l => l.procedureItemNumber || '').filter(Boolean).join(', ');
    }
    codes = codes.trim();

    // In PM Mode, show the doctor's name on the card
    const doctorNameHTML = currentAppMode === 'PM' 
        ? `<p class="text-sm font-medium text-sky-700">${data.doctorCode}</p>`
        : '';
    
    // Add checkbox for batch processing
    const checkboxHTML = addCheckbox
        ? `<div class="mr-3 pt-1">
             <input type="checkbox" class="batch-checkbox h-5 w-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500" data-filename="${fileHandle.name}">
           </div>`
        : '';

    el.innerHTML = `
      <div class="flex">
        ${checkboxHTML}
        <div class="flex-grow">
            <div class="flex justify-between items-start">
                <p class="font-semibold text-slate-800">${data.patientName}</p>
                ${doctorNameHTML}
            </div>
            <p class="text-sm text-slate-500">${date}</p>
            ${(data.status === 'Billed' || data.status === 'Archived') ? `<p class="text-sm font-medium text-blue-600">${codes || 'No codes'}</p>` : ''}
            ${data.billingComment ? `<p class="text-xs italic text-amber-700 mt-1">Note: ${data.billingComment}</p>` : ''}
            ${data.status === 'Deleted' ? `<p class="text-sm font-bold text-red-600">DELETED</p>` : ''}
        </div>
      </div>
    `;
    
    // Add click event to the main div (but not the checkbox)
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
window.openBillingPanel = function(item) {
    const { data, fileHandle, fromFolder, fromDoctor } = item;
    currentBillingFile = { handle: fileHandle, data: data, fromFolder: fromFolder, fromDoctor: fromDoctor };
    
    billingPanelTitle.textContent = `Patient: ${data.patientName} (Dr. ${data.doctorCode})`;
    
    // 1. Fill Billing Inputs
    billingConsultItem.value = data.consultItem || '';
    billingComment.value = data.billingComment || '';

    // --- UPDATED LOGIC FOR TOGGLE INITIALIZATION ---
    // Default: ON (Checked) to force user to either enter code or turn off.
    consultToggle.checked = true;
    
    // 2. Build Billing Assistant Cards
    billingAssistantLesions.innerHTML = data.lesions.map(l => {
        let regionText = "N/A";
        if (l.anatomicalRegion) {
            const option = Array.from(anatomicalRegionEl.options).find(opt => opt.value === l.anatomicalRegion);
            if (option) regionText = option.text;
        }

        const isComplex = l.excisionClosureType === 'Flap Repair' || l.excisionClosureType === 'Graft Repair' || l.excisionClosureType === 'Graft + Flap';
        let closureText = l.excisionClosureType;
        if (l.excisionClosureType === 'Graft Repair' || l.excisionClosureType === 'Graft + Flap') {
            closureText += ` (${l.graftType || 'N/A'})`;
        }

        // Check if this lesion had a "Time Based" code saved previously (unlikely on unprocessed, but robust)
        const isTimeBased = false; // Default to false on load, buttons will set it

        return `
        <div class="p-4 bg-slate-50 rounded-lg border border-slate-200" data-lesion-id="${l.id}">
            <p class="font-bold text-lg text-slate-700">Lesion ${l.id}: ${l.location}</p>
            
            <div class="mt-2 space-y-1 text-sm text-slate-600">
                <p><strong>Procedure:</strong> ${l.procedure} ${l.procedure === 'Excision' ? `(${l.excisionClosureType})` : ''} ${l.procedure === 'Punch' ? `(${l.punchType})` : ''}</p>
                <p><strong>PDx:</strong> ${l.pathology.replace(/;/g, ', ')}</p>
                <p><strong>Region:</strong> ${regionText}</p>
                <p><strong>Defect Size:</strong> <span class="font-bold text-base">${l.defectSize.toFixed(1)}mm</span></p>
                ${isComplex ? `<p><strong>Closure:</strong> ${closureText}</p>` : ''}
            </div>

            <div class="mt-4">
                <label class="block text-sm font-medium text-slate-600 mb-2">Step 1: Select Final Histology or Action</label>
                <div class="flex flex-wrap gap-2" id="histo-btn-group-${l.id}">
                    <button type="button" class="billing-btn text-sm bg-slate-200 text-slate-700 py-1 px-3 rounded-full" data-histo="BCC/SCC">BCC / SCC</button>
                    <button type="button" class="billing-btn text-sm bg-slate-200 text-slate-700 py-1 px-3 rounded-full" data-histo="Suspected Melanoma">Suspected Melanoma</button>
                    <button type="button" class="billing-btn text-sm bg-slate-200 text-slate-700 py-1 px-3 rounded-full" data-histo="Definitive Melanoma">Definitive Melanoma</button>
                    <button type="button" class="billing-btn text-sm bg-slate-200 text-slate-700 py-1 px-3 rounded-full" data-histo="Benign / Other">Benign / Other</button>
                    <button type="button" class="billing-btn text-sm bg-slate-200 text-slate-700 py-1 px-3 rounded-full" data-histo="Simple Biopsy">Simple Biopsy</button>
                    <!-- RENAMED BUTTON -->
                    <button type="button" class="billing-btn text-sm bg-amber-100 text-amber-800 py-1 px-3 rounded-full" data-histo="Time Based/Custom Code">Time Based/Custom Code</button>
                </div>
            </div>

            <div id="excision-code-container-${l.id}" class="mt-4 hidden space-y-2">
                <label class="block text-sm font-medium text-slate-600">Step 2: Suggested Excision Code</label>
                <div id="excision-btn-group-${l.id}"></div>
            </div>

            <div id="repair-code-container-${l.id}" class="mt-4 hidden space-y-2">
                <label class="block text-sm font-medium text-slate-600">Step 3: Suggested Repair Code (if applicable)</label>
                <div id="repair-btn-group-${l.id}"></div>
            </div>

            <div class="mt-6">
                <label for="lesion-item-${l.id}" class="block text-sm font-medium text-slate-600">Final Procedure Item(s)</label>
                <input type="text" id="lesion-item-${l.id}" data-lesion-id="${l.id}" value="${data.lesions.find(les => les.id === l.id).procedureItemNumber || ''}"
                       class="lesion-item-input w-full bg-white border border-slate-300 rounded-lg p-2 mt-1"
                       placeholder="Select from suggestions above...">
                <!-- Validation msg -->
                <p id="time-code-msg-${l.id}" class="text-sm text-red-600 mt-1 hidden">Please enter a code.</p>
            </div>
        </div>
        `;
    }).join('');

    // 3. Add event listeners
    data.lesions.forEach(l => {
        getEl(`histo-btn-group-${l.id}`).addEventListener('click', (e) => handleHistoClick(e, l));
        getEl(`excision-btn-group-${l.id}`).addEventListener('click', (e) => handleConfirmClick(e, l.id, 'excision'));
        getEl(`repair-btn-group-${l.id}`).addEventListener('click', (e) => handleConfirmClick(e, l.id, 'repair'));
        
        const inputEl = getEl(`lesion-item-${l.id}`);
        inputEl.addEventListener('input', () => {
            validateBillingPanel();
        });
    });

    // 4. Show correct action buttons & Initialize UI
    saveAsBilledBtn.disabled = false;
    saveAsBilledBtn.textContent = 'Save as Billed';
    deleteProcedureBtn.disabled = false;
    deleteProcedureBtn.textContent = 'Delete';
    sendBackBtn.disabled = false;
    sendBackBtn.textContent = 'Send Back to Doctor';

    if (fromFolder === 'Unprocessed' && currentAppMode === 'Doctor') {
        doctorActions.classList.remove('hidden');
        pmActions.classList.add('hidden');
    } else if (fromFolder === 'Billed' && currentAppMode === 'PM') {
        doctorActions.classList.add('hidden');
        pmActions.classList.remove('hidden');
    } else { 
        doctorActions.classList.add('hidden');
        pmActions.classList.add('hidden');
    }

    billingPanel.classList.remove('hidden');
    
    // Initialize Global UI state (hides toggle if needed based on previously selected data, though unlikely for new)
    updateGlobalConsultUI();
    // Also run updateConsultUI to hide/show input based on default toggle state
    if (typeof window.updateConsultUI === 'function') window.updateConsultUI();
    validateBillingPanel(); 
}

/**
 * Checks if "Time Based/Custom Code" is selected for any lesion and updates global UI.
 */
window.updateGlobalConsultUI = function() {
    let isTimeBasedMode = false;
    
    // Iterate all lesions to see if any have "Time Based/Custom Code" selected in DOM
    const lesionDivs = document.querySelectorAll('[data-lesion-id]');
    lesionDivs.forEach(div => {
         const lesionId = div.dataset.lesionId;
         const histoGroup = getEl(`histo-btn-group-${lesionId}`);
         const selectedBtn = histoGroup ? histoGroup.querySelector('.billing-btn.selected') : null;
         if (selectedBtn && selectedBtn.dataset.histo === 'Time Based/Custom Code') {
             isTimeBasedMode = true;
         }
    });

    if (isTimeBasedMode) {
        // Mode: Time Based / Custom
        // 1. Change Label
        if(billingConsultLabel) billingConsultLabel.textContent = "Consult Item/Custom Codes";
        // 2. Hide Toggle Container
        if(consultToggleContainer) consultToggleContainer.classList.add('hidden');
        // 3. Force Input visible and enabled
        if(billingConsultItem) {
            billingConsultItem.style.display = 'block';
            billingConsultItem.disabled = false;
            if(consultDisabledMsg) consultDisabledMsg.classList.add('hidden');
        }
    } else {
        // Mode: Standard
        // 1. Revert Label
        if(billingConsultLabel) billingConsultLabel.textContent = "Consult Item";
        // 2. Show Toggle Container
        if(consultToggleContainer) consultToggleContainer.classList.remove('hidden');
        // 3. Update Input based on current toggle state
        if (typeof window.updateConsultUI === 'function') {
            window.updateConsultUI();
        }
    }
}

/**
 * Handles clicks on the Step 1 (Histology) buttons
 */
function handleHistoClick(event, lesion) {
    const target = event.target.closest('.billing-btn');
    if (!target) return;

    const histoType = target.dataset.histo;
    const lesionId = lesion.id;
    
    // Toggle selected state
    getEl(`histo-btn-group-${lesionId}`).querySelectorAll('.billing-btn').forEach(btn => btn.classList.remove('selected'));
    target.classList.add('selected');

    // Clear lower selections
    const excisionContainer = getEl(`excision-btn-group-${lesionId}`);
    const repairContainer = getEl(`repair-btn-group-${lesionId}`);
    excisionContainer.innerHTML = '';
    repairContainer.innerHTML = '';
    getEl(`excision-code-container-${lesionId}`).classList.add('hidden');
    getEl(`repair-code-container-${lesionId}`).classList.add('hidden');
    
    const inputEl = getEl(`lesion-item-${lesionId}`);
    
    inputEl.value = ''; 
    inputEl.placeholder = 'Select from suggestions above...';

    // --- Check Global UI Mode ---
    updateGlobalConsultUI();

    // --- NEW BILLING LOGIC ---
    const region = lesion.anatomicalRegion;
    const defectSize = lesion.defectSize;
    const clinicalClosure = lesion.procedure === 'Wedge Excision' ? 'Wedge Excision' : lesion.excisionClosureType;
    const isPunchBiopsy = lesion.procedure === 'Punch' && lesion.punchType === 'Punch Biopsy';
    const isShave = lesion.procedure === 'Shave';

    // 1. Get Excision Codes
    let excisionCodes = [];
    
    if (histoType === 'Time Based/Custom Code') {
         // No procedure items for this lesion. Code goes to consult box (globally).
         // Disable local input for clarity.
         inputEl.placeholder = 'No procedure items (Enter code in Consult Box)';
         inputEl.disabled = true; 
         inputEl.classList.add('bg-gray-100');
         inputEl.classList.remove('missing-field'); // Don't error this one
         validateBillingPanel();
         return; // Exit early
         
    } else {
        // Re-enable local input for standard items
        inputEl.disabled = false; 
        inputEl.classList.remove('bg-gray-100');
    }

    if (isPunchBiopsy) {
        const biopsyCode = appSettings.biopsy["30071"];
        if (biopsyCode) excisionCodes = [biopsyCode];
    } else if (isShave) {
        const biopsyCode = appSettings.biopsy["30071"];
        if (biopsyCode) excisionCodes = [biopsyCode];
    } else if (histoType === 'Simple Biopsy') {
        const biopsyCode = appSettings.biopsy["30071"];
        if (biopsyCode) excisionCodes = [biopsyCode];
    } else {
        excisionCodes = findExcisionCode(histoType, region, defectSize);
    }
    
    if (excisionCodes.length > 0) {
        excisionCodes.forEach(code => {
            let isRecommended = (isPunchBiopsy || isShave);
            const btn = createBillingSuggestion(code.item, code.desc, 'excision', isRecommended);
            excisionContainer.appendChild(btn);
        });
        getEl(`excision-code-container-${lesionId}`).classList.remove('hidden');
    }

    // 2. Get Repair Codes
    let suggestedExcisionItem = excisionCodes.length > 0 ? excisionCodes[0].item : null;

    if (histoType !== 'Simple Biopsy' && !isPunchBiopsy && !isShave) {
        const matchingRepairCodes = appSettings.repairs.filter(code => code.clinicalType === clinicalClosure);

        if (matchingRepairCodes.length > 0) {
            matchingRepairCodes.forEach(code => {
                let isRecommended = false;
                let isDisabled = false;
                let reason = '';

                if (code.canClaimWith && suggestedExcisionItem) {
                    if (!code.canClaimWith.includes(suggestedExcisionItem)) {
                        isRecommended = false;
                        isDisabled = true;
                        reason = `(Not co-claimable with ${suggestedExcisionItem})`;
                    }
                }
                if (code.minSize && defectSize < code.minSize) {
                    isRecommended = false;
                    isDisabled = true;
                    reason = `(Defect ${defectSize.toFixed(1)}mm < min size ${code.minSize}mm)`;
                }

                const btn = createBillingSuggestion(code.item, code.desc, 'repair', isRecommended, isDisabled, reason);
                repairContainer.appendChild(btn);
            });
            getEl(`repair-code-container-${lesionId}`).classList.remove('hidden');
        }
    }
    
    // 3. Update final text box
    updateFinalCode(lesionId);
}

// ... (findExcisionCode, createBillingSuggestion, handleConfirmClick, updateFinalCode) ...

/**
 * --- UPDATED VALIDATION FUNCTION ---
 */
function validateBillingPanel() {
    let isPanelValid = true;
    
    // 1. Determine Context (Time Based or Standard)
    let isTimeBasedMode = false;
    if (billingConsultLabel && billingConsultLabel.textContent.includes("Custom Codes")) {
        isTimeBasedMode = true;
    }

    // 2. Check Consult Item Input
    // If Time Based Mode: Input MUST be populated (toggle is hidden, so we treat it as "forced ON")
    if (isTimeBasedMode) {
        if (!billingConsultItem.value.trim()) {
            isPanelValid = false;
            billingConsultItem.classList.add('missing-field');
        } else {
            billingConsultItem.classList.remove('missing-field');
        }
    } else {
        // Standard logic:
        // Valid if (Toggle OFF) OR (Toggle ON AND Input has text)
        if (consultToggle.checked && !billingConsultItem.value.trim()) {
            isPanelValid = false;
            billingConsultItem.classList.add('missing-field');
        } else {
            billingConsultItem.classList.remove('missing-field');
        }
    }

    // 3. Check each lesion
    if (currentBillingFile && currentBillingFile.data && currentBillingFile.data.lesions) {
        for (const lesion of currentBillingFile.data.lesions) {
            const lesionId = lesion.id;
            const histoGroup = getEl(`histo-btn-group-${lesionId}`);
            const selectedHistoBtn = histoGroup.querySelector('.billing-btn.selected');
            const itemInput = getEl(`lesion-item-${lesionId}`);
            
            // a. Check if a histo button is selected
            if (!selectedHistoBtn) {
                isPanelValid = false;
            }

            // b. Check Item Input
            // If this specific lesion is "Time Based/Custom Code", we IGNORE its local input validation
            if (selectedHistoBtn && selectedHistoBtn.dataset.histo === 'Time Based/Custom Code') {
                itemInput.classList.remove('missing-field');
            } else {
                // Standard lesion: Must have code in its local box
                if (!itemInput.value.trim()) {
                    isPanelValid = false;
                    itemInput.classList.add('missing-field');
                } else {
                    itemInput.classList.remove('missing-field');
                }
            }
        }
    } else {
        isPanelValid = false;
    }

    // 3. Enable/Disable the button
    saveAsBilledBtn.disabled = !isPanelValid;
    return isPanelValid;
}

// --- FILE ACTIONS (SAVE, DELETE, ARCHIVE) ---

async function saveBilledFile() {
    // Disable Button to prevent double-click
    saveAsBilledBtn.disabled = true;
    const originalBtnText = saveAsBilledBtn.textContent;
    saveAsBilledBtn.textContent = 'Saving...';

    // --- NEW: Re-run validation and show specific errors ---
    if (!validateBillingPanel()) {
        // Check global mode
        let isTimeBasedMode = (billingConsultLabel.textContent.includes("Custom Codes"));

        // 1. Check consult
        if (isTimeBasedMode) {
             if (!billingConsultItem.value.trim()) {
                showAppAlert("Error: Please enter the Time Based/Custom Code in the main box.", "error");
                billingConsultItem.classList.add('missing-field');
                saveAsBilledBtn.disabled = false; saveAsBilledBtn.textContent = originalBtnText; return;
             }
        } else {
             if (consultToggle.checked && !billingConsultItem.value.trim()) {
                showAppAlert("Error: Please enter a 'Consult Item' number or switch 'Bill Consult' OFF.", "error");
                billingConsultItem.classList.add('missing-field');
                saveAsBilledBtn.disabled = false; saveAsBilledBtn.textContent = originalBtnText; return;
            }
        }
        
        // 2. Check lesions
        for (const lesion of currentBillingFile.data.lesions) {
            const lesionId = lesion.id;
            const histoGroup = getEl(`histo-btn-group-${lesionId}`);
            const selectedBtn = histoGroup.querySelector('.billing-btn.selected');
            const itemInput = getEl(`lesion-item-${lesionId}`);
            
            if (!selectedBtn) {
                showAppAlert(`Error: Please select a 'Final Histology' for Lesion ${lesionId}.`, "error");
                histoGroup.closest('.p-4').classList.add('missing-field');
                saveAsBilledBtn.disabled = false; saveAsBilledBtn.textContent = originalBtnText; return; 
            } 
            
            if (selectedBtn.dataset.histo !== 'Time Based/Custom Code' && !itemInput.value.trim()) {
                showAppAlert(`Error: Please add a 'Final Procedure Item' for Lesion ${lesionId}.`, "error");
                itemInput.focus();
                saveAsBilledBtn.disabled = false; saveAsBilledBtn.textContent = originalBtnText; return;
            }
        }
        // Fallback
        saveAsBilledBtn.disabled = false; saveAsBilledBtn.textContent = originalBtnText; return;
    }
    // --- End Validation ---

    // 1. Get new data from panel
    const updatedData = { ...currentBillingFile.data };
    updatedData.consultItem = billingConsultItem.value;
    updatedData.billingComment = billingComment.value;
    updatedData.status = 'Billed';

    document.querySelectorAll('.lesion-item-input').forEach(input => {
        const lesionId = parseInt(input.dataset.lesionId, 10);
        const lesion = updatedData.lesions.find(l => l.id === lesionId);
        if (lesion) {
            lesion.procedureItemNumber = input.value;
        }
    });

    // 2. Move file
    try {
        await moveFile('Unprocessed', 'Billed', currentBillingFile.handle, updatedData, currentBillingFile.fromDoctor);
        // 3. Refresh UI
        billingPanel.classList.add('hidden');
        loadBillingFiles();
    } catch (e) {
        // Error handled by moveFile alert, but re-enable button here just in case
        saveAsBilledBtn.disabled = false;
        saveAsBilledBtn.textContent = originalBtnText;
    }
}

async function deleteBillingFile() {
    if (!await showAppConfirm('Are you sure you want to delete this unprocessed procedure? This cannot be undone.', "warning")) {
        return;
    }
    
    // Disable button
    deleteProcedureBtn.disabled = true;
    deleteProcedureBtn.textContent = 'Deleting...';

    // 1. Update status to 'Deleted'
    const updatedData = { ...currentBillingFile.data, status: 'Deleted', billingComment: `DELETED by doctor on ${new Date().toLocaleDateString()}` };

    // 2. Move file from 'Unprocessed' to 'Archive'
    try {
        await moveFile('Unprocessed', 'Archive', currentBillingFile.handle, updatedData, currentBillingFile.fromDoctor);
        // 3. Refresh UI
        billingPanel.classList.add('hidden');
        loadBillingFiles();
    } catch(e) {
        deleteProcedureBtn.disabled = false;
        deleteProcedureBtn.textContent = 'Delete';
    }
}

/**
 * Archives a single file from the billing panel
 */
async function archiveBilledFile() {
    if (!await showAppConfirm('Are you sure you want to archive this item?', "info")) {
        return;
    }
    
    const archiveBtn = getEl('move-to-archive-btn');
    archiveBtn.disabled = true;
    archiveBtn.textContent = 'Archiving...';

    // 1. Update status to 'Archived'
    const updatedData = { ...currentBillingFile.data, status: 'Archived' };
    
    // 2. Move file from 'Billed' to 'Archive'
    try {
        await moveFile('Billed', 'Archive', currentBillingFile.handle, updatedData, currentBillingFile.fromDoctor);
        // 3. Refresh UI
        billingPanel.classList.add('hidden');
        loadBillingFiles();
    } catch(e) {
        archiveBtn.disabled = false;
        archiveBtn.textContent = 'Archive this one item';
    }
}

/**
 * --- NEW: Sends a file from 'Billed' back to 'Unprocessed' ---
 */
async function sendBackToDoctor() {
    const reason = billingComment.value.trim();
    if (!reason) {
        showAppAlert("Please add a comment in the 'Billing Comment' box explaining why this is being sent back.", "error");
        billingComment.classList.add('missing-field');
        return;
    }
    
    if (!await showAppConfirm('Are you sure you want to send this item back to the doctor for review?', "warning")) {
        return;
    }
    
    sendBackBtn.disabled = true;
    sendBackBtn.textContent = 'Sending...';

    // 1. Update status and add PM comment
    const updatedData = { ...currentBillingFile.data };
    updatedData.status = 'Unprocessed'; // Set status back
    // Prepend the PM's reason to any existing comment
    const oldComment = updatedData.billingComment ? ` (Original: ${updatedData.billingComment})` : '';
    updatedData.billingComment = `PM REVIEW: ${reason}${oldComment}`;
    
    // 2. Move file from 'Billed' to 'Unprocessed'
    try {
        await moveFile('Billed', 'Unprocessed', currentBillingFile.handle, updatedData, currentBillingFile.fromDoctor);
        // 3. Refresh UI
        billingPanel.classList.add('hidden');
        loadBillingFiles();
    } catch(e) {
        sendBackBtn.disabled = false;
        sendBackBtn.textContent = 'Send Back to Doctor';
    }
}


/**
 * Archives all selected files in a batch
 */
async function archiveBatchFiles() {
    const checkboxes = billedList.querySelectorAll('.batch-checkbox:checked');
    if (checkboxes.length === 0) {
        showAppAlert("Please select items to archive using the checkboxes.", "info");
        return;
    }

    if (!await showAppConfirm(`Are you sure you want to archive ${checkboxes.length} item(s)?`, "info")) {
        return;
    }

    // Disable UI
    batchArchiveBtn.disabled = true;
    batchArchiveBtn.textContent = 'Archiving...';

    let successCount = 0;
    for (const cb of checkboxes) {
        const filename = cb.dataset.filename;
        // Find the corresponding file object from the global state
        const fileItem = allFiles.billed.find(f => f.fileHandle.name === filename);

        if (fileItem) {
            try {
                const updatedData = { ...fileItem.data, status: 'Archived' };
                await moveFile('Billed', 'Archive', fileItem.fileHandle, updatedData, fileItem.fromDoctor);
                successCount++;
            } catch (e) {
                console.error(`Failed to archive ${filename}:`, e);
                showAppAlert(`Failed to archive ${filename}. Please try again.`, "error");
            }
        }
    }

    // Re-enable UI
    batchArchiveBtn.disabled = false;
    batchArchiveBtn.textContent = 'Batch Archive Selected';

    showAppAlert(`Successfully archived ${successCount} of ${checkboxes.length} items.`, "success");
    
    // Refresh the lists
    loadBillingFiles();
}


/**
 * --- NEW: Selects or deselects all checkboxes in the "Ready to Bill" list
 */
window.toggleSelectAll = function() {
    const checkboxes = billedList.querySelectorAll('.batch-checkbox');
    // Check if the button currently says "Select All"
    const isSelectAll = (selectAllBtn.textContent === 'Select All');
    
    checkboxes.forEach(cb => {
        cb.checked = isSelectAll;
    });
    
    // Toggle button text
    selectAllBtn.textContent = isSelectAll ? 'Deselect All' : 'Select All';
}


/**
 * Generates and triggers the print dialog for the "Ready to Bill" list
 */
window.printBilledList = function() {
    const mainSearchTerm = searchBar.value.toLowerCase();
    const itemsToPrint = allFiles.billed.filter(item => 
        item.data.patientName.toLowerCase().includes(mainSearchTerm) ||
        item.data.doctorCode.toLowerCase().includes(mainSearchTerm)
    );
    
    if (itemsToPrint.length === 0) {
        showAppAlert("No items in 'Ready to Bill' to print.", "info");
        return;
    }

    let doctorHeader = (currentAppMode === 'PM') ? 'All Doctors' : currentDoctor;
    
    let reportHTML = `<h1 class="text-2xl font-bold mb-4">Billing Run Sheet - ${doctorHeader}</h1>`;
    // Use new date helper
    reportHTML += `<h2 class="text-lg font-medium mb-6">Generated: ${window.formatDateToAU(new Date())}</h2>`;
    
    let currentDoctorGroup = "";
    
    itemsToPrint.forEach(item => {
        const data = item.data;
        
        // 1. Print Doctor Header (if PM mode and doctor is different)
        if (currentAppMode === 'PM' && data.doctorCode !== currentDoctorGroup) {
            currentDoctorGroup = data.doctorCode;
            reportHTML += `<h1 class="text-xl font-bold p-2 bg-slate-200 mt-6 mb-3">Doctor: ${currentDoctorGroup}</h1>`;
        }
        
        // 2. Print Patient Subheading
        const date = window.formatDateToAU(data.procedureDate);
        reportHTML += `<div style="border-top: 1px solid #ccc; padding: 10px 0;">`; 
        reportHTML += `<h2 class="text-lg font-semibold">${data.patientName}</h2>`;
        reportHTML += `<div class="ml-4 mb-2 text-sm text-slate-700"><strong>Date:</strong> ${date}</div>`;
        
        // 3. Print Lesion Details
        data.lesions.forEach(l => {
            let procText = l.procedure;
            if (l.procedure === 'Excision') {
                procText += ` (${l.excisionClosureType})`;
                if (l.excisionClosureType === 'Graft Repair' || l.excisionClosureType === 'Graft + Flap') {
                     procText += ` (${l.graftType})`;
                }
            }
            if (l.procedure === 'Punch') procText += ` (${l.punchType})`;
            
            reportHTML += `
                <div class="ml-8 mb-3 p-2 bg-slate-50" style="border-left: 3px solid #64748b;">
                    <strong class="text-slate-800">Lesion ${l.id}: ${l.location}</strong>
                    <div class="ml-4">
                        <div><strong>Procedure:</strong> ${procText}</div>
                        <div><strong>Defect Size:</strong> ${l.defectSize.toFixed(1)}mm</div>
                        <div><strong>Histology:</strong> ${l.pathology.replace(/;/g, ', ')}</div>
                        <div class="font-medium text-blue-700"><strong>Procedure Items:</strong> ${l.procedureItemNumber || 'N/A'}</div>
                    </div>
                </div>
            `;
        });
        
        // 4. Print Consult & Comment
        reportHTML += `<div class="ml-8">`;
        if (data.consultItem) {
             reportHTML += `<div class="font-medium text-blue-700"><strong>Consult Item:</strong> ${data.consultItem}</div>`;
        }
        if (data.billingComment) {
            reportHTML += `<div class="text-sm italic text-amber-700"><strong>Comment:</strong> ${data.billingComment}</div>`;
        }
        reportHTML += `</div></div>`; 
    });
    
    printContent(reportHTML);
}

/**
 * --- NEW FUNCTION ---
 * Prints the "Unprocessed" list for the doctor, with space for notes
 */
window.printUnprocessedList = function() {
    const mainSearchTerm = searchBar.value.toLowerCase();
    const itemsToPrint = allFiles.unprocessed.filter(item => 
        item.data.patientName.toLowerCase().includes(mainSearchTerm)
    );

    if (itemsToPrint.length === 0) {
        showAppAlert("No items in 'Unprocessed' to print.", "info");
        return;
    }

    let reportHTML = `<h1 class="text-2xl font-bold mb-4">Outstanding Billing List - ${currentDoctor}</h1>`;
    reportHTML += `<h2 class="text-lg font-medium mb-6">Generated: ${window.formatDateToAU(new Date())}</h2>`;
    reportHTML += `<p class="mb-6 text-sm italic">Use this sheet to manually record item numbers for later entry.</p>`;

    itemsToPrint.forEach(item => {
        const data = item.data;
        const date = window.formatDateToAU(data.procedureDate);
        
        reportHTML += `<div style="border: 1px solid #94a3b8; padding: 15px; margin-bottom: 20px; break-inside: avoid; border-radius: 8px;">`;
        reportHTML += `<div style="display:flex; justify-content:space-between;">`;
        reportHTML += `<h2 class="text-lg font-bold">${data.patientName}</h2>`;
        reportHTML += `<span class="text-slate-600">${date}</span>`;
        reportHTML += `</div>`;

        data.lesions.forEach(l => {
             let procText = l.procedure;
             if (l.procedure === 'Excision') procText += ` (${l.excisionClosureType})`;
             
             reportHTML += `
                <div style="margin-top: 10px; padding-left: 10px; border-left: 4px solid #cbd5e1;">
                    <div><strong>Lesion ${l.id}:</strong> ${l.location}</div>
                    <div class="text-sm text-slate-600">${procText}</div>
                    <div class="text-sm text-slate-600">Defect: ${l.defectSize.toFixed(1)}mm</div>
                    <div class="text-sm text-slate-600">PDx: ${l.pathology}</div>
                    
                    <div style="margin-top: 8px; display: flex; gap: 15px; align-items: center;">
                        <div style="border-bottom: 1px solid #334155; width: 150px; height: 25px;">
                            <span class="text-xs text-slate-500">Item Number(s):</span>
                        </div>
                        <div style="border-bottom: 1px solid #334155; width: 100px; height: 25px;">
                            <span class="text-xs text-slate-500">Consult:</span>
                        </div>
                    </div>
                </div>
             `;
        });
        
        // General notes area
        reportHTML += `<div style="margin-top: 15px; border-top: 1px dashed #ccc; padding-top: 5px;">`;
        reportHTML += `<span class="text-xs text-slate-400">Notes:</span>`;
        reportHTML += `<div style="height: 40px;"></div>`;
        reportHTML += `</div>`;
        
        reportHTML += `</div>`; 
    });

    printContent(reportHTML);
}

/**
 * Helper to execute print
 */
function printContent(htmlContent) {
    const printReportEl = getEl('printable-report');
    printReportEl.innerHTML = htmlContent;
    
    printReportEl.style.display = 'block';
    printReportEl.style.position = 'static'; 
    printReportEl.style.width = 'auto';
    printReportEl.style.height = 'auto';
    printReportEl.style.overflow = 'visible';
    
    window.print();
}

// --- NEW: Add event listener to hide report after printing ---
window.onafterprint = () => {
    const printReportEl = getEl('printable-report');
    if (printReportEl) {
        printReportEl.style.display = 'none';
    }
};
