/* Node checks: review and result notes state the decision that was made. */
const vault = require('../js/lesion-vault.js');
global.linkedLesionPlansReexcision = vault.linkedLesionPlansReexcision;
global.isPunchShaveBiopsyPlan = (plan) => /biopsy/i.test(String(plan || ''));
global.isMonitorLesionPlan = (plan) => /monitor/i.test(String(plan || ''));
global.lesionType = (lesion) => lesion?.type || '';
const { generateResultIemrNote, formatLesionPlanIemr } = require('../js/outputs.js');
const { formatExamPlanBadge } = require('../js/skin-check.js');

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

const result = 'Nodular BCC, completely excised.';
eq(
    generateResultIemrNote({ location: 'Nose', histologyResult: result, contactState: 'mark_for_contact' }),
    'Nose: ' + result + '. Plan not set.',
    'recorded result does not say it was reviewed or that a call was chosen'
);
eq(
    generateResultIemrNote({
        location: 'Nose',
        histologyResult: result,
        resultPlan: 'no_followup',
        contactState: 'mark_for_contact'
    }),
    'Nose: ' + result + '. Reviewed. No further action.',
    'no further action without a call omits the contact sentence'
);
eq(
    generateResultIemrNote({
        location: 'Nose',
        histologyResult: result,
        resultPlan: 'no_followup',
        contactState: 'advised_now'
    }),
    'Nose: ' + result + '. Reviewed. No further action. Patient advised.',
    'advised patient keeps that contact sentence'
);
eq(
    generateResultIemrNote({
        location: 'Nose',
        histologyResult: result,
        resultPlan: 'no_followup',
        contactState: 'file_no_call'
    }, { fileNoCall: true }),
    'Nose: ' + result + '. Reviewed. No further action. Filed. No call (call-if-anything).',
    'file and no call drops the word agreed'
);
eq(
    generateResultIemrNote({
        location: 'Nose',
        histologyResult: result,
        resultPlan: 'further_management',
        contactState: 'appointment_requested'
    }),
    'Nose: ' + result + '. Reviewed. Needs further management. Appointment requested to discuss the result.',
    'appointment request keeps its contact sentence'
);
eq(
    generateResultIemrNote({
        location: 'Nose',
        histologyResult: result,
        contactUrgent: true
    }),
    'Nose: ' + result + '. Plan not set. Urgent contact.',
    'an urgent unset plan keeps the urgent flag'
);

eq(vault.resultContactPlanLine('', 'mark_for_contact'), 'Result recorded. Plan not set.', 'blank plan is not stored as no further action');
eq(vault.resultContactPlanLine('no_followup', 'mark_for_contact'), 'No follow-up', 'chosen no further action stays no follow-up');
eq(vault.resultContactPlanLine('further_management', 'mark_for_contact'), 'Needs further management. Patient to be contacted.', 'further management waiting for contact does not say the result was discussed');
eq(vault.resultContactPlanLine('further_management', 'advised_now'), 'Further management opened', 'opening further management uses that sentence');
eq(
    vault.planLineAfterSavedHistology({ histologyResult: 'BCC', contactState: 'mark_for_contact' }, 'needs_contact'),
    'Result recorded. Plan not set.',
    'saving a result without a plan does not write NFA'
);

const waiting = {
    managementStatus: 'needs_contact',
    histologyResult: 'BCC',
    currentPlan: 'Result recorded. Plan not set.',
    timeline: []
};
eq(vault.lesionIemrCommsLine(waiting), 'Result recorded. Plan not set.', 'waiting lesion is not described as reviewed');

const cleared = {
    managementStatus: 'no_followup',
    currentPlan: 'Cleared at topical review',
    histologyResult: '',
    timeline: [{ type: 'result_advised', at: '2026-10-20T01:00:00.000Z', planAfter: 'No follow-up' }]
};
eq(vault.lesionIemrCommsLine(cleared), 'Plan: Cleared at topical review', 'topical clearance is not a result being advised');

