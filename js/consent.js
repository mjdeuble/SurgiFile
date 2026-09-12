/* Formal excision surgical consent generator */

function openExcisionConsentModal() {
    if (typeof requireCurrentPatient === 'function' && !requireCurrentPatient('Open a patient chart before generating consent.')) {
        return;
    }
    const modal = document.getElementById('excisionConsentModal');
    if (!modal) return;

    if (typeof applyCurrentPatientToForms === 'function') applyCurrentPatientToForms();
    else if (typeof syncPatientIdentifiers === 'function') syncPatientIdentifiers('main');
    importExcisionLesions({ silent: true });
    modal.classList.remove('hidden');
}

function closeExcisionConsentModal() {
    const modal = document.getElementById('excisionConsentModal');
    if (modal) modal.classList.add('hidden');
}

function consentSourceLesions() {
    const map = new Map();
    const add = (item) => {
        if (!item) return;
        const key = item.id ? String(item.id) : [item.location, item.impression, map.size].join('|');
        const existing = map.get(key);
        map.set(key, existing ? { ...existing, ...item } : item);
    };
    if (typeof chartLesions === 'function' && hasCurrentPatient()) {
        chartLesions().forEach(add);
    }
    (Array.isArray(lesions) ? lesions : []).forEach(add);
    return Array.from(map.values());
}

function isConsentExcisionLesion(lesion) {
    if (!lesion) return false;
    if (typeof lesionType === 'function' && lesionType(lesion) === 'excision') return true;
    const plan = String(lesion.plan || '');
    const procedure = String(lesion.procedureDetail?.procedure || lesion.procedure || '');
    if (plan.includes('Excision')) return true;
    if (/^excision$/i.test(procedure)) return true;
    return false;
}

function isConsentShaveLesion(lesion) {
    if (!lesion) return false;
    if (typeof lesionType === 'function' && lesionType(lesion) === 'shave') return true;
    return String(lesion.biopsyType || '').includes('Shave');
}

function isConsentPunchLesion(lesion) {
    if (!lesion) return false;
    if (typeof lesionType === 'function' && lesionType(lesion) === 'punch') return true;
    const punchType = String(lesion.procedureDetail?.punchType || lesion.punchType || '');
    if (/punch excision|formal excision/i.test(punchType)) return false;
    return String(lesion.biopsyType || '').includes('Punch') || /^punch$/i.test(String(lesion.procedureDetail?.procedure || lesion.procedure || ''));
}

function lesionNeedsFormalConsent(lesion) {
    if (!lesion) return false;
    const status = typeof lesionLifecycleStatus === 'function'
        ? lesionLifecycleStatus(lesion)
        : (lesion.managementStatus || '');
    if (status === 'no_followup') return false;
    if (typeof lesionHasProcedureConsent === 'function' && lesionHasProcedureConsent(lesion)) return false;
    if (isConsentExcisionLesion(lesion)) return true;
    if (isConsentShaveLesion(lesion)) return true;
    if (isConsentPunchLesion(lesion)) return true;
    return false;
}

function consentProcedureKindLabel(kind) {
    if (kind === 'shave') return 'Shave biopsy';
    if (kind === 'punch') return 'Punch biopsy';
    return 'Excision';
}

function consentProcedureFromLesion(item) {
    const detail = typeof procedureDetailForLesion === 'function' ? procedureDetailForLesion(item) : {};
    const shave = isConsentShaveLesion(item);
    const punch = !shave && isConsentPunchLesion(item);
    const kind = shave ? 'shave' : (punch ? 'punch' : 'excision');
    const marginFromDetail = detail.margin
        ? (typeof formatMarginDisplay === 'function' ? formatMarginDisplay(detail.margin) : (String(detail.margin) + (/mm/i.test(String(detail.margin)) ? '' : 'mm')))
        : '';
    let diagnosis = detail.pathology || item.impression || 'Skin Malignancy';
    if (typeof formatDiagnosisDisplay === 'function') {
        diagnosis = formatDiagnosisDisplay(diagnosis) || diagnosis;
    }
    if (item.priorLesionId) {
        const priorKind = typeof priorProcedureKindForReexcision === 'function'
            ? priorProcedureKindForReexcision(item)
            : (item.priorProcedureKind || 'prior procedure');
        diagnosis += ' (re-excision after ' + priorKind + ')';
    }
    return {
        lesionId: item.id || '',
        procedureKind: kind,
        includeOnConsent: true,
        location: detail.location || item.location || '',
        diagnosis,
        margin: (shave || punch)
            ? (item.margin
                ? (typeof formatMarginDisplay === 'function' ? formatMarginDisplay(item.margin) : (item.margin + (/mm/i.test(String(item.margin)) ? '' : 'mm')))
                : marginFromDetail)
            : (typeof formatMarginDisplay === 'function'
                ? (formatMarginDisplay(item.excisionMarginMm || item.excisionMargin || marginFromDetail) || marginFromDetail)
                : (item.excisionMargin || marginFromDetail || '3mm to 5mm')),
        reconstruction: shave
            ? 'Shave / saucerisation'
            : (punch
                ? 'Punch biopsy'
                : (item.excisionReconstruction || (typeof closureToReconstruction === 'function'
                    ? closureToReconstruction(typeof normalizeExcisionClosure === 'function' ? normalizeExcisionClosure(item) : (detail.excisionClosureType || item.excisionClosureType))
                    : 'Direct Linear Closure')))
    };
}

