// --- PWA Service Worker Registration ---
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js')
            .then(registration => {
                console.log('ServiceWorker registration successful with scope: ', registration.scope);
            })
            .catch(error => {
                console.log('ServiceWorker registration failed: ', error);
            });
    });
}

// --- DOM Element References ---
const getEl = (id) => document.getElementById(id);

// --- Tab View Elements ---
const tabEntryBtn = getEl('tab-entry');
const tabBillingBtn = getEl('tab-billing');
const tabSettingsBtn = getEl('tab-settings');
const entryView = getEl('entry-view');
const billingView = getEl('billing-view');
const settingsView = getEl('settings-view');

// --- Entry View Elements ---
const entryFormContainer = getEl('entry-form-container'); // Container for billing-only mode
const billingOnlyModeBtn = getEl('billing-only-mode-btn');
const entryViewSubtitle = getEl('entry-view-subtitle');
const finalDefectSizeContainer = getEl('final-defect-size-container');

const lesionForm = getEl('lesion-form');
const procedureTypeEl = getEl('procedureType');
const dynamicOptionsContainer = getEl('dynamic-options-container');
const addLesionBtn = getEl('add-lesion-btn');
const cancelEditBtn = getEl('cancel-edit-btn');

const patientNameEl = getEl('patientName');
const doctorCodeEl = getEl('doctorCode'); // This is now a <select>
const saveProcedureBtn = getEl('save-procedure-btn');
const clearProcedureBtn = getEl('clear-procedure-btn');

const lesionsListEl = getEl('lesions-list');
const entryNoteOutputEl = getEl('entryNoteOutput');
const clinicalRequestOutputEl = getEl('clinicalRequestOutput');
const formTitle = getEl('form-title');
const clinicalRequestContainer = getEl('clinical-request-output-container');
const entryNoteContainer = getEl('entry-note-output-container');
const outputBtnCombined = getEl('output-btn-combined');
const outputBtnSeparate = getEl('output-btn-separate');

// --- Billing View Elements ---
const billingViewContainer = getEl('billing-view-container');
const appTitle = getEl('app-title');
const loadFilesBtn = getEl('load-files-btn');
// const pmModeToggle = getEl('pm-mode-toggle'); // <-- This is no longer needed
const searchBar = getEl('search-bar');
const printBilledListBtn = getEl('print-billed-list-btn');

const unprocessedColumn = getEl('unprocessed-column');
const unprocessedList = getEl('unprocessed-list');
const unprocessedCountDash = getEl('unprocessed-count-dash');
const billedList = getEl('billed-list');
const billedCountDash = getEl('billed-count-dash');
const archiveList = getEl('archive-list');
const archiveCountDash = getEl('archive-count-dash');

const billingPanel = getEl('billing-panel');
const billingPanelTitle = getEl('billing-panel-title');
const billingPanelContent = getEl('billing-panel-content');
const billingAssistantLesions = getEl('billing-assistant-lesions');
const billingConsultItem = getEl('billing-consult-item');
const billingComment = getEl('billing-comment');
const closeBillingPanelBtn = getEl('close-billing-panel-btn');
const doctorActions = getEl('billing-panel-doctor-actions');
const pmActions = getEl('billing-panel-pm-actions');
const saveAsBilledBtn = getEl('save-as-billed-btn');
const deleteProcedureBtn = getEl('delete-procedure-btn');
const moveToArchiveBtn = getEl('move-to-archive-btn');

// --- Settings View Elements ---
const appSettingsEditor = getEl('app-settings-editor');
const saveAppSettingsBtn = getEl('save-app-settings-btn');
const resetAppSettingsBtn = getEl('reset-app-settings-btn');
const appSettingsStatus = getEl('app-settings-status');
const newDoctorNameInput = getEl('new-doctor-name'); // <-- NEW
const addDoctorBtn = getEl('add-doctor-btn'); // <-- NEW
const addDoctorStatus = getEl('add-doctor-status'); // <-- NEW

// --- Print Elements ---
const printTitle = getEl('print-title');
const printTable = getEl('print-table');


// Form Sections
const excisionOptions = getEl('excision-options');
const graftTypeContainer = getEl('graft-type-container');
const justificationContainer = getEl('justification-container');
const punchOptions = getEl('punch-options');
const lesionSizeContainer = getEl('lesion-size-container');
const marginContainer = getEl('margin-container');
const punchSizeContainer = getEl('punch-size-container');
const orientationInputContainer = getEl('orientation-input-container');
const closureDetailsContainer = getEl('closure-details-container');
const useDeepSutureEl = getEl('useDeepSuture');
const deepSutureContainer = getEl('deep-suture-container');
const useNonDissolvableEl = getEl('useNonDissolvable');
const skinSutureDetails = getEl('skin-suture-details');

