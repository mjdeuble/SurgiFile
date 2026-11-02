/* Encrypted per-user lesion records and management-status transitions.
   Status = queue (lifecycle). Type = technique (shave / punch / excision / topical / none). */

const LESION_SCHEMA_VERSION = 3;

const LESION_TYPES = ['shave', 'punch', 'excision', 'topical', 'none'];

const LESION_STATUSES = {
    awaiting_assessment: 'Awaiting Assessment',
    planned_procedure: 'Planned Procedure',
    current_case: 'Current Case',
    awaiting_histology: 'Awaiting Results',
    needs_contact: 'Needs Contact',
    appointment_requested: 'Appointment Requested',
    topical_followup: 'Topical Follow-up',
    no_followup: 'No Follow-up',
    awaiting_biopsy: 'Planned Procedure',
    planned_excision: 'Planned Procedure'
};

const ACTIVE_MANAGEMENT_STATUSES = [
    'awaiting_assessment',
    'planned_procedure',
    'current_case',
    'awaiting_histology',
    'needs_contact',
    'appointment_requested',
    'topical_followup'
];

const POST_RESULT_FOLLOWUP_STATUSES = ['awaiting_histology', 'needs_contact', 'appointment_requested'];

const REQUIRES_MANAGEMENT_STATUSES = [
    'awaiting_assessment',
    'needs_contact',
    'appointment_requested'
];

const REQUIRES_MANAGEMENT_FILTERS = ['requires_management', 'needs_contact', 'appointment_requested'];

const LEGACY_STATUS_ALIASES = {
    planned_excision: 'planned_procedure',
    awaiting_biopsy: 'planned_procedure'
};

const TIMELINE_TYPES = ['call_attempt', 'voicemail', 'sms', 'spoke', 'result_advised', 'appointment_requested', 'plan', 'procedure', 'abort', 'histology', 'consent', 'note'];
const CALL_OUTCOMES = ['no answer', 'voicemail', 'spoke', 'declined', 'booked', 'patient not ready'];

function newLesionId() {
    if (crypto.randomUUID) return crypto.randomUUID();
    return 'lesion-' + Date.now() + '-' + Math.random().toString(16).slice(2);
}

function newPersonId() {
    if (typeof newOpaqueRecordId === 'function') return newOpaqueRecordId('person');
    const token = (typeof crypto !== 'undefined' && crypto.randomUUID)
        ? crypto.randomUUID()
        : (Date.now() + '-' + Math.random().toString(16).slice(2));
    return 'person-' + token;
}

function chartIdForPerson(personId) {
    const wanted = String(personId || '').trim();
    if (!wanted) return '';
    const charts = typeof managedCharts !== 'undefined' && Array.isArray(managedCharts) ? managedCharts : [];
    const matches = charts.filter((chart) => chart && String(chart.personId || '') === wanted);
    return matches.length === 1 ? String(matches[0].id) : '';
}

function nextSpotNumberForChart(chartId, lesions) {
    const id = String(chartId || '');
    let max = 0;
    (Array.isArray(lesions) ? lesions : []).forEach((lesion) => {
        if (!lesion || String(lesion.chartId || '') !== id) return;
        const spot = Number(lesion.spotNumber) || 0;
        if (spot > max) max = spot;
    });
    return max + 1;
}

function copySpotIdentityFromPrior(child, prior) {
    if (!child || !prior) return child;
    if (prior.personId) child.personId = prior.personId;
    const spot = Number(prior.spotNumber) || 0;
    if (spot > 0) {
        child.spotNumber = spot;
        child.episodeNumber = (Number(prior.episodeNumber) || 1) + 1;
    }
    return child;
}

function assignFreshSpotIdentity(lesion, chart, lesions) {
    if (!lesion || !chart || !String(chart.personId || '').trim()) return lesion;
    lesion.personId = chart.personId;
    if (!lesion.chartId) lesion.chartId = chart.id;
    if (!(Number(lesion.spotNumber) > 0)) {
        lesion.spotNumber = nextSpotNumberForChart(chart.id, lesions);
        lesion.episodeNumber = 1;
    }
    return lesion;
}

function retargetLesionIdentity(lesion, chart, allLesions) {
    if (!lesion || !chart) return { chartChanged: false };
    let chartChanged = false;
    if (!String(chart.personId || '').trim()) {
        chart.personId = newPersonId();
        chartChanged = true;
    }
    lesion.personId = chart.personId;
    const others = (Array.isArray(allLesions) ? allLesions : []).filter((item) => item && String(item.id) !== String(lesion.id));
    const parent = others.find((item) => String(item.id) === String(lesion.priorLesionId || '')
        && String(item.chartId) === String(chart.id));
    if (parent && Number(parent.spotNumber) > 0) {
        lesion.spotNumber = Number(parent.spotNumber);
        lesion.episodeNumber = (Number(parent.episodeNumber) || 1) + 1;
    } else {
        lesion.spotNumber = nextSpotNumberForChart(chart.id, others);
        lesion.episodeNumber = 1;
    }
    return { chartChanged };
}

function planRecordIdentityUpgrade(lesions, charts, options) {
    const nextId = (options && options.nextPersonId) || newPersonId;
    const sourceLesions = (Array.isArray(lesions) ? lesions : []).filter((item) => item && item.id);
    const sourceCharts = (Array.isArray(charts) ? charts : []).filter((item) => item && item.id);
    const chartById = new Map(sourceCharts.map((chart) => [String(chart.id), chart]));
    const personByChart = new Map();
    const personAssignments = [];
    sourceCharts.forEach((chart) => {
        const existing = String(chart.personId || '').trim();
        if (existing) {
            personByChart.set(String(chart.id), existing);
            return;
        }
        const personId = nextId();
        personByChart.set(String(chart.id), personId);
        personAssignments.push({ chartId: String(chart.id), personId });
    });

    const byId = new Map(sourceLesions.map((lesion) => [String(lesion.id), lesion]));
    const skipped = [];
    const lesionAssignments = [];
    const claimed = new Set();

    function chartIdOf(lesion) {
        const id = String(lesion?.chartId || '').trim();
        return id && chartById.has(id) ? id : '';
    }

    const byChart = new Map();
    sourceLesions.forEach((lesion) => {
        const chartId = chartIdOf(lesion);
        if (!chartId) {
            skipped.push({
                lesionId: String(lesion.id),
                location: String(lesion.location || ''),
                reason: 'No chart yet'
            });
            return;
        }
        if (!byChart.has(chartId)) byChart.set(chartId, []);
        byChart.get(chartId).push(lesion);
    });

    byChart.forEach((group, chartId) => {
        const idsOnChart = new Set(group.map((lesion) => String(lesion.id)));
        const childrenOf = new Map();
        const blocked = new Set();
        group.forEach((lesion) => {
            const priorId = String(lesion.priorLesionId || '').trim();
            if (!priorId) return;
            const prior = byId.get(priorId);
            if (!prior || !idsOnChart.has(priorId) || chartIdOf(prior) !== chartId) {
                blocked.add(String(lesion.id));
                skipped.push({
                    lesionId: String(lesion.id),
                    location: String(lesion.location || ''),
                    reason: 'The earlier episode is missing or on another chart'
                });
                return;
            }
            if (!childrenOf.has(priorId)) childrenOf.set(priorId, []);
            childrenOf.get(priorId).push(lesion);
        });

        function markSkipped(lesion, reason) {
            const id = String(lesion.id);
            blocked.add(id);
            if (!skipped.some((row) => row.lesionId === id)) {
                skipped.push({
                    lesionId: id,
                    location: String(lesion.location || ''),
                    reason
                });
            }
        }

        const cycleIds = new Set();
        group.forEach((start) => {
            if (blocked.has(String(start.id))) return;
            const seen = [];
            const local = new Set();
            let current = start;
            while (current && !blocked.has(String(current.id))) {
                const id = String(current.id);
                if (local.has(id)) {
                    seen.slice(seen.indexOf(id)).forEach((item) => cycleIds.add(item));
                    return;
                }
                local.add(id);
                seen.push(id);
                const kids = (childrenOf.get(id) || []).filter((kid) => !blocked.has(String(kid.id)));
                if (kids.length !== 1) return;
                current = kids[0];
            }
        });
        cycleIds.forEach((id) => {
            const lesion = byId.get(id);
            if (lesion) markSkipped(lesion, 'The episodes point in a circle');
        });

        function walkChain(root) {
            const chain = [];
            const seen = new Set();
            let current = root;
            while (current) {
                const id = String(current.id);
                if (seen.has(id)) return { error: 'The episodes point in a circle', chain };
                seen.add(id);
                chain.push(current);
                const kids = (childrenOf.get(id) || []).filter((kid) => !blocked.has(String(kid.id)));
                if (!kids.length) return { chain };
                const linkedId = String(current.linkedReexcisionId || current.linkedChildId || '').trim();
                let child = null;
                if (linkedId) {
                    child = kids.find((kid) => String(kid.id) === linkedId) || null;
                    if (!child) return { error: 'The linked next episode does not match', chain };
                    kids.filter((kid) => String(kid.id) !== linkedId).forEach((orphan) => {
                        markSkipped(orphan, 'An extra episode sits beside the linked one');
                    });
                } else if (kids.length > 1) {
                    return { error: 'More than one next episode and no single link', chain, orphans: kids };
                } else {
                    child = kids[0];
                }
                current = child;
            }
            return { chain };
        }

        const roots = group.filter((lesion) => {
            if (blocked.has(String(lesion.id))) return false;
            const priorId = String(lesion.priorLesionId || '').trim();
            return !priorId || !idsOnChart.has(priorId) || blocked.has(priorId);
        });
        roots.sort((a, b) => {
            const created = String(a.createdAt || '').localeCompare(String(b.createdAt || ''));
            if (created) return created;
            const location = String(a.location || '').localeCompare(String(b.location || ''), 'en', { sensitivity: 'base' });
            if (location) return location;
            return String(a.id).localeCompare(String(b.id));
        });

        const usedSpots = new Set();
        group.forEach((lesion) => {
            const spot = Number(lesion.spotNumber) || 0;
            if (spot > 0) usedSpots.add(spot);
        });
        let nextSpot = usedSpots.size ? Math.max(...usedSpots) + 1 : 1;
        const allocatedSpots = new Set();

        roots.forEach((root) => {
            if (claimed.has(String(root.id)) || blocked.has(String(root.id))) return;
            const walked = walkChain(root);
            if (walked.error) {
                walked.chain.forEach((lesion) => markSkipped(lesion, walked.error));
                (walked.orphans || []).forEach((lesion) => markSkipped(lesion, walked.error));
                return;
            }
            const chain = walked.chain.filter((lesion) => !blocked.has(String(lesion.id)) && !claimed.has(String(lesion.id)));
            if (!chain.length) return;
            const existingSpots = [...new Set(chain.map((lesion) => Number(lesion.spotNumber) || 0).filter((spot) => spot > 0))];
            const disagrees = existingSpots.length > 1 || chain.some((lesion, index) => {
                const episode = Number(lesion.episodeNumber) || 0;
                return episode > 0 && episode !== index + 1;
            });
            if (disagrees || (existingSpots[0] && allocatedSpots.has(existingSpots[0]))) {
                chain.forEach((lesion) => {
                    claimed.add(String(lesion.id));
                    markSkipped(lesion, 'The spot number already disagrees');
                });
                return;
            }
            const spotNumber = existingSpots[0] || nextSpot++;
            allocatedSpots.add(spotNumber);
            const personId = personByChart.get(chartId) || '';
            chain.forEach((lesion, index) => {
                claimed.add(String(lesion.id));
                const episodeNumber = index + 1;
                const procedureId = String(lesion.procedureId || '').trim() || String(lesion.histologyBatchId || '').trim();
                const changed = String(lesion.personId || '') !== personId
                    || Number(lesion.spotNumber) !== spotNumber
                    || Number(lesion.episodeNumber) !== episodeNumber
                    || (procedureId && String(lesion.procedureId || '') !== procedureId);
                if (!changed) return;
                lesionAssignments.push({
                    lesionId: String(lesion.id),
                    personId,
                    spotNumber,
                    episodeNumber,
                    procedureId
                });
            });
        });

        group.forEach((lesion) => {
            const id = String(lesion.id);
            if (claimed.has(id) || skipped.some((row) => row.lesionId === id)) return;
            markSkipped(lesion, 'Left unchanged because the episode link is uncertain');
        });
    });

    return { personAssignments, lesionAssignments, skipped };
}

function consentEpisodeRefs(procedures, lesions) {
    const byId = new Map((Array.isArray(lesions) ? lesions : []).filter((item) => item && item.id).map((item) => [String(item.id), item]));
    return (Array.isArray(procedures) ? procedures : []).map((procedure) => {
        const lesion = byId.get(String(procedure?.lesionId || ''));
        return {
            lesionId: String(procedure?.lesionId || ''),
            personId: String(lesion?.personId || ''),
            spotNumber: Number(lesion?.spotNumber) || 0,
            episodeNumber: Number(lesion?.episodeNumber) || 0,
            procedureId: String(lesion?.procedureId || '')
        };
    });
}

function newTimelineId() {
    if (crypto.randomUUID) return crypto.randomUUID();
    return 'evt-' + Date.now() + '-' + Math.random().toString(16).slice(2);
}

function canonicalLesionStatus(status) {
    const raw = String(status || '');
    return LEGACY_STATUS_ALIASES[raw] || raw;
}

function lesionHasSavedHistology(lesion) {
    return !!String(lesion?.histologyResult || '').trim();
}

function lesionIsClinicallyFinalised(lesion) {
    if (!lesion) return false;
    if (lesion.linkedReexcisionId || (typeof lesionIsSupersededByReexcision === 'function' && lesionIsSupersededByReexcision(lesion))) {
        return true;
    }
    return canonicalLesionStatus(lesion.managementStatus) === 'no_followup';
}

function statusAfterSavedHistology(lesion) {
    if (lesion?.linkedReexcisionId || (typeof lesionIsSupersededByReexcision === 'function' && lesionIsSupersededByReexcision(lesion))) {
        return 'no_followup';
    }
    const contact = lesion?.contactState || '';
    const plan = lesion?.resultPlan || '';
    if (plan === 'no_followup') return 'no_followup';
    if (contact === 'appointment_requested') return 'appointment_requested';
    const stored = canonicalLesionStatus(lesion?.managementStatus);
    if (stored === 'no_followup') return 'no_followup';
    if (stored === 'appointment_requested') return 'appointment_requested';
    return 'needs_contact';
}

function planLineAfterSavedHistology(lesion, status) {
    const contact = lesion?.contactState === 'file_no_call'
        ? 'advised_now'
        : (lesion?.contactState || 'mark_for_contact');
    const extras = { fileNoCall: lesion?.contactState === 'file_no_call' };
    if (status === 'no_followup') {
        if (typeof lesionCanCloseNoFollowup === 'function' && !lesionCanCloseNoFollowup(lesion)) {
            return 'No follow-up — billing pending';
        }
        return 'No follow-up';
    }
    if (status === 'needs_contact' && isFurtherManagementPlan(lesion?.resultPlan) && lesion?.resultAdvisedAt) {
        return 'Further management opened';
    }
    return resultContactPlanLine(lesion?.resultPlan || '', contact, extras)
        || 'Result recorded. Plan not set.';
}

function repairLesionAwaitingAfterResult(lesion) {
    if (!lesion || !lesionHasSavedHistology(lesion)) return false;
    const stored = canonicalLesionStatus(lesion.managementStatus);
    let changed = false;
    if (stored === 'awaiting_histology') {
        const next = statusAfterSavedHistology(lesion);
        if (lesion.managementStatus !== next) {
            lesion.managementStatus = next;
            changed = true;
        }
    }
    if (!String(lesion.currentPlan || '').trim() || /awaiting histology/i.test(lesion.currentPlan)) {
        lesion.currentPlan = planLineAfterSavedHistology(lesion, canonicalLesionStatus(lesion.managementStatus));
        changed = true;
    }
    return changed;
}

function lesionLifecycleStatus(lesion) {
    // Re-excision handoff sets linkedReexcisionId; prior is clinically done.
    if (lesion?.linkedReexcisionId) return 'no_followup';
    const status = canonicalLesionStatus(lesion?.managementStatus);
    if (status === 'awaiting_histology' && lesionHasSavedHistology(lesion)) {
        return statusAfterSavedHistology(lesion);
    }
    if (status === 'awaiting_histology' && lesion && !lesionProcedureDone(lesion)) return 'planned_procedure';
    return status;
}

function isActiveManagementStatus(status) {
    return ACTIVE_MANAGEMENT_STATUSES.includes(canonicalLesionStatus(status));
}

const DEFAULT_CLINIC_TIME_ZONE = 'Australia/Brisbane';

function isValidIanaTimeZone(zone) {
    const name = String(zone || '').trim();
    if (!name) return false;
    try {
        Intl.DateTimeFormat('en-CA', { timeZone: name }).format(new Date());
        return true;
    } catch (err) {
        return false;
    }
}

function normalizeClinicTimeZone(value) {
    const name = String(value || '').trim();
    if (isValidIanaTimeZone(name)) return name;
    return DEFAULT_CLINIC_TIME_ZONE;
}

function clinicCalendarDayKey(timeZone, now) {
    const zone = normalizeClinicTimeZone(timeZone);
    const date = now instanceof Date ? now : new Date(now == null ? Date.now() : now);
    if (Number.isNaN(date.getTime())) return '';
    let parts;
    try {
        parts = new Intl.DateTimeFormat('en-CA', {
            timeZone: zone,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        }).formatToParts(date);
    } catch (err) {
        return '';
    }
    const pick = (type) => {
        const part = parts.find((item) => item.type === type);
        return part ? String(part.value || '') : '';
    };
    const year = pick('year');
    const month = pick('month').padStart(2, '0');
    const day = pick('day').padStart(2, '0');
    if (!/^\d{4}$/.test(year) || !/^\d{2}$/.test(month) || !/^\d{2}$/.test(day)) return '';
    return year + '-' + month + '-' + day;
}

function clinicTodayKey(timeZone, now) {
    const zone = timeZone || (typeof clinicTimeZone === 'function' ? clinicTimeZone() : DEFAULT_CLINIC_TIME_ZONE);
    return clinicCalendarDayKey(zone, now);
}

function normalizeFurtherActionDate(value) {
    const text = String(value || '').trim();
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
    if (!match) return '';
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const dt = new Date(Date.UTC(year, month - 1, day));
    if (dt.getUTCFullYear() !== year || dt.getUTCMonth() !== month - 1 || dt.getUTCDate() !== day) return '';
    return text;
}

function formatFurtherActionDateLabel(value) {
    const date = normalizeFurtherActionDate(value);
    if (!date) return '';
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = Number(date.slice(5, 7));
    const day = Number(date.slice(8, 10));
    return day + ' ' + months[month - 1] + ' ' + date.slice(0, 4);
}

function furtherActionDateIsFuture(lesion, todayKey) {
    const date = normalizeFurtherActionDate(lesion && lesion.furtherActionDate);
    const today = normalizeFurtherActionDate(todayKey);
    if (!date || !today) return false;
    return date > today;
}

function applyFurtherActionDate(lesion, raw) {
    if (!lesion) return { ok: false, reason: 'missing' };
    const trimmed = String(raw == null ? '' : raw).trim();
    const next = normalizeFurtherActionDate(trimmed);
    if (trimmed && !next) return { ok: false, reason: 'invalid' };
    lesion.furtherActionDate = next;
    return { ok: true, furtherActionDate: next };
}

function lesionStaysOnOpenAttentionList(lesion, options) {
    const opts = options || {};
    if (!lesion) return false;
    if (typeof lesionIsHiddenByReexcisionLink === 'function' && lesionIsHiddenByReexcisionLink(lesion)) return false;
    if (!isActiveManagementStatus(lesion.managementStatus)) return false;
    if (!opts.attentionOnly) return true;
    const today = opts.todayKey || clinicTodayKey(opts.timeZone, opts.now);
    return !furtherActionDateIsFuture(lesion, today);
}

function isRequiresManagementStatus(status) {
    return REQUIRES_MANAGEMENT_STATUSES.includes(canonicalLesionStatus(status));
}

function isRequiresManagementFilter(filter) {
    return REQUIRES_MANAGEMENT_FILTERS.includes(String(filter || ''));
}

function isCompletedManagementFilter(filter) {
    return filter === 'completed' || filter === 'no_followup';
}

function isPostResultFollowupStatus(status) {
    return POST_RESULT_FOLLOWUP_STATUSES.includes(canonicalLesionStatus(status));
}

function isInactiveForProcedureStatus(status) {
    const s = canonicalLesionStatus(status);
    return s === 'no_followup' || s === 'topical_followup' || isPostResultFollowupStatus(s);
}

function lesionRequiresBillingBeforeClose(lesion) {
    if (!lesion) return false;
    if (typeof lesionProcedureDone === 'function' ? lesionProcedureDone(lesion) : !!(lesion.procedureCompletedAt || lesion.excisionFinalisedAt)) {
        return true;
    }
    if (String(lesion.histologyResult || '').trim()) return true;
    const bill = typeof billingForLesion === 'function' ? billingForLesion(lesion.id) : null;
    return !!(bill && bill.status !== 'confirmed' && bill.status !== 'processed');
}

function lesionCanCloseNoFollowup(lesion) {
    if (!lesionRequiresBillingBeforeClose(lesion)) return true;
    if (typeof isLesionBillingProcessed === 'function') return isLesionBillingProcessed(lesion.id);
    const bill = typeof billingForLesion === 'function' ? billingForLesion(lesion.id) : null;
    return !!(bill && (bill.status === 'confirmed' || bill.status === 'processed'));
}

function resultPlanLabel(plan) {
    if (plan === 'further_management' || plan === 'plan_excision') return 'Needs further management';
    if (plan === 'no_followup') return 'No further action';
    return '';
}

function isFurtherManagementPlan(plan) {
    return plan === 'further_management' || plan === 'plan_excision';
}

function proposedPlanLabel(value) {
    const key = String(value || '').trim();
    if (key === 'topical') return 'Topical / field treatment';
    if (key === 'excision') return 'Excision';
    if (key === 'biopsy') return 'Biopsy';
    if (key === 'monitor') return 'Monitor / review';
    if (key === 'refer') return 'Refer';
    return '';
}