const advised = {
    managementStatus: 'no_followup',
    currentPlan: 'No follow-up',
    histologyResult: 'BCC',
    timeline: [{ type: 'result_advised', at: '2026-10-20T01:00:00.000Z', planAfter: 'No follow-up' }]
};
eq(vault.lesionIemrCommsLine(advised), 'Result advised: No follow-up', 'a discussed result keeps the result advised prefix');

const stale = { currentPlan: 'NFA — to be advised', resultPlan: '', managementStatus: 'needs_contact', histologyResult: 'BCC' };
eq(vault.repairMisleadingPlanLine(stale), true, 'old NFA wording is replaced');
eq(stale.currentPlan, 'Result recorded. Plan not set.', 'replacement says the plan is not set');
eq(stale.managementStatus, 'needs_contact', 'wording repair leaves the lesion waiting for a plan');

const topical = {
    plan: 'Topical / Field Treatment',
    type: 'topical',
    topicalFollowUp: '4 weeks',
    managementStatus: 'topical_followup'
};
eq(vault.deriveLesionStatusFromPlan(topical), 'topical_followup', 'topical review interval still uses the same lesion');
eq(vault.repairMisleadingPlanLine({ ...topical, currentPlan: 'Topical follow-up' }), false, 'topical follow-up plan is left as it is');

const booked = { managementStatus: 'needs_contact', currentPlan: 'Result recorded. Plan not set.', contactState: 'mark_for_contact' };
vault.applyContactOutcomeToLesion(booked, 'booked');
eq(booked.managementStatus, 'appointment_requested', 'booking still requests an appointment');
eq(booked.currentPlan, 'Appointment booked to discuss result', 'booking still replaces the unset plan line');

const kept = { managementStatus: 'needs_contact', currentPlan: 'Cleared at topical review', contactState: 'mark_for_contact' };
vault.applyContactOutcomeToLesion(kept, 'booked');
eq(kept.currentPlan, 'Cleared at topical review', 'booking does not replace a real closure reason');
eq(kept.managementStatus, 'appointment_requested', 'booking still changes the contact status');

eq(vault.linkedLesionPlansReexcision({ priorLesionId: 'p', type: 'excision', plan: 'Formally Book Excision Procedure' }), true, 'excision child is a re-excision');
eq(vault.linkedLesionPlansReexcision({ priorLesionId: 'p', proposedPlan: 'biopsy', plan: 'Punch / Shave Biopsy' }), false, 'biopsy child is not a re-excision');
eq(vault.linkedLesionPlansReexcision({ priorLesionId: 'p', proposedPlan: 'monitor', plan: '' }), false, 'monitor child is not a re-excision');
eq(vault.linkedLesionPlansReexcision({ priorLesionId: 'p', plan: '', type: 'none' }), false, 'unset linked lesion is not a re-excision');
eq(
    formatLesionPlanIemr({ priorLesionId: 'p', plan: 'Punch / Shave Biopsy', biopsyType: 'Punch Biopsy' }),
    'Punch Biopsy',
    'note plan names the biopsy'
);
eq(
    formatExamPlanBadge({ priorLesionId: 'p', plan: 'Punch / Shave Biopsy', biopsyType: 'Punch Biopsy' }),
    'Punch / Shave Biopsy (Punch Biopsy)',
    'exam badge names the biopsy'
);
eq(
    formatExamPlanBadge({ priorLesionId: 'p', plan: 'Formally Book Excision Procedure' }),
    'Re-excision',
    'excision child badge stays re-excision'
);

eq(vault.reviewClosureMessage('Cleared at topical review', false), 'Lesion clinically finalised. Cleared at topical review.', 'sign-off message uses the topical reason');
eq(vault.reviewClosureMessage('No follow-up', false), 'Lesion clinically finalised. No further action.', 'plain no follow-up keeps the existing sign-off message');
eq(vault.reviewClosureMessage('Closed without a result', true), 'Lesion clinically finalised. Unbilled items stay on Billing.', 'billing hold keeps the billing message');

if (failed) {
    console.error('\n' + failed + ' failing check(s)');
    process.exit(1);
}
console.log('\nall review output wording checks passed');
