// --- SETTINGS TAB LOGIC ---

// This file manages the Settings tab, including:
// - Loading and saving the app settings (billing codes, sutures) to localStorage
// - Resetting settings to their default state
// - Populating the suture dropdowns on the Entry tab

const defaultAppSettings = {
    // ---
    // NEW MBS-COMPLIANT BILLING LOGIC
    // Based on "MBS Skin Item Number Verification" document (Nov 2025)
    // ---
    "excisions": {
        // Table A: Malignant Lesions (BCC/SCC)
        "BCC/SCC": {
            "Area1": [
                { "maxSize": 5.9, "item": "31356", "desc": "Excision of malignant lesion (Area 1) - <6mm" },
                { "minSize": 6, "maxSize": 999, "item": "31358", "desc": "Excision of malignant lesion (Area 1) - >=6mm" }
                // Item 31359 (>=1/3 surface) is complex and requires manual selection
            ],
            "Area2": [
                { "maxSize": 13.9, "item": "31361", "desc": "Excision of malignant lesion (Area 2) - <14mm" },
                { "minSize": 14, "maxSize": 999, "item": "31363", "desc": "Excision of malignant lesion (Area 2) - >=14mm" }
            ],
            "Area3": [
                { "maxSize": 14.9, "item": "31365", "desc": "Excision of malignant lesion (Area 3) - <15mm" },
                { "minSize": 15, "maxSize": 30, "item": "31367", "desc": "Excision of malignant lesion (Area 3) - 15-30mm" },
                { "minSize": 30.1, "maxSize": 999, "item": "31369", "desc": "Excision of malignant lesion (Area 3) - >30mm" }
            ]
            // Extensive items 31386-31388 are not included in auto-suggestion
            // due to complex rules (e.g., "involving >=2 critical areas")
        },
        // Table B: Non-Malignant (Benign) Lesions
        "Benign / Other": {
            "Area1": [
                { "maxSize": 5.9, "item": "31357", "desc": "Excision of non-malignant lesion (Area 1) - <6mm" },
                { "minSize": 6, "maxSize": 999, "item": "31360", "desc": "Excision of non-malignant lesion (Area 1) - >=6mm" }
            ],
            "Area2": [
                { "maxSize": 13.9, "item": "31362", "desc": "Excision of non-malignant lesion (Area 2) - <14mm" },
                { "minSize": 14, "maxSize": 999, "item": "31364", "desc": "Excision of non-malignant lesion (Area 2) - >=14mm" }
            ],
            "Area3": [
                { "maxSize": 14.9, "item": "31366", "desc": "Excision of non-malignant lesion (Area 3) - <15mm" },
                { "minSize": 15, "maxSize": 30, "item": "31368", "desc": "Excision of non-malignant lesion (Area 3) - 15-30mm" },
                { "minSize": 30.1, "maxSize": 999, "item": "31370", "desc": "Excision of non-malignant lesion (Area 3) - >30mm" }
            ]
        },
        // Table C: Stage 1 - Initial Excision (Suspected Melanoma)
        "Suspected Melanoma": {
            "Area1": [
                { "maxSize": 5.9, "item": "31377", "desc": "Initial excision of suspected melanoma (Area 1) - <6mm" },
                { "minSize": 6, "maxSize": 999, "item": "31378", "desc": "Initial excision of suspected melanoma (Area 1) - >=6mm" }
            ],
            "Area2": [
                { "maxSize": 13.9, "item": "31379", "desc": "Initial excision of suspected melanoma (Area 2) - <14mm" },
                { "minSize": 14, "maxSize": 999, "item": "31380", "desc": "Initial excision of suspected melanoma (Area 2) - >=14mm" }
            ],
            "Area3": [
                { "maxSize": 14.9, "item": "31381", "desc": "Initial excision of suspected melanoma (Area 3) - <15mm" },
                { "minSize": 15, "maxSize": 30, "item": "31382", "desc": "Initial excision of suspected melanoma (Area 3) - 15-30mm" },
                { "minSize": 30.1, "maxSize": 999, "item": "31383", "desc": "Initial excision of suspected melanoma (Area 3) - >30mm" }
            ]
        },
        // Table D: Stage 2 - Definitive Excision (Confirmed Melanoma)
        "Definitive Melanoma": {
            "Area1": [
                // No item for <6mm
                { "minSize": 6, "maxSize": 999, "item": "31371", "desc": "Definitive wide excision of confirmed melanoma (Area 1) - >=6mm" }
            ],
            "Area2": [
                { "maxSize": 13.9, "item": "31372", "desc": "Definitive wide excision of confirmed melanoma (Area 2) - <14mm" },
                { "minSize": 14, "maxSize": 999, "item": "31373", "desc": "Definitive wide excision of confirmed melanoma (Area 2) - >=14mm" }
            ],
            "Area3": [
                { "maxSize": 14.9, "item": "31374", "desc": "Definitive wide excision of confirmed melanoma (Area 3) - <15mm" },
                { "minSize": 15, "maxSize": 30, "item": "31375", "desc": "Definitive wide excision of confirmed melanoma (Area 3) - 15-30mm" },
                { "minSize": 30.1, "maxSize": 999, "item": "31376", "desc": "Definitive wide excision of confirmed melanoma (Area 3) - >30mm" }
            ]
        }
    },
    // Table E: Biopsy and Repair Items
    "biopsy": {
        "30071": { "item": "30071", "desc": "Diagnostic biopsy of skin (independent procedure)" },
        "30072": { "item": "30072", "desc": "Diagnostic biopsy of mucous membrane (independent procedure)" }
    },
    "repairs": [
        { 
            "item": "45201", 
            "desc": "Standard flap repair for one defect", 
            "clinicalType": "Flap Repair",
            // CRITICAL: Co-claiming rules
            "canClaimWith": ["31358", "31359", "31360", "31363", "31364", "31369", "31370", "31371", "31373", "31376", "31378", "31380", "31383"]
        },
        { 
            "item": "45202", 
            "desc": "Additional flap repair (same defect) or repair at free margin", 
            "clinicalType": "Flap Repair" 
            // This item has complex rules (e.g., must be claimed with 45201 OR be at free margin)
            // It will be suggested, but requires user knowledge.
        },
        { 
            "item": "45451", 
            "desc": "Full thickness skin graft (defect >=5mm)", 
            "clinicalType": "Graft Repair",
            "minSize": 5 
        },
        { 
            "item": "45440", 
            "desc": "Split skin graft (Small defect)", 
            "clinicalType": "Graft Repair" 
            // Complex rules based on size AND location, will be suggested for all grafts
        },
        { 
            "item": "45443", 
            "desc": "Split skin graft (Large defect)", 
            "clinicalType": "Graft Repair" 
            // Complex rules based on size AND location, will be suggested for all grafts
        },
        { 
            "item": "45665", 
            "desc": "Full thickness wedge excision (Lip, Eyelid, Ear)", 
            "clinicalType": "Wedge Excision" 
            // This is mapped to the "Wedge Excision" procedure type from entry-view.js
        }
        // Item 45207 is (correctly) OMITTED as it is mutually exclusive.
    ],
    // ---
    // END OF NEW BILLING LOGIC
    // ---
    "sutures": {
        "deep": ["Vicryl", "Monocryl", "PDS II", "Monosyn"],
        "skin": ["Prolene", "Nylon", "Ethilon"],
        "skin_dissolvable": ["Monocryl", "Monosyn", "PDS II", "Vicryl Rapide"],
        "skin_all": [
            "Prolene", 
            "Nylon", 
            "Ethilon", 
            "Monocryl", 
            "Monosyn", 
            "PDS II", 
            "Vicryl Rapide"
        ]
    }
};

