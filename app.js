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

// --- NEW: Custom Alert/Confirm Modal Elements ---
var appAlertModal = getEl('appAlertModal');
var appAlertTitle = getEl('appAlertTitle');
var appAlertMessage = getEl('appAlertMessage');
var appAlertIconContainer = getEl('appAlertIconContainer');
var appAlertOkBtn = getEl('appAlertOkBtn');

var appConfirmModal = getEl('appConfirmModal');
var appConfirmTitle = getEl('appConfirmTitle');
var appConfirmMessage = getEl('appConfirmMessage');
var appConfirmIconContainer = getEl('appConfirmIconContainer');
var appConfirmCancelBtn = getEl('appConfirmCancelBtn');
var appConfirmOkBtn = getEl('appConfirmOkBtn');
// --- End New Modal Elements ---

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
var selectAllBtn = getEl('select-all-btn'); 
 
var billingPanel = getEl('billing-panel');
var billingPanelTitle = getEl('billing-panel-title');
var billingAssistantLesions = getEl('billing-assistant-lesions');
var billingConsultItem = getEl('billing-consult-item');
var noConsultBtn = getEl('no-consult-btn'); // <-- ENSURED THIS IS HERE
var billingComment = getEl('billing-comment');
var closeBillingPanelBtn = getEl('close-billing-panel-btn');
var doctorActions = getEl('billing-panel-doctor-actions');
var pmActions = getEl('billing-panel-pm-actions');
var saveAsBilledBtn = getEl('save-as-billed-btn');
var deleteProcedureBtn = getEl('delete-procedure-btn');
var moveToArchiveBtn = getEl('move-to-archive-btn');
var editProcedureBtn = getEl('edit-procedure-btn');
var sendBackBtn = getEl('send-back-btn');

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

// --- NEW: Custom Alert/Confirm Logic ---
let confirmPromise = {
    resolve: null,
};

const ICONS = {
    info: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" class="text-blue-500" viewBox="0 0 16 16"><path d="M8 16A8 8 0 1 0 8 0a8 8 0 0 0 0 16zm.93-9.412-1 4.705c-.07.34.029.533.304.533.194 0 .487-.07.686-.246l.208-.188c.196-.17.307-.397.477-.632l.5-1.027l.131-.273c.09-.176.152-.335.195-.44l.01-.025c.03-.06.05-.113.065-.166.015-.05.025-.101.03-.15.005-.05.007-.1.007-.15l-.001-.07a.996.996 0 0 0-.01-.07L10.02 7.02c-.01-.06-.02-.12-.03-.18c-.01-.06-.025-.12-.045-.18s-.04-.12-.06-.18c-.02-.06-.045-.12-.07-.18c-.025-.06-.055-.12-.09-.18c-.035-.06-.075-.12-.12-.18c-.045-.06-.1-.12-.15-.18c-.05-.06-.11-.12-.17-.18s-.125-.11-.19-.16c-.065-.05-.13-.09-.2-.13c-.07-.04-.14-.07-.21-.1s-.15-.05-.22-.06c-.07-.01-.15-.01-.22-.01s-.15 0-.22.01c-.07.01-.14.02-.21.04s-.13.05-.2.07c-.06.02-.12.05-.19.08s-.12.07-.17.11c-.05.04-.1.08-.15.13s-.09.11-.13.17c-.04.06-.08.12-.11.19c-.03.06-.06.12-.08.19c-.02.06-.04.12-.05.19s-.02.13-.03.19c-.01.06-.01.12-.01.19s0 .13.01.19c.01.06.01.12.02.18l.02.13c.01.06.03.12.05.18l.04.14c.02.06.04.12.07.18l.06.14c.02.06.05.12.08.18l.09.15c.03.06.07.12.11.18l.13.15c.04.06.09.11.15.17l.17.15c.05.04.11.08.17.12l.2.13c.07.04.14.07.22.1c.07.03.15.05.22.06c.07.01.15.01.22.01s.15 0 .22-.01c.07-.01.15-.02.22-.04c.07-.02.14-.04.2-.07c.06-.02.12-.05.18-.08c.06-.03.12-.07.17-.11l.15-.12c.05-.04.1-.09.14-.14l.l3-.15c.04-.05.07-.11.1-.17l.08-.14c.02-.06.04-.12.06-.19l.05-.15c.01-.06.02-.12.03-.18l.02-.15c.01-.06.01-.12.01-.18V8.98l-.007-.07a.5.5 0 0 0-.03-.19z"/></svg>',
    warning: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" class="text-amber-500" viewBox="0 0 16 16"><path d="M8 16A8 8 0 1 0 8 0a8 8 0 0 0 0 16zM8 4a.905.905 0 0 1 .9.995l-.35 3.507a.552.552 0 0 1-1.1 0L7.1 4.995A.905.905 0 0 1 8 4zm.002 6a1 1 0 1 1 0 2 1 1 0 0 1 0-2z"/></svg>',
    error: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" class="text-red-600" viewBox="0 0 16 16"><path d="M16 8A8 8 0 1 1 0 8a8 8 0 0 1 16 0zM5.354 4.646a.5.5 0 1 0-.708.708L7.293 8l-2.647 2.646a.5.5 0 0 0 .708.708L8 8.707l2.646 2.647a.5.5 0 0 0 .708-.708L8.707 8l2.647-2.646a.5.5 0 0 0-.708-.708L8 7.293 5.354 4.646z"/></svg>',
    success: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" class="text-green-500" viewBox="0 0 16 16"><path d="M16 8A8 8 0 1 1 0 8a8 8 0 0 1 16 0zm-3.97-3.03a.75.75 0 0 0-1.08.022L7.477 9.417 5.384 7.323a.75.75 0 0 0-1.06 1.06L6.97 11.03a.75.75 0 0 0 1.079-.02l3.992-4.99a.75.75 0 0 0-.01-1.05z"/></svg>'
};

