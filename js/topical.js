/* Topical / field treatment (cryotherapy, Efudix, PDT) and saved PDT fee list */

const TOPICAL_TREATMENT_OPTIONS = [
    { id: 'cryotherapy', label: 'Cryotherapy' },
    { id: 'efudix', label: 'Efudix (5-fluorouracil)' },
    { id: 'efudix-calcipotriol', label: 'Efudix + Calcipotriol' },
    { id: 'aldara', label: 'Aldara (imiquimod)' },
    { id: 'pdt', label: 'Red Light PDT' }
];

const TOPICAL_DECISION_DECLINED = 'declined';
const PDT_PRICE_STORAGE_KEY = 'dermRecordPdtPrices';

const EFUDIX_DURATION_OPTIONS = [
    { value: '', label: 'Duration not specified' },
    { value: '1 week', label: '1 week' },
    { value: '2 weeks', label: '2 weeks' },
    { value: '3 weeks', label: '3 weeks' },
    { value: '4 weeks', label: '4 weeks' },
    { value: 'other', label: 'Other / custom' }
];
const COMBO_DURATION_OPTIONS = [
    { value: '', label: 'Duration not specified' },
    { value: '4 days', label: '4 days' },
    { value: '5 days', label: '5 days' },
    { value: '6 days', label: '6 days' },
    { value: '7 days', label: '7 days' },
    { value: 'other', label: 'Other / custom' }
];
const CREAM_FREQUENCY_OPTIONS = [
    { value: '', label: 'Frequency not specified' },
    { value: 'once daily', label: 'Once daily' },
    { value: 'twice daily', label: 'Twice daily' }
];

/* RACGP AFP May 2017 — Optimising cryosurgery technique (Table 2), timed spot-freeze.
   Freeze time is held after ice ball encompasses lesion + margin. Clinician may modify. */
const CRYOTHERAPY_PROTOCOLS = [
    {
        id: 'ak',
        label: 'Actinic / solar keratosis',
        matchCodes: ['SK'],
        matchWords: ['actinic', 'solar keratosis'],
        technique: 'open-spray',
        freezeSeconds: 15,
        freezeSecondsMax: 15,
        ftc: 1,
        marginMm: 1,
        sessions: 1,
        interval: '',
        suggestRecall: false,
        hint: 'RACGP: open-spray 15 s × 1 FTC, 1 mm margin. Brief 1–2 s freezes are ineffective. Some AU sources cite shorter freezes for thin AKs — adjust if needed.'
    },
    {
        id: 'sebk',
        label: 'Seborrhoeic keratosis',
        matchCodes: ['SebK'],
        matchWords: ['seborrhoeic', 'seborrheic'],
        technique: 'open-spray',
        freezeSeconds: 10,
        freezeSecondsMax: 20,
        ftc: 1,
        marginMm: 1,
        sessions: 1,
        interval: '',
        suggestRecall: false,
        hint: 'RACGP: freeze to ice formation × 1 FTC, 1 mm margin; usually single session. Thicker lesions may need longer freeze or a second FTC.'
    },
    {
        id: 'wart-flat',
        label: 'Viral wart (flat)',
        matchCodes: [],
        matchWords: ['wart', 'verruca'],
        technique: 'open-spray',
        freezeSeconds: 10,
        freezeSecondsMax: 10,
        ftc: 1,
        marginMm: 1,
        sessions: 2,
        interval: '2 weeks',
        suggestRecall: true,
        hint: 'RACGP: flat warts 10 s × 1 FTC, 1 mm; typically 2 sessions ~2 weeks apart. Pare thick keratin first when practical.'
    },
    {
        id: 'wart-plane',
        label: 'Plane wart',
        matchCodes: [],
        matchWords: [],
        technique: 'open-spray',
        freezeSeconds: 4,
        freezeSecondsMax: 5,
        ftc: 1,
        marginMm: 1,
        sessions: 2,
        interval: '2 weeks',
        suggestRecall: true,
        hint: 'RACGP: plane warts 3–5 s × 1 FTC, 1 mm; often needs a second session.'
    },
    {
        id: 'wart-plantar',
        label: 'Plantar wart',
        matchCodes: [],
        matchWords: ['plantar'],
        technique: 'open-spray',
        freezeSeconds: 15,
        freezeSecondsMax: 20,
        ftc: 1,
        marginMm: 1,
        sessions: 2,
        interval: '2 weeks',
        suggestRecall: true,
        hint: 'RACGP: plantar 10–20 s × 1 FTC (recalcitrant may need double FTC), 1 mm; usually ≥2 sessions.'
    },
    {
        id: 'wart-filiform',
        label: 'Filiform / digit wart',
        matchCodes: [],
        matchWords: ['filiform'],
        technique: 'open-spray',
        freezeSeconds: 10,
        freezeSecondsMax: 10,
        ftc: 1,
        marginMm: 1,
        sessions: 2,
        interval: '2 weeks',
        suggestRecall: true,
        hint: 'RACGP: filiform/digit ~10 s × 1 FTC, 1 mm; plan a review/repeat session.'
    },
    {
        id: 'skin-tag',
        label: 'Skin tag',
        matchCodes: [],
        matchWords: ['skin tag', 'acrochordon'],
        technique: 'open-spray',
        freezeSeconds: 8,
        freezeSecondsMax: 10,
        ftc: 1,
        marginMm: 1,
        sessions: 1,
        interval: '',
        suggestRecall: false,
        hint: 'RACGP: 5–10 s × 1 FTC, 1 mm; usually single treatment (spray or forceps).'
    },
    {
        id: 'solar-lentigo',
        label: 'Solar lentigo',
        matchCodes: ['SL'],
        matchWords: ['solar lentigo', 'lentigo'],
        technique: 'open-spray',
        freezeSeconds: 5,
        freezeSecondsMax: 5,
        ftc: 1,
        marginMm: 1,
        sessions: 1,
        interval: '',
        suggestRecall: false,
        hint: 'RACGP: 5 s × 1 FTC, 1 mm. Do not treat if melanoma in situ cannot be excluded — biopsy/refer instead.'
    },
    {
        id: 'bowen',
        label: 'Bowen’s / IEC',
        matchCodes: ['IEC'],
        matchWords: ['bowen', 'iec', 'intraepidermal'],
        technique: 'open-spray',
        freezeSeconds: 20,
        freezeSecondsMax: 30,
        ftc: 1,
        marginMm: 3,
        sessions: 1,
        interval: '',
        suggestRecall: false,
        hint: 'RACGP: 15–30 s × 1 FTC, 3 mm margin. Confirm diagnosis is suitable for cryotherapy.'
    },
    {
        id: 'dermatofibroma',
        label: 'Dermatofibroma',
        matchCodes: ['DF'],
        matchWords: ['dermatofibroma'],
        technique: 'cryoprobe',
        freezeSeconds: 25,
        freezeSecondsMax: 30,
        ftc: 1,
        marginMm: 2,
        sessions: 2,
        interval: '8 weeks',
        suggestRecall: true,
        hint: 'RACGP: 20–30 s × 1 FTC, 2 mm; often 2 sessions ~8 weeks apart.'
    },
    {
        id: 'bcc-caution',
        label: 'BCC (selected lesions only)',
        matchCodes: ['BCC'],
        matchWords: ['basal cell'],
        technique: 'open-spray',
        freezeSeconds: 30,
        freezeSecondsMax: 30,
        ftc: 2,
        marginMm: 5,
        sessions: 1,
        interval: '',
        suggestRecall: false,
        hint: 'RACGP: 30 s × 2 FTC, 5 mm — only for carefully selected lesions. Prefer excision when histology/margins needed. Not for poorly defined, deep, or high-risk sites.'
    },
    {
        id: 'custom',
        label: 'Custom / other',
        matchCodes: [],
        matchWords: [],
        technique: 'open-spray',
        freezeSeconds: 10,
        freezeSecondsMax: 15,
        ftc: 1,
        marginMm: 1,
        sessions: 1,
        interval: '',
        suggestRecall: false,
        hint: 'Enter parameters clinically. Biopsy or refer if diagnosis is uncertain (RACGP).'
    }
];

