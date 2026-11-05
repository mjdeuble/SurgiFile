/* Node checks: Declines treatment stays the refusal plan, and Other is a separate skin-condition plan. */
const fs = require('fs');
const vm = require('vm');

vm.runInThisContext(fs.readFileSync(require('path').join(__dirname, '../js/decline-plan.js'), 'utf8'), {
    filename: 'js/decline-plan.js'
});

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

eq(isDeclineTreatmentPlan('Declines treatment'), true, 'the separate decline plan is a refusal');
eq(isDeclineTreatmentPlan('Declines Treatment / Other'), true, 'an older combined plan is still a refusal');
eq(isDeclineTreatmentPlan('Other'), false, 'Other is not a refusal');
eq(isOtherClinicalPlan('Other'), true, 'Other is the skin-condition plan');
eq(isOtherClinicalPlan('Declines treatment'), false, 'a refusal is not the skin-condition plan');
eq(formatOtherPlanSummary({ plan: 'Other', otherPlanNote: 'Dermatitis — emollient' }), 'Dermatitis — emollient', 'Other prints the condition note');
eq(formatOtherPlanSummary({ plan: 'Other', otherPlanNote: 'Dermatitis — emollient', otherFollowUp: '4 weeks' }), 'Dermatitis — emollient — review in 4 weeks', 'Other with a review names the interval');
eq(formatOtherPlanSummary({ plan: 'Declines treatment', otherPlanNote: 'Dermatitis' }), '', 'a refusal does not print as Other');

const fresh = renderDeclinePlanFieldsHtml('', { plan: 'Declines treatment' }, false);
eq(fresh.includes('Other (document)'), false, 'a new refusal does not offer the old Other disposition');
eq(fresh.includes('Informed refusal'), true, 'the refusal form keeps the informed-refusal heading');

const legacy = renderDeclinePlanFieldsHtml('', { plan: 'Declines Treatment / Other', declineKind: 'other', declineOtherPlan: 'Think overnight' }, false);
eq(legacy.includes('Other plan already documented'), true, 'an older other disposition can still be opened');
eq(legacy.includes('Think overnight'), true, 'the older other note stays on the lesion');

if (failed) {
    console.error('\n' + failed + ' failing check(s)');
    process.exit(1);
}
console.log('\nall plan split checks passed');
