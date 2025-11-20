// --- ... existing code ... ---
    editProcedureBtn.addEventListener('click', () => {
        // Get the first lesion from the file and switch to the entry tab to edit
        if (currentBillingFile.data && currentBillingFile.data.lesions.length > 0) {
// --- ... existing code ... ---
        } else {
            showAppAlert("Error: Cannot find lesion data in this file.", "error");
        }
    });


    // --- Connect Settings View Listeners ---
// --- ... existing code ... ---
        }
    });

    // --- NEW: Global Key Press Listeners ---
    document.addEventListener('keydown', (event) => {
        // Check for Ctrl+P (Windows/Linux) or Cmd+P (Mac)
        if ((event.ctrlKey || event.metaKey) && event.key === 'p') {
            
            // Check if we are on the Billing tab
            const isBillingTabActive = billingView.classList.contains('active');
            
            if (isBillingTabActive) {
                // We are on the billing page, so *always* prevent the default browser print dialog.
                event.preventDefault();
                
                // Now, check if we are in PM mode to trigger the custom print.
                if (currentAppMode === 'PM') {
                    // Trigger the app's custom print function (defined in billing-view.js)
                    window.printBilledList();
                } else {
                    // In Doctor mode, let them know this is a PM-only feature.
                    showAppAlert("Printing the 'Ready to Bill' list is a Practice Manager action. Please switch to PM mode to print.", "info");
                }
            }
            // If not on the billing tab (e.g., Settings, Entry), we do nothing
            // and allow the default browser behavior.
        }
    });


    // --- INITIAL APP LOAD ---
    
    // 1. Load settings from localStorage (or defaults)
// --- ... existing code ... ---