const DEFAULT_PDT_PRICE_LIST = [
    { id: 'pdt-face', area: 'Face', price: 0 },
    { id: 'pdt-scalp', area: 'Scalp', price: 0 },
    { id: 'pdt-hands', area: 'Hands (both)', price: 0 },
    { id: 'pdt-forearms', area: 'Forearms (both)', price: 0 },
    { id: 'pdt-chest', area: 'Chest / décolletage', price: 0 }
];

let pdtPriceList = [];

function isTopicalPlan(plan) {
    return (plan || '').includes('Topical');
}

function topicalLabel(id) {
    if (id === TOPICAL_DECISION_DECLINED) return 'Declined treatment';
    const match = TOPICAL_TREATMENT_OPTIONS.find(opt => opt.id === id);
    return match ? match.label : (id || '');
}

function loadPdtPriceList() {
    if (typeof loadClinicPdtPrices === 'function' && vaultRootHandle) {
        return;
    }
    const fromLocal = typeof readLocalPdtPricesFallback === 'function'
        ? readLocalPdtPricesFallback()
        : null;
    if (fromLocal) {
        pdtPriceList = fromLocal.map((item) => ({ ...item }));
        return;
    }
    try {
        const raw = localStorage.getItem(PDT_PRICE_STORAGE_KEY);
        if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed) && parsed.length > 0) {
                pdtPriceList = parsed.map(item => ({
                    id: item.id || ('pdt-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7)),
                    area: String(item.area || '').trim() || 'Unnamed area',
                    price: Number(item.price) || 0
                }));
                return;
            }
        }
    } catch (err) {
        pdtPriceList = [];
    }
    pdtPriceList = DEFAULT_PDT_PRICE_LIST.map(item => ({ ...item }));
}

async function savePdtPriceList() {
    try {
        if (typeof saveClinicPdtPrices === 'function') {
            await saveClinicPdtPrices();
            return;
        }
        localStorage.setItem(PDT_PRICE_STORAGE_KEY, JSON.stringify(pdtPriceList));
    } catch (err) {
        showToast(err.message || 'Unable to save PDT prices.');
    }
}

function formatPdtMoney(price) {
    const n = Number(price);
    if (!n || n <= 0) return 'Fee not set';
    return '$' + n.toFixed(n % 1 ? 2 : 0);
}

function getPdtAreaById(id) {
    return pdtPriceList.find(item => item.id === id) || null;
}

function normalizePdtRegions(lesionOrFields) {
    const src = lesionOrFields || {};
    if (Array.isArray(src.pdtRegions) && src.pdtRegions.length) {
        return src.pdtRegions.map((row) => ({
            id: String(row.id || ''),
            area: String(row.area || '').trim(),
            price: Math.max(0, Number(row.price) || 0)
        })).filter((row) => row.area || row.id);
    }
    if (src.pdtAreaId || src.pdtAreaName) {
        return [{
            id: String(src.pdtAreaId || ''),
            area: String(src.pdtAreaName || '').trim() || 'Body area',
            price: Math.max(0, Number(src.pdtQuotedPrice) || 0)
        }];
    }
    return [];
}

function summarizePdtRegions(regions) {
    const list = Array.isArray(regions) ? regions : [];
    const names = list.map((row) => row.area).filter(Boolean);
    const total = list.reduce((sum, row) => sum + (Number(row.price) || 0), 0);
    return {
        names: names.join(' + '),
        total,
        count: list.length
    };
}

function pdtRegionsSnapshotFromIds(ids) {
    return (ids || []).map((id) => {
        const item = getPdtAreaById(id);
        if (!item) return null;
        return { id: item.id, area: item.area, price: Number(item.price) || 0 };
    }).filter(Boolean);
}

async function initTopicalModule() {
    if (typeof loadClinicPdtPrices === 'function' && vaultRootHandle) {
        await loadClinicPdtPrices();
    } else {
        loadPdtPriceList();
    }
    renderPdtAreaSelect();
    renderPdtPriceEditor();
    renderAkComparisonTable();
    updateAkComparisonControls();
}

function getSelectedPdtAreaIds() {
    return Array.from(document.querySelectorAll('input[name="pdtAreaPick"]:checked, input[name="inspPdtAreaPick"]:checked'))
        .map((el) => el.value)
        .filter((id, idx, all) => all.indexOf(id) === idx);
}

function renderPdtAreaSelect(selectedIds) {
    let selected = Array.isArray(selectedIds)
        ? selectedIds.slice()
        : (selectedIds ? [selectedIds] : getSelectedPdtAreaIds());
    if (!selected.length) {
        const legacy = document.getElementById('pdtAreaSelect')?.value;
        if (legacy) selected = [legacy];
    }
    const hosts = [
        { id: 'pdtAreaChecklist', name: 'pdtAreaPick' },
        { id: 'inspPdtAreaChecklist', name: 'inspPdtAreaPick' }
    ];
    hosts.forEach((spec) => {
        const host = document.getElementById(spec.id);
        if (!host) return;
        if (pdtPriceList.length === 0) {
            host.innerHTML = '<p class="insp-hint">No clinic PDT areas yet. Add them under Clinic settings → PDT prices, or record a custom area and fee below.</p>';
            return;
        }
        host.innerHTML = pdtPriceList.map((item) => {
            const checked = selected.includes(item.id) ? ' checked' : '';
            return `<label class="insp-choice">
                <input type="checkbox" name="${spec.name}" value="${item.id}"${checked} onchange="updatePdtQuotePreview()">
                <span class="flex-1">${escapeHtml(item.area)}</span>
                <span>${formatPdtMoney(item.price)}</span>
            </label>`;
        }).join('');
    });
    updatePdtQuotePreview();
}

function renderPdtPriceEditor() {
    const list = document.getElementById('pdtPriceEditorList');
    if (!list) return;
    if (pdtPriceList.length === 0) {
        list.innerHTML = `<p class="text-[11px] text-slate-500 italic">No body areas yet. Add an area and fee below — saved to the clinic folder.</p>`;
        return;
    }
    list.innerHTML = pdtPriceList.map(item => `
        <div class="grid grid-cols-12 gap-2 items-center">
            <input type="text" value="${escapeHtml(item.area)}" onchange="updatePdtPriceArea('${item.id}', this.value)" class="col-span-6 p-1.5 border border-slate-300 rounded bg-white text-[11px]">
            <div class="col-span-4 flex items-center gap-1">
                <span class="text-[11px] text-slate-700">$</span>
                <input type="number" min="0" step="1" value="${item.price || ''}" onchange="updatePdtPriceAmount('${item.id}', this.value)" placeholder="0" class="w-full p-1.5 border border-slate-300 rounded bg-white text-[11px]">
            </div>
            <button type="button" onclick="removePdtPriceArea('${item.id}')" class="col-span-2 text-[11px] font-bold text-red-600 hover:text-red-800 cursor-pointer">Remove</button>
        </div>
    `).join('');
}

