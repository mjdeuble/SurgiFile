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

// --- NEW: Nav / Mode Elements ---
const appTitle = getEl('app-title');
const modeBtnDoctor = getEl('mode-btn-doctor');
const modeBtnPM = getEl('mode-btn-pm');
const navDoctorContainer = getEl('nav-doctor-container');
const navDoctorDropdown = getEl('navDoctorDropdown');


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
// const doctorCodeEl = getEl('doctorCode'); // <-- This is REMOVED
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
const loadFilesBtn = getEl('load-files-btn');
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
// const billingPanelContent = getEl('billing-panel-content'); // <-- REMOVED
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
const useDissolvableEl = getEl('useDissolvable'); // <-- NEW
const skinSutureDetailsDissolvable = getEl('skin-suture-details-dissolvable'); // <-- NEW


// Form Inputs
const excisionClosureTypeEl = getEl('excisionClosureType');
const punchTypeEl = getEl('punchType');
const skinSutureTypeEl = getEl('skinSutureType');
const deepSutureTypeEl = getEl('deepSutureType');
const skinSutureSizeEl = getEl('skinSutureSize');
const deepSutureSizeEl = getEl('deepSutureSize');
const anatomicalRegionEl = getEl('anatomicalRegion');
const skinSutureTypeDissolvableEl = getEl('skinSutureTypeDissolvable'); // <-- NEW
const skinSutureSizeDissolvableEl = getEl('skinSutureSizeDissolvable'); // <-- NEW


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
const otherPathologyInput = getEl('otherPathsologyInput'); // <-- Fix typo from index
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
let currentAppMode = 'Doctor'; // NEW: 'Doctor' or 'PM'
let currentDoctor = ''; // NEW: Stores the display name of the selected doctor

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
        
        // When switching to billing, just load the files for the current mode/doctor
        loadBillingFiles();

    } else if (tabName === 'settings') {
        tabSettingsBtn.classList.add('active');
        settingsView.classList.add('active');
        loadAppSettingsToEditor();
    }
}

// --- NEW: App Mode Controller ---
function setAppMode(mode) {
    if (mode === 'Doctor') {
        currentAppMode = 'Doctor';
        modeBtnDoctor.classList.add('active');
        modeBtnPM.classList.remove('active');
        navDoctorContainer.style.display = 'block'; // Show dropdown
        appTitle.textContent = "Clinical Management PWA";
        billingViewContainer.classList.remove('pm-mode-active');
    } else { // 'PM'
        currentAppMode = 'PM';
        modeBtnDoctor.classList.remove('active');
        modeBtnPM.classList.add('active');
        navDoctorContainer.style.display = 'none'; // Hide dropdown
        appTitle.textContent = "Billing & Processing (PM View)";
        billingViewContainer.classList.add('pm-mode-active');
    }
    localStorage.setItem('appMode', currentAppMode);
    
    // When mode changes, reload billing files
    if (billingView.classList.contains('active')) {
        loadBillingFiles();
    }
}

// --- Dynamic Doctor Dropdown Population ---
function populateDoctorDropdown() {
    navDoctorDropdown.innerHTML = ''; // Clear existing options
    const savedDoctor = localStorage.getItem('currentDoctor');

    if (appSettings.doctorList && appSettings.doctorList.length > 0) {
        appSettings.doctorList.forEach(doctorDisplayName => {
            const option = document.createElement('option');
            option.value = doctorDisplayName;
            option.textContent = doctorDisplayName;
            navDoctorDropdown.appendChild(option);
        });

        // Restore saved doctor
        if (savedDoctor && appSettings.doctorList.includes(savedDoctor)) {
            navDoctorDropdown.value = savedDoctor;
        } else if (appSettings.doctorList.length > 0) {
            // Default to the first doctor
            navDoctorDropdown.value = appSettings.doctorList[0];
        }
    } else {
        // No doctors found
        const option = document.createElement('option');
        option.value = "";
        option.textContent = "No doctors found";
        navDoctorDropdown.appendChild(option);
    }
    
    // Trigger change to save and update state
    handleDoctorChange();
}

// --- Handle Doctor Change ---
function handleDoctorChange() {
    currentDoctor = navDoctorDropdown.value;
    localStorage.setItem('currentDoctor', currentDoctor);

    // When the doctor changes, we must reload the billing files
    if (billingView.classList.contains('active')) {
        loadBillingFiles();
    }
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

// --- Handle Add Doctor Button ---
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
        
        addDoctorStatus.textContent = `${result} Refreshing doctor list...`;
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

    // --- Connect NEW Mode Listeners ---
    modeBtnDoctor.addEventListener('click', () => setAppMode('Doctor'));
    modeBtnPM.addEventListener('click', () => setAppMode('PM'));
    navDoctorDropdown.addEventListener('change', handleDoctorChange);

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
    
    useDeepSutureEl.addEventListener('change', () => {
        deepSutureContainer.classList.toggle('hidden', !useDeepSutureEl.checked);
    });
    useNonDissolvableEl.addEventListener('change', () => {
        skinSutureDetails.classList.toggle('hidden', !useNonDissolvableEl.checked);
        // NEW: Uncheck the other box if this one is checked
        if (useNonDissolvableEl.checked) {
            useDissolvableEl.checked = false;
            skinSutureDetailsDissolvable.classList.add('hidden');
        }
    });
    // NEW: Listener for dissolvable sutures
    useDissolvableEl.addEventListener('change', () => {
        skinSutureDetailsDissolvable.classList.toggle('hidden', !useDissolvableEl.checked);
        if (useDissolvableEl.checked) {
            useNonDissolvableEl.checked = false;
            skinSutureDetails.classList.add('hidden');
        }
    });
    
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
            populateDoctorDropdown(); // This will re-select the doctor and trigger loadBillingFiles()
        }
    });
    searchBar.addEventListener('input', () => renderFileLists()); // Re-render on search
    printBilledListBtn.addEventListener('click', printBilledList);
    
    closeBillingPanelBtn.addEventListener('click', () => billingPanel.classList.add('hidden'));
    saveAsBilledBtn.addEventListener('click', saveBilledFile);
    deleteProcedureBtn.addEventListener('click', deleteBillingFile);
Next, we'll update `entry-view.js` to get its `doctorCode` from the *new* `navDoctorDropdown` element. Ready?
    moveToArchiveBtn.addEventListener('click', archiveBilledFile);

    // --- Connect Settings View Listeners ---
    saveAppSettingsBtn.addEventListener('click', saveAppSettings);
    resetAppSettingsBtn.addEventListener('click', resetAppSettings);
    addDoctorBtn.addEventListener('click', handleAddDoctor);

    // --- Connect PWA/File System Listeners ---
    setSaveFolderBtn.addEventListener('click', setSaveFolder);
    billingOnlyModeBtn.addEventListener('click', toggleBillingOnlyMode);

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
    
    // Restore the saved app mode, default to 'Doctor'
    const savedMode = localStorage.getItem('appMode') || 'Doctor';
    setAppMode(savedMode);

    // The loadSavedFolder() call is in db.js, which is loaded
    // after this file. It will run on db:onsuccess.

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
