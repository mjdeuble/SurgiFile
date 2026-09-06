/* Patient aftercare sheet: print/PDF-style handout generated from the open chart. */

let aftercarePaperwork = emptyAftercareRecord();

function emptyAftercareRecord() {
    return { given: false, givenAt: '', visitDate: '', topics: [] };
}

function aftercareIdentity() {
    const name = String(currentPatient?.name || '').trim() || '________________________';
    const dob = String(currentPatient?.dob || '').trim() || '____ / ____ / ________';
    const phone = String(currentPatient?.phone || '').trim();
    const doctor = (typeof currentDoctorName === 'function' && currentDoctorName())
        || (typeof loggedInDoctorName === 'function' && loggedInDoctorName())
        || String(currentPatient?.clinician || '').trim()
        || '________________________';
    const doctorLine = /^dr\b/i.test(doctor) || doctor.includes('_') ? doctor : 'Dr ' + doctor;
    return { name, dob, phone, doctor, doctorLine };
}

function aftercareSourceLesions() {
    if (typeof chartLesions === 'function' && hasCurrentPatient()) return chartLesions();
    return Array.isArray(lesions) ? lesions : [];
}

function aftercareLocationBlob(lesion) {
    const detail = typeof procedureDetailForLesion === 'function' ? procedureDetailForLesion(lesion) : {};
    return [detail.location, lesion?.location, lesion?.billingRegion].filter(Boolean).join(' ');
}

function aftercareSiteGroup(locationStr) {
    const loc = String(locationStr || '');
    if (typeof ANATOMIC_SITE_RISK_GROUPS === 'object' && Array.isArray(ANATOMIC_SITE_RISK_GROUPS)) {
        const hit = ANATOMIC_SITE_RISK_GROUPS.find((group) => group.keywords.some((keyword) => {
            return typeof locationContainsKeyword === 'function'
                ? locationContainsKeyword(loc, keyword)
                : loc.toLowerCase().includes(String(keyword).toLowerCase());
        }));
        if (hit) return hit.id;
    }
    const lower = loc.toLowerCase();
    if (/leg|thigh|knee|shin|calf|ankle|foot|toe|heel|plantar|pretibial/.test(lower)) return 'lower-limb';
    if (/hand|finger|thumb|wrist|palm/.test(lower)) return 'hand';
    if (/arm|elbow|forearm|axilla/.test(lower)) return 'upper-limb';
    if (/ear|helix|pinna/.test(lower)) return 'ear';
    if (/eyelid|canthus|periocular/.test(lower)) return 'periocular';
    if (/scalp|forehead|vertex/.test(lower)) return 'scalp';
    if (/neck/.test(lower)) return 'neck';
    if (/face|nose|lip|cheek|chin|temple/.test(lower)) return 'face';
    if (/back|chest|shoulder|abdomen|breast/.test(lower)) return 'trunk';
    return '';
}

function aftercareIsExcision(lesion) {
    const status = lesion?.managementStatus || '';
    const plan = String(lesion?.plan || '');
    const detail = typeof procedureDetailForLesion === 'function' ? procedureDetailForLesion(lesion) : {};
    const proc = String(detail.procedure || lesion?.procedure || '');
    if (status === 'planned_excision' || status === 'current_case') return true;
    if (plan.includes('Excision')) return true;
    if (/^excision$/i.test(proc)) return true;
    return false;
}

function aftercareIsBiopsy(lesion) {
    const plan = String(lesion?.plan || '');
    const detail = typeof procedureDetailForLesion === 'function' ? procedureDetailForLesion(lesion) : {};
    const proc = String(detail.procedure || lesion?.biopsyType || '');
    if (plan.includes('Biopsy')) return true;
    if (/shave|punch/i.test(proc) && !aftercareIsExcision(lesion)) return true;
    return false;
}

function aftercareProcedureDone(lesion) {
    return !!(lesion?.procedureCompletedAt || lesion?.excisionFinalisedAt);
}

