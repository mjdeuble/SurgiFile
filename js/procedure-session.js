/* Procedure allocation: punch, shave, and excision share one planned queue. */

function emptyProcedureSession(chartId) {
    return {
        chartId: chartId || '',
        selectedIds: [],
        deselectedIds: [],
        lockedIds: [],
        started: false,
        startedAt: '',
        completedAt: '',
        detailLesionId: '',
        complications: { none: true, bleeding: false, vasovagal: false, other: false },
        complicationNotes: ''
    };
}

function snapshotProcedureSession() {
    const today = typeof todayVisitKey === 'function' ? todayVisitKey() : '';
    return {
        visitDate: today,
        chartId: procedureSession.chartId || (typeof currentPatient !== 'undefined' ? currentPatient.chartId : '') || '',
        selectedIds: (procedureSession.selectedIds || []).map(String),
        deselectedIds: (procedureSession.deselectedIds || []).map(String),
        lockedIds: (procedureSession.lockedIds || []).map(String),
        started: !!procedureSession.started,
        startedAt: procedureSession.startedAt || '',
        completedAt: procedureSession.completedAt || '',
        detailLesionId: procedureSession.detailLesionId || '',
        complications: procedureSession.complications || { none: true, bleeding: false, vasovagal: false, other: false },
        complicationNotes: procedureSession.complicationNotes || '',
        sanitised: typeof isBedSanitised !== 'undefined' ? !!isBedSanitised : false
    };
}

function isStoredProcedureSessionActive(saved) {
    if (!saved || !saved.started || saved.completedAt) return false;
    const today = typeof todayVisitKey === 'function' ? todayVisitKey() : '';
    if (saved.visitDate && today && saved.visitDate !== today) return false;
    return (saved.selectedIds || []).length > 0 || (saved.lockedIds || []).length > 0;
}

function findActiveProcedureChart() {
    const charts = typeof managedCharts !== 'undefined' ? managedCharts : [];
    return charts.find((chart) => isStoredProcedureSessionActive(chart.procedureSession)) || null;
}

async function persistProcedureSessionToChart() {
    if (typeof hasCurrentPatient === 'function' && !hasCurrentPatient()) return;
    if (typeof saveCurrentChartFromDom === 'function') {
        await saveCurrentChartFromDom();
        return;
    }
    const chart = typeof currentManagedChart === 'function' ? currentManagedChart() : null;
    if (!chart) return;
    const snap = snapshotProcedureSession();
    chart.procedureSession = isStoredProcedureSessionActive(snap) ? snap : null;
    if (typeof saveManagedChartRecord === 'function') await saveManagedChartRecord(chart);
}

async function clearStoredProcedureSession() {
    procedureSession = emptyProcedureSession(hasCurrentPatient() ? currentPatient.chartId : '');
    const chart = typeof currentManagedChart === 'function' ? currentManagedChart() : null;
    if (chart) chart.procedureSession = null;
}

function restoreProcedureSessionFromChart(chart) {
    const saved = chart?.procedureSession;
    if (!isStoredProcedureSessionActive(saved)) return false;
    const chartId = (typeof currentPatient !== 'undefined' ? currentPatient.chartId : '') || saved.chartId || '';
    if (saved.chartId && chartId && saved.chartId !== chartId) return false;

    isBedSanitised = true;
    pendingSanitise = false;
    if (typeof setModalBedSanitation === 'function') setModalBedSanitation(true);

    procedureSession = {
        chartId: chartId,
        selectedIds: (saved.selectedIds || []).map(String),
        deselectedIds: (saved.deselectedIds || []).map(String),
        lockedIds: (saved.lockedIds || saved.selectedIds || []).map(String),
        started: true,
        startedAt: saved.startedAt || new Date().toISOString(),
        completedAt: '',
        detailLesionId: saved.detailLesionId || '',
        complications: saved.complications || { none: true, bleeding: false, vasovagal: false, other: false },
        complicationNotes: saved.complicationNotes || ''
    };

    syncExLesionsFromProcedureSession();
    if (procedureSession.detailLesionId) {
        const lesion = (typeof chartLesions === 'function' ? chartLesions() : []).find((item) => String(item.id) === String(procedureSession.detailLesionId));
        if (lesion && typeof loadProcedureLesionIntoForm === 'function') loadProcedureLesionIntoForm(lesion);
    }
    if (typeof applyProcedureComplicationFields === 'function') applyProcedureComplicationFields();
    if (typeof renderProcedureWorkspace === 'function') renderProcedureWorkspace();
    if (typeof renderChartSidebar === 'function') renderChartSidebar();
    if (typeof updateOutput === 'function') updateOutput();
    return true;
}

function resetProcedureSession() {
    procedureSession = emptyProcedureSession(hasCurrentPatient() ? currentPatient.chartId : '');
    if (procedureSession.chartId) {
        procedureSession.selectedIds = procedureCandidateLesions().map((item) => String(item.id));
    }
    if (typeof resetExAll === 'function') resetExAll();
    closeProcedureCompleteModal();
}

function ensureProcedureSession() {
    const chartId = hasCurrentPatient() ? currentPatient.chartId : '';
    if (procedureSession.chartId !== chartId) {
        resetProcedureSession();
        return;
    }
    if (!procedureSession.started) {
        procedureCandidateLesions().forEach((item) => {
            const id = String(item.id);
            if (isProcedureDeselected(id) || isProcedureSelected(id)) return;
            procedureSession.selectedIds.push(id);
        });
    }
}

function isSameDayBiopsy(lesion) {
    if (!lesion || lesion.procedureCompletedAt) return false;
    if (typeof isDiagnosticBiopsyType === 'function' && !isDiagnosticBiopsyType(lesion)) return false;
    const status = typeof lesionLifecycleStatus === 'function' ? lesionLifecycleStatus(lesion) : (lesion.managementStatus || '');
    if (status === 'no_followup' || status === 'topical_followup' || status === 'awaiting_histology') return false;
    if (typeof isVisitLesion === 'function' && isVisitLesion(lesion.id)) return true;
    return typeof isLesionCreatedToday === 'function' && isLesionCreatedToday(lesion);
}

function isShaveProcedureCandidate(lesion) {
    if (!lesion || lesion.procedureCompletedAt) return false;
    if (typeof lesionType === 'function' ? lesionType(lesion) !== 'shave' : !(typeof isShaveBiopsyLesion === 'function' && isShaveBiopsyLesion(lesion))) return false;
    const status = typeof lesionLifecycleStatus === 'function' ? lesionLifecycleStatus(lesion) : (lesion.managementStatus || '');
    if (status === 'no_followup' || status === 'topical_followup' || status === 'awaiting_histology') return false;
    return true;
}

function isFormalExcisionCandidate(lesion) {
    if (!lesion || lesion.procedureCompletedAt) return false;
    const status = typeof lesionLifecycleStatus === 'function' ? lesionLifecycleStatus(lesion) : (lesion.managementStatus || '');
    if (status === 'no_followup' || status === 'topical_followup' || status === 'awaiting_histology') return false;
    if (typeof lesionType === 'function' && lesionType(lesion) === 'excision') return true;
    return String(lesion.plan || '').includes('Excision');
}

