/* Skin check workflow: sanitation, concerns, risk screening, lesions */

const PUNCH_SHAVE_BIOPSY_PLAN = 'Punch / Shave Biopsy';

function isPunchShaveBiopsyPlan(plan) {
    const p = String(plan || '');
    return p.includes('Punch / Shave Biopsy') || p.includes('Biopsy Today');
}

function syncPatientIdentifiers(source) {
    const mainName = document.getElementById('mainPatientName');
    const mainDOB = document.getElementById('mainPatientDOB');
    const mainDoc = document.getElementById('mainDoctorName');

    const consentName = document.getElementById('consentPatientName');
    const consentDOB = document.getElementById('consentPatientDOB');
    const consentDoc = document.getElementById('consentDoctorName');

    if (source === 'main') {
        if (consentName && mainName) consentName.value = mainName.value;
        if (consentDOB && mainDOB) consentDOB.value = mainDOB.value;
        if (consentDoc && mainDoc) consentDoc.value = mainDoc.value;
    } else if (source === 'consent') {
        if (mainName && consentName) mainName.value = consentName.value;
        if (mainDOB && consentDOB) mainDOB.value = consentDOB.value;
        if (mainDoc && consentDoc) mainDoc.value = consentDoc.value;
    }
    const doctor = (typeof currentDoctorName === 'function' && currentDoctorName())
        || (typeof loggedInDoctorName === 'function' && loggedInDoctorName())
        || '';
    if (mainDoc) mainDoc.value = doctor;
    if (consentDoc) consentDoc.value = doctor;
    const name = currentPatient?.name || mainName?.value || '';
    const dob = currentPatient?.dob || mainDOB?.value || '';
    const setText = (id, value) => {
        const el = document.getElementById(id);
        if (el) el.textContent = value || '—';
    };
    setText('mainPatientNameDisplay', name);
    setText('mainPatientDobDisplay', dob);
    setText('mainDoctorNameDisplay', doctor);
    setText('consentPatientNameDisplay', name);
    setText('consentPatientDobDisplay', dob);
    setText('consentDoctorNameDisplay', doctor);
    updateOutput();
}

function openSanitationModal() {
    applyCurrentPatientToForms();
    const modal = document.getElementById('sanitationModal');
    if (modal) modal.classList.remove('hidden');
}

function setModalBedSanitation(isClean) {
    if (!isClean && isBedSanitised && typeof hasCurrentPatient === 'function' && hasCurrentPatient()) {
        isClean = true;
    }
    isBedSanitised = isClean;
    const btnYes = document.getElementById('modalBedYes');
    const btnNo = document.getElementById('modalBedNo');
    const confirmBtn = document.getElementById('confirmSanitationBtn');
    if (!btnYes || !btnNo || !confirmBtn) return;

    if (isClean) {
        btnYes.className = "px-3 py-1 rounded text-xs font-bold transition-all bg-emerald-600 text-white shadow cursor-pointer";
        btnNo.className = "px-3 py-1 rounded text-xs font-bold transition-all bg-slate-200 text-slate-600 hover:bg-slate-300 cursor-pointer";
        
        confirmBtn.disabled = false;
        confirmBtn.className = "w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition-all shadow cursor-pointer";
    } else {
        btnNo.className = "px-3 py-1 rounded text-xs font-bold transition-all bg-red-600 text-white shadow cursor-pointer";
        btnYes.className = "px-3 py-1 rounded text-xs font-bold transition-all bg-slate-200 text-slate-600 hover:bg-slate-300 cursor-pointer";
        
        confirmBtn.disabled = true;
        confirmBtn.className = "w-full py-3 bg-slate-300 text-slate-500 font-bold rounded-xl transition-all shadow cursor-not-allowed opacity-60";
    }
}

async function confirmSanitationModal() {
    if (!isBedSanitised) return;
    const name = currentPatient.name || '';
    const dob = currentPatient.dob || '';
    const clinician = (typeof currentDoctorName === 'function' && currentDoctorName())
        || (typeof loggedInDoctorName === 'function' && loggedInDoctorName())
        || '';
    if (!name || !dob) {
        showToast('Open a patient chart before starting the examination.');
        return;
    }
    if (!hasCurrentPatient() || currentPatient.chartId !== patientChartId(name, dob)) {
        if (typeof openPatientChart === 'function') {
            await openPatientChart({ name, dob, clinician }, { silent: true, keepFilter: true });
        } else {
            setCurrentPatient({ name, dob, clinician });
        }
    }
    const modal = document.getElementById('sanitationModal');
    if (modal) modal.classList.add('hidden');
    if (typeof persistPatientBillingFromDom === 'function') persistPatientBillingFromDom();
    if (typeof collapseAllAccordions === 'function') collapseAllAccordions();
    updateOutput();
}

function handleScopeChange() {
    const regionalRadio = document.getElementById('scopeRegionalRadio');
    const panel = document.getElementById('regionalAreaPanel');
    if (regionalRadio && regionalRadio.checked) {
        if (panel) panel.classList.remove('hidden');
    } else {
        if (panel) panel.classList.add('hidden');
    }
    updateExamRequiredFields();
    updateOutput();
}

