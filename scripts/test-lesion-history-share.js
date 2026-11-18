/* Node checks: lesion history copy text includes site, exam, and notes. */
const {
    formatLesionHistoryShareText,
    lesionNoteEvents,
    renderLesionNotesListHtml,
    removeNoteEventFromRecord,
    deleteLesionNoteEvent
} = require('../js/management.js');
global.escapeHtml = (value) => String(value || '');

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

const parent = {
    id: 'P',
    location: 'Right cheek',
    patientName: 'Jane Example',
    createdAt: '2026-03-01T00:00:00.000Z',
    timeline: [
        { id: 'late', type: 'note', at: '2026-10-02T00:00:00.000Z', note: 'Parent later note' },
        { id: 'early', type: 'note', at: '2026-03-02T00:00:00.000Z', note: 'Parent first note' }
    ]
};
const child = {
    id: 'C',
    priorLesionId: 'P',
    location: 'Right cheek',
    patientName: 'Jane Example',
    createdAt: '2026-10-01T00:00:00.000Z',
    timeline: [
        { id: 'child', type: 'note', at: '2026-10-20T09:10:00.000Z', note: 'Child follow-up note' }
    ]
};
global.managedLesions = [child, parent];

const fromChild = formatLesionHistoryShareText(child, { name: 'Jane Example', dob: '02/03/1954' });
const fromParent = formatLesionHistoryShareText(parent, { name: 'Jane Example', dob: '02/03/1954' });
function noteOrder(text) {
    return ['Parent first note', 'Parent later note', 'Child follow-up note'].map((note) => text.indexOf(note));
}
const childOrder = noteOrder(fromChild);
const parentOrder = noteOrder(fromParent);
eq(childOrder.every((index) => index !== -1), true, 'copied child history includes parent and child notes');
eq(childOrder[0] < childOrder[1] && childOrder[1] < childOrder[2], true, 'copied history lists the oldest note first');
eq(parentOrder[0] < parentOrder[1] && parentOrder[1] < parentOrder[2], true, 'copied parent history includes the child note in the same order');

const shown = lesionNoteEvents(child).map((event) => event.note);
eq(JSON.stringify(shown), JSON.stringify([
    'Parent first note',
    'Parent later note',
    'Child follow-up note'
]), 'the notes list is the whole chain, oldest first');
global.formatLesionWhen = (iso) => String(iso || '').slice(0, 10);
const html = renderLesionNotesListHtml(child);
eq(html.indexOf('Parent first note') < html.indexOf('Child follow-up note'), true, 'the displayed notes list the oldest note first');
eq(html.includes('— Parent first note'), true, 'the date leads the note');
eq(html.includes('>Note<'), false, 'a note card does not repeat the word Note');
eq(html.includes('Dr Smith'), false, 'a note card does not show the author');
eq(html.includes('Delete note'), true, 'each note card can delete the note');
child.timeline[0].by = 'Dr Smith';
const withAuthor = renderLesionNotesListHtml(child);
eq(withAuthor.includes('Dr Smith'), false, 'the author stays off the card');

const record = {
    id: 'D',
    adminCallNote: 'Later note',
    timeline: [
        { id: 'n1', type: 'note', at: '2026-01-01T00:00:00.000Z', note: 'Earlier note', by: 'Dr Smith' },
        { id: 'n2', type: 'note', at: '2026-02-01T00:00:00.000Z', note: 'Later note', by: 'Dr Smith' }
    ]
};
eq(removeNoteEventFromRecord(record, 'n2').note, 'Later note', 'the chosen note is removed');
eq(record.timeline.length, 1, 'one note remains');
eq(record.adminCallNote, 'Earlier note', 'the stored call note falls back to the earlier note');
global.lesionChainNoteEvents = lesionNoteEvents;
const { chartReviewTodayNotes } = require('../js/outputs.js');
const todayParent = {
    id: 'TP',
    timeline: [{ id: 'tp', type: 'note', at: '2026-10-20T01:00:00.000Z', note: 'Parent note from this morning' }]
};
const todayChild = {
    id: 'TC',
    priorLesionId: 'TP',
    timeline: [{ id: 'tc', type: 'note', at: '2026-10-20T02:00:00.000Z', note: 'Child note from this morning' }]
};
global.managedLesions = [todayChild, todayParent];
eq(
    JSON.stringify(chartReviewTodayNotes(todayChild, '2026-10-20T10:00:00.000Z')),
    JSON.stringify(['Parent note from this morning', 'Child note from this morning']),
    'today’s copied note includes the parent note before the child note'
);

global.managedLesions = [record];
global.findLesionRecordById = (id) => global.managedLesions.find((item) => item.id === id) || null;
global.window = { confirm: () => true };
let saved = null;
global.saveManagedLesionRecord = async (item) => { saved = item; };
deleteLesionNoteEvent('D', 'n1').then((ok) => {
    eq(ok, true, 'deleting a note succeeds');
    eq(record.timeline.length, 0, 'the deleted note is gone');
    eq(saved && saved.id, 'D', 'the lesion is saved after the note is deleted');
    if (failed) {
        console.error('\n' + failed + ' failing check(s)');
        process.exit(1);
    }
    console.log('\nall lesion-history share checks passed');
}).catch((err) => {
    console.error(err);
    process.exit(1);
});
