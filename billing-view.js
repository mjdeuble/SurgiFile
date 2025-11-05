// --- BILLING VIEW LOGIC ---
// This file manages all interactivity for the "Billing & Processing" tab.
// All DOM element references (e.g., loadFilesBtn, billingPanel) are
// defined in 'main.js' and assumed to be available.

/**
 * Toggles the Practice Manager (PM) mode UI changes.
 */
function togglePMMode() {
    billingViewContainer.classList.toggle('pm-mode-active', pmModeToggle.checked);
    appTitle.textContent = pmModeToggle.checked ? "Billing & Processing (PM View)" : "Clinical Management PWA";
}

/**
 * Loads all .json files from the Unprocessed, Billed, and Archive directories.
 */
async function loadBillingFiles() {
    if (!saveFolderHandle || !(await verifyFolderPermission(saveFolderHandle, true))) {
        // Use a modal in production
        alert("Please set the default save folder and grant permission first.");
        switchTab('entry');
        return;
    }

    allFiles = { unprocessed: [], billed: [], archive: [] }; // Reset global state

    try {
        // 1. Load Unprocessed
        const unprocessedDir = await saveFolderHandle.getDirectoryHandle('Unprocessed');
        for await (const entry of unprocessedDir.values()) {
            if (entry.kind === 'file' && entry.name.endsWith('.json')) {
                const fileHandle = await unprocessedDir.getFileHandle(entry.name);
                const file = await fileHandle.getFile();
                const data = JSON.parse(await file.text());
                allFiles.unprocessed.push({ data, fileHandle, fromFolder: 'Unprocessed' });
            }
        }
    } catch(e) { console.error('Error loading Unprocessed:', e); }

    try {
        // 2. Load Billed
        const billedDir = await saveFolderHandle.getDirectoryHandle('Billed');
        for await (const entry of billedDir.values()) {
            if (entry.kind === 'file' && entry.name.endsWith('.json')) {
                const fileHandle = await billedDir.getFileHandle(entry.name);
                const file = await fileHandle.getFile();
                const data = JSON.parse(await file.text());
                allFiles.billed.push({ data, fileHandle, fromFolder: 'Billed' });
            }
        }
    } catch(e) { console.error('Error loading Billed:', e); }

    try {
        // 3. Load Archive
        const archiveDir = await saveFolderHandle.getDirectoryHandle('Archive');
         for await (const entry of archiveDir.values()) {
            if (entry.kind === 'file' && entry.name.endsWith('.json')) {
                const fileHandle = await archiveDir.getFileHandle(entry.name);
                const file = await fileHandle.getFile();
                const data = JSON.parse(await file.text());
                allFiles.archive.push({ data, fileHandle, fromFolder: 'Archive' });
            }
        }
    } catch(e) { console.error('Error loading Archive:', e); }

    // Sort files by date, newest first
    allFiles.unprocessed.sort((a, b) => b.data.procedureId - a.data.procedureId);
    allFiles.billed.sort((a, b) => b.data.procedureId - a.data.procedureId);
    allFiles.archive.sort((a, b) => b.data.procedureId - a.data.procedureId);

    renderFileLists();
}

/**
 * Renders the files into their respective columns, applying any search filter.
 */
function renderFileLists() {
    const searchTerm = searchBar.value.toLowerCase();
    
    const filterAndRender = (list, data) => {
        list.innerHTML = '';
        let count = 0;
        data.filter(item => item.data.patientName.toLowerCase().includes(searchTerm))
            .forEach(item => {
                list.appendChild(createFileListItem(item.data, item.fileHandle, item.fromFolder));
                count++;
            });
        return count;
    };
    
    const uCount = filterAndRender(unprocessedList, allFiles.unprocessed);
    const bCount = filterAndRender(billedList, allFiles.billed);
    const aCount = filterAndRender(archiveList, allFiles.archive);

    unprocessedCountDash.textContent = uCount;
    billedCountDash.textContent = bCount;
    archiveCountDash.textContent = aCount;
}

/**
 * Creates a DOM element for a single file item in the billing lists.
 * @param {object} data - The procedure data from the JSON file.
 * @param {FileSystemFileHandle} fileHandle - The handle to the file.
 * @param {string} fromFolder - The name of the folder it was loaded from.
 * @returns {HTMLElement} The new list item div.
 */