function selectedConsentProcedures() {
    return (Array.isArray(consentProcedures) ? consentProcedures : []).filter((p) => p && p.includeOnConsent !== false);
}

function importExcisionLesions(options) {
    consentProcedures = [];
    const source = consentSourceLesions().filter(lesionNeedsFormalConsent);

    source.forEach((item) => {
        consentProcedures.push(consentProcedureFromLesion(item));
    });
    renderConsentProceduresTable();
    updateConsentRiskPreview();
    if (source.length && !options?.silent) {
        const shaves = source.filter(isConsentShaveLesion).length;
        const punches = source.filter((item) => !isConsentShaveLesion(item) && isConsentPunchLesion(item)).length;
        const reex = source.filter((item) => item.priorLesionId).length;
        const excisions = source.length - shaves - punches;
        const bits = [];
        if (reex) bits.push(reex + ' re-excision' + (reex === 1 ? '' : 's') + ' needing written consent');
        if (excisions - reex > 0) bits.push((excisions - reex) + ' excision' + (excisions - reex === 1 ? '' : 's'));
        if (shaves) bits.push(shaves + ' shave' + (shaves === 1 ? '' : 's') + ' without verbal consent');
        if (punches) bits.push(punches + ' punch' + (punches === 1 ? '' : 'es') + ' without consent');
        showToast('Loaded ' + (bits.join(', ') || (source.length + ' procedure' + (source.length === 1 ? '' : 's'))) + ' (all selected).');
    } else if (!source.length && !options?.silent) {
        showToast('No unconsented lesions to import.');
    }
}

function addProcedureToConsent() {
    const locInput = document.getElementById('addConsentLoc');
    const loc = locInput ? locInput.value.trim() : '';
    if (!loc) {
        showToast('Please enter an anatomical location for the procedure.');
        return;
    }
    const kindRaw = document.getElementById('addConsentKind')?.value || 'excision';
    const kind = kindRaw === 'shave' || kindRaw === 'punch' ? kindRaw : 'excision';
    const dxRaw = typeof readDiagnosisTypeahead === 'function'
        ? readDiagnosisTypeahead('addConsentDx')
        : (document.getElementById('addConsentDx')?.value || '');
    const dx = (typeof formatDiagnosisDisplay === 'function' ? formatDiagnosisDisplay(dxRaw) : dxRaw) || 'Skin Malignancy';
    const marginNum = typeof readMmInputValue === 'function'
        ? readMmInputValue('addConsentMargin')
        : (document.getElementById('addConsentMargin')?.value.trim() || '');
    if (kind === 'excision' && !marginNum) {
        showToast('Enter the planned margin as a number. mm is added automatically.');
        return;
    }
    const margin = marginNum
        ? (typeof formatMarginDisplay === 'function' ? formatMarginDisplay(marginNum) : marginNum)
        : '';
    const recon = kind === 'shave'
        ? 'Shave / saucerisation'
        : (kind === 'punch'
            ? 'Punch biopsy'
            : (document.getElementById('addConsentRecon')?.value || 'Direct Linear Closure'));

    consentProcedures.push({
        lesionId: '',
        procedureKind: kind,
        includeOnConsent: true,
        location: loc,
        diagnosis: dx,
        margin,
        reconstruction: recon
    });
    if (locInput) locInput.value = '';
    const marginEl = document.getElementById('addConsentMargin');
    if (marginEl) marginEl.value = '';
    if (typeof setDiagnosisTypeahead === 'function') setDiagnosisTypeahead('addConsentDx', '');
    else {
        const dxEl = document.getElementById('addConsentDx');
        if (dxEl) dxEl.value = '';
    }
    renderConsentProceduresTable();
    updateConsentRiskPreview();
}

function removeConsentProcedure(index) {
    consentProcedures.splice(index, 1);
    renderConsentProceduresTable();
    updateConsentRiskPreview();
}

function toggleConsentProcedureInclude(index, checked) {
    if (!consentProcedures[index]) return;
    consentProcedures[index].includeOnConsent = !!checked;
    renderConsentProceduresTable();
    updateConsentRiskPreview();
}

function renderConsentProceduresTable() {
    const tbody = document.getElementById('consentProceduresTableBody');
    if (!tbody) return;

    if (consentProcedures.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" class="p-3 text-center text-slate-400 italic">No unconsented lesions. Excisions, and punch/shave without verbal consent, import automatically — or add one below.</td></tr>`;
        return;
    }

    tbody.innerHTML = consentProcedures.map((p, idx) => {
        const included = p.includeOnConsent !== false;
        const biopsy = p.procedureKind === 'shave' || p.procedureKind === 'punch';
        return `
        <tr class="hover:bg-purple-50/40 transition-colors ${included ? '' : 'opacity-50'}">
            <td class="p-2 text-center">
                <input type="checkbox" ${included ? 'checked' : ''} onchange="toggleConsentProcedureInclude(${idx}, this.checked)" class="rounded text-purple-600" title="Include on this consent">
            </td>
            <td class="p-2 font-bold text-slate-500">${idx + 1}</td>
            <td class="p-2 text-purple-800 font-semibold">${escapeHtml(consentProcedureKindLabel(p.procedureKind))}</td>
            <td class="p-2 font-semibold text-slate-800">${escapeHtml(p.location)}</td>
            <td class="p-2 text-slate-700">${escapeHtml(p.diagnosis)}</td>
            <td class="p-2 text-slate-600">${escapeHtml(p.margin || '—')}</td>
            <td class="p-2 text-slate-600">${escapeHtml(biopsy ? '—' : (p.reconstruction || ''))}</td>
            <td class="p-2 text-right">
                <button onclick="removeConsentProcedure(${idx})" class="text-red-500 hover:text-red-700 font-bold cursor-pointer">&times; Remove</button>
            </td>
        </tr>`;
    }).join('');
}

