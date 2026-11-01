/* Lesion checker suggestions from notes, consents, bills, visit lists, and backups. */
const { reviewLesionChartMismatches } = require('../js/lesion-vault.js');

const JANE = 'jane doe|01011980';
const JOHN = 'john smith|02021970';
const charts = [
    { id: JANE, name: 'Jane Doe', firstName: 'Jane', lastName: 'Doe', dob: '01/01/1980' },
    { id: JOHN, name: 'John Smith', firstName: 'John', lastName: 'Smith', dob: '02/02/1970' }
];
const future = Date.now() + 24 * 60 * 60 * 1000;
const past = Date.now() - 24 * 60 * 60 * 1000;

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

function one(findings, id) {
    const hit = findings.find((item) => item.lesionId === id);
    if (!hit) {
        failed += 1;
        console.error('FAIL missing finding', id);
    }
    return hit;
}

const misplaced = {
    id: 'arm',
    patientName: 'John Smith',
    patientDob: '02/02/1970',
    chartId: JOHN,
    location: 'Left upper arm',
    impression: 'Basal cell carcinoma',
    histologyCaseNumber: 'S24-100',
    managementStatus: 'awaiting_histology'
};

const fromBill = reviewLesionChartMismatches({
    lesions: [misplaced],
    charts,
    bills: [{ lesionId: 'arm', chartId: JANE, patientName: 'Jane Doe', patientDob: '01/01/1980' }],
    now: Date.now()
});
const billHit = one(fromBill, 'arm');
eq(billHit && billHit.suggestions.length, 1, 'billing disagreement gives one suggestion');
eq(billHit && billHit.suggestions[0].chartId, JANE, 'billing suggestion is Jane');
eq(billHit && billHit.current.chartId, JOHN, 'current chart stays John');
eq(billHit && billHit.suggestions[0].reasons[0], 'A billing record is filed on this chart', 'billing reason is shown');

const fromNote = reviewLesionChartMismatches({
    lesions: [misplaced],
    charts,
    notes: [{
        chartId: JANE,
        patientName: 'Jane Doe',
        patientDob: '01/01/1980',
        expiresAt: new Date(future).toISOString(),
        consultText: 'Left upper arm. Basal cell carcinoma. Case S24-100.'
    }],
    now: Date.now()
});
eq(one(fromNote, 'arm').suggestions[0].chartId, JANE, 'visit note that names the site and diagnosis suggests Jane');

const expired = reviewLesionChartMismatches({
    lesions: [misplaced],
    charts,
    notes: [{
        chartId: JANE,
        expiresAt: new Date(past).toISOString(),
        consultText: 'Left upper arm. Basal cell carcinoma. Case S24-100.'
    }],
    now: Date.now()
});
eq(expired.length, 0, 'an expired visit note is ignored');

const shortSite = reviewLesionChartMismatches({
    lesions: [{ ...misplaced, id: 'nose', location: 'Nose' }],
    charts,
    notes: [{
        chartId: JANE,
        expiresAt: new Date(future).toISOString(),
        consultText: 'Nose. Basal cell carcinoma.'
    }],
    now: Date.now()
});
eq(shortSite.length, 0, 'a short site name in a note is not enough');

const conflict = reviewLesionChartMismatches({
    lesions: [misplaced],
    charts,
    notes: [
        {
            chartId: JANE,
            expiresAt: new Date(future).toISOString(),
            consultText: 'Left upper arm Basal cell carcinoma'
        },
        {
            chartId: JOHN,
            expiresAt: new Date(future).toISOString(),
            consultText: 'Left upper arm Basal cell carcinoma'
        }
    ],
    now: Date.now()
});
eq(one(conflict, 'arm').suggestions.length, 1, 'a note on the current chart is not a second suggestion');

const bothWays = reviewLesionChartMismatches({
    lesions: [{ ...misplaced, chartId: 'nobody|01011900', patientName: 'Nobody', patientDob: '01/01/1900' }],
    charts,
    notes: [
        {
            chartId: JANE,
            expiresAt: new Date(future).toISOString(),
            consultText: 'Left upper arm Basal cell carcinoma'
        },
        {
            chartId: JOHN,
            expiresAt: new Date(future).toISOString(),
            consultText: 'Left upper arm Basal cell carcinoma'
        }
    ],
    now: Date.now()
});
eq(one(bothWays, 'arm').suggestions.length, 2, 'two different note charts are both offered');

const child = {
    id: 'child',
    priorLesionId: 'arm',
    patientName: 'John Smith',
    patientDob: '02/02/1970',
    chartId: JOHN,
    location: 'Left upper arm',
    managementStatus: 'planned_procedure'
};
const parent = { ...misplaced, chartId: JANE, patientName: 'Jane Doe', patientDob: '01/01/1980' };
const linked = reviewLesionChartMismatches({
    lesions: [parent, child],
    charts,
    now: Date.now()
});
eq(linked.some((item) => item.lesionId === 'arm'), false, 'the parent already on Jane is not listed');
eq(one(linked, 'child').suggestions[0].chartId, JANE, 'planned child follows the earlier lesion');

const fromConsent = reviewLesionChartMismatches({
    lesions: [misplaced],
    charts,
    consents: [{
        chartId: JANE,
        lesionIds: ['arm'],
        expiresAt: new Date(future).toISOString()
    }],
    now: Date.now()
});
eq(one(fromConsent, 'arm').suggestions[0].reasons[0], 'A saved consent on this chart includes this lesion', 'consent id is a reason');

const fromVisit = reviewLesionChartMismatches({
    lesions: [misplaced],
    charts: charts.map((chart) => chart.id === JANE
        ? { ...chart, visitSession: { visitLesionIds: ['arm'] } }
        : chart),
    now: Date.now()
});
eq(one(fromVisit, 'arm').suggestions[0].chartId, JANE, 'a visit list on Jane suggests Jane');

const fromBackup = reviewLesionChartMismatches({
    lesions: [misplaced],
    charts,
    priorCopies: [{ id: 'arm', chartId: JANE, patientName: 'Jane Doe', patientDob: '01/01/1980' }],
    now: Date.now()
});
eq(one(fromBackup, 'arm').suggestions[0].reasons.join(' '), 'An earlier saved copy of this lesion is on this chart', 'backup copy is a reason');

const same = reviewLesionChartMismatches({
    lesions: [{ ...misplaced, chartId: JANE, patientName: 'Jane Doe', patientDob: '01/01/1980' }],
    charts,
    bills: [{ lesionId: 'arm', chartId: JANE, patientName: 'Jane Doe', patientDob: '01/01/1980' }],
    now: Date.now()
});
eq(same.length, 0, 'a lesion already on the billing chart is left off the list');

if (failed) {
    console.error(failed + ' check(s) failed');
    process.exit(1);
}
console.log('lesion checker checks passed');
