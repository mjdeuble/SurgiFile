/* Visit notes are kept 45 days from the day they were written, including notes stamped with the old 7-day expiry. */
const {
    VISIT_NOTE_TTL_MS,
    visitNoteIsExpired,
    extendVisitNoteRetention,
    visitNoteDaysLeft
} = require('../js/note-vault.js');

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

const day = 24 * 60 * 60 * 1000;
const now = Date.now();
eq(VISIT_NOTE_TTL_MS, 45 * day, 'visit notes are kept 45 days');

const recent = {
    createdAt: new Date(now - (10 * day)).toISOString(),
    expiresAt: new Date(now - (3 * day)).toISOString()
};
eq(visitNoteIsExpired(recent, now), false, 'a note inside 45 days is kept after its old expiry');
eq(extendVisitNoteRetention(recent), true, 'the stored expiry is extended');
eq(Date.parse(recent.expiresAt), Date.parse(recent.createdAt) + (45 * day), 'the new expiry is 45 days from the day it was written');
eq(extendVisitNoteRetention(recent), false, 'a second pass leaves the extended expiry alone');

const old = {
    createdAt: new Date(now - (46 * day)).toISOString(),
    expiresAt: new Date(now - (39 * day)).toISOString()
};
eq(visitNoteIsExpired(old, now), true, 'a note older than 45 days is expired');
eq(visitNoteDaysLeft(recent) > 30, true, 'days remaining follow the 45-day window');

const stampedOnly = { expiresAt: new Date(now - day).toISOString() };
eq(visitNoteIsExpired(stampedOnly, now), true, 'a note with no written date still follows its stored expiry');
eq(extendVisitNoteRetention(stampedOnly), false, 'a note with no written date is not given a new expiry');

if (failed) {
    console.error(failed + ' failed');
    process.exit(1);
}
console.log('visit note retention checks passed');