function offerLesionToProcedureSession(lesion) {
    if (!lesion) return;
    if (procedureSession.chartId !== (currentPatient.chartId || '')) return;
    const id = String(lesion.id);
    const status = typeof lesionLifecycleStatus === 'function' ? lesionLifecycleStatus(lesion) : (lesion.managementStatus || '');
    const t = typeof lesionType === 'function' ? lesionType(lesion) : '';
    const isPlanned = t === 'punch' || t === 'shave' || t === 'excision'
        || status === 'planned_procedure' || status === 'current_case'
        || isShaveProcedureCandidate(lesion) || isFormalExcisionCandidate(lesion) || isSameDayBiopsy(lesion);
    if (isPlanned && !isProcedureDeselected(id) && !isProcedureSelected(id)) {
        procedureSession.selectedIds.push(id);
    }
    if (typeof renderProcedureWorkspace === 'function') renderProcedureWorkspace();
    if (procedureSession.started && typeof persistProcedureSessionToChart === 'function') {
        persistProcedureSessionToChart().catch(() => {});
    }
    if (procedureSession.started && typeof refreshProcedureCompleteOutputs === 'function') {
        refreshProcedureCompleteOutputs();
    }
}

function procedureCandidateLesions() {
    if (typeof chartLesions !== 'function' || !hasCurrentPatient()) return [];
    return chartLesions().filter((item) => {
        if (item.procedureCompletedAt) return false;
        const status = typeof lesionLifecycleStatus === 'function' ? lesionLifecycleStatus(item) : (item.managementStatus || '');
        if (status === 'no_followup' || status === 'topical_followup' || status === 'awaiting_assessment' || status === 'awaiting_histology') {
            return false;
        }
        const t = typeof lesionType === 'function' ? lesionType(item) : '';
        return t === 'punch' || t === 'shave' || t === 'excision'
            || status === 'planned_procedure' || status === 'current_case'
            || isSameDayBiopsy(item) || isFormalExcisionCandidate(item) || isShaveProcedureCandidate(item);
    });
}

function procedureSelectedLesions() {
    const ids = new Set(procedureSession.selectedIds.map(String));
    return procedureCandidateLesions().filter((item) => ids.has(String(item.id)));
}

function isProcedureSelected(id) {
    return procedureSession.selectedIds.some((item) => String(item) === String(id));
}

function isProcedureDeselected(id) {
    return (procedureSession.deselectedIds || []).some((item) => String(item) === String(id));
}

function isProcedureAllocationLocked(id) {
    if (!procedureSession.started) return false;
    return (procedureSession.lockedIds || []).some((item) => String(item) === String(id));
}

function toggleProcedureAllocation(id, checked) {
    id = String(id);
    if (procedureSession.started && isProcedureAllocationLocked(id) && !checked) {
        showToast('This lesion is already part of the started procedure.');
        renderProcedureWorkspace();
        return;
    }
    if (checked) {
        if (!isProcedureSelected(id)) procedureSession.selectedIds.push(id);
        procedureSession.deselectedIds = (procedureSession.deselectedIds || []).filter((item) => item !== id);
        if (procedureSession.started && !(procedureSession.lockedIds || []).some((item) => String(item) === id)) {
            procedureSession.lockedIds = (procedureSession.lockedIds || []).concat([id]);
        }
    } else {
        procedureSession.selectedIds = procedureSession.selectedIds.filter((item) => item !== id);
        if (!isProcedureDeselected(id)) procedureSession.deselectedIds.push(id);
    }
    renderProcedureWorkspace();
    if (procedureSession.started && typeof persistProcedureSessionToChart === 'function') {
        persistProcedureSessionToChart().catch(() => {});
    }
}

function filledValue(value) {
    return !!(value && String(value).trim());
}

function firstSingleMm(value) {
    const text = String(value == null ? '' : value).trim();
    if (!text) return '';
    const nums = [...text.matchAll(/(\d+(?:\.\d+)?)/g)].map((match) => match[1]);
    return nums.length === 1 ? nums[0] : '';
}

function inferDermoscopyUsed(lesion) {
    const d = String(lesion?.dermoscopy || '').trim();
    if (!d || /^unspecified$/i.test(d) || /^to be examined$/i.test(d)) return '';
    return 'Y';
}

function procedureDetailForLesion(lesion) {
    const saved = lesion?.procedureDetail || {};
    const fromEx = (typeof exLesions !== 'undefined' ? exLesions : []).find((item) => String(item.sourceLesionId) === String(lesion?.id));
    let procedure = saved.procedure || fromEx?.procedure || lesion?.procedure || '';
    const closureHint = saved.excisionClosureType || fromEx?.excisionClosureType || lesion?.excisionClosureType || '';
    const hasExcisionMeasures = !!(saved.length || fromEx?.length || lesion?.excisionLengthMm);
    const formal = typeof isFormalExcisionCandidate === 'function' && isFormalExcisionCandidate(lesion);
    if (saved.procedure || fromEx?.procedure) {
        procedure = saved.procedure || fromEx?.procedure;
    } else if ((typeof lesionType === 'function' && lesionType(lesion) === 'shave') || String(lesion?.biopsyType || '').includes('Shave')) {
        procedure = 'Shave';
    } else if ((typeof lesionType === 'function' && lesionType(lesion) === 'punch') || String(lesion?.biopsyType || '').includes('Punch')) {
        procedure = 'Punch';
    } else if ((typeof lesionType === 'function' && lesionType(lesion) === 'excision') || /ellipse|flap|graft|secondary/i.test(closureHint) || formal || hasExcisionMeasures || String(lesion?.plan || '').includes('Excision') || lesion?.excisionFinalisedAt) {
        procedure = 'Excision';
    } else if (String(lesion?.plan || '').includes('Biopsy')) {
        procedure = 'Punch';
    }
    const rawPathology = saved.pathology || fromEx?.pathology || lesion?.impression || '';
    const pathology = typeof normalizePathologyString === 'function' ? normalizePathologyString(rawPathology) : rawPathology;
    return {
        procedure,
        excisionClosureType: saved.excisionClosureType || fromEx?.excisionClosureType || lesion?.excisionClosureType || '',
        punchType: (() => {
            if (procedure !== 'Punch') return '';
            const raw = saved.punchType || fromEx?.punchType || lesion?.biopsyType || '';
            return /excision/i.test(raw) && !/biopsy/i.test(raw) ? 'Punch Excision' : 'Punch Biopsy';
        })(),
        graftType: saved.graftType || fromEx?.graftType || lesion?.graftType || '',
        justification: saved.justification || fromEx?.justification || '',
        location: saved.location || fromEx?.location || lesion?.location || '',
        pathology,
        dermoscopyUsed: saved.dermoscopyUsed || fromEx?.dermoscopyUsed || inferDermoscopyUsed(lesion),
        length: saved.length || fromEx?.length || lesion?.length || (procedure === 'Excision' ? lesion?.excisionLengthMm : '') || '',
        width: saved.width || fromEx?.width || lesion?.width || (procedure === 'Excision' ? lesion?.excisionWidthMm : '') || '',
        margin: saved.margin || fromEx?.margin || lesion?.margin || (procedure === 'Excision' ? (lesion?.excisionMarginMm || firstSingleMm(lesion?.excisionMargin)) : '') || '',
        punchSize: saved.punchSize || fromEx?.punchSize || lesion?.punchSize || '',
        billingRegion: saved.billingRegion || fromEx?.billingRegion || lesion?.billingRegion || '',
        anesthetic: saved.anesthetic || fromEx?.anesthetic || '',
        prep: saved.prep || fromEx?.prep || '',
        excludeNMSC: !!(saved.excludeNMSC || fromEx?.excludeNMSC),
        excludeMelanoma: !!(saved.excludeMelanoma || fromEx?.excludeMelanoma),
        orientationType: saved.orientationType || fromEx?.orientationType || '',
        orientationDescription: saved.orientationDescription || fromEx?.orientationDescription || '',
        skinSutureSize: saved.skinSutureSize || fromEx?.skinSutureSize || '',
        skinSutureType: saved.skinSutureType || fromEx?.skinSutureType || '',
        skinSutureRemoval: saved.skinSutureRemoval || fromEx?.skinSutureRemoval || ''
    };
}

