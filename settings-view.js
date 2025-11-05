// --- SETTINGS TAB LOGIC ---
// This file manages the "Settings" tab, including loading,
// saving, and resetting the application's configuration.

// 'appSettings' is defined in 'main.js'
// 'appSettingsEditor', 'saveAppSettingsBtn', 'resetAppSettingsBtn', 'appSettingsStatus'
// are also defined in 'main.js'

// The default settings are stored here in case local storage is empty or reset.
const defaultAppSettings = {
    "excisions": {
        "BCC/SCC": {
            "Option1": [
                { "maxSize": 6, "item": "31356", "desc": "BCC/SCC, Option 1, <6mm" },
                { "maxSize": 999, "item": "31358", "desc": "BCC/SCC, Option 1, >6mm" }
            ],
            "Option2": [
                { "maxSize": 14, "item": "31362", "desc": "BCC/SCC, Option 2, <14mm" },
                { "maxSize": 999, "item": "31364", "desc": "BCC/SCC, Option 2, >14mm" }
            ],
            "Option3": [
                { "maxSize": 15, "item": "31366", "desc": "BCC/SCC, Option 3, <15mm" },
                { "maxSize": 30, "item": "31368", "desc": "BCC/SCC, Option 3, 15-30mm" },
                { "maxSize": 999, "item": "31370", "desc": "BCC/SCC, Option 3, >30mm" }
            ]
        },
        "Melanoma": {
            "Option1": [
                { "maxSize": 6, "item": "31377", "desc": "Melanoma, Option 1, <6mm" },
                { "maxSize": 999, "item": "31378", "desc": "Melanoma, Option 1, >6mm" }
            ],
            "Option2": [
                { "maxSize": 14, "item": "31379", "desc": "Melanoma, Option 2, <14mm" },
                { "maxSize": 999, "item": "31380", "desc": "Melanoma, Option 2, >14mm" }
            ],
            "Option3": [
                { "maxSize": 15, "item": "31381", "desc": "Melanoma, Option 3, <15mm" },
                { "maxSize": 30, "item": "31382", "desc": "Melanoma, Option 3, 15-30mm" },
                { "maxSize": 999, "item": "31383", "desc": "Melanoma, Option 3, >30mm" }
            ]
        },
        "Non-Malignant": {
            "Option1": [
                { "maxSize": 6, "item": "31357", "desc": "Benign, Option 1, <6mm" },
                { "maxSize": 999, "item": "31360", "desc": "Benign, Option 1, >6mm" }
            ],
            "Option2": [
                { "maxSize": 14, "item": "31361", "desc": "Benign, Option 2, <14mm" },
                { "maxSize": 999, "item": "31363", "desc": "Benign, Option 2, >14mm" }
            ],
            "Option3": [
                { "maxSize": 15, "item": "31365", "desc": "Benign, Option 3, <15mm" },
                { "maxSize": 30, "item": "31367", "desc": "Benign, Option 3, 15-30mm" },
                { "maxSize": 999, "item": "31369", "desc": "Benign, Option 3, >30mm" }
            ]
        }
    },
    "biopsy": {
        "30071": { "item": "30071", "desc": "Biopsy - Skin" }
    },
    "repairs": [
        { "item": "45201", "desc": "Flap repair - standard", "clinicalType": "Flap Repair" },
        { "item": "45451", "desc": "Full thickness graft", "clinicalType": "Graft Repair" },
        { "item": "45440", "desc": "Split skin graft - Small", "clinicalType": "Graft Repair" },
        { "item": "45443", "desc": "Split skin graft - Large", "clinicalType": "Graft Repair" },
        { "item": "45202", "desc": "Flap repair - non-standard", "clinicalType": "Flap Repair" },
        { "item": "45665", "desc": "Wedge (Lip, Eyelid, Ear)", "clinicalType": "Ellipse" },
        { "item": "45207", "desc": "H-flap or double advancement", "clinicalType": "Flap Repair" }
    ],
    "sutures": {
        "deep": ["Vicryl", "Monocryl", "PDS II", "Monosyn"],
        "skin": ["Prolene", "Nylon", "Monocryl", "Monosyn", "PDS II"]
    }
};

