/* Node checks: chart-review notes list today's plan/note only. */
const {
    reviewEventIsToday,
    chartReviewTodayNotes,
    hasTodayReviewPlanEvent,
    chartReviewDisposition,
    chartReviewPlanLine,
    formatChartReviewLesionLines,
    formatChartReviewIdentityLines,
    formatChartReviewLesionBlock,
    formatChartReviewLesionsSection
} = require('../js/outputs.js');

let failed = 0;
function eq(actual, expected, label) {
    const ok = Object.is(actual, expected)
        || (actual && expected && typeof actual === 'object' && JSON.stringify(actual) === JSON.stringify(expected));
    if (!ok) {
        failed += 1;
        console.error('FAIL', label, { actual, expected });
    } else {
        console.log('ok', label);
    }
}

const now = '2026-10-20T10:00:00.000Z';
const todayNote = { type: 'note', at: '2026-10-20T09:10:00.000Z', note: 'Morning review — desk to phone after 10' };
const yesterdayNote = { type: 'note', at: '2026-10-19T09:10:00.000Z', note: 'Old note from yesterday' };
const todayPlan = { type: 'plan', at: '2026-10-20T09:12:00.000Z', note: '', planAfter: 'No follow-up' };

eq(reviewEventIsToday('2026-10-20T01:00:00.000Z', now), true, 'same local day is today');
eq(reviewEventIsToday('2026-10-19T23:00:00.000Z', now), false, 'previous day is not today');

const noted = {
    id: 'L1',
    location: 'Right cheek',
    plan: 'Formally Book Excision Procedure',
    impression: 'BCC',
    macroscopic: '6mm nodule',
    dermoscopy: 'Arborising vessels',
    length: '6',
    width: '6',
    priorHistologyDiagnosis: 'Nodular BCC',
    priorHistologyResult: 'Incompletely excised nodular BCC',
    timeline: [yesterdayNote, todayNote]
};
eq(chartReviewTodayNotes(noted, now), ['Morning review — desk to phone after 10'], 'only today notes');
eq(chartReviewPlanLine(noted, now), '', 'note-only does not reprint the old exam plan');
eq(formatChartReviewLesionLines(noted, now), ['Note: Morning review — desk to phone after 10'], 'note-only lines');
eq(formatChartReviewIdentityLines(noted).includes('Macroscopic: 6mm nodule'), true, 'identity includes macroscopic');
eq(formatChartReviewIdentityLines(noted).includes('Dermoscopic: Arborising vessels'), true, 'identity includes dermoscopy');
eq(formatChartReviewIdentityLines(noted).includes('Prior histology: Nodular BCC'), true, 'identity includes prior histology');
eq(formatChartReviewLesionBlock(noted, 1, now).includes('Macroscopic: 6mm nodule'), true, 'review block includes exam background');
eq(formatChartReviewLesionBlock(noted, 1, now).includes('Arborising vessels'), true, 'review block includes dermoscopy');
eq(formatChartReviewLesionBlock(noted, 1, now).includes('Nodular BCC'), true, 'review block includes prior histology');
eq(formatChartReviewLesionBlock(noted, 1, now).includes('Old note from yesterday'), false, 'review block omits yesterday notes');
eq(formatChartReviewLesionBlock(noted, 1, now).includes('Right cheek'), true, 'review block names the site');

const nfa = {
    id: 'L2',
    location: 'Left forearm',
    resultPlan: 'no_followup',
    managementStatus: 'no_followup',
    clinicallyFinalisedAt: '2026-10-20T09:12:00.000Z',
    plan: 'Punch / Shave Biopsy',
    macroscopic: 'pink plaque',
    timeline: [todayPlan, todayNote]
};
eq(chartReviewDisposition(nfa), 'No further action', 'NFA disposition');
eq(hasTodayReviewPlanEvent(nfa, now), true, 'today plan event detected');
eq(chartReviewPlanLine(nfa, now), 'No further action', 'NFA plan line');
eq(
    formatChartReviewLesionLines(nfa, now),
    ['Plan: No further action', 'Note: Morning review — desk to phone after 10'],
    'NFA plus today note'
);

const further = {
    id: 'L3',
    location: 'Scalp',
    resultPlan: 'further_management',
    proposedPlan: 'excision',
    proposedPlanNote: 'Book 4mm margin',
    timeline: [{ type: 'plan', at: '2026-10-20T09:30:00.000Z', note: '' }]
};
eq(chartReviewPlanLine(further, now), 'Needs further management', 'further management without a proposed-plan helper');
global.formatProposedManagementPlan = (lesion) => 'Proposed: Excision — ' + (lesion.proposedPlanNote || '');
eq(chartReviewPlanLine(further, now), 'Proposed: Excision — Book 4mm margin', 'further management uses proposed plan when helper exists');
delete global.formatProposedManagementPlan;

const createdToday = {
    id: 'L4',
    location: 'Nose',
    createdAt: '2026-10-20T08:00:00.000Z',
    plan: 'Awaiting Assessment',
    timeline: []
};
eq(chartReviewPlanLine(createdToday, now), 'Awaiting Assessment', 'lesion documented today can show its plan');

const stale = {
    id: 'L5',
    location: 'Back',
    resultPlan: 'no_followup',
    managementStatus: 'no_followup',
    clinicallyFinalisedAt: '2026-10-01T09:00:00.000Z',
    timeline: [yesterdayNote]
};
eq(chartReviewPlanLine(stale, now), '', 'old NFA without today action is omitted');
eq(formatChartReviewLesionBlock(stale, 1, now), '', 'untouched lesion is omitted from the review section');

const section = formatChartReviewLesionsSection([noted, nfa], now);
eq(section.includes('=== LESIONS REVIEWED TODAY ==='), true, 'section heading');
eq(section.includes('Arborising'), true, 'section includes dermoscopy so the site is identifiable');
eq(section.includes('6mm nodule'), true, 'section includes macroscopic');
eq(section.includes('Note: Morning review — desk to phone after 10'), true, 'section includes today note');
eq(section.includes('Plan: No further action'), true, 'section includes today plan');

if (failed) {
    console.error('\n' + failed + ' failing check(s)');
    process.exit(1);
}
console.log('\nall chart-review note checks passed');
