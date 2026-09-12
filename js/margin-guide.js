/* Australian clinical (in-vivo) peripheral margin suggestions.
   Cancer Council Australia keratinocyte guidelines (AJGP 2021 Table 1) and
   melanoma margins (MJA 2018 / Cancer Council). Suggest only — never lock. */

let marginSuggestTargetId = '';
let lastMarginSuggestion = null;

function parseMarginMm(value) {
    const text = String(value == null ? '' : value).trim();
    if (!text) return '';
    const nums = [...text.matchAll(/(\d+(?:\.\d+)?)/g)].map((match) => match[1]);
    if (!nums.length) return '';
    return nums[0];
}

function formatMarginDisplay(value) {
    const n = parseMarginMm(value);
    return n ? n + ' mm' : '';
}

function formatMarginCompact(value) {
    const n = parseMarginMm(value);
    return n ? n + 'mm' : '';
}

function setMmInputValue(elOrId, raw) {
    const el = typeof elOrId === 'string' ? document.getElementById(elOrId) : elOrId;
    if (!el) return;
    el.value = parseMarginMm(raw);
}

function readMmInputValue(elOrId) {
    const el = typeof elOrId === 'string' ? document.getElementById(elOrId) : elOrId;
    return parseMarginMm(el?.value);
}

function plannedMarginFieldsFromNumber(raw, suggestion) {
    const n = parseMarginMm(raw);
    const out = {
        excisionMarginMm: n,
        excisionMargin: formatMarginDisplay(n)
    };
    if (suggestion && (suggestion.reason || suggestion.suggestedMm)) {
        out.suggestedMarginMm = parseMarginMm(suggestion.suggestedMm || suggestion.mm || n);
        out.marginSuggestionReason = suggestion.reason || '';
    }
    return out;
}

const MARGIN_SITE_RULES = [
    { id: 'nose', label: 'Nose', band: 'high_kc', re: /\b(nose|nasal|ala|alar|columella|nasolabial|melolabial)\b/i },
    { id: 'eyelid', label: 'Eyelid / periorbital', band: 'high_kc', re: /\b(eyelid|lid|canthus|canthal|periocular|periorbital|infraorbital|supraorbital)\b/i },
    { id: 'eyebrow', label: 'Eyebrow', band: 'high_kc', re: /\b(eyebrow|brow)\b/i },
    { id: 'lip', label: 'Lip', band: 'high_kc', re: /\b(lip|vermilion|philtrum)\b/i },
    { id: 'chin', label: 'Chin / mandible', band: 'high_kc', re: /\b(chin|mentum|mandible|jawline|jaw)\b/i },
    { id: 'temple', label: 'Temple', band: 'high_kc', re: /\b(temple|temporal)\b/i },
    { id: 'ear', label: 'Ear / peri-auricular', band: 'high_kc', re: /\b(ear|helix|helical|pinna|tragus|antitragus|lobule|concha|preauricular|postauricular|pre-auricular|post-auricular|auricle|earlobe)\b/i },
    { id: 'genitalia', label: 'Genitalia', band: 'high_kc', re: /\b(genital|genitalia|penis|penile|vulva|vulval|scrotum|scrotal|perineum|perineal)\b/i },
    { id: 'digit', label: 'Digit / nail', band: 'high_kc', re: /\b(digit|finger|thumb|toe|nail|subungual|periungual)\b/i },
    { id: 'palm_sole', label: 'Palm / sole', band: 'high_kc', re: /\b(palm|palmar|sole|plantar|acral)\b/i },
    { id: 'hand', label: 'Hand', band: 'high_kc', re: /\b(hands?|dorsum of (the )?hand)\b/i },
    { id: 'foot', label: 'Foot', band: 'high_kc', re: /\b(feet|foot)\b/i },
    { id: 'pretibia', label: 'Pretibia / distal leg', band: 'healing', re: /\b(pretibia|pre-tibial|shin|malleolus|ankle)\b/i },
    { id: 'cheek', label: 'Cheek', band: 'head_neck', re: /\b(cheek|malar|zygoma)\b/i },
    { id: 'forehead', label: 'Forehead', band: 'head_neck', re: /\b(forehead|glabella|frontal)\b/i },
    { id: 'scalp', label: 'Scalp', band: 'head_neck', re: /\b(scalp|vertex|occiput|occipital|parietal|crown)\b/i },
    { id: 'neck', label: 'Neck', band: 'head_neck', re: /\b(neck|cervical|supraclavicular)\b/i },
    { id: 'face', label: 'Face', band: 'head_neck', re: /\b(face|facial)\b/i },
    { id: 'trunk', label: 'Trunk', band: 'lower', re: /\b(trunk|chest|abdomen|abdominal|back|flank|breast|shoulder|scapula)\b/i },
    { id: 'prox_arm', label: 'Proximal arm', band: 'lower', re: /\b(upper arm|forearm|arm)\b/i },
    { id: 'prox_leg', label: 'Proximal leg', band: 'lower', re: /\b(thigh|hip|buttock)\b/i }
];

