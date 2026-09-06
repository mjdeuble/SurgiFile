/* MBS suggestions from procedure region, lesion type, size, and reconstruction.
   Biopsy: 30071 (TN.8.7). Excision: 31356–31383 from TN.8.125 NED and region.
   Flap 45201 follows TN.8.93. Same-day consult 23 is optional (AN.0.9 / MBSM01).
   Confirm against the current MBS before claiming. */

const DEFAULT_CONSULT_BILLING = 'Private Bill';
const DEFAULT_BIOPSY_BILLING = '$20 OOP per biopsy (Item 30071)';
const CONSULT_BILLING_VALUES = ['Private Bill', 'Bulk Bill', 'DVA'];
const BIOPSY_BILLING_OOP = '$20 OOP per biopsy (Item 30071)';
const BIOPSY_BILLING_BULK = 'Bulk Billed ($0 OOP)';

function normalizeConsultBilling(value) {
    const raw = String(value || '').trim();
    if (CONSULT_BILLING_VALUES.includes(raw)) return raw;
    if (/dva/i.test(raw)) return 'DVA';
    if (/bulk/i.test(raw)) return 'Bulk Bill';
    if (/private/i.test(raw)) return 'Private Bill';
    return DEFAULT_CONSULT_BILLING;
}

function normalizeBiopsyBilling(value) {
    const raw = String(value || '').trim();
    if (/bulk/i.test(raw) || /\$0/.test(raw)) return BIOPSY_BILLING_BULK;
    return BIOPSY_BILLING_OOP;
}

function biopsyOopUnitAmount(biopsyBilling) {
    return normalizeBiopsyBilling(biopsyBilling) === BIOPSY_BILLING_OOP ? 20 : 0;
}

function currentConsultBilling() {
    const chart = typeof currentManagedChart === 'function' ? currentManagedChart() : null;
    if (chart && chart.consultBilling) return normalizeConsultBilling(chart.consultBilling);
    return normalizeConsultBilling(document.getElementById('modalConsultBilling')?.value);
}

function currentBiopsyBilling() {
    const chart = typeof currentManagedChart === 'function' ? currentManagedChart() : null;
    if (chart && chart.biopsyBilling) return normalizeBiopsyBilling(chart.biopsyBilling);
    return normalizeBiopsyBilling(document.getElementById('modalBiopsyBilling')?.value);
}

function sessionBiopsyCount() {
    const exam = typeof getBiopsyLesions === 'function' ? getBiopsyLesions() : [];
    const ids = new Set(exam.map((item) => String(item.id)));
    let count = exam.length;
    if (typeof procedureSelectedLesions === 'function') {
        procedureSelectedLesions().forEach((lesion) => {
            const id = String(lesion.id || '');
            if (!id || ids.has(id)) return;
            const plan = String(lesion.plan || '');
            const diagnostic = typeof isDiagnosticBiopsyForBilling === 'function' && isDiagnosticBiopsyForBilling(lesion);
            const shave = typeof isShaveBiopsyLesion === 'function' && isShaveBiopsyLesion(lesion);
            if (diagnostic || shave || plan.includes('Biopsy')) {
                ids.add(id);
                count += 1;
            }
        });
    }
    return count;
}

function applyPatientBillingToDom(billing) {
    const consult = normalizeConsultBilling(billing?.consultBilling);
    const biopsy = normalizeBiopsyBilling(billing?.biopsyBilling);
    ['modalConsultBilling', 'billingModalConsult'].forEach((id) => {
        const el = document.getElementById(id);
        if (el) el.value = consult;
    });
    ['modalBiopsyBilling', 'billingModalBiopsy'].forEach((id) => {
        const el = document.getElementById(id);
        if (el) el.value = biopsy;
    });
    updateChartBillingButtonStatus(consult, biopsy);
}

function persistPatientBilling(billing) {
    if (typeof applyingChartRecord !== 'undefined' && applyingChartRecord) return;
    const consult = normalizeConsultBilling(
        billing?.consultBilling ?? document.getElementById('modalConsultBilling')?.value
    );
    const biopsy = normalizeBiopsyBilling(
        billing?.biopsyBilling ?? document.getElementById('modalBiopsyBilling')?.value
    );
    applyPatientBillingToDom({ consultBilling: consult, biopsyBilling: biopsy });
    const chart = typeof currentManagedChart === 'function' ? currentManagedChart() : null;
    if (chart) {
        chart.consultBilling = consult;
        chart.biopsyBilling = biopsy;
        if (typeof scheduleChartSave === 'function') scheduleChartSave();
    }
    if (typeof updateOutput === 'function') updateOutput();
}