// Form Inputs
const excisionClosureTypeEl = getEl('excisionClosureType');
const punchTypeEl = getEl('punchType');
const skinSutureTypeEl = getEl('skinSutureType');
const deepSutureTypeEl = getEl('deepSutureType');
const skinSutureSizeEl = getEl('skinSutureSize');
const deepSutureSizeEl = getEl('deepSutureSize');

const justificationButtons = getEl('justification-buttons');
const flapGraftJustificationInput = getEl('flapGraftJustification');

// Modal References
const mainMarkerBtnContainer = getEl('main-marker-btn-container');
const orientationModal = getEl('orientationModal');
const clock = getEl('clock');
const modalLocationSelector = getEl('modal-location-selector');
const cancelOrientationBtn = getEl('cancelOrientationBtn');
const pathologyModal = getEl('pathologyModal');
const pathologyDisplayEl = getEl('pathologyDisplay');
const pathologyCheckboxesEl = getEl('pathology-checkboxes');
const otherPathologyInput = getEl('otherPathologyInput');
const confirmPathologyBtn = getEl('confirmPathologyBtn');
const dermoscopyBtnContainer = getEl('dermoscopy-btn-container');

// --- PWA File System Elements ---
const setSaveFolderBtn = getEl('set-save-folder-btn');
const folderStatusMsg = getEl('folder-status-msg');
let saveFolderHandle = null; // This will store our main billing folder permission
let currentBillingFile = { handle: null, data: null, fromFolder: '', fromDoctor: '' }; // State for the open billing file

// --- State Management ---
let lesions = []; // This is now a temporary list for the current procedure
let lesionCounter = 0;
let editingLesionId = null;
let editingLesionDoctor = null; // Store the original doctor when editing
let modalSelectedLocationElement = null;
let allFiles = { unprocessed: [], billed: [], archive: [] }; // Global state for billing files
let appSettings = {}; // Holds ALL app settings
let isBillingOnlyMode = false;

const pathologyOptions = {
    'BCC': 'Basal cell carcinoma', 'SCC': 'Squamous cell carcinoma', 'IEC': 'IEC/Bowen\'s disease',
    'MMis': 'Melanoma in situ', 'MMinv': 'Melanoma invasive', 'DN': 'Naevus: dysplastic', 'BN': 'Naevus: banal',
    'SebK': 'Seborrhoeic keratosis', 'SK': 'Solar keratosis', 'KA': 'Keratoacanthoma', 'B Cyst': 'Benign cyst',
    'DF': 'Dermatofibroma', 'LPLK': 'Lichen planus-like keratosis', 'MCC': 'Merkel cell carcinoma',
    'OB': 'Other benign', 'OM': 'Other malignant', 'SGH': 'Sebaceous gland hyperplasia', 'SL': 'Solar lentigo',
    'HMF': 'Hutchinson\'s melanotic freckle', 'MMmet': 'Melanoma, metastasis', 'SN': 'Naevus: Spitz'
};


// --- EVENT LISTENERS ---

// --- Tab Navigation ---
function switchTab(tabName) {
    [tabEntryBtn, tabBillingBtn, tabSettingsBtn].forEach(btn => btn.classList.remove('active'));
    [entryView, billingView, settingsView].forEach(view => view.classList.remove('active'));

    if (tabName === 'entry') {
        tabEntryBtn.classList.add('active');
        entryView.classList.add('active');
    } else if (tabName === 'billing') {
        tabBillingBtn.classList.add('active');
        billingView.classList.add('active');
        
        // When switching to billing, re-scan folders and reload files
        // This ensures the doctor list is up-to-date
        (async () => {
            if (saveFolderHandle) {
                appSettings.doctorList = await getDoctorListFromFolders();
                populateDoctorDropdown();
                loadBillingFiles(); // Load files for the currently selected doctor
            }
        })();

    } else if (tabName === 'settings') {
        tabSettingsBtn.classList.add('active');
        settingsView.classList.add('active');
        loadAppSettingsToEditor();
    }
}