function isProcedureDetailComplete(detail) {
    if (!filledValue(detail?.procedure) || !filledValue(detail.location) || !filledValue(detail.pathology) || !filledValue(detail.dermoscopyUsed)) {
        return false;
    }
    switch (detail.procedure) {
        case 'Excision': {
            if (!filledValue(detail.length) || !filledValue(detail.width) || !filledValue(detail.margin) || !filledValue(detail.billingRegion)) return false;
            const closureVal = detail.excisionClosureType || '';
            const isComplex = closureVal === 'Graft' || closureVal === 'Flap' || closureVal === 'Graft + Flap';
            if (isComplex && !filledValue(detail.justification)) return false;
            if ((closureVal === 'Graft' || closureVal === 'Graft + Flap') && !filledValue(detail.graftType)) return false;
            return true;
        }
        case 'Punch': {
            const punchTypeVal = detail.punchType || 'Punch Biopsy';
            if (punchTypeVal === 'Punch Biopsy') {
                return filledValue(detail.punchSize) && filledValue(detail.billingRegion);
            }
            return filledValue(detail.length) && filledValue(detail.width) && filledValue(detail.margin) && filledValue(detail.billingRegion);
        }
        case 'Shave':
            return filledValue(detail.billingRegion);
        default:
            return false;
    }
}

function isProcedureDetailReady(lesion) {
    return isProcedureDetailComplete(procedureDetailForLesion(lesion));
}

function isProcedureLesionReady(lesion) {
    if (!isProcedureDetailReady(lesion)) return false;
    if (typeof lesionHasProcedureConsent === 'function' && !lesionHasProcedureConsent(lesion)) return false;
    return true;
}

function selectedLesionsNotReady() {
    return procedureSelectedLesions().filter((item) => !isProcedureDetailReady(item));
}

function selectedLesionsMissingConsent() {
    return procedureSelectedLesions().filter((item) => typeof lesionHasProcedureConsent === 'function' && !lesionHasProcedureConsent(item));
}

function canStartProcedure() {
    const selected = procedureSelectedLesions();
    return selected.length > 0 && selected.every(isProcedureLesionReady);
}

function collectProcedureDetailFromForm() {
    const getVal = (elId) => document.getElementById(elId)?.value || '';
    const getChk = (elId) => !!document.getElementById(elId)?.checked;
    const procedure = getVal('exProcedureType');
    return {
        procedure,
        excisionClosureType: procedure === 'Excision' ? getVal('exExcisionClosureType') : '',
        punchType: procedure === 'Punch' ? getVal('exPunchType') : '',
        graftType: getVal('exGraftType'),
        justification: getVal('exFlapGraftJustification'),
        location: getVal('exLesionLocation'),
        pathology: getVal('exProvisionalDiagnoses'),
        dermoscopyUsed: getVal('exDermoscopyUsed'),
        length: (procedure === 'Punch' && getVal('exPunchType') !== 'Punch Excision') ? '' : getVal('exLesionLength'),
        width: (procedure === 'Punch' && getVal('exPunchType') !== 'Punch Excision') ? '' : getVal('exLesionWidth'),
        margin: (procedure === 'Punch' && getVal('exPunchType') !== 'Punch Excision') ? '' : getVal('exMargin'),
        punchSize: (procedure === 'Punch' && getVal('exPunchType') !== 'Punch Excision') ? getVal('exPunchSize') : '',
        billingRegion: getVal('exBillingRegion'),
        anesthetic: getVal('exLocalAnesthetic'),
        prep: getVal('exSkinPrep'),
        excludeNMSC: getChk('exExcludeNMSC'),
        excludeMelanoma: getChk('exExcludeMelanoma'),
        orientationType: getVal('exOrientationType'),
        orientationDescription: getVal('exOrientationDescription'),
        skinSutureSize: getVal('exSkinSutureSize'),
        skinSutureType: document.getElementById('exUseNonDissolvable')?.checked ? getVal('exSkinSutureType') : 'Dissolvable',
        skinSutureRemoval: document.getElementById('exUseNonDissolvable')?.checked ? getVal('exRemovalOfSkinSutures') : ''
    };
}

function formatProcedureComplications() {
    const flags = procedureSession.complications || {};
    const parts = [];
    if (flags.none && !flags.bleeding && !flags.vasovagal && !flags.other) parts.push('Uneventful. No complications.');
    if (flags.bleeding) parts.push('Bleeding / haematoma.');
    if (flags.vasovagal) parts.push('Vasovagal episode.');
    if (flags.other) parts.push('Other complication.');
    const notes = String(procedureSession.complicationNotes || '').trim();
    if (notes) parts.push(notes);
    return parts.join(' ');
}

function updateProcedureComplications() {
    const none = !!document.getElementById('procCompNone')?.checked;
    const bleeding = !!document.getElementById('procCompBleeding')?.checked;
    const vasovagal = !!document.getElementById('procCompVasovagal')?.checked;
    const other = !!document.getElementById('procCompOther')?.checked;
    if (none && (bleeding || vasovagal || other)) {
        const noneEl = document.getElementById('procCompNone');
        if (noneEl) noneEl.checked = false;
    }
    procedureSession.complications = {
        none: !!document.getElementById('procCompNone')?.checked,
        bleeding,
        vasovagal,
        other
    };
    procedureSession.complicationNotes = document.getElementById('procCompNotes')?.value || '';
    if (typeof updateOutput === 'function') updateOutput();
    refreshProcedureCompleteOutputs();
    if (typeof scheduleChartSave === 'function') scheduleChartSave();
}

function applyProcedureComplicationFields() {
    const flags = procedureSession.complications || {};
    const setChk = (id, on) => {
        const el = document.getElementById(id);
        if (el) el.checked = !!on;
    };
    setChk('procCompNone', flags.none);
    setChk('procCompBleeding', flags.bleeding);
    setChk('procCompVasovagal', flags.vasovagal);
    setChk('procCompOther', flags.other);
    const notes = document.getElementById('procCompNotes');
    if (notes) notes.value = procedureSession.complicationNotes || '';
}

function exLesionForChartId(id) {
    return (typeof exLesions !== 'undefined' ? exLesions : []).find((item) => String(item.sourceLesionId) === String(id));
}

