/* Node checks: person, spot, and procedure numbers, plus the record upgrade. */
const {
    planRecordIdentityUpgrade,
    copySpotIdentityFromPrior,
    assignFreshSpotIdentity,
    nextSpotNumberForChart,
    consentEpisodeRefs,
    identityChartId,
    retargetLesionIdentity,
    personRecordMatches,
    conflictingChartForIdentity,
    stampLinkedPersonRecords
} = require('../js/lesion-vault.js');

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

let personSeq = 0;
function nextPersonId() {
    personSeq += 1;
    return 'person-' + personSeq;
}

const charts = [
    { id: 'chart-a', name: 'Jane Doe', dob: '01/01/1970' },
    { id: 'chart-b', name: 'John Roe', dob: '02/02/1980', personId: 'person-kept' }
];
const lesions = [
    { id: 'nose-a', chartId: 'chart-a', location: 'Left nose', createdAt: '2020-01-01' },
    { id: 'nose-b', chartId: 'chart-a', location: 'Right nose', createdAt: '2020-01-02' },
    { id: 'arm', chartId: 'chart-a', location: 'Forearm', createdAt: '2021-01-01', histologyBatchId: 'hb-1' },
    { id: 'arm-2', chartId: 'chart-a', location: 'Forearm', createdAt: '2021-06-01', priorLesionId: 'arm', histologyBatchId: 'hb-1' },
    { id: 'cheek', chartId: 'chart-a', location: 'Cheek', createdAt: '2022-01-01', linkedChildId: 'cheek-2', linkedReexcisionId: 'cheek-2' },
    { id: 'cheek-2', chartId: 'chart-a', location: 'Cheek', createdAt: '2022-02-01', priorLesionId: 'cheek' },
    { id: 'cheek-extra', chartId: 'chart-a', location: 'Cheek', createdAt: '2022-03-01', priorLesionId: 'cheek' },
    { id: 'loop-a', chartId: 'chart-a', location: 'Back', priorLesionId: 'loop-b' },
    { id: 'loop-b', chartId: 'chart-a', location: 'Back', priorLesionId: 'loop-a' },
    { id: 'orphan', chartId: 'chart-a', location: 'L Upper Back', priorLesionId: 'missing', patientName: 'Someone Else', patientDob: '03/03/1990', impression: 'BCC', histologyCaseNumber: 'S24-1', histologyDiagnosis: '', createdAt: '2024-03-12T00:00:00.000Z', currentPlan: 'Re-excision planned' },
    { id: 'other', chartId: 'chart-b', location: 'Ear', priorLesionId: 'arm' },
    { id: 'loose', location: 'Scalp' }
];

const plan = planRecordIdentityUpgrade(lesions, charts, { nextPersonId });
eq(plan.personAssignments.map((row) => row.chartId), ['chart-a'], 'only a chart without a person number is numbered');
eq(charts.find((chart) => chart.id === 'chart-b').personId, 'person-kept', 'an existing person number is not replaced');

