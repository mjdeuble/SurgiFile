/* Operative excision generator (note + shorthand pathology request) */

function loadProcSupplies() {
    /* Prefer clinic-folder supplies when available; sync fallback for boot before login. */
    if (typeof loadClinicSupplies === 'function' && vaultRootHandle) {
        return;
    }
    const fromLocal = typeof readLocalProcSuppliesFallback === 'function'
        ? readLocalProcSuppliesFallback()
        : null;
    if (fromLocal) {
        procSupplies = {
            anesthetics: fromLocal.anesthetics.slice(),
            sutures: fromLocal.sutures.slice(),
            preps: fromLocal.preps.slice()
        };
        return;
    }
    try {
        const raw = localStorage.getItem(PROC_SUPPLIES_STORAGE_KEY);
        if (raw) {
            const parsed = JSON.parse(raw);
            procSupplies = {
                anesthetics: Array.isArray(parsed.anesthetics) && parsed.anesthetics.length
                    ? parsed.anesthetics.map((item) => String(item || '').trim()).filter(Boolean)
                    : DEFAULT_PROC_SUPPLIES.anesthetics.slice(),
                sutures: Array.isArray(parsed.sutures) && parsed.sutures.length
                    ? parsed.sutures.map((item) => String(item || '').trim()).filter(Boolean)
                    : DEFAULT_PROC_SUPPLIES.sutures.slice(),
                preps: Array.isArray(parsed.preps) && parsed.preps.length
                    ? parsed.preps.map((item) => String(item || '').trim()).filter(Boolean)
                    : DEFAULT_PROC_SUPPLIES.preps.slice()
            };
            return;
        }
    } catch (err) {
        /* fall through to defaults */
    }
    procSupplies = {
        anesthetics: DEFAULT_PROC_SUPPLIES.anesthetics.slice(),
        sutures: DEFAULT_PROC_SUPPLIES.sutures.slice(),
        preps: DEFAULT_PROC_SUPPLIES.preps.slice()
    };
}

async function saveProcSupplies() {
    try {
        if (typeof saveClinicSupplies === 'function') {
            await saveClinicSupplies();
            return;
        }
        localStorage.setItem(PROC_SUPPLIES_STORAGE_KEY, JSON.stringify(procSupplies));
    } catch (err) {
        showToast(err.message || 'Unable to save procedure supplies.');
    }
}

function fillSelectOptions(select, items, selectedValue, placeholder) {
    if (!select) return;
    const current = selectedValue !== undefined ? selectedValue : select.value;
    const list = (items || []).slice();
    if (current && !list.includes(current)) list.push(current);
    select.innerHTML = '';
    if (placeholder) {
        const opt = document.createElement('option');
        opt.value = '';
        opt.textContent = placeholder;
        select.appendChild(opt);
    }
    list.forEach((item) => {
        const opt = document.createElement('option');
        opt.value = item;
        opt.textContent = item;
        select.appendChild(opt);
    });
    if (current) select.value = current;
}

function populateProcSupplySelects(selected) {
    const anesthetic = selected?.anesthetic ?? document.getElementById('exLocalAnesthetic')?.value;
    const deepSuture = selected?.deepSutureType ?? document.getElementById('exDeepSutureType')?.value;
    const skinSuture = selected?.skinSutureType ?? document.getElementById('exSkinSutureType')?.value;
    const prep = selected?.prep ?? document.getElementById('exSkinPrep')?.value;
    fillSelectOptions(document.getElementById('exLocalAnesthetic'), procSupplies.anesthetics, anesthetic);
    fillSelectOptions(document.getElementById('exDeepSutureType'), procSupplies.sutures, deepSuture);
    fillSelectOptions(document.getElementById('exSkinSutureType'), procSupplies.sutures, skinSuture);
    fillSelectOptions(document.getElementById('exSkinPrep'), procSupplies.preps, prep, 'Select prep...');
}

function renderProcSupplyEditorList(kind, containerId) {
    const list = document.getElementById(containerId);
    if (!list) return;
    const items = procSupplies[kind] || [];
    if (!items.length) {
        list.innerHTML = `<p class="text-[11px] text-slate-500 italic">None saved yet.</p>`;
        return;
    }
    list.innerHTML = items.map((item, idx) => `
        <div class="flex items-center gap-1.5">
            <input type="text" value="${escapeHtml(item)}" onchange="updateProcSupplyItem('${kind}', ${idx}, this.value)" class="flex-1 p-1.5 border border-slate-300 rounded bg-white">
            <button type="button" onclick="removeProcSupplyItem('${kind}', ${idx})" class="text-[11px] font-bold text-red-600 hover:text-red-800 cursor-pointer">Remove</button>
        </div>
    `).join('');
}

function renderProcSupplyEditors() {
    renderProcSupplyEditorList('anesthetics', 'procSupplyAnesthetics');
    renderProcSupplyEditorList('sutures', 'procSupplySutures');
    renderProcSupplyEditorList('preps', 'procSupplyPreps');
}

async function updateProcSupplyItem(kind, index, value) {
    if (!procSupplies[kind] || !procSupplies[kind][index]) return;
    const next = String(value || '').trim();
    if (!next) return;
    procSupplies[kind][index] = next;
    await saveProcSupplies();
    populateProcSupplySelects();
    renderProcSupplyEditors();
}

async function removeProcSupplyItem(kind, index) {
    if (!procSupplies[kind]) return;
    procSupplies[kind].splice(index, 1);
    await saveProcSupplies();
    populateProcSupplySelects();
    renderProcSupplyEditors();
}

async function addProcSupplyItem(kind) {
    const inputId = kind === 'anesthetics' ? 'newProcAnesthetic' : (kind === 'sutures' ? 'newProcSuture' : 'newProcPrep');
    const input = document.getElementById(inputId);
    const value = String(input?.value || '').trim();
    if (!value) {
        showToast('Enter a name to add.');
        return;
    }
    if (!procSupplies[kind]) procSupplies[kind] = [];
    const exists = procSupplies[kind].some((item) => item.toLowerCase() === value.toLowerCase());
    if (exists) {
        showToast('That item is already in the list.');
        return;
    }
    procSupplies[kind].push(value);
    if (input) input.value = '';
    await saveProcSupplies();
    populateProcSupplySelects();
    renderProcSupplyEditors();
    showToast('Saved to clinic supplies.');
}