function setExamFieldComplete(id, complete) {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.toggle('is-complete', !!complete);
    el.classList.toggle('is-incomplete', !complete);
}

let examMetadataWasComplete = false;

function examScopeIsComplete() {
    const selected = document.querySelector('input[name="scopeConsent"]:checked');
    if (!selected) return false;
    if (selected.id === 'scopeRegionalRadio') {
        return !!(document.getElementById('regionalAreaInput')?.value.trim());
    }
    return true;
}

function examMetadataSectionComplete() {
    return examScopeIsComplete()
        && !!(document.getElementById('fitzpatrick')?.value)
        && !!(document.getElementById('lastSkinCheck')?.value)
        && smsNormalResultsConsentIsSet();
}

function normalizeSmsNormalResultsConsent(value) {
    const raw = String(value || '').trim().toLowerCase();
    if (raw === 'yes' || raw === 'true' || raw === 'agreed') return 'yes';
    if (raw === 'no' || raw === 'false' || raw === 'declined') return 'no';
    return '';
}

function smsNormalResultsConsentIsSet() {
    return smsNormalResultsConsent === 'yes' || smsNormalResultsConsent === 'no';
}

function smsNormalResultsConsentLabel() {
    if (smsNormalResultsConsent === 'yes') return 'Yes — happy to receive normal results by text';
    if (smsNormalResultsConsent === 'no') return 'No — do not send normal results by text';
    return '';
}

function updateSmsNormalResultsButtons() {
    const btnNo = document.getElementById('smsResultsNo');
    const btnYes = document.getElementById('smsResultsYes');
    const unset = 'px-3 py-1 rounded text-xs font-bold transition-all bg-slate-200 text-slate-700 hover:bg-slate-300 cursor-pointer';
    const yesOn = 'px-3 py-1 rounded text-xs font-bold transition-all bg-emerald-600 text-white shadow cursor-pointer';
    const noOn = 'px-3 py-1 rounded text-xs font-bold transition-all bg-slate-700 text-white shadow cursor-pointer';
    if (btnYes) btnYes.className = smsNormalResultsConsent === 'yes' ? yesOn : unset;
    if (btnNo) btnNo.className = smsNormalResultsConsent === 'no' ? noOn : unset;
    setExamFieldComplete('examSmsResultsField', smsNormalResultsConsentIsSet());
}

function applySmsNormalResultsConsent(value) {
    smsNormalResultsConsent = normalizeSmsNormalResultsConsent(value);
    updateSmsNormalResultsButtons();
}

function setSmsNormalResultsConsent(value) {
    smsNormalResultsConsent = normalizeSmsNormalResultsConsent(value);
    updateSmsNormalResultsButtons();
    updateExamRequiredFields();
    updateOutput();
    if (typeof applyingChartRecord !== 'undefined' && applyingChartRecord) return;
    if (typeof scheduleChartSave === 'function') scheduleChartSave();
}

function concernsSectionComplete() {
    return !!noPatientConcerns || (Array.isArray(patientConcerns) && patientConcerns.length > 0);
}

function screeningGroupsComplete(groups) {
    const g = groups || groupStates || {};
    return ['canc', 'all', 'bld', 'dia', 'hea'].every((key) => g[key] === 'YES' || g[key] === 'NO');
}

function screeningSectionComplete() {
    return !!screeningMarkedComplete && screeningGroupsComplete() && isSection1RiskComplete();
}

function setExamSectionDone(id, done) {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.toggle('is-done', !!done);
}

function updateExamSectionHeaders() {
    setExamSectionDone('examSecNumMetadata', examMetadataSectionComplete());
    setExamSectionDone('examSecNumConcerns', concernsSectionComplete());
    setExamSectionDone('examSecNumRisks', screeningSectionComplete());
}

function updateExamRequiredFields() {
    const scopeOk = examScopeIsComplete();
    const fitzOk = !!(document.getElementById('fitzpatrick')?.value);
    const lastOk = !!(document.getElementById('lastSkinCheck')?.value);
    setExamFieldComplete('examScopeField', scopeOk);
    setExamFieldComplete('examFitzField', fitzOk);
    setExamFieldComplete('examLastCheckField', lastOk);
    setExamFieldComplete('examSmsResultsField', smsNormalResultsConsentIsSet());
    const complete = scopeOk && fitzOk && lastOk && smsNormalResultsConsentIsSet();
    if (complete && !examMetadataWasComplete) {
        if (typeof collapseExamSectionWhenComplete === 'function') collapseExamSectionWhenComplete('sec-metadata');
    }
    examMetadataWasComplete = complete;
    updateExamSectionHeaders();
}

