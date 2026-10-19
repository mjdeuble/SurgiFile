/* Application boot. Register new feature init functions here. */

function bootDermRecord() {
    updateHeaderPatient();
    updateOutput();
    initBillingModule();
    initExcisionGeneratorModule();
    initTopicalModule();
    if (typeof initDiagnosisTypeaheads === 'function') initDiagnosisTypeaheads();
    if (typeof initLocationZoneFields === 'function') initLocationZoneFields();
    initAuthModule();
    initManagementModule();
    if (typeof bindChartPatientIdentityFields === 'function') bindChartPatientIdentityFields();
    if (typeof renderChartSidebar === 'function') renderChartSidebar();
    initVaultIdleLock();
    if (typeof updateExamRequiredFields === 'function') updateExamRequiredFields();
    if (typeof collapseAllAccordions === 'function') collapseAllAccordions();
    if (typeof updateExamSectionHeaders === 'function') updateExamSectionHeaders();
    if (typeof updateScreeningCompleteButton === 'function') updateScreeningCompleteButton();

    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('sw.js?v=196').catch(() => {
            // Offline cache is optional when opened from file:// or without HTTPS
        });
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootDermRecord);
} else {
    bootDermRecord();
}
