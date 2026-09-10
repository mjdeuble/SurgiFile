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

function chartRecordFileName(chartId) {
    const stem = String(chartId || '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 60) || 'chart';
    let hash = 0;
    for (let i = 0; i < String(chartId).length; i++) {
        hash = ((hash << 5) - hash) + String(chartId).charCodeAt(i);
        hash |= 0;
    }
    return stem + '-' + (hash >>> 0).toString(16) + '.json.enc';
}

function findManagedChart(chartId) {
    if (!chartId) return null;
    return managedCharts.find((item) => item.id === chartId) || null;
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
    return {
        visitDate: today,
        workspaceTab: (tab === 'skin-check' || tab === 'excision-generator') ? tab : 'management',
        sanitised: typeof isBedSanitised !== 'undefined' ? !!isBedSanitised : false,
        patientConcerns: Array.isArray(patientConcerns) ? patientConcerns.slice() : [],
        visitLesionIds: (Array.isArray(lesions) ? lesions : []).map((item) => String(item.id)).filter(Boolean),
        updatedAt: new Date().toISOString()
    };
}

function isVisitSessionActive(session) {
    if (!session) return false;
    const today = todayVisitKey();
    if (session.visitDate && session.visitDate !== today) return false;
    if (session.sanitised) return true;
    if ((session.visitLesionIds || []).length) return true;
    if ((session.patientConcerns || []).length) return true;
    if (session.workspaceTab === 'skin-check' || session.workspaceTab === 'excision-generator') return true;
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
        if (typeof lesionChartId === 'function' && lesionChartId(item) !== chartId) return;
        next.push({ ...item });
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

    if (session.sanitised) {
        isBedSanitised = true;
        pendingSanitise = false;
        if (typeof setModalBedSanitation === 'function') setModalBedSanitation(true);
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
        owner: (typeof vaultAuth !== 'undefined' && vaultAuth.username) || '',
        fileName: chartRecordFileName(id)
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
    const name = chart.fileName || chartRecordFileName(chart.id);
    chart.fileName = name;
    const payload = await encryptJson(vaultAuth.key, chart);
    await writeTextFile(dir, name, JSON.stringify(payload));
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
    }
    managedCharts.sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'en', { sensitivity: 'base' }));
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

function generateScreeningEmrSection(options) {
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
        return `=== PRE-PROCEDURAL CLINICAL RISK SCREENING ===\n\n- On file and already copied to IEMR (${when}). Not repeated here. History remains available for consent forms.\n\n`;
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
        return 'Examination copied to IEMR ' + when;
    }
    if (record.iemr?.screeningCopied) {
        const when = record.iemr.screeningCopiedAt
            ? new Date(record.iemr.screeningCopiedAt).toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' })
            : '';
        return 'Screening on file' + (when ? ' (copied ' + when + ')' : '') + '. Today’s examination not yet copied.';
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
        await saveCurrentChartFromDom();
        resetScreeningAndExamForm();
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
            if (tab === 'skin-check' || tab === 'excision-generator') {
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
    const activeChart = (!lastChart && typeof findActiveProcedureChart === 'function')
        ? findActiveProcedureChart()
        : null;
    const source = lastChart || last || activeChart;
    if (!source) return false;
    const chartRecord = lastChart || (source.id ? source : chartForLastPatient(source));
    const hasActiveVisit = !!(chartRecord && isVisitSessionActive(chartRecord.visitSession));
    const hasActiveProcedure = !!(chartRecord && typeof isStoredProcedureSessionActive === 'function'
        && isStoredProcedureSessionActive(chartRecord.procedureSession))
        || !!(activeChart && typeof isStoredProcedureSessionActive === 'function'
            && isStoredProcedureSessionActive(activeChart.procedureSession));
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
        && (activeWorkspaceTab === 'skin-check' || activeWorkspaceTab === 'excision-generator'))) {
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
    if (!options?.force && sessionNotesShouldPromptClose()) {
        const pending = typeof notesPendingCopy === 'function'
            ? notesPendingCopy()
            : { pending: true, consultExists: true, procedureExists: false };
        openCloseChartNotesModal({
            ...pending,
            pending: true,
            consultExists: pending.consultExists || true,
            forcePrompt: true
        });
        return;
    }
    closeCloseChartNotesModal();
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
    closePatientChart();
}