/**
 * Loads the app settings from localStorage or sets the defaults.
 * This is called from main.js on startup.
 */
function loadAppSettings() {
    const savedSettings = localStorage.getItem('appSettings');
    if (savedSettings) {
        try {
            appSettings = JSON.parse(savedSettings);
        } catch (e) {
            console.error("Error parsing saved settings, loading defaults.", e);
            appSettings = defaultAppSettings;
            localStorage.setItem('appSettings', JSON.stringify(defaultAppSettings, null, 2));
        }
    } else {
        appSettings = defaultAppSettings;
        localStorage.setItem('appSettings', JSON.stringify(defaultAppSettings, null, 2));
    }
    // AFTER loading, populate dropdowns
    populateSutureDropdowns();
}

/**
 * Loads the current 'appSettings' object into the settings tab's text editor.
 * This is called when switching to the settings tab.
 */
function loadAppSettingsToEditor() {
    appSettingsEditor.value = JSON.stringify(appSettings, null, 2);
    appSettingsStatus.textContent = ''; // Clear any old status messages
}

/**
 * Saves the contents of the text editor to localStorage and the 'appSettings' variable.
 * Triggered by the "Save Changes" button.
 */
function saveAppSettings() {
    try {
        const newSettings = JSON.parse(appSettingsEditor.value);
        appSettings = newSettings;
        localStorage.setItem('appSettings', JSON.stringify(newSettings, null, 2));
        appSettingsStatus.textContent = "Changes saved successfully! Reloading form data.";
        appSettingsStatus.className = "text-sm mt-2 text-green-600";
        populateSutureDropdowns(); // Re-populate dropdowns
    } catch (e) {
        appSettingsStatus.textContent = `Error: ${e.message}. Changes NOT saved.`;
        appSettingsStatus.className = "text-sm mt-2 text-red-600";
    }
}

/**
 * Resets the settings in the editor, variable, and localStorage to the defaults.
 * Triggered by the "Reset to Defaults" button.
 */
function resetAppSettings() {
    // Use a modal/custom confirm in production instead of alert()
    if (confirm("Are you sure you want to reset all app settings to the defaults? This cannot be undone.")) {
        appSettings = defaultAppSettings;
        localStorage.setItem('appSettings', JSON.stringify(defaultAppSettings, null, 2));
        loadAppSettingsToEditor();
        populateSutureDropdowns();
        appSettingsStatus.textContent = "Settings reset to default. Form data reloaded.";
        appSettingsStatus.className = "text-sm mt-2 text-green-600";
    }
}

/**
 * Populates the suture dropdowns in the 'Entry' tab based on loaded appSettings.
 * This is called by loadAppSettings() and saveAppSettings().
 */
function populateSutureDropdowns() {
    // DOM elements are defined in main.js
    if (!deepSutureTypeEl || !skinSutureTypeEl) {
        console.error("Suture elements not found. 'main.js' must load first.");
        return;
    }
    
    // Clear existing options
    deepSutureTypeEl.innerHTML = '';
    skinSutureTypeEl.innerHTML = '';

    // Populate Deep Sutures
    appSettings.sutures.deep.forEach(suture => {
        const option = document.createElement('option');
        option.value = suture;
        option.textContent = suture;
        deepSutureTypeEl.appendChild(option);
    });
    
    // Populate Skin Sutures
    appSettings.sutures.skin.forEach(suture => {
        const option = document.createElement('option');
        option.value = suture;
        option.textContent = suture;
        skinSutureTypeEl.appendChild(option);
    });

    // Set defaults (these elements are also from main.js)
    if (deepSutureSizeEl) deepSutureSizeEl.value = "4/0";
    if (skinSutureSizeEl) skinSutureSizeEl.value = "5/0";
}