function addPatientConcern() {
    if (!requireCurrentPatient('Select a patient before adding a lesion.')) return;
    if (!isBedSanitised) {
        if (typeof pulseSanitiseControl === 'function') pulseSanitiseControl();
        showToast('Click Sanitised in the chart bar once to unlock examination.');
        return;
    }
    const input = document.getElementById('newConcernLocation');
    if (!input || !input.value.trim()) return;

    if (noPatientConcerns) {
        noPatientConcerns = false;
        const noneBox = document.getElementById('noPatientConcerns');
        if (noneBox) noneBox.checked = false;
    }

    const locText = input.value.trim();
    patientConcerns.push(locText);
    
    lesions.push({
        id: newLesionId(),
        location: locText,
        impression: 'Pending Assessment',
        macroscopic: 'Patient reported spot',
        dermoscopy: 'To be examined',
        plan: 'Awaiting Assessment',
        biopsyType: '',
        isConcern: true
    });

    input.value = '';
    renderPatientConcerns();
    renderLesionsTable();
    if (typeof renderChartSidebar === 'function') renderChartSidebar();
    updateExamSectionHeaders();
    updateOutput();
    const saved = lesions[lesions.length - 1];
    if (saved && typeof persistSessionLesionToVault === 'function') {
        persistSessionLesionToVault(saved).catch((err) => {
            showToast(err.message || 'Could not write the encrypted lesion file.');
        });
    }
}

function quickAddConcern(presetText) {
    const input = document.getElementById('newConcernLocation');
    if (input) {
        input.value = presetText;
        addPatientConcern();
    }
}

function removeConcern(index) {
    patientConcerns.splice(index, 1);
    renderPatientConcerns();
    updateExamSectionHeaders();
    updateOutput();
}

function syncNoPatientConcernsUi() {
    const noneBox = document.getElementById('noPatientConcerns');
    if (noneBox) noneBox.checked = !!noPatientConcerns;
    const addWrap = document.getElementById('patientConcernsAddWrap');
    if (addWrap) addWrap.classList.toggle('opacity-50', !!noPatientConcerns);
    const input = document.getElementById('newConcernLocation');
    const addBtn = document.getElementById('btnAddPatientConcern');
    if (input) input.disabled = !!noPatientConcerns;
    if (addBtn) addBtn.disabled = !!noPatientConcerns;
    document.querySelectorAll('[data-concern-preset]').forEach((btn) => {
        btn.disabled = !!noPatientConcerns;
    });
}

function handleNoPatientConcernsChange() {
    const noneBox = document.getElementById('noPatientConcerns');
    const wanted = !!noneBox?.checked;
    if (wanted && patientConcerns.length > 0) {
        if (noneBox) noneBox.checked = false;
        noPatientConcerns = false;
        showToast('Remove listed concerns before marking none.');
        return;
    }
    noPatientConcerns = wanted;
    syncNoPatientConcernsUi();
    if (noPatientConcerns && typeof collapseExamSectionWhenComplete === 'function') {
        collapseExamSectionWhenComplete('sec-concerns');
    }
    updateExamSectionHeaders();
    updateOutput();
}

function applyNoPatientConcerns(value) {
    noPatientConcerns = !!value;
    syncNoPatientConcernsUi();
    updateExamSectionHeaders();
}

function renderPatientConcerns() {
    const list = document.getElementById('patientConcernsList');
    if (!list) return;
    syncNoPatientConcernsUi();

    if (noPatientConcerns && patientConcerns.length === 0) {
        list.innerHTML = `<div class="text-xs text-emerald-800 font-medium">No patient-reported lesion concerns today.</div>`;
        return;
    }

    if (patientConcerns.length === 0) {
        list.innerHTML = `<div class="text-xs text-slate-400 italic">No specific patient concerns recorded yet.</div>`;
        return;
    }

    list.innerHTML = patientConcerns.map((c, i) => `
        <div class="flex justify-between items-center p-2 rounded bg-blue-50 border border-blue-200 text-xs">
            <span class="font-semibold text-blue-900">• ${c}</span>
            <button onclick="removeConcern(${i})" class="text-red-500 hover:text-red-700 font-bold cursor-pointer">&times;</button>
        </div>
    `).join('');
}

function setGroupState(grpKey, state) {
    groupStates[grpKey] = state;
    
    const btnNo = document.getElementById(`grp-${grpKey}-no`);
    const btnYes = document.getElementById(`grp-${grpKey}-yes`);
    const subpanel = document.getElementById(`subpanel-${grpKey}`);

    if (state === 'YES') {
        if (btnYes) btnYes.className = "px-3 py-1 rounded text-xs font-bold transition-all bg-red-600 text-white shadow";
        if (btnNo) btnNo.className = "px-3 py-1 rounded text-xs font-bold transition-all bg-slate-200 text-slate-700 hover:bg-slate-300";
        if (subpanel) subpanel.classList.remove('hidden');
    } else if (state === 'NO') {
        if (btnNo) btnNo.className = "px-3 py-1 rounded text-xs font-bold transition-all bg-emerald-600 text-white shadow";
        if (btnYes) btnYes.className = "px-3 py-1 rounded text-xs font-bold transition-all bg-slate-200 text-slate-700 hover:bg-slate-300";
        if (subpanel) subpanel.classList.add('hidden');
    } else {
        if (btnYes) btnYes.className = "px-3 py-1 rounded text-xs font-bold transition-all bg-slate-200 text-slate-700 hover:bg-slate-300";
        if (btnNo) btnNo.className = "px-3 py-1 rounded text-xs font-bold transition-all bg-slate-200 text-slate-700 hover:bg-slate-300";
        if (subpanel) subpanel.classList.add('hidden');
    }

    recalculateRecall();
    updateScreeningCompleteButton();
    updateExamSectionHeaders();
    updateOutput();
    if (typeof scheduleChartSave === 'function') scheduleChartSave();
}

