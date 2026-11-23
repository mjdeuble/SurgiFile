/* The attached pathology sheet prints from a frame on this page. */
const { printSupplementaryReportSheet } = require('../js/outputs.js');

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

const toasts = [];
global.showToast = (message) => { toasts.push(message); };
global.getBiopsyLesions = () => [];
global.outputCopyState = {
    emr: { copied: false, lastCopiedText: '' },
    path: { copied: false, lastCopiedText: '' },
    supp: { copied: false, lastCopiedText: '' },
    rec: { copied: false, lastCopiedText: '' }
};
global.currentPatient = { name: 'Jane Doe', dob: '01/01/1970', clinician: 'Dr Smith' };
global.window = {
    open() {
        throw new Error('opened a window');
    }
};

function makeFrame() {
    const frame = {
        id: 'pathologyPrintFrame',
        title: '',
        attrs: {},
        onload: null,
        setAttribute(name, value) { frame.attrs[name] = value; }
    };
    const doc = {
        html: '',
        readyState: 'loading',
        open() { doc.html = ''; },
        write(chunk) { doc.html += String(chunk); },
        close() {
            doc.readyState = 'complete';
            if (typeof frame.onload === 'function') frame.onload();
        }
    };
    const win = {
        document: doc,
        focused: false,
        printed: 0,
        focus() { win.focused = true; },
        print() { win.printed += 1; }
    };
    frame.contentWindow = win;
    return frame;
}

const frame = makeFrame();
const created = [];
global.document = {
    getElementById(id) {
        if (id === 'pathologyPrintFrame') return frame;
        return null;
    },
    createElement(tag) {
        const el = makeFrame();
        el.tag = tag;
        created.push(el);
        return el;
    },
    body: { appendChild(el) { created.push(el); } }
};

const lesions = [
    { location: 'Left forearm', impression: 'BCC', biopsyType: 'Excision', macroscopic: 'Pigmented papule', dermoscopy: 'Chaos' },
    { location: 'Right cheek', impression: 'SCC', biopsyType: 'Shave' },
    { location: 'Back', impression: 'IEC', biopsyType: 'Excision', length: '12', width: '8', margin: '3' }
];

printSupplementaryReportSheet(lesions);
eq(frame.contentWindow.printed, 1, 'the sheet prints once from the frame on this page');
eq(frame.contentWindow.focused, true, 'the print dialog uses the pathology frame');
eq(frame.contentWindow.document.html.includes('SUPPLEMENTARY PATHOLOGY CLINICAL REPORT'), true, 'the frame holds the attached report');
eq(frame.contentWindow.document.html.includes('Jane Doe'), true, 'the sheet names the patient');
eq(frame.contentWindow.document.html.includes('window.print'), false, 'the frame does not print itself a second time');
eq(global.outputCopyState.supp.copied, true, 'printing marks the attached report as produced');
eq(toasts[0], 'Supplementary pathology report sent to printer. Saved in generated documents.', 'the page confirms the print dialog');

toasts.length = 0;
printSupplementaryReportSheet([]);
eq(frame.contentWindow.printed, 1, 'an empty request does not print again');
eq(toasts[0], 'No attached pathology report to print yet.', 'an empty request stays on this page');

global.document.getElementById = () => null;
printSupplementaryReportSheet(lesions);
eq(created.length > 0, true, 'a missing frame is added to this page');
eq(created[created.length - 1].contentWindow.printed, 1, 'the added frame prints the sheet');

if (failed) {
    console.error(failed + ' failed');
    process.exit(1);
}
console.log('pathology print frame ok');
