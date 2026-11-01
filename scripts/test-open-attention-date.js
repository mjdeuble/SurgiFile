/* Further-action dates and the clinic time zone for the open-lesion attention list. */
const vault = require('../js/lesion-vault.js');
const profile = require('../js/clinic-profile.js');

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

const zone = 'Australia/Brisbane';
const eveningUtc = new Date('2026-11-01T16:30:00.000Z');
eq(vault.normalizeClinicTimeZone(''), 'Australia/Brisbane', 'blank zone is Brisbane');
eq(vault.normalizeClinicTimeZone('Not/AZone'), 'Australia/Brisbane', 'unknown zone is Brisbane');
eq(vault.normalizeClinicTimeZone('Australia/Perth'), 'Australia/Perth', 'known zone is kept');
eq(vault.isValidIanaTimeZone('Australia/Eucla'), true, 'Eucla is a real zone');
eq(vault.clinicCalendarDayKey(zone, eveningUtc), '2026-11-02', 'Brisbane evening is the next calendar day');
eq(vault.clinicCalendarDayKey('UTC', eveningUtc), '2026-11-01', 'UTC stays on the previous day');
eq(profile.emptyClinicProfile().timeZone, 'Australia/Brisbane', 'new clinic profile defaults to Brisbane');

eq(vault.normalizeFurtherActionDate('2026-11-02'), '2026-11-02', 'calendar date is kept');
eq(vault.normalizeFurtherActionDate('2026-02-31'), '', 'impossible date is rejected');
eq(vault.normalizeFurtherActionDate(''), '', 'blank date is blank');
eq(vault.formatFurtherActionDateLabel('2026-11-02'), '2 Nov 2026', 'date label');

const today = '2026-11-02';
function lesion(status, date) {
    return { id: status + (date || 'none'), managementStatus: status, furtherActionDate: date || '' };
}

eq(vault.furtherActionDateIsFuture(lesion('awaiting_histology', '2026-11-03'), today), true, 'tomorrow is future');
eq(vault.furtherActionDateIsFuture(lesion('awaiting_histology', '2026-11-02'), today), false, 'today is not future');
eq(vault.furtherActionDateIsFuture(lesion('planned_procedure', '2026-11-01'), today), false, 'yesterday is not future');
eq(vault.furtherActionDateIsFuture(lesion('awaiting_histology', ''), today), false, 'no date is not future');

function shown(item) {
    return vault.lesionStaysOnOpenAttentionList(item, { attentionOnly: true, todayKey: today });
}

eq(shown(lesion('awaiting_histology', '')), true, 'pending result with no date stays');
eq(shown(lesion('awaiting_histology', '2026-11-03')), false, 'pending result dated ahead is hidden');
eq(shown(lesion('planned_procedure', '2026-11-03')), false, 'planned procedure dated ahead is hidden');
eq(shown(lesion('planned_procedure', '2026-11-02')), true, 'planned procedure due today stays');
eq(shown(lesion('needs_contact', '2026-10-01')), true, 'past contact date stays');
eq(shown(lesion('topical_followup', '')), true, 'topical review with no date stays');
eq(shown(lesion('no_followup', '')), false, 'completed lesion stays off the open list');
eq(shown(lesion('no_followup', '2026-11-01')), false, 'completed lesion with a past date stays off');
eq(vault.lesionStaysOnOpenAttentionList(lesion('no_followup', ''), { attentionOnly: false, todayKey: today }), false, 'attention off still excludes completed');
eq(vault.lesionStaysOnOpenAttentionList(lesion('awaiting_histology', '2026-11-03'), { attentionOnly: false, todayKey: today }), true, 'attention off keeps a future-dated open lesion');

const planned = {
    id: 'P1',
    managementStatus: 'planned_procedure',
    type: 'excision',
    currentPlan: 'Excision planned',
    furtherActionDate: '2026-11-03'
};
const moved = vault.applyFurtherActionDate(planned, '2026-12-01');
eq(moved.ok, true, 'date update is accepted');
eq(planned.furtherActionDate, '2026-12-01', 'date is replaced');
eq(planned.managementStatus, 'planned_procedure', 'planned status is unchanged');
eq(planned.currentPlan, 'Excision planned', 'plan line is unchanged');
const cleared = vault.applyFurtherActionDate(planned, '');
eq(cleared.furtherActionDate, '', 'date can be cleared');
eq(planned.managementStatus, 'planned_procedure', 'clearing the date leaves the status');
eq(vault.applyFurtherActionDate(planned, '2026-02-31').ok, false, 'invalid date is refused');
eq(planned.furtherActionDate, '', 'refused date does not write');

global.isTopicalPlan = (plan) => String(plan || '').includes('Topical');
const topical = {
    id: 'T1',
    plan: 'Topical / Field Treatment',
    type: 'topical',
    topicalFollowUp: '4 weeks',
    topicalDecision: 'efudix',
    managementStatus: 'topical_followup'
};
eq(vault.deriveLesionStatusFromPlan(topical), 'topical_followup', 'topical review still derives follow-up');
vault.applyFurtherActionDate(topical, '2026-12-15');
eq(topical.managementStatus, 'topical_followup', 'dating a topical review does not change its status');
eq(vault.deriveLesionStatusFromPlan(topical), 'topical_followup', 'topical review still derives follow-up after a date');

if (failed) {
    console.error(failed + ' failed');
    process.exit(1);
}
console.log('open attention date checks passed');