function updateScreeningCompleteButton() {
    const btn = document.getElementById('btnCompleteScreening');
    if (!btn) return;
    const ready = screeningGroupsComplete() && isSection1RiskComplete();
    btn.disabled = !ready;
    btn.textContent = screeningMarkedComplete ? 'Screening complete' : 'Complete screening';
    btn.className = ready
        ? 'px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg shadow cursor-pointer'
        : 'px-4 py-2 bg-slate-300 text-slate-500 font-bold text-xs rounded-lg cursor-not-allowed';
}

function completeRiskScreening() {
    if (typeof requireCurrentPatient === 'function' && !requireCurrentPatient('Open a patient chart before completing risk screening.')) {
        return;
    }
    if (!screeningGroupsComplete()) {
        showToast('Select YES or NO for every risk category.');
        return;
    }
    if (!isSection1RiskComplete()) {
        showToast('Complete the skin-cancer history details before finishing screening.');
        return;
    }
    screeningMarkedComplete = true;
    updateScreeningCompleteButton();
    updateExamSectionHeaders();
    if (typeof collapseExamSectionWhenComplete === 'function') collapseExamSectionWhenComplete('sec-risks');
    updateOutput();
    if (typeof scheduleChartSave === 'function') scheduleChartSave();
    showToast('Pre-procedural risk screening complete.');
}

function setAllGroupedRisksNo() {
    ['canc', 'all', 'bld', 'dia', 'hea'].forEach(grp => {
        setGroupState(grp, 'NO');
    });
}

function toggleMelanomaSubFields() {
    const chk = document.getElementById('hxPersonalMelanoma');
    const sub = document.getElementById('melanomaSubFields');
    if (chk && chk.checked) {
        if (sub) sub.classList.remove('hidden');
    } else {
        if (sub) sub.classList.add('hidden');
    }
    recalculateRecall();
}

function isSection1RiskComplete() {
    if (groupStates['canc'] === 'NO') return true;
    if (groupStates['canc'] === 'YES') {
        const hasMel = document.getElementById('hxPersonalMelanoma')?.checked;
        const hasNMSC = document.getElementById('hxPersonalNMSC')?.checked;
        const hasFam = document.getElementById('hxFamilyMelanoma')?.checked;
        const hasMoles = document.getElementById('hxHighMoleCount')?.checked;
        return !!(hasMel || hasNMSC || hasFam || hasMoles);
    }
    return false;
}

function setRecallDisplay(interval, reason) {
    const titleEl = document.getElementById('recallRecommendationTitle');
    const reasonEl = document.getElementById('recallRecommendationReason');
    const badgeEl = document.getElementById('headerRecallBadgeText');
    const headerReasonEl = document.getElementById('headerRecallReason');
    if (titleEl) titleEl.innerText = interval;
    if (reasonEl) reasonEl.innerText = reason;
    if (badgeEl) badgeEl.innerText = interval;
    if (headerReasonEl) headerReasonEl.innerText = reason;
    if (typeof renderPatientChartSummary === 'function') renderPatientChartSummary();
}

function computedRecallInterval() {
    if (!isSection1RiskComplete()) return '';
    const title = document.getElementById('recallRecommendationTitle')?.innerText
        .replace('Recommended Repeat Skin Check: ', '')
        .trim() || '';
    if (!title || /pending/i.test(title)) return '';
    return title;
}

function computedRecallReason() {
    if (!computedRecallInterval()) return '';
    return document.getElementById('recallRecommendationReason')?.innerText.trim() || '';
}

