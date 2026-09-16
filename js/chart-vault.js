/* Encrypted patient charts: identity, screening history, and IEMR copy state. */

let applyingChartRecord = false;
let chartSaveTimer = null;

const CHART_SCREENING_FIELDS = [
    { id: 'hxPersonalMelanoma', type: 'checkbox' },
    { id: 'melanomaStage', type: 'value' },
    { id: 'melanomaTime', type: 'value' },
    { id: 'melanomaYoungAge', type: 'checkbox' },
    { id: 'hxPersonalNMSC', type: 'checkbox' },
    { id: 'hxFamilyMelanoma', type: 'checkbox' },
    { id: 'hxHighMoleCount', type: 'checkbox' },
    { id: 'algLocalAnaesthetic', type: 'checkbox' },
    { id: 'algAntiseptic', type: 'checkbox' },
    { id: 'algLatexDressings', type: 'checkbox' },
    { id: 'allergiesText', type: 'value' },
    { id: 'bldAspirin', type: 'checkbox' },
    { id: 'bldWarfarin', type: 'checkbox' },
    { id: 'bldDOAC', type: 'checkbox' },
    { id: 'bldHerbals', type: 'checkbox' },
    { id: 'medicationsText', type: 'value' },
    { id: 'diaPacemaker', type: 'checkbox' },
    { id: 'diaMetalwork', type: 'checkbox' },
    { id: 'diaCochlear', type: 'checkbox' },
    { id: 'heaSmoking', type: 'checkbox' },
    { id: 'heaDiabetes', type: 'checkbox' },
    { id: 'heaImmuno', type: 'checkbox' },
    { id: 'heaKeloid', type: 'checkbox' },
    { id: 'heaVasovagal', type: 'checkbox' },
    { id: 'pastHistoryText', type: 'value' }
];

function todayVisitKey() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + day;
}

function chartRecordFileName() {
    return typeof newOpaqueEncFileName === 'function'
        ? newOpaqueEncFileName('chart')
        : 'chart-' + Date.now() + '-' + Math.random().toString(16).slice(2) + '.json.enc';
}

function findManagedChart(chartId) {
    if (!chartId) return null;
    return managedCharts.find((item) => item.id === chartId) || null;
}

const UI_SESSION_FILE = 'ui-session.json.enc';
let loadedUiSession = { chartId: '' };
let uiSessionWriteChain = Promise.resolve();

function lastOpenChartId() {
    return String(loadedUiSession?.chartId || '').trim();
}

function findActiveVisitChart() {
    const charts = typeof managedCharts !== 'undefined' ? managedCharts : [];
    return charts.find((chart) => isVisitSessionActive(chart.visitSession)) || null;
}

async function writeUiSessionFile(chartId) {
    const id = String(chartId || '').trim();
    loadedUiSession = { v: 1, chartId: id, updatedAt: new Date().toISOString() };
    if (!isVaultLoggedIn()) return;
    const dir = await getUserDir(vaultAuth.username, true);
    if (!id) {
        if (typeof deleteTextFile === 'function') await deleteTextFile(dir, UI_SESSION_FILE);
        return;
    }
    const payload = await encryptJson(vaultAuth.key, {
        v: 1,
        chartId: id,
        updatedAt: loadedUiSession.updatedAt
    });
    await writeTextFile(dir, UI_SESSION_FILE, JSON.stringify(payload));
}

function persistUiSession(chartId) {
    const id = String(chartId || '').trim();
    loadedUiSession = { ...(loadedUiSession || {}), chartId: id };
    uiSessionWriteChain = uiSessionWriteChain
        .then(() => writeUiSessionFile(id), () => writeUiSessionFile(id));
    return uiSessionWriteChain;
}

async function loadUiSessionFromVault() {
    loadedUiSession = { chartId: '' };
    if (!isVaultLoggedIn()) return loadedUiSession;
    try {
        const dir = await getUserDir(vaultAuth.username, false);
        if (typeof recoverIncompleteVaultWrites === 'function') await recoverIncompleteVaultWrites(dir);
        const text = await readTextFile(dir, UI_SESSION_FILE);
        const data = await decryptJson(vaultAuth.key, JSON.parse(text));
        loadedUiSession = { chartId: String(data?.chartId || '').trim() };
    } catch (err) {
        loadedUiSession = { chartId: '' };
    }
    return loadedUiSession;
}

function patientContactForLesion(lesion) {
    const identity = typeof patientIdentityFromRecord === 'function'
        ? patientIdentityFromRecord(lesion || {})
        : {};
    const chartId = (typeof lesionChartId === 'function' ? lesionChartId(lesion) : '')
        || identity.chartId
        || lesion?.chartId
        || '';
    const chart = chartId ? findManagedChart(chartId) : null;
    let phone = String(identity.phone || lesion?.patientPhone || lesion?.phone || '').trim();
    if (!phone) phone = String(chart?.phone || '').trim();
    if (!phone && typeof hasCurrentPatient === 'function' && hasCurrentPatient()
        && currentPatient.chartId && chartId && currentPatient.chartId === chartId) {
        phone = String(currentPatient.phone || '').trim();
    }
    let sms = '';
    if (typeof normalizeSmsNormalResultsConsent === 'function') {
        if (chart) sms = normalizeSmsNormalResultsConsent(chart.smsNormalResultsConsent);
        else if (typeof hasCurrentPatient === 'function' && hasCurrentPatient()
            && currentPatient.chartId === chartId
            && typeof smsNormalResultsConsent !== 'undefined') {
            sms = normalizeSmsNormalResultsConsent(smsNormalResultsConsent);
        }
    }
    const smsLabel = typeof smsNormalResultsConsentLabelFor === 'function'
        ? smsNormalResultsConsentLabelFor(sms, { short: true })
        : '';
    return { phone, sms, smsLabel, chartId };
}

function currentManagedChart() {
    return hasCurrentPatient() ? findManagedChart(currentPatient.chartId) : null;
}

function screeningIsFilled(groups) {
    const g = groups || {};
    return ['canc', 'all', 'bld', 'dia', 'hea'].some((key) => g[key] === 'YES' || g[key] === 'NO');
}

function collectChartExamFromDom() {
    const scope = document.querySelector('input[name="scopeConsent"]:checked')?.value || '';
    return {
        scope,
        regionalArea: document.getElementById('regionalAreaInput')?.value || '',
        fitzpatrick: document.getElementById('fitzpatrick')?.value || '',
        lastSkinCheck: document.getElementById('lastSkinCheck')?.value || '',
        visitDate: todayVisitKey(),
        noPatientConcerns: !!noPatientConcerns,
        smsNormalResultsConsent: typeof smsNormalResultsConsent !== 'undefined' ? smsNormalResultsConsent : ''
    };
}

function collectVisitSessionFromDom() {
    const today = todayVisitKey();
    const tab = typeof activeWorkspaceTab !== 'undefined' ? activeWorkspaceTab : 'management';
    const consultType = (typeof visitConsultType !== 'undefined' && visitConsultType)
        || (typeof isBedSanitised !== 'undefined' && isBedSanitised ? 'face_to_face' : '');
    const prev = currentManagedChart()?.visitSession;
    const screeningAsked = !!(typeof screeningAskedThisConsult !== 'undefined' && screeningAskedThisConsult)
        || !!(prev?.visitDate === today && prev?.screeningAsked);
    return {
        visitDate: today,
    workspaceTab: (typeof isClinicalWorkspaceTab === 'function' ? isClinicalWorkspaceTab(tab) : (tab === 'skin-check' || tab === 'excision-generator')) ? tab : 'management',
        consultType,
        sanitised: consultType === 'face_to_face' || (typeof isBedSanitised !== 'undefined' ? !!isBedSanitised : false),
        patientConcerns: Array.isArray(patientConcerns) ? patientConcerns.slice() : [],
        visitLesionIds: (Array.isArray(lesions) ? lesions : []).map((item) => String(item.id)).filter(Boolean),
        screeningAsked,
        updatedAt: new Date().toISOString()
    };
}

function isVisitSessionActive(session) {
    if (!session) return false;
    const today = todayVisitKey();
    if (session.visitDate && session.visitDate !== today) return false;
    if (session.consultType) return true;
    if (session.sanitised) return true;
    if ((session.visitLesionIds || []).length) return true;
    if ((session.patientConcerns || []).length) return true;
    if (typeof isClinicalWorkspaceTab === 'function' ? isClinicalWorkspaceTab(session.workspaceTab) : (session.workspaceTab === 'skin-check' || session.workspaceTab === 'excision-generator')) return true;
    return false;
}

function hydrateVisitLesionsFromIds(ids) {
    const wanted = new Set((ids || []).map(String).filter(Boolean));
    if (!wanted.size || !hasCurrentPatient()) {
        lesions = [];
        return;
    }
    const chartId = currentPatient.chartId;
    const next = [];
    managedLesions.forEach((item) => {
        if (!wanted.has(String(item.id))) return;
        const row = { ...item };
        if (typeof lesionChartId === 'function' && lesionChartId(row) !== chartId) {
            row.chartId = chartId;
            if (currentPatient.name) row.patientName = row.patientName || currentPatient.name;
            if (currentPatient.dob) row.patientDob = row.patientDob || currentPatient.dob;
        }
        next.push(row);
    });
    lesions = next;
}

function restoreVisitSessionFromChart(chart) {
    const session = chart?.visitSession;
    if (!isVisitSessionActive(session)) return false;

    if (Array.isArray(session.patientConcerns)) {
        patientConcerns = session.patientConcerns.slice();
    }
    hydrateVisitLesionsFromIds(session.visitLesionIds);

    const consultType = session.consultType
        || (session.sanitised ? 'face_to_face' : '');
    if (typeof visitConsultType !== 'undefined') visitConsultType = consultType || '';
    if (typeof screeningAskedThisConsult !== 'undefined') {
        screeningAskedThisConsult = !!session.screeningAsked;
    }
    if (consultType === 'face_to_face' || session.sanitised) {
        isBedSanitised = true;
        pendingSanitise = false;
        if (typeof setModalBedSanitation === 'function') setModalBedSanitation(true);
    } else if (consultType === 'phone' || consultType === 'chart_review') {
        isBedSanitised = false;
        pendingSanitise = false;
        if (typeof setModalBedSanitation === 'function') setModalBedSanitation(false);
    }

    if (typeof renderPatientConcerns === 'function') renderPatientConcerns();
    if (typeof renderLesionsTable === 'function') renderLesionsTable();
    if (typeof renderChartSidebar === 'function') renderChartSidebar();
    if (typeof updateExamRequiredFields === 'function') updateExamRequiredFields();
    if (typeof updateChartChrome === 'function') updateChartChrome();
    return true;
}