function getReconstructionSpecificRisks(reconstructionStr) {
    const recon = (reconstructionStr || '').toLowerCase();
    let risks = [];

    if (recon.includes('flap')) {
        risks.push("Local Flap Repair risks: Flap edge or tip poor blood supply (ischemia or tissue necrosis), trapdoor/pincushion raised scar contour, standing cone ('dog-ear') tissue bunching requiring future minor contour adjustment, and numbness across flap lines.");
    }
    if (recon.includes('graft')) {
        risks.push("Full Thickness Skin Graft (FTSG) risks: Partial or complete graft loss ('take failure') requiring prolonged specialized dressing care, skin color or texture mismatch with surrounding tissue, graft contraction, and donor site scar/discomfort.");
    }
    if (recon.includes('secondary intention')) {
        risks.push("Healing by Secondary Intention risks: Extended healing timeline over several weeks to months, daily/regular specialized wound dressing changes, wound edge contraction pulling on surrounding facial/skin features, and potential for noticeable scar texture or color change.");
    }
    if (recon.includes('wedge') || recon.includes('cartilage')) {
        risks.push("Wedge / cartilage repair risks: Change in ear or free-margin shape, notch deformity, and painful cartilage inflammation (perichondritis) if cartilage is entered.");
    }

    return risks;
}

const ANATOMIC_SITE_RISK_GROUPS = [
    {
        id: 'ear',
        label: 'Ear',
        keywords: ['ear', 'helix', 'helical', 'pinna', 'tragus', 'antitragus', 'lobule', 'concha', 'scaphoid', 'preauricular', 'postauricular', 'auricle', 'earlobe'],
        risks: [
            "Ear location risks: Cartilage exposure, painful inflammation of ear cartilage (perichondritis), or helical rim notch deformity.",
            "Deep clearance verification: Potential need for intraoperative deep margin or cartilage punch biopsies to confirm complete tumor clearance."
        ]
    },
    {
        id: 'periocular',
        label: 'Eyelid / periocular',
        keywords: ['eyelid', 'lid', 'canthus', 'canthal', 'periocular', 'periorbital', 'infraorbital', 'supraorbital', 'brow', 'eyebrow', 'lacrimal'],
        risks: [
            "Eyelid / periocular risks: Lower eyelid pull (ectropion), incomplete eyelid closure, watering eye, or injury to structures around the eye requiring ophthalmology review."
        ]
    },
    {
        id: 'face',
        label: 'Face',
        keywords: ['face', 'facial', 'cheek', 'malar', 'zygoma', 'lip', 'vermilion', 'philtrum', 'nose', 'nasal', 'ala', 'alar', 'columella', 'chin', 'mentum', 'temple', 'temporal', 'jaw', 'jawline', 'mandible', 'maxilla', 'nasolabial', 'melolabial', 'glabella'],
        risks: [
            "Facial area risks: Minor facial nerve branch weakness causing subtle muscle asymmetry, or distortion of facial free margins (e.g. lip border, nose edge, or lower eyelid pull)."
        ]
    },
    {
        id: 'scalp',
        label: 'Scalp / forehead',
        keywords: ['scalp', 'forehead', 'frontal', 'vertex', 'occiput', 'occipital', 'parietal', 'crown'],
        risks: [
            "Scalp / Forehead risks: Forehead nerve branch weakness affecting brow movement, localized hair loss along suture lines, or scalp tension tightness."
        ]
    },
    {
        id: 'neck',
        label: 'Neck',
        keywords: ['neck', 'cervical', 'supraclavicular', 'submandibular', 'submental'],
        risks: [
            "Neck location risks: Scar tightness with head turning, prominence of a stretched scar in a visible area, or rare injury to superficial neck sensory nerves."
        ]
    },
    {
        id: 'trunk',
        label: 'Trunk / high-tension zone',
        keywords: ['back', 'shoulder', 'scapula', 'scapular', 'chest', 'presternal', 'sternum', 'sternal', 'breast', 'trunk', 'abdomen', 'abdominal', 'flank', 'lumbar', 'buttock', 'gluteal', 'sacral'],
        risks: [
            "High tension movement zone risks: Propensity for stretched, widened, or raised (hypertrophic/keloid) scar growth due to physical body movement."
        ]
    },
    {
        id: 'upper-limb',
        label: 'Arm / forearm',
        keywords: ['arm', 'upper arm', 'forearm', 'elbow', 'antecubital', 'axilla', 'axillary'],
        risks: [
            "Upper limb risks: Scar tightness across a movement crease, temporary stiffness, or sensory nerve numbness along the arm or forearm."
        ]
    },
    {
        id: 'hand',
        label: 'Hand / digit',
        keywords: ['hand', 'finger', 'thumb', 'digit', 'wrist', 'palm', 'palmar', 'dorsum of hand', 'knuckle', 'nail'],
        risks: [
            "Hand / Digit risks: Finger nerve numbness, tendon adhesion, joint tightness, or temporary functional hand stiffness during healing."
        ]
    },
    {
        id: 'lower-limb',
        label: 'Lower limb',
        keywords: ['leg', 'thigh', 'knee', 'popliteal', 'shin', 'pretibial', 'calf', 'ankle', 'foot', 'toe', 'heel', 'sole', 'plantar', 'dorsum of foot', 'lower limb', 'lower leg'],
        risks: [
            "Lower limb risks: Slower wound healing due to leg circulation, lower leg swelling (edema), and requirement for strict leg elevation after surgery."
        ]
    }
];

