// --- IndexedDB Helpers ---
// This file manages the IndexedDB connection and provides simple
// get/set/del functions for storing data, like the folder handle.

let db; // Database connection object

const dbOpenRequest = indexedDB.open('file-system-db', 1);

dbOpenRequest.onupgradeneeded = (event) => {
    const db = event.target.result;
    if (!db.objectStoreNames.contains('keyval')) {
        db.createObjectStore('keyval');
    }
};

dbOpenRequest.onsuccess = (event) => {
    db = event.target.result;
    // Once the DB is ready, we will call loadSavedFolder() from main.js
    // (Original call removed for better load order control)
    console.log("Database connection ready.");
};

dbOpenRequest.onerror = (event) => {
    console.error('IndexedDB error:', event.target.error);
};

function dbGet(key) {
    return new Promise((resolve, reject) => {
        if (!db) {
            console.warn('DB not ready, retrying...');
            // Wait for the onsuccess event to fire
            return setTimeout(() => dbGet(key).then(resolve).catch(reject), 100);
        }
        const transaction = db.transaction('keyval', 'readonly');
        const store = transaction.objectStore('keyval');
        const request = store.get(key);
        request.onsuccess = () => resolve(request.result);
        request.onerror = (event) => reject(event.target.error);
    });
}

function dbSet(key, value) {
    return new Promise((resolve, reject) => {
        if (!db) {
            console.warn('DB not ready, retrying set...');
             // Wait for the onsuccess event to fire
            return setTimeout(() => dbSet(key, value).then(resolve).catch(reject), 100);
        }
        const transaction = db.transaction('keyval', 'readwrite');
        const store = transaction.objectStore('keyval');
        const request = store.put(value, key);
        request.onsuccess = () => resolve(request.result);
        request.onerror = (event) => reject(event.target.error);
    });
}

function dbDel(key) {
     return new Promise((resolve, reject) => {
        if (!db) {
            console.warn('DB not ready, retrying del...');
             // Wait for the onsuccess event to fire
            return setTimeout(() => dbDel(key).then(resolve).catch(reject), 100);
        }
        const transaction = db.transaction('keyval', 'readwrite');
        const store = transaction.objectStore('keyval');
        const request = store.delete(key);
        request.onsuccess = () => resolve();
        request.onerror = (event) => reject(event.target.error);
    });
}