async function clearStoredVisitSession() {
    const chart = currentManagedChart();
    if (chart) {
        chart.visitSession = null;
        await saveManagedChartRecord(chart);
    }
}

function examFromDomIsFilled(exam) {
    if (!exam) return false;
    return !!(exam.scope || exam.fitzpatrick || exam.lastSkinCheck || String(exam.regionalArea || '').trim() || exam.noPatientConcerns);
}

function collectChartScreeningFromDom() {
    const fields = {};
    CHART_SCREENING_FIELDS.forEach((field) => {
        const el = document.getElementById(field.id);
        if (!el) return;
        fields[field.id] = field.type === 'checkbox' ? !!el.checked : (el.value || '');
    });
    const groups = {
        canc: groupStates.canc || 'unset',
        all: groupStates.all || 'unset',
        bld: groupStates.bld || 'unset',
        dia: groupStates.dia || 'unset',
        hea: groupStates.hea || 'unset'
    };
    return {
        groups,
        fields,
        filled: screeningIsFilled(groups),
        completed: !!screeningMarkedComplete,
        visitDate: (screeningIsFilled(groups) || screeningMarkedComplete) ? todayVisitKey() : ''
    };
}

function screeningSnapshotHash(screening, exam) {
    return JSON.stringify({
        groups: screening?.groups || {},
        fields: screening?.fields || {},
        exam: exam || {}
    });
}

function emptyChartIemr() {
    return {
        screeningCopied: false,
        screeningCopiedAt: '',
        screeningHash: '',
        examCopied: false,
        examCopiedAt: '',
        examVisitDate: '',
        examHash: '',
        examFingerprint: ''
    };
}

function newChartRecord(patient) {
    const now = new Date().toISOString();
    const identity = typeof patientIdentityFromRecord === 'function'
        ? patientIdentityFromRecord(patient)
        : {
            name: String(patient?.name || '').trim(),
            firstName: String(patient?.firstName || '').trim(),
            lastName: String(patient?.lastName || '').trim(),
            dob: String(patient?.dob || '').trim(),
            phone: String(patient?.phone || '').trim(),
            clinician: String(patient?.clinician || '').trim(),
            chartId: patient?.chartId
        };
    const id = identity.chartId || patientChartId(identity.name, identity.dob);
    return {
        id,
        name: identity.name,
        firstName: identity.firstName,
        lastName: identity.lastName,
        dob: identity.dob,
        phone: identity.phone,
        clinician: identity.clinician,
        createdAt: now,
        updatedAt: now,
        screening: { groups: { canc: 'unset', all: 'unset', bld: 'unset', dia: 'unset', hea: 'unset' }, fields: {}, filled: false, completed: false, collectedAt: '', visitDate: '' },
        exam: { scope: '', regionalArea: '', fitzpatrick: '', lastSkinCheck: '' },
        aftercare: { given: false, givenAt: '', visitDate: '', topics: [] },
        akComparison: { explained: false, explainedAt: '', visitDate: '', optionIds: [] },
        consultBilling: (typeof normalizeConsultBilling === 'function'
            ? normalizeConsultBilling(patient?.consultBilling)
            : (patient?.consultBilling || 'Private Bill')),
        biopsyBilling: (typeof normalizeBiopsyBilling === 'function'
            ? normalizeBiopsyBilling(patient?.biopsyBilling)
            : (patient?.biopsyBilling || '$20 OOP per biopsy (Item 30071)')),
        smsNormalResultsConsent: typeof normalizeSmsNormalResultsConsent === 'function'
            ? normalizeSmsNormalResultsConsent(patient?.smsNormalResultsConsent)
            : '',
        iemr: emptyChartIemr(),
        procedureSession: null,
        visitSession: null,
        scratchpadIdleSince: '',
        owner: (typeof vaultAuth !== 'undefined' && vaultAuth.username) || '',
        fileName: chartRecordFileName()
    };
}

function upsertManagedChartMemory(chart) {
    const idx = managedCharts.findIndex((item) => item.id === chart.id);
    if (idx === -1) managedCharts.unshift(chart);
    else managedCharts[idx] = chart;
}

async function writeManagedChart(chart) {
    if (!isVaultLoggedIn() || !chart?.id) return;
    const dir = await getUserChartsDir(vaultAuth.username, true);
    await writeOpaqueEncryptedJson(dir, chart, 'chart', vaultAuth.key);
}

async function saveManagedChartRecord(chart) {
    chart.updatedAt = new Date().toISOString();
    upsertManagedChartMemory(chart);
    if (isVaultLoggedIn()) await writeManagedChart(chart);
}

async function loadManagedChartsFromVault() {
    managedCharts = [];
    if (!isVaultLoggedIn()) return;
    const dir = await getUserChartsDir(vaultAuth.username, true);
    if (typeof recoverIncompleteVaultWrites === 'function') await recoverIncompleteVaultWrites(dir);
    for await (const [name, handle] of dir.entries()) {
        if (handle.kind !== 'file' || !name.endsWith('.json.enc')) continue;
        try {
            const text = await handle.getFile().then((f) => f.text());
            const chart = await decryptJson(vaultAuth.key, JSON.parse(text));
            if (chart && chart.id) {
                chart.fileName = name;
                if (!chart.iemr) chart.iemr = emptyChartIemr();
                if (!chart.screening) chart.screening = { groups: {}, fields: {}, filled: false };
                if (!chart.exam) chart.exam = {};
                if (!chart.aftercare) chart.aftercare = { given: false, givenAt: '', visitDate: '', topics: [] };
                if (!chart.akComparison) chart.akComparison = { explained: false, explainedAt: '', visitDate: '', optionIds: [] };
                if (!chart.consultBilling) {
                    chart.consultBilling = typeof normalizeConsultBilling === 'function'
                        ? normalizeConsultBilling('')
                        : 'Private Bill';
                }
                if (!chart.biopsyBilling) {
                    chart.biopsyBilling = typeof normalizeBiopsyBilling === 'function'
                        ? normalizeBiopsyBilling('')
                        : '$20 OOP per biopsy (Item 30071)';
                }
                if (!chart.smsNormalResultsConsent) chart.smsNormalResultsConsent = '';
                managedCharts.push(chart);
            }
        } catch (err) {
            console.warn('Skipped unreadable chart file', name);
        }
        if (typeof vaultLoadTickFile === 'function') vaultLoadTickFile();
    }
    managedCharts.sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'en', { sensitivity: 'base' }));
    if (typeof dedupeVaultRecordsById === 'function') {
        managedCharts = await dedupeVaultRecordsById(managedCharts, 'chart', dir);
        managedCharts.sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'en', { sensitivity: 'base' }));
    }
}

const CHART_IDLE_TTL_MS = 14 * 24 * 60 * 60 * 1000;
let pruningIdleCharts = false;

function parseTimestampMs(iso) {
    const t = Date.parse(iso || '');
    return Number.isNaN(t) ? 0 : t;
}

function billingKeepsScratchpad(bill) {
    if (!bill) return false;
    return bill.status !== 'processed';
}

function lesionKeepsScratchpad(lesion) {
    if (!lesion) return false;
    const status = typeof canonicalLesionStatus === 'function'
        ? canonicalLesionStatus(typeof lesionLifecycleStatus === 'function'
            ? lesionLifecycleStatus(lesion)
            : lesion.managementStatus)
        : lesion.managementStatus;
    if (status !== 'no_followup') return true;
    if (typeof lesionCanCloseNoFollowup === 'function' && !lesionCanCloseNoFollowup(lesion)) return true;
    return false;
}

function chartHasLiveWorkspace(chart, chartId) {
    if (chart) {
        if (isVisitSessionActive(chart.visitSession)) return true;
        if (typeof isStoredProcedureSessionActive === 'function'
            && isStoredProcedureSessionActive(chart.procedureSession)) return true;
    }
    const id = chart?.id || chartId;
    if (typeof hasCurrentPatient === 'function' && hasCurrentPatient() && currentPatient.chartId === id) {
        if (typeof isBedSanitised !== 'undefined' && isBedSanitised) return true;
        if (typeof procedureSession !== 'undefined' && procedureSession.started && !procedureSession.completedAt) return true;
        if (typeof lesions !== 'undefined' && lesions.length) return true;
        if (typeof patientConcerns !== 'undefined' && patientConcerns.length) return true;
        if (typeof isClinicalWorkspaceTab === 'function'
            ? isClinicalWorkspaceTab(activeWorkspaceTab)
            : (activeWorkspaceTab === 'skin-check' || activeWorkspaceTab === 'excision-generator')) return true;
        if (typeof screeningMarkedComplete !== 'undefined' && screeningMarkedComplete) return true;
        if (typeof groupStates !== 'undefined'
            && ['canc', 'all', 'bld', 'dia', 'hea'].some((key) => groupStates[key] === 'YES' || groupStates[key] === 'NO')) {
            return true;
        }
    }
    return false;
}

function scratchpadChartBundle(chartId) {
    const id = String(chartId || '');
    const chart = id && typeof findManagedChart === 'function' ? findManagedChart(id) : null;
    const lesions = (typeof managedLesions !== 'undefined' ? managedLesions : []).filter((item) => {
        const itemId = typeof lesionChartId === 'function' ? lesionChartId(item) : item.chartId;
        return itemId && itemId === id;
    });
    const lesionIds = new Set(lesions.map((item) => String(item.id)));
    const bills = (typeof managedBillings !== 'undefined' ? managedBillings : []).filter((bill) => {
        if (bill.chartId && bill.chartId === id) return true;
        return lesionIds.has(String(bill.lesionId || ''));
    });
    return { chart, lesions, bills };
}

