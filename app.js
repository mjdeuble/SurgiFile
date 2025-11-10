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
// This section defines all querySelector constants for the app
// We use 'var' and attach to 'window' to ensure they are globally accessible
// across all script files.

window.getEl = (id) => document.getElementById(id);

// --- Tab View Elements ---
var tabClinicalNoteBtn = getEl('tab-clinical-note');
var tabManualBillingBtn = getEl('tab-manual-billing');
var tabBillingBtn = getEl('tab-billing');
var tabSettingsBtn = getEl('tab-settings');
var entryView = getEl('entry-view');
var billingView = getEl('billing-view');
var settingsView = getEl('settings-view');

// --- Nav Bar Mode Elements ---
var navDoctorDropdownContainer = getEl('nav-doctor-dropdown-container');
var navDoctorDropdown = getEl('nav-doctor-dropdown');
var appTitle = getEl('app-title');
var pmModeToggle = getEl('pm-mode-toggle');
var pmModeToggleLabel = getEl('pm-mode-toggle-label');

// --- Entry View Elements ---
var entryFormContainer = getEl('entry-form-container');
var entryGridContainer = getEl('entry-grid-container');
var entryViewHeaderTitle = getEl('entry-view-header-title');
var entryViewSubtitle = getEl('entry-view-subtitle');
var finalDefectSizeContainer = getEl('final-defect-size-container');
var fullClinicalFieldsContainer = getEl('full-clinical-fields');

var lesionForm = getEl('lesion-form');
var procedureTypeEl = getEl('procedureType');
var dynamicOptionsContainer = getEl('dynamic-options-container');
var addLesionBtn = getEl('add-lesion-btn');
var cancelEditBtn = getEl('cancel-edit-btn');

var patientNameEl = getEl('patientName');
var saveProcedureBtn = getEl('save-procedure-btn');
var clearProcedureBtn = getEl('clear-procedure-btn');

var lesionsListEl = getEl('lesions-list');
var lesionsListContainer = getEl('lesions-list-container');
var entryNoteOutputEl = getEl('entryNoteOutput');
var clinicalRequestOutputEl = getEl('clinicalRequestOutput');
var formTitle = getEl('form-title');
var clinicalRequestContainer = getEl('clinical-request-output-container');
var entryNoteContainer = getEl('entry-note-output-container');
var outputColumn = getEl('output-column');
var outputBtnCombined = getEl('output-btn-combined');
var outputBtnSeparate = getEl('output-btn-separate');
var outputStyleContainer = getEl('output-style-container');

// --- Billing View Elements ---
var billingViewContainer = getEl('billing-view-container');
var loadFilesBtn = getEl('load-files-btn');
var searchBar = getEl('search-bar');
var printBilledListBtn = getEl('print-billed-list-btn');
var unprocessedSection = getEl('unprocessed-section');
var unprocessedHeader = getEl('unprocessed-header'); // Added back
var unprocessedList = getEl('unprocessed-list');
var unprocessedCountDash = getEl('unprocessed-count-dash');
var billedSection = getEl('billed-section');
var billedHeader = getEl('billed-header');
var billedList = getEl('billed-list');
var billedCountDash = getEl('billed-count-dash');
var archiveSection = getEl('archive-section');
var archiveHeader = getEl('archive-header');
var archiveList = getEl('archive-list');
var archiveCountDash = getEl('archive-count-dash');
var archiveSearch = getEl('archive-search'); // Added back
var batchArchiveBtn = getEl('batch-archive-btn'); // Added back

var billingPanel = getEl('billing-panel');
var billingPanelTitle = getEl('billing-panel-title');
var billingAssistantLesions = getEl('billing-assistant-lesions');
var billingConsultItem = getEl('billing-consult-item');
var billingComment = getEl('billing-comment');
var closeBillingPanelBtn = getEl('close-billing-panel-btn');
var doctorActions = getEl('billing-panel-doctor-actions');
var pmActions = getEl('billing-panel-pm-actions');
var saveAsBilledBtn = getEl('save-as-billed-btn');
var deleteProcedureBtn = getEl('delete-procedure-btn');
var moveToArchiveBtn = getEl('move-to-archive-btn');
var editProcedureBtn = getEl('edit-procedure-btn');

// --- Settings View Elements ---
var setSaveFolderBtn = getEl('set-save-folder-btn');
var folderStatusMsg = getEl('folder-status-msg');
var appSettingsEditor = getEl('app-settings-editor');
var saveAppSettingsBtn = getEl('save-app-settings-btn');
var resetAppSettingsBtn = getEl('reset-app-settings-btn');
var appSettingsStatus = getEl('app-settings-status');
var newDoctorNameInput = getEl('new-doctor-name');
var addDoctorBtn = getEl('add-doctor-btn');
var addDoctorStatus = getEl('add-doctor-status');