function locationContainsKeyword(locationStr, keyword) {
    const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
    const re = new RegExp('(^|[^a-z])' + escaped + '([^a-z]|$)', 'i');
    return re.test(locationStr || '');
}

function getLocationSpecificRisks(locationStr) {
    const loc = (locationStr || '').trim();
    if (!loc) return [];

    const matched = [];
    ANATOMIC_SITE_RISK_GROUPS.forEach(group => {
        if (group.keywords.some(keyword => locationContainsKeyword(loc, keyword))) {
            group.risks.forEach(risk => {
                if (!matched.includes(risk)) matched.push(risk);
            });
        }
    });

    return matched;
}

function getConsentProceduresForRisks() {
    const listed = selectedConsentProcedures().slice();
    const draftLoc = document.getElementById('addConsentLoc')?.value.trim();
    if (!draftLoc) return listed;

    const alreadyListed = listed.some(p => (p.location || '').trim().toLowerCase() === draftLoc.toLowerCase());
    if (alreadyListed) return listed;

    const kindRaw = document.getElementById('addConsentKind')?.value || 'excision';
    const kind = kindRaw === 'shave' || kindRaw === 'punch' ? kindRaw : 'excision';
    const draftDxRaw = typeof readDiagnosisTypeahead === 'function'
        ? readDiagnosisTypeahead('addConsentDx')
        : (document.getElementById('addConsentDx')?.value || '');
    listed.push({
        location: draftLoc,
        diagnosis: (typeof formatDiagnosisDisplay === 'function' ? formatDiagnosisDisplay(draftDxRaw) : draftDxRaw) || '',
        procedureKind: kind,
        reconstruction: kind === 'shave'
            ? 'Shave / saucerisation'
            : (kind === 'punch'
                ? 'Punch biopsy'
                : (document.getElementById('addConsentRecon')?.value || 'Direct Linear Closure'))
    });
    return listed;
}

function getNonTreatmentRisks(diagnosisStr) {
    const dx = (diagnosisStr || '').toLowerCase();
    let risks = [];

    if (dx.includes('basal cell') || dx.includes('bcc')) {
        risks.push("Risks of non-treatment (BCC): Tumor growth deeper into surrounding skin, cartilage, or bone, causing increasing tissue destruction and requiring much larger surgery later.");
    } else if (dx.includes('melanoma')) {
        risks.push("CRITICAL RISKS OF NON-TREATMENT (Melanoma): High risk of rapid spread through lymphatic and blood vessels to lymph nodes and internal organs, presenting a serious threat to life if surgery is delayed or refused.");
    } else if (/\biec\b|bowen|intraepidermal/.test(dx)) {
        risks.push("Risks of non-treatment (IEC): Expansion of in-situ disease, possible progression to invasive SCC, and a larger procedure later.");
    } else if (dx.includes('squamous cell') || /\bscc\b/.test(dx)) {
        risks.push("Risks of non-treatment (SCC): Tumor growth into deep tissues and potential spread (metastasis) to regional lymph nodes or other body sites if untreated.");
    } else {
        risks.push("Risks of non-treatment: Continued growth, bleeding, ulceration, and potential malignant transformation or future complex surgery.");
    }

    return risks;
}

function updateConsentRiskPreview() {
    let allReconRisks = [];
    let allLocRisks = [];
    let allNonTxRisks = [];
    const procedures = getConsentProceduresForRisks();

    procedures.forEach(p => {
        getReconstructionSpecificRisks(p.reconstruction).forEach(r => {
            if (!allReconRisks.includes(r)) allReconRisks.push(r);
        });
        getLocationSpecificRisks(p.location).forEach(r => {
            if (!allLocRisks.includes(r)) allLocRisks.push(r);
        });
        getNonTreatmentRisks(p.diagnosis).forEach(r => {
            if (!allNonTxRisks.includes(r)) allNonTxRisks.push(r);
        });
    });

    const reconBox = document.getElementById('consentReconRiskCheckboxes');
    const locBox = document.getElementById('consentLocationRiskCheckboxes');
    const nonTxBox = document.getElementById('consentNonTxRiskCheckboxes');

    if (reconBox) {
        if (allReconRisks.length === 0) {
            const onlyBiopsy = procedures.length && procedures.every((p) => p.procedureKind === 'shave' || p.procedureKind === 'punch');
            reconBox.innerHTML = onlyBiopsy
                ? `<p class="text-slate-500 italic">Biopsy procedures listed. Standard minor surgical risks in section A still apply.</p>`
                : `<p class="text-slate-500 italic">Direct linear skin closure planned (standard surgical risks apply). Flap, graft, wedge, or secondary-intention risks appear only when that reconstruction is selected.</p>`;
        } else {
            reconBox.innerHTML = allReconRisks.map((r, i) => `
                <label class="flex items-start text-slate-800 font-medium cursor-pointer bg-purple-50/50 p-2 rounded border border-purple-200">
                    <input type="checkbox" id="chkReconRisk_${i}" checked class="rounded text-purple-600 mt-0.5 mr-2 shrink-0">
                    <span>${r}</span>
                </label>
            `).join('');
        }
    }

    if (locBox) {
        if (procedures.length === 0) {
            locBox.innerHTML = `<p class="text-slate-500 italic">Add a surgical site above to generate material risks for that anatomic location only.</p>`;
        } else if (allLocRisks.length === 0) {
            locBox.innerHTML = `<p class="text-slate-500 italic">No extra site-specific material risks matched this location. Standard surgical risks in section A still apply.</p>`;
        } else {
            locBox.innerHTML = allLocRisks.map((r, i) => `
                <label class="flex items-start text-slate-800 font-medium cursor-pointer bg-purple-50/50 p-2 rounded border border-purple-200">
                    <input type="checkbox" id="chkLocRisk_${i}" checked class="rounded text-purple-600 mt-0.5 mr-2 shrink-0">
                    <span>${r}</span>
                </label>
            `).join('');
        }
    }

    if (nonTxBox) {
        if (procedures.length === 0) {
            nonTxBox.innerHTML = `<p class="text-slate-500 italic">Non-treatment risks appear once a provisional diagnosis is listed for the procedure.</p>`;
        } else {
            nonTxBox.innerHTML = allNonTxRisks.map((r, i) => `
                <label class="flex items-start text-red-950 font-medium cursor-pointer bg-red-50/50 p-2 rounded border border-red-200">
                    <input type="checkbox" id="chkNonTxRisk_${i}" checked class="rounded text-red-600 mt-0.5 mr-2 shrink-0">
                    <span>${r}</span>
                </label>
            `).join('');
        }
    }
}