async function initProcedureSupplies() {
    if (typeof loadClinicSupplies === 'function' && vaultRootHandle) {
        await loadClinicSupplies();
    } else {
        loadProcSupplies();
    }
    populateProcSupplySelects();
    renderProcSupplyEditors();
}

function setProcedurePathologyDisplay(value) {
    if (typeof setDiagnosisTypeahead === 'function' && document.getElementById('exPathologySearch')) {
        setDiagnosisTypeahead('exPathologySearch', value || '');
        return;
    }
    const displayEl = document.getElementById('exPathologyDisplay');
    if (!displayEl) return;
    const text = typeof formatDiagnosisDisplay === 'function' ? formatDiagnosisDisplay(value) : String(value || '').replace(/;/g, ', ');
    if (text) {
        displayEl.textContent = text;
        displayEl.classList.remove('italic', 'text-slate-500');
    } else {
        displayEl.textContent = 'Click to select...';
        displayEl.classList.add('italic', 'text-slate-500');
    }
}

function syncExDermoscopyButtons() {
    const val = document.getElementById('exDermoscopyUsed')?.value || '';
    document.querySelectorAll('#ex-dermoscopy-btn-container .dermoscopy-btn').forEach((btn) => {
        btn.classList.toggle('selected', btn.dataset.value === val);
    });
}

function initExcisionGeneratorModule() {
    drawExOrientationClock();
    setupExcisionEventListeners();
    initProcedureSupplies();
    updateExFormUI();
}

function setupExcisionEventListeners() {
    const exForm = document.getElementById('ex-lesion-form');
    if (exForm) {
        exForm.addEventListener('change', updateExFormUI);
        exForm.addEventListener('input', checkExFormCompleteness);
    }

    // Justification Quick Buttons
    const exJustBtns = document.getElementById('ex-justification-buttons');
    if (exJustBtns) {
        exJustBtns.addEventListener('click', (e) => {
            if (e.target.classList.contains('justification-btn')) {
                e.target.classList.toggle('selected');
                const selectedBtns = exJustBtns.querySelectorAll('.justification-btn.selected');
                const justifications = Array.from(selectedBtns).map(btn => btn.dataset.text);
                document.getElementById('exFlapGraftJustification').value = justifications.join(' ');
                checkExFormCompleteness();
            }
        });
    }

    // Dermoscopy Buttons
    const exDermoContainer = document.getElementById('ex-dermoscopy-btn-container');
    if (exDermoContainer) {
        exDermoContainer.addEventListener('click', (e) => {
            const target = e.target.closest('.dermoscopy-btn');
            if (!target) return;
            document.getElementById('exDermoscopyUsed').value = target.dataset.value;
            exDermoContainer.querySelectorAll('.dermoscopy-btn').forEach(btn => btn.classList.remove('selected'));
            target.classList.add('selected');
            checkExFormCompleteness();
        });
    }

    // Orientation Marker Type Buttons
    const exMarkerContainer = document.getElementById('ex-main-marker-btn-container');
    if (exMarkerContainer) {
        exMarkerContainer.addEventListener('click', (e) => {
            const target = e.target.closest('.main-marker-btn');
            if (!target) return;

            const markerType = target.dataset.value;
            document.getElementById('exOrientationType').value = markerType;

            if (markerType === 'None') {
                document.getElementById('exOrientationDescription').value = '';
                updateExOrientationButtons();
            } else {
                openExOrientationModal();
            }
        });
    }

    // Orientation Modal Location Selector
    const exModalSelector = document.getElementById('ex-modal-location-selector');
    if (exModalSelector) {
        exModalSelector.addEventListener('click', (e) => {
            const target = e.target.closest('.direction-btn, .hour-text');
            if (!target) return;

            document.getElementById('exOrientationDescription').value = target.dataset.value;
            updateExOrientationButtons();
            closeExOrientationModal();
        });
    }

    // Deep Suture Toggle
    const exDeepChk = document.getElementById('exUseDeepSuture');
    if (exDeepChk) {
        exDeepChk.addEventListener('change', () => {
            document.getElementById('ex-deep-suture-container')?.classList.toggle('hidden', !exDeepChk.checked);
            checkExFormCompleteness();
        });
    }

    // Skin Suture Non-Dissolvable Toggle
    const exSkinChk = document.getElementById('exUseNonDissolvable');
    if (exSkinChk) {
        exSkinChk.addEventListener('change', () => {
            document.getElementById('ex-skin-suture-details')?.classList.toggle('hidden', !exSkinChk.checked);
            checkExFormCompleteness();
        });
    }
}