function collectScratchpadChartIds() {
    const ids = new Set();
    (typeof managedCharts !== 'undefined' ? managedCharts : []).forEach((chart) => {
        if (chart?.id) ids.add(chart.id);
    });
    (typeof managedLesions !== 'undefined' ? managedLesions : []).forEach((lesion) => {
        const id = typeof lesionChartId === 'function' ? lesionChartId(lesion) : lesion.chartId;
        if (id) ids.add(id);
    });
    (typeof managedBillings !== 'undefined' ? managedBillings : []).forEach((bill) => {
        if (bill.chartId) ids.add(bill.chartId);
    });
    (typeof managedVisitNotes !== 'undefined' ? managedVisitNotes : []).forEach((note) => {
        if (note.chartId) ids.add(note.chartId);
    });
    (typeof managedConsents !== 'undefined' ? managedConsents : []).forEach((doc) => {
        if (doc.chartId) ids.add(doc.chartId);
    });
    return [...ids];
}

function scratchpadChartIsActive(chartId, options) {
    options = options || {};
    const { chart, lesions, bills } = scratchpadChartBundle(chartId);
    if (!options.ignoreWorkspace && chartHasLiveWorkspace(chart, chartId)) return true;
    if (options.ignoreWorkspace && chart) {
        if (isVisitSessionActive(chart.visitSession)) return true;
        if (typeof isStoredProcedureSessionActive === 'function'
            && isStoredProcedureSessionActive(chart.procedureSession)) return true;
    }
    if (lesions.some(lesionKeepsScratchpad)) return true;
    if (bills.some(billingKeepsScratchpad)) return true;
    return false;
}

function computeScratchpadIdleSinceMs(chartId) {
    const { chart, lesions, bills } = scratchpadChartBundle(chartId);
    let latest = 0;
    const bump = (iso) => {
        latest = Math.max(latest, parseTimestampMs(iso));
    };
    lesions.forEach((lesion) => {
        bump(lesion.updatedAt);
        bump(lesion.billingProcessedAt);
        bump(lesion.resultAdvisedAt);
        bump(lesion.histologyAt);
        bump(lesion.procedureCompletedAt);
        bump(lesion.excisionFinalisedAt);
    });
    bills.forEach((bill) => {
        bump(bill.processedAt);
        bump(bill.confirmedAt);
        bump(bill.updatedAt);
    });
    if (chart) {
        bump(chart.createdAt);
        bump(chart.iemr?.examCopiedAt);
        bump(chart.visitSession?.updatedAt);
        bump(chart.procedureSession?.completedAt);
    }
    return latest;
}

function scratchpadIdleSinceMs(chartId) {
    const { chart } = scratchpadChartBundle(chartId);
    const stamped = parseTimestampMs(chart?.scratchpadIdleSince);
    if (stamped) return stamped;
    return computeScratchpadIdleSinceMs(chartId);
}

function scratchpadExpiresAtIso(chartId) {
    if (scratchpadChartIsActive(chartId)) return '';
    const start = scratchpadIdleSinceMs(chartId);
    if (!start) return '';
    return new Date(start + CHART_IDLE_TTL_MS).toISOString();
}

function scratchpadChartIsExpired(chartId) {
    if (!chartId) return false;
    if (scratchpadChartIsActive(chartId)) return false;
    if (typeof hasCurrentPatient === 'function' && hasCurrentPatient() && currentPatient.chartId === chartId) {
        return false;
    }
    const { chart, lesions, bills } = scratchpadChartBundle(chartId);
    if (!chart && !lesions.length && !bills.length) return false;
    const iso = scratchpadExpiresAtIso(chartId);
    if (!iso) return false;
    return Date.parse(iso) <= Date.now();
}

function formatScratchpadExpiry(chartId) {
    const id = chartId || (typeof hasCurrentPatient === 'function' && hasCurrentPatient() ? currentPatient.chartId : '');
    if (!id || scratchpadChartIsActive(id)) return '';
    const { chart, lesions, bills } = scratchpadChartBundle(id);
    if (!chart?.scratchpadIdleSince && !lesions.length && !bills.length) return '';
    const iso = scratchpadExpiresAtIso(id);
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return 'Deletes ' + d.toLocaleDateString('en-AU', { day: '2-digit', month: 'short' });
}

function syncScratchpadIdleStamp(chart, options) {
    options = options || {};
    if (!chart?.id) return;
    if (scratchpadChartIsActive(chart.id, { ignoreWorkspace: !!options.ignoreWorkspace })) {
        chart.scratchpadIdleSince = '';
        return;
    }
    if (chart.scratchpadIdleSince && !options.refresh) return;
    const computed = computeScratchpadIdleSinceMs(chart.id);
    const ms = Math.max(computed || 0, options.refresh ? Date.now() : 0) || computed || Date.now();
    chart.scratchpadIdleSince = new Date(ms).toISOString();
}

async function deleteManagedChartFile(chart) {
    if (!isVaultLoggedIn() || !chart) return false;
    if (!chart.fileName) return true;
    const dir = await getUserChartsDir(vaultAuth.username, true);
    return await deleteTextFile(dir, chart.fileName);
}

function abandonOpenChartAfterPurge() {
    applyingChartRecord = true;
    try {
        if (typeof closeFinaliseVisitModal === 'function') closeFinaliseVisitModal();
        if (typeof resetProcedureSession === 'function') resetProcedureSession();
        if (typeof resetScreeningAndExamForm === 'function') resetScreeningAndExamForm();
        currentPatient = { name: '', firstName: '', lastName: '', dob: '', phone: '', clinician: '', chartId: '' };
        pendingWorkspaceTab = '';
        pendingSanitise = false;
        if (typeof visitConsultType !== 'undefined') visitConsultType = '';
        if (typeof isBedSanitised !== 'undefined') isBedSanitised = false;
        if (typeof lesions !== 'undefined') lesions = [];
        if (typeof patientConcerns !== 'undefined') patientConcerns = [];
        if (typeof noPatientConcerns !== 'undefined') noPatientConcerns = false;
        if (typeof screeningMarkedComplete !== 'undefined') screeningMarkedComplete = false;
        if (typeof screeningAskedThisConsult !== 'undefined') screeningAskedThisConsult = false;
        if (typeof smsNormalResultsConsent !== 'undefined') smsNormalResultsConsent = '';
        if (typeof selectedChartLesionId !== 'undefined') selectedChartLesionId = '';
        if (typeof currentManagedCaseId !== 'undefined') currentManagedCaseId = null;
        if (typeof updateHeaderPatient === 'function') updateHeaderPatient();
        if (typeof switchWorkspaceTab === 'function') switchWorkspaceTab('management');
    } finally {
        applyingChartRecord = false;
    }
}

async function purgeScratchpadChartId(chartId) {
    const id = String(chartId || '');
    if (!id) return false;
    const bundle = scratchpadChartBundle(id);
    const chart = bundle.chart;
    const chartLesions = bundle.lesions;
    const chartBills = bundle.bills;
    let failed = 0;

    const deletedLesionIds = new Set();
    for (const lesion of chartLesions) {
        const ok = typeof deleteManagedLesionFile === 'function'
            ? await deleteManagedLesionFile(lesion.id)
            : false;
        if (ok) deletedLesionIds.add(String(lesion.id));
        else failed += 1;
    }
    if (typeof managedLesions !== 'undefined') {
        managedLesions = managedLesions.filter((item) => {
            const itemId = typeof lesionChartId === 'function' ? lesionChartId(item) : item.chartId;
            if (itemId !== id) return true;
            return !deletedLesionIds.has(String(item.id));
        });
    }
    if (typeof lesions !== 'undefined') {
        lesions = lesions.filter((item) => {
            const itemId = typeof lesionChartId === 'function' ? lesionChartId(item) : item.chartId;
            if (itemId !== id) return true;
            return !deletedLesionIds.has(String(item.id));
        });
    }

    const deletedBillIds = new Set();
    for (const bill of chartBills) {
        const ok = typeof deleteManagedBillingFile === 'function'
            ? await deleteManagedBillingFile(bill)
            : false;
        if (ok) deletedBillIds.add(String(bill.id));
        else failed += 1;
    }
    if (typeof managedBillings !== 'undefined') {
        managedBillings = managedBillings.filter((bill) => !deletedBillIds.has(String(bill.id)));
    }

    let chartGone = !chart;
    if (chart) {
        chartGone = await deleteManagedChartFile(chart);
        if (chartGone) {
            managedCharts = managedCharts.filter((item) => item.id !== id);
        } else {
            failed += 1;
        }
    }

    if (failed) {
        if (typeof toastVaultDeleteFailure === 'function') toastVaultDeleteFailure('charts');
        return false;
    }

    if (typeof currentManagedCaseId !== 'undefined' && currentManagedCaseId
        && !(typeof managedLesions !== 'undefined' ? managedLesions : []).some((item) => String(item.id) === String(currentManagedCaseId))) {
        currentManagedCaseId = null;
    }

    if (typeof lastOpenChartId === 'function' && lastOpenChartId() === id && typeof persistUiSession === 'function') {
        try { await persistUiSession(''); } catch (err) { /* pointer is best-effort */ }
    }

    if (typeof hasCurrentPatient === 'function' && hasCurrentPatient() && currentPatient.chartId === id) {
        abandonOpenChartAfterPurge();
    }
    return true;
}

async function ensureScratchpadIdleStamps() {
    const charts = typeof managedCharts !== 'undefined' ? managedCharts.slice() : [];
    for (const chart of charts) {
        if (!chart?.id) continue;
        if (scratchpadChartIsActive(chart.id)) {
            if (chart.scratchpadIdleSince) {
                chart.scratchpadIdleSince = '';
                try { await saveManagedChartRecord(chart); } catch (err) { /* in-memory clear still applies */ }
            }
            continue;
        }
        if (chart.scratchpadIdleSince) continue;
        const ms = computeScratchpadIdleSinceMs(chart.id) || Date.now();
        chart.scratchpadIdleSince = new Date(ms).toISOString();
        if (ms + CHART_IDLE_TTL_MS > Date.now()) {
            try { await saveManagedChartRecord(chart); } catch (err) { /* prune can still use the in-memory stamp */ }
        }
    }
}