function createFileListItem(data, fileHandle, fromFolder) {
    const item = document.createElement('div');
    item.className = 'file-list-item bg-white p-3 rounded-lg shadow border border-slate-200';
    const date = new Date(data.procedureDate).toLocaleDateString();
    
    let codes = data.consultItem || '';
    if (data.lesions) {
        codes += ' ' + data.lesions.map(l => l.procedureItemNumber || '').filter(Boolean).join(', ');
    }
    codes = codes.trim();

    item.innerHTML = `
        <p class="font-semibold text-slate-800">${data.patientName}</p>
        <p class="text-sm text-slate-500">${data.doctorCode} - ${date}</p>
        ${(data.status === 'Billed' || data.status === 'Archived') ? `<p class="text-sm font-medium text-blue-600">${codes || 'No codes'}</p>` : ''}
        ${data.billingComment ? `<p class="text-xs italic text-amber-700 mt-1">Note: ${data.billingComment}</p>` : ''}
        ${data.status === 'Deleted' ? `<p class="text-sm font-bold text-red-600">DELETED</p>` : ''}
    `;
    item.addEventListener('click', () => openBillingPanel(data, fileHandle, fromFolder));
    return item;
}

// --- BILLING ASSISTANT LOGIC ---

/**
 * Opens the modal billing panel with the data from a specific file.
 * @param {object} data - The procedure data from the JSON file.
 * @param {FileSystemFileHandle} fileHandle - The handle to the file.
 * @param {string} fromFolder - The name of the folder it was loaded from.
 */
function openBillingPanel(data, fileHandle, fromFolder) {
    currentBillingFile = { handle: fileHandle, data: data, fromFolder: fromFolder };
    
    billingPanelTitle.textContent = `Patient: ${data.patientName}`;
    
    // 1. Fill Clinical Summary
    billingPanelContent.innerHTML = data.lesions.map(l => {
        const defectSize = l.defectSize || (Math.max(parseFloat(l.length) || 0, parseFloat(l.width) || 0) + (2 * (parseFloat(l.margin) || 0)));
        return `
        <div class="p-3 bg-slate-50 rounded-lg">
            <p class="font-semibold">${l.id}. ${l.location} (${l.procedure})</p>
            <p class="text-sm">PDx: ${l.pathology.replace(/;/g, ', ')}</p>
            <p class="text-sm">Region: ${l.anatomicalRegion}</p>
            <p class="text-sm">Defect Size (Lesion + Margin): <span class="font-bold">${defectSize.toFixed(1)}mm</span></p>
            <p class="text-sm">Closure: ${l.excisionClosureType} ${l.useDeepSuture ? '(Deep)' : ''}</p>
        </div>
    `}).join('');

    // 2. Fill Billing Inputs
    billingConsultItem.value = data.consultItem || '';
    billingComment.value = data.billingComment || '';
    
    // 3. Build Billing Assistant
    billingAssistantLesions.innerHTML = data.lesions.map(l => `
        <div class="p-3 bg-slate-100 rounded-lg" data-lesion-id="${l.id}">
            <p class="font-bold text-lg text-slate-700">Lesion ${l.id}: ${l.location}</p>
            
            <div class="mt-2">
                <label class="block text-sm font-medium text-slate-600 mb-2">Step 1: Select Final Histology</label>
                <div class="flex flex-wrap gap-2" id="histo-btn-group-${l.id}">
                    <button type="button" class="billing-btn text-sm bg-slate-200 text-slate-700 py-1 px-3 rounded-full" data-histo="BCC/SCC">BCC / SCC</button>
                    <button type="button" class="billing-btn text-sm bg-slate-200 text-slate-700 py-1 px-3 rounded-full" data-histo="Melanoma">Melanoma</button>
                    <button type="button" class="billing-btn text-sm bg-slate-200 text-slate-700 py-1 px-3 rounded-full" data-histo="Non-Malignant">Benign</button>
                    <button type="button" class="billing-btn text-sm bg-slate-200 text-slate-700 py-1 px-3 rounded-full" data-histo="Biopsy">Simple Biopsy</button>
                </div>
            </div>

            <div id="excision-code-container-${l.id}" class="mt-4 hidden">
                <label class="block text-sm font-medium text-slate-600 mb-2">Step 2: Select Excision Code</label>
                <div class="flex flex-wrap gap-2" id="excision-btn-group-${l.id}">
                    </div>
            </div>

            <div id="repair-code-container-${l.id}" class="mt-4 hidden">
                <label class="block text-sm font-medium text-slate-600 mb-2">Step 3: Select/Confirm Repair Code</label>
                <div class="flex flex-wrap gap-2" id="repair-btn-group-${l.id}">
                    </div>
            </div>

            <div class="mt-4">
                <label for="lesion-item-${l.id}" class="block text-sm font-medium text-slate-600">Final Procedure Item(s)</label>
                <input type="text" id="lesion-item-${l.id}" data-lesion-id="${l.id}" value="${data.lesions.find(les => les.id === l.id).procedureItemNumber || ''}"
                       class="lesion-item-input w-full bg-white border border-slate-300 rounded-lg p-2 mt-1">
            </div>
        </div>
    `).join('');

    // 4. Add event listeners to the new buttons
    data.lesions.forEach(l => {
        getEl(`histo-btn-group-${l.id}`).addEventListener('click', (e) => handleHistoClick(e, l));
        getEl(`excision-btn-group-${l.id}`).addEventListener('click', (e) => handleCodeClick(e, l.id, 'excision'));
        getEl(`repair-btn-group-${l.id}`).addEventListener('click', (e) => handleCodeClick(e, l.id, 'repair'));
    });


    // 5. Show correct action buttons
    if (fromFolder === 'Unprocessed') {
        doctorActions.classList.remove('hidden');
        pmActions.classList.add('hidden');
    } else if (fromFolder === 'Billed') {
        doctorActions.classList.add('hidden');
        pmActions.classList.remove('hidden');
    } else { // Archive
        doctorActions.classList.add('hidden');
        pmActions.classList.add('hidden');
    }

    billingPanel.classList.remove('hidden');
}

