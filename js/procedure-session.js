/* Procedure allocation: punch, shave, and excision share one planned queue. */

function emptySiteComplication() {
    return { none: true, bleeding: false, extraHaemostasis: false, other: false, notes: '' };
}

function emptyEpisodeComplications() {
    return { none: true, vasovagal: false, other: false };
}

function normalizeEpisodeComplications(raw) {
    const src = raw || {};
    const vasovagal = !!src.vasovagal;
    const other = !!src.other;
    return {
        none: !vasovagal && !other,
        vasovagal,
        other
    };
}

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
        complications: emptyEpisodeComplications(),
        complicationNotes: '',
        siteComplications: {},
        amendLesionId: '',
        amendPanel: ''
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
        complications: procedureSession.complications || emptyEpisodeComplications(),
        complicationNotes: procedureSession.complicationNotes || '',
        siteComplications: procedureSession.siteComplications && typeof procedureSession.siteComplications === 'object'
            ? procedureSession.siteComplications
            : {},
        amendLesionId: procedureSession.amendLesionId || '',
        amendPanel: procedureSession.amendPanel || '',
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
        complications: normalizeEpisodeComplications(saved.complications),
        complicationNotes: String(saved.complicationNotes || ''),
        siteComplications: saved.siteComplications && typeof saved.siteComplications === 'object'
            ? saved.siteComplications
            : {},
        amendLesionId: saved.amendLesionId || '',
        amendPanel: saved.amendPanel || ''
    };
    if (saved.complications?.bleeding && !Object.keys(procedureSession.siteComplications).length) {
        const extra = String(procedureSession.complicationNotes || '').trim();
        procedureSession.complicationNotes = extra
            ? extra
            : 'Bleeding / haematoma.';
        if (!procedureSession.complications.vasovagal) {
            procedureSession.complications.other = true;
            procedureSession.complications.none = false;
        }
    }

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
    if (!lesion || (typeof lesionProcedureDone === 'function' ? lesionProcedureDone(lesion) : lesion.procedureCompletedAt)) return false;
    if (typeof isDiagnosticBiopsyType === 'function' && !isDiagnosticBiopsyType(lesion)) return false;
    const status = typeof lesionLifecycleStatus === 'function' ? lesionLifecycleStatus(lesion) : (lesion.managementStatus || '');
    if (status === 'no_followup' || status === 'topical_followup' || status === 'awaiting_histology') return false;
    if (typeof isVisitLesion === 'function' && isVisitLesion(lesion.id)) return true;
    return typeof isLesionCreatedToday === 'function' && isLesionCreatedToday(lesion);
}

function isShaveProcedureCandidate(lesion) {
    if (!lesion || (typeof lesionProcedureDone === 'function' ? lesionProcedureDone(lesion) : lesion.procedureCompletedAt)) return false;
    if (typeof lesionType === 'function' ? lesionType(lesion) !== 'shave' : !(typeof isShaveBiopsyLesion === 'function' && isShaveBiopsyLesion(lesion))) return false;
    const status = typeof lesionLifecycleStatus === 'function' ? lesionLifecycleStatus(lesion) : (lesion.managementStatus || '');
    if (status === 'no_followup' || status === 'topical_followup' || status === 'awaiting_histology') return false;
    return true;
}

function isFormalExcisionCandidate(lesion) {
    if (!lesion || (typeof lesionProcedureDone === 'function' ? lesionProcedureDone(lesion) : lesion.procedureCompletedAt)) return false;
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
        if (typeof lesionProcedureDone === 'function' ? lesionProcedureDone(item) : item.procedureCompletedAt) return false;
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
        margin: (typeof parseMarginMm === 'function'
            ? parseMarginMm(saved.margin || fromEx?.margin || lesion?.margin || (procedure === 'Excision' ? (lesion?.excisionMarginMm || lesion?.excisionMargin) : '') || '')
            : (saved.margin || fromEx?.margin || lesion?.margin || (procedure === 'Excision' ? (lesion?.excisionMarginMm || firstSingleMm(lesion?.excisionMargin)) : '') || '')),
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
        skinSutureRemoval: saved.skinSutureRemoval || fromEx?.skinSutureRemoval || '',
        useDeepSuture: !!(saved.useDeepSuture || fromEx?.useDeepSuture),
        deepSutureSize: saved.deepSutureSize || fromEx?.deepSutureSize || '',
        deepSutureType: saved.deepSutureType || fromEx?.deepSutureType || ''
    };
}

function procedureDetailNeedsRos(detail) {
    if (!detail) return false;
    if (detail.procedure === 'Shave' || detail.excisionClosureType === 'Secondary Intention') return false;
    if (detail.procedure !== 'Punch' && detail.procedure !== 'Excision') return false;
    if (detail.skinSutureType === 'Dissolvable') return false;
    return true;
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
            break;
        }
        case 'Punch': {
            const punchTypeVal = detail.punchType || 'Punch Biopsy';
            if (punchTypeVal === 'Punch Biopsy') {
                if (!(filledValue(detail.punchSize) && filledValue(detail.billingRegion))) return false;
            } else if (!(filledValue(detail.length) && filledValue(detail.width) && filledValue(detail.margin) && filledValue(detail.billingRegion))) {
                return false;
            }
            break;
        }
        case 'Shave':
            if (!filledValue(detail.billingRegion)) return false;
            break;
        default:
            return false;
    }
    if (procedureDetailNeedsRos(detail) && !filledValue(detail.skinSutureRemoval)) return false;
    return true;
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
        useDeepSuture: getChk('exUseDeepSuture'),
        deepSutureSize: getChk('exUseDeepSuture') ? getVal('exDeepSutureSize') : '',
        deepSutureType: getChk('exUseDeepSuture') ? getVal('exDeepSutureType') : '',
        skinSutureSize: getVal('exSkinSutureSize'),
        skinSutureType: document.getElementById('exUseNonDissolvable')?.checked ? getVal('exSkinSutureType') : 'Dissolvable',
        skinSutureRemoval: document.getElementById('exUseNonDissolvable')?.checked ? getVal('exRemovalOfSkinSutures') : ''
    };
}