async function pruneExpiredIdleCharts() {
    if (pruningIdleCharts || !isVaultLoggedIn()) return 0;
    pruningIdleCharts = true;
    let removed = 0;
    let failed = 0;
    try {
        await ensureScratchpadIdleStamps();
        const expired = collectScratchpadChartIds().filter((id) => scratchpadChartIsExpired(id));
        for (const id of expired) {
            try {
                if (await purgeScratchpadChartId(id)) removed += 1;
                else failed += 1;
            } catch (err) {
                failed += 1;
                console.warn('Could not purge idle chart', id, err);
            }
        }
        if (removed && typeof showToast === 'function') {
            showToast(removed === 1
                ? 'Removed 1 finished chart after 14 days.'
                : 'Removed ' + removed + ' finished charts after 14 days.');
        }
        return removed;
    } finally {
        pruningIdleCharts = false;
    }
}

async function ensureChartRecord(patient) {
    const source = patient || currentPatient;
    const id = source?.chartId || patientChartId(source?.name, source?.dob);
    if (!id) return null;
    let chart = findManagedChart(id);
    if (!chart) {
        chart = newChartRecord({ ...source, chartId: id });
        await saveManagedChartRecord(chart);
    } else {
        let changed = false;
        if (source?.clinician && !chart.clinician) {
            chart.clinician = source.clinician;
            changed = true;
        }
        if (source?.phone && !chart.phone) {
            chart.phone = source.phone;
            changed = true;
        }
        if (source?.firstName && !chart.firstName) {
            chart.firstName = source.firstName;
            changed = true;
        }
        if (source?.lastName && !chart.lastName) {
            chart.lastName = source.lastName;
            changed = true;
        }
        if (source?.consultBilling && !chart.consultBilling) {
            chart.consultBilling = typeof normalizeConsultBilling === 'function'
                ? normalizeConsultBilling(source.consultBilling)
                : source.consultBilling;
            changed = true;
        }
        if (source?.biopsyBilling && !chart.biopsyBilling) {
            chart.biopsyBilling = typeof normalizeBiopsyBilling === 'function'
                ? normalizeBiopsyBilling(source.biopsyBilling)
                : source.biopsyBilling;
            changed = true;
        }
        if (changed) await saveManagedChartRecord(chart);
    }
    return chart;
}

function applyChartExamToDom(exam) {
    const sameVisit = !!(exam && exam.visitDate && exam.visitDate === todayVisitKey());
    const radios = document.querySelectorAll('input[name="scopeConsent"]');
    radios.forEach((radio) => {
        radio.checked = sameVisit && exam.scope ? radio.value === exam.scope : false;
    });
    const fitz = document.getElementById('fitzpatrick');
    if (fitz) fitz.value = sameVisit && exam.fitzpatrick ? exam.fitzpatrick : '';
    const last = document.getElementById('lastSkinCheck');
    if (last) last.value = sameVisit && exam.lastSkinCheck ? exam.lastSkinCheck : '';
    const region = document.getElementById('regionalAreaInput');
    if (region) region.value = sameVisit ? (exam.regionalArea || '') : '';
    if (typeof handleScopeChange === 'function') handleScopeChange();
    else if (typeof updateExamRequiredFields === 'function') updateExamRequiredFields();
    if (typeof applyNoPatientConcerns === 'function') applyNoPatientConcerns(!!(sameVisit && exam.noPatientConcerns));
}

function applyChartScreeningToDom(screening) {
    const sameVisit = !!(screening && screening.visitDate && screening.visitDate === todayVisitKey());
    const groups = sameVisit ? (screening.groups || {}) : {};
    ['canc', 'all', 'bld', 'dia', 'hea'].forEach((key) => {
        const state = sameVisit ? (groups[key] || 'unset') : 'unset';
        if (typeof setGroupState === 'function') setGroupState(key, state);
        else groupStates[key] = state;
    });
    const fields = sameVisit ? (screening.fields || {}) : {};
    CHART_SCREENING_FIELDS.forEach((field) => {
        const el = document.getElementById(field.id);
        if (!el) return;
        if (field.type === 'checkbox') el.checked = sameVisit && !!fields[field.id];
        else el.value = sameVisit && fields[field.id] != null ? fields[field.id] : '';
    });
    screeningMarkedComplete = !!(sameVisit && screening.completed);
    if (typeof toggleMelanomaSubFields === 'function') toggleMelanomaSubFields();
    if (typeof recalculateRecall === 'function') recalculateRecall();
    if (typeof updateScreeningCompleteButton === 'function') updateScreeningCompleteButton();
    if (typeof updateExamSectionHeaders === 'function') updateExamSectionHeaders();
}

function resetScreeningAndExamForm() {
    applyingChartRecord = true;
    try {
        ['canc', 'all', 'bld', 'dia', 'hea'].forEach((key) => {
            if (typeof setGroupState === 'function') setGroupState(key, 'unset');
            else groupStates[key] = 'unset';
        });
        CHART_SCREENING_FIELDS.forEach((field) => {
            const el = document.getElementById(field.id);
            if (!el) return;
            if (field.type === 'checkbox') el.checked = false;
            else el.value = '';
        });
        const radios = document.querySelectorAll('input[name="scopeConsent"]');
        radios.forEach((radio) => { radio.checked = false; });
        const region = document.getElementById('regionalAreaInput');
        if (region) region.value = '';
        const fitz = document.getElementById('fitzpatrick');
        if (fitz) fitz.value = '';
        const last = document.getElementById('lastSkinCheck');
        if (last) last.value = '';
        if (typeof handleScopeChange === 'function') handleScopeChange();
        else if (typeof updateExamRequiredFields === 'function') updateExamRequiredFields();
        if (typeof toggleMelanomaSubFields === 'function') toggleMelanomaSubFields();
        if (typeof recalculateRecall === 'function') recalculateRecall();
        Object.keys(outputCopyState).forEach((key) => {
            outputCopyState[key].copied = false;
            outputCopyState[key].lastCopiedText = '';
        });
        if (typeof emptyAftercareRecord === 'function') aftercarePaperwork = emptyAftercareRecord();
        if (typeof emptyAkComparisonRecord === 'function') {
            akComparisonRecord = emptyAkComparisonRecord();
            if (typeof updateAkComparisonControls === 'function') updateAkComparisonControls();
        }
        if (typeof applyPatientBillingToDom === 'function') {
            applyPatientBillingToDom({
                consultBilling: typeof DEFAULT_CONSULT_BILLING !== 'undefined' ? DEFAULT_CONSULT_BILLING : 'Private Bill',
                biopsyBilling: typeof DEFAULT_BIOPSY_BILLING !== 'undefined' ? DEFAULT_BIOPSY_BILLING : '$20 OOP per biopsy (Item 30071)'
            });
        }
        if (typeof applySmsNormalResultsConsent === 'function') applySmsNormalResultsConsent('');
        examMetadataWasComplete = false;
        screeningMarkedComplete = false;
        if (typeof screeningAskedThisConsult !== 'undefined') screeningAskedThisConsult = false;
        if (typeof applyNoPatientConcerns === 'function') applyNoPatientConcerns(false);
        if (typeof updateScreeningCompleteButton === 'function') updateScreeningCompleteButton();
        if (typeof collapseAllAccordions === 'function') collapseAllAccordions();
    } finally {
        applyingChartRecord = false;
    }
}

function applyCurrentChartToForms() {
    const chart = currentManagedChart();
    applyingChartRecord = true;
    try {
        if (!chart) {
            resetScreeningAndExamForm();
            return;
        }
        applyChartExamToDom(chart.exam);
        applyChartScreeningToDom(chart.screening);
        if (typeof applyChartAftercare === 'function') applyChartAftercare(chart.aftercare);
        if (typeof applyChartAkComparison === 'function') applyChartAkComparison(chart.akComparison);
        if (typeof applyPatientBillingToDom === 'function') {
            applyPatientBillingToDom({
                consultBilling: chart.consultBilling,
                biopsyBilling: chart.biopsyBilling
            });
        }
        if (typeof applySmsNormalResultsConsent === 'function') {
            applySmsNormalResultsConsent(chart.smsNormalResultsConsent);
        }
        if (typeof updateExamRequiredFields === 'function') updateExamRequiredFields();
        refreshExamCopyStateFromChart(chart);
    } finally {
        applyingChartRecord = false;
    }
    if (typeof collapseAllAccordions === 'function') collapseAllAccordions();
    if (typeof updateOutput === 'function') updateOutput();
    if (typeof updateChartChrome === 'function') updateChartChrome();
}

function refreshExamCopyStateFromChart(chart) {
    const record = chart || currentManagedChart();
    if (record?.iemr?.examCopied && record.iemr.examVisitDate === todayVisitKey() && record.iemr.examFingerprint === examVisitFingerprint()) {
        outputCopyState.emr.copied = true;
        if (!outputCopyState.emr.lastCopiedText) {
            outputCopyState.emr.lastCopiedText = document.getElementById('emrNoteTextContainer')?.value || '';
        }
    } else {
        outputCopyState.emr.copied = false;
        outputCopyState.emr.lastCopiedText = '';
    }
}

