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
    const status = lesion.managementStatus || '';
    const plan = String(lesion.plan || '');
    const procedure = String(lesion.procedureDetail?.procedure || lesion.procedure || '');
    if (status === 'planned_excision' || status === 'current_case') return true;
    if (plan.includes('Excision')) return true;
    if (/^excision$/i.test(procedure)) return true;
    if (typeof isFormalExcisionCandidate === 'function' && isFormalExcisionCandidate(lesion)) return true;
    return false;
}

function importExcisionLesions(options) {
    consentProcedures = [];
    const all = consentSourceLesions();
    const formal = all.filter(isConsentExcisionLesion);
    const source = formal.length ? formal : all.filter((item) => (item.managementStatus || '') !== 'no_followup');

    source.forEach((item) => {
        const detail = typeof procedureDetailForLesion === 'function' ? procedureDetailForLesion(item) : {};
        consentProcedures.push({
            location: detail.location || item.location || '',
            diagnosis: detail.pathology || item.impression || 'Skin Malignancy',
            margin: item.excisionMargin || (detail.margin ? detail.margin + 'mm' : '') || '3mm to 5mm',
            reconstruction: item.excisionReconstruction || (typeof closureToReconstruction === 'function'
                ? closureToReconstruction(typeof normalizeExcisionClosure === 'function' ? normalizeExcisionClosure(item) : (detail.excisionClosureType || item.excisionClosureType))
                : 'Direct Linear Closure')
        });
    });
    renderConsentProceduresTable();
    updateConsentRiskPreview();
    if (source.length && !options?.silent) {
        showToast('Loaded ' + source.length + ' lesion' + (source.length === 1 ? '' : 's') + ' from this chart.');
    }
}

function addProcedureToConsent() {
    const locInput = document.getElementById('addConsentLoc');
    const loc = locInput ? locInput.value.trim() : '';
    if (!loc) {
        showToast('Please enter an anatomical location for the procedure.');
        return;
    }
    const dx = document.getElementById('addConsentDx')?.value || 'Skin Malignancy';
    const margin = document.getElementById('addConsentMargin')?.value.trim() || '3mm to 5mm';
    const recon = document.getElementById('addConsentRecon')?.value || 'Direct Linear Closure';

    consentProcedures.push({ location: loc, diagnosis: dx, margin: margin, reconstruction: recon });
    if (locInput) locInput.value = '';
    renderConsentProceduresTable();
    updateConsentRiskPreview();
}

function removeConsentProcedure(index) {
    consentProcedures.splice(index, 1);
    renderConsentProceduresTable();
    updateConsentRiskPreview();
}