function classifyMarginSite(location) {
    const text = String(location || '').trim();
    if (!text) {
        return { id: '', label: 'Site not entered', band: 'unknown', matched: '' };
    }
    for (const rule of MARGIN_SITE_RULES) {
        if (rule.re.test(text)) {
            return { id: rule.id, label: rule.label, band: rule.band, matched: text };
        }
    }
    return { id: 'other', label: text, band: 'lower', matched: text };
}

function marginDiagnosisFamily(raw) {
    const parts = String(raw || '').split(';').map((part) => part.trim()).filter(Boolean);
    const chunks = parts.length ? parts : [String(raw || '').trim()];
    const mapOne = (part) => {
        const fam = (typeof diagnosisFamilyFromText === 'function'
            ? diagnosisFamilyFromText(part)
            : (typeof diagnosisCodeFromText === 'function' ? diagnosisCodeFromText(part) : '')) || '';
        const code = (typeof diagnosisCodeFromText === 'function' ? diagnosisCodeFromText(part) : '') || part;
        const hay = (fam + ' ' + code + ' ' + part).toLowerCase();
        if (fam === 'MCC' || /\bmcc\b|merkel/.test(hay)) return 'mcc';
        if (fam === 'MMmet' || /\bmmmet\b|metastas/.test(hay)) return 'metastasis';
        if (fam === 'HMF' || /\bhmf\b|hutchinson|lentigo maligna/.test(hay)) return 'hmf';
        if (fam === 'MMis' || /\bmmis\b|melanoma in situ/.test(hay)) return 'mmis';
        if (fam === 'MMinv' || (/\bmminv\b|invasive melanoma|\bmelanoma\b/.test(hay) && !/exclude|ex mel/.test(hay))) return 'mminv';
        if (fam === 'KA' || /\bka\b|keratoacanthoma/.test(hay)) return 'ka';
        if (fam === 'IEC' || /\biec\b|bowen|intraepidermal/.test(hay)) return 'iec';
        if (fam === 'SCC' || /\bscc\b|squamous/.test(hay)) return 'scc';
        if (fam === 'BCC' || /\bbcc\b|basal cell/.test(hay)) return 'bcc';
        if (fam === 'DN' || fam === 'BN' || fam === 'SN' || fam === 'Reed'
            || /\bdn\b|\bbn\b|dysplastic|atypical naev|atypical nev|spitz|\bsn\b/.test(hay)) return 'pigmented';
        if (fam === 'SK' || fam === 'SebK' || fam === 'LPLK' || fam === 'SL' || fam === 'DF'
            || /\bsk\b|seb k|sebk|solar keratos|lplk/.test(hay)) return 'benign_kc_like';
        return '';
    };
    const mapped = chunks.map(mapOne).filter(Boolean);
    const rank = {
        metastasis: 6, mcc: 5, mminv: 4, hmf: 3, mmis: 3, scc: 2, bcc: 2, ka: 2, iec: 2, pigmented: 1, benign_kc_like: 0
    };
    mapped.sort((a, b) => (rank[b] || 0) - (rank[a] || 0));
    return mapped[0] || 'other';
}

function isMelanomaFamily(family) {
    return family === 'mmis' || family === 'hmf' || family === 'mminv';
}

function isPigmentedFamily(family) {
    return isMelanomaFamily(family) || family === 'pigmented';
}

function parseBreslowMmFromText(text) {
    const s = String(text || '');
    const match = s.match(/breslow[^0-9]{0,24}(\d+(?:\.\d+)?)\s*(?:mm)?/i)
        || s.match(/(?:thickness|invasion(?: depth)?)[^0-9]{0,18}(\d+(?:\.\d+)?)\s*mm/i)
        || s.match(/(\d+(?:\.\d+)?)\s*mm\s*(?:breslow|thick)/i);
    if (!match) return '';
    return match[1];
}

