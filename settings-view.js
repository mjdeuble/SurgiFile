// --- SETTINGS TAB LOGIC ---

const defaultAppSettings = {
    "doctorList": [
        "Practice Manager", // Special user, must be first
        "DR_A",
        "DR_B",
        "DR_C"
        // Add more doctor codes here as needed
    ],
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
        "Suspected Melanoma": { // New items: 31377-31383
            "Option1": [
                { "maxSize": 6, "item": "31377", "desc": "Suspected Melanoma, Option 1, <6mm" },
                { "maxSize": 999, "item": "31378", "desc": "Suspected Melanoma, Option 1, >6mm" }
            ],
            "Option2": [
                { "maxSize": 14, "item": "31379", "desc": "Suspected Melanoma, Option 2, <14mm" },
                { "maxSize": 999, "item": "31380", "desc": "Suspected Melanoma, Option 2, >14mm" }
            ],
            "Option3": [
                { "maxSize": 15, "item": "31381", "desc": "Suspected Melanoma, Option 3, <15mm" },
                { "maxSize": 30, "item": "31382", "desc": "Suspected Melanoma, Option 3, 15-30mm" },
                { "maxSize": 999, "item": "31383", "desc": "Suspected Melanoma, Option 3, >30mm" }
            ]
        },
        "Definitive Melanoma": { // Amended items: 31371-31376
            "Option1": [
                 // No <6mm code for definitive excision
                { "maxSize": 999, "item": "31371", "desc": "Definitive Melanoma, Option 1, >6mm" }
            ],
            "Option2": [
                { "maxSize": 14, "item": "31372", "desc": "Definitive Melanoma, Option 2, <14mm" },
                { "maxSize": 999, "item": "31373", "desc": "Definitive Melanoma, Option 2, >14mm" }
            ],
            "Option3": [
                { "maxSize": 15, "item": "31374", "desc": "Definitive Melanoma, Option 3, <15mm" },
                { "maxSize": 30, "item": "31375", "desc": "Definitive Melanoma, Option 3, 15-30mm" },
                { "maxSize": 999, "item": "31376", "desc": "Definitive Melanoma, Option 3, >30mm" }
            ]
        },
        "Benign / Other": { // Renamed from "Non-Malignant"
            "Option1": [
                { "maxSize": 6, "item": "31357", "desc": "Benign/Other, Option 1, <6mm" },
                { "maxSize": 999, "item": "31360", "desc": "Benign/Other, Option 1, >6mm" }
            ],
            "Option2": [
                { "maxSize": 14, "item": "31361", "desc": "Benign/Other, Option 2, <14mm" },
                { "maxSize": 999, "item": "31363", "desc": "Benign/Other, Option 2, >14mm" }
            ],
            "Option3": [
                { "maxSize": 15, "item": "31365", "desc": "Benign/Other, Option 3, <15mm" },
                { "maxSize": 30, "item": "31367", "desc": "Benign/Other, Option 3, 15-30mm" },
                { "maxSize": 999, "item": "31369", "desc": "Benign/Other, Option 3, >30mm" }
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
    populateDoctorDropdown(); // New function call from main.js
}

function loadAppSettingsToEditor() {
    appSettingsEditor.value = JSON.stringify(appSettings, null, 2);
}

function saveAppSettings() {
    try {
        const newSettings = JSON.parse(appSettingsEditor.value);
        appSettings = newSettings;
        localStorage.setItem('appSettings', JSON.stringify(newSettings, null, 2));
        appSettingsStatus.textContent = "Changes saved successfully! Reloading form data.";
        appSettingsStatus.className = "text-sm mt-2 text-green-600";
        populateSutureDropdowns(); // Re-populate dropdowns
        populateDoctorDropdown(); // Re-populate doctor dropdown
    } catch (e) {
        appSettingsStatus.textContent = `Error: ${e.message}. Changes NOT saved.`;
        appSettingsStatus.className = "text-sm mt-2 text-red-600";
    }
}

function resetAppSettings() {
    if (confirm("Are you sure you want to reset all app settings to the defaults? This cannot be undone.")) {
        appSettings = defaultAppSettings;
        localStorage.setItem('appSettings', JSON.stringify(defaultAppSettings, null, 2));
        loadAppSettingsToEditor();
        populateSutureDropdowns();
        populateDoctorDropdown();
        appSettingsStatus.textContent = "Settings reset to default. Form data reloaded.";
        appSettingsStatus.className = "text-sm mt-2 text-green-600";
    }
}

// --- DYNAMIC FORM POPULATION ---
function populateSutureDropdowns() {
    // Clear existing options
    deepSutureTypeEl.innerHTML = '';
    skinSutureTypeEl.innerHTML = '';

    // Populate Deep Sutures
    if (appSettings.sutures && appSettings.sutures.deep) {
        appSettings.sutures.deep.forEach(suture => {
            const option = document.createElement('option');
            option.value = suture;
            option.textContent = suture;
            deepSutureTypeEl.appendChild(option);
        });
    }

    // Populate Skin Sutures
     if (appSettings.sutures && appSettings.sutures.skin) {
        appSettings.sutures.skin.forEach(suture => {
            const option = document.createElement('option');
            option.value = suture;
            option.textContent = suture;
            skinSutureTypeEl.appendChild(option);
        });
     }

    // Set defaults
    deepSutureSizeEl.value = "4/0";
    skinSutureSizeEl.value = "5/0";
}
