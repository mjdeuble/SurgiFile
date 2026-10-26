/* Node checks: punch verbal consent, pot order, cryo off reception, unplanned SSG, billing persist. */
const fs = require('fs');
const path = require('path');
const {
    isVerbalConsentBiopsyType,
    lesionConsentRequirement,
    lesionHasProcedureConsent,
    comparePracticeLesions,
    practiceLesionTreeNumber,
    practiceLesionPotNumber
} = require('../js/lesion-vault.js');
const {
    normalizeConsultBilling,
    storedConsultBilling,
    storedBiopsyBilling,
    DEFAULT_CONSULT_BILLING,
    resolvedGraftType
} = require('../js/billing.js');

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

const consent = fs.readFileSync(path.join(__dirname, '..', 'js/consent.js'), 'utf8');
eq(/if \(isConsentShaveLesion\(lesion\)\) return true;\s+if \(isConsentPunchLesion\(lesion\)\) return true;/.test(consent), false, 'punches are not imported onto the written consent form');
eq(consent.includes('if (isConsentShaveLesion(lesion)) return true;'), true, 'unconsented shaves can still go on the written form');

const first = { histologyPot: '2', createdAt: '2026-10-01T09:00:00.000Z', id: 'a', histologyBatchId: 'b1', procedureCompletedAt: '2026-10-20T10:00:00.000Z' };
const second = { histologyPot: '1', createdAt: '2026-10-01T10:00:00.000Z', id: 'b', histologyBatchId: 'b1', procedureCompletedAt: '2026-10-20T10:05:00.000Z' };
const third = { histologyPot: '10', createdAt: '2026-10-01T08:00:00.000Z', id: 'c', histologyBatchId: 'b1', procedureCompletedAt: '2026-10-20T10:10:00.000Z' };
const ordered = [first, third, second].sort(comparePracticeLesions);
eq(ordered.map((row) => practiceLesionPotNumber(row)).join(','), '1,2,10', 'awaiting-result pots sort 1, 2, 10 not created-time');
eq(practiceLesionTreeNumber(second, 0), '1', 'tree number uses pot when present');
eq(practiceLesionTreeNumber({ id: 'x' }, 3), '4', 'tree number falls back to index when pot is missing');

const topical = fs.readFileSync(path.join(__dirname, '..', 'js/topical.js'), 'utf8');
eq(topical.includes("if (l.topicalDecision === 'cryotherapy') {\n            return '';"), true, 'reception omits cryotherapy');
const iemr = fs.readFileSync(path.join(__dirname, '..', 'js/topical.js'), 'utf8');
eq(iemr.includes('Cryotherapy parameters:'), true, 'IEMR still records cryotherapy parameters');

eq(resolvedGraftType('Ellipse', 'Split-Skin Graft (SSG)'), '', 'ellipse does not keep leftover SSG');
eq(resolvedGraftType('Secondary Intention', 'Split-Skin Graft (SSG)'), '', 'secondary intention does not keep leftover SSG');
eq(resolvedGraftType('Graft', 'Split-Skin Graft (SSG)'), 'Split-Skin Graft (SSG)', 'planned graft keeps SSG');
eq(resolvedGraftType('Graft + Flap', 'Full-Thickness Skin Graft (FTSG)'), 'Full-Thickness Skin Graft (FTSG)', 'graft + flap keeps chosen graft');

eq(storedConsultBilling({ consultBilling: 'Concession' }), 'Concession', 'stored consult prefers chart');
eq(storedConsultBilling({ consultBilling: 'Bulk Bill' }), 'Bulk Bill', 'stored bulk bill');
eq(storedConsultBilling({ consultBilling: '' }), '', 'empty stored consult is empty');
eq(storedConsultBilling(null), '', 'no chart has no stored consult');
eq(storedBiopsyBilling({ biopsyBilling: 'Bulk Billed ($0 OOP)' }), 'Bulk Billed ($0 OOP)', 'stored biopsy bulk');
eq(normalizeConsultBilling('concession'), 'Concession', 'normalize concession');
eq(DEFAULT_CONSULT_BILLING, 'Private Bill', 'default consult is private');

const vault = fs.readFileSync(path.join(__dirname, '..', 'js/chart-vault.js'), 'utf8');
eq(vault.includes('storedConsultBilling(chart)'), true, 'chart save keeps stored consult billing');
eq(vault.includes('seedPatientBillingFromSource'), true, 'add-patient billing is seeded before first autosave');

if (failed) {
    console.error(failed + ' check(s) failed');
    process.exit(1);
}
console.log('All clinic list-fix checks passed.');
