// --- APPLICATION EVENT LISTENERS ---

// ... existing code ...
    // Copy Buttons
    getEl('copy-request-btn').addEventListener('click', () => copyToClipboard('clinicalRequestOutput', getEl('copy-request-btn-text')));
// ... existing code ...
    getEl('copy-note-btn').addEventListener('click', () => copyToClipboard('entryNoteOutput', getEl('copy-note-btn-text')));
    
    // Suture Checkbox Logic
-    useNonDissolvableEl.addEventListener('change', () => {
-        skinSutureDetails.classList.remove('hidden');
-        skinSutureDetailsDissolvable.classList.add('hidden');
-        useDissolvableEl.checked = false;
+    // *** FIX: Updated Suture Logic ***
+    useDeepSutureEl.addEventListener('change', () => {
+        deepSutureContainer.classList.toggle('hidden', !useDeepSutureEl.checked);
         checkLesionFormCompleteness();
     });
-    useDissolvableEl.addEventListener('change', () => {
-        skinSutureDetails.classList.add('hidden');
-        skinSutureDetailsDissolvable.classList.remove('hidden');
-        useNonDissolvableEl.checked = false;
+    useSkinSutureEl.addEventListener('change', () => {
+        skinSutureDetails.classList.toggle('hidden', !useSkinSutureEl.checked);
         checkLesionFormCompleteness();
     });
 
+    // Suture Type Dropdown (to show/hide removal box)
+    skinSutureTypeEl.addEventListener('change', () => {
+        const removalBox = getEl('skin-suture-removal-container');
+        const isDissolvable = appSettings.sutures.skin_dissolvable.includes(skinSutureTypeEl.value);
+        removalBox.style.display = (skinSutureTypeEl.value && !isDissolvable) ? 'block' : 'none';
+        checkLesionFormCompleteness(); // Re-validate
+    });
+
     // Output Style Buttons
     outputBtnCombined.addEventListener('click', () => setOutputStyle('combined'));
// ... existing code ...