// --- Dynamic Doctor Dropdown Population ---
function populateDoctorDropdown() {
    doctorCodeEl.innerHTML = ''; // Clear existing options
    const savedDoctorCode = localStorage.getItem('doctorCode');

    if (appSettings.doctorList && appSettings.doctorList.length > 0) {
        appSettings.doctorList.forEach(doctorDisplayName => {
            const option = document.createElement('option');
            // We use the display name (with spaces) for both value and text
            option.value = doctorDisplayName;
            option.textContent = doctorDisplayName;
            doctorCodeEl.appendChild(option);
        });

        // Restore saved doctor
        if (savedDoctorCode && appSettings.doctorList.includes(savedDoctorCode)) {
            doctorCodeEl.value = savedDoctorCode;
        } else if (appSettings.doctorList.length > 1) {
            // Default to the first *non-PM* doctor if no selection saved
            // Assumes PM is always at index 0
            doctorCodeEl.value = appSettings.doctorList[1]; 
        } else if (appSettings.doctorList.length > 0) {
            // Fallback to whatever is first (probably just PM)
            doctorCodeEl.value = appSettings.doctorList[0];
        }

        // Trigger change to save and update PM mode if needed
        handleDoctorChange();

    } else {
        // Fallback if settings are broken
        const option = document.createElement('option');
        option.value = "ERROR";
        option.textContent = "Error: No save folder set";
        doctorCodeEl.appendChild(option);
    }
}

// --- Handle Doctor Change and PM Mode ---
function handleDoctorChange() {
    const selectedDoctor = doctorCodeEl.value;
    localStorage.setItem('doctorCode', selectedDoctor);

    // This function now *replaces* the old pmModeToggle
    const isPM = (selectedDoctor === appSettings.pmIdentifier);
    togglePMModeView(isPM);

    // When the doctor changes, we must reload the billing files
    // This check prevents auto-loading before the billing view is ready
    if (billingView.classList.contains('active')) {
        loadBillingFiles();
    }
}

// --- NEW: Controls the UI based on PM selection ---
function togglePMModeView(isPM) {
    billingViewContainer.classList.toggle('pm-mode-active', isPM);
    appTitle.textContent = isPM ? "Billing & Processing (PM View)" : "Clinical Management PWA";
}


// --- Handle Billing-Only Mode Toggle ---
function toggleBillingOnlyMode() {
    isBillingOnlyMode = !isBillingOnlyMode;
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
    // Re-validate the form for the new mode
    checkLesionFormCompleteness();
}

// --- NEW: Handle Add Doctor Button ---
async function handleAddDoctor() {
    const newName = newDoctorNameInput.value.trim();
    if (!newName) {
        addDoctorStatus.textContent = "Error: Doctor name cannot be empty.";
        addDoctorStatus.className = "text-sm mt-2 text-red-600";
        return;
    }

    try {
        addDoctorStatus.textContent = "Creating folders...";
        addDoctorStatus.className = "text-sm mt-2 text-slate-600";
        
        const result = await addNewDoctorFolder(newName);
        
        addDoctorStatus.textContent = `${result} Please refresh the app.`;
        addDoctorStatus.className = "text-sm mt-2 text-green-600";
        newDoctorNameInput.value = ''; // Clear input on success

        // Refresh the doctor list in the app state
        appSettings.doctorList = await getDoctorListFromFolders();
        populateDoctorDropdown();

    } catch (e) {
        addDoctorStatus.textContent = `Error: ${e.message}`;
        addDoctorStatus.className = "text-sm mt-2 text-red-600";
    }
}


