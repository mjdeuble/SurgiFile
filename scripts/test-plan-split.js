/* Node checks: Declines treatment and Other are separate, and both can keep a review. */
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
eq(isOtherClinicalPlan('Other'), true, 'Other is its own plan');
eq(isOtherClinicalPlan('Declines treatment'), false, 'a refusal is not Other');
eq(lesionOpensAsOtherPlan({ plan: 'Other' }), true, 'a saved Other plan opens as Other');
eq(lesionOpensAsOtherPlan({ plan: 'Declines Treatment / Other', declineKind: 'other' }), true, 'an older other disposition opens as Other');
eq(lesionOpensAsOtherPlan({ plan: 'Declines treatment', declineKind: 'declines' }), false, 'a refusal stays a refusal');

eq(formatOtherPlanSummary({
    plan: 'Other',
    otherPlanNote: 'Dermatitis — emollient',
    otherFollowUp: '4 weeks'
}), 'Dermatitis — emollient — review in 4 weeks', 'Other with a review names the interval');
eq(formatOtherPlanSummary({
    plan: 'Other',
    otherPlanNote: 'Dermatitis — emollient',
    otherFollowUp: 'none'
}), 'Dermatitis — emollient', 'Other without a review prints the condition');
eq(formatDeclinePlanSummary({
    plan: 'Declines treatment',
    declineKind: 'declines',
    declineRecommended: ['excision'],
    declineReview: '6 months'
}), 'Declined Excision — review in 6 months', 'a refusal with a review names the interval');
eq(formatDeclinePlanSummary({
    plan: 'Declines treatment',
    declineKind: 'declines',
    declineRecommended: ['excision'],
    declineReview: 'none'
}), 'Declined Excision', 'a refusal without a review does not invent an interval');

const fresh = renderDeclinePlanFieldsHtml('', { plan: 'Declines treatment', declineReview: '3 months' }, false);
eq(fresh.includes('Other (document)'), false, 'a refusal form does not offer the old Other disposition');
eq(fresh.includes('Informed refusal'), true, 'the refusal form keeps the informed-refusal heading');
eq(fresh.includes('>Review<'), true, 'the refusal form has a review timeframe');
eq(fresh.includes('Review in 3 months') && fresh.includes('selected'), true, 'the saved refusal review stays selected');

const legacy = otherFieldsFromLesion({
    plan: 'Declines Treatment / Other',
    declineKind: 'other',
    declineOtherPlan: 'Think overnight',
    declineReview: '2 weeks'
});
eq(legacy.note, 'Think overnight', 'an older other note becomes the Other condition');
eq(legacy.follow, '2 weeks', 'an older other review becomes the Other review');

if (failed) {
    console.error('\n' + failed + ' failing check(s)');
    process.exit(1);
}
console.log('\nall plan split checks passed');
