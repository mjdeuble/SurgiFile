/* Informed refusal / other disposition — medicolegal documentation for Declines Treatment / Other */

const DECLINE_TREATMENT_PLAN = 'Declines Treatment / Other';

const DECLINE_RECOMMENDED_OPTIONS = [
    { id: 'biopsy', label: 'Punch / shave biopsy' },
    { id: 'excision', label: 'Excision' },
    { id: 'topical', label: 'Topical / field treatment' },
    { id: 'referral', label: 'Referral / specialist' },
    { id: 'monitor', label: 'Observation / monitoring' },
    { id: 'other', label: 'Other recommended treatment' }
];

const DECLINE_RISK_OPTIONS = [
    { id: 'delayed_diagnosis', label: 'Delayed or missed diagnosis' },
    { id: 'growth', label: 'Lesion may enlarge or become harder to treat' },
    { id: 'recurrence', label: 'Incomplete treatment or recurrence' },
    { id: 'progression', label: 'Possible progression (including melanoma / metastasis if relevant)' },
    { id: 'other', label: 'Other material risk' }
];

const DECLINE_DEFAULT_SAFETY_NET = 'Return sooner if the lesion changes in size, colour or shape, bleeds, becomes tender, or new lesions appear. Treatment can still be arranged later.';

function isDeclineTreatmentPlan(plan) {
    return String(plan || '').includes('Declines Treatment');
}

function declineNs(prefix) {
    return prefix === 'insp' ? 'inspDecline' : 'decline';
}

function emptyDeclineFields() {
    return {
        declineKind: '',
        declineRecommended: [],
        declineRecommendedOther: '',
        declineOtherPlan: '',
        declineReason: '',
        declineAlternatives: '',
        declineRisks: [],
        declineRisksOther: '',
        declineCapacity: 'appears',
        declineCapacityNote: '',
        declineVoluntary: true,
        declineForm: 'verbal',
        declineSafetyNet: true,
        declineSafetyNetAdvice: DECLINE_DEFAULT_SAFETY_NET,
        declineReview: 'none',
        declineSecondOpinion: false,
        declineWrittenInfo: false,
        declineNotes: '',
        declineRecordedAt: ''
    };
}

function declineChecked(list, id) {
    return Array.isArray(list) && list.includes(id) ? ' checked' : '';
}

function declineEsc(value) {
    return typeof escapeHtml === 'function' ? escapeHtml(value) : String(value ?? '');
}

function declineLabelFor(list, id) {
    const match = list.find((row) => row.id === id);
    return match ? match.label : id;
}