async function saveCurrentChartFromDom(options) {
    if (!hasCurrentPatient()) return null;
    const chart = await ensureChartRecord(currentPatient);
    if (!chart) return null;
    const screening = collectChartScreeningFromDom();
    const exam = collectChartExamFromDom();
    if (screening.filled) screening.collectedAt = new Date().toISOString();
    else screening.collectedAt = chart.screening?.collectedAt || '';
    chart.name = currentPatient.name;
    chart.firstName = currentPatient.firstName || chart.firstName || '';
    chart.lastName = currentPatient.lastName || chart.lastName || '';
    chart.dob = currentPatient.dob;
    chart.phone = currentPatient.phone || chart.phone || '';
    chart.clinician = (typeof loggedInDoctorName === 'function' && loggedInDoctorName()) || currentPatient.clinician || chart.clinician || '';
    const previousScreening = chart.screening || {};
    if (screening.filled || screening.completed || previousScreening.visitDate === todayVisitKey()) {
        chart.screening = screening;
    }
    const previousExam = chart.exam || {};
    if (examFromDomIsFilled(exam) || previousExam.visitDate === todayVisitKey()) {
        chart.exam = exam;
    }
    const collectedAftercare = typeof collectChartAftercare === 'function' ? collectChartAftercare() : null;
    const previousAftercare = chart.aftercare || {};
    if (collectedAftercare?.given || previousAftercare.visitDate === todayVisitKey()) {
        chart.aftercare = collectedAftercare || previousAftercare;
    }
    const collectedAkComparison = typeof collectChartAkComparison === 'function' ? collectChartAkComparison() : null;
    const previousAkComparison = chart.akComparison || {};
    if (collectedAkComparison?.explained || previousAkComparison.visitDate === todayVisitKey()) {
        chart.akComparison = collectedAkComparison || previousAkComparison;
    }
    if (typeof normalizeConsultBilling === 'function') {
        chart.consultBilling = normalizeConsultBilling(
            document.getElementById('modalConsultBilling')?.value || chart.consultBilling
        );
    }
    if (typeof normalizeBiopsyBilling === 'function') {
        chart.biopsyBilling = normalizeBiopsyBilling(
            document.getElementById('modalBiopsyBilling')?.value || chart.biopsyBilling
        );
    }
    if (typeof normalizeSmsNormalResultsConsent === 'function') {
        chart.smsNormalResultsConsent = normalizeSmsNormalResultsConsent(smsNormalResultsConsent);
    } else if (typeof smsNormalResultsConsent !== 'undefined') {
        chart.smsNormalResultsConsent = smsNormalResultsConsent || chart.smsNormalResultsConsent || '';
    }
    if (typeof snapshotProcedureSession === 'function') {
        const snap = snapshotProcedureSession();
        chart.procedureSession = (typeof isStoredProcedureSessionActive === 'function' && isStoredProcedureSessionActive(snap))
            ? snap
            : null;
    }
    if (options?.endVisit) {
        chart.visitSession = null;
        chart.procedureSession = null;
    } else {
        const visitSnap = collectVisitSessionFromDom();
        if (isVisitSessionActive(visitSnap)
            || examFromDomIsFilled(exam)
            || screening.filled
            || screening.completed
            || (typeof isStoredProcedureSessionActive === 'function' && isStoredProcedureSessionActive(chart.procedureSession))) {
            chart.visitSession = visitSnap;
        } else if (chart.visitSession?.visitDate === todayVisitKey()) {
            chart.visitSession = visitSnap;
        }
    }
    if (typeof syncScratchpadIdleStamp === 'function') {
        syncScratchpadIdleStamp(chart, {
            refresh: !!options?.endVisit,
            ignoreWorkspace: !!options?.endVisit
        });
    }
    await saveManagedChartRecord(chart);
    if (typeof updateChartChrome === 'function') updateChartChrome();
    return chart;
}

function scheduleChartSave() {
    if (applyingChartRecord || !hasCurrentPatient()) return;
    clearTimeout(chartSaveTimer);
    chartSaveTimer = setTimeout(() => {
        saveCurrentChartFromDom().catch((err) => {
            console.warn('Could not save patient chart', err);
            if (typeof toastVaultWriteError === 'function') {
                toastVaultWriteError('Chart could not be saved to the clinic folder. Check folder access.');
            } else if (typeof showToast === 'function') {
                showToast('Chart could not be saved to the clinic folder. Check folder access.');
            }
        });
    }, 700);
}

function chartScreeningAlreadyCopied(chart) {
    if (!chart?.iemr?.screeningCopied) return false;
    const hash = screeningSnapshotHash(collectChartScreeningFromDom(), collectChartExamFromDom());
    return !!chart.iemr.screeningHash && chart.iemr.screeningHash === hash;
}

function examVisitFingerprint() {
    const noteLesions = typeof visitNoteLesions === 'function' ? visitNoteLesions() : (lesions || []);
    return JSON.stringify({
        lesions: (noteLesions || []).map((item) => ({
            id: item.id,
            location: item.location,
            impression: item.impression,
            plan: item.plan,
            macroscopic: item.macroscopic,
            dermoscopy: item.dermoscopy
        })),
        concerns: patientConcerns || [],
        procedureStarted: !!(procedureSession && procedureSession.started),
        exam: collectChartExamFromDom()
    });
}

function chartExamAlreadyCopiedToday(chart) {
    const record = chart || currentManagedChart();
    return !!(record?.iemr?.examCopied && record.iemr.examVisitDate === todayVisitKey());
}

function chartExamCopyIsCurrent(chart) {
    const record = chart || currentManagedChart();
    if (!chartExamAlreadyCopiedToday(record)) return false;
    return !!record.iemr.examFingerprint && record.iemr.examFingerprint === examVisitFingerprint();
}

function screeningAskedThisVisit() {
    if (typeof screeningAskedThisConsult !== 'undefined' && screeningAskedThisConsult) return true;
    const session = typeof currentManagedChart === 'function' ? currentManagedChart()?.visitSession : null;
    return !!(session && isVisitSessionActive(session) && session.screeningAsked);
}

function generateScreeningEmrSection(options) {
    // Only document screening in IEMR when completed in this consult session.
    // Prior answers stay on the chart for consent/recall, but are not repeated every note.
    if (!screeningAskedThisVisit()) return '';

    let hasAnyScreening = false;
    let screeningTxt = `=== PRE-PROCEDURAL CLINICAL RISK SCREENING ===\n\n`;

    if (groupStates['canc'] === 'YES') {
        hasAnyScreening = true;
        screeningTxt += `- Personal/Family Skin Cancer History: YES\n`;
        if (document.getElementById('hxPersonalMelanoma')?.checked) {
            const stage = document.getElementById('melanomaStage')?.value || '';
            const time = document.getElementById('melanomaTime')?.value || '';
            const young = document.getElementById('melanomaYoungAge')?.checked ? ' (Diagnosed <50 yrs)' : '';
            screeningTxt += `    - Personal History of Melanoma: ${stage}, Diagnosed ${time}${young}\n`;
        }
        if (document.getElementById('hxPersonalNMSC')?.checked) screeningTxt += `    - Personal History of NMSC (BCC/SCC): YES\n`;
        if (document.getElementById('hxFamilyMelanoma')?.checked) screeningTxt += `    - First-Degree Relative with Melanoma: YES\n`;
        if (document.getElementById('hxHighMoleCount')?.checked) screeningTxt += `    - High Nevus Count / Dysplastic Nevi: YES\n`;
    } else if (groupStates['canc'] === 'NO') {
        hasAnyScreening = true;
        screeningTxt += `- Personal/Family Skin Cancer History: NO\n`;
    }

    if (groupStates['all'] === 'YES') {
        hasAnyScreening = true;
        screeningTxt += `- Allergies & Adverse Reactions: YES\n`;
        if (document.getElementById('algLocalAnaesthetic')?.checked) screeningTxt += `    - Allergy: Local Anaesthetics (Lignocaine/Adrenaline)\n`;
        if (document.getElementById('algAntiseptic')?.checked) screeningTxt += `    - Allergy: Antiseptics (Chlorhexidine/Betadine)\n`;
        if (document.getElementById('algLatexDressings')?.checked) screeningTxt += `    - Allergy: Latex or Acrylic Dressings/Tapes\n`;
        const algText = document.getElementById('allergiesText')?.value.trim();
        if (algText) screeningTxt += `    - Specific Allergy Details: ${algText}\n`;
    } else if (groupStates['all'] === 'NO') {
        hasAnyScreening = true;
        screeningTxt += `- Allergies & Adverse Reactions: NO known allergies\n`;
    }

    if (groupStates['bld'] === 'YES') {
        hasAnyScreening = true;
        screeningTxt += `- Bleeding & Anticoagulation Risk: YES\n`;
        if (document.getElementById('bldAspirin')?.checked) screeningTxt += `    - Anticoagulant: Aspirin / NSAIDs\n`;
        if (document.getElementById('bldWarfarin')?.checked) screeningTxt += `    - Anticoagulant: Warfarin\n`;
        if (document.getElementById('bldDOAC')?.checked) screeningTxt += `    - Anticoagulant: DOAC (Apixaban/Rivaroxaban)\n`;
        if (document.getElementById('bldHerbals')?.checked) screeningTxt += `    - Anticoagulant: Fish Oil / Vit E / Herbals\n`;
        const medText = document.getElementById('medicationsText')?.value.trim();
        if (medText) screeningTxt += `    - Current Medications: ${medText}\n`;
    } else if (groupStates['bld'] === 'NO') {
        hasAnyScreening = true;
        screeningTxt += `- Bleeding & Anticoagulation Risk: NO (No blood thinners reported)\n`;
    }

    if (groupStates['dia'] === 'YES') {
        hasAnyScreening = true;
        screeningTxt += `- Diathermy / Cardiac Device / Metal Implant Screening: YES\n`;
        if (document.getElementById('diaPacemaker')?.checked) screeningTxt += `    - CRITICAL ALERT: Cardiac Pacemaker / ICD Present (Monopolar Diathermy Contraindicated)\n`;
        if (document.getElementById('diaMetalwork')?.checked) screeningTxt += `    - Internal Metalwork / Joint Replacement (TKR/THR) Present\n`;
        if (document.getElementById('diaCochlear')?.checked) screeningTxt += `    - Cochlear Implant Present\n`;
    } else if (groupStates['dia'] === 'NO') {
        hasAnyScreening = true;
        screeningTxt += `- Diathermy / Implant Safety Screening: NO pacemakers or internal metalwork reported\n`;
    }

    if (groupStates['hea'] === 'YES') {
        hasAnyScreening = true;
        screeningTxt += `- Wound Healing & Scarring Risks: YES\n`;
        if (document.getElementById('heaSmoking')?.checked) screeningTxt += `    - Active Smoking (Increased flap/graft ischemia risk)\n`;
        if (document.getElementById('heaDiabetes')?.checked) screeningTxt += `    - Diabetes Mellitus\n`;
        if (document.getElementById('heaImmuno')?.checked) screeningTxt += `    - Immunosuppression / Biologic Therapy\n`;
        if (document.getElementById('heaKeloid')?.checked) screeningTxt += `    - Keloid or Hypertrophic Scarring History\n`;
        if (document.getElementById('heaVasovagal')?.checked) screeningTxt += `    - Vasovagal Syncope History\n`;
    } else if (groupStates['hea'] === 'NO') {
        hasAnyScreening = true;
        screeningTxt += `- Wound Healing & Scarring Risks: NO (Non-smoker, normal healing history)\n`;
    }

    const pastText = document.getElementById('pastHistoryText')?.value.trim();
    if (pastText) {
        hasAnyScreening = true;
        screeningTxt += `- Additional Medical/Surgical Notes: ${pastText}\n`;
    }

    if (!hasAnyScreening) return '';
    const chart = currentManagedChart();
    if (!options?.forceFull && chartScreeningAlreadyCopied(chart)) {
        const when = chart.iemr.screeningCopiedAt
            ? new Date(chart.iemr.screeningCopiedAt).toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' })
            : 'previously';
        return `=== PRE-PROCEDURAL CLINICAL RISK SCREENING ===\n\n- Completed this visit; already copied to IEMR (${when}). Not repeated here.\n\n`;
    }
    return screeningTxt + `\n`;
}