function persistPatientBillingFromDom() {
    persistPatientBilling();
}

function receptionBiopsyBillingBit(count, bBilling) {
    if (!count) return '';
    const oopUnit = biopsyOopUnitAmount(bBilling);
    const oopTotal = count * oopUnit;
    if (oopTotal > 0) return `Biopsy OOP: $${oopTotal} Total`;
    return 'Biopsy Bulk Bill';
}

function updateChartBillingButtonStatus(consult, biopsy) {
    const status = document.getElementById('textChartBillingStatus');
    if (!status) return;
    const consultLabel = normalizeConsultBilling(consult ?? currentConsultBilling());
    const biopsyVal = normalizeBiopsyBilling(biopsy ?? currentBiopsyBilling());
    const biopsyLabel = biopsyOopUnitAmount(biopsyVal) > 0 ? '$20 OOP' : 'Bulk Bill';
    status.textContent = consultLabel + ' · Biopsy ' + biopsyLabel;
}

function openPatientBillingModal() {
    if (typeof requireCurrentPatient === 'function' && !requireCurrentPatient('Open a patient chart before changing billing.')) {
        return;
    }
    applyPatientBillingToDom({
        consultBilling: currentConsultBilling(),
        biopsyBilling: currentBiopsyBilling()
    });
    const modal = document.getElementById('patientBillingModal');
    if (modal) modal.classList.remove('hidden');
}

function closePatientBillingModal() {
    const modal = document.getElementById('patientBillingModal');
    if (modal) modal.classList.add('hidden');
}

function savePatientBillingModal() {
    persistPatientBilling({
        consultBilling: document.getElementById('billingModalConsult')?.value,
        biopsyBilling: document.getElementById('billingModalBiopsy')?.value
    });
    closePatientBillingModal();
    if (typeof showToast === 'function') showToast('Billing settings saved to this chart.');
}

function readAddPatientBilling() {
    return {
        consultBilling: normalizeConsultBilling(document.getElementById('chartPatientConsultBilling')?.value),
        biopsyBilling: normalizeBiopsyBilling(document.getElementById('chartPatientBiopsyBilling')?.value)
    };
}

const MBS_BODY_AREA_GROUPS = [
    {
        region: 1,
        label: 'Region 1 — nose, eyelid, eyebrow, lip, ear, digit, genitalia',
        areas: [
            { id: 'nose', label: 'Nose' },
            { id: 'eyelid', label: 'Eyelid' },
            { id: 'eyebrow', label: 'Eyebrow' },
            { id: 'lip', label: 'Lip' },
            { id: 'ear', label: 'Ear' },
            { id: 'digit', label: 'Digit (finger or toe)' },
            { id: 'genitalia', label: 'Genitalia' },
            { id: 'region1_contiguous', label: 'Contiguous to a region 1 site' }
        ]
    },
    {
        region: 2,
        label: 'Region 2 — face, neck, scalp, nipple-areola, distal limb',
        areas: [
            { id: 'face', label: 'Face (not nose, eyelid, eyebrow, lip, or ear)' },
            { id: 'neck', label: 'Neck' },
            { id: 'scalp', label: 'Scalp' },
            { id: 'nipple_areola', label: 'Nipple-areola complex' },
            { id: 'distal_lower_limb', label: 'Distal lower limb (knee and below)' },
            { id: 'distal_upper_limb', label: 'Distal upper limb (wrist / hand)' }
        ]
    },
    {
        region: 3,
        label: 'Region 3 — remainder of body',
        areas: [
            { id: 'trunk', label: 'Trunk (chest, abdomen, back)' },
            { id: 'proximal_upper_limb', label: 'Proximal upper limb (above wrist)' },
            { id: 'proximal_lower_limb', label: 'Proximal lower limb (above knee)' },
            { id: 'region3_other', label: 'Other site not in region 1 or 2' }
        ]
    }
];

const BILLING_LESION_TYPES = [
    { id: 'benign', label: 'Benign' },
    { id: 'malignant', label: 'Malignant' },
    { id: 'confirmed_melanoma', label: 'Confirmed melanoma excision' },
    { id: 'suspected_melanoma', label: 'Suspected melanoma' }
];

const BILLING_RECONSTRUCTIONS = [
    { id: 'ellipse', label: 'Simple ellipse' },
    { id: 'flap', label: 'Flap' },
    { id: 'graft', label: 'Graft' },
    { id: 'flap_graft', label: 'Flap + graft' }
];