function inferBreslowBand(text, family) {
    const hay = String(text || '').toLowerCase();
    if (family === 'hmf' || /lentigo maligna|\bhmf\b/.test(hay)) return 'lm';
    if (family === 'mmis' || (/in situ/.test(hay) && !/invasi/.test(hay))) return 'is';
    const mm = parseFloat(parseBreslowMmFromText(text));
    if (!Number.isFinite(mm)) return family === 'mminv' ? 'unknown' : (family === 'mmis' ? 'is' : 'unknown');
    if (mm <= 0) return 'is';
    if (mm <= 1) return 't1';
    if (mm <= 2) return 't2';
    if (mm <= 4) return 't3';
    return 't4';
}

function lesionHasConfirmedHistology(lesion) {
    return !!(lesion && String(lesion.histologyResult || '').trim());
}

function collectMarginHistologyText(lesion, prior) {
    return [
        lesion?.histologyDiagnosis,
        lesion?.histologyResult,
        lesion?.priorHistologyResult,
        prior?.histologyDiagnosis,
        prior?.histologyResult
    ].filter(Boolean).join('\n');
}

function inferMarginIntent(ctx) {
    const family = ctx.family || marginDiagnosisFamily(ctx.diagnosis);
    const reex = !!ctx.isReexcision;
    const histo = collectMarginHistologyText(ctx.lesion, ctx.prior);
    const confirmedMelanoma = (typeof histologyIndicatesMelanoma === 'function'
        ? (histologyIndicatesMelanoma(histo) || histologyIndicatesMelanoma(ctx.lesion) || histologyIndicatesMelanoma(ctx.prior))
        : /melanoma|hmf|lentigo maligna/.test(histo.toLowerCase()));
    const kind = ctx.kind || 'excision';

    if (family === 'mcc' || family === 'metastasis') return 'specialist';
    if (kind === 'shave' || kind === 'punch') {
        if (isPigmentedFamily(family)) return 'diagnostic';
        return 'kc';
    }
    if (reex && (confirmedMelanoma || isMelanomaFamily(family))) return 'melanoma_wle';
    if (lesionHasConfirmedHistology(ctx.lesion) && isMelanomaFamily(family)) return 'melanoma_wle';
    if (isMelanomaFamily(family) && !reex && !confirmedMelanoma) return 'diagnostic';
    if (family === 'pigmented' && !reex) return 'diagnostic';
    if (family === 'benign_kc_like') return 'none';
    return 'kc';
}

function siteRiskForFamily(site, family) {
    if (!site || site.band === 'unknown') return { high: false, note: 'Enter the site so high-risk anatomy can be applied.' };
    if (family === 'scc' || family === 'ka') {
        if (site.band === 'high_kc' || site.band === 'head_neck') {
            return {
                high: true,
                note: site.label + ' is head and neck / high-risk anatomy for SCC — Australian tables use the high-risk row (6 mm), not a unique millimetre for this named site.'
            };
        }
        if (site.band === 'healing') {
            return {
                high: false,
                note: site.label + ' is a poorly healing site. SCC millimetres stay 4 mm unless another high-risk flag applies; consider delayed healing / specialist closure.'
            };
        }
        return { high: false, note: site.label + ' is not a high-risk SCC site on its own.' };
    }
    if (family === 'bcc' || family === 'iec') {
        if (site.band === 'high_kc') {
            return {
                high: true,
                note: site.label + ' is a high-risk keratinocyte site (central face / ear / digit / acral / genitalia). CCA does not publish a different millimetre per named site — it upgrades BCC to > 5 mm. Mohs is an alternative if poorly defined.'
            };
        }
        if (site.band === 'healing') {
            return {
                high: true,
                note: site.label + ' is treated as high-risk for BCC because of poor healing / incomplete-excision risk. Prefill 5 mm; consider delayed healing.'
            };
        }
        if (site.band === 'head_neck') {
            return {
                high: false,
                note: site.label + ' is intermediate for BCC (not central-face H-zone). Keep 2–3 mm unless the lesion is ill-defined, recurrent, aggressive subtype, or ≥ 20 mm.'
            };
        }
        return { high: false, note: site.label + ' is a lower-risk site for BCC unless size or other flags apply.' };
    }
    if (isMelanomaFamily(family) || family === 'pigmented') {
        const constrained = site.band === 'high_kc' || site.id === 'face' || site.id === 'cheek' || site.id === 'forehead';
        if (constrained) {
            return {
                high: false,
                note: 'Australian melanoma RCTs did not cover face, digits, acral, or genitals. Suggested WLE millimetres are unchanged; you may narrow for function. No unique millimetre is published for ' + site.label + '.'
            };
        }
        return { high: false, note: 'Site does not change the melanoma millimetre table.' };
    }
    return { high: false, note: site.label ? ('Site recorded as ' + site.label + '.') : '' };
}