function addCustomConsentRisk() {
    const input = document.getElementById('consentCustomRiskInput');
    if (!input || !input.value.trim()) return;

    const text = input.value.trim();
    customConsentRisks.push(text);
    input.value = '';
    renderCustomConsentRisks();
}

function removeCustomConsentRisk(index) {
    customConsentRisks.splice(index, 1);
    renderCustomConsentRisks();
}

function renderCustomConsentRisks() {
    const list = document.getElementById('consentCustomRisksList');
    if (!list) return;

    if (customConsentRisks.length === 0) {
        list.innerHTML = `<span class="text-slate-400 italic text-[11px]">No patient-specific custom risks added yet.</span>`;
        return;
    }

    list.innerHTML = customConsentRisks.map((r, i) => `
        <div class="flex justify-between items-center p-2 bg-amber-50 border border-amber-200 rounded text-xs">
            <span class="font-semibold text-amber-950">• ${r}</span>
            <button onclick="removeCustomConsentRisk(${i})" class="text-red-600 font-bold hover:text-red-800 cursor-pointer">&times;</button>
        </div>
    `).join('');
}

function formatConsentDoctorLine(name) {
    const n = String(name || '').trim();
    if (!n || n.includes('_')) return 'Dr ________________________';
    return /^dr\b/i.test(n) ? n : 'Dr ' + n;
}

function collectCheckedRisks(prefix) {
    const risks = [];
    document.querySelectorAll('[id^="' + prefix + '"]').forEach((input) => {
        if (input.checked) {
            const labelText = input.closest('label')?.querySelector('span')?.innerText;
            if (labelText) risks.push(labelText);
        }
    });
    return risks;
}

function collectConsentFormData() {
    const name = currentPatient?.name
        || document.getElementById('consentPatientName')?.value.trim()
        || document.getElementById('mainPatientName')?.value.trim()
        || "________________________";
    const dob = currentPatient?.dob
        || document.getElementById('consentPatientDOB')?.value.trim()
        || document.getElementById('mainPatientDOB')?.value.trim()
        || "____ / ____ / ________";
    const doctor = (typeof currentDoctorName === 'function' && currentDoctorName())
        || (typeof loggedInDoctorName === 'function' && loggedInDoctorName())
        || currentPatient?.clinician
        || "________________________";

    const genRisks = [];
    if (document.getElementById('riskGenLocalAnaesthetic')?.checked) genRisks.push("Local anaesthetic injection risks: Stinging or discomfort during numbing, minor localized bruising, temporary numbness or muscle weakness, feeling faint (vasovagal reaction), or rare allergic reaction.");
    if (document.getElementById('riskGenBleeding')?.checked) genRisks.push("Bleeding during or after surgery, resulting in a blood collection under the skin (hematoma) that may require medical drainage.");
    if (document.getElementById('riskGenInfection')?.checked) genRisks.push("Surgical site infection requiring oral or topical antibiotic therapy or special dressing care.");
    if (document.getElementById('riskGenScarring')?.checked) genRisks.push("Permanent surgical scar, color or texture change, or thickened/raised scar growth (hypertrophic or keloid scar).");
    if (document.getElementById('riskGenDehiscence')?.checked) genRisks.push("Opening of wound edges (dehiscence), spitting of internal stitches, or delayed wound healing.");
    if (document.getElementById('riskGenNumbness')?.checked) genRisks.push("Temporary or permanent nerve numbness, altered skin sensation, or tingling around the surgical area.");
    if (document.getElementById('riskGenIncomplete')?.checked) genRisks.push("Pathology report showing tumor cells close to or at the cut edge (incomplete excision), requiring a secondary operation (re-excision).");

    return {
        name,
        dob,
        doctor,
        dateStr: new Date().toLocaleDateString('en-AU', { day: '2-digit', month: '2-digit', year: 'numeric' }),
        allowDeepPunch: !!document.getElementById('chkDeepPunchConsent')?.checked,
        allowFlapGraft: !!document.getElementById('chkFlapGraftContingency')?.checked,
        procedures: selectedConsentProcedures().map((p) => ({ ...p })),
        historyLines: typeof screeningConsentHistoryLines === 'function' ? screeningConsentHistoryLines() : [],
        genRisks,
        reconRisks: collectCheckedRisks('chkReconRisk_'),
        locRisks: collectCheckedRisks('chkLocRisk_'),
        nonTxRisks: collectCheckedRisks('chkNonTxRisk_'),
        customRisks: Array.isArray(customConsentRisks) ? customConsentRisks.slice() : [],
        oopFee: document.getElementById('consentOopFee')?.value || "$150.00 Out-of-Pocket Gap",
        reexFee: document.getElementById('consentReexcisionFeeText')?.value || "Standard procedural fees apply if margin re-excision required"
    };
}