function formatProposedManagementPlan(lesion) {
    const tag = proposedPlanLabel(lesion?.proposedPlan);
    const note = String(lesion?.proposedPlanNote || '').trim();
    if (tag && note) return 'Proposed: ' + tag + ' — ' + note;
    if (tag) return 'Proposed: ' + tag;
    if (note) return 'Proposed: ' + note;
    return 'Plan not set';
}

function resultContactPlanLine(plan, contact, extras) {
    extras = extras || {};
    const chosen = String(plan || '').trim();
    const further = isFurtherManagementPlan(chosen);
    const decidedNfa = chosen === 'no_followup';
    if (extras.fileNoCall && decidedNfa) return 'No follow-up';
    if (contact === 'advised_now' && decidedNfa) return 'No follow-up';
    if (contact === 'advised_now' && further) return 'Further management opened';
    if (contact === 'appointment_requested') {
        if (further) return 'Discuss result. Needs further management.';
        if (decidedNfa) return 'Discuss result';
        if (!chosen) return 'Discuss result. Plan not set.';
        return 'Discuss result';
    }
    if (contact === 'not_reached') {
        if (further) return 'Further management — not reached';
        if (decidedNfa) return 'No follow-up — not reached';
        return 'Not reached. Plan not set.';
    }
    if (further) return 'Needs further management. Patient to be contacted.';
    if (decidedNfa) return 'No follow-up';
    return 'Result recorded. Plan not set.';
}

function reviewClosurePlanLine(lesion, billingHold) {
    const kind = lesionReviewDispositionKind(lesion);
    let line = 'No follow-up';
    if (kind === 'topical') line = 'Cleared at topical review';
    else if (kind === 'no_result') line = 'Closed without a result';
    else if (kind === 'cancel_plan') line = 'Planned procedure cancelled';
    else if (kind === 'refer') line = 'Episode complete';
    else if (kind === 'scheduled') line = 'Cleared at review';
    if (billingHold) {
        return line === 'No follow-up' ? 'No follow-up — billing pending' : (line + ' — billing pending');
    }
    return line;
}

function reviewClosureMessage(planOrLesion, billingHold) {
    const plan = planOrLesion && typeof planOrLesion === 'object'
        ? reviewClosurePlanLine(planOrLesion, billingHold)
        : String(planOrLesion || '').trim();
    if (billingHold) return 'Lesion clinically finalised. Unbilled items stay on Billing.';
    if (!plan || plan === 'No follow-up' || plan === 'No follow-up — billing pending') {
        return 'Lesion clinically finalised. No further action.';
    }
    return 'Lesion clinically finalised. ' + plan.replace(/\.$/, '') + '.';
}

function linkedLesionPlansReexcision(lesion) {
    if (!lesion?.priorLesionId) return false;
    const proposed = String(lesion.proposedPlan || '').trim();
    if (proposed === 'biopsy' || proposed === 'monitor' || proposed === 'refer' || proposed === 'topical') return false;
    if (proposed === 'excision') return true;
    const plan = String(lesion.plan || '');
    if (typeof isPunchShaveBiopsyPlan === 'function' && isPunchShaveBiopsyPlan(plan)) return false;
    if (typeof isMonitorLesionPlan === 'function' && isMonitorLesionPlan(plan)) return false;
    if (typeof isTopicalPlan === 'function' && isTopicalPlan(plan)) return false;
    if (typeof isReferLesionPlan === 'function' && isReferLesionPlan(plan)) return false;
    if (typeof isDeclineTreatmentPlan === 'function' && isDeclineTreatmentPlan(plan)) return false;
    if (/biopsy/i.test(plan) && !/excision/i.test(plan)) return false;
    if (/monitor/i.test(plan)) return false;
    const type = typeof lesionType === 'function' ? lesionType(lesion) : String(lesion.type || '');
    if (type === 'shave' || type === 'punch' || type === 'topical') return false;
    if (type === 'excision') return true;
    return /excision/i.test(plan);
}

function contactPlanCanBeReplaced(text) {
    const value = String(text || '').trim();
    if (!value) return true;
    return /needs contact|to be advised|not reached|plan not set|patient to be contacted|result recorded|result reviewed|mark for contact/i.test(value);
}

function repairMisleadingPlanLine(lesion) {
    if (!lesion) return false;
    const text = String(lesion.currentPlan || '').trim();
    if (!text) return false;
    const plan = String(lesion.resultPlan || '').trim();
    let next = '';
    if (!plan && /^(NFA — to be advised|NFA — not reached|Result reviewed — mark for contact)$/i.test(text)) {
        next = 'Result recorded. Plan not set.';
    } else if (/^Further management — (set plan on linked lesion|opening linked lesion)$/i.test(text)) {
        next = 'Further management opened';
    } else if (text === 'Further management after result discussed'
        && lesion.contactState !== 'advised_now'
        && lesion.contactState !== 'file_no_call') {
        next = 'Needs further management. Patient to be contacted.';
    } else if (text === 'Needs management' && !String(lesion.proposedPlan || '').trim()) {
        next = 'Plan not set';
    }
    if (!next || next === text) return false;
    lesion.currentPlan = next;
    return true;
}

function lesionProcedureDone(lesion) {
    return !!(lesion?.procedureCompletedAt || lesion?.excisionFinalisedAt);
}

function lesionIsOpenForProcedure(lesion) {
    if (!lesion) return false;
    if (typeof lesionIsHiddenByReexcisionLink === 'function' && lesionIsHiddenByReexcisionLink(lesion)) return false;
    const status = lesionLifecycleStatus(lesion);
    const planned = status === 'planned_procedure' || status === 'current_case';
    if (lesion.priorLesionId && !lesionProcedureDone(lesion)) {
        const t = lesionType(lesion);
        if (planned || t === 'excision' || String(lesion.plan || '').includes('Excision')) return true;
    }
    if (planned && lesion.priorLesionId) return true;
    if (lesionProcedureDone(lesion)) return false;
    if (status === 'awaiting_assessment') return false;
    if (isInactiveForProcedureStatus(status)) return false;
    const t = lesionType(lesion);
    if (t === 'punch' || t === 'shave' || t === 'excision') return true;
    if (planned) return true;
    const plan = String(lesion.plan || '');
    return plan.includes('Excision') || plan.includes('Biopsy');
}

function sanitizeOpenReexcisionChild(lesion) {
    if (!lesion?.priorLesionId) return false;
    const status = canonicalLesionStatus(lesion.managementStatus);
    if (status !== 'planned_procedure' && status !== 'current_case') return false;
    let changed = false;
    if (lesion.procedureCompletedAt) {
        lesion.procedureCompletedAt = '';
        changed = true;
    }
    if (lesion.excisionFinalisedAt) {
        lesion.excisionFinalisedAt = '';
        changed = true;
    }
    if (String(lesion.histologyResult || '').trim()) {
        if (!String(lesion.priorHistologyResult || '').trim()) {
            lesion.priorHistologyResult = String(lesion.histologyResult).trim();
        }
        lesion.histologyResult = '';
        lesion.histologyAt = '';
        changed = true;
    }
    return changed;
}

function deriveLesionType(record) {
    const explicit = String(record?.type || '').toLowerCase().trim();
    if (LESION_TYPES.includes(explicit)) return explicit;

    const plan = String(record?.plan || '');
    if (typeof isTopicalPlan === 'function' ? isTopicalPlan(plan) : /topical/i.test(plan)) return 'topical';

    const procedure = String(record?.procedureDetail?.procedure || record?.procedure || '');
    const punchType = String(record?.procedureDetail?.punchType || record?.punchType || '');
    const biopsyType = String(record?.biopsyType || '');
    const blob = [procedure, punchType, biopsyType].join(' ');

    if (/shave/i.test(blob) || /^shave$/i.test(procedure)) return 'shave';
    if (/punch excision/i.test(punchType) || /formal excision/i.test(punchType)) return 'excision';
    if (/^excision$/i.test(procedure) || plan.includes('Excision') || record?.managementStatus === 'planned_excision') {
        return 'excision';
    }
    if (/^punch$/i.test(procedure) || /punch/i.test(biopsyType) || /punch/i.test(punchType)) return 'punch';
    if (record?.managementStatus === 'awaiting_biopsy') return /shave/i.test(blob) ? 'shave' : 'punch';
    return 'none';
}

function lesionType(lesion) {
    return deriveLesionType(lesion);
}

function isShaveBiopsyLesion(lesion) {
    return lesionType(lesion) === 'shave';
}

function isPunchBiopsyLesion(lesion) {
    return lesionType(lesion) === 'punch';
}

function isExcisionLesion(lesion) {
    return lesionType(lesion) === 'excision';
}

function isVerbalConsentBiopsyType(biopsyType) {
    const raw = String(biopsyType || '');
    if (/shave/i.test(raw)) return true;
    if (/punch/i.test(raw) && !/excision/i.test(raw)) return true;
    return false;
}

function isDiagnosticBiopsyType(lesion) {
    const t = lesionType(lesion);
    return t === 'punch' || t === 'shave';
}

function lesionConsentStatus(lesion) {
    const raw = String(lesion?.consentStatus || '').toLowerCase();
    if (raw === 'written' || raw === 'formal' || raw === 'consented') return 'written';
    if (raw === 'verbal') return 'verbal';
    return '';
}

function lesionConsentLabel(lesion) {
    const status = lesionConsentStatus(lesion);
    if (status === 'written') return 'Consented';
    if (status === 'verbal') return 'Consented (verbally)';
    return '';
}

function lesionConsentRequirement(lesion) {
    const t = typeof lesionType === 'function' ? lesionType(lesion) : String(lesion?.type || '');
    if (t === 'excision') return 'written';
    if (t === 'shave' || t === 'punch') return 'verbal';
    const plan = String(lesion?.plan || '');
    const procedure = String(lesion?.procedureDetail?.procedure || lesion?.procedure || '');
    if (plan.includes('Excision') || /^excision$/i.test(procedure)) return 'written';
    if (t === 'topical' || t === 'none') return 'none';
    return 'any';
}

function lesionHasProcedureConsent(lesion) {
    if (!lesion) return false;
    const need = lesionConsentRequirement(lesion);
    if (need === 'none') return true;
    const status = lesionConsentStatus(lesion);
    if (!status) return false;
    if (need === 'written') return status === 'written';
    if (need === 'verbal') return status === 'verbal' || status === 'written';
    return status === 'verbal' || status === 'written';
}

function lesionConsentNeededLabel(lesion) {
    const label = lesionConsentLabel(lesion);
    if (label) return label;
    if (lesion?.priorLesionId && lesionConsentRequirement(lesion) === 'written') {
        return 'Written consent needed (re-excision)';
    }
    const need = lesionConsentRequirement(lesion);
    if (need === 'written') return 'Written consent needed';
    if (need === 'verbal') return 'Verbal consent needed';
    return 'Consent needed';
}

function practiceLesionPotNumber(lesion) {
    return typeof normalizeHistologyPot === 'function'
        ? normalizeHistologyPot(lesion?.histologyPot)
        : String(lesion?.histologyPot || '').trim();
}

function practiceLesionDayKey(lesion) {
    const iso = lesion?.procedureCompletedAt || lesion?.excisionFinalisedAt || lesion?.histologyAt || '';
    if (iso) {
        const d = new Date(iso);
        if (!Number.isNaN(d.getTime())) {
            return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0')].join('-');
        }
        return String(iso).slice(0, 10);
    }
    return String(lesion?.createdAt || lesion?.examinedAt || '').slice(0, 10);
}

function practiceLesionOrderKey(lesion) {
    return String(lesion?.createdAt || lesion?.examinedAt || lesion?.updatedAt || '') + '|' + String(lesion?.id || '');
}

function comparePracticeLesions(a, b) {
    const dayCmp = String(practiceLesionDayKey(a)).localeCompare(String(practiceLesionDayKey(b)));
    if (dayCmp) return dayCmp;
    const batchCmp = String(a?.histologyBatchId || '').localeCompare(String(b?.histologyBatchId || ''));
    if (batchCmp) return batchCmp;
    const pa = practiceLesionPotNumber(a);
    const pb = practiceLesionPotNumber(b);
    if (pa && pb) {
        const potCmp = pa.localeCompare(pb, 'en', { numeric: true, sensitivity: 'base' });
        if (potCmp) return potCmp;
    } else if (pa !== pb) {
        return pa ? -1 : 1;
    }
    return practiceLesionOrderKey(a).localeCompare(practiceLesionOrderKey(b));
}

function practiceLesionTreeNumber(lesion, idx) {
    return practiceLesionPotNumber(lesion) || String(Number(idx) + 1);
}

function isMonitorLesionPlan(plan) {
    return /Monitor/i.test(String(plan || ''));
}

function hasScheduledFollowUp(value) {
    return !!(value && value !== 'none');
}

function isTopicalFollowUpLesion(lesion) {
    if (!lesion) return false;
    if (typeof lesionIsClinicallyFinalised === 'function' && lesionIsClinicallyFinalised(lesion)) return false;
    if (lesion.linkedReexcisionId || lesion.linkedChildId) return false;
    const status = typeof lesionLifecycleStatus === 'function'
        ? lesionLifecycleStatus(lesion)
        : canonicalLesionStatus(lesion.managementStatus);
    if (status === 'topical_followup') return true;
    const topical = (typeof isTopicalPlan === 'function' && isTopicalPlan(lesion.plan))
        || (typeof lesionType === 'function' ? lesionType(lesion) : lesion.type) === 'topical';
    return !!(topical && hasScheduledFollowUp(lesion.topicalFollowUp));
}

function hasOutstandingTopicalWork(lesion) {
    if (!lesion) return false;
    const topical = (typeof isTopicalPlan === 'function' && isTopicalPlan(lesion.plan))
        || (typeof lesionType === 'function' ? lesionType(lesion) : lesion.type) === 'topical';
    if (!topical) return false;
    if (lesion.topicalDecision === 'pdt') {
        return !!(Number(lesion.pdtQuotedPrice) > 0
            || (Array.isArray(lesion.pdtRegions) && lesion.pdtRegions.length)
            || lesion.pdtAreaName);
    }
    return lesion.topicalDecision === 'cryotherapy' && !!lesion.cryoRecallRepeat;
}

function isScheduledReviewLesion(lesion) {
    if (!lesion) return false;
    if (isMonitorLesionPlan(lesion.plan) && hasScheduledFollowUp(lesion.monitorFollowUp)) return true;
    const decline = typeof isDeclineTreatmentPlan === 'function'
        ? isDeclineTreatmentPlan(lesion.plan)
        : /Declines Treatment/i.test(String(lesion.plan || ''));
    return !!(decline && hasScheduledFollowUp(lesion.declineReview));
}

function lesionReviewDispositionKind(lesion) {
    if (!lesion) return '';
    if (lesion.linkedReexcisionId || lesion.linkedChildId) return '';
    const status = typeof lesionLifecycleStatus === 'function'
        ? lesionLifecycleStatus(lesion)
        : canonicalLesionStatus(lesion.managementStatus);
    if (status === 'current_case' || status === 'no_followup') return '';
    const done = typeof lesionProcedureDone === 'function'
        ? lesionProcedureDone(lesion)
        : !!(lesion.procedureCompletedAt || lesion.excisionFinalisedAt);
    const histo = typeof lesionHasSavedHistology === 'function'
        ? lesionHasSavedHistology(lesion)
        : !!String(lesion.histologyResult || '').trim();
    if (done && !histo) return 'no_result';
    if (status === 'planned_procedure' && !done) return 'cancel_plan';
    if (histo) return 'result';
    const refer = (typeof isReferLesionPlan === 'function' && isReferLesionPlan(lesion.plan))
        || String(lesion.proposedPlan || '') === 'refer';
    if (refer) return 'refer';
    if (isTopicalFollowUpLesion(lesion) || hasOutstandingTopicalWork(lesion)) return 'topical';
    if (isScheduledReviewLesion(lesion)) return 'scheduled';
    return 'open';
}

function lesionAllowsReviewDisposition(lesion) {
    return !!lesionReviewDispositionKind(lesion);
}

function lesionCanOpenFurtherManagement(lesion) {
    if (!lesion) return false;
    if (typeof lesionHasSavedHistology === 'function' ? lesionHasSavedHistology(lesion) : !!String(lesion.histologyResult || '').trim()) {
        return true;
    }
    const kind = lesionReviewDispositionKind(lesion);
    return !!kind && kind !== 'no_result';
}

function lesionReviewDispositionCopy(lesion) {
    const kind = lesionReviewDispositionKind(lesion);
    if (kind === 'topical') {
        return {
            kind,
            heading: 'Review plan',
            nfa: 'Cleared / no further action',
            further: 'Needs further management',
            hint: 'Cleared at this review — no further action. The original topical episode stays on the history.',
            confirmTitle: 'Clear this lesion?',
            confirmBody: 'This marks the topical episode complete. The original prescription stays on the history.',
            confirmButton: 'Confirm cleared',
            placeholder: 'e.g. Field clear at review — no further treatment'
        };
    }
    if (kind === 'no_result') {
        return {
            kind,
            heading: 'Review plan',
            nfa: 'Close without result',
            further: 'Needs further management',
            hint: 'Closes this episode without a histology report. The procedure stays on the history.',
            confirmTitle: 'Close without a result?',
            confirmBody: 'This closes the episode without a histology report. The procedure stays on the history.',
            confirmButton: 'Close without result',
            placeholder: 'e.g. Report not available — close without result'
        };
    }
    if (kind === 'cancel_plan') {
        return {
            kind,
            heading: 'Review plan',
            nfa: 'Cancel plan / no further action',
            further: 'Needs further management',
            hint: 'Cancels this planned procedure. The original plan stays on the history.',
            confirmTitle: 'Cancel this planned procedure?',
            confirmBody: 'This cancels the planned procedure and clinically finalises the lesion. You can reopen it later if treatment is needed.',
            confirmButton: 'Cancel plan',
            placeholder: 'e.g. Patient cancelled the planned excision'
        };
    }
    if (kind === 'refer') {
        return {
            kind,
            heading: 'Review plan',
            nfa: 'Episode complete',
            further: 'Needs further management',
            hint: 'Marks this referral episode complete. The original referral plan stays on the history.',
            confirmTitle: 'Mark this referral episode complete?',
            confirmBody: 'This clinically finalises the lesion. The referral plan stays on the history.',
            confirmButton: 'Mark episode complete',
            placeholder: 'e.g. Referral sent to plastics'
        };
    }
    if (kind === 'scheduled') {
        return {
            kind,
            heading: 'Review plan',
            nfa: 'Cleared / no further action',
            further: 'Needs further management',
            hint: 'Cleared at this review — no further action. The original plan stays on the history.',
            confirmTitle: 'Clear this lesion at review?',
            confirmBody: 'This marks the scheduled review complete. The original plan stays on the history.',
            confirmButton: 'Confirm cleared',
            placeholder: 'e.g. Stable at review — no further treatment'
        };
    }
    if (kind === 'open') {
        return {
            kind,
            heading: 'Review plan',
            nfa: 'No further action',
            further: 'Needs further management',
            hint: 'Confirming no further action clinically finalises this lesion. You can reopen it later if more treatment is needed.',
            confirmTitle: 'No further action for this lesion?',
            confirmBody: 'This clinically finalises the lesion. You can change it later if more treatment is needed.',
            confirmButton: 'Confirm no further action',
            placeholder: 'e.g. Discussed — no further action'
        };
    }
    return {
        kind: kind || 'result',
        heading: 'Clinical plan',
        nfa: 'No further action',
        further: 'Needs further management',
        hint: 'Confirming no further action clinically finalises this lesion. You can reopen it later if more treatment is needed.',
        confirmTitle: 'No further action for this lesion?',
        confirmBody: 'This clinically finalises the lesion. You can change it later if more treatment is needed.',
        confirmButton: 'Confirm no further action',
        placeholder: 'e.g. Morning review — desk to phone after 10'
    };
}

function lesionOwnProcedureKind(lesion) {
    const t = typeof lesionType === 'function' ? lesionType(lesion) : String(lesion?.type || '');
    if (t === 'topical' || (typeof isTopicalPlan === 'function' && isTopicalPlan(lesion?.plan))) {
        return 'topical / field treatment';
    }
    if (t === 'shave') return 'shave biopsy';
    if (t === 'punch') return 'punch biopsy';
    if (t === 'excision') return lesion?.priorLesionId ? 're-excision' : 'excision';
    const proc = String(lesion?.procedureDetail?.procedure || lesion?.procedure || '');
    if (/shave/i.test(proc)) return 'shave biopsy';
    if (/punch/i.test(proc)) return 'punch biopsy';
    if (/excision/i.test(proc)) return lesion?.priorLesionId ? 're-excision' : 'excision';
    return 'procedure';
}

function priorProcedureKindForReexcision(lesion) {
    if (lesion?.priorLesionId && lesion.priorProcedureKind) return lesion.priorProcedureKind;
    if (lesion?.priorLesionId) {
        const prior = findLesionRecordById(lesion.priorLesionId);
        if (prior) return lesionOwnProcedureKind(prior);
    }
    return lesionOwnProcedureKind(lesion);
}

function collectReexcisionChildren(priorId) {
    if (!priorId) return [];
    const seen = new Set();
    const out = [];
    const add = (item) => {
        if (!item?.id || String(item.priorLesionId) !== String(priorId)) return;
        const id = String(item.id);
        if (seen.has(id)) return;
        seen.add(id);
        out.push(item);
    };
    (typeof managedLesions !== 'undefined' ? managedLesions : []).forEach(add);
    if (typeof lesions !== 'undefined' && Array.isArray(lesions)) lesions.forEach(add);
    return out;
}

function findLinkedReexcisionChild(priorId) {
    const children = collectReexcisionChildren(priorId);
    if (!children.length) return null;
    const prior = findLesionRecordById(priorId);
    if (prior?.linkedReexcisionId) {
        const linked = children.find((item) => String(item.id) === String(prior.linkedReexcisionId))
            || findLesionRecordById(prior.linkedReexcisionId);
        if (linked) return linked;
    }
    const open = children.filter((item) => {
        if (lesionProcedureDone(item)) return false;
        const status = lesionLifecycleStatus(item);
        return status !== 'no_followup';
    });
    const pool = open.length ? open : children;
    pool.sort((a, b) => String(b.updatedAt || b.createdAt || '').localeCompare(String(a.updatedAt || a.createdAt || '')));
    return pool[0] || null;
}

