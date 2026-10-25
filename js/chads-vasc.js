/* CHA₂DS₂-VASc counselling for holding a DOAC around a skin procedure.
   Annual rates are the commonly quoted untreated AF figures used for discussion
   (Lip / Swedish AF-style tables). The hold-period figure is that annual risk
   prorated over the days the tablet is missed — an estimate for consent, not a
   precise individual prediction. */

const CHADS_ANNUAL_STROKE_PCT = [0.2, 0.6, 2.2, 3.2, 4.8, 7.2, 9.7, 11.2, 10.8, 12.2];

const CHADS_DRUG_LABELS = {
    rivaroxaban: 'rivaroxaban (Xarelto)',
    apixaban: 'apixaban (Eliquis)',
    dabigatran: 'dabigatran (Pradaxa)',
    edoxaban: 'edoxaban (Lixiana)'
};

function parseChadsAgeFromDob(raw) {
    const text = String(raw || '').trim();
    let day;
    let month;
    let year;
    const au = text.match(/^(\d{1,2})\D+(\d{1,2})\D+(\d{4})$/);
    const iso = text.match(/^(\d{4})\D+(\d{1,2})\D+(\d{1,2})$/);
    if (au) {
        day = Number(au[1]);
        month = Number(au[2]);
        year = Number(au[3]);
    } else if (iso) {
        year = Number(iso[1]);
        month = Number(iso[2]);
        day = Number(iso[3]);
    } else {
        return null;
    }
    if (!day || !month || !year || day > 31 || month > 12 || year < 1900) return null;
    const dob = new Date(year, month - 1, day);
    if (dob.getFullYear() !== year || dob.getMonth() !== month - 1 || dob.getDate() !== day) return null;
    const now = new Date();
    let age = now.getFullYear() - year;
    if (now.getMonth() < month - 1 || (now.getMonth() === month - 1 && now.getDate() < day)) age -= 1;
    return age >= 0 && age < 130 ? age : null;
}

function chadsPatientDob() {
    return (typeof currentPatient !== 'undefined' && currentPatient?.dob)
        || document.getElementById('consentPatientDOB')?.value
        || document.getElementById('mainPatientDOB')?.value
        || (typeof readChartPatientDobFields === 'function' ? readChartPatientDobFields() : '')
        || '';
}

function chadsAgePoints(age) {
    const n = Number(age);
    if (!(n >= 0)) return 0;
    if (n >= 75) return 2;
    if (n >= 65) return 1;
    return 0;
}

function chadsScoreFromFactors(factors) {
    const f = factors || {};
    let score = 0;
    if (f.hf) score += 1;
    if (f.htn) score += 1;
    score += chadsAgePoints(f.age);
    if (f.diabetes) score += 1;
    if (f.stroke) score += 2;
    if (f.vascular) score += 1;
    if (f.sex === 'female') score += 1;
    return Math.min(9, score);
}

function chadsAnnualStrokePct(score) {
    const i = Math.max(0, Math.min(9, Number(score) || 0));
    return CHADS_ANNUAL_STROKE_PCT[i];
}

function formatChadsPercent(pct) {
    const n = Number(pct);
    if (!(n > 0)) return '0%';
    if (n >= 1) return n.toFixed(n >= 10 ? 1 : 1) + '%';
    if (n >= 0.1) return n.toFixed(2) + '%';
    return n.toFixed(3) + '%';
}

