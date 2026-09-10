/* Encrypted per-user lesion records and management-status transitions.
   Status = queue (lifecycle). Type = technique (shave / punch / excision / topical / none). */

const LESION_SCHEMA_VERSION = 2;

const LESION_TYPES = ['shave', 'punch', 'excision', 'topical', 'none'];

const LESION_STATUSES = {
    awaiting_assessment: 'Awaiting Assessment',
    planned_procedure: 'Planned Procedure',
    current_case: 'Current Case',
    awaiting_histology: 'Awaiting Histology',
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
    'topical_followup'
];

const LEGACY_STATUS_ALIASES = {
    planned_excision: 'planned_procedure',
    awaiting_biopsy: 'planned_procedure'
};

const TIMELINE_TYPES = ['call_attempt', 'voicemail', 'sms', 'spoke', 'result_advised', 'plan', 'procedure', 'abort', 'histology', 'consent'];
const CALL_OUTCOMES = ['no answer', 'voicemail', 'spoke', 'declined', 'booked'];

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

function lesionLifecycleStatus(lesion) {
    const status = canonicalLesionStatus(lesion?.managementStatus);
    if (status === 'awaiting_histology' && lesion && !lesionProcedureDone(lesion)) return 'planned_procedure';
    return status;
}

function isActiveManagementStatus(status) {
    return ACTIVE_MANAGEMENT_STATUSES.includes(canonicalLesionStatus(status));
}