function findLiveReexcisionChild(prior) {
    if (!prior?.id) return null;
    return findLinkedReexcisionChild(prior.id);
}

function lesionHasOwnCompletedEpisode(lesion) {
    return !!(lesion
        && typeof lesionProcedureDone === 'function'
        && lesionProcedureDone(lesion)
        && lesionHasSavedHistology(lesion));
}

function findExistingChildOfPrior(priorId) {
    if (!priorId) return null;
    return findLinkedReexcisionChild(priorId) || collectReexcisionChildren(priorId)[0] || null;
}

function latestReexcisionEpisode(lesion) {
    let current = lesion;
    const seen = new Set();
    while (current?.id) {
        const id = String(current.id);
        if (seen.has(id)) break;
        seen.add(id);
        const child = findLinkedReexcisionChild(id);
        if (!child) break;
        current = child;
    }
    return current || lesion || null;
}

function lesionIsOpenReexcisionPlan(lesion) {
    if (!lesion) return false;
    if (lesionProcedureDone(lesion) || lesionIsCompletedEpisode(lesion)) return false;
    const status = lesionLifecycleStatus(lesion);
    return status === 'planned_procedure' || status === 'current_case';
}

function lesionIsSupersededByReexcision(lesion) {
    if (!lesion?.id) return false;
    return !!findLinkedReexcisionChild(lesion.id);
}

function lesionIsOrphanReexcisionDuplicate(lesion) {
    if (!lesion?.id || !lesion.priorLesionId) return false;
    const canonical = findLinkedReexcisionChild(lesion.priorLesionId);
    return !!(canonical && String(canonical.id) !== String(lesion.id));
}

function lesionIsPreviousProcedure(lesion) {
    if (!lesion) return false;
    if (lesionIsOrphanReexcisionDuplicate(lesion)) return false;
    if (lesion.linkedReexcisionId || lesion.linkedChildId) return true;
    return lesionIsSupersededByReexcision(lesion);
}

function lesionIsHiddenByReexcisionLink(lesion) {
    return lesionIsOrphanReexcisionDuplicate(lesion);
}

function lesionBelongsToOpenChart(lesion) {
    if (!lesion || !hasCurrentPatient()) return false;
    const chartId = lesionChartId(lesion);
    return !!chartId && chartId === currentPatient.chartId;
}

function lesionIsCompletedEpisode(lesion) {
    if (!lesion) return false;
    if (typeof lesionProcedureDone === 'function' && lesionProcedureDone(lesion)) return true;
    const status = typeof lesionLifecycleStatus === 'function'
        ? lesionLifecycleStatus(lesion)
        : canonicalLesionStatus(lesion.managementStatus);
    if (isPostResultFollowupStatus(status)) return true;
    return !!String(lesion.histologyResult || '').trim();
}

function isOpenManagementChild(lesion) {
    if (!lesion?.priorLesionId || lesionProcedureDone(lesion)) return false;
    const status = lesionLifecycleStatus(lesion);
    return status !== 'no_followup' && status !== 'awaiting_histology';
}

function lesionCanBookReexcision(lesion) {
    if (!lesion?.id || lesion.priorLesionId) return false;
    if (!lesionHasSavedHistology(lesion)) return false;
    if (findLinkedReexcisionChild(lesion.id)) return false;
    // Legacy only: advised further management with no child yet.
    return isFurtherManagementPlan(lesion.resultPlan)
        && !!(lesion.resultAdvisedAt || lesion.contactState === 'advised_now' || lesion.contactState === 'file_no_call');
}

function lesionCanSpawnReexcision(lesion) {
    if (!lesion?.id) return false;
    if (!lesionHasOwnCompletedEpisode(lesion)) return false;
    return collectReexcisionChildren(lesion.id).length === 0;
}

function lesionNeedsNewReexcisionRecord(lesion) {
    if (!lesionCanSpawnReexcision(lesion)) return false;
    return lesionIsCompletedEpisode(lesion) || lesionHasSavedHistology(lesion);
}

function normalizeHistologyCaseNumber(value) {
    return String(value || '').trim().replace(/\s+/g, ' ');
}

function normalizeHistologyPot(value) {
    return String(value || '').trim();
}

function findLesionRecordById(id) {
    if (!id) return null;
    const match = (item) => item && String(item.id) === String(id);
    const managed = (typeof managedLesions !== 'undefined' ? managedLesions : []).find(match);
    if (managed) return managed;
    if (typeof lesions !== 'undefined' && Array.isArray(lesions)) return lesions.find(match) || null;
    return null;
}

function histologyCaseDayKey(lesion) {
    const raw = lesion?.procedureCompletedAt || lesion?.excisionFinalisedAt || lesion?.histologyAt || '';
    if (!raw) return '';
    const date = new Date(raw);
    if (Number.isNaN(date.getTime())) return String(raw).slice(0, 10);
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + d;
}

function newHistologyBatchId() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return 'hb-' + crypto.randomUUID();
    return 'hb-' + Date.now() + '-' + Math.random().toString(16).slice(2);
}

function histologyBatchIdOf(lesion) {
    return String(lesion?.histologyBatchId || '').trim();
}

function collectLesionRecordsForHistology() {
    const map = new Map();
    (typeof managedLesions !== 'undefined' ? managedLesions : []).forEach((item) => {
        if (item?.id) map.set(String(item.id), item);
    });
    if (typeof lesions !== 'undefined' && Array.isArray(lesions)) {
        lesions.forEach((item) => {
            if (item?.id && !map.has(String(item.id))) map.set(String(item.id), item);
        });
    }
    return [...map.values()];
}

function histologyBatchSiblings(lesion) {
    const batchId = histologyBatchIdOf(lesion);
    if (!lesion?.id || !batchId) return [];
    return collectLesionRecordsForHistology().filter((item) => {
        if (!item?.id || String(item.id) === String(lesion.id)) return false;
        return histologyBatchIdOf(item) === batchId;
    }).sort((a, b) => {
        const pa = parseInt(normalizeHistologyPot(a.histologyPot), 10);
        const pb = parseInt(normalizeHistologyPot(b.histologyPot), 10);
        if (Number.isFinite(pa) && Number.isFinite(pb) && pa !== pb) return pa - pb;
        return String(a.location || '').localeCompare(String(b.location || ''));
    });
}

function histologyBatchSharedCaseNumber(lesion) {
    const own = normalizeHistologyCaseNumber(lesion?.histologyCaseNumber);
    if (own) return own;
    const hit = histologyBatchSiblings(lesion).find((item) => normalizeHistologyCaseNumber(item.histologyCaseNumber));
    return hit ? normalizeHistologyCaseNumber(hit.histologyCaseNumber) : '';
}

function stampHistologyBatchForProcedure(lesionList) {
    const items = (Array.isArray(lesionList) ? lesionList : []).filter((item) => item && item.id);
    if (!items.length) return '';
    const existing = items.map((item) => histologyBatchIdOf(item)).filter(Boolean);
    const batchId = existing[0] || newHistologyBatchId();
    const procedureId = items.map((item) => String(item.procedureId || '').trim()).find(Boolean) || batchId;
    items.forEach((lesion, idx) => {
        lesion.histologyBatchId = batchId;
        if (!String(lesion.procedureId || '').trim()) lesion.procedureId = procedureId;
        if (!normalizeHistologyPot(lesion.histologyPot)) {
            lesion.histologyPot = String(idx + 1);
        }
        const session = (typeof lesions !== 'undefined' && Array.isArray(lesions))
            ? lesions.find((row) => String(row.id) === String(lesion.id))
            : null;
        if (session && session !== lesion) {
            session.histologyBatchId = batchId;
            if (!String(session.procedureId || '').trim()) session.procedureId = lesion.procedureId;
            if (!normalizeHistologyPot(session.histologyPot)) session.histologyPot = lesion.histologyPot;
        }
        const managed = (typeof managedLesions !== 'undefined' ? managedLesions : [])
            .find((row) => String(row.id) === String(lesion.id));
        if (managed && managed !== lesion) {
            managed.histologyBatchId = batchId;
            if (!String(managed.procedureId || '').trim()) managed.procedureId = lesion.procedureId;
            if (!normalizeHistologyPot(managed.histologyPot)) managed.histologyPot = lesion.histologyPot;
        }
    });
    return batchId;
}

function lesionHasCopiedPriorHistology(lesion) {
    if (!lesion) return false;
    return !!(String(lesion.priorHistologyResult || '').trim()
        || String(lesion.priorHistologyDiagnosis || '').trim()
        || String(lesion.priorHistologyCaseNumber || '').trim());
}

function histologyAccessionParts(lesion, mode) {
    const autoPrior = mode === 'prior'
        || (mode !== 'own' && !!(lesion?.priorLesionId || lesionHasCopiedPriorHistology(lesion)));
    if (autoPrior) {
        return {
            number: normalizeHistologyCaseNumber(lesion?.priorHistologyCaseNumber),
            pot: normalizeHistologyPot(lesion?.priorHistologyPot),
            result: String(lesion?.priorHistologyResult || '').trim(),
            kind: lesion?.priorProcedureKind || ''
        };
    }
    return {
        number: normalizeHistologyCaseNumber(lesion?.histologyCaseNumber),
        pot: normalizeHistologyPot(lesion?.histologyPot),
        result: String(lesion?.histologyResult || '').trim(),
        kind: ''
    };
}

function formatHistologyAccession(lesion, mode) {
    const parts = histologyAccessionParts(lesion, mode);
    if (!parts.number) return '';
    return parts.pot ? (parts.number + ', pot ' + parts.pot) : parts.number;
}

function formatPriorProcedureDate(value) {
    const raw = String(value || '').trim();
    if (!raw) return '';
    const d = new Date(/^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw + 'T00:00:00' : raw);
    if (Number.isNaN(d.getTime())) return raw;
    return d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
}

function priorHistologySourceLabel(lesion) {
    const named = String(lesion?.priorHistologySourceName || '').trim();
    if (named) return named;
    const source = String(lesion?.priorHistologySource || '');
    if (source === 'colleague') return 'colleague / external clinic';
    if (source === 'own_notes') return 'old chart';
    return '';
}

function formatPriorHistologyCitation(lesion) {
    const cited = typeof lesionWithPriorHistologyCitation === 'function'
        ? lesionWithPriorHistologyCitation(lesion)
        : lesion;
    const parts = histologyAccessionParts(cited, 'prior');
    const accession = formatHistologyAccession(cited, 'prior');
    const dx = typeof formatDiagnosisDisplay === 'function'
        ? formatDiagnosisDisplay(cited?.priorHistologyDiagnosis || '')
        : String(cited?.priorHistologyDiagnosis || '').trim();
    const result = parts.result || '';
    const date = formatPriorProcedureDate(cited?.priorProcedureAt);
    const source = priorHistologySourceLabel(cited);
    if (!accession && !result && !dx && !date && !parts.kind) return '';
    let text = 'Previous histology';
    if (date) text += ' ' + date;
    if (accession) text += ' ' + accession;
    if (parts.kind) {
        const kindLabel = ({
            punch: 'punch biopsy',
            shave: 'shave',
            excision: 'excision',
            incisional: 'incisional biopsy'
        })[parts.kind] || parts.kind;
        text += ' (' + kindLabel + ')';
    }
    if (source) text += ' · ' + source;
    const breslow = String(cited?.priorBreslowMm || '').trim();
    if (breslow) text += ' · Breslow ' + breslow + ' mm';
    const detail = dx && result && dx.toLowerCase() !== result.toLowerCase()
        ? dx + '. ' + result
        : (dx || result);
    if (detail) text += ': ' + detail;
    return text;
}

function lesionWithPriorHistologyCitation(lesion) {
    if (!lesion?.priorLesionId) return lesion;
    const prior = findLesionRecordById(lesion.priorLesionId);
    if (!prior) return lesion;
    const kind = lesion.priorProcedureKind
        || (typeof priorProcedureKindForReexcision === 'function' ? priorProcedureKindForReexcision(prior) : '');
    return {
        ...lesion,
        priorHistologyCaseNumber: lesion.priorHistologyCaseNumber || prior.histologyCaseNumber || '',
        priorHistologyPot: lesion.priorHistologyPot || prior.histologyPot || '',
        priorHistologyResult: lesion.priorHistologyResult || prior.histologyResult || '',
        priorHistologyDiagnosis: lesion.priorHistologyDiagnosis || prior.histologyDiagnosis || '',
        priorProcedureAt: lesion.priorProcedureAt || prior.histologyAt || prior.priorProcedureAt || '',
        priorHistologySource: lesion.priorHistologySource || prior.priorHistologySource || '',
        priorHistologySourceName: lesion.priorHistologySourceName || prior.priorHistologySourceName || '',
        priorBreslowMm: lesion.priorBreslowMm || prior.priorBreslowMm || '',
        priorProcedureKind: kind
    };
}

function attachPriorHistologyToExLesion(exLesion, sourceId) {
    if (!exLesion) return exLesion;
    const id = sourceId || exLesion.sourceLesionId;
    const source = typeof findLesionRecordById === 'function' ? findLesionRecordById(id) : null;
    if (!source?.priorLesionId) return exLesion;
    const cited = typeof lesionWithPriorHistologyCitation === 'function'
        ? lesionWithPriorHistologyCitation(source)
        : source;
    exLesion.priorLesionId = source.priorLesionId;
    exLesion.priorProcedureKind = cited.priorProcedureKind || source.priorProcedureKind || '';
    exLesion.priorHistologyCaseNumber = cited.priorHistologyCaseNumber || '';
    exLesion.priorHistologyPot = cited.priorHistologyPot || '';
    exLesion.priorHistologyResult = cited.priorHistologyResult || '';
    return exLesion;
}

function copyPriorHistologyFromLesion(prior, extras) {
    extras = extras || {};
    return {
        priorHistologyCaseNumber: normalizeHistologyCaseNumber(extras.priorHistologyCaseNumber || prior?.histologyCaseNumber),
        priorHistologyPot: normalizeHistologyPot(extras.priorHistologyPot || prior?.histologyPot),
        priorHistologyResult: String(extras.priorHistologyResult || prior?.histologyResult || '').trim(),
        priorHistologyDiagnosis: String(extras.priorHistologyDiagnosis || prior?.histologyDiagnosis || '').trim(),
        priorProcedureKind: extras.priorProcedureKind || prior?.priorProcedureKind || '',
        priorProcedureAt: extras.priorProcedureAt || prior?.histologyAt || prior?.priorProcedureAt || '',
        priorHistologySource: extras.priorHistologySource || prior?.priorHistologySource || '',
        priorHistologySourceName: extras.priorHistologySourceName || prior?.priorHistologySourceName || '',
        priorBreslowMm: extras.priorBreslowMm || prior?.priorBreslowMm || ''
    };
}

function sameDayHistologyCaseSiblings(lesion) {
    if (!lesion?.id) return [];
    const chart = typeof lesionChartId === 'function' ? lesionChartId(lesion) : (lesion.chartId || '');
    const day = histologyCaseDayKey(lesion);
    return collectLesionRecordsForHistology().filter((item) => {
        if (!item?.id || String(item.id) === String(lesion.id)) return false;
        if (item.priorLesionId) return false;
        const itemChart = typeof lesionChartId === 'function' ? lesionChartId(item) : (item.chartId || '');
        if (chart && itemChart !== chart) return false;
        const done = (typeof lesionProcedureDone === 'function' ? lesionProcedureDone(item) : !!(item.procedureCompletedAt || item.excisionFinalisedAt))
            || (typeof lesionLifecycleStatus === 'function' ? lesionLifecycleStatus(item) : item.managementStatus) === 'awaiting_histology'
            || !!String(item.histologyResult || '').trim();
        if (!done) return false;
        if (!day) return false;
        return histologyCaseDayKey(item) === day;
    });
}

function histologyCaseShareSiblings(lesion) {
    if (!lesion?.id) return [];
    if (histologyBatchIdOf(lesion)) return histologyBatchSiblings(lesion);
    return sameDayHistologyCaseSiblings(lesion);
}

async function applyHistologyCaseToSiblings(sourceId, caseNumber) {
    const num = normalizeHistologyCaseNumber(caseNumber);
    const source = findLesionRecordById(sourceId);
    if (!num || !source) return { applied: 0, skipped: 0 };
    const siblings = histologyCaseShareSiblings(source);
    let applied = 0;
    let skipped = 0;
    for (const item of siblings) {
        const existing = normalizeHistologyCaseNumber(item.histologyCaseNumber);
        if (existing && existing !== num) {
            skipped += 1;
            continue;
        }
        if (existing === num) continue;
        item.histologyCaseNumber = num;
        item.updatedAt = new Date().toISOString();
        if (typeof saveManagedLesionRecord === 'function') {
            await saveManagedLesionRecord(item, 'histology-case', 'Lab case ' + num, { silent: true });
        } else if (typeof writeManagedLesion === 'function') {
            await writeManagedLesion(item);
            upsertManagedLesionMemory(item);
        }
        applied += 1;
    }
    if (applied && typeof renderManagedLesions === 'function') renderManagedLesions();
    if (applied && typeof renderChartSidebar === 'function') renderChartSidebar();
    return { applied, skipped };
}

function restorePriorTypeFromProcedure(lesion) {
    const proc = String(lesion?.procedureDetail?.procedure || lesion?.procedure || '');
    if (/shave/i.test(proc)) return 'shave';
    if (/punch/i.test(proc)) return 'punch';
    if (/excision/i.test(proc)) return 'excision';
    if (typeof isTopicalPlan === 'function' && isTopicalPlan(lesion?.plan)) return 'topical';
    const t = typeof deriveLesionType === 'function' ? deriveLesionType(lesion) : String(lesion?.type || '');
    return LESION_TYPES.includes(t) ? t : 'none';
}

function buildReexcisionLesionFromPrior(prior, extras) {
    extras = extras || {};
    const now = new Date().toISOString();
    const kind = typeof lesionOwnProcedureKind === 'function'
        ? lesionOwnProcedureKind(prior)
        : priorProcedureKindForReexcision(prior);
    const closure = extras.excisionClosureType || 'Ellipse';
    const reconstruction = extras.excisionReconstruction
        || (typeof closureToReconstruction === 'function' ? closureToReconstruction(closure) : '');
    const graftType = extras.graftType || '';
    const patient = typeof sessionPatientSnapshot === 'function' ? sessionPatientSnapshot() : {};
    const child = {
        id: extras.id || newLesionId(),
        createdAt: now,
        updatedAt: now,
        priorLesionId: String(prior.id),
        reexcisionOf: prior.location || '',
        priorProcedureKind: kind,
        location: extras.location || prior.location || '',
        impression: extras.impression || prior.impression || '',
        macroscopic: prior.macroscopic || 'Unspecified',
        dermoscopy: prior.dermoscopy || 'Unspecified',
        type: 'excision',
        plan: 'Formally Book Excision Procedure',
        managementStatus: 'planned_procedure',
        excisionMargin: extras.excisionMargin || '',
        excisionClosureType: closure,
        excisionReconstruction: reconstruction,
        graftType,
        billingGraftType: graftType,
        billingReconstruction: extras.billingReconstruction
            || (typeof inferBillingReconstruction === 'function'
                ? inferBillingReconstruction({ excisionReconstruction: reconstruction, excisionClosureType: closure })
                : ''),
        billingRegion: prior.billingRegion || '',
        billingLesionType: extras.billingLesionType
            || prior.billingLesionType
            || '',
        consentStatus: '',
        consentedAt: '',
        procedureCompletedAt: '',
        excisionFinalisedAt: '',
        procedureDetail: null,
        billingStatus: 'none',
        histologyResult: '',
        histologyAt: '',
        histologyCaseNumber: '',
        histologyPot: '',
        histologyBatchId: '',
        ...copyPriorHistologyFromLesion(prior, extras),
        timeline: [],
        history: [],
        currentPlan: extras.currentPlan || ('Re-excision planned after ' + kind),
        proposedPlan: 'excision',
        proposedPlanNote: extras.proposedPlanNote || '',
        schemaVersion: LESION_SCHEMA_VERSION,
        patientName: extras.patientName || prior.patientName || patient.patientName || '',
        patientDob: extras.patientDob || prior.patientDob || patient.patientDob || '',
        clinician: extras.clinician || prior.clinician || patient.clinician || '',
        chartId: extras.chartId || prior.chartId || patient.chartId || '',
        phone: extras.phone || prior.phone || patient.patientPhone || ''
    };
    copySpotIdentityFromPrior(child, prior);
    if (typeof applyInferredBillingLesionType === 'function') {
        applyInferredBillingLesionType(child);
    }
    return child;
}