const FLAP_COMPATIBLE_ITEMS = new Set([
    '31358', '31359', '31360', '31363', '31364', '31369', '31370',
    '31371', '31373', '31376', '31378', '31380', '31383'
]);

const MBS_PROCEDURE_AREAS = [
    { region: 1, label: 'Region 1 — nose, eyelid, eyebrow, lip, ear, digit, genitalia' },
    { region: 2, label: 'Region 2 — face, neck, scalp, nipple-areola, distal limb' },
    { region: 3, label: 'Region 3 — remainder of body' }
];

function allMbsBodyAreas() {
    return MBS_BODY_AREA_GROUPS.flatMap((group) => group.areas.map((area) => ({
        ...area,
        region: group.region,
        groupLabel: group.label
    })));
}

function getMbsBodyArea(id) {
    return allMbsBodyAreas().find((area) => area.id === id) || null;
}

function billingRegionFromBodyArea(id) {
    return getMbsBodyArea(id)?.region || '';
}

function resolveBillingRegion(lesion) {
    const direct = Number(lesion?.billingRegion);
    if (direct === 1 || direct === 2 || direct === 3) return direct;
    return Number(billingRegionFromBodyArea(lesion?.bodyAreaId)) || null;
}

function procedureAreaLabel(region) {
    const n = Number(region);
    return MBS_PROCEDURE_AREAS.find((area) => area.region === n)?.label || (n ? `Region ${n}` : '');
}

function populateProcedureAreaSelect(selectEl, selectedRegion) {
    if (!selectEl) return;
    const current = String(selectedRegion || selectEl.value || '');
    selectEl.innerHTML = '<option value="">Select procedure area...</option>' +
        MBS_PROCEDURE_AREAS.map((area) =>
            `<option value="${area.region}" ${String(area.region) === current ? 'selected' : ''}>${area.label}</option>`
        ).join('');
}

function populateBodyAreaSelect(selectEl, selectedId) {
    const region = billingRegionFromBodyArea(selectedId) || selectedId;
    populateProcedureAreaSelect(selectEl, region);
}

function parseMm(value) {
    if (value == null || String(value).trim() === '') return null;
    const n = Number(String(value).replace(/[^\d.]/g, ''));
    return Number.isFinite(n) && n >= 0 ? n : null;
}

function necessaryExcisionDiameterMm(lengthMm, widthMm, marginMm) {
    const length = parseMm(lengthMm);
    const width = parseMm(widthMm);
    const margin = parseMm(marginMm);
    if (length == null || width == null || margin == null) return null;
    return (length + width) / 2 + (2 * margin);
}

function sizeBandForRegion(region, nedMm) {
    if (nedMm == null || !Number.isFinite(nedMm)) return null;
    if (region === 1) return nedMm < 6 ? 'small' : 'large';
    if (region === 2) return nedMm < 14 ? 'small' : 'large';
    if (region === 3) {
        if (nedMm < 15) return 'small';
        if (nedMm <= 30) return 'mid';
        return 'large';
    }
    return null;
}

function ellipseItemFor(region, type, band) {
    const table = {
        1: {
            benign: { small: '31357', large: '31360' },
            malignant: { small: '31356', large: '31358' },
            confirmed_melanoma: { small: '31371', large: '31371' },
            suspected_melanoma: { small: '31377', large: '31378' }
        },
        2: {
            benign: { small: '31362', large: '31364' },
            malignant: { small: '31361', large: '31363' },
            confirmed_melanoma: { small: '31372', large: '31373' },
            suspected_melanoma: { small: '31379', large: '31380' }
        },
        3: {
            benign: { small: '31366', mid: '31368', large: '31370' },
            malignant: { small: '31365', mid: '31367', large: '31369' },
            confirmed_melanoma: { small: '31374', mid: '31375', large: '31376' },
            suspected_melanoma: { small: '31381', mid: '31382', large: '31383' }
        }
    };
    return table[region]?.[type]?.[band] || null;
}

function flapCompatibleItemFor(region, type) {
    return ellipseItemFor(region, type, 'large');
}

const CONSULT_ITEM_CODE = '23';

