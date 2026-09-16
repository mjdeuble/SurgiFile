/* Chart-level clinical letters for Best Practice paste (plain ASCII).
   GP advice = management update to the referring/usual GP.
   Specialist referral = organise further opinion or definitive management. */

const LETTER_TYPE_GP = 'gp_advice';
const LETTER_TYPE_SPECIALIST = 'specialist_referral';
const REFER_LESION_PLAN = 'Refer / Specialist';

let letterDraft = emptyLetterDraft();

function emptyLetterDraft() {
    return {
        letterType: LETTER_TYPE_GP,
        recipientName: '',
        recipientClinic: '',
        urgency: 'routine',
        clinicalQuestion: '',
        additionalNotes: '',
        includeHistory: true,
        selectedIds: []
    };
}

function isReferLesionPlan(plan) {
    const p = String(plan || '');
    return /^Refer/i.test(p) || /Specialist/i.test(p) && /Refer/i.test(p);
}

function letterSourceLesions() {
    const map = new Map();
    const add = (item) => {
        if (!item?.id) return;
        if (typeof lesionIsHiddenByReexcisionLink === 'function' && lesionIsHiddenByReexcisionLink(item)) return;
        const id = String(item.id);
        const existing = map.get(id);
        map.set(id, existing ? { ...existing, ...item } : item);
    };
    if (typeof clinicalChartLesions === 'function') clinicalChartLesions().forEach(add);
    else if (typeof chartLesions === 'function') chartLesions().forEach(add);
    (Array.isArray(lesions) ? lesions : []).forEach(add);
    return Array.from(map.values()).sort((a, b) => {
        const aScore = letterLesionPrefScore(a);
        const bScore = letterLesionPrefScore(b);
        if (aScore !== bScore) return bScore - aScore;
        return String(a.location || '').localeCompare(String(b.location || ''), 'en', { sensitivity: 'base' });
    });
}

function letterLesionPrefScore(lesion) {
    let score = 0;
    if (String(lesion?.proposedPlan || '') === 'refer') score += 4;
    if (isReferLesionPlan(lesion?.plan)) score += 4;
    if (typeof isVisitLesion === 'function' && isVisitLesion(lesion?.id)) score += 2;
    if (lesion?.histologyDiagnosis || lesion?.histologyResult) score += 1;
    if (lesion?.priorLesionId) score += 1;
    return score;
}

function letterShouldPreselect(lesion) {
    if (String(lesion?.proposedPlan || '') === 'refer') return true;
    if (isReferLesionPlan(lesion?.plan)) return true;
    if (typeof isVisitLesion === 'function' && isVisitLesion(lesion?.id)) return true;
    return false;
}

function letterPatientIdentity() {
    const chart = typeof currentManagedChart === 'function' ? currentManagedChart() : null;
    const name = (typeof currentPatient !== 'undefined' && currentPatient?.name)
        || chart?.name
        || '';
    const dob = (typeof currentPatient !== 'undefined' && currentPatient?.dob)
        || chart?.dob
        || '';
    const phone = (typeof currentPatient !== 'undefined' && currentPatient?.phone)
        || chart?.phone
        || '';
    const clinician = (typeof currentPatient !== 'undefined' && currentPatient?.clinician)
        || chart?.clinician
        || (typeof vaultAuth !== 'undefined' ? vaultAuth.displayName || vaultAuth.username : '')
        || '';
    return { name: String(name || '').trim(), dob: String(dob || '').trim(), phone: String(phone || '').trim(), clinician: String(clinician || '').trim() };
}

function letterFormatDob(dob) {
    const raw = String(dob || '').trim();
    if (!raw) return '';
    // Prefer AU display if already dd/mm/yyyy
    if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(raw)) return raw;
    const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (iso) return iso[3] + '/' + iso[2] + '/' + iso[1];
    try {
        const d = new Date(raw);
        if (!Number.isNaN(d.getTime())) {
            return d.toLocaleDateString('en-AU', { day: '2-digit', month: '2-digit', year: 'numeric' });
        }
    } catch (err) { /* ignore */ }
    return raw;
}