function procedureOutputLesions() {
    if (procedureSession.started && typeof procedureSelectedLesions === 'function') {
        return procedureSelectedLesions();
    }
    return (typeof chartLesions === 'function' ? chartLesions() : []).filter((item) => (
        typeof lesionPerformedToday === 'function' ? lesionPerformedToday(item) : !!item.procedureCompletedAt
    ));
}

function withSentenceEnd(text) {
    const t = String(text || '').trim();
    if (!t) return '';
    return /[.!?]$/.test(t) ? t : t + '.';
}

function episodeIsUneventful(flags, notes) {
    const src = flags || {};
    if (src.vasovagal || src.other || src.bleeding) return false;
    if (String(notes || '').trim()) return false;
    return true;
}

function formatEpisodeComplications() {
    const flags = procedureSession.complications || {};
    const notes = String(procedureSession.complicationNotes || '').trim();
    if (episodeIsUneventful(flags, notes)) return 'Uneventful. No complications.';
    const parts = [];
    if (flags.vasovagal) parts.push('Vasovagal episode.');
    if (flags.bleeding) parts.push('Bleeding / haematoma.');
    if (flags.other) parts.push('Other complication.');
    if (notes) parts.push(withSentenceEnd(notes));
    return parts.join(' ');
}

function siteComplicationRecord(id) {
    const rec = (procedureSession.siteComplications || {})[String(id)];
    return rec ? { ...emptySiteComplication(), ...rec } : emptySiteComplication();
}

function siteIsUneventful(rec) {
    const src = rec || {};
    if (src.bleeding || src.extraHaemostasis || src.other) return false;
    if (String(src.notes || '').trim()) return false;
    return true;
}

function formatSiteComplications(id) {
    const rec = siteComplicationRecord(id);
    if (siteIsUneventful(rec)) return 'Uneventful.';
    const parts = [];
    if (rec.bleeding) parts.push('Bleeding / haematoma.');
    if (rec.extraHaemostasis) parts.push('Extra haemostasis.');
    if (rec.other) parts.push('Other complication.');
    const notes = String(rec.notes || '').trim();
    if (notes) parts.push(withSentenceEnd(notes));
    return parts.join(' ');
}

function formatLiveProcedureComplications(lesionList) {
    const lesions = lesionList || (procedureSession.started
        ? (typeof procedureSelectedLesions === 'function' ? procedureSelectedLesions() : [])
        : procedureOutputLesions());
    const episodeQuiet = episodeIsUneventful(procedureSession.complications, procedureSession.complicationNotes);
    const episode = formatEpisodeComplications();
    const siteHits = [];
    (lesions || []).forEach((lesion) => {
        const rec = siteComplicationRecord(lesion.id);
        if (siteIsUneventful(rec)) return;
        siteHits.push((lesion.location || 'Site') + ': ' + formatSiteComplications(lesion.id));
    });
    if (episodeQuiet && !siteHits.length) return 'Uneventful. No complications.';
    const parts = [];
    if (!episodeQuiet) parts.push(episode);
    if (siteHits.length) parts.push(siteHits.join(' '));
    if (siteHits.length && lesions.length > siteHits.length) parts.push('Other sites uneventful.');
    return parts.filter(Boolean).join(' ');
}

function formatStoredProcedureComplications(lesions) {
    if (!lesions.length) return '';
    const episode = String(lesions.map((item) => item.procedureEpisodeComplications).find(Boolean) || '').trim();
    const episodeQuiet = !episode || /^uneventful/i.test(episode);
    const siteHits = [];
    lesions.forEach((lesion) => {
        const site = String(lesion.procedureSiteComplications || '').trim();
        if (!site || /^uneventful/i.test(site)) return;
        siteHits.push((lesion.location || 'Site') + ': ' + site);
    });
    if (episodeQuiet && !siteHits.length) {
        const legacy = lesions.map((item) => String(item.procedureComplications || '').trim()).find(Boolean);
        return episode || legacy || 'Uneventful. No complications.';
    }
    const parts = [];
    if (!episodeQuiet) parts.push(episode);
    if (siteHits.length) parts.push(siteHits.join(' '));
    if (siteHits.length && lesions.length > siteHits.length) parts.push('Other sites uneventful.');
    return parts.join(' ');
}

function formatProcedureComplications() {
    if (procedureSession.started) return formatLiveProcedureComplications();
    const lesions = procedureOutputLesions();
    if (lesions.some((item) => item.procedureEpisodeComplications || item.procedureSiteComplications)) {
        return formatStoredProcedureComplications(lesions);
    }
    if (procedureSession.completedAt) return formatLiveProcedureComplications(lesions);
    const legacy = lesions.map((item) => String(item.procedureComplications || '').trim()).find(Boolean);
    return legacy || '';
}

function formatLesionComplicationStamp(id) {
    const site = formatSiteComplications(id);
    const episode = formatEpisodeComplications();
    const siteQuiet = !site || /^uneventful/i.test(site);
    const episodeQuiet = episodeIsUneventful(procedureSession.complications, procedureSession.complicationNotes);
    if (siteQuiet && episodeQuiet) return 'Uneventful. No complications.';
    const parts = [];
    if (!siteQuiet) parts.push(site);
    if (!episodeQuiet) parts.push('Episode: ' + episode);
    return parts.join(' ');
}