function itemLabel(code, options) {
    const labels = {
        '23': 'Level B consult (same-day attendance)',
        '30071': 'Diagnostic skin biopsy (punch / shave)',
        '31356': 'Malignant, region 1, NED < 6 mm',
        '31357': 'Benign, region 1, NED < 6 mm',
        '31358': 'Malignant, region 1, NED ≥ 6 mm (flap-compatible)',
        '31360': 'Benign, region 1, NED ≥ 6 mm (flap-compatible)',
        '31361': 'Malignant, region 2, NED < 14 mm',
        '31362': 'Benign, region 2, NED < 14 mm',
        '31363': 'Malignant, region 2, NED ≥ 14 mm (flap-compatible)',
        '31364': 'Benign, region 2, NED ≥ 14 mm (flap-compatible)',
        '31365': 'Malignant, region 3, NED < 15 mm',
        '31366': 'Benign, region 3, NED < 15 mm',
        '31367': 'Malignant, region 3, NED 15–30 mm',
        '31368': 'Benign, region 3, NED 15–30 mm',
        '31369': 'Malignant, region 3, NED > 30 mm (flap-compatible)',
        '31370': 'Benign, region 3, NED > 30 mm (flap-compatible)',
        '31371': 'Confirmed melanoma, region 1, NED ≥ 6 mm (flap-compatible)',
        '31372': 'Confirmed melanoma, region 2, NED < 14 mm',
        '31373': 'Confirmed melanoma, region 2, NED ≥ 14 mm (flap-compatible)',
        '31374': 'Confirmed melanoma, region 3, NED < 15 mm',
        '31375': 'Confirmed melanoma, region 3, NED 15–30 mm',
        '31376': 'Confirmed melanoma, region 3, NED > 30 mm (flap-compatible)',
        '31377': 'Suspected melanoma, region 1, NED < 6 mm',
        '31378': 'Suspected melanoma, region 1, NED ≥ 6 mm (flap-compatible)',
        '31379': 'Suspected melanoma, region 2, NED < 14 mm',
        '31380': 'Suspected melanoma, region 2, NED ≥ 14 mm (flap-compatible)',
        '31381': 'Suspected melanoma, region 3, NED < 15 mm',
        '31382': 'Suspected melanoma, region 3, NED 15–30 mm',
        '31383': 'Suspected melanoma, region 3, NED > 30 mm (flap-compatible)',
        '45201': 'Local skin flap (once per defect)',
        '45440': 'Split-skin graft, defect < 40 mm',
        '45443': 'Split-skin graft, defect ≥ 40 mm',
        '45451': 'Full-thickness skin graft, defect ≥ 5 mm'
    };
    let label = labels[code] || 'MBS item';
    if (!options?.flap) label = label.replace(' (flap-compatible)', '');
    return label;
}

function impressionForBilling(lesion) {
    return String(lesion?.impression || lesion?.pathology || '').toLowerCase();
}

function inferBillingLesionType(lesion) {
    if (lesion.billingLesionType) return lesion.billingLesionType;
    const histology = String(lesion.histologyResult || '').toLowerCase();
    if (histology) {
        if (/\bmelanoma\b/.test(histology) && !/exclude melanoma|no melanoma|not melanoma/.test(histology)) {
            return 'confirmed_melanoma';
        }
        if (/\bbcc\b|\bscc\b|basal cell|squamous cell|intraepidermal|bowen|keratoacanthoma|malignant/.test(histology)) {
            return 'malignant';
        }
        if (/benign|seborrheic|seborrhoeic|nevus|naevus|dermatofibroma|hemangioma|cyst|keratosis/.test(histology)) {
            return 'benign';
        }
    }
    const impression = impressionForBilling(lesion);
    if (impression) {
        if (/\bmelanoma\b/.test(impression) && !/exclude melanoma|no melanoma|not melanoma/.test(impression)) {
            return 'suspected_melanoma';
        }
        if (/\bbcc\b|\bscc\b|basal cell|squamous cell|intraepidermal|bowen|keratoacanthoma|malignant/.test(impression)) {
            return 'malignant';
        }
        if (/benign|seborrheic|seborrhoeic|nevus|naevus|dermatofibroma|hemangioma|cyst|keratosis/.test(impression)) {
            return 'benign';
        }
    }
    return '';
}

function firstFilled(...values) {
    for (const value of values) {
        if (value != null && String(value).trim() !== '') return value;
    }
    return '';
}

function closureLooksLikeExcision(value) {
    return /ellipse|flap|graft|secondary/i.test(String(value || ''));
}