function renderDeclinePlanFieldsHtml(prefix, lesion, disabled) {
    const ns = declineNs(prefix);
    const d = { ...emptyDeclineFields(), ...(lesion || {}) };
    const off = disabled ? ' disabled' : '';
    const kind = d.declineKind || '';
    const rec = Array.isArray(d.declineRecommended) ? d.declineRecommended : [];
    const risks = Array.isArray(d.declineRisks) ? d.declineRisks : [];
    const recommendedBoxes = DECLINE_RECOMMENDED_OPTIONS.map((opt) => (
        `<label class="insp-choice"><input type="checkbox" name="${ns}Recommended" value="${opt.id}"${declineChecked(rec, opt.id)} onchange="syncDeclinePlanUi('${prefix}')"${off}> ${opt.label}</label>`
    )).join('');
    const riskBoxes = DECLINE_RISK_OPTIONS.map((opt) => (
        `<label class="insp-choice"><input type="checkbox" name="${ns}Risks" value="${opt.id}"${declineChecked(risks, opt.id)} onchange="syncDeclinePlanUi('${prefix}')"${off}> ${opt.label}</label>`
    )).join('');
    return `
        <p class="insp-label" style="margin:0">Informed refusal / other disposition</p>
        <p class="insp-hint">NSW Health and Avant: a valid refusal is freely given, specific, and informed. Record what was recommended, what was explained, the patient’s reason, capacity, and the safety-net. This is not a substitute for a signed hospital refusal form if the risk of harm is high.</p>
        <p class="insp-label">Disposition</p>
        <div class="insp-choice-row">
            <label class="insp-choice"><input type="radio" name="${ns}Kind" value="declines"${kind === 'declines' || !kind ? ' checked' : ''} onchange="syncDeclinePlanUi('${prefix}')"${off}> Patient declines recommended treatment</label>
            <label class="insp-choice"><input type="radio" name="${ns}Kind" value="other"${kind === 'other' ? ' checked' : ''} onchange="syncDeclinePlanUi('${prefix}')"${off}> Other (document)</label>
        </div>
        <div id="${ns}RecommendedWrap" class="${kind === 'other' ? 'hidden' : ''}">
            <p class="insp-label">Recommended treatment declined</p>
            <div class="insp-choice-list">${recommendedBoxes}</div>
            <div id="${ns}RecommendedOtherWrap" class="${rec.includes('other') ? '' : 'hidden'}">
                <label class="insp-label" for="${ns}RecommendedOther">Other recommended treatment</label>
                <input type="text" id="${ns}RecommendedOther" class="insp-input" value="${declineEsc(d.declineRecommendedOther || '')}" placeholder="e.g. Mohs referral, PDT course"${off}>
            </div>
        </div>
        <div id="${ns}OtherWrap" class="${kind === 'other' ? '' : 'hidden'}">
            <label class="insp-label" for="${ns}OtherPlan">Other plan</label>
            <input type="text" id="${ns}OtherPlan" class="insp-input" value="${declineEsc(d.declineOtherPlan || '')}" placeholder="e.g. Patient to think overnight; will phone next week"${off}>
        </div>
        <div>
            <label class="insp-label" for="${ns}Reason">Patient’s stated reason</label>
            <textarea id="${ns}Reason" rows="2" class="insp-textarea" placeholder="e.g. Does not want surgery; cost; prefers to wait; religious / personal reason"${off}>${declineEsc(d.declineReason || '')}</textarea>
        </div>
        <div>
            <label class="insp-label" for="${ns}Alternatives">Alternatives discussed</label>
            <textarea id="${ns}Alternatives" rows="2" class="insp-textarea" placeholder="e.g. Topical instead of excision; observation; second opinion; referral"${off}>${declineEsc(d.declineAlternatives || '')}</textarea>
        </div>
        <p class="insp-label">Material risks of declining explained</p>
        <div class="insp-choice-list">${riskBoxes}</div>
        <div id="${ns}RisksOtherWrap" class="${risks.includes('other') ? '' : 'hidden'}">
            <label class="insp-label" for="${ns}RisksOther">Other risk explained</label>
            <input type="text" id="${ns}RisksOther" class="insp-input" value="${declineEsc(d.declineRisksOther || '')}"${off}>
        </div>
        <p class="insp-label">Decision-making</p>
        <div class="insp-choice-row">
            <label class="insp-choice"><input type="radio" name="${ns}Capacity" value="appears"${d.declineCapacity !== 'concerns' ? ' checked' : ''} onchange="syncDeclinePlanUi('${prefix}')"${off}> Appears to have decision-making capacity</label>
            <label class="insp-choice"><input type="radio" name="${ns}Capacity" value="concerns"${d.declineCapacity === 'concerns' ? ' checked' : ''} onchange="syncDeclinePlanUi('${prefix}')"${off}> Capacity concerns — document</label>
        </div>
        <div id="${ns}CapacityNoteWrap" class="${d.declineCapacity === 'concerns' ? '' : 'hidden'}">
            <label class="insp-label" for="${ns}CapacityNote">Capacity note</label>
            <input type="text" id="${ns}CapacityNote" class="insp-input" value="${declineEsc(d.declineCapacityNote || '')}" placeholder="e.g. Discussed with person responsible; seek senior advice"${off}>
        </div>
        <label class="insp-choice"><input type="checkbox" id="${ns}Voluntary" ${d.declineVoluntary === false ? '' : 'checked'}${off}> Decision given voluntarily — no coercion apparent</label>
        <div>
            <label class="insp-label" for="${ns}Form">How the refusal was recorded</label>
            <select id="${ns}Form" class="insp-select"${off}>
                <option value="verbal"${d.declineForm !== 'written_offered' && d.declineForm !== 'written_signed' ? ' selected' : ''}>Verbal — documented in this record</option>
                <option value="written_offered"${d.declineForm === 'written_offered' ? ' selected' : ''}>Written acknowledgement offered</option>
                <option value="written_signed"${d.declineForm === 'written_signed' ? ' selected' : ''}>Written acknowledgement signed</option>
            </select>
            <p class="insp-hint">If declining treatment could cause serious harm, NSW Health advises a signed written refusal as well as this note.</p>
        </div>
        <p class="insp-label">Safety-net</p>
        <label class="insp-choice"><input type="checkbox" id="${ns}SafetyNet" ${d.declineSafetyNet === false ? '' : 'checked'}${off}> Safety-net advice given</label>
        <div>
            <label class="insp-label" for="${ns}SafetyNetAdvice">Advice given</label>
            <textarea id="${ns}SafetyNetAdvice" rows="2" class="insp-textarea"${off}>${declineEsc(d.declineSafetyNetAdvice || DECLINE_DEFAULT_SAFETY_NET)}</textarea>
        </div>
        <div>
            <label class="insp-label" for="${ns}Review">Offered review</label>
            <select id="${ns}Review" class="insp-select"${off}>
                <option value="none"${!d.declineReview || d.declineReview === 'none' ? ' selected' : ''}>No scheduled review — return if changes</option>
                <option value="2 weeks"${d.declineReview === '2 weeks' ? ' selected' : ''}>Review in 2 weeks</option>
                <option value="4 weeks"${d.declineReview === '4 weeks' ? ' selected' : ''}>Review in 4 weeks</option>
                <option value="8 weeks"${d.declineReview === '8 weeks' ? ' selected' : ''}>Review in 8 weeks</option>
                <option value="3 months"${d.declineReview === '3 months' ? ' selected' : ''}>Review in 3 months</option>
                <option value="6 months"${d.declineReview === '6 months' ? ' selected' : ''}>Review in 6 months</option>
            </select>
        </div>
        <label class="insp-choice"><input type="checkbox" id="${ns}SecondOpinion" ${d.declineSecondOpinion ? 'checked' : ''}${off}> Second opinion offered</label>
        <label class="insp-choice"><input type="checkbox" id="${ns}WrittenInfo" ${d.declineWrittenInfo ? 'checked' : ''}${off}> Written information provided</label>
        <div>
            <label class="insp-label" for="${ns}Notes">Additional notes</label>
            <input type="text" id="${ns}Notes" class="insp-input" value="${declineEsc(d.declineNotes || '')}" placeholder="e.g. Partner present; printout given"${off}>
        </div>
        <div class="insp-actions" style="margin:0.35rem 0 0">
            <button type="button" onclick="printDeclineAcknowledgement('${prefix}')"${off}>Print refusal note</button>
        </div>`;
}