function buildManagementChildFromPrior(prior, extras) {
    extras = extras || {};
    const now = new Date().toISOString();
    const kind = typeof lesionOwnProcedureKind === 'function'
        ? lesionOwnProcedureKind(prior)
        : priorProcedureKindForReexcision(prior);
    const patient = typeof sessionPatientSnapshot === 'function' ? sessionPatientSnapshot() : {};
    const proposedPlan = String(extras.proposedPlan || '').trim();
    const proposedPlanNote = String(extras.proposedPlanNote || '').trim();
    const contact = extras.contact || 'mark_for_contact';
    let managementStatus = 'needs_contact';
    if (contact === 'appointment_requested') managementStatus = 'appointment_requested';
    else if (contact === 'advised_now') managementStatus = 'awaiting_assessment';
    const child = {
        id: extras.id || newLesionId(),
        createdAt: now,
        updatedAt: now,
        priorLesionId: String(prior.id),
        reexcisionOf: prior.location || '',
        priorProcedureKind: kind,
        location: extras.location || prior.location || '',
        impression: extras.impression || prior.histologyDiagnosis || prior.impression || '',
        macroscopic: prior.macroscopic || 'Unspecified',
        dermoscopy: prior.dermoscopy || 'Unspecified',
        type: proposedPlan === 'topical' ? 'topical' : 'none',
        plan: '',
        managementStatus,
        consentStatus: '',
        consentedAt: '',
        procedureCompletedAt: '',
        excisionFinalisedAt: '',
        procedureDetail: null,
        billingStatus: 'none',
        billingRegion: prior.billingRegion || '',
        billingLesionType: extras.billingLesionType || prior.billingLesionType || '',
        histologyResult: '',
        histologyAt: '',
        histologyCaseNumber: '',
        histologyPot: '',
        histologyBatchId: '',
        ...copyPriorHistologyFromLesion(prior, extras),
        timeline: [],
        history: [],
        proposedPlan,
        proposedPlanNote,
        currentPlan: extras.currentPlan || formatProposedManagementPlan({ proposedPlan, proposedPlanNote }),
        contactState: contact === 'advised_now' ? 'advised_now' : (contact === 'not_reached' ? 'not_reached' : (contact === 'appointment_requested' ? 'appointment_requested' : 'mark_for_contact')),
        resultAdvisedAt: (contact === 'advised_now' || extras.advised) ? (extras.resultAdvisedAt || now) : '',
        contactUrgent: !!extras.contactUrgent,
        schemaVersion: LESION_SCHEMA_VERSION,
        patientName: extras.patientName || prior.patientName || patient.patientName || '',
        patientDob: extras.patientDob || prior.patientDob || patient.patientDob || '',
        clinician: extras.clinician || prior.clinician || patient.clinician || '',
        chartId: extras.chartId || prior.chartId || patient.chartId || '',
        phone: extras.phone || prior.phone || patient.patientPhone || ''
    };
    copySpotIdentityFromPrior(child, prior);
    if (typeof applyInferredBillingLesionType === 'function') {
        applyInferredBillingLesionType(child);
    }
    return child;
}

async function persistManagementChild(child) {
    if (!child?.id) return null;
    const now = new Date().toISOString();
    child.createdAt = child.createdAt || now;
    child.updatedAt = now;
    child.schemaVersion = LESION_SCHEMA_VERSION;
    applyChildChartIdentity(child);
    if (typeof vaultAuth !== 'undefined' && vaultAuth.username) child.owner = vaultAuth.username;
    if (!child.currentPlan) child.currentPlan = formatProposedManagementPlan(child);
    if (typeof appendLesionHistory === 'function' && !(child.history || []).length) {
        appendLesionHistory(child, 'created', 'Further management after prior episode');
    }
    if (typeof appendLesionTimeline === 'function' && !(child.timeline || []).some((event) => event && event.type === 'plan')) {
        appendLesionTimeline(child, {
            type: 'plan',
            note: 'Opened for further management after ' + (child.priorProcedureKind || 'prior procedure'),
            planAfter: child.currentPlan
        });
    }
    if (typeof writeManagedLesion === 'function') await writeManagedLesion(child);
    upsertManagedLesionMemory(child);
    if (typeof syncSessionLesionFromProcedure === 'function') syncSessionLesionFromProcedure(child);
    if (typeof renderManagedLesions === 'function') renderManagedLesions();
    if (typeof renderChartSidebar === 'function') renderChartSidebar();
    return child;
}

const spawnChildInFlight = new Map();

async function reopenExistingChildOfPrior(prior, child, extras) {
    extras = extras || {};
    const now = new Date().toISOString();
    const template = buildManagementChildFromPrior(prior, extras);
    const keepExcision = !lesionProcedureDone(child)
        && (child.type === 'excision'
            || (typeof lesionIsOpenReexcisionPlan === 'function' && lesionIsOpenReexcisionPlan(child))
            || String(child.plan || '').includes('Excision'));
    child.updatedAt = now;
    if (extras.location) child.location = extras.location;
    if (extras.impression) child.impression = extras.impression;
    if (typeof copyPriorHistologyFromLesion === 'function') {
        Object.assign(child, copyPriorHistologyFromLesion(prior, extras));
    }
    if (!keepExcision) {
        child.managementStatus = template.managementStatus;
        child.proposedPlan = template.proposedPlan || child.proposedPlan || '';
        child.proposedPlanNote = template.proposedPlanNote || child.proposedPlanNote || '';
        child.currentPlan = extras.currentPlan || formatProposedManagementPlan(child);
        child.contactState = template.contactState;
        child.resultAdvisedAt = template.resultAdvisedAt || child.resultAdvisedAt || '';
        child.contactUrgent = !!template.contactUrgent;
        if (typeof appendLesionTimeline === 'function') {
            appendLesionTimeline(child, {
                type: 'plan',
                note: 'Reopened the existing linked lesion instead of adding another child',
                planAfter: child.currentPlan
            });
        }
    }
    await persistManagementChild(child);
    await closePriorLesionAfterReexcision(prior, child);
    return child;
}

async function spawnFurtherManagementChild(prior, extras) {
    extras = extras || {};
    if (!prior?.id) return null;
    if (!lesionHasSavedHistology(prior) && !extras.allowWithoutHistology) {
        showToast('Save histology before opening further management.');
        return null;
    }
    const key = String(prior.id);
    if (spawnChildInFlight.has(key)) return spawnChildInFlight.get(key);

    const work = (async () => {
        const existing = findExistingChildOfPrior(prior.id);
        if (existing) {
            if (lesionHasOwnCompletedEpisode(existing)) return existing;
            const status = lesionLifecycleStatus(existing);
            const open = !lesionProcedureDone(existing) && status !== 'no_followup';
            if (open) {
                if (String(prior.linkedReexcisionId || prior.linkedChildId) !== String(existing.id)) {
                    await closePriorLesionAfterReexcision(prior, existing);
                }
                return existing;
            }
            return reopenExistingChildOfPrior(prior, existing, extras);
        }
        const child = buildManagementChildFromPrior(prior, extras);
        await persistManagementChild(child);
        await closePriorLesionAfterReexcision(prior, child);
        const savedPrior = managedLesions.find((item) => String(item.id) === String(prior.id));
        if (savedPrior) {
            savedPrior.resultPlan = 'further_management';
            savedPrior.linkedChildId = String(child.id);
            savedPrior.linkedReexcisionId = String(child.id);
            await writeManagedLesion(savedPrior);
            upsertManagedLesionMemory(savedPrior);
        }
        return child;
    })();

    spawnChildInFlight.set(key, work);
    try {
        return await work;
    } finally {
        spawnChildInFlight.delete(key);
    }
}

function consentRank(status) {
    if (status === 'written') return 2;
    if (status === 'verbal') return 1;
    return 0;
}

async function applyLesionConsent(id, kind) {
    const nextKind = kind === 'written' ? 'written' : 'verbal';
    const now = new Date().toISOString();
    const session = (typeof lesions !== 'undefined' && Array.isArray(lesions))
        ? lesions.find((item) => String(item.id) === String(id))
        : null;
    const managed = managedLesions.find((item) => String(item.id) === String(id));
    const current = session || managed;
    if (!current) return false;
    if (consentRank(lesionConsentStatus(session || managed)) >= consentRank(nextKind)
        && consentRank(lesionConsentStatus(managed)) >= consentRank(nextKind)) {
        return false;
    }

    const payload = {
        ...(managed || {}),
        ...(session || {}),
        id: current.id,
        consentStatus: nextKind,
        consentedAt: now
    };
    if (session) {
        session.consentStatus = nextKind;
        session.consentedAt = now;
    }
    if (typeof persistSessionLesionToVault === 'function' && typeof isVaultLoggedIn === 'function' && isVaultLoggedIn()) {
        await persistSessionLesionToVault(payload);
    } else if (managed) {
        const prior = lesionConsentStatus(managed);
        managed.consentStatus = nextKind;
        managed.consentedAt = now;
        if (consentRank(nextKind) > consentRank(prior)) {
            appendLesionTimeline(managed, {
                type: 'consent',
                note: nextKind === 'verbal'
                    ? 'Verbal consent (shave / saucerisation)'
                    : 'Written surgical consent generated',
                planAfter: managed.currentPlan || ''
            });
        }
        upsertManagedLesionMemory(managed);
    }
    return true;
}

function deriveLesionStatusFromPlan(record) {
    const plan = record?.plan || '';
    if (plan.includes('Biopsy') || plan.includes('Excision')) return 'planned_procedure';
    if (typeof isTopicalPlan === 'function' ? isTopicalPlan(plan) : /topical/i.test(plan)) {
        const hasFu = hasScheduledFollowUp(record.topicalFollowUp);
        if (record.topicalDecision === 'declined') return hasFu ? 'topical_followup' : 'no_followup';
        if (hasFu) return 'topical_followup';
        if (hasOutstandingTopicalWork(record)) return 'awaiting_assessment';
        return 'no_followup';
    }
    if (isMonitorLesionPlan(plan)) {
        return hasScheduledFollowUp(record.monitorFollowUp) ? 'awaiting_assessment' : 'no_followup';
    }
    if (typeof isDeclineTreatmentPlan === 'function' ? isDeclineTreatmentPlan(plan) : /Declines Treatment/i.test(plan)) {
        return hasScheduledFollowUp(record.declineReview) ? 'awaiting_assessment' : 'no_followup';
    }
    return 'awaiting_assessment';
}

function defaultPlanLine(lesion) {
    const status = lesionLifecycleStatus(lesion);
    const type = lesionType(lesion);
    if (status === 'awaiting_histology') {
        if (lesionHasSavedHistology(lesion)) {
            return planLineAfterSavedHistology(lesion, statusAfterSavedHistology(lesion));
        }
        return 'Awaiting histology';
    }
    if (status === 'needs_contact') {
        return resultContactPlanLine(lesion?.resultPlan || '', lesion?.contactState === 'file_no_call'
            ? 'advised_now'
            : (lesion?.contactState || 'mark_for_contact'), {
            fileNoCall: lesion?.contactState === 'file_no_call'
        });
    }
    if (status === 'appointment_requested') return 'Discuss result';
    if (status === 'current_case') return 'In theatre now';
    if (status === 'planned_procedure') {
        if (lesion?.priorLesionId && type === 'excision') return 'Re-excision planned';
        if (typeof lesionHasCopiedPriorHistology === 'function'
            ? lesionHasCopiedPriorHistology(lesion)
            : !!(lesion?.priorHistologyResult || lesion?.priorHistologyCaseNumber)) {
            return type === 'excision' ? 'Excision planned after prior histology' : 'Procedure planned after prior histology';
        }
        if (type === 'excision') return 'Excision planned';
        if (type === 'shave') return 'Shave biopsy planned';
        if (type === 'punch') return 'Punch biopsy planned';
        return 'Procedure planned';
    }
    if (status === 'topical_followup') return 'Topical follow-up';
    if (typeof isDeclineTreatmentPlan === 'function' && isDeclineTreatmentPlan(lesion?.plan)) {
        return typeof formatDeclinePlanSummary === 'function' && formatDeclinePlanSummary(lesion)
            ? formatDeclinePlanSummary(lesion)
            : 'Declined recommended treatment';
    }
    if (status === 'no_followup') return 'No follow-up';
    if (status === 'awaiting_assessment') {
        if (isMonitorLesionPlan(lesion?.plan) && hasScheduledFollowUp(lesion?.monitorFollowUp)) {
            return 'Monitor — review in ' + lesion.monitorFollowUp;
        }
        if (typeof isReferLesionPlan === 'function' && isReferLesionPlan(lesion?.plan)) {
            return 'Refer / Specialist';
        }
        if (hasOutstandingTopicalWork(lesion)) {
            if (lesion.topicalDecision === 'pdt') return 'PDT quoted — awaiting booking';
            if (lesion.cryoRecallRepeat) return 'Cryotherapy recall';
        }
        return 'Awaiting assessment';
    }
    return String(lesion?.plan || '').trim();
}

function ensureLesionTimeline(lesion) {
    if (!Array.isArray(lesion.timeline)) lesion.timeline = [];
    return lesion.timeline;
}

function appendLesionNote(lesion, text) {
    const note = String(text || '').trim();
    if (!lesion || !note) return null;
    lesion.adminCallNote = note;
    return appendLesionTimeline(lesion, { type: 'note', note });
}

function appendLesionTimeline(lesion, event) {
    if (!lesion) return null;
    const entry = {
        id: event?.id || newTimelineId(),
        at: event?.at || new Date().toISOString(),
        by: event?.by || (typeof vaultAuth !== 'undefined' ? vaultAuth.username : '') || '',
        type: TIMELINE_TYPES.includes(event?.type) ? event.type : 'plan',
        outcome: event?.outcome || '',
        note: event?.note || '',
        planAfter: event?.planAfter || ''
    };
    ensureLesionTimeline(lesion).push(entry);
    if (entry.planAfter) lesion.currentPlan = entry.planAfter;
    return entry;
}

function lesionTimelineNewestFirst(lesion) {
    return ensureLesionTimeline(lesion).slice().sort((a, b) => String(b.at || '').localeCompare(String(a.at || '')));
}

function isUnsuccessfulCallEvent(event) {
    if (!event) return false;
    if (event.type === 'spoke' || event.outcome === 'spoke' || event.outcome === 'booked') return false;
    if (event.type === 'sms' || event.type === 'result_advised' || event.type === 'plan' || event.type === 'procedure' || event.type === 'abort' || event.type === 'histology' || event.type === 'consent') return false;
    return event.type === 'call_attempt' || event.type === 'voicemail'
        || event.outcome === 'no answer' || event.outcome === 'voicemail'
        || event.outcome === 'declined' || event.outcome === 'patient not ready';
}

function lastUnsuccessfulCall(lesion) {
    const calls = lesionTimelineNewestFirst(lesion).filter((event) => {
        return ['call_attempt', 'voicemail', 'spoke', 'sms'].includes(event.type)
            || CALL_OUTCOMES.includes(event.outcome);
    });
    const last = calls[0];
    return isUnsuccessfulCallEvent(last) ? last : null;
}

function formatCallBadge(event) {
    if (!event) return '';
    if (event.type === 'voicemail' || event.outcome === 'voicemail') return 'Voicemail';
    if (event.outcome === 'declined') return 'Declined';
    if (event.outcome === 'patient not ready') return 'Patient not ready';
    if (event.outcome === 'booked') return 'Booked';
    if (event.outcome === 'no answer' || event.type === 'call_attempt') return 'No answer';
    return event.outcome || event.type;
}

function applyContactOutcomeToLesion(lesion, outcome) {
    if (!lesion) return;
    const value = String(outcome || '').trim().toLowerCase();
    if (value === 'booked') {
        lesion.managementStatus = 'appointment_requested';
        lesion.contactState = 'appointment_requested';
        if (contactPlanCanBeReplaced(lesion.currentPlan)) {
            lesion.currentPlan = 'Appointment booked to discuss result';
        }
        return;
    }
    if (value === 'patient not ready') {
        lesion.managementStatus = 'needs_contact';
        lesion.contactState = 'not_reached';
        lesion.currentPlan = 'Patient not ready — contact again';
        return;
    }
    if (value === 'no answer' || value === 'voicemail' || value === 'declined') {
        const status = lesionLifecycleStatus(lesion);
        if (status === 'needs_contact' || status === 'appointment_requested' || lesionHasSavedHistology(lesion)) {
            lesion.managementStatus = 'needs_contact';
            lesion.contactState = 'not_reached';
        }
    }
}

function lesionIemrCommsLine(lesion) {
    const status = typeof lesionLifecycleStatus === 'function' ? lesionLifecycleStatus(lesion) : canonicalLesionStatus(lesion?.managementStatus);
    if (status === 'appointment_requested') {
        return 'Result reviewed. Appointment requested to discuss.';
    }
    if (status === 'needs_contact') {
        if (!String(lesion?.resultPlan || '').trim()) {
            return lesion?.contactUrgent
                ? 'Result recorded. Plan not set. Urgent contact.'
                : 'Result recorded. Plan not set.';
        }
        return lesion?.contactUrgent ? 'Result reviewed. Urgent contact.' : 'Result reviewed. Patient to be contacted.';
    }
    const last = lesionTimelineNewestFirst(lesion).find((event) => event.type === 'result_advised' || event.type === 'plan');
    if (!last) return '';
    const text = String(lesion?.currentPlan || last.planAfter || last.note || '').trim();
    if (!text) return '';
    const advisedResult = last.type === 'result_advised' && lesionHasSavedHistology(lesion);
    return advisedResult ? ('Result advised: ' + text) : ('Plan: ' + text);
}

function isSameLocalDay(iso) {
    if (!iso) return false;
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return false;
    const now = new Date();
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
}

function isLesionCreatedToday(lesion) {
    return isSameLocalDay(lesion?.createdAt);
}

function lesionPerformedToday(lesion) {
    return isSameLocalDay(lesion?.procedureCompletedAt);
}

function convertLesionRecordV2(lesion) {
    if (!lesion || (Number(lesion.schemaVersion) || 0) >= 2) {
        if (lesion && !Array.isArray(lesion.timeline)) lesion.timeline = [];
        return { lesion, changed: false };
    }
    const oldStatus = lesion.managementStatus;
    const done = lesionProcedureDone(lesion);

    if (!lesion.type || !LESION_TYPES.includes(lesion.type)) {
        if (oldStatus === 'planned_excision') lesion.type = 'excision';
        else if (oldStatus === 'awaiting_biopsy') lesion.type = deriveLesionType(lesion) === 'shave' ? 'shave' : 'punch';
        else lesion.type = deriveLesionType(lesion);
    }

    if (oldStatus === 'planned_excision' || oldStatus === 'awaiting_biopsy' || oldStatus === 'current_case') {
        lesion.managementStatus = 'planned_procedure';
    } else if (oldStatus === 'awaiting_histology' && !done) {
        lesion.managementStatus = 'planned_procedure';
    }

    if (!Array.isArray(lesion.timeline)) lesion.timeline = [];
    const callNote = String(lesion.adminCallNote || '').trim();
    if (callNote && !lesion.timeline.length) {
        appendLesionTimeline(lesion, {
            type: 'plan',
            at: lesion.updatedAt || lesion.createdAt || new Date().toISOString(),
            by: lesion.owner || '',
            note: callNote,
            planAfter: ''
        });
    }
    if (!String(lesion.currentPlan || '').trim()) {
        lesion.currentPlan = defaultPlanLine(lesion);
    }
    lesion.schemaVersion = 2;
    return { lesion, changed: true };
}

function convertLesionRecordV3(lesion) {
    if (!lesion || (Number(lesion.schemaVersion) || 0) >= 3) {
        return { lesion, changed: false };
    }
    let changed = false;
    const status = canonicalLesionStatus(lesion.managementStatus);
    const hasResult = !!String(lesion.histologyResult || '').trim();
    if (status === 'awaiting_histology' && hasResult) {
        lesion.managementStatus = 'needs_contact';
        if (!String(lesion.currentPlan || '').trim() || /awaiting histology/i.test(lesion.currentPlan)) {
            lesion.currentPlan = planLineAfterSavedHistology(lesion, 'needs_contact');
        }
        changed = true;
    }
    lesion.schemaVersion = 3;
    return { lesion, changed: true };
}

function convertLesionRecordToCurrent(lesion) {
    if (!lesion) return { lesion, changed: false };
    let changed = false;
    if ((Number(lesion.schemaVersion) || 0) < 2) {
        changed = convertLesionRecordV2(lesion).changed || changed;
    }
    if ((Number(lesion.schemaVersion) || 0) < 3) {
        changed = convertLesionRecordV3(lesion).changed || changed;
    }
    if (repairLesionAwaitingAfterResult(lesion)) changed = true;
    if (repairMisleadingPlanLine(lesion)) changed = true;
    if (!Array.isArray(lesion.timeline)) {
        lesion.timeline = [];
        changed = true;
    }
    return { lesion, changed };
}

async function repairLesionsStuckAwaitingAfterResult() {
    if (!Array.isArray(managedLesions) || !managedLesions.length) return 0;
    let repaired = 0;
    for (const lesion of managedLesions) {
        const moved = repairLesionAwaitingAfterResult(lesion);
        const reworded = repairMisleadingPlanLine(lesion);
        if (!moved && !reworded) continue;
        if (!moved) {
            try {
                if (typeof writeManagedLesion === 'function' && typeof isVaultLoggedIn === 'function' && isVaultLoggedIn()) {
                    await writeManagedLesion(lesion);
                }
                upsertManagedLesionMemory(lesion);
            } catch (err) {
                upsertManagedLesionMemory(lesion);
            }
            continue;
        }
        try {
            if (typeof writeManagedLesion === 'function' && typeof isVaultLoggedIn === 'function' && isVaultLoggedIn()) {
                await writeManagedLesion(lesion);
            }
            upsertManagedLesionMemory(lesion);
            repaired += 1;
        } catch (err) {
            upsertManagedLesionMemory(lesion);
            repaired += 1;
        }
    }
    if (repaired && typeof showToast === 'function') {
        showToast('Moved ' + repaired + ' result' + (repaired === 1 ? '' : 's') + ' off Awaiting results.');
    }
    return repaired;
}

async function backupUserLesionsDir(username) {
    if (!vaultRootHandle) throw new Error('No clinic folder connected.');
    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const backupsRoot = await vaultRootHandle.getDirectoryHandle('backups', { create: true });
    const runDir = await backupsRoot.getDirectoryHandle('lesions-v1-' + stamp, { create: true });
    const usersDir = await runDir.getDirectoryHandle('users', { create: true });
    const userDir = await usersDir.getDirectoryHandle(username, { create: true });
    const dest = await userDir.getDirectoryHandle('lesions', { create: true });
    const src = await getUserLesionsDir(username, false);
    let copied = 0;
    for await (const [name, handle] of src.entries()) {
        if (handle.kind !== 'file' || !name.endsWith('.json.enc')) continue;
        const file = await handle.getFile();
        const destHandle = await dest.getFileHandle(name, { create: true });
        const writable = await destHandle.createWritable();
        await writable.write(await file.arrayBuffer());
        await writable.close();
        copied += 1;
    }
    return { stamp, copied };
}

async function listLesionConversionBackupNames() {
    if (!vaultRootHandle) return [];
    let backupsRoot;
    try {
        backupsRoot = await vaultRootHandle.getDirectoryHandle('backups', { create: false });
    } catch (err) {
        return [];
    }
    const names = [];
    for await (const [name, handle] of backupsRoot.entries()) {
        if (handle.kind === 'directory' && String(name).startsWith('lesions-v1-')) names.push(name);
    }
    names.sort();
    return names;
}

async function leftoverLesionConversionBackupCount() {
    return (await listLesionConversionBackupNames()).length;
}