function updateExFormUI() {
    const proc = document.getElementById('exProcedureType')?.value || '';
    const closure = document.getElementById('exExcisionClosureType')?.value || '';
    const punchType = document.getElementById('exPunchType')?.value || '';

    const dynContainer = document.getElementById('ex-dynamic-options-container');
    const exOpt = document.getElementById('ex-excision-options');
    const graftOpt = document.getElementById('ex-graft-type-container');
    const justOpt = document.getElementById('ex-justification-container');
    const punchOpt = document.getElementById('ex-punch-options');
    const sizeOpt = document.getElementById('ex-lesion-size-container');
    const marginOpt = document.getElementById('ex-margin-container');
    const punchSizeOpt = document.getElementById('ex-punch-size-container');
    const billingOpt = document.getElementById('ex-billing-region-container');
    const orientOpt = document.getElementById('ex-orientation-input-container');
    const closureOpt = document.getElementById('ex-closure-details-container');

    document.querySelectorAll('.ex-form-section').forEach(el => el.style.display = 'none');

    if (!proc) {
        if (dynContainer) dynContainer.style.display = 'none';
        checkExFormCompleteness();
        return;
    }

    if (dynContainer) dynContainer.style.display = 'block';
    if (orientOpt) orientOpt.style.display = 'block';

    switch (proc) {
        case 'Excision':
            if (exOpt) exOpt.style.display = 'block';
            if (sizeOpt) sizeOpt.style.display = 'block';
            if (marginOpt) marginOpt.style.display = 'block';
            if (billingOpt) billingOpt.style.display = 'block';
            if (graftOpt) graftOpt.style.display = (closure === 'Graft' || closure === 'Graft + Flap') ? 'block' : 'none';
            if (justOpt) justOpt.style.display = (closure === 'Graft' || closure === 'Flap' || closure === 'Graft + Flap') ? 'block' : 'none';
            if (closureOpt) closureOpt.style.display = (closure !== 'Secondary Intention') ? 'block' : 'none';
            break;
        case 'Punch':
            if (punchOpt) punchOpt.style.display = 'block';
            if (closureOpt) closureOpt.style.display = 'block';
            if (punchType === 'Punch Biopsy') {
                if (punchSizeOpt) punchSizeOpt.style.display = 'block';
                if (billingOpt) billingOpt.style.display = 'block';
            } else {
                if (sizeOpt) sizeOpt.style.display = 'block';
                if (marginOpt) marginOpt.style.display = 'block';
                if (billingOpt) billingOpt.style.display = 'block';
            }
            break;
        case 'Shave':
            if (sizeOpt) sizeOpt.style.display = 'block';
            if (marginOpt) marginOpt.style.display = 'block';
            if (billingOpt) billingOpt.style.display = 'block';
            break;
    }

    const sizeLabel = document.getElementById('exLesionSizeLabel');
    const marginLabel = document.getElementById('exMarginLabel');
    if (proc === 'Shave') {
        if (sizeLabel) sizeLabel.textContent = 'Lesion Dimensions (mm) — optional';
        if (marginLabel) marginLabel.textContent = 'Clinical Margin (mm) — optional';
    } else {
        if (sizeLabel) sizeLabel.textContent = 'Lesion Dimensions (mm) *';
        if (marginLabel) marginLabel.textContent = 'Clinical Margin (mm) *';
    }

    checkExFormCompleteness();
}

function isExFormComplete() {
    const filled = (id) => !!(document.getElementById(id)?.value || '').trim();
    const proc = document.getElementById('exProcedureType')?.value || '';
    if (!proc) return false;
    if (!filled('exLesionLocation') || !filled('exProvisionalDiagnoses') || !filled('exDermoscopyUsed')) return false;
    switch (proc) {
        case 'Excision': {
            if (!filled('exLesionLength') || !filled('exLesionWidth') || !filled('exMargin') || !filled('exBillingRegion')) return false;
            const closureVal = document.getElementById('exExcisionClosureType')?.value || '';
            const isComplex = closureVal === 'Graft' || closureVal === 'Flap' || closureVal === 'Graft + Flap';
            if (isComplex && !filled('exFlapGraftJustification')) return false;
            if ((closureVal === 'Graft' || closureVal === 'Graft + Flap') && !filled('exGraftType')) return false;
            break;
        }
        case 'Punch': {
            const punchTypeVal = document.getElementById('exPunchType')?.value || '';
            if (punchTypeVal === 'Punch Biopsy') {
                if (!filled('exPunchSize') || !filled('exBillingRegion')) return false;
            } else if (!filled('exLesionLength') || !filled('exLesionWidth') || !filled('exMargin') || !filled('exBillingRegion')) {
                return false;
            }
            break;
        }
        case 'Shave':
            if (!filled('exBillingRegion')) return false;
            break;
        default:
            return false;
    }
    const closureVal = document.getElementById('exExcisionClosureType')?.value || '';
    const needsRos = proc !== 'Shave' && closureVal !== 'Secondary Intention'
        && !!document.getElementById('exUseNonDissolvable')?.checked;
    if (needsRos && !filled('exRemovalOfSkinSutures')) return false;
    return true;
}

function checkExFormCompleteness() {
    const addBtn = document.getElementById('ex-add-lesion-btn');
    if (!addBtn) return;
    if (typeof procedureSession !== 'undefined' && typeof isProcedureAllocationLocked === 'function' && isProcedureAllocationLocked(procedureSession.detailLesionId)) {
        addBtn.disabled = true;
        updateExAllOutputs({ skipVisitSave: true });
        return;
    }

    const validateAndHighlight = (el, isRequired) => {
        if (!el) return true;
        let isValid = true;
        if (isRequired) {
            if (!el.value || !el.value.trim()) {
                el.classList.add('missing-field');
                isValid = false;
            } else {
                el.classList.remove('missing-field');
            }
        } else {
            el.classList.remove('missing-field');
        }
        return isValid;
    };

    let isAllValid = true;
    const proc = document.getElementById('exProcedureType')?.value || '';

    if (!proc) {
        addBtn.disabled = true;
        updateExAllOutputs({ skipVisitSave: true });
        return;
    }

    isAllValid &= validateAndHighlight(document.getElementById('exLesionLocation'), true);
    const dxHidden = document.getElementById('exProvisionalDiagnoses');
    const dxSearch = document.getElementById('exPathologySearch');
    const dxFilled = !!(dxHidden?.value || '').trim();
    if (dxSearch) {
        dxSearch.classList.toggle('missing-field', !dxFilled);
        isAllValid &= dxFilled;
    } else {
        isAllValid &= validateAndHighlight(dxHidden, true);
    }
    isAllValid &= validateAndHighlight(document.getElementById('exDermoscopyUsed'), true);

    switch (proc) {
        case 'Excision':
            isAllValid &= validateAndHighlight(document.getElementById('exLesionLength'), true);
            isAllValid &= validateAndHighlight(document.getElementById('exLesionWidth'), true);
            isAllValid &= validateAndHighlight(document.getElementById('exMargin'), true);
            isAllValid &= validateAndHighlight(document.getElementById('exBillingRegion'), true);
            
            const closureVal = document.getElementById('exExcisionClosureType')?.value || '';
            const isComplex = closureVal === 'Graft' || closureVal === 'Flap' || closureVal === 'Graft + Flap';
            isAllValid &= validateAndHighlight(document.getElementById('exFlapGraftJustification'), isComplex);
            
            if (closureVal === 'Graft' || closureVal === 'Graft + Flap') {
                isAllValid &= validateAndHighlight(document.getElementById('exGraftType'), true);
            }
            break;
        case 'Punch':
            const punchTypeVal = document.getElementById('exPunchType')?.value || '';
            if (punchTypeVal === 'Punch Biopsy') {
                isAllValid &= validateAndHighlight(document.getElementById('exPunchSize'), true);
                isAllValid &= validateAndHighlight(document.getElementById('exBillingRegion'), true);
            } else {
                isAllValid &= validateAndHighlight(document.getElementById('exLesionLength'), true);
                isAllValid &= validateAndHighlight(document.getElementById('exLesionWidth'), true);
                isAllValid &= validateAndHighlight(document.getElementById('exMargin'), true);
                isAllValid &= validateAndHighlight(document.getElementById('exBillingRegion'), true);
            }
            break;
        case 'Shave':
            isAllValid &= validateAndHighlight(document.getElementById('exLesionLength'), false);
            isAllValid &= validateAndHighlight(document.getElementById('exLesionWidth'), false);
            isAllValid &= validateAndHighlight(document.getElementById('exMargin'), false);
            isAllValid &= validateAndHighlight(document.getElementById('exBillingRegion'), true);
            break;
    }

    const closureForRos = document.getElementById('exExcisionClosureType')?.value || '';
    const needsRos = proc !== 'Shave' && closureForRos !== 'Secondary Intention'
        && !!document.getElementById('exUseNonDissolvable')?.checked;
    isAllValid &= validateAndHighlight(document.getElementById('exRemovalOfSkinSutures'), needsRos);

    addBtn.disabled = !isAllValid;
    updateExAllOutputs({ skipVisitSave: true });
}

