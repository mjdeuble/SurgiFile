/* Node checks: CHA2DS2-VASc score and DOAC-hold consent wording. */
const chads = require('../js/chads-vasc.js');

let failed = 0;
function eq(actual, expected, label) {
    const ok = Object.is(actual, expected)
        || (typeof actual === 'number' && typeof expected === 'number' && Math.abs(actual - expected) < 1e-9);
    if (!ok) {
        failed += 1;
        console.error('FAIL', label, { actual, expected });
    } else {
        console.log('ok', label);
    }
}

function ok(cond, label) {
    if (!cond) {
        failed += 1;
        console.error('FAIL', label);
    } else {
        console.log('ok', label);
    }
}

eq(chads.parseChadsAgeFromDob('02/03/1954'), 72, 'age from AU DOB');
eq(chads.chadsAgePoints(64), 0, 'under 65 is 0');
eq(chads.chadsAgePoints(65), 1, '65–74 is 1');
eq(chads.chadsAgePoints(75), 2, '75+ is 2');

const female75 = {
    sex: 'female',
    age: 75,
    hf: true,
    htn: true,
    diabetes: false,
    stroke: false,
    vascular: false,
    indication: 'af',
    drug: 'rivaroxaban',
    holdDays: 3
};
eq(chads.chadsScoreFromFactors(female75), 5, 'female 75 + HF + HTN = 5');
eq(chads.chadsAnnualStrokePct(5), 7.2, 'score 5 annual rate');

const risk = chads.chadsHoldRisk(female75);
eq(risk.score, 5, 'hold risk keeps score');
ok(Math.abs(risk.holdPct - (7.2 * 3 / 365)) < 1e-9, 'hold risk is annual prorated over days');
ok(risk.oneIn.indexOf('1 in') !== -1, 'one-in wording is produced');

const lines = chads.formatChadsConsentLines(female75);
eq(lines.length, 1, 'AF calculation produces consent text');
ok(lines[0].indexOf('rivaroxaban') !== -1, 'consent names rivaroxaban');
ok(lines[0].indexOf('CHA₂DS₂-VASc') !== -1, 'consent names the score');
ok(lines[0].indexOf('Score 5') !== -1, 'consent includes the score');
ok(lines[0].indexOf('3 days') !== -1, 'consent includes hold days');

eq(chads.formatChadsConsentLines({ ...female75, indication: 'vte' }).length, 0, 'VTE does not emit a CHA2DS2-VASc consent paragraph');
eq(chads.chadsCalculationReady({ ...female75, sex: '' }), false, 'sex is required');
eq(chads.chadsCalculationReady(female75), true, 'complete AF factors are ready');

const male64 = {
    sex: 'male',
    age: 64,
    indication: 'af',
    holdDays: 2,
    drug: 'apixaban'
};
eq(chads.chadsScoreFromFactors(male64), 0, 'male under 65 with no factors is 0');
ok(chads.formatChadsConsentLines(male64)[0].indexOf('apixaban') !== -1, 'consent can name another DOAC');

if (failed) {
    console.error('\n' + failed + ' failing check(s)');
    process.exit(1);
}
console.log('\nall CHA2DS2-VASc checks passed');