async function pruneLesionConversionBackups(keepLatest) {
    if (!vaultRootHandle) return 0;
    const keep = keepLatest === 0 || keepLatest === '0'
        ? 0
        : Math.max(1, Number(keepLatest) || 1);
    let backupsRoot;
    try {
        backupsRoot = await vaultRootHandle.getDirectoryHandle('backups', { create: false });
    } catch (err) {
        return 0;
    }
    const names = await listLesionConversionBackupNames();
    const stale = names.slice(0, Math.max(0, names.length - keep));
    let removed = 0;
    for (const name of stale) {
        try {
            await backupsRoot.removeEntry(name, { recursive: true });
            removed += 1;
        } catch (err) {
            console.warn('Could not remove old lesion conversion backup', name, err);
        }
    }
    return removed;
}

async function convertManagedLesionsToSchemaV2() {
    const needs = managedLesions.filter((item) => (Number(item.schemaVersion) || 0) < LESION_SCHEMA_VERSION);
    if (!needs.length) {
        try { await pruneLesionConversionBackups(1); } catch (err) { /* leftover backups are best-effort */ }
        return 0;
    }
    try {
        await backupUserLesionsDir(vaultAuth.username);
    } catch (err) {
        console.warn('Lesion backup failed; conversion skipped', err);
        showToast('Could not back up lesion files, so they were left unchanged. Connect the clinic folder with write access and sign in again.');
        return 0;
    }
    let converted = 0;
    for (const lesion of needs) {
        const { changed } = convertLesionRecordToCurrent(lesion);
        if (!changed) continue;
        lesion.updatedAt = lesion.updatedAt || new Date().toISOString();
        await writeManagedLesion(lesion);
        converted += 1;
    }
    try { await pruneLesionConversionBackups(1); } catch (err) { /* leftover backups are best-effort */ }
    if (converted) {
        showToast('Updated ' + converted + ' lesion record' + (converted === 1 ? '' : 's') + ' to the procedure lifecycle. A backup was saved in the clinic folder.');
    }
    return converted;
}

function normalizeChartName(name) {
    return String(name || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function normalizeChartDob(dob) {
    return String(dob || '').trim().replace(/[^\d]/g, '');
}

function patientChartId(name, dob) {
    const n = normalizeChartName(name);
    const d = normalizeChartDob(dob);
    if (!n || !d) return '';
    return n + '|' + d;
}

function canonicalChartName(name) {
    const split = splitPatientName(name);
    const composed = composePatientName(split.firstName, split.lastName);
    return normalizeChartName(composed || name);
}

function canonicalPatientChartId(name, dob) {
    const n = canonicalChartName(name);
    const d = normalizeChartDob(dob);
    if (!n || !d) return '';
    return n + '|' + d;
}

function findChartById(id) {
    const wanted = String(id || '').trim();
    if (!wanted) return null;
    if (typeof findManagedChart === 'function') {
        const found = findManagedChart(wanted);
        if (found) return found;
    }
    const charts = typeof managedCharts !== 'undefined' && Array.isArray(managedCharts) ? managedCharts : [];
    return charts.find((chart) => chart && chart.id === wanted) || null;
}

function chartIdForName(name, dob) {
    const raw = patientChartId(name, dob);
    const canonical = canonicalPatientChartId(name, dob);
    if (!raw && !canonical) return '';
    const dobKey = normalizeChartDob(dob);
    const charts = typeof managedCharts !== 'undefined' && Array.isArray(managedCharts) ? managedCharts : [];
    const matches = charts.filter((chart) => {
        if (!chart?.id || normalizeChartDob(chart.dob) !== dobKey) return false;
        if (chart.id === raw || chart.id === canonical) return true;
        const chartName = composePatientName(chart.firstName, chart.lastName, chart.name);
        return !!canonical && canonicalPatientChartId(chartName, chart.dob) === canonical;
    });
    if (matches.length === 1) return matches[0].id;
    if (matches.length > 1) return '';
    return raw || canonical;
}

function identityChartId(record) {
    if (!record) return '';
    const stored = String(record.chartId || '').trim();
    const named = chartIdForName(record.patientName || record.name, record.patientDob || record.dob);
    if (stored && findChartById(stored)) return stored;
    if (named && findChartById(named)) return named;
    const byPerson = chartIdForPerson(record.personId);
    if (byPerson) return byPerson;
    return stored || named || '';
}

function lesionAncestry(lesion) {
    const chain = [];
    const seen = new Set();
    let current = lesion;
    while (current) {
        const id = String(current.id || '');
        if (id) {
            if (seen.has(id)) break;
            seen.add(id);
        }
        chain.push(current);
        if (!current.priorLesionId) break;
        const parent = typeof findLesionRecordById === 'function' ? findLesionRecordById(current.priorLesionId) : null;
        if (!parent) break;
        current = parent;
    }
    return chain;
}

function resolvedUnlinkedChartId(lesion) {
    if (!lesion) return '';
    const stored = String(lesion.chartId || '').trim();
    const namedId = chartIdForName(lesion.patientName || lesion.name, lesion.patientDob || lesion.dob);
    const namedChart = namedId && findChartById(namedId);
    const storedChart = stored && findChartById(stored);
    if (namedChart && (!storedChart || namedChart.id !== storedChart.id)) return namedChart.id;
    return identityChartId(lesion);
}

function lesionChartId(lesion) {
    if (!lesion) return '';
    const chain = lesionAncestry(lesion);
    const root = chain[chain.length - 1] || lesion;
    return resolvedUnlinkedChartId(root);
}

function recordAttachmentChartId(record) {
    if (!record) return '';
    if (record.lesionId && typeof findLesionRecordById === 'function') {
        const lesion = findLesionRecordById(record.lesionId);
        if (lesion) return lesionChartId(lesion);
    }
    if (record.patientName || record.priorLesionId || record.managementStatus || record.location) {
        const id = lesionChartId(record);
        if (id) return id;
    }
    return String(record.chartId || '').trim();
}

function attachmentPatientIdentity(record) {
    const chartId = recordAttachmentChartId(record);
    const chart = findChartById(chartId);
    if (chart) {
        const name = composePatientName(chart.firstName, chart.lastName, chart.name);
        const split = splitPatientName(name);
        return {
            name,
            firstName: chart.firstName || split.firstName,
            lastName: chart.lastName || split.lastName,
            dob: chart.dob || '',
            phone: chart.phone || '',
            clinician: chart.clinician || record?.clinician || '',
            chartId: chart.id
        };
    }
    const chain = lesionAncestry(record);
    const root = chain[chain.length - 1] || record || {};
    const name = root.patientName || root.name || record?.patientName || record?.name || '';
    const split = splitPatientName(name);
    return {
        name,
        firstName: root.firstName || record?.firstName || split.firstName,
        lastName: root.lastName || record?.lastName || split.lastName,
        dob: root.patientDob || root.dob || record?.patientDob || record?.dob || '',
        phone: root.patientPhone || root.phone || record?.patientPhone || record?.phone || '',
        clinician: root.clinician || record?.clinician || '',
        chartId: chartId || root.chartId || record?.chartId || ''
    };
}

function lesionSaveIdentity(existing, openSnap, sessionLesion) {
    existing = existing || {};
    openSnap = openSnap || {};
    sessionLesion = sessionLesion || {};
    const existingId = lesionChartId(existing);
    const openId = String(openSnap.chartId || '').trim();
    const keep = !!(existingId && (!openId || openId !== existingId));
    if (keep) {
        const owner = attachmentPatientIdentity(existing);
        const ownerMatches = owner && owner.chartId === existingId;
        return {
            patientName: (ownerMatches && owner.name) || existing.patientName || sessionLesion.patientName || '',
            patientDob: (ownerMatches && owner.dob) || existing.patientDob || sessionLesion.patientDob || '',
            patientPhone: existing.patientPhone || sessionLesion.patientPhone || existing.phone || sessionLesion.phone || (ownerMatches && owner.phone) || '',
            clinician: existing.clinician || sessionLesion.clinician || openSnap.clinician || '',
            chartId: existingId
        };
    }
    return {
        patientName: openSnap.patientName || sessionLesion.patientName || existing.patientName || '',
        patientDob: openSnap.patientDob || sessionLesion.patientDob || existing.patientDob || '',
        patientPhone: openSnap.patientPhone || sessionLesion.patientPhone || existing.patientPhone || sessionLesion.phone || existing.phone || '',
        clinician: openSnap.clinician || sessionLesion.clinician || existing.clinician || '',
        chartId: openId || sessionLesion.chartId || existing.chartId || identityChartId(sessionLesion) || ''
    };
}

function lesionChildIdentity(child, prior) {
    const ownerId = prior ? lesionChartId(prior) : '';
    if (prior && ownerId) {
        return {
            chartId: ownerId,
            patientName: prior.patientName || child?.patientName || '',
            patientDob: prior.patientDob || child?.patientDob || '',
            phone: prior.phone || prior.patientPhone || child?.phone || '',
            clinician: prior.clinician || child?.clinician || ''
        };
    }
    const open = hasCurrentPatient() ? sessionPatientSnapshot() : {};
    return {
        chartId: child?.chartId || open.chartId || chartIdForName(child?.patientName, child?.patientDob),
        patientName: child?.patientName || open.patientName || '',
        patientDob: child?.patientDob || open.patientDob || '',
        phone: child?.phone || open.patientPhone || '',
        clinician: child?.clinician || open.clinician || ''
    };
}

function applyChildChartIdentity(child) {
    if (!child) return child;
    const prior = child.priorLesionId && typeof findLesionRecordById === 'function'
        ? findLesionRecordById(child.priorLesionId)
        : null;
    const ident = lesionChildIdentity(child, prior);
    if (ident.chartId) child.chartId = ident.chartId;
    if (ident.patientName) child.patientName = ident.patientName;
    if (ident.patientDob) child.patientDob = ident.patientDob;
    if (ident.phone) child.phone = ident.phone;
    if (ident.clinician) child.clinician = child.clinician || ident.clinician;
    if (prior) copySpotIdentityFromPrior(child, prior);
    return child;
}

function lesionChartRepair(lesion) {
    if (!lesion?.id) return null;
    const chain = lesionAncestry(lesion);
    const root = chain[chain.length - 1] || lesion;
    const linked = chain.length > 1 && root && String(root.id) !== String(lesion.id);
    if (linked) {
        const resolved = lesionChartId(root);
        if (!resolved) return null;
        const sameChart = String(lesion.chartId || '') === resolved;
        const sameName = !root.patientName || lesion.patientName === root.patientName;
        const sameDob = !root.patientDob || lesion.patientDob === root.patientDob;
        if (sameChart && sameName && sameDob) return null;
        return {
            chartId: resolved,
            patientName: root.patientName || lesion.patientName || '',
            patientDob: root.patientDob || lesion.patientDob || '',
            phone: lesion.phone || root.phone || root.patientPhone || ''
        };
    }
    const stored = String(lesion.chartId || '').trim();
    const namedId = chartIdForName(lesion.patientName, lesion.patientDob);
    const namedChart = namedId ? findChartById(namedId) : null;
    if (!namedChart || stored === namedChart.id) return null;
    if (stored && findChartById(stored) && findChartById(stored).id === namedChart.id) return null;
    return {
        chartId: namedChart.id,
        patientName: lesion.patientName || '',
        patientDob: lesion.patientDob || '',
        phone: lesion.phone || ''
    };
}

async function repairMisattachedLesionCharts() {
    const items = typeof managedLesions !== 'undefined' ? managedLesions : [];
    let fixed = 0;
    for (const lesion of items) {
        const repair = lesionChartRepair(lesion);
        if (!repair) continue;
        lesion.chartId = repair.chartId;
        if (repair.patientName) lesion.patientName = repair.patientName;
        if (repair.patientDob) lesion.patientDob = repair.patientDob;
        if (repair.phone && !lesion.phone) lesion.phone = repair.phone;
        try {
            if (typeof saveManagedLesionRecord === 'function') {
                await saveManagedLesionRecord(lesion, 'repair:chart', 'Moved back to the patient chart this lesion belongs to', { silent: true });
            }
            fixed += 1;
        } catch (err) {
            console.warn('Could not move lesion back to its chart', lesion.id, err);
        }
    }
    if (fixed && typeof showToast === 'function') {
        showToast('Moved ' + fixed + ' lesion' + (fixed === 1 ? '' : 's') + ' back onto the correct patient chart.');
    }
    return fixed;
}

function hasCurrentPatient() {
    return !!(currentPatient && currentPatient.chartId);
}

function blockOpenChartWhileVisitActive(nextChartId) {
    if (!hasCurrentPatient()) return false;
    const next = String(nextChartId || '').trim();
    if (next && String(currentPatient.chartId || '') === next) return false;
    showToast('Finalise this visit before opening another chart.');
    return true;
}

function blockAddPatientWhileVisitActive() {
    if (!hasCurrentPatient()) return false;
    showToast('Finalise this visit before adding another patient.');
    return true;
}

function syncOpenChartSearchGate() {
    const open = hasCurrentPatient();
    const el = document.getElementById('headerOpenChartTools');
    if (el) el.classList.toggle('hidden', open);
    if (open && typeof hideChartSearchResults === 'function') hideChartSearchResults();
}

function onHeaderPatientButtonClick() {
    if (hasCurrentPatient()) {
        if (typeof switchWorkspaceTab === 'function') switchWorkspaceTab('management');
        return;
    }
    focusPracticeBoardSearch();
}

function splitPatientName(full) {
    const raw = String(full || '').trim();
    if (!raw) return { firstName: '', lastName: '' };
    if (raw.includes(',')) {
        const bits = raw.split(',');
        return { lastName: (bits.shift() || '').trim(), firstName: bits.join(',').trim() };
    }
    const parts = raw.split(/\s+/).filter(Boolean);
    if (parts.length === 1) return { firstName: parts[0], lastName: '' };
    return { firstName: parts.slice(0, -1).join(' '), lastName: parts[parts.length - 1] };
}

function composePatientName(firstName, lastName, fallback) {
    const combined = [firstName, lastName].map((part) => String(part || '').trim()).filter(Boolean).join(' ');
    return combined || String(fallback || '').trim();
}

function normalizePhoneDigits(phone) {
    return String(phone || '').replace(/\D/g, '');
}

function formatAuPhoneDisplay(raw) {
    let digits = normalizePhoneDigits(raw);
    if (!digits) return '';
    if (digits.startsWith('61') && digits.length >= 9) digits = '0' + digits.slice(2);
    if (digits.length <= 9 && digits.startsWith('4') && !digits.startsWith('04')) digits = '0' + digits;
    digits = digits.slice(0, 10);
    if (digits.startsWith('04')) {
        if (digits.length <= 4) return digits;
        if (digits.length <= 7) return digits.slice(0, 4) + ' ' + digits.slice(4);
        return digits.slice(0, 4) + ' ' + digits.slice(4, 7) + ' ' + digits.slice(7);
    }
    if (digits.startsWith('0')) {
        if (digits.length <= 2) return digits;
        if (digits.length <= 6) return '(' + digits.slice(0, 2) + ') ' + digits.slice(2);
        return '(' + digits.slice(0, 2) + ') ' + digits.slice(2, 6) + ' ' + digits.slice(6);
    }
    return digits;
}

function padDobPart(value, size) {
    const digits = String(value || '').replace(/\D/g, '');
    if (!digits) return '';
    return digits.length >= size ? digits.slice(0, size) : digits.padStart(size, '0');
}

function parseDobDigits(raw) {
    const digits = String(raw || '').replace(/\D/g, '');
    return {
        day: digits.slice(0, 2),
        month: digits.slice(2, 4),
        year: digits.slice(4, 8)
    };
}

function composeChartPatientDob(day, month, year) {
    const dd = padDobPart(day, 2);
    const mm = padDobPart(month, 2);
    const yyyy = String(year || '').replace(/\D/g, '').slice(0, 4);
    if (!dd && !mm && !yyyy) return '';
    if (yyyy.length !== 4) return '';
    const d = Number(dd);
    const m = Number(mm);
    const y = Number(yyyy);
    if (!d || d < 1 || d > 31 || !m || m < 1 || m > 12 || y < 1900) return '';
    const dt = new Date(y, m - 1, d);
    if (dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== d) return '';
    if (dt.getTime() > Date.now()) return '';
    return dd + '/' + mm + '/' + yyyy;
}

function readChartPatientDobFields() {
    return composeChartPatientDob(
        document.getElementById('chartPatientDobDay')?.value,
        document.getElementById('chartPatientDobMonth')?.value,
        document.getElementById('chartPatientDobYear')?.value
    );
}

function fillChartPatientDobFields(raw) {
    const parts = parseDobDigits(raw);
    const dayEl = document.getElementById('chartPatientDobDay');
    const monthEl = document.getElementById('chartPatientDobMonth');
    const yearEl = document.getElementById('chartPatientDobYear');
    if (dayEl) dayEl.value = parts.day;
    if (monthEl) monthEl.value = parts.month;
    if (yearEl) yearEl.value = parts.year;
    syncChartPatientDobHidden();
}

function syncChartPatientDobHidden() {
    const hidden = document.getElementById('chartPatientDob');
    if (hidden) hidden.value = readChartPatientDobFields();
}

function dobSegmentShouldAdvance(el, maxLen) {
    const digits = String(el?.value || '').replace(/\D/g, '');
    if (digits.length >= maxLen) return true;
    if (maxLen !== 2 || digits.length !== 1) return false;
    const n = Number(digits);
    if (el.id === 'chartPatientDobDay') return n >= 4;
    if (el.id === 'chartPatientDobMonth') return n >= 2;
    return false;
}

function bindChartPatientDobSegment(el, nextId, prevId, maxLen) {
    if (!el || el.dataset.dobBound === '1') return;
    el.dataset.dobBound = '1';
    el.addEventListener('input', () => {
        el.value = String(el.value || '').replace(/\D/g, '').slice(0, maxLen);
        syncChartPatientDobHidden();
        if (dobSegmentShouldAdvance(el, maxLen) && nextId) {
            document.getElementById(nextId)?.focus();
            document.getElementById(nextId)?.select();
        }
    });
    el.addEventListener('keydown', (event) => {
        if (event.key === 'Backspace' && !el.value && prevId) {
            event.preventDefault();
            const prev = document.getElementById(prevId);
            if (prev) {
                prev.focus();
                prev.select();
            }
        }
    });
    el.addEventListener('blur', () => {
        if (maxLen === 2 && el.value) el.value = padDobPart(el.value, 2);
        syncChartPatientDobHidden();
    });
    el.addEventListener('paste', (event) => {
        const text = (event.clipboardData || window.clipboardData)?.getData('text') || '';
        const digits = String(text).replace(/\D/g, '');
        if (digits.length < 8) return;
        event.preventDefault();
        fillChartPatientDobFields(digits);
        document.getElementById('chartPatientPhone')?.focus();
    });
}

function bindChartPatientIdentityFields() {
    const dayEl = document.getElementById('chartPatientDobDay');
    const monthEl = document.getElementById('chartPatientDobMonth');
    const yearEl = document.getElementById('chartPatientDobYear');
    const phoneEl = document.getElementById('chartPatientPhone');
    bindChartPatientDobSegment(dayEl, 'chartPatientDobMonth', '', 2);
    bindChartPatientDobSegment(monthEl, 'chartPatientDobYear', 'chartPatientDobDay', 2);
    bindChartPatientDobSegment(yearEl, 'chartPatientPhone', 'chartPatientDobMonth', 4);
    if (phoneEl && phoneEl.dataset.phoneBound !== '1') {
        phoneEl.dataset.phoneBound = '1';
        phoneEl.addEventListener('input', () => {
            phoneEl.value = formatAuPhoneDisplay(phoneEl.value);
        });
        phoneEl.addEventListener('blur', () => {
            phoneEl.value = formatAuPhoneDisplay(phoneEl.value);
        });
        phoneEl.addEventListener('paste', (event) => {
            const text = (event.clipboardData || window.clipboardData)?.getData('text') || '';
            if (!text) return;
            event.preventDefault();
            phoneEl.value = formatAuPhoneDisplay(text);
        });
    }
}

function patientIdentityFromRecord(source) {
    const firstName = String(source?.firstName || '').trim();
    const lastName = String(source?.lastName || '').trim();
    const name = composePatientName(firstName, lastName, source?.name || source?.patientName);
    const split = splitPatientName(name);
    return {
        name,
        firstName: firstName || split.firstName,
        lastName: lastName || split.lastName,
        dob: String(source?.dob || source?.patientDob || '').trim(),
        phone: String(source?.phone || source?.patientPhone || '').trim(),
        clinician: String(source?.clinician || '').trim(),
        chartId: source?.chartId || patientChartId(name, source?.dob || source?.patientDob)
    };
}

function sessionPatientSnapshot() {
    const clinician = (typeof loggedInDoctorName === 'function' && loggedInDoctorName()) || '';
    const openChart = typeof currentManagedChart === 'function' ? currentManagedChart() : null;
    if (!hasCurrentPatient()) {
        return {
            patientName: '',
            patientDob: '',
            patientPhone: '',
            clinician,
            chartId: '',
            personId: ''
        };
    }
    return {
        patientName: currentPatient.name,
        patientDob: currentPatient.dob,
        patientPhone: currentPatient.phone || '',
        clinician: clinician || currentPatient.clinician || '',
        chartId: currentPatient.chartId,
        personId: currentPatient.personId || openChart?.personId || ''
    };
}

function lastChartStorageKey() {
    return 'dermrecord.lastChart.' + (vaultAuth.username || 'session');
}

function clearPlaintextLastChartStorage() {
    try {
        const keys = [];
        for (let i = 0; i < localStorage.length; i += 1) {
            const key = localStorage.key(i);
            if (key && key.indexOf('dermrecord.lastChart.') === 0) keys.push(key);
        }
        keys.forEach((key) => localStorage.removeItem(key));
    } catch (err) {
        /* Private mode may block storage. */
    }
}

function takePlaintextLastChartId() {
    try {
        const raw = localStorage.getItem(lastChartStorageKey());
        if (!raw) return '';
        const saved = JSON.parse(raw);
        const id = String(saved?.chartId || '').trim();
        if (id) return id;
        return typeof patientChartId === 'function' ? (patientChartId(saved?.name, saved?.dob) || '') : '';
    } catch (err) {
        return '';
    }
}

async function adoptPlaintextLastChartIfNeeded() {
    const existing = typeof lastOpenChartId === 'function' ? lastOpenChartId() : '';
    const migrated = takePlaintextLastChartId();
    if (existing || !migrated) {
        clearPlaintextLastChartStorage();
        return;
    }
    if (typeof persistUiSession !== 'function') return;
    await persistUiSession(migrated);
    clearPlaintextLastChartStorage();
}

function rememberLastPatient() {
    const id = hasCurrentPatient() ? String(currentPatient.chartId || '').trim() : '';
    if (typeof persistUiSession === 'function') {
        persistUiSession(id).catch(() => {});
    }
}

function readLastPatient() {
    const id = typeof lastOpenChartId === 'function' ? lastOpenChartId() : '';
    if (!id) return null;
    return { chartId: id };
}

function restoreLastPatient() {
    const saved = readLastPatient();
    if (!saved?.chartId) return false;
    const chart = typeof findManagedChart === 'function' ? findManagedChart(saved.chartId) : null;
    if (!chart) return false;
    setCurrentPatient(patientIdentityFromRecord(chart), { silentRestore: true });
    return true;
}

function applyCurrentPatientToForms() {
    const name = currentPatient.name || '';
    const dob = currentPatient.dob || '';
    const doctor = (typeof currentDoctorName === 'function' && currentDoctorName())
        || (typeof loggedInDoctorName === 'function' && loggedInDoctorName())
        || '';
    const nameEl = document.getElementById('mainPatientName');
    const dobEl = document.getElementById('mainPatientDOB');
    const docEl = document.getElementById('mainDoctorName');
    if (nameEl) nameEl.value = name;
    if (dobEl) dobEl.value = dob;
    if (docEl) docEl.value = doctor;
    const nameDisplay = document.getElementById('mainPatientNameDisplay');
    const dobDisplay = document.getElementById('mainPatientDobDisplay');
    const docDisplay = document.getElementById('mainDoctorNameDisplay');
    if (nameDisplay) nameDisplay.textContent = name || '—';
    if (dobDisplay) dobDisplay.textContent = dob || '—';
    if (docDisplay) docDisplay.textContent = doctor || '—';
    const consentNameDisplay = document.getElementById('consentPatientNameDisplay');
    const consentDobDisplay = document.getElementById('consentPatientDobDisplay');
    if (consentNameDisplay) consentNameDisplay.textContent = name || '—';
    if (consentDobDisplay) consentDobDisplay.textContent = dob || '—';
    if (typeof applyLoggedInDoctorToForms === 'function') applyLoggedInDoctorToForms();
    if (typeof syncPatientIdentifiers === 'function') syncPatientIdentifiers('main');
}

function updateHeaderPatient() {
    const nameEl = document.getElementById('headerPatientName');
    const dobEl = document.getElementById('headerPatientDob');
    if (nameEl) nameEl.textContent = hasCurrentPatient() ? currentPatient.name : 'No chart open';
    if (dobEl) {
        dobEl.textContent = hasCurrentPatient()
            ? [currentPatient.dob, currentPatient.phone, currentPatient.clinician].filter(Boolean).join(' · ')
            : 'Search to open a chart';
    }
    if (typeof syncOpenChartSearchGate === 'function') syncOpenChartSearchGate();
    if (typeof renderChartSidebar === 'function') renderChartSidebar();
}

function knownPatientsFromLesions() {
    const map = new Map();
    managedLesions.forEach((lesion) => {
        const id = lesionChartId(lesion);
        if (!id || map.has(id)) return;
        map.set(id, patientIdentityFromRecord({
            chartId: id,
            name: lesion.patientName || '',
            dob: lesion.patientDob || '',
            phone: lesion.patientPhone || lesion.phone || '',
            clinician: lesion.clinician || ''
        }));
    });
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }));
}