function collectExLesionFromForm(id, sourceLesionId) {
    const getVal = (elId) => document.getElementById(elId)?.value || '';
    const getChk = (elId) => document.getElementById(elId)?.checked || false;
    const procedure = getVal('exProcedureType');
    const punchType = procedure === 'Punch' ? (getVal('exPunchType') || 'Punch Biopsy') : '';
    const lesionData = {
        id,
        sourceLesionId: sourceLesionId || '',
        procedure,
        excisionClosureType: procedure === 'Excision' ? getVal('exExcisionClosureType') : '',
        punchType,
        graftType: getVal('exGraftType'),
        justification: getVal('exFlapGraftJustification'),
        location: getVal('exLesionLocation'),
        patientName: (typeof currentPatient !== 'undefined' && currentPatient?.name) || '',
        patientDob: (typeof currentPatient !== 'undefined' && currentPatient?.dob) || '',
        chartId: (typeof currentPatient !== 'undefined' && currentPatient?.chartId) || '',
        billingRegion: getVal('exBillingRegion'),
        bodyAreaLabel: typeof procedureAreaLabel === 'function' ? procedureAreaLabel(getVal('exBillingRegion')) : '',
        anesthetic: getVal('exLocalAnesthetic'),
        prep: getVal('exSkinPrep'),
        pathology: getVal('exProvisionalDiagnoses'),
        excludeNMSC: getChk('exExcludeNMSC'),
        excludeMelanoma: getChk('exExcludeMelanoma'),
        dermoscopyUsed: getVal('exDermoscopyUsed'),
        length: punchType === 'Punch Biopsy' ? '' : getVal('exLesionLength'),
        width: punchType === 'Punch Biopsy' ? '' : getVal('exLesionWidth'),
        margin: punchType === 'Punch Biopsy' ? '' : getVal('exMargin'),
        punchSize: punchType === 'Punch Biopsy' ? getVal('exPunchSize') : '',
        orientationType: getVal('exOrientationType'),
        orientationDescription: getVal('exOrientationDescription'),
        useDeepSuture: getChk('exUseDeepSuture'),
        deepSutureSize: getVal('exDeepSutureSize'),
        deepSutureType: getVal('exDeepSutureType'),
        skinSutureSize: getVal('exSkinSutureSize'),
        skinSutureType: getChk('exUseNonDissolvable') ? getVal('exSkinSutureType') : 'Dissolvable',
        skinSutureRemoval: getChk('exUseNonDissolvable') ? getVal('exRemovalOfSkinSutures') : null,
        isDraft: false
    };
    return typeof attachPriorHistologyToExLesion === 'function'
        ? attachPriorHistologyToExLesion(lesionData, sourceLesionId)
        : lesionData;
}

function draftExLesionFromForm() {
    const procedure = document.getElementById('exProcedureType')?.value || '';
    if (!procedure) return null;
    const existing = editingExLesionId != null
        ? exLesions.find((item) => item.id === editingExLesionId)
        : null;
    const sourceId = (typeof procedureSession !== 'undefined' && procedureSession.detailLesionId)
        ? String(procedureSession.detailLesionId)
        : (existing?.sourceLesionId || '');
    const draft = collectExLesionFromForm(existing?.id || 'draft', sourceId);
    draft.isDraft = true;
    return draft;
}

function shouldMergeExFormDraft() {
    if (typeof procedureSession === 'undefined') return true;
    if (procedureSession.started || procedureSession.completedAt) return false;
    return true;
}

function exLesionsForOutput() {
    if (typeof ensureExLesionsFromOutputLesions === 'function') ensureExLesionsFromOutputLesions();
    if (!shouldMergeExFormDraft()) return exLesions.slice();
    const draft = draftExLesionFromForm();
    if (!draft) return exLesions.slice();
    const idx = exLesions.findIndex((item) => {
        if (editingExLesionId != null && item.id === editingExLesionId) return true;
        if (draft.sourceLesionId && String(item.sourceLesionId) === String(draft.sourceLesionId)) return true;
        return false;
    });
    if (idx === -1) return exLesions.concat([draft]);
    const next = exLesions.slice();
    next[idx] = { ...next[idx], ...draft, id: next[idx].id, isDraft: false };
    return next;
}

