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
const lesionForm = getEl('lesion-form');
const procedureTypeEl = getEl('procedureType');
const dynamicOptionsContainer = getEl('dynamic-options-container');
const addLesionBtn = getEl('add-lesion-btn');
const cancelEditBtn = getEl('cancel-edit-btn');
const patientNameEl = getEl('patientName');
const doctorCodeEl = getEl('doctorCode');
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
const copyRequestBtnText = getEl('copy-request-btn-text');
const copyNoteBtnText = getEl('copy-note-btn-text');

// --- Billing View Elements ---
const billingViewContainer = getEl('billing-view-container');
const appTitle = getEl('app-title');
const loadFilesBtn = getEl('load-files-btn');
const pmModeToggle = getEl('pm-mode-toggle');
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

// --- Entry Form Inputs ---
const excisionClosureTypeEl = getEl('excisionClosureType');
const punchTypeEl = getEl('punchType');
const skinSutureTypeEl = getEl('skinSutureType');
const deepSutureTypeEl = getEl('deepSutureType');
const skinSutureSizeEl = getEl('skinSutureSize');
const deepSutureSizeEl = getEl('deepSutureSize');
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
const setSaveFolderBtn = getEl('set-save-folder-btn');
const folderStatusMsg = getEl('folder-status-msg');
let saveFolderHandle = null; // This will store our main billing folder permission
let currentBillingFile = { handle: null, data: null, fromFolder: '' }; // State for the open billing file

// --- State Management ---
let lesions = []; // This is now a temporary list for the current procedure
let lesionCounter = 0;
let editingLesionId = null;
let modalSelectedLocationElement = null;
let allFiles = { unprocessed: [], billed: [], archive: [] }; // Global state for billing files
let appSettings = {}; // Holds ALL app settings
const pathologyOptions = {
    'BCC': 'Basal cell carcinoma', 'SCC': 'Squamous cell carcinoma', 'IEC': 'IEC/Bowen\'s disease',    
    'MMis': 'Melanoma in situ', 'MMinv': 'Melanoma invasive', 'DN': 'Naevus: dysplastic', 'BN': 'Naevus: banal',
    'SebK': 'Seborrhoeic keratosis', 'SK': 'Solar keratosis', 'KA': 'Keratoacanthoma', 'B Cyst': 'Benign cyst',
    'DF': 'Dermatofibroma', 'LPLK': 'Lichen planus-like keratosis', 'MCC': 'Merkel cell carcinoma',
    'OB': 'Other benign', 'OM': 'Other malignant', 'SGH': 'Sebaceous gland hyperplasia', 'SL': 'Solar lentigo',
    'HMF': 'Hutchinson\'s melanotic freckle', 'MMmet': 'Melanoma, metastasis', 'SN': 'Naevus: Spitz'
};


// --- Tab Navigation ---
tabEntryBtn.addEventListener('click', () => switchTab('entry'));
tabBillingBtn.addEventListener('click', () => switchTab('billing'));
tabSettingsBtn.addEventListener('click', () => switchTab('settings'));

/**
 * Switches the main view between the three application tabs.
 * @param {string} tabName - 'entry', 'billing', or 'settings'
 */
function switchTab(tabName) {
    [tabEntryBtn, tabBillingBtn, tabSettingsBtn].forEach(btn => btn.classList.remove('active'));
    [entryView, billingView, settingsView].forEach(view => view.classList.remove('active'));

    if (tabName === 'entry') {
        tabEntryBtn.classList.add('active');
        entryView.classList.add('active');
    } else if (tabName === 'billing') {
        tabBillingBtn.classList.add('active');
        billingView.classList.add('active');
        loadBillingFiles(); // Load files when switching to this tab
    } else if (tabName === 'settings') {
        tabSettingsBtn.classList.add('active');
        settingsView.classList.add('active');
        loadAppSettingsToEditor();
    }
}

// --- INIT ---
document.addEventListener('DOMContentLoaded', () => {
    // --- Load Settings First ---
    // This synchronously loads settings from localStorage and populates
    // suture dropdowns, making them ready before any other script runs.
    loadAppSettings(); 
    
    // --- Load Saved Folder Handle ---
    // This is asynchronous, but dbGet() has a built-in retry
    // mechanism to wait for the DB to be ready.
    loadSavedFolder();
    
    // --- Load Doctor Code ---
    const savedDoctorCode = localStorage.getItem('doctorCode');
    if (savedDoctorCode) {
        doctorCodeEl.value = savedDoctorCode;
    }
    doctorCodeEl.addEventListener('input', () => {
        localStorage.setItem('doctorCode', doctorCodeEl.value.trim());
    });

    // --- Populate Pathology Modal ---
    Object.entries(pathologyOptions).forEach(([key, value]) => {
        const label = document.createElement('label');
        label.className = 'flex items-center space-x-2';
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

    // --- Draw UI Components ---
    drawClock();

    // --- Set Initial UI States ---
    updateOutputVisibility();
    updateFormUI();
    formTitle.textContent = `Enter Lesion ${lesionCounter + 1} Details`; // Set initial lesion counter title

    // --- Attach Entry View Listeners ---
    lesionForm.addEventListener('change', updateFormUI);
    lesionForm.addEventListener('input', checkLesionFormCompleteness);
    addLesionBtn.addEventListener('click', addOrUpdateLesion);
    cancelEditBtn.addEventListener('click', cancelEdit);
    saveProcedureBtn.addEventListener('click', saveProcedure);
    clearProcedureBtn.addEventListener('click', resetAll);
    getEl('copy-request-btn').addEventListener('click', () => copyToClipboard('clinicalRequestOutput', copyRequestBtnText));
    getEl('copy-note-btn').addEventListener('click', () => copyToClipboard('entryNoteOutput', copyNoteBtnText));
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

    // --- Attach Billing View Listeners ---
    setSaveFolderBtn.addEventListener('click', setSaveFolder);
    loadFilesBtn.addEventListener('click', loadBillingFiles);
    pmModeToggle.addEventListener('change', togglePMMode);
    searchBar.addEventListener('input', () => renderFileLists()); // Re-render on search
    printBilledListBtn.addEventListener('click', printBilledList);
    closeBillingPanelBtn.addEventListener('click', () => billingPanel.classList.add('hidden'));
    saveAsBilledBtn.addEventListener('click', saveBilledFile);
    deleteProcedureBtn.addEventListener('click', deleteBillingFile);
    moveToArchiveBtn.addEventListener('click', archiveBilledFile);

    // --- Attach Settings View Listeners ---
    saveAppSettingsBtn.addEventListener('click', saveAppSettings);
    resetAppSettingsBtn.addEventListener('click', resetAppSettings);
});