function letterAgeYears(dob) {
    const raw = String(dob || '').trim();
    let y = 0;
    let m = 0;
    let d = 0;
    const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
    const au = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (iso) {
        y = Number(iso[1]); m = Number(iso[2]); d = Number(iso[3]);
    } else if (au) {
        d = Number(au[1]); m = Number(au[2]); y = Number(au[3]);
    } else return '';
    if (!y || !m || !d) return '';
    const today = new Date();
    let age = today.getFullYear() - y;
    const hadBirthday = (today.getMonth() + 1 > m) || (today.getMonth() + 1 === m && today.getDate() >= d);
    if (!hadBirthday) age -= 1;
    return age >= 0 && age < 130 ? String(age) : '';
}

function letterAscii(text) {
    return String(text || '')
        .replace(/\u2013|\u2014/g, '-')
        .replace(/\u2018|\u2019/g, "'")
        .replace(/\u201C|\u201D/g, '"')
        .replace(/\u2022/g, '-')
        .replace(/\u00A0/g, ' ')
        .replace(/[^\x09\x0A\x0D\x20-\x7E]/g, '');
}

function letterWrapLine(line, width) {
    const max = width || 88;
    const s = String(line || '');
    if (s.length <= max) return [s];
    const words = s.split(/\s+/);
    const out = [];
    let cur = '';
    words.forEach((w) => {
        if (!w) return;
        if (!cur) {
            cur = w;
            return;
        }
        if ((cur + ' ' + w).length <= max) cur += ' ' + w;
        else {
            out.push(cur);
            cur = w;
        }
    });
    if (cur) out.push(cur);
    return out.length ? out : [''];
}

function letterPushWrapped(lines, text, width) {
    String(text || '').split(/\n/).forEach((row) => {
        letterWrapLine(row, width).forEach((part) => lines.push(part));
    });
}

function letterClinicHeaderLines() {
    const profile = (typeof clinicProfile !== 'undefined' && clinicProfile) ? clinicProfile : {};
    const lines = [];
    if (profile.clinicName) lines.push(String(profile.clinicName).trim());
    if (profile.address) {
        String(profile.address).split(/\n/).map((r) => r.trim()).filter(Boolean).forEach((r) => lines.push(r));
    }
    const contactBits = [];
    if (profile.phone) contactBits.push('Tel: ' + String(profile.phone).trim());
    if (profile.email) contactBits.push('Email: ' + String(profile.email).trim());
    if (profile.website) contactBits.push(String(profile.website).trim());
    if (contactBits.length) lines.push(contactBits.join('  |  '));
    return lines;
}

function letterDiagnosis(lesion) {
    if (typeof formatDiagnosisIemr === 'function') {
        return String(formatDiagnosisIemr(lesion?.impression) || lesion?.impression || '').trim();
    }
    return String(lesion?.impression || '').trim();
}

function letterHistologyLine(lesion) {
    const dx = String(lesion?.histologyDiagnosis || '').trim();
    const result = String(lesion?.histologyResult || '').trim();
    const caseNo = String(lesion?.histologyCaseNumber || '').trim();
    const pot = String(lesion?.histologyPot || '').trim();
    if (!dx && !result && !caseNo) return '';
    const bits = [];
    if (dx) bits.push(dx);
    else if (result) bits.push(result);
    if (caseNo) bits.push('Lab case ' + caseNo + (pot ? ' (pot ' + pot + ')' : ''));
    else if (pot) bits.push('Pot ' + pot);
    return bits.join(' - ');
}

function letterManagementLine(lesion) {
    if (String(lesion?.proposedPlan || '') === 'refer' || isReferLesionPlan(lesion?.plan)) {
        const note = String(lesion?.proposedPlanNote || '').trim();
        return note ? 'Referral - ' + note : 'Referral for specialist opinion / management';
    }
    if (typeof formatProposedManagementPlan === 'function' && lesion?.proposedPlan) {
        const proposed = formatProposedManagementPlan(lesion);
        if (proposed && proposed !== 'Needs management') return proposed.replace(/^Proposed:\s*/i, '');
    }
    if (typeof formatLesionPlanIemr === 'function') {
        const plan = formatLesionPlanIemr(lesion);
        if (plan) return plan;
    }
    return String(lesion?.currentPlan || lesion?.plan || '').trim() || 'As discussed';
}

