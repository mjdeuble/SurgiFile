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

const LEGACY_STATUS_ALIASES = {
    planned_excision: 'planned_procedure',
    awaiting_biopsy: 'planned_procedure'
};

const TIMELINE_TYPES = ['call_attempt', 'voicemail', 'sms', 'spoke', 'result_advised', 'plan', 'procedure', 'abort', 'histology', 'consent'];
const CALL_OUTCOMES = ['no answer', 'voicemail', 'spoke', 'declined', 'booked', 'patient not ready'];

function newLesionId() {
    if (crypto.randomUUID) return crypto.randomUUID();
    return 'lesion-' + Date.now() + '-' + Math.random().toString(16).slice(2);
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

function statusAfterSavedHistology(lesion) {
    if (lesion?.linkedReexcisionId || (typeof lesionIsSupersededByReexcision === 'function' && lesionIsSupersededByReexcision(lesion))) {
        return 'no_followup';
    }
    const contact = lesion?.contactState || '';
    const plan = lesion?.resultPlan || '';
    const advised = !!lesion?.resultAdvisedAt || contact === 'advised_now' || contact === 'file_no_call';
    if (contact === 'appointment_requested') return 'appointment_requested';
    if (advised && plan === 'no_followup' && typeof lesionCanCloseNoFollowup === 'function' && lesionCanCloseNoFollowup(lesion)) {
        return 'no_followup';
    }
    const stored = canonicalLesionStatus(lesion?.managementStatus);
    if (stored === 'appointment_requested' && !advised) return 'appointment_requested';
    if (stored === 'no_followup') return 'no_followup';
    return 'needs_contact';
}

function planLineAfterSavedHistology(lesion, status) {
    const contact = lesion?.contactState === 'file_no_call'
        ? 'advised_now'
        : (lesion?.contactState || 'mark_for_contact');
    const extras = { fileNoCall: lesion?.contactState === 'file_no_call' };
    if (status === 'no_followup') return 'No follow-up';
    if (status === 'needs_contact' && lesion?.resultPlan === 'no_followup' && lesion?.resultAdvisedAt
        && typeof lesionCanCloseNoFollowup === 'function' && !lesionCanCloseNoFollowup(lesion)) {
        return 'No follow-up — billing pending';
    }
    if (status === 'needs_contact' && isFurtherManagementPlan(lesion?.resultPlan) && lesion?.resultAdvisedAt) {
        return 'Further management — set plan on linked lesion';
    }
    return resultContactPlanLine(lesion?.resultPlan || 'no_followup', contact, extras)
        || 'Result reviewed — mark for contact';
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
    return 'Needs management';
}

function resultContactPlanLine(plan, contact, extras) {
    extras = extras || {};
    const further = isFurtherManagementPlan(plan);
    if (extras.fileNoCall && plan === 'no_followup') return 'No follow-up';
    if (contact === 'advised_now' && plan === 'no_followup') return 'No follow-up';
    if (contact === 'advised_now' && further) return 'Further management — set plan on linked lesion';
    if (contact === 'appointment_requested') {
        return further ? 'Discuss result — further management likely' : 'Discuss result';
    }
    if (contact === 'not_reached') {
        return further ? 'Further management — not reached' : 'NFA — not reached';
    }
    if (further) return 'Further management after result discussed';
    if (plan === 'no_followup') return 'NFA — to be advised';
    return 'Result reviewed — mark for contact';
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
    if (t === 'shave' || t === 'punch') return 'any';
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
    return status === 'verbal' || status === 'written';
}

function lesionConsentNeededLabel(lesion) {
    const label = lesionConsentLabel(lesion);
    if (label) return label;
    if (lesion?.priorLesionId && lesionConsentRequirement(lesion) === 'written') {
        return 'Written consent needed (re-excision)';
    }
    return lesionConsentRequirement(lesion) === 'written' ? 'Written consent needed' : 'Consent needed';
}

function lesionOwnProcedureKind(lesion) {
    const t = typeof lesionType === 'function' ? lesionType(lesion) : String(lesion?.type || '');
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
    // Hide duplicate re-excision children only. Parent / previous-procedure
    // lesions stay on the practice board and patient chart.
    return lesionIsOrphanReexcisionDuplicate(lesion);
}

function lesionBelongsToOpenChart(lesion) {
    if (!lesion || typeof hasCurrentPatient !== 'function' || !hasCurrentPatient()) return false;
    const chartId = currentPatient.chartId;
    const seen = new Set();
    let current = lesion;
    while (current?.id) {
        const id = String(current.id);
        if (seen.has(id)) break;
        seen.add(id);
        if (typeof lesionChartId === 'function' && lesionChartId(current) === chartId) return true;
        if (!current.priorLesionId) break;
        current = findLesionRecordById(current.priorLesionId);
    }
    return false;
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
    if (!lesionHasSavedHistology(lesion)) return false;
    if (findLinkedReexcisionChild(lesion.id)) return false;
    const child = findLiveReexcisionChild(lesion);
    if (child && !lesionProcedureDone(child) && lesionLifecycleStatus(child) !== 'no_followup') return false;
    return true;
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
    items.forEach((lesion, idx) => {
        lesion.histologyBatchId = batchId;
        if (!normalizeHistologyPot(lesion.histologyPot)) {
            lesion.histologyPot = String(idx + 1);
        }
        const session = (typeof lesions !== 'undefined' && Array.isArray(lesions))
            ? lesions.find((row) => String(row.id) === String(lesion.id))
            : null;
        if (session && session !== lesion) {
            session.histologyBatchId = batchId;
            if (!normalizeHistologyPot(session.histologyPot)) session.histologyPot = lesion.histologyPot;
        }
        const managed = (typeof managedLesions !== 'undefined' ? managedLesions : [])
            .find((row) => String(row.id) === String(lesion.id));
        if (managed && managed !== lesion) {
            managed.histologyBatchId = batchId;
            if (!normalizeHistologyPot(managed.histologyPot)) managed.histologyPot = lesion.histologyPot;
        }
    });
    return batchId;
}

function histologyAccessionParts(lesion, mode) {
    const autoPrior = mode === 'prior' || (mode !== 'own' && lesion?.priorLesionId);
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

function formatPriorHistologyCitation(lesion) {
    const cited = typeof lesionWithPriorHistologyCitation === 'function'
        ? lesionWithPriorHistologyCitation(lesion)
        : lesion;
    const accession = formatHistologyAccession(cited, 'prior');
    if (!accession) return '';
    const parts = histologyAccessionParts(cited, 'prior');
    let text = 'Previous histology ' + accession;
    if (parts.kind) text += ' (' + parts.kind + ')';
    if (parts.result) text += ': ' + parts.result;
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
        priorHistologyResult: String(extras.priorHistologyResult || prior?.histologyResult || '').trim()
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
        type: 'none',
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
    return child;
}

async function persistManagementChild(child) {
    if (!child?.id) return null;
    const now = new Date().toISOString();
    const patient = typeof sessionPatientSnapshot === 'function' ? sessionPatientSnapshot() : {};
    child.createdAt = child.createdAt || now;
    child.updatedAt = now;
    child.schemaVersion = LESION_SCHEMA_VERSION;
    if (patient.chartId) child.chartId = patient.chartId;
    else if (!child.chartId && child.patientName && child.patientDob && typeof patientChartId === 'function') {
        child.chartId = patientChartId(child.patientName, child.patientDob);
    }
    if (patient.patientName) child.patientName = child.patientName || patient.patientName;
    if (patient.patientDob) child.patientDob = child.patientDob || patient.patientDob;
    if (patient.patientPhone) child.phone = child.phone || patient.patientPhone;
    if (patient.clinician) child.clinician = child.clinician || patient.clinician;
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

async function spawnFurtherManagementChild(prior, extras) {
    extras = extras || {};
    if (!prior?.id) return null;
    if (!lesionHasSavedHistology(prior) && !extras.allowWithoutHistology) {
        showToast('Save histology before opening further management.');
        return null;
    }
    const existing = findLinkedReexcisionChild(prior.id);
    if (existing && !lesionProcedureDone(existing)) {
        const existingStatus = lesionLifecycleStatus(existing);
        if (existingStatus !== 'no_followup') return existing;
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
        if (record.topicalDecision === 'declined') return 'no_followup';
        if (record.topicalFollowUp && record.topicalFollowUp !== 'none') return 'topical_followup';
        return 'no_followup';
    }
    if (plan.includes('Monitor')) return 'no_followup';
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
    if (status === 'needs_contact') return 'Result reviewed — mark for contact';
    if (status === 'appointment_requested') return 'Discuss result';
    if (status === 'current_case') return 'In theatre now';
    if (status === 'planned_procedure') {
        if (lesion?.priorLesionId && type === 'excision') return 'Re-excision planned';
        if (type === 'excision') return 'Excision planned';
        if (type === 'shave') return 'Shave biopsy planned';
        if (type === 'punch') return 'Punch biopsy planned';
        return 'Procedure planned';
    }
    if (status === 'topical_followup') return 'Topical follow-up';
    if (status === 'no_followup') return 'No follow-up';
    if (status === 'awaiting_assessment') return 'Awaiting assessment';
    return String(lesion?.plan || '').trim();
}

function ensureLesionTimeline(lesion) {
    if (!Array.isArray(lesion.timeline)) lesion.timeline = [];
    return lesion.timeline;
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
        if (!String(lesion.currentPlan || '').trim() || /needs contact|to be advised|not reached/i.test(lesion.currentPlan)) {
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
        return lesion?.contactUrgent ? 'Result reviewed. Urgent contact.' : 'Result reviewed. Patient to be contacted.';
    }
    const last = lesionTimelineNewestFirst(lesion).find((event) => event.type === 'result_advised' || event.type === 'plan');
    if (!last) return '';
    const text = String(lesion?.currentPlan || last.planAfter || last.note || '').trim();
    if (!text) return '';
    return last.type === 'result_advised' ? ('Result advised: ' + text) : ('Plan: ' + text);
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
            lesion.currentPlan = lesion.resultAdvisedAt
                ? (isFurtherManagementPlan(lesion.resultPlan) ? 'Further management — set plan on linked lesion' : 'NFA — to be advised')
                : 'Result reviewed — mark for contact';
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
        if (!repairLesionAwaitingAfterResult(lesion)) continue;
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

function lesionChartId(lesion) {
    return lesion?.chartId || patientChartId(lesion?.patientName, lesion?.patientDob);
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
    ['headerOpenChartTools', 'boardOpenChartTools'].forEach((id) => {
        const el = document.getElementById(id);
        if (el) el.classList.toggle('hidden', open);
    });
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
    if (hasCurrentPatient()) {
        return {
            patientName: currentPatient.name,
            patientDob: currentPatient.dob,
            patientPhone: currentPatient.phone || '',
        clinician: (typeof loggedInDoctorName === 'function' && loggedInDoctorName()) || currentPatient.clinician || '',
            chartId: currentPatient.chartId
        };
    }
    const name = document.getElementById('mainPatientName')?.value.trim() || '';
    const dob = document.getElementById('mainPatientDOB')?.value.trim() || '';
    return {
        patientName: name,
        patientDob: dob,
        patientPhone: currentPatient.phone || '',
        clinician: (typeof loggedInDoctorName === 'function' && loggedInDoctorName()) || document.getElementById('mainDoctorName')?.value.trim() || '',
        chartId: patientChartId(name, dob)
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
            : 'Search the practice board to open a chart';
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
    currentPatient = {
        name,
        firstName: identity.firstName,
        lastName: identity.lastName,
        dob,
        phone: identity.phone,
        clinician,
        chartId
    };
    if (changed && !options?.silentRestore) {
        isBedSanitised = false;
        shaveConsentVerified = false;
        pendingShaveConsentAction = '';
        lesions = [];
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
    patientConcerns = [];
    noPatientConcerns = false;
    screeningMarkedComplete = false;
    if (typeof screeningAskedThisConsult !== 'undefined') screeningAskedThisConsult = false;
    smsNormalResultsConsent = '';
    selectedChartLesionId = '';
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
    ['headerChartSearchResults', 'boardChartSearchResults'].forEach((id) => {
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
    const other = resultsId === 'boardChartSearchResults' ? 'headerChartSearchResults' : 'boardChartSearchResults';
    const otherEl = document.getElementById(other);
    if (otherEl) {
        otherEl.classList.add('hidden');
        otherEl.innerHTML = '';
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
    hideChartSearchResults();
    const headerSearch = document.getElementById('headerChartSearch');
    const boardSearch = document.getElementById('boardChartSearch');
    if (headerSearch) headerSearch.value = '';
    if (boardSearch) boardSearch.value = '';
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
    const input = document.getElementById('boardChartSearch') || document.getElementById('headerChartSearch');
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
    if (dobEl) dobEl.value = '';
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
    const firstName = document.getElementById('chartPatientFirstName')?.value.trim() || '';
    const lastName = document.getElementById('chartPatientLastName')?.value.trim() || '';
    const dob = document.getElementById('chartPatientDob')?.value.trim() || '';
    const phone = document.getElementById('chartPatientPhone')?.value.trim() || '';
    const clinician = (typeof loggedInDoctorName === 'function' && loggedInDoctorName()) || '';
    const name = composePatientName(firstName, lastName);
    if (!clinician) {
        showToast('Sign in with a user that has a full doctor name. Charts attach to that doctor automatically.');
        return;
    }
    if (!firstName || !lastName || !dob) {
        showToast('Enter first name, last name, and date of birth.');
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
    closePatientModal();
    const billing = typeof readAddPatientBilling === 'function'
        ? readAddPatientBilling()
        : { consultBilling: 'Private Bill', biopsyBilling: '$20 OOP per biopsy (Item 30071)' };
    const patient = { name, firstName, lastName, dob, phone, clinician, ...billing };
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
}

async function submitPatientModal() {
    await submitAddPatientModal();
}

function requireCurrentPatient(message) {
    if (hasCurrentPatient()) return true;
    showToast(message || 'Search for a patient on the practice board, or add a new patient.');
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
        patientName: patient.patientName || sessionLesion.patientName || existing.patientName || '',
        patientDob: patient.patientDob || sessionLesion.patientDob || existing.patientDob || '',
        patientPhone: patient.patientPhone || sessionLesion.patientPhone || existing.patientPhone || sessionLesion.phone || existing.phone || '',
        clinician: patient.clinician || sessionLesion.clinician || existing.clinician || '',
        chartId: patient.chartId || sessionLesion.chartId || existing.chartId || '',
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
        priorHistologyResult: sessionLesion.priorHistologyResult || existing.priorHistologyResult || ''
    };
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
        if (!lesionCanCloseNoFollowup(lesion)) {
            showToast('Confirm billing before closing. The lesion stays on the board until then.');
            return;
        }
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
    let action = nextAction === 'plan_excision' ? 'further_management' : nextAction;
    const contact = extras.contact || 'mark_for_contact';
    const fileNoCall = !!extras.fileNoCall && action === 'no_followup';
    const proposedPlan = String(extras.proposedPlan || '').trim();
    const proposedPlanNote = String(extras.proposedPlanNote || '').trim();
    lesion.histologyResult = resultText;
    lesion.histologyAt = new Date().toISOString();
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
    lesion.resultPlan = action === 'further_management' || action === 'no_followup' ? action : (lesion.resultPlan || '');
    lesion.contactState = fileNoCall ? 'file_no_call' : contact;
    const advised = contact === 'advised_now' || fileNoCall;
    if (advised) lesion.resultAdvisedAt = new Date().toISOString();
    const planAfter = resultContactPlanLine(lesion.resultPlan, fileNoCall ? 'advised_now' : contact, { fileNoCall });
    const accession = typeof formatHistologyAccession === 'function' ? formatHistologyAccession(lesion, 'own') : '';
    const timelineNote = [extras.callNote || resultText, accession && ('Lab case ' + accession)].filter(Boolean).join(' · ');
    let timelineType = 'histology';
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
    const note = [extras.callNote ? resultText + ' · ' + extras.callNote : resultText, accession && ('Lab case ' + accession)].filter(Boolean).join(' · ');
    if (action === 'further_management') {
        if (!lesionHasSavedHistology(lesion)) {
            showToast('Save the histology result before opening further management.');
            return { lesion, needResult: true };
        }
        lesion.currentPlan = 'Further management — opening linked lesion';
        await saveManagedLesionRecord(lesion, 'histology', note);
        const child = await spawnFurtherManagementChild(lesion, {
            contact: fileNoCall ? 'mark_for_contact' : contact,
            advised,
            resultAdvisedAt: lesion.resultAdvisedAt || '',
            contactUrgent: !!lesion.contactUrgent,
            proposedPlan: proposedPlan || (nextAction === 'plan_excision' ? 'excision' : ''),
            proposedPlanNote
        });
        return {
            lesion,
            child,
            spawnedManagement: true,
            openExcision: !!(advised && (proposedPlan === 'excision' || nextAction === 'plan_excision')),
            openChildId: child?.id || ''
        };
    }
    if (advised && action === 'no_followup') {
        if (lesionCanCloseNoFollowup(lesion)) {
            await setManagedLesionStatus(id, 'no_followup', note, { currentPlan: 'No follow-up' });
            return { lesion, closed: true };
        }
        lesion.managementStatus = lesionLifecycleStatus(lesion) === 'appointment_requested'
            ? 'appointment_requested'
            : 'needs_contact';
        lesion.currentPlan = 'No follow-up — billing pending';
        await saveManagedLesionRecord(lesion, 'histology', note);
        return { lesion, billingHold: true };
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
            lesion.managementStatus = 'topical_followup';
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
        if (lesionCanCloseNoFollowup(lesion)) {
            await setManagedLesionStatus(lesion.id, 'no_followup', 'Patient advised', { currentPlan: 'No follow-up' });
            return { changed: true, closed: true };
        }
        lesion.currentPlan = 'No follow-up — billing pending';
        await saveManagedLesionRecord(lesion, 'comms:advised', 'Patient advised');
        return { changed: true, billingHold: true };
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
    const now = new Date().toISOString();
    const patient = typeof sessionPatientSnapshot === 'function' ? sessionPatientSnapshot() : {};
    child.createdAt = child.createdAt || now;
    child.updatedAt = now;
    child.type = 'excision';
    child.managementStatus = 'planned_procedure';
    child.consentStatus = '';
    child.consentedAt = '';
    child.procedureCompletedAt = '';
    child.excisionFinalisedAt = '';
    child.procedureDetail = null;
    child.billingStatus = 'none';
    child.schemaVersion = LESION_SCHEMA_VERSION;
    if (patient.chartId) child.chartId = patient.chartId;
    else if (!child.chartId && child.patientName && child.patientDob && typeof patientChartId === 'function') {
        child.chartId = patientChartId(child.patientName, child.patientDob);
    }
    if (patient.patientName) child.patientName = child.patientName || patient.patientName;
    if (patient.patientDob) child.patientDob = child.patientDob || patient.patientDob;
    if (patient.patientPhone) child.phone = child.phone || patient.patientPhone;
    if (patient.clinician) child.clinician = child.clinician || patient.clinician;
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
