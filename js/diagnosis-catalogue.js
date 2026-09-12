/* Searchable diagnosis catalogue for provisional diagnosis and structured histology.
   Parent `family` is the existing DermRecord code (BCC, SCC, MMis…). Subtype is `code`. */

const DIAGNOSIS_CATALOGUE = [
    { code: 'BCC', family: 'BCC', label: 'BCC', aliases: ['basal', 'basal cell carcinoma'], everyday: true, risk: 'low', billing: 'malignant' },
    { code: 'BCC-nod', family: 'BCC', label: 'BCC, nodular', aliases: ['nodular', 'nbcc', 'nodulocystic'], everyday: true, risk: 'low', billing: 'malignant' },
    { code: 'BCC-sup', family: 'BCC', label: 'BCC, superficial', aliases: ['superficial', 'sbcc', 'multicentric'], everyday: true, risk: 'low', billing: 'malignant' },
    { code: 'BCC-pig', family: 'BCC', label: 'BCC, pigmented', aliases: ['pigmented bcc'], everyday: true, risk: 'low', billing: 'malignant' },
    { code: 'BCC-inf', family: 'BCC', label: 'BCC, infiltrative', aliases: ['infiltrative', 'infiltrating'], everyday: true, risk: 'high', billing: 'malignant' },
    { code: 'BCC-mor', family: 'BCC', label: 'BCC, morphoeic / sclerosing', aliases: ['morphoeic', 'morpheic', 'morpheaform', 'sclerosing', 'fibrosing'], everyday: true, risk: 'high', billing: 'malignant' },
    { code: 'BCC-mic', family: 'BCC', label: 'BCC, micronodular', aliases: ['micronodular'], everyday: true, risk: 'high', billing: 'malignant' },
    { code: 'BCC-bsq', family: 'BCC', label: 'BCC, basosquamous', aliases: ['basosquamous', 'metatypical'], everyday: true, risk: 'high', billing: 'malignant' },
    { code: 'BCC-mix', family: 'BCC', label: 'BCC, mixed subtype', aliases: ['mixed bcc', 'nodular and infiltrative'], everyday: true, risk: 'high', billing: 'malignant' },
    { code: 'BCC-rec', family: 'BCC', label: 'BCC, recurrent / incomplete', aliases: ['recurrent bcc', 'residual bcc', 'incomplete bcc'], everyday: true, risk: 'high', billing: 'malignant' },
    { code: 'BCC-fep', family: 'BCC', label: 'Fibroepithelial BCC (Pinkus)', aliases: ['pinkus', 'fibroepithelioma'], risk: 'low', billing: 'malignant' },
    { code: 'BCC-adn', family: 'BCC', label: 'BCC with adnexal differentiation', aliases: ['infundibulocystic'], risk: 'low', billing: 'malignant' },
    { code: 'BCC-src', family: 'BCC', label: 'BCC, sarcomatoid', aliases: ['sarcomatoid bcc'], risk: 'high', billing: 'malignant' },
    { code: '?BCC', family: 'BCC', label: '?BCC', aliases: ['possible bcc', 'probable bcc'], everyday: true, risk: 'low', billing: 'malignant' },

    { code: 'SCC', family: 'SCC', label: 'SCC', aliases: ['squamous', 'squamous cell carcinoma'], everyday: true, risk: 'low', billing: 'malignant' },
    { code: 'SCC-wd', family: 'SCC', label: 'SCC, well differentiated', aliases: ['wd scc', 'well differentiated'], everyday: true, risk: 'low', billing: 'malignant' },
    { code: 'SCC-md', family: 'SCC', label: 'SCC, moderately differentiated', aliases: ['md scc', 'moderately differentiated'], everyday: true, risk: 'low', billing: 'malignant' },
    { code: 'SCC-pd', family: 'SCC', label: 'SCC, poorly differentiated', aliases: ['pd scc', 'poorly differentiated', 'undifferentiated scc'], everyday: true, risk: 'high', billing: 'malignant' },
    { code: 'SCC-aka', family: 'SCC', label: 'SCC, KA-type', aliases: ['ka-like', 'ka type', 'crateriform scc'], risk: 'low', billing: 'malignant' },
    { code: 'SCC-aca', family: 'SCC', label: 'SCC, acantholytic', aliases: ['acantholytic', 'adenoid scc', 'pseudoglandular'], risk: 'high', billing: 'malignant' },
    { code: 'SCC-des', family: 'SCC', label: 'SCC, desmoplastic', aliases: ['desmoplastic scc', 'fibrosing scc'], risk: 'high', billing: 'malignant' },
    { code: 'SCC-spi', family: 'SCC', label: 'SCC, spindle / sarcomatoid', aliases: ['spindle scc', 'sarcomatoid scc'], risk: 'high', billing: 'malignant' },
    { code: 'SCC-ver', family: 'SCC', label: 'SCC, verrucous', aliases: ['verrucous', 'ackerman'], risk: 'low', billing: 'malignant' },
    { code: 'SCC-clr', family: 'SCC', label: 'SCC, clear cell', aliases: ['clear cell squamous'], risk: 'low', billing: 'malignant' },
    { code: 'SCC-ads', family: 'SCC', label: 'SCC, adenosquamous', aliases: ['adenosquamous'], risk: 'high', billing: 'malignant' },
    { code: 'SCC-rec', family: 'SCC', label: 'SCC, recurrent', aliases: ['recurrent scc', 'residual scc'], everyday: true, risk: 'high', billing: 'malignant' },
    { code: '?SCC', family: 'SCC', label: '?SCC', aliases: ['possible scc', 'probable scc'], everyday: true, risk: 'low', billing: 'malignant' },
    { code: 'KA', family: 'KA', label: 'Keratoacanthoma', aliases: ['ka', 'keratoacanthoma'], everyday: true, risk: 'low', billing: 'malignant' },
    { code: 'IEC', family: 'IEC', label: 'IEC / Bowen / SCC in situ', aliases: ['iec', 'bowen', 'bowen\'s', 'sccis', 'scc in situ', 'intraepidermal'], everyday: true, risk: 'low', billing: 'malignant' },

    { code: 'MMis', family: 'MMis', label: 'Melanoma in situ', aliases: ['mis', 'mmis', 'melanoma in situ'], everyday: true, risk: 'diagnostic', billing: 'melanoma' },
    { code: 'HMF', family: 'HMF', label: 'Lentigo maligna / HMF', aliases: ['lm', 'hmf', 'hutchinson', 'lentigo maligna', 'melanotic freckle'], everyday: true, risk: 'diagnostic', billing: 'melanoma' },
    { code: 'MM-lmm', family: 'MMinv', label: 'Lentigo maligna melanoma', aliases: ['lmm'], risk: 'diagnostic', billing: 'melanoma' },
    { code: 'MMinv', family: 'MMinv', label: 'Melanoma, invasive', aliases: ['mm', 'melanoma', 'invasive melanoma'], everyday: true, risk: 'diagnostic', billing: 'melanoma' },
    { code: 'MM-ssm', family: 'MMinv', label: 'Melanoma, superficial spreading', aliases: ['ssm', 'low-csd'], risk: 'diagnostic', billing: 'melanoma' },
    { code: 'MM-nod', family: 'MMinv', label: 'Melanoma, nodular', aliases: ['nm', 'nodular melanoma'], risk: 'diagnostic', billing: 'melanoma' },
    { code: 'MM-alm', family: 'MMinv', label: 'Melanoma, acral lentiginous', aliases: ['alm', 'acral'], risk: 'diagnostic', billing: 'melanoma' },
    { code: 'MM-des', family: 'MMinv', label: 'Melanoma, desmoplastic', aliases: ['dm', 'desmoplastic melanoma'], risk: 'specialist', billing: 'melanoma' },
    { code: 'MM-nv', family: 'MMinv', label: 'Melanoma, naevoid', aliases: ['naevoid mm', 'nevoid melanoma'], risk: 'diagnostic', billing: 'melanoma' },
    { code: 'MM-spitz', family: 'MMinv', label: 'Spitz melanoma', aliases: ['malignant spitz'], risk: 'specialist', billing: 'melanoma' },
    { code: 'MMmet', family: 'MMmet', label: 'Melanoma, metastasis', aliases: ['in-transit', 'satellitosis', 'mmmet'], everyday: true, risk: 'specialist', billing: 'melanoma' },
    { code: '?MM', family: 'MMinv', label: '?Melanoma / atypical pigmented', aliases: ['apl', 'atypical pigmented', 'possible melanoma', '?melanoma'], everyday: true, risk: 'diagnostic', billing: 'melanoma' },

    { code: 'BN', family: 'BN', label: 'Naevus, banal', aliases: ['mn', 'melanocytic naevus', 'ordinary naevus', 'nevus'], everyday: true, risk: 'none', billing: 'benign' },
    { code: 'BN-j', family: 'BN', label: 'Junctional naevus', aliases: ['jn', 'junctional'], risk: 'none', billing: 'benign' },
    { code: 'BN-c', family: 'BN', label: 'Compound naevus', aliases: ['cn', 'compound'], risk: 'none', billing: 'benign' },
    { code: 'BN-d', family: 'BN', label: 'Intradermal naevus', aliases: ['idn', 'dermal naevus'], risk: 'none', billing: 'benign' },
    { code: 'DN', family: 'DN', label: 'Dysplastic / atypical naevus', aliases: ['clark', 'atypical naevus', 'dysplastic'], everyday: true, risk: 'diagnostic', billing: 'benign' },
    { code: 'DN-mi', family: 'DN', label: 'DN, mild dysplasia', aliases: ['mild dysplasia'], risk: 'diagnostic', billing: 'benign' },
    { code: 'DN-mo', family: 'DN', label: 'DN, moderate dysplasia', aliases: ['moderate dysplasia'], risk: 'diagnostic', billing: 'benign' },
    { code: 'DN-se', family: 'DN', label: 'DN, severe dysplasia', aliases: ['severe dysplasia'], risk: 'diagnostic', billing: 'benign' },
    { code: 'SN', family: 'SN', label: 'Spitz naevus', aliases: ['spitz'], everyday: true, risk: 'diagnostic', billing: 'benign' },
    { code: 'SN-at', family: 'SN', label: 'Atypical Spitz tumour', aliases: ['ast', 'spitz melanocytoma'], risk: 'diagnostic', billing: 'benign' },
    { code: 'BN-bl', family: 'BN', label: 'Blue naevus', aliases: ['blue nevus', 'cellular blue'], risk: 'none', billing: 'benign' },
    { code: 'BN-con', family: 'BN', label: 'Congenital naevus', aliases: ['cmn', 'congenital melanocytic'], risk: 'none', billing: 'benign' },
    { code: 'Reed', family: 'BN', label: 'Reed naevus', aliases: ['pigmented spindle cell naevus'], risk: 'none', billing: 'benign' },

    { code: 'SK', family: 'SK', label: 'Solar / actinic keratosis', aliases: ['ak', 'actinic', 'solar keratosis'], everyday: true, risk: 'none', billing: 'benign' },
    { code: 'SK-h', family: 'SK', label: 'AK, hypertrophic', aliases: ['hypertrophic ak', 'cutaneous horn'], risk: 'none', billing: 'benign' },
    { code: 'SK-p', family: 'SK', label: 'AK, pigmented', aliases: ['pigmented ak'], risk: 'none', billing: 'benign' },
    { code: 'SebK', family: 'SebK', label: 'Seborrhoeic keratosis', aliases: ['seborrheic', 'seborrhoeic', 'isk', 'bark', 'irritated sebk'], everyday: true, risk: 'none', billing: 'benign' },
    { code: 'LPLK', family: 'LPLK', label: 'Lichen planus-like keratosis', aliases: ['lichenoid keratosis', 'lplk'], everyday: true, risk: 'none', billing: 'benign' },
    { code: 'SL', family: 'SL', label: 'Solar lentigo', aliases: ['lentigo', 'ink-spot'], everyday: true, risk: 'none', billing: 'benign' },

    { code: 'DF', family: 'DF', label: 'Dermatofibroma', aliases: ['histiocytoma', 'fhi'], everyday: true, risk: 'none', billing: 'benign' },
    { code: 'B Cyst', family: 'B Cyst', label: 'Epidermoid / trichilemmal cyst', aliases: ['cyst', 'sebaceous cyst', 'wen'], everyday: true, risk: 'none', billing: 'benign' },
    { code: 'SGH', family: 'SGH', label: 'Sebaceous hyperplasia', aliases: ['seb hyper', 'sgh'], everyday: true, risk: 'none', billing: 'benign' },
    { code: 'PG', family: 'OB', label: 'Pyogenic granuloma', aliases: ['pg', 'lobular capillary haemangioma'], everyday: true, risk: 'none', billing: 'benign' },
    { code: 'FEP', family: 'OB', label: 'Skin tag', aliases: ['fibroepithelial polyp', 'acrochordon'], risk: 'none', billing: 'benign' },
    { code: 'Wart', family: 'OB', label: 'Viral wart', aliases: ['verruca', 'hpv', 'wart'], risk: 'none', billing: 'benign' },
    { code: 'CNH', family: 'OB', label: 'Chondrodermatitis nodularis helicis', aliases: ['cnh'], risk: 'none', billing: 'benign' },
    { code: 'Ang', family: 'OB', label: 'Cherry angioma', aliases: ['haemangioma', 'campbell de morgan'], risk: 'none', billing: 'benign' },

    { code: 'MCC', family: 'MCC', label: 'Merkel cell carcinoma', aliases: ['mcc', 'merkel'], everyday: true, risk: 'specialist', billing: 'malignant' },
    { code: 'AFX', family: 'OM', label: 'Atypical fibroxanthoma', aliases: ['afx'], everyday: true, risk: 'specialist', billing: 'malignant' },
    { code: 'PDS', family: 'OM', label: 'Pleomorphic dermal sarcoma', aliases: ['pds'], risk: 'specialist', billing: 'malignant' },
    { code: 'DFSP', family: 'OM', label: 'Dermatofibrosarcoma protuberans', aliases: ['dfsp'], risk: 'specialist', billing: 'malignant' },
    { code: 'SebCa', family: 'OM', label: 'Sebaceous carcinoma', aliases: ['sebaceous ca'], risk: 'specialist', billing: 'malignant' },
    { code: 'MAC', family: 'OM', label: 'Microcystic adnexal carcinoma', aliases: ['mac'], risk: 'specialist', billing: 'malignant' },
    { code: 'EMPD', family: 'OM', label: 'Extramammary Paget disease', aliases: ['empd', 'paget'], risk: 'specialist', billing: 'malignant' },
    { code: 'AngS', family: 'OM', label: 'Angiosarcoma', aliases: ['angiosarcoma'], risk: 'specialist', billing: 'malignant' },
    { code: 'PorCa', family: 'OM', label: 'Porocarcinoma', aliases: ['porocarcinoma'], risk: 'specialist', billing: 'malignant' },
    { code: 'OB', family: 'OB', label: 'Other benign', aliases: ['other benign'], risk: 'none', billing: 'benign' },
    { code: 'OM', family: 'OM', label: 'Other malignant', aliases: ['other malignant'], risk: 'specialist', billing: 'malignant' }
];