function loadProcedureLesionIntoForm(lesion) {
    const existing = exLesionForChartId(lesion.id);
    if (existing && typeof startEditExLesion === 'function') {
        startEditExLesion(existing.id);
    } else {
        if (typeof resetExLesionForm === 'function') resetExLesionForm();
        const detail = procedureDetailForLesion(lesion);
        const setVal = (elId, val) => {
            const el = document.getElementById(elId);
            if (el && val !== undefined && val !== null && val !== '') el.value = String(val);
        };
        setVal('exLesionLocation', detail.location);
        const pathology = typeof normalizePathologyString === 'function' ? normalizePathologyString(detail.pathology) : detail.pathology;
        setVal('exProvisionalDiagnoses', pathology);
        if (typeof setProcedurePathologyDisplay === 'function') setProcedurePathologyDisplay(pathology);
        if (detail.procedure) setVal('exProcedureType', detail.procedure);
        if (typeof updateExFormUI === 'function') updateExFormUI();
        setVal('exExcisionClosureType', detail.excisionClosureType);
        setVal('exPunchType', detail.punchType);
        setVal('exGraftType', detail.graftType);
        setVal('exFlapGraftJustification', detail.justification);
        setVal('exBillingRegion', detail.billingRegion);
        populateProcSupplySelects(detail);
        setVal('exLocalAnesthetic', detail.anesthetic);
        setVal('exSkinPrep', detail.prep);
        setVal('exLesionLength', detail.length);
        setVal('exLesionWidth', detail.width);
        setVal('exMargin', detail.margin);
        setVal('exPunchSize', detail.punchSize);
        setVal('exDermoscopyUsed', detail.dermoscopyUsed);
        if (typeof syncExDermoscopyButtons === 'function') syncExDermoscopyButtons();
        setVal('exOrientationType', detail.orientationType);
        setVal('exOrientationDescription', detail.orientationDescription);
        setVal('exSkinSutureSize', detail.skinSutureSize);
        setVal('exSkinSutureType', detail.skinSutureType);
        setVal('exRemovalOfSkinSutures', detail.skinSutureRemoval);
        const nmsc = document.getElementById('exExcludeNMSC');
        if (nmsc) nmsc.checked = !!detail.excludeNMSC;
        const mel = document.getElementById('exExcludeMelanoma');
        if (mel) mel.checked = !!detail.excludeMelanoma;
        if (typeof updateExFormUI === 'function') updateExFormUI();
    }

    const title = document.getElementById('ex-form-title');
    if (title) {
        const headingDetail = procedureDetailForLesion(lesion);
        const t = typeof lesionType === 'function' ? lesionType(lesion) : '';
        const tag = headingDetail.procedure === 'Excision' || t === 'excision' || isFormalExcisionCandidate(lesion)
            ? 'Excision: '
            : (headingDetail.procedure === 'Shave' || t === 'shave'
                ? 'Shave: '
                : (t === 'punch' || isSameDayBiopsy(lesion) ? 'Punch: ' : 'Procedure data: '));
        title.textContent = tag + (lesion.location || '');
    }
    const saveBtn = document.getElementById('ex-add-lesion-btn');
    if (saveBtn) saveBtn.textContent = isProcedureAllocationLocked(lesion.id) ? 'Locked after start' : 'Save lesion data';
    if (typeof checkExFormCompleteness === 'function') checkExFormCompleteness();
}

function openProcedureLesionDetail(id) {
    ensureProcedureSession();
    const lesion = (typeof chartLesions === 'function' ? chartLesions() : []).find((item) => String(item.id) === String(id));
    if (!lesion) return;
    procedureSession.detailLesionId = String(id);
    loadProcedureLesionIntoForm(lesion);
    renderProcedureWorkspace();
    if (typeof scheduleChartSave === 'function') scheduleChartSave();
}

function syncProcedureFormToChart(id) {
    if (!id) return;
    let lesion = (typeof chartLesions === 'function' ? chartLesions() : []).find((item) => String(item.id) === String(id));
    if (!lesion) return;
    const detail = collectProcedureDetailFromForm();
    lesion.procedureDetail = detail;
    if (detail.procedure === 'Excision' || (detail.procedure === 'Punch' && detail.punchType === 'Punch Excision')) {
        lesion.excisionLengthMm = detail.length || lesion.excisionLengthMm;
        lesion.excisionWidthMm = detail.width || lesion.excisionWidthMm;
        lesion.excisionMarginMm = detail.margin || lesion.excisionMarginMm;
        lesion.excisionMargin = lesion.excisionMargin || (detail.margin ? detail.margin + 'mm' : lesion.excisionMargin);
        lesion.excisionClosureType = detail.excisionClosureType || lesion.excisionClosureType;
    } else {
        lesion.excisionClosureType = '';
        lesion.billingReconstruction = '';
    }
    lesion.length = detail.length || '';
    lesion.width = detail.width || '';
    lesion.margin = detail.procedure === 'Punch' && detail.punchType !== 'Punch Excision' ? '' : (detail.margin || '');
    lesion.punchSize = detail.punchSize || '';
    lesion.prep = detail.prep || '';
    if (detail.billingRegion) lesion.billingRegion = Number(detail.billingRegion);
    lesion.graftType = detail.graftType || lesion.graftType;
    lesion.billingGraftType = lesion.graftType;
    if (detail.pathology) lesion.impression = detail.pathology;
    if (detail.location) lesion.location = detail.location;
    if (detail.procedure === 'Punch' || detail.procedure === 'Shave') {
        lesion.biopsyType = detail.procedure === 'Punch' ? (detail.punchType || 'Punch Biopsy') : 'Shave / Deep Saucerisation';
        if (!(lesion.plan || '').includes('Biopsy')) lesion.plan = typeof PUNCH_SHAVE_BIOPSY_PLAN === 'string' ? PUNCH_SHAVE_BIOPSY_PLAN : 'Punch / Shave Biopsy';
        lesion.type = detail.procedure === 'Punch' && /excision/i.test(detail.punchType || '') && !/biopsy/i.test(detail.punchType || '')
            ? 'excision'
            : (detail.procedure === 'Shave' ? 'shave' : 'punch');
    }
    if (detail.procedure === 'Excision' && !(lesion.plan || '').includes('Excision')) {
        lesion.plan = 'Formally Book Excision Procedure';
        lesion.type = 'excision';
    }
    if (detail.procedure === 'Excision') lesion.type = 'excision';
    lesion.skinSutureSize = detail.skinSutureSize || lesion.skinSutureSize;
    lesion.skinSutureType = detail.skinSutureType || lesion.skinSutureType;
    lesion.skinSutureRemoval = detail.skinSutureRemoval || lesion.skinSutureRemoval;
    const sessionIdx = lesions.findIndex((item) => String(item.id) === String(id));
    if (sessionIdx !== -1) lesions[sessionIdx] = { ...lesions[sessionIdx], ...lesion };
    else lesions.push({ ...lesion });
    const managedIdx = managedLesions.findIndex((item) => String(item.id) === String(id));
    if (managedIdx !== -1) managedLesions[managedIdx] = { ...managedLesions[managedIdx], ...lesion };
    if (typeof persistSessionLesionToVault === 'function') {
        persistSessionLesionToVault(lesion).catch(() => {});
    }
}

function prepareExLesionEditForChart(id) {
    const existing = exLesionForChartId(id);
    editingExLesionId = existing ? existing.id : null;
}

function saveProcedureLesionFromForm() {
    const id = procedureSession.detailLesionId;
    if (isProcedureAllocationLocked(id)) {
        showToast('Lesion details are locked once the procedure has started.');
        return;
    }
    if (!id) {
        showToast('Click a lesion in the allocate list first.');
        return;
    }
    if (typeof isExFormComplete === 'function' && !isExFormComplete()) {
        if (typeof checkExFormCompleteness === 'function') checkExFormCompleteness();
        showToast('Fill the required procedure fields before saving.');
        return;
    }
    prepareExLesionEditForChart(id);
    syncProcedureFormToChart(id);
    if (typeof addOrUpdateExLesion === 'function') addOrUpdateExLesion();
    showToast('Lesion procedure data saved.');
    if (typeof renderChartSidebar === 'function') renderChartSidebar();
    if (typeof renderManagedLesions === 'function') renderManagedLesions();
    renderProcedureWorkspace();
}

function maybeSaveOpenProcedureForm() {
    const id = procedureSession.detailLesionId;
    if (!id || isProcedureAllocationLocked(id) || !isProcedureSelected(id)) return false;
    if (typeof isExFormComplete !== 'function' || !isExFormComplete()) return false;
    prepareExLesionEditForChart(id);
    syncProcedureFormToChart(id);
    if (typeof addOrUpdateExLesion === 'function') addOrUpdateExLesion();
    return true;
}