window.loadAppSettings = function() {
    const savedSettings = localStorage.getItem('appSettings');
    let needsResave = false; // Flag to force-save if we migrate old settings

    if (savedSettings) {
        try {
            appSettings = JSON.parse(savedSettings);

            // --- Migration logic ---
            // This ensures users upgrading from an old version
            // don't have broken settings.

            // 1. Remove old doctorList if it exists
            if (appSettings.doctorList) {
                delete appSettings.doctorList;
                needsResave = true;
            }
            // 2. Remove old pmIdentifier if it exists
            if (appSettings.pmIdentifier) {
                delete appSettings.pmIdentifier;
                needsResave = true;
            }
            // 3. Check if the new settings structure exists. If not, force a reset.
            if (!appSettings.excisions || !appSettings.excisions["BCC/SCC"]["Area1"]) {
                 console.log("Old settings detected. Forcing reset to new billing logic.");
                 appSettings = defaultAppSettings;
                 needsResave = true;
                 // Alert the user that settings were reset
                 setTimeout(() => {
                    alert("Your application settings were outdated and have been reset to the new 2025 MBS billing logic.");
                 }, 1000);
            }

            // 4. Add new skin_all suture list if it's missing (for migration)
            if (!appSettings.sutures.skin_all) {
                appSettings.sutures.skin_all = defaultAppSettings.sutures.skin_all;
                needsResave = true;
            }

        } catch (e) {
            console.error("Error parsing saved settings, loading defaults.", e);
            appSettings = defaultAppSettings;
            needsResave = true;
        }
    } else {
        appSettings = defaultAppSettings;
        needsResave = true;
    }

    if (needsResave) {
         console.log("Saving new default settings to localStorage.");
         localStorage.setItem('appSettings', JSON.stringify(appSettings, null, 2));
    }

    // AFTER loading, populate dropdowns
    populateSutureDropdowns();
}


window.loadAppSettingsToEditor = function() {
    // We load the *current* appSettings, which have already been
    // migrated and cleaned by loadAppSettings()
    appSettingsEditor.value = JSON.stringify(appSettings, null, 2);
}

window.saveAppSettings = function() {
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
    
window.resetAppSettings = function() {
    if (confirm("Are you sure you want to reset all app settings to the defaults? This will load the latest 2025 MBS billing logic and cannot be undone.")) {
        appSettings = defaultAppSettings;
        localStorage.setItem('appSettings', JSON.stringify(defaultAppSettings, null, 2));
        loadAppSettingsToEditor();
        populateSutureDropdowns();
        appSettingsStatus.textContent = "Settings reset to default. Form data reloaded.";
        appSettingsStatus.className = "text-sm mt-2 text-green-600";
    }
}

// --- DYNAMIC FORM POPULATION ---
window.populateSutureDropdowns = function() {
    // Check if settings (and element) are loaded
    if (!appSettings.sutures || !deepSutureTypeEl) {
        console.warn("Settings or form elements not ready for suture population.");
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
    
    // *** FIX: Populate new combined Skin Suture dropdown ***
    // Add a default "Select" option
    const defaultOption = document.createElement('option');
    defaultOption.value = "";
    defaultOption.textContent = "Select suture type...";
    skinSutureTypeEl.appendChild(defaultOption);
    
    appSettings.sutures.skin_all.forEach(suture => {
         const option = document.createElement('option');
         option.value = suture;
        option.textContent = suture;
        skinSutureTypeEl.appendChild(option);
    });
    
     // Set defaults
     deepSutureSizeEl.value = "4/0";
     skinSutureSizeEl.value = "5/0";
}
