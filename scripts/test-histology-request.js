/* Histology request: short attached flag, specimens run on as one sentence each. */
const { generatePathologyOutputs } = require('../js/outputs.js');

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

function lesion(extra) {
    return Object.assign({
        location: 'Nose',
        impression: 'BCC',
        biopsyType: 'Punch Biopsy',
        punchSize: '3'
    }, extra || {});
}

const fitting = generatePathologyOutputs([
    lesion(),
    lesion({ location: 'Right cheek', impression: 'SCC', biopsyType: 'Shave', punchSize: '' })
]);
eq(fitting.requiresAttachment, false, 'two short specimens stay on the pad');
eq(
    fitting.slipText,
    '1. NOSE: ?BCC, Punch Bx, 3mm punch. 2. RIGHT CHEEK: ?SCC, Shave Bx.',
    'fitting request is one line and each specimen ends with a full stop'
);
eq(fitting.slipText.includes('\n'), false, 'fitting request has no line break');
eq(fitting.reportText, '', 'a fitting request has no attached report');

const cited = generatePathologyOutputs([
    lesion({
        macroscopic: 'Pigmented.',
        priorCite: 'Previous histology: BCC.'
    })
]);
global.formatPriorHistologyCitation = (item) => item.priorCite || '';
const citedAfter = generatePathologyOutputs([
    lesion({
        macroscopic: 'Pigmented.',
        priorCite: 'Previous histology: BCC.'
    })
]);
eq(
    citedAfter.slipText,
    '1. NOSE: ?BCC, Punch Bx, 3mm punch. Pigmented. Previous histology: BCC.',
    'a specimen that already ends with a full stop keeps a single stop'
);
eq(cited.slipText.endsWith('.'), true, 'a specimen without a citation still ends with a full stop');

global.formatHistologyAccession = (item) => item.priorAccession || '';
const attached = generatePathologyOutputs([
    lesion({ location: 'Left forearm', priorAccession: 'S26-100' }),
    lesion({ location: 'Right cheek', impression: 'SCC', biopsyType: 'Shave', punchSize: '' }),
    lesion({ location: 'Back', impression: 'IEC', biopsyType: 'Excision', punchSize: '', length: '12', width: '8', margin: '3' })
]);
eq(attached.requiresAttachment, true, 'three specimens need the attached report');
eq(
    attached.slipText,
    '*** SEE ATTACHED ***\n1. LEFT FOREARM: ?BCC, Punch Bx, 3mm punch; prev S26-100. 2. RIGHT CHEEK: ?SCC, Shave Bx. 3. BACK: ?IEC, Excision, 12x8mm, margin 3mm.',
    'attached request uses the short flag and keeps specimens on the next line together'
);
eq(attached.slipText.includes('SEE ATTACHED REPORT'), false, 'the long attached banner is gone');
eq(attached.slipText.split('\n').length, 2, 'only the flag sits on its own line');
eq(attached.slipText.split('\n')[1].includes('\n'), false, 'specimen text has no further line break');
eq(attached.reportText.includes('SPECIMEN #1: LEFT FOREARM'), true, 'the stapled report still lists each specimen');
eq(attached.reportText.includes('\n'), true, 'the stapled report stays line by line');

const longMacro = 'Pigmented papule with chaos and asymmetric clods across the whole lesion surface and a scar at one edge.';
const longPair = generatePathologyOutputs([
    lesion({ macroscopic: longMacro, dermoscopy: 'Chaos, asymmetric clods' }),
    lesion({ location: 'Shin', impression: 'Melanoma', biopsyType: 'Excision', punchSize: '', length: '14', width: '9', margin: '5', macroscopic: longMacro })
]);
eq(longPair.requiresAttachment, true, 'a long two-specimen request still attaches the full details');
eq(longPair.slipText.startsWith('*** SEE ATTACHED ***\n'), true, 'a long request opens with the short flag');
eq(longPair.slipText.includes(longMacro), false, 'the pad line leaves the long description for the attached report');
eq(
    longPair.slipText,
    '*** SEE ATTACHED ***\n1. NOSE: ?BCC, Punch Bx, 3mm punch. 2. SHIN: ?Melanoma, Excision, 14x9mm, margin 5mm.',
    'the long request still runs the short specimen lines together'
);

if (failed) {
    console.error(failed + ' failed');
    process.exit(1);
}
console.log('histology request wording ok');