function mountDeclinePlanFields(containerId, prefix, lesion, disabled) {
    const el = document.getElementById(containerId);
    if (!el) return;
    el.innerHTML = renderDeclinePlanFieldsHtml(prefix, lesion, disabled);
    syncDeclinePlanUi(prefix);
}

function syncDeclinePlanUi(prefix) {
    const ns = declineNs(prefix);
    const kind = document.querySelector(`input[name="${ns}Kind"]:checked`)?.value || 'declines';
    document.getElementById(ns + 'RecommendedWrap')?.classList.toggle('hidden', kind !== 'declines');
    document.getElementById(ns + 'OtherWrap')?.classList.toggle('hidden', kind !== 'other');
    const recOther = !!document.querySelector(`input[name="${ns}Recommended"][value="other"]:checked`);
    document.getElementById(ns + 'RecommendedOtherWrap')?.classList.toggle('hidden', !recOther);
    const riskOther = !!document.querySelector(`input[name="${ns}Risks"][value="other"]:checked`);
    document.getElementById(ns + 'RisksOtherWrap')?.classList.toggle('hidden', !riskOther);
    const capacity = document.querySelector(`input[name="${ns}Capacity"]:checked`)?.value || 'appears';
    document.getElementById(ns + 'CapacityNoteWrap')?.classList.toggle('hidden', capacity !== 'concerns');
}

