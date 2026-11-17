/* Clearing a result returns the lesion to awaiting results and drops it from billing. */
const vault = require('../js/lesion-vault.js');
const billing = require('../js/billing-vault.js');

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

global.vaultAuth = { username: 'doctor' };
global.sessionPatientSnapshot = () => ({});
global.suggestMbsItems = () => ({ ready: false, summary: '' });
global.applyInferredBillingLesionType = (lesion) => {
    lesion.billingLesionType = String(lesion.impression || '').includes('melanoma')
        ? 'suspected_melanoma'
        : 'benign';
};

function filledLesion(extra) {
    return {
        id: 'L1',
        patientName: 'Wrong Person',
        location: 'Left cheek',
        impression: 'possible melanoma',
        procedureCompletedAt: '2026-11-01T01:00:00.000Z',
        managementStatus: 'needs_contact',
        currentPlan: 'Result recorded — set the plan.',
        resultPlan: 'no_followup',
        contactState: 'mark_for_contact',
        resultAdvisedAt: '2026-11-10T01:00:00.000Z',
        clinicallyFinalisedAt: '2026-11-10T01:00:00.000Z',
        contactUrgent: true,
        proposedPlan: 'excision',
        proposedPlanNote: 'discuss',
        histologyResult: 'Melanoma, 0.4 mm',
        histologyDiagnosis: 'Melanoma',
        histologyAt: '2026-11-10T01:00:00.000Z',
        histologyCaseNumber: 'S26-999',
        histologyPot: '2',
        histologyBatchId: 'batch-1',
        priorHistologyResult: 'Prior BCC',
        billingLesionType: 'confirmed_melanoma',
        suggestedMbsItems: '31371',
        furtherActionDate: '2026-12-01',
        timeline: [
            { id: 'n1', type: 'note', note: 'Discussed scar', at: '2026-11-01T02:00:00.000Z' },
            { id: 'h1', type: 'histology', note: 'Melanoma, 0.4 mm', at: '2026-11-10T01:00:00.000Z' }
        ],
        history: [],
        ...extra
    };
}

const lesion = filledLesion();
const cleared = vault.clearSavedHistologyResult(lesion);
eq(cleared.ok, true, 'a saved result can be cleared');
eq(cleared.restored, true, 'a finished procedure returns to awaiting results');
eq(lesion.histologyResult, '', 'report text is cleared');
eq(lesion.histologyDiagnosis, '', 'diagnosis is cleared');
eq(lesion.histologyAt, '', 'result time is cleared');
eq(lesion.histologyCaseNumber, '', 'lab case number entered with the result is cleared');
eq(lesion.histologyPot, '2', 'pot number stays');
eq(lesion.histologyBatchId, 'batch-1', 'procedure batch stays');
eq(lesion.priorHistologyResult, 'Prior BCC', 'copied prior histology stays');
eq(lesion.procedureCompletedAt, '2026-11-01T01:00:00.000Z', 'procedure stays completed');
eq(lesion.managementStatus, 'awaiting_histology', 'status is awaiting results');
eq(lesion.currentPlan, 'Awaiting histology', 'plan line is awaiting histology');
eq(lesion.resultPlan, '', 'result plan is cleared');
eq(lesion.contactState, '', 'contact state is cleared');
eq(lesion.resultAdvisedAt, '', 'advice time is cleared');
eq(lesion.clinicallyFinalisedAt, '', 'clinical finalised time is cleared');
eq(lesion.contactUrgent, false, 'urgent flag from the result is cleared');
eq(lesion.proposedPlan, '', 'proposed plan from the result is cleared');
eq(lesion.furtherActionDate, '2026-12-01', 'next attention date stays');
eq(lesion.billingLesionType, 'suspected_melanoma', 'billing type is inferred again without the result');
eq(lesion.timeline.some((event) => event && event.type === 'histology' && /Melanoma/.test(event.note || '')), false, 'wrong result leaves the timeline');
eq(lesion.timeline.some((event) => event && event.type === 'note' && event.note === 'Discussed scar'), true, 'doctor note stays');
eq(lesion.timeline.some((event) => event && event.note === 'Result cleared. Awaiting histology.'), true, 'clearance is recorded');
eq(vault.lesionLifecycleStatus(lesion), 'awaiting_histology', 'lifecycle is awaiting results');

const again = vault.clearSavedHistologyResult(lesion);
eq(again.ok, false, 'clearing twice does not invent a result');
eq(again.reason, 'empty', 'a second clear reports that the result is already gone');

const linked = filledLesion({
    id: 'L2',
    linkedChildId: 'C1',
    managementStatus: 'no_followup',
    currentPlan: 'Episode complete · further management open'
});
const linkedClear = vault.clearSavedHistologyResult(linked);
eq(linkedClear.ok, true, 'a linked lesion can still lose the wrong report');
eq(linkedClear.restored, false, 'a linked next episode is not moved back onto the results queue');
eq(linked.managementStatus, 'no_followup', 'linked lesion status stays');
eq(linked.histologyResult, '', 'linked lesion report is still cleared');
eq(linked.currentPlan, 'Episode complete · further management open', 'linked plan line stays');

const bill = billing.snapshotBillingFromLesion(lesion, {
    id: 'B1',
    histologyDiagnosis: 'Melanoma',
    histologyResult: 'Melanoma, 0.4 mm',
    billingLesionType: 'confirmed_melanoma',
    suggestedMbsItems: '31371',
    status: 'awaiting'
});
eq(bill.histologyDiagnosis, '', 'billing diagnosis follows the cleared lesion');
eq(bill.histologyResult, '', 'billing report follows the cleared lesion');
eq(bill.billingLesionType, 'suspected_melanoma', 'billing type follows the cleared lesion');
eq(bill.suggestedMbsItems, '', 'old item suggestion does not stay on the bill');
eq(bill.status, 'awaiting', 'bill queue status stays');

const kept = billing.snapshotBillingFromLesion({ id: 'L3' }, {
    histologyDiagnosis: 'BCC',
    histologyResult: 'BCC, clear',
    billingLesionType: 'malignant',
    suggestedMbsItems: '31220'
});
eq(kept.histologyResult, 'BCC, clear', 'a lesion without result fields keeps the bill result');

if (failed) {
    console.error(failed + ' failed');
    process.exit(1);
}
console.log('clear histology result checks passed');
