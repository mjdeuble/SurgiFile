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
    savePdtPriceList();
}

function savePdtPriceList() {
    try {
        localStorage.setItem(PDT_PRICE_STORAGE_KEY, JSON.stringify(pdtPriceList));
    } catch (err) {
        showToast('Unable to save PDT prices on this device.');
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

function initTopicalModule() {
    loadPdtPriceList();
    renderPdtAreaSelect();
    renderPdtPriceEditor();
    renderAkComparisonTable();
    updateAkComparisonControls();
}

function renderPdtAreaSelect(selectedId) {
    const select = document.getElementById('pdtAreaSelect');
    if (!select) return;
    const current = selectedId || select.value;
    if (pdtPriceList.length === 0) {
        select.innerHTML = '<option value="">No PDT areas saved yet — add one below</option>';
        return;
    }
    select.innerHTML = '<option value="">Select PDT body area...</option>' + pdtPriceList.map(item => {
        return `<option value="${item.id}">${item.area} (${formatPdtMoney(item.price)})</option>`;
    }).join('');
    if (current && pdtPriceList.some(item => item.id === current)) {
        select.value = current;
    }
    updatePdtQuotePreview();
}

function renderPdtPriceEditor() {
    const list = document.getElementById('pdtPriceEditorList');
    if (!list) return;
    if (pdtPriceList.length === 0) {
        list.innerHTML = `<p class="text-[11px] text-teal-800 italic">No body areas yet. Add an area and fee below — it is saved on this device.</p>`;
        return;
    }
    list.innerHTML = pdtPriceList.map(item => `
        <div class="grid grid-cols-12 gap-2 items-center">
            <input type="text" value="${item.area.replace(/"/g, '&quot;')}" onchange="updatePdtPriceArea('${item.id}', this.value)" class="col-span-6 p-1.5 border border-teal-300 rounded bg-white text-[11px]">
            <div class="col-span-4 flex items-center gap-1">
                <span class="text-[11px] text-teal-900">$</span>
                <input type="number" min="0" step="1" value="${item.price || ''}" onchange="updatePdtPriceAmount('${item.id}', this.value)" placeholder="0" class="w-full p-1.5 border border-teal-300 rounded bg-white text-[11px]">
            </div>
            <button type="button" onclick="removePdtPriceArea('${item.id}')" class="col-span-2 text-[11px] font-bold text-red-600 hover:text-red-800 cursor-pointer">Remove</button>
        </div>
    `).join('');
}

function updatePdtPriceArea(id, area) {
    const item = getPdtAreaById(id);
    if (!item) return;
    item.area = area.trim() || item.area;
    savePdtPriceList();
    renderPdtAreaSelect(id);
    renderPdtPriceEditor();
}

function updatePdtPriceAmount(id, price) {
    const item = getPdtAreaById(id);
    if (!item) return;
    item.price = Math.max(0, Number(price) || 0);
    savePdtPriceList();
    renderPdtAreaSelect(id);
    renderPdtPriceEditor();
    updatePdtQuotePreview();
}

function removePdtPriceArea(id) {
    pdtPriceList = pdtPriceList.filter(item => item.id !== id);
    savePdtPriceList();
    renderPdtAreaSelect();
    renderPdtPriceEditor();
}

function addPdtPriceArea() {
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
    savePdtPriceList();
    if (areaInput) areaInput.value = '';
    if (priceInput) priceInput.value = '';
    renderPdtAreaSelect(id);
    renderPdtPriceEditor();
    showToast('PDT area saved on this device.');
}

function isPdtRelevant() {
    const discussed = getDiscussedTreatmentIds();
    const decision = document.querySelector('input[name="topicalDecision"]:checked')?.value || '';
    return discussed.includes('pdt') || decision === 'pdt';
}

function getDiscussedTreatmentIds() {
    return Array.from(document.querySelectorAll('input[name="topicalDiscussed"]:checked')).map(el => el.value);
}

function updateTopicalFieldVisibility() {
    const pdtPanel = document.getElementById('pdtQuotePanel');
    if (pdtPanel) {
        if (isPdtRelevant()) pdtPanel.classList.remove('hidden');
        else pdtPanel.classList.add('hidden');
    }
    updatePdtQuotePreview();
}

function handleTopicalDecisionChange() {
    const decision = document.querySelector('input[name="topicalDecision"]:checked')?.value || '';
    if (decision === 'pdt') {
        const pdtDiscussed = document.querySelector('input[name="topicalDiscussed"][value="pdt"]');
        if (pdtDiscussed) pdtDiscussed.checked = true;
    }
    updateTopicalFieldVisibility();
}

function updatePdtQuotePreview() {
    const preview = document.getElementById('pdtQuotePreview');
    if (!preview) return;
    const areaId = document.getElementById('pdtAreaSelect')?.value || '';
    const item = getPdtAreaById(areaId);
    if (!item) {
        preview.textContent = 'Select a saved body area to pull the stored PDT fee.';
        return;
    }
    preview.textContent = item.price > 0
        ? `Quoted fee for ${item.area}: ${formatPdtMoney(item.price)} OOP`
        : `${item.area} is in the list, but no PDT fee has been set yet.`;
}

function resetTopicalForm() {
    document.querySelectorAll('input[name="topicalDiscussed"]').forEach(el => { el.checked = false; });
    const declined = document.querySelector('input[name="topicalDecision"][value="declined"]');
    document.querySelectorAll('input[name="topicalDecision"]').forEach(el => { el.checked = false; });
    if (declined) declined.checked = false;
    const notes = document.getElementById('topicalNotes');
    if (notes) notes.value = '';
    const select = document.getElementById('pdtAreaSelect');
    if (select) select.value = '';
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
    renderPdtAreaSelect(item.pdtAreaId || '');
    updateTopicalFieldVisibility();
}

function readTopicalFieldsFromForm() {
    const discussed = getDiscussedTreatmentIds();
    const decision = document.querySelector('input[name="topicalDecision"]:checked')?.value || '';
    const areaId = document.getElementById('pdtAreaSelect')?.value || '';
    const area = getPdtAreaById(areaId);
    return {
        topicalDiscussed: discussed,
        topicalDecision: decision,
        topicalNotes: document.getElementById('topicalNotes')?.value.trim() || '',
        topicalFollowUp: document.getElementById('topicalFollowUp')?.value || 'none',
        pdtAreaId: area ? area.id : '',
        pdtAreaName: area ? area.area : '',
        pdtQuotedPrice: area ? Number(area.price) || 0 : 0
    };
}

function emptyTopicalFields() {
    return {
        topicalDiscussed: [],
        topicalDecision: '',
        topicalNotes: '',
        topicalFollowUp: 'none',
        pdtAreaId: '',
        pdtAreaName: '',
        pdtQuotedPrice: 0
    };
}

function formatTopicalDecisionText(lesion) {
    if (!lesion || !lesion.topicalDecision) return '';
    if (lesion.topicalDecision === TOPICAL_DECISION_DECLINED) {
        return 'Declined treatment after discussion';
    }
    let text = topicalLabel(lesion.topicalDecision);
    if (lesion.topicalDecision === 'pdt' && lesion.pdtAreaName) {
        text += ` — ${lesion.pdtAreaName}`;
        if (lesion.pdtQuotedPrice > 0) {
            text += ` (quoted ${formatPdtMoney(lesion.pdtQuotedPrice)} OOP)`;
        }
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
            const quote = l.pdtQuotedPrice > 0 ? ` ${formatPdtMoney(l.pdtQuotedPrice)} OOP` : '';
            return `PDT ${l.pdtAreaName || 'area TBC'}${quote}`.trim();
        }
        if (l.topicalDecision === 'cryotherapy') return 'Cryotherapy';
        if (l.topicalDecision === 'efudix') return 'Efudix script';
        if (l.topicalDecision === 'efudix-calcipotriol') return 'Efudix + Calcipotriol script';
        if (l.topicalDecision === 'aldara') return 'Aldara script';
        if (l.topicalDecision === TOPICAL_DECISION_DECLINED) return 'Topical Rx declined';
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

function renderAkComparisonTable() {
    const table = document.getElementById('akComparisonTable');
    if (!table) return;
    const head = '<thead><tr><th scope="col">Compare</th>' + AK_COMPARISON_OPTIONS.map((opt) => {
        return `<th scope="col"><span class="ak-compare-name">${akComparisonEsc(opt.short)}</span><span class="ak-compare-kind">${akComparisonEsc(opt.kind)}</span></th>`;
    }).join('') + '</tr></thead>';
    const body = '<tbody>' + AK_COMPARISON_ROWS.map((row) => {
        const cells = AK_COMPARISON_OPTIONS.map((opt) => `<td>${akComparisonEsc(opt.cells[row.id] || '')}</td>`).join('');
        return `<tr><th scope="row">${akComparisonEsc(row.label)}</th>${cells}</tr>`;
    }).join('') + '</tbody>';
    table.innerHTML = head + body;
}

function updateAkComparisonControls() {
    const explained = akComparisonWasExplainedToday();
    const showBtns = [
        document.getElementById('btnShowAkComparison')
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
    akComparisonRecord = {
        explained: true,
        explainedAt: new Date().toISOString(),
        visitDate: typeof todayVisitKey === 'function' ? todayVisitKey() : '',
        optionIds: AK_COMPARISON_OPTIONS.map((opt) => opt.id)
    };
    markAkComparisonDiscussedOnForm();
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
