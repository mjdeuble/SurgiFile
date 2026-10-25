/* Node checks: lesion history copy text includes site, exam, and notes. */
const {
    formatLesionHistoryShareText
} = require('../js/management.js');

let failed = 0;
function eq(actual, expected, label) {
    const ok = Object.is(actual, expected)
        || (typeof actual === 'boolean' && actual === expected)
        || (actual && expected && String(actual).includes(String(expected)));
    if (!ok) {
        failed += 1;
        console.error('FAIL', label, { actual, expected });
    } else {
        console.log('ok', label);
    }
}

const lesion = {
    id: 'L1',
    location: 'Right cheek',
    patientName: 'Jane Example',
    patientDob: '02/03/1954',
    impression: 'BCC',
    macroscopic: '6mm erythematous nodule',
    dermoscopy: 'Arborising vessels',
    length: '6',
    width: '6',
    createdAt: '2026-03-12T00:00:00.000Z',
    histologyDiagnosis: 'Nodular BCC',
    histologyResult: 'Incompletely excised nodular BCC',
    procedureCompletedAt: '2026-03-15T00:00:00.000Z',
    timeline: [
        { type: 'note', at: '2026-10-20T09:10:00.000Z', note: 'Morning review — desk to phone after 10' },
        { type: 'plan', at: '2026-10-20T09:12:00.000Z', note: '' }
    ]
};

const text = formatLesionHistoryShareText(lesion, {
    name: 'Jane Example',
    dob: '02/03/1954',
    clinician: 'Deuble'
});

eq(!!text, true, 'share text is produced');
eq(text.includes('Jane Example'), true, 'includes patient name');
eq(text.includes('DOB 02/03/1954'), true, 'includes date of birth');
eq(text.includes('Right cheek'), true, 'includes site');
eq(text.includes('6mm erythematous nodule') || text.includes('Macroscopic'), true, 'includes exam background');
eq(text.includes('Morning review — desk to phone after 10'), true, 'includes clinician note');
eq(text.includes('Save plan'), false, 'does not include inspector form chrome');

eq(formatLesionHistoryShareText(null), '', 'empty without a lesion');

if (failed) {
    console.error('\n' + failed + ' failing check(s)');
    process.exit(1);
}
console.log('\nall lesion-history share checks passed');