function lesionProcedureDone(lesion) {
    return !!(lesion?.procedureCompletedAt || lesion?.excisionFinalisedAt);
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
    return lesionConsentRequirement(lesion) === 'written' ? 'Written consent needed' : 'Consent needed';
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
    if (status === 'awaiting_histology') return 'Awaiting histology';
    if (status === 'current_case') return 'In theatre now';
    if (status === 'planned_procedure') {
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
        || event.outcome === 'no answer' || event.outcome === 'voicemail' || event.outcome === 'declined';
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
    if (event.outcome === 'no answer' || event.type === 'call_attempt') return 'No answer';
    return event.outcome || event.type;
}

function lesionIemrCommsLine(lesion) {
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
    if (!lesion || (Number(lesion.schemaVersion) || 0) >= LESION_SCHEMA_VERSION) {
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
    lesion.schemaVersion = LESION_SCHEMA_VERSION;
    return { lesion, changed: true };
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

async function convertManagedLesionsToSchemaV2() {
    const needs = managedLesions.filter((item) => (Number(item.schemaVersion) || 0) < LESION_SCHEMA_VERSION);
    if (!needs.length) return 0;
    try {
        await backupUserLesionsDir(vaultAuth.username);
    } catch (err) {
        console.warn('Lesion backup failed; conversion skipped', err);
        showToast('Could not back up lesion files, so they were left unchanged. Connect the clinic folder with write access and sign in again.');
        return 0;
    }
    let converted = 0;
    for (const lesion of needs) {
        const { changed } = convertLesionRecordV2(lesion);
        if (!changed) continue;
        lesion.updatedAt = lesion.updatedAt || new Date().toISOString();
        await writeManagedLesion(lesion);
        converted += 1;
    }
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

function rememberLastPatient() {
    try {
        if (hasCurrentPatient()) {
            localStorage.setItem(lastChartStorageKey(), JSON.stringify({
                name: currentPatient.name,
                firstName: currentPatient.firstName || '',
                lastName: currentPatient.lastName || '',
                dob: currentPatient.dob,
                phone: currentPatient.phone || '',
                clinician: currentPatient.clinician || '',
                chartId: currentPatient.chartId || ''
            }));
        } else {
            localStorage.removeItem(lastChartStorageKey());
        }
    } catch (err) {
        /* Private mode may block storage. */
    }
}

function readLastPatient() {
    try {
        const raw = localStorage.getItem(lastChartStorageKey());
        if (!raw) return null;
        const saved = JSON.parse(raw);
        if (!saved?.name || !saved?.dob) return null;
        return saved;
    } catch (err) {
        return null;
    }
}

function restoreLastPatient() {
    const saved = readLastPatient();
    if (!saved) return false;
    setCurrentPatient(patientIdentityFromRecord(saved), { silentRestore: true });
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
        smsNormalResultsConsent = '';
        selectedChartLesionId = '';
        if (typeof resetProcedureSession === 'function') resetProcedureSession();
        if (typeof renderLesionsTable === 'function') renderLesionsTable();
        if (typeof renderPatientConcerns === 'function') renderPatientConcerns();
        if (typeof updateOutput === 'function') updateOutput();
        if (activeWorkspaceTab === 'skin-check' || activeWorkspaceTab === 'excision-generator') {
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
    shaveConsentVerified = false;
    pendingShaveConsentAction = '';
    lesions = [];
    patientConcerns = [];
    noPatientConcerns = false;
    screeningMarkedComplete = false;
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
            <span class="chart-search-hit-meta">${escapeHtml([patient.dob, patient.phone].filter(Boolean).join(' · ') || 'No DOB or phone on file')}</span>
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
    const other = resultsId === 'boardChartSearchResults' ? 'headerChartSearchResults' : 'boardChartSearchResults';
    const otherEl = document.getElementById(other);
    if (otherEl) {
        otherEl.classList.add('hidden');
        otherEl.innerHTML = '';
    }
    renderChartSearchResults(resultsId, input?.value || '');
}

function onChartSearchKeydown(event, resultsId) {
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
    if (!isVaultLoggedIn()) return;
    try {
        const dir = await getUserLesionsDir(vaultAuth.username, false);
        await dir.removeEntry(id + '.json.enc');
    } catch (err) {
        /* File may not exist yet. */
    }
}

async function loadManagedLesionsFromVault() {
    managedLesions = [];
    if (!isVaultLoggedIn()) return;
    const dir = await getUserLesionsDir(vaultAuth.username, true);
    for await (const [name, handle] of dir.entries()) {
        if (handle.kind !== 'file' || !name.endsWith('.json.enc')) continue;
        try {
            const text = await handle.getFile().then((f) => f.text());
            const lesion = await decryptJson(vaultAuth.key, JSON.parse(text));
            if (lesion && lesion.id) managedLesions.push(lesion);
        } catch (err) {
            console.warn('Skipped unreadable lesion file', name);
        }
    }
    managedLesions.sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));
    if (typeof convertManagedLesionsToSchemaV2 === 'function') {
        await convertManagedLesionsToSchemaV2();
    }
    if (typeof loadManagedChartsFromVault === 'function') {
        await loadManagedChartsFromVault();
    }
    if (typeof loadManagedVisitNotesFromVault === 'function') {
        await loadManagedVisitNotesFromVault();
    }
    if (typeof loadManagedConsentsFromVault === 'function') {
        await loadManagedConsentsFromVault();
    }
    if (typeof loadManagedBillingsFromVault === 'function') {
        await loadManagedBillingsFromVault();
    }
    if (typeof migrateEmbeddedBillingFromLesions === 'function') {
        await migrateEmbeddedBillingFromLesions();
    }
}

function upsertManagedLesionMemory(lesion) {
    const idx = managedLesions.findIndex((item) => item.id === lesion.id);
    if (idx === -1) managedLesions.unshift(lesion);
    else managedLesions[idx] = lesion;
}

async function persistSessionLesionToVault(sessionLesion) {
    if (!isVaultLoggedIn()) return null;
    const existing = managedLesions.find((item) => item.id === sessionLesion.id) || {};
    const priorConsent = lesionConsentStatus(existing);
    const now = new Date().toISOString();
    const patient = sessionPatientSnapshot();
    const merged = { ...existing, ...sessionLesion };
    const type = deriveLesionType(merged);
    const derivedStatus = deriveLesionStatusFromPlan({ ...merged, type });
    const completed = lesionProcedureDone(merged);
    let managementStatus;
    if (completed) {
        managementStatus = canonicalLesionStatus(existing.managementStatus) === 'awaiting_histology'
            || canonicalLesionStatus(sessionLesion.managementStatus) === 'awaiting_histology'
            ? 'awaiting_histology'
            : (canonicalLesionStatus(sessionLesion.managementStatus) || canonicalLesionStatus(existing.managementStatus) || 'awaiting_histology');
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
        ...patient,
        id: sessionLesion.id,
        createdAt: existing.createdAt || now,
        updatedAt: now,
        owner: vaultAuth.username,
        type,
        managementStatus,
        currentPlan: sessionLesion.currentPlan || existing.currentPlan || '',
        timeline: Array.isArray(sessionLesion.timeline) ? sessionLesion.timeline
            : (Array.isArray(existing.timeline) ? existing.timeline : []),
        schemaVersion: LESION_SCHEMA_VERSION,
        billingStatus: existing.billingStatus || 'none',
        history: existing.history || [],
        consentStatus: sessionLesion.consentStatus || existing.consentStatus || '',
        consentedAt: sessionLesion.consentedAt || existing.consentedAt || ''
    };
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
    await writeManagedLesion(next);
    upsertManagedLesionMemory(next);
    if (typeof offerLesionToProcedureSession === 'function') offerLesionToProcedureSession(next);
    renderManagedLesions();
    if (typeof renderChartSidebar === 'function') renderChartSidebar();
    return next;
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
    const lesion = managedLesions.find((item) => item.id === id);
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
    }
    if (nextStatus === 'planned_procedure' || nextStatus === 'no_followup') {
        if (lesionLifecycleStatus(lesion) === 'awaiting_histology' && typeof isLesionBillingProcessed === 'function' && !isLesionBillingProcessed(id)) {
            showToast('Process billing for this lesion before choosing management.');
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
    lesion.histologyResult = resultText;
    lesion.histologyAt = new Date().toISOString();
    if (billingType) lesion.billingLesionType = billingType;
    if (typeof histologyIndicatesMelanoma === 'function' && histologyIndicatesMelanoma(lesion)) {
        lesion.billingLesionType = 'confirmed_melanoma';
    } else if (typeof applyInferredBillingLesionType === 'function') {
        applyInferredBillingLesionType(lesion);
    }
    if (typeof suggestMbsItems === 'function' && typeof billingProcedureKind === 'function' && billingProcedureKind(lesion) === 'excision') {
        const suggestion = suggestMbsItems(lesion);
        if (suggestion.ready && suggestion.summary) lesion.suggestedMbsItems = suggestion.summary;
    }
    if (extras.advised) lesion.resultAdvisedAt = new Date().toISOString();
    const planAfter = nextAction === 'plan_excision'
        ? 'Excision planned'
        : (nextAction === 'no_followup' ? 'No follow-up' : 'Awaiting histology');
    appendLesionTimeline(lesion, {
        type: extras.advised ? 'result_advised' : 'histology',
        outcome: extras.advised ? 'spoke' : '',
        note: extras.callNote || resultText,
        planAfter
    });
    if (typeof syncBillingFromLesion === 'function') {
        await syncBillingFromLesion(lesion);
    }
    const note = extras.callNote ? resultText + ' · ' + extras.callNote : resultText;
    if (nextAction === 'plan_excision' || nextAction === 'no_followup') {
        if (nextAction === 'plan_excision') lesion.type = 'excision';
        await setManagedLesionStatus(id, nextAction === 'plan_excision' ? 'planned_procedure' : 'no_followup', note, {
            type: nextAction === 'plan_excision' ? 'excision' : lesion.type,
            currentPlan: planAfter
        });
        return;
    }
    if (lesionLifecycleStatus(lesion) !== 'awaiting_histology') {
        lesion.managementStatus = 'awaiting_histology';
    }
    lesion.currentPlan = planAfter;
    await saveManagedLesionRecord(lesion, 'histology', note);
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
