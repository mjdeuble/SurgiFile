/* Saving a result writes the lesion and the bill together. */
const { saveHistologyLesionAndBill, recordHistologyOutcome, applyHistologyCaseToSiblings } = require('../js/lesion-vault.js');

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

function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

global.vaultAuth = { username: 'doctor' };
global.isVaultLoggedIn = () => false;
global.renderManagedLesions = () => {};
global.updateCurrentCaseBanner = () => {};
global.showToast = () => {};
global.lesionHasSavedHistology = (item) => !!String(item?.histologyResult || '').trim();
global.lesionLifecycleStatus = (item) => item.managementStatus;
global.canonicalLesionStatus = (status) => status;
global.lesionProcedureDone = (item) => !!(item?.procedureCompletedAt || item?.excisionFinalisedAt);

(async () => {
    const lesion = {
        id: 'L1',
        location: 'Nose',
        histologyResult: 'BCC, excised',
        managementStatus: 'needs_contact',
        history: [],
        timeline: []
    };
    global.managedLesions = [lesion];
    let duringBill = '';
    global.syncBillingFromLesion = async () => {
        await delay(40);
        duringBill = lesion.history.some((item) => item.action === 'histology')
            ? 'history-during-bill'
            : 'history-not-yet';
    };
    await saveHistologyLesionAndBill(lesion, 'histology', 'BCC, excised', { silent: true });
    eq(duringBill, 'history-during-bill', 'the lesion save starts while the bill write is still going');
    eq(lesion.history.some((item) => item.action === 'histology'), true, 'the lesion history records the result');

    const resultLesion = {
        id: 'R1',
        location: 'Arm',
        managementStatus: 'awaiting_histology',
        procedureCompletedAt: '2026-11-24T01:00:00.000Z',
        history: [],
        timeline: [],
        contactState: ''
    };
    global.managedLesions = [resultLesion];
    let billCalls = 0;
    global.syncBillingFromLesion = async () => { billCalls += 1; };
    const saved = await recordHistologyOutcome('R1', 'SCC, completely excised', '', 'scc', {
        resultOnly: true,
        histologyDiagnosis: 'SCC'
    });
    eq(saved.resultOnly, true, 'a result-only save stays on the result');
    eq(resultLesion.histologyResult, 'SCC, completely excised', 'the result is stored on the lesion');
    eq(resultLesion.histologyDiagnosis, 'SCC', 'the diagnosis is stored on the lesion');
    eq(resultLesion.managementStatus, 'needs_contact', 'a new result leaves the awaiting queue');
    eq(billCalls, 1, 'the bill is updated once for the result');

    const day = '2026-11-24T02:00:00.000Z';
    const source = { id: 'S', chartId: 'c1', histologyCaseNumber: 'S26-1', procedureCompletedAt: day, history: [] };
    const potA = { id: 'A', chartId: 'c1', histologyCaseNumber: '', procedureCompletedAt: day, history: [] };
    const potB = { id: 'B', chartId: 'c1', histologyCaseNumber: '', procedureCompletedAt: day, history: [] };
    global.managedLesions = [source, potA, potB];
    const share = await applyHistologyCaseToSiblings('S', 'S26-1');
    eq(share.applied, 2, 'both other pots receive the lab number');
    eq(potA.histologyCaseNumber, 'S26-1', 'the first other pot stores the lab number');
    eq(potB.histologyCaseNumber, 'S26-1', 'the second other pot stores the lab number');

    if (failed) {
        console.error(failed + ' failed');
        process.exit(1);
    }
    console.log('histology result save ok');
})().catch((err) => {
    console.error(err);
    process.exit(1);
});