function readCheckedValues(name) {
    return Array.from(document.querySelectorAll(`input[name="${name}"]:checked`)).map((el) => el.value);
}

function readDeclineFieldsFromForm(prefix) {
    const ns = declineNs(prefix);
    const fields = emptyDeclineFields();
    fields.declineKind = document.querySelector(`input[name="${ns}Kind"]:checked`)?.value || 'declines';
    fields.declineRecommended = readCheckedValues(ns + 'Recommended');
    fields.declineRecommendedOther = document.getElementById(ns + 'RecommendedOther')?.value.trim() || '';
    fields.declineOtherPlan = document.getElementById(ns + 'OtherPlan')?.value.trim() || '';
    fields.declineReason = document.getElementById(ns + 'Reason')?.value.trim() || '';
    fields.declineAlternatives = document.getElementById(ns + 'Alternatives')?.value.trim() || '';
    fields.declineRisks = readCheckedValues(ns + 'Risks');
    fields.declineRisksOther = document.getElementById(ns + 'RisksOther')?.value.trim() || '';
    fields.declineCapacity = document.querySelector(`input[name="${ns}Capacity"]:checked`)?.value || 'appears';
    fields.declineCapacityNote = document.getElementById(ns + 'CapacityNote')?.value.trim() || '';
    fields.declineVoluntary = !!document.getElementById(ns + 'Voluntary')?.checked;
    fields.declineForm = document.getElementById(ns + 'Form')?.value || 'verbal';
    fields.declineSafetyNet = !!document.getElementById(ns + 'SafetyNet')?.checked;
    fields.declineSafetyNetAdvice = document.getElementById(ns + 'SafetyNetAdvice')?.value.trim() || '';
    fields.declineReview = document.getElementById(ns + 'Review')?.value || 'none';
    fields.declineSecondOpinion = !!document.getElementById(ns + 'SecondOpinion')?.checked;
    fields.declineWrittenInfo = !!document.getElementById(ns + 'WrittenInfo')?.checked;
    fields.declineNotes = document.getElementById(ns + 'Notes')?.value.trim() || '';
    fields.declineRecordedAt = new Date().toISOString();
    return fields;
}

function validateDeclineFields(fields) {
    fields = fields || emptyDeclineFields();
    if (fields.declineKind === 'other') {
        if (!fields.declineOtherPlan) return 'Enter the other plan you are documenting.';
    } else if (!fields.declineRecommended.length) {
        return 'Tick the recommended treatment the patient declined.';
    }
    if (fields.declineRecommended.includes('other') && !fields.declineRecommendedOther) {
        return 'Name the other recommended treatment that was declined.';
    }
    if (!fields.declineReason) return 'Record the patient’s stated reason.';
    if (!fields.declineRisks.length && !fields.declineRisksOther) {
        return 'Tick the material risks that were explained, or record another risk.';
    }
    if (fields.declineRisks.includes('other') && !fields.declineRisksOther) {
        return 'Record the other material risk that was explained.';
    }
    if (fields.declineCapacity === 'concerns' && !fields.declineCapacityNote) {
        return 'Document the capacity concern, or mark that the patient appears to have capacity.';
    }
    if (!fields.declineVoluntary) {
        return 'A valid refusal must be voluntary. Tick that the decision was given without apparent coercion, or do not record a refusal.';
    }
    if (!fields.declineSafetyNet) return 'Tick that safety-net advice was given.';
    if (!fields.declineSafetyNetAdvice) return 'Record the safety-net advice given to the patient.';
    return '';
}

