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

// --- DOM Element References (GLOBAL) ---
// Defined at top level so they are accessible to other views (billing-view.js, etc.)
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
var pmModeToggleSettings = getEl('pm-mode-toggle-settings'); 
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
var patientDOBEl = getEl('patientDOB'); 
var saveProcedureBtn = getEl('save-procedure-btn');
var clearProcedureBtn = getEl('clear-procedure-btn');

// --- Custom Alert/Confirm Modal Elements ---
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
var printUnprocessedListBtn = getEl('print-unprocessed-list-btn');
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
var billingConsultLabel = getEl('billing-consult-label'); // Label ref
var consultToggle = getEl('consult-toggle'); // Toggle ref
var consultToggleContainer = getEl('consult-toggle-container'); // Container ref
var consultDisabledMsg = getEl('consult-disabled-msg'); 
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
var saveFolderHandle = null; 
var currentBillingFile = { handle: null, data: null, fromFolder: '', fromDoctor: '' };

// --- State Management ---
var lesions = []; 
var lesionCounter = 0;
var editingLesionId = null;
var editingProcedureFile = null; 
var modalSelectedLocationElement = null;
var allFiles = { unprocessed: [], billed: [], archive: [] }; 
var appSettings = {}; 
var isBillingOnlyMode = false;
var currentAppMode = 'Doctor'; 
var currentDoctor = null; 

var pathologyOptions = {
    'BCC': 'Basal cell carcinoma', 'SCC': 'Squamous cell carcinoma', 'IEC': 'IEC/Bowen\'s disease',
    'MMis': 'Melanoma in situ', 'MMinv': 'Melanoma invasive', 'DN': 'Naevus: dysplastic', 'BN': 'Naevus: banal',
    'SebK': 'Seborrhoeic keratosis', 'SK': 'Solar keratosis', 'KA': 'Keratoacanthoma', 'B Cyst': 'Benign cyst',
    'DF': 'Dermatofibroma', 'LPLK': 'Lichen planus-like keratosis', 'MCC': 'Merkel cell carcinoma',
    'OB': 'Other benign', 'OM': 'Other malignant', 'SGH': 'Sebaceous gland hyperplasia', 'SL': 'Solar lentigo',
    'HMF': 'Hutchinson\'s melanotic freckle', 'MMmet': 'Melanoma, metastasis', 'SN': 'Naevus: Spitz'
};


// --- CORE APP LOGIC ---

// --- Date Formatting Helper (Australian Standard) ---
window.formatDateToAU = function(dateInput) {
    if (!dateInput) return '';
    if (typeof dateInput === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateInput)) {
        const parts = dateInput.split('-');
        return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return dateInput; 
    return new Intl.DateTimeFormat('en-AU', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    }).format(d);
}

// --- Custom Alert/Confirm Logic ---
let confirmPromise = {
    resolve: null,
};

let alertTimeout = null; 