function formatConsentProcedureLines(p, idx) {
    const shave = p.procedureKind === 'shave';
    const punch = p.procedureKind === 'punch';
    const lines = [
        (idx + 1) + '. ' + String(p.location || 'Site').toUpperCase(),
        '   Procedure: ' + (shave ? 'Shave biopsy / saucerisation' : (punch ? 'Punch biopsy' : 'Surgical excision')),
        '   Provisional diagnosis: ' + (p.diagnosis || '')
    ];
    if (p.margin) lines.push('   Planned margin: ' + p.margin);
    if (!shave && !punch && p.reconstruction) lines.push('   Reconstruction: ' + p.reconstruction);
    return lines.join('\n');
}

function buildConsentPlainText(data) {
    const d = data || collectConsentFormData();
    const bullets = (items, fallback) => (items && items.length ? items : [fallback]).map((item) => '- ' + item).join('\n');
    let txt = '=== INFORMED CONSENT FOR SURGICAL EXCISION ===\n';
    txt += 'Patient Informed Consent & Material Risk Disclosure\n';
    txt += 'Date: ' + d.dateStr + '\n\n';
    txt += 'Patient Full Name: ' + d.name + '\n';
    txt += 'Date of Birth: ' + d.dob + '\n';
    txt += 'Operating Doctor: ' + formatConsentDoctorLine(d.doctor) + '\n\n';
    txt += 'I confirm that my doctor has discussed with me the diagnosis, treatment plan, and surgical procedures outlined below. I have been given the opportunity to ask questions regarding these procedures and any alternative treatment options.\n\n';
    txt += '=== 1. PROPOSED SURGICAL PROCEDURES ===\n\n';
    if (d.procedures.length) {
        txt += d.procedures.map(formatConsentProcedureLines).join('\n\n') + '\n\n';
    } else {
        txt += 'No specific surgical procedures listed.\n\n';
    }
    if (d.historyLines.length) {
        txt += '=== RELEVANT MEDICAL HISTORY (FROM CHART SCREENING) ===\n\n';
        txt += bullets(d.historyLines) + '\n\n';
    }
    if (d.allowDeepPunch || d.allowFlapGraft) {
        if (d.allowDeepPunch) txt += '- Intraoperative Deep Margin Sampling: I authorize the doctor to perform deep margin or cartilage punch/shave biopsies during surgery if required to confirm that all tumor cells have been cleared.\n';
        if (d.allowFlapGraft) txt += '- Reconstructive Modification: I authorize the doctor to adapt the reconstruction to a local skin flap, skin graft, or secondary intention healing if wound tension prevents direct linear stitching.\n';
        txt += '\n';
    }
    txt += '=== 2. GENERAL MINOR SURGICAL & LOCAL ANAESTHETIC RISKS ===\n\n';
    txt += 'My doctor has explained that all skin procedures involve standard minor risks, including:\n';
    txt += bullets(d.genRisks, 'Standard minor surgical risks discussed.') + '\n\n';
    if (d.reconRisks.length) {
        txt += '=== 3. RECONSTRUCTION-SPECIFIC RISKS (FLAP / GRAFT / SECONDARY INTENTION) ===\n\n';
        txt += 'Specific risks associated with the planned surgical reconstruction method include:\n';
        txt += bullets(d.reconRisks) + '\n\n';
    }
    txt += '=== 4. LOCATION-SPECIFIC MATERIAL RISKS ===\n\n';
    txt += 'Specific risks associated with operating on these anatomical body sites include:\n';
    txt += bullets(d.locRisks, 'Standard anatomical area risks discussed.') + '\n\n';
    if (d.customRisks.length) {
        txt += '=== 5. PATIENT-SPECIFIC RISKS DISCUSSED ===\n\n';
        txt += bullets(d.customRisks) + '\n\n';
    }
    txt += '=== 6. RISKS OF REFUSAL OR DELAY OF SURGICAL TREATMENT ===\n\n';
    txt += 'My doctor has explained the risks if I choose to delay or decline surgical treatment today:\n';
    txt += bullets(d.nonTxRisks, 'Risks of non-treatment discussed.') + '\n\n';
    txt += '=== 7. INFORMED FINANCIAL CONSENT (IFC) ===\n\n';
    txt += 'Financial details regarding this surgical procedure have been disclosed:\n';
    txt += '- Surgeon Out-of-Pocket Fee: ' + d.oopFee + '\n';
    txt += '- Secondary Re-Excision Notice: ' + d.reexFee + '\n\n';
    txt += '=== 8. PATIENT LEGAL DECLARATION & AUTHORIZATION ===\n\n';
    txt += 'I confirm that my operating medical practitioner has thoroughly explained the nature of the proposed surgical procedures, expected benefits, potential risks, and alternative options. I have had an opportunity to ask questions, and all my questions have been answered to my satisfaction. I understand that no guarantee can be given regarding final cosmetic scar appearance or complete histological cure. I agree to strictly follow post-operative wound care instructions and attend recommended follow-up appointments.\n\n';
    txt += 'Patient / Guardian Signature: ________________________\n';
    txt += 'Print Name: ' + d.name + '\n';
    txt += 'Date: ' + d.dateStr + '\n\n';
    txt += 'Operating Medical Practitioner Signature: ________________________\n';
    txt += formatConsentDoctorLine(d.doctor) + '\n';
    txt += 'Date: ' + d.dateStr + '\n';
    return txt;
}