const DIAGNOSIS_BY_CODE = {};
const DIAGNOSIS_EXACT_LOOKUP = new Map();

function indexDiagnosisCatalogue() {
    DIAGNOSIS_CATALOGUE.forEach((entry) => {
        DIAGNOSIS_BY_CODE[entry.code] = entry;
        if (typeof exPathologyOptions !== 'undefined' && !exPathologyOptions[entry.code]) {
            exPathologyOptions[entry.code] = entry.label;
        }
        const keys = [entry.code, entry.label].concat(entry.aliases || []);
        keys.forEach((key) => {
            const norm = normalizeDiagnosisQuery(key);
            if (norm && !DIAGNOSIS_EXACT_LOOKUP.has(norm)) DIAGNOSIS_EXACT_LOOKUP.set(norm, entry);
        });
    });
}

function normalizeDiagnosisQuery(text) {
    return String(text || '')
        .trim()
        .toLowerCase()
        .replace(/[’']/g, "'")
        .replace(/[.,/()+]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function startsAsWord(hay, q) {
    if (!hay.startsWith(q)) return false;
    if (hay.length === q.length) return true;
    const next = hay.charAt(q.length);
    if (next === ' ' || next === '-' || next === '/') return true;
    return q.length >= 3;
}

function scoreDiagnosisMatch(entry, q) {
    const code = entry.code.toLowerCase();
    const family = String(entry.family).toLowerCase();
    const label = normalizeDiagnosisQuery(entry.label);
    const aliases = (entry.aliases || []).map((alias) => normalizeDiagnosisQuery(alias));
    if (code === q) return 1000;
    if (label === q) return 980;
    if (aliases.includes(q)) return 940;
    if (family === q && entry.code === entry.family) return 920;
    if (family === q) return 720;
    if (startsAsWord(code, q)) return 820;
    if (startsAsWord(label, q)) return 780;
    if (aliases.some((alias) => startsAsWord(alias, q))) return 760;
    const tokens = q.split(' ').filter(Boolean);
    if (tokens.length > 1) {
        const hay = [code, family, label].concat(aliases).join(' ');
        if (tokens.every((token) => hay.includes(token))) return 680 + (entry.everyday ? 25 : 0);
    }
    if (q.length >= 3) {
        if (label.includes(q)) return 520;
        if (aliases.some((alias) => alias.includes(q))) return 500;
        if (code.includes(q)) return 420;
    }
    return 0;
}

function searchDiagnoses(query, options) {
    const exclude = new Set(options?.exclude || []);
    const q = normalizeDiagnosisQuery(query);
    const pool = DIAGNOSIS_CATALOGUE.filter((entry) => !exclude.has(entry.code));
    if (!q) {
        const everyday = pool.filter((entry) => entry.everyday);
        const seen = new Set();
        const mixed = [];
        everyday.forEach((entry) => {
            if (!seen.has(entry.family)) {
                seen.add(entry.family);
                mixed.push(entry);
            }
        });
        everyday.forEach((entry) => {
            if (!mixed.includes(entry)) mixed.push(entry);
        });
        return mixed.slice(0, 14);
    }
    const scored = [];
    pool.forEach((entry) => {
        const score = scoreDiagnosisMatch(entry, q);
        if (score > 0) scored.push({ entry, score });
    });
    scored.sort((a, b) => b.score - a.score
        || Number(!!b.entry.everyday) - Number(!!a.entry.everyday)
        || a.entry.label.localeCompare(b.entry.label));
    return scored.slice(0, 14).map((row) => row.entry);
}

function findDiagnosisEntry(text) {
    const t = String(text || '').trim();
    if (!t) return null;
    if (DIAGNOSIS_BY_CODE[t]) return DIAGNOSIS_BY_CODE[t];
    const norm = normalizeDiagnosisQuery(t);
    if (DIAGNOSIS_EXACT_LOOKUP.has(norm)) return DIAGNOSIS_EXACT_LOOKUP.get(norm);
    if (typeof DIAGNOSIS_ALIASES !== 'undefined' && DIAGNOSIS_ALIASES[t]) {
        return DIAGNOSIS_BY_CODE[DIAGNOSIS_ALIASES[t]] || null;
    }
    return null;
}

function resolveDiagnosis(text) {
    const t = String(text || '').trim();
    if (!t) return { code: '', family: '', label: '', custom: true, entry: null };
    const entry = findDiagnosisEntry(t);
    if (entry) return { code: entry.code, family: entry.family, label: entry.label, custom: false, entry };
    return { code: t, family: '', label: t, custom: true, entry: null };
}

function diagnosisFamilyFromText(text) {
    const resolved = resolveDiagnosis(text);
    if (resolved.family) return resolved.family;
    if (typeof exPathologyOptions !== 'undefined' && exPathologyOptions[String(text || '').trim()]) {
        return String(text).trim();
    }
    return '';
}

function diagnosisIsAggressiveSubtype(text) {
    const parts = String(text || '').split(';');
    return parts.some((part) => resolveDiagnosis(part).entry?.risk === 'high');
}

function splitDiagnosisParts(raw) {
    return String(raw || '').split(';').map((part) => part.trim()).filter(Boolean);
}

function joinDiagnosisParts(parts) {
    return (parts || []).map((part) => String(part || '').trim()).filter(Boolean).join(';');
}

const _diagnosisCodeFromTextOriginal = window.diagnosisCodeFromText;
const _formatDiagnosisIemrOriginal = window.formatDiagnosisIemr;
const _normalizePathologyOriginal = window.normalizePathologyString;

function diagnosisFamilyRank(family) {
    const f = String(family || '');
    if (/^(MMis|HMF|MMinv|MMmet)$/i.test(f)) return 3;
    if (/^(BCC|SCC|IEC|KA|MCC|OM)$/i.test(f)) return 2;
    return f ? 1 : 0;
}

window.diagnosisCodeFromText = function diagnosisCodeFromText(text) {
    const parts = splitDiagnosisParts(text);
    const families = (parts.length ? parts : [String(text || '').trim()]).map((part) => {
        if (!part) return '';
        const resolved = resolveDiagnosis(part);
        if (!resolved.custom && resolved.family) return resolved.family;
        if (typeof _diagnosisCodeFromTextOriginal === 'function') return _diagnosisCodeFromTextOriginal(part);
        return '';
    }).filter(Boolean);
    families.sort((a, b) => diagnosisFamilyRank(b) - diagnosisFamilyRank(a));
    return families[0] || '';
};

window.normalizePathologyString = function normalizePathologyString(raw) {
    return splitDiagnosisParts(raw).map((part) => {
        const resolved = resolveDiagnosis(part);
        if (!resolved.custom && resolved.code) return resolved.code;
        if (typeof _diagnosisCodeFromTextOriginal === 'function') {
            return _diagnosisCodeFromTextOriginal(part) || part;
        }
        return part;
    }).filter(Boolean).join(';');
};

window.formatDiagnosisDisplay = function formatDiagnosisDisplay(raw) {
    return splitDiagnosisParts(raw).map((part) => {
        const resolved = resolveDiagnosis(part);
        if (!resolved.custom && resolved.label) {
            if (resolved.code === resolved.family && typeof exPathologyOptions !== 'undefined' && exPathologyOptions[resolved.family]
                && resolved.label === resolved.family) {
                return resolved.family + ' (' + exPathologyOptions[resolved.family] + ')';
            }
            return resolved.label;
        }
        if (typeof exPathologyOptions !== 'undefined' && exPathologyOptions[part]) {
            return part + ' (' + exPathologyOptions[part] + ')';
        }
        return part;
    }).join(', ');
};

window.formatDiagnosisIemr = function formatDiagnosisIemr(raw) {
    return splitDiagnosisParts(raw).map((part) => {
        const resolved = resolveDiagnosis(part);
        if (!resolved.custom && resolved.code) return resolved.code;
        if (typeof _formatDiagnosisIemrOriginal === 'function') {
            const fallback = _formatDiagnosisIemrOriginal(part);
            if (fallback) return fallback;
        }
        const family = window.diagnosisCodeFromText(part);
        return family || part;
    }).join('; ');
};

function diagnosisBillingBucket(text) {
    const parts = splitDiagnosisParts(text);
    let bucket = '';
    parts.forEach((part) => {
        const entry = resolveDiagnosis(part).entry;
        const next = entry?.billing || '';
        if (next === 'melanoma') bucket = 'melanoma';
        else if (next === 'malignant' && bucket !== 'melanoma') bucket = 'malignant';
        else if (next === 'benign' && !bucket) bucket = 'benign';
    });
    return bucket;
}

const dxTypeaheadRegistry = {};

function dxSuggestEl(input) {
    const wrap = input?.closest('.dx-typeahead');
    return wrap?.querySelector('.dx-suggest') || null;
}

function hideDxSuggest(input) {
    const list = dxSuggestEl(input);
    if (list) {
        list.classList.add('hidden');
        list.innerHTML = '';
    }
    const state = dxTypeaheadRegistry[input?.id];
    if (state) state.activeIndex = -1;
}

function positionDxSuggest(input, list) {
    const rect = input.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const maxH = 260;
    list.style.position = 'fixed';
    list.style.left = Math.max(8, rect.left) + 'px';
    list.style.width = Math.max(rect.width, 220) + 'px';
    list.style.zIndex = '96';
    if (spaceBelow < 140 && rect.top > spaceBelow) {
        list.style.top = 'auto';
        list.style.bottom = (window.innerHeight - rect.top + 4) + 'px';
        list.style.maxHeight = Math.min(maxH, rect.top - 12) + 'px';
    } else {
        list.style.bottom = 'auto';
        list.style.top = (rect.bottom + 4) + 'px';
        list.style.maxHeight = Math.min(maxH, spaceBelow - 12) + 'px';
    }
}

function renderDxChips(state) {
    if (!state.multi || !state.chipsEl) return;
    const parts = splitDiagnosisParts(state.hiddenEl?.value || '');
    state.chipsEl.innerHTML = parts.map((code, idx) => {
        const label = escapeHtml(formatDiagnosisDisplay(code) || code);
        return '<span class="dx-chip">' + label
            + '<button type="button" class="dx-chip-x" data-dx-remove="' + idx + '" aria-label="Remove">&times;</button></span>';
    }).join('');
}

function commitDiagnosisEntry(state, entry, customText) {
    if (state.multi) {
        const parts = splitDiagnosisParts(state.hiddenEl?.value || '');
        const next = entry ? entry.code : String(customText || '').trim();
        if (!next) return;
        if (!parts.includes(next)) parts.push(next);
        if (state.hiddenEl) state.hiddenEl.value = joinDiagnosisParts(parts);
        state.input.value = '';
        renderDxChips(state);
    } else {
        const code = entry ? entry.code : String(customText || '').trim();
        state.input.value = entry ? entry.label : code;
        state.input.dataset.dxCode = entry ? entry.code : code;
        if (state.hiddenEl) state.hiddenEl.value = code;
    }
    hideDxSuggest(state.input);
    if (typeof state.onChange === 'function') state.onChange(readDiagnosisTypeahead(state.input.id));
}

function paintDxSuggest(state, query) {
    const list = dxSuggestEl(state.input);
    if (!list) return;
    const exclude = state.multi ? splitDiagnosisParts(state.hiddenEl?.value || '') : [];
    const hits = searchDiagnoses(query, { exclude });
    if (!hits.length && !String(query || '').trim()) {
        hideDxSuggest(state.input);
        return;
    }
    const q = String(query || '').trim();
    const items = hits.map((entry, idx) => {
        const meta = entry.code === entry.family ? '' : entry.family;
        return '<button type="button" class="dx-suggest-item' + (idx === 0 ? ' is-active' : '') + '" data-dx-code="'
            + escapeHtml(entry.code) + '" role="option">'
            + '<span class="dx-suggest-label">' + escapeHtml(entry.label) + '</span>'
            + (meta ? '<span class="dx-suggest-meta">' + escapeHtml(meta) + '</span>' : '')
            + '</button>';
    });
    if (q && state.allowCustom && !findDiagnosisEntry(q)) {
        items.push('<button type="button" class="dx-suggest-item" data-dx-custom="1" role="option">'
            + '<span class="dx-suggest-label">Use “' + escapeHtml(q) + '”</span>'
            + '<span class="dx-suggest-meta">Custom</span></button>');
    }
    if (!items.length) {
        hideDxSuggest(state.input);
        return;
    }
    list.innerHTML = items.join('');
    list.classList.remove('hidden');
    positionDxSuggest(state.input, list);
    state.activeIndex = 0;
}

function dxSuggestButtons(state) {
    return [...(dxSuggestEl(state.input)?.querySelectorAll('.dx-suggest-item') || [])];
}

function moveDxActive(state, delta) {
    const buttons = dxSuggestButtons(state);
    if (!buttons.length) return;
    buttons.forEach((btn) => btn.classList.remove('is-active'));
    state.activeIndex = (state.activeIndex + delta + buttons.length) % buttons.length;
    buttons[state.activeIndex].classList.add('is-active');
    buttons[state.activeIndex].scrollIntoView({ block: 'nearest' });
}

function chooseDxActive(state) {
    const buttons = dxSuggestButtons(state);
    const btn = buttons[state.activeIndex] || buttons[0];
    if (!btn) {
        if (state.allowCustom && state.input.value.trim()) commitDiagnosisEntry(state, null, state.input.value.trim());
        return;
    }
    if (btn.dataset.dxCustom) {
        commitDiagnosisEntry(state, null, state.input.value.trim());
        return;
    }
    commitDiagnosisEntry(state, DIAGNOSIS_BY_CODE[btn.dataset.dxCode] || null, '');
}

function bindDiagnosisTypeahead(inputId, options) {
    const input = document.getElementById(inputId);
    if (!input || input.dataset.dxBound === '1') return;
    input.dataset.dxBound = '1';
    const wrap = input.closest('.dx-typeahead');
    const state = {
        input,
        multi: !!options?.multi,
        allowCustom: options?.allowCustom !== false,
        hiddenEl: options?.hiddenId ? document.getElementById(options.hiddenId) : null,
        chipsEl: wrap?.querySelector('.dx-chips') || null,
        onChange: options?.onChange || null,
        activeIndex: -1
    };
    dxTypeaheadRegistry[inputId] = state;
    input.setAttribute('autocomplete', 'off');
    input.setAttribute('role', 'combobox');
    input.setAttribute('aria-autocomplete', 'list');

    input.addEventListener('focus', () => paintDxSuggest(state, input.value));
    input.addEventListener('input', () => paintDxSuggest(state, input.value));
    input.addEventListener('keydown', (event) => {
        const list = dxSuggestEl(input);
        const open = list && !list.classList.contains('hidden');
        if (event.key === 'ArrowDown') {
            event.preventDefault();
            if (!open) paintDxSuggest(state, input.value);
            else moveDxActive(state, 1);
        } else if (event.key === 'ArrowUp') {
            event.preventDefault();
            if (open) moveDxActive(state, -1);
        } else if (event.key === 'Enter') {
            if (open) {
                event.preventDefault();
                chooseDxActive(state);
            } else if (state.multi && input.value.trim()) {
                event.preventDefault();
                const hit = searchDiagnoses(input.value)[0];
                const exact = findDiagnosisEntry(input.value.trim());
                commitDiagnosisEntry(state, exact || hit || null, input.value.trim());
            }
        } else if (event.key === 'Escape') {
            hideDxSuggest(input);
        } else if (event.key === 'Backspace' && state.multi && !input.value) {
            const parts = splitDiagnosisParts(state.hiddenEl?.value || '');
            if (parts.length) {
                parts.pop();
                if (state.hiddenEl) state.hiddenEl.value = joinDiagnosisParts(parts);
                renderDxChips(state);
                if (typeof state.onChange === 'function') state.onChange(readDiagnosisTypeahead(inputId));
            }
        }
    });
    input.addEventListener('blur', () => {
        window.setTimeout(() => {
            if (document.activeElement === input) return;
            if (state.multi) {
                const typed = input.value.trim();
                const exact = typed ? findDiagnosisEntry(typed) : null;
                if (exact) commitDiagnosisEntry(state, exact, '');
                hideDxSuggest(input);
                return;
            }
            const typed = input.value.trim();
            if (!typed) {
                input.dataset.dxCode = '';
                if (state.hiddenEl) state.hiddenEl.value = '';
                hideDxSuggest(input);
                return;
            }
            const exact = findDiagnosisEntry(typed) || findDiagnosisEntry(input.dataset.dxCode || '');
            if (exact) commitDiagnosisEntry(state, exact, '');
            else if (state.allowCustom) commitDiagnosisEntry(state, null, typed);
            hideDxSuggest(input);
        }, 140);
    });

    wrap?.addEventListener('mousedown', (event) => {
        const item = event.target.closest('.dx-suggest-item');
        if (item) {
            event.preventDefault();
            if (item.dataset.dxCustom) commitDiagnosisEntry(state, null, input.value.trim());
            else commitDiagnosisEntry(state, DIAGNOSIS_BY_CODE[item.dataset.dxCode] || null, '');
            return;
        }
        const remove = event.target.closest('[data-dx-remove]');
        if (remove) {
            event.preventDefault();
            const parts = splitDiagnosisParts(state.hiddenEl?.value || '');
            parts.splice(Number(remove.dataset.dxRemove), 1);
            if (state.hiddenEl) state.hiddenEl.value = joinDiagnosisParts(parts);
            renderDxChips(state);
            if (typeof state.onChange === 'function') state.onChange(readDiagnosisTypeahead(inputId));
        }
    });

    if (state.multi) renderDxChips(state);
}

function readDiagnosisTypeahead(inputId) {
    const state = dxTypeaheadRegistry[inputId];
    if (!state) {
        return document.getElementById(inputId)?.value.trim() || '';
    }
    if (state.multi) return state.hiddenEl?.value || '';
    const code = state.input.dataset.dxCode || '';
    const typed = state.input.value.trim();
    if (code && (findDiagnosisEntry(code)?.label === typed || code === typed)) return code;
    const exact = findDiagnosisEntry(typed);
    return exact ? exact.code : typed;
}

function setDiagnosisTypeahead(inputId, value) {
    const state = dxTypeaheadRegistry[inputId];
    const input = document.getElementById(inputId);
    if (!input) return;
    if (!state) {
        input.value = value || '';
        return;
    }
    if (state.multi) {
        const parts = splitDiagnosisParts(value).map((part) => {
            const resolved = resolveDiagnosis(part);
            return resolved.custom ? part : resolved.code;
        });
        if (state.hiddenEl) state.hiddenEl.value = joinDiagnosisParts(parts);
        input.value = '';
        renderDxChips(state);
        return;
    }
    const resolved = resolveDiagnosis(value);
    if (!resolved.custom && resolved.entry) {
        input.value = resolved.label;
        input.dataset.dxCode = resolved.code;
        if (state.hiddenEl) state.hiddenEl.value = resolved.code;
    } else {
        input.value = value || '';
        input.dataset.dxCode = value || '';
        if (state.hiddenEl) state.hiddenEl.value = value || '';
    }
}

function initDiagnosisTypeaheads() {
    indexDiagnosisCatalogue();
    bindDiagnosisTypeahead('lesionImpression', {
        onChange: () => {
            if (typeof handleExamDiagnosisChange === 'function') handleExamDiagnosisChange();
        }
    });
    bindDiagnosisTypeahead('assignExcisionDiagnosis', {});
    bindDiagnosisTypeahead('addConsentDx', {
        onChange: () => {
            if (typeof updateConsentRiskPreview === 'function') updateConsentRiskPreview();
        }
    });
    bindDiagnosisTypeahead('histologyDiagnosis', {
        onChange: () => {
            if (typeof syncHistologyBillingTypeFromResult === 'function') syncHistologyBillingTypeFromResult();
        }
    });
    bindDiagnosisTypeahead('exPathologySearch', {
        multi: true,
        hiddenId: 'exProvisionalDiagnoses',
        onChange: () => {
            if (typeof checkExFormCompleteness === 'function') checkExFormCompleteness();
        }
    });
    bindDiagnosisTypeahead('marginSuggestDiagnosis', {
        onChange: () => {
            if (typeof onMarginSuggestFormChange === 'function') onMarginSuggestFormChange();
        }
    });
    if (!window._dxSuggestRepositionBound) {
        window._dxSuggestRepositionBound = true;
        const hideAll = () => {
            Object.keys(dxTypeaheadRegistry).forEach((id) => hideDxSuggest(dxTypeaheadRegistry[id].input));
        };
        window.addEventListener('resize', hideAll);
        window.addEventListener('scroll', hideAll, true);
    }
}

indexDiagnosisCatalogue();