function updateProcedureComplications(source) {
    const noneEl = document.getElementById('procCompNone');
    const vasoEl = document.getElementById('procCompVasovagal');
    const otherEl = document.getElementById('procCompOther');
    if (source === 'none' && noneEl?.checked) {
        if (vasoEl) vasoEl.checked = false;
        if (otherEl) otherEl.checked = false;
    } else if (source !== 'none' && (vasoEl?.checked || otherEl?.checked)) {
        if (noneEl) noneEl.checked = false;
    }
    const vasovagal = !!vasoEl?.checked;
    const other = !!otherEl?.checked;
    if (!vasovagal && !other && noneEl) noneEl.checked = true;
    procedureSession.complications = {
        none: !!noneEl?.checked && !vasovagal && !other,
        vasovagal,
        other
    };
    procedureSession.complicationNotes = document.getElementById('procCompNotes')?.value || '';
    if (typeof updateOutput === 'function') updateOutput();
    refreshProcedureCompleteOutputs({ skipLesionList: source === 'notes' });
    if (typeof scheduleChartSave === 'function') scheduleChartSave();
}

function applyProcedureComplicationFields() {
    const flags = procedureSession.complications || emptyEpisodeComplications();
    const setChk = (id, on) => {
        const el = document.getElementById(id);
        if (el) el.checked = !!on;
    };
    const uneventful = episodeIsUneventful(flags, procedureSession.complicationNotes);
    setChk('procCompNone', uneventful || flags.none);
    setChk('procCompVasovagal', flags.vasovagal);
    setChk('procCompOther', flags.other);
    const notes = document.getElementById('procCompNotes');
    if (notes) notes.value = procedureSession.complicationNotes || '';
}

function updateSiteComplications(id, source) {
    id = String(id || '');
    if (!id) return;
    const noneEl = document.getElementById('procSiteCompNone');
    const bleedEl = document.getElementById('procSiteCompBleeding');
    const haemEl = document.getElementById('procSiteCompHaemostasis');
    const otherEl = document.getElementById('procSiteCompOther');
    if (source === 'none' && noneEl?.checked) {
        if (bleedEl) bleedEl.checked = false;
        if (haemEl) haemEl.checked = false;
        if (otherEl) otherEl.checked = false;
    } else if (source !== 'none' && (bleedEl?.checked || haemEl?.checked || otherEl?.checked)) {
        if (noneEl) noneEl.checked = false;
    }
    const bleeding = !!bleedEl?.checked;
    const extraHaemostasis = !!haemEl?.checked;
    const other = !!otherEl?.checked;
    if (!bleeding && !extraHaemostasis && !other && noneEl) noneEl.checked = true;
    if (!procedureSession.siteComplications) procedureSession.siteComplications = {};
    procedureSession.siteComplications[id] = {
        none: !!noneEl?.checked && !bleeding && !extraHaemostasis && !other,
        bleeding,
        extraHaemostasis,
        other,
        notes: document.getElementById('procSiteCompNotes')?.value || ''
    };
    if (typeof updateOutput === 'function') updateOutput();
    refreshProcedureCompleteOutputs({ skipLesionList: source === 'notes' });
    if (typeof scheduleChartSave === 'function') scheduleChartSave();
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
        if (typeof setProcedurePathologyDisplay === 'function') setProcedurePathologyDisplay(pathology);
        else setVal('exProvisionalDiagnoses', pathology);
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
        const setChk = (elId, on) => {
            const el = document.getElementById(elId);
            if (el) el.checked = !!on;
        };
        setChk('exUseDeepSuture', detail.useDeepSuture);
        setVal('exDeepSutureSize', detail.deepSutureSize);
        setVal('exDeepSutureType', detail.deepSutureType);
        document.getElementById('ex-deep-suture-container')?.classList.toggle('hidden', !detail.useDeepSuture);
        const isNonDissolvable = detail.skinSutureType !== 'Dissolvable';
        setChk('exUseNonDissolvable', isNonDissolvable);
        document.getElementById('ex-skin-suture-details')?.classList.toggle('hidden', !isNonDissolvable);
        if (isNonDissolvable) {
            setVal('exSkinSutureSize', detail.skinSutureSize);
            setVal('exSkinSutureType', detail.skinSutureType);
            setVal('exRemovalOfSkinSutures', detail.skinSutureRemoval);
        }
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
        const tag = lesion.priorLesionId
            ? 'Re-excision: '
            : (headingDetail.procedure === 'Excision' || t === 'excision' || isFormalExcisionCandidate(lesion)
                ? 'Excision: '
                : (headingDetail.procedure === 'Shave' || t === 'shave'
                    ? 'Shave: '
                    : (t === 'punch' || isSameDayBiopsy(lesion) ? 'Punch: ' : 'Procedure data: ')));
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
        lesion.excisionMargin = lesion.excisionMargin || (detail.margin
            ? (typeof formatMarginDisplay === 'function' ? formatMarginDisplay(detail.margin) : (detail.margin + 'mm'))
            : lesion.excisionMargin);
        if (typeof suggestionMetaIfMatches === 'function') {
            const meta = suggestionMetaIfMatches('exMargin');
            if (meta) {
                lesion.suggestedMarginMm = meta.suggestedMm || detail.margin;
                lesion.marginSuggestionReason = meta.reason || '';
            }
        }
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
    lesion.useDeepSuture = !!detail.useDeepSuture;
    lesion.deepSutureSize = detail.deepSutureSize || '';
    lesion.deepSutureType = detail.deepSutureType || '';
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
        useDeepSuture: !!(detail.useDeepSuture || existing?.useDeepSuture),
        deepSutureSize: detail.deepSutureSize || existing?.deepSutureSize || '',
        deepSutureType: detail.deepSutureType || existing?.deepSutureType || '',
        skinSutureSize: detail.skinSutureSize || existing?.skinSutureSize || '',
        skinSutureType: detail.skinSutureType || existing?.skinSutureType || '',
        skinSutureRemoval: detail.skinSutureRemoval || existing?.skinSutureRemoval || null,
        histologyPot: lesion.histologyPot || existing?.histologyPot || ''
    };
    if (typeof attachPriorHistologyToExLesion === 'function') attachPriorHistologyToExLesion(next, lesion.id);
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
    if (procedureSession.siteComplications) delete procedureSession.siteComplications[id];
    if (String(procedureSession.amendLesionId) === id) {
        procedureSession.amendLesionId = '';
        procedureSession.amendPanel = '';
    }

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

