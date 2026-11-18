/* The results pane names the patient and the chart's text-results answer. */
global.escapeHtml = (value) => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

const {
    smsAcceptableResultLabel,
    inspectorPatientSmsHtml
} = require('../js/chart.js');

let failed = 0;
function eq(actual, expected, label) {
    const ok = Object.is(actual, expected) || (actual && expected && String(actual).includes(String(expected)));
    if (!ok) {
        failed += 1;
        console.error('FAIL', label, { actual, expected });
    } else {
        console.log('ok', label);
    }
}

eq(smsAcceptableResultLabel('yes'), 'SMS for Acceptable Result = Yes', 'yes');
eq(smsAcceptableResultLabel('no'), 'SMS for Acceptable Result = No', 'no');
eq(smsAcceptableResultLabel(''), 'SMS for Acceptable Result = Not recorded', 'blank');

global.patientContactForLesion = () => ({ sms: 'yes', chartId: 'chart-1' });
const yesHtml = inspectorPatientSmsHtml({ patientName: 'Jane Example', location: 'Left shin', chartId: 'chart-1' });
eq(yesHtml.includes('Jane Example'), true, 'caption names the patient');
eq(yesHtml.includes('SMS for Acceptable Result = Yes'), true, 'caption shows yes beside the name');
eq(yesHtml.includes('is-yes'), true, 'yes is marked');

global.patientContactForLesion = () => ({ sms: 'no', chartId: 'chart-1' });
const noHtml = inspectorPatientSmsHtml({ patientName: 'Jane Example', chartId: 'chart-1' });
eq(noHtml.includes('SMS for Acceptable Result = No'), true, 'caption shows no');
eq(noHtml.includes('is-no'), true, 'no is marked');

global.patientContactForLesion = () => ({ sms: '', chartId: 'chart-1' });
const blankHtml = inspectorPatientSmsHtml({ patientName: 'Jane Example', chartId: 'chart-1' });
eq(blankHtml.includes('SMS for Acceptable Result = Not recorded'), true, 'caption shows when the chart has no answer');
eq(blankHtml.includes('is-unset'), true, 'blank is marked');

if (failed) {
    console.error(failed + ' check(s) failed');
    process.exit(1);
}
console.log('All SMS result caption checks passed.');