function recalculateRecall() {
    if (!isSection1RiskComplete()) {
        setRecallDisplay(
            'Pending Risk Screening',
            'Complete the skin-cancer history category to calculate the interval.'
        );
        updateOutput();
        return;
    }

    let interval = "12 Months";
    let reason = "Standard annual recall for low-risk Australian adults.";

    const groupCancYes = groupStates['canc'] === 'YES';
    const groupHeaYes = groupStates['hea'] === 'YES';

    const hasMelanoma = groupCancYes && document.getElementById('hxPersonalMelanoma')?.checked;
    const melanomaStage = document.getElementById('melanomaStage')?.value || '';
    const melanomaTime = document.getElementById('melanomaTime')?.value || '';
    const melanomaYoung = groupCancYes && document.getElementById('melanomaYoungAge')?.checked;

    const hasNMSC = groupCancYes && document.getElementById('hxPersonalNMSC')?.checked;
    const hasFamilyMel = groupCancYes && document.getElementById('hxFamilyMelanoma')?.checked;
    const hasHighMoles = groupCancYes && document.getElementById('hxHighMoleCount')?.checked;
    const isImmuno = groupHeaYes && document.getElementById('heaImmuno')?.checked;

    if (hasMelanoma) {
        if (melanomaStage.includes('Multiple') || melanomaTime.includes('Less than 2 years')) {
            interval = "3 Months";
            reason = "Very high risk: Personal history of melanoma diagnosed <2 yrs ago or multiple primary melanomas.";
        } else if (melanomaTime.includes('2 to 5 years') || melanomaYoung || melanomaStage.includes('Thick')) {
            interval = "3 - 6 Months";
            reason = "High risk: Personal history of melanoma (2-5 yrs ago, thick/ulcerated, or young age <50).";
        } else {
            interval = "6 - 12 Months";
            reason = "Tapered high risk: Personal history of melanoma >5 yrs ago (disease free).";
        }
    } else if (hasNMSC || hasFamilyMel || hasHighMoles || isImmuno) {
        interval = "6 Months";
        reason = "Increased risk: Personal history of NMSC (BCC/SCC), family melanoma, dysplastic nevi, or immunosuppression.";
    }

    setRecallDisplay(interval, reason);
    updateOutput();
}

function triggerAddLesion() {
    if (!requireCurrentPatient('Select a patient before adding a lesion.')) return;
    if (!isBedSanitised) {
        pendingWorkspaceTab = 'skin-check';
        if (typeof pulseSanitiseControl === 'function') pulseSanitiseControl();
        showToast('Click Sanitised in the chart bar once to unlock examination.');
        return;
    }
    if (activeWorkspaceTab !== 'skin-check') switchWorkspaceTab('skin-check');
    if (typeof setAccordionCollapsed === 'function') setAccordionCollapsed('sec-lesions', false);
    openLesionModal();
}

function openLesionModal(lesionId = null) {
    const modal = document.getElementById('lesionModal');
    if (!modal) return;

    document.getElementById('editLesionId').value = lesionId || '';
    
    if (lesionId) {
        const item = (typeof chartLesions === 'function' ? chartLesions() : lesions).find(l => String(l.id) === String(lesionId));
        if (item) {
            document.getElementById('lesionModalTitle').innerText = "Edit Skin Lesion Record";
            document.getElementById('lesionLocation').value = item.location;
            applyExamImpressionValue(item.impression);
            document.getElementById('lesionMacroscopic').value = item.macroscopic;
            document.getElementById('lesionDermoscopy').value = item.dermoscopy;
            const planEl = document.getElementById('lesionPlan');
            planEl.value = item.plan;
            if (isPunchShaveBiopsyPlan(item.plan) && planEl.value !== item.plan) {
                planEl.value = PUNCH_SHAVE_BIOPSY_PLAN;
            }
            if (isTopicalPlan(item.plan) && planEl.value !== item.plan) {
                planEl.value = 'Topical / Field Treatment';
            }

            const biopsyRadios = document.getElementsByName('biopsyType');
            biopsyRadios.forEach(r => {
                if (r.value === item.biopsyType) r.checked = true;
            });
            const marginEl = document.getElementById('excisionMargin');
            const reconEl = document.getElementById('excisionReconstruction');
            if (marginEl) marginEl.value = item.excisionMargin || '';
            if (reconEl) reconEl.value = normalizeExcisionClosure(item);
            const graftEl = document.getElementById('consultExcisionGraftType');
            if (graftEl) graftEl.value = item.graftType || item.billingGraftType || 'Full-Thickness Skin Graft (FTSG)';
            const examLen = document.getElementById('examLesionLength');
            const examWid = document.getElementById('examLesionWidth');
            const examMar = document.getElementById('examLesionMargin');
            const examPunch = document.getElementById('examPunchSize');
            if (examLen) examLen.value = item.length || '';
            if (examWid) examWid.value = item.width || '';
            if (examMar) examMar.value = item.margin || '';
            if (examPunch) examPunch.value = item.punchSize || '';
            populateTopicalForm(item);
        }
    } else {
        document.getElementById('lesionModalTitle').innerText = "Document Skin Lesion";
        document.getElementById('lesionLocation').value = '';
        document.getElementById('lesionMacroscopic').value = '';
        document.getElementById('lesionDermoscopy').value = '';
        applyExamImpressionValue('BCC');
        document.getElementById('lesionPlan').value = 'Awaiting Assessment';
        const examLen = document.getElementById('examLesionLength');
        const examWid = document.getElementById('examLesionWidth');
        const examMar = document.getElementById('examLesionMargin');
        const examPunch = document.getElementById('examPunchSize');
        if (examLen) examLen.value = '';
        if (examWid) examWid.value = '';
        if (examMar) examMar.value = '';
        if (examPunch) examPunch.value = '';
        const marginEl = document.getElementById('excisionMargin');
        const reconEl = document.getElementById('excisionReconstruction');
        if (marginEl) marginEl.value = '';
        if (reconEl) reconEl.value = 'Ellipse';
        const graftEl = document.getElementById('consultExcisionGraftType');
        if (graftEl) graftEl.value = 'Full-Thickness Skin Graft (FTSG)';

        resetTopicalForm();
    }

    handlePlanChange();
    if (typeof updateConsultExcisionClosureUI === 'function') updateConsultExcisionClosureUI();
    modal.classList.remove('hidden');
}