function upsertExLesionFromChart(lesion) {
    if (typeof exLesions === 'undefined' || !lesion) return;
    const detail = procedureDetailForLesion(lesion);
    if (!filledValue(detail.procedure) || !filledValue(detail.location)) return;
    const existing = exLesionForChartId(lesion.id);
    const next = {
        id: existing ? existing.id : (typeof exLesionCounter === 'number' ? ++exLesionCounter : exLesions.length + 1),
        sourceLesionId: String(lesion.id),
        procedure: detail.procedure,
        excisionClosureType: detail.excisionClosureType || '',
        punchType: detail.punchType || '',
        graftType: detail.graftType || '',
        justification: detail.justification || '',
        location: detail.location || '',
        patientName: lesion.patientName || currentPatient?.name || '',
        patientDob: lesion.patientDob || currentPatient?.dob || '',
        chartId: lesion.chartId || currentPatient?.chartId || '',
        billingRegion: detail.billingRegion || '',
        bodyAreaLabel: typeof procedureAreaLabel === 'function' ? procedureAreaLabel(detail.billingRegion) : '',
        anesthetic: detail.anesthetic || existing?.anesthetic || '',
        prep: detail.prep || existing?.prep || '',
        pathology: detail.pathology || '',
        excludeNMSC: !!detail.excludeNMSC,
        excludeMelanoma: !!detail.excludeMelanoma,
        dermoscopyUsed: detail.dermoscopyUsed || existing?.dermoscopyUsed || '',
        length: detail.length || '',
        width: detail.width || '',
        margin: detail.margin || '',
        punchSize: detail.punchSize || '',
        orientationType: detail.orientationType || existing?.orientationType || 'None',
        orientationDescription: detail.orientationDescription || existing?.orientationDescription || '',
        useDeepSuture: !!existing?.useDeepSuture,
        deepSutureSize: existing?.deepSutureSize || '',
        deepSutureType: existing?.deepSutureType || '',
        skinSutureSize: detail.skinSutureSize || existing?.skinSutureSize || '',
        skinSutureType: detail.skinSutureType || existing?.skinSutureType || '',
        skinSutureRemoval: detail.skinSutureRemoval || existing?.skinSutureRemoval || null
    };
    if (existing) {
        const idx = exLesions.findIndex((item) => item.id === existing.id);
        if (idx !== -1) exLesions[idx] = { ...existing, ...next, id: existing.id };
        return;
    }
    exLesions.push(next);
}

function syncExLesionsFromProcedureSession() {
    const ids = new Set((procedureSession.selectedIds || []).map(String));
    if (typeof exLesions !== 'undefined') {
        exLesions = exLesions.filter((item) => ids.has(String(item.sourceLesionId)));
    }
    procedureSelectedLesions().forEach(upsertExLesionFromChart);
    if (typeof updateExLesionsList === 'function') updateExLesionsList();
}

async function abortProcedureLesion(id) {
    id = String(id || '');
    if (!id) return;
    if (!procedureSession.started) {
        showToast('Start the procedure first, then return a lesion if it cannot be completed.');
        return;
    }
    if (!isProcedureSelected(id) && !isProcedureAllocationLocked(id)) {
        showToast('That lesion is not in this procedure.');
        return;
    }
    let lesion = (typeof managedLesions !== 'undefined' ? managedLesions : []).find((item) => String(item.id) === id)
        || (typeof chartLesions === 'function' ? chartLesions() : []).find((item) => String(item.id) === id);
    procedureSession.selectedIds = (procedureSession.selectedIds || []).filter((item) => String(item) !== id);
    procedureSession.lockedIds = (procedureSession.lockedIds || []).filter((item) => String(item) !== id);
    if (!isProcedureDeselected(id)) procedureSession.deselectedIds.push(id);
    if (String(procedureSession.detailLesionId) === id) procedureSession.detailLesionId = '';

    if (lesion) {
        const planAfter = typeof defaultPlanLine === 'function'
            ? defaultPlanLine({ ...lesion, managementStatus: 'planned_procedure', procedureCompletedAt: '' })
            : 'Planned procedure';
        lesion.procedureCompletedAt = '';
        lesion.managementStatus = 'planned_procedure';
        lesion.currentPlan = planAfter;
        if (typeof appendLesionTimeline === 'function') {
            appendLesionTimeline(lesion, {
                type: 'abort',
                note: 'Aborted during procedure',
                planAfter
            });
        }
        const sessionIdx = (typeof lesions !== 'undefined' ? lesions : []).findIndex((item) => String(item.id) === id);
        if (sessionIdx !== -1) lesions[sessionIdx] = { ...lesions[sessionIdx], ...lesion };
        const managedIdx = (typeof managedLesions !== 'undefined' ? managedLesions : []).findIndex((item) => String(item.id) === id);
        if (managedIdx !== -1) managedLesions[managedIdx] = { ...managedLesions[managedIdx], ...lesion };
        try {
            if (typeof setManagedLesionStatus === 'function' && typeof isVaultLoggedIn === 'function' && isVaultLoggedIn()) {
                await setManagedLesionStatus(lesion.id, 'planned_procedure', 'Aborted during procedure', {
                    type: lesion.type,
                    currentPlan: planAfter
                });
            }
        } catch (err) {
            lesion.managementStatus = 'planned_procedure';
        }
    }

    syncExLesionsFromProcedureSession();
    const remaining = procedureSession.selectedIds.length;
    if (!remaining) {
        procedureSession.started = false;
        closeProcedureCompleteModal();
        showToast('Returned to planned procedure. Nothing left in this session.');
    } else {
        showToast('Returned to planned procedure. Finish the remaining lesions when ready.');
    }
    if (typeof renderLesionsTable === 'function') renderLesionsTable();
    if (typeof renderChartSidebar === 'function') renderChartSidebar();
    if (typeof renderManagedLesions === 'function') renderManagedLesions();
    if (typeof updateOutput === 'function') updateOutput();
    renderProcedureWorkspace();
    refreshProcedureCompleteOutputs();
    if (typeof persistProcedureSessionToChart === 'function') {
        persistProcedureSessionToChart().catch(() => {});
    }
}