function addOrUpdateExLesion() {
    const isUpdating = editingExLesionId !== null;
    const existing = isUpdating ? exLesions.find((item) => item.id === editingExLesionId) : null;
    const sourceId = (typeof procedureSession !== 'undefined' && procedureSession.detailLesionId)
        ? String(procedureSession.detailLesionId)
        : (existing?.sourceLesionId || '');
    const lesionData = collectExLesionFromForm(
        isUpdating ? editingExLesionId : ++exLesionCounter,
        sourceId
    );

    if (isUpdating) {
        const idx = exLesions.findIndex(l => l.id === editingExLesionId);
        if (idx !== -1) exLesions[idx] = lesionData;
    } else {
        exLesions.push(lesionData);
    }

    updateExAllOutputs();
    resetExLesionForm();
}

function startEditExLesion(id) {
    if (typeof procedureSession !== 'undefined' && procedureSession.started) {
        showToast('Lesion details are locked once the procedure has started. Change sutures from Finish procedure.');
        return;
    }
    const lesion = exLesions.find(l => l.id === id);
    if (!lesion) return;
    editingExLesionId = id;

    const setVal = (elId, val) => { const el = document.getElementById(elId); if (el) el.value = val || ''; };
    const setChk = (elId, val) => { const el = document.getElementById(elId); if (el) el.checked = !!val; };

    setVal('exProcedureType', lesion.procedure);
    updateExFormUI();

    setVal('exExcisionClosureType', lesion.excisionClosureType);
    setVal('exPunchType', lesion.punchType);
    setVal('exGraftType', lesion.graftType);
    setVal('exFlapGraftJustification', lesion.justification);
    setVal('exBillingRegion', String(lesion.billingRegion || billingRegionFromBodyArea(lesion.bodyAreaId) || ''));

    // Reselect justification buttons
    const justContainer = document.getElementById('ex-justification-buttons');
    if (justContainer) {
        justContainer.querySelectorAll('.justification-btn').forEach(btn => {
            if (lesion.justification && lesion.justification.includes(btn.dataset.text)) {
                btn.classList.add('selected');
            } else {
                btn.classList.remove('selected');
            }
        });
    }

    setVal('exLesionLocation', lesion.location);
    populateProcSupplySelects(lesion);
    setVal('exLocalAnesthetic', lesion.anesthetic);
    setVal('exSkinPrep', lesion.prep);
    setProcedurePathologyDisplay(lesion.pathology);

    setVal('exLesionLength', lesion.length);
    setVal('exLesionWidth', lesion.width);
    setVal('exMargin', lesion.margin);
    setVal('exPunchSize', lesion.punchSize);
    setVal('exOrientationType', lesion.orientationType);
    setVal('exOrientationDescription', lesion.orientationDescription);
    updateExOrientationButtons();

    setChk('exExcludeNMSC', lesion.excludeNMSC);
    setChk('exExcludeMelanoma', lesion.excludeMelanoma);
    setVal('exDermoscopyUsed', lesion.dermoscopyUsed);

    document.querySelectorAll('#ex-dermoscopy-btn-container .dermoscopy-btn').forEach(btn => {
        btn.classList.toggle('selected', btn.dataset.value === lesion.dermoscopyUsed);
    });

    setChk('exUseDeepSuture', lesion.useDeepSuture);
    setVal('exDeepSutureSize', lesion.deepSutureSize);
    setVal('exDeepSutureType', lesion.deepSutureType);

    const isNonDissolvable = lesion.skinSutureType !== 'Dissolvable';
    setChk('exUseNonDissolvable', isNonDissolvable);
    document.getElementById('ex-skin-suture-details')?.classList.toggle('hidden', !isNonDissolvable);
    if (isNonDissolvable) {
        setVal('exSkinSutureSize', lesion.skinSutureSize);
        setVal('exSkinSutureType', lesion.skinSutureType);
        setVal('exRemovalOfSkinSutures', lesion.skinSutureRemoval);
    }

    updateExFormUI();

    document.getElementById('ex-form-title').textContent = `Editing Lesion ${id}`;
    document.getElementById('ex-add-lesion-btn').textContent = 'Save lesion data';
    document.getElementById('ex-cancel-edit-btn').classList.remove('hidden');
    document.getElementById('ex-clear-all-btn').classList.add('hidden');
}

function cancelExEdit() {
    resetExLesionForm();
}

function resetExLesionForm(resetProcType = true) {
    editingExLesionId = null;
    const exForm = document.getElementById('ex-lesion-form');
    if (exForm) exForm.reset();

    document.getElementById('exOrientationType').value = 'None';
    document.getElementById('exOrientationDescription').value = '';
    setProcedurePathologyDisplay('');
    document.getElementById('exDermoscopyUsed').value = '';

    document.querySelectorAll('#ex-dermoscopy-btn-container .dermoscopy-btn').forEach(btn => btn.classList.remove('selected'));
    document.querySelectorAll('#ex-justification-buttons .justification-btn').forEach(btn => btn.classList.remove('selected'));

    document.getElementById('ex-form-title').textContent = procedureSession.detailLesionId ? 'Enter procedure data' : `Enter Lesion ${exLesionCounter + 1} Details`;
    document.getElementById('ex-add-lesion-btn').textContent = 'Save lesion data';
    document.getElementById('ex-cancel-edit-btn').classList.add('hidden');
    document.getElementById('ex-clear-all-btn').classList.remove('hidden');

    if (resetProcType && document.getElementById('exProcedureType')) {
        document.getElementById('exProcedureType').value = '';
    }

    updateExOrientationButtons();
    updateExFormUI();
}

function resetExAll() {
    if (typeof procedureSession !== 'undefined' && procedureSession.started) {
        showToast('Lesion details are locked once the procedure has started. Change sutures from Finish procedure.');
        return;
    }
    exLesions = [];
    exLesionCounter = 0;
    resetExLesionForm();
    updateExAllOutputs();
}

