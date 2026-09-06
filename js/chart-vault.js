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
        noPatientConcerns: !!noPatientConcerns
    };
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
        iemr: emptyChartIemr(),
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
        if (chart.iemr?.examCopied && chart.iemr.examVisitDate === todayVisitKey() && chart.iemr.examFingerprint === examVisitFingerprint()) {
            outputCopyState.emr.copied = true;
            outputCopyState.emr.lastCopiedText = document.getElementById('emrNoteTextContainer')?.value || '';
        } else {
            outputCopyState.emr.copied = false;
            outputCopyState.emr.lastCopiedText = '';
        }
    } finally {
        applyingChartRecord = false;
    }
    if (typeof collapseAllAccordions === 'function') collapseAllAccordions();
    if (typeof updateOutput === 'function') updateOutput();
    if (typeof updateChartChrome === 'function') updateChartChrome();
}

async function saveCurrentChartFromDom() {
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
    return JSON.stringify({
        lesions: (lesions || []).map((item) => ({
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
    }
    if (groupStates['dia'] === 'YES') {
        if (document.getElementById('diaPacemaker')?.checked) lines.push('CRITICAL: Cardiac pacemaker / ICD — monopolar diathermy contraindicated.');
        if (document.getElementById('diaMetalwork')?.checked) lines.push('Internal metalwork / joint replacement present.');
        if (document.getElementById('diaCochlear')?.checked) lines.push('Cochlear implant present.');
    }
    if (groupStates['hea'] === 'YES') {
        if (document.getElementById('heaSmoking')?.checked) lines.push('Active smoking (increased flap/graft ischaemia risk).');
        if (document.getElementById('heaDiabetes')?.checked) lines.push('Diabetes mellitus.');
        if (document.getElementById('heaImmuno')?.checked) lines.push('Immunosuppression / biologic therapy.');
        if (document.getElementById('heaKeloid')?.checked) lines.push('Keloid or hypertrophic scarring history.');
        if (document.getElementById('heaVasovagal')?.checked) lines.push('Vasovagal syncope history.');
    }
    const past = document.getElementById('pastHistoryText')?.value.trim();
    if (past) lines.push(past);
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
    if (typeof setMgmtFilter === 'function' && (!options || !options.keepFilter)) setMgmtFilter('open');
    if (typeof renderManagedLesions === 'function') renderManagedLesions();
    if (typeof updateChartChrome === 'function') updateChartChrome();
    if (!options?.silent) showToast('Opened chart: ' + name + '.');
    return true;
}

async function closePatientChart(options) {
    if (!hasCurrentPatient()) {
        if (typeof switchWorkspaceTab === 'function') switchWorkspaceTab('management');
        if (typeof updateChartChrome === 'function') updateChartChrome();
        return;
    }
    if (!options?.force && typeof notesPendingCopy === 'function') {
        const pending = notesPendingCopy();
        if (pending.pending) {
            openCloseChartNotesModal(pending);
            return;
        }
    }
    closeCloseChartNotesModal();
    await saveCurrentChartFromDom();
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
    const consultBtn = document.getElementById('btnCloseChartCopyConsult');
    const procBtn = document.getElementById('btnCloseChartCopyProcedure');
    const bits = [];
    if (state.consultPending) bits.push('consult notes');
    if (state.procedurePending) bits.push('procedure notes');
    if (detail) {
        detail.textContent = bits.length
            ? 'Still to copy: ' + bits.join(' and ') + '. Copy them into Best Practice, then close the chart.'
            : 'Notes have been copied. You can close the chart.';
    }
    if (consultBtn) {
        consultBtn.classList.toggle('hidden', !state.consultExists);
        consultBtn.disabled = !state.consultPending;
        consultBtn.textContent = state.consultPending ? 'Copy consult' : 'Consult copied';
    }
    if (procBtn) {
        procBtn.classList.toggle('hidden', !state.procedureExists);
        procBtn.disabled = !state.procedurePending;
        procBtn.textContent = state.procedurePending ? 'Copy procedure' : 'Procedure copied';
    }
}

function copyPendingChartNotes(kind) {
    if (kind === 'procedure') {
        if (typeof copyProcedureInteractionNote === 'function') copyProcedureInteractionNote();
        else if (typeof copyEMRNotePlainText === 'function') copyEMRNotePlainText();
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
    if (banner) {
        banner.classList.toggle('is-open', open);
        const sub = document.getElementById('mgmtChartBannerText');
        if (sub) {
            sub.textContent = open
                ? ([currentPatient.dob, currentPatient.phone, currentPatient.clinician].filter(Boolean).join(' · ') + ' · This chart only. Close the chart to see every patient’s lesions.')
                : 'All current active skin lesions. Search a patient to open their chart.';
        }
    }
    if (iemrEl) {
        iemrEl.classList.toggle('hidden', !open);
        iemrEl.textContent = open ? iemrCopyStatusLabel() : '';
    }
    updateHeaderPatient();
}