/**
 * Handles the click on a histology button in the billing panel.
 * @param {Event} event - The click event.
 * @param {object} lesion - The lesion object associated with this panel.
 */
function handleHistoClick(event, lesion) {
    const target = event.target.closest('.billing-btn');
    if (!target) return;

    const histoType = target.dataset.histo;
    
    // Toggle selected state
    getEl(`histo-btn-group-${lesion.id}`).querySelectorAll('.billing-btn').forEach(btn => btn.classList.remove('selected'));
    target.classList.add('selected');

    // Clear lower selections
    getEl(`excision-btn-group-${lesion.id}`).innerHTML = '';
    getEl(`repair-btn-group-${lesion.id}`).innerHTML = '';
    getEl(`repair-code-container-${lesion.id}`).classList.add('hidden');
    getEl(`lesion-item-${lesion.id}`).value = '';

    // --- This is the core logic ---
    const region = lesion.anatomicalRegion;
    const defectSize = lesion.defectSize;
    const closure = lesion.excisionClosureType;
    
    // 1. Get Excision Codes
    let excisionCodes = [];
    if (histoType === 'Biopsy') {
        excisionCodes = [appSettings.biopsy["30071"]]; // 30071
    } else {
        excisionCodes = findExcisionCode(histoType, region, defectSize);
    }
    
    const excisionContainer = getEl(`excision-btn-group-${lesion.id}`);
    if (excisionCodes.length > 0) {
        excisionCodes.forEach(code => {
            excisionContainer.appendChild(createBillingButton(code.item, code.desc));
        });
        getEl(`excision-code-container-${lesion.id}`).classList.remove('hidden');
    }

    // 2. Get Repair Codes (if not a simple biopsy)
    if (histoType !== 'Biopsy') {
        const repairContainer = getEl(`repair-btn-group-${lesion.id}`);
        const repairCodes = appSettings.repairs; // Get all repair codes
        
        repairCodes.forEach(code => {
            const btn = createBillingButton(code.item, code.desc);
            // Pre-select the one that matches the clinical data
            if (closure === code.clinicalType) {
                btn.classList.add('selected');
            }
            repairContainer.appendChild(btn);
        });
        getEl(`repair-code-container-${lesion.id}`).classList.remove('hidden');
    }
    
    // 3. Update final text box
    updateFinalCode(lesion.id);
}

/**
 * Finds the matching excision code from appSettings.
 * @param {string} histoType - "BCC/SCC", "Melanoma", etc.
 * @param {string} region - "Option1", "Option2", "Option3"
 * @param {number} size - The calculated defect size.
 * @returns {Array} An array containing the matching code object, or an empty array.
 */
function findExcisionCode(histoType, region, size) {
    const codes = appSettings.excisions[histoType]?.[region];
    if (!codes) return [];
    // Find the first size bracket that the lesion fits into
    const matchingCode = codes.find(c => size <= c.maxSize);
    return matchingCode ? [matchingCode] : []; // Return as array
}