function renderProcedureAbortList() {
    const root = document.getElementById('procAbortList');
    if (!root) return;
    const selected = procedureSelectedLesions();
    if (!procedureSession.started) {
        root.innerHTML = '';
        return;
    }
    if (!selected.length) {
        root.innerHTML = '<p class="text-xs text-slate-500 italic">No lesions left in this procedure. Complete to end, or stay and allocate another.</p>';
        return;
    }
    root.innerHTML = selected.map((lesion) => {
        const safeId = String(lesion.id).replace(/'/g, '');
        const t = typeof lesionType === 'function' ? lesionType(lesion) : '';
        const tag = t === 'excision' ? 'Excision' : (t === 'shave' ? 'Shave' : (t === 'punch' ? 'Punch' : 'Procedure'));
        return `<button type="button" class="proc-abort-row" onclick="abortProcedureLesion('${safeId}')">
            <span class="min-w-0">
                <span class="block text-sm font-semibold text-slate-800 truncate">${escapeHtml(lesion.location || 'No site')}</span>
                <span class="block text-[11px] text-slate-500 truncate">${escapeHtml(tag)} · ${escapeHtml(lesion.impression || '')}</span>
            </span>
            <span class="proc-abort-label">Return to planned</span>
        </button>`;
    }).join('');
}

function toggleProcedureSession() {
    ensureProcedureSession();
    if (procedureSession.started) {
        openProcedureCompleteModal();
        return;
    }
    startProcedureSession();
}

function startProcedureSession() {
    maybeSaveOpenProcedureForm();
    if (!procedureSession.selectedIds.length) {
        showToast('Tick at least one lesion. Planned procedures start selected; untick any you are not doing now.');
        renderProcedureWorkspace();
        return;
    }
    const incomplete = selectedLesionsNotReady();
    if (incomplete.length) {
        showToast('Complete procedure details for: ' + incomplete.map((item) => item.location || 'unnamed lesion').join(', '));
        renderProcedureWorkspace();
        return;
    }
    const missingConsent = selectedLesionsMissingConsent();
    if (missingConsent.length) {
        showToast('Consent is required before starting. Open Surgical Consent and copy the form for: ' + missingConsent.map((item) => item.location || 'unnamed lesion').join(', '));
        renderProcedureWorkspace();
        return;
    }
    procedureSession.started = true;
    procedureSession.startedAt = new Date().toISOString();
    procedureSession.lockedIds = procedureSession.selectedIds.map(String);
    procedureSession.complications = procedureSession.complications || { none: true, bleeding: false, vasovagal: false, other: false };
    syncExLesionsFromProcedureSession();
    if (typeof updateOutput === 'function') updateOutput();
    renderProcedureWorkspace();
    if (typeof persistProcedureSessionToChart === 'function') {
        persistProcedureSessionToChart().catch(() => {});
    }
    openProcedureCompleteModal();
}

function openProcedureCompleteModal() {
    const modal = document.getElementById('procedureCompleteModal');
    if (!modal) return;
    syncExLesionsFromProcedureSession();
    applyProcedureComplicationFields();
    refreshProcedureCompleteOutputs();
    modal.classList.remove('hidden');
}

function closeProcedureCompleteModal() {
    const modal = document.getElementById('procedureCompleteModal');
    if (modal) modal.classList.add('hidden');
}

function procedureHistoTechnique(lesion) {
    const detail = procedureDetailForLesion(lesion);
    if (detail.procedure === 'Punch') return detail.punchType || 'Punch Biopsy';
    if (detail.procedure === 'Shave') return 'Shave / Deep Saucerisation';
    if (detail.procedure === 'Excision') return 'Formal excision';
    return lesion.biopsyType || 'Biopsy';
}

function procedurePathologyLesions() {
    return procedureSelectedLesions().map((lesion) => {
        const detail = procedureDetailForLesion(lesion);
        return {
            location: detail.location || lesion.location || 'Unspecified site',
            impression: detail.pathology || lesion.impression || '',
            biopsyType: procedureHistoTechnique(lesion),
            procedure: detail.procedure,
            excisionClosureType: detail.excisionClosureType || '',
            length: (detail.procedure === 'Punch' && (detail.punchType || 'Punch Biopsy') === 'Punch Biopsy') ? '' : detail.length,
            width: (detail.procedure === 'Punch' && (detail.punchType || 'Punch Biopsy') === 'Punch Biopsy') ? '' : detail.width,
            margin: (detail.procedure === 'Punch' && (detail.punchType || 'Punch Biopsy') === 'Punch Biopsy') ? '' : detail.margin,
            punchSize: detail.punchSize,
            orientationType: detail.orientationType || '',
            orientationDescription: detail.orientationDescription || '',
            macroscopic: lesion.macroscopic || '',
            dermoscopy: (lesion.dermoscopy && lesion.dermoscopy !== 'Unspecified') ? lesion.dermoscopy : ''
        };
    });
}

function procedurePathologyData() {
    if (typeof generatePathologyOutputs !== 'function') {
        return { slipText: '', reportText: '', requiresAttachment: false };
    }
    const specimens = procedurePathologyLesions();
    if (!specimens.length) {
        return { slipText: '', reportText: '', requiresAttachment: false };
    }
    return generatePathologyOutputs(specimens);
}

function refreshProcedureCompleteOutputs() {
    if (typeof renderProcedureAbortList === 'function') renderProcedureAbortList();
    const data = procedurePathologyData();
    const preview = document.getElementById('procHistoPreview');
    if (preview) preview.value = data.slipText || 'No allocated specimens yet.';
    const pathEl = document.getElementById('pathologyRequestText');
    if (pathEl) pathEl.value = data.slipText || '';
    const suppEl = document.getElementById('supplementaryReportText');
    if (suppEl) suppEl.value = data.reportText || '';
    const limitNote = document.getElementById('procHistoLimitNote');
    if (limitNote) {
        limitNote.classList.toggle('hidden', !data.requiresAttachment);
    }
    const printHint = document.getElementById('procHistoPrintHint');
    if (printHint) {
        printHint.textContent = data.requiresAttachment
            ? 'The request is too long for the pathology pad. Copy the short pad line, then print the attached report and staple it to the slip.'
            : 'Short enough for the pathology pad. Copy onto the pad.';
    }
    const printBtn = document.getElementById('btnProcPrintHisto');
    if (printBtn) {
        printBtn.classList.toggle('hidden', !data.requiresAttachment);
        printBtn.textContent = 'Print attached report';
    }
    const pathText = data.slipText || '';
    const histoCopied = outputCopyState.path.copied && outputCopyState.path.lastCopiedText === pathText;
    const histoBtn = document.getElementById('btnProcCopyHisto');
    if (histoBtn) {
        histoBtn.textContent = histoCopied ? 'Histology copied' : 'Copy histology request';
        histoBtn.className = histoCopied
            ? 'px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg cursor-pointer'
            : 'px-3 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-lg cursor-pointer';
    }
    refreshProcedureBillingPanel();
    const recPreview = document.getElementById('procReceptionPreview');
    const recText = typeof generateReceptionMessage === 'function' ? generateReceptionMessage() : '';
    if (recPreview) recPreview.value = recText;
    const recCopied = outputCopyState.rec.copied && outputCopyState.rec.lastCopiedText === recText;
    const recBtn = document.getElementById('btnProcCopyRec');
    if (recBtn) {
        recBtn.textContent = recCopied ? 'Reception message copied' : 'Copy message to reception';
        recBtn.className = recCopied
            ? 'px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg cursor-pointer'
            : 'px-3 py-2 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold rounded-lg cursor-pointer';
    }
}

function procedureRosLine(lesion) {
    const detail = procedureDetailForLesion(lesion);
    const site = detail.location || lesion.location || 'site';
    if (detail.procedure === 'Shave' || detail.excisionClosureType === 'Secondary Intention') {
        return site + ': no ROS (open wound)';
    }
    if (detail.skinSutureType === 'Dissolvable') {
        return site + ': dissolvable — no ROS';
    }
    if (detail.skinSutureRemoval) {
        return site + ': ROS ' + detail.skinSutureRemoval + ' days';
    }
    if (detail.procedure === 'Punch' || detail.procedure === 'Excision') {
        return site + ': ROS TBC';
    }
    return '';
}

function procedureRosSummary(lesionList) {
    return (lesionList || []).map(procedureRosLine).filter(Boolean).join('; ');
}

function refreshProcedureBillingPanel() {
    const banner = document.getElementById('procBillingBanner');
    const rowsEl = document.getElementById('procBillingRows');
    if (!banner || !rowsEl) return;
    const selected = procedureSelectedLesions();
    if (!selected.length) {
        banner.className = 'text-xs rounded-lg px-3 py-2 border border-slate-200 bg-slate-50 text-slate-600';
        banner.textContent = 'Allocate lesions to see whether billing can be processed now or must be held.';
        rowsEl.innerHTML = '';
        return;
    }
    const summary = typeof procedureSessionBillingSummary === 'function'
        ? procedureSessionBillingSummary(selected)
        : { rows: [], allProcess: false, allHold: false, mixed: false };
    if (summary.allReady) {
        banner.className = 'text-xs rounded-lg px-3 py-2 border border-emerald-300 bg-emerald-50 text-emerald-900 font-semibold';
        banner.textContent = 'Every lesion in this set can be billed today (punch/shave 30071, suspected melanoma, or histology confirmed). Codes below. Complete will mark them billed.';
    } else if (summary.allProcess) {
        banner.className = 'text-xs rounded-lg px-3 py-2 border border-emerald-300 bg-emerald-50 text-emerald-900 font-semibold';
        banner.textContent = 'All procedures are OK to bill today, but some codes still need procedure area or size. Enter those, then Complete.';
    } else if (summary.allHold) {
        banner.className = 'text-xs rounded-lg px-3 py-2 border border-amber-300 bg-amber-50 text-amber-950 font-semibold';
        banner.textContent = 'Hold billing for reception until histology is back. Do not process excision items unless you change a lesion to suspected melanoma.';
    } else {
        banner.className = 'text-xs rounded-lg px-3 py-2 border border-sky-300 bg-sky-50 text-sky-950 font-semibold';
        banner.textContent = 'Some procedures can be billed in Best Practice now. Hold the rest until histology is known.';
    }
    const listHtml = summary.rows.map((row) => {
        const id = String(row.lesion.id || '').replace(/'/g, '');
        const bill = typeof billingForLesion === 'function' ? billingForLesion(row.lesion.id) : null;
        const sent = typeof billingHasBeenSent === 'function' && billingHasBeenSent(bill);
        const badge = row.hold
            ? '<span class="text-[10px] font-bold uppercase tracking-wider text-amber-800 bg-amber-100 px-1.5 py-0.5 rounded">Hold</span>'
            : '<span class="text-[10px] font-bold uppercase tracking-wider text-emerald-800 bg-emerald-100 px-1.5 py-0.5 rounded">Bill today</span>';
        const action = sent
            ? '<span class="text-[11px] font-semibold text-emerald-800">Billed</span>'
            : (summary.allReady
                ? '<span class="text-[11px] font-semibold text-emerald-800">Billed on Complete</span>'
                : (row.ok
                    ? `<button type="button" onclick="openProcessBillingModal('${id}')" class="mgmt-action-btn mgmt-action-btn-primary">Confirm billing</button>`
                    : '<span class="text-[11px] text-amber-800">Hold for histology</span>'));
        return `<div class="flex flex-wrap items-start justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2">
            <div class="min-w-0">
                <p class="text-sm font-semibold text-slate-800">${escapeHtml(row.site)} · ${escapeHtml(row.tag || '')} ${badge}</p>
                <p class="text-[11px] text-slate-600">${escapeHtml(row.reason)}</p>
                ${row.codes ? `<p class="text-sm font-mono font-bold text-slate-900 mt-0.5">${escapeHtml(row.codes)}</p>` : ''}
            </div>
            <div class="shrink-0">${action}</div>
        </div>`;
    }).join('');
    const copyBlock = summary.allProcess && summary.doctorText
        ? `<div class="flex flex-wrap items-center justify-between gap-2">
                <p class="text-[11px] text-slate-500">Also claim 23 if a consult was performed today.</p>
                <button type="button" onclick="copyProcedureBillingCodes()" class="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white text-[11px] font-bold rounded-lg cursor-pointer">Copy billing codes</button>
           </div>`
        : '';
    rowsEl.innerHTML = copyBlock + listHtml;
}

function copyProcedureBillingCodes() {
    const selected = procedureSelectedLesions();
    const summary = typeof procedureSessionBillingSummary === 'function'
        ? procedureSessionBillingSummary(selected)
        : null;
    const text = summary?.doctorText || '';
    if (!text) {
        showToast('No billing codes to copy yet.');
        return;
    }
    copyTextToClipboard(text, 'Billing codes copied.');
}

function copyProcedureReceptionMessage() {
    const text = typeof generateReceptionMessage === 'function' ? generateReceptionMessage() : '';
    if (!text) {
        showToast('No reception message yet.');
        return;
    }
    copyTextToClipboard(text, 'Reception message copied.', () => {
        if (typeof markOutputCopied === 'function') markOutputCopied('rec', text);
        refreshProcedureCompleteOutputs();
    });
}

function copyProcedureHistology() {
    const data = procedurePathologyData();
    if (!data.slipText) {
        showToast('No histology request to copy yet.');
        return;
    }
    copyTextToClipboard(data.slipText, 'Histology request copied.', () => {
        if (typeof markOutputCopied === 'function') markOutputCopied('path', data.slipText);
        if (data.reportText && typeof markOutputCopied === 'function') markOutputCopied('supp', data.reportText);
        refreshProcedureCompleteOutputs();
    });
}

function printProcedureHistology() {
    const specimens = procedurePathologyLesions();
    if (!specimens.length) {
        showToast('No allocated specimens to print.');
        return;
    }
    if (typeof printSupplementaryReportSheet === 'function') {
        printSupplementaryReportSheet(specimens);
        refreshProcedureCompleteOutputs();
    }
}

function copyProcedureInteractionNote() {
    showToast('Use Today’s clinical note on the Examination chart rail. It rebuilds the full visit note.');
    if (typeof switchWorkspaceTab === 'function' && typeof isBedSanitised !== 'undefined' && isBedSanitised) {
        switchWorkspaceTab('skin-check');
    }
}

async function endProcedureSession() {
    updateProcedureComplications();
    const incomplete = selectedLesionsNotReady();
    if (incomplete.length) {
        showToast('Complete procedure details for: ' + incomplete.map((item) => item.location || 'unnamed lesion').join(', '));
        renderProcedureWorkspace();
        return;
    }
    const note = formatProcedureComplications();
    const ids = procedureSession.selectedIds.slice();
    if (!ids.length) {
        procedureSession.started = false;
        procedureSession.completedAt = new Date().toISOString();
        closeProcedureCompleteModal();
        renderProcedureWorkspace();
        if (typeof persistProcedureSessionToChart === 'function') {
            persistProcedureSessionToChart().catch(() => {});
        }
        return;
    }
    for (const id of ids) {
        let lesion = managedLesions.find((item) => String(item.id) === String(id))
            || (typeof chartLesions === 'function' ? chartLesions() : []).find((item) => String(item.id) === String(id));
        if (!lesion) continue;
        lesion.procedureCompletedAt = new Date().toISOString();
        lesion.procedureComplications = note;
        lesion.managementStatus = 'awaiting_histology';
        lesion.schemaVersion = typeof LESION_SCHEMA_VERSION !== 'undefined' ? LESION_SCHEMA_VERSION : 2;
        lesion.currentPlan = 'Awaiting histology';
        if (typeof appendLesionTimeline === 'function') {
            appendLesionTimeline(lesion, {
                type: 'procedure',
                note: note || 'Procedure completed',
                planAfter: 'Awaiting histology'
            });
        }
        const sessionIdx = lesions.findIndex((item) => String(item.id) === String(id));
        if (sessionIdx !== -1) lesions[sessionIdx] = { ...lesions[sessionIdx], ...lesion };
        try {
            if (typeof persistSessionLesionToVault === 'function' && isVaultLoggedIn()) {
                await persistSessionLesionToVault(lesion);
            }
            if (typeof setManagedLesionStatus === 'function' && isVaultLoggedIn()) {
                await setManagedLesionStatus(id, 'awaiting_histology', note || 'Procedure completed');
            }
            if (typeof createOrUpdateBillingFromLesion === 'function') {
                await createOrUpdateBillingFromLesion(lesion);
            }
        } catch (err) {
            lesion.managementStatus = 'awaiting_histology';
            if (typeof createOrUpdateBillingFromLesion === 'function') {
                try { await createOrUpdateBillingFromLesion(lesion); } catch (billErr) { /* in-memory billing still attempted */ }
            }
        }
    }
    const finishedLesions = ids.map((id) => managedLesions.find((item) => String(item.id) === String(id))).filter(Boolean);
    let billedSameDay = null;
    if (typeof confirmSameDaySessionBilling === 'function') {
        billedSameDay = await confirmSameDaySessionBilling(finishedLesions);
    }
    procedureSession.started = false;
    procedureSession.completedAt = new Date().toISOString();
    procedureSession.selectedIds = [];
    procedureSession.detailLesionId = '';
    closeProcedureCompleteModal();
    const billed = typeof procedureSessionBillingSummary === 'function'
        ? procedureSessionBillingSummary(finishedLesions)
        : null;
    if (billedSameDay?.confirmed) {
        showToast('Procedure finished. Billing marked billed: ' + billedSameDay.codes.join(' · '));
    } else if (billed?.allProcess) {
        showToast('Procedure finished. Billing is OK to enter in Best Practice now.');
    } else if (billed?.allHold) {
        showToast('Procedure finished. Ask reception to HOLD billing until histology is back.');
    } else if (billed?.mixed) {
        showToast('Procedure finished. Process ready claims now; hold the rest for histology.');
    } else {
        showToast('Procedure finished. Lesions moved to awaiting histology for results, billing, and management planning.');
    }
    if (typeof renderLesionsTable === 'function') renderLesionsTable();
    if (typeof renderChartSidebar === 'function') renderChartSidebar();
    if (typeof renderManagedLesions === 'function') renderManagedLesions();
    if (typeof renderManagedLesions === 'function') renderManagedLesions();
    if (typeof updateOutput === 'function') updateOutput();
    if (typeof saveCurrentVisitNotes === 'function') {
        saveCurrentVisitNotes().catch(() => { /* snapshot is best-effort */ });
    }
    if (typeof persistProcedureSessionToChart === 'function') {
        persistProcedureSessionToChart().catch(() => {});
    }
    renderProcedureWorkspace();
}

function renderProcedureWorkspace() {
    ensureProcedureSession();
    const hint = document.getElementById('procSessionHint');
    const btn = document.getElementById('btnToggleProcedure');
    const count = document.getElementById('procAllocateCount');
    const list = document.getElementById('procAllocateList');
    const selected = procedureSelectedLesions();
    const detailsIncomplete = selected.filter((item) => !isProcedureDetailReady(item));
    const missingConsent = selected.filter((item) => isProcedureDetailReady(item)
        && typeof lesionHasProcedureConsent === 'function'
        && !lesionHasProcedureConsent(item));

    if (hint) {
        if (procedureSession.started) {
            hint.textContent = 'Procedure started. If a lesion cannot be completed, click it in Finish to return it to planned procedure.';
        } else if (!selected.length) {
            hint.textContent = 'Tick the lesions for this procedure. Planned punch, shave, and excision start selected; untick any you are not doing now.';
        } else if (detailsIncomplete.length) {
            hint.textContent = 'Orange lesions still need procedure details. Click a lesion, enter the data, save, then start.';
        } else if (missingConsent.length) {
            hint.textContent = 'Purple lesions still need consent. Open Surgical Consent, generate for those sites, then start.';
        } else {
            hint.textContent = 'Selected lesions are ready. Start procedure to document complications and copy outputs.';
        }
    }
    if (btn) {
        if (procedureSession.started) {
            btn.textContent = 'Finish procedure';
            btn.disabled = false;
            btn.className = 'px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-lg cursor-pointer';
            btn.setAttribute('aria-pressed', 'true');
            btn.title = 'Open Finish procedure to copy notes and record complications';
        } else {
            const ready = canStartProcedure();
            btn.textContent = 'Start procedure';
            btn.disabled = !ready;
            btn.className = ready
                ? 'px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg cursor-pointer'
                : 'px-4 py-2 bg-slate-300 text-slate-500 text-xs font-bold rounded-lg cursor-not-allowed';
            btn.setAttribute('aria-pressed', 'false');
            let title = 'Select lesions and complete their procedure details first';
            if (detailsIncomplete.length) title = 'Complete procedure details first';
            else if (missingConsent.length) title = 'Consent required — open Surgical Consent';
            else if (ready) title = 'Start procedure';
            btn.title = title;
        }
    }
    if (count) {
        const readyCount = selected.filter(isProcedureLesionReady).length;
        count.textContent = selected.length
            ? `${selected.length} allocated · ${readyCount} ready`
            : 'None allocated';
    }

    if (!list) {
        if (typeof renderProcedureAbortList === 'function') renderProcedureAbortList();
        return;
    }
    const candidates = procedureCandidateLesions();
    if (!candidates.length) {
        list.innerHTML = '<p class="text-xs text-slate-400 italic">No planned procedures on this chart yet. Add a punch, shave, or excision during examination.</p>';
        if (typeof renderProcedureAbortList === 'function') renderProcedureAbortList();
        return;
    }

    list.innerHTML = candidates.map((lesion) => {
        const id = String(lesion.id);
        const checked = isProcedureSelected(id);
        const detailsOk = isProcedureDetailReady(lesion);
        const consentOk = typeof lesionHasProcedureConsent !== 'function' || lesionHasProcedureConsent(lesion);
        const ready = detailsOk && consentOk;
        const t = typeof lesionType === 'function' ? lesionType(lesion) : '';
        const tag = t === 'excision' || isFormalExcisionCandidate(lesion)
            ? 'Excision'
            : (t === 'shave' ? 'Shave' : (t === 'punch' ? 'Punch' : 'Procedure'));
        const tagClass = t === 'shave' ? 'text-sky-800' : (t === 'punch' ? 'text-emerald-800' : 'text-purple-800');
        const locked = isProcedureAllocationLocked(id);
        const active = String(procedureSession.detailLesionId) === id;
        let statusClass = 'is-idle';
        let statusLabel = '';
        if (checked) {
            if (ready) {
                statusClass = 'is-ready';
                statusLabel = 'Ready';
            } else if (!detailsOk) {
                statusClass = 'is-incomplete';
                statusLabel = 'Incomplete';
            } else {
                statusClass = 'is-consent';
                statusLabel = 'Consent needed';
            }
        }
        const safeId = id.replace(/'/g, '');
        const abortBtn = procedureSession.started && locked
            ? `<button type="button" class="proc-abort-btn" onclick="abortProcedureLesion('${safeId}')">Abort</button>`
            : '';
        return `
            <div class="proc-allocate-row ${statusClass} ${active ? 'is-active' : ''}">
                <label class="proc-allocate-check">
                    <input type="checkbox" ${checked ? 'checked' : ''} ${locked ? 'disabled' : ''} onchange="toggleProcedureAllocation('${safeId}', this.checked)">
                </label>
                <button type="button" class="proc-allocate-body" onclick="openProcedureLesionDetail('${safeId}')">
                    <span class="flex items-center justify-between gap-2">
                        <span class="block text-sm font-semibold text-slate-800 truncate">${escapeHtml(lesion.location || 'No site')}</span>
                        ${statusLabel ? `<span class="proc-ready-pill">${statusLabel}</span>` : ''}
                    </span>
                    <span class="block text-[11px] text-slate-500 truncate">${escapeHtml(lesion.impression || '')} · ${escapeHtml(typeof lesionStatusLabel === 'function' ? lesionStatusLabel(lesion) : '')}</span>
                    <span class="mt-0.5 inline-block text-[10px] font-bold ${tagClass}">${tag}</span>
                </button>
                ${abortBtn}
            </div>`;
    }).join('');
    if (typeof renderProcedureAbortList === 'function') renderProcedureAbortList();
}
