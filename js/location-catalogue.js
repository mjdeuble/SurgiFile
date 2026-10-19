/* Match free-text lesion sites to MBS excision regions 1 / 2 / 3 (TN.8.125).
   Region 1 sites win over a generic “face”. Bare “arm” or “leg” stay unmatched. */

const MBS_LOCATION_SITES = [
    { id: 'nose', region: 1, label: 'Nose', aliases: ['nasal', 'ala', 'alar', 'columella', 'nasi'], re: /\b(nose|nasal|ala|alar|columella|nasi)\b/i },
    { id: 'nasolabial', region: 1, label: 'Nasolabial fold', aliases: ['melolabial'], re: /\b(nasolabial|melolabial)\b/i },
    { id: 'eyelid', region: 1, label: 'Eyelid', aliases: ['lid', 'canthus', 'canthal', 'periocular', 'periorbital', 'infraorbital', 'supraorbital'], re: /\b(eyelid|lids?|canthus|canthal|periocular|periorbital|infraorbital|supraorbital)\b/i },
    { id: 'eyebrow', region: 1, label: 'Eyebrow', aliases: ['brow'], re: /\b(eyebrow|brows?)\b/i },
    { id: 'lip', region: 1, label: 'Lip', aliases: ['vermilion', 'philtrum'], re: /\b(lips?|vermilion|philtrum)\b/i },
    { id: 'ear', region: 1, label: 'Ear', aliases: ['helix', 'helical', 'pinna', 'tragus', 'lobule', 'concha', 'preauricular', 'postauricular', 'earlobe', 'auricle'], re: /\b(ears?|helix|helical|pinna|tragus|antitragus|lobule|concha|preauricular|postauricular|pre-auricular|post-auricular|auricle|earlobe)\b/i },
    { id: 'digit', region: 1, label: 'Digit (finger or toe)', aliases: ['finger', 'thumb', 'toe', 'nail', 'subungual', 'periungual'], re: /\b(digits?|fingers?|thumbs?|toes?|nails?|subungual|periungual)\b/i },
    { id: 'genitalia', region: 1, label: 'Genitalia', aliases: ['penis', 'vulva', 'scrotum', 'perineum'], re: /\b(genital|genitalia|penis|penile|vulva|vulval|scrotum|scrotal|perineum|perineal)\b/i },
    { id: 'cheek', region: 2, label: 'Cheek', aliases: ['malar', 'zygoma'], re: /\b(cheeks?|malar|zygoma)\b/i },
    { id: 'forehead', region: 2, label: 'Forehead', aliases: ['glabella', 'frontal'], re: /\b(forehead|glabella|frontal)\b/i },
    { id: 'temple', region: 2, label: 'Temple', aliases: ['temporal'], re: /\b(temple|temporal)\b/i },
    { id: 'chin', region: 2, label: 'Chin', aliases: ['mentum', 'jaw', 'jawline', 'mandible'], re: /\b(chin|mentum|mandible|jawline|jaws?)\b/i },
    { id: 'face', region: 2, label: 'Face', aliases: ['facial'], re: /\b(face|facial)\b/i },
    { id: 'scalp', region: 2, label: 'Scalp', aliases: ['vertex', 'occiput', 'occipital', 'parietal', 'crown', 'head'], re: /\b(scalp|vertex|occiput|occipital|parietal|crown|head)\b/i },
    { id: 'neck', region: 2, label: 'Neck', aliases: ['cervical', 'supraclavicular'], re: /\b(neck|cervical|supraclavicular)\b/i },
    { id: 'nipple_areola', region: 2, label: 'Nipple-areola', aliases: ['nipple', 'areola'], re: /\b(nipples?|areola|areolar)\b/i },
    { id: 'hand', region: 2, label: 'Hand / wrist', aliases: ['wrist', 'palm', 'palmar'], re: /\b(hands?|wrists?|palms?|palmar|dorsum of (the )?hand)\b/i },
    { id: 'knee', region: 2, label: 'Knee', aliases: ['patella'], re: /\b(knees?|patella|popliteal)\b/i },
    { id: 'shin', region: 2, label: 'Shin / pretibia', aliases: ['pretibia', 'tibial'], re: /\b(shins?|pretibia|pre-tibial|pretibial)\b/i },
    { id: 'calf', region: 2, label: 'Calf', aliases: ['gastroc'], re: /\b(calf|calves)\b/i },
    { id: 'ankle', region: 2, label: 'Ankle', aliases: ['malleolus'], re: /\b(ankles?|malleolus|malleolar)\b/i },
    { id: 'foot', region: 2, label: 'Foot', aliases: ['heel', 'sole', 'plantar', 'dorsum of foot'], re: /\b(feet|foot|heels?|soles?|plantar|dorsum of (the )?foot)\b/i },
    { id: 'chest', region: 3, label: 'Chest', aliases: ['thorax', 'sternum', 'presternal'], re: /\b(chest|thorax|sternal|sternum|presternal)\b/i },
    { id: 'abdomen', region: 3, label: 'Abdomen', aliases: ['abdominal'], re: /\b(abdomen|abdominal|umbilical)\b/i },
    { id: 'back', region: 3, label: 'Back', aliases: ['lumbar', 'flank', 'scapula'], re: /\b(backs?|lumbar|flanks?|scapula|scapular|thoracic back)\b/i },
    { id: 'breast', region: 3, label: 'Breast', aliases: ['mammary'], re: /\b(breasts?|mammary)\b/i },
    { id: 'shoulder', region: 3, label: 'Shoulder', aliases: ['deltoid'], re: /\b(shoulders?|deltoid)\b/i },
    { id: 'upper_arm', region: 3, label: 'Upper arm', aliases: ['brachium'], re: /\b(upper arms?|brachium|biceps|triceps)\b/i },
    { id: 'forearm', region: 3, label: 'Forearm', aliases: ['antecubital', 'elbow'], re: /\b(forearms?|antecubital|elbows?)\b/i },
    { id: 'thigh', region: 3, label: 'Thigh', aliases: ['femur'], re: /\b(thighs?)\b/i },
    { id: 'hip', region: 3, label: 'Hip', aliases: ['groin', 'inguinal'], re: /\b(hips?|groin|inguinal)\b/i },
    { id: 'buttock', region: 3, label: 'Buttock', aliases: ['gluteal'], re: /\b(buttocks?|gluteal|glute)\b/i },
    { id: 'trunk', region: 3, label: 'Trunk', aliases: ['torso'], re: /\b(trunk|torso)\b/i }
];

