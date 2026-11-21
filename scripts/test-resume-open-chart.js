/* Node checks: sign-in returns to the open chart, and an unfinished procedure comes back. */
const {
    procedureSessionStillOpen,
    isStoredProcedureSessionActive,
    findActiveProcedureChart,
    snapshotProcedureSession,
    emptyProcedureSession
} = require('../js/procedure-session.js');
const {
    chooseLoginResumeTarget,
    resumedChartWorkspaceTab,
    loginResumeMessage,
    isVisitSessionActive,
    todayVisitKey
} = require('../js/chart-vault.js');

let failed = 0;
function eq(actual, expected, label) {
    if (!Object.is(actual, expected)) {
        failed += 1;
        console.error('FAIL', label, { actual, expected });
    } else {
        console.log('ok', label);
    }
}

const today = todayVisitKey();
const yesterday = '2020-01-02';

const startedYesterday = {
    started: true,
    startedAt: '2020-01-02T01:00:00.000Z',
    visitDate: yesterday,
    completedAt: '',
    selectedIds: ['L1'],
    lockedIds: ['L1']
};
eq(procedureSessionStillOpen(startedYesterday), true, 'a procedure started on another day is still open');
eq(isStoredProcedureSessionActive(startedYesterday), true, 'an unfinished procedure is kept past midnight');
eq(procedureSessionStillOpen({ ...startedYesterday, completedAt: '2020-01-02T02:00:00.000Z' }), false, 'a completed procedure is closed');
eq(procedureSessionStillOpen({ started: false, selectedIds: ['L1'] }), false, 'setup before Start is not a running procedure');
eq(procedureSessionStillOpen({ started: true, selectedIds: [], lockedIds: [] }), false, 'a procedure with no lesions is closed');

const openChart = { id: 'chart-a', name: 'Ada Patient' };
const otherProcedure = {
    id: 'chart-b',
    name: 'Bea Patient',
    procedureSession: startedYesterday
};
eq(chooseLoginResumeTarget({ lastChart: openChart, lastChartId: 'chart-a', procedureChart: openChart }).kind, 'chart', 'the open chart wins when the procedure is on that chart');
eq(chooseLoginResumeTarget({ lastChart: openChart, lastChartId: 'chart-a', procedureChart: otherProcedure }).kind, 'procedure-other', 'an unfinished procedure on another chart is opened instead');
eq(chooseLoginResumeTarget({ lastChart: openChart, lastChartId: 'chart-a', procedureChart: otherProcedure }).chart.id, 'chart-b', 'the other procedure chart is the one opened');
eq(chooseLoginResumeTarget({ lastChart: null, lastChartId: 'missing', procedureChart: null }).kind, 'missing', 'a deleted chart is not replaced with someone else');
eq(chooseLoginResumeTarget({ lastChart: null, lastChartId: '', procedureChart: null }).kind, 'none', 'sign-in with no open chart stays on the list');

const sameDayVisit = {
    visitDate: today,
    consultType: 'face_to_face',
    workspaceTab: 'consent',
    sanitised: true
};
eq(isVisitSessionActive(sameDayVisit), true, 'today’s visit is active');
eq(resumedChartWorkspaceTab({ visitSession: sameDayVisit }, false), 'consent', 'before Start, sign-in returns to the screen that was open');
eq(resumedChartWorkspaceTab({ visitSession: { ...sameDayVisit, workspaceTab: 'excision-generator' } }, false), 'excision-generator', 'procedure setup returns to Procedure');
eq(resumedChartWorkspaceTab({ visitSession: sameDayVisit, procedureSession: startedYesterday }, true), 'excision-generator', 'a started procedure returns to Procedure even from Consent');
eq(resumedChartWorkspaceTab({ visitSession: { ...sameDayVisit, visitDate: yesterday, workspaceTab: 'history' } }, false), 'management', 'the next day, a procedure that was not started opens the chart');
eq(resumedChartWorkspaceTab({ visitSession: { visitDate: yesterday, workspaceTab: 'consent' }, procedureSession: startedYesterday }, true), 'excision-generator', 'the next day, an unfinished procedure still opens Procedure');

eq(loginResumeMessage({ name: 'Ada Patient', procedureSession: { visitDate: today } }, true), 'Opened Ada Patient. Procedure still in progress.', 'same-day procedure message');
const overnight = loginResumeMessage({ name: 'Ada Patient', procedureSession: { visitDate: yesterday } }, true);
eq(overnight.includes('Opened Ada Patient.'), true, 'overnight message names the patient');
eq(overnight.includes('still in progress'), true, 'overnight message says the procedure is unfinished');
eq(overnight.includes('2 Jan'), true, 'overnight message names the day the procedure started');
eq(loginResumeMessage({ name: 'Ada Patient' }, false), 'Opened Ada Patient.', 'a chart with no procedure just reopens');

global.managedCharts = [
    { id: 'old', procedureSession: { ...startedYesterday, startedAt: '2020-01-02T01:00:00.000Z' } },
    { id: 'newer', procedureSession: { ...startedYesterday, startedAt: '2020-01-03T01:00:00.000Z', visitDate: '2020-01-03' } }
];
eq(findActiveProcedureChart().id, 'newer', 'the latest unfinished procedure is the one sign-in prefers');

global.todayVisitKey = () => '2026-11-21';
global.procedureSession = emptyProcedureSession('chart-a');
procedureSession.started = true;
procedureSession.visitDate = '2026-11-20';
procedureSession.startedAt = '2026-11-20T01:00:00.000Z';
procedureSession.selectedIds = ['L1'];
const snap = snapshotProcedureSession();
eq(snap.visitDate, '2026-11-20', 'saving the procedure keeps the day it started');
eq(snap.startedAt, '2026-11-20T01:00:00.000Z', 'saving the procedure keeps the start time');

if (failed) {
    console.error(failed + ' failed');
    process.exit(1);
}
console.log('all resume-open-chart checks passed');