async function updatePdtPriceArea(id, area) {
    const item = getPdtAreaById(id);
    if (!item) return;
    item.area = area.trim() || item.area;
    await savePdtPriceList();
    renderPdtAreaSelect();
    renderPdtPriceEditor();
}

async function updatePdtPriceAmount(id, price) {
    const item = getPdtAreaById(id);
    if (!item) return;
    item.price = Math.max(0, Number(price) || 0);
    await savePdtPriceList();
    renderPdtAreaSelect();
    renderPdtPriceEditor();
    updatePdtQuotePreview();
}

async function removePdtPriceArea(id) {
    pdtPriceList = pdtPriceList.filter(item => item.id !== id);
    await savePdtPriceList();
    renderPdtAreaSelect();
    renderPdtPriceEditor();
}

async function addPdtPriceArea() {
    const areaInput = document.getElementById('newPdtAreaName');
    const priceInput = document.getElementById('newPdtAreaPrice');
    const area = areaInput ? areaInput.value.trim() : '';
    if (!area) {
        showToast('Enter a PDT body area name.');
        return;
    }
    const price = Math.max(0, Number(priceInput?.value) || 0);
    const id = 'pdt-' + Date.now();
    pdtPriceList.push({ id, area, price });
    await savePdtPriceList();
    if (areaInput) areaInput.value = '';
    if (priceInput) priceInput.value = '';
    renderPdtAreaSelect();
    renderPdtPriceEditor();
    showToast('PDT area saved to clinic settings.');
}

function topicalUiIsInspector() {
    return !!document.getElementById('inspPlanTopicalFields');
}

function topicalDecisionValue() {
    const insp = document.querySelector('input[name="inspTopicalDecision"]:checked')?.value;
    if (insp) return insp;
    return document.querySelector('input[name="topicalDecision"]:checked')?.value || '';
}

function isPdtRelevant() {
    return topicalDecisionValue() === 'pdt' || getDiscussedTreatmentIds().includes('pdt');
}

function isCryoRelevant() {
    return topicalDecisionValue() === 'cryotherapy';
}

function isEfudixCourseRelevant() {
    return topicalDecisionValue() === 'efudix' || getDiscussedTreatmentIds().includes('efudix');
}

function isComboCourseRelevant() {
    return topicalDecisionValue() === 'efudix-calcipotriol'
        || getDiscussedTreatmentIds().includes('efudix-calcipotriol');
}

function topicalEl(modalId, inspId) {
    return document.getElementById(inspId) || document.getElementById(modalId);
}

function topicalEls(modalId, inspId) {
    return [document.getElementById(modalId), document.getElementById(inspId)].filter(Boolean);
}

function emptyCreamCourseFields() {
    return {
        efudixDuration: '',
        efudixFrequency: '',
        comboDuration: '',
        comboFrequency: '',
        pdtQuotedFeeOverride: '',
        pdtCustomArea: '',
        pdtCustomFee: ''
    };
}

function durationSelectValue(stored, options) {
    const raw = String(stored || '').trim();
    if (!raw) return '';
    if ((options || []).some((opt) => opt.value && opt.value === raw)) return raw;
    return 'other';
}

function readDurationField(selectEl, customEl) {
    const sel = selectEl?.value || '';
    if (sel === 'other') return String(customEl?.value || '').trim();
    return sel;
}

function formatCreamCourseText(duration, frequency) {
    return [String(duration || '').trim(), String(frequency || '').trim()].filter(Boolean).join(', ');
}

function formatEfudixCourseText(lesion) {
    return formatCreamCourseText(lesion?.efudixDuration, lesion?.efudixFrequency);
}

function formatComboCourseText(lesion) {
    return formatCreamCourseText(lesion?.comboDuration, lesion?.comboFrequency);
}

function creamSelectOptionsHtml(options, current) {
    const sel = durationSelectValue(current, options);
    return (options || []).map((opt) => (
        `<option value="${escapeHtml(opt.value)}"${opt.value === sel ? ' selected' : ''}>${escapeHtml(opt.label)}</option>`
    )).join('');
}

function syncCreamCourseUi() {
    topicalEls('efudixDuration', 'inspEfudixDuration').forEach((el) => {
        const wrap = document.getElementById(el.id === 'inspEfudixDuration' ? 'inspEfudixDurationCustomWrap' : 'efudixDurationCustomWrap');
        wrap?.classList.toggle('hidden', el.value !== 'other');
    });
    topicalEls('comboDuration', 'inspComboDuration').forEach((el) => {
        const wrap = document.getElementById(el.id === 'inspComboDuration' ? 'inspComboDurationCustomWrap' : 'comboDurationCustomWrap');
        wrap?.classList.toggle('hidden', el.value !== 'other');
    });
}

function readCreamCourseFromForm() {
    const insp = topicalUiIsInspector();
    return {
        efudixDuration: readDurationField(
            topicalEl('efudixDuration', insp ? 'inspEfudixDuration' : 'efudixDuration'),
            topicalEl('efudixDurationCustom', insp ? 'inspEfudixDurationCustom' : 'efudixDurationCustom')
        ),
        efudixFrequency: (topicalEl('efudixFrequency', insp ? 'inspEfudixFrequency' : 'efudixFrequency')?.value || '').trim(),
        comboDuration: readDurationField(
            topicalEl('comboDuration', insp ? 'inspComboDuration' : 'comboDuration'),
            topicalEl('comboDurationCustom', insp ? 'inspComboDurationCustom' : 'comboDurationCustom')
        ),
        comboFrequency: (topicalEl('comboFrequency', insp ? 'inspComboFrequency' : 'comboFrequency')?.value || '').trim(),
        pdtQuotedFeeOverride: (topicalEl('pdtQuotedFee', insp ? 'inspPdtQuotedFee' : 'pdtQuotedFee')?.value || '').trim(),
        pdtCustomArea: (topicalEl('pdtCustomArea', insp ? 'inspPdtCustomArea' : 'pdtCustomArea')?.value || '').trim(),
        pdtCustomFee: (topicalEl('pdtCustomFee', insp ? 'inspPdtCustomFee' : 'pdtCustomFee')?.value || '').trim()
    };
}

function fillCreamCourseFields(fields) {
    const setDuration = (selectId, customId, wrapId, value, options) => {
        const sel = document.getElementById(selectId);
        const custom = document.getElementById(customId);
        const wrap = document.getElementById(wrapId);
        if (!sel) return;
        const picked = durationSelectValue(value, options);
        sel.value = picked;
        if (custom) custom.value = picked === 'other' ? String(value || '') : '';
        wrap?.classList.toggle('hidden', picked !== 'other');
    };
    const setVal = (id, value) => {
        const el = document.getElementById(id);
        if (el) el.value = value || '';
    };
    ['', 'insp'].forEach((prefix) => {
        const p = (name) => prefix ? ('insp' + name.charAt(0).toUpperCase() + name.slice(1)) : name;
        setDuration(p('efudixDuration'), p('efudixDurationCustom'), p('efudixDurationCustomWrap'), fields?.efudixDuration, EFUDIX_DURATION_OPTIONS);
        setVal(p('efudixFrequency'), fields?.efudixFrequency);
        setDuration(p('comboDuration'), p('comboDurationCustom'), p('comboDurationCustomWrap'), fields?.comboDuration, COMBO_DURATION_OPTIONS);
        setVal(p('comboFrequency'), fields?.comboFrequency);
        setVal(p('pdtQuotedFee'), fields?.pdtQuotedFeeOverride || (Number(fields?.pdtQuotedPrice) > 0 && !fields?.pdtRegions?.length ? fields.pdtQuotedPrice : ''));
        setVal(p('pdtCustomArea'), fields?.pdtCustomArea);
        setVal(p('pdtCustomFee'), fields?.pdtCustomFee);
    });
    syncCreamCourseUi();
}

