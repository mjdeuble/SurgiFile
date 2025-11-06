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
const getEl = (id) => document.getElementById(id);

// --- Tab View Elements ---
const tabClinicalNoteBtn = getEl('tab-clinical-note');
const tabManualBillingBtn = getEl('tab-manual-billing');
const tabBillingBtn = getEl('tab-billing');
const tabSettingsBtn = getEl('tab-settings');
const entryView = getEl('entry-view');
const billingView = getEl('billing-view');
const settingsView = getEl('settings-view');

// --- Nav Bar Mode Elements ---
const modeBtnDoctor = getEl('mode-btn-doctor');
const modeBtnPM = getEl('mode-btn-pm');
const navDoctorDropdownContainer = getEl('nav-doctor-dropdown-container');
const navDoctorDropdown = getEl('nav-doctor-dropdown');
const appTitle = getEl('app-title');

// --- Entry View Elements ---
const entryFormContainer = getEl('entry-form-container'); // Container for billing-only mode
const entryViewSubtitle = getEl('entry-view-subtitle');
const finalDefectSizeContainer = getEl('final-defect-size-container');
const fullClinicalFieldsContainer = getEl('full-clinical-fields');

const lesionForm = getEl('lesion-form');
const procedureTypeEl = getEl('procedureType');
const dynamicOptionsContainer = getEl('dynamic-options-container');
const addLesionBtn = getEl('add-lesion-btn');
const cancelEditBtn = getEl('cancel-edit-btn');

const patientNameEl = getEl('patientName');
// doctorCodeEl is now navDoctorDropdown
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
const unprocessedSection = getEl('unprocessed-section');
const unprocessedList = getEl('unprocessed-list');
const unprocessedCountDash = getEl('unprocessed-count-dash');
const billedSection = getEl('billed-section');
const billedHeader = getEl('billed-header');
const billedList = getEl('billed-list');
const billedCountDash = getEl('billed-count-dash');
const archiveSection = getEl('archive-section');
const archiveHeader = getEl('archive-header');
const archiveList = getEl('archive-list');
const archiveCountDash = getEl('archive-count-dash');

const billingPanel = getEl('billing-panel');
const billingPanelTitle = getEl('billing-panel-title');
const billingAssistantLesions = getEl('billing-assistant-lesions');
const billingConsultItem = getEl('billing-consult-item');
const billingComment = getEl('billing-comment');
const closeBillingPanelBtn = getEl('close-billing-panel-btn');
const doctorActions = getEl('billing-panel-doctor-actions');
const pmActions = getEl('billing-panel-pm-actions');
const saveAsBilledBtn = getEl('save-as-billed-btn');
const deleteProcedureBtn = getEl('delete-procedure-btn');
const moveToArchiveBtn = getEl('move-to-archive-btn');
const editProcedureBtn = getEl('edit-procedure-btn');

// --- Settings View Elements ---
const setSaveFolderBtn = getEl('set-save-folder-btn');
const folderStatusMsg = getEl('folder-status-msg');
const appSettingsEditor = getEl('app-settings-editor');
const saveAppSettingsBtn = getEl('save-app-settings-btn');
const resetAppSettingsBtn = getEl('reset-app-settings-btn');
const appSettingsStatus = getEl('app-settings-status');
const newDoctorNameInput = getEl('new-doctor-name');
const addDoctorBtn = getEl('add-doctor-btn');
const addDoctorStatus = getEl('add-doctor-status');

// --- Print Elements ---
const printTitle = getEl('print-title');
const printTable = getEl('print-table');

// --- Entry Form Sections ---
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
const useDissolvableEl = getEl('useDissolvable');
const skinSutureDetailsDissolvable = getEl('skin-suture-details-dissolvable');

// --- Entry Form Inputs ---
const anatomicalRegionEl = getEl('anatomicalRegion');
const excisionClosureTypeEl = getEl('excisionClosureType');
const punchTypeEl = getEl('punchType');
const skinSutureTypeEl = getEl('skinSutureType');
const deepSutureTypeEl = getEl('deepSutureType');
const skinSutureSizeEl = getEl('skinSutureSize');
const deepSutureSizeEl = getEl('deepSutureSize');
const skinSutureTypeDissolvableEl = getEl('skinSutureTypeDissolvable');
const skinSutureSizeDissolvableEl = getEl('skinSutureSizeDissolvable');
const justificationButtons = getEl('justification-buttons');
const flapGraftJustificationInput = getEl('flapGraftJustification');

// --- Modal References ---
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
let saveFolderHandle = null; // This will store our main billing folder permission
let currentBillingFile = { handle: null, data: null, fromFolder: '', fromDoctor: '' }; // State for the open billing file

// --- State Management ---
let lesions = []; // This is now a temporary list for the current procedure
let lesionCounter = 0;
let editingLesionId = null;
let editingProcedureFile = null; // Store the original file data when editing
let modalSelectedLocationElement = null;
let allFiles = { unprocessed: [], billed: [], archive: [] }; // Global state for billing files
let appSettings = {}; // Holds ALL app settings
let isBillingOnlyMode = false;
let currentAppMode = 'Doctor'; // 'Doctor' or 'PM'
let currentDoctor = null; // The display name of the selected doctor