function suggestClinicalMargin(input) {
    const diagnosis = input.diagnosis || '';
    const family = input.family || marginDiagnosisFamily(diagnosis);
    const site = input.site || classifyMarginSite(input.location);
    const intent = input.intent || inferMarginIntent({ ...input, family });
    const flags = input.flags || {};
    const siteRisk = siteRiskForFamily(site, family);
    const high = !!(flags.illDefined || flags.recurrent || flags.aggressive || flags.immuno || flags.large || siteRisk.high);
    const sourceKc = 'Cancer Council Australia keratinocyte guidelines (AJGP 2021 Table 1)';
    const sourceMm = 'Cancer Council / MJA 2018 melanoma clinical margins';
    const alts = [];
    const caution = [];

    if (intent === 'specialist' || family === 'mcc' || family === 'metastasis') {
        return {
            mm: '',
            rangeLabel: 'Specialist / MDT',
            reason: 'Merkel cell carcinoma and melanoma metastasis are not given an office millimetre in Australian primary-care tables.',
            source: sourceKc,
            site,
            siteRisk,
            intent,
            family,
            alternatives: [],
            caution: ['Refer — do not auto-suggest a wide local excision millimetre.'],
            allowSuggest: false
        };
    }

    if (intent === 'none' || family === 'benign_kc_like') {
        return {
            mm: '',
            rangeLabel: 'No oncologic margin',
            reason: 'Solar keratosis / seborrhoeic keratosis are not excised to a cancer millimetre. Do not use a 3–4 mm ellipse as an oncologic default.',
            source: sourceKc,
            site,
            siteRisk,
            intent,
            family,
            alternatives: [],
            caution: [],
            allowSuggest: false
        };
    }

    if (intent === 'diagnostic') {
        alts.push({ mm: '2', label: '2 mm diagnostic' });
        if (site.band === 'high_kc') {
            caution.push('Keep this a diagnostic excision (no flap, into upper subcutis). A high-risk site does not widen the first pigmented biopsy.');
        }
        return {
            mm: '2',
            rangeLabel: '2 mm',
            reason: 'Diagnostic excision of a suspicious pigmented lesion: 2 mm clinical margin into upper subcutis. Not a 10 mm wide local excision, and not a flap.',
            source: sourceMm,
            site,
            siteRisk,
            intent,
            family,
            alternatives: alts,
            caution,
            allowSuggest: true
        };
    }

    if (intent === 'melanoma_wle') {
        const band = input.breslowBand || inferBreslowBand(input.histologyText, family);
        let mm = '';
        let rangeLabel = '';
        let reason = '';
        if (family === 'hmf' || band === 'lm') {
            mm = '10';
            rangeLabel = '10 mm (prefer)';
            reason = 'Lentigo maligna / HMF: prefer 10 mm if the site allows. 5 mm is often inadequate. Aim complete histological clearance.';
            alts.push({ mm: '5', label: '5 mm (may be inadequate)' }, { mm: '10', label: '10 mm prefer' });
        } else if (band === 'is' || family === 'mmis') {
            mm = '5';
            rangeLabel = '5–10 mm';
            reason = 'Melanoma in situ (non-LM): 5 mm usual, range 5–10 mm, aiming complete histological clearance.';
            alts.push({ mm: '5', label: '5 mm' }, { mm: '10', label: '10 mm' });
        } else if (band === 't1') {
            mm = '10';
            rangeLabel = '10 mm';
            reason = 'Invasive melanoma pT1 (Breslow ≤ 1.0 mm): 10 mm radial clinical margin from scar / residual edge.';
            alts.push({ mm: '10', label: '10 mm' });
        } else if (band === 't2') {
            mm = '10';
            rangeLabel = '10–20 mm';
            reason = 'Invasive melanoma pT2 (1.01–2.00 mm): 10–20 mm. Map sentinel node before a wider excision if SLNB is planned.';
            alts.push({ mm: '10', label: '10 mm' }, { mm: '20', label: '20 mm' });
        } else if (band === 't3') {
            mm = '20';
            rangeLabel = '10–20 mm (prefer 20 mm)';
            reason = 'Invasive melanoma pT3 (2.01–4.00 mm): 10–20 mm; prefer 20 mm where the site allows.';
            alts.push({ mm: '10', label: '10 mm' }, { mm: '20', label: '20 mm' });
        } else if (band === 't4') {
            mm = '20';
            rangeLabel = '20 mm';
            reason = 'Invasive melanoma pT4 (> 4 mm): 20 mm. Usually specialist / MDT.';
            alts.push({ mm: '20', label: '20 mm' });
            caution.push('Thick melanoma — confirm with specialist / MDT if not already referred.');
        } else {
            mm = '';
            rangeLabel = 'Need Breslow';
            reason = 'Confirmed or planned melanoma wide local excision needs Breslow thickness (or in situ / LM) before a millimetre is suggested. Do not guess 10 mm.';
            caution.push('Enter Breslow or in-situ / LM in the box below, or keep the field blank.');
        }
        if (siteRisk.note) caution.push(siteRisk.note);
        return {
            mm,
            rangeLabel,
            reason,
            source: sourceMm,
            site,
            siteRisk,
            intent,
            family,
            alternatives: alts,
            caution,
            allowSuggest: !!mm
        };
    }

    if (family === 'iec') {
        const mm = '4';
        caution.push('CCA has no millimetre table for Bowen / IEC. 4 mm follows BAD 2022 (3–5 mm) when excision is chosen. Topical, PDT, or cryotherapy may be appropriate instead.');
        if (siteRisk.high) caution.push(siteRisk.note);
        return {
            mm,
            rangeLabel: '3–5 mm',
            reason: 'IEC / Bowen if excising: 4 mm clinical margin (BAD 2022 3–5 mm). Deep plane: skin and fat.',
            source: 'BAD 2022 (CCA has no IEC millimetre table)',
            site,
            siteRisk,
            intent,
            family,
            alternatives: [{ mm: '3', label: '3 mm' }, { mm: '4', label: '4 mm' }, { mm: '5', label: '5 mm' }],
            caution,
            allowSuggest: true
        };
    }

    if (family === 'bcc') {
        const mm = high ? '5' : '3';
        const rangeLabel = high ? '> 5 mm' : '2–3 mm';
        const why = [];
        if (siteRisk.high) why.push(siteRisk.note);
        if (flags.illDefined) why.push('Ill-defined border.');
        if (flags.recurrent) why.push('Recurrent / incomplete.');
        if (flags.aggressive) why.push('Aggressive subtype (morphoeic / infiltrative / micronodular).');
        if (flags.immuno) why.push('Immunosuppression.');
        if (flags.large) why.push('Size ≥ 20 mm.');
        if (high && (flags.illDefined || flags.recurrent || site.band === 'high_kc')) {
            caution.push('Mohs or specialist margin-controlled surgery is an alternative to a wider empirical margin on this site.');
        }
        alts.push({ mm: '2', label: '2 mm' }, { mm: '3', label: '3 mm' }, { mm: '5', label: '5 mm' });
        return {
            mm,
            rangeLabel,
            reason: (high
                ? 'High-risk BCC: clinical margin > 5 mm (prefill 5 mm). '
                : 'Low-risk BCC: clinical margin 2–3 mm (prefill 3 mm). ')
                + (why.length ? why.join(' ') : (siteRisk.note || '')),
            source: sourceKc,
            site,
            siteRisk,
            intent,
            family,
            alternatives: alts,
            caution,
            allowSuggest: true
        };
    }

    if (family === 'scc' || family === 'ka') {
        const veryHigh = high && (flags.immuno || flags.aggressive || flags.recurrent) && siteRisk.high;
        const mm = veryHigh ? '10' : (high ? '6' : '4');
        const rangeLabel = veryHigh ? '~10 mm / MDT' : (high ? '6 mm' : '4 mm');
        const label = family === 'ka' ? 'Keratoacanthoma (treat as SCC)' : 'SCC';
        if (veryHigh) caution.push('Very high-risk SCC — 10 mm is a teaching upper bound; MDT / specialist is often more appropriate than an office 10 mm ellipse.');
        if (siteRisk.note) caution.push(siteRisk.note);
        alts.push({ mm: '4', label: '4 mm' }, { mm: '6', label: '6 mm' }, { mm: '10', label: '10 mm' });
        return {
            mm,
            rangeLabel,
            reason: label + ': ' + (high ? 'high-risk clinical margin 6 mm' : 'low-risk clinical margin 4 mm')
                + (veryHigh ? '; extra flags suggest considering ~10 mm or referral' : '')
                + '. Deep plane: skin and subcutaneous fat.',
            source: sourceKc,
            site,
            siteRisk,
            intent,
            family,
            alternatives: alts,
            caution,
            allowSuggest: true
        };
    }

    const fallbackMm = high ? '5' : '3';
    return {
        mm: fallbackMm,
        rangeLabel: high ? '3–5 mm+' : '3–4 mm',
        reason: 'Diagnosis is not a standard BCC / SCC / melanoma code. OCP practical line for small uncomplicated keratinocyte lesions is a 3–4 mm ellipse — confirm the diagnosis before relying on this.',
        source: 'Optimal Care Pathway keratinocyte 2nd ed. (practical line)',
        site,
        siteRisk,
        intent,
        family,
        alternatives: [{ mm: '3', label: '3 mm' }, { mm: '4', label: '4 mm' }, { mm: '5', label: '5 mm' }],
        caution: [siteRisk.note].filter(Boolean),
        allowSuggest: true
    };
}