// --- Print Elements ---
var printTitle = getEl('print-title');
var printTable = getEl('print-table');

// --- Entry Form Sections ---
var excisionOptions = getEl('excision-options');
var graftTypeContainer = getEl('graft-type-container');
var justificationContainer = getEl('justification-container');
var punchOptions = getEl('punch-options');
var lesionSizeContainer = getEl('lesion-size-container');
var marginContainer = getEl('margin-container');
var punchSizeContainer = getEl('punch-size-container');
var orientationInputContainer = getEl('orientation-input-container');
var closureDetailsContainer = getEl('closure-details-container');
var deepSutureContainer = getEl('deep-suture-container');
var skinSutureDetails = getEl('skin-suture-details');
// REMOVED: var skinSutureDetailsDissolvable = getEl('skin-suture-details-dissolvable');
var pathologyContainer = getEl('pathology-container');
var skinSutureRemovalContainer = getEl('skin-suture-removal-container');

// --- Entry Form Inputs ---
var anatomicalRegionEl = getEl('anatomicalRegion');
var excisionClosureTypeEl = getEl('excisionClosureType');
var punchTypeEl = getEl('punchType');
var useDeepSutureEl = getEl('useDeepSuture');
var deepSutureTypeEl = getEl('deepSutureType');
var deepSutureSizeEl = getEl('deepSutureSize');
var useSkinSutureEl = getEl('useSkinSuture');
var skinSutureTypeEl = getEl('skinSutureType');
var skinSutureSizeEl = getEl('skinSutureSize');
var removalOfSkinSuturesEl = getEl('removalOfSkinSutures');
var justificationButtons = getEl('justification-buttons');
var flapGraftJustificationInput = getEl('flapGraftJustification');

// --- Modal References ---
var mainMarkerBtnContainer = getEl('main-marker-btn-container');
var orientationModal = getEl('orientationModal');
var clock = getEl('clock');
var modalLocationSelector = getEl('modal-location-selector');
var cancelOrientationBtn = getEl('cancelOrientationBtn');
var pathologyModal = getEl('pathologyModal');
var pathologyDisplayEl = getEl('pathologyDisplay');
var pathologyCheckboxesEl = getEl('pathology-checkboxes');
var otherPathologyInput = getEl('otherPathologyInput');
var confirmPathologyBtn = getEl('confirmPathologyBtn');
var dermoscopyBtnContainer = getEl('dermoscopy-btn-container');

// --- PWA File System Elements ---
window.saveFolderHandle = null;
window.currentBillingFile = { handle: null, data: null, fromFolder: '', fromDoctor: '' };

// --- State Management ---
window.lesions = [];
window.lesionCounter = 0;
window.editingLesionId = null;
window.editingProcedureFile = null;
window.modalSelectedLocationElement = null;
window.allFiles = { unprocessed: [], billed: [], archive: [] };
window.appSettings = {};
window.isBillingOnlyMode = false;
window.currentAppMode = 'Doctor';
window.currentDoctor = null;

window.pathologyOptions = {
    'BCC': 'Basal cell carcinoma', 'SCC': 'Squamous cell carcinoma', 'IEC': 'IEC/Bowen\'s disease',
    'MMis': 'Melanoma in situ', 'MMinv': 'Melanoma invasive', 'DN': 'Naevus: dysplastic', 'BN': 'Naevus: banal',
    'SebK': 'Seborrhoeic keratosis', 'SK': 'Solar keratosis', 'KA': 'Keratoacanthoma', 'B Cyst': 'Benign cyst',
    'DF': 'Dermatofibroma', 'LPLK': 'Lichen planus-like keratosis', 'MCC': 'Merkel cell carcinoma',
    'OB': 'Other benign', 'OM': 'Other malignant', 'SGH': 'Sebaceous gland hyperplasia', 'SL': 'Solar lentigo',
    'HMF': 'Hutchinson\'s melanotic freckle', 'MMmet': 'Melanoma, metastasis', 'SN': 'Naevus: Spitz'
};

// --- GLOBAL FUNCTIONS ---

