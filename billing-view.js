// --- BILLING VIEW LOGIC ---

function togglePMMode() {
    billingViewContainer.classList.toggle('pm-mode-active', pmModeToggle.checked);
    appTitle.textContent = pmModeToggle.checked ? "Billing & Processing (PM View)" : "Clinical Management PWA";
}

async function loadBillingFiles() {
    if (!saveFolderHandle || !(await verifyFolderPermission(saveFolderHandle, true))) {
        alert("Please set the default save folder and grant permission first.");
        switchTab('entry');
        return;
    }

    allFiles = { unprocessed: [], billed: [], archive: [] }; // Reset global state
    const selectedDoctorCode = doctorCodeEl.value; // Get the currently selected doctor

    let doctorFoldersToScan = [];

    if (selectedDoctorCode === appSettings.pmIdentifier) {
        // Practice Manager: Scan all doctor folders
        doctorFoldersToScan = appSettings.doctorList
            .filter(doc => doc.code !== appSettings.pmIdentifier && doc.code.trim() !== '')
            .map(doc => doc.code);
        
        // Also show PM-mode-specific UI if the PM is selected
        billingViewContainer.classList.add('pm-mode-active');
        pmModeToggle.checked = true;

    } else if (selectedDoctorCode) {
        // A specific doctor is selected: Scan only their folder
        doctorFoldersToScan.push(selectedDoctorCode);
        
        // Hide PM-mode-specific UI if a doctor is selected
        billingViewContainer.classList.remove('pm-mode-active');
        pmModeToggle.checked = false;
    } else {
        alert("Please select a Doctor from the dropdown in the 'Clinical Entry' tab first.");
        switchTab('entry');
        return;
    }

    // Loop through each doctor folder and load files from their subfolders
    for (const doctorCode of doctorFoldersToScan) {
        try {
            const doctorDirHandle = await saveFolderHandle.getDirectoryHandle(doctorCode);

            // 1. Load Unprocessed
            try {
                const unprocessedDir = await doctorDirHandle.getDirectoryHandle('Unprocessed');
                for await (const entry of unprocessedDir.values()) {
                    if (entry.kind === 'file' && entry.name.endsWith('.json')) {
                        const fileHandle = await unprocessedDir.getFileHandle(entry.name);
                        const file = await fileHandle.getFile();
                        const data = JSON.parse(await file.text());
                        // Add doctor code and fromFolder to the context
                        allFiles.unprocessed.push({ data, fileHandle, fromFolder: 'Unprocessed', doctorCode: doctorCode });
                    }
                }
            } catch(e) { console.error(`Error loading Unprocessed for ${doctorCode}:`, e); }

            // 2. Load Billed
            try {
                const billedDir = await doctorDirHandle.getDirectoryHandle('Billed');
                for await (const entry of billedDir.values()) {
                    if (entry.kind === 'file' && entry.name.endsWith('.json')) {
                        const fileHandle = await billedDir.getFileHandle(entry.name);
                        const file = await fileHandle.getFile();
                        const data = JSON.parse(await file.text());
                        allFiles.billed.push({ data, fileHandle, fromFolder: 'Billed', doctorCode: doctorCode });
                    }
                }
            } catch(e) { console.error(`Error loading Billed for ${doctorCode}:`, e); }

            // 3. Load Archive
            try {
                const archiveDir = await doctorDirHandle.getDirectoryHandle('Archive');
                for await (const entry of archiveDir.values()) {
                    if (entry.kind === 'file' && entry.name.endsWith('.json')) {
                        const fileHandle = await archiveDir.getFileHandle(entry.name);
                        const file = await fileHandle.getFile();
                        const data = JSON.parse(await file.text());
                        allFiles.archive.push({ data, fileHandle, fromFolder: 'Archive', doctorCode: doctorCode });
                    }
                }
            } catch(e) { console.error(`Error loading Archive for ${doctorCode}:`, e); }

        } catch (e) {
            console.error(`Could not find or access folder for doctor: ${doctorCode}`, e);
        }
    }


    // Sort files by date, newest first
    allFiles.unprocessed.sort((a, b) => b.data.procedureId - a.data.procedureId);
    allFiles.billed.sort((a, b) => b.data.procedureId - a.data.procedureId);
    allFiles.archive.sort((a, b) => b.data.procedureId - a.data.procedureId);

    renderFileLists();
}