function findLesionForMarginSuggest(id) {
    if (!id) return null;
    if (typeof findLesionRecordById === 'function') return findLesionRecordById(id);
    if (typeof findLesionForExcisionProcedure === 'function') return findLesionForExcisionProcedure(id);
    return null;
}

function marginSuggestFieldSpec(fieldId) {
    return {
        assignExcisionMargin: {
            locationId: 'assignExcisionLocation',
            diagnosisId: 'assignExcisionDiagnosis',
            lesionId: () => document.getElementById('assignExcisionLesionId')?.value
                || document.getElementById('assignExcisionLesionSelect')?.value,
            priorId: () => document.getElementById('assignExcisionPriorLesionId')?.value,
            kind: 'excision',
            lengthId: '',
            widthId: ''
        },
        exMargin: {
            locationId: 'exLesionLocation',
            diagnosisId: 'exProvisionalDiagnoses',
            lesionId: () => (typeof procedureSession !== 'undefined' ? procedureSession.detailLesionId : ''),
            kind: 'excision',
            lengthId: 'exLesionLength',
            widthId: 'exLesionWidth'
        },
        excisionMargin: {
            locationId: 'lesionLocation',
            diagnosisFn: () => (typeof readExamImpression === 'function' ? readExamImpression() : ''),
            lesionId: () => document.getElementById('editLesionId')?.value,
            kind: 'excision'
        },
        examLesionMargin: {
            locationId: 'lesionLocation',
            diagnosisFn: () => (typeof readExamImpression === 'function' ? readExamImpression() : ''),
            lesionId: () => document.getElementById('editLesionId')?.value,
            kind: 'shave',
            lengthId: 'examLesionLength',
            widthId: 'examLesionWidth'
        },
        addConsentMargin: {
            locationId: 'addConsentLoc',
            diagnosisId: 'addConsentDx',
            kindFn: () => document.getElementById('addConsentKind')?.value || 'excision'
        }
    }[fieldId] || null;
}

