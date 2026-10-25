/* Node checks: review dispositions for stuck / early-closed pathways. */
const vault = require('../js/lesion-vault.js');

let failed = 0;
function eq(actual, expected, label) {
    const ok = Object.is(actual, expected)
        || (typeof actual === 'boolean' && actual === expected);
    if (!ok) {
        failed += 1;
        console.error('FAIL', label, { actual, expected });
    } else {
        console.log('ok', label);
    }
}

global.isTopicalPlan = (plan) => String(plan || '').includes('Topical');
global.isReferLesionPlan = (plan) => String(plan || '').includes('Refer');
global.isDeclineTreatmentPlan = (plan) => /Declines Treatment/i.test(String(plan || ''));
global.formatDeclinePlanSummary = (lesion) => lesion?.declineKind === 'other'
    ? (lesion.declineOtherPlan || 'Other disposition documented')
    : 'Declined recommended treatment';
global.lesionType = (lesion) => lesion?.type || '';
global.lesionHasSavedHistology = (lesion) => !!String(lesion?.histologyResult || '').trim();
global.lesionProcedureDone = (lesion) => !!(lesion?.procedureCompletedAt || lesion?.excisionFinalisedAt);
global.lesionIsClinicallyFinalised = (lesion) => lesion?.managementStatus === 'no_followup'
    || !!(lesion?.linkedReexcisionId || lesion?.linkedChildId);
global.formatProposedManagementPlan = (lesion) => {
    const key = String(lesion?.proposedPlan || '').trim();
    if (key === 'excision') return 'Proposed: Excision';
    if (key === 'topical') return 'Proposed: Topical / field treatment';
    if (key === 'biopsy') return 'Proposed: Biopsy';
    if (key === 'refer') return 'Proposed: Refer';
    if (key === 'monitor') return 'Proposed: Monitor / review';
    return 'Needs management';
};
global.vaultAuth = { username: 'test' };
global.isVaultLoggedIn = () => false;
global.showToast = () => {};
global.renderManagedLesions = () => {};
global.updateCurrentCaseBanner = () => {};
global.managedLesions = [];
global.currentPatient = { name: 'Jane Example', dob: '02/03/1954', chartId: 'c1', clinician: 'Deuble' };
global.document = { getElementById: () => null };

const awaiting = {
    id: 'A1',
    plan: 'Awaiting Assessment',
    type: 'none',
    managementStatus: 'awaiting_assessment',
    timeline: [],
    history: []
};
eq(vault.lesionReviewDispositionKind(awaiting), 'open', 'awaiting assessment is an open review');
eq(vault.lesionAllowsReviewDisposition(awaiting), true, 'awaiting assessment can be cleared');
eq(vault.lesionCanOpenFurtherManagement(awaiting), true, 'awaiting assessment can open a child');
eq(vault.lesionReviewDispositionCopy(awaiting).nfa, 'No further action', 'awaiting assessment NFA label');

const refer = {
    id: 'R1',
    plan: 'Refer / Specialist',
    type: 'none',
    managementStatus: 'awaiting_assessment',
    timeline: [],
    history: []
};
eq(vault.lesionReviewDispositionKind(refer), 'refer', 'refer is a referral review');
eq(vault.lesionReviewDispositionCopy(refer).nfa, 'Episode complete', 'refer NFA label');
eq(vault.deriveLesionStatusFromPlan(refer), 'awaiting_assessment', 'refer stays awaiting assessment');

const monitorOpen = {
    id: 'M1',
    plan: 'Monitor / Reassure (Benign)',
    type: 'none',
    monitorFollowUp: '3 months',
    managementStatus: 'awaiting_assessment'
};
eq(vault.isScheduledReviewLesion(monitorOpen), true, 'monitor with interval is a scheduled review');
eq(vault.deriveLesionStatusFromPlan(monitorOpen), 'awaiting_assessment', 'monitor with interval stays open');
eq(vault.lesionReviewDispositionKind(monitorOpen), 'scheduled', 'monitor interval kind is scheduled');
eq(vault.deriveLesionStatusFromPlan({ ...monitorOpen, monitorFollowUp: 'none' }), 'no_followup', 'monitor without interval still completes');

const declineReview = {
    id: 'D1',
    plan: 'Declines Treatment / Other',
    type: 'none',
    declineReview: '6 months',
    managementStatus: 'awaiting_assessment'
};
eq(vault.deriveLesionStatusFromPlan(declineReview), 'awaiting_assessment', 'decline with offered review stays open');
eq(vault.lesionReviewDispositionKind(declineReview), 'scheduled', 'decline review kind is scheduled');
eq(vault.deriveLesionStatusFromPlan({ ...declineReview, declineReview: 'none' }), 'no_followup', 'decline without review still completes');

const pdt = {
    id: 'P1',
    plan: 'Topical / Field Treatment',
    type: 'topical',
    topicalDecision: 'pdt',
    topicalFollowUp: 'none',
    pdtQuotedPrice: 450,
    pdtAreaName: 'Scalp'
};
eq(vault.hasOutstandingTopicalWork(pdt), true, 'quoted PDT is outstanding work');
eq(vault.deriveLesionStatusFromPlan(pdt), 'awaiting_assessment', 'quoted PDT stays open');
eq(vault.lesionReviewDispositionKind({ ...pdt, managementStatus: 'awaiting_assessment' }), 'topical', 'PDT review kind is topical');