function getDiscussedTreatmentIds() {
    const inspBoxes = document.querySelectorAll('input[name="inspTopicalDiscussed"]');
    if (inspBoxes.length) {
        return Array.from(inspBoxes).filter((el) => el.checked).map((el) => el.value);
    }
    const modalBoxes = document.querySelectorAll('input[name="topicalDiscussed"]:checked');
    if (modalBoxes.length) return Array.from(modalBoxes).map((el) => el.value);
    const lesion = typeof ensureSelectedChartLesion === 'function' ? ensureSelectedChartLesion() : null;
    if (lesion && Array.isArray(lesion.topicalDiscussed)) return lesion.topicalDiscussed.slice();
    return [];
}

function getCryoProtocolById(id) {
    return CRYOTHERAPY_PROTOCOLS.find((row) => row.id === id) || CRYOTHERAPY_PROTOCOLS.find((row) => row.id === 'custom');
}

function inferCryoProtocolId(impression) {
    const raw = String(impression || '').trim();
    const code = typeof diagnosisCodeFromText === 'function' ? (diagnosisCodeFromText(raw) || raw) : raw;
    const lower = raw.toLowerCase();
    if (/plantar/.test(lower)) return 'wart-plantar';
    if (/filiform/.test(lower)) return 'wart-filiform';
    if (/plane\s*wart/.test(lower)) return 'wart-plane';
    if (/skin\s*tag|acrochordon/.test(lower)) return 'skin-tag';
    for (const row of CRYOTHERAPY_PROTOCOLS) {
        if (row.id === 'custom' || row.id.startsWith('wart-')) continue;
        if (row.matchCodes.some((c) => c === code || raw === c)) return row.id;
        if (row.matchWords.some((w) => lower.includes(w))) return row.id;
    }
    if (/wart|verruca/.test(lower)) return 'wart-flat';
    return 'custom';
}

function populateCryoProtocolSelect(selectedId) {
    const sel = document.getElementById('cryoProtocolSelect');
    if (!sel) return;
    const current = selectedId || sel.value || 'ak';
    sel.innerHTML = CRYOTHERAPY_PROTOCOLS.map((row) => (
        `<option value="${row.id}">${escapeHtml(row.label)}</option>`
    )).join('');
    if ([...sel.options].some((opt) => opt.value === current)) sel.value = current;
}

function emptyCryoFields() {
    return {
        cryoProtocolId: '',
        cryoProtocolLabel: '',
        cryoTechnique: 'open-spray',
        cryoFreezeSeconds: 0,
        cryoFreezeThawCycles: 1,
        cryoMarginMm: 1,
        cryoSessionsPlanned: 1,
        cryoSessionInterval: '',
        cryoRecallRepeat: false,
        cryoGuidelineHint: '',
        cryoModified: false
    };
}

function readCryoFieldsFromForm() {
    const protocolId = document.getElementById('cryoProtocolSelect')?.value || '';
    const protocol = getCryoProtocolById(protocolId);
    const freeze = Math.max(0, Number(document.getElementById('cryoFreezeSeconds')?.value) || 0);
    const ftc = Math.max(1, Number(document.getElementById('cryoFreezeThawCycles')?.value) || 1);
    const margin = Math.max(0, Number(document.getElementById('cryoMarginMm')?.value) || 0);
    const sessions = Math.max(1, Number(document.getElementById('cryoSessionsPlanned')?.value) || 1);
    const interval = document.getElementById('cryoSessionInterval')?.value || '';
    const recall = !!document.getElementById('cryoRecallRepeat')?.checked;
    const technique = document.getElementById('cryoTechnique')?.value || 'open-spray';
    const modified = document.getElementById('cryoPlanPanel')?.dataset.modified === '1';
    return {
        cryoProtocolId: protocolId,
        cryoProtocolLabel: protocol?.label || '',
        cryoTechnique: technique,
        cryoFreezeSeconds: freeze,
        cryoFreezeThawCycles: ftc,
        cryoMarginMm: margin,
        cryoSessionsPlanned: sessions,
        cryoSessionInterval: interval,
        cryoRecallRepeat: recall,
        cryoGuidelineHint: protocol?.hint || '',
        cryoModified: modified
    };
}

function fillCryoFields(fields, options) {
    const opts = options || {};
    const protocolId = fields?.cryoProtocolId || 'custom';
    populateCryoProtocolSelect(protocolId);
    const protocol = getCryoProtocolById(protocolId);
    const setVal = (id, value) => {
        const el = document.getElementById(id);
        if (el) el.value = value;
    };
    setVal('cryoFreezeSeconds', fields?.cryoFreezeSeconds ?? protocol.freezeSeconds);
    setVal('cryoFreezeThawCycles', fields?.cryoFreezeThawCycles ?? protocol.ftc);
    setVal('cryoMarginMm', fields?.cryoMarginMm ?? protocol.marginMm);
    setVal('cryoSessionsPlanned', fields?.cryoSessionsPlanned ?? protocol.sessions);
    setVal('cryoSessionInterval', fields?.cryoSessionInterval ?? protocol.interval ?? '');
    setVal('cryoTechnique', fields?.cryoTechnique ?? protocol.technique);
    const recall = document.getElementById('cryoRecallRepeat');
    if (recall) {
        recall.checked = fields?.cryoRecallRepeat != null
            ? !!fields.cryoRecallRepeat
            : !!protocol.suggestRecall;
    }
    const panel = document.getElementById('cryoPlanPanel');
    if (panel) panel.dataset.modified = fields?.cryoModified ? '1' : '0';
    const hint = document.getElementById('cryoProtocolHint');
    if (hint) hint.textContent = protocol?.hint || '';
    updateCryoPlanPreview();
    if (opts.syncFollowUp !== false) syncTopicalFollowUpFromCryo();
}

function applyCryoProtocol(protocolId, options) {
    const protocol = getCryoProtocolById(protocolId);
    fillCryoFields({
        cryoProtocolId: protocol.id,
        cryoProtocolLabel: protocol.label,
        cryoTechnique: protocol.technique,
        cryoFreezeSeconds: protocol.freezeSeconds,
        cryoFreezeThawCycles: protocol.ftc,
        cryoMarginMm: protocol.marginMm,
        cryoSessionsPlanned: protocol.sessions,
        cryoSessionInterval: protocol.interval || '',
        cryoRecallRepeat: !!protocol.suggestRecall,
        cryoGuidelineHint: protocol.hint,
        cryoModified: false
    }, options);
}

function applyCryoProtocolFromSelect() {
    applyCryoProtocol(document.getElementById('cryoProtocolSelect')?.value || 'custom', { syncFollowUp: true });
}

function applyCryoRecommendationFromImpression(options) {
    const opts = options || {};
    if (!isCryoRelevant() && !opts.force) return;
    const impression = typeof readExamImpression === 'function' ? readExamImpression() : '';
    const id = inferCryoProtocolId(impression);
    applyCryoProtocol(id, { syncFollowUp: true });
    const panel = document.getElementById('cryoPlanPanel');
    if (panel) panel.dataset.modified = '0';
}

function markCryoPlanModified() {
    const panel = document.getElementById('cryoPlanPanel');
    if (panel) panel.dataset.modified = '1';
    updateCryoPlanPreview();
}