function formatDeclineRecommendedText(fields) {
    const ids = Array.isArray(fields?.declineRecommended) ? fields.declineRecommended : [];
    const labels = ids.map((id) => {
        if (id === 'other') return fields.declineRecommendedOther || 'Other recommended treatment';
        return declineLabelFor(DECLINE_RECOMMENDED_OPTIONS, id);
    }).filter(Boolean);
    return labels.join('; ');
}

function formatDeclineRisksText(fields) {
    const ids = Array.isArray(fields?.declineRisks) ? fields.declineRisks : [];
    const labels = ids.map((id) => {
        if (id === 'other') return fields.declineRisksOther || 'Other material risk';
        return declineLabelFor(DECLINE_RISK_OPTIONS, id);
    }).filter(Boolean);
    if (!ids.includes('other') && fields?.declineRisksOther) labels.push(fields.declineRisksOther);
    return labels.join('; ');
}

function formatDeclineFormLabel(value) {
    if (value === 'written_signed') return 'Written acknowledgement signed';
    if (value === 'written_offered') return 'Written acknowledgement offered';
    return 'Verbal — documented in this record';
}

function formatDeclinePlanSummary(lesion) {
    if (!isDeclineTreatmentPlan(lesion?.plan)) return '';
    if (lesion.declineKind === 'other') {
        return lesion.declineOtherPlan
            ? ('Other plan — ' + lesion.declineOtherPlan)
            : 'Other disposition documented';
    }
    const rec = formatDeclineRecommendedText(lesion);
    return rec ? ('Declined ' + rec) : 'Declined recommended treatment';
}

function formatDeclineEmrLines(lesion) {
    if (!isDeclineTreatmentPlan(lesion?.plan)) return '';
    let lines = '';
    const summary = formatDeclinePlanSummary(lesion);
    if (summary) lines += `    - Informed refusal / other: ${summary}\n`;
    if (lesion.declineReason) lines += `    - Patient’s stated reason: ${lesion.declineReason}\n`;
    if (lesion.declineAlternatives) lines += `    - Alternatives discussed: ${lesion.declineAlternatives}\n`;
    const risks = formatDeclineRisksText(lesion);
    if (risks) lines += `    - Material risks of declining explained: ${risks}\n`;
    lines += `    - Decision-making capacity: ${lesion.declineCapacity === 'concerns' ? ('Concerns — ' + (lesion.declineCapacityNote || 'documented')) : 'Appears to have capacity'}.\n`;
    lines += `    - Refusal given voluntarily: ${lesion.declineVoluntary === false ? 'Not confirmed' : 'Yes — no coercion apparent'}.\n`;
    lines += `    - How recorded: ${formatDeclineFormLabel(lesion.declineForm)}.\n`;
    if (lesion.declineSafetyNet) {
        lines += `    - Safety-net advice: ${lesion.declineSafetyNetAdvice || DECLINE_DEFAULT_SAFETY_NET}\n`;
    }
    if (lesion.declineReview && lesion.declineReview !== 'none') {
        lines += `    - Offered review: ${lesion.declineReview}.\n`;
    }
    if (lesion.declineSecondOpinion) lines += `    - Second opinion offered.\n`;
    if (lesion.declineWrittenInfo) lines += `    - Written information provided.\n`;
    if (lesion.declineNotes) lines += `    - Additional notes: ${lesion.declineNotes}\n`;
    lines += `    - Treating clinician recorded this informed refusal contemporaneously in the health record.\n`;
    return lines;
}

function collectDeclineFieldsForPrint(prefix) {
    if (document.getElementById(declineNs(prefix) + 'Reason') || document.querySelector(`input[name="${declineNs(prefix)}Kind"]`)) {
        return readDeclineFieldsFromForm(prefix);
    }
    const lesion = typeof ensureSelectedChartLesion === 'function' ? ensureSelectedChartLesion() : null;
    return lesion && isDeclineTreatmentPlan(lesion.plan) ? lesion : emptyDeclineFields();
}