function closeLesionModal() {
    const modal = document.getElementById('lesionModal');
    if (modal) modal.classList.add('hidden');
}

function populateExamDiagnosisSelect() {
    const sel = document.getElementById('lesionImpression');
    if (!sel || typeof exPathologyOptions === 'undefined') return;
    const current = sel.value;
    sel.innerHTML = Object.entries(exPathologyOptions).map(([code, label]) => {
        return `<option value="${escapeHtml(code)}">${escapeHtml(code)} (${escapeHtml(label)})</option>`;
    }).join('') + '<option value="OTHER">Other (manual entry)</option>';
    if (current && [...sel.options].some((opt) => opt.value === current)) sel.value = current;
}

function handleExamDiagnosisChange() {
    const sel = document.getElementById('lesionImpression');
    const other = document.getElementById('lesionImpressionOther');
    if (!other) return;
    const isOther = sel?.value === 'OTHER';
    other.classList.toggle('hidden', !isOther);
    if (isOther) other.focus();
    if (typeof isCryoRelevant === 'function' && isCryoRelevant()) {
        const panel = document.getElementById('cryoPlanPanel');
        if (panel && panel.dataset.modified !== '1' && typeof applyCryoRecommendationFromImpression === 'function') {
            applyCryoRecommendationFromImpression({ force: true });
        }
    }
}

function applyExamImpressionValue(raw) {
    const sel = document.getElementById('lesionImpression');
    const other = document.getElementById('lesionImpressionOther');
    if (!sel) return;
    populateExamDiagnosisSelect();
    const t = String(raw || '').trim();
    if (!t || t === 'Pending Assessment') {
        sel.value = 'BCC';
        if (other) {
            other.value = '';
            other.classList.add('hidden');
        }
        return;
    }
    const code = typeof diagnosisCodeFromText === 'function' ? diagnosisCodeFromText(t) : '';
    if (code && [...sel.options].some((opt) => opt.value === code)) {
        sel.value = code;
        if (other) {
            other.value = '';
            other.classList.add('hidden');
        }
        return;
    }
    sel.value = 'OTHER';
    if (other) {
        other.value = t;
        other.classList.remove('hidden');
    }
}

function readExamImpression() {
    const sel = document.getElementById('lesionImpression');
    if (!sel) return '';
    if (sel.value === 'OTHER') return document.getElementById('lesionImpressionOther')?.value.trim() || '';
    return sel.value;
}

function selectedExamBiopsyType() {
    let biopsyType = '';
    document.getElementsByName('biopsyType').forEach((r) => { if (r.checked) biopsyType = r.value; });
    return biopsyType;
}

function handleBiopsyTypeChange() {
    const biopsyType = selectedExamBiopsyType();
    const isPunch = /punch/i.test(biopsyType);
    document.getElementById('examShaveMeasureFields')?.classList.toggle('hidden', isPunch);
    document.getElementById('examPunchMeasureFields')?.classList.toggle('hidden', !isPunch);
    document.getElementById('examShaveSafetyPrompt')?.classList.toggle('hidden', isPunch);
}

function handlePlanChange() {
    const plan = document.getElementById('lesionPlan').value;
    const bFields = document.getElementById('planBiopsyFields');
    const eFields = document.getElementById('planExcisionFields');
    const tFields = document.getElementById('planTopicalFields');

    if (bFields) bFields.classList.add('hidden');
    if (eFields) eFields.classList.add('hidden');
    if (tFields) tFields.classList.add('hidden');

    if (isPunchShaveBiopsyPlan(plan)) {
        if (bFields) bFields.classList.remove('hidden');
        handleBiopsyTypeChange();
    } else if (plan.includes('Formally Book Excision')) {
        if (eFields) eFields.classList.remove('hidden');
        if (typeof updateConsultExcisionClosureUI === 'function') updateConsultExcisionClosureUI();
    } else if (isTopicalPlan(plan)) {
        if (tFields) tFields.classList.remove('hidden');
        updateTopicalFieldVisibility();
    }
}

function updateConsultExcisionClosureUI() {
    const closure = document.getElementById('excisionReconstruction')?.value || '';
    const wrap = document.getElementById('consultExcisionGraftWrap');
    if (wrap) wrap.classList.toggle('hidden', !closureNeedsGraftType(closure));
}

