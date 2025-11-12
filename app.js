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
var getEl = (id) => document.getElementById(id);

// --- Tab View Elements ---
var tabClinicalNoteBtn = getEl('tab-clinical-note');
var tabManualBillingBtn = getEl('tab-manual-billing');
var tabBillingBtn = getEl('tab-billing');
var tabSettingsBtn = getEl('tab-settings'); // This is now the cogwheel
var entryView = getEl('entry-view');
var billingView = getEl('billing-view');
var settingsView = getEl('settings-view');

// --- Nav Bar Mode Elements ---
var pmModeToggleSettings = getEl('pm-mode-toggle-settings'); // NEW: Toggle on settings page
var navDoctorDropdownContainer = getEl('nav-doctor-dropdown-container');
var navDoctorDropdown = getEl('nav-doctor-dropdown');
var appTitle = getEl('app-title');

// --- Entry View Elements ---
var entryFormContainer = getEl('entry-form-container');
var entryViewHeaderTitle = getEl('entry-view-header-title'); 
var entryViewSubtitle = getEl('entry-view-subtitle');
var procedureDateContainer = getEl('procedure-date-container'); 
var finalDefectSizeContainer = getEl('final-defect-size-container');
var fullClinicalFieldsContainer = getEl('full-clinical-fields');
var pathologyContainer = getEl('pathology-container'); 
var clinicalAuditFields = getEl('clinical-audit-fields'); 

var lesionForm = getEl('lesion-form');
var procedureTypeEl = getEl('procedureType');
var dynamicOptionsContainer = getEl('dynamic-options-container');
var addLesionBtn = getEl('add-lesion-btn');
var cancelEditBtn = getEl('cancel-edit-btn');

var patientNameEl = getEl('patientName');
var patientDOBEl = getEl('patientDOB'); // <-- ADDED
var saveProcedureBtn = getEl('save-procedure-btn');
var clearProcedureBtn = getEl('clear-procedure-btn');

// --- Entry View Right Column Elements ---
var recordedLesionsWrapper = getEl('recorded-lesions-wrapper'); 
var lesionsListEl = getEl('lesions-list');
var outputStyleBtnContainer = getEl('output-style-btn-container'); 
var clinicalRequestWrapper = getEl('clinical-request-wrapper'); 
var generatedNoteWrapper = getEl('generated-note-wrapper'); 
var entryNoteOutputEl = getEl('entryNoteOutput');
var clinicalRequestOutputEl = getEl('clinicalRequestOutput');
var formTitle = getEl('form-title');
var outputBtnCombined = getEl('output-btn-combined');
var outputBtnSeparate = getEl('output-btn-separate');

// --- Billing View Elements ---
var billingViewContainer = getEl('billing-view-container');
var loadFilesBtn = getEl('load-files-btn');
var searchBar = getEl('search-bar');
var archiveSearch = getEl('archive-search'); 
var printBilledListBtn = getEl('print-billed-list-btn');
var unprocessedSection = getEl('unprocessed-section');
var unprocessedHeader = getEl('unprocessed-header'); 
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
var batchArchiveBtn = getEl('batch-archive-btn'); 
var selectAllBtn = getEl('select-all-btn'); // <-- ADDED
 
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
var sendBackBtn = getEl('send-back-btn'); // <-- ADDED

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
var useSkinSutureEl = getEl('useSkinSuture'); 
var skinSutureDetails = getEl('skin-suture-details');
var skinSutureRemovalContainer = getEl('skin-suture-removal-container'); 

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
 * Checks if there is unsaved data in the entry form.
 * @returns {boolean} True if there is unsaved data.
 */
window.hasUnsavedChanges = function() {
    // Check for patient name, a partially entered lesion, or any added lesions
    return (patientNameEl.value.trim() !== '' || procedureTypeEl.value !== '' || lesions.length > 0);
}

/**
 * Central function to safely perform an action, like switching tabs or mode.
 * It will check for unsaved changes and ask for confirmation if needed.
 * @param {function} actionToPerform - The function to call if it's safe (e.g., () => switchTab('billing'))
 */