function assigned(id) {
    return plan.lesionAssignments.find((row) => row.lesionId === id);
}
eq(assigned('nose-a').spotNumber === assigned('nose-b').spotNumber, false, 'the same site words stay separate spots');
eq(assigned('arm').spotNumber, assigned('arm-2').spotNumber, 'a linked episode keeps the spot');
eq(assigned('arm').episodeNumber, 1, 'the first episode is 1');
eq(assigned('arm-2').episodeNumber, 2, 'the next episode is 2');
eq(assigned('arm').procedureId, 'hb-1', 'a shared lab batch becomes the procedure number');
eq(assigned('arm-2').procedureId, 'hb-1', 'both episodes in that sitting share the procedure number');
eq(assigned('cheek').spotNumber, assigned('cheek-2').spotNumber, 'the linked child is the next episode');
eq(assigned('cheek-2').episodeNumber, 2, 'the linked child is episode 2');
eq(plan.skipped.some((row) => row.lesionId === 'cheek-extra'), true, 'an extra episode beside the link is left unchanged');
eq(plan.skipped.some((row) => row.lesionId === 'loop-a' && /circle/.test(row.reason)), true, 'a circle is left unchanged');
eq(plan.skipped.some((row) => row.lesionId === 'orphan'), true, 'a missing earlier episode is left unchanged');
const orphan = plan.skipped.find((row) => row.lesionId === 'orphan');
eq(orphan.attachedTo, 'Jane Doe · DOB 01/01/1970', 'a skipped lesion names the chart it is on');
eq(orphan.storedPatient, 'Someone Else · DOB 03/03/1990', 'a skipped lesion names the patient stored on it');
eq(orphan.location, 'L Upper Back', 'a skipped lesion keeps the site');
eq(orphan.diagnosis, 'BCC', 'a skipped lesion keeps the diagnosis');
eq(orphan.caseNumber, 'S24-1', 'a skipped lesion keeps the lab case');
eq(orphan.when, '12 Mar 2024', 'a skipped lesion keeps the date');
eq(orphan.plan, 'Re-excision planned', 'a skipped lesion keeps the plan');
eq(/not in the saved lesions/.test(orphan.reason), true, 'a missing earlier episode says it is not saved');
const other = plan.skipped.find((row) => row.lesionId === 'other');
eq(!!other, true, 'a link to another chart is left unchanged');
eq(other.attachedTo, 'John Roe · DOB 02/02/1980', 'the other-chart lesion names who it is attached to');
eq(other.reason.includes('Forearm') && other.reason.includes('Jane Doe'), true, 'the earlier episode names the other patient and site');
eq(plan.skipped.some((row) => row.lesionId === 'loose' && row.reason === 'This lesion is not attached to a chart.'), true, 'a lesion with no chart waits');
eq(plan.lesionAssignments.some((row) => row.lesionId === 'cheek-extra'), false, 'the extra episode is not numbered');

const again = planRecordIdentityUpgrade(lesions.map((lesion) => {
    const row = assigned(lesion.id);
    if (!row) return lesion;
    return { ...lesion, personId: row.personId, spotNumber: row.spotNumber, episodeNumber: row.episodeNumber, procedureId: row.procedureId || lesion.procedureId };
}), charts.map((chart) => ({ ...chart, personId: chart.personId || plan.personAssignments.find((row) => row.chartId === chart.id)?.personId })), { nextPersonId });
eq(again.personAssignments.length, 0, 'a second upgrade does not give new person numbers');
eq(again.lesionAssignments.length, 0, 'a second upgrade does not renumber clean spots');

const child = copySpotIdentityFromPrior({ id: 'new' }, { personId: 'person-1', spotNumber: 4, episodeNumber: 2 });
eq(child.spotNumber, 4, 'a new episode keeps the spot');
eq(child.episodeNumber, 3, 'a new episode takes the next number');
eq(child.procedureId, undefined, 'a new episode does not keep the old procedure');

const fresh = assignFreshSpotIdentity({ id: 'fresh', chartId: 'chart-a' }, { id: 'chart-a', personId: 'person-1' }, [
    { id: 'old', chartId: 'chart-a', spotNumber: 4 }
]);
eq(fresh.personId, 'person-1', 'a new spot takes the person number');
eq(fresh.spotNumber, 5, 'a new spot takes the next spot number');
eq(fresh.episodeNumber, 1, 'a new spot starts at episode 1');
eq(nextSpotNumberForChart('chart-a', [{ chartId: 'chart-a', spotNumber: 4 }]), 5, 'the next spot is one higher than the highest');

