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
//
// *** FIX ***
// Changed all top-level 'const' and 'let' to 'var' to make them
// globally accessible to other scripts (like events.js).
// 'const' is script-scoped, 'var' is globally-scoped.
//
var getEl = (id) => document.getElementById(id);

// --- Tab View Elements ---
var tabClinicalNoteBtn = getEl('tab-clinical-note');
var tabManualBillingBtn = getEl('tab-manual-billing');
var tabBillingBtn = getEl('tab-billing');
var tabSettingsBtn = getEl('tab-settings');
var entryView = getEl('entry-view');
var billingView = getEl('billing-view');
var settingsView = getEl('settings-view');

// --- Nav Bar Mode Elements ---
// FIX: Removed old mode buttons
var navDoctorDropdownContainer = getEl('nav-doctor-dropdown-container');
var navDoctorDropdown = getEl('nav-doctor-dropdown');
var appTitle = getEl('app-title');
var pmModeToggle = getEl('pm-mode-toggle'); // <-- FIX: Added toggle switch
var pmModeToggleLabel = getEl('pm-mode-toggle-label'); // <-- FIX: Added toggle label

// --- Entry View Elements ---
var entryFormContainer = getEl('entry-form-container'); // Container for billing-only mode
var entryViewHeaderTitle = getEl('entry-view-header-title'); // <-- FIX: Added header title
var entryViewSubtitle = getEl('entry-view-subtitle');
var finalDefectSizeContainer = getEl('final-defect-size-container');
var fullClinicalFieldsContainer = getEl('full-clinical-fields');

var lesionForm = getEl('lesion-form');
var procedureTypeEl = getEl('procedureType');
var dynamicOptionsContainer = getEl('dynamic-options-container');
var entryGridContainer = getEl('entry-grid-container'); // <-- FIX: Added this ID
var addLesionBtn = getEl('add-lesion-btn');
var cancelEditBtn = getEl('cancel-edit-btn');

var patientNameEl = getEl('patientName');
// doctorCodeEl is now navDoctorDropdown
var saveProcedureBtn = getEl('save-procedure-btn');
var clearProcedureBtn = getEl('clear-procedure-btn');
 
var lesionsListEl = getEl('lesions-list');
var lesionsListContainer = getEl('lesions-list-container'); // <-- FIX: Added this ID
var entryNoteOutputEl = getEl('entryNoteOutput');
var clinicalRequestOutputEl = getEl('clinicalRequestOutput');
var formTitle = getEl('form-title');
var clinicalRequestContainer = getEl('clinical-request-output-container');
var entryNoteContainer = getEl('entry-note-output-container');
var outputColumn = getEl('output-column'); // <-- FIX: Added this ID
var outputBtnCombined = getEl('output-btn-combined');
var outputBtnSeparate = getEl('output-btn-separate');
var outputStyleContainer = getEl('output-style-container'); // <-- FIX: Added this ID
 
// --- Billing View Elements ---
var billingViewContainer = getEl('billing-view-container');
var loadFilesBtn = getEl('load-files-btn');
var searchBar = getEl('search-bar');
var archiveSearch = getEl('archive-search'); // <-- FIX: This was missing
var printBilledListBtn = getEl('print-billed-list-btn');
var batchArchiveBtn = getEl('batch-archive-btn'); // <-- FIX: This was missing
var unprocessedSection = getEl('unprocessed-section');
var unprocessedHeader = getEl('unprocessed-header'); // <-- FIX: This was missing
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
var useDeepSutureEl = getEl('useDeepSuture');
var deepSutureContainer = getEl('deep-suture-container');
var useSkinSutureEl = getEl('useSkinSuture'); // <-- FIX: Added this new element
var skinSutureDetails = getEl('skin-suture-details');

// --- Entry Form Inputs ---
var anatomicalRegionEl = getEl('anatomicalRegion');
var excisionClosureTypeEl = getEl('excisionClosureType');
var punchTypeEl = getEl('punchType');
var skinSutureTypeEl = getEl('skinSutureType');
var deepSutureTypeEl = getEl('deepSutureType');
var skinSutureSizeEl = getEl('skinSutureSize');
var deepSutureSizeEl = getEl('deepSutureSize');
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
var pathologyContainer = getEl('pathology-container'); // <-- FIX: Added this ID
var pathologyCheckboxesEl = getEl('pathology-checkboxes');
var otherPathologyInput = getEl('otherPathologyInput');
var confirmPathologyBtn = getEl('confirmPathologyBtn');
var dermoscopyBtnContainer = getEl('dermoscopy-btn-container');