function onCryoSessionsChanged() {
    markCryoPlanModified();
    const sessions = Math.max(1, Number(document.getElementById('cryoSessionsPlanned')?.value) || 1);
    const recall = document.getElementById('cryoRecallRepeat');
    const interval = document.getElementById('cryoSessionInterval');
    if (sessions > 1) {
        if (recall) recall.checked = true;
        if (interval && !interval.value) interval.value = '2 weeks';
    }
    syncTopicalFollowUpFromCryo();
}

function onCryoRecallFieldsChanged() {
    markCryoPlanModified();
    const recall = document.getElementById('cryoRecallRepeat');
    const interval = document.getElementById('cryoSessionInterval');
    if (recall?.checked && interval && !interval.value) interval.value = '2 weeks';
    syncTopicalFollowUpFromCryo();
    updateCryoPlanPreview();
}

function syncTopicalFollowUpFromCryo() {
    const follow = document.getElementById('topicalFollowUp');
    if (!follow) return;
    const recall = !!document.getElementById('cryoRecallRepeat')?.checked;
    const interval = document.getElementById('cryoSessionInterval')?.value || '';
    if (!recall) return;
    const map = {
        '2 weeks': '2 weeks',
        '4 weeks': '4 weeks',
        '6 weeks': '8 weeks',
        '8 weeks': '8 weeks'
    };
    const next = map[interval] || (interval ? '4 weeks' : '2 weeks');
    if ([...follow.options].some((opt) => opt.value === next)) follow.value = next;
}

function cryoTechniqueLabel(value) {
    if (value === 'cryoprobe') return 'cryoprobe';
    if (value === 'dipstick') return 'cotton-tipped dipstick';
    return 'open-spray timed spot-freeze';
}

function formatCryoPlanSummary(fields) {
    if (!fields || !(Number(fields.cryoFreezeSeconds) > 0)) return '';
    const ftc = Number(fields.cryoFreezeThawCycles) || 1;
    const margin = Number(fields.cryoMarginMm);
    const sessions = Number(fields.cryoSessionsPlanned) || 1;
    let text = `LN2 ${cryoTechniqueLabel(fields.cryoTechnique)}, ${fields.cryoFreezeSeconds}s × ${ftc} FTC`;
    if (!Number.isNaN(margin)) text += `, ${margin} mm margin`;
    if (fields.cryoProtocolLabel) text += ` (${fields.cryoProtocolLabel})`;
    if (sessions > 1) {
        text += `; ${sessions} sessions`;
        if (fields.cryoSessionInterval) text += ` ~${fields.cryoSessionInterval} apart`;
    }
    if (fields.cryoRecallRepeat) {
        text += `; recall for further cryotherapy${fields.cryoSessionInterval ? ' in ' + fields.cryoSessionInterval : ''}`;
    }
    if (fields.cryoModified) text += ' [clinician-modified]';
    return text;
}

function updateCryoPlanPreview() {
    const preview = document.getElementById('cryoPlanPreview');
    if (!preview) return;
    const summary = formatCryoPlanSummary(readCryoFieldsFromForm());
    preview.textContent = summary
        ? `Documented plan: ${summary}. Source: RACGP cryosurgery technique guidance (clinician may modify).`
        : 'Set freeze time and margin for this lesion.';
}

function updateTopicalFieldVisibility() {
    const showPdt = isPdtRelevant();
    ['pdtQuotePanel', 'inspPdtQuotePanel'].forEach((id) => {
        document.getElementById(id)?.classList.toggle('hidden', !showPdt);
    });
    const showEfudix = isEfudixCourseRelevant();
    ['efudixCoursePanel', 'inspEfudixCoursePanel'].forEach((id) => {
        document.getElementById(id)?.classList.toggle('hidden', !showEfudix);
    });
    const showCombo = isComboCourseRelevant();
    ['comboCoursePanel', 'inspComboCoursePanel'].forEach((id) => {
        document.getElementById(id)?.classList.toggle('hidden', !showCombo);
    });
    syncCreamCourseUi();
    const cryoPanel = document.getElementById('cryoPlanPanel');
    if (cryoPanel) {
        if (isCryoRelevant()) {
            cryoPanel.classList.remove('hidden');
            populateCryoProtocolSelect(document.getElementById('cryoProtocolSelect')?.value || '');
            const hasPlan = Number(document.getElementById('cryoFreezeSeconds')?.value) > 0;
            if (!hasPlan) applyCryoRecommendationFromImpression({ force: true });
            else updateCryoPlanPreview();
        } else {
            cryoPanel.classList.add('hidden');
        }
    }
    updatePdtQuotePreview();
    if (!document.getElementById('akComparisonModal')?.classList.contains('hidden')
        && typeof renderAkComparisonTable === 'function') {
        renderAkComparisonTable();
    }
}

function markDiscussedForDecision(decision, prefix) {
    if (!decision || decision === 'declined') return;
    const name = prefix === 'insp' ? 'inspTopicalDiscussed' : 'topicalDiscussed';
    const box = document.querySelector(`input[name="${name}"][value="${decision}"]`);
    if (box) box.checked = true;
}

function handleTopicalDecisionChange() {
    const decision = document.querySelector('input[name="topicalDecision"]:checked')?.value || '';
    markDiscussedForDecision(decision, '');
    if (decision === 'cryotherapy') applyCryoRecommendationFromImpression({ force: true });
    updateTopicalFieldVisibility();
}

function handleInspectorTopicalDecisionChange() {
    const decision = document.querySelector('input[name="inspTopicalDecision"]:checked')?.value || '';
    markDiscussedForDecision(decision, 'insp');
    updateTopicalFieldVisibility();
    if (decision === 'pdt' || getDiscussedTreatmentIds().includes('pdt')) {
        renderPdtAreaSelect(getSelectedPdtAreaIds());
    }
}

function collectPdtRegionsFromForm() {
    const regions = pdtRegionsSnapshotFromIds(getSelectedPdtAreaIds());
    const cream = readCreamCourseFromForm();
    if (cream.pdtCustomArea) {
        regions.push({
            id: 'pdt-custom',
            area: cream.pdtCustomArea,
            price: Math.max(0, Number(cream.pdtCustomFee) || 0)
        });
    }
    const override = Math.max(0, Number(cream.pdtQuotedFeeOverride) || 0);
    return { regions, override };
}

function updatePdtQuotePreview() {
    const previews = topicalEls('pdtQuotePreview', 'inspPdtQuotePreview');
    if (!previews.length) return;
    const collected = collectPdtRegionsFromForm();
    const regions = collected.regions;
    if (!regions.length && !collected.override) {
        previews.forEach((preview) => {
            preview.textContent = 'Tick clinic PDT areas, or record a custom area and fee for this field.';
        });
        return;
    }
    const summary = summarizePdtRegions(regions);
    const total = collected.override || summary.total;
    const names = summary.names || 'Recorded field';
    const lines = regions.map((row) => `${row.area}: ${formatPdtMoney(row.price)}`);
    const text = (lines.length ? lines.join('\n') + '\n' : '')
        + (collected.override
            ? `Quoted fee recorded: ${formatPdtMoney(total)} OOP for ${names}`
            : (total > 0
                ? `Quoted fee for ${names}: ${formatPdtMoney(total)} OOP`
                : `${names} selected — set a clinic fee or record a quoted fee below.`));
    previews.forEach((preview) => {
        preview.textContent = text;
    });
}