function formatChadsOneIn(pct) {
    if (!(pct > 0)) return 'much less than 1 in 10,000';
    const n = Math.round(100 / pct);
    let rounded = n;
    if (n >= 10000) rounded = Math.round(n / 500) * 500;
    else if (n >= 1000) rounded = Math.round(n / 50) * 50;
    else if (n >= 100) rounded = Math.round(n / 10) * 10;
    else if (n >= 20) rounded = Math.round(n / 5) * 5;
    return 'about 1 in ' + String(rounded).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function chadsHoldRisk(factors) {
    const f = factors || {};
    const age = f.age == null ? parseChadsAgeFromDob(f.dob || '') : f.age;
    const score = chadsScoreFromFactors({ ...f, age });
    const annualPct = chadsAnnualStrokePct(score);
    const holdDays = Math.max(0, Number(f.holdDays) || 0);
    const holdPct = annualPct * (holdDays / 365);
    return {
        age,
        score,
        annualPct,
        holdDays,
        holdPct,
        oneIn: formatChadsOneIn(holdPct),
        drug: f.drug || 'rivaroxaban',
        drugLabel: CHADS_DRUG_LABELS[f.drug] || CHADS_DRUG_LABELS.rivaroxaban,
        indication: f.indication || 'af',
        sex: f.sex || ''
    };
}

function readChadsFactorsFromDom() {
    const drug = document.querySelector('input[name="chadsDrug"]:checked')?.value
        || document.getElementById('chadsDrug')?.value
        || 'rivaroxaban';
    const indication = document.querySelector('input[name="chadsIndication"]:checked')?.value
        || document.getElementById('chadsIndication')?.value
        || 'af';
    const sex = document.querySelector('input[name="chadsSex"]:checked')?.value
        || document.getElementById('chadsSex')?.value
        || '';
    return {
        drug,
        indication,
        sex,
        dob: chadsPatientDob(),
        age: parseChadsAgeFromDob(chadsPatientDob()),
        hf: !!document.getElementById('chadsHf')?.checked,
        htn: !!document.getElementById('chadsHtn')?.checked,
        diabetes: !!document.getElementById('chadsDiabetes')?.checked,
        stroke: !!document.getElementById('chadsStroke')?.checked,
        vascular: !!document.getElementById('chadsVascular')?.checked,
        holdDays: Math.max(0, Number(document.getElementById('chadsHoldDays')?.value) || 0)
    };
}

function chadsCalculationReady(factors) {
    const fromDom = !factors;
    const f = factors || readChadsFactorsFromDom();
    if (fromDom && typeof document !== 'undefined' && document.getElementById && document.getElementById('bldDOAC') && !document.getElementById('bldDOAC').checked) {
        return false;
    }
    if (f.indication && f.indication !== 'af') return false;
    if (f.sex !== 'male' && f.sex !== 'female') return false;
    if (!(Number(f.holdDays) > 0)) return false;
    return true;
}

function formatChadsConsentLines(factors) {
    const f = factors || readChadsFactorsFromDom();
    if (!chadsCalculationReady(f)) return [];
    const risk = chadsHoldRisk(f);
    const ageBit = risk.age != null ? (', age ' + risk.age) : '';
    const days = risk.holdDays === 1 ? '1 day' : (risk.holdDays + ' days');
    return [
        'Anticoagulant interruption (CHA₂DS₂-VASc): The patient takes ' + risk.drugLabel
            + ' for atrial fibrillation. Score ' + risk.score + ageBit
            + ' — approximate untreated annual stroke or systemic-embolism risk '
            + formatChadsPercent(risk.annualPct)
            + '. Holding anticoagulation for ' + days
            + ' carries an approximate additional risk of '
            + formatChadsPercent(risk.holdPct) + ' (' + risk.oneIn
            + ') during that interval. This estimate was discussed for consent. It is a prorated population figure, not a precise individual prediction. Bridging with heparin is not usually used when a DOAC is held for skin surgery. Bleeding risk if the anticoagulant is continued was also considered.'
    ];
}

function collectChadsConsentBlock() {
    const includeEl = document.getElementById('consentChadsInclude') || document.getElementById('chadsIncludeConsent');
    if (includeEl && !includeEl.checked) return null;
    const lines = formatChadsConsentLines();
    if (!lines.length) return null;
    return { lines };
}

function chadsResultSummaryHtml(factors) {
    const f = factors || readChadsFactorsFromDom();
    const esc = typeof escapeHtml === 'function' ? escapeHtml : (value) => String(value || '');
    if (f.indication && f.indication !== 'af') {
        return '<p class="insp-hint">CHA₂DS₂-VASc is for atrial fibrillation. For VTE or another indication, record the hold plan in the notes — do not use this stroke-risk estimate.</p>';
    }
    if (f.sex !== 'male' && f.sex !== 'female') {
        return '<p class="insp-hint">Ask sex and complete the factors to estimate the extra stroke risk while the DOAC is held.</p>';
    }
    if (!(Number(f.holdDays) > 0)) {
        return '<p class="insp-hint">Enter how many days the tablet will be missed, including the procedure day.</p>';
    }
    const risk = chadsHoldRisk(f);
    const ageBit = risk.age != null ? (' · age ' + risk.age) : ' · date of birth needed for age points';
    return '<p class="text-xs text-slate-800"><strong>Score ' + risk.score + '</strong>' + esc(ageBit)
        + ' · untreated annual risk ' + esc(formatChadsPercent(risk.annualPct))
        + '</p><p class="text-xs text-slate-800 mt-1"><strong>About '
        + esc(formatChadsPercent(risk.holdPct)) + '</strong> extra stroke or embolism risk over '
        + esc(String(risk.holdDays)) + ' day' + (risk.holdDays === 1 ? '' : 's')
        + ' off ' + esc(risk.drugLabel) + ' (' + esc(risk.oneIn) + ').</p>';
}

function writeChadsHiddenFields() {
    const setVal = (id, value) => {
        const el = document.getElementById(id);
        if (el) el.value = value == null ? '' : String(value);
    };
    setVal('chadsDrug', document.querySelector('input[name="chadsDrug"]:checked')?.value || 'rivaroxaban');
    setVal('chadsIndication', document.querySelector('input[name="chadsIndication"]:checked')?.value || 'af');
    setVal('chadsSex', document.querySelector('input[name="chadsSex"]:checked')?.value || '');
}

function applyChadsRadioGroup(name, value) {
    const radios = document.querySelectorAll('input[name="' + name + '"]');
    let matched = false;
    radios.forEach((el) => {
        el.checked = el.value === value;
        if (el.checked) matched = true;
    });
    if (!matched && name === 'chadsDrug') {
        const riv = document.querySelector('input[name="chadsDrug"][value="rivaroxaban"]');
        if (riv) riv.checked = true;
    }
    if (!matched && name === 'chadsIndication') {
        const af = document.querySelector('input[name="chadsIndication"][value="af"]');
        if (af) af.checked = true;
    }
}

function applyChadsFieldsFromStore() {
    applyChadsRadioGroup('chadsDrug', document.getElementById('chadsDrug')?.value || 'rivaroxaban');
    applyChadsRadioGroup('chadsIndication', document.getElementById('chadsIndication')?.value || 'af');
    applyChadsRadioGroup('chadsSex', document.getElementById('chadsSex')?.value || '');
    const dm = document.getElementById('chadsDiabetes');
    if (dm && dm.checked) dm.dataset.userSet = '1';
    const include = document.getElementById('chadsIncludeConsent');
    if (include && include.checked) include.dataset.autoed = '1';
    const hold = document.getElementById('chadsHoldDays');
    if (hold && !hold.value) hold.value = '3';
    writeChadsHiddenFields();
    syncChadsVascUi();
}

function prefillChadsDiabetes() {
    const dm = document.getElementById('chadsDiabetes');
    const chartDm = document.getElementById('heaDiabetes');
    if (!dm || dm.dataset.userSet === '1') return;
    if (chartDm?.checked) dm.checked = true;
}

function syncChadsVascUi() {
    const onDoac = !!document.getElementById('bldDOAC')?.checked;
    const panel = document.getElementById('chadsVascPanel');
    if (panel) panel.classList.toggle('hidden', !onDoac);
    if (onDoac) prefillChadsDiabetes();
    const ageEl = document.getElementById('chadsAgeDisplay');
    if (ageEl) {
        const age = parseChadsAgeFromDob(chadsPatientDob());
        ageEl.textContent = age != null ? (age + ' years (from date of birth)') : 'Enter a date of birth on the chart — age scores 1 point from 65 and 2 from 75.';
    }
    const result = document.getElementById('chadsResultBox');
    if (result) result.innerHTML = onDoac ? chadsResultSummaryHtml() : '';
    const include = document.getElementById('chadsIncludeConsent');
    if (include && onDoac && chadsCalculationReady() && include.dataset.autoed !== '1') {
        include.checked = true;
        include.dataset.autoed = '1';
    }
    syncChadsConsentCard();
}

function syncChadsConsentCard() {
    const card = document.getElementById('consentChadsCard');
    if (!card) return;
    const onDoac = !!document.getElementById('bldDOAC')?.checked;
    card.classList.toggle('hidden', !onDoac);
    const summary = document.getElementById('consentChadsSummary');
    if (summary) {
        const lines = formatChadsConsentLines();
        if (lines.length) summary.textContent = lines[0];
        else summary.innerHTML = chadsResultSummaryHtml();
    }
    const include = document.getElementById('consentChadsInclude');
    const source = document.getElementById('chadsIncludeConsent');
    if (include && source) include.checked = !!source.checked;
}

function onChadsVascChange() {
    writeChadsHiddenFields();
    syncChadsVascUi();
    if (typeof updateOutput === 'function') updateOutput();
    if (typeof scheduleChartSave === 'function') scheduleChartSave();
}

function onDoacScreeningChange() {
    syncChadsVascUi();
    if (typeof updateOutput === 'function') updateOutput();
    if (typeof scheduleChartSave === 'function') scheduleChartSave();
}

function onChadsDiabetesUserChange() {
    const dm = document.getElementById('chadsDiabetes');
    if (dm) dm.dataset.userSet = '1';
    onChadsVascChange();
}

function onHealingDiabetesChange() {
    const dm = document.getElementById('chadsDiabetes');
    if (dm && dm.dataset.userSet !== '1') {
        dm.checked = !!document.getElementById('heaDiabetes')?.checked;
    }
    if (typeof updateOutput === 'function') updateOutput();
    if (typeof scheduleChartSave === 'function') scheduleChartSave();
    syncChadsVascUi();
}

function onConsentChadsIncludeChange() {
    const include = document.getElementById('consentChadsInclude');
    const source = document.getElementById('chadsIncludeConsent');
    if (source && include) {
        source.checked = !!include.checked;
        source.dataset.autoed = '1';
    }
    if (typeof scheduleChartSave === 'function') scheduleChartSave();
}

function focusChadsVascCalculator() {
    if (typeof selectChartVisitItem === 'function') selectChartVisitItem('risks');
    else if (typeof switchWorkspaceTab === 'function') switchWorkspaceTab('history');
    if (typeof setGroupState === 'function') setGroupState('bld', 'YES');
    const doac = document.getElementById('bldDOAC');
    if (doac && !doac.checked) {
        doac.checked = true;
        onDoacScreeningChange();
    } else {
        syncChadsVascUi();
    }
    if (typeof setAccordionCollapsed === 'function') setAccordionCollapsed('sec-risks', false);
    const panel = document.getElementById('chadsVascPanel');
    if (panel) panel.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        parseChadsAgeFromDob,
        chadsAgePoints,
        chadsScoreFromFactors,
        chadsAnnualStrokePct,
        chadsHoldRisk,
        formatChadsPercent,
        formatChadsOneIn,
        formatChadsConsentLines,
        chadsCalculationReady,
        CHADS_ANNUAL_STROKE_PCT
    };
}