function aftercarePlanLabel(lesion) {
    if (typeof isTopicalPlan === 'function' && isTopicalPlan(lesion.plan) && lesion.topicalDecision) {
        return typeof topicalLabel === 'function' ? topicalLabel(lesion.topicalDecision) : lesion.topicalDecision;
    }
    const detail = typeof procedureDetailForLesion === 'function' ? procedureDetailForLesion(lesion) : {};
    if (aftercareIsExcision(lesion)) {
        const done = aftercareProcedureDone(lesion);
        const closure = detail.excisionClosureType || lesion.excisionReconstruction || '';
        return (done ? 'Excision completed' : 'Formal excision planned') + (closure ? ' (' + closure + ')' : '');
    }
    if (aftercareIsBiopsy(lesion)) {
        return lesion.biopsyType || detail.procedure || 'Biopsy';
    }
    return lesion.plan || 'Clinical review';
}

function aftercareSiteAdvice(siteId, kind) {
    const surgical = kind === 'excision-planned' || kind === 'excision-done' || kind === 'shave' || kind === 'punch' || kind === 'biopsy';
    if (!surgical) return [];
    const map = {
        'lower-limb': [
            'Elevate the treated leg above the level of the hip whenever sitting or lying, for 30–45 minutes several times a day, for at least the first 3–5 days.',
            'Avoid long periods of standing or walking for the first few days. Short walks are fine.',
            'Lower-leg wounds often swell and can be slower to heal. Keep the dressing dry and return if the wound weeps heavily or the swelling rapidly increases.',
            'Wear comfortable, loose footwear. Do not soak the foot or leg in a bath until the clinic says the wound is sealed.'
        ],
        hand: [
            'Keep the hand elevated on a pillow when resting, especially for the first 48 hours, to reduce throbbing and swelling.',
            'Avoid heavy gripping, gym weights, and wet work (washing dishes without a waterproof cover) until reviewed.',
            'Finger and hand wounds can feel stiff. Gentle movement of untreated joints is encouraged unless you have been told to rest a particular finger.'
        ],
        'upper-limb': [
            'Avoid heavy lifting and repetitive strain through the treated arm until the wound is comfortable and, if stitches are present, until they are removed.',
            'A sling is not usually needed. Use the arm for light daily tasks.'
        ],
        face: [
            'Sleep with an extra pillow for the first two nights to reduce swelling, especially around the eyes, lips, or nose.',
            'Avoid gym, bending, straining, and alcohol for 48 hours (these increase bleeding and swelling).',
            'Do not apply make-up over the wound until the surface has sealed. Gentle facial washing around (not on) the dressing is fine after 24 hours if the dressing stays dry.'
        ],
        periocular: [
            'Expect bruising and swelling around the eyelid; this often looks worse on day 2–3 then improves.',
            'Sleep with the head elevated. Avoid rubbing the eye. Contact the clinic promptly if vision changes, severe pain, or the eyelid will not close.'
        ],
        ear: [
            'Avoid sleeping on the treated ear. Do not wear tight headphones, helmets, or earrings on that side until comfortable.',
            'Cartilage wounds can stay tender. Contact the clinic if the ear becomes hot, very painful, or you develop fever (possible cartilage infection).'
        ],
        scalp: [
            'Hair washing: keep the dressing dry for 48 hours unless told otherwise, then gentle water over the area is usually allowed. Avoid vigorous shampooing over stitches.',
            'A tight hat or helmet may be uncomfortable; a loose cap is fine if it does not rub the wound.'
        ],
        neck: [
            'Avoid extreme neck turning and tight collars for the first week so the wound is not stretched.',
            'Support the neck with a pillow when sitting in a car for longer trips.'
        ],
        trunk: [
            'Chest, shoulder and back wounds sit in a high-movement area and can stretch. Minimise gym, swimming, and overhead reaching until stitches are out (or the clinic advises).',
            'A supportive, non-tight garment can reduce pulling across the chest.'
        ]
    };
    return map[siteId] || [];
}

function aftercareTopicsFromLesions(list) {
    const topics = new Set();
    list.forEach((lesion) => {
        if (aftercareIsExcision(lesion) && aftercareProcedureDone(lesion)) topics.add('excision-done');
        else if (aftercareIsExcision(lesion)) topics.add('excision-planned');
        else if (aftercareIsBiopsy(lesion) && (/shave/i.test(String(lesion.biopsyType || '')))) topics.add('shave');
        else if (aftercareIsBiopsy(lesion) && (/punch/i.test(String(lesion.biopsyType || '')))) topics.add('punch');
        else if (aftercareIsBiopsy(lesion) || aftercareProcedureDone(lesion)) topics.add('biopsy');
        const decision = lesion.topicalDecision || '';
        if (decision && decision !== 'declined') topics.add(decision);
        if (decision === 'declined') topics.add('declined-topical');
        if (!aftercareIsExcision(lesion) && !aftercareIsBiopsy(lesion) && !decision && (lesion.plan || '').toLowerCase().includes('monitor')) {
            topics.add('monitor');
        }
    });
    return Array.from(topics);
}