function resetTopicalForm() {
    document.querySelectorAll('input[name="topicalDiscussed"]').forEach(el => { el.checked = false; });
    const declined = document.querySelector('input[name="topicalDecision"][value="declined"]');
    document.querySelectorAll('input[name="topicalDecision"]').forEach(el => { el.checked = false; });
    if (declined) declined.checked = false;
    const notes = document.getElementById('topicalNotes');
    if (notes) notes.value = '';
    document.querySelectorAll('input[name="pdtAreaPick"]').forEach((el) => { el.checked = false; });
    const select = document.getElementById('pdtAreaSelect');
    if (select) select.value = '';
    fillCryoFields(emptyCryoFields(), { syncFollowUp: false });
    fillCreamCourseFields(emptyCreamCourseFields());
    const follow = document.getElementById('topicalFollowUp');
    if (follow) follow.value = 'none';
    updateTopicalFieldVisibility();
}

function populateTopicalForm(item) {
    resetTopicalForm();
    const discussed = Array.isArray(item.topicalDiscussed) ? item.topicalDiscussed : [];
    discussed.forEach(id => {
        const box = document.querySelector(`input[name="topicalDiscussed"][value="${id}"]`);
        if (box) box.checked = true;
    });
    if (item.topicalDecision) {
        const radio = document.querySelector(`input[name="topicalDecision"][value="${item.topicalDecision}"]`);
        if (radio) radio.checked = true;
    }
    const notes = document.getElementById('topicalNotes');
    if (notes) notes.value = item.topicalNotes || '';
    const follow = document.getElementById('topicalFollowUp');
    if (follow) follow.value = item.topicalFollowUp || 'none';
    const regionIds = normalizePdtRegions(item).map((row) => row.id).filter(Boolean);
    renderPdtAreaSelect(regionIds);
    fillCreamCourseFields(item);
    if (item.topicalDecision === 'cryotherapy' || (item.cryoFreezeSeconds > 0)) {
        fillCryoFields({
            cryoProtocolId: item.cryoProtocolId || inferCryoProtocolId(item.impression),
            cryoProtocolLabel: item.cryoProtocolLabel || '',
            cryoTechnique: item.cryoTechnique || 'open-spray',
            cryoFreezeSeconds: item.cryoFreezeSeconds || 0,
            cryoFreezeThawCycles: item.cryoFreezeThawCycles || 1,
            cryoMarginMm: item.cryoMarginMm ?? 1,
            cryoSessionsPlanned: item.cryoSessionsPlanned || 1,
            cryoSessionInterval: item.cryoSessionInterval || '',
            cryoRecallRepeat: !!item.cryoRecallRepeat,
            cryoGuidelineHint: item.cryoGuidelineHint || '',
            cryoModified: !!item.cryoModified
        }, { syncFollowUp: false });
    }
    updateTopicalFieldVisibility();
}

function readTopicalFieldsFromForm() {
    const discussed = getDiscussedTreatmentIds();
    const insp = topicalUiIsInspector();
    const decision = topicalDecisionValue();
    const cream = readCreamCourseFromForm();
    const collected = collectPdtRegionsFromForm();
    const pdtRegions = collected.regions;
    const summary = summarizePdtRegions(pdtRegions);
    const quoted = collected.override || summary.total;
    const cryo = decision === 'cryotherapy' ? readCryoFieldsFromForm() : emptyCryoFields();
    return {
        topicalDiscussed: discussed,
        topicalDecision: decision,
        topicalNotes: (document.getElementById(insp ? 'inspTopicalNotes' : 'topicalNotes')?.value || '').trim(),
        topicalFollowUp: document.getElementById(insp ? 'inspTopicalFollowUp' : 'topicalFollowUp')?.value || 'none',
        efudixDuration: cream.efudixDuration,
        efudixFrequency: cream.efudixFrequency,
        comboDuration: cream.comboDuration,
        comboFrequency: cream.comboFrequency,
        pdtQuotedFeeOverride: cream.pdtQuotedFeeOverride,
        pdtCustomArea: cream.pdtCustomArea,
        pdtCustomFee: cream.pdtCustomFee,
        pdtRegions,
        pdtAreaId: pdtRegions[0]?.id || '',
        pdtAreaName: summary.names,
        pdtQuotedPrice: quoted,
        ...cryo
    };
}

function emptyTopicalFields() {
    return {
        topicalDiscussed: [],
        topicalDecision: '',
        topicalNotes: '',
        topicalFollowUp: 'none',
        ...emptyCreamCourseFields(),
        pdtRegions: [],
        pdtAreaId: '',
        pdtAreaName: '',
        pdtQuotedPrice: 0,
        ...emptyCryoFields()
    };
}

function formatTopicalDecisionText(lesion) {
    if (!lesion || !lesion.topicalDecision) return '';
    if (lesion.topicalDecision === TOPICAL_DECISION_DECLINED) {
        return 'Declined treatment after discussion';
    }
    let text = topicalLabel(lesion.topicalDecision);
    if (lesion.topicalDecision === 'efudix') {
        const course = formatEfudixCourseText(lesion);
        if (course) text += ` — ${course}`;
    }
    if (lesion.topicalDecision === 'efudix-calcipotriol') {
        const course = formatComboCourseText(lesion);
        if (course) text += ` — ${course}`;
    }
    if (lesion.topicalDecision === 'pdt') {
        const summary = summarizePdtRegions(normalizePdtRegions(lesion));
        const quoted = Number(lesion.pdtQuotedPrice) || summary.total;
        if (summary.names) {
            text += ` — ${summary.names}`;
            if (quoted > 0) {
                text += ` (quoted ${formatPdtMoney(quoted)} OOP)`;
            }
        } else if (quoted > 0) {
            text += ` (quoted ${formatPdtMoney(quoted)} OOP)`;
        }
    }
    if (lesion.topicalDecision === 'cryotherapy') {
        const summary = formatCryoPlanSummary(lesion);
        if (summary) text += ` — ${summary}`;
    }
    return text;
}

function formatTopicalEmrLines(lesion) {
    if (!isTopicalPlan(lesion.plan)) return '';
    let lines = '';
    const discussed = (lesion.topicalDiscussed || []).map(topicalLabel).filter(Boolean);
    if (discussed.length > 0) {
        lines += `    - Treatment options discussed: ${discussed.join('; ')}\n`;
    }
    const decision = formatTopicalDecisionText(lesion);
    if (decision) {
        lines += `    - Patient decision: ${decision}\n`;
    } else {
        lines += `    - Patient decision: Not yet recorded\n`;
    }
    const efudixCourse = formatEfudixCourseText(lesion);
    if (efudixCourse && (lesion.topicalDecision === 'efudix' || (lesion.topicalDiscussed || []).includes('efudix'))) {
        lines += `    - Efudix course discussed: ${efudixCourse}\n`;
    }
    const comboCourse = formatComboCourseText(lesion);
    if (comboCourse && (lesion.topicalDecision === 'efudix-calcipotriol' || (lesion.topicalDiscussed || []).includes('efudix-calcipotriol'))) {
        lines += `    - Combination Efudix + Calcipotriol course discussed: ${comboCourse}\n`;
    }
    if (lesion.topicalDecision === 'pdt' || (lesion.topicalDiscussed || []).includes('pdt')) {
        const regions = normalizePdtRegions(lesion);
        if (regions.length) {
            regions.forEach((row) => {
                lines += `    - PDT region quoted: ${row.area || 'Area'} (${formatPdtMoney(row.price)} OOP)\n`;
            });
        }
        const quoted = Number(lesion.pdtQuotedPrice) || summarizePdtRegions(regions).total;
        if (quoted > 0) {
            const names = summarizePdtRegions(regions).names || 'field treatment';
            lines += `    - PDT quoted fee: ${formatPdtMoney(quoted)} OOP for ${names}.\n`;
        }
    }
    if (lesion.topicalDecision === 'cryotherapy' && Number(lesion.cryoFreezeSeconds) > 0) {
        lines += `    - Cryotherapy parameters: ${formatCryoPlanSummary(lesion)}.\n`;
        lines += `    - Technique note: timed spot-freeze; freeze clock starts after ice ball covers lesion + intended margin; allow full thaw (>60 s) before any second FTC (RACGP).\n`;
        if (lesion.cryoGuidelineHint) {
            lines += `    - Guideline basis: ${lesion.cryoGuidelineHint}\n`;
        }
        if (lesion.cryoRecallRepeat) {
            lines += `    - Further cryotherapy recall requested${lesion.cryoSessionInterval ? ' in ' + lesion.cryoSessionInterval : ''}.\n`;
        }
    }
    if (lesion.topicalNotes) {
        lines += `    - Treatment counselling notes: ${lesion.topicalNotes}\n`;
    }
    if (lesion.topicalFollowUp && lesion.topicalFollowUp !== 'none') {
        lines += `    - Topical / field follow-up plan: ${lesion.topicalFollowUp}\n`;
    }
    return lines;
}

