// --- BILLING VIEW LOGIC ---

function togglePMMode() {
    const isPM = pmModeToggle.checked;
    billingViewContainer.classList.toggle('pm-mode-active', isPM);
    appTitle.textContent = isPM ? "Billing & Processing (PM View)" : "Clinical Management PWA";
    
    // Also update the main doctor dropdown in the entry tab
    const doctorSelect = getEl('doctorCode');
    if (isPM) {
        // If PM mode is on, select "Practice Manager" in the entry tab
        doctorSelect.value = "Practice Manager";
        // Trigger a change event to save this to localStorage
        doctorSelect.dispatchEvent(new Event('change'));
    } else {
        // If turning PM mode off, revert to the last saved doctor (or the first non-PM)
        let lastDoctor = localStorage.getItem('doctorCode');
        if (!lastDoctor || lastDoctor === "Practice Manager") {
            lastDoctor = appSettings.doctorList[1] || appSettings.doctorList[0]; // Fallback to first non-PM
        }
        doctorSelect.value = lastDoctor;
        doctorSelect.dispatchEvent(new Event('change'));
    }

    // Refresh the file list to reflect the new user's permissions
    loadBillingFiles();
}


async function loadBillingFiles() {
    if (!saveFolderHandle || !(await verifyFolderPermission(saveFolderHandle, true))) {
        alert("Please set the default save folder and grant permission first.");
        switchTab('entry');
        return;
    }

    allFiles = { unprocessed: [], billed: [], archive: [] }; // Reset global state
    const currentDoctor = getEl('doctorCode').value;
    const isPM = (currentDoctor === "Practice Manager");

    // Determine which doctor folders to scan
    let doctorsToScan = [];
    if (isPM) {
        // PM scans all doctors *except* "Practice Manager"
        doctorsToScan = appSettings.doctorList.filter(d => d !== "Practice Manager");
    } else {
        // A doctor only scans their own folder
        doctorsToScan = [currentDoctor];
    }

    // Show/hide columns based on role
    unprocessedColumn.style.display = isPM ? 'none' : 'flex';
    
    // Adjust grid columns
    const billingColumns = getEl('billing-columns');
    if(isPM) {
        billingColumns.style.gridTemplateColumns = 'repeat(2, minmax(0, 1fr))';
    } else {
        billingColumns.style.gridTemplateColumns = 'repeat(3, minmax(0, 1fr))';
    }


    for (const doctor of doctorsToScan) {
        try {
            const doctorDir = await saveFolderHandle.getDirectoryHandle(doctor);

            // 1. Load Unprocessed (only if not PM)
            if (!isPM) {
                try {
                    const unprocessedDir = await doctorDir.getDirectoryHandle('Unprocessed');
                    for await (const entry of unprocessedDir.values()) {
                        if (entry.kind === 'file' && entry.name.endsWith('.json')) {
                            const fileHandle = await unprocessedDir.getFileHandle(entry.name);
                            const file = await fileHandle.getFile();
                            const data = JSON.parse(await file.text());
                            allFiles.unprocessed.push({ data, fileHandle, fromDoctor: doctor, fromFolder: 'Unprocessed' });
                        }
                    }
                } catch (e) { console.error(`No 'Unprocessed' folder for ${doctor}?`, e); }
            }

            // 2. Load Billed
            try {
                const billedDir = await doctorDir.getDirectoryHandle('Billed');
                for await (const entry of billedDir.values()) {
                    if (entry.kind === 'file' && entry.name.endsWith('.json')) {
                        const fileHandle = await billedDir.getFileHandle(entry.name);
                        const file = await fileHandle.getFile();
                        const data = JSON.parse(await file.text());
                        allFiles.billed.push({ data, fileHandle, fromDoctor: doctor, fromFolder: 'Billed' });
                    }
                }
            } catch (e) { console.error(`No 'Billed' folder for ${doctor}?`, e); }


            // 3. Load Archive
            try {
                const archiveDir = await doctorDir.getDirectoryHandle('Archive');
                for await (const entry of archiveDir.values()) {
                    if (entry.kind === 'file' && entry.name.endsWith('.json')) {
                        const fileHandle = await archiveDir.getFileHandle(entry.name);
                        const file = await fileHandle.getFile();
                        const data = JSON.parse(await file.text());
                        allFiles.archive.push({ data, fileHandle, fromDoctor: doctor, fromFolder: 'Archive' });
                    }
                }
            } catch (e) { console.error(`No 'Archive' folder for ${doctor}?`, e); }

        } catch (e) {
            console.error(`Could not read directory for doctor: ${doctor}`, e);
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
    const currentDoctor = getEl('doctorCode').value;
    const isPM = (currentDoctor === "Practice Manager");

    const filterAndRender = (list, data) => {
        list.innerHTML = '';
        let count = 0;
        data.filter(item => item.data.patientName.toLowerCase().includes(searchTerm))
            .forEach(item => {
                list.appendChild(createFileListItem(item.data, item.fileHandle, item.fromDoctor, item.fromFolder));
                count++;
            });
        
        if (count === 0) {
            list.innerHTML = `<p class="text-slate-500 italic p-2">No files found.</p>`;
        }
        return count;
    };

    const uCount = filterAndRender(unprocessedList, allFiles.unprocessed);
    const bCount = filterAndRender(billedList, allFiles.billed);
    const aCount = filterAndRender(archiveList, allFiles.archive);

    unprocessedCountDash.textContent = uCount;
    billedCountDash.textContent = bCount;
    archiveCountDash.textContent = aCount;
}

function createFileListItem(data, fileHandle, fromDoctor, fromFolder) {
    const item = document.createElement('div');
    item.className = 'file-list-item bg-white p-3 rounded-lg shadow border border-slate-200';
    const date = new Date(data.procedureDate).toLocaleDateString();

    let codes = data.consultItem || '';
    if (data.lesions) {
        codes += ' ' + data.lesions.map(l => l.procedureItemNumber || '').filter(Boolean).join(', ');
    }
    codes = codes.trim();
    
    // For PM view, show which doctor this belongs to
    const doctorLabel = (getEl('doctorCode').value === "Practice Manager") ? `<p class="text-sm font-medium text-slate-600">${data.doctorCode}</p>` : '';

    item.innerHTML = `
        <p class="font-semibold text-slate-800">${data.patientName}</p>
        ${doctorLabel}
        <p class="text-sm text-slate-500">${date}</p>
        ${(data.status === 'Billed' || data.status === 'Archived') ? `<p class="text-sm font-medium text-blue-600">${codes || 'No codes'}</p>` : ''}
        ${data.billingComment ? `<p class="text-xs italic text-amber-700 mt-1">Note: ${data.billingComment}</p>` : ''}
        ${data.status === 'Deleted' ? `<p class="text-sm font-bold text-red-600">DELETED</p>` : ''}
    `;
    item.addEventListener('click', () => openBillingPanel(data, fileHandle, fromDoctor, fromFolder));
    return item;
}

// --- BILLING ASSISTANT LOGIC ---
function openBillingPanel(data, fileHandle, fromDoctor, fromFolder) {
    currentBillingFile = { handle: fileHandle, data: data, fromDoctor: fromDoctor, fromFolder: fromFolder };

    billingPanelTitle.textContent = `Patient: ${data.patientName} (${data.doctorCode})`;

    // 1. Fill Clinical Summary
    billingPanelContent.innerHTML = data.lesions.map(l => {
        let defectSize = 0;
        if (l.procedure === 'Punch' && l.punchType === 'Punch Biopsy') {
             defectSize = parseFloat(l.punchSize) || 0;
        } else if (l.billingOnlyDefectSize) {
             defectSize = parseFloat(l.billingOnlyDefectSize) || 0;
        } else {
             defectSize = l.defectSize || 0; // Use pre-calculated
        }

        return `
        <div class="p-3 bg-slate-50 rounded-lg">
            <p class="font-semibold">${l.id}. ${l.location} (${l.procedure})</p>
            <p class="text-sm">PDx: ${l.pathology.replace(/;/g, ', ')}</p>
            <p class="text-sm">Region: ${l.anatomicalRegion}</p>
            <p class="text-sm">Defect Size: <span class="font-bold">${defectSize.toFixed(1)}mm</span></p>
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
                    <button type="button" class="billing-btn text-sm bg-slate-200 text-slate-700 py-1 px-3 rounded-full" data-histo="Suspected Melanoma">Suspected Melanoma</button>
                    <button type="button" class="billing-btn text-sm bg-slate-200 text-slate-700 py-1 px-3 rounded-full" data-histo="Definitive Melanoma">Definitive Melanoma</button>
                    <button type="button" class="billing-btn text-sm bg-slate-200 text-slate-700 py-1 px-3 rounded-full" data-histo="Benign / Other">Benign / Other</button>
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
    // PM can only move from Billed -> Archive
    // Doctor can only move from Unprocessed -> Billed (or Delete)
    const isPM = (getEl('doctorCode').value === "Practice Manager");

    if (isPM) {
        doctorActions.classList.add('hidden');
        if (fromFolder === 'Billed') {
            pmActions.classList.remove('hidden');
        } else {
            pmActions.classList.add('hidden'); // PM can't action Unprocessed or Archive
        }
    } else {
        pmActions.classList.add('hidden');
        if (fromFolder === 'Unprocessed') {
            doctorActions.classList.remove('hidden');
        } else {
            doctorActions.classList.add('hidden'); // Doctor can't action Billed or Archive
        }
    }

    billingPanel.classList.remove('hidden');
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
    let defectSize = 0;
    if (lesion.procedure === 'Punch' && lesion.punchType === 'Punch Biopsy') {
            defectSize = parseFloat(lesion.punchSize) || 0;
    } else if (lesion.billingOnlyDefectSize) {
            defectSize = parseFloat(lesion.billingOnlyDefectSize) || 0;
    } else {
            defectSize = lesion.defectSize || 0; // Use pre-calculated
    }
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

    // 2. Move file
    await moveFile(currentBillingFile.fromDoctor, 'Unprocessed', 'Billed', currentBillingFile.handle, updatedData);

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
    await moveFile(currentBillingFile.fromDoctor, 'Unprocessed', 'Archive', currentBillingFile.handle, updatedData);

    // 3. Refresh UI
    billingPanel.classList.add('hidden');
    loadBillingFiles();
}

async function archiveBilledFile() {
    // 1. Update status to 'Archived'
    const updatedData = { ...currentBillingFile.data, status: 'Archived' };

    // 2. Move file from 'Billed' to 'Archive'
    await moveFile(currentBillingFile.fromDoctor, 'Billed', 'Archive', currentBillingFile.handle, updatedData);

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