const locZoneRegistry = {};

function mbsRegionGroupLabel(region) {
    if (typeof procedureAreaLabel === 'function') return procedureAreaLabel(region);
    if (region === 1) return 'Region 1 — nose, eyelid, eyebrow, lip, ear, digit, genitalia';
    if (region === 2) return 'Region 2 — face, neck, scalp, nipple-areola, distal limb';
    if (region === 3) return 'Region 3 — remainder of body';
    return '';
}

function locationZoneFields(locationText) {
    const hit = matchLocationToMbsRegion(locationText);
    if (!hit) return { billingRegion: '', bodyAreaId: '', bodyAreaLabel: '' };
    return {
        billingRegion: hit.region,
        bodyAreaId: hit.id,
        bodyAreaLabel: hit.groupLabel
    };
}

function matchLocationToMbsRegion(location) {
    const text = String(location || '').trim();
    if (!text) return null;
    for (const site of MBS_LOCATION_SITES) {
        if (site.re.test(text)) {
            return {
                id: site.id,
                label: site.label,
                region: site.region,
                groupLabel: mbsRegionGroupLabel(site.region)
            };
        }
    }
    return null;
}

function locationZoneNoteText(hit, options) {
    if (!hit) {
        return options && options.empty
            ? ''
            : 'Type a site that maps to MBS region 1, 2 or 3 (e.g. Right cheek, Left nose).';
    }
    return 'Allocated to Region ' + hit.region + ' — ' + hit.label;
}

function locZoneWrap(input) {
    return input?.closest('.loc-zone') || input?.parentElement || null;
}

function locZoneNoteEl(input, noteId) {
    if (noteId) return document.getElementById(noteId);
    return locZoneWrap(input)?.querySelector('.loc-zone-note') || null;
}

function applyLocationZoneUi(input, options) {
    options = options || {};
    const text = String(input?.value || '').trim();
    const hit = matchLocationToMbsRegion(text);
    input.classList.toggle('is-matched', !!hit);
    input.classList.toggle('is-unmatched', !!text && !hit);
    const note = locZoneNoteEl(input, options.noteId);
    if (note) {
        note.textContent = locationZoneNoteText(hit, { empty: !text });
        note.classList.toggle('is-matched', !!hit);
        note.classList.toggle('is-unmatched', !!text && !hit);
        note.classList.toggle('hidden', !text && !hit);
    }
    const select = options.regionSelectId ? document.getElementById(options.regionSelectId) : null;
    if (select) {
        if (hit) select.value = String(hit.region);
        else if (!select.value) select.value = '';
    }
    if (typeof options.onChange === 'function') options.onChange(hit, text);
    if (input.id === 'inspLesionLocation' || input.id === 'lesionLocation') {
        syncLesionLocationSaveButtons();
    }
    return hit;
}