function formatTopicalTableBadge(lesion) {
    if (!isTopicalPlan(lesion.plan)) return lesion.plan || '';
    const decision = formatTopicalDecisionText(lesion);
    return decision ? `Topical / Field Treatment (${decision})` : 'Topical / Field Treatment';
}

function getTopicalReceptionBits() {
    return lesions.filter(l => isTopicalPlan(l.plan)).map(l => {
        if (l.topicalDecision === 'pdt') {
            const summary = summarizePdtRegions(normalizePdtRegions(l));
            const quote = summary.total > 0 ? ` ${formatPdtMoney(summary.total)} OOP` : '';
            return `Book PDT ${summary.names || 'area TBC'}${quote}`.trim();
        }
        if (l.topicalDecision === 'cryotherapy') {
            return '';
        }
        if (l.topicalDecision === 'efudix') {
            const course = formatEfudixCourseText(l);
            return course ? `Efudix script (${course})` : 'Efudix script';
        }
        if (l.topicalDecision === 'efudix-calcipotriol') {
            const course = formatComboCourseText(l);
            return course ? `Efudix + Calcipotriol script (${course})` : 'Efudix + Calcipotriol script';
        }
        if (l.topicalDecision === 'aldara') return 'Aldara script';
        return '';
    }).filter(Boolean);
}

/* Patient-facing actinic keratosis (sun spot) treatment comparison */

const AK_COMPARISON_ROWS = [
    { id: 'what', label: 'What it is' },
    { id: 'bestFor', label: 'Best for' },
    { id: 'course', label: 'How long / visits' },
    { id: 'reaction', label: 'How your skin reacts' },
    { id: 'cost', label: 'Usual cost' },
    { id: 'know', label: 'Good to know' }
];

const AK_COMPARISON_OPTIONS = [
    {
        id: 'cryotherapy',
        short: 'Cryotherapy',
        full: 'Cryotherapy (freezing)',
        kind: 'Individual spots',
        cells: {
            what: 'Liquid nitrogen freeze of selected sun spots, done in the clinic.',
            bestFor: 'A small number of separate spots — not a whole field of sun damage.',
            course: 'Minutes in clinic. Some spots need a second freeze later.',
            reaction: 'Short sting, then a blister and scab over 1–3 weeks. The spot can stay paler.',
            cost: 'Usually a clinic Medicare item rather than a cream script.',
            know: 'Treats the spot you can see. It does not treat surrounding sun-damaged skin.'
        }
    },
    {
        id: 'efudix',
        short: 'Efudix',
        full: 'Efudix (5-fluorouracil)',
        kind: 'Home field cream',
        cells: {
            what: 'A prescription cream that treats a field of sun-damaged skin at home.',
            bestFor: 'An area with many sun spots (face, scalp, hands, forearms).',
            course: 'Usually 2–4 weeks, once or twice daily, as prescribed.',
            reaction: 'Redness, stinging and crusting that typically peaks in week 2–3. This means it is working. The skin then heals over the following weeks.',
            cost: 'Usually a PBS cream when eligible — generally the lowest-cost field option.',
            know: 'Avoid strong sun on the treated area. Do not use on eyelids, lips or groin unless specifically instructed.'
        }
    },
    {
        id: 'efudix-calcipotriol',
        short: 'Efudix + Calcipotriol',
        full: 'Combination Efudix + Calcipotriol',
        kind: 'Short home course',
        cells: {
            what: 'Efudix used together with a vitamin D cream (calcipotriol) for a shorter, stronger field treatment.',
            bestFor: 'A field of sun spots when a brief course is preferred over weeks of cream.',
            course: 'Often around 4 consecutive days, twice daily — only for the exact days prescribed.',
            reaction: 'Often stronger and faster than Efudix alone: marked redness, burning and crusting can appear quickly, then settle.',
            cost: 'Two creams. Calcipotriol may be a private script depending on PBS rules.',
            know: 'Do not exceed the prescribed number of days. Avoid eyelids. Contact the clinic if the reaction is severe (phone or photos).'
        }
    },
    {
        id: 'aldara',
        short: 'Aldara',
        full: 'Aldara (imiquimod)',
        kind: 'Home immune cream',
        cells: {
            what: 'A cream that stimulates your immune system to clear selected sun spots or a mapped field.',
            bestFor: 'Selected spots or a field when an immune-based cream is suitable.',
            course: 'Typically several nights a week for a number of weeks, with rest nights built in.',
            reaction: 'Redness, crusting and weeping. Some people feel flu-like (aches, mild fever) after early doses.',
            cost: 'A prescription cream. PBS eligibility depends on the diagnosis and listing.',
            know: 'Stop and contact the clinic if fever is severe, redness spreads rapidly, or the eye is involved.'
        }
    },
    {
        id: 'pdt',
        short: 'Red Light PDT',
        full: 'Red Light PDT',
        kind: 'Clinic field treatment',
        cells: {
            what: 'A photosensitising cream applied in clinic, then activated with red light.',
            bestFor: 'A field of sun damage when you prefer treatment completed in clinic rather than weeks of home cream.',
            course: 'Usually 1–2 clinic visits. Allow extra time on the day (cream incubation then light).',
            reaction: 'A sunburn look — red, swollen and crusted — often worse for 3–7 days, then peeling over 1–2 weeks.',
            cost: 'Usually a private clinic fee (quoted for the body area if PDT is chosen).',
            know: 'You will be extra sensitive to daylight and strong indoor light for at least 24–48 hours. Stay indoors as advised.'
        }
    }
];

let akComparisonRecord = emptyAkComparisonRecord();

function emptyAkComparisonRecord() {
    return { explained: false, explainedAt: '', visitDate: '', optionIds: [] };
}

function akComparisonEsc(value) {
    return typeof escapeHtml === 'function' ? escapeHtml(value) : String(value ?? '');
}

function akComparisonWasExplainedToday() {
    const today = typeof todayVisitKey === 'function' ? todayVisitKey() : '';
    if (akComparisonRecord.explained && akComparisonRecord.visitDate === today) return true;
    const chart = typeof currentManagedChart === 'function' ? currentManagedChart() : null;
    return !!(chart?.akComparison?.explained && chart.akComparison.visitDate === today);
}

function applyChartAkComparison(record) {
    const today = typeof todayVisitKey === 'function' ? todayVisitKey() : '';
    if (record?.explained && record.visitDate === today) {
        akComparisonRecord = {
            explained: true,
            explainedAt: record.explainedAt || '',
            visitDate: record.visitDate,
            optionIds: Array.isArray(record.optionIds) ? record.optionIds.slice() : AK_COMPARISON_OPTIONS.map((opt) => opt.id)
        };
        updateAkComparisonControls();
        return;
    }
    akComparisonRecord = emptyAkComparisonRecord();
    updateAkComparisonControls();
}