function billingProcedureKind(lesion) {
    const detail = typeof procedureDetailForLesion === 'function' ? procedureDetailForLesion(lesion) : {};
    const closure = firstFilled(detail.excisionClosureType, lesion?.excisionClosureType, lesion?.billingReconstruction, lesion?.excisionReconstruction);
    if (closureLooksLikeExcision(closure) || lesion?.excisionFinalisedAt) return 'excision';

    const procedure = String(firstFilled(detail.procedure, lesion?.procedure) || '').trim();
    const punchType = String(firstFilled(detail.punchType, lesion?.punchType) || '').trim();
    const hasNedMeasures = !!(
        firstFilled(lesion?.excisionLengthMm, detail.length) &&
        firstFilled(lesion?.excisionWidthMm, detail.width) &&
        firstFilled(lesion?.excisionMarginMm, detail.margin)
    );
    if (/^excision$/i.test(procedure) || /punch excision/i.test(punchType) || /formal excision/i.test(punchType)) return 'excision';
    if (hasNedMeasures && !/^shave$/i.test(procedure) && !( /^punch$/i.test(procedure) && /biopsy/i.test(punchType || 'Punch Biopsy') )) {
        return 'excision';
    }

    if (/^shave$/i.test(procedure) || /shave/i.test(punchType)) return 'biopsy';
    if (/^punch$/i.test(procedure) || /punch biopsy/i.test(punchType)) return 'biopsy';
    const biopsyType = String(lesion?.biopsyType || '').trim();
    if (/shave/i.test(biopsyType) || (/punch/i.test(biopsyType) && !/excision/i.test(biopsyType))) return 'biopsy';
    if (firstFilled(lesion?.punchSize, detail.punchSize) && !hasNedMeasures) return 'biopsy';
    return procedure || punchType ? 'excision' : '';
}

function isDiagnosticBiopsyForBilling(lesion) {
    return billingProcedureKind(lesion) === 'biopsy';
}

function lesionNedMm(lesion) {
    const detail = typeof procedureDetailForLesion === 'function' ? procedureDetailForLesion(lesion) : {};
    const length = lesion?.excisionLengthMm || detail.length;
    const width = lesion?.excisionWidthMm || detail.width;
    const marginRaw = lesion?.excisionMarginMm || lesion?.excisionMargin || detail.margin || '';
    const margin = String(marginRaw).replace(/[^\d.]/g, '');
    const ellipse = necessaryExcisionDiameterMm(length, width, margin);
    if (ellipse != null) return ellipse;
    const punch = parseMm(lesion?.punchSize || detail.punchSize);
    if (Number.isFinite(punch) && punch > 0) return punch;
    return null;
}

function composeClaimCodes(procedureSummary, excludeConsult) {
    const proc = String(procedureSummary || '').trim();
    if (excludeConsult) return proc;
    if (!proc) return CONSULT_ITEM_CODE;
    const parts = proc.split(/\s*\+\s*/).map((part) => part.trim()).filter(Boolean);
    if (parts.includes(CONSULT_ITEM_CODE)) return parts.join(' + ');
    return CONSULT_ITEM_CODE + ' + ' + proc;
}

function procedureCodesOnly(claim) {
    return String(claim || '')
        .split(/\s*\+\s*/)
        .map((part) => part.trim())
        .filter((part) => part && part !== CONSULT_ITEM_CODE)
        .join(' + ');
}

function hasCompletedExcision(lesion) {
    return !!(lesion && (lesion.excisionFinalisedAt || lesion.excisionLengthMm));
}

function canAssignBillingCodes(lesion) {
    if (isDiagnosticBiopsyForBilling(lesion)) return true;
    const type = inferBillingLesionType(lesion);
    if (type === 'suspected_melanoma') return true;
    if (type && resolveBillingRegion(lesion) && lesionNedMm(lesion) != null) return true;
    return !!(lesion && lesion.histologyResult && type);
}

function shouldClaimFlapGraft(lesion) {
    if (lesion.includeFlapGraft === false || lesion.includeFlapGraft === 'false') return false;
    if (lesion.includeFlapGraft === true || lesion.includeFlapGraft === 'true') return true;
    const recon = inferBillingReconstruction(lesion);
    return usesFlap(recon) || usesGraft(recon);
}

function inferBillingReconstruction(lesion) {
    const closure = String(lesion.excisionClosureType || '');
    if (closure === 'Graft + Flap') return 'flap_graft';
    if (closure === 'Flap') return 'flap';
    if (closure === 'Graft') return 'graft';
    if (closure === 'Ellipse' || closure === 'Secondary Intention') return 'ellipse';
    if (lesion.billingReconstruction) return lesion.billingReconstruction;
    const booked = String(lesion.excisionReconstruction || '');
    if (booked.includes('Flap') && booked.includes('Graft')) return 'flap_graft';
    if (booked.includes('Flap')) return 'flap';
    if (booked.includes('Graft')) return 'graft';
    return 'ellipse';
}