function readMarginSuggestContext(fieldId) {
    const spec = marginSuggestFieldSpec(fieldId) || {};
    const lesionId = spec.lesionId ? spec.lesionId() : '';
    const lesion = findLesionForMarginSuggest(lesionId);
    const priorId = spec.priorId ? spec.priorId() : (lesion?.priorLesionId || '');
    const prior = findLesionForMarginSuggest(priorId);
    const location = document.getElementById(spec.locationId)?.value
        || lesion?.location
        || prior?.location
        || '';
    const diagnosis = spec.diagnosisFn
        ? spec.diagnosisFn()
        : ((typeof readDiagnosisTypeahead === 'function' && spec.diagnosisId
            ? readDiagnosisTypeahead(spec.diagnosisId)
            : '')
            || document.getElementById(spec.diagnosisId)?.value
            || lesion?.impression
            || lesion?.procedureDetail?.pathology
            || prior?.impression
            || '');
    const kind = spec.kindFn ? spec.kindFn() : (spec.kind || 'excision');
    const lengthMm = spec.lengthId ? parseFloat(document.getElementById(spec.lengthId)?.value) : parseFloat(lesion?.length || lesion?.excisionLengthMm);
    const widthMm = spec.widthId ? parseFloat(document.getElementById(spec.widthId)?.value) : parseFloat(lesion?.width || lesion?.excisionWidthMm);
    const isReexcision = !!(priorId || lesion?.priorLesionId);
    return {
        fieldId,
        lesion,
        prior,
        location,
        diagnosis,
        kind,
        isReexcision,
        histologyText: collectMarginHistologyText(lesion, prior),
        lengthMm: Number.isFinite(lengthMm) ? lengthMm : 0,
        widthMm: Number.isFinite(widthMm) ? widthMm : 0,
        immuno: !!document.getElementById('heaImmuno')?.checked
    };
}