function procedureSutureSummary(lesion) {
    const detail = typeof procedureDetailForLesion === 'function' ? procedureDetailForLesion(lesion) : {};
    if (detail.procedure === 'Shave' || detail.excisionClosureType === 'Secondary Intention') {
        return 'Open wound · no ROS';
    }
    const bits = [];
    if (detail.procedure === 'Excision' && detail.excisionClosureType) bits.push(detail.excisionClosureType);
    if (detail.useDeepSuture) {
        bits.push(('Deep ' + [detail.deepSutureSize, detail.deepSutureType].filter(Boolean).join(' ')).trim());
    }
    if (detail.skinSutureType === 'Dissolvable') {
        bits.push('Dissolvable skin');
    } else {
        const skin = [detail.skinSutureSize, detail.skinSutureType].filter(Boolean).join(' ');
        if (skin) bits.push(skin);
        bits.push(detail.skinSutureRemoval ? ('ROS ' + detail.skinSutureRemoval + 'd') : 'ROS TBC');
    }
    return bits.join(' · ') || 'Sutures not recorded';
}

function procedureAllowsSutureAmend(lesion) {
    const detail = typeof procedureDetailForLesion === 'function' ? procedureDetailForLesion(lesion) : {};
    return detail.procedure === 'Excision' || detail.procedure === 'Punch';
}

function toggleProcAmend(id, panel) {
    id = String(id || '');
    if (!id || !procedureSession.started) return;
    if (procedureSession.amendLesionId === id && procedureSession.amendPanel === panel) {
        procedureSession.amendLesionId = '';
        procedureSession.amendPanel = '';
    } else {
        procedureSession.amendLesionId = id;
        procedureSession.amendPanel = panel;
    }
    renderProcedureAbortList();
}

function onProcAmendClosureChange() {
    const closure = document.getElementById('procAmendClosure')?.value || '';
    const secondary = closure === 'Secondary Intention';
    document.getElementById('procAmendSutureFields')?.classList.toggle('hidden', secondary);
    document.getElementById('procAmendGraftWrap')?.classList.toggle('hidden', closure !== 'Graft' && closure !== 'Graft + Flap');
    document.getElementById('procAmendJustWrap')?.classList.toggle('hidden', closure !== 'Graft' && closure !== 'Flap' && closure !== 'Graft + Flap');
}

function fillProcAmendSelect(elId, items, selected, placeholder) {
    if (typeof fillSelectOptions === 'function') {
        fillSelectOptions(document.getElementById(elId), items, selected, placeholder);
        return;
    }
    const select = document.getElementById(elId);
    if (!select) return;
    const list = (items || []).slice();
    if (selected && !list.includes(selected)) list.push(selected);
    select.innerHTML = (placeholder ? `<option value="">${placeholder}</option>` : '') + list.map((item) => (
        `<option value="${escapeHtml(item)}"${item === selected ? ' selected' : ''}>${escapeHtml(item)}</option>`
    )).join('');
}

function populateProcAmendSutureSelects(detail) {
    const sutures = (typeof procSupplies !== 'undefined' && procSupplies.sutures)
        ? procSupplies.sutures
        : ['Vicryl', 'Monocryl', 'Prolene', 'Nylon'];
    fillProcAmendSelect('procAmendDeepType', sutures, detail.deepSutureType || 'Vicryl');
    fillProcAmendSelect('procAmendSkinType', sutures, detail.skinSutureType && detail.skinSutureType !== 'Dissolvable' ? detail.skinSutureType : 'Prolene');
}