function consentProcedureHtml(p, idx) {
    const esc = typeof escapeHtml === 'function' ? escapeHtml : (value) => String(value || '');
    const shave = p.procedureKind === 'shave';
    const punch = p.procedureKind === 'punch';
    const bits = [
        '<strong style="text-transform:uppercase;">' + esc(p.location || 'Site') + '</strong>',
        'Procedure: ' + (shave ? 'Shave biopsy / saucerisation' : (punch ? 'Punch biopsy' : 'Surgical excision')),
        'Provisional diagnosis: ' + esc(p.diagnosis || '')
    ];
    if (p.margin) bits.push('Planned margin: ' + esc(p.margin));
    if (!shave && !punch && p.reconstruction) bits.push('Reconstruction: ' + esc(p.reconstruction));
    return '<li style="margin-bottom:10px;">' + bits.join('<br>') + '</li>';
}

function buildConsentPrintHtml(data) {
    const d = data || collectConsentFormData();
    const esc = typeof escapeHtml === 'function' ? escapeHtml : (value) => String(value || '');
    const li = (items, fallback) => (items && items.length ? items : [fallback]).map((item) => '<li>' + esc(item) + '</li>').join('');
    return `
        <!DOCTYPE html>
        <html>
        <head>
            <title>Informed Surgical Consent - ${esc(d.name)}</title>
            <style>
                body { font-family: Arial, Helvetica, sans-serif; font-size: 10pt; line-height: 1.5; color: #1e293b; margin: 12mm; }
                h1 { font-size: 14pt; font-weight: bold; text-transform: uppercase; color: #0f172a; margin: 0 0 2px 0; letter-spacing: 0.02em; }
                .subtitle { font-size: 9.5pt; color: #475569; margin-bottom: 16px; font-weight: normal; }
                .patient-info { border-bottom: 2px solid #e2e8f0; padding-bottom: 10px; margin-bottom: 16px; font-size: 10pt; }
                .patient-info div { margin-bottom: 4px; }
                .section-head { font-weight: bold; font-size: 10.5pt; text-transform: uppercase; color: #1e3a8a; margin-top: 18px; margin-bottom: 6px; border-bottom: 1px solid #cbd5e1; padding-bottom: 2px; }
                p { margin-top: 0; margin-bottom: 8px; text-align: justify; }
                ul, ol { margin: 4px 0 10px 18px; padding: 0; }
                li { margin-bottom: 4px; }
                .declaration-text { margin-top: 14px; padding: 10px 0; border-top: 1px solid #cbd5e1; font-size: 9.5pt; line-height: 1.5; text-align: justify; color: #0f172a; }
                .sig-box { margin-top: 24px; padding-top: 12px; border-top: 2px solid #0f172a; }
                .sig-col { margin-bottom: 22px; }
                .sig-line { margin-top: 35px; border-bottom: 1px solid #000; height: 1px; }
                @media print { body { margin: 8mm; } }
            </style>
        </head>
        <body>
            <div>
                <h1>INFORMED CONSENT FOR SURGICAL EXCISION</h1>
                <div class="subtitle">Patient Informed Consent & Material Risk Disclosure Document</div>
            </div>

            <div class="patient-info">
                <div><strong>Patient Full Name:</strong> ${esc(d.name)}</div>
                <div><strong>Date of Birth:</strong> ${esc(d.dob)}</div>
                <div><strong>Operating Doctor:</strong> ${esc(formatConsentDoctorLine(d.doctor))}</div>
            </div>

            <p>I confirm that my doctor has discussed with me the diagnosis, treatment plan, and surgical procedures outlined below. I have been given the opportunity to ask questions regarding these procedures and any alternative treatment options.</p>

            <div class="section-head">1. Proposed Surgical Procedures</div>
            ${d.procedures.length ? '<ol>' + d.procedures.map(consentProcedureHtml).join('') + '</ol>' : '<p>No specific surgical procedures listed.</p>'}

            ${d.historyLines.length ? `
            <div class="section-head">Relevant medical history (from chart screening)</div>
            <ul>${d.historyLines.map((line) => '<li>' + esc(line) + '</li>').join('')}</ul>
            ` : ''}

            <ul>
                ${d.allowDeepPunch ? '<li><strong>Intraoperative Deep Margin Sampling:</strong> I authorize the doctor to perform deep margin or cartilage punch/shave biopsies during surgery if required to confirm that all tumor cells have been cleared.</li>' : ''}
                ${d.allowFlapGraft ? '<li><strong>Reconstructive Modification:</strong> I authorize the doctor to adapt the reconstruction to a local skin flap, skin graft, or secondary intention healing if wound tension prevents direct linear stitching.</li>' : ''}
            </ul>

            <div class="section-head">2. General Minor Surgical & Local Anaesthetic Risks</div>
            <p>My doctor has explained that all skin procedures involve standard minor risks, including:</p>
            <ul>${li(d.genRisks, 'Standard minor surgical risks discussed.')}</ul>

            ${d.reconRisks.length ? `
                <div class="section-head">3. Reconstruction-Specific Risks (Flap / Graft / Secondary Intention)</div>
                <p>Specific risks associated with the planned surgical reconstruction method include:</p>
                <ul>${li(d.reconRisks)}</ul>
            ` : ''}

            <div class="section-head">4. Location-Specific Material Risks</div>
            <p>Specific risks associated with operating on these anatomical body sites include:</p>
            <ul>${li(d.locRisks, 'Standard anatomical area risks discussed.')}</ul>

            ${d.customRisks.length ? `
                <div class="section-head">5. Patient-Specific Risks Discussed</div>
                <ul>${li(d.customRisks)}</ul>
            ` : ''}

            <div class="section-head">6. Risks of Refusal or Delay of Surgical Treatment</div>
            <p>My doctor has explained the risks if I choose to delay or decline surgical treatment today:</p>
            <ul>${li(d.nonTxRisks, 'Risks of non-treatment discussed.')}</ul>

            <div class="section-head">7. Informed Financial Consent (IFC)</div>
            <p>Financial details regarding this surgical procedure have been disclosed:</p>
            <ul>
                <li><strong>Surgeon Out-of-Pocket Fee:</strong> ${esc(d.oopFee)}</li>
                <li><strong>Secondary Re-Excision Notice:</strong> ${esc(d.reexFee)}</li>
            </ul>

            <div class="section-head">8. Patient Legal Declaration & Authorization</div>
            <div class="declaration-text">
                I confirm that my operating medical practitioner has thoroughly explained the nature of the proposed surgical procedures, expected benefits, potential risks, and alternative options. I have had an opportunity to ask questions, and all my questions have been answered to my satisfaction. I understand that no guarantee can be given regarding final cosmetic scar appearance or complete histological cure. I agree to strictly follow post-operative wound care instructions and attend recommended follow-up appointments.
            </div>

            <div class="sig-box">
                <div class="sig-col">
                    <strong>Patient / Guardian Signature:</strong>
                    <div class="sig-line"></div>
                    <div style="margin-top: 6px;">Print Name: <strong>${esc(d.name)}</strong></div>
                    <div style="margin-top: 3px;">Date: ${esc(d.dateStr)}</div>
                </div>
                <div class="sig-col">
                    <strong>Operating Medical Practitioner Signature:</strong>
                    <div class="sig-line"></div>
                    <div style="margin-top: 6px;"><strong>${esc(formatConsentDoctorLine(d.doctor))}</strong></div>
                    <div style="margin-top: 3px;">Date: ${esc(d.dateStr)}</div>
                </div>
            </div>

            \x3Cscript>
                window.onload = function() { window.print(); }
            \x3C/script>
        </body>
        </html>
    `;
}