function readMarginSuggestForm() {
    const intent = document.querySelector('input[name="marginSuggestIntent"]:checked')?.value || 'kc';
    return {
        diagnosis: (typeof readDiagnosisTypeahead === 'function'
            ? readDiagnosisTypeahead('marginSuggestDiagnosis')
            : (document.getElementById('marginSuggestDiagnosis')?.value.trim() || '')) || '',
        location: document.getElementById('marginSuggestLocation')?.value.trim() || '',
        intent,
        breslowBand: document.getElementById('marginSuggestBreslow')?.value || 'unknown',
        flags: {
            illDefined: !!document.getElementById('marginFlagIllDefined')?.checked,
            recurrent: !!document.getElementById('marginFlagRecurrent')?.checked,
            aggressive: !!document.getElementById('marginFlagAggressive')?.checked,
            immuno: !!document.getElementById('marginFlagImmuno')?.checked,
            large: !!document.getElementById('marginFlagLarge')?.checked
        },
        histologyText: document.getElementById('marginSuggestHisto')?.value.trim() || ''
    };
}

function currentMarginSuggestion() {
    const form = readMarginSuggestForm();
    const site = classifyMarginSite(form.location);
    return suggestClinicalMargin({
        diagnosis: form.diagnosis,
        location: form.location,
        site,
        intent: form.intent,
        breslowBand: form.breslowBand,
        flags: form.flags,
        histologyText: form.histologyText,
        family: marginDiagnosisFamily(form.diagnosis)
    });
}

function setMarginSuggestIntent(intent) {
    const radios = document.querySelectorAll('input[name="marginSuggestIntent"]');
    radios.forEach((el) => {
        el.checked = el.value === intent;
    });
    const wle = intent === 'melanoma_wle';
    document.getElementById('marginSuggestBreslowWrap')?.classList.toggle('hidden', !wle);
    document.getElementById('marginSuggestFlagsWrap')?.classList.toggle('hidden', intent !== 'kc');
}

function paintMarginSuggestPreview() {
    const suggestion = currentMarginSuggestion();
    const valueEl = document.getElementById('marginSuggestValue');
    const rangeEl = document.getElementById('marginSuggestRange');
    const reasonEl = document.getElementById('marginSuggestReason');
    const sourceEl = document.getElementById('marginSuggestSource');
    const siteEl = document.getElementById('marginSuggestSiteNote');
    const cautionEl = document.getElementById('marginSuggestCaution');
    const chipsEl = document.getElementById('marginSuggestChips');
    const chosenEl = document.getElementById('marginSuggestChosen');
    const useBtn = document.getElementById('marginSuggestUseBtn');

    if (valueEl) valueEl.textContent = suggestion.mm ? suggestion.mm : '—';
    if (rangeEl) rangeEl.textContent = suggestion.rangeLabel || '';
    if (reasonEl) reasonEl.textContent = suggestion.reason || '';
    if (sourceEl) sourceEl.textContent = suggestion.source || '';
    if (siteEl) siteEl.textContent = suggestion.siteRisk?.note || '';

    if (cautionEl) {
        const notes = (suggestion.caution || []).filter(Boolean);
        cautionEl.classList.toggle('hidden', !notes.length);
        cautionEl.innerHTML = notes.map((line) => '<p>' + escapeHtml(line) + '</p>').join('');
    }

    if (chipsEl) {
        const chosen = readMmInputValue('marginSuggestChosen') || suggestion.mm;
        chipsEl.innerHTML = (suggestion.alternatives || []).map((alt) => {
            const active = String(alt.mm) === String(chosen) ? ' is-active' : '';
            return '<button type="button" class="margin-chip' + active + '" onclick="applyMarginSuggestChip(\'' + escapeHtml(alt.mm) + '\')">'
                + escapeHtml(alt.label) + '</button>';
        }).join('');
    }

    if (chosenEl && document.activeElement !== chosenEl) {
        if (suggestion.mm && !chosenEl.value) chosenEl.value = suggestion.mm;
        else if (suggestion.mm && parseMarginMm(chosenEl.value) === parseMarginMm(suggestion.mm)) {
            chosenEl.value = suggestion.mm;
        }
    }
    if (useBtn) useBtn.disabled = !(readMmInputValue('marginSuggestChosen') || suggestion.mm);
}

function applyMarginSuggestChip(mm) {
    setMmInputValue('marginSuggestChosen', mm);
    paintMarginSuggestPreview();
}

function onMarginSuggestFormChange() {
    const intent = document.querySelector('input[name="marginSuggestIntent"]:checked')?.value || 'kc';
    document.getElementById('marginSuggestBreslowWrap')?.classList.toggle('hidden', intent !== 'melanoma_wle');
    document.getElementById('marginSuggestFlagsWrap')?.classList.toggle('hidden', intent !== 'kc');
    const chosen = document.getElementById('marginSuggestChosen');
    if (chosen) chosen.value = '';
    paintMarginSuggestPreview();
}