function letterHistoryLines(include) {
    if (!include) return [];
    const lines = [];
    if (typeof screeningConsentHistoryLines === 'function') {
        screeningConsentHistoryLines().forEach((row) => {
            const t = String(row || '').trim();
            if (t) lines.push('- ' + t);
        });
    }
    if (!lines.length && typeof patientSummaryHistoryLines === 'function') {
        patientSummaryHistoryLines().forEach((row) => {
            const t = String(row || '').trim();
            if (t) lines.push('- ' + t);
        });
    }
    const exam = typeof currentManagedChart === 'function' ? currentManagedChart()?.exam : null;
    if (exam?.fitzpatrick) lines.push('- Fitzpatrick skin type: ' + exam.fitzpatrick);
    if (exam?.lastSkinCheck) lines.push('- Last skin check: ' + exam.lastSkinCheck);
    if (exam?.scope) lines.push('- Examination scope this episode: ' + exam.scope + (exam.regionalArea ? ' (' + exam.regionalArea + ')' : ''));
    return lines;
}

function letterUrgencyLabel(value) {
    if (value === 'urgent') return 'Urgent';
    if (value === 'soon') return 'Semi-urgent / soon';
    return 'Routine';
}

function letterSelectedLesions() {
    const wanted = new Set((letterDraft.selectedIds || []).map(String));
    return letterSourceLesions().filter((item) => wanted.has(String(item.id)));
}