function setCurrentPatient(patient, options) {
    const identity = patientIdentityFromRecord(patient);
    const name = identity.name;
    const dob = identity.dob;
    const clinician = (typeof loggedInDoctorName === 'function' && loggedInDoctorName()) || '';
    const chartId = identity.chartId || patientChartId(name, dob);
    if (!options?.allowChartSwitch && blockOpenChartWhileVisitActive(chartId)) {
        return;
    }
    const changed = chartId !== (currentPatient.chartId || '');
    const chart = typeof findChartById === 'function' ? findChartById(chartId) : null;
    currentPatient = {
        name,
        firstName: identity.firstName,
        lastName: identity.lastName,
        dob,
        phone: identity.phone,
        clinician,
        chartId,
        personId: String(patient?.personId || chart?.personId || '').trim()
    };
    if (changed && !options?.silentRestore) {
        isBedSanitised = false;
        shaveConsentVerified = false;
        pendingShaveConsentAction = '';
        lesions = [];
        if (typeof visitReviewLesionIds !== 'undefined') visitReviewLesionIds = [];
        patientConcerns = [];
        noPatientConcerns = false;
        screeningMarkedComplete = false;
        if (typeof screeningAskedThisConsult !== 'undefined') screeningAskedThisConsult = false;
        smsNormalResultsConsent = '';
        selectedChartLesionId = '';
        if (typeof resetProcedureSession === 'function') resetProcedureSession();
        if (typeof renderLesionsTable === 'function') renderLesionsTable();
        if (typeof renderPatientConcerns === 'function') renderPatientConcerns();
        if (typeof updateOutput === 'function') updateOutput();
        if (typeof isClinicalWorkspaceTab === 'function'
            ? isClinicalWorkspaceTab(activeWorkspaceTab)
            : (activeWorkspaceTab === 'skin-check' || activeWorkspaceTab === 'excision-generator')) {
            switchWorkspaceTab('management');
        }
    }
    applyCurrentPatientToForms();
    updateHeaderPatient();
    rememberLastPatient();
    if (typeof renderManagedLesions === 'function') renderManagedLesions();
    if (typeof renderChartSidebar === 'function') renderChartSidebar();
}

function clearCurrentPatient() {
    currentPatient = { name: '', firstName: '', lastName: '', dob: '', phone: '', clinician: '', chartId: '' };
    pendingWorkspaceTab = '';
    pendingSanitise = false;
    isBedSanitised = false;
    if (typeof visitConsultType !== 'undefined') visitConsultType = '';
    shaveConsentVerified = false;
    pendingShaveConsentAction = '';
    lesions = [];
    if (typeof visitReviewLesionIds !== 'undefined') visitReviewLesionIds = [];
    patientConcerns = [];
    noPatientConcerns = false;
    screeningMarkedComplete = false;
    if (typeof screeningAskedThisConsult !== 'undefined') screeningAskedThisConsult = false;
    smsNormalResultsConsent = '';
    selectedChartLesionId = '';
    if (typeof applyCurrentPatientToForms === 'function') applyCurrentPatientToForms();
    updateHeaderPatient();
    rememberLastPatient();
    if (typeof renderManagedLesions === 'function') renderManagedLesions();
    if (typeof renderChartSidebar === 'function') renderChartSidebar();
}