/**
 * Shows a custom alert modal.
 * @param {string} message - The message to display.
 * @param {string} [type='info'] - 'info', 'success', 'warning', or 'error'.
 * e.g., showAppAlert("File saved successfully.", "success");
 * e.g., showAppAlert("Please fill all required fields.", "error");
 */
window.showAppAlert = function(message, type = 'info') {
    let title;
    let icon = ICONS[type] || ICONS.info;
    let buttonClass;

    switch(type) {
        case 'error':
            title = 'Error';
            buttonClass = 'bg-red-600 hover:bg-red-700';
            break;
        case 'success':
            title = 'Success';
            buttonClass = 'bg-green-600 hover:bg-green-700';
            break;
        case 'warning':
            title = 'Warning';
            buttonClass = 'bg-amber-500 hover:bg-amber-600';
            break;
        case 'info':
        default:
            title = 'Information';
            buttonClass = 'bg-blue-600 hover:bg-blue-700';
            break;
    }

    appAlertTitle.textContent = title;
    appAlertMessage.textContent = message;
    appAlertIconContainer.innerHTML = icon;
    
    appAlertOkBtn.className = `font-bold py-2 px-5 rounded-lg text-white ${buttonClass}`;
    
    appAlertModal.classList.remove('hidden');
    appAlertOkBtn.focus();
}

/**
 * Shows a custom confirmation modal and returns a promise.
 * @param {string} message - The question to ask.
 * @param {string} [type='warning'] - 'warning' (red btn) or 'info' (blue btn).
 * @returns {Promise<boolean>} True if confirmed, false if cancelled.
 * e.g., if (await showAppConfirm("Are you sure you want to delete this?", "warning")) { ... }
 */
window.showAppConfirm = function(message, type = 'warning') {
    let title = 'Please Confirm';
    let icon = ICONS.warning;
    let confirmButtonClass = 'bg-red-600 hover:bg-red-700';

    if (type === 'info') {
        title = 'Confirmation';
        icon = ICONS.info;
        confirmButtonClass = 'bg-blue-600 hover:bg-blue-700';
    }
    
    appConfirmTitle.textContent = title;
    appConfirmMessage.textContent = message;
    appConfirmIconContainer.innerHTML = icon;
    
    appConfirmOkBtn.className = `font-bold py-2 px-4 rounded-lg text-white ${confirmButtonClass}`;

    appConfirmModal.classList.remove('hidden');
    appConfirmCancelBtn.focus();

    return new Promise((resolve, reject) => {
        // Store the resolver function so the button click handlers can call it
        confirmPromise.resolve = resolve;
    });
}

function handleAlertOk() {
    appAlertModal.classList.add('hidden');
}

function handleConfirm(result) {
    appConfirmModal.classList.add('hidden');
    if (confirmPromise.resolve) {
        confirmPromise.resolve(result);
    }
    confirmPromise.resolve = null; // Clear promise
}

// Attach listeners to new modal buttons
if(appAlertOkBtn) appAlertOkBtn.addEventListener('click', handleAlertOk);
if(appConfirmCancelBtn) appConfirmCancelBtn.addEventListener('click', () => handleConfirm(false));
if(appConfirmOkBtn) appConfirmOkBtn.addEventListener('click', () => handleConfirm(true));

// --- End Custom Alert/Confirm Logic ---


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
window.performSafeAction = async function(actionToPerform) {
    if (hasUnsavedChanges()) {
        if (await showAppConfirm("You have unsaved changes. Are you sure you want to proceed? Your current form data will be lost.", "warning")) {
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
        // FIX: Check if function exists before calling, as it loads in a later script
        if (typeof loadAppSettingsToEditor === 'function') {
            loadAppSettingsToEditor();
        }
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
window.handleDoctorChange = async function() {
    const newDoctor = navDoctorDropdown.value;
    
    // --- NEW: Safety Check ---
    if (hasUnsavedChanges()) {
        if (await showAppConfirm("You have unsaved changes. Changing the doctor will clear the form. Are you sure?", "warning")) {
            resetAll(false); // Clear the form
        } else {
            navDoctorDropdown.value = currentDoctor; // Revert dropdown
            return;
        }
    }
    
    currentDoctor = newDoctor;
    localStorage.setItem('currentDoctor', currentDoctor);

    // If we are on the billing tab, reload the files for the new doctor
    if (billingView.classList.contains('active')) {
        loadBillingFiles();
    }
}