function syncLesionLocationSaveButtons() {
    const apply = (inputId, buttonId) => {
        const input = document.getElementById(inputId);
        const btn = document.getElementById(buttonId);
        if (!input || !btn) return;
        if (input.disabled) {
            btn.disabled = true;
            return;
        }
        const ok = !!matchLocationToMbsRegion(input.value);
        btn.disabled = !ok;
        btn.classList.toggle('opacity-50', !ok);
        btn.classList.toggle('cursor-not-allowed', !ok);
        btn.title = ok ? '' : 'Enter a site that maps to MBS region 1, 2 or 3.';
    };
    apply('inspLesionLocation', 'btnSaveInspectorDoc');
    apply('lesionLocation', 'btnSaveLesion');
}

function bindLocationZoneField(inputId, options) {
    const input = document.getElementById(inputId);
    if (!input) return null;
    options = options || {};
    const existing = locZoneRegistry[inputId];
    if (existing && existing.input === input) {
        applyLocationZoneUi(input, existing);
        return existing;
    }
    const wrap = locZoneWrap(input);
    if (wrap && !wrap.querySelector('.loc-zone-note') && !options.noteId) {
        const note = document.createElement('p');
        note.className = 'loc-zone-note';
        wrap.appendChild(note);
    }
    const state = {
        input,
        noteId: options.noteId || '',
        regionSelectId: options.regionSelectId || '',
        onChange: options.onChange || null
    };
    locZoneRegistry[inputId] = state;
    input.setAttribute('autocomplete', 'off');
    input.classList.add('loc-zone-input');
    input.addEventListener('input', () => applyLocationZoneUi(input, state));
    input.addEventListener('blur', () => applyLocationZoneUi(input, state));
    applyLocationZoneUi(input, state);
    return state;
}

function refreshLocationZoneField(inputId) {
    const input = document.getElementById(inputId);
    if (!input) return null;
    const existing = locZoneRegistry[inputId];
    if (existing && existing.input === input) {
        applyLocationZoneUi(input, existing);
        if (inputId === 'exLesionLocation') syncProcedureRegionFromLocation();
        return existing;
    }
    return bindLocationZoneField(inputId, existing || {});
}

function initLocationZoneFields() {
    bindLocationZoneField('lesionLocation');
    bindLocationZoneField('exLesionLocation', {
        regionSelectId: 'exBillingRegion',
        onChange: () => {
            if (typeof checkExFormCompleteness === 'function') checkExFormCompleteness();
            syncProcedureRegionFromLocation();
        }
    });
    bindLocationZoneField('assignExcisionLocation');
    syncProcedureRegionFromLocation();
}

function syncProcedureRegionFromLocation() {
    const input = document.getElementById('exLesionLocation');
    const select = document.getElementById('exBillingRegion');
    const wrap = document.getElementById('ex-billing-region-container');
    const hint = document.getElementById('exBillingRegionHint');
    if (!select) return null;
    const hit = matchLocationToMbsRegion(input?.value || '');
    if (hit) {
        select.value = String(hit.region);
        select.disabled = true;
        if (hint) hint.textContent = 'Taken from the location above. Change the site if this region is wrong.';
    } else {
        select.disabled = false;
        if (hint) hint.textContent = 'Used later to suggest MBS item numbers after histology (or for suspected melanoma).';
    }
    if (wrap && input?.value.trim() && hit) wrap.classList.add('is-auto-region');
    else if (wrap) wrap.classList.remove('is-auto-region');
    return hit;
}

function requireMatchedLocation(locationText, message) {
    const text = String(locationText || '').trim();
    if (!text) {
        if (typeof showToast === 'function') showToast(message || 'Please enter an anatomical location for the lesion.');
        return null;
    }
    const hit = matchLocationToMbsRegion(text);
    if (!hit) {
        if (typeof showToast === 'function') {
            showToast('Use a site that maps to MBS region 1, 2 or 3 (e.g. Right cheek, Left nose).');
        }
        return null;
    }
    return hit;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        MBS_LOCATION_SITES,
        matchLocationToMbsRegion,
        locationZoneFields,
        locationZoneNoteText,
        requireMatchedLocation
    };
}