function saveLesion() {
    if (!requireCurrentPatient('Select a patient so this lesion is saved to their chart.')) return;
    const loc = document.getElementById('lesionLocation').value.trim();
    if (!loc) {
        showToast('Please enter an anatomical location for the lesion.');
        return;
    }

    const editId = document.getElementById('editLesionId').value;
    const impression = readExamImpression();
    if (!impression) {
        showToast('Please choose a diagnosis, or enter one under Other.');
        return;
    }
    const macroscopic = document.getElementById('lesionMacroscopic').value.trim() || 'Unspecified';
    const dermoscopy = document.getElementById('lesionDermoscopy').value.trim() || 'Unspecified';
    const plan = document.getElementById('lesionPlan').value;

    let biopsyType = '';
    let excisionMargin = '';
    let excisionReconstruction = '';
    let excisionClosureType = '';
    let graftType = '';
    let topicalFields = emptyTopicalFields();
    let length = '';
    let width = '';
    let margin = '';
    let punchSize = '';

    if (isPunchShaveBiopsyPlan(plan)) {
        const bRadios = document.getElementsByName('biopsyType');
        bRadios.forEach(r => { if (r.checked) biopsyType = r.value; });
        if (biopsyType.includes('Punch')) {
            punchSize = document.getElementById('examPunchSize')?.value.trim() || '';
        } else {
            length = document.getElementById('examLesionLength')?.value.trim() || '';
            width = document.getElementById('examLesionWidth')?.value.trim() || '';
            margin = document.getElementById('examLesionMargin')?.value.trim() || '';
        }

        if (biopsyType.includes('Shave')) {
            const existingLesion = editId
                ? ((lesions || []).find((item) => String(item.id) === String(editId))
                    || (typeof chartLesions === 'function' ? chartLesions() : []).find((item) => String(item.id) === String(editId)))
                : null;
            const existingConsent = typeof lesionConsentStatus === 'function' ? lesionConsentStatus(existingLesion) : '';
            const alreadyConsented = existingConsent === 'verbal' || existingConsent === 'written';
            if (!alreadyConsented && pendingShaveConsentAction !== 'verbal' && pendingShaveConsentAction !== 'skip') {
                openShaveConsentModal();
                return;
            }
        }
    } else if (plan.includes('Formally Book Excision')) {
        excisionMargin = document.getElementById('excisionMargin')?.value.trim() || '3mm to 5mm';
        excisionClosureType = document.getElementById('excisionReconstruction')?.value || 'Ellipse';
        excisionReconstruction = closureToReconstruction(excisionClosureType);
        graftType = document.getElementById('consultExcisionGraftType')?.value || '';
    } else if (isTopicalPlan(plan)) {
        topicalFields = readTopicalFieldsFromForm();
        if (topicalFields.topicalDiscussed.length === 0) {
            showToast('Select at least one treatment that was discussed.');
            return;
        }
        if (!topicalFields.topicalDecision) {
            showToast('Record the patient decision, or mark treatment as declined.');
            return;
        }
        if (topicalFields.topicalDecision === 'pdt' && !(topicalFields.pdtRegions || []).length) {
            showToast('Select at least one PDT body area so the stored fee can be quoted.');
            return;
        }
        if (topicalFields.topicalDecision === 'cryotherapy' && !(Number(topicalFields.cryoFreezeSeconds) > 0)) {
            showToast('Choose a cryotherapy protocol (or enter freeze time) before saving.');
            return;
        }
    }

    const lesionRecord = {
        location: loc,
        impression,
        macroscopic,
        dermoscopy,
        plan,
        biopsyType,
        length,
        width,
        margin,
        punchSize,
        excisionMargin,
        excisionReconstruction,
        excisionClosureType,
        graftType,
        billingGraftType: graftType,
        billingReconstruction: plan.includes('Formally Book Excision')
            ? inferBillingReconstruction({ excisionReconstruction, excisionClosureType })
            : '',
        ...topicalFields
    };

    if (biopsyType.includes('Shave') && pendingShaveConsentAction === 'verbal') {
        const existingConsent = editId && typeof lesionConsentStatus === 'function'
            ? lesionConsentStatus((lesions || []).find((item) => String(item.id) === String(editId))
                || (typeof chartLesions === 'function' ? chartLesions() : []).find((item) => String(item.id) === String(editId)))
            : '';
        if (existingConsent !== 'written') {
            lesionRecord.consentStatus = 'verbal';
            lesionRecord.consentedAt = new Date().toISOString();
        }
        shaveConsentVerified = true;
    }
    pendingShaveConsentAction = '';

    if (isPunchShaveBiopsyPlan(plan)) {
        lesionRecord.type = biopsyType.includes('Punch') ? 'punch' : 'shave';
    } else if (plan.includes('Formally Book Excision')) {
        lesionRecord.type = 'excision';
    } else if (isTopicalPlan(plan)) {
        lesionRecord.type = 'topical';
    } else {
        lesionRecord.type = 'none';
    }

    if (editId) {
        const idx = lesions.findIndex(l => String(l.id) === String(editId));
        if (idx !== -1) {
            lesions[idx] = { ...lesions[idx], ...lesionRecord, id: lesions[idx].id };
        } else {
            const prior = (typeof chartLesions === 'function' ? chartLesions() : []).find(l => String(l.id) === String(editId)) || {};
            lesions.push({ ...prior, ...lesionRecord, id: editId });
        }
    } else {
        lesions.push({
            id: newLesionId(),
            ...lesionRecord
        });
    }

    const saved = lesions.find(l => editId ? String(l.id) === String(editId) : l.id === lesions[lesions.length - 1].id);
    if (saved && typeof persistSessionLesionToVault === 'function') {
        persistSessionLesionToVault(saved).catch((err) => {
            showToast(err.message || 'Lesion saved in this session, but the encrypted file was not written.');
        });
    }

    closeLesionModal();
    renderLesionsTable();
    if (typeof renderChartSidebar === 'function') renderChartSidebar();
    updateOutput();
}