function procSuturesPanelHtml(lesion) {
    const detail = procedureDetailForLesion(lesion);
    const safeId = String(lesion.id).replace(/'/g, '');
    const isExcision = detail.procedure === 'Excision';
    const closure = detail.excisionClosureType || 'Ellipse';
    const secondary = isExcision && closure === 'Secondary Intention';
    const showGraft = closure === 'Graft' || closure === 'Graft + Flap';
    const showJust = closure === 'Graft' || closure === 'Flap' || closure === 'Graft + Flap';
    const nonDissolvable = detail.skinSutureType !== 'Dissolvable';
    const sizeOpts = (selected) => ['3/0', '4/0', '5/0', '6/0'].map((size) => (
        `<option value="${size}"${size === selected ? ' selected' : ''}>${size}</option>`
    )).join('');
    const closureOpts = ['Ellipse', 'Secondary Intention', 'Flap', 'Graft', 'Graft + Flap'].map((value) => {
        const label = value === 'Ellipse' ? 'Simple ellipse' : (value === 'Secondary Intention' ? 'Secondary intention' : (value === 'Graft + Flap' ? 'Flap + Graft' : value));
        return `<option value="${value}"${value === closure ? ' selected' : ''}>${label}</option>`;
    }).join('');
    return `
        <div class="proc-amend-panel">
            <p class="text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-2">Closure / sutures used</p>
            ${isExcision ? `
                <label class="block text-[11px] font-semibold text-slate-600 mb-1">Closure</label>
                <select id="procAmendClosure" onchange="onProcAmendClosureChange()" class="w-full mb-2 bg-white border border-slate-300 rounded-lg p-2 text-xs">${closureOpts}</select>
                <div id="procAmendGraftWrap" class="${showGraft ? '' : 'hidden'} mb-2">
                    <label class="block text-[11px] font-semibold text-slate-600 mb-1">Graft type</label>
                    <select id="procAmendGraftType" class="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs">
                        <option value="Split-Skin Graft (SSG)"${detail.graftType === 'Split-Skin Graft (SSG)' ? ' selected' : ''}>Split-Skin Graft (SSG)</option>
                        <option value="Full-Thickness Skin Graft (FTSG)"${detail.graftType === 'Full-Thickness Skin Graft (FTSG)' ? ' selected' : ''}>Full-Thickness Skin Graft (FTSG)</option>
                    </select>
                </div>
                <div id="procAmendJustWrap" class="${showJust ? '' : 'hidden'} mb-2">
                    <label class="block text-[11px] font-semibold text-slate-600 mb-1">Justification</label>
                    <textarea id="procAmendJustification" rows="2" class="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs">${escapeHtml(detail.justification || '')}</textarea>
                </div>
            ` : `<input type="hidden" id="procAmendClosure" value="">`}
            <div id="procAmendSutureFields" class="${secondary ? 'hidden' : ''} space-y-2">
                <label class="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                    <input type="checkbox" id="procAmendDeep" ${detail.useDeepSuture ? 'checked' : ''} onchange="document.getElementById('procAmendDeepFields').classList.toggle('hidden', !this.checked)" class="rounded">
                    Deep sutures
                </label>
                <div id="procAmendDeepFields" class="${detail.useDeepSuture ? '' : 'hidden'} grid grid-cols-2 gap-2">
                    <select id="procAmendDeepSize" class="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs">${sizeOpts(detail.deepSutureSize || '4/0')}</select>
                    <select id="procAmendDeepType" class="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs"></select>
                </div>
                <label class="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                    <input type="checkbox" id="procAmendNonDissolvable" ${nonDissolvable ? 'checked' : ''} onchange="document.getElementById('procAmendSkinFields').classList.toggle('hidden', !this.checked)" class="rounded">
                    Non-dissolvable skin suture
                </label>
                <div id="procAmendSkinFields" class="${nonDissolvable ? '' : 'hidden'} grid grid-cols-2 gap-2">
                    <select id="procAmendSkinSize" class="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs">${sizeOpts(detail.skinSutureSize || '5/0')}</select>
                    <select id="procAmendSkinType" class="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs"></select>
                    <input type="number" id="procAmendRosDays" min="1" placeholder="ROS days" value="${escapeHtml(detail.skinSutureRemoval || '')}" class="col-span-2 w-full bg-white border border-slate-300 rounded-lg p-2 text-xs">
                </div>
            </div>
            <button type="button" onclick="applyProcIntraOpAmend('${safeId}')" class="mt-2 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-[11px] font-bold rounded-lg cursor-pointer">Save closure / sutures</button>
        </div>`;
}

function procSiteEventPanelHtml(lesion) {
    const rec = siteComplicationRecord(lesion.id);
    const uneventful = siteIsUneventful(rec);
    const safeId = String(lesion.id).replace(/'/g, '');
    return `
        <div class="proc-amend-panel">
            <p class="text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-2">This site</p>
            <div class="flex flex-wrap gap-3 text-sm">
                <label class="flex items-center gap-2 cursor-pointer"><input type="checkbox" id="procSiteCompNone" ${uneventful ? 'checked' : ''} onchange="updateSiteComplications('${safeId}', 'none')" class="rounded text-emerald-600"> Uneventful</label>
                <label class="flex items-center gap-2 cursor-pointer"><input type="checkbox" id="procSiteCompBleeding" ${rec.bleeding ? 'checked' : ''} onchange="updateSiteComplications('${safeId}', 'flag')" class="rounded text-amber-700"> Bleeding / haematoma</label>
                <label class="flex items-center gap-2 cursor-pointer"><input type="checkbox" id="procSiteCompHaemostasis" ${rec.extraHaemostasis ? 'checked' : ''} onchange="updateSiteComplications('${safeId}', 'flag')" class="rounded text-amber-700"> Extra haemostasis</label>
                <label class="flex items-center gap-2 cursor-pointer"><input type="checkbox" id="procSiteCompOther" ${rec.other ? 'checked' : ''} onchange="updateSiteComplications('${safeId}', 'flag')" class="rounded text-amber-700"> Other</label>
            </div>
            <textarea id="procSiteCompNotes" rows="2" oninput="updateSiteComplications('${safeId}', 'notes')" class="mt-2 w-full p-2 border border-amber-200 rounded-lg text-sm bg-white" placeholder="Site details — extra diathermy, dressing, delayed bleed…">${escapeHtml(rec.notes || '')}</textarea>
        </div>`;
}

function commitProcedureLesion(lesion) {
    if (!lesion?.id) return;
    const id = String(lesion.id);
    const sessionIdx = (typeof lesions !== 'undefined' ? lesions : []).findIndex((item) => String(item.id) === id);
    if (sessionIdx !== -1) lesions[sessionIdx] = { ...lesions[sessionIdx], ...lesion };
    else if (typeof lesions !== 'undefined') lesions.push({ ...lesion });
    const managedIdx = (typeof managedLesions !== 'undefined' ? managedLesions : []).findIndex((item) => String(item.id) === id);
    if (managedIdx !== -1) managedLesions[managedIdx] = { ...managedLesions[managedIdx], ...lesion };
    if (typeof persistSessionLesionToVault === 'function') persistSessionLesionToVault(lesion).catch(() => {});
}

function applyProcIntraOpAmend(id) {
    id = String(id || '');
    const lesion = (typeof managedLesions !== 'undefined' ? managedLesions : []).find((item) => String(item.id) === id)
        || (typeof chartLesions === 'function' ? chartLesions() : []).find((item) => String(item.id) === id);
    if (!lesion) {
        showToast('Could not find that lesion.');
        return;
    }
    const detail = { ...procedureDetailForLesion(lesion) };
    const getVal = (elId) => document.getElementById(elId)?.value || '';
    const getChk = (elId) => !!document.getElementById(elId)?.checked;
    if (detail.procedure === 'Excision') {
        const closure = getVal('procAmendClosure') || detail.excisionClosureType || 'Ellipse';
        detail.excisionClosureType = closure;
        lesion.excisionClosureType = closure;
        if (closure === 'Graft' || closure === 'Graft + Flap') {
            detail.graftType = getVal('procAmendGraftType') || detail.graftType;
            lesion.graftType = detail.graftType;
            lesion.billingGraftType = detail.graftType;
        }
        if (closure === 'Graft' || closure === 'Flap' || closure === 'Graft + Flap') {
            detail.justification = getVal('procAmendJustification');
            if (!filledValue(detail.justification)) {
                showToast('Add a justification for flap or graft.');
                return;
            }
        }
        if (closure === 'Secondary Intention') {
            detail.useDeepSuture = false;
            detail.deepSutureSize = '';
            detail.deepSutureType = '';
            detail.skinSutureSize = '';
            detail.skinSutureType = '';
            detail.skinSutureRemoval = '';
        }
    }
    const secondary = detail.procedure === 'Shave' || detail.excisionClosureType === 'Secondary Intention';
    if (!secondary) {
        const useDeep = getChk('procAmendDeep');
        detail.useDeepSuture = useDeep;
        detail.deepSutureSize = useDeep ? getVal('procAmendDeepSize') : '';
        detail.deepSutureType = useDeep ? getVal('procAmendDeepType') : '';
        const nonDissolvable = getChk('procAmendNonDissolvable');
        if (nonDissolvable) {
            detail.skinSutureSize = getVal('procAmendSkinSize');
            detail.skinSutureType = getVal('procAmendSkinType') || 'Prolene';
            detail.skinSutureRemoval = getVal('procAmendRosDays');
            if (!filledValue(detail.skinSutureRemoval)) {
                showToast('Enter ROS days for non-dissolvable sutures.');
                return;
            }
        } else {
            detail.skinSutureSize = getVal('procAmendSkinSize');
            detail.skinSutureType = 'Dissolvable';
            detail.skinSutureRemoval = '';
        }
    }
    lesion.procedureDetail = detail;
    lesion.skinSutureSize = detail.skinSutureSize;
    lesion.skinSutureType = detail.skinSutureType;
    lesion.skinSutureRemoval = detail.skinSutureRemoval;
    lesion.useDeepSuture = !!detail.useDeepSuture;
    lesion.deepSutureSize = detail.deepSutureSize || '';
    lesion.deepSutureType = detail.deepSutureType || '';
    commitProcedureLesion(lesion);
    if (typeof upsertExLesionFromChart === 'function') upsertExLesionFromChart(lesion);
    procedureSession.amendLesionId = '';
    procedureSession.amendPanel = '';
    if (typeof updateExAllOutputs === 'function') updateExAllOutputs({ skipVisitSave: true });
    if (typeof updateOutput === 'function') updateOutput();
    if (typeof scheduleVisitNoteSave === 'function') scheduleVisitNoteSave();
    refreshProcedureCompleteOutputs();
    renderProcedureAbortList();
    if (typeof persistProcedureSessionToChart === 'function') persistProcedureSessionToChart().catch(() => {});
    showToast('Closure / sutures updated.');
}

function ensureExLesionsFromOutputLesions() {
    if (typeof exLesions === 'undefined' || typeof upsertExLesionFromChart !== 'function') return;
    const list = procedureOutputLesions();
    if (!list.length) return;
    const ids = new Set(list.map((item) => String(item.id)));
    exLesions = exLesions.filter((item) => ids.has(String(item.sourceLesionId)));
    list.forEach(upsertExLesionFromChart);
}

function setProcedureDetailFormLocked(locked) {
    const form = document.getElementById('ex-lesion-form');
    const actions = document.getElementById('ex-form-actions');
    const banner = document.getElementById('procFormLockedBanner');
    if (form) form.classList.toggle('proc-form-locked', !!locked);
    if (actions) actions.classList.toggle('proc-form-locked', !!locked);
    if (banner) banner.classList.toggle('hidden', !locked);
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
        const siteEvent = siteComplicationRecord(lesion.id);
        const siteQuiet = siteIsUneventful(siteEvent);
        const suturesOpen = procedureSession.amendLesionId === String(lesion.id) && procedureSession.amendPanel === 'sutures';
        const eventOpen = procedureSession.amendLesionId === String(lesion.id) && procedureSession.amendPanel === 'event';
        const allowSutures = procedureAllowsSutureAmend(lesion);
        const diagnosis = typeof formatDiagnosisDisplay === 'function' ? formatDiagnosisDisplay(lesion.impression) : (lesion.impression || '');
        const panel = suturesOpen
            ? procSuturesPanelHtml(lesion)
            : (eventOpen ? procSiteEventPanelHtml(lesion) : '');
        return `<div class="proc-finish-lesion">
            <div class="proc-finish-lesion-main">
                <div class="min-w-0">
                    <span class="block text-sm font-semibold text-slate-800 truncate">${escapeHtml(lesion.location || 'No site')}</span>
                    <span class="block text-[11px] text-slate-500 truncate">${escapeHtml(tag)} · ${escapeHtml(diagnosis)}</span>
                    <span class="block text-[11px] text-slate-600 truncate">${escapeHtml(procedureSutureSummary(lesion))}</span>
                    ${siteQuiet ? '' : `<span class="block text-[11px] font-semibold text-amber-800 truncate">Event: ${escapeHtml(formatSiteComplications(lesion.id))}</span>`}
                </div>
                <div class="proc-finish-actions">
                    ${allowSutures ? `<button type="button" class="proc-finish-btn ${suturesOpen ? 'is-active' : ''}" onclick="toggleProcAmend('${safeId}', 'sutures')">Sutures</button>` : ''}
                    <button type="button" class="proc-finish-btn ${eventOpen ? 'is-active' : ''} ${siteQuiet ? '' : 'has-event'}" onclick="toggleProcAmend('${safeId}', 'event')">Event</button>
                    <button type="button" class="proc-finish-btn is-abort" onclick="abortProcedureLesion('${safeId}')">Return to planned</button>
                </div>
            </div>
            ${panel}
        </div>`;
    }).join('');
    const openLesion = selected.find((item) => String(item.id) === String(procedureSession.amendLesionId));
    if (openLesion && procedureSession.amendPanel === 'sutures') {
        populateProcAmendSutureSelects(procedureDetailForLesion(openLesion));
    }
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
    procedureSession.completedAt = '';
    procedureSession.lockedIds = procedureSession.selectedIds.map(String);
    procedureSession.complications = emptyEpisodeComplications();
    procedureSession.complicationNotes = '';
    procedureSession.siteComplications = {};
    procedureSession.amendLesionId = '';
    procedureSession.amendPanel = '';
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
        const cited = typeof lesionWithPriorHistologyCitation === 'function'
            ? lesionWithPriorHistologyCitation(lesion)
            : lesion;
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
            histologyPot: lesion.histologyPot || '',
            orientationType: detail.orientationType || '',
            orientationDescription: detail.orientationDescription || '',
            macroscopic: lesion.macroscopic || '',
            dermoscopy: (lesion.dermoscopy && lesion.dermoscopy !== 'Unspecified') ? lesion.dermoscopy : '',
            priorLesionId: lesion.priorLesionId || '',
            priorProcedureKind: cited.priorProcedureKind || lesion.priorProcedureKind || '',
            priorHistologyCaseNumber: cited.priorHistologyCaseNumber || '',
            priorHistologyPot: cited.priorHistologyPot || '',
            priorHistologyResult: cited.priorHistologyResult || ''
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

function refreshProcedureCompleteOutputs(options) {
    if (!options?.skipLesionList && typeof renderProcedureAbortList === 'function') renderProcedureAbortList();
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

function procedureRosReceptionLine(lesion) {
    const detail = typeof procedureDetailForLesion === 'function' ? procedureDetailForLesion(lesion) : {};
    const site = detail.location || lesion.location || 'site';
    if (detail.procedure === 'Shave' || detail.excisionClosureType === 'Secondary Intention') {
        return site + ' - no ROS';
    }
    if (detail.skinSutureType === 'Dissolvable') {
        return site + ' - no ROS';
    }
    if (detail.skinSutureRemoval) {
        return site + ' - ROS ' + detail.skinSutureRemoval + ' days';
    }
    if (detail.procedure === 'Punch' || detail.procedure === 'Excision') {
        return site + ' - ROS TBC';
    }
    return '';
}

function procedureRosReceptionSummary(lesionList) {
    return (lesionList || []).map(procedureRosReceptionLine).filter(Boolean).join('; ');
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
        banner.textContent = 'Hold the whole session. Same-day procedures are billed together, and at least one item still needs histology.';
    }
    const listHtml = summary.rows.map((row) => {
        const id = String(row.lesion.id || '').replace(/'/g, '');
        const bill = typeof billingForLesion === 'function' ? billingForLesion(row.lesion.id) : null;
        const sent = typeof billingHasBeenSent === 'function' && billingHasBeenSent(bill);
        const badge = row.hold
            ? '<span class="text-[10px] font-bold uppercase tracking-wider text-amber-800 bg-amber-100 px-1.5 py-0.5 rounded">Hold</span>'
            : '<span class="text-[10px] font-bold uppercase tracking-wider text-emerald-800 bg-emerald-100 px-1.5 py-0.5 rounded">Bill today</span>';
        const sessionHold = !!(summary.holdRows && summary.holdRows.length);
        const action = sent
            ? '<span class="text-[11px] font-semibold text-emerald-800">Billed</span>'
            : (summary.allReady
                ? '<span class="text-[11px] font-semibold text-emerald-800">Billed on Complete</span>'
                : (row.ok && !sessionHold
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

async function endProcedureSession() {
    updateProcedureComplications();
    const incomplete = selectedLesionsNotReady();
    if (incomplete.length) {
        showToast('Complete procedure details for: ' + incomplete.map((item) => item.location || 'unnamed lesion').join(', '));
        renderProcedureWorkspace();
        return;
    }
    if ((procedureSession.complications || {}).other && !String(procedureSession.complicationNotes || '').trim()) {
        showToast('Add a note for the episode complication.');
        openProcedureCompleteModal();
        return;
    }
    const siteOther = procedureSelectedLesions().find((lesion) => {
        const rec = siteComplicationRecord(lesion.id);
        return rec.other && !String(rec.notes || '').trim();
    });
    if (siteOther) {
        procedureSession.amendLesionId = String(siteOther.id);
        procedureSession.amendPanel = 'event';
        showToast('Add a note for the site event on ' + (siteOther.location || 'that lesion') + '.');
        openProcedureCompleteModal();
        return;
    }
    const episodeNote = formatEpisodeComplications();
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
    const ordered = typeof procedureSelectedLesions === 'function'
        ? procedureSelectedLesions()
        : ids.map((id) => (
            (typeof managedLesions !== 'undefined' ? managedLesions : []).find((item) => String(item.id) === String(id))
            || (typeof chartLesions === 'function' ? chartLesions() : []).find((item) => String(item.id) === String(id))
        )).filter(Boolean);
    if (typeof stampHistologyBatchForProcedure === 'function') {
        stampHistologyBatchForProcedure(ordered.length ? ordered : ids.map((id) => ({ id })));
    }
    for (const id of ids) {
        let lesion = managedLesions.find((item) => String(item.id) === String(id))
            || (typeof chartLesions === 'function' ? chartLesions() : []).find((item) => String(item.id) === String(id));
        if (!lesion) continue;
        const stamped = ordered.find((item) => String(item.id) === String(id));
        if (stamped?.histologyBatchId) lesion.histologyBatchId = stamped.histologyBatchId;
        if (stamped?.histologyPot && (typeof normalizeHistologyPot === 'function' ? !normalizeHistologyPot(lesion.histologyPot) : !String(lesion.histologyPot || '').trim())) {
            lesion.histologyPot = stamped.histologyPot;
        }
        lesion.procedureCompletedAt = new Date().toISOString();
        lesion.procedureEpisodeComplications = episodeNote;
        lesion.procedureSiteComplications = formatSiteComplications(id);
        lesion.procedureComplications = formatLesionComplicationStamp(id);
        lesion.managementStatus = 'awaiting_histology';
        lesion.schemaVersion = typeof LESION_SCHEMA_VERSION !== 'undefined' ? LESION_SCHEMA_VERSION : 2;
        lesion.currentPlan = 'Awaiting histology';
        if (typeof appendLesionTimeline === 'function') {
            appendLesionTimeline(lesion, {
                type: 'procedure',
                note: lesion.procedureComplications || 'Procedure completed',
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
                await setManagedLesionStatus(id, 'awaiting_histology', lesion.procedureComplications || 'Procedure completed');
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
        showToast('Procedure finished. Ask reception to HOLD billing for the whole session.');
    } else {
        showToast('Procedure finished. Lesions moved to awaiting histology for results, billing, and management planning.');
    }
    if (typeof renderLesionsTable === 'function') renderLesionsTable();
    if (typeof renderChartSidebar === 'function') renderChartSidebar();
    if (typeof renderManagedLesions === 'function') renderManagedLesions();
    if (typeof ensureExLesionsFromOutputLesions === 'function') ensureExLesionsFromOutputLesions();
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
            hint.textContent = 'Procedure started. In Finish: change sutures, record a site event, or return a lesion to planned. Vasovagal belongs under Episode.';
        } else if (!selected.length) {
            hint.textContent = 'Tick the lesions for this procedure. Planned punch, shave, and excision start selected; untick any you are not doing now.';
        } else if (detailsIncomplete.length) {
            hint.textContent = 'Orange lesions still need procedure details. Click a lesion, enter the data, save, then start.';
        } else if (missingConsent.length) {
            hint.textContent = 'Purple lesions still need consent. Open Surgical Consent, generate for those sites, then start.';
        } else {
            hint.textContent = 'Selected lesions are ready. Start procedure to record events, change sutures if needed, and copy outputs.';
        }
    }
    if (btn) {
        if (procedureSession.started) {
            btn.textContent = 'Finish procedure';
            btn.disabled = false;
            btn.className = 'px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-lg cursor-pointer';
            btn.setAttribute('aria-pressed', 'true');
            btn.title = 'Open Finish procedure to change sutures, record events, and copy notes';
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
        setProcedureDetailFormLocked(!!procedureSession.started);
        return;
    }
    const candidates = procedureCandidateLesions();
    if (!candidates.length) {
        list.innerHTML = '<p class="text-xs text-slate-400 italic">No planned procedures on this chart yet. Add a punch, shave, or excision during examination.</p>';
        if (typeof renderProcedureAbortList === 'function') renderProcedureAbortList();
        setProcedureDetailFormLocked(!!procedureSession.started);
        return;
    }

    list.innerHTML = candidates.map((lesion) => {
        const id = String(lesion.id);
        const checked = isProcedureSelected(id);
        const detailsOk = isProcedureDetailReady(lesion);
        const consentOk = typeof lesionHasProcedureConsent !== 'function' || lesionHasProcedureConsent(lesion);
        const ready = detailsOk && consentOk;
        const t = typeof lesionType === 'function' ? lesionType(lesion) : '';
        const tag = lesion.priorLesionId
            ? 'Re-excision'
            : (t === 'excision' || isFormalExcisionCandidate(lesion)
                ? 'Excision'
                : (t === 'shave' ? 'Shave' : (t === 'punch' ? 'Punch' : 'Procedure')));
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
                    <span class="block text-[11px] text-slate-500 truncate">${escapeHtml(typeof formatDiagnosisDisplay === 'function' ? formatDiagnosisDisplay(lesion.impression) : (lesion.impression || ''))} · ${escapeHtml(typeof lesionStatusLabel === 'function' ? lesionStatusLabel(lesion) : '')}</span>
                    <span class="mt-0.5 inline-block text-[10px] font-bold ${tagClass}">${tag}</span>
                </button>
                ${abortBtn}
            </div>`;
    }).join('');
    if (typeof renderProcedureAbortList === 'function') renderProcedureAbortList();
    setProcedureDetailFormLocked(!!procedureSession.started);
}
