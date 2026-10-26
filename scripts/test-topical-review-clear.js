/* Node checks: topical follow-up can be cleared or opened as a child without histology. */
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
global.lesionType = (lesion) => lesion?.type || '';
global.lesionHasSavedHistology = (lesion) => !!String(lesion?.histologyResult || '').trim();
global.lesionProcedureDone = (lesion) => !!(lesion?.procedureCompletedAt || lesion?.excisionFinalisedAt);
global.formatProposedManagementPlan = (lesion) => {
    const key = String(lesion?.proposedPlan || '').trim();
    if (key === 'excision') return 'Proposed: Excision';
    if (key === 'topical') return 'Proposed: Topical / field treatment';
    if (key === 'biopsy') return 'Proposed: Biopsy';
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

const topical = {
    id: 'T1',
    plan: 'Topical / Field Treatment',
    type: 'topical',
    topicalFollowUp: '4 weeks',
    topicalDecision: 'efudix',
    managementStatus: 'topical_followup',
    location: 'Forehead',
    macroscopic: 'field change',
    timeline: [],
    history: []
};
eq(vault.isTopicalFollowUpLesion(topical), true, 'topical with follow-up needs a review disposition');
eq(vault.lesionShowsNextStepPlan(topical), true, 'topical review shows clear / next episode');
eq(vault.lesionReviewDispositionCopy(topical).nfa, 'Clear — no further treatment', 'topical clear label');
eq(vault.lesionReviewDispositionCopy(topical).further, 'Open next episode', 'topical next-episode label');
eq(vault.lesionCanOpenFurtherManagement(topical), true, 'topical follow-up can open further management without histology');
eq(vault.lesionOwnProcedureKind(topical), 'topical / field treatment', 'topical kind label');
eq(vault.deriveLesionStatusFromPlan(topical), 'topical_followup', 'follow-up still derives topical_followup');

const none = { ...topical, topicalFollowUp: 'none', managementStatus: 'no_followup' };
eq(vault.isTopicalFollowUpLesion(none), false, 'no scheduled follow-up is not a review lesion');

const punch = {
    id: 'P1',
    plan: 'Punch / Shave Biopsy',
    type: 'punch',
    procedureCompletedAt: '2026-10-01T00:00:00.000Z',
    managementStatus: 'awaiting_histology',
    histologyResult: '',
    timeline: [],
    history: []
};
eq(vault.lesionCanOpenFurtherManagement(punch), false, 'procedure without a result still needs histology');

eq(vault.isTopicalFollowUpLesion({
    ...topical,
    linkedChildId: 'C1',
    managementStatus: 'no_followup'
}), false, 'already-linked topical parent is not waiting for review');

(async () => {
    global.managedLesions = [{ ...topical, timeline: [], history: [] }];
    const nfa = await vault.recordHistologyOutcome('T1', '', 'no_followup', '', { callNote: 'Field clear' });
    eq(!!nfa?.closed, true, 'NFA closes the topical review');
    eq(global.managedLesions[0].managementStatus, 'no_followup', 'NFA sets no_followup');
    eq(!!global.managedLesions[0].clinicallyFinalisedAt, true, 'NFA stamps clinically finalised');

    global.managedLesions = [{
        ...topical,
        id: 'T2',
        timeline: [],
        history: [],
        linkedChildId: '',
        linkedReexcisionId: ''
    }];
    const further = await vault.recordHistologyOutcome('T2', '', 'further_management', '', {
        proposedPlan: 'excision',
        proposedPlanNote: 'Book after incomplete field',
        allowWithoutHistology: true
    });
    eq(!!further?.spawnedManagement, true, 'further management spawns a child');
    eq(!!further?.openChildId, true, 'child id is returned');
    eq(!!further?.needResult, false, 'no histology gate on topical review');
    const parent = global.managedLesions.find((item) => item.id === 'T2');
    const child = global.managedLesions.find((item) => item.id === further.openChildId);
    eq(!!parent?.linkedChildId, true, 'parent is linked to the child');
    eq(parent?.managementStatus, 'no_followup', 'parent episode is complete');
    eq(!!child, true, 'child exists');
    eq(child?.priorLesionId, 'T2', 'child points at the topical parent');
    eq(child?.proposedPlan, 'excision', 'child keeps the proposed plan');

    global.managedLesions = [{ ...punch, timeline: [], history: [] }];
    const blocked = await vault.recordHistologyOutcome('P1', '', 'further_management', '', {});
    eq(!!blocked?.needResult, true, 'punch without a result is still blocked');

    if (failed) {
        console.error('\n' + failed + ' failing check(s)');
        process.exit(1);
    }
    console.log('\nall topical review clear checks passed');
})().catch((err) => {
    console.error(err);
    process.exit(1);
});