function flapWasUsed(lesion) {
    const detail = typeof procedureDetailForLesion === 'function' ? procedureDetailForLesion(lesion) : {};
    const closure = firstFilled(detail.excisionClosureType, lesion?.excisionClosureType);
    if (closure === 'Flap' || closure === 'Graft + Flap') return true;
    if (closure === 'Ellipse' || closure === 'Secondary Intention' || closure === 'Graft') return false;
    return usesFlap(inferBillingReconstruction(lesion));
}

function graftWasUsed(lesion) {
    return usesGraft(inferBillingReconstruction(lesion));
}

const EXCISION_CLOSURE_OPTIONS = [
    { value: 'Ellipse', label: 'Simple ellipse' },
    { value: 'Secondary Intention', label: 'Secondary intention' },
    { value: 'Flap', label: 'Flap' },
    { value: 'Graft', label: 'Graft' },
    { value: 'Graft + Flap', label: 'Flap + Graft' }
];

function reconstructionToClosureType(recon) {
    const text = String(recon || '');
    if (recon === 'flap_graft' || (text.includes('Flap') && text.includes('Graft')) || text.includes('Graft + Flap')) return 'Graft + Flap';
    if (recon === 'flap' || text.includes('Flap')) return 'Flap';
    if (recon === 'graft' || text.includes('Graft')) return 'Graft';
    if (text.includes('Secondary')) return 'Secondary Intention';
    return 'Ellipse';
}

function normalizeExcisionClosure(lesion) {
    if (!lesion) return 'Ellipse';
    if (lesion.excisionClosureType && EXCISION_CLOSURE_OPTIONS.some((opt) => opt.value === lesion.excisionClosureType)) {
        return lesion.excisionClosureType;
    }
    return reconstructionToClosureType(lesion.excisionReconstruction || lesion.excisionClosureType || lesion.billingReconstruction);
}

function closureToReconstruction(closure) {
    if (closure === 'Flap') return 'Local Flap Repair';
    if (closure === 'Graft') return 'Full Thickness Skin Graft';
    if (closure === 'Graft + Flap') return 'Local Flap and Skin Graft';
    if (closure === 'Secondary Intention') return 'Healing by Secondary Intention';
    return 'Direct Linear Closure';
}

function closureNeedsGraftType(closure) {
    return closure === 'Graft' || closure === 'Graft + Flap';
}

function usesFlap(recon) {
    return recon === 'flap' || recon === 'flap_graft';
}

function usesGraft(recon) {
    return recon === 'graft' || recon === 'flap_graft';
}

function graftItemFor(lesion, nedMm) {
    const graftType = String(lesion.billingGraftType || lesion.graftType || 'Full-Thickness Skin Graft (FTSG)');
    if (graftType.includes('Split')) {
        if (nedMm == null) return { code: '45440', note: 'Confirm 45440 (< 40 mm) vs 45443 (≥ 40 mm) from defect diameter.' };
        return { code: nedMm >= 40 ? '45443' : '45440' };
    }
    if (nedMm != null && nedMm < 5) {
        return { code: '45451', note: '45451 requires average defect diameter ≥ 5 mm.' };
    }
    return { code: '45451' };
}

function sizeBandOptions(region) {
    if (region === 3) return ['small', 'mid', 'large'];
    return ['small', 'large'];
}

function sizeBandLabel(region, band) {
    if (region === 1) return band === 'small' ? '< 6 mm' : '≥ 6 mm';
    if (region === 2) return band === 'small' ? '< 14 mm' : '≥ 14 mm';
    if (band === 'small') return '< 15 mm';
    if (band === 'mid') return '15–30 mm';
    return '> 30 mm';
}