function removeExLesion(id) {
    if (typeof procedureSession !== 'undefined' && procedureSession.started) {
        showToast('Return a lesion from Finish procedure instead of removing it here.');
        return;
    }
    exLesions = exLesions.filter(l => l.id !== id);
    exLesions.forEach((lesion, index) => { lesion.id = index + 1; });
    exLesionCounter = exLesions.length;
    document.getElementById('ex-form-title').textContent = `Enter Lesion ${exLesionCounter + 1} Details`;

    if (editingExLesionId === id) cancelExEdit();
    updateExAllOutputs();
}

function updateExLesionsList() {
    const listEl = document.getElementById('ex-lesions-list');
    if (!listEl) return;

    listEl.innerHTML = '';
    if (exLesions.length === 0) {
        listEl.innerHTML = `<p class="text-xs text-slate-400 italic">No lesions added yet.</p>`;
        return;
    }

    exLesions.forEach(lesion => {
        const item = document.createElement('div');
        item.className = 'bg-slate-50 p-3 rounded-xl border border-slate-200 flex justify-between items-center text-xs';
        item.innerHTML = `
            <div>
                <p class="font-bold text-slate-800">${lesion.id}. ${lesion.location}</p>
                <p class="text-slate-500">${typeof formatDiagnosisDisplay === 'function' ? formatDiagnosisDisplay(lesion.pathology) : lesion.pathology.replace(/;/g, ', ')} (${lesion.procedure} - ${lesion.excisionClosureType || lesion.punchType || 'Shave'})</p>
            </div>
            <div class="flex items-center gap-1.5">
                ${typeof procedureSession !== 'undefined' && procedureSession.started ? '' : `<button onclick="startEditExLesion(${lesion.id})" class="text-blue-600 hover:text-blue-800 font-semibold px-2 py-1 cursor-pointer">Edit</button>
                <button onclick="removeExLesion(${lesion.id})" class="text-red-500 hover:text-red-700 font-semibold px-2 py-1 cursor-pointer">&times; Remove</button>`}
            </div>
        `;
        listEl.appendChild(item);
    });
}

function generateExClinicalRequest() {
    const items = exLesionsForOutput();
    if (items.length === 0) {
        return 'Your clinical request will appear here...';
    }

    return items.map((lesion, index) => {
        const n = lesion.histologyPot || (lesion.id && lesion.id !== 'draft' ? lesion.id : index + 1);
        const auditParts = [];
        auditParts.push(lesion.location || 'Unspecified site');
        auditParts.push(lesion.pathology || 'Unspecified');

        if (lesion.excludeNMSC) auditParts.push('ex NMSC');
        if (lesion.excludeMelanoma) auditParts.push('ex MEL');

        let managementCode = 'O';
        switch (lesion.procedure) {
            case 'Excision':
                switch (lesion.excisionClosureType) {
                    case 'Ellipse': managementCode = 'E'; break;
                    case 'Flap': managementCode = 'F'; break;
                    case 'Graft': managementCode = lesion.graftType === 'Split-Skin Graft (SSG)' ? 'SSG' : 'FTG'; break;
                    case 'Graft + Flap': managementCode = (lesion.graftType === 'Split-Skin Graft (SSG)' ? 'SSG' : 'FTG') + '+F'; break;
                    case 'Secondary Intention': managementCode = 'NC'; break;
                    default: managementCode = 'E'; break;
                }
                break;
            case 'Punch':
                managementCode = lesion.punchType === 'Punch Biopsy' ? 'PS' : 'PR';
                break;
            case 'Shave':
                managementCode = 'SxEx';
                break;
        }
        auditParts.push(managementCode);

        if (lesion.dermoscopyUsed) {
            auditParts.push(`D=${lesion.dermoscopyUsed}`);
        }

        return `${n}. ${auditParts.join('; ')} ${exRequestDimensionString(lesion)}`;
    }).join('\n');
}

function exRequestDimensionString(lesion) {
    const dimensionParts = [];
    let procedureNameFull = lesion.procedure || 'Procedure';
    if (lesion.procedure === 'Excision') procedureNameFull = `Excision (${lesion.excisionClosureType || 'Ellipse'})`;
    if (lesion.procedure === 'Punch') procedureNameFull = lesion.punchType || 'Punch';
    if (lesion.procedure === 'Shave') procedureNameFull = 'Shave Biopsy';
    dimensionParts.push(procedureNameFull);

    const punchBiopsy = lesion.procedure === 'Punch' && (lesion.punchType || 'Punch Biopsy') === 'Punch Biopsy';
    if (punchBiopsy) {
        if (lesion.punchSize) dimensionParts.push(`Punch: ${lesion.punchSize}mm`);
    } else {
        if (lesion.length && lesion.width) dimensionParts.push(`${lesion.length}x${lesion.width}mm`);
        else if (lesion.length) dimensionParts.push(`${lesion.length}mm`);
        else if (lesion.width) dimensionParts.push(`${lesion.width}mm`);
        if (lesion.margin) dimensionParts.push(`Margin: ${typeof formatMarginCompact === 'function' ? formatMarginCompact(lesion.margin) : (lesion.margin + 'mm')}`);
    }

    const diameter = exClinicalDiameterMm(lesion);
    if (diameter > 0) dimensionParts.push(`Dia: ${diameter.toFixed(2)}mm`);

    if (lesion.orientationType && lesion.orientationType !== 'None') {
        dimensionParts.push(`${lesion.orientationType}: ${lesion.orientationDescription}`);
    }

    return `[${dimensionParts.join(', ')}]`;
}

function exClinicalDiameterMm(lesion) {
    if (lesion.procedure === 'Punch' && (lesion.punchType || 'Punch Biopsy') === 'Punch Biopsy') {
        return parseFloat(lesion.punchSize) || 0;
    }
    const length = parseFloat(lesion.length);
    const width = parseFloat(lesion.width);
    const margin = parseFloat(lesion.margin);
    if (Number.isFinite(length) && Number.isFinite(width) && Number.isFinite(margin)) {
        return ((length + width) / 2) + (2 * margin);
    }
    return 0;
}

