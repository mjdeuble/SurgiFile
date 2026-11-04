/* Node checks: confirming finalise hides the box before billing, and a failed save leaves the chart open. */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const document = {
    readyState: 'complete',
    addEventListener() {},
    getElementById() { return { classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } }, value: '', className: '', textContent: '', innerHTML: '' }; },
    querySelector() { return null; },
    querySelectorAll() { return []; }
};
global.document = document;
global.window = { addEventListener() {} };
global.hasCurrentPatient = () => true;
global.currentPatient = { name: 'Robin Plancheck', chartId: 'chart-1' };
global.showToast = () => {};
global.visitProcedureLesionsForFinalise = () => [{ id: 'lesion-1', location: 'Shoulder' }];
global.visitFinaliseBillingState = () => ({ mode: 'process', lesions: [{ id: 'lesion-1' }] });

const file = path.join(__dirname, '..', 'js', 'chart-vault.js');
vm.runInThisContext(fs.readFileSync(file, 'utf8'), { filename: file });

let failed = 0;
function eq(actual, expected, label) {
    if (actual !== expected) {
        failed += 1;
        console.error('FAIL', label, { actual, expected });
    } else {
        console.log('ok', label);
    }
}

(async () => {
    const order = [];
    let modalHidden = false;
    closeFinaliseVisitModal = () => { modalHidden = true; order.push('hide'); };
    markVisitLesionsBillingProcessed = async () => {
        order.push('bill');
        eq(modalHidden, true, 'the finalise box is closed before billing is marked');
        return { codes: ['31382'] };
    };
    closePatientChart = async () => { order.push('close'); };

    await submitFinaliseVisitWork(() => {});
    eq(order.join(','), 'hide,bill,close', 'billing is marked and then the chart closes');

    const warn = console.warn;
    console.warn = () => {};
    order.length = 0;
    modalHidden = false;
    let reopened = false;
    let toasted = '';
    hasCurrentPatient = () => true;
    showToast = (msg) => { toasted = msg; };
    openFinaliseVisitModal = () => { reopened = true; };
    markVisitLesionsBillingProcessed = async () => { throw new Error('disk full'); };
    closePatientChart = async () => { order.push('close'); };
    await submitFinaliseVisit();
    eq(order.includes('close'), false, 'a failed billing mark does not close the chart');
    eq(toasted, 'The chart is still open. The save did not finish.', 'a failed save says the chart is still open');
    eq(reopened, true, 'the finalise box comes back when the save fails');
    eq(finaliseCloseInFlight, false, 'stay on chart works again after the save fails');
    console.warn = warn;

    if (failed) {
        console.error(failed + ' failed');
        process.exit(1);
    }
    console.log('all finalise close checks passed');
})().catch((err) => {
    console.error(err);
    process.exit(1);
});
