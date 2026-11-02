/* The upgrade must report progress the way the busy bar expects, then leave a result. */
global.document = {
    readyState: 'complete',
    getElementById(id) {
        return id === 'recordUpgradeResults' ? host : null;
    },
    addEventListener() {}
};
global.window = { confirm: () => true };
global.escapeHtml = (value) => String(value ?? '');

const host = { textContent: '', innerHTML: '' };
let toast = '';
const progressCalls = [];
global.showToast = (message) => { toast = message; };
global.runBusyAction = async (label, work) => work({
    progress(step, fraction) { progressCalls.push([step, fraction]); }
});
global.saveManagedChartRecord = async () => { savedCharts += 1; };
global.writeManagedLesion = async () => { savedLesions += 1; };

const { planRecordIdentityUpgrade } = require('../js/lesion-vault.js');
global.planRecordIdentityUpgrade = planRecordIdentityUpgrade;
global.managedCharts = [{ id: 'c1', name: 'Jane Doe' }];
global.managedLesions = [
    { id: 'nose', chartId: 'c1', location: 'Nose', createdAt: '2020-01-01' },
    { id: 'nose-2', chartId: 'c1', location: 'Nose', createdAt: '2020-06-01', priorLesionId: 'nose' }
];

let savedCharts = 0;
let savedLesions = 0;
const { upgradeRecordsFromSettings, recordUpgradeSummary, renderRecordUpgradeResults } = require('../js/lesion-checker.js');

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

eq(recordUpgradeSummary({
    personAssignments: [{ chartId: 'c1' }],
    lesionAssignments: [{ lesionId: 'nose' }, { lesionId: 'nose-2' }],
    skipped: []
}), 'Gave a person number to 1 patient. Numbered 2 lesions.', 'summary names the patients and lesions');

renderRecordUpgradeResults({
    personAssignments: [],
    lesionAssignments: [],
    skipped: [{
        attachedTo: 'Jane Doe · DOB 01/01/1970',
        storedPatient: 'John Roe · DOB 02/02/1980',
        location: 'L Upper Back',
        diagnosis: 'BCC',
        caseNumber: 'S24-9',
        when: '12 Mar 2024',
        plan: 'Re-excision planned',
        reason: 'The earlier episode, Forearm, is on John Roe · DOB 02/02/1980.'
    }]
});
eq(host.innerHTML.includes('Jane Doe · DOB 01/01/1970'), true, 'the unchanged list names the chart');
eq(host.innerHTML.includes('L Upper Back · BCC · Case S24-9 · 12 Mar 2024'), true, 'the unchanged list names the lesion');
eq(host.innerHTML.includes('Name on the lesion: John Roe · DOB 02/02/1980'), true, 'the unchanged list names a different stored patient');
eq(host.innerHTML.includes('The earlier episode, Forearm, is on John Roe'), true, 'the unchanged list says where the earlier episode is');

upgradeRecordsFromSettings().then(() => {
    eq(savedCharts, 1, 'the patient chart is saved');
    eq(savedLesions, 2, 'both episodes are saved');
    eq(progressCalls.length, 3, 'progress updates do not stop the upgrade');
    eq(host.innerHTML.includes('Gave a person number to 1 patient'), true, 'the result stays under the button');
    eq(toast.includes('Numbered 2 lesions'), true, 'a toast repeats the result');
    eq(host.textContent.includes('stopped'), false, 'a normal upgrade is not described as stopped');
    if (failed) {
        console.error('\n' + failed + ' failing check(s)');
        process.exit(1);
    }
    console.log('\nall upgrade message checks passed');
}).catch((err) => {
    console.error(err);
    process.exit(1);
});