/**
 * Creates a new button element for the billing assistant.
 * @param {string} item - The item number (e.g., "31356").
 * @param {string} desc - The description for the tooltip.
 * @returns {HTMLButtonElement} The new button element.
 */
function createBillingButton(item, desc) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'billing-btn text-sm bg-slate-200 text-slate-700 py-1 px-3 rounded-full';
    btn.dataset.item = item;
    btn.title = desc;
    btn.textContent = item;
    return btn;
}

/**
 * Handles clicks on excision or repair code buttons.
 * @param {Event} event - The click event.
 * @param {number} lesionId - The ID of the lesion.
 * @param {string} groupType - 'excision' or 'repair'.
 */
function handleCodeClick(event, lesionId, groupType) {
    const target = event.target.closest('.billing-btn');
    if (!target) return;
    
    const btnGroup = getEl(`${groupType}-btn-group-${lesionId}`);
    // Allow multiple repair selections (e.g., Graft + Flap)
    if (groupType === 'repair') {
        target.classList.toggle('selected'); // Toggle on/off
    } else {
        // Only one excision code
        btnGroup.querySelectorAll('.billing-btn').forEach(btn => btn.classList.remove('selected'));
        target.classList.add('selected');
    }
    
    updateFinalCode(lesionId);
}

/**
 * Updates the final item code text input based on selected buttons.
 * @param {number} lesionId - The ID of the lesion.
 */
function updateFinalCode(lesionId) {
    const excisionBtn = getEl(`excision-btn-group-${lesionId}`).querySelector('.selected');
    const repairBtns = getEl(`repair-btn-group-${lesionId}`).querySelectorAll('.selected');
    
    const excisionCode = excisionBtn ? excisionBtn.dataset.item : '';
    const repairCodes = Array.from(repairBtns).map(btn => btn.dataset.item);

    const finalCode = [excisionCode, ...repairCodes].filter(Boolean).join(', ');
    getEl(`lesion-item-${lesionId}`).value = finalCode;
}

/**
 * Saves the updated billing data and moves the file to the 'Billed' folder.
 */
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
    await moveFile('Unprocessed', 'Billed', currentBillingFile.handle, updatedData);

    // 3. Refresh UI
    billingPanel.classList.add('hidden');
    loadBillingFiles();
}

/**
 * Deletes an unprocessed file by moving it to 'Archive' with a 'Deleted' status.
 */
async function deleteBillingFile() {
    // Use a modal in production
    if (!confirm('Are you sure you want to delete this unprocessed procedure? This cannot be undone.')) {
        return;
    }
    // 1. Update status to 'Deleted'
    const updatedData = { ...currentBillingFile.data, status: 'Deleted', billingComment: `DELETED by doctor on ${new Date().toLocaleDateString()}` };

    // 2. Move file from 'Unprocessed' to 'Archive'
    await moveFile('Unprocessed', 'Archive', currentBillingFile.handle, updatedData);

    // 3. Refresh UI
    billingPanel.classList.add('hidden');
    loadBillingFiles();
}

/**
 * Moves a file from 'Billed' to 'Archive'.
 */
async function archiveBilledFile() {
    // 1. Update status to 'Archived'
    const updatedData = { ...currentBillingFile.data, status: 'Archived' };
    
    // 2. Move file from 'Billed' to 'Archive'
    await moveFile('Billed', 'Archive', currentBillingFile.handle, updatedData);

    // 3. Refresh UI
    billingPanel.classList.add('hidden');
    loadBillingFiles();
}

/**
 * Generates an HTML table of billed items and opens the print dialog.
 */
function printBilledList() {
    const itemsToPrint = allFiles.billed.filter(item => item.data.patientName.toLowerCase().includes(searchBar.value.toLowerCase()));
    
    if (itemsToPrint.length === 0) {
        alert("No billed items to print."); // Use custom modal
        return;
    }

    printTitle.innerHTML = `Billing Run Sheet - ${new Date().toLocaleDateString()}`;
    
    let tableHTML = `
        <thead>
            <tr>
                <th>[ ]</th>
                <th>Patient Name</th>
                <th>Date</th>
                <th>Doctor</th>
                <th>Consult Item</th>
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
                <td>${date}</td>
                <td>${data.doctorCode}</td>
                <td>${consult}</td>
                <td>${procedures}</td>
                <td>${comment}</td>
            </tr>
        `;
    });
    
    tableHTML += `</tbody>`;
    printTable.innerHTML = tableHTML;
    
    window.print();
}
