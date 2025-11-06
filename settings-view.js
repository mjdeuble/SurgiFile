// --- SETTINGS TAB LOGIC ---

// ... existing code ...
    "sutures": {
// ... existing code ...
        "skin_dissolvable": ["Monocryl", "Monosyn", "PDS II", "Vicryl Rapide"]
    }
};

// *** FIX: Make function global by attaching to window ***
window.loadAppSettings = function() {
    const savedSettings = localStorage.getItem('appSettings');
// ... existing code ...
    // AFTER loading, populate dropdowns
    populateSutureDropdowns();
}

// *** FIX: Make function global by attaching to window ***
window.loadAppSettingsToEditor = function() {
    // We load the *current* appSettings, which have already been
// ... existing code ...
    appSettingsEditor.value = JSON.stringify(appSettings, null, 2);
}

// *** FIX: Make function global by attaching to window ***
window.saveAppSettings = function() {
    try {
// ... existing code ...
        appSettingsStatus.className = "text-sm mt-2 text-red-600";
    }
}

// *** FIX: Make function global by attaching to window ***
window.resetAppSettings = function() {
    if (confirm("Are you sure you want to reset all app settings to the defaults? This will load the latest 2025 MBS billing logic and cannot be undone.")) {
// ... existing code ...
        appSettingsStatus.className = "text-sm mt-2 text-green-600";
    }
}

// --- DYNAMIC FORM POPULATION ---
// *** FIX: Make function global by attaching to window ***
window.populateSutureDropdowns = function() {
    // Check if settings (and element) are loaded
// ... existing code ...
    skinSutureSizeEl.value = "5/0";
    skinSutureSizeDissolvableEl.value = "5/0";
}
