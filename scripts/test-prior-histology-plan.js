/* Node checks: previous histology is independent of management plan. */
const fs = require('fs');
const path = require('path');
const {
    FORMAL_EXCISION_PLAN,
    CONFIRMED_HISTOLOGY_EXCISION_PLAN,
    EXCISION_AFTER_PRIOR_HISTOLOGY_PLAN,
    isConfirmedHistologyExcisionPlan,
    isExcisionBookingPlan,
    formPlanValue,
    lesionUsesCopiedPriorHistology,
    emptyCopiedPriorHistology,
    copiedPriorHistologyForSave,
    copiedPriorHistologyHasData,
    currentPlanAfterCopiedPrior,
    formatExamPlanBadge
} = require('../js/skin-check.js');

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

eq(isConfirmedHistologyExcisionPlan(CONFIRMED_HISTOLOGY_EXCISION_PLAN), true, 'legacy plan still recognised');
eq(isExcisionBookingPlan(CONFIRMED_HISTOLOGY_EXCISION_PLAN), true, 'legacy plan still books excision');
eq(isExcisionBookingPlan(FORMAL_EXCISION_PLAN), true, 'formal excision still books excision');
eq(isExcisionBookingPlan('Awaiting Assessment'), false, 'awaiting is not excision');
eq(formPlanValue(CONFIRMED_HISTOLOGY_EXCISION_PLAN), FORMAL_EXCISION_PLAN, 'legacy plan maps to formal excision on the form');
eq(formPlanValue('Awaiting Assessment'), 'Awaiting Assessment', 'awaiting plan is unchanged');
eq(formPlanValue('Monitor / Reassure (Benign)'), 'Monitor / Reassure (Benign)', 'monitor plan is unchanged');
eq(formPlanValue('Punch / Shave Biopsy'), 'Punch / Shave Biopsy', 'biopsy plan is unchanged');

const prior = {
    priorHistologyDiagnosis: 'BCC',
    priorHistologyResult: 'Nodular BCC, involved margin',
    plan: 'Awaiting Assessment'
};
eq(lesionUsesCopiedPriorHistology(prior), true, 'copied prior histo is detected without an excision plan');
eq(formPlanValue(prior.plan), 'Awaiting Assessment', 'copied prior histo does not force excision');
eq(lesionUsesCopiedPriorHistology({ ...prior, priorLesionId: 'parent-1' }), false, 'DermRecord child lesions are not treated as copied-in histo');
eq(lesionUsesCopiedPriorHistology({ plan: 'Formally Book Excision Procedure' }), false, 'excision without prior fields is not copied histo');

const collected = {
    priorHistologyDiagnosis: 'SCC',
    priorHistologyResult: 'Well differentiated SCC',
    priorHistologyCaseNumber: 'S26-1',
    priorHistologyPot: '1',
    priorProcedureKind: 'punch',
    priorProcedureAt: '2026-01-01',
    priorHistologySource: 'own_notes',
    priorHistologySourceName: '',
    priorBreslowMm: ''
};
eq(copiedPriorHistologyForSave(true, collected), collected, 'enabled checkbox keeps the copied fields');
eq(copiedPriorHistologyForSave(false, collected), emptyCopiedPriorHistology(), 'disabled checkbox clears copied fields');
eq(copiedPriorHistologyForSave(false, collected, { keepInherited: true }), null, 'child lesions keep inherited prior fields');
eq(copiedPriorHistologyHasData(collected), true, 'payload with diagnosis counts as data');
eq(copiedPriorHistologyHasData(emptyCopiedPriorHistology()), false, 'empty payload has no data');

eq(
    currentPlanAfterCopiedPrior(FORMAL_EXCISION_PLAN, true, ''),
    EXCISION_AFTER_PRIOR_HISTOLOGY_PLAN,
    'excision + prior histo stamps the excision currentPlan'
);
eq(
    currentPlanAfterCopiedPrior('Monitor / Reassure (Benign)', true, EXCISION_AFTER_PRIOR_HISTOLOGY_PLAN),
    '',
    'leaving excision clears the prior-histo excision currentPlan'
);
eq(
    currentPlanAfterCopiedPrior('Awaiting Assessment', true, ''),
    undefined,
    'non-excision plans keep their own currentPlan'
);

eq(
    formatExamPlanBadge({ plan: 'Awaiting Assessment', priorHistologyDiagnosis: 'BCC' }),
    'Awaiting Assessment · prior histology',
    'badge keeps awaiting plan and notes prior histology'
);
eq(
    formatExamPlanBadge({ plan: 'Monitor / Reassure (Benign)', priorHistologyResult: 'BCC' }),
    'Monitor / Reassure (Benign) · prior histology',
    'badge keeps monitor plan'
);
eq(
    formatExamPlanBadge({ plan: 'Punch / Shave Biopsy', biopsyType: 'Punch Biopsy', priorHistologyDiagnosis: 'BCC' }),
    'Punch / Shave Biopsy (Punch Biopsy) · prior histology',
    'badge keeps biopsy plan'
);
eq(
    formatExamPlanBadge({ plan: CONFIRMED_HISTOLOGY_EXCISION_PLAN, priorHistologyDiagnosis: 'BCC' }),
    FORMAL_EXCISION_PLAN + ' · prior histology',
    'legacy confirmed-histo plan displays as formal excision plus prior histology'
);
eq(
    formatExamPlanBadge({ plan: FORMAL_EXCISION_PLAN, priorLesionId: 'parent-1', priorHistologyDiagnosis: 'BCC' }),
    'Re-excision',
    'child lesions still show as re-excision'
);

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
eq(html.includes('id="priorHistologyEnabled"'), true, 'add-lesion checkbox exists');
eq(html.includes('Histology already confirmed — book excision'), false, 'dedicated confirmed-histo plan option removed from add-lesion');
eq(html.includes('Choose any management plan above'), true, 'histo copy no longer tells the user to book excision');

const chart = fs.readFileSync(path.join(__dirname, '..', 'js/chart.js'), 'utf8');
eq(chart.includes('id="inspPriorHistologyEnabled"'), true, 'inspector checkbox exists');
eq(chart.includes('Histology already confirmed — book excision'), false, 'dedicated confirmed-histo plan option removed from inspector');
eq(chart.includes('lesionHasCopiedPriorHistology(lesion))))'), false, 'inspector no longer forces plan from copied prior histo');

if (failed) {
    console.error('\n' + failed + ' failing check(s)');
    process.exit(1);
}
console.log('\nall prior-histology plan checks passed');
