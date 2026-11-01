/* Lesions in results and planned-procedure queues stay on the chart that owns them. */
const {
    chartIdForName,
    lesionChartId,
    lesionBelongsToOpenChart,
    recordAttachmentChartId,
    attachmentPatientIdentity,
    lesionSaveIdentity,
    lesionChildIdentity,
    lesionChartRepair,
    sessionPatientSnapshot
} = require('../js/lesion-vault.js');

const JANE = 'jane doe|01011980';
const JOHN = 'john smith|02021970';
const JANE_DOB = '01/01/1980';
const JOHN_DOB = '02/02/1970';

global.managedCharts = [
    { id: JANE, name: 'Jane Doe', firstName: 'Jane', lastName: 'Doe', dob: JANE_DOB, phone: '0400 000 001' },
    { id: JOHN, name: 'John Smith', firstName: 'John', lastName: 'Smith', dob: JOHN_DOB, phone: '0400 000 002' }
];

const parent = {
    id: 'lesion-parent',
    patientName: 'Jane Doe',
    patientDob: JANE_DOB,
    chartId: JANE,
    managementStatus: 'awaiting_histology',
    location: 'Left cheek'
};
const planned = {
    id: 'lesion-planned',
    priorLesionId: 'lesion-parent',
    patientName: 'Jane Doe',
    patientDob: JANE_DOB,
    chartId: JOHN,
    managementStatus: 'planned_procedure',
    location: 'Left cheek'
};
const commaNamed = {
    id: 'lesion-comma',
    patientName: 'Doe, Jane',
    patientDob: JANE_DOB,
    chartId: 'doe, jane|' + '01011980',
    managementStatus: 'awaiting_histology',
    location: 'Right arm'
};
const otherJane = {
    id: 'lesion-other-jane',
    patientName: 'Jane Doe',
    patientDob: '03/03/1990',
    chartId: 'jane doe|03031990',
    managementStatus: 'awaiting_histology',
    location: 'Back'
};

global.managedLesions = [parent, planned, commaNamed, otherJane];
global.currentPatient = { name: '', dob: '', phone: '', chartId: '' };
global.document = {
    getElementById() {
        throw new Error('leftover patient name was read');
    }
};

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

eq(lesionChartId(planned), JANE, 'planned child follows the parent chart, not the stamped name');
eq(lesionChartId(parent), JANE, 'awaiting-result parent stays on its own chart');
eq(lesionChartId(commaNamed), JANE, 'Smith, Jane and Jane Doe with the same date of birth are one chart');
eq(lesionChartId(otherJane), 'jane doe|03031990', 'same name with a different date of birth stays separate');

global.currentPatient = { name: 'John Smith', dob: JOHN_DOB, chartId: JOHN };
eq(lesionBelongsToOpenChart(planned), false, 'planned lesion is not listed on the stamped chart');
global.currentPatient = { name: 'Jane Doe', dob: JANE_DOB, chartId: JANE };
eq(lesionBelongsToOpenChart(planned), true, 'planned lesion is listed on the parent chart');
eq(lesionBelongsToOpenChart(commaNamed), true, 'comma-named result is listed on Jane\'s chart');

eq(recordAttachmentChartId({ lesionId: 'lesion-planned', chartId: JOHN, patientName: 'John Smith', patientDob: JOHN_DOB }), JANE, 'billing row follows the lesion, not the copied name');
eq(attachmentPatientIdentity(planned).name, 'Jane Doe', 'queue heading uses the owning chart name');
eq(attachmentPatientIdentity(planned).dob, JANE_DOB, 'queue heading uses the owning chart date of birth');
eq(chartIdForName('Doe, Jane', JANE_DOB), JANE, 'name lookup finds the chart stored as First Last');

const stamped = {
    id: 'lesion-stamped',
    priorLesionId: 'lesion-parent',
    patientName: 'John Smith',
    patientDob: JOHN_DOB,
    chartId: JOHN,
    managementStatus: 'planned_procedure',
    location: 'Left cheek'
};
global.managedLesions.push(stamped);
const saved = lesionSaveIdentity(stamped, {
    patientName: 'John Smith',
    patientDob: JOHN_DOB,
    chartId: JOHN
}, { patientName: 'John Smith', chartId: JOHN });
eq(saved.chartId, JANE, 'saving from another open chart does not move the lesion');
eq(saved.patientName, 'Jane Doe', 'saving keeps the lesion patient name');

const fresh = lesionSaveIdentity({}, {
    patientName: 'Jane Doe',
    patientDob: JANE_DOB,
    chartId: JANE
}, {});
eq(fresh.chartId, JANE, 'a new lesion takes the open chart');

global.currentPatient = { name: 'John Smith', dob: JOHN_DOB, chartId: JOHN };
const child = lesionChildIdentity({
    patientName: 'John Smith',
    patientDob: JOHN_DOB,
    chartId: JOHN
}, parent);
eq(child.chartId, JANE, 'further management stays on the prior lesion chart');
eq(child.patientName, 'Jane Doe', 'further management keeps the prior patient name');

const repair = lesionChartRepair(planned);
eq(repair && repair.chartId, JANE, 'stored planned lesion is repaired onto the parent chart');
eq(repair && repair.patientName, 'Jane Doe', 'repair restores the parent name');
eq(lesionChartRepair(parent), null, 'a lesion already on its chart is left alone');
eq(lesionChartRepair(otherJane), null, 'a different person with the same first and last name is left alone');

global.currentPatient = { name: 'John Smith', dob: JOHN_DOB, phone: '0400 000 002', chartId: '' };
const idle = sessionPatientSnapshot();
eq(idle.chartId, '', 'closed chart does not attach a leftover name');
eq(idle.patientName, '', 'closed chart does not copy a leftover patient name');

const ambiguous = {
    id: 'lesion-ambiguous',
    patientName: 'Jane Doe',
    patientDob: JANE_DOB,
    chartId: JOHN,
    managementStatus: 'awaiting_histology'
};
global.managedCharts.push({ id: 'jane doe|01011980-copy', name: 'Doe, Jane', firstName: 'Jane', lastName: 'Doe', dob: JANE_DOB });
eq(chartIdForName('Jane Doe', JANE_DOB), '', 'two charts with the same name and date of birth are not guessed');
eq(lesionChartId(ambiguous), JOHN, 'ambiguous name keeps the stored chart');

if (failed) {
    console.error(failed + ' check(s) failed');
    process.exit(1);
}
console.log('lesion chart attachment checks passed');