function exFindingsSizeText(lesion) {
    const size = (lesion.length && lesion.width)
        ? `${lesion.length}x${lesion.width}mm`
        : (lesion.length ? `${lesion.length}mm` : (lesion.width ? `${lesion.width}mm` : ''));
    const margin = lesion.margin
        ? `${typeof formatMarginCompact === 'function' ? formatMarginCompact(lesion.margin) : (lesion.margin + 'mm')} clinical margins`
        : '';
    if (size && margin) return `A ${size} lesion excised with ${margin}.`;
    if (size) return `A ${size} lesion excised.`;
    if (margin) return `Lesion excised with ${margin}.`;
    return 'Lesion excised.';
}

function exShaveFindingsText(lesion) {
    const size = (lesion.length && lesion.width)
        ? `${lesion.length}x${lesion.width}mm`
        : (lesion.length ? `${lesion.length}mm` : (lesion.width ? `${lesion.width}mm` : ''));
    const margin = lesion.margin
        ? `${typeof formatMarginCompact === 'function' ? formatMarginCompact(lesion.margin) : (lesion.margin + 'mm')} clinical margin`
        : '';
    if (size && margin) return `A ${size} lesion removed via shave biopsy with ${margin}.`;
    if (size) return `A ${size} lesion removed via shave biopsy.`;
    if (margin) return `Shave biopsy with ${margin}.`;
    return 'Shave biopsy of the lesion.';
}

function exPrepNoteText(lesion) {
    if (lesion.prep) return `Skin prepped with ${lesion.prep} and draped in a sterile manner.`;
    return 'Site prepped and draped in a sterile manner.';
}

function exSkinClosureSentence(lesion) {
    const size = String(lesion.skinSutureSize || '').trim();
    const type = String(lesion.skinSutureType || '').trim();
    if (size && type) return `Skin closed with ${size} ${type}.`;
    if (type) return `Skin closed with ${type}.`;
    if (size) return `Skin closed with ${size}.`;
    return 'Skin closed.';
}

function generateExEntryNote() {
    const items = exLesionsForOutput();
    if (items.length === 0) {
        return 'Your generated note will appear here...';
    }

    const procedureDetails = items.map((lesion, index) => {
        const n = lesion.histologyPot || (lesion.id && lesion.id !== 'draft' ? lesion.id : index + 1);
        let procedureTitle = '';
        const closureParts = [];
        const findingsParts = [];

        if (lesion.useDeepSuture) {
            closureParts.push(`Deep closure with ${lesion.deepSutureSize} ${lesion.deepSutureType}.`);
        }

        switch (lesion.procedure) {
            case 'Excision':
                procedureTitle = `Excision with ${lesion.excisionClosureType || 'Ellipse'}`;
                findingsParts.push(exFindingsSizeText(lesion));
                if (lesion.justification) {
                    findingsParts.push(`Justification for complex closure: ${lesion.justification}`);
                }
                if (lesion.excisionClosureType === 'Secondary Intention') {
                    closureParts.push('Wound left to heal by secondary intention.');
                } else {
                    if (lesion.excisionClosureType === 'Graft' || lesion.excisionClosureType === 'Graft + Flap') {
                        closureParts.push(`Defect repaired with a ${lesion.graftType}.`);
                    }
                    if (lesion.excisionClosureType === 'Flap' || lesion.excisionClosureType === 'Graft + Flap') {
                        if (!closureParts.some(p => p.includes('repaired with'))) {
                            closureParts.push(`Defect repaired with a flap.`);
                        } else {
                            closureParts[closureParts.length - 1] += ' and a flap.';
                        }
                    }
                    closureParts.push(exSkinClosureSentence(lesion));
                }
                break;
            case 'Punch':
                procedureTitle = lesion.punchType || 'Punch Biopsy';
                if ((lesion.punchType || 'Punch Biopsy') === 'Punch Biopsy') {
                    findingsParts.push(lesion.punchSize
                        ? `A ${lesion.punchSize}mm punch biopsy was taken from the lesion site.`
                        : 'A punch biopsy was taken from the lesion site.');
                } else {
                    findingsParts.push(exFindingsSizeText(lesion).replace('excised.', 'excised via punch technique.'));
                }
                closureParts.push(exSkinClosureSentence(lesion));
                break;
            case 'Shave':
                procedureTitle = 'Shave Biopsy';
                findingsParts.push(exShaveFindingsText(lesion));
                closureParts.push('Hemostasis achieved. Left to heal by secondary intention.');
                break;
            default:
                procedureTitle = lesion.procedure || 'Procedure';
                findingsParts.push(exFindingsSizeText(lesion));
                break;
        }

        let specimenText = `Sent for histopathology, labelled as "${n}. ${lesion.location || 'Unspecified site'}".`;
        if (lesion.orientationType && lesion.orientationType !== 'None') {
            specimenText += ` Orientation marker (${lesion.orientationType}) at ${lesion.orientationDescription}.`;
        }
        const priorCite = typeof formatPriorHistologyCitation === 'function' ? formatPriorHistologyCitation(lesion) : '';
        if (priorCite) specimenText += ` ${priorCite}.`;

        return `PROCEDURE ${n}: ${procedureTitle} of the ${lesion.location || 'unspecified site'}\n- Consent: Obtained after discussion of risks, benefits, and alternatives.\n- Anesthetic: ${lesion.anesthetic} administered.\n- Prep: ${exPrepNoteText(lesion)}\n- Findings: ${findingsParts.join(' ')}\n- Closure: ${closureParts.join(' ')}\n- Specimen: ${specimenText}`;
    }).join('\n\n');

    const planItems = [];
    items.forEach((l, index) => {
        const n = l.histologyPot || (l.id && l.id !== 'draft' ? l.id : index + 1);
        let needsPlan = false;
        let planText = '';

        if (l.procedure === 'Excision' && l.excisionClosureType !== 'Secondary Intention') needsPlan = true;
        if (l.procedure === 'Punch') needsPlan = true;

        if (needsPlan) {
            if (l.skinSutureType === 'Dissolvable') {
                planText = `- Wound for lesion ${n} (${l.location || 'unspecified site'}) closed with dissolvable skin sutures which do not require removal.`;
            } else if (l.skinSutureRemoval) {
                planText = `- Sutures for lesion ${n} (${l.location || 'unspecified site'}) to be removed in ${l.skinSutureRemoval} days.`;
            } else {
                planText = `- Sutures for lesion ${n} (${l.location || 'unspecified site'}) — removal date to be confirmed.`;
            }
            if (planText) planItems.push(planText);
        }
    });

    const openWoundLesions = items.filter(l => l.procedure === 'Shave' || (l.procedure === 'Excision' && l.excisionClosureType === 'Secondary Intention'));
    if (openWoundLesions.length > 0) {
        planItems.push('- For open wounds, advised to keep clean and apply antiseptic/dressing as needed.');
    }

    return `OBJECTIVE:\n${procedureDetails}\n\nFollow up:\n${planItems.length > 0 ? planItems.join('\n') : '- General wound care advice given.'}\n- Discussed signs of infection (redness, swelling, discharge, increasing pain) and to seek review if these occur.\n- Follow-up for results and further management as required.`.trim().replace(/^\s+/gm, '');
}