function screeningConsentHistoryLines() {
    const lines = [];
    if (groupStates['canc'] === 'YES') {
        const bits = [];
        if (document.getElementById('hxPersonalMelanoma')?.checked) {
            const stage = document.getElementById('melanomaStage')?.value || '';
            const time = document.getElementById('melanomaTime')?.value || '';
            bits.push('personal melanoma' + (stage || time ? ' (' + [stage, time].filter(Boolean).join(', ') + ')' : ''));
        }
        if (document.getElementById('hxPersonalNMSC')?.checked) bits.push('personal NMSC (BCC/SCC)');
        if (document.getElementById('hxFamilyMelanoma')?.checked) bits.push('first-degree relative melanoma');
        if (document.getElementById('hxHighMoleCount')?.checked) bits.push('high mole count / dysplastic nevi');
        if (bits.length) lines.push('Skin cancer history: ' + bits.join('; ') + '.');
        else lines.push('Skin cancer history reported (see chart).');
    } else if (groupStates['canc'] === 'NO') {
        lines.push('No personal or family skin cancer history.');
    }
    if (groupStates['all'] === 'YES') {
        const bits = [];
        if (document.getElementById('algLocalAnaesthetic')?.checked) bits.push('local anaesthetic');
        if (document.getElementById('algAntiseptic')?.checked) bits.push('antiseptics');
        if (document.getElementById('algLatexDressings')?.checked) bits.push('latex / acrylic dressings');
        const extra = document.getElementById('allergiesText')?.value.trim();
        if (bits.length) lines.push('Allergies: ' + bits.join(', ') + (extra ? ' — ' + extra : ''));
        else if (extra) lines.push('Allergies: ' + extra);
        else lines.push('Allergies reported (see chart).');
    } else if (groupStates['all'] === 'NO') {
        lines.push('No known allergies.');
    }
    if (groupStates['bld'] === 'YES') {
        const bits = [];
        if (document.getElementById('bldAspirin')?.checked) bits.push('aspirin / NSAIDs');
        if (document.getElementById('bldWarfarin')?.checked) bits.push('warfarin');
        if (document.getElementById('bldDOAC')?.checked) bits.push('DOAC');
        if (document.getElementById('bldHerbals')?.checked) bits.push('fish oil / vitamin E / herbals');
        const meds = document.getElementById('medicationsText')?.value.trim();
        if (bits.length) lines.push('Bleeding risk / anticoagulants: ' + bits.join(', '));
        if (meds) lines.push('Medications: ' + meds);
    } else if (groupStates['bld'] === 'NO') {
        lines.push('No anticoagulants reported.');
    }
    if (groupStates['dia'] === 'YES') {
        if (document.getElementById('diaPacemaker')?.checked) lines.push('CRITICAL: Cardiac pacemaker / ICD — monopolar diathermy contraindicated.');
        if (document.getElementById('diaMetalwork')?.checked) lines.push('Internal metalwork / joint replacement present.');
        if (document.getElementById('diaCochlear')?.checked) lines.push('Cochlear implant present.');
    } else if (groupStates['dia'] === 'NO') {
        lines.push('No pacemaker, cochlear implant, or internal metalwork reported.');
    }
    if (groupStates['hea'] === 'YES') {
        if (document.getElementById('heaSmoking')?.checked) lines.push('Active smoking (increased flap/graft ischaemia risk).');
        if (document.getElementById('heaDiabetes')?.checked) lines.push('Diabetes mellitus.');
        if (document.getElementById('heaImmuno')?.checked) lines.push('Immunosuppression / biologic therapy.');
        if (document.getElementById('heaKeloid')?.checked) lines.push('Keloid or hypertrophic scarring history.');
        if (document.getElementById('heaVasovagal')?.checked) lines.push('Vasovagal syncope history.');
    } else if (groupStates['hea'] === 'NO') {
        lines.push('No smoking, diabetes, immunosuppression, keloid, or vasovagal history reported.');
    }
    const past = document.getElementById('pastHistoryText')?.value.trim();
    if (past) lines.push(past);
    return lines;
}

function patientSummaryHistoryLines() {
    const fromDom = screeningConsentHistoryLines();
    if (fromDom.length) return fromDom;
    const chart = typeof currentManagedChart === 'function' ? currentManagedChart() : null;
    const screening = chart?.screening;
    if (!screening?.filled && !screening?.fields) return [];
    const fields = screening.fields || {};
    const groups = screening.groups || {};
    const lines = [];
    if (groups.canc === 'YES') {
        const bits = [];
        if (fields.hxPersonalMelanoma) bits.push('personal melanoma');
        if (fields.hxPersonalNMSC) bits.push('personal NMSC');
        if (fields.hxFamilyMelanoma) bits.push('family melanoma');
        if (fields.hxHighMoleCount) bits.push('high mole count');
        if (bits.length) lines.push('Skin cancer history: ' + bits.join('; ') + '.');
    } else if (groups.canc === 'NO') {
        lines.push('No personal or family skin cancer history.');
    }
    if (groups.all === 'YES') lines.push(fields.allergiesText ? 'Allergies: ' + fields.allergiesText : 'Allergies reported (see chart).');
    else if (groups.all === 'NO') lines.push('No known allergies.');
    if (groups.bld === 'YES') {
        const bits = [];
        if (fields.bldAspirin) bits.push('aspirin / NSAIDs');
        if (fields.bldWarfarin) bits.push('warfarin');
        if (fields.bldDOAC) bits.push('DOAC');
        if (fields.bldHerbals) bits.push('fish oil / herbals');
        if (bits.length) lines.push('Bleeding risk / anticoagulants: ' + bits.join(', '));
        if (fields.medicationsText) lines.push('Medications: ' + fields.medicationsText);
    }
    if (groups.dia === 'YES') {
        if (fields.diaPacemaker) lines.push('CRITICAL: Cardiac pacemaker / ICD — monopolar diathermy contraindicated.');
        if (fields.diaMetalwork) lines.push('Internal metalwork / joint replacement present.');
        if (fields.diaCochlear) lines.push('Cochlear implant present.');
    } else if (groups.dia === 'NO') {
        lines.push('No pacemaker, cochlear implant, or internal metalwork reported.');
    }
    if (groups.hea === 'YES') {
        if (fields.heaSmoking) lines.push('Active smoking.');
        if (fields.heaDiabetes) lines.push('Diabetes mellitus.');
        if (fields.heaImmuno) lines.push('Immunosuppression / biologic therapy.');
        if (fields.heaKeloid) lines.push('Keloid / hypertrophic scarring history.');
        if (fields.heaVasovagal) lines.push('Vasovagal syncope history.');
    }
    if (fields.pastHistoryText) lines.push(fields.pastHistoryText);
    return lines;
}

async function markChartIemrCopied(text) {
    const chart = await saveCurrentChartFromDom();
    if (!chart) return;
    const now = new Date().toISOString();
    const hash = screeningSnapshotHash(chart.screening, chart.exam);
    if (!chart.iemr) chart.iemr = emptyChartIemr();
    if (chart.screening?.filled) {
        chart.iemr.screeningCopied = true;
        chart.iemr.screeningCopiedAt = chart.iemr.screeningCopiedAt || now;
        chart.iemr.screeningHash = hash;
    }
    chart.iemr.examCopied = true;
    chart.iemr.examCopiedAt = now;
    chart.iemr.examVisitDate = todayVisitKey();
    chart.iemr.examHash = text || '';
    chart.iemr.examFingerprint = examVisitFingerprint();
    await saveManagedChartRecord(chart);
    if (typeof updateChartChrome === 'function') updateChartChrome();
}

function iemrCopyStatusLabel(chart) {
    const record = chart || currentManagedChart();
    if (!record) return '';
    if (chartExamAlreadyCopiedToday(record)) {
        const when = record.iemr.examCopiedAt
            ? new Date(record.iemr.examCopiedAt).toLocaleString('en-AU', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
            : 'today';
        return 'Visit note copied to IEMR ' + when;
    }
    if (record.iemr?.screeningCopied) {
        const when = record.iemr.screeningCopiedAt
            ? new Date(record.iemr.screeningCopiedAt).toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' })
            : '';
        return 'Screening on file' + (when ? ' (copied ' + when + ')' : '') + '. Today’s visit note not yet copied.';
    }
    if (record.screening?.filled) return 'Screening on chart. Not yet copied to IEMR.';
    return 'No screening saved on this chart yet.';
}

function knownPatientCharts() {
    const map = new Map();
    managedCharts.forEach((chart) => {
        if (!chart.id) return;
        map.set(chart.id, {
            chartId: chart.id,
            name: chart.name || '',
            firstName: chart.firstName || '',
            lastName: chart.lastName || '',
            dob: chart.dob || '',
            phone: chart.phone || '',
            clinician: chart.clinician || '',
            screeningFilled: !!chart.screening?.filled,
            iemrCopied: !!(chart.iemr?.screeningCopied || chart.iemr?.examCopied)
        });
    });
    if (typeof knownPatientsFromLesions === 'function') {
        knownPatientsFromLesions().forEach((p) => {
            if (!p.chartId) return;
            const existing = map.get(p.chartId);
            if (!existing) map.set(p.chartId, { ...p, screeningFilled: false, iemrCopied: false });
            else {
                if (!existing.clinician && p.clinician) existing.clinician = p.clinician;
                if (!existing.phone && p.phone) existing.phone = p.phone;
                if (!existing.firstName && p.firstName) existing.firstName = p.firstName;
                if (!existing.lastName && p.lastName) existing.lastName = p.lastName;
            }
        });
    }
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }));
}