function aftercareHasContent() {
    return aftercareSourceLesions().length > 0 || (typeof hasCurrentPatient === 'function' && hasCurrentPatient());
}

function aftercareWasGivenToday() {
    const today = typeof todayVisitKey === 'function' ? todayVisitKey() : '';
    if (aftercarePaperwork.given && aftercarePaperwork.visitDate === today) return true;
    const chart = typeof currentManagedChart === 'function' ? currentManagedChart() : null;
    return !!(chart?.aftercare?.given && chart.aftercare.visitDate === today);
}

function markAftercareGiven(topics) {
    aftercarePaperwork = {
        given: true,
        givenAt: new Date().toISOString(),
        visitDate: typeof todayVisitKey === 'function' ? todayVisitKey() : '',
        topics: Array.isArray(topics) ? topics : aftercareTopicsFromLesions(aftercareSourceLesions())
    };
    if (typeof updateOutput === 'function') updateOutput();
    if (typeof scheduleChartSave === 'function') scheduleChartSave();
}

function applyChartAftercare(record) {
    const today = typeof todayVisitKey === 'function' ? todayVisitKey() : '';
    if (record?.visitDate === today && record.given) {
        aftercarePaperwork = {
            given: true,
            givenAt: record.givenAt || '',
            visitDate: record.visitDate,
            topics: Array.isArray(record.topics) ? record.topics.slice() : []
        };
        return;
    }
    aftercarePaperwork = emptyAftercareRecord();
}

function collectChartAftercare() {
    if (!aftercarePaperwork.given) return emptyAftercareRecord();
    return {
        given: true,
        givenAt: aftercarePaperwork.givenAt,
        visitDate: aftercarePaperwork.visitDate,
        topics: aftercarePaperwork.topics.slice()
    };
}

function aftercareEsc(value) {
    return typeof escapeHtml === 'function' ? escapeHtml(value) : String(value ?? '');
}

function aftercareListHtml(items) {
    return '<ul>' + items.map((item) => '<li>' + aftercareEsc(item) + '</li>').join('') + '</ul>';
}