function renderFileLists() {
    const searchTerm = searchBar.value.toLowerCase();
    
    const filterAndRender = (list, data) => {
        list.innerHTML = '';
        let count = 0;
        data.filter(item => item.data.patientName.toLowerCase().includes(searchTerm))
            .forEach(item => {
                // Pass the new context (fromFolder, doctorCode)
                list.appendChild(createFileListItem(item.data, item.fileHandle, item.fromFolder, item.doctorCode));
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

function createFileListItem(data, fileHandle, fromFolder, doctorCode) {
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
    // Pass the new context to the billing panel
    item.addEventListener('click', () => openBillingPanel(data, fileHandle, fromFolder, doctorCode));
    return item;
}

// --- BILLING ASSISTANT LOGIC ---
function openBillingPanel(data, fileHandle, fromFolder, doctorCode) {
    // Store all context, including the doctorCode
    currentBillingFile = { handle: fileHandle, data: data, fromFolder: fromFolder, doctorCode: doctorCode };
    
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


    // 5. Show correct action buttons based on folder AND selected user
    const isPM = doctorCodeEl.value === appSettings.pmIdentifier;

    if (fromFolder === 'Unprocessed') {
        // Doctors and PMs can bill or delete Unprocessed files
        doctorActions.classList.remove('hidden');
        editClinicalDataBtn.classList.remove('hidden'); // Allow editing
        pmActions.classList.add('hidden');
    } else if (fromFolder === 'Billed') {
        // Only PMs can archive Billed files
        doctorActions.classList.add('hidden');
        editClinicalDataBtn.classList.add('hidden'); // Lock editing
        pmActions.classList.toggle('hidden', !isPM);
    } else { // Archive
        // No actions for archived files
        doctorActions.classList.add('hidden');
        editClinicalDataBtn.classList.add('hidden'); // Lock editing
        pmActions.classList.add('hidden');
    }

    billingPanel.classList.remove('hidden');
}

/**
 * NEW: Event listener for the "Edit Clinical Data" button.
 * Saves the current file's data to localStorage and switches to the entry tab.
 */
function loadProcedureForEditing() {
    const dataToEdit = { ...currentBillingFile.data };
    const editContext = {
        filename: currentBillingFile.handle.name,
        fromFolder: currentBillingFile.fromFolder,
        doctorCode: currentBillingFile.doctorCode // Pass the doctor code
    };

    localStorage.setItem('procedureToEdit', JSON.stringify(dataToEdit));
    localStorage.setItem('editContext', JSON.stringify(editContext));

    billingPanel.classList.add('hidden');
    switchTab('entry');
}

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

function findExcisionCode(histoType, region, size) {
    const codes = appSettings.excisions[histoType]?.[region];
    if (!codes) return [];
    // Find the first size bracket that the lesion fits into
    const matchingCode = codes.find(c => size <= c.maxSize);
    return matchingCode ? [matchingCode] : []; // Return as array
}

function createBillingButton(item, desc) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'billing-btn text-sm bg-slate-200 text-slate-700 py-1 px-3 rounded-full';
    btn.dataset.item = item;
    btn.title = desc;
    btn.textContent = item;
    return btn;
}

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

function updateFinalCode(lesionId) {
    const excisionBtn = getEl(`excision-btn-group-${lesionId}`).querySelector('.selected');
    const repairBtns = getEl(`repair-btn-group-${lesionId}`).querySelectorAll('.selected');
    
    const excisionCode = excisionBtn ? excisionBtn.dataset.item : '';
    const repairCodes = Array.from(repairBtns).map(btn => btn.dataset.item);

    const finalCode = [excisionCode, ...repairCodes].filter(Boolean).join(', ');
    getEl(`lesion-item-${lesionId}`).value = finalCode;
}

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
    // 2. Move file - **Pass the doctorCode**
    await moveFile('Unprocessed', 'Billed', currentBillingFile.handle, updatedData, currentBillingFile.doctorCode);

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
    // 2. Move file from 'Unprocessed' to 'Archive' - **Pass the doctorCode**
    await moveFile('Unprocessed', 'Archive', currentBillingFile.handle, updatedData, currentBillingFile.doctorCode);

    // 3. Refresh UI
    billingPanel.classList.add('hidden');
    loadBillingFiles();
}
    
async function archiveBilledFile() {
    // 1. Update status to 'Archived'
    const updatedData = { ...currentBillingFile.data, status: 'Archived' };
    
    // 2. Move file from 'Billed' to 'Archive' - **Pass the doctorCode**
    await moveFile('Billed', 'Archive', currentBillingFile.handle, updatedData, currentBillingFile.doctorCode);

    // 3. Refresh UI
    billingPanel.classList.add('hidden');
    loadBillingFiles();
}

function printBilledList() {
    const itemsToPrint = allFiles.billed.filter(item => item.data.patientName.toLowerCase().includes(searchBar.value.toLowerCase()));
    
    if (itemsToPrint.length === 0) {
        alert("No billed items to print.");
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