function printDeclineAcknowledgement(prefix) {
    const fields = { ...emptyDeclineFields(), ...collectDeclineFieldsForPrint(prefix || 'insp') };
    const patient = (typeof currentPatient !== 'undefined' && currentPatient?.name) ? currentPatient.name : '';
    const dob = (typeof currentPatient !== 'undefined' && currentPatient?.dob) ? currentPatient.dob : '';
    const clinician = (typeof currentPatient !== 'undefined' && currentPatient?.clinician) ? currentPatient.clinician : '';
    const clinic = (typeof clinicProfile !== 'undefined' && clinicProfile?.name) ? clinicProfile.name : 'DermRecord';
    const when = fields.declineRecordedAt
        ? new Date(fields.declineRecordedAt).toLocaleString('en-AU')
        : new Date().toLocaleString('en-AU');
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Informed refusal record</title>
    <style>
        body { font-family: "Segoe UI", Tahoma, sans-serif; color: #1a1a1a; margin: 18px; }
        h1 { font-size: 18px; margin: 0 0 4px; }
        p, li { font-size: 12px; line-height: 1.45; margin: 0 0 8px; }
        h2 { font-size: 13px; margin: 14px 0 6px; }
        .meta { color: #444; }
        @media print { body { margin: 10mm; } }
    </style>
</head>
<body>
    <h1>Informed refusal / other disposition</h1>
    <p class="meta">${declineEsc(clinic)}${patient ? ' · ' + declineEsc(patient) : ''}${dob ? ' · DOB ' + declineEsc(dob) : ''}${clinician ? ' · ' + declineEsc(clinician) : ''}<br>Recorded ${declineEsc(when)}</p>
    <h2>Disposition</h2>
    <p>${fields.declineKind === 'other'
        ? declineEsc('Other plan — ' + (fields.declineOtherPlan || ''))
        : declineEsc('Patient declines recommended treatment: ' + (formatDeclineRecommendedText(fields) || 'not specified'))}</p>
    <h2>Discussion</h2>
    <p><strong>Patient’s stated reason:</strong> ${declineEsc(fields.declineReason || '—')}</p>
    <p><strong>Alternatives discussed:</strong> ${declineEsc(fields.declineAlternatives || '—')}</p>
    <p><strong>Material risks explained:</strong> ${declineEsc(formatDeclineRisksText(fields) || '—')}</p>
    <h2>Decision-making</h2>
    <p>Capacity: ${fields.declineCapacity === 'concerns'
        ? declineEsc('Concerns — ' + (fields.declineCapacityNote || ''))
        : 'Appears to have decision-making capacity'}.</p>
    <p>Voluntary: ${fields.declineVoluntary === false ? 'Not confirmed' : 'Yes — no coercion apparent'}.</p>
    <p>How recorded: ${declineEsc(formatDeclineFormLabel(fields.declineForm))}.</p>
    <h2>Safety-net</h2>
    <p>${declineEsc(fields.declineSafetyNetAdvice || DECLINE_DEFAULT_SAFETY_NET)}</p>
    <p>Offered review: ${declineEsc(!fields.declineReview || fields.declineReview === 'none' ? 'None scheduled — return if changes' : fields.declineReview)}.</p>
    <p>${fields.declineSecondOpinion ? 'Second opinion offered. ' : ''}${fields.declineWrittenInfo ? 'Written information provided. ' : ''}${fields.declineNotes ? declineEsc(fields.declineNotes) : ''}</p>
    <p>This contemporaneous note records that the treating clinician explained the recommended treatment, alternatives, and material risks, and that the patient (or person responsible) made this decision.</p>
    <script>window.onload = function () { window.print(); };<\/script>
</body>
</html>`;
    const printWin = window.open('', '_blank', 'width=900,height=800');
    if (!printWin) {
        if (typeof showToast === 'function') showToast('Unable to open print window. Please check popup permissions.');
        return;
    }
    printWin.document.open();
    printWin.document.write(html);
    printWin.document.close();
}