function renderConsentProceduresTable() {
    const tbody = document.getElementById('consentProceduresTableBody');
    if (!tbody) return;

    if (consentProcedures.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="p-3 text-center text-slate-400 italic">No surgical procedures on this consent yet. Chart lesions import automatically, or add one below.</td></tr>`;
        return;
    }

    tbody.innerHTML = consentProcedures.map((p, idx) => `
        <tr class="hover:bg-purple-50/40 transition-colors">
            <td class="p-2 font-bold text-slate-500">${idx + 1}</td>
            <td class="p-2 font-semibold text-slate-800">${escapeHtml(p.location)}</td>
            <td class="p-2 text-slate-700">${escapeHtml(p.diagnosis)}</td>
            <td class="p-2 text-slate-600">${escapeHtml(p.margin)}</td>
            <td class="p-2 text-slate-600">${escapeHtml(p.reconstruction)}</td>
            <td class="p-2 text-right">
                <button onclick="removeConsentProcedure(${idx})" class="text-red-500 hover:text-red-700 font-bold cursor-pointer">&times; Remove</button>
            </td>
        </tr>
    `).join('');
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
    const listed = Array.isArray(consentProcedures) ? consentProcedures.slice() : [];
    const draftLoc = document.getElementById('addConsentLoc')?.value.trim();
    if (!draftLoc) return listed;

    const alreadyListed = listed.some(p => (p.location || '').trim().toLowerCase() === draftLoc.toLowerCase());
    if (alreadyListed) return listed;

    listed.push({
        location: draftLoc,
        diagnosis: document.getElementById('addConsentDx')?.value || '',
        reconstruction: document.getElementById('addConsentRecon')?.value || 'Direct Linear Closure'
    });
    return listed;
}

function getNonTreatmentRisks(diagnosisStr) {
    const dx = (diagnosisStr || '').toLowerCase();
    let risks = [];

    if (dx.includes('basal cell') || dx.includes('bcc')) {
        risks.push("Risks of non-treatment (BCC): Tumor growth deeper into surrounding skin, cartilage, or bone, causing increasing tissue destruction and requiring much larger surgery later.");
    } else if (dx.includes('squamous cell') || dx.includes('scc')) {
        risks.push("Risks of non-treatment (SCC): Tumor growth into deep tissues and potential spread (metastasis) to regional lymph nodes or other body sites if untreated.");
    } else if (dx.includes('melanoma')) {
        risks.push("CRITICAL RISKS OF NON-TREATMENT (Melanoma): High risk of rapid spread through lymphatic and blood vessels to lymph nodes and internal organs, presenting a serious threat to life if surgery is delayed or refused.");
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
            reconBox.innerHTML = `<p class="text-slate-500 italic">Direct linear skin closure planned (standard surgical risks apply). Flap, graft, wedge, or secondary-intention risks appear only when that reconstruction is selected.</p>`;
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

function printExcisionConsentPDF() {
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

    const allowDeepPunch = document.getElementById('chkDeepPunchConsent')?.checked;
    const allowFlapGraft = document.getElementById('chkFlapGraftContingency')?.checked;

    let genRisks = [];
    if (document.getElementById('riskGenLocalAnaesthetic')?.checked) genRisks.push("Local anaesthetic injection risks: Stinging or discomfort during numbing, minor localized bruising, temporary numbness or muscle weakness, feeling faint (vasovagal reaction), or rare allergic reaction.");
    if (document.getElementById('riskGenBleeding')?.checked) genRisks.push("Bleeding during or after surgery, resulting in a blood collection under the skin (hematoma) that may require medical drainage.");
    if (document.getElementById('riskGenInfection')?.checked) genRisks.push("Surgical site infection requiring oral or topical antibiotic therapy or special dressing care.");
    if (document.getElementById('riskGenScarring')?.checked) genRisks.push("Permanent surgical scar, color or texture change, or thickened/raised scar growth (hypertrophic or keloid scar).");
    if (document.getElementById('riskGenDehiscence')?.checked) genRisks.push("Opening of wound edges (dehiscence), spitting of internal stitches, or delayed wound healing.");
    if (document.getElementById('riskGenNumbness')?.checked) genRisks.push("Temporary or permanent nerve numbness, altered skin sensation, or tingling around the surgical area.");
    if (document.getElementById('riskGenIncomplete')?.checked) genRisks.push("Pathology report showing tumor cells close to or at the cut edge (incomplete excision), requiring a secondary operation (re-excision).");

    let reconRisks = [];
    const reconRiskInputs = document.querySelectorAll('[id^="chkReconRisk_"]');
    reconRiskInputs.forEach(input => {
        if (input.checked) {
            const labelText = input.closest('label').querySelector('span').innerText;
            reconRisks.push(labelText);
        }
    });

    let locRisks = [];
    const locRiskInputs = document.querySelectorAll('[id^="chkLocRisk_"]');
    locRiskInputs.forEach(input => {
        if (input.checked) {
            const labelText = input.closest('label').querySelector('span').innerText;
            locRisks.push(labelText);
        }
    });

    let nonTxRisks = [];
    const nonTxInputs = document.querySelectorAll('[id^="chkNonTxRisk_"]');
    nonTxInputs.forEach(input => {
        if (input.checked) {
            const labelText = input.closest('label').querySelector('span').innerText;
            nonTxRisks.push(labelText);
        }
    });

    const oopFee = document.getElementById('consentOopFee')?.value || "$150.00 Out-of-Pocket Gap";
    const reexFee = document.getElementById('consentReexcisionFeeText')?.value || "Standard procedural fees apply if margin re-excision required";

    const dateStr = new Date().toLocaleDateString('en-AU', { day: '2-digit', month: '2-digit', year: 'numeric' });

    const printHtml = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>Informed Surgical Consent - ${name}</title>
            <style>
                body { font-family: Arial, Helvetica, sans-serif; font-size: 10pt; line-height: 1.5; color: #1e293b; margin: 12mm; }
                h1 { font-size: 14pt; font-weight: bold; text-transform: uppercase; color: #0f172a; margin: 0 0 2px 0; letter-spacing: 0.02em; }
                .subtitle { font-size: 9.5pt; color: #475569; margin-bottom: 16px; font-weight: normal; }
                .patient-info { border-bottom: 2px solid #e2e8f0; padding-bottom: 10px; margin-bottom: 16px; display: grid; grid-template-columns: 2fr 1fr 1.5fr; gap: 12px; font-size: 10pt; }
                .section-head { font-weight: bold; font-size: 10.5pt; text-transform: uppercase; color: #1e3a8a; margin-top: 18px; margin-bottom: 6px; border-bottom: 1px solid #cbd5e1; padding-bottom: 2px; }
                p { margin-top: 0; margin-bottom: 8px; text-align: justify; }
                table { width: 100%; border-collapse: collapse; margin: 8px 0 12px 0; font-size: 9.5pt; }
                th, td { border: 1px solid #cbd5e1; padding: 6px 10px; text-align: left; }
                th { background-color: #f8fafc; font-weight: bold; text-transform: uppercase; font-size: 8.5pt; color: #334155; }
                ul { margin: 4px 0 10px 18px; padding: 0; }
                li { margin-bottom: 4px; }
                .declaration-text { margin-top: 14px; padding: 10px 0; border-top: 1px solid #cbd5e1; font-size: 9.5pt; line-height: 1.5; text-align: justify; color: #0f172a; }
                .sig-box { margin-top: 24px; padding-top: 12px; border-top: 2px solid #0f172a; display: grid; grid-template-columns: 1fr 1fr; gap: 30px; font-size: 9.5pt; }
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
                <div><strong>Patient Full Name:</strong> ${name}</div>
                <div><strong>Date of Birth:</strong> ${dob}</div>
                <div><strong>Operating Doctor:</strong> ${doctor}</div>
            </div>

            <p>I confirm that my doctor has discussed with me the diagnosis, treatment plan, and surgical procedures outlined below. I have been given the opportunity to ask questions regarding these procedures and any alternative treatment options.</p>

            <div class="section-head">1. Proposed Surgical Procedures</div>
            ${consentProcedures.length > 0 ? `
                <table>
                    <thead>
                        <tr>
                            <th style="width: 6%; text-align: center;">#</th>
                            <th style="width: 32%;">Anatomical Location</th>
                            <th style="width: 28%;">Provisional Diagnosis</th>
                            <th style="width: 14%;">Planned Margin</th>
                            <th style="width: 20%;">Reconstruction Method</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${consentProcedures.map((p, idx) => `
                            <tr>
                                <td style="font-weight: bold; text-align: center;">${idx + 1}</td>
                                <td style="font-weight: bold; text-transform: uppercase;">${p.location}</td>
                                <td>${p.diagnosis}</td>
                                <td>${p.margin}</td>
                                <td>${p.reconstruction}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            ` : '<p>No specific surgical procedures listed.</p>'}

            ${typeof screeningConsentHistoryLines === 'function' && screeningConsentHistoryLines().length ? `
            <div class="section-head">Relevant medical history (from chart screening)</div>
            <ul>
                ${screeningConsentHistoryLines().map((line) => `<li>${typeof escapeHtml === 'function' ? escapeHtml(line) : line}</li>`).join('')}
            </ul>
            ` : ''}

            <ul>
                ${allowDeepPunch ? `<li><strong>Intraoperative Deep Margin Sampling:</strong> I authorize the doctor to perform deep margin or cartilage punch/shave biopsies during surgery if required to confirm that all tumor cells have been cleared.</li>` : ''}
                ${allowFlapGraft ? `<li><strong>Reconstructive Modification:</strong> I authorize the doctor to adapt the reconstruction to a local skin flap, skin graft, or secondary intention healing if wound tension prevents direct linear stitching.</li>` : ''}
            </ul>

            <div class="section-head">2. General Minor Surgical & Local Anaesthetic Risks</div>
            <p>My doctor has explained that all skin procedures involve standard minor risks, including:</p>
            <ul>
                ${genRisks.length > 0 ? genRisks.map(r => `<li>${r}</li>`).join('') : '<li>Standard minor surgical risks discussed.</li>'}
            </ul>

            ${reconRisks.length > 0 ? `
                <div class="section-head">3. Reconstruction-Specific Risks (Flap / Graft / Secondary Intention)</div>
                <p>Specific risks associated with the planned surgical reconstruction method include:</p>
                <ul>
                    ${reconRisks.map(r => `<li>${r}</li>`).join('')}
                </ul>
            ` : ''}

            <div class="section-head">4. Location-Specific Material Risks</div>
            <p>Specific risks associated with operating on these anatomical body sites include:</p>
            <ul>
                ${locRisks.length > 0 ? locRisks.map(r => `<li>${r}</li>`).join('') : '<li>Standard anatomical area risks discussed.</li>'}
            </ul>

            ${customConsentRisks.length > 0 ? `
                <div class="section-head">5. Patient-Specific Risks Discussed</div>
                <ul>
                    ${customConsentRisks.map(r => `<li>${r}</li>`).join('')}
                </ul>
            ` : ''}

            <div class="section-head">6. Risks of Refusal or Delay of Surgical Treatment</div>
            <p>My doctor has explained the risks if I choose to delay or decline surgical treatment today:</p>
            <ul>
                ${nonTxRisks.length > 0 ? nonTxRisks.map(r => `<li>${r}</li>`).join('') : '<li>Risks of non-treatment discussed.</li>'}
            </ul>

            <div class="section-head">7. Informed Financial Consent (IFC)</div>
            <p>Financial details regarding this surgical procedure have been disclosed:</p>
            <ul>
                <li><strong>Surgeon Out-of-Pocket Fee:</strong> ${oopFee}</li>
                <li><strong>Secondary Re-Excision Notice:</strong> ${reexFee}</li>
            </ul>

            <div class="section-head">8. Patient Legal Declaration & Authorization</div>
            <div class="declaration-text">
                I confirm that my operating medical practitioner has thoroughly explained the nature of the proposed surgical procedures, expected benefits, potential risks, and alternative options. I have had an opportunity to ask questions, and all my questions have been answered to my satisfaction. I understand that no guarantee can be given regarding final cosmetic scar appearance or complete histological cure. I agree to strictly follow post-operative wound care instructions and attend recommended follow-up appointments.
            </div>

            <div class="sig-box">
                <div>
                    <strong>Patient / Guardian Signature:</strong>
                    <div class="sig-line"></div>
                    <div style="margin-top: 6px;">Print Name: <strong>${typeof escapeHtml === 'function' ? escapeHtml(name) : name}</strong></div>
                    <div style="margin-top: 3px;">Date: ${dateStr}</div>
                </div>
                <div>
                    <strong>Operating Medical Practitioner Signature:</strong>
                    <div class="sig-line"></div>
                    <div style="margin-top: 6px;"><strong>${typeof escapeHtml === 'function' ? escapeHtml(formatConsentDoctorLine(doctor)) : formatConsentDoctorLine(doctor)}</strong></div>
                    <div style="margin-top: 3px;">Date: ${dateStr}</div>
                </div>
            </div>

            \x3Cscript>
                window.onload = function() { window.print(); }
            \x3C/script>
        </body>
        </html>
    `;

    const printWin = window.open('', '_blank', 'width=850,height=950');
    if (printWin) {
        printWin.document.open();
        printWin.document.write(printHtml);
        printWin.document.close();
    } else {
        showToast('Unable to open print window. Please check popup permissions.');
    }
}