async function openPatientChart(patient, options) {
    const identity = typeof patientIdentityFromRecord === 'function' ? patientIdentityFromRecord(patient) : patient;
    const name = String(identity?.name || '').trim();
    const dob = String(identity?.dob || '').trim();
    const clinician = String(identity?.clinician || '').trim();
    const chartId = identity?.chartId || patientChartId(name, dob);
    if (!chartId) {
        showToast('Enter patient name and date of birth.');
        return false;
    }
    if (hasCurrentPatient() && currentPatient.chartId !== chartId) {
        if (typeof blockOpenChartWhileVisitActive === 'function') {
            blockOpenChartWhileVisitActive(chartId);
        } else {
            showToast('Finalise this visit before opening another chart.');
        }
        return false;
    }
    setCurrentPatient({ ...identity, name, dob, clinician, chartId }, options);
    const chart = await ensureChartRecord({
        ...currentPatient,
        consultBilling: patient?.consultBilling,
        biopsyBilling: patient?.biopsyBilling
    });
    if (chart?.phone && !currentPatient.phone) currentPatient.phone = chart.phone;
    if (chart?.firstName && !currentPatient.firstName) currentPatient.firstName = chart.firstName;
    if (chart?.lastName && !currentPatient.lastName) currentPatient.lastName = chart.lastName;
    if (typeof visitConsultType !== 'undefined') visitConsultType = '';
    if (typeof screeningAskedThisConsult !== 'undefined') screeningAskedThisConsult = false;
    if (typeof isBedSanitised !== 'undefined') isBedSanitised = false;
    applyCurrentChartToForms();
    const restoredVisit = typeof restoreVisitSessionFromChart === 'function'
        && restoreVisitSessionFromChart(chart);
    const restoredProcedure = typeof restoreProcedureSessionFromChart === 'function'
        && restoreProcedureSessionFromChart(chart);
    if (typeof refreshExamCopyStateFromChart === 'function') refreshExamCopyStateFromChart(chart);
    const shouldResumeWorkspace = !!(options?.resumeVisit || options?.resumeAfterLock || restoredVisit || restoredProcedure);
    if (shouldResumeWorkspace && typeof switchWorkspaceTab === 'function') {
        if (restoredProcedure) {
            switchWorkspaceTab('excision-generator', { skipCompleteModal: true, skipPersist: true });
        } else {
            const tab = chart?.visitSession?.workspaceTab;
            if (typeof isClinicalWorkspaceTab === 'function' ? isClinicalWorkspaceTab(tab) : (tab === 'skin-check' || tab === 'excision-generator')) {
                switchWorkspaceTab(tab, { skipCompleteModal: true, skipPersist: true });
            }
        }
    }
    if (typeof setMgmtFilter === 'function' && (!options || !options.keepFilter)) setMgmtFilter('open');
    if (typeof renderManagedLesions === 'function') renderManagedLesions();
    if (typeof updateChartChrome === 'function') updateChartChrome();
    if (typeof updateOutput === 'function') updateOutput();
    if (!options?.silent) {
        if (restoredProcedure) showToast('Opened chart: ' + name + '. Procedure still in progress.');
        else if (restoredVisit) showToast('Opened chart: ' + name + '. Visit restored.');
        else showToast('Opened chart: ' + name + '.');
    }
    if (typeof maybePromptConsultType === 'function') {
        maybePromptConsultType(options);
    }
    return true;
}

function chartForLastPatient(saved) {
    if (!saved) return null;
    if (saved.chartId && typeof findManagedChart === 'function') {
        const byId = findManagedChart(saved.chartId);
        if (byId) return byId;
    }
    const id = typeof patientChartId === 'function' ? patientChartId(saved.name, saved.dob) : '';
    if (id && typeof findManagedChart === 'function') {
        const byDerived = findManagedChart(id);
        if (byDerived) return byDerived;
    }
    const charts = typeof managedCharts !== 'undefined' ? managedCharts : [];
    return charts.find((chart) => chart.name === saved.name && chart.dob === saved.dob) || null;
}

async function resumeLastChartAfterLogin() {
    if (typeof openPatientChart !== 'function') return false;
    const last = typeof readLastPatient === 'function' ? readLastPatient() : null;
    const lastChart = chartForLastPatient(last);
    const activeProcedure = typeof findActiveProcedureChart === 'function'
        ? findActiveProcedureChart()
        : null;
    const activeVisit = findActiveVisitChart();
    const source = lastChart || activeProcedure || activeVisit;
    if (!source) return false;
    const chartRecord = lastChart || (source.id ? source : chartForLastPatient(source));
    const hasActiveVisit = !!(chartRecord && isVisitSessionActive(chartRecord.visitSession));
    const hasActiveProcedure = !!(chartRecord && typeof isStoredProcedureSessionActive === 'function'
        && isStoredProcedureSessionActive(chartRecord.procedureSession))
        || !!(activeProcedure && typeof isStoredProcedureSessionActive === 'function'
            && isStoredProcedureSessionActive(activeProcedure.procedureSession));
    const opened = await openPatientChart(patientFromChartOrLast(source), {
        silent: true,
        keepFilter: true,
        resumeVisit: true,
        resumeAfterLock: true
    });
    if (!opened) return false;
    if (hasActiveProcedure && typeof procedureSession !== 'undefined' && procedureSession.started) {
        showToast('Procedure still in progress. Restored after sign-in.');
        return 'procedure';
    }
    if (hasActiveVisit || (typeof activeWorkspaceTab !== 'undefined'
        && (typeof isClinicalWorkspaceTab === 'function'
            ? isClinicalWorkspaceTab(activeWorkspaceTab)
            : (activeWorkspaceTab === 'skin-check' || activeWorkspaceTab === 'excision-generator')))) {
        showToast('Visit restored after sign-in.');
        return 'visit';
    }
    return 'chart';
}

function patientFromChartOrLast(source) {
    if (!source) return null;
    return {
        name: source.name,
        firstName: source.firstName || '',
        lastName: source.lastName || '',
        dob: source.dob,
        phone: source.phone || '',
        clinician: source.clinician || '',
        chartId: source.chartId || source.id || ''
    };
}

function sessionNotesShouldPromptClose() {
    if (!hasCurrentPatient()) return false;
    if (typeof notesPendingCopy === 'function') {
        const pending = notesPendingCopy();
        if (pending?.pending) return true;
    }
    if (typeof chartExamCopyIsCurrent === 'function' && chartExamCopyIsCurrent()) return false;
    const exam = typeof collectChartExamFromDom === 'function' ? collectChartExamFromDom() : null;
    const examFilled = typeof examFromDomIsFilled === 'function' && examFromDomIsFilled(exam);
    const hasVisitLesions = (Array.isArray(lesions) && lesions.length > 0)
        || !!(typeof currentManagedChart === 'function' && (currentManagedChart()?.visitSession?.visitLesionIds || []).length);
    const procedureActive = !!(typeof procedureSession !== 'undefined'
        && (procedureSession.started || procedureSession.completedAt));
    const screeningDone = !!(typeof screeningMarkedComplete !== 'undefined' && screeningMarkedComplete)
        || !!(typeof groupStates !== 'undefined' && ['canc', 'all', 'bld', 'dia', 'hea'].some((k) => groupStates[k] === 'YES' || groupStates[k] === 'NO'));
    return !!(examFilled || hasVisitLesions || procedureActive || screeningDone);
}

async function closePatientChart(options) {
    if (!hasCurrentPatient()) {
        if (typeof switchWorkspaceTab === 'function') switchWorkspaceTab('management');
        if (typeof updateChartChrome === 'function') updateChartChrome();
        return;
    }
    if (!options?.force) {
        requestClosePatientChart();
        return;
    }
    closeFinaliseVisitModal();
    if (typeof clearStoredProcedureSession === 'function') {
        await clearStoredProcedureSession();
    }
    await saveCurrentChartFromDom({ endVisit: true });
    if (typeof saveCurrentVisitNotes === 'function') await saveCurrentVisitNotes();
    resetScreeningAndExamForm();
    clearCurrentPatient();
    if (typeof switchWorkspaceTab === 'function') switchWorkspaceTab('management');
    if (typeof setMgmtFilter === 'function') setMgmtFilter('open');
    if (typeof renderManagedLesions === 'function') renderManagedLesions();
    if (typeof updateChartChrome === 'function') updateChartChrome();
    if (!options?.silent) showToast('Chart closed. Showing all active lesions.');
}

function requestClosePatientChart() {
    if (!hasCurrentPatient()) {
        closePatientChart({ force: true });
        return;
    }
    if (typeof procedureSession !== 'undefined' && procedureSession.started) {
        showToast('Complete the procedure first, then finalise the visit.');
        if (typeof switchWorkspaceTab === 'function') switchWorkspaceTab('excision-generator', { skipCompleteModal: true });
        return;
    }
    openFinaliseVisitModal();
}

function openFinaliseVisitModal() {
    const modal = document.getElementById('finaliseVisitModal');
    if (!modal) {
        closePatientChart({ force: true });
        return;
    }
    refreshFinaliseVisitModal();
    modal.classList.remove('hidden');
}

function closeFinaliseVisitModal() {
    const modal = document.getElementById('finaliseVisitModal');
    if (modal) modal.classList.add('hidden');
}

function stayOnPatientChart() {
    closeFinaliseVisitModal();
}

function setFinaliseCopyButton(id, copied, idleLabel, doneLabel, idleClass, doneClass) {
    const btn = document.getElementById(id);
    if (!btn) return;
    btn.textContent = copied ? doneLabel : idleLabel;
    btn.className = copied ? doneClass : idleClass;
}

