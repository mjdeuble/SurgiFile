const {
    normalizeConsultBilling,
    storedConsultBilling,
    storedBiopsyBilling,
    DEFAULT_CONSULT_BILLING
} = require('../js/billing.js');
const {
    isVerbalConsentBiopsyType,
    lesionConsentRequirement,
    lesionHasProcedureConsent
} = require('../js/lesion-vault.js');

let failed = 0;
function eq(actual, expected, label) {
    const ok = Object.is(actual, expected);
    if (!ok) {
        failed += 1;
        console.error('FAIL', label, { actual, expected });
    } else {
        console.log('ok', label);
    }
}

eq(storedConsultBilling({ consultBilling: 'Concession' }), 'Concession', 'stored consult prefers chart');
eq(storedConsultBilling({ consultBilling: 'Bulk Bill' }), 'Bulk Bill', 'stored bulk bill');
eq(storedConsultBilling({ consultBilling: '' }), '', 'empty stored consult is empty');
eq(storedConsultBilling(null), '', 'no chart has no stored consult');
eq(storedBiopsyBilling({ biopsyBilling: 'Bulk Billed ($0 OOP)' }), 'Bulk Billed ($0 OOP)', 'stored biopsy bulk');
eq(normalizeConsultBilling('concession'), 'Concession', 'normalize concession');
eq(DEFAULT_CONSULT_BILLING, 'Private Bill', 'default consult is private');

eq(isVerbalConsentBiopsyType('Punch Biopsy'), true, 'punch biopsy is verbal');
eq(isVerbalConsentBiopsyType('Punch Excision'), false, 'punch excision is not verbal-only');
eq(isVerbalConsentBiopsyType('Shave / Deep Saucerisation Biopsy'), true, 'shave is verbal');
eq(isVerbalConsentBiopsyType(''), false, 'empty biopsy type is not verbal');

eq(lesionConsentRequirement({ type: 'punch' }), 'verbal', 'punch lesion requires verbal');
eq(lesionConsentRequirement({ type: 'shave' }), 'verbal', 'shave lesion requires verbal');
eq(lesionConsentRequirement({ type: 'excision' }), 'written', 'excision requires written');
eq(lesionHasProcedureConsent({ type: 'punch', consentStatus: 'verbal' }), true, 'verbal punch is consented');
eq(lesionHasProcedureConsent({ type: 'punch' }), false, 'punch without consent is not ready');
eq(lesionHasProcedureConsent({ type: 'excision', consentStatus: 'verbal' }), false, 'verbal is not enough for excision');

if (failed) {
    console.error(failed + ' check(s) failed');
    process.exit(1);
}
console.log('All patient-billing and punch-consent checks passed.');