function generateClinicalLetterPlainText(options) {
    const opts = options || {};
    const type = opts.letterType || letterDraft.letterType || LETTER_TYPE_GP;
    const patient = letterPatientIdentity();
    const selected = Array.isArray(opts.lesions) ? opts.lesions : letterSelectedLesions();
    const recipientName = String(opts.recipientName != null ? opts.recipientName : letterDraft.recipientName || '').trim();
    const recipientClinic = String(opts.recipientClinic != null ? opts.recipientClinic : letterDraft.recipientClinic || '').trim();
    const urgency = String(opts.urgency != null ? opts.urgency : letterDraft.urgency || 'routine');
    const clinicalQuestion = String(opts.clinicalQuestion != null ? opts.clinicalQuestion : letterDraft.clinicalQuestion || '').trim();
    const additionalNotes = String(opts.additionalNotes != null ? opts.additionalNotes : letterDraft.additionalNotes || '').trim();
    const includeHistory = opts.includeHistory != null ? !!opts.includeHistory : !!letterDraft.includeHistory;

    const dateStr = new Date().toLocaleDateString('en-AU', {
        day: '2-digit',
        month: 'long',
        year: 'numeric'
    });
    const dobStr = letterFormatDob(patient.dob);
    const ageStr = letterAgeYears(patient.dob);
    const isSpecialist = type === LETTER_TYPE_SPECIALIST;
    const lines = [];

    letterClinicHeaderLines().forEach((row) => lines.push(row));
    if (lines.length) lines.push('');
    lines.push(dateStr);
    lines.push('');

    if (recipientName) lines.push(recipientName);
    else lines.push(isSpecialist ? 'Dear Specialist Colleague' : 'Dear Doctor');
    if (recipientClinic) lines.push(recipientClinic);
    lines.push('');

    const salutation = recipientName
        ? ('Dear ' + recipientName.replace(/^Dear\s+/i, '') + ',')
        : (isSpecialist ? 'Dear Colleague,' : 'Dear Doctor,');
    lines.push(salutation);
    lines.push('');

    let reLine = 'Re: ' + (patient.name || 'Patient');
    if (dobStr) reLine += '    DOB: ' + dobStr;
    if (ageStr) reLine += ' (' + ageStr + ' yrs)';
    lines.push(reLine);
    if (patient.phone) lines.push('Phone: ' + patient.phone);
    lines.push('');

    if (isSpecialist) {
        lines.push('REFERRAL FOR SPECIALIST OPINION / MANAGEMENT');
        lines.push('Urgency: ' + letterUrgencyLabel(urgency));
        lines.push('');
        letterPushWrapped(lines, 'I would be grateful for your review and advice regarding the lesion(s) outlined below. '
            + (clinicalQuestion
                ? ('In particular: ' + clinicalQuestion)
                : 'Please advise regarding further investigation and definitive management.'));
    } else {
        lines.push('ADVICE TO GENERAL PRACTITIONER');
        lines.push('');
        letterPushWrapped(lines, 'I am writing to update you regarding the dermatological assessment and management of your patient. '
            + (clinicalQuestion ? ('Focus of this correspondence: ' + clinicalQuestion) : 'A summary of findings and the agreed plan is below.'));
    }
    lines.push('');

    const history = letterHistoryLines(includeHistory);
    if (history.length) {
        lines.push('RELEVANT HISTORY');
        history.forEach((row) => letterPushWrapped(lines, row));
        lines.push('');
    }

    lines.push('LESIONS');
    if (!selected.length) {
        lines.push('(No lesions selected.)');
    } else {
        selected.forEach((lesion, idx) => {
            const n = idx + 1;
            const site = String(lesion.location || 'Unspecified site').trim();
            const dx = letterDiagnosis(lesion) || 'Unspecified';
            const macro = String(lesion.macroscopic || '').trim();
            const derm = String(lesion.dermoscopy || '').trim();
            const histo = letterHistologyLine(lesion);
            const mgmt = letterManagementLine(lesion);
            lines.push('');
            letterPushWrapped(lines, n + '. ' + site);
            letterPushWrapped(lines, '   Clinical impression: ' + dx);
            if (macro && macro !== 'Unspecified') letterPushWrapped(lines, '   Macroscopic: ' + macro);
            if (derm && derm !== 'Unspecified') letterPushWrapped(lines, '   Dermoscopy: ' + derm);
            if (histo) letterPushWrapped(lines, '   Histology: ' + histo);
            if (lesion.priorLesionId) letterPushWrapped(lines, '   Context: Further management after prior procedure at this site.');
            letterPushWrapped(lines, '   Management: ' + mgmt);
        });
    }
    lines.push('');

    if (isSpecialist) {
        lines.push('REQUEST');
        letterPushWrapped(lines, clinicalQuestion
            ? clinicalQuestion
            : 'Please review and arrange appropriate further management. I am happy to continue shared care as advised.');
        lines.push('');
    } else {
        lines.push('PLAN / FOLLOW-UP');
        letterPushWrapped(lines, clinicalQuestion
            ? clinicalQuestion
            : 'Please find the management plan above. I would be grateful if you could support follow-up in primary care as outlined, and re-refer if there is clinical change or concern.');
        lines.push('');
    }

    if (additionalNotes) {
        lines.push('ADDITIONAL NOTES');
        letterPushWrapped(lines, additionalNotes);
        lines.push('');
    }

    letterPushWrapped(lines, 'Thank you for your care of this patient. Please contact me if any further information would be helpful.');
    lines.push('');
    lines.push('Yours sincerely,');
    lines.push('');
    lines.push(patient.clinician || 'Treating clinician');
    const profile = (typeof clinicProfile !== 'undefined' && clinicProfile) ? clinicProfile : {};
    if (profile.clinicName) lines.push(String(profile.clinicName).trim());
    if (profile.phone) lines.push('Tel: ' + String(profile.phone).trim());

    return letterAscii(lines.join('\n').replace(/\n{3,}/g, '\n\n').trim());
}