function refreshFinaliseVisitModal() {
    if (typeof updateOutput === 'function') updateOutput();
    const iemr = typeof generateCompleteInteractionNote === 'function'
        ? generateCompleteInteractionNote()
        : (typeof generateEMRNotePlainText === 'function' ? generateEMRNotePlainText() : '');
    const rec = typeof generateReceptionMessage === 'function' ? generateReceptionMessage() : '';
    const lesions = typeof visitProcedureLesionsForFinalise === 'function' ? visitProcedureLesionsForFinalise() : [];
    const state = typeof visitFinaliseBillingState === 'function'
        ? visitFinaliseBillingState(lesions)
        : { mode: lesions.length ? 'hold' : 'close', copyText: '' };

    const iemrEl = document.getElementById('finaliseIemrPreview');
    const recEl = document.getElementById('finaliseReceptionPreview');
    const billEl = document.getElementById('finaliseBillingPreview');
    const billWrap = document.getElementById('finaliseBillingWrap');
    const billHint = document.getElementById('finaliseBillingHint');
    const billChips = document.getElementById('finaliseBillingChips');
    const closeBtn = document.getElementById('btnFinaliseVisitClose');

    if (iemrEl) iemrEl.value = iemr || '';
    if (recEl) recEl.value = rec || '';
    if (billEl) billEl.value = state.copyText || '';
    if (billWrap) billWrap.classList.toggle('hidden', state.mode === 'close');
    if (billChips) {
        billChips.innerHTML = state.mode === 'close'
            ? ''
            : (typeof renderFinaliseBillingCopyList === 'function'
                ? renderFinaliseBillingCopyList(state.summary)
                : '');
    }
    if (typeof bindFinaliseBillingCopyClicks === 'function') bindFinaliseBillingCopyClicks();
    if (billHint) {
        billHint.textContent = state.mode === 'process'
            ? 'Click a site or an item number to copy it into Best Practice. Same-day procedures bill together. Copy what you need, then mark processed and close so billing is not an extra step.'
            : 'HOLD until histology. Click each expected item number as a placeholder for reception; change it if the result differs.';
    }

    const iemrCopied = typeof outputCopyState !== 'undefined' && outputCopyState.emr
        && outputCopyState.emr.copied && outputCopyState.emr.lastCopiedText === iemr;
    const recCopied = typeof outputCopyState !== 'undefined' && outputCopyState.rec
        && outputCopyState.rec.copied && outputCopyState.rec.lastCopiedText === rec;
    setFinaliseCopyButton(
        'btnFinaliseCopyIemr',
        iemrCopied,
        'Copy IEMR',
        'IEMR copied',
        'px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg cursor-pointer',
        'px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg cursor-pointer'
    );
    setFinaliseCopyButton(
        'btnFinaliseCopyReception',
        recCopied,
        'Copy message to reception',
        'Reception message copied',
        'px-3 py-2 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold rounded-lg cursor-pointer',
        'px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg cursor-pointer'
    );
    setFinaliseCopyButton(
        'btnFinaliseCopyBilling',
        false,
        'Copy all item numbers',
        'All item numbers copied',
        'px-3 py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-lg cursor-pointer',
        'px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg cursor-pointer'
    );

    if (closeBtn) {
        if (state.mode === 'process') {
            closeBtn.textContent = 'Mark billing processed and close';
            closeBtn.className = 'px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-lg cursor-pointer';
        } else if (state.mode === 'hold') {
            closeBtn.textContent = 'Hold billing and close';
            closeBtn.className = 'px-4 py-2 bg-amber-800 hover:bg-amber-900 text-white text-xs font-bold rounded-lg cursor-pointer';
        } else {
            closeBtn.textContent = 'Close chart';
            closeBtn.className = 'px-4 py-2 bg-amber-800 hover:bg-amber-900 text-white text-xs font-bold rounded-lg cursor-pointer';
        }
    }
}

function copyFinaliseVisitIemr() {
    const text = document.getElementById('finaliseIemrPreview')?.value || '';
    if (!text) {
        showToast('No IEMR note to copy yet.');
        return;
    }
    if (typeof copyTodaysClinicalNote === 'function') {
        copyTodaysClinicalNote();
    } else {
        copyTextToClipboard(text, 'IEMR copied for Best Practice.', () => {
            if (typeof markOutputCopied === 'function') markOutputCopied('emr', text);
            if (typeof markChartIemrCopied === 'function') markChartIemrCopied(text);
        });
    }
    setTimeout(() => refreshFinaliseVisitModal(), 200);
}

function copyFinaliseVisitReception() {
    const text = document.getElementById('finaliseReceptionPreview')?.value
        || (typeof generateReceptionMessage === 'function' ? generateReceptionMessage() : '');
    if (!text) {
        showToast('No reception message yet.');
        return;
    }
    copyTextToClipboard(text, 'Reception message copied.', () => {
        if (typeof markOutputCopied === 'function') markOutputCopied('rec', text);
        refreshFinaliseVisitModal();
    });
}

function copyFinaliseVisitBilling() {
    const text = document.getElementById('finaliseBillingPreview')?.value
        || (typeof generateVisitBillingCopy === 'function'
            ? generateVisitBillingCopy(typeof visitProcedureLesionsForFinalise === 'function' ? visitProcedureLesionsForFinalise() : [])
            : '');
    if (!text) {
        showToast('No item numbers to copy yet.');
        return;
    }
    copyTextToClipboard(text, 'Item numbers copied for Best Practice.', () => {
        setFinaliseCopyButton(
            'btnFinaliseCopyBilling',
            true,
            'Copy all item numbers',
            'All item numbers copied',
            'px-3 py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-lg cursor-pointer',
            'px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg cursor-pointer'
        );
    });
}

async function submitFinaliseVisit() {
    const lesions = typeof visitProcedureLesionsForFinalise === 'function' ? visitProcedureLesionsForFinalise() : [];
    const state = typeof visitFinaliseBillingState === 'function'
        ? visitFinaliseBillingState(lesions)
        : { mode: lesions.length ? 'hold' : 'close' };
    if (state.mode === 'process' && typeof markVisitLesionsBillingProcessed === 'function') {
        const result = await markVisitLesionsBillingProcessed(lesions);
        await closePatientChart({ force: true, silent: true });
        const codes = (result.codes || []).filter(Boolean).join(' · ');
        showToast(codes
            ? 'Billing marked processed: ' + codes + '. Chart closed.'
            : 'Billing marked processed. Chart closed.');
        return;
    }
    if (state.mode === 'hold') {
        await closePatientChart({ force: true, silent: true });
        showToast('Billing held. Chart closed.');
        return;
    }
    await closePatientChart({ force: true });
}

async function flushVisitPersistence() {
    if (typeof applyingChartRecord !== 'undefined' && applyingChartRecord) {
        if (typeof waitForPendingVaultWrites === 'function') await waitForPendingVaultWrites();
        return { ok: true, skipped: true };
    }
    if (typeof isVaultLoggedIn === 'function' && !isVaultLoggedIn()) return { ok: true, skipped: true };
    if (typeof chartSaveTimer !== 'undefined' && chartSaveTimer) {
        clearTimeout(chartSaveTimer);
        chartSaveTimer = null;
    }
    if (typeof visitNoteSaveTimer !== 'undefined' && visitNoteSaveTimer) {
        clearTimeout(visitNoteSaveTimer);
        visitNoteSaveTimer = null;
    }
    if (!hasCurrentPatient()) {
        if (typeof waitForPendingVaultWrites === 'function') await waitForPendingVaultWrites();
        return { ok: true, skipped: true };
    }
    const errors = [];
    if (typeof saveCurrentChartFromDom === 'function') {
        try { await saveCurrentChartFromDom(); } catch (err) {
            console.warn('Flush chart save failed', err);
            errors.push(err);
        }
    }
    if (typeof saveCurrentVisitNotes === 'function') {
        try { await saveCurrentVisitNotes(); } catch (err) {
            console.warn('Flush note save failed', err);
            errors.push(err);
        }
    }
    if (typeof waitForPendingVaultWrites === 'function') await waitForPendingVaultWrites();
    return { ok: !errors.length, errors };
}

function bindVisitPersistenceFlush() {
    if (typeof window === 'undefined' || window.__dermVisitFlushBound) return;
    window.__dermVisitFlushBound = true;
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') flushVisitPersistence();
    });
    // Browsers do not wait for File System Access writes on pagehide. Flush is
    // best-effort; lock Windows when leaving the desk.
    window.addEventListener('pagehide', () => {
        flushVisitPersistence();
    });
}

if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', bindVisitPersistenceFlush);
    } else {
        bindVisitPersistenceFlush();
    }
}

function updateChartChrome() {
    const open = hasCurrentPatient();
    const closeBtn = document.getElementById('btnHeaderCloseChart');
    if (closeBtn) closeBtn.classList.toggle('hidden', !open);
    if (typeof syncOpenChartSearchGate === 'function') syncOpenChartSearchGate();
    const filterBar = document.getElementById('mgmtFilterBar');
    if (filterBar) filterBar.classList.toggle('hidden', open);
    const banner = document.getElementById('mgmtChartBanner');
    const title = document.getElementById('mgmtBoardTitle');
    const iemrEl = document.getElementById('mgmtIemrStatus');
    if (title) title.textContent = open ? currentPatient.name : 'Practice board';
    if (banner) banner.classList.toggle('is-open', open);
    const sub = document.getElementById('mgmtChartBannerText');
    if (sub) {
        sub.textContent = open
            ? ([currentPatient.dob, currentPatient.phone, currentPatient.clinician].filter(Boolean).join(' · ')
                + (typeof formatScratchpadExpiry === 'function' && formatScratchpadExpiry(currentPatient.chartId)
                    ? ' · Finished work is kept 14 days (' + formatScratchpadExpiry(currentPatient.chartId) + ').'
                    : ''))
            : 'All current active skin lesions. Search a patient to open their chart. Finished charts are kept 14 days, then deleted.';
    }
    if (iemrEl) {
        iemrEl.classList.toggle('hidden', !open);
        iemrEl.textContent = open ? iemrCopyStatusLabel() : '';
    }
    if (typeof renderPatientChartSummary === 'function') renderPatientChartSummary();
    updateHeaderPatient();
}