async function markListedLesionsWrittenConsent(procedures) {
    const list = Array.isArray(procedures) ? procedures : selectedConsentProcedures();
    const ids = [...new Set(list.map((p) => p.lesionId).filter(Boolean))];
    if (!ids.length || typeof applyLesionConsent !== 'function') return;
    for (const id of ids) {
        try {
            await applyLesionConsent(id, 'written');
        } catch (err) {
            console.warn('Could not mark lesion consented', id, err);
        }
    }
    if (typeof renderLesionsTable === 'function') renderLesionsTable();
    if (typeof renderChartSidebar === 'function') renderChartSidebar();
    if (typeof renderManagedLesions === 'function') renderManagedLesions();
    if (typeof renderProcedureWorkspace === 'function') renderProcedureWorkspace();
}

async function generateExcisionConsent(options) {
    let data;
    let text;
    let printHtml = '';
    try {
        data = collectConsentFormData();
        if (!data.procedures.length) {
            showToast('Select at least one lesion to include on the consent.');
            return;
        }
        text = buildConsentPlainText(data);
        printHtml = buildConsentPrintHtml(data);
    } catch (err) {
        console.warn('Consent generate failed', err);
        showToast('Could not build the consent text.');
        return;
    }
    if (typeof copyTextToClipboard === 'function') {
        copyTextToClipboard(text, options?.print ? 'Consent copied for BP Premier. Opening print…' : 'Consent copied for BP Premier.');
    } else {
        showToast('Consent text is ready, but copy is unavailable.');
    }
    if (typeof saveGeneratedConsentDoc === 'function') {
        saveGeneratedConsentDoc(data, text, printHtml).catch((err) => {
            console.warn('Could not save consent document', err);
        });
    }
    try {
        await markListedLesionsWrittenConsent(data.procedures);
        importExcisionLesions({ silent: true });
    } catch (err) {
        console.warn('Could not mark lesions consented', err);
    }
    if (options?.print) printConsentHtml(data);
}

function printConsentHtml(data) {
    const printHtml = buildConsentPrintHtml(data || collectConsentFormData());
    const printWin = window.open('', '_blank', 'width=850,height=950');
    if (printWin) {
        printWin.document.open();
        printWin.document.write(printHtml);
        printWin.document.close();
    } else {
        showToast('Unable to open print window. Please check popup permissions.');
    }
}

function printExcisionConsentPDF() {
    generateExcisionConsent({ print: true });
}
