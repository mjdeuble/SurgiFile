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

function normalizeLocationQuery(text) {
    return String(text || '')
        .toLowerCase()
        .replace(/[^a-z0-9\s/-]/g, ' ')
        .replace(/\b(left|right|lt|rt|bilateral|mid|medial|lateral|proximal|distal|upper|lower|inner|outer|anterior|posterior|dorsal|volar)\b/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function searchLocationSites(query) {
    const raw = String(query || '').trim();
    const q = normalizeLocationQuery(raw);
    if (q.length < 2 && raw.length < 2) return [];
    const tokens = q.split(' ').filter((tok) => tok.length >= 2);
    return MBS_LOCATION_SITES.map((site) => {
        const hay = (site.label + ' ' + (site.aliases || []).join(' ')).toLowerCase();
        let score = 0;
        if (q && hay.includes(q)) score += 12;
        if (q && site.label.toLowerCase().startsWith(q)) score += 18;
        tokens.forEach((tok) => {
            if (hay.includes(tok)) score += 4;
        });
        if (site.re.test(raw)) score += 16;
        return { site, score };
    }).filter((row) => row.score > 0)
        .sort((a, b) => b.score - a.score || a.site.region - b.site.region || a.site.label.localeCompare(b.site.label))
        .slice(0, 8)
        .map((row) => row.site);
}

function locationLateralityPrefix(text) {
    const hit = String(text || '').match(/\b(left|right|lt|rt)\b/i);
    if (!hit) return '';
    return /left|lt/i.test(hit[1]) ? 'Left ' : 'Right ';
}

function locationSuggestionValue(typed, site) {
    return locationLateralityPrefix(typed) + site.label;
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

function locZoneSuggestEl(input) {
    return locZoneWrap(input)?.querySelector('.loc-suggest') || null;
}

function locZoneNoteEl(input, noteId) {
    if (noteId) return document.getElementById(noteId);
    return locZoneWrap(input)?.querySelector('.loc-zone-note') || null;
}

function hideLocSuggest(input) {
    const list = locZoneSuggestEl(input);
    if (list) {
        list.classList.add('hidden');
        list.innerHTML = '';
    }
}

function paintLocSuggest(state, query) {
    const list = locZoneSuggestEl(state.input);
    if (!list) return;
    const hits = searchLocationSites(query);
    if (!hits.length) {
        hideLocSuggest(state.input);
        return;
    }
    list.innerHTML = hits.map((site, idx) => (
        '<button type="button" class="dx-suggest-item' + (idx === 0 ? ' is-active' : '') + '" data-loc-id="'
        + site.id + '" role="option">'
        + '<span class="dx-suggest-label">' + (typeof escapeHtml === 'function' ? escapeHtml(site.label) : site.label) + '</span>'
        + '<span class="dx-suggest-meta">Region ' + site.region + '</span></button>'
    )).join('');
    list.classList.remove('hidden');
    state.activeIndex = 0;
}

function locSuggestItems(input) {
    return [...(locZoneSuggestEl(input)?.querySelectorAll('.dx-suggest-item') || [])];
}

function moveLocActive(state, delta) {
    const items = locSuggestItems(state.input);
    if (!items.length) return;
    items.forEach((item) => item.classList.remove('is-active'));
    state.activeIndex = (state.activeIndex + delta + items.length) % items.length;
    items[state.activeIndex].classList.add('is-active');
    items[state.activeIndex].scrollIntoView({ block: 'nearest' });
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
    return hit;
}

function chooseLocSite(state, site) {
    if (!site) return;
    state.input.value = locationSuggestionValue(state.input.value, site);
    hideLocSuggest(state.input);
    applyLocationZoneUi(state.input, state);
    if (typeof state.afterPick === 'function') state.afterPick(site, state.input.value);
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
    if (wrap && !wrap.querySelector('.loc-suggest')) {
        const list = document.createElement('div');
        list.className = 'dx-suggest loc-suggest hidden';
        list.setAttribute('role', 'listbox');
        wrap.appendChild(list);
    }
    if (wrap && !wrap.querySelector('.loc-zone-note') && !options.noteId) {
        const note = document.createElement('p');
        note.className = 'loc-zone-note';
        wrap.appendChild(note);
    }
    const state = {
        input,
        noteId: options.noteId || '',
        regionSelectId: options.regionSelectId || '',
        onChange: options.onChange || null,
        afterPick: options.afterPick || null,
        activeIndex: -1
    };
    locZoneRegistry[inputId] = state;
    input.setAttribute('autocomplete', 'off');
    input.classList.add('loc-zone-input');
    input.addEventListener('focus', () => {
        if (input.value.trim().length >= 2) paintLocSuggest(state, input.value);
    });
    input.addEventListener('input', () => {
        paintLocSuggest(state, input.value);
        applyLocationZoneUi(input, state);
    });
    input.addEventListener('keydown', (event) => {
        const list = locZoneSuggestEl(input);
        const open = list && !list.classList.contains('hidden');
        if (event.key === 'ArrowDown') {
            event.preventDefault();
            if (!open) paintLocSuggest(state, input.value);
            else moveLocActive(state, 1);
        } else if (event.key === 'ArrowUp') {
            event.preventDefault();
            if (open) moveLocActive(state, -1);
        } else if (event.key === 'Enter' && open) {
            event.preventDefault();
            const items = locSuggestItems(input);
            const btn = items[state.activeIndex] || items[0];
            const site = MBS_LOCATION_SITES.find((item) => item.id === btn?.dataset.locId);
            if (site) chooseLocSite(state, site);
        } else if (event.key === 'Escape') {
            hideLocSuggest(input);
        }
    });
    input.addEventListener('blur', () => {
        window.setTimeout(() => {
            if (document.activeElement === input) return;
            hideLocSuggest(input);
            applyLocationZoneUi(input, state);
        }, 140);
    });
    wrap?.addEventListener('mousedown', (event) => {
        const btn = event.target.closest('.loc-suggest .dx-suggest-item');
        if (!btn) return;
        event.preventDefault();
        const site = MBS_LOCATION_SITES.find((item) => item.id === btn.dataset.locId);
        if (site) chooseLocSite(state, site);
    });
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
        searchLocationSites,
        locationZoneFields,
        locationSuggestionValue,
        locationZoneNoteText,
        requireMatchedLocation
    };
}