const pathologyOptions = {
    'BCC': 'Basal cell carcinoma', 'SCC': 'Squamous cell carcinoma', 'IEC': 'IEC/Bowen\'s disease',
    'MMis': 'Melanoma in situ', 'MMinv': 'Melanoma invasive', 'DN': 'Naevus: dysplastic', 'BN': 'Naevus: banal',
    'SebK': 'Seborrhoeic keratosis', 'SK': 'Solar keratosis', 'KA': 'Keratoacanthoma', 'B Cyst': 'Benign cyst',
    'DF': 'Dermatofibroma', 'LPLK': 'Lichen planus-like keratosis', 'MCC': 'Merkel cell carcinoma',
    'OB': 'Other benign', 'OM': 'Other malignant', 'SGH': 'Sebaceous gland hyperplasia', 'SL': 'Solar lentigo',
    'HMF': 'Hutchinson\'s melanotic freckle', 'MMmet': 'Melanoma, metastasis', 'SN': 'Naevus: Spitz'
};


// --- CORE APP LOGIC ---

/**
 * Switches the main view between Entry, Billing, and Settings
 * @param {string} tabName - The name of the tab to switch to
 */
function switchTab(tabName) {
    // Deselect all tabs and hide all views
    [tabClinicalNoteBtn, tabManualBillingBtn, tabBillingBtn, tabSettingsBtn].forEach(btn => btn.classList.remove('active'));
    [entryView, billingView, settingsView].forEach(view => view.classList.remove('active'));

    // Handle "Billing-Only Mode" based on which entry tab is clicked
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
        // When switching to billing, trigger a refresh
        (async () => {
            if (saveFolderHandle) {
                const doctors = await getDoctorListFromFolders();
                populateDoctorDropdown(doctors);
            }
            handleDoctorChange(); // This will trigger loadBillingFiles
        })();
    } else if (tabName === 'settings') {
        settingsView.classList.add('active');
        tabSettingsBtn.classList.add('active');
        loadAppSettingsToEditor();
    }

    // Update the UI elements on the entry page
    if (tabName === 'clinical-note' || tabName === 'manual-billing') {
        updateEntryModeUI();
    }
}

/**
 * Updates the Entry tab UI based on isBillingOnlyMode
 */
function updateEntryModeUI() {
    entryFormContainer.classList.toggle('billing-only-mode', isBillingOnlyMode);
    if (isBillingOnlyMode) {
        entryViewSubtitle.textContent = 'Part 1: Enter minimal billing data for a procedure performed previously.';
    } else {
        entryViewSubtitle.textContent = 'Part 1: Enter full clinical data and generate the operation note.';
    }
    // Re-run form logic to show/hide correct fields
    updateFormUI();
}

/**
 * Sets the app mode to 'Doctor' or 'PM'
 * @param {string} mode - The mode to switch to ('Doctor' or 'PM')
 */
function setAppMode(mode) {
    currentAppMode = mode;
    localStorage.setItem('appMode', mode);

    // Show/hide entry tabs based on mode
    const isPM = (mode === 'PM');
    tabClinicalNoteBtn.style.display = isPM ? 'none' : 'inline-block';
    tabManualBillingBtn.style.display = isPM ? 'none' : 'inline-block';

    if (isPM) {
        modeBtnPM.classList.add('active');
        modeBtnDoctor.classList.remove('active');
        navDoctorDropdownContainer.classList.add('hidden'); // Hide dropdown in PM mode
        appTitle.textContent = "Billing & Processing (PM View)";
        currentDoctor = null; // PM is not a doctor

        // If PM mode is set while on an entry tab, force switch to billing
        if (entryView.classList.contains('active')) {
            switchTab('billing');
        }

    } else { // Doctor mode
        modeBtnDoctor.classList.add('active');
        modeBtnPM.classList.remove('active');
        navDoctorDropdownContainer.classList.remove('hidden'); // Show dropdown
        appTitle.textContent = "Clinical Management PWA";
        // Set currentDoctor to the selected dropdown value
        currentDoctor = navDoctorDropdown.value || null;
    }

    // Update the billing view to reflect the new mode
    billingViewContainer.classList.toggle('pm-mode-active', isPM);
    billingViewContainer.classList.toggle('doctor-mode-active', !isPM);

    // Set default collapse states based on mode
    if (isPM) {
        // PM: Billed is always expanded, Archive is collapsed
        unprocessedList.classList.add('collapsed'); // (is hidden by CSS anyway)
        billedList.classList.remove('collapsed');
        archiveList.classList.add('collapsed');
    } else {
        // Doctor: Unprocessed is expanded, Billed & Archive are collapsed
        unprocessedList.classList.remove('collapsed');
        billedList.classList.add('collapsed');
        archiveList.classList.add('collapsed');
    }

    // Refresh the file list for the new mode
    if (billingView.classList.contains('active')) {
        loadBillingFiles();
    }
}

/**
 * Populates the doctor dropdown list from the scanned folder names
 * @param {string[]} doctors - An array of doctor display names
 */
function populateDoctorDropdown(doctors) {
    const savedDoctor = localStorage.getItem('currentDoctor');
    navDoctorDropdown.innerHTML = ''; // Clear old options

    if (!doctors || doctors.length === 0) {
        const option = document.createElement('option');
        option.value = "";
        option.textContent = "No doctors found";
        navDoctorDropdown.appendChild(option);
        currentDoctor = null;

        // *** REQUEST #7 ***
        // If no doctors are found AND no save folder is set,
        // redirect to the settings page.
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

    // Restore saved doctor
    if (savedDoctor && doctors.includes(savedDoctor)) {
        navDoctorDropdown.value = savedDoctor;
    }
    
    // Update the global state
    currentDoctor = navDoctorDropdown.value;
}

/**
 * Handles the logic when the doctor dropdown selection changes
 */
function handleDoctorChange() {
    currentDoctor = navDoctorDropdown.value;
    localStorage.setItem('currentDoctor', currentDoctor);

    // If we are on the billing tab, reload the files for the new doctor
    if (billingView.classList.contains('active')) {
        loadBillingFiles();
    }
}