function openCloseChartNotesModal(pending) {
    const modal = document.getElementById('closeChartNotesModal');
    if (!modal) {
        closePatientChart({ force: true });
        return;
    }
    refreshCloseChartNotesModal(pending);
    modal.classList.remove('hidden');
}

function closeCloseChartNotesModal() {
    const modal = document.getElementById('closeChartNotesModal');
    if (modal) modal.classList.add('hidden');
}

function stayOnPatientChart() {
    closeCloseChartNotesModal();
}

function refreshCloseChartNotesModal(pending) {
    const state = pending || (typeof notesPendingCopy === 'function' ? notesPendingCopy() : { pending: false });
    const detail = document.getElementById('closeChartNotesDetail');
    const todayBtn = document.getElementById('btnCloseChartCopyToday');
    const consultBtn = document.getElementById('btnCloseChartCopyConsult');
    const procBtn = document.getElementById('btnCloseChartCopyProcedure');
    if (detail) {
        detail.textContent = state.forcePrompt || state.pending
            ? 'Copy today’s clinical note into Best Practice before closing. If you already pasted earlier, replace that note rather than appending.'
            : 'Notes have been copied. You can close the chart.';
    }
    if (todayBtn) {
        todayBtn.classList.remove('hidden');
        todayBtn.disabled = false;
        todayBtn.textContent = 'Copy today’s note';
    }
    if (consultBtn) consultBtn.classList.add('hidden');
    if (procBtn) procBtn.classList.add('hidden');
}

function copyPendingChartNotes(kind) {
    if (typeof copyTodaysClinicalNote === 'function') {
        copyTodaysClinicalNote();
    } else if (typeof copyEMRNotePlainText === 'function') {
        copyEMRNotePlainText();
    }
    setTimeout(() => {
        const pending = typeof notesPendingCopy === 'function' ? notesPendingCopy() : { pending: false };
        if (!pending.pending) {
            closePatientChart({ force: true });
            return;
        }
        refreshCloseChartNotesModal(pending);
    }, 350);
}

function flushVisitPersistence() {
    if (typeof applyingChartRecord !== 'undefined' && applyingChartRecord) return;
    if (typeof isVaultLoggedIn === 'function' && !isVaultLoggedIn()) return;
    if (!hasCurrentPatient()) return;
    if (typeof chartSaveTimer !== 'undefined' && chartSaveTimer) {
        clearTimeout(chartSaveTimer);
        chartSaveTimer = null;
    }
    if (typeof visitNoteSaveTimer !== 'undefined' && visitNoteSaveTimer) {
        clearTimeout(visitNoteSaveTimer);
        visitNoteSaveTimer = null;
    }
    const tasks = [];
    if (typeof saveCurrentChartFromDom === 'function') {
        tasks.push(saveCurrentChartFromDom().catch((err) => console.warn('Flush chart save failed', err)));
    }
    if (typeof saveCurrentVisitNotes === 'function') {
        tasks.push(saveCurrentVisitNotes().catch((err) => console.warn('Flush note save failed', err)));
    }
    return Promise.all(tasks);
}

function bindVisitPersistenceFlush() {
    if (typeof window === 'undefined' || window.__dermVisitFlushBound) return;
    window.__dermVisitFlushBound = true;
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') flushVisitPersistence();
    });
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
    const mgmtClose = document.getElementById('btnMgmtCloseChart');
    if (closeBtn) closeBtn.classList.toggle('hidden', !open);
    if (mgmtClose) mgmtClose.classList.toggle('hidden', !open);
    const banner = document.getElementById('mgmtChartBanner');
    const title = document.getElementById('mgmtBoardTitle');
    const iemrEl = document.getElementById('mgmtIemrStatus');
    if (title) title.textContent = open ? currentPatient.name : 'Practice board';
    if (banner) banner.classList.toggle('is-open', open);
    const sub = document.getElementById('mgmtChartBannerText');
    if (sub) {
        sub.textContent = open
            ? ([currentPatient.dob, currentPatient.phone, currentPatient.clinician].filter(Boolean).join(' · ') + ' · This chart only. Close the chart to see every patient’s lesions.')
            : 'All current active skin lesions. Search a patient to open their chart.';
    }
    if (iemrEl) {
        iemrEl.classList.toggle('hidden', !open);
        iemrEl.textContent = open ? iemrCopyStatusLabel() : '';
    }
    if (typeof renderPatientChartSummary === 'function') renderPatientChartSummary();
    updateHeaderPatient();
}