const ICONS = {
    info: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" class="text-blue-500" viewBox="0 0 16 16"><path d="M8 16A8 8 0 1 0 8 0a8 8 0 0 0 0 16zm.93-9.412-1 4.705c-.07.34.029.533.304.533.194 0 .487-.07.686-.246l.208-.188c.196-.17.307-.397.477-.632l.5-1.027l.131-.273c.09-.176.152-.335.195-.44l.01-.025c.03-.06.05-.113.065-.166.015-.05.025-.101.03-.15.005-.05.007-.1.007-.15l-.001-.07a.996.996 0 0 0-.01-.07L10.02 7.02c-.01-.06-.02-.12-.03-.18c-.01-.06-.025-.12-.045-.18s-.04-.12-.06-.18c-.02-.06-.045-.12-.07-.18c-.025-.06-.055-.12-.09-.18c-.035-.06-.075-.12-.12-.18c-.045-.06-.1-.12-.15-.18c-.05-.06-.11-.12-.17-.18s-.125-.11-.19-.16c-.065-.05-.13-.09-.2-.13c-.07-.04-.14-.07-.21-.1s-.15-.05-.22-.06c-.07-.01-.15-.01-.22-.01s-.15 0-.22.01c-.07.01-.14.02-.21.04s-.13.05-.2.07c-.06.02-.12.05-.19.08s-.12.07-.17.11c-.05.04-.1.08-.15.13s-.09.11-.13.17c-.04.06-.08.12-.11.19c-.03.06-.06.12-.08.19c-.02.06-.04.12-.05.19s-.02.13-.03.19c-.01.06-.01.12-.01.19s0 .13.01.19c.01.06.01.12.02.18l.02.13c.01.06.03.12.05.18l.04.14c.02.06.04.12.07.18l.06.14c.02.06.05.12.08.18l.09.15c.03.06.07.12.11.18l.13.15c.04.06.09.11.15.17l.17.15c.05.04.11.08.17.12l.2.13c.07.04.14.07.22.1c.07.03.15.05.22.06c.07.01.15.01.22.01s.15 0 .22-.01c.07-.01.15-.02.22-.04c.07-.02.14-.04.2-.07c.06-.02.12-.05.18-.08c.06-.03.12-.07.17-.11l.15-.12c.05-.04.1-.09.14-.14l.l3-.15c.04-.05.07-.11.1-.17l.08-.14c.02-.06.04-.12.06-.19l.05-.15c.01-.06.02-.12.03-.18l.02-.15c.01-.06.01-.12.01-.18V8.98l-.007-.07a.5.5 0 0 0-.03-.19z"/></svg>',
    warning: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" class="text-amber-500" viewBox="0 0 16 16"><path d="M8 16A8 8 0 1 0 8 0a8 8 0 0 0 0 16zM8 4a.905.905 0 0 1 .9.995l-.35 3.507a.552.552 0 0 1-1.1 0L7.1 4.995A.905.905 0 0 1 8 4zm.002 6a1 1 0 1 1 0 2 1 1 0 0 1 0-2z"/></svg>',
    error: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" class="text-red-600" viewBox="0 0 16 16"><path d="M16 8A8 8 0 1 1 0 8a8 8 0 0 1 16 0zM5.354 4.646a.5.5 0 1 0-.708.708L7.293 8l-2.647 2.646a.5.5 0 0 0 .708.708L8 8.707l2.646 2.647a.5.5 0 0 0 .708-.708L8.707 8l2.647-2.646a.5.5 0 0 0-.708-.708L8 7.293 5.354 4.646z"/></svg>',
    success: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" class="text-green-500" viewBox="0 0 16 16"><path d="M16 8A8 8 0 1 1 0 8a8 8 0 0 1 16 0zm-3.97-3.03a.75.75 0 0 0-1.08.022L7.477 9.417 5.384 7.323a.75.75 0 0 0-1.06 1.06L6.97 11.03a.75.75 0 0 0 1.079-.02l3.992-4.99a.75.75 0 0 0-.01-1.05z"/></svg>'
};

window.showAppAlert = function(message, type = 'info') {
    if (!appAlertModal) return;

    let title;
    let icon = ICONS[type] || ICONS.info;
    let borderClass;

    switch(type) {
        case 'error': title = 'Error'; borderClass = 'border-red-500'; break;
        case 'success': title = 'Success'; borderClass = 'border-green-500'; break;
        case 'warning': title = 'Warning'; borderClass = 'border-amber-500'; break;
        case 'info': default: title = 'Information'; borderClass = 'border-blue-500'; break;
    }

    appAlertTitle.textContent = title;
    appAlertMessage.textContent = message;
    appAlertIconContainer.innerHTML = icon;
    
    const contentDiv = getEl('appAlertContent');
    if (contentDiv) {
        contentDiv.className = `max-w-sm bg-white p-4 rounded-xl shadow-2xl border-l-4 flex items-start gap-3 ${borderClass}`;
    }
    
    if (alertTimeout) clearTimeout(alertTimeout);

    appAlertModal.classList.remove('hidden');
    setTimeout(() => { appAlertModal.classList.remove('opacity-0'); }, 10);
    alertTimeout = setTimeout(() => { handleAlertOk(); }, 3000);
}

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
        confirmPromise.resolve = resolve;
    });
}

function handleAlertOk() {
    appAlertModal.classList.add('opacity-0');
    setTimeout(() => { appAlertModal.classList.add('hidden'); }, 500); 
}

function handleConfirm(result) {
    appConfirmModal.classList.add('hidden');
    if (confirmPromise.resolve) {
        confirmPromise.resolve(result);
    }
    confirmPromise.resolve = null; 
}

if(appAlertOkBtn) appAlertOkBtn.addEventListener('click', handleAlertOk);
if(appConfirmCancelBtn) appConfirmCancelBtn.addEventListener('click', () => handleConfirm(false));
if(appConfirmOkBtn) appConfirmOkBtn.addEventListener('click', () => handleConfirm(true));

// --- Logic for Unsaved Changes ---
window.hasUnsavedChanges = function() {
    return (patientNameEl.value.trim() !== '' || procedureTypeEl.value !== '' || lesions.length > 0);
}

