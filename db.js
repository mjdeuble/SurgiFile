// --- IndexedDB Helpers ---
// ... existing code ...
    console.error('IndexedDB error:', event.target.error);
};

// *** FIX: Make function global by attaching to window ***
window.dbGet = function(key) {
    return new Promise((resolve, reject) => {
// ... existing code ...
        request.onerror = (event) => reject(event.target.error);
    });
}

// *** FIX: Make function global by attaching to window ***
window.dbSet = function(key, value) {
    return new Promise((resolve, reject) => {
// ... existing code ...
        request.onerror = (event) => reject(event.target.error);
    });
}

// *** FIX: Make function global by attaching to window ***
window.dbDel = function(key) {
     return new Promise((resolve, reject) => {
// ... existing code ...
        request.onerror = (event) => reject(event.target.error);
    });
}
