/* A pathology group is processed only when every lesion in it is ready. */
const {
    procedureGroupBillingReady,
    visitFinaliseBillingState,
    confirmSameDaySessionBilling
} = require('../js/billing.js');

let failed = 0;
function eq(actual, expected, label) {
    if (!Object.is(actual, expected)) {
        failed += 1;
        console.error('FAIL', label, { actual, expected });
    } else {
        console.log('ok', label);
    }
}

global.lesionType = (lesion) => lesion.type || '';
const day = '2026-11-22T01:00:00.000Z';
function biopsy(id, chartId, when) {
    return {
        id,
        chartId,
        type: 'shave',
        location: 'Cheek ' + id,
        procedureCompletedAt: when || day
    };
}

function excision(id, chartId, when) {
    return {
        id,
        chartId,
        type: 'excision',
        location: 'Back ' + id,
        impression: 'BCC',
        billingRegion: 3,
        excisionLengthMm: 8,
        excisionWidthMm: 6,
        excisionMarginMm: 3,
        procedureCompletedAt: when || day
    };
}

const punch = biopsy('b1', 'chart-a');
const waiting = excision('e1', 'chart-a');
global.managedLesions = [punch, waiting];

const mixed = procedureGroupBillingReady(punch);
eq(mixed.ok, false, 'a biopsy is held when an excision in the group is waiting on histology');
eq(mixed.hold, true, 'the mixed group is held together');
eq(mixed.reason.includes('whole group'), true, 'the reason says the group is billed together');

const heldVisit = visitFinaliseBillingState([punch, waiting]);
eq(heldVisit.mode, 'hold', 'finalise holds the visit when the group is not all ready');

const punches = [biopsy('p1', 'chart-b'), biopsy('p2', 'chart-b')];
global.managedLesions = punches;
const readyGroup = procedureGroupBillingReady(punches[0]);
eq(readyGroup.ok, true, 'a group of biopsies can be billed on the day');
const readyVisit = visitFinaliseBillingState(punches);
eq(readyVisit.mode, 'process', 'finalise processes a group that is entirely ready');
eq(readyVisit.lesions.length, 2, 'both biopsies are included');

const known = excision('e2', 'chart-c');
known.histologyDiagnosis = 'BCC';
known.histologyResult = 'Nodular BCC';
const withResult = [biopsy('p3', 'chart-c'), known];
global.managedLesions = withResult;
eq(procedureGroupBillingReady(withResult[0]).ok, true, 'a biopsy and an excision with a result are billed together');

const split = punches.concat([waiting]);
global.managedLesions = split;
const splitVisit = visitFinaliseBillingState(split);
eq(splitVisit.mode, 'process', 'a separate ready group can still be processed');
eq(splitVisit.lesions.length, 2, 'only the ready group is processed');
eq(splitVisit.lesions.every((item) => item.chartId === 'chart-b'), true, 'the waiting group is left out');

let persisted = 0;
global.persistProcessedBilling = () => { persisted += 1; return Promise.resolve(); };
global.managedLesions = [punch, waiting];
confirmSameDaySessionBilling([punch, waiting]).then(async (result) => {
    eq(result.confirmed, 0, 'a mixed group confirms nothing');
    eq(persisted, 0, 'a mixed group is not marked processed');
    const readyPair = [biopsy('r1', 'chart-d'), biopsy('r2', 'chart-d')];
    global.managedLesions = readyPair;
    global.billingForLesion = (id) => ({ id: 'bill-' + id, lesionId: id, status: 'awaiting' });
    global.billingHasBeenSent = () => false;
    let active = 0;
    let peak = 0;
    const flags = [];
    global.persistProcessedBilling = (bill, codes, extra) => {
        active += 1;
        peak = Math.max(peak, active);
        flags.push(!!(extra && extra.markProcessed));
        return new Promise((resolve) => setTimeout(() => {
            active -= 1;
            resolve();
        }, 30));
    };
    const processed = await confirmSameDaySessionBilling(readyPair, { markProcessed: true });
    eq(processed.confirmed, 2, 'both ready biopsies are saved');
    eq(peak, 2, 'the two billing saves run together');
    eq(flags.length, 2, 'each ready biopsy is saved once');
    eq(flags.every(Boolean), true, 'visit close marks them processed in that save');
    if (failed) {
        console.error(failed + ' failed');
        process.exit(1);
    }
    console.log('all billing-group hold checks passed');
}).catch((err) => {
    console.error(err);
    process.exit(1);
});
