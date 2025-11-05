// --- BILLING VIEW LOGIC ---

// This file manages all logic for the "Billing & Processing" tab:
// - Loading files from the doctor folders
// - Rendering the Unprocessed, Billed, and Archive lists
// - Handling search/filtering
// - Opening and managing the Billing Panel (assistant)
// - Moving files between folders (save as billed, archive)
// - Printing the billed list

async function loadBillingFiles() {
    if (!saveFolderHandle || !(await verifyFolderPermission(saveFolderHandle, true))) {
        if (currentAppMode === 'Doctor' && !currentDoctor) {
            // This is fine, just means no folder is set
        } else {
            alert("Please set the default save folder and grant permission first.");
        }
        // Even if no folder, we must clear the lists
        allFiles = { unprocessed: [], billed: [], archive: [] };
        renderFileLists(); // Render empty lists
        return;
    }

    allFiles = { unprocessed: [], billed: [], archive: [] }; // Reset global state

    // --- NEW: Determine which folders to scan ---
    let doctorsToScan = [];
    if (currentAppMode === 'PM') {
        // PM Mode: Scan all doctors
        doctorsToScan = appSettings.doctorList || [];
    } else if (currentDoctor) {
        // Doctor Mode: Scan only the selected doctor
        doctorsToScan = [currentDoctor];
    }
    // If no doctor is selected or list is empty, doctorsToScan will be empty,
    // and the loop below will be skipped, which is correct.

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

            // 3. Load Archive
            try {
                const archiveDir = await doctorDir.getDirectoryHandle('Archive');
                for await (const entry of archiveDir.values()) {
                    if (entry.kind === 'file' && entry.name.endsWith('.json')) {
                        const fileHandle = await archiveDir.getFileHandle(entry.name);
                        const file = await fileHandle.getFile();
                        const data = JSON.parse(await file.text());
                        allFiles.archive.push({ data, fileHandle, fromFolder: 'Archive', fromDoctor: doctorDisplayName });
                    }
                }
            } catch (e) { console.error(`No 'Archive' folder for ${doctorDisplayName}?`, e); }

        } catch (e) {
            console.error(`Could not find folder for doctor: ${doctorDisplayName}`, e);
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
        const itemsToRender = data.filter(item => 
            item.data.patientName.toLowerCase().includes(searchTerm) ||
            item.data.doctorCode.toLowerCase().includes(searchTerm)
        );

        if (itemsToRender.length === 0) {
             list.innerHTML = `<p class="text-slate-500 italic p-2">No files found.</p>`;
        } else {
            itemsToRender.forEach(item => {
                list.appendChild(createFileListItem(item.data, item.fileHandle, item.fromFolder, item.fromDoctor));
                count++;
            });
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

function createFileListItem(data, fileHandle, fromFolder, fromDoctor) {
    const item = document.createElement('div');
    item.className = 'file-list-item bg-white p-3 rounded-lg shadow border border-slate-200';
    const date = new Date(data.procedureDate).toLocaleDateString();
    
    let codes = data.consultItem || '';
    if (data.lesions) {
        codes += ' ' + data.lesions.map(l => l.procedureItemNumber || '').filter(Boolean).join(', ');
    }
    codes = codes.trim();

    // In PM Mode, we show the doctor's name on the card
    const doctorNameHTML = currentAppMode === 'PM' 
        ? `<p class="text-sm font-medium text-sky-700">${data.doctorCode}</p>`
        : '';

    item.innerHTML = `
        <div class="flex justify-between items-start">
            <p class="font-semibold text-slate-800">${data.patientName}</p>
            ${doctorNameHTML}
        </div>
        <p class="text-sm text-slate-500">${date}</p>
        ${(data.status === 'Billed' || data.status === 'Archived') ? `<p class="text-sm font-medium text-blue-600">${codes || 'No codes'}</p>` : ''}
        ${data.billingComment ? `<p class="text-xs italic text-amber-700 mt-1">Note: ${data.billingComment}</p>` : ''}
        ${data.status === 'Deleted' ? `<p class="text-sm font-bold text-red-600">DELETED</p>` : ''}
    `;
    item.addEventListener('click', () => openBillingPanel(data, fileHandle, fromFolder, fromDoctor));
    return item;
}

// --- BILLING ASSISTANT LOGIC ---
function openBillingPanel(data, fileHandle, fromFolder, fromDoctor) {
    currentBillingFile = { handle: fileHandle, data: data, fromFolder: fromFolder, fromDoctor: fromDoctor };
    
    billingPanelTitle.textContent = `Patient: ${data.patientName} (Dr. ${data.doctorCode})`;
    
    // 1. Fill Billing Inputs
    billingConsultItem.value = data.consultItem || '';
    billingComment.value = data.billingComment || '';
    
    // 2. Build Billing Assistant Cards (NEW STREAMLINED UI)
    billingAssistantLesions.innerHTML = data.lesions.map(l => {
        // Get the full text of the selected anatomical region
        let regionText = "N/A";
        if (l.anatomicalRegion) {
            const option = Array.from(anatomicalRegionEl.options).find(opt => opt.value === l.anatomicalRegion);
            if (option) regionText = option.text;
        }

        return `
        <div class="p-4 bg-slate-50 rounded-lg border border-slate-200" data-lesion-id="${l.id}">
            <p class="font-bold text-lg text-slate-700">Lesion ${l.id}: ${l.location}</p>
            
            <!-- Combined Summary/Info Box -->
            <div class="mt-2 space-y-1 text-sm text-slate-600">
                <p><strong>Procedure:</strong> ${l.procedure} ${l.procedure === 'Excision' ? `(${l.excisionClosureType})` : ''} ${l.procedure === 'Punch' ? `(${l.punchType})` : ''}</p>
                <p><strong>PDx:</strong> ${l.pathology.replace(/;/g, ', ')}</p>
                <p><strong>Region:</strong> ${regionText}</p>
                <p><strong>Defect Size:</strong> <span class="font-bold text-base">${l.defectSize.toFixed(1)}mm</span></p>
                ${(l.excisionClosureType === 'Flap Repair' || l.excisionClosureType === 'Graft Repair' || l.excisionClosureType === 'Graft + Flap') ? `<p><strong>Closure:</strong> ${l.excisionClosureType} ${l.graftType ? `(${l.graftType})` : ''}</p>` : ''}
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
                <div id="excision-btn-group-${l.id}">
                    <!-- Suggestions injected here -->
                </div>
            </div>

            <div id="repair-code-container-${l.id}" class="mt-4 hidden space-y-2">
                <label class="block text-sm font-medium text-slate-600">Step 3: Suggested Repair Code (if applicable)</label>
                <div id="repair-btn-group-${l.id}">
                    <!-- Suggestions injected here -->
                </div>
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
        
        // Add listeners for the *new* confirm buttons
        getEl(`excision-btn-group-${l.id}`).addEventListener('click', (e) => handleConfirmClick(e, l.id, 'excision'));
        getEl(`repair-btn-group-${l.id}`).addEventListener('click', (e) => handleConfirmClick(e, l.id, 'repair'));
    });


    // 4. Show correct action buttons
    // The "fromDoctor" field (which is the display name) is now critical.
    if (fromFolder === 'Unprocessed' && currentAppMode === 'Doctor') {
        doctorActions.classList.remove('hidden');
        pmActions.classList.add('hidden');
    } else if (fromFolder === 'Billed' && currentAppMode === 'PM') {
        doctorActions.classList.add('hidden');
        pmActions.classList.remove('hidden');
    } else { // Archive, or wrong mode (PM can't bill, Doc can't archive)
        doctorActions.classList.add('hidden');
        pmActions.classList.add('hidden');
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
    getEl(`repair-btn-group-${l.id}`).innerHTML = '';
    getEl(`excision-code-container-${lesion.id}`).classList.add('hidden');
    getEl(`repair-code-container-${lesion.id}`).classList.add('hidden');
    getEl(`lesion-item-${lesion.id}`).value = '';

    // --- This is the core logic ---
    const region = lesion.anatomicalRegion;
    const defectSize = lesion.defectSize;
    const closure = lesion.excisionClosureType;
    
    // 1. Get Excision Codes
    let excisionCodes = [];
    if (histoType === 'Simple Biopsy') {
        excisionCodes = [appSettings.biopsy["30071"]]; // 30071
    } else if (histoType === 'Time Based Only') {
        // No codes, just clear and return
         getEl(`lesion-item-${lesion.id}`).value = 'Time Based';
         return;
    } else {
        excisionCodes = findExcisionCode(histoType, region, defectSize);
    }
    
    const excisionContainer = getEl(`excision-btn-group-${lesion.id}`);
    if (excisionCodes.length > 0) {
        excisionCodes.forEach(code => {
            excisionContainer.appendChild(createBillingSuggestion(code.item, code.desc, 'excision'));
        });
        getEl(`excision-code-container-${lesion.id}`).classList.remove('hidden');
    }

    // 2. Get Repair Codes (if not a simple biopsy or time-based)
    if (histoType !== 'Simple Biopsy' && histoType !== 'Time Based Only') {
        const repairContainer = getEl(`repair-btn-group-${l.id}`);
        // Find repair codes that match the clinical closure type
        const matchingRepairCodes = appSettings.repairs.filter(code => code.clinicalType === closure);

        if (matchingRepairCodes.length > 0) {
            matchingRepairCodes.forEach(code => {
                const btn = createBillingSuggestion(code.item, code.desc, 'repair');
                repairContainer.appendChild(btn);
            });
            getEl(`repair-code-container-${lesion.id}`).classList.remove('hidden');
        }
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

function createBillingSuggestion(item, desc, type) {
    const suggestionEl = document.createElement('div');
    suggestionEl.className = 'billing-suggestion';
    suggestionEl.dataset.item = item;
    suggestionEl.dataset.type = type;

    suggestionEl.innerHTML = `
        <div>
            <span class="font-bold text-slate-800">${item}</span>
            <span class="text-sm text-slate-600 ml-2">${desc}</span>
        </div>
        <button type="button" class="confirm-btn">Confirm</button>
    `;
    return suggestionEl;
}

function handleConfirmClick(event, lesionId, groupType) {
    const target = event.target.closest('.confirm-btn');
    if (!target) return;

    const suggestionEl = target.closest('.billing-suggestion');
    if (!suggestionEl) return;
    
    // Toggle confirmed state
    suggestionEl.classList.toggle('confirmed');
    target.textContent = suggestionEl.classList.contains('confirmed') ? 'Added' : 'Confirm';
    
    updateFinalCode(lesionId);
}

function updateFinalCode(lesionId) {
    const excisionBtn = getEl(`excision-btn-group-${lesionId}`).querySelector('.confirmed');
    const repairBtns = getEl(`repair-btn-group-${lesionId}`).querySelectorAll('.confirmed');
    
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

async function archiveBilledFile() {
    // 1. Update status to 'Archived'
    const updatedData = { ...currentBillingFile.data, status: 'Archived' };
    
    // 2. Move file from 'Billed' to 'Archive'
    await moveFile('Billed', 'Archive', currentBillingFile.handle, updatedData, currentBillingFile.fromDoctor);

    // 3. Refresh UI
    billingPanel.classList.add('hidden');
    loadBillingFiles();
}

function printBilledList() {
    const itemsToPrint = allFiles.billed.filter(item => 
        item.data.patientName.toLowerCase().includes(searchBar.value.toLowerCase()) ||
        item.data.doctorCode.toLowerCase().includes(searchBar.value.toLowerCase())
    );
    
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