function normalizeSearchQuery(query) {
    return String(query || '')
        .toLowerCase()
        .replace(/,/g, ' ')
        .replace(/[.'’]/g, '')
        .replace(/[^a-z0-9\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function formatPatientSearchName(patient) {
    const identity = patientIdentityFromRecord(patient);
    if (identity.lastName && identity.firstName) return identity.lastName + ', ' + identity.firstName;
    return identity.name || 'Unnamed patient';
}

function patientSearchHaystack(patient) {
    const identity = patientIdentityFromRecord(patient);
    const dobDigits = normalizeChartDob(identity.dob);
    const phoneDigits = normalizePhoneDigits(identity.phone);
    const first = identity.firstName.toLowerCase();
    const last = identity.lastName.toLowerCase();
    return [
        identity.name.toLowerCase(),
        first,
        last,
        [last, first].filter(Boolean).join(' '),
        [last, first].filter(Boolean).join(', '),
        [first, last].filter(Boolean).join(' '),
        String(identity.dob || '').toLowerCase(),
        dobDigits,
        String(identity.phone || '').toLowerCase(),
        phoneDigits
    ].filter(Boolean).map((value) => value.replace(/,/g, ' ').replace(/[.'’]/g, ''));
}

function patientMatchesQuery(patient, query) {
    const raw = normalizeSearchQuery(query);
    if (!raw) return false;
    const tokens = raw.split(/\s+/).filter(Boolean);
    const hay = patientSearchHaystack(patient);
    return tokens.every((token) => {
        const digits = token.replace(/\D/g, '');
        return hay.some((value) => {
            if (value.includes(token)) return true;
            return digits.length >= 2 && String(value).replace(/\D/g, '').includes(digits);
        });
    });
}

function searchPatientCharts(query) {
    const known = typeof knownPatientCharts === 'function' ? knownPatientCharts() : knownPatientsFromLesions();
    const q = normalizeSearchQuery(query);
    const firstToken = q.split(/\s+/)[0] || '';
    return known
        .filter((patient) => patientMatchesQuery(patient, q))
        .sort((a, b) => {
            const lastA = patientIdentityFromRecord(a).lastName.toLowerCase();
            const lastB = patientIdentityFromRecord(b).lastName.toLowerCase();
            const rank = (last) => {
                if (firstToken && last.startsWith(firstToken)) return 0;
                if (firstToken && last.includes(firstToken)) return 1;
                return 2;
            };
            const byLast = rank(lastA) - rank(lastB);
            if (byLast) return byLast;
            return formatPatientSearchName(a).localeCompare(formatPatientSearchName(b), 'en', { sensitivity: 'base' });
        })
        .slice(0, 8);
}

function hideChartSearchResults() {
    ['headerChartSearchResults'].forEach((id) => {
        const el = document.getElementById(id);
        if (!el) return;
        el.classList.add('hidden');
        el.innerHTML = '';
    });
    lastChartSearchHits = [];
    chartSearchActiveIndex = 0;
}

function renderChartSearchResults(rootId, query) {
    const root = document.getElementById(rootId);
    if (!root) return;
    const q = String(query || '').trim();
    if (!q) {
        root.classList.add('hidden');
        root.innerHTML = '';
        lastChartSearchHits = [];
        return;
    }
    lastChartSearchHits = searchPatientCharts(q);
    chartSearchActiveIndex = 0;
    if (!lastChartSearchHits.length) {
        root.innerHTML = '<p class="chart-search-empty">No matching chart. Use <strong>Add new patient</strong> if this is a first visit.</p>';
        root.classList.remove('hidden');
        return;
    }
    root.innerHTML = lastChartSearchHits.map((patient, idx) => `
        <button type="button" role="option" data-search-idx="${idx}" onclick="openPatientFromSearchIndex(${idx})" class="chart-search-hit ${idx === 0 ? 'is-active' : ''}">
            <span class="chart-search-hit-name">${escapeHtml(formatPatientSearchName(patient))}</span>
            <span class="chart-search-hit-meta">${escapeHtml([patient.dob, patient.phone].filter(Boolean).join(' · ') || 'No DOB or phone on file')}${typeof formatScratchpadExpiry === 'function' && formatScratchpadExpiry(patient.chartId) ? ' · ' + escapeHtml(formatScratchpadExpiry(patient.chartId)) : ''}</span>
        </button>
    `).join('');
    root.classList.remove('hidden');
}

function highlightChartSearchHit() {
    document.querySelectorAll('.chart-search-hit').forEach((btn) => {
        const idx = Number(btn.getAttribute('data-search-idx'));
        btn.classList.toggle('is-active', idx === chartSearchActiveIndex);
    });
}

function onChartSearchInput(input, resultsId) {
    if (typeof hasCurrentPatient === 'function' && hasCurrentPatient()) {
        hideChartSearchResults();
        return;
    }
    renderChartSearchResults(resultsId, input?.value || '');
}

function onChartSearchKeydown(event, resultsId) {
    if (typeof hasCurrentPatient === 'function' && hasCurrentPatient()) {
        event.preventDefault();
        hideChartSearchResults();
        return;
    }
    if (event.key === 'Escape') {
        hideChartSearchResults();
        event.target.blur();
        return;
    }
    if (event.key === 'ArrowDown') {
        event.preventDefault();
        if (!lastChartSearchHits.length) return;
        chartSearchActiveIndex = (chartSearchActiveIndex + 1) % lastChartSearchHits.length;
        highlightChartSearchHit();
        return;
    }
    if (event.key === 'ArrowUp') {
        event.preventDefault();
        if (!lastChartSearchHits.length) return;
        chartSearchActiveIndex = (chartSearchActiveIndex - 1 + lastChartSearchHits.length) % lastChartSearchHits.length;
        highlightChartSearchHit();
        return;
    }
    if (event.key === 'Enter') {
        event.preventDefault();
        if (lastChartSearchHits.length) openPatientFromSearchIndex(chartSearchActiveIndex);
    }
}

async function openPatientFromSearchIndex(idx) {
    const patient = lastChartSearchHits[idx];
    if (!patient) return;
    if (typeof runBusyAction === 'function') {
        return runBusyAction('Opening chart…', async () => openPatientFromSearchIndexWork(idx), {});
    }
    return openPatientFromSearchIndexWork(idx);
}

async function openPatientFromSearchIndexWork(idx) {
    const patient = lastChartSearchHits[idx];
    if (!patient) return;
    hideChartSearchResults();
    const headerSearch = document.getElementById('headerChartSearch');
    if (headerSearch) headerSearch.value = '';
    if (typeof openPatientChart === 'function') await openPatientChart(patient);
    else setCurrentPatient(patient);
    if (pendingSanitise) {
        pendingSanitise = false;
        markChartSanitised();
        return;
    }
    if (pendingWorkspaceTab) {
        const tab = pendingWorkspaceTab;
        pendingWorkspaceTab = '';
        switchWorkspaceTab(tab);
    }
}

function focusPracticeBoardSearch() {
    if (typeof hasCurrentPatient === 'function' && hasCurrentPatient()) {
        if (typeof switchWorkspaceTab === 'function') switchWorkspaceTab('management');
        showToast('Finalise this visit before opening another chart.');
        return;
    }
    if (typeof switchWorkspaceTab === 'function') switchWorkspaceTab('management');
    const input = document.getElementById('headerChartSearch');
    if (input) {
        input.focus();
        input.select();
    }
}

function renderKnownPatientList() {
    /* Opening charts is done from the practice-board search. */
}

function fillPatientModalFromKnown() {
    /* Replaced by searchable open-chart. */
}

function selectKnownPatientByIndex() {
    /* Replaced by searchable open-chart. */
}

async function openKnownPatientByIndex(idx) {
    const known = (typeof knownPatientCharts === 'function' ? knownPatientCharts() : knownPatientsFromLesions())[idx];
    if (!known) return;
    if (typeof openPatientChart === 'function') await openPatientChart(known);
    else setCurrentPatient(known);
}

function openAddPatientModal() {
    if (typeof blockAddPatientWhileVisitActive === 'function' && blockAddPatientWhileVisitActive()) {
        return;
    }
    if (typeof loggedInDoctorName === 'function' && !loggedInDoctorName()) {
        showToast('Sign in with a user that has a full doctor name. Charts attach to that doctor automatically.');
        return;
    }
    const modal = document.getElementById('patientModal');
    const firstEl = document.getElementById('chartPatientFirstName');
    const lastEl = document.getElementById('chartPatientLastName');
    const dobEl = document.getElementById('chartPatientDob');
    const phoneEl = document.getElementById('chartPatientPhone');
    if (firstEl) firstEl.value = '';
    if (lastEl) lastEl.value = '';
    if (typeof bindChartPatientIdentityFields === 'function') bindChartPatientIdentityFields();
    if (typeof fillChartPatientDobFields === 'function') fillChartPatientDobFields('');
    else if (dobEl) dobEl.value = '';
    if (phoneEl) phoneEl.value = '';
    const addConsult = document.getElementById('chartPatientConsultBilling');
    const addBiopsy = document.getElementById('chartPatientBiopsyBilling');
    if (addConsult) addConsult.value = typeof DEFAULT_CONSULT_BILLING !== 'undefined' ? DEFAULT_CONSULT_BILLING : 'Private Bill';
    if (addBiopsy) addBiopsy.value = typeof DEFAULT_BIOPSY_BILLING !== 'undefined' ? DEFAULT_BIOPSY_BILLING : '$20 OOP per biopsy (Item 30071)';
    if (modal) modal.classList.remove('hidden');
    if (firstEl) firstEl.focus();
}

function openPatientModal(mode) {
    if (mode === 'add') {
        openAddPatientModal();
        return;
    }
    focusPracticeBoardSearch();
}

function closePatientModal() {
    const modal = document.getElementById('patientModal');
    if (modal) modal.classList.add('hidden');
}

async function submitAddPatientModal() {
    if (typeof isAppBusy === 'function' && isAppBusy()) {
        if (typeof showToast === 'function') showToast('Wait until the current action finishes.');
        return;
    }
    const firstName = document.getElementById('chartPatientFirstName')?.value.trim() || '';
    const lastName = document.getElementById('chartPatientLastName')?.value.trim() || '';
    const dob = (typeof readChartPatientDobFields === 'function'
        ? readChartPatientDobFields()
        : (document.getElementById('chartPatientDob')?.value.trim() || ''));
    const phone = typeof formatAuPhoneDisplay === 'function'
        ? formatAuPhoneDisplay(document.getElementById('chartPatientPhone')?.value || '')
        : (document.getElementById('chartPatientPhone')?.value.trim() || '');
    const phoneEl = document.getElementById('chartPatientPhone');
    if (phoneEl) phoneEl.value = phone;
    const clinician = (typeof loggedInDoctorName === 'function' && loggedInDoctorName()) || '';
    const name = composePatientName(firstName, lastName);
    if (!clinician) {
        showToast('Sign in with a user that has a full doctor name. Charts attach to that doctor automatically.');
        return;
    }
    if (!firstName || !lastName) {
        showToast('Enter first name and last name.');
        return;
    }
    if (!dob) {
        showToast('Enter date of birth as day, month, and year (for example 12 / 03 / 1960).');
        const missing = !document.getElementById('chartPatientDobDay')?.value
            ? 'chartPatientDobDay'
            : (!document.getElementById('chartPatientDobMonth')?.value ? 'chartPatientDobMonth' : 'chartPatientDobYear');
        document.getElementById(missing)?.focus();
        return;
    }
    if (normalizePhoneDigits(phone).length < 8) {
        showToast('Enter a phone number so reception can contact the patient.');
        return;
    }
    if (!patientChartId(name, dob)) {
        showToast('Date of birth needs digits so the chart can be identified.');
        return;
    }
    const billing = typeof readAddPatientBilling === 'function'
        ? readAddPatientBilling()
        : { consultBilling: 'Private Bill', biopsyBilling: '$20 OOP per biopsy (Item 30071)' };
    const patient = { name, firstName, lastName, dob, phone, clinician, ...billing };
    const finish = async () => {
        closePatientModal();
        if (typeof openPatientChart === 'function') {
            await openPatientChart(patient);
        } else {
            setCurrentPatient(patient);
            showToast('Chart set to ' + name + '.');
        }
        if (pendingSanitise) {
            pendingSanitise = false;
            markChartSanitised();
            return;
        }
        if (pendingWorkspaceTab) {
            const tab = pendingWorkspaceTab;
            pendingWorkspaceTab = '';
            switchWorkspaceTab(tab);
        }
    };
    if (typeof runBusyAction === 'function') {
        return runBusyAction('Creating chart…', finish, {
            button: document.getElementById('patientModalSubmit'),
            buttonText: 'Creating chart…'
        });
    }
    return finish();
}

async function submitPatientModal() {
    await submitAddPatientModal();
}

function requireCurrentPatient(message) {
    if (hasCurrentPatient()) return true;
    showToast(message || 'Search for a patient in the header, or add a new patient.');
    focusPracticeBoardSearch();
    return false;
}

function appendLesionHistory(lesion, action, note) {
    if (!Array.isArray(lesion.history)) lesion.history = [];
    lesion.history.push({
        at: new Date().toISOString(),
        action,
        note: note || '',
        by: vaultAuth.username || ''
    });
    if (lesion.history.length > 40) lesion.history = lesion.history.slice(-40);
}

async function writeManagedLesion(lesion) {
    upsertManagedLesionMemory(lesion);
    if (!isVaultLoggedIn()) return;
    const dir = await getUserLesionsDir(vaultAuth.username, true);
    const payload = await encryptJson(vaultAuth.key, lesion);
    await writeTextFile(dir, lesion.id + '.json.enc', JSON.stringify(payload));
}

async function deleteManagedLesionFile(id) {
    if (!isVaultLoggedIn() || !id) return false;
    try {
        const dir = await getUserLesionsDir(vaultAuth.username, false);
        return await deleteTextFile(dir, id + '.json.enc');
    } catch (err) {
        console.warn('Could not delete lesion file', id, err);
        return false;
    }
}

async function loadManagedLesionsFromVault() {
    managedLesions = [];
    if (!isVaultLoggedIn()) return;
    const dir = await getUserLesionsDir(vaultAuth.username, true);
    if (typeof recoverIncompleteVaultWrites === 'function') await recoverIncompleteVaultWrites(dir);
    if (typeof vaultLoadBeginStage === 'function') vaultLoadBeginStage('Loading lesions…', 0.16, 0.46);
    for await (const [name, handle] of dir.entries()) {
        if (handle.kind !== 'file' || !name.endsWith('.json.enc')) continue;
        try {
            const text = await handle.getFile().then((f) => f.text());
            const lesion = await decryptJson(vaultAuth.key, JSON.parse(text));
            if (lesion && lesion.id) managedLesions.push(lesion);
        } catch (err) {
            console.warn('Skipped unreadable lesion file', name);
        }
        if (typeof vaultLoadTickFile === 'function') vaultLoadTickFile();
    }
    if (typeof vaultLoadEndStage === 'function') vaultLoadEndStage();
    managedLesions.sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));
    if (typeof convertManagedLesionsToSchemaV2 === 'function') {
        await convertManagedLesionsToSchemaV2();
    }
    if (typeof repairLesionsStuckAwaitingAfterResult === 'function') {
        await repairLesionsStuckAwaitingAfterResult();
    }
    if (typeof repairStuckReexcisionLesions === 'function') {
        await repairStuckReexcisionLesions();
    }
    for (const item of managedLesions) {
        if (sanitizeOpenReexcisionChild(item) && typeof writeManagedLesion === 'function') {
            try { await writeManagedLesion(item); } catch (err) { /* in-memory sanitise still applies */ }
        }
    }
    if (typeof loadManagedChartsFromVault === 'function') {
        if (typeof vaultLoadBeginStage === 'function') vaultLoadBeginStage('Loading charts…', 0.46, 0.7);
        await loadManagedChartsFromVault();
    }
    if (typeof repairMisattachedLesionCharts === 'function') {
        await repairMisattachedLesionCharts();
    }
    if (typeof loadManagedVisitNotesFromVault === 'function') {
        if (typeof vaultLoadBeginStage === 'function') vaultLoadBeginStage('Loading notes…', 0.7, 0.8);
        await loadManagedVisitNotesFromVault();
    }
    if (typeof loadManagedConsentsFromVault === 'function') {
        if (typeof vaultLoadBeginStage === 'function') vaultLoadBeginStage('Loading consents…', 0.8, 0.86);
        await loadManagedConsentsFromVault();
    }
    if (typeof loadManagedBillingsFromVault === 'function') {
        if (typeof vaultLoadBeginStage === 'function') vaultLoadBeginStage('Loading billing…', 0.86, 0.92);
        await loadManagedBillingsFromVault();
    }
    if (typeof migrateEmbeddedBillingFromLesions === 'function') {
        if (typeof vaultLoadBeginStage === 'function') vaultLoadBeginStage('Finishing clinic files…', 0.92, 0.94);
        await migrateEmbeddedBillingFromLesions();
    }
    if (typeof pruneExpiredIdleCharts === 'function') {
        await pruneExpiredIdleCharts();
    }
    if (typeof migrateIdentifyingEncFilenames === 'function' && isVaultLoggedIn()) {
        try {
            const dir = await getUserChartsDir(vaultAuth.username, true);
            await migrateIdentifyingEncFilenames(managedCharts, 'chart', dir, vaultAuth.key);
        } catch (err) {
            console.warn('Could not rename identifying chart files', err);
        }
    }
}

function upsertManagedLesionMemory(lesion) {
    const idx = managedLesions.findIndex((item) => String(item.id) === String(lesion.id));
    if (idx === -1) managedLesions.unshift(lesion);
    else managedLesions[idx] = lesion;
}

async function persistSessionLesionToVault(sessionLesion) {
    if (!isVaultLoggedIn()) return null;
    const existing = managedLesions.find((item) => String(item.id) === String(sessionLesion.id)) || {};
    const priorConsent = lesionConsentStatus(existing);
    const now = new Date().toISOString();
    const patient = sessionPatientSnapshot();
    const ident = lesionSaveIdentity(existing, patient, sessionLesion);
    const merged = { ...existing, ...sessionLesion };
    if (merged.priorLesionId) sanitizeOpenReexcisionChild(merged);
    const type = deriveLesionType(merged);
    const derivedStatus = deriveLesionStatusFromPlan({ ...merged, type });
    const completed = lesionProcedureDone(merged);
    let managementStatus;
    if (completed) {
        const existingStatus = canonicalLesionStatus(existing.managementStatus);
        const sessionStatus = canonicalLesionStatus(sessionLesion.managementStatus);
        if (existingStatus === 'needs_contact' || existingStatus === 'appointment_requested' || existingStatus === 'no_followup') {
            managementStatus = existingStatus;
        } else if (lesionHasSavedHistology(existing) || lesionHasSavedHistology(merged)) {
            managementStatus = statusAfterSavedHistology({
                ...merged,
                resultPlan: existing.resultPlan || merged.resultPlan,
                contactState: existing.contactState || merged.contactState,
                resultAdvisedAt: existing.resultAdvisedAt || merged.resultAdvisedAt,
                histologyResult: existing.histologyResult || merged.histologyResult,
                managementStatus: existingStatus || sessionStatus
            });
        } else if (existingStatus === 'awaiting_histology' || sessionStatus === 'awaiting_histology') {
            managementStatus = 'awaiting_histology';
        } else {
            managementStatus = sessionStatus || existingStatus || 'awaiting_histology';
        }
    } else if (canonicalLesionStatus(existing.managementStatus) === 'current_case' && derivedStatus === 'planned_procedure') {
        managementStatus = 'current_case';
    } else {
        managementStatus = derivedStatus;
    }
    if (!completed && managementStatus === 'awaiting_histology') {
        managementStatus = 'planned_procedure';
    }
    const next = {
        ...existing,
        ...sessionLesion,
        id: sessionLesion.id,
        createdAt: existing.createdAt || now,
        updatedAt: now,
        owner: vaultAuth.username,
        patientName: ident.patientName,
        patientDob: ident.patientDob,
        patientPhone: ident.patientPhone,
        clinician: ident.clinician,
        chartId: ident.chartId,
        type,
        managementStatus,
        currentPlan: sessionLesion.currentPlan || existing.currentPlan || '',
        timeline: Array.isArray(sessionLesion.timeline) ? sessionLesion.timeline
            : (Array.isArray(existing.timeline) ? existing.timeline : []),
        schemaVersion: LESION_SCHEMA_VERSION,
        billingStatus: existing.billingStatus || 'none',
        history: existing.history || [],
        consentStatus: sessionLesion.consentStatus || existing.consentStatus || '',
        consentedAt: sessionLesion.consentedAt || existing.consentedAt || '',
        histologyCaseNumber: sessionLesion.histologyCaseNumber || existing.histologyCaseNumber || '',
        histologyPot: sessionLesion.histologyPot || existing.histologyPot || '',
        histologyBatchId: sessionLesion.histologyBatchId || existing.histologyBatchId || '',
        histologyResult: String(sessionLesion.histologyResult || '').trim() || existing.histologyResult || '',
        histologyDiagnosis: String(sessionLesion.histologyDiagnosis || '').trim() || existing.histologyDiagnosis || '',
        histologyAt: sessionLesion.histologyAt || existing.histologyAt || '',
        resultPlan: sessionLesion.resultPlan || existing.resultPlan || '',
        contactState: sessionLesion.contactState || existing.contactState || '',
        resultAdvisedAt: sessionLesion.resultAdvisedAt || existing.resultAdvisedAt || '',
        priorHistologyCaseNumber: sessionLesion.priorHistologyCaseNumber || existing.priorHistologyCaseNumber || '',
        priorHistologyPot: sessionLesion.priorHistologyPot || existing.priorHistologyPot || '',
        priorHistologyResult: sessionLesion.priorHistologyResult || existing.priorHistologyResult || '',
        priorHistologyDiagnosis: sessionLesion.priorHistologyDiagnosis || existing.priorHistologyDiagnosis || '',
        priorProcedureAt: sessionLesion.priorProcedureAt || existing.priorProcedureAt || '',
        priorHistologySource: sessionLesion.priorHistologySource || existing.priorHistologySource || '',
        priorHistologySourceName: sessionLesion.priorHistologySourceName || existing.priorHistologySourceName || '',
        priorBreslowMm: sessionLesion.priorBreslowMm || existing.priorBreslowMm || '',
        priorProcedureKind: sessionLesion.priorProcedureKind || existing.priorProcedureKind || ''
    };
    if (typeof applyInferredBillingLesionType === 'function') {
        applyInferredBillingLesionType(next);
    }
    if (repairLesionAwaitingAfterResult(next)) {
        managementStatus = next.managementStatus;
    }
    if (!next.currentPlan) next.currentPlan = defaultPlanLine(next);
    if (isTopicalPlan(sessionLesion.plan)) {
        next.topicalFollowUp = sessionLesion.topicalFollowUp || 'none';
        if (!completed && (!existing.managementStatus || ['awaiting_assessment', 'topical_followup', 'no_followup', 'planned_procedure'].includes(canonicalLesionStatus(existing.managementStatus)))) {
            next.managementStatus = deriveLesionStatusFromPlan(next);
            next.type = 'topical';
            next.currentPlan = defaultPlanLine(next);
        }
    }
    if (isMonitorLesionPlan(sessionLesion.plan) && !completed) {
        next.monitorFollowUp = sessionLesion.monitorFollowUp || 'none';
        if (!existing.managementStatus || ['awaiting_assessment', 'topical_followup', 'no_followup', 'planned_procedure'].includes(canonicalLesionStatus(existing.managementStatus))) {
            next.managementStatus = deriveLesionStatusFromPlan(next);
            next.type = 'none';
            next.currentPlan = defaultPlanLine(next);
            next.clinicallyFinalisedAt = next.managementStatus === 'no_followup'
                ? (next.clinicallyFinalisedAt || now)
                : '';
        }
    }
    if (typeof isDeclineTreatmentPlan === 'function' && isDeclineTreatmentPlan(sessionLesion.plan) && !completed) {
        next.managementStatus = deriveLesionStatusFromPlan(next);
        next.type = 'none';
        next.currentPlan = typeof formatDeclinePlanSummary === 'function' && formatDeclinePlanSummary(next)
            ? formatDeclinePlanSummary(next)
            : (next.currentPlan || 'Declined recommended treatment');
        next.clinicallyFinalisedAt = next.managementStatus === 'no_followup'
            ? (next.clinicallyFinalisedAt || now)
            : '';
    }
    const planChanged = !existing.id || existing.plan !== next.plan || existing.type !== next.type;
    if (!existing.id) appendLesionHistory(next, 'created', sessionLesion.plan || '');
    else appendLesionHistory(next, 'updated', sessionLesion.plan || '');
    if (planChanged) {
        next.currentPlan = sessionLesion.currentPlan || defaultPlanLine(next);
        appendLesionTimeline(next, {
            type: 'plan',
            note: next.plan || '',
            planAfter: next.currentPlan
        });
    }
    repairLesionAwaitingAfterResult(next);
    const nextConsent = lesionConsentStatus(next);
    if (consentRank(nextConsent) > consentRank(priorConsent)) {
        appendLesionTimeline(next, {
            type: 'consent',
            note: nextConsent === 'verbal'
                ? 'Verbal consent (shave / saucerisation)'
                : 'Written surgical consent generated',
            planAfter: next.currentPlan || ''
        });
    }
    if (sessionLesion.priorLesionId) {
        next.priorLesionId = String(sessionLesion.priorLesionId);
        next.reexcisionOf = sessionLesion.reexcisionOf || next.reexcisionOf || '';
        next.priorProcedureKind = sessionLesion.priorProcedureKind || next.priorProcedureKind || '';
        next.type = 'excision';
        sanitizeOpenReexcisionChild(next);
    }
    if (Object.prototype.hasOwnProperty.call(sessionLesion, 'procedureDetail') && !sessionLesion.procedureDetail) {
        next.procedureDetail = null;
    }
    if (Object.prototype.hasOwnProperty.call(sessionLesion, 'procedureCompletedAt')) {
        next.procedureCompletedAt = sessionLesion.procedureCompletedAt || '';
    }
    if (Object.prototype.hasOwnProperty.call(sessionLesion, 'excisionFinalisedAt')) {
        next.excisionFinalisedAt = sessionLesion.excisionFinalisedAt || '';
    }
    if (Object.prototype.hasOwnProperty.call(sessionLesion, 'consentStatus')) {
        next.consentStatus = sessionLesion.consentStatus || '';
        next.consentedAt = sessionLesion.consentedAt || '';
    }
    await writeManagedLesion(next);
    upsertManagedLesionMemory(next);
    if (typeof offerLesionToProcedureSession === 'function') offerLesionToProcedureSession(next);
    renderManagedLesions();
    if (typeof renderChartSidebar === 'function') renderChartSidebar();
    return next;
}

async function revertLesionConsent(id, previousStatus, previousConsentedAt) {
    if (!id) return false;
    const nextKind = previousStatus === 'written' || previousStatus === 'verbal' ? previousStatus : '';
    const nextAt = nextKind ? String(previousConsentedAt || '') : '';
    const session = (typeof lesions !== 'undefined' && Array.isArray(lesions))
        ? lesions.find((item) => String(item.id) === String(id))
        : null;
    const managed = (typeof managedLesions !== 'undefined' ? managedLesions : []).find((item) => String(item.id) === String(id));
    const current = session || managed;
    if (!current) return false;
    if (lesionConsentStatus(current) === nextKind && String(current.consentedAt || '') === nextAt) return false;
    if (session) {
        session.consentStatus = nextKind;
        session.consentedAt = nextAt;
    }
    const payload = {
        ...(managed || {}),
        ...(session || {}),
        id,
        consentStatus: nextKind,
        consentedAt: nextAt
    };
    if (managed) {
        managed.consentStatus = nextKind;
        managed.consentedAt = nextAt;
        if (typeof appendLesionTimeline === 'function') {
            appendLesionTimeline(managed, {
                type: 'consent',
                note: 'Written consent cancelled',
                planAfter: managed.currentPlan || ''
            });
        }
        payload.timeline = managed.timeline;
    }
    if (typeof persistSessionLesionToVault === 'function' && typeof isVaultLoggedIn === 'function' && isVaultLoggedIn()) {
        await persistSessionLesionToVault(payload);
    } else if (managed && typeof writeManagedLesion === 'function') {
        await writeManagedLesion(managed);
        upsertManagedLesionMemory(managed);
    }
    if (typeof renderLesionsTable === 'function') renderLesionsTable();
    if (typeof renderChartSidebar === 'function') renderChartSidebar();
    if (typeof renderManagedLesions === 'function') renderManagedLesions();
    if (typeof renderProcedureWorkspace === 'function') renderProcedureWorkspace();
    return true;
}

async function saveManagedLesionRecord(lesion, action, note, options) {
    lesion.updatedAt = new Date().toISOString();
    appendLesionHistory(lesion, action, note);
    await writeManagedLesion(lesion);
    upsertManagedLesionMemory(lesion);
    if (!options?.silent) {
        renderManagedLesions();
        updateCurrentCaseBanner();
        if (typeof renderChartSidebar === 'function') renderChartSidebar();
    }
}

async function setManagedLesionStatus(id, status, note, extras) {
    const lesion = managedLesions.find((item) => String(item.id) === String(id));
    if (!lesion) return;
    extras = extras || {};
    let nextStatus = canonicalLesionStatus(status);
    if (nextStatus === 'awaiting_histology' && !lesionProcedureDone(lesion)) {
        showToast('Finish the procedure to move this lesion to awaiting results.');
        return;
    }
    if (nextStatus === 'current_case') {
        for (const item of managedLesions) {
            if (item.id !== id && lesionLifecycleStatus(item) === 'current_case') {
                item.managementStatus = 'planned_procedure';
                item.currentPlan = defaultPlanLine({ ...item, managementStatus: 'planned_procedure' });
                appendLesionHistory(item, 'status:planned_procedure', 'Replaced as current case');
                item.updatedAt = new Date().toISOString();
                await writeManagedLesion(item);
            }
        }
        currentManagedCaseId = id;
    }
    if (nextStatus === 'no_followup') {
        lesion.billingStatus = lesion.billingStatus || 'none';
        lesion.clinicallyFinalisedAt = lesion.clinicallyFinalisedAt || new Date().toISOString();
        if (!extras.currentPlan) {
            extras.currentPlan = lesionCanCloseNoFollowup(lesion)
                ? 'No follow-up'
                : 'No follow-up — billing pending';
        }
    } else if (canonicalLesionStatus(lesion.managementStatus) === 'no_followup') {
        lesion.clinicallyFinalisedAt = '';
    }
    if (extras.type) lesion.type = extras.type;
    lesion.managementStatus = nextStatus;
    lesion.schemaVersion = LESION_SCHEMA_VERSION;
    lesion.currentPlan = extras.currentPlan || defaultPlanLine(lesion);
    await saveManagedLesionRecord(lesion, 'status:' + nextStatus, note || LESION_STATUSES[nextStatus] || nextStatus);
}

async function recordHistologyOutcome(id, resultText, nextAction, billingType, extras) {
    const lesion = managedLesions.find((item) => item.id === id);
    if (!lesion) return;
    extras = extras || {};
    const priorStatus = typeof lesionLifecycleStatus === 'function'
        ? lesionLifecycleStatus(lesion)
        : canonicalLesionStatus(lesion.managementStatus);
    let action = nextAction === 'plan_excision' ? 'further_management' : nextAction;
    const contact = extras.contact || 'mark_for_contact';
    const fileNoCall = !!extras.fileNoCall && action === 'no_followup';
    const proposedPlan = String(extras.proposedPlan || '').trim();
    const proposedPlanNote = String(extras.proposedPlanNote || '').trim();
    if (String(resultText || '').trim()) {
        lesion.histologyResult = resultText;
        lesion.histologyAt = new Date().toISOString();
    }
    if (Object.prototype.hasOwnProperty.call(extras, 'histologyDiagnosis')) {
        lesion.histologyDiagnosis = extras.histologyDiagnosis || '';
    }
    if (Object.prototype.hasOwnProperty.call(extras, 'histologyCaseNumber')) {
        lesion.histologyCaseNumber = normalizeHistologyCaseNumber(extras.histologyCaseNumber);
    }
    if (Object.prototype.hasOwnProperty.call(extras, 'histologyPot')) {
        lesion.histologyPot = normalizeHistologyPot(extras.histologyPot);
    }
    if (billingType) lesion.billingLesionType = billingType;
    if (typeof histologyIndicatesMelanoma === 'function' && histologyIndicatesMelanoma(lesion)) {
        lesion.billingLesionType = 'confirmed_melanoma';
        lesion.contactUrgent = true;
    } else if (typeof applyInferredBillingLesionType === 'function') {
        applyInferredBillingLesionType(lesion);
        if (extras.urgent) lesion.contactUrgent = true;
        else if (contact !== 'advised_now' && !fileNoCall) lesion.contactUrgent = !!extras.urgent;
    }
    if (typeof suggestMbsItems === 'function' && typeof billingProcedureKind === 'function' && billingProcedureKind(lesion) === 'excision') {
        const suggestion = suggestMbsItems(lesion);
        if (suggestion.ready && suggestion.summary) lesion.suggestedMbsItems = suggestion.summary;
    }
    if (extras.resultOnly) {
        if (lesionHasSavedHistology(lesion) && (priorStatus === 'awaiting_histology'
            || canonicalLesionStatus(lesion.managementStatus) === 'awaiting_histology')) {
            lesion.managementStatus = 'needs_contact';
            if (!lesion.contactState) lesion.contactState = 'mark_for_contact';
            lesion.currentPlan = 'Result recorded — set the plan.';
        }
        const accession = typeof formatHistologyAccession === 'function' ? formatHistologyAccession(lesion, 'own') : '';
        appendLesionTimeline(lesion, {
            type: 'histology',
            note: [resultText, accession && ('Lab case ' + accession)].filter(Boolean).join(' · '),
            planAfter: lesion.currentPlan || ''
        });
        if (typeof syncBillingFromLesion === 'function') {
            await syncBillingFromLesion(lesion);
        }
        await saveManagedLesionRecord(lesion, 'histology', resultText || lesion.histologyResult || '', { silent: true });
        return { lesion, resultOnly: true };
    }
    lesion.resultPlan = action === 'further_management' || action === 'no_followup' ? action : (lesion.resultPlan || '');
    if (Object.prototype.hasOwnProperty.call(extras, 'callNote')) {
        lesion.adminCallNote = extras.callNote || '';
    }
    lesion.contactState = fileNoCall ? 'file_no_call' : contact;
    const advised = contact === 'advised_now' || fileNoCall;
    if (advised) lesion.resultAdvisedAt = new Date().toISOString();
    const planAfter = resultContactPlanLine(lesion.resultPlan, fileNoCall ? 'advised_now' : contact, { fileNoCall });
    const accession = typeof formatHistologyAccession === 'function' ? formatHistologyAccession(lesion, 'own') : '';
    const timelineNote = [extras.callNote || resultText, accession && ('Lab case ' + accession)].filter(Boolean).join(' · ');
    let timelineType = String(resultText || '').trim() ? 'histology' : 'plan';
    let timelineOutcome = '';
    if (advised) timelineType = 'result_advised';
    else if (contact === 'not_reached') {
        timelineType = 'call_attempt';
        timelineOutcome = 'no answer';
    } else if (contact === 'appointment_requested') {
        timelineType = 'plan';
    }
    appendLesionTimeline(lesion, {
        type: timelineType,
        outcome: timelineOutcome,
        note: timelineNote,
        planAfter
    });
    if (typeof syncBillingFromLesion === 'function') {
        await syncBillingFromLesion(lesion);
    }
    const note = [
        extras.callNote
            ? (String(resultText || '').trim() ? resultText + ' · ' + extras.callNote : extras.callNote)
            : resultText,
        accession && ('Lab case ' + accession)
    ].filter(Boolean).join(' · ');
    if (action === 'further_management') {
        const canOpen = typeof lesionCanOpenFurtherManagement === 'function'
            ? lesionCanOpenFurtherManagement(lesion)
            : (lesionHasSavedHistology(lesion) || isTopicalFollowUpLesion(lesion));
        const reviewDisposition = !!extras.allowWithoutHistology || (canOpen && !lesionHasSavedHistology(lesion));
        if (!lesionHasSavedHistology(lesion) && !reviewDisposition) {
            showToast('Save the histology result before opening further management.');
            return { lesion, needResult: true };
        }
        lesion.currentPlan = 'Further management opened';
        await saveManagedLesionRecord(lesion, reviewDisposition ? 'plan' : 'histology', note);
        const child = await spawnFurtherManagementChild(lesion, {
            allowWithoutHistology: reviewDisposition,
            contact: reviewDisposition ? 'advised_now' : (fileNoCall ? 'mark_for_contact' : contact),
            advised: reviewDisposition || advised,
            resultAdvisedAt: lesion.resultAdvisedAt || '',
            contactUrgent: !!lesion.contactUrgent,
            proposedPlan: proposedPlan || (nextAction === 'plan_excision' ? 'excision' : ''),
            proposedPlanNote
        });
        return {
            lesion,
            child,
            spawnedManagement: true,
            openExcision: !!((reviewDisposition || advised) && (proposedPlan === 'excision' || nextAction === 'plan_excision')),
            openChildId: child?.id || ''
        };
    }
    if (action === 'no_followup') {
        const billingHold = !lesionCanCloseNoFollowup(lesion);
        const closurePlan = reviewClosurePlanLine(lesion, billingHold);
        await setManagedLesionStatus(id, 'no_followup', note, {
            currentPlan: closurePlan
        });
        return { lesion, closed: true, billingHold, closurePlan };
    }
    if (contact === 'appointment_requested') {
        lesion.managementStatus = 'appointment_requested';
        lesion.currentPlan = planAfter;
        await saveManagedLesionRecord(lesion, 'histology', note);
        return { lesion, reception: true };
    }
    lesion.managementStatus = 'needs_contact';
    lesion.currentPlan = planAfter;
    await saveManagedLesionRecord(lesion, 'histology', note);
    return { lesion };
}

async function applyAdviceFromContact(lesion) {
    if (!lesion?.id) return { changed: false };
    if (typeof repairLesionAwaitingAfterResult === 'function') repairLesionAwaitingAfterResult(lesion);
    const status = lesionLifecycleStatus(lesion);
    if (status === 'awaiting_histology') return { changed: false, needResult: true };
    if (status !== 'needs_contact' && status !== 'appointment_requested') return { changed: false };
    lesion.resultAdvisedAt = new Date().toISOString();
    lesion.contactState = 'advised_now';

    // Contact on a management child — parent is already closed.
    if (isOpenManagementChild(lesion) && !lesionHasSavedHistology(lesion)) {
        const proposed = String(lesion.proposedPlan || '');
        if (proposed === 'excision') {
            lesion.managementStatus = 'awaiting_assessment';
            lesion.currentPlan = formatProposedManagementPlan(lesion);
            await saveManagedLesionRecord(lesion, 'comms:advised', 'Patient advised');
            return { changed: true, openExcision: true, openChildId: lesion.id };
        }
        if (proposed === 'topical') {
            lesion.managementStatus = 'awaiting_assessment';
            lesion.type = 'topical';
            lesion.currentPlan = formatProposedManagementPlan(lesion);
            await saveManagedLesionRecord(lesion, 'comms:advised', 'Patient advised');
            return { changed: true };
        }
        if (proposed === 'refer') {
            lesion.managementStatus = 'awaiting_assessment';
            lesion.currentPlan = formatProposedManagementPlan(lesion);
            await saveManagedLesionRecord(lesion, 'comms:advised', 'Patient advised — referral');
            return { changed: true, openLetter: true, openChildId: lesion.id };
        }
        lesion.managementStatus = 'awaiting_assessment';
        lesion.currentPlan = formatProposedManagementPlan(lesion);
        await saveManagedLesionRecord(lesion, 'comms:advised', 'Patient advised');
        return { changed: true };
    }

    const plan = lesion.resultPlan || '';
    if (plan === 'no_followup') {
        const billingHold = !lesionCanCloseNoFollowup(lesion);
        const closurePlan = reviewClosurePlanLine(lesion, billingHold);
        await setManagedLesionStatus(lesion.id, 'no_followup', 'Patient advised', {
            currentPlan: closurePlan
        });
        return { changed: true, closed: true, billingHold, closurePlan };
    }
    if (isFurtherManagementPlan(plan)) {
        if (typeof lesionHasSavedHistology === 'function' && !lesionHasSavedHistology(lesion)) {
            return { changed: false, needResult: true };
        }
        const existing = findLinkedReexcisionChild(lesion.id);
        if (existing) {
            await saveManagedLesionRecord(lesion, 'comms:advised', 'Patient advised');
            const existingProposed = String(existing.proposedPlan || '');
            return {
                changed: true,
                openExcision: existingProposed === 'excision' || lesionType(existing) === 'excision',
                openLetter: existingProposed === 'refer',
                openChildId: existing.id
            };
        }
        const child = await spawnFurtherManagementChild(lesion, {
            contact: 'advised_now',
            advised: true,
            resultAdvisedAt: lesion.resultAdvisedAt,
            proposedPlan: String(lesion.proposedPlan || '') === 'excision' || plan === 'plan_excision' ? 'excision' : (lesion.proposedPlan || '')
        });
        return {
            changed: true,
            openExcision: String(child?.proposedPlan || '') === 'excision',
            openLetter: String(child?.proposedPlan || '') === 'refer',
            openChildId: child?.id || '',
            spawnedManagement: true
        };
    }
    await saveManagedLesionRecord(lesion, 'comms:advised', 'Patient advised');
    return { changed: true, needPlan: true };
}

async function closePriorLesionAfterReexcision(prior, child) {
    if (!prior?.id || !child?.id) return;
    const kind = typeof lesionOwnProcedureKind === 'function'
        ? lesionOwnProcedureKind(prior)
        : priorProcedureKindForReexcision(prior);
    prior.linkedReexcisionId = String(child.id);
    prior.linkedChildId = String(child.id);
    const billingPending = typeof lesionCanCloseNoFollowup === 'function' && !lesionCanCloseNoFollowup(prior);
    const childIsExcision = (typeof lesionType === 'function' ? lesionType(child) : child.type) === 'excision'
        || canonicalLesionStatus(child.managementStatus) === 'planned_procedure'
        || canonicalLesionStatus(child.managementStatus) === 'current_case';
    prior.currentPlan = billingPending
        ? (childIsExcision
            ? 'Episode complete · re-excision booked — billing on Billing tab'
            : 'Episode complete · further management open — billing on Billing tab')
        : (childIsExcision
            ? 'Episode complete · re-excision booked'
            : 'Episode complete · further management open');
    if (typeof appendLesionTimeline === 'function') {
        appendLesionTimeline(prior, {
            type: 'plan',
            note: childIsExcision
                ? ('Re-excision booked as a new lesion after ' + kind + ' (written consent required on the new procedure).')
                : ('Further management opened as a linked lesion after ' + kind + '.'),
            planAfter: prior.currentPlan
        });
    }
    const restoredType = restorePriorTypeFromProcedure(prior);
    if (restoredType && restoredType !== 'none') prior.type = restoredType;
    // Clinical queue is done; billing stays on the billing board separately.
    prior.managementStatus = 'no_followup';
    prior.resultPlan = prior.resultPlan || 'further_management';
    await saveManagedLesionRecord(prior, childIsExcision ? 'reexcision:linked' : 'management:linked', billingPending
        ? (childIsExcision
            ? 'Re-excision booked; clinical episode complete; billing still pending'
            : 'Further management opened; clinical episode complete; billing still pending')
        : (childIsExcision
            ? 'Re-excision booked; clinical episode complete'
            : 'Further management opened; clinical episode complete'));
}

async function persistReexcisionChild(child) {
    if (!child?.id) return null;
    if (child.priorLesionId) {
        const existing = findExistingChildOfPrior(child.priorLesionId);
        if (existing && String(existing.id) !== String(child.id)) {
            if (lesionHasOwnCompletedEpisode(existing)) {
                return existing;
            }
            const keepConsent = existing.consentStatus || '';
            const keepConsentedAt = existing.consentedAt || '';
            child.id = existing.id;
            child.createdAt = existing.createdAt || child.createdAt;
            child.history = existing.history || child.history;
            child.timeline = existing.timeline || child.timeline;
            Object.assign(existing, child);
            child = existing;
            if (keepConsent) {
                child.consentStatus = keepConsent;
                child.consentedAt = keepConsentedAt;
            }
        }
    }
    const now = new Date().toISOString();
    child.createdAt = child.createdAt || now;
    child.updatedAt = now;
    child.type = 'excision';
    child.managementStatus = 'planned_procedure';
    if (!(typeof consentRank === 'function' ? consentRank(child.consentStatus) : child.consentStatus)) {
        child.consentStatus = '';
        child.consentedAt = '';
    }
    if (!lesionProcedureDone(child)) {
        child.procedureCompletedAt = '';
        child.excisionFinalisedAt = '';
        child.procedureDetail = null;
    }
    child.billingStatus = child.billingStatus || 'none';
    child.schemaVersion = LESION_SCHEMA_VERSION;
    applyChildChartIdentity(child);
    if (typeof vaultAuth !== 'undefined' && vaultAuth.username) child.owner = vaultAuth.username;
    if (!child.currentPlan) child.currentPlan = defaultPlanLine(child);
    sanitizeOpenReexcisionChild(child);
    if (typeof appendLesionHistory === 'function' && !(child.history || []).length) {
        appendLesionHistory(child, 'created', child.plan || 'Re-excision planned');
    }
    if (typeof appendLesionTimeline === 'function' && !(child.timeline || []).some((event) => event && event.type === 'plan')) {
        appendLesionTimeline(child, {
            type: 'plan',
            note: child.plan || '',
            planAfter: child.currentPlan
        });
    }
    if (typeof writeManagedLesion === 'function') await writeManagedLesion(child);
    upsertManagedLesionMemory(child);
    if (typeof syncSessionLesionFromProcedure === 'function') syncSessionLesionFromProcedure(child);
    if (typeof offerLesionToProcedureSession === 'function') offerLesionToProcedureSession(child);
    if (typeof renderManagedLesions === 'function') renderManagedLesions();
    if (typeof renderChartSidebar === 'function') renderChartSidebar();
    if (typeof renderProcedureWorkspace === 'function') renderProcedureWorkspace();
    return child;
}

async function repairStuckReexcisionLesions() {
    // Do not auto-book re-excisions. Fix status drift only; never spawn without histology + user intent.
    const stuck = (managedLesions || []).filter((item) => {
        if (!item?.id) return false;
        if (item.linkedReexcisionId || findLinkedReexcisionChild(item.id)) return false;
        if (canonicalLesionStatus(item.managementStatus) !== 'planned_procedure') return false;
        if ((typeof lesionType === 'function' ? lesionType(item) : item.type) !== 'excision') return false;
        return lesionProcedureDone(item) || lesionHasSavedHistology(item);
    });
    if (!stuck.length) return 0;
    let fixed = 0;
    for (const prior of stuck) {
        try {
            if (lesionHasSavedHistology(prior)) {
                const next = statusAfterSavedHistology(prior);
                prior.managementStatus = next;
                if (!String(prior.currentPlan || '').trim() || /planned|excision planned/i.test(prior.currentPlan)) {
                    prior.currentPlan = planLineAfterSavedHistology(prior, next);
                }
            } else if (lesionProcedureDone(prior)) {
                prior.managementStatus = 'awaiting_histology';
                prior.currentPlan = prior.currentPlan || 'Awaiting histology';
            } else {
                continue;
            }
            await saveManagedLesionRecord(prior, 'repair:status', 'Corrected planned excision that already had a completed episode', { silent: true });
            fixed += 1;
        } catch (err) {
            console.warn('Could not repair stuck re-excision status', prior.id, err);
        }
    }
    return fixed;
}

async function markBillingProcessed(ids) {
    if (typeof markBillingsAsProcessed === 'function') {
        await markBillingsAsProcessed(ids);
        return;
    }
    for (const id of ids) {
        if (typeof confirmBillingCodes === 'function') await confirmBillingCodes(id);
    }
}

function checkerResolveChart(charts, chartId, name, dob) {
    const list = Array.isArray(charts) ? charts : [];
    const id = String(chartId || '').trim();
    if (id) {
        const hit = list.find((chart) => chart && chart.id === id);
        if (hit) return hit;
    }
    const raw = patientChartId(name, dob);
    const canonical = canonicalPatientChartId(name, dob);
    if (!raw && !canonical) return null;
    const dobKey = normalizeChartDob(dob);
    const matches = list.filter((chart) => {
        if (!chart?.id || normalizeChartDob(chart.dob) !== dobKey) return false;
        if (chart.id === raw || chart.id === canonical) return true;
        const chartName = composePatientName(chart.firstName, chart.lastName, chart.name);
        return !!canonical && canonicalPatientChartId(chartName, chart.dob) === canonical;
    });
    return matches.length === 1 ? matches[0] : null;
}

function checkerIdentityFromChart(chart) {
    const name = composePatientName(chart.firstName, chart.lastName, chart.name) || 'Unnamed patient';
    return {
        name,
        dob: String(chart.dob || '').trim(),
        chartId: chart.id,
        firstName: chart.firstName || '',
        lastName: chart.lastName || ''
    };
}

function checkerRecordIsVisitNote(record) {
    return !!(record && (
        Object.prototype.hasOwnProperty.call(record, 'consultText')
        || Object.prototype.hasOwnProperty.call(record, 'procedureText')
        || Object.prototype.hasOwnProperty.call(record, 'histologySlipText')
        || Object.prototype.hasOwnProperty.call(record, 'aftercareHtml')
    ));
}

function checkerRecordIsCurrent(record, now) {
    const expiry = Date.parse(record?.expiresAt || '');
    let until = Number.isNaN(expiry) ? NaN : expiry;
    if (checkerRecordIsVisitNote(record)) {
        const created = Date.parse(record?.createdAt || '');
        const keepMs = typeof VISIT_NOTE_TTL_MS === 'number' ? VISIT_NOTE_TTL_MS : (45 * 24 * 60 * 60 * 1000);
        if (!Number.isNaN(created)) {
            const fromCreated = created + keepMs;
            if (Number.isNaN(until) || fromCreated > until) until = fromCreated;
        }
    }
    if (!Number.isNaN(until)) return until > now;
    const created = Date.parse(record?.createdAt || '');
    if (Number.isNaN(created)) return false;
    return created + (7 * 24 * 60 * 60 * 1000) > now;
}

function checkerTextMentionsLesion(text, lesion) {
    const loc = String(lesion?.location || '').trim().toLowerCase().replace(/\s+/g, ' ');
    if (loc.length < 8) return false;
    const hay = String(text || '').toLowerCase().replace(/\s+/g, ' ');
    if (!hay.includes(loc)) return false;
    const caseNo = String(lesion.histologyCaseNumber || lesion.priorHistologyCaseNumber || '').trim().toLowerCase();
    if (caseNo.length >= 4 && hay.includes(caseNo)) return true;
    const dx = String(lesion.histologyDiagnosis || lesion.impression || '').trim().toLowerCase();
    return dx.length >= 8 && hay.includes(dx);
}

function checkerDocumentText(record) {
    return [
        record?.consultText,
        record?.procedureText,
        record?.histologySlipText,
        record?.histologyReportText,
        record?.plainText
    ].filter(Boolean).join('\n');
}

function checkerRootLesion(lesion, byId) {
    const seen = new Set();
    let current = lesion;
    while (current?.priorLesionId) {
        const id = String(current.id || '');
        if (id && seen.has(id)) break;
        if (id) seen.add(id);
        const parent = byId.get(String(current.priorLesionId));
        if (!parent) break;
        current = parent;
    }
    return current;
}

function reviewLesionChartMismatches(input) {
    const lesions = Array.isArray(input?.lesions) ? input.lesions : [];
    const charts = Array.isArray(input?.charts) ? input.charts : [];
    const bills = Array.isArray(input?.bills) ? input.bills : [];
    const notes = Array.isArray(input?.notes) ? input.notes : [];
    const consents = Array.isArray(input?.consents) ? input.consents : [];
    const priorCopies = Array.isArray(input?.priorCopies) ? input.priorCopies : [];
    const now = Number(input?.now) || Date.now();
    const byId = new Map(lesions.filter((lesion) => lesion?.id).map((lesion) => [String(lesion.id), lesion]));
    const findings = [];

    lesions.forEach((lesion) => {
        if (!lesion?.id) return;
        const storedChart = checkerResolveChart(charts, lesion.chartId, '', '');
        const namedChart = checkerResolveChart(charts, '', lesion.patientName, lesion.patientDob);
        const currentChart = storedChart || namedChart;
        const current = currentChart
            ? checkerIdentityFromChart(currentChart)
            : {
                name: lesion.patientName || 'Unnamed patient',
                dob: String(lesion.patientDob || '').trim(),
                chartId: String(lesion.chartId || '').trim(),
                firstName: '',
                lastName: ''
            };
        const votes = new Map();
        const vote = (chart, weight, reason) => {
            if (!chart?.id || (currentChart && chart.id === currentChart.id)) return;
            let slot = votes.get(chart.id);
            if (!slot) {
                slot = { chart, weight: 0, reasons: [] };
                votes.set(chart.id, slot);
            }
            if (weight > slot.weight) slot.weight = weight;
            if (reason && !slot.reasons.includes(reason)) slot.reasons.push(reason);
        };

        const root = checkerRootLesion(lesion, byId);
        if (root && String(root.id) !== String(lesion.id)) {
            vote(
                checkerResolveChart(charts, root.chartId, root.patientName, root.patientDob),
                5,
                'Linked to an earlier lesion on this chart'
            );
        }
        if (storedChart && namedChart && namedChart.id !== storedChart.id) {
            vote(namedChart, 3, 'The name still stored on this lesion matches this chart');
        }
        charts.forEach((chart) => {
            const visit = chart?.visitSession || {};
            const procedure = chart?.procedureSession || {};
            const visitIds = []
                .concat(visit.visitLesionIds || [], visit.visitReviewLesionIds || [])
                .map(String);
            const procedureIds = []
                .concat(procedure.selectedIds || [], procedure.lockedIds || [], procedure.detailLesionId || [], procedure.amendLesionId || [])
                .map(String)
                .filter(Boolean);
            if (visitIds.includes(String(lesion.id))) {
                vote(chart, 5, 'This chart’s visit list includes this lesion');
            }
            if (procedureIds.includes(String(lesion.id))) {
                vote(chart, 5, 'This chart’s procedure list includes this lesion');
            }
        });
        consents.forEach((doc) => {
            if (!checkerRecordIsCurrent(doc, now)) return;
            const ids = (doc.lesionIds || []).map(String);
            if (!ids.includes(String(lesion.id))) return;
            vote(
                checkerResolveChart(charts, doc.chartId, doc.patientName, doc.patientDob),
                5,
                'A saved consent on this chart includes this lesion'
            );
        });
        bills.forEach((bill) => {
            if (String(bill?.lesionId || '') !== String(lesion.id)) return;
            vote(
                checkerResolveChart(charts, bill.chartId, bill.patientName, bill.patientDob),
                4,
                'A billing record is filed on this chart'
            );
        });
        priorCopies.forEach((copy) => {
            if (String(copy?.id || '') !== String(lesion.id)) return;
            vote(
                checkerResolveChart(charts, copy.chartId, copy.patientName, copy.patientDob),
                4,
                'An earlier saved copy of this lesion is on this chart'
            );
        });
        notes.forEach((note) => {
            if (!checkerRecordIsCurrent(note, now)) return;
            if (!checkerTextMentionsLesion(checkerDocumentText(note), lesion)) return;
            vote(
                checkerResolveChart(charts, note.chartId, note.patientName, note.patientDob),
                2,
                'A recent visit note on this chart mentions this site and diagnosis'
            );
        });
        consents.forEach((doc) => {
            if (!checkerRecordIsCurrent(doc, now)) return;
            const ids = (doc.lesionIds || []).map(String);
            if (ids.includes(String(lesion.id))) return;
            if (!checkerTextMentionsLesion(checkerDocumentText(doc), lesion)) return;
            vote(
                checkerResolveChart(charts, doc.chartId, doc.patientName, doc.patientDob),
                2,
                'A recent consent on this chart mentions this site and diagnosis'
            );
        });

        if (!votes.size) return;
        const top = Math.max(...Array.from(votes.values()).map((slot) => slot.weight));
        const suggestions = Array.from(votes.values())
            .filter((slot) => slot.weight === top)
            .map((slot) => ({
                ...checkerIdentityFromChart(slot.chart),
                reasons: slot.reasons
            }))
            .sort((a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }));
        findings.push({
            lesionId: String(lesion.id),
            location: lesion.location || '',
            impression: lesion.impression || lesion.histologyDiagnosis || '',
            caseNumber: lesion.histologyCaseNumber || '',
            managementStatus: lesion.managementStatus || '',
            current,
            suggestions
        });
    });

    findings.sort((a, b) => {
        const byName = String(a.current?.name || '').localeCompare(String(b.current?.name || ''), 'en', { sensitivity: 'base' });
        if (byName) return byName;
        return String(a.location || '').localeCompare(String(b.location || ''), 'en', { sensitivity: 'base' });
    });
    return findings;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        DEFAULT_CLINIC_TIME_ZONE,
        isValidIanaTimeZone,
        normalizeClinicTimeZone,
        clinicCalendarDayKey,
        clinicTodayKey,
        normalizeFurtherActionDate,
        formatFurtherActionDateLabel,
        furtherActionDateIsFuture,
        applyFurtherActionDate,
        lesionStaysOnOpenAttentionList,
        isActiveManagementStatus,
        isTopicalFollowUpLesion,
        hasOutstandingTopicalWork,
        isScheduledReviewLesion,
        isMonitorLesionPlan,
        lesionReviewDispositionKind,
        lesionAllowsReviewDisposition,
        lesionCanOpenFurtherManagement,
        lesionReviewDispositionCopy,
        reviewClosurePlanLine,
        reviewClosureMessage,
        resultContactPlanLine,
        planLineAfterSavedHistology,
        lesionIemrCommsLine,
        linkedLesionPlansReexcision,
        repairMisleadingPlanLine,
        applyContactOutcomeToLesion,
        lesionOwnProcedureKind,
        deriveLesionStatusFromPlan,
        lesionLifecycleStatus,
        spawnFurtherManagementChild,
        recordHistologyOutcome,
        applyAdviceFromContact,
        setManagedLesionStatus,
        isVerbalConsentBiopsyType,
        lesionConsentRequirement,
        lesionHasProcedureConsent,
        practiceLesionPotNumber,
        practiceLesionDayKey,
        practiceLesionOrderKey,
        comparePracticeLesions,
        practiceLesionTreeNumber,
        patientChartId,
        newPersonId,
        chartIdForPerson,
        nextSpotNumberForChart,
        copySpotIdentityFromPrior,
        assignFreshSpotIdentity,
        retargetLesionIdentity,
        planRecordIdentityUpgrade,
        consentEpisodeRefs,
        identityChartId,
        canonicalPatientChartId,
        chartIdForName,
        lesionChartId,
        lesionBelongsToOpenChart,
        recordAttachmentChartId,
        attachmentPatientIdentity,
        lesionSaveIdentity,
        lesionChildIdentity,
        lesionChartRepair,
        sessionPatientSnapshot,
        reviewLesionChartMismatches
    };
}