function suggestMbsItems(lesion) {
    const region = resolveBillingRegion(lesion);
    const type = inferBillingLesionType(lesion);
    const recon = inferBillingReconstruction(lesion);
    const applyFlap = flapWasUsed(lesion);
    const applyGraft = graftWasUsed(lesion);
    const nedMm = lesionNedMm(lesion);
    const notes = [];
    const items = [];
    const kind = billingProcedureKind(lesion);

    if (kind === 'biopsy') {
        items.push({ code: '30071', label: itemLabel('30071') });
        notes.push('TN.8.7: 30071 for diagnostic punch or shave biopsy when the specimen is sent for pathology. If a shave completely removes the lesion, still claim 30071 only. Aftercare is 2 days.');
        if (!region) notes.push('Record the procedure area for the site. Item 30071 is the same for all regions.');
        return {
            region,
            type,
            recon,
            nedMm,
            items,
            notes,
            summary: '30071',
            ready: true,
            kind
        };
    }

    if (!region) {
        return {
            region: '',
            type,
            recon,
            nedMm,
            items,
            notes: ['Select procedure area (Region 1 / 2 / 3). Excision items 31356–31383 are chosen from location and necessary excision diameter (TN.8.125).'],
            summary: '',
            ready: false,
            kind
        };
    }
    if (!type) {
        const band = sizeBandForRegion(region, nedMm);
        if (band) {
            notes.push('Size band from location and NED is ' + sizeBandLabel(region, band) + '. Assign benign, malignant, confirmed melanoma, or suspected melanoma to pick the item.');
        } else {
            notes.push('Assign lesion type, and enter length, width, and margin so NED can be calculated (TN.8.125: (length + width) / 2 + 2 × margin).');
        }
        return {
            region,
            type,
            recon,
            nedMm,
            items,
            notes,
            summary: '',
            ready: false,
            kind
        };
    }

    const band = sizeBandForRegion(region, nedMm);
    let excisionCode = null;
    if (applyFlap) {
        excisionCode = flapCompatibleItemFor(region, type);
        if (band && band !== 'large') {
            notes.push('Flap repair is billed with the flap-compatible (larger-band) excision item plus 45201, even when NED is below that size threshold.');
        }
        if (!band) {
            notes.push('Flap uses the flap-compatible excision item for this region. Enter length, width, and margin to record NED.');
        }
    } else if (band) {
        excisionCode = ellipseItemFor(region, type, band);
    } else {
        const alternatives = sizeBandOptions(region).map((b) => {
            const code = ellipseItemFor(region, type, b);
            return code ? `${code} (${sizeBandLabel(region, b)})` : '';
        }).filter(Boolean);
        notes.push('Enter lesion length, width, and clinical margin to confirm the size band. Possible items: ' + alternatives.join(', ') + '.');
    }

    if (type === 'confirmed_melanoma' && region === 1 && nedMm != null && nedMm < 6) {
        notes.push('31371 requires NED ≥ 6 mm. Wide local excision usually meets this; confirm measurements.');
    }
    if (type === 'malignant' && !lesion.histologyResult) {
        notes.push('Malignant excision items 31356–31376 normally require histological confirmation before claiming. Suspected melanoma items 31377–31383 can be billed before confirmation.');
    }

    if (excisionCode) {
        items.push({ code: excisionCode, label: itemLabel(excisionCode, { flap: applyFlap }) });
    }

    if (applyFlap && excisionCode) {
        if (FLAP_COMPATIBLE_ITEMS.has(excisionCode)) {
            items.push({ code: '45201', label: itemLabel('45201') });
        } else {
            notes.push('This excision item cannot be co-claimed with 45201. Use the larger-band item for the same site if a flap was performed.');
        }
    }

    if (applyGraft) {
        const graft = graftItemFor(lesion, nedMm);
        items.push({ code: graft.code, label: itemLabel(graft.code) });
        if (graft.note) notes.push(graft.note);
        notes.push('Graft items 45440 / 45443 / 45451 are separate from the excision item. Confirm co-claiming against the current MBS for the same defect.');
    }

    if (recon === 'ellipse' && (lesion.excisionClosureType === 'Secondary Intention' || String(lesion.excisionReconstruction || '').includes('Secondary'))) {
        notes.push('Secondary intention is billed as the excision item alone (no 45201).');
    }

    return {
        region,
        type,
        recon,
        nedMm,
        items,
        notes,
        summary: items.map((item) => item.code).join(' + '),
        ready: items.length > 0,
        kind
    };
}

function formatNedDisplay(nedMm) {
    if (nedMm == null || !Number.isFinite(nedMm)) return '';
    const rounded = Math.round(nedMm * 10) / 10;
    return String(rounded);
}