function openLetterModal(options) {
    if (typeof requireCurrentPatient === 'function' && !requireCurrentPatient('Open a patient chart before generating a letter.')) {
        return;
    }
    const modal = document.getElementById('letterModal');
    if (!modal) return;

    const preferIds = (options?.preferLesionIds || []).map(String).filter(Boolean);
    const source = letterSourceLesions();
    letterDraft = emptyLetterDraft();
    if (options?.letterType === LETTER_TYPE_SPECIALIST || options?.letterType === LETTER_TYPE_GP) {
        letterDraft.letterType = options.letterType;
    } else if (preferIds.length || source.some((l) => String(l.proposedPlan || '') === 'refer' || isReferLesionPlan(l.plan))) {
        letterDraft.letterType = LETTER_TYPE_SPECIALIST;
    }
    letterDraft.selectedIds = source
        .filter((item) => preferIds.includes(String(item.id)) || (!preferIds.length && letterShouldPreselect(item)))
        .map((item) => String(item.id));
    if (!letterDraft.selectedIds.length && source.length === 1) {
        letterDraft.selectedIds = [String(source[0].id)];
    }

    syncLetterModalFromDraft();
    renderLetterLesionChecklist();
    refreshLetterPreview();
    modal.classList.remove('hidden');
}

function closeLetterModal() {
    const modal = document.getElementById('letterModal');
    if (modal) modal.classList.add('hidden');
}

function syncLetterModalFromDraft() {
    const typeGp = document.getElementById('letterTypeGp');
    const typeSp = document.getElementById('letterTypeSpecialist');
    if (typeGp) typeGp.checked = letterDraft.letterType === LETTER_TYPE_GP;
    if (typeSp) typeSp.checked = letterDraft.letterType === LETTER_TYPE_SPECIALIST;

    const setVal = (id, value) => {
        const el = document.getElementById(id);
        if (el) el.value = value || '';
    };
    setVal('letterRecipientName', letterDraft.recipientName);
    setVal('letterRecipientClinic', letterDraft.recipientClinic);
    setVal('letterClinicalQuestion', letterDraft.clinicalQuestion);
    setVal('letterAdditionalNotes', letterDraft.additionalNotes);

    const urgency = document.getElementById('letterUrgency');
    if (urgency) urgency.value = letterDraft.urgency || 'routine';

    const hist = document.getElementById('letterIncludeHistory');
    if (hist) hist.checked = !!letterDraft.includeHistory;

    updateLetterModalTypeUi();
}

function readLetterDraftFromModal() {
    const typeSp = document.getElementById('letterTypeSpecialist');
    letterDraft.letterType = typeSp?.checked ? LETTER_TYPE_SPECIALIST : LETTER_TYPE_GP;
    letterDraft.recipientName = document.getElementById('letterRecipientName')?.value.trim() || '';
    letterDraft.recipientClinic = document.getElementById('letterRecipientClinic')?.value.trim() || '';
    letterDraft.urgency = document.getElementById('letterUrgency')?.value || 'routine';
    letterDraft.clinicalQuestion = document.getElementById('letterClinicalQuestion')?.value.trim() || '';
    letterDraft.additionalNotes = document.getElementById('letterAdditionalNotes')?.value.trim() || '';
    letterDraft.includeHistory = !!document.getElementById('letterIncludeHistory')?.checked;
    letterDraft.selectedIds = Array.from(document.querySelectorAll('#letterLesionList input[type="checkbox"][data-letter-lesion]:checked'))
        .map((el) => String(el.getAttribute('data-letter-lesion') || ''))
        .filter(Boolean);
}

function updateLetterModalTypeUi() {
    const isSpecialist = !!document.getElementById('letterTypeSpecialist')?.checked;
    const urgencyWrap = document.getElementById('letterUrgencyWrap');
    const questionLabel = document.getElementById('letterClinicalQuestionLabel');
    const title = document.getElementById('letterModalTitle');
    const subtitle = document.getElementById('letterModalSubtitle');
    if (urgencyWrap) urgencyWrap.classList.toggle('hidden', !isSpecialist);
    if (questionLabel) {
        questionLabel.textContent = isSpecialist
            ? 'Referral question / request'
            : 'Key message for the GP (optional)';
    }
    if (title) title.textContent = isSpecialist ? 'Specialist referral letter' : 'GP advice letter';
    if (subtitle) {
        subtitle.textContent = isSpecialist
            ? 'Organising specialist opinion or definitive management — plain text for Best Practice letters.'
            : 'Advising the GP of assessment and management — plain text for Best Practice letters.';
    }
}