window.performSafeAction = function(actionToPerform) {
    if (hasUnsavedChanges()) {
        if (confirm("You have unsaved changes. Are you sure you want to proceed? Your current form data will be lost.")) {
            resetAll(false); // Pass false to skip confirmation
            actionToPerform();
        } else {
            // User cancelled, do nothing.
            // If it was the PM mode toggle, we need to revert it.
            if (pmModeToggleSettings.checked && currentAppMode === 'Doctor') pmModeToggleSettings.checked = false;
            if (!pmModeToggleSettings.checked && currentAppMode === 'PM') pmModeToggleSettings.checked = true;
        }
    } else {
        // No unsaved data, just perform the action
        actionToPerform();
    }
}


/**
 * Switches the main view between Entry, Billing, and Settings
 * @param {string} tabName - The name of the tab to switch to
 */
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
        tabSettingsBtn.classList.add('active'); // Activate the cogwheel
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
window.updateEntryModeUI = function() {
    entryFormContainer.classList.toggle('billing-only-mode', isBillingOnlyMode);
    
    if (isBillingOnlyMode) {
        entryViewHeaderTitle.textContent = "Add Manual Billing";
        entryViewSubtitle.textContent = 'Enter minimal billing data for a procedure performed previously.';
        procedureDateContainer.style.display = 'block'; // Show date input
        
        // --- NEW LOGIC ---
        // Hide elements not needed for manual billing
        recordedLesionsWrapper.style.display = 'block'; // SHOW
        clinicalRequestWrapper.style.display = 'none'; // HIDE
        generatedNoteWrapper.style.display = 'none'; // HIDE
        outputStyleBtnContainer.style.display = 'none'; // HIDE
        
    } else {
        entryViewHeaderTitle.textContent = "Clinical Note Generator";
        entryViewSubtitle.textContent = 'Part 1: Enter full clinical data and generate the operation note.';
        procedureDateContainer.style.display = 'none'; // Hide date input
        
        // --- NEW LOGIC ---
        // Show all elements for clinical note
        recordedLesionsWrapper.style.display = 'block'; // SHOW
        clinicalRequestWrapper.style.display = 'block'; // SHOW
        generatedNoteWrapper.style.display = 'block'; // SHOW
        outputStyleBtnContainer.style.display = 'flex'; // SHOW
    }
    
    // Set today's date for manual billing default
    if (isBillingOnlyMode) {
        const today = new Date().toISOString().split('T')[0];
        getEl('procedureDate').value = today;
    }
    
    // Re-run form logic to show/hide correct fields
    updateFormUI();
}

/**
 * Sets the app mode to 'Doctor' or 'PM'
 * @param {string} mode - The mode to switch to ('Doctor' or 'PM')
 */
window.setAppMode = function(mode) {
    currentAppMode = mode;
    localStorage.setItem('appMode', mode);

    // Show/hide entry tabs based on mode
    const isPM = (mode === 'PM');
    tabClinicalNoteBtn.style.display = isPM ? 'none' : 'inline-block';
    tabManualBillingBtn.style.display = isPM ? 'none' : 'inline-block';
    
    // Update PM Mode Toggle on the settings page
    pmModeToggleSettings.checked = isPM;
    
    if (isPM) {
        navDoctorDropdownContainer.classList.add('hidden'); // Hide dropdown in PM mode
        appTitle.textContent = "SurgiFile (PM Mode)";
        currentDoctor = null; // PM is not a doctor

        // If PM mode is set while on an entry tab, force switch to billing
        if (entryView.classList.contains('active')) {
            switchTab('billing');
        }

    } else { // Doctor mode
        navDoctorDropdownContainer.classList.remove('hidden'); // Show dropdown
        appTitle.textContent = "SurgiFile";
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
window.populateDoctorDropdown = function(doctors) {
    const savedDoctor = localStorage.getItem('currentDoctor');
    navDoctorDropdown.innerHTML = ''; // Clear old options

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
window.handleDoctorChange = function() {
    const newDoctor = navDoctorDropdown.value;
    
    // --- NEW: Safety Check ---
    if (hasUnsavedChanges()) {
        if (!confirm("You have unsaved changes. Changing the doctor will clear the form. Are you sure?")) {
            navDoctorDropdown.value = currentDoctor; // Revert dropdown
            return;
        } else {
            resetAll(false); // Clear the form
        }
    }
    
    currentDoctor = newDoctor;
    localStorage.setItem('currentDoctor', currentDoctor);

    // If we are on the billing tab, reload the files for the new doctor
    if (billingView.classList.contains('active')) {
        loadBillingFiles();
    }
}