function openMarginSuggestModal(fieldId) {
    const spec = marginSuggestFieldSpec(fieldId);
    if (!spec) return;
    marginSuggestTargetId = fieldId;
    const ctx = readMarginSuggestContext(fieldId);
    const family = marginDiagnosisFamily(ctx.diagnosis);
    const intent = inferMarginIntent({ ...ctx, family });
    const site = classifyMarginSite(ctx.location);
    const maxDim = Math.max(ctx.lengthMm || 0, ctx.widthMm || 0);

    const dxEl = document.getElementById('marginSuggestDiagnosis');
    const locEl = document.getElementById('marginSuggestLocation');
    const histoEl = document.getElementById('marginSuggestHisto');
    if (typeof setDiagnosisTypeahead === 'function') {
        setDiagnosisTypeahead('marginSuggestDiagnosis', ctx.diagnosis || '');
    } else if (dxEl) {
        dxEl.value = ctx.diagnosis || '';
    }
    if (locEl) locEl.value = ctx.location || '';
    if (histoEl) histoEl.value = ctx.histologyText || '';

    setMarginSuggestIntent(intent);
    const breslow = inferBreslowBand(ctx.histologyText, family);
    const bEl = document.getElementById('marginSuggestBreslow');
    if (bEl) bEl.value = breslow || 'unknown';

    const ill = document.getElementById('marginFlagIllDefined');
    const rec = document.getElementById('marginFlagRecurrent');
    const agg = document.getElementById('marginFlagAggressive');
    const immuno = document.getElementById('marginFlagImmuno');
    const large = document.getElementById('marginFlagLarge');
    const aggressive = typeof diagnosisIsAggressiveSubtype === 'function' && diagnosisIsAggressiveSubtype(ctx.diagnosis);
    if (ill) ill.checked = false;
    if (rec) rec.checked = !!ctx.isReexcision;
    if (agg) agg.checked = !!aggressive;
    if (immuno) immuno.checked = !!ctx.immuno;
    if (large) large.checked = maxDim >= 20;

    const existing = readMmInputValue(fieldId);
    const suggestion = suggestClinicalMargin({
        diagnosis: ctx.diagnosis,
        location: ctx.location,
        site,
        intent,
        breslowBand: breslow,
        flags: {
            illDefined: false,
            recurrent: !!ctx.isReexcision,
            aggressive: !!aggressive,
            immuno: !!ctx.immuno,
            large: maxDim >= 20
        },
        histologyText: ctx.histologyText,
        family
    });
    setMmInputValue('marginSuggestChosen', existing || suggestion.mm || '');
    paintMarginSuggestPreview();

    const modal = document.getElementById('marginSuggestModal');
    if (modal) modal.classList.remove('hidden');
    document.getElementById('marginSuggestChosen')?.focus();
}

function closeMarginSuggestModal() {
    const modal = document.getElementById('marginSuggestModal');
    if (modal) modal.classList.add('hidden');
    marginSuggestTargetId = '';
}

function useMarginSuggestion() {
    const targetId = marginSuggestTargetId;
    if (!targetId) return;
    const suggestion = currentMarginSuggestion();
    const chosen = readMmInputValue('marginSuggestChosen') || suggestion.mm;
    if (!chosen) {
        if (typeof showToast === 'function') showToast('Enter a millimetre number, or pick a chip.');
        return;
    }
    setMmInputValue(targetId, chosen);
    lastMarginSuggestion = {
        targetId,
        mm: chosen,
        suggestedMm: suggestion.mm || chosen,
        reason: suggestion.reason || '',
        source: suggestion.source || '',
        intent: suggestion.intent,
        family: suggestion.family
    };
    const target = document.getElementById(targetId);
    if (target) {
        target.dispatchEvent(new Event('input', { bubbles: true }));
        target.dispatchEvent(new Event('change', { bubbles: true }));
        if (typeof validateExForm === 'function' && targetId === 'exMargin') validateExForm();
    }
    closeMarginSuggestModal();
    if (typeof showToast === 'function') showToast('Margin set to ' + formatMarginDisplay(chosen) + '. You can still edit the number.');
}

function suggestionMetaIfMatches(fieldId) {
    if (!lastMarginSuggestion || lastMarginSuggestion.targetId !== fieldId) return null;
    return lastMarginSuggestion;
}