// --- PWA File System Elements ---
var saveFolderHandle = null; // This will store our main billing folder permission
var currentBillingFile = { handle: null, data: null, fromFolder: '', fromDoctor: '' }; // State for the open billing file

// --- State Management ---
var lesions = []; // This is now a temporary list for the current procedure
var lesionCounter = 0;
var editingLesionId = null;
var editingProcedureFile = null; // Store the original file data when editing
var modalSelectedLocationElement = null;
var allFiles = { unprocessed: [], billed: [], archive: [] }; // Global state for billing files
var appSettings = {}; // Holds ALL app settings
var isBillingOnlyMode = false;
var currentAppMode = 'Doctor'; // 'Doctor' or 'PM'
var currentDoctor = null; // The display name of the selected doctor

var pathologyOptions = {
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
// *** FIX: Make function global by attaching to window ***
window.switchTab = function(tabName) {
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
// *** FIX: Make function global by attaching to window ***
window.updateEntryModeUI = function() {
    entryFormContainer.classList.toggle('billing-only-mode', isBillingOnlyMode);
    if (isBillingOnlyMode) {
        entryViewHeaderTitle.textContent = 'Add Manual Billing'; // <-- FIX: Change title
        entryViewSubtitle.textContent = 'Part 1: Enter minimal billing data for a procedure performed previously.';
        // --- FIX: Hide output column and set grid to 1 column ---
        outputColumn.style.display = 'block'; // <-- FIX: Keep column visible
        entryGridContainer.classList.remove('lg:grid-cols-1');
        entryGridContainer.classList.add('lg:grid-cols-2'); // <-- FIX: Keep 2 columns
        
        // --- FIX: Selectively hide elements ---
        lesionsListContainer.style.display = 'block';
        clinicalRequestContainer.style.display = 'none'; // <-- FIX: Hide Clinical Request
        entryNoteContainer.style.display = 'none';
        outputStyleContainer.style.display = 'none';

    } else {
        entryViewHeaderTitle.textContent = 'Clinical Note Generator'; // <-- FIX: Change title
        entryViewSubtitle.textContent = 'Part 1: Enter full clinical data and generate the operation note.';
        // --- FIX: Show output column and set grid to 2 columns ---
        outputColumn.style.display = 'block';
        entryGridContainer.classList.remove('lg:grid-cols-1');
        entryGridContainer.classList.add('lg:grid-cols-2');

        // --- FIX: Selectively show elements ---
        lesionsListContainer.style.display = 'block';
        outputStyleContainer.style.display = 'flex';
        // Let updateOutputVisibility() handle note/request boxes
        updateOutputVisibility(); 
    }
    // Re-run form logic to show/hide correct fields
    updateFormUI();
}

/**
 * Sets the app mode to 'Doctor' or 'PM'
 * @param {string} mode - The mode to switch to ('Doctor' or 'PM')
 */
// *** FIX: Make function global by attaching to window ***
window.setAppMode = function(mode) {
    currentAppMode = mode;
    localStorage.setItem('appMode', mode);

    // Show/hide entry tabs based on mode
    const isPM = (mode === 'PM');
    tabClinicalNoteBtn.style.display = isPM ? 'none' : 'inline-block';
    tabManualBillingBtn.style.display = isPM ? 'none' : 'inline-block';

    // --- FIX: Update UI based on new toggle switch ---
    if (isPM) {
        pmModeToggle.checked = true; // Sync toggle
        navDoctorDropdownContainer.classList.add('hidden'); // Hide dropdown in PM mode
        appTitle.textContent = "Billing & Processing (PM View)";
        currentDoctor = null; // PM is not a doctor

        // If PM mode is set while on an entry tab, force switch to billing
        if (entryView.classList.contains('active')) {
            switchTab('billing');
        }

    } else { // Doctor mode
        pmModeToggle.checked = false; // Sync toggle
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
// *** FIX: Make function global by attaching to window ***
window.populateDoctorDropdown = function(doctors) {
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
// *** FIX: Make function global by attaching to window ***
window.handleDoctorChange = function() {
    currentDoctor = navDoctorDropdown.value;
    localStorage.setItem('currentDoctor', currentDoctor);

    // If we are on the billing tab, reload the files for the new doctor
    if (billingView.classList.contains('active')) {
        loadBillingFiles();
    }
}