function renderBillingSuggestionHtml(lesion) {
    const suggestion = suggestMbsItems(lesion);
    const areaLabel = procedureAreaLabel(suggestion.region);
    const ned = formatNedDisplay(suggestion.nedMm);
    const codes = suggestion.items.length
        ? suggestion.items.map((item) =>
            `<span class="inline-flex items-center px-2 py-0.5 rounded bg-emerald-100 text-emerald-900 font-bold tracking-wide">${escapeHtml(item.code)}</span>`
        ).join('<span class="text-slate-400 font-bold">+</span>')
        : '<span class="text-slate-400 italic">No item yet</span>';
    const notes = suggestion.notes.map((note) => `<p class="text-[11px] text-slate-500">${escapeHtml(note)}</p>`).join('');
    const sizeText = suggestion.kind === 'biopsy' && ned
        ? ' · Punch ' + ned + ' mm'
        : (ned ? ' · NED ' + ned + ' mm' : '');
    return `
        <div class="space-y-1.5">
            <div class="flex flex-wrap items-center gap-1.5">${codes}</div>
            <p class="text-[11px] text-slate-600">
                ${areaLabel ? escapeHtml(areaLabel) : 'Region ' + escapeHtml(String(suggestion.region || '—'))}${sizeText}
            </p>
            ${notes}
        </div>`;
}

function billingSelectHtml(id, field, options, selected, extraClass) {
    const opts = options.map((opt) =>
        `<option value="${opt.id}" ${opt.id === selected ? 'selected' : ''}>${opt.label}</option>`
    ).join('');
    return `<select onchange="updateBillingAllocation('${id}', '${field}', this.value)" class="${extraClass || 'w-full p-1.5 border border-slate-300 rounded bg-white text-[11px]'}">
        <option value="">Select...</option>${opts}
    </select>`;
}

function initBillingModule() {
    populateProcedureAreaSelect(document.getElementById('exBillingRegion'));
}

function copySuggestedBillingItems(id) {
    const bill = typeof findManagedBilling === 'function' ? findManagedBilling(id) : null;
    const lesion = managedLesions.find((item) => item.id === id);
    const view = bill ? (typeof billingViewModel === 'function' ? billingViewModel(bill) : bill) : lesion;
    if (!view) return;
    const codes = view.assignedMbsItems || suggestMbsItems(view).summary;
    if (!codes) {
        showToast('Assign histology type or suspected melanoma, then apply the suggested items.');
        return;
    }
    copyTextToClipboard(codes, 'Billing codes copied.');
}

function lesionCanBillAtProcedure(lesion) {
    if (!lesion) {
        return { ok: false, hold: true, reason: 'No lesion selected.', kind: 'hold' };
    }
    if (isDiagnosticBiopsyForBilling(lesion)) {
        return {
            ok: true,
            hold: false,
            reason: 'Diagnostic biopsy (30071) can be billed now.',
            kind: 'biopsy'
        };
    }
    const type = inferBillingLesionType(lesion);
    if (type === 'suspected_melanoma') {
        return {
            ok: true,
            hold: false,
            reason: 'Suspected melanoma items can be billed before histology. Enter them in Best Practice now.',
            kind: 'suspected_melanoma'
        };
    }
    if (lesion.histologyResult) {
        return {
            ok: true,
            hold: false,
            reason: 'Histology is known. Enter item numbers in Best Practice now.',
            kind: 'histo_known'
        };
    }
    return {
        ok: false,
        hold: true,
        reason: 'Hold billing until histology is back, unless this excision is billed as suspected melanoma.',
        kind: 'hold'
    };
}

function procedureSessionBillingSummary(lesionList) {
    const rows = (lesionList || []).map((lesion) => {
        const status = lesionCanBillAtProcedure(lesion);
        const suggestion = suggestMbsItems(lesion);
        return {
            lesion,
            ...status,
            codes: suggestion.summary || '',
            ready: !!suggestion.ready,
            site: lesion.location || 'site'
        };
    });
    const processRows = rows.filter((row) => row.ok);
    const holdRows = rows.filter((row) => row.hold);
    return {
        rows,
        processRows,
        holdRows,
        allProcess: rows.length > 0 && holdRows.length === 0,
        allHold: rows.length > 0 && processRows.length === 0,
        mixed: processRows.length > 0 && holdRows.length > 0
    };
}

function receptionBillingInstruction(summary) {
    if (!summary || !summary.rows || !summary.rows.length) return '';
    if (summary.allProcess) {
        return 'Billing: PROCESS NOW — all procedures are OK to bill (histology known, suspected melanoma items, or biopsy 30071). Enter codes in Best Practice now.';
    }
    if (summary.allHold) {
        return 'Billing: HOLD — awaiting histology.';
    }
    const processSites = summary.processRows.map((row) => row.site).join(', ');
    const holdSites = summary.holdRows.map((row) => row.site).join(', ');
    return `Billing: PROCESS NOW for ${processSites}. HOLD for ${holdSites} until histology is known.`;
}

