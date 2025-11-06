// --- BILLING VIEW LOGIC ---

// This file manages all logic for the "Billing & Processing" tab:
// - Loading files from the doctor folders
// - Rendering the Unprocessed, Ready to Bill, and Archive lists
// - Handling search/filtering
// - Opening and managing the Billing Panel (assistant)
// - Moving files between folders (save as billed, archive)
// - Batch processing and printing

/**
 * Loads all billing files based on the current app mode (Doctor or PM)
 * and the selected doctor.
 */
async function loadBillingFiles() {
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
function renderFileLists() {
    const mainSearchTerm = searchBar.value.toLowerCase();
    const archiveSearchTerm = archiveSearch.value.toLowerCase(); // Separate search for archive
    
    // Show/hide batch archive button
    batchArchiveBtn.style.display = (currentAppMode === 'PM' && allFiles.billed.length > 0) ? 'flex' : 'none';

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
    const date = new Date(data.procedureDate).toLocaleDateString();
    
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
function openBillingPanel(item) {
    const { data, fileHandle, fromFolder, fromDoctor } = item;
    currentBillingFile = { handle: fileHandle, data: data, fromFolder: fromFolder, fromDoctor: fromDoctor };
    
    billingPanelTitle.textContent = `Patient: ${data.patientName} (Dr. ${data.doctorCode})`;
    
    // 1. Fill Billing Inputs
    billingConsultItem.value = data.consultItem || '';
    billingComment.value = data.billingComment || '';
    
    // 2. Build Billing Assistant Cards
    billingAssistantLesions.innerHTML = data.lesions.map(l => {
        let regionText = "N/A";
        if (l.anatomicalRegion) {
            const option = Array.from(anatomicalRegionEl.options).find(opt => opt.value === l.anatomicalRegion);
            if (option) regionText = option.text;
        }

        const isComplex = l.excisionClosureType === 'Flap Repair' || l.excisionClosureType === 'Graft Repair' || l.excisionClosureType === 'Graft + Flap';

        return `
        <div class="p-4 bg-slate-50 rounded-lg border border-slate-200" data-lesion-id="${l.id}">
            <p class="font-bold text-lg text-slate-700">Lesion ${l.id}: ${l.location}</p>
            
            <div class="mt-2 space-y-1 text-sm text-slate-600">
                <p><strong>Procedure:</strong> ${l.procedure} ${l.procedure === 'Excision' ? `(${l.excisionClosureType})` : ''} ${l.procedure === 'Punch' ? `(${l.punchType})` : ''}</p>
                <p><strong>PDx:</strong> ${l.pathology.replace(/;/g, ', ')}</p>
                <p><strong>Region:</strong> ${regionText}</p>
                <p><strong>Defect Size:</strong> <span class="font-bold text-base">${l.defectSize.toFixed(1)}mm</span></p>
                ${isComplex ? `<p><strong>Closure:</strong> ${l.excisionClosureType} ${l.graftType ? `(${l.graftType})` : ''}</p>` : ''}
            </div>

            <div class="mt-4">
                <label class="block text-sm font-medium text-slate-600 mb-2">Step 1: Select Final Histology or Action</label>
                <div class="flex flex-wrap gap-2" id="histo-btn-group-${l.id}">
                    <button type="button" class="billing-btn text-sm bg-slate-200 text-slate-700 py-1 px-3 rounded-full" data-histo="BCC/SCC">BCC / SCC</button>
                    <button type="button" class="billing-btn text-sm bg-slate-200 text-slate-700 py-1 px-3 rounded-full" data-histo="Suspected Melanoma">Suspected Melanoma</button>
                    <button type="button" class="billing-btn text-sm bg-slate-200 text-slate-700 py-1 px-3 rounded-full" data-histo="Definitive Melanoma">Definitive Melanoma</button>
                    <button type="button" class="billing-btn text-sm bg-slate-200 text-slate-700 py-1 px-3 rounded-full" data-histo="Benign / Other">Benign / Other</button>
                    <button type="button" class="billing-btn text-sm bg-slate-200 text-slate-700 py-1 px-3 rounded-full" data-histo="Simple Biopsy">Simple Biopsy</button>
                    <button type="button" class="billing-btn text-sm bg-amber-100 text-amber-800 py-1 px-3 rounded-full" data-histo="Time Based Only">Time Based Only</button>
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
                       class="lesion-item-input w-full bg-white border border-slate-300 rounded-lg p-2 mt-1">
            </div>
        </div>
        `;
    }).join('');

    // 3. Add event listeners to the new buttons
    data.lesions.forEach(l => {
        getEl(`histo-btn-group-${l.id}`).addEventListener('click', (e) => handleHistoClick(e, l));
        getEl(`excision-btn-group-${l.id}`).addEventListener('click', (e) => handleConfirmClick(e, l.id, 'excision'));
        getEl(`repair-btn-group-${l.id}`).addEventListener('click', (e) => handleConfirmClick(e, l.id, 'repair'));
    });


    // 4. Show correct action buttons
    if (fromFolder === 'Unprocessed' && currentAppMode === 'Doctor') {
        doctorActions.classList.remove('hidden');
        pmActions.classList.add('hidden');
    } else if (fromFolder === 'Billed' && currentAppMode === 'PM') {
        doctorActions.classList.add('hidden');
        pmActions.classList.remove('hidden');
    } else { // Archive, or wrong mode
        doctorActions.classList.add('hidden');
        pmActions.classList.add('hidden');
    }

    billingPanel.classList.remove('hidden');
}

/**
 * Handles clicks on the Step 1 (Histology) buttons
 */
function handleHistoClick(event, lesion) {
    const target = event.target.closest('.billing-btn');
    if (!target) return;

    const histoType = target.dataset.histo;
    
    // Toggle selected state
    getEl(`histo-btn-group-${lesion.id}`).querySelectorAll('.billing-btn').forEach(btn => btn.classList.remove('selected'));
    target.classList.add('selected');

    // Clear lower selections
    const excisionContainer = getEl(`excision-btn-group-${lesion.id}`);
    const repairContainer = getEl(`repair-btn-group-${lesion.id}`);
    excisionContainer.innerHTML = '';
    repairContainer.innerHTML = '';
    getEl(`excision-code-container-${lesion.id}`).classList.add('hidden');
    getEl(`repair-code-container-${lesion.id}`).classList.add('hidden');
    getEl(`lesion-item-${lesion.id}`).value = '';

    // --- NEW BILLING LOGIC ---
    const region = lesion.anatomicalRegion;
    const defectSize = lesion.defectSize;
    // Map the clinical procedure type to the one in settings-view.js
    const clinicalClosure = lesion.procedure === 'Wedge Excision' ? 'Wedge Excision' : lesion.excisionClosureType;

    // 1. Get Excision Codes
    let excisionCodes = [];
    if (histoType === 'Simple Biopsy') {
        // Find the '30071' code
        const biopsyCode = appSettings.biopsy["30071"];
        if (biopsyCode) excisionCodes = [biopsyCode];
    } else if (histoType === 'Time Based Only') {
         getEl(`lesion-item-${lesion.id}`).value = 'Time Based';
         return;
    } else {
        excisionCodes = findExcisionCode(histoType, region, defectSize);
    }
    
    if (excisionCodes.length > 0) {
        excisionCodes.forEach(code => {
            // Create suggestion, auto-confirm if it's the only one
            const btn = createBillingSuggestion(code.item, code.desc, 'excision', true);
            excisionContainer.appendChild(btn);
        });
        getEl(`excision-code-container-${lesion.id}`).classList.remove('hidden');
    }

    // 2. Get Repair Codes (if not a simple biopsy or time-based)
    let suggestedExcisionItem = excisionCodes.length > 0 ? excisionCodes[0].item : null;

    if (histoType !== 'Simple Biopsy' && histoType !== 'Time Based Only') {
        // Find repair codes that match the clinical closure type
        const matchingRepairCodes = appSettings.repairs.filter(code => code.clinicalType === clinicalClosure);

        if (matchingRepairCodes.length > 0) {
            matchingRepairCodes.forEach(code => {
                let isRecommended = true;
                let isDisabled = false;
                let reason = '';

                // Check co-claiming rules
                if (code.canClaimWith && suggestedExcisionItem) {
                    if (!code.canClaimWith.includes(suggestedExcisionItem)) {
                        isRecommended = false;
                        isDisabled = true;
                        reason = `(Not co-claimable with ${suggestedExcisionItem})`;
                    }
                }
                // Check min size rules
                if (code.minSize && defectSize < code.minSize) {
                    isRecommended = false;
                    isDisabled = true;
                    reason = `(Defect ${defectSize.toFixed(1)}mm < min size ${code.minSize}mm)`;
                }

                const btn = createBillingSuggestion(code.item, code.desc, 'repair', isRecommended, isDisabled, reason);
                repairContainer.appendChild(btn);
            });
            getEl(`repair-code-container-${lesion.id}`).classList.remove('hidden');
        }
    }
    
    // 3. Update final text box
    updateFinalCode(lesion.id);
}

/**
 * Finds the correct excision code from appSettings
 */
function findExcisionCode(histoType, region, size) {
    const codes = appSettings.excisions[histoType]?.[region];
    if (!codes) return [];

    // Use .filter to find all matches (though usually it's one)
    const matchingCodes = codes.filter(code => {
        const minOk = code.minSize ? size >= code.minSize : true;
        const maxOk = code.maxSize ? size <= code.maxSize : true;
        return minOk && maxOk;
    });
    
    return matchingCodes;
}

/**
 * Creates the HTML for a billing suggestion
 */
function createBillingSuggestion(item, desc, type, isRecommended = false, isDisabled = false, reason = '') {
    const suggestionEl = document.createElement('div');
    suggestionEl.className = `billing-suggestion ${isRecommended ? 'confirmed' : ''} ${isDisabled ? 'disabled' : ''}`;
    suggestionEl.dataset.item = item;
    suggestionEl.dataset.type = type;

    const btnText = isRecommended ? 'Added' : 'Confirm';
    const reasonHTML = reason ? `<span class="text-xs text-red-600 ml-2">${reason}</span>` : '';
    const recommendedHTML = isRecommended ? `<span class="text-xs font-medium text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">Recommended</span>` : '';

    suggestionEl.innerHTML = `
        <div class="flex-grow">
            <div>
                <span class="font-bold text-slate-800">${item}</span>
                <span class="text-sm text-slate-600 ml-2">${desc}</span>
                ${reasonHTML}
            </div>
        </div>
        <div class="flex-shrink-0 flex items-center gap-2">
            ${recommendedHTML}
            <button type="button" class="confirm-btn" ${isDisabled ? 'disabled' : ''}>${btnText}</button>
        </div>
    `;
    return suggestionEl;
}

/**
 * Handles clicks on the "Confirm" / "Added" buttons
 */
function handleConfirmClick(event, lesionId, groupType) {
    const target = event.target.closest('.confirm-btn');
    if (!target) return;

    const suggestionEl = target.closest('.billing-suggestion');
    if (!suggestionEl) return;
    
    // Toggle confirmed state
    suggestionEl.classList.toggle('confirmed');
    target.textContent = suggestionEl.classList.contains('confirmed') ? 'Added' : 'Confirm';
    
    // If it's an excision, re-check repair code rules
    if (groupType === 'excision') {
        // TODO: Re-validate repair codes based on this new selection
    }

    updateFinalCode(lesionId);
}

/**
 * Updates the final item code text box
 */
function updateFinalCode(lesionId) {
    const confirmedItems = [];
    // Get all confirmed buttons, respecting the order (excision then repair)
    const excisionBtn = getEl(`excision-btn-group-${lesionId}`).querySelector('.confirmed');
    if (excisionBtn) confirmedItems.push(excisionBtn.dataset.item);

    const repairBtns = getEl(`repair-btn-group-${lesionId}`).querySelectorAll('.confirmed');
    repairBtns.forEach(btn => confirmedItems.push(btn.dataset.item));
    
    const finalCode = confirmedItems.filter(Boolean).join(', ');
    getEl(`lesion-item-${lesionId}`).value = finalCode;
}

// --- FILE ACTIONS (SAVE, DELETE, ARCHIVE) ---

async function saveBilledFile() {
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
    await moveFile('Unprocessed', 'Billed', currentBillingFile.handle, updatedData, currentBillingFile.fromDoctor);

    // 3. Refresh UI
    billingPanel.classList.add('hidden');
    loadBillingFiles();
}

async function deleteBillingFile() {
    if (!confirm('Are you sure you want to delete this unprocessed procedure? This cannot be undone.')) {
        return;
    }
    // 1. Update status to 'Deleted'
    const updatedData = { ...currentBillingFile.data, status: 'Deleted', billingComment: `DELETED by doctor on ${new Date().toLocaleDateString()}` };

    // 2. Move file from 'Unprocessed' to 'Archive'
    await moveFile('Unprocessed', 'Archive', currentBillingFile.handle, updatedData, currentBillingFile.fromDoctor);

    // 3. Refresh UI
    billingPanel.classList.add('hidden');
    loadBillingFiles();
}

/**
 * Archives a single file from the billing panel
 */
async function archiveBilledFile() {
    if (!confirm('Are you sure you want to archive this item?')) {
        return;
    }
    
    // 1. Update status to 'Archived'
    const updatedData = { ...currentBillingFile.data, status: 'Archived' };
    
    // 2. Move file from 'Billed' to 'Archive'
    await moveFile('Billed', 'Archive', currentBillingFile.handle, updatedData, currentBillingFile.fromDoctor);

    // 3. Refresh UI
    billingPanel.classList.add('hidden');
    loadBillingFiles();
}

/**
 * Archives all selected files in a batch
 */
async function archiveBatchFiles() {
    const checkboxes = billedList.querySelectorAll('.batch-checkbox:checked');
    if (checkboxes.length === 0) {
        alert("Please select items to archive using the checkboxes.");
        return;
    }

    if (!confirm(`Are you sure you want to archive ${checkboxes.length} item(s)?`)) {
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
                alert(`Failed to archive ${filename}. Please try again.`);
            }
        }
    }

    // Re-enable UI
    batchArchiveBtn.disabled = false;
    batchArchiveBtn.textContent = 'Batch Archive Selected';

    alert(`Successfully archived ${successCount} of ${checkboxes.length} items.`);
    
    // Refresh the lists
    loadBillingFiles();
}