function deleteLesion(id) {
    lesions = lesions.filter(l => String(l.id) !== String(id));
    if (typeof deleteManagedLesionFile === 'function') {
        deleteManagedLesionFile(id).catch(() => {});
        managedLesions = managedLesions.filter(l => String(l.id) !== String(id));
        if (typeof renderManagedLesions === 'function') renderManagedLesions();
    }
    renderLesionsTable();
    updateOutput();
    if (typeof renderChartSidebar === 'function') renderChartSidebar();
}

function renderLesionsTable() {
    const tbody = document.getElementById('lesionsTableBody');
    if (!tbody) return;
    const rows = typeof chartLesions === 'function' ? chartLesions() : lesions;

    if (rows.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="p-4 text-center text-slate-400 italic">No lesions on this chart yet. Click "+ Add Lesion" to record a spot.</td></tr>`;
        return;
    }

    tbody.innerHTML = rows.map((l, idx) => {
        const status = typeof lesionStatusLabel === 'function' ? lesionStatusLabel(l) : (l.plan || '');
        const today = typeof isVisitLesion === 'function' && isVisitLesion(l.id);
        return `
        <tr class="hover:bg-slate-50 transition-colors">
            <td class="p-3 font-bold text-slate-500">${idx + 1}</td>
            <td class="p-3 font-semibold text-slate-800">${escapeHtml(l.location || '')}${today ? ' <span class="text-[10px] font-bold text-emerald-700">Today</span>' : ''}</td>
            <td class="p-3 text-slate-700">${escapeHtml(typeof formatDiagnosisDisplay === 'function' ? formatDiagnosisDisplay(l.impression) : (l.impression || ''))}</td>
            <td class="p-3"><span class="text-[11px] font-semibold text-blue-800">${escapeHtml(status)}</span>${l.currentPlan ? `<div class="text-[10px] text-slate-500 mt-0.5">${escapeHtml(l.currentPlan)}</div>` : ''}${typeof lastUnsuccessfulCall === 'function' && lastUnsuccessfulCall(l) ? `<span class="lesion-call-badge">${escapeHtml(formatCallBadge(lastUnsuccessfulCall(l)))}</span>` : ''}</td>
            <td class="p-3">
                        <span class="px-2 py-0.5 rounded text-[11px] font-semibold ${(l.plan || '').includes('Biopsy') ? 'bg-blue-100 text-blue-800' : (l.plan || '').includes('Excision') ? 'bg-purple-100 text-purple-800' : isTopicalPlan(l.plan) ? 'bg-teal-100 text-teal-800' : (l.plan || '').includes('Awaiting') ? 'bg-amber-100 text-amber-900 border border-amber-300' : 'bg-slate-100 text-slate-700'}">
                            ${isTopicalPlan(l.plan) ? formatTopicalTableBadge(l) : `${l.plan || ''} ${l.biopsyType ? '(' + l.biopsyType + ')' : ''}`}
                        </span>
            </td>
            <td class="p-3 text-right space-x-2">
                <button onclick="openLesionModal('${String(l.id).replace(/'/g, '')}')" class="text-blue-600 hover:text-blue-800 font-semibold cursor-pointer">Edit</button>
                <button onclick="deleteLesion('${String(l.id).replace(/'/g, '')}')" class="text-red-500 hover:text-red-700 font-semibold cursor-pointer">Delete</button>
            </td>
        </tr>`;
    }).join('');
}

function openShaveConsentModal() {
    const modal = document.getElementById('shaveConsentModal');
    if (modal) modal.classList.remove('hidden');
}

function closeShaveConsentModal() {
    const modal = document.getElementById('shaveConsentModal');
    if (modal) modal.classList.add('hidden');
}

function confirmShaveConsent() {
    pendingShaveConsentAction = 'verbal';
    shaveConsentVerified = true;
    closeShaveConsentModal();
    saveLesion();
}

function skipShaveVerbalConsent() {
    pendingShaveConsentAction = 'skip';
    closeShaveConsentModal();
    saveLesion();
}

function cancelShaveConsent() {
    pendingShaveConsentAction = '';
    closeShaveConsentModal();
}