// --- INIT ---
document.addEventListener('DOMContentLoaded', () => {
    // --- Connect Tab Listeners ---
    tabEntryBtn.addEventListener('click', () => switchTab('entry'));
    tabBillingBtn.addEventListener('click', () => switchTab('billing'));
    tabSettingsBtn.addEventListener('click', () => switchTab('settings'));

    // --- Connect Entry View Listeners ---
    lesionForm.addEventListener('change', updateFormUI);
    lesionForm.addEventListener('input', checkLesionFormCompleteness);
    
    addLesionBtn.addEventListener('click', addOrUpdateLesion);
    cancelEditBtn.addEventListener('click', cancelEdit);

    saveProcedureBtn.addEventListener('click', saveProcedure);
    clearProcedureBtn.addEventListener('click', resetAll);

    getEl('copy-request-btn').addEventListener('click', () => copyToClipboard('clinicalRequestOutput', getEl('copy-request-btn-text')));
    getEl('copy-note-btn').addEventListener('click', () => copyToClipboard('entryNoteOutput', getEl('copy-note-btn-text')));
    
    cancelOrientationBtn.addEventListener('click', () => orientationModal.classList.add('hidden'));
    
    useDeepSutureEl.addEventListener('change', () => deepSutureContainer.classList.toggle('hidden'));
    useNonDissolvableEl.addEventListener('change', () => skinSutureDetails.classList.toggle('hidden', !useNonDissolvableEl.checked));
    
    outputBtnCombined.addEventListener('click', () => setOutputStyle('combined'));
    outputBtnSeparate.addEventListener('click', () => setOutputStyle('separate'));
    
    justificationButtons.addEventListener('click', (e) => {
        if(e.target.classList.contains('justification-btn')) {
            e.target.classList.toggle('selected');
            const selectedButtons = justificationButtons.querySelectorAll('.justification-btn.selected');
            const justifications = Array.from(selectedButtons).map(btn => btn.dataset.text);
            flapGraftJustificationInput.value = justifications.join(' ');
            checkLesionFormCompleteness();
        }
    });

    pathologyDisplayEl.addEventListener('click', openPathologyModal);
    confirmPathologyBtn.addEventListener('click', confirmPathologySelection);
    
    dermoscopyBtnContainer.addEventListener('click', (e) => {
        const target = e.target.closest('.dermoscopy-btn');
        if (!target) return;
        getEl('dermoscopyUsed').value = target.dataset.value;
        dermoscopyBtnContainer.querySelectorAll('.dermoscopy-btn').forEach(btn => btn.classList.remove('selected'));
        target.classList.add('selected');
        checkLesionFormCompleteness();
    });

    // --- Connect Billing View Listeners ---
    loadFilesBtn.addEventListener('click', async () => {
        // "Refresh Database" now re-scans for new doctors first
        if (saveFolderHandle) {
            appSettings.doctorList = await getDoctorListFromFolders();
            populateDoctorDropdown();
        }
        loadBillingFiles();
    });
    // pmModeToggle.addEventListener('change', togglePMMode); // <-- REMOVED
    searchBar.addEventListener('input', () => renderFileLists()); // Re-render on search
    printBilledListBtn.addEventListener('click', printBilledList);
    
    closeBillingPanelBtn.addEventListener('click', () => billingPanel.classList.add('hidden'));
    saveAsBilledBtn.addEventListener('click', saveBilledFile);
    deleteProcedureBtn.addEventListener('click', deleteBillingFile);
    moveToArchiveBtn.addEventListener('click', archiveBilledFile);

    // --- Connect Settings View Listeners ---
    saveAppSettingsBtn.addEventListener('click', saveAppSettings);
    resetAppSettingsBtn.addEventListener('click', resetAppSettings);
    addDoctorBtn.addEventListener('click', handleAddDoctor); // <-- NEW

    // --- Connect PWA/File System Listeners ---
    setSaveFolderBtn.addEventListener('click', setSaveFolder);
    billingOnlyModeBtn.addEventListener('click', toggleBillingOnlyMode);



    // --- Connect Doctor Dropdown Listener ---
    doctorCodeEl.addEventListener('change', handleDoctorChange);

    // --- Modal & Clock Listeners ---
     mainMarkerBtnContainer.addEventListener('click', (e) => {
        const target = e.target.closest('.main-marker-btn');
        if (!target) return;

        const markerType = target.dataset.value;
        getEl('orientationType').value = markerType;

        if (markerType === 'None') {
            getEl('orientationDescription').value = '';
            updateOrientationButtons();
        } else {
            openOrientationModal();
        }
    });

    modalLocationSelector.addEventListener('click', (e) => {
        const target = e.target.closest('.direction-btn, .hour-text');
        if (!target) return;

        getEl('orientationDescription').value = target.dataset.value;
        updateOrientationButtons();
        orientationModal.classList.add('hidden');
    });


    // --- Initial App Load ---
    loadAppSettings(); // Load settings first
    
    // This is now triggered by db.js onsuccess callback
    // dbOpenRequest.onsuccess = (event) => {
    //     db = event.target.result;
    //     console.log("Database connection ready.");
    //     loadSavedFolder(); // Load folder, which then populates doctors
    // };
    // We moved this call to db.js to ensure load order
    loadSavedFolder(); // Load folder, which then populates doctors

    // Populate pathology modal
    Object.entries(pathologyOptions).forEach(([key, value]) => {
        const label = document.createElement('label');
        label.className = 'flex items-center space-x-2 text-sm';
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.value = key;
        checkbox.className = 'h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500';
        label.appendChild(checkbox);
        const span = document.createElement('span');
        span.textContent = `${key} (${value})`;
        label.appendChild(span);
        pathologyCheckboxesEl.appendChild(label);
    });

    // Draw clock
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

    // Final UI setup
    updateOutputVisibility();
    updateFormUI();
    // Set the initial lesion counter title
    formTitle.textContent = `Enter Lesion ${lesionCounter + 1} Details`;
});