const cryo = {
    id: 'C1',
    plan: 'Topical / Field Treatment',
    type: 'topical',
    topicalDecision: 'cryotherapy',
    topicalFollowUp: 'none',
    cryoRecallRepeat: true
};
eq(vault.hasOutstandingTopicalWork(cryo), true, 'cryo recall is outstanding work');
eq(vault.deriveLesionStatusFromPlan(cryo), 'awaiting_assessment', 'cryo recall stays open');

const topicalDeclinedFu = {
    id: 'TD1',
    plan: 'Topical / Field Treatment',
    type: 'topical',
    topicalDecision: 'declined',
    topicalFollowUp: '4 weeks'
};
eq(vault.deriveLesionStatusFromPlan(topicalDeclinedFu), 'topical_followup', 'topical declined with follow-up stays open');
eq(vault.deriveLesionStatusFromPlan({ ...topicalDeclinedFu, topicalFollowUp: 'none' }), 'no_followup', 'topical declined without follow-up completes');

const planned = {
    id: 'X1',
    plan: 'Formally Book Excision Procedure',
    type: 'excision',
    managementStatus: 'planned_procedure',
    timeline: [],
    history: []
};
eq(vault.lesionReviewDispositionKind(planned), 'cancel_plan', 'undone planned procedure is cancel_plan');
eq(vault.lesionCanOpenFurtherManagement(planned), true, 'cancelled plan can open further management');
eq(vault.lesionReviewDispositionCopy(planned).nfa, 'Cancel plan / no further action', 'cancel plan NFA label');

const punch = {
    id: 'H1',
    plan: 'Punch / Shave Biopsy',
    type: 'punch',
    procedureCompletedAt: '2026-10-01T00:00:00.000Z',
    managementStatus: 'awaiting_histology',
    histologyResult: '',
    timeline: [],
    history: []
};
eq(vault.lesionReviewDispositionKind(punch), 'no_result', 'done procedure without report is no_result');
eq(vault.lesionAllowsReviewDisposition(punch), true, 'no-result episode can be closed');
eq(vault.lesionCanOpenFurtherManagement(punch), false, 'no-result further management still needs histology');
eq(vault.lesionReviewDispositionCopy(punch).nfa, 'Close without result', 'no-result NFA label');

const inTheatre = { ...planned, id: 'TNOW', managementStatus: 'current_case' };
eq(vault.lesionAllowsReviewDisposition(inTheatre), false, 'current case has no review disposition');

const proposedTopical = {
    id: 'CH1',
    priorLesionId: 'P0',
    proposedPlan: 'topical',
    type: 'topical',
    plan: '',
    managementStatus: 'awaiting_assessment',
    timeline: [],
    history: []
};
eq(vault.lesionReviewDispositionKind(proposedTopical), 'open', 'proposed topical child stays an open review');
eq(vault.deriveLesionStatusFromPlan(proposedTopical), 'awaiting_assessment', 'undocumented topical child is not fake follow-up');

(async () => {
    global.managedLesions = [{ ...awaiting, timeline: [], history: [] }];
    const nfa = await vault.recordHistologyOutcome('A1', '', 'no_followup', '', { callNote: 'Nothing to treat' });
    eq(!!nfa?.closed, true, 'NFA closes awaiting assessment');
    eq(global.managedLesions[0].managementStatus, 'no_followup', 'awaiting assessment becomes no_followup');

    global.managedLesions = [{ ...refer, timeline: [], history: [], linkedChildId: '', linkedReexcisionId: '' }];
    const further = await vault.recordHistologyOutcome('R1', '', 'further_management', '', {
        proposedPlan: 'excision',
        allowWithoutHistology: true
    });
    eq(!!further?.spawnedManagement, true, 'refer further management spawns a child');
    eq(!!further?.needResult, false, 'refer does not need histology');
    const parent = global.managedLesions.find((item) => item.id === 'R1');
    eq(parent?.managementStatus, 'no_followup', 'refer parent episode is complete');

    global.managedLesions = [{ ...punch, timeline: [], history: [] }];
    const blocked = await vault.recordHistologyOutcome('H1', '', 'further_management', '', {});
    eq(!!blocked?.needResult, true, 'punch without a result is still blocked for further management');

    global.managedLesions = [{ ...punch, id: 'H2', timeline: [], history: [] }];
    const closedNoResult = await vault.recordHistologyOutcome('H2', '', 'no_followup', '', { callNote: 'Pot lost' });
    eq(!!closedNoResult?.closed, true, 'NFA closes an episode without a result');
    eq(global.managedLesions[0].managementStatus, 'no_followup', 'no-result NFA sets no_followup');

    global.managedLesions = [{ ...planned, timeline: [], history: [], linkedChildId: '', linkedReexcisionId: '' }];
    const cancel = await vault.recordHistologyOutcome('X1', '', 'no_followup', '', { callNote: 'Patient cancelled' });
    eq(!!cancel?.closed, true, 'NFA cancels a planned procedure');

    global.managedLesions = [{
        id: 'CH2',
        priorLesionId: 'P0',
        proposedPlan: 'topical',
        type: 'none',
        plan: '',
        managementStatus: 'needs_contact',
        timeline: [],
        history: []
    }];
    const advised = await vault.applyAdviceFromContact(global.managedLesions[0]);
    eq(!!advised?.changed, true, 'advising a proposed topical child updates it');
    eq(global.managedLesions[0].managementStatus, 'awaiting_assessment', 'proposed topical child stays awaiting assessment');
    eq(global.managedLesions[0].type, 'topical', 'proposed topical child keeps topical type');

    if (failed) {
        console.error('\n' + failed + ' failing check(s)');
        process.exit(1);
    }
    console.log('\nall lesion review disposition checks passed');
})().catch((err) => {
    console.error(err);
    process.exit(1);
});
