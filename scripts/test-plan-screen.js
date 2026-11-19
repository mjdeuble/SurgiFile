/* Node checks: booked-procedure inspector vs a treatment review. */
const vault = require('../js/lesion-vault.js');

global.escapeHtml = (str) => String(str ?? '').replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
}[ch]));
global.lesionType = (lesion) => lesion?.type || '';
global.lesionProcedureDone = (lesion) => !!(lesion?.procedureCompletedAt || lesion?.excisionFinalisedAt);
global.lesionHasSavedHistology = (lesion) => !!String(lesion?.histologyResult || '').trim();
global.isTopicalPlan = (plan) => String(plan || '').includes('Topical');
global.isDeclineTreatmentPlan = (plan) => /Declines Treatment/i.test(String(plan || ''));
global.isMonitorLesionPlan = vault.isMonitorLesionPlan;
global.lesionReviewDispositionKind = vault.lesionReviewDispositionKind;
global.lesionAllowsReviewDisposition = vault.lesionAllowsReviewDisposition;
global.lesionReviewDispositionCopy = vault.lesionReviewDispositionCopy;
global.isTopicalFollowUpLesion = vault.isTopicalFollowUpLesion;
global.lesionLifecycleStatus = vault.lesionLifecycleStatus;
global.localStorage = { getItem: () => null, setItem() {} };
global.document = {
    getElementById: () => null,
    querySelector: () => null,
    querySelectorAll: () => []
};

const management = require('../js/management.js');
global.lesionAlreadyClinicallyFinalised = management.lesionAlreadyClinicallyFinalised;
const chart = require('../js/chart.js');

let failed = 0;
function eq(actual, expected, label) {
    if (actual !== expected) {
        failed += 1;
        console.error('FAIL', label, { actual, expected });
    } else {
        console.log('ok', label);
    }
}
function has(html, text, label) {
    const ok = String(html).includes(text);
    if (!ok) {
        failed += 1;
        console.error('FAIL', label, 'missing', text);
    } else {
        console.log('ok', label);
    }
}
function lacks(html, text, label) {
    const ok = !String(html).includes(text);
    if (!ok) {
        failed += 1;
        console.error('FAIL', label, 'unexpected', text);
    } else {
        console.log('ok', label);
    }
}

const booked = {
    id: 'book-1',
    plan: 'Formally Book Excision Procedure',
    type: 'excision',
    managementStatus: 'planned_procedure',
    excisionClosureType: 'Flap',
    priorHistologyDiagnosis: 'BCC',
    priorHistologyResult: 'Margins involved',
    length: '10',
    width: '12',
    margin: '3'
};
const planCard = management.renderInspectorPlanCard(booked);
has(planCard, 'Change plan', 'booked plan card keeps Change plan');
has(planCard, 'Cancel plan', 'booked plan card offers Cancel plan');
has(planCard, 'Histology is recorded after this procedure is completed.', 'booked plan card still says histology comes after the procedure');
lacks(planCard, 'Needs further management', 'booked plan card has no further-management choice');

const notes = chart.renderInspectorPlanContactForm(booked);
eq(chart.inspectorCanSetResultPlan(booked), false, 'a booked procedure has no second plan choice');
has(notes, '<div class="insp-card-head">Notes</div>', 'the lower block is notes');
has(notes, 'Add note', 'the lower block saves a note');
has(notes, 'submitInspectorLesionNote()', 'a note uses its own save');
lacks(notes, 'Save plan', 'a booked procedure has no plan save on the note');
lacks(notes, 'insp-label">Add note', 'the entry box has no Add note heading');
global.renderLesionNotesListHtml = management.renderLesionNotesListHtml;
const noted = chart.renderInspectorPlanContactForm({
    id: 'note-1',
    plan: 'Formally Book Excision Procedure',
    type: 'excision',
    managementStatus: 'planned_procedure',
    timeline: [{ id: 'n1', type: 'note', at: '2026-11-19T05:19:00.000Z', note: 'Excision booked' }]
});
const noteListAt = noted.indexOf('lesion-timeline');
const noteBoxAt = noted.indexOf('id="inspLesionNote"');
eq(noteListAt !== -1 && noteListAt < noteBoxAt, true, 'recorded notes sit above the entry box');
lacks(noted, 'insp-label">Notes', 'the notes list has no second Notes heading');
lacks(notes, 'inspHistologyNext', 'the lower block has no outcome radios');
lacks(notes, 'Needs further management', 'the lower block does not offer further management');

const topical = {
    id: 'top-1',
    plan: 'Topical / Field Treatment',
    type: 'topical',
    topicalDecision: 'pdt',
    topicalFollowUp: 'none',
    pdtQuotedPrice: 450,
    pdtAreaName: 'Scalp',
    managementStatus: 'awaiting_assessment'
};
const topicalForm = chart.renderInspectorPlanContactForm(topical);
has(topicalForm, '<div class="insp-card-head">This review</div>', 'a topical review is titled This review');
has(topicalForm, 'Cleared / no further action', 'a topical review can be cleared');
has(topicalForm, 'Needs further management', 'a topical review can still need further management');
has(topicalForm, 'submitInspectorManageLesion()', 'the review saves the plan on its own');
has(topicalForm, 'submitInspectorLesionNote()', 'the review adds a note on its own');
const planCardAt = topicalForm.indexOf('id="inspPlanContactCard"');
const notesCardAt = topicalForm.indexOf('id="inspLesionNotesCard"');
eq(planCardAt !== -1 && notesCardAt > planCardAt, true, 'the notes card sits apart from the plan card');
lacks(topicalForm.slice(planCardAt, notesCardAt), 'inspLesionNote', 'the plan card does not contain the note box');
eq((topicalForm.match(/This review/g) || []).length, 1, 'This review is not repeated as a second heading');

const monitor = {
    id: 'mon-1',
    plan: 'Monitor / Reassure (Benign)',
    type: 'none',
    monitorFollowUp: '3 months',
    managementStatus: 'awaiting_assessment'
};
const monitorForm = chart.renderInspectorPlanContactForm(monitor);
has(monitorForm, '<div class="insp-card-head">This review</div>', 'a scheduled review is titled This review');
has(monitorForm, 'Needs further management', 'a scheduled review keeps both outcomes');

const signed = {
    id: 'res-1',
    plan: 'Formally Book Excision Procedure',
    type: 'excision',
    procedureCompletedAt: '2026-10-01T00:00:00.000Z',
    histologyResult: 'BCC, margins clear',
    managementStatus: 'needs_contact'
};
const resultForm = chart.renderInspectorPlanContactForm(signed);
has(resultForm, 'Clinical plan', 'histology sign-off still shows Clinical plan');
has(resultForm, 'Needs further management', 'histology sign-off still offers further management');

const noResult = {
    id: 'nr-1',
    plan: 'Punch / Shave Biopsy',
    type: 'punch',
    procedureCompletedAt: '2026-10-01T00:00:00.000Z',
    histologyResult: '',
    managementStatus: 'awaiting_histology'
};
const noResultForm = chart.renderInspectorPlanContactForm(noResult);
has(noResultForm, 'Review plan', 'a finished procedure without a report keeps Review plan');
has(noResultForm, 'Close without result', 'a finished procedure without a report can close');
has(noResultForm, 'Needs further management', 'a finished procedure without a report still offers further management');

if (failed) {
    console.error('\n' + failed + ' failing check(s)');
    process.exit(1);
}
console.log('\nall plan screen checks passed');