window.switchTab = function(tabName) {
    [tabClinicalNoteBtn, tabManualBillingBtn, tabBillingBtn, tabSettingsBtn].forEach(btn => btn.classList.remove('active'));
    [entryView, billingView, settingsView].forEach(view => view.classList.remove('active'));

    if (tabName === 'clinical-note') {
        isBillingOnlyMode = false;
        entryView.classList.add('active');
        tabClinicalNoteBtn.classList.add('active');
    } else if (tabName === 'manual-billing') {
        isBillingOnlyMode = true;
        entryView.classList.add('active');
        tabManualBillingBtn.classList.add('active');
    } else if (tabName === 'billing') {
        billingView.classList.add('active');
        tabBillingBtn.classList.add('active');
        (async () => {
            if (saveFolderHandle) {
                const doctors = await getDoctorListFromFolders();
                populateDoctorDropdown(doctors);
            }
            handleDoctorChange();
        })();
    } else if (tabName === 'settings') {
        settingsView.classList.add('active');
        tabSettingsBtn.classList.add('active');
        loadAppSettingsToEditor();
    }

    if (tabName === 'clinical-note' || tabName === 'manual-billing') {
        updateEntryModeUI();
    }
}

window.updateEntryModeUI = function() {
    entryFormContainer.classList.toggle('billing-only-mode', isBillingOnlyMode);
    if (isBillingOnlyMode) {
        entryViewHeaderTitle.textContent = 'Add Manual Billing';
        entryViewSubtitle.textContent = 'Part 1: Enter minimal billing data for a procedure performed previously.';
        outputColumn.style.display = 'block';
        entryGridContainer.classList.remove('lg:grid-cols-1');
        entryGridContainer.classList.add('lg:grid-cols-2');
        
        lesionsListContainer.style.display = 'block';
        clinicalRequestContainer.style.display = 'block';
        entryNoteContainer.style.display = 'none';
        outputStyleContainer.style.display = 'none';
    } else {
        entryViewHeaderTitle.textContent = 'Clinical Note Generator';
        entryViewSubtitle.textContent = 'Part 1: Enter full clinical data and generate the operation note.';
        outputColumn.style.display = 'block';
        entryGridContainer.classList.remove('lg:grid-cols-1');
        entryGridContainer.classList.add('lg:grid-cols-2');

        lesionsListContainer.style.display = 'block';
        outputStyleContainer.style.display = 'flex';
        updateOutputVisibility(); 
    }
    updateFormUI();
}

window.setAppMode = function(mode) {
    currentAppMode = mode;
    localStorage.setItem('appMode', mode);

    const isPM = (mode === 'PM');
    tabClinicalNoteBtn.style.display = isPM ? 'none' : 'inline-block';
    tabManualBillingBtn.style.display = isPM ? 'none' : 'inline-block';

    if (isPM) {
        pmModeToggle.checked = true;
        navDoctorDropdownContainer.classList.add('hidden');
        appTitle.textContent = "Billing & Processing (PM View)";
        currentDoctor = null;

        if (entryView.classList.contains('active')) {
            switchTab('billing');
        }
    } else {
        pmModeToggle.checked = false;
        navDoctorDropdownContainer.classList.remove('hidden');
        appTitle.textContent = "Clinical Management PWA";
        currentDoctor = navDoctorDropdown.value || null;
    }

    billingViewContainer.classList.toggle('pm-mode-active', isPM);
    billingViewContainer.classList.toggle('doctor-mode-active', !isPM);

    if (isPM) {
        unprocessedList.classList.add('collapsed');
        billedList.classList.remove('collapsed');
        archiveList.classList.add('collapsed');
    } else {
        unprocessedList.classList.remove('collapsed');
        billedList.classList.add('collapsed');
        archiveList.classList.add('collapsed');
    }

    if (billingView.classList.contains('active')) {
        loadBillingFiles();
    }
}

window.populateDoctorDropdown = function(doctors) {
    const savedDoctor = localStorage.getItem('currentDoctor');
    navDoctorDropdown.innerHTML = '';

    if (!doctors || doctors.length === 0) {
        const option = document.createElement('option');
        option.value = "";
        option.textContent = "No doctors found";
        navDoctorDropdown.appendChild(option);
        currentDoctor = null;

        if (!saveFolderHandle) {
            switchTab('settings');
        }
        return;
    }

    doctors.forEach(doctorName => {
        const option = document.createElement('option');
        option.value = doctorName;
        option.textContent = doctorName;
        navDoctorDropdown.appendChild(option);
    });

    if (savedDoctor && doctors.includes(savedDoctor)) {
        navDoctorDropdown.value = savedDoctor;
    }
    
    currentDoctor = navDoctorDropdown.value;
}

window.handleDoctorChange = function() {
    currentDoctor = navDoctorDropdown.value;
    localStorage.setItem('currentDoctor', currentDoctor);

    if (billingView.classList.contains('active')) {
        loadBillingFiles();
    }
}