function aftercareTreatmentBlocks(list) {
    const blocks = [];
    const seen = new Set();
    const add = (key, title, bodyItems) => {
        if (seen.has(key) || !bodyItems.length) return;
        seen.add(key);
        blocks.push({ key, title, items: bodyItems });
    };

    const anyExcisionPlanned = list.some((l) => aftercareIsExcision(l) && !aftercareProcedureDone(l));
    const anyExcisionDone = list.some((l) => aftercareIsExcision(l) && aftercareProcedureDone(l));
    const anyShave = list.some((l) => aftercareIsBiopsy(l) && /shave/i.test(String(l.biopsyType || '') + String((typeof procedureDetailForLesion === 'function' ? procedureDetailForLesion(l).procedure : '') || '')));
    const anyPunch = list.some((l) => aftercareIsBiopsy(l) && /punch/i.test(String(l.biopsyType || '') + String((typeof procedureDetailForLesion === 'function' ? procedureDetailForLesion(l).procedure : '') || '')));
    const anyBiopsy = list.some((l) => aftercareIsBiopsy(l));

    if (anyExcisionPlanned) {
        add('excision-planned', 'Before your planned excision', [
            'This is a planned procedure under local anaesthetic. Eat and drink as usual unless you have been told otherwise. Wear a loose top that does not need to be pulled over a fresh dressing.',
            'Take your usual medicines unless your doctor has specifically asked you to pause a blood thinner. Bring a current medication list.',
            'Allow extra time. You can usually drive home after a small local-anaesthetic procedure, but arrange a driver if you feel faint easily or the site will make driving awkward (for example near an eye or on the right foot).',
            'After the excision you will have a dressing and, in most cases, stitches. Expected aftercare is the same as the surgical wound advice on this sheet: keep the dressing dry, rest the area, and contact the clinic if you are worried.',
            'If you become unwell with an infection, or start a new blood thinner, telephone the clinic before the appointment.'
        ]);
    }

    if (anyExcisionDone) {
        add('excision-done', 'After today’s excision', [
            'A dressing is in place. Leave it on and keep it clean and dry for 48 hours unless you have been given different instructions.',
            'Mild ooze or a small amount of blood on the dressing in the first day is common. If blood soaks through, apply firm pressure with a clean pad for 15–20 minutes without peeking. If bleeding continues, contact the clinic or seek urgent care.',
            'Expect tightness, bruising and a pulling sensation as the wound heals. Pain is usually managed with paracetamol. Avoid anti-inflammatory tablets (ibuprofen) in the first 24 hours if you were advised they increase bleeding.',
            'Stitches: keep the wound supported. Do not pick crusts. Return at the advised time for removal (often 5–7 days on the face; 10–14 days on the body or limbs).',
            'Avoid swimming, baths, spa pools, and heavy exercise until the clinic confirms the wound is sealed. Showers are usually fine after 48 hours if the dressing is patted dry or changed as instructed.'
        ]);
    }

    if (anyShave || (anyBiopsy && !anyPunch && !anyShave)) {
        add('shave', 'After a shave / saucerisation biopsy', [
            'The surface of the skin has been sampled. A scab will form. Keep the area clean and dry for 24 hours, then you may gently wash and pat dry.',
            'A little weeping or a blood-spot on the dressing is expected. Apply Vaseline or the ointment you were given once or twice daily after the first day, and a simple plaster if clothing rubs.',
            'The site often looks like a graze for 1–3 weeks. Colour change can last longer. Pathology results are typically available in the timeframe your doctor discussed; we will contact you, or you may be sent an SMS if you agreed to that.'
        ]);
    }

    if (anyPunch) {
        add('punch', 'After a punch biopsy', [
            'A small cylinder of skin has been removed. There may be one or two stitches, or the site may be left to heal with a dressing.',
            'Keep the dressing dry for 24–48 hours. Avoid stretching that area. If stitches are present, return as advised for removal.',
            'A firm lump under the scar can last some weeks and usually settles. Contact the clinic if the area becomes increasingly red, hot, painful, or discharges pus.'
        ]);
    }

    const topicalBlocks = {
        cryotherapy: {
            title: 'Cryotherapy (freezing)',
            items: [
                'The treated spot will become red, swollen and often blister within 24 hours. This is expected. A scab then forms and falls off over 1–3 weeks.',
                'If a blister is large and uncomfortable you may pop it with a clean needle and apply Vaseline; do not unroof the whole blister.',
                'The area can stay paler or darker than surrounding skin for months. Contact the clinic if pain rapidly worsens, redness spreads, or you feel feverish.'
            ]
        },
        efudix: {
            title: 'Efudix (5-fluorouracil) — expected effects',
            items: [
                'Indication: this cream treats sun-damaged skin and superficial skin cancers / solar keratoses in the area your doctor marked.',
                'Apply a thin layer to the treated field as directed (often once or twice daily). Wash hands after applying. Avoid eyelids, lips, and groin unless specifically instructed.',
                'Expected reaction: redness, stinging, crusting and rawness, usually peaking in week 2–3. This means the cream is working. Moisturiser or Vaseline can be used if the skin is very dry; your doctor may advise a rest day if it is severe.',
                'Avoid strong sun on the treated area. Use a hat and SPF 50+.',
                'Red flags: spreading infection (hot, pus, fever), severe swelling of the eyes, or a reaction far beyond the treated field — stop the cream and contact the clinic. You may telephone or send photographs of the area.',
                'Tell the clinic you are using Efudix, the body area, start date, and how many days you have applied it.'
            ]
        },
        'efudix-calcipotriol': {
            title: 'Combination Efudix + Calcipotriol',
            items: [
                'Indication: a shorter, more intense field treatment for sun damage. Follow the exact number of days your doctor prescribed (often around 4–7 days).',
                'The reaction is often stronger than Efudix alone: marked redness, burning and crusting can appear quickly. This is expected. Use a bland moisturiser; take a rest day only if advised or if you cannot sleep for pain.',
                'Do not use on the eyelids. Avoid sun. Do not exceed the prescribed course.',
                'Contact the clinic (phone or photos) if the skin breaks down widely, you develop fever, or eye swelling. Say that you are on combination cream and which area was treated.'
            ]
        },
        aldara: {
            title: 'Aldara (imiquimod)',
            items: [
                'Indication: this cream stimulates your immune system to treat selected superficial skin cancers or sun damage in the mapped area.',
                'Typical use: apply a thin layer at night to the spot, leave on, and wash off in the morning, on the days prescribed (often several nights a week). Do not cover tightly unless told to.',
                'Expected effects: redness, crusting, weeping, and sometimes flu-like aches or mild fever, especially after the first doses. Rest nights are often built into the course.',
                'Red flags: severe flu-like illness, rapidly spreading redness, or involvement of the eye — stop and contact the clinic by phone or with photographs. Mention Aldara, the site, and how many applications you have used.'
            ]
        },
        pdt: {
            title: 'Red light PDT',
            items: [
                'Indication: photodynamic therapy treats a field of sun damage or selected superficial lesions using a photosensitising cream and red light.',
                'The treated area will be red, swollen and crusted, often looking worse for 3–7 days. Tightness and a sunburn feeling are expected. Cool packs (not ice directly on skin) and a bland moisturiser help.',
                'You will be extra sensitive to daylight and strong indoor light for at least 24–48 hours. Stay indoors as advised, use a physical sunscreen and a wide-brim hat when you go out, and avoid sunbeds.',
                'Peeling and scabbing settle over 1–2 weeks. Contact the clinic if pain is severe, blisters are very large, or infection is suspected. Phone or send photos; tell us it was PDT and which area was treated.'
            ]
        }
    };

    Object.keys(topicalBlocks).forEach((id) => {
        if (list.some((l) => l.topicalDecision === id)) {
            add(id, topicalBlocks[id].title, topicalBlocks[id].items);
        }
    });

    const monitorOnly = list.filter((l) => {
        if (aftercareIsExcision(l) || aftercareIsBiopsy(l) || l.topicalDecision) return false;
        const plan = String(l.plan || '').toLowerCase();
        return plan.includes('monitor') || plan.includes('awaiting') || !plan;
    });
    if (monitorOnly.length) {
        add('monitor', 'Spots being watched', [
            'Some lesions are being observed rather than treated today. Photograph them in the same light if they change (size, colour, shape, bleeding, itch that is new).',
            'Contact the clinic if a watched spot grows, darkens, bleeds, or looks different from your other moles. You may phone or send photographs.'
        ]);
    }

    return blocks;
}