function renderLetterLesionChecklist() {
    const host = document.getElementById('letterLesionList');
    if (!host) return;
    const items = letterSourceLesions();
    const selected = new Set((letterDraft.selectedIds || []).map(String));
    if (!items.length) {
        host.innerHTML = '<p class="text-xs text-slate-500 italic p-3">No lesions on this chart yet. Document lesions first, then generate the letter.</p>';
        return;
    }
    host.innerHTML = items.map((lesion) => {
        const id = String(lesion.id);
        const checked = selected.has(id) ? 'checked' : '';
        const dx = letterDiagnosis(lesion) || 'No diagnosis';
        const histo = letterHistologyLine(lesion);
        const referTag = (String(lesion.proposedPlan || '') === 'refer' || isReferLesionPlan(lesion.plan))
            ? '<span class="ml-1 px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-800 text-[10px] font-semibold">Refer</span>'
            : '';
        const visitTag = (typeof isVisitLesion === 'function' && isVisitLesion(id))
            ? '<span class="ml-1 px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-semibold">This visit</span>'
            : '';
        return `
            <label class="flex items-start gap-2.5 p-2.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 cursor-pointer">
                <input type="checkbox" class="mt-1 rounded text-blue-600" data-letter-lesion="${escapeHtml(id)}" ${checked} onchange="onLetterOptionsChanged()">
                <span class="min-w-0 flex-1">
                    <span class="block text-sm font-semibold text-slate-800">${escapeHtml(lesion.location || 'Unspecified site')}${referTag}${visitTag}</span>
                    <span class="block text-xs text-slate-600 mt-0.5">${escapeHtml(dx)}</span>
                    ${histo ? `<span class="block text-[11px] text-slate-500 mt-0.5">Histology: ${escapeHtml(histo)}</span>` : ''}
                    <span class="block text-[11px] text-slate-500 mt-0.5">${escapeHtml(letterManagementLine(lesion))}</span>
                </span>
            </label>`;
    }).join('');
}

function onLetterOptionsChanged() {
    readLetterDraftFromModal();
    updateLetterModalTypeUi();
    refreshLetterPreview();
}

function onLetterTypeChanged() {
    readLetterDraftFromModal();
    updateLetterModalTypeUi();
    refreshLetterPreview();
}

function letterSelectAllLesions(selectAll) {
    document.querySelectorAll('#letterLesionList input[type="checkbox"][data-letter-lesion]').forEach((el) => {
        el.checked = !!selectAll;
    });
    onLetterOptionsChanged();
}

function refreshLetterPreview() {
    readLetterDraftFromModal();
    const preview = document.getElementById('letterPreviewText');
    const meta = document.getElementById('letterPreviewMeta');
    const text = generateClinicalLetterPlainText();
    if (preview) preview.textContent = text || '';
    if (meta) {
        const n = (letterDraft.selectedIds || []).length;
        meta.textContent = n
            ? (n + ' lesion' + (n === 1 ? '' : 's') + ' included · ASCII plain text for BP')
            : 'Select at least one lesion · ASCII plain text for BP';
    }
}

function copyClinicalLetter() {
    readLetterDraftFromModal();
    if (!(letterDraft.selectedIds || []).length) {
        showToast('Select at least one lesion to include in the letter.');
        return;
    }
    const text = generateClinicalLetterPlainText();
    if (!text) {
        showToast('Nothing to copy yet.');
        return;
    }
    const label = letterDraft.letterType === LETTER_TYPE_SPECIALIST
        ? 'Specialist referral letter copied for Best Practice.'
        : 'GP advice letter copied for Best Practice.';
    copyTextToClipboard(text, label, () => {
        if (typeof markOutputCopied === 'function') markOutputCopied('letter', text);
    });
}

function openLetterModalForRefer(lesionId) {
    openLetterModal({
        letterType: LETTER_TYPE_SPECIALIST,
        preferLesionIds: lesionId ? [lesionId] : []
    });
}