/**
 * Generates and triggers the print dialog
 */
function printBilledList() {
    const mainSearchTerm = searchBar.value.toLowerCase();
    const itemsToPrint = allFiles.billed.filter(item => 
        item.data.patientName.toLowerCase().includes(mainSearchTerm) ||
        item.data.doctorCode.toLowerCase().includes(mainSearchTerm)
    );
    
    if (itemsToPrint.length === 0) {
        alert("No items in 'Ready to Bill' to print.");
        return;
    }

    let doctorHeader = (currentAppMode === 'PM') ? 'All Doctors' : currentDoctor;
    printTitle.innerHTML = `Billing Run Sheet - ${doctorHeader} - ${new Date().toLocaleDateString()}`;
    
    let tableHTML = `
        <thead>
            <tr>
                <th class="w-8">[ ]</th>
                <th>Patient Name</th>
                ${currentAppMode === 'PM' ? '<th>Doctor</th>' : ''}
                <th>Date</th>
                <th>Consult</th>
                <th>Procedure Items</th>
                <th>Comment</th>
            </tr>
        </thead>
        <tbody>
    `;
    
    itemsToPrint.forEach(item => {
        const data = item.data;
        const date = new Date(data.procedureDate).toLocaleDateString();
        const consult = data.consultItem || '';
        const procedures = data.lesions.map(l => l.procedureItemNumber || '').filter(Boolean).join(', ');
        const comment = data.billingComment || '';
        
        tableHTML += `
            <tr>
                <td>[ &nbsp; ]</td>
                <td>${data.patientName}</td>
                 ${currentAppMode === 'PM' ? `<td>${data.doctorCode}</td>` : ''}
                <td>${date}</td>
                <td>${consult}</td>
                <td>${procedures}</td>
                <td>${comment}</td>
            </tr>
        `;
    });
    
    tableHTML += `</tbody>`;
    printTable.innerHTML = tableHTML;
    
    // Use the print-specific stylesheet to show the report
    window.print();
}