function updateExAllOutputs(options) {
    updateExLesionsList();
    updateExOutputVisibility();
    if (!options?.skipVisitSave && typeof scheduleVisitNoteSave === 'function') scheduleVisitNoteSave();
}

function setExOutputStyle(style) {
    localStorage.setItem('dermRecordExOutputStyle', style);
    updateExOutputVisibility();
}

function exOutputIsPlaceholder(text) {
    return !text || /^Your /i.test(String(text).trim());
}

function updateExOutputVisibility() {
    const style = localStorage.getItem('dermRecordExOutputStyle') || 'combined';
    const btnComb = document.getElementById('ex-output-btn-combined');
    const btnSep = document.getElementById('ex-output-btn-separate');
    const reqContainer = document.getElementById('ex-clinical-request-output-container');
    const noteContainer = document.getElementById('ex-entry-note-output-container');
    const reqEl = document.getElementById('exClinicalRequestOutput');
    const noteEl = document.getElementById('exEntryNoteOutput');

    if (btnComb) btnComb.className = style === 'combined' ? 'output-style-btn px-3 py-1 rounded-lg bg-blue-600 text-white font-bold cursor-pointer' : 'output-style-btn px-3 py-1 rounded-lg bg-slate-200 text-slate-700 cursor-pointer';
    if (btnSep) btnSep.className = style === 'separate' ? 'output-style-btn px-3 py-1 rounded-lg bg-blue-600 text-white font-bold cursor-pointer' : 'output-style-btn px-3 py-1 rounded-lg bg-slate-200 text-slate-700 cursor-pointer';

    const request = generateExClinicalRequest();
    const note = generateExEntryNote();
    const requestReady = !exOutputIsPlaceholder(request);
    const noteReady = !exOutputIsPlaceholder(note);

    if (reqEl) reqEl.value = request;
    if (style === 'separate') {
        if (reqContainer) reqContainer.style.display = 'block';
        if (noteContainer) noteContainer.style.display = 'block';
        if (noteEl) noteEl.value = note;
        return;
    }

    if (reqContainer) reqContainer.style.display = 'none';
    if (noteContainer) noteContainer.style.display = 'block';
    if (!noteEl) return;
    if (!requestReady && !noteReady) {
        noteEl.value = 'Your clinical request and note will appear here...';
        return;
    }
    const parts = [];
    if (noteReady) parts.push(note);
    if (requestReady) parts.push('CLINICAL REQUEST:\n' + request);
    noteEl.value = parts.join('\n\n---\n\n');
}

function openExPathologyModal() {
    document.getElementById('exPathologySearch')?.focus();
}

function confirmExPathologySelection() {
    const hiddenInput = document.getElementById('exProvisionalDiagnoses');
    setProcedurePathologyDisplay(hiddenInput?.value || '');
    const modal = document.getElementById('exPathologyModal');
    if (modal) modal.classList.add('hidden');
    checkExFormCompleteness();
}

function openExOrientationModal() {
    if (exModalSelectedLocationElement) exModalSelectedLocationElement.classList.remove('selected');
    const desc = document.getElementById('exOrientationDescription')?.value;
    const selector = document.getElementById('ex-modal-location-selector');
    if (desc && selector) {
        const targetEl = selector.querySelector(`[data-value="${desc}"]`);
        if (targetEl) {
            targetEl.classList.add('selected');
            exModalSelectedLocationElement = targetEl;
        }
    }

    const modal = document.getElementById('exOrientationModal');
    if (modal) modal.classList.remove('hidden');
}

function closeExOrientationModal() {
    const modal = document.getElementById('exOrientationModal');
    if (modal) modal.classList.add('hidden');
}

function drawExOrientationClock() {
    const clockSvg = document.getElementById('exClock');
    if (!clockSvg) return;

    const radius = 80;
    const center = 100;
    clockSvg.innerHTML = `
        <circle cx="${center}" cy="${center}" r="${radius}" class="clock-face"/>
        <circle cx="${center}" cy="${center}" r="4" class="center-dot"/>
    `;

    for (let i = 1; i <= 12; i++) {
        const angle = (i - 3) * (Math.PI / 6);
        const textX = center + (radius - 20) * Math.cos(angle);
        const textY = center + (radius - 20) * Math.sin(angle);
        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        text.setAttribute('x', textX);
        text.setAttribute('y', textY);
        text.textContent = i;
        text.classList.add('hour-text');
        text.dataset.value = `${i} O'Clock`;
        clockSvg.appendChild(text);
    }
}

function updateExOrientationButtons() {
    const type = document.getElementById('exOrientationType')?.value || 'None';
    const desc = document.getElementById('exOrientationDescription')?.value || '';
    const container = document.getElementById('ex-main-marker-btn-container');

    if (container) {
        container.querySelectorAll('.main-marker-btn').forEach(btn => {
            const btnType = btn.dataset.value;
            btn.classList.remove('selected');
            btn.textContent = btnType;

            if (btnType === type) {
                btn.classList.add('selected');
                if (type !== 'None' && desc) {
                    btn.textContent = `${type}: ${desc}`;
                }
            }
        });
    }
}