const refs = consentEpisodeRefs(
    [{ lesionId: 'arm' }, { lesionId: 'nose-a' }],
    [{ id: 'arm', personId: 'person-1', spotNumber: 3, episodeNumber: 2, procedureId: 'hb-1' }]
);
eq(refs[0].procedureId, 'hb-1', 'consent stores the procedure number beside the text');
eq(refs[0].spotNumber, 3, 'consent stores the spot number beside the text');
eq(refs[1].spotNumber, 0, 'a consent row without a match stores no spot');

global.managedCharts = [{ id: 'chart-new', personId: 'person-9', name: 'Jane Smith' }];
eq(identityChartId({
    chartId: 'jane doe|01011970',
    personId: 'person-9',
    patientName: 'Someone Else',
    patientDob: '03/03/1990'
}), 'chart-new', 'a missing chart id can still find the person');

const movedChart = { id: 'chart-b', personId: '' };
const moved = { id: 'moved', chartId: 'chart-b', priorLesionId: 'arm' };
const placed = retargetLesionIdentity(moved, movedChart, lesions);
eq(placed.chartChanged, true, 'moving onto a chart without a person number adds one');
eq(moved.personId, movedChart.personId, 'the moved lesion keeps that person number');
eq(moved.episodeNumber, 1, 'a moved lesion with no parent on that chart starts a spot');

const personChart = { id: 'chart-a', personId: 'person-1', name: 'Jane Doe', dob: '01/01/1970' };
const twin = { id: 'chart-twin', personId: 'person-8', firstName: 'Jane', lastName: 'Doe', dob: '01/01/1970' };
eq(!!conflictingChartForIdentity(personChart, [personChart, twin], 'Jane Doe', '01/01/1970'), true, 'another chart with the same name and date of birth is blocked');
eq(conflictingChartForIdentity(personChart, [personChart], 'Jane Doe', '02/02/1971'), null, 'the same chart can keep its own name and date of birth');

const linkedLesion = {
    id: 'cheek',
    chartId: 'chart-a',
    personId: 'person-1',
    patientName: 'Jane Doe',
    patientDob: '01/01/1970',
    patientPhone: '0400 000 000',
    spotNumber: 2,
    episodeNumber: 1,
    procedureId: 'proc-1',
    location: 'Left cheek'
};
const otherPerson = {
    id: 'other',
    chartId: 'chart-z',
    personId: 'person-z',
    patientName: 'Sam Lee',
    spotNumber: 1
};
global.managedLesions = [linkedLesion, otherPerson];
global.managedBillings = [{ id: 'bill-1', chartId: 'chart-a', personId: 'person-1', patientName: 'Jane Doe', patientDob: '01/01/1970', patientPhone: '0400 000 000' }];
global.managedVisitNotes = [];
global.managedConsents = [];
global.lesions = [];
const stamped = stampLinkedPersonRecords(personChart, {
    personId: 'person-1',
    name: 'Janet Doe',
    firstName: 'Janet',
    lastName: 'Doe',
    dob: '02/02/1971',
    phone: '0411 111 111'
});
eq(stamped.length, 2, 'the lesion and the bill are updated');
eq(linkedLesion.patientName, 'Janet Doe', 'the linked lesion takes the new name');
eq(linkedLesion.patientDob, '02/02/1971', 'the linked lesion takes the new date of birth');
eq(linkedLesion.patientPhone, '0411 111 111', 'the linked lesion takes the new phone');
eq(linkedLesion.personId, 'person-1', 'the person number stays the same');
eq(linkedLesion.spotNumber, 2, 'the spot number stays the same');
eq(linkedLesion.procedureId, 'proc-1', 'the procedure number stays the same');
eq(linkedLesion.chartId, 'chart-a', 'the chart link stays the same');
eq(otherPerson.patientName, 'Sam Lee', 'a different person is left alone');
eq(personRecordMatches({ personId: 'person-1', chartId: 'somewhere-else' }, personChart), true, 'a person number still matches after the chart id on a copy differs');

if (failed) {
    console.error('\n' + failed + ' failing check(s)');
    process.exit(1);
}
console.log('\nall record identity checks passed');