function collectChartAkComparison() {
    if (!akComparisonRecord.explained) return emptyAkComparisonRecord();
    return {
        explained: true,
        explainedAt: akComparisonRecord.explainedAt,
        visitDate: akComparisonRecord.visitDate,
        optionIds: akComparisonRecord.optionIds.slice()
    };
}

function selectedAkComparisonOptions() {
    const ids = getDiscussedTreatmentIds().filter((id) => id && id !== TOPICAL_DECISION_DECLINED);
    const picked = ids.map((id) => AK_COMPARISON_OPTIONS.find((opt) => opt.id === id)).filter(Boolean);
    return picked.length ? picked : AK_COMPARISON_OPTIONS.slice();
}

function buildAkComparisonTableHtml(options) {
    const cols = options || selectedAkComparisonOptions();
    const head = '<thead><tr><th scope="col">Compare</th>' + cols.map((opt) => {
        return `<th scope="col"><span class="ak-compare-name">${akComparisonEsc(opt.short)}</span><span class="ak-compare-kind">${akComparisonEsc(opt.kind)}</span></th>`;
    }).join('') + '</tr></thead>';
    const body = '<tbody>' + AK_COMPARISON_ROWS.map((row) => {
        const cells = cols.map((opt) => `<td>${akComparisonEsc(opt.cells[row.id] || '')}</td>`).join('');
        return `<tr><th scope="row">${akComparisonEsc(row.label)}</th>${cells}</tr>`;
    }).join('') + '</tbody>';
    return head + body;
}

function renderAkComparisonTable() {
    const table = document.getElementById('akComparisonTable');
    if (!table) return;
    table.innerHTML = buildAkComparisonTableHtml();
}

function updateAkComparisonControls() {
    const explained = akComparisonWasExplainedToday();
    const showBtns = [
        document.getElementById('btnShowAkComparison'),
        document.getElementById('btnInspShowAkComparison')
    ];
    showBtns.forEach((btn) => {
        if (!btn) return;
        btn.textContent = explained ? 'Comparison explained' : 'Show comparison chart';
        btn.classList.toggle('is-explained', explained);
    });
    const markBtn = document.getElementById('btnAkComparisonExplained');
    if (markBtn) {
        markBtn.textContent = explained ? 'Explained — recorded in IEMR' : 'Explained';
        markBtn.classList.toggle('is-explained', explained);
    }
}

function buildAkComparisonPrintHtml(options) {
    const cols = options || selectedAkComparisonOptions();
    const clinic = (typeof clinicProfile !== 'undefined' && clinicProfile?.name) ? clinicProfile.name : 'DermRecord';
    const patient = (typeof currentPatient !== 'undefined' && currentPatient?.name) ? currentPatient.name : '';
    const discussed = cols.map((opt) => opt.full).join('; ');
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Sun-spot treatment comparison</title>
    <style>
        body { font-family: "Segoe UI", Tahoma, sans-serif; color: #1a1a1a; margin: 16px; }
        h1 { font-size: 18px; margin: 0 0 4px; }
        p { font-size: 12px; line-height: 1.4; margin: 0 0 10px; }
        table { width: 100%; border-collapse: collapse; font-size: 11px; }
        th, td { border: 1px solid #8a8a8a; padding: 6px 8px; vertical-align: top; text-align: left; }
        thead th { background: #145c3d; color: #fff; }
        tbody th { background: #e7f3ee; width: 18%; }
        .kind { display: block; font-size: 10px; font-weight: 600; opacity: 0.85; }
        @media print { body { margin: 8mm; } }
    </style>
</head>
<body>
    <h1>Comparing treatments for sun spots</h1>
    <p>${akComparisonEsc(clinic)}${patient ? ' · ' + akComparisonEsc(patient) : ''}<br>
    Options discussed: ${akComparisonEsc(discussed)}.</p>
    <table>${buildAkComparisonTableHtml(cols)}</table>
    <p>General comparison only — not a personal prescription. Exact days, PBS eligibility, and fees depend on your skin, the body area, and the option you choose.</p>
    <script>window.onload = function () { window.print(); };<\/script>
</body>
</html>`;
}

function printAkComparisonChart() {
    const cols = selectedAkComparisonOptions();
    const printWin = window.open('', '_blank', 'width=1100,height=800');
    if (!printWin) {
        if (typeof showToast === 'function') showToast('Unable to open print window. Please check popup permissions.');
        return;
    }
    printWin.document.open();
    printWin.document.write(buildAkComparisonPrintHtml(cols));
    printWin.document.close();
}

function openAkComparisonModal() {
    renderAkComparisonTable();
    updateAkComparisonControls();
    const modal = document.getElementById('akComparisonModal');
    if (modal) modal.classList.remove('hidden');
}

function closeAkComparisonModal() {
    const modal = document.getElementById('akComparisonModal');
    if (modal) modal.classList.add('hidden');
}

function markAkComparisonDiscussedOnForm() {
    AK_COMPARISON_OPTIONS.forEach((opt) => {
        const box = document.querySelector(`input[name="topicalDiscussed"][value="${opt.id}"]`);
        if (box) box.checked = true;
    });
    if (typeof updateTopicalFieldVisibility === 'function') updateTopicalFieldVisibility();
}

function markAkComparisonExplained() {
    if (typeof requireCurrentPatient === 'function' && !requireCurrentPatient('Open a patient chart before recording that the comparison was explained.')) {
        return;
    }
    const optionIds = selectedAkComparisonOptions().map((opt) => opt.id);
    akComparisonRecord = {
        explained: true,
        explainedAt: new Date().toISOString(),
        visitDate: typeof todayVisitKey === 'function' ? todayVisitKey() : '',
        optionIds
    };
    updateAkComparisonControls();
    if (typeof updateOutput === 'function') updateOutput();
    if (typeof scheduleChartSave === 'function') scheduleChartSave();
    if (typeof showToast === 'function') {
        showToast('Comparison marked as explained. IEMR now includes the options discussed.');
    }
}

function generateAkComparisonEmrSection() {
    if (!akComparisonWasExplainedToday()) return '';
    const optionIds = (akComparisonRecord.optionIds || []).length
        ? akComparisonRecord.optionIds
        : AK_COMPARISON_OPTIONS.map((opt) => opt.id);
    const options = optionIds.map((id) => AK_COMPARISON_OPTIONS.find((opt) => opt.id === id)).filter(Boolean);
    let txt = `=== ACTINIC KERATOSIS TREATMENT COMPARISON (EXPLAINED) ===\n\n`;
    txt += `- A visual comparison chart of topical and red-light PDT options for actinic keratoses (sun spots) was shown and explained to the patient today to support shared decision-making.\n`;
    txt += `- Options compared: ${options.map((opt) => opt.full).join('; ')}.\n`;
    txt += `- Key points covered for each option (what it is, who it suits, course/visits, expected skin reaction, usual cost category, and precautions).\n\n`;
    options.forEach((opt) => {
        txt += `${opt.full} (${opt.kind}):\n`;
        AK_COMPARISON_ROWS.forEach((row) => {
            const cell = opt.cells[row.id];
            if (cell) txt += `    - ${row.label}: ${cell}\n`;
        });
        txt += `\n`;
    });
    txt += `- Patient invited to ask questions. Suitability, PBS eligibility, and the exact regimen were discussed as they apply to this patient. Final choice is recorded against the lesion plan if a treatment was selected today.\n\n`;
    return txt;
}