function aftercareSiteBlocks(list) {
    const bySite = new Map();
    list.forEach((lesion) => {
        if (!aftercareIsExcision(lesion) && !aftercareIsBiopsy(lesion) && !aftercareProcedureDone(lesion)) return;
        const kind = aftercareIsExcision(lesion)
            ? (aftercareProcedureDone(lesion) ? 'excision-done' : 'excision-planned')
            : 'biopsy';
        const loc = aftercareLocationBlob(lesion);
        const siteId = aftercareSiteGroup(loc);
        if (!siteId) return;
        const tips = aftercareSiteAdvice(siteId, kind);
        if (!tips.length) return;
        if (!bySite.has(siteId)) {
            bySite.set(siteId, { id: siteId, locations: [], tips });
        }
        const locLabel = lesion.location || loc;
        if (locLabel && !bySite.get(siteId).locations.includes(locLabel)) {
            bySite.get(siteId).locations.push(locLabel);
        }
    });
    return Array.from(bySite.values());
}

function generateAftercareHtml() {
    const { name, dob, phone, doctorLine } = aftercareIdentity();
    const dateStr = new Date().toLocaleDateString('en-AU', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const list = aftercareSourceLesions();
    const treatments = aftercareTreatmentBlocks(list);
    const sites = aftercareSiteBlocks(list);
    const clinicPhoneHint = phone ? ' (clinic already has your number ' + phone + ' on the chart)' : '';

    const lesionRows = list.length
        ? list.map((lesion, idx) => {
            const dx = lesion.impression || lesion.procedureDetail?.pathology || '—';
            return `<tr>
                <td>${idx + 1}</td>
                <td><strong>${aftercareEsc(lesion.location || 'Site')}</strong></td>
                <td>${aftercareEsc(dx)}</td>
                <td>${aftercareEsc(aftercarePlanLabel(lesion))}</td>
            </tr>`;
        }).join('')
        : '<tr><td colspan="4">No individual lesions were recorded today. General skin-care advice still applies.</td></tr>';

    const treatmentHtml = treatments.map((block) => `
        <div class="section-head">${aftercareEsc(block.title)}</div>
        ${aftercareListHtml(block.items)}
    `).join('');

    const siteHtml = sites.map((site) => `
        <div class="section-head">Extra advice for ${aftercareEsc(site.locations.join(', ') || site.id)}</div>
        ${aftercareListHtml(site.tips)}
    `).join('');

    return `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Aftercare advice — ${aftercareEsc(name)}</title>
    <style>
        body { font-family: Arial, Helvetica, sans-serif; font-size: 10.5pt; line-height: 1.45; color: #0f172a; margin: 12mm; }
        h1 { font-size: 16pt; margin: 0 0 4px; letter-spacing: 0.02em; text-transform: uppercase; }
        .subtitle { color: #475569; margin-bottom: 14px; font-size: 10pt; }
        .patient-info { border: 1.5px solid #0f172a; padding: 10px 12px; margin-bottom: 16px; display: grid; grid-template-columns: 2fr 1fr 1.5fr; gap: 8px; }
        .section-head { font-weight: bold; font-size: 11pt; text-transform: uppercase; color: #1e3a8a; margin: 16px 0 6px; border-bottom: 1px solid #cbd5e1; padding-bottom: 3px; }
        table { width: 100%; border-collapse: collapse; margin: 6px 0 12px; font-size: 10pt; }
        th, td { border: 1px solid #cbd5e1; padding: 6px 8px; text-align: left; vertical-align: top; }
        th { background: #f1f5f9; font-size: 8.5pt; text-transform: uppercase; }
        ul { margin: 4px 0 8px 18px; padding: 0; }
        li { margin-bottom: 5px; }
        .flag { background: #fef3c7; border: 1px solid #f59e0b; padding: 10px 12px; margin: 12px 0; }
        .actions { margin: 0 0 14px; }
        .actions button { margin-right: 8px; padding: 8px 14px; font-weight: bold; cursor: pointer; }
        @media print { .actions { display: none; } body { margin: 8mm; } }
    </style>
</head>
<body>
    <div class="actions">
        <button type="button" onclick="window.print()">Print / Save as PDF</button>
        <button type="button" onclick="window.close()">Close</button>
    </div>
    <h1>Patient aftercare advice</h1>
    <div class="subtitle">Take this sheet home. A copy can be saved into your medical record.</div>
    <div class="patient-info">
        <div><strong>Patient:</strong> ${aftercareEsc(name)}</div>
        <div><strong>DOB:</strong> ${aftercareEsc(dob)}</div>
        <div><strong>Doctor:</strong> ${aftercareEsc(doctorLine)}</div>
        <div style="grid-column: 1 / -1;"><strong>Date given:</strong> ${dateStr}</div>
    </div>

    <div class="section-head">Today’s lesions and plan</div>
    <table>
        <thead><tr><th>#</th><th>Site</th><th>Working diagnosis</th><th>Plan</th></tr></thead>
        <tbody>${lesionRows}</tbody>
    </table>

    <div class="section-head">Standard care</div>
    ${aftercareListHtml([
        'Wash your hands before touching a dressing or applying cream.',
        'Keep treated skin clean. Pat dry — do not rub. Avoid picking scabs or stitches.',
        'Use the ointment or moisturiser you were given, or plain Vaseline, unless you have been told to keep a dressing dry and untouched.',
        'Protect healing skin from sun with clothing or SPF 50+ once the surface has sealed.',
        'Take paracetamol for discomfort if needed, unless you cannot take it. Finish any prescribed antibiotics.'
    ])}

    ${treatmentHtml}
    ${siteHtml}

    <div class="section-head">When to contact the clinic</div>
    <div class="flag">
        <p style="margin:0 0 8px;"><strong>You may telephone the clinic or send photographs of the area.</strong> Photos are often enough for us to advise whether you need to come in.</p>
        ${aftercareListHtml([
            'Increasing pain, spreading redness, heat, pus, or a fever.',
            'Bleeding that soaks dressings and does not stop after 15–20 minutes of firm, continuous pressure.',
            'Stitches that burst, the wound opening, or a dressing that will not stay on.',
            'A topical cream reaction that is much more severe than you were prepared for, or involves the eyes.',
            'A watched mole that is changing, bleeding, or looking different.',
            'Any concern you would rather have checked — it is appropriate to call.'
        ])}
    </div>

    <div class="section-head">What to tell us when you make contact</div>
    ${aftercareListHtml([
        'Your full name and date of birth (as printed at the top of this sheet).',
        'The date you were seen (' + dateStr + ') and the doctor who treated you.',
        'The body site and what was done (biopsy, excision, cream, PDT, cryotherapy).',
        'What you are worried about now, and when it started.',
        'Attach or bring clear photographs in good light if you are sending photos' + clinicPhoneHint + '.'
    ])}

    <div class="section-head">Urgent care</div>
    <p>If you have heavy bleeding that will not stop, rapidly spreading infection, shortness of breath, or feel severely unwell, seek urgent medical care (this clinic if open, your GP, or a hospital emergency department). Take this sheet with you.</p>

    <p style="margin-top: 22px; font-size: 9pt; color: #475569;">This advice is for the visit on ${dateStr} and does not replace contacting the clinic if you are worried. Keep this copy with your appointment details.</p>
</body>
</html>`;
}

function aftercareFilename() {
    const ident = aftercareIdentity();
    const slug = String(ident.name || 'patient').replace(/[^\w]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
    const day = typeof todayVisitKey === 'function' ? todayVisitKey() : 'visit';
    return 'Aftercare-' + slug + '-' + day + '.html';
}

function openAftercarePrintWindow(html) {
    const printWin = window.open('', '_blank', 'width=850,height=950');
    if (!printWin) {
        showToast('Unable to open the aftercare window. Allow pop-ups, or use Download copy.');
        return false;
    }
    printWin.document.open();
    printWin.document.write(html);
    printWin.document.close();
    return true;
}

function downloadAftercareCopy(html) {
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = aftercareFilename();
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
}

function giveAftercareSheet(options) {
    if (typeof requireCurrentPatient === 'function' && !requireCurrentPatient('Open a patient chart before generating aftercare.')) {
        return;
    }
    const html = generateAftercareHtml();
    const topics = aftercareTopicsFromLesions(aftercareSourceLesions());
    const download = !!(options && options.download);
    if (download) {
        downloadAftercareCopy(html);
        markAftercareGiven(topics);
        showToast('Aftercare copy downloaded. IEMR will record that written advice was given.');
        return;
    }
    const opened = openAftercarePrintWindow(html);
    if (opened) {
        markAftercareGiven(topics);
        showToast('Aftercare sheet ready to print or save as PDF. IEMR will record that it was given.');
    }
}

function printAftercareSheet() {
    giveAftercareSheet({ download: false });
}

function downloadAftercareSheet() {
    giveAftercareSheet({ download: true });
}

function generateAftercareEmrSection() {
    if (!aftercareWasGivenToday()) return '';
    const topics = (aftercarePaperwork.topics || []).length
        ? aftercarePaperwork.topics
        : aftercareTopicsFromLesions(aftercareSourceLesions());
    const labels = {
        'excision-planned': 'pre- and post-operative advice for planned excision',
        'excision-done': 'post-operative excision wound care',
        shave: 'shave biopsy wound care',
        punch: 'punch biopsy wound care',
        biopsy: 'biopsy wound care',
        cryotherapy: 'cryotherapy',
        efudix: 'Efudix',
        'efudix-calcipotriol': 'combination Efudix + Calcipotriol',
        aldara: 'Aldara (imiquimod)',
        pdt: 'red light PDT',
        monitor: 'lesion observation / photo review'
    };
    const covered = topics.map((id) => labels[id] || id).filter(Boolean);
    let txt = `=== WRITTEN AFTERCARE GIVEN ===\n\n`;
    txt += `- Written aftercare advice sheet provided to the patient today (printed / PDF or downloaded copy for the chart).\n`;
    txt += `- Patient advised they may telephone the clinic or send photographs if concerned, and to quote their name, date of birth, visit date, and treated site.\n`;
    if (covered.length) {
        txt += `- Sheet included: ${covered.join('; ')}.\n`;
    }
    txt += `- Standard wound / field-treatment care and red-flag advice included.\n\n`;
    return txt;
}