window.performSafeAction = async function(actionToPerform) {
    if (hasUnsavedChanges()) {
        if (await showAppConfirm("You have unsaved changes. Are you sure you want to proceed? Your current form data will be lost.", "warning")) {
            resetAll(false); 
            actionToPerform();
        } else {
            if (pmModeToggleSettings.checked && currentAppMode === 'Doctor') pmModeToggleSettings.checked = false;
            if (!pmModeToggleSettings.checked && currentAppMode === 'PM') pmModeToggleSettings.checked = true;
        }
    } else {
        actionToPerform();
    }
}

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
        if (typeof loadAppSettingsToEditor === 'function') {
            loadAppSettingsToEditor();
        }
    }

    if (tabName === 'clinical-note' || tabName === 'manual-billing') {
        updateEntryModeUI();
    }
}

window.updateEntryModeUI = function() {
    entryFormContainer.classList.toggle('billing-only-mode', isBillingOnlyMode);
    
    if (isBillingOnlyMode) {
        entryViewHeaderTitle.textContent = "Add Manual Billing";
        entryViewSubtitle.textContent = 'Enter minimal billing data for a procedure performed previously.';
        procedureDateContainer.style.display = 'block'; 
        
        recordedLesionsWrapper.style.display = 'block'; 
        clinicalRequestWrapper.style.display = 'none'; 
        generatedNoteWrapper.style.display = 'none'; 
        outputStyleBtnContainer.style.display = 'none'; 
        
    } else {
        entryViewHeaderTitle.textContent = "Clinical Note Generator";
        entryViewSubtitle.textContent = 'Part 1: Enter full clinical data and generate the operation note.';
        procedureDateContainer.style.display = 'none'; 
        
        recordedLesionsWrapper.style.display = 'block'; 
        clinicalRequestWrapper.style.display = 'block'; 
        generatedNoteWrapper.style.display = 'block'; 
        outputStyleBtnContainer.style.display = 'flex'; 
    }
    
    if (isBillingOnlyMode) {
        const today = new Date().toISOString().split('T')[0];
        getEl('procedureDate').value = today;
    }
    
    updateFormUI();
}

window.setAppMode = function(mode) {
    currentAppMode = mode;
    localStorage.setItem('appMode', mode);

    const isPM = (mode === 'PM');
    tabClinicalNoteBtn.style.display = isPM ? 'none' : 'inline-block';
    tabManualBillingBtn.style.display = isPM ? 'none' : 'inline-block';
    
    pmModeToggleSettings.checked = isPM;
    
    if (isPM) {
        navDoctorDropdownContainer.classList.add('hidden'); 
        appTitle.textContent = "SurgiFile (PM Mode)";
        currentDoctor = null; 

        if (entryView.classList.contains('active')) {
            switchTab('billing');
        }

    } else { 
        navDoctorDropdownContainer.classList.remove('hidden'); 
        appTitle.textContent = "SurgiFile";
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

window.handleDoctorChange = async function() {
    const newDoctor = navDoctorDropdown.value;
    
    if (hasUnsavedChanges()) {
        if (await showAppConfirm("You have unsaved changes. Changing the doctor will clear the form. Are you sure?", "warning")) {
            resetAll(false); 
        } else {
            navDoctorDropdown.value = currentDoctor; 
            return;
        }
    }
    
    currentDoctor = newDoctor;
    localStorage.setItem('currentDoctor', currentDoctor);

    if (billingView.classList.contains('active')) {
        loadBillingFiles();
    }
}

// --- INITIALIZATION LISTENER (IMPORTANT: WRAPPED) ---
document.addEventListener('DOMContentLoaded', () => {
    // 1. Load settings from localStorage (or defaults)
    if(typeof loadAppSettings === 'function') loadAppSettings(); 
    
    // 2. Populate modals with data from settings
    if(typeof populatePathologyModal === 'function') populatePathologyModal();
    if(typeof drawOrientationClock === 'function') drawOrientationClock();
    
    // 3. Restore saved app mode (Doctor/PM)
    const savedMode = localStorage.getItem('appMode') || 'Doctor';
    setAppMode(savedMode);
    
    // 4. Load saved folder handled by db.js, which waits for window.load
    
    // 5. Final UI setup
    updateOutputVisibility();
    updateFormUI();
    if(formTitle) formTitle.textContent = `Enter Lesion ${lesionCounter + 1} Details`;

    // 6. Check for Auto-Save Draft (New)
    setTimeout(() => {
        if (typeof window.checkForDraft === 'function') {
            window.checkForDraft();
        }
    }, 500);
});
