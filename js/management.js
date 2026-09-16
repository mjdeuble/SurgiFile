/* Admin: practice lesion list, filters, and separate billing queue. */

let mgmtActiveFilter = 'open';

function initManagementModule() {
    bindSavedVaultQueueClicks();
    bindProcessBillingClaimChips();
    renderManagedLesions();
    updateCurrentCaseBanner();
    if (typeof updateChartChrome === 'function') updateChartChrome();
}

function bindProcessBillingClaimChips() {
    const wrap = document.getElementById('processBillingClaimChips');
    if (!wrap || wrap.dataset.claimChipsBound === '1') return;
    wrap.dataset.claimChipsBound = '1';
    wrap.addEventListener('click', (event) => {
        const btn = event.target.closest('[data-claim-code]');
        if (!btn || !wrap.contains(btn)) return;
        removeProcessBillingClaimCode(btn.getAttribute('data-claim-code') || '');
    });
}

function bindSavedVaultQueueClicks() {
    const board = document.getElementById('mgmtBoard');
    if (!board || board.dataset.vaultQueueBound === '1') return;
    board.dataset.vaultQueueBound = '1';
    board.addEventListener('click', (event) => {
        const btn = event.target.closest('[data-note-action],[data-consent-action]');
        if (!btn || !board.contains(btn)) return;
        const noteAction = btn.getAttribute('data-note-action') || '';
        const consentAction = btn.getAttribute('data-consent-action') || '';
        const noteId = btn.getAttribute('data-note-id') || '';
        const consentId = btn.getAttribute('data-consent-id') || '';
        if (noteAction === 'open' && typeof openSavedVisitNote === 'function') openSavedVisitNote(noteId);
        else if (noteAction === 'copy-consult' && typeof copySavedVisitNote === 'function') copySavedVisitNote(noteId, 'consult');
        else if (noteAction === 'copy-procedure' && typeof copySavedVisitNote === 'function') copySavedVisitNote(noteId, 'procedure');
        else if (consentAction === 'open' && typeof openSavedConsentDoc === 'function') openSavedConsentDoc(consentId);
        else if (consentAction === 'copy' && typeof copySavedConsentDoc === 'function') copySavedConsentDoc(consentId);
        else if (consentAction === 'print' && typeof printSavedConsentDoc === 'function') printSavedConsentDoc(consentId);
    });
}

function lesionsForCurrentChart() {
    if (!hasCurrentPatient()) return managedLesions;
    return managedLesions.filter((item) => (typeof lesionBelongsToOpenChart === 'function'
        ? lesionBelongsToOpenChart(item)
        : lesionChartId(item) === currentPatient.chartId));
}

function adminLesions() {
    if (hasCurrentPatient()) return lesionsForCurrentChart();
    return managedLesions;
}

function adminBillings() {
    const bills = typeof managedBillings !== 'undefined' ? managedBillings : [];
    if (!hasCurrentPatient()) return bills;
    const chartId = currentPatient.chartId;
    return bills.filter((bill) => {
        if (bill.chartId && bill.chartId === chartId) return true;
        const lesion = managedLesions.find((item) => String(item.id) === String(bill.lesionId));
        return lesionChartId(lesion || bill) === chartId;
    });
}

function managedLesionsByStatus(status) {
    const want = typeof canonicalLesionStatus === 'function' ? canonicalLesionStatus(status) : status;
    return adminLesions().filter((item) => (typeof lesionLifecycleStatus === 'function' ? lesionLifecycleStatus(item) : item.managementStatus) === want);
}

function lesionMatchesFilter(lesion, filter) {
    if (typeof lesionIsHiddenByReexcisionLink === 'function' && lesionIsHiddenByReexcisionLink(lesion)) return false;
    const status = typeof lesionLifecycleStatus === 'function' ? lesionLifecycleStatus(lesion) : lesion.managementStatus;
    if (filter === 'open' || filter === 'active') {
        const active = typeof isActiveManagementStatus === 'function'
            ? isActiveManagementStatus(lesion.managementStatus)
            : ACTIVE_MANAGEMENT_STATUSES.includes(status);
        if (active) return true;
        return typeof lesionIsPreviousProcedure === 'function' && lesionIsPreviousProcedure(lesion);
    }
    if (filter === 'billing' || filter === 'notes') return false;
    if (filter === 'planned_excision' || filter === 'planned_procedure') return status === 'planned_procedure';
    return status === filter || lesion.managementStatus === filter;
}

function formatLesionWhen(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleString('en-AU', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function lesionEpisodeAt(item) {
    return item?.procedureCompletedAt || item?.excisionFinalisedAt || '';
}

function lesionEpisodeDayKey(item) {
    const iso = lesionEpisodeAt(item);
    if (!iso) return 'none';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return 'none';
    return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0')].join('-');
}

function formatEpisodeDayLabel(key, iso) {
    if (!key || key === 'none') return 'No procedure yet';
    const d = iso ? new Date(iso) : new Date(key + 'T12:00:00');
    if (Number.isNaN(d.getTime())) return 'No procedure yet';
    return d.toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}

function groupRecordsByPatientEpisode(items, options) {
    options = options || {};
    const patients = new Map();
    (items || []).forEach((item) => {
        const source = options.sourceOf ? options.sourceOf(item) : item;
        const identity = typeof patientIdentityFromRecord === 'function'
            ? patientIdentityFromRecord(source)
            : {
                name: source.patientName || item.patientName || '',
                firstName: '',
                lastName: '',
                dob: source.patientDob || item.patientDob || '',
                chartId: source.chartId || item.chartId || ''
            };
        const pKey = identity.chartId
            || [String(identity.name || source.patientName || '').toLowerCase(), String(identity.dob || source.patientDob || '')].join('|')
            || 'unnamed';
        if (!patients.has(pKey)) {
            const sortName = typeof formatPatientSearchName === 'function'
                ? formatPatientSearchName(source)
                : (identity.lastName && identity.firstName
                    ? identity.lastName + ', ' + identity.firstName
                    : (identity.name || source.patientName || 'Unnamed patient'));
            patients.set(pKey, {
                key: pKey,
                identity,
                sortName,
                sample: source,
                episodes: new Map()
            });
        }
        const patient = patients.get(pKey);
        const eKey = lesionEpisodeDayKey(source);
        if (!patient.episodes.has(eKey)) {
            patient.episodes.set(eKey, { key: eKey, at: lesionEpisodeAt(source), items: [] });
        }
        patient.episodes.get(eKey).items.push(item);
    });
    return Array.from(patients.values())
        .sort((a, b) => a.sortName.localeCompare(b.sortName, 'en', { sensitivity: 'base' }))
        .map((patient) => {
            const episodeList = Array.from(patient.episodes.values()).sort((a, b) => {
                if (a.key === 'none' && b.key !== 'none') return 1;
                if (b.key === 'none' && a.key !== 'none') return -1;
                return String(b.at || '').localeCompare(String(a.at || ''));
            });
            episodeList.forEach((ep) => {
                ep.items.sort((a, b) => {
                    const left = options.sourceOf ? options.sourceOf(a) : a;
                    const right = options.sourceOf ? options.sourceOf(b) : b;
                    return String(left.location || '').localeCompare(String(right.location || ''), 'en', { sensitivity: 'base' });
                });
            });
            return Object.assign({}, patient, { episodeList });
        });
}

function renderListPatientHeader(patient) {
    if (typeof hasCurrentPatient === 'function' && hasCurrentPatient()) return '';
    const sample = patient.sample || {};
    const name = patient.sortName || sample.patientName || 'Unnamed patient';
    const dob = patient.identity?.dob || sample.patientDob || '';
    const openId = String(sample.lesionId || sample.id || '').replace(/'/g, '');
    const canFocus = !!(patient.identity?.chartId || (sample.patientName && sample.patientDob));
    const nameHtml = canFocus && openId && typeof openChartFromLesion === 'function'
        ? `<button type="button" onclick="openChartFromLesion('${openId}')" class="text-left cursor-pointer group">
                <span class="text-sm font-bold text-slate-900 group-hover:text-blue-700">${escapeHtml(name)}</span>
                ${dob ? `<span class="text-[11px] font-semibold text-slate-500 ml-2">DOB ${escapeHtml(dob)}</span>` : ''}
                <span class="text-[10px] font-semibold text-blue-700 ml-1">Open chart</span>
           </button>`
        : `<p class="text-sm font-bold text-slate-900">${escapeHtml(name)}${dob ? ` <span class="text-[11px] font-semibold text-slate-500">DOB ${escapeHtml(dob)}</span>` : ''}</p>`;
    return `<header class="list-patient-head">${nameHtml}${renderLesionPatientContactHtml(sample)}</header>`;
}

function renderPatientEpisodeGroups(items, renderItem, options) {
    const groups = groupRecordsByPatientEpisode(items, options);
    if (!groups.length) return '';
    return groups.map((patient) => {
        const episodes = patient.episodeList.map((ep) => `
            <div class="list-episode">
                <h4 class="list-episode-head">${escapeHtml(formatEpisodeDayLabel(ep.key, ep.at))}</h4>
                <div class="space-y-2">${ep.items.map((item) => renderItem(item, { grouped: true })).join('')}</div>
            </div>
        `).join('');
        return `<section class="list-patient-group lg:col-span-2">
            ${renderListPatientHeader(patient)}
            <div class="list-patient-body">${episodes}</div>
        </section>`;
    }).join('');
}

function billingRecordSource(view) {
    const lesion = (typeof managedLesions !== 'undefined' ? managedLesions : [])
        .find((item) => String(item.id) === String(view?.lesionId || view?.id)) || null;
    return {
        ...(lesion || {}),
        ...view,
        id: lesion?.id || view?.lesionId || view?.id,
        lesionId: view?.lesionId || lesion?.id || view?.id,
        patientName: view?.patientName || lesion?.patientName || '',
        patientDob: view?.patientDob || lesion?.patientDob || '',
        chartId: view?.chartId || lesion?.chartId || '',
        location: view?.location || lesion?.location || '',
        procedureCompletedAt: lesion?.procedureCompletedAt || view?.procedureCompletedAt || '',
        excisionFinalisedAt: lesion?.excisionFinalisedAt || view?.excisionFinalisedAt || ''
    };
}

function renderPatientChartSummary() {
    const wrap = document.getElementById('mgmtPatientSummary');
    if (!wrap) return;
    wrap.classList.add('hidden');
    wrap.innerHTML = '';
}

const CHART_BOARD_STATUS_GROUPS = [
    ['planned_procedure', 'Planned procedure'],
    ['current_case', 'In procedure'],
    ['awaiting_assessment', 'Awaiting assessment'],
    ['awaiting_histology', 'Awaiting results'],
    ['needs_contact', 'Needs contact'],
    ['appointment_requested', 'Appointment requested'],
    ['topical_followup', 'Topical follow-up'],
    ['previous_procedure', 'Previous procedures'],
    ['no_followup', 'No follow-up']
];

function chartBoardGroupKey(lesion) {
    if (typeof lesionIsPreviousProcedure === 'function' && lesionIsPreviousProcedure(lesion)) {
        return 'previous_procedure';
    }
    return typeof lesionLifecycleStatus === 'function' ? lesionLifecycleStatus(lesion) : lesion.managementStatus;
}

function renderOpenChartBoard() {
    const items = adminLesions().filter((item) => !(typeof lesionIsHiddenByReexcisionLink === 'function' && lesionIsHiddenByReexcisionLink(item)));
    const seen = new Set(items.map((item) => String(item.id)));
    const known = new Set(CHART_BOARD_STATUS_GROUPS.map((pair) => pair[0]));
    const groups = CHART_BOARD_STATUS_GROUPS.map(([key, title]) => {
        const rows = items.filter((item) => chartBoardGroupKey(item) === key);
        return { key, title, rows };
    }).filter((group) => group.rows.length);
    const leftover = items.filter((item) => {
        const status = chartBoardGroupKey(item);
        return !known.has(status);
    });
    if (leftover.length) groups.push({ key: 'other', title: 'Other', rows: leftover });

    const lesionHtml = groups.map((group) => `
        <section class="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden lg:col-span-2">
            <header class="px-4 py-3 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
                <h3 class="text-sm font-bold text-slate-800">${escapeHtml(group.title)}</h3>
                <span class="text-[11px] font-semibold text-slate-500">${group.rows.length}</span>
            </header>
            <div class="p-3 space-y-2">${group.rows.map((lesion) => renderManagedLesionCard(lesion, { grouped: true, chartBoard: true })).join('')}</div>
        </section>`).join('');

    const orphanBills = adminBillings().filter((bill) => !seen.has(String(bill.lesionId || '')));
    const awaitingOrphans = orphanBills.filter((bill) => bill.status === 'awaiting' || !bill.status).map(billingViewModel);
    const confirmedOrphans = orphanBills.filter((bill) => bill.status === 'confirmed').map(billingViewModel);
    const processedOrphans = orphanBills.filter((bill) => bill.status === 'processed').map(billingViewModel);
    const billingHtml = (awaitingOrphans.length || confirmedOrphans.length || processedOrphans.length)
        ? `<div class="lg:col-span-2 space-y-3">${
            (awaitingOrphans.length ? renderBillingQueue(awaitingOrphans) : '')
            + (confirmedOrphans.length ? renderConfirmedBillingQueue(confirmedOrphans) : '')
            + (processedOrphans.length ? renderProcessedBillingQueue(processedOrphans) : '')
        }</div>`
        : '';

    if (!groups.length && !orphanBills.length) {
        return '<p class="text-sm text-slate-400 italic lg:col-span-2">No lesions on this chart yet.</p>';
    }
    return lesionHtml + billingHtml;
}

function renderManagedLesions() {
    const billsNeedPrune = !renderManagedLesions._pruning
        && typeof billingIsProcessedExpired === 'function'
        && typeof pruneExpiredProcessedBillings === 'function'
        && (typeof managedBillings !== 'undefined' ? managedBillings : []).some(billingIsProcessedExpired);
    const chartsNeedPrune = !renderManagedLesions._pruning
        && typeof scratchpadChartIsExpired === 'function'
        && typeof pruneExpiredIdleCharts === 'function'
        && typeof collectScratchpadChartIds === 'function'
        && collectScratchpadChartIds().some((id) => scratchpadChartIsExpired(id));
    if (billsNeedPrune || chartsNeedPrune) {
        renderManagedLesions._pruning = true;
        Promise.resolve()
            .then(() => (billsNeedPrune ? pruneExpiredProcessedBillings() : 0))
            .then(() => (chartsNeedPrune ? pruneExpiredIdleCharts() : 0))
            .then(() => {
                renderManagedLesions._pruning = false;
                renderManagedLesions();
            })
            .catch(() => {
                renderManagedLesions._pruning = false;
            });
    }
    const root = document.getElementById('mgmtBoard');
    const empty = document.getElementById('mgmtEmptyState');
    const counts = document.getElementById('mgmtCounts');
    if (typeof renderChartSidebar === 'function') renderChartSidebar();
    if (!root) return;

    document.querySelectorAll('[data-mgmt-filter]').forEach((btn) => {
        btn.classList.toggle('is-active', btn.getAttribute('data-mgmt-filter') === mgmtActiveFilter);
    });
    if (typeof updateChartChrome === 'function') updateChartChrome();

    const chart = adminLesions();
    const bills = adminBillings();
    const open = chart.filter((item) => {
        if (typeof lesionIsHiddenByReexcisionLink === 'function' && lesionIsHiddenByReexcisionLink(item)) return false;
        return typeof isActiveManagementStatus === 'function'
            ? isActiveManagementStatus(item.managementStatus)
            : ACTIVE_MANAGEMENT_STATUSES.includes(item.managementStatus);
    }).length;
    const awaitingBill = bills.filter((item) => item.status === 'awaiting' || !item.status).length;
    const confirmedBill = bills.filter((item) => item.status === 'confirmed').length;
    const processedBill = bills.filter((item) => item.status === 'processed').length;
    if (counts) {
        if (hasCurrentPatient()) {
            counts.classList.add('hidden');
            counts.textContent = '';
        } else if (!isVaultLoggedIn()) {
            counts.classList.remove('hidden');
            counts.textContent = 'Sign in to load encrypted charts, billing, and results.';
        } else {
            counts.classList.remove('hidden');
            const noteCount = typeof adminVisitNotes === 'function' ? adminVisitNotes().length : 0;
            const consentCount = typeof adminConsentDocs === 'function' ? adminConsentDocs().length : 0;
            counts.textContent = `All patients · ${open} open · ${awaitingBill} awaiting · ${confirmedBill} confirmed · ${processedBill} processed · ${noteCount} notes · ${consentCount} consents`;
        }
    }

    if (hasCurrentPatient()) {
        const boardHtml = renderOpenChartBoard();
        if (empty) empty.classList.add('hidden');
        root.innerHTML = boardHtml;
        return;
    }

    if (mgmtActiveFilter === 'billing') {
        const awaiting = bills.filter((item) => item.status === 'awaiting' || !item.status).map(billingViewModel);
        const confirmed = bills.filter((item) => item.status === 'confirmed').map(billingViewModel);
        const processed = bills.filter((item) => item.status === 'processed').map(billingViewModel);
        if (empty) empty.classList.toggle('hidden', awaiting.length + confirmed.length + processed.length > 0);
        root.innerHTML = `<div class="lg:col-span-2 space-y-4">${renderBillingQueue(awaiting)}${renderConfirmedBillingQueue(confirmed)}${renderProcessedBillingQueue(processed)}</div>`;
        return;
    }

    if (mgmtActiveFilter === 'notes') {
        const notes = typeof adminVisitNotes === 'function' ? adminVisitNotes() : [];
        const consents = typeof adminConsentDocs === 'function' ? adminConsentDocs() : [];
        if (empty) empty.classList.toggle('hidden', notes.length + consents.length > 0);
        const notesHtml = typeof renderSavedVisitNotesQueue === 'function'
            ? renderSavedVisitNotesQueue(notes)
            : '<p class="text-sm text-slate-400 italic lg:col-span-2">Saved notes are not available.</p>';
        const consentsHtml = typeof renderSavedConsentDocsQueue === 'function'
            ? renderSavedConsentDocsQueue(consents)
            : '';
        root.innerHTML = `<div class="lg:col-span-2 space-y-4">${notesHtml}${consentsHtml}</div>`;
        return;
    }

    const visible = chart.filter((item) => lesionMatchesFilter(item, mgmtActiveFilter));
    if (empty) empty.classList.toggle('hidden', visible.length > 0);

    if (mgmtActiveFilter === 'open' || mgmtActiveFilter === 'active') {
        if (empty) empty.classList.toggle('hidden', visible.length > 0);
        root.innerHTML = renderOpenLesionBoard(visible);
        return;
    }

    root.innerHTML = renderStatusColumn(mgmtActiveFilter, visible);
}

function renderOpenLesionBoard(items) {
    const html = renderPatientEpisodeGroups(items, (lesion, opts) => renderManagedLesionCard(lesion, opts));
    return html || '<p class="text-sm text-slate-400 italic lg:col-span-2">No open lesions.</p>';
}

function renderNamedStatusColumn(title, items) {
    const grouped = renderPatientEpisodeGroups(items, (lesion, opts) => renderManagedLesionCard(lesion, opts));
    return `
        <section class="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden lg:col-span-2">
            <header class="px-4 py-3 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
                <h3 class="text-sm font-bold text-slate-800">${escapeHtml(title)}</h3>
                <span class="text-[11px] font-semibold text-slate-500">${items.length}</span>
            </header>
            <div class="p-3 space-y-3">
                ${grouped || '<p class="text-sm text-slate-400 italic">No lesions in this queue.</p>'}
            </div>
        </section>`;
}

function renderStatusColumn(status, items) {
    const title = (status === 'planned_excision' || status === 'planned_procedure')
        ? 'Planned procedure'
        : status === 'awaiting_histology' ? 'Awaiting results'
        : status === 'needs_contact' ? 'Needs contact'
        : status === 'appointment_requested' ? 'Appointment requested'
        : (LESION_STATUSES[status] || status);
    return renderNamedStatusColumn(title, items);
}

function phoneTelHref(phone) {
    const digits = String(phone || '').trim().replace(/[^\d+]/g, '');
    return digits ? 'tel:' + digits : '';
}

function lesionPatientContactInnerHtml(lesion) {
    const details = typeof patientContactForLesion === 'function'
        ? patientContactForLesion(lesion)
        : { phone: '', sms: '', smsLabel: '' };
    const parts = [];
    if (details.phone) {
        const href = phoneTelHref(details.phone);
        const number = `<span class="font-semibold text-slate-800 select-all">${escapeHtml(details.phone)}</span>`;
        parts.push(href
            ? `<a href="${escapeHtml(href)}" class="lesion-contact-phone" onclick="event.stopPropagation()">${number}</a>`
            : number);
    }
    if (details.smsLabel) {
        const cls = details.sms === 'yes' ? 'text-emerald-800' : 'text-slate-800';
        parts.push(`<span class="${cls} font-semibold">${escapeHtml(details.smsLabel)}</span>`);
    }
    if (!parts.length) return '';
    return parts.join('<span class="text-slate-400"> · </span>');
}

function renderLesionPatientContactHtml(lesion) {
    const inner = lesionPatientContactInnerHtml(lesion);
    return inner ? `<p class="lesion-contact-line">${inner}</p>` : '';
}

function fillLesionPatientContactEl(el, lesion) {
    if (!el) return;
    const inner = lesionPatientContactInnerHtml(lesion);
    el.innerHTML = inner;
    el.classList.toggle('hidden', !inner);
}

function unspecifiedExamText(value) {
    const text = String(value || '').trim();
    if (!text) return '';
    if (/^(unspecified|to be examined|patient reported spot|pending assessment)$/i.test(text)) return '';
    return text;
}

function formatLesionCardWhen(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleString('en-AU', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function formatMmPair(length, width) {
    const a = String(length == null ? '' : length).trim();
    const b = String(width == null ? '' : width).trim();
    if (a && b) return a + ' × ' + b + ' mm';
    if (a) return a + ' mm';
    if (b) return b + ' mm';
    return '';
}

function lesionExamAt(lesion) {
    return lesion?.createdAt || lesion?.examinedAt || '';
}

function lesionProcedureAt(lesion) {
    return lesion?.procedureCompletedAt || lesion?.excisionFinalisedAt || '';
}

function lesionCardRow(label, valueHtml) {
    if (!valueHtml) return '';
    return `<div class="lesion-card-row"><dt>${escapeHtml(label)}</dt><dd>${valueHtml}</dd></div>`;
}

function renderLesionCardBlock(title, when, rowsHtml) {
    if (!rowsHtml) return '';
    return `<section class="lesion-card-block">
        <h4><span>${escapeHtml(title)}</span>${when ? `<time datetime="${escapeHtml(when)}">${escapeHtml(formatLesionCardWhen(when) || when)}</time>` : ''}</h4>
        <dl class="lesion-card-dl">${rowsHtml}</dl>
    </section>`;
}

function lesionExamDimensions(lesion) {
    return formatMmPair(lesion?.length, lesion?.width);
}

function lesionExamMargin(lesion) {
    const mm = String(lesion?.margin || '').trim();
    return mm ? mm + ' mm' : '';
}

function lesionProcedureTypeLabel(lesion) {
    const detail = typeof procedureDetailForLesion === 'function' ? procedureDetailForLesion(lesion) : {};
    const type = typeof lesionType === 'function' ? lesionType(lesion) : (lesion?.type || '');
    if (type === 'shave' || detail.procedure === 'Shave') return 'Shave biopsy';
    if (type === 'punch' || detail.procedure === 'Punch') {
        return detail.punchType || lesion?.biopsyType || 'Punch biopsy';
    }
    if (type === 'excision' || detail.procedure === 'Excision') {
        const bits = [lesion?.priorLesionId ? 'Re-excision' : 'Excision'];
        if (detail.excisionClosureType) bits.push(detail.excisionClosureType);
        if (detail.graftType) bits.push(detail.graftType);
        return bits.join(' · ');
    }
    if (type === 'topical') return 'Topical';
    if (detail.procedure) return detail.procedure;
    if (lesion?.biopsyType) return lesion.biopsyType;
    return '';
}

function lesionProcedureDimensions(lesion) {
    const detail = typeof procedureDetailForLesion === 'function' ? procedureDetailForLesion(lesion) : {};
    const type = typeof lesionType === 'function' ? lesionType(lesion) : (lesion?.type || '');
    const done = typeof lesionProcedureDone === 'function' ? lesionProcedureDone(lesion) : !!lesionProcedureAt(lesion);
    if (type === 'punch' || detail.procedure === 'Punch') {
        const punch = String(detail.punchSize || lesion?.punchSize || '').trim();
        return punch ? punch + ' mm punch' : '';
    }
    const pair = formatMmPair(
        done ? (detail.length || lesion?.excisionLengthMm) : lesion?.excisionLengthMm,
        done ? (detail.width || lesion?.excisionWidthMm) : lesion?.excisionWidthMm
    );
    if (pair) return pair;
    const punch = String(detail.punchSize || lesion?.punchSize || '').trim();
    return punch ? punch + ' mm punch' : '';
}

function lesionProcedureMargin(lesion) {
    const detail = typeof procedureDetailForLesion === 'function' ? procedureDetailForLesion(lesion) : {};
    const mm = String(detail.margin || lesion?.excisionMarginMm || lesion?.excisionMargin || '').trim();
    if (mm) return mm + ' mm';
    const exam = String(lesion?.margin || '').trim();
    const done = typeof lesionProcedureDone === 'function' ? lesionProcedureDone(lesion) : !!lesionProcedureAt(lesion);
    return done && exam ? exam + ' mm' : '';
}

function lesionHistologyCardValue(lesion) {
    const done = typeof lesionProcedureDone === 'function' ? lesionProcedureDone(lesion) : !!lesionProcedureAt(lesion);
    const hasResult = typeof lesionHasSavedHistology === 'function'
        ? lesionHasSavedHistology(lesion)
        : !!String(lesion?.histologyResult || '').trim();
    const accession = typeof formatHistologyAccession === 'function' ? formatHistologyAccession(lesion, 'own') : '';
    const pot = lesion?.histologyPot ? 'Pot ' + lesion.histologyPot : '';
    const extras = [accession ? 'Lab case ' + accession : '', pot].filter(Boolean).join(' · ');
    if (hasResult) {
        const detail = typeof billingHistologyDetail === 'function'
            ? billingHistologyDetail(lesion)
            : (lesion.histologyResult || lesion.histologyDiagnosis || '');
        return [detail || 'Recorded', extras].filter(Boolean).join(' · ');
    }
    if (done) return extras ? 'Pending · ' + extras : 'Pending';
    return '';
}

function lesionTimelineTypeLabel(type) {
    return {
        call_attempt: 'Call',
        voicemail: 'Voicemail',
        sms: 'SMS',
        spoke: 'Spoke',
        result_advised: 'Result advised',
        plan: 'Plan',
        procedure: 'Procedure',
        abort: 'Aborted',
        histology: 'Histology',
        consent: 'Consent'
    }[type] || type || 'Action';
}

function isLesionContactEvent(event) {
    if (!event) return false;
    return ['call_attempt', 'voicemail', 'sms', 'spoke', 'result_advised'].includes(event.type)
        || (typeof CALL_OUTCOMES !== 'undefined' && CALL_OUTCOMES.includes(event.outcome));
}

function lesionCardEvents(lesion) {
    const events = typeof ensureLesionTimeline === 'function'
        ? ensureLesionTimeline(lesion).slice()
        : (Array.isArray(lesion?.timeline) ? lesion.timeline.slice() : []);
    return events.sort((a, b) => String(a.at || '').localeCompare(String(b.at || '')));
}

function renderLesionCardEventLine(event) {
    const when = formatLesionCardWhen(event.at) || '';
    const typeLabel = lesionTimelineTypeLabel(event.type);
    const outcome = String(event.outcome || '').trim();
    const head = outcome && outcome.toLowerCase() !== typeLabel.toLowerCase()
        ? typeLabel + ' · ' + outcome
        : typeLabel;
    const noteBits = [];
    if (event.note) noteBits.push(event.note);
    if (event.planAfter && event.planAfter !== event.note) noteBits.push('Plan: ' + event.planAfter);
    const note = noteBits.join(' — ');
    return `<li>
        <time>${escapeHtml(when)}</time>
        <span><strong>${escapeHtml(head)}</strong>${note ? ' · ' + escapeHtml(note) : ''}</span>
    </li>`;
}

function renderLesionExamBlock(lesion) {
    const macro = unspecifiedExamText(lesion?.macroscopic);
    const dermoscopy = unspecifiedExamText(lesion?.dermoscopy);
    const features = [macro ? 'Macro: ' + macro : '', dermoscopy ? 'Dermoscopy: ' + dermoscopy : '']
        .filter(Boolean).join(' · ');
    const impression = unspecifiedExamText(
        (typeof formatDiagnosisDisplay === 'function' ? formatDiagnosisDisplay(lesion?.impression) : '')
        || lesion?.impression
    );
    const rows = [
        lesionCardRow('Features', features ? escapeHtml(features) : ''),
        lesionCardRow('Impression', impression ? escapeHtml(impression) : ''),
        lesionCardRow('Dimensions', escapeHtml(lesionExamDimensions(lesion))),
        lesionCardRow('Margin', escapeHtml(lesionExamMargin(lesion)))
    ].join('');
    const at = lesionExamAt(lesion);
    if (!rows && !at) return '';
    const empty = !rows ? lesionCardRow('Recorded', 'Examination saved') : rows;
    return renderLesionCardBlock('Examination', at, empty);
}

function renderLesionProcedureBlock(lesion) {
    const type = typeof lesionType === 'function' ? lesionType(lesion) : (lesion?.type || '');
    const done = typeof lesionProcedureDone === 'function' ? lesionProcedureDone(lesion) : !!lesionProcedureAt(lesion);
    const planned = ['planned_procedure', 'current_case'].includes(
        typeof lesionLifecycleStatus === 'function' ? lesionLifecycleStatus(lesion) : lesion?.managementStatus
    );
    if (type === 'topical' && !done) {
        const discussed = Array.isArray(lesion?.topicalDiscussed) ? lesion.topicalDiscussed.join(', ') : '';
        const rows = [
            lesionCardRow('Decision', escapeHtml(lesion?.topicalDecision || '')),
            lesionCardRow('Discussed', escapeHtml(discussed)),
            lesionCardRow('Follow-up', lesion?.topicalFollowUp && lesion.topicalFollowUp !== 'none'
                ? escapeHtml(lesion.topicalFollowUp) : '')
        ].join('');
        return renderLesionCardBlock('Topical', lesionExamAt(lesion), rows);
    }
    if (!done && !planned && type !== 'punch' && type !== 'shave' && type !== 'excision') return '';
    const rows = [
        lesionCardRow('Type', escapeHtml(lesionProcedureTypeLabel(lesion))),
        lesionCardRow('Histology', done ? escapeHtml(lesionHistologyCardValue(lesion)) : ''),
        lesionCardRow('Dimensions', escapeHtml(lesionProcedureDimensions(lesion))),
        lesionCardRow('Margin', escapeHtml(lesionProcedureMargin(lesion)))
    ].join('');
    if (!rows) return '';
    return renderLesionCardBlock(done ? 'Procedure' : 'Planned procedure', done ? lesionProcedureAt(lesion) : '', rows);
}

function renderLesionContactBlock(lesion) {
    const events = lesionCardEvents(lesion).filter(isLesionContactEvent);
    if (!events.length) return '';
    return `<section class="lesion-card-block">
        <h4><span>Contact</span></h4>
        <ul class="lesion-card-log">${events.map(renderLesionCardEventLine).join('')}</ul>
    </section>`;
}

function renderLesionActionLog(lesion) {
    const events = lesionCardEvents(lesion).filter((event) => !isLesionContactEvent(event));
    if (!events.length) return '';
    return `<section class="lesion-card-block">
        <h4><span>Actions</span></h4>
        <ul class="lesion-card-log">${events.map(renderLesionCardEventLine).join('')}</ul>
    </section>`;
}

function renderLesionBillingBlock(lesion) {
    const bill = typeof billingForLesion === 'function' ? billingForLesion(lesion.id) : null;
    if (!bill) return '';
    const vm = typeof billingViewModel === 'function' ? billingViewModel(bill) : bill;
    const codes = vm.assignedMbsItems || vm.suggestedMbsItems || '';
    const status = typeof billingStatusLabel === 'function' ? billingStatusLabel(bill) : (bill.status || '');
    const billId = String(bill.id || '').replace(/'/g, '');
    const lesionId = String(lesion.id || bill.lesionId || '').replace(/'/g, '');
    const meta = typeof billingCardMeta === 'function' ? billingCardMeta(vm) : '';
    let actions = '';
    if (bill.status === 'confirmed') {
        actions = `
            <button type="button" onclick="copySuggestedBillingItems('${billId}')" class="mgmt-action-btn">Copy codes</button>
            <button type="button" onclick="printConfirmedBillings('${billId}')" class="mgmt-action-btn">Print</button>
            <button type="button" onclick="markBillingsAsProcessed(['${billId}'])" class="mgmt-action-btn mgmt-action-btn-primary">Mark processed</button>
            <button type="button" onclick="returnBillingToAwaiting('${billId}')" class="mgmt-action-btn">Return to awaiting</button>`;
    } else if (bill.status === 'processed') {
        actions = `
            <button type="button" onclick="copySuggestedBillingItems('${billId}')" class="mgmt-action-btn">Copy codes</button>
            <button type="button" onclick="returnBillingToConfirmed('${billId}')" class="mgmt-action-btn">Return to confirmed</button>`;
    } else if (lesionId && typeof canOpenProcessBilling === 'function' && canOpenProcessBilling(lesion)) {
        actions = `<button type="button" onclick="openProcessBillingModal('${lesionId}')" class="mgmt-action-btn mgmt-action-btn-primary">Process session billing</button>`;
    } else if (lesionId) {
        const hold = typeof procedureGroupBillingReady === 'function' ? procedureGroupBillingReady(lesion) : null;
        actions = `<p class="text-[11px] text-amber-800">${escapeHtml(hold?.reason || 'Enter histology for all lesions in this procedure before billing.')}</p>`;
    }
    return `
        <div class="rounded-lg border border-slate-200 bg-white p-2.5 space-y-1.5">
            <p class="text-[10px] font-bold uppercase tracking-wider text-slate-500">Billing · ${escapeHtml(status)}</p>
            ${meta ? `<p class="text-[11px] text-slate-500">${escapeHtml(meta)}</p>` : ''}
            ${codes && typeof renderBillingCodeChips === 'function' ? `<div class="flex flex-wrap items-center gap-1.5">${renderBillingCodeChips(codes)}</div>` : ''}
            ${actions ? `<div class="flex flex-wrap gap-1.5">${actions}</div>` : ''}
        </div>`;
}

function renderManagedLesionCard(lesion, options) {
    const grouped = !!(options && options.grouped);
    const chartBoard = !!(options && options.chartBoard);
    const patient = lesion.patientName || 'Unnamed patient';
    const identity = typeof patientIdentityFromRecord === 'function' ? patientIdentityFromRecord(lesion) : null;
    const canFocus = !!(identity?.chartId || (lesion.patientName && lesion.patientDob));
    const bill = typeof billingForLesion === 'function' ? billingForLesion(lesion.id) : null;
    const billLabel = bill && !chartBoard ? billingStatusLabel(bill) : '';
    const safeId = String(lesion.id || '').replace(/'/g, '');
    const contactHtml = grouped ? '' : renderLesionPatientContactHtml(lesion);
    const nameHtml = grouped
        ? ''
        : (canFocus
            ? `<button type="button" onclick="openChartFromLesion('${safeId}')" class="text-left min-w-0 cursor-pointer group">
                    <span class="text-sm font-semibold text-slate-800 truncate group-hover:text-blue-700">${escapeHtml(patient)}</span>${hasCurrentPatient() ? '' : ' <span class="text-[10px] font-semibold text-blue-700">Open chart</span>'}
               </button>`
            : `<p class="text-sm font-semibold text-slate-800 truncate">${escapeHtml(patient)}</p>`);
    const dx = typeof billingDisplayDiagnosis === 'function'
        ? billingDisplayDiagnosis(lesion)
        : (typeof formatDiagnosisDisplay === 'function' ? formatDiagnosisDisplay(lesion.impression) : (lesion.impression || ''));
    const status = typeof lesionStatusLabel === 'function' ? lesionStatusLabel(lesion) : (lesion.plan || '');
    const missed = typeof lastUnsuccessfulCall === 'function' ? lastUnsuccessfulCall(lesion) : null;
    const prior = typeof formatPriorHistologyCitation === 'function' && lesion.priorLesionId
        ? formatPriorHistologyCitation(lesion)
        : '';

    if (chartBoard) {
        const examHtml = renderLesionExamBlock(lesion);
        const procedureHtml = renderLesionProcedureBlock(lesion);
        return `
        <article class="p-3 rounded-lg border border-slate-200 bg-slate-50/70 space-y-2">
            <div class="flex justify-between gap-2">
                <div class="min-w-0">
                    <p class="text-sm font-semibold text-slate-800">${escapeHtml(lesion.location || 'No site')}</p>
                    <p class="text-xs text-slate-600">${dx ? escapeHtml(dx) : escapeHtml(status)}</p>
                </div>
                <span class="text-[10px] font-bold uppercase tracking-wider text-slate-500 shrink-0">${escapeHtml(status)}</span>
            </div>
            ${missed ? `<p class="lesion-call-badge">${escapeHtml(formatCallBadge(missed))}</p>` : ''}
            ${prior ? `<p class="text-[11px] text-slate-600">${escapeHtml(prior)}</p>` : ''}
            ${lesion.currentPlan ? `<p class="text-[11px] text-slate-700"><span class="font-semibold text-slate-600">Plan:</span> ${escapeHtml(lesion.currentPlan)}</p>` : ''}
            ${examHtml}
            ${procedureHtml}
            ${renderLesionContactBlock(lesion)}
            ${renderLesionActionLog(lesion)}
            ${renderLesionBillingBlock(lesion)}
            <div class="flex flex-wrap gap-1.5">${renderManagedLesionActions(lesion, options)}</div>
        </article>`;
    }

    const fu = lesion.topicalFollowUp && lesion.topicalFollowUp !== 'none'
        ? `Follow-up: ${escapeHtml(lesion.topicalFollowUp)}`
        : '';
    const region = lesion.billingRegion ? procedureAreaLabel(lesion.billingRegion) : '';
    const dims = lesionExamDimensions(lesion) || lesionProcedureDimensions(lesion);
    return `
        <article class="p-3 rounded-lg border border-slate-200 bg-slate-50/70 space-y-2">
            <div class="flex justify-between gap-2">
                <div class="min-w-0">
                    ${nameHtml}
                    <p class="text-xs text-slate-600">${escapeHtml(lesion.location || 'No site')}${dx ? ' · ' + escapeHtml(dx) : ''}</p>
                    ${contactHtml}
                </div>
                <span class="text-[10px] text-slate-400 shrink-0">${escapeHtml(formatLesionWhen(lesionProcedureAt(lesion) || lesionExamAt(lesion) || lesion.updatedAt))}</span>
            </div>
            <p class="text-[11px] text-slate-500">${escapeHtml(status)}${fu ? ' · ' + fu : ''}${region ? ' · ' + escapeHtml(region) : ''}${dims ? ' · ' + escapeHtml(dims) : ''}${billLabel ? ' · Billing: ' + escapeHtml(billLabel) : ''}</p>
            ${lesion.currentPlan ? `<p class="text-[11px] text-slate-700"><span class="font-semibold text-slate-600">Plan:</span> ${escapeHtml(lesion.currentPlan)}</p>` : ''}
            ${missed ? `<p class="lesion-call-badge">${escapeHtml(formatCallBadge(missed))}</p>` : ''}
            ${lesion.histologyResult ? `<p class="text-[11px] text-slate-600">Result: ${escapeHtml(lesion.histologyResult)}</p>` : ''}
            ${typeof formatHistologyAccession === 'function' && formatHistologyAccession(lesion, 'own')
                ? `<p class="text-[11px] text-slate-600">Lab case: ${escapeHtml(formatHistologyAccession(lesion, 'own'))}</p>`
                : (lesion.histologyPot
                    ? `<p class="text-[11px] text-slate-600">Pot ${escapeHtml(String(lesion.histologyPot))}${lesion.histologyBatchId ? ' (this procedure)' : ''}</p>`
                    : '')}
            ${prior ? `<p class="text-[11px] text-slate-600">${escapeHtml(prior)}</p>` : ''}
            <div class="flex flex-wrap gap-1.5">${renderManagedLesionActions(lesion, options)}</div>
        </article>`;
}

function canUpdateResult(lesion) {
    if (typeof isOpenManagementChild === 'function' && isOpenManagementChild(lesion) && !String(lesion?.histologyResult || '').trim()) {
        return false;
    }
    const status = lesionLifecycleStatus(lesion);
    return status === 'awaiting_histology' || status === 'needs_contact' || status === 'appointment_requested'
        || !!lesion.procedureCompletedAt || !!lesion.histologyResult;
}

function renderManagedLesionActions(lesion, options) {
    const id = String(lesion.id || '').replace(/'/g, '');
    const chartBoard = !!(options && options.chartBoard);
    const btns = [];
    btns.push(`<button type="button" onclick="openLesionCommsModal('${id}')" class="mgmt-action-btn">Log contact</button>`);
    if (canUpdateResult(lesion)) {
        btns.push(`<button type="button" onclick="openHistologyModal('${id}')" class="mgmt-action-btn">Update result</button>`);
    }
    if (!chartBoard && typeof canOpenProcessBilling === 'function' && canOpenProcessBilling(lesion)) {
        btns.push(`<button type="button" onclick="openProcessBillingModal('${id}')" class="mgmt-action-btn mgmt-action-btn-primary">Process session billing</button>`);
    }
    if (String(lesion.proposedPlan || '') === 'refer' || (typeof isReferLesionPlan === 'function' && isReferLesionPlan(lesion.plan))) {
        btns.push(`<button type="button" onclick="openLetterModalForRefer('${id}')" class="mgmt-action-btn">Generate letter</button>`);
    }
    return btns.join('');
}

function openLesionDocumentation(id) {
    if (typeof requireRoomReady === 'function' && !requireRoomReady('skin-check')) return;
    if (typeof switchWorkspaceTab === 'function') switchWorkspaceTab('skin-check');
    if (typeof openLesionModal === 'function') openLesionModal(id);
}

async function openChartFromLesion(id) {
    const lesion = managedLesions.find((item) => String(item.id) === String(id))
        || (typeof lesions !== 'undefined' ? lesions.find((item) => String(item.id) === String(id)) : null);
    if (!lesion) {
        showToast('Could not find that lesion.');
        return;
    }
    const identity = typeof patientIdentityFromRecord === 'function'
        ? patientIdentityFromRecord(lesion)
        : {
            name: lesion.patientName || '',
            dob: lesion.patientDob || '',
            clinician: lesion.clinician || '',
            chartId: lesion.chartId || ''
        };
    if (!identity.name && !identity.chartId) {
        showToast('This lesion has no patient chart yet.');
        return;
    }
    if (typeof openPatientChart === 'function') {
        const ok = await openPatientChart({
            name: identity.name,
            firstName: identity.firstName,
            lastName: identity.lastName,
            dob: identity.dob,
            phone: identity.phone,
            clinician: identity.clinician || lesion.clinician || '',
            chartId: identity.chartId || lesion.chartId
        }, { keepFilter: true });
        if (!ok) return;
    } else {
        setCurrentPatient({
            name: identity.name,
            dob: identity.dob,
            clinician: identity.clinician || '',
            chartId: identity.chartId
        });
        renderManagedLesions();
    }
    if (typeof selectChartLesion === 'function') selectChartLesion(id, { skipComms: true });
}

function focusPatientFromLesion(id) {
    return openChartFromLesion(id);
}

function lesionCommsTypeFromForm(channel, outcome) {
    if (channel === 'sms') return 'sms';
    if (channel === 'result_advised') return 'result_advised';
    if (channel === 'plan') return 'plan';
    if (channel === 'spoke' || outcome === 'spoke') return 'spoke';
    if (channel === 'voicemail' || outcome === 'voicemail') return 'voicemail';
    return 'call_attempt';
}

function formatTimelineEvent(event) {
    const when = typeof formatLesionWhen === 'function' ? formatLesionWhen(event.at) : (event.at || '');
    const typeLabel = {
        call_attempt: 'Call',
        voicemail: 'Voicemail',
        sms: 'SMS',
        spoke: 'Spoke',
        result_advised: 'Result advised',
        plan: 'Plan',
        procedure: 'Procedure',
        abort: 'Aborted',
        histology: 'Histology',
        consent: 'Consent'
    }[event.type] || event.type;
    const bits = [typeLabel];
    if (event.outcome) bits.push(event.outcome);
    const head = bits.join(' · ');
    const note = event.note ? escapeHtml(event.note) : '';
    const plan = event.planAfter ? `<div class="text-[11px] text-slate-600">Plan: ${escapeHtml(event.planAfter)}</div>` : '';
    return `<li class="lesion-timeline-item">
        <div class="flex justify-between gap-2">
            <span class="font-semibold text-slate-800">${escapeHtml(head)}</span>
            <span class="text-[10px] text-slate-400 shrink-0">${escapeHtml(when)}</span>
        </div>
        ${note ? `<p class="text-[12px] text-slate-600 mt-0.5">${note}</p>` : ''}
        ${plan}
        ${event.by ? `<p class="text-[10px] text-slate-400">${escapeHtml(event.by)}</p>` : ''}
    </li>`;
}

function openLesionCommsModal(id) {
    const lesion = managedLesions.find((item) => String(item.id) === String(id))
        || (typeof chartLesions === 'function' ? chartLesions() : []).find((item) => String(item.id) === String(id));
    const modal = document.getElementById('lesionCommsModal');
    if (!lesion || !modal) return;
    const idEl = document.getElementById('lesionCommsLesionId');
    const summaryEl = document.getElementById('lesionCommsSummary');
    const planEl = document.getElementById('lesionCommsCurrentPlan');
    const listEl = document.getElementById('lesionCommsTimeline');
    const channelEl = document.getElementById('lesionCommsChannel');
    const outcomeEl = document.getElementById('lesionCommsOutcome');
    const noteEl = document.getElementById('lesionCommsNote');
    const newPlanEl = document.getElementById('lesionCommsNewPlan');
    if (idEl) idEl.value = id;
    if (summaryEl) {
        summaryEl.textContent = `${lesion.patientName || currentPatient?.name || ''} — ${lesion.location || 'site'} · ${lesion.impression || ''}`;
    }
    fillLesionPatientContactEl(document.getElementById('lesionCommsContact'), lesion);
    if (planEl) planEl.textContent = lesion.currentPlan || 'No current plan recorded.';
    const events = typeof lesionTimelineNewestFirst === 'function' ? lesionTimelineNewestFirst(lesion) : [];
    if (listEl) {
        listEl.innerHTML = events.length
            ? events.map(formatTimelineEvent).join('')
            : '<li class="text-xs text-slate-400 italic">No communication recorded yet.</li>';
    }
    if (channelEl) channelEl.value = 'call_attempt';
    if (outcomeEl) outcomeEl.value = 'no answer';
    if (noteEl) noteEl.value = '';
    if (newPlanEl) newPlanEl.value = '';
    updateLesionCommsOutcomeVisibility();
    modal.classList.remove('hidden');
}

function closeLesionCommsModal() {
    const modal = document.getElementById('lesionCommsModal');
    if (modal) modal.classList.add('hidden');
}

function updateLesionCommsOutcomeVisibility() {
    const channel = document.getElementById('lesionCommsChannel')?.value || 'call_attempt';
    const wrap = document.getElementById('lesionCommsOutcomeWrap');
    if (wrap) wrap.classList.toggle('hidden', channel === 'sms' || channel === 'plan' || channel === 'result_advised');
}

async function submitLesionCommsModal() {
    const id = document.getElementById('lesionCommsLesionId')?.value;
    const lesion = managedLesions.find((item) => String(item.id) === String(id));
    if (!lesion) return;
    const channel = document.getElementById('lesionCommsChannel')?.value || 'call_attempt';
    const outcome = document.getElementById('lesionCommsOutcome')?.value || '';
    const note = document.getElementById('lesionCommsNote')?.value.trim() || '';
    const newPlan = document.getElementById('lesionCommsNewPlan')?.value.trim() || '';
    const type = lesionCommsTypeFromForm(channel, outcome);
    const useOutcome = channel === 'sms' || channel === 'plan' || channel === 'result_advised' ? '' : outcome;
    const advised = type === 'spoke' || type === 'result_advised' || outcome === 'spoke';
    const hasResult = typeof lesionHasSavedHistology === 'function'
        ? lesionHasSavedHistology(lesion)
        : !!String(lesion.histologyResult || '').trim();
    const awaitingLab = (typeof lesionLifecycleStatus === 'function' ? lesionLifecycleStatus(lesion) : lesion.managementStatus) === 'awaiting_histology';
    if (advised && awaitingLab && !hasResult) {
        showToast('Record the histology result first.');
        closeLesionCommsModal();
        if (typeof openHistologyModal === 'function') openHistologyModal(id);
        return;
    }
    if (hasResult && typeof repairLesionAwaitingAfterResult === 'function') {
        repairLesionAwaitingAfterResult(lesion);
    }
    if (!note && !newPlan && type === 'plan') {
        showToast('Enter a note or a new plan.');
        return;
    }
    const planAfter = newPlan || lesion.currentPlan || '';
    appendLesionTimeline(lesion, {
        type,
        outcome: useOutcome,
        note,
        planAfter
    });
    if (newPlan) lesion.currentPlan = newPlan;
    if (useOutcome && typeof applyContactOutcomeToLesion === 'function') {
        applyContactOutcomeToLesion(lesion, useOutcome);
    }
    await saveManagedLesionRecord(lesion, 'comms:' + type, note || planAfter);
    closeLesionCommsModal();
    if (advised && typeof applyAdviceFromContact === 'function') {
        const follow = await applyAdviceFromContact(lesion);
        if (follow?.needResult) {
            showToast('Record the histology result first.');
            if (typeof openHistologyModal === 'function') openHistologyModal(id);
            if (typeof renderChartSidebar === 'function') renderChartSidebar();
            return;
        }
        if (follow?.openExcision) {
            if (typeof lesionHasSavedHistology === 'function' && !lesionHasSavedHistology(lesion)
                && !(typeof isOpenManagementChild === 'function' && isOpenManagementChild(lesion))) {
                showToast('Save histology before booking a re-excision.');
                if (typeof openHistologyModal === 'function') openHistologyModal(id);
            } else {
                const openId = follow.openChildId || lesion.id;
                showToast(follow.spawnedManagement
                    ? 'Patient advised. Set the plan on the linked lesion in Lesions.'
                    : 'Patient advised. Book the excision in Lesions.');
                openLesionDocumentation(openId);
            }
            if (typeof renderChartSidebar === 'function') renderChartSidebar();
            return;
        }
        if (follow?.openLetter) {
            const openId = follow.openChildId || lesion.id;
            showToast(follow.spawnedManagement
                ? 'Patient advised. Further management opened — generate the referral letter when ready.'
                : 'Patient advised. Generate the referral letter when ready.');
            if (typeof openLetterModalForRefer === 'function') openLetterModalForRefer(openId);
            else if (typeof openLetterModal === 'function') openLetterModal({ letterType: 'specialist_referral', preferLesionIds: [openId] });
            if (typeof renderChartSidebar === 'function') renderChartSidebar();
            return;
        }
        if (follow?.closed) {
            showToast('Patient advised. No further action.');
            if (typeof renderChartSidebar === 'function') renderChartSidebar();
            return;
        }
        if (follow?.billingHold) {
            showToast('Patient advised. Confirm billing before the lesion can leave the board.');
            if (typeof renderChartSidebar === 'function') renderChartSidebar();
            return;
        }
        if (follow?.needPlan) {
            showToast('Patient advised. Record the plan in Update result.');
            if (typeof renderChartSidebar === 'function') renderChartSidebar();
            return;
        }
    }
    showToast('Communication saved.');
    if (typeof renderChartSidebar === 'function') renderChartSidebar();
}

function renderBillingQueue(items) {
    const body = items.length
        ? renderPatientEpisodeGroups(items, (view, opts) => renderBillingQueueCard(view, opts), { sourceOf: billingRecordSource })
        : '<p class="p-4 text-slate-400 italic text-sm">No lesions awaiting billing.</p>';
    return `
        <section class="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden lg:col-span-2">
            <header class="px-4 py-3 bg-amber-50 border-b border-amber-200 flex flex-wrap justify-between items-center gap-2">
                <div>
                    <h3 class="text-sm font-bold text-slate-800">Awaiting billings</h3>
                    <p class="text-[11px] text-slate-500 mt-0.5">Separate from clinical management. Confirm item numbers here; they move to Confirmed billings for the practice manager.</p>
                </div>
                <span class="text-[11px] font-semibold text-slate-500">${items.length}</span>
            </header>
            <div class="p-3 space-y-3">
                ${body}
            </div>
        </section>`;
}

function renderConfirmedBillingQueue(items) {
    const body = items.length
        ? renderPatientEpisodeGroups(items, (view, opts) => renderConfirmedBillingCard(view, opts), { sourceOf: billingRecordSource })
        : '<p class="p-4 text-slate-400 italic text-sm">No confirmed billings yet.</p>';
    return `
        <section class="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden lg:col-span-2">
            <header class="px-4 py-3 bg-emerald-50 border-b border-emerald-200 flex flex-wrap justify-between items-center gap-2">
                <div>
                    <h3 class="text-sm font-bold text-slate-800">Confirmed billings</h3>
                    <p class="text-[11px] text-slate-500 mt-0.5">Ready for the practice manager. Print this list, then mark items processed once they have been entered.</p>
                </div>
                <div class="flex flex-wrap items-center gap-1.5">
                    <span class="text-[11px] font-semibold text-slate-500">${items.length}</span>
                    ${items.length ? `
                        <button type="button" onclick="toggleAllConfirmedBillingChecks(true)" class="mgmt-action-btn">Select all</button>
                        <button type="button" onclick="printConfirmedBillings()" class="mgmt-action-btn mgmt-action-btn-primary">Print for practice manager</button>
                        <button type="button" onclick="processSelectedBilling()" class="mgmt-action-btn">Mark processed</button>
                    ` : ''}
                </div>
            </header>
            <div class="p-3 space-y-3">
                ${body}
            </div>
        </section>`;
}

function renderProcessedBillingQueue(items) {
    const body = items.length
        ? renderPatientEpisodeGroups(items, (view, opts) => renderProcessedBillingCard(view, opts), { sourceOf: billingRecordSource })
        : '<p class="p-4 text-slate-400 italic text-sm">No processed billings yet.</p>';
    return `
        <section class="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden lg:col-span-2">
            <header class="px-4 py-3 bg-slate-50 border-b border-slate-200 flex flex-wrap justify-between items-center gap-2">
                <div>
                    <h3 class="text-sm font-bold text-slate-800">Processed billings</h3>
                    <p class="text-[11px] text-slate-500 mt-0.5">Entered by the practice manager. Kept 14 days, then deleted. Print if you need a copy for Best Practice.</p>
                </div>
                <div class="flex flex-wrap items-center gap-1.5">
                    <span class="text-[11px] font-semibold text-slate-500">${items.length}</span>
                    ${items.length ? `<button type="button" onclick="printProcessedBillings()" class="mgmt-action-btn">Print processed</button>` : ''}
                </div>
            </header>
            <div class="p-3 space-y-3">
                ${body}
            </div>
        </section>`;
}

function billingCardMeta(lesion) {
    const region = procedureAreaLabel(lesion.billingRegion || billingRegionFromBodyArea(lesion.bodyAreaId));
    const dims = [lesion.excisionLengthMm, lesion.excisionWidthMm].filter(Boolean).join(' × ');
    const margin = lesion.excisionMarginMm ? `margin ${lesion.excisionMarginMm} mm` : '';
    const closure = lesion.excisionClosureType || '';
    return [
        region,
        dims ? dims + ' mm' : '',
        margin,
        closure,
        lesion.histologyResult || lesion.histologyDiagnosis
            ? 'Histo: ' + (typeof billingHistologyDetail === 'function' ? billingHistologyDetail(lesion) : (lesion.histologyResult || lesion.histologyDiagnosis))
            : '',
        (typeof formatHistologyAccession === 'function' && formatHistologyAccession(lesion, 'own'))
            ? 'Case ' + formatHistologyAccession(lesion, 'own')
            : '',
        lesion.punchSize ? 'Punch ' + lesion.punchSize + ' mm' : ''
    ].filter(Boolean).join(' · ');
}

function renderBillingQueueCard(view, options) {
    const grouped = !!(options && options.grouped);
    const type = inferBillingLesionType(view);
    const suggestionLesion = { ...view, billingLesionType: type };
    const suggestion = suggestMbsItems(suggestionLesion);
    const dx = typeof billingDisplayDiagnosis === 'function' ? billingDisplayDiagnosis(view) : (view.impression || '');
    return `
        <article class="p-3 rounded-lg border border-slate-200 bg-white space-y-3">
            <div class="min-w-0">
                ${grouped ? '' : `<p class="text-sm font-semibold text-slate-800">${escapeHtml(view.patientName || '')}</p>`}
                <p class="text-xs text-slate-600">${escapeHtml(view.location || '')}${dx ? ' · ' + escapeHtml(dx) : ''}</p>
                ${grouped ? '' : renderLesionPatientContactHtml(view)}
                <p class="text-[11px] text-slate-500">${escapeHtml(billingCardMeta(view))}</p>
            </div>
            ${view.billWhen === 'hold' || (typeof lesionCanBillAtProcedure === 'function' && lesionCanBillAtProcedure(view).hold)
                ? '<p class="text-[11px] font-semibold text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1">HOLD until histology is in for every lesion in this procedure. Then bill the session together, with one consult item.</p>'
                : '<p class="text-[11px] font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg px-2 py-1">Histology is in for the procedure. Process session billing — one consult plus each lesion.</p>'}
            ${!suggestion.ready ? `<p class="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-2.5">Need location and size (and type for excision) to suggest items. You can still process session billing and enter type there.</p>` : ''}
            <div id="billingSuggest-${view.id}" class="p-2.5 rounded-lg border border-emerald-200 bg-emerald-50/60">
                ${renderBillingSuggestionHtml(suggestionLesion)}
            </div>
            <div class="flex flex-wrap gap-1.5">
                ${typeof canOpenProcessBilling === 'function' && canOpenProcessBilling(view)
                    ? `<button type="button" onclick="openProcessBillingModal('${escapeHtml(String(view.lesionId || ''))}')" class="mgmt-action-btn mgmt-action-btn-primary">Process session billing</button>`
                    : ''}
                <button type="button" onclick="openHistologyModal('${escapeHtml(String(view.lesionId || ''))}')" class="mgmt-action-btn">Update result</button>
            </div>
        </article>`;
}

function renderBillingCodeChips(codes) {
    const parts = String(codes || '').split(/\s*\+\s*/).map((code) => code.trim()).filter(Boolean);
    if (!parts.length) return '<span class="text-slate-400 italic text-xs">No codes stored</span>';
    return parts.map((code) =>
        `<span class="inline-flex items-center px-2 py-0.5 rounded bg-emerald-100 text-emerald-900 font-bold tracking-wide text-xs">${escapeHtml(code)}</span>`
    ).join('<span class="text-slate-400 font-bold">+</span>');
}

function renderConfirmedBillingCard(lesion, options) {
    const grouped = !!(options && options.grouped);
    const codes = lesion.assignedMbsItems || lesion.suggestedMbsItems || '';
    const type = BILLING_LESION_TYPES.find((t) => t.id === inferBillingLesionType(lesion))?.label || '';
    const billId = escapeHtml(String(lesion.id || ''));
    const dx = typeof billingDisplayDiagnosis === 'function' ? billingDisplayDiagnosis(lesion) : (lesion.impression || '');
    return `
        <article class="p-3 rounded-lg border border-slate-200 bg-white space-y-2">
            <div class="flex flex-wrap justify-between gap-2">
                <label class="flex items-start gap-2 min-w-0 cursor-pointer">
                    <input type="checkbox" class="billing-confirmed-check mt-1 rounded text-emerald-700" value="${billId}">
                    <span class="min-w-0">
                        ${grouped ? '' : `<span class="block text-sm font-semibold text-slate-800">${escapeHtml(lesion.patientName || '')}</span>`}
                        <span class="block text-xs text-slate-600">${escapeHtml(lesion.location || '')}${dx ? ' · ' + escapeHtml(dx) : ''}</span>
                        <span class="block text-[11px] text-slate-500">${escapeHtml(billingCardMeta(lesion))}${type ? ' · ' + escapeHtml(type) : ''}</span>
                    </span>
                </label>
                <span class="text-[10px] text-slate-400 shrink-0">${escapeHtml(formatLesionWhen(lesion.confirmedAt || lesion.processedAt || lesion.billingConfirmedAt))}</span>
            </div>
            <div class="flex flex-wrap items-center gap-1.5 pl-6">${renderBillingCodeChips(codes)}</div>
            <div class="flex flex-wrap gap-1.5 pl-6">
                <button type="button" onclick="copySuggestedBillingItems('${billId}')" class="mgmt-action-btn">Copy codes</button>
                <button type="button" onclick="printConfirmedBillings('${billId}')" class="mgmt-action-btn">Print</button>
                <button type="button" onclick="markBillingsAsProcessed(['${billId}'])" class="mgmt-action-btn mgmt-action-btn-primary">Mark processed</button>
                <button type="button" onclick="returnBillingToAwaiting('${billId}')" class="mgmt-action-btn">Return to awaiting</button>
            </div>
        </article>`;
}

function renderProcessedBillingCard(lesion, options) {
    const grouped = !!(options && options.grouped);
    const codes = lesion.assignedMbsItems || lesion.suggestedMbsItems || '';
    const type = BILLING_LESION_TYPES.find((t) => t.id === inferBillingLesionType(lesion))?.label || '';
    const billId = escapeHtml(String(lesion.id || ''));
    const dx = typeof billingDisplayDiagnosis === 'function' ? billingDisplayDiagnosis(lesion) : (lesion.impression || '');
    return `
        <article class="p-3 rounded-lg border border-slate-200 bg-white space-y-2">
            <div class="flex flex-wrap justify-between gap-2">
                <div class="min-w-0">
                    ${grouped ? '' : `<p class="text-sm font-semibold text-slate-800">${escapeHtml(lesion.patientName || '')}</p>`}
                    <p class="text-xs text-slate-600">${escapeHtml(lesion.location || '')}${dx ? ' · ' + escapeHtml(dx) : ''}</p>
                    <p class="text-[11px] text-slate-500">${escapeHtml(billingCardMeta(lesion))}${type ? ' · ' + escapeHtml(type) : ''}</p>
                </div>
                <span class="text-[10px] text-slate-400 shrink-0">${escapeHtml(formatLesionWhen(lesion.processedAt))}${typeof formatBillingProcessedExpiry === 'function' && formatBillingProcessedExpiry(lesion) ? ' · ' + escapeHtml(formatBillingProcessedExpiry(lesion)) : ''}</span>
            </div>
            <div class="flex flex-wrap items-center gap-1.5">${renderBillingCodeChips(codes)}</div>
            <div class="flex flex-wrap gap-1.5">
                <button type="button" onclick="copySuggestedBillingItems('${billId}')" class="mgmt-action-btn">Copy codes</button>
                <button type="button" onclick="returnBillingToConfirmed('${billId}')" class="mgmt-action-btn">Return to confirmed</button>
            </div>
        </article>`;
}

async function updateBillingAllocation(id, field, value) {
    const bill = findManagedBilling(id);
    if (!bill) return;
    bill[field] = value;
    const lesion = managedLesions.find((item) => String(item.id) === String(bill.lesionId));
    if (lesion && (field === 'billingLesionType' || field === 'includeFlapGraft' || field === 'billingGraftType')) {
        lesion[field] = value;
    }
    const view = billingViewModel(bill);
    if (field === 'billingLesionType' || field === 'includeFlapGraft' || field === 'billingGraftType') {
        bill.suggestedMbsItems = suggestMbsItems(view).summary;
    }
    const wrap = document.getElementById('billingGraftWrap-' + bill.id);
    if (wrap) wrap.classList.toggle('hidden', !(shouldClaimFlapGraft(view) && usesGraft(inferBillingReconstruction(view))));
    const box = document.getElementById('billingSuggest-' + bill.id);
    if (box) box.innerHTML = renderBillingSuggestionHtml(billingViewModel(bill));
    try {
        await saveManagedBillingRecord(bill, 'billing:' + field, String(value));
        if (lesion && isVaultLoggedIn()) await saveManagedLesionRecord(lesion, 'billing:' + field, String(value), { silent: true });
    } catch (err) {
        showToast(err.message || 'Could not save billing allocation.');
    }
}

function applyBillingSuggestion(id) {
    const bill = findManagedBilling(id);
    if (!bill) return;
    const includeEl = document.getElementById('billingIncludeFlap-' + bill.id);
    if (includeEl) bill.includeFlapGraft = includeEl.checked;
    const view = billingViewModel(bill);
    const suggestion = suggestMbsItems(view);
    const input = document.getElementById('billingCodesInput-' + bill.id);
    if (input) input.value = suggestion.summary || '';
    if (!suggestion.summary) {
        showToast('Need procedure area, size, and assigned type to suggest items. You can still type codes manually.');
        return;
    }
    showToast('Suggestion applied. Send billing when ready.');
}

async function persistProcessedBilling(bill, codes, extra) {
    const silentToast = !!(extra && extra.silentToast);
    if (extra) {
        extra = { ...extra };
        delete extra.silentToast;
    }
    const suggestion = suggestMbsItems(billingViewModel(bill));
    bill.assignedMbsItems = codes;
    bill.suggestedMbsItems = suggestion.summary;
    bill.status = 'confirmed';
    bill.confirmedAt = new Date().toISOString();
    bill.processedAt = '';
    if (extra) Object.assign(bill, extra);
    const lesion = managedLesions.find((item) => String(item.id) === String(bill.lesionId));
    if (lesion) {
        lesion.assignedMbsItems = codes;
        lesion.suggestedMbsItems = suggestion.summary;
        lesion.billingStatus = 'confirmed';
        if (isVaultLoggedIn()) {
            try { await saveManagedLesionRecord(lesion, 'billing:confirmed', codes, { silent: true }); } catch (err) { /* keep billing record even if lesion write fails */ }
        }
    }
    await saveManagedBillingRecord(bill, 'confirmed', codes);
    if (lesion
        && typeof lesionCanCloseNoFollowup === 'function'
        && lesionCanCloseNoFollowup(lesion)
        && lesion.resultPlan === 'no_followup'
        && (lesion.resultAdvisedAt || lesion.contactState === 'file_no_call' || lesion.contactState === 'advised_now')
        && (typeof lesionLifecycleStatus === 'function' ? lesionLifecycleStatus(lesion) : lesion.managementStatus) !== 'no_followup'
        && typeof setManagedLesionStatus === 'function') {
        await setManagedLesionStatus(lesion.id, 'no_followup', 'Billing confirmed', { currentPlan: 'No follow-up' });
    }
    if (!silentToast) {
        showToast('Billing confirmed: ' + codes + '. Print for the practice manager from Billing.');
    }
    renderManagedLesions();
    if (typeof refreshProcedureCompleteOutputs === 'function') refreshProcedureCompleteOutputs();
    return lesion;
}

async function confirmBillingCodes(id) {
    const bill = findManagedBilling(id);
    if (!bill || billingHasBeenSent(bill)) return;
    const includeEl = document.getElementById('billingIncludeFlap-' + bill.id);
    if (includeEl) bill.includeFlapGraft = includeEl.checked;
    const view = billingViewModel(bill);
    const input = document.getElementById('billingCodesInput-' + bill.id);
    const suggestion = suggestMbsItems(view);
    const codes = (input?.value || '').trim() || suggestion.summary;
    if (!codes) {
        showToast('Enter billing codes, or apply the suggestion first.');
        return;
    }
    await persistProcessedBilling(bill, codes);
}

let processBillingContext = {
    lesionId: '',
    billId: '',
    group: [],
    items: [],
    accepted: {},
    rejected: {},
    customByKey: {},
    noConsult: false
};

function processBillingView() {
    const bill = findManagedBilling(processBillingContext.billId);
    return bill && typeof billingViewModel === 'function' ? billingViewModel(bill) : bill;
}

function fillProcessBillingTypeSelect(selected) {
    const select = document.getElementById('processBillingType');
    if (!select) return;
    select.innerHTML = '<option value="">Select type...</option>' + BILLING_LESION_TYPES.map((opt) =>
        `<option value="${opt.id}" ${opt.id === selected ? 'selected' : ''}>${opt.label}</option>`
    ).join('');
}

function claimCodesFromBox() {
    return String(document.getElementById('processBillingCodes')?.value || '')
        .split(/\s*\+\s*/)
        .map((part) => part.trim())
        .filter(Boolean);
}

function setProcessBillingClaim(codes) {
    const unique = [];
    codes.forEach((code) => {
        const value = String(code || '').trim();
        if (value && !unique.includes(value)) unique.push(value);
    });
    const input = document.getElementById('processBillingCodes');
    if (input) input.value = unique.join(' + ');
    renderProcessBillingClaimChips(unique);
    updateProcessBillingSendState();
}

function renderProcessBillingClaimChips(codes) {
    const wrap = document.getElementById('processBillingClaimChips');
    if (!wrap) return;
    if (!codes.length) {
        wrap.innerHTML = '<span class="text-[11px] text-slate-400 italic">No items in the claim yet</span>';
        return;
    }
    wrap.innerHTML = codes.map((code) =>
        `<button type="button" class="billing-claim-chip" data-claim-code="${escapeHtml(code)}" title="Remove ${escapeHtml(code)}">${escapeHtml(code)}</button>`
    ).join('');
}

function addProcessBillingClaimCodes(codes) {
    const next = claimCodesFromBox();
    codes.forEach((code) => {
        const value = String(code || '').trim();
        if (value && !next.includes(value)) next.push(value);
    });
    setProcessBillingClaim(next);
    renderProcessBillingSuggestedItems();
}

function removeProcessBillingClaimCode(code) {
    const value = String(code || '').trim();
    setProcessBillingClaim(claimCodesFromBox().filter((item) => item !== value));
    Object.keys(processBillingContext.accepted || {}).forEach((key) => {
        if (processBillingContext.accepted[key] === value) delete processBillingContext.accepted[key];
    });
    renderProcessBillingSuggestedItems();
}

function onProcessBillingCodesInput() {
    renderProcessBillingClaimChips(claimCodesFromBox());
    updateProcessBillingSendState();
}

function processBillingTypeSelectHtml(lesionId, selected) {
    const id = String(lesionId || '').replace(/'/g, '');
    const options = (typeof BILLING_LESION_TYPES !== 'undefined' ? BILLING_LESION_TYPES : []).map((opt) =>
        `<option value="${opt.id}" ${opt.id === selected ? 'selected' : ''}>${opt.label}</option>`
    ).join('');
    return `<label class="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1" for="processBillingType-${id}">Lesion type</label>
        <select id="processBillingType-${id}" onchange="onProcessBillingLesionTypeChange('${id}')" class="w-full p-2 border border-slate-300 rounded-lg bg-white text-sm">
            <option value="">Select type...</option>${options}
        </select>`;
}

function procedureGroupAlreadyHasConsult(group) {
    const consult = typeof CONSULT_ITEM_CODE !== 'undefined' ? CONSULT_ITEM_CODE : '23';
    return (group || []).some((item) => {
        const bill = typeof billingForLesion === 'function' ? billingForLesion(item.id) : null;
        if (!bill || (typeof billingHasBeenSent === 'function' && !billingHasBeenSent(bill))) return false;
        if (bill.consultItem) return true;
        return String(bill.assignedMbsItems || '').split(/\s*\+\s*/).map((part) => part.trim()).includes(consult);
    });
}

function buildProcessBillingSuggestedItems(group) {
    const lesions = Array.isArray(group) && group.length
        ? group
        : [processBillingView()].filter(Boolean);
    const items = [];
    if (!procedureGroupAlreadyHasConsult(processBillingContext.allGroup || lesions)) {
        items.push({
            key: 'consult',
            code: CONSULT_ITEM_CODE,
            label: itemLabel(CONSULT_ITEM_CODE) + ' — one consult for this procedure',
            kind: 'consult',
            lesionId: ''
        });
    }
    const notes = [];
    lesions.forEach((lesion) => {
        const bill = typeof billingForLesion === 'function' ? billingForLesion(lesion.id) : null;
        const view = bill && typeof billingViewModel === 'function' ? billingViewModel(bill) : lesion;
        const suggestion = suggestMbsItems(view || {});
        const site = lesion.location || view.location || 'site';
        (suggestion.notes || []).forEach((note) => notes.push(site + ': ' + note));
        (suggestion.items || []).forEach((item, index) => {
            const flap = typeof flapWasUsed === 'function' && flapWasUsed(view);
            items.push({
                key: 'proc-' + String(lesion.id) + '-' + index,
                code: item.code,
                label: site + ' — ' + (item.label || itemLabel(item.code, { flap })),
                kind: item.code === '45201' ? 'flap' : 'procedure',
                lesionId: String(lesion.id)
            });
        });
    });
    const firstSuggestion = lesions[0] ? suggestMbsItems(lesions[0]) : { notes: [] };
    return { suggestion: { notes, kind: firstSuggestion.kind }, items };
}

function processBillingItemStatus(item) {
    if (processBillingContext.accepted[item.key]) return 'accepted';
    if (processBillingContext.rejected[item.key]) return 'rejected';
    return 'pending';
}

function renderProcessBillingLesionDetails(view, options) {
    options = options || {};
    const detail = typeof procedureDetailForLesion === 'function' ? procedureDetailForLesion(view) : {};
    const length = firstFilled(view.excisionLengthMm, detail.length);
    const width = firstFilled(view.excisionWidthMm, detail.width);
    const margin = firstFilled(view.excisionMarginMm, detail.margin);
    const punch = firstFilled(view.punchSize, detail.punchSize);
    const shaveSize = [firstFilled(view.length, detail.length), firstFilled(view.width, detail.width)].filter(Boolean).join(' × ');
    const shaveMargin = firstFilled(view.margin, detail.margin);
    const ned = lesionNedMm(view);
    const kind = billingProcedureKind(view);
    const isShave = kind === 'biopsy' && ((typeof lesionType === 'function' ? lesionType(view) : view.type) === 'shave'
        || /shave/i.test(String(view.biopsyType || view.procedure || detail.procedure || '')));
    const type = kind === 'biopsy'
        ? (isShave ? 'Shave biopsy (30071)' : 'Punch biopsy (30071)')
        : (BILLING_LESION_TYPES.find((opt) => opt.id === inferBillingLesionType(view))?.label || '—');
    const closure = firstFilled(view.excisionClosureType, detail.excisionClosureType) || '—';
    const histo = typeof billingHistologyDetail === 'function' ? billingHistologyDetail(view) : (view.histologyResult || '');
    const diagnosis = (typeof billingDisplayDiagnosis === 'function' ? billingDisplayDiagnosis(view) : '')
        || firstFilled(view.impression, view.pathology, detail.pathology);
    const flap = flapWasUsed(view);
    const region = procedureAreaLabel(view.billingRegion || billingRegionFromBodyArea(view.bodyAreaId)) || '—';
    const lesionSize = length && width ? `${length} × ${width} mm` : (length ? `${length} mm` : '—');
    const nedText = ned != null ? formatNedDisplay(ned) + ' mm' : '—';
    const nedCalc = length && width && margin
        ? `(${length} + ${width}) ÷ 2 + 2 × ${margin}`
        : '(length + width) ÷ 2 + 2 × margin';
    const sizeRows = kind === 'biopsy'
        ? (isShave
            ? `<div><dt>Lesion size</dt><dd>${shaveSize ? escapeHtml(shaveSize) + ' mm' : '—'}</dd></div>
               ${shaveMargin ? `<div><dt>Margin</dt><dd>${escapeHtml(String(shaveMargin))} mm</dd></div>` : ''}`
            : `<div><dt>Lesion size</dt><dd>${punch ? escapeHtml(String(punch)) + ' mm punch' : '—'}</dd></div>`)
        : `<div><dt>Lesion size</dt><dd>${escapeHtml(lesionSize)}</dd></div>
           <div><dt>Margin</dt><dd>${margin ? escapeHtml(String(margin)) + ' mm' : '—'}</dd></div>
           <div><dt>Overall size</dt><dd>${escapeHtml(nedText)}<span class="billing-detail-sub">NED ${escapeHtml(nedCalc)}</span></dd></div>`;
    const typeSelect = options.typeSelect && kind !== 'biopsy'
        ? `<div class="pt-1">${processBillingTypeSelectHtml(view.lesionId || view.id, inferBillingLesionType(view))}</div>`
        : '';
    return `
        <div class="billing-detail-card space-y-2">
            <h4>${escapeHtml(view.location || 'Lesion')}</h4>
            <dl class="billing-detail-grid">
                <div><dt>Site</dt><dd>${escapeHtml(view.location || '—')}</dd></div>
                <div><dt>Diagnosis</dt><dd>${escapeHtml(diagnosis || '—')}</dd></div>
                <div><dt>Region</dt><dd>${escapeHtml(region)}</dd></div>
                <div><dt>Type</dt><dd>${escapeHtml(type)}</dd></div>
                ${kind === 'biopsy' ? '' : `<div><dt>Closure</dt><dd>${escapeHtml(closure)}</dd></div>
                <div><dt>Flap used</dt><dd>${flap ? 'Yes — 45201 can be claimed' : 'No'}</dd></div>`}
                ${histo ? `<div><dt>Histology</dt><dd>${escapeHtml(histo)}</dd></div>` : ''}
            </dl>
            <h4>Lesion size</h4>
            <dl class="billing-detail-grid">
                ${sizeRows}
            </dl>
            ${typeSelect}
        </div>`;
}

function renderProcessBillingSuggestedItems() {
    const box = document.getElementById('processBillingSuggest');
    if (!box) return;
    const html = processBillingContext.items.map((item) => {
        const status = processBillingItemStatus(item);
        const custom = processBillingContext.customByKey[item.key] || '';
        const shownCode = processBillingContext.accepted[item.key] || item.code;
        const customRow = status === 'rejected'
            ? `<div class="w-full pt-1">
                    <input type="text" value="${escapeHtml(custom)}" placeholder="Custom item number, then Accept" class="w-full p-1.5 border border-slate-300 rounded text-xs font-mono" oninput="processBillingContext.customByKey['${item.key}'] = this.value.trim();" onkeydown="if (event.key === 'Enter') { event.preventDefault(); acceptProcessBillingItem('${item.key}'); }">
               </div>`
            : '';
        return `
            <div class="billing-suggest-item is-${status}">
                <span class="billing-suggest-code">${escapeHtml(shownCode)}</span>
                <span class="billing-suggest-label text-[11px] flex-1">${escapeHtml(item.label)}</span>
                <span class="billing-item-actions">
                    <button type="button" class="billing-item-btn billing-item-btn-accept${status === 'accepted' ? ' is-active' : ''}" onclick="acceptProcessBillingItem('${item.key}')">Accept</button>
                    <button type="button" class="billing-item-btn billing-item-btn-reject${status === 'rejected' ? ' is-active' : ''}" onclick="rejectProcessBillingItem('${item.key}')">Reject</button>
                </span>
                ${customRow}
            </div>`;
    }).join('');
    const notes = (processBillingContext.suggestionNotes || []).map((note) =>
        `<p class="text-[11px] text-slate-500">${escapeHtml(note)}</p>`
    ).join('');
    box.innerHTML = html + notes;
}

function rebuildProcessBillingClaim() {
    const codes = processBillingContext.items
        .filter((item) => processBillingContext.accepted[item.key])
        .map((item) => processBillingContext.accepted[item.key]);
    setProcessBillingClaim(codes);
    renderProcessBillingSuggestedItems();
}

function acceptProcessBillingItem(key) {
    const item = processBillingContext.items.find((entry) => entry.key === key);
    if (!item) return;
    delete processBillingContext.rejected[key];
    if (key === 'consult') processBillingContext.noConsult = false;
    const code = processBillingContext.customByKey[key] || item.code;
    processBillingContext.accepted[key] = code;
    rebuildProcessBillingClaim();
}

function rejectProcessBillingItem(key) {
    const item = processBillingContext.items.find((entry) => entry.key === key);
    if (!item) return;
    delete processBillingContext.accepted[key];
    processBillingContext.rejected[key] = true;
    if (key === 'consult') processBillingContext.noConsult = true;
    rebuildProcessBillingClaim();
}

function applyProcessBillingCustomReplacement(key) {
    acceptProcessBillingItem(key);
}

async function openProcessBillingModal(lesionId) {
    const lesion = managedLesions.find((item) => String(item.id) === String(lesionId));
    if (!lesion) {
        showToast('Lesion not found.');
        return;
    }
    const ready = typeof procedureGroupBillingReady === 'function' ? procedureGroupBillingReady(lesion) : { ok: true, group: [lesion] };
    if (!ready.ok) {
        showToast(ready.reason || 'Enter histology for all lesions in this procedure before billing.');
        return;
    }
    const group = (ready.group || [lesion]).slice();
    const bills = [];
    for (const item of group) {
        let bill = typeof billingForLesion === 'function' ? billingForLesion(item.id) : null;
        if (bill && billingHasBeenSent(bill)) continue;
        if (typeof createOrUpdateBillingFromLesion === 'function') {
            bill = await createOrUpdateBillingFromLesion(item) || bill;
        }
        if (bill) bills.push({ lesion: item, bill });
    }
    if (!bills.length) {
        showToast('Billing for this procedure is already confirmed.');
        return;
    }
    const first = bills[0];
    processBillingContext = {
        lesionId: first.lesion.id,
        billId: first.bill.id,
        group: bills.map((row) => row.lesion),
        allGroup: group,
        items: [],
        accepted: {},
        rejected: {},
        customByKey: {},
        noConsult: false
    };
    document.getElementById('processBillingLesionId').value = first.lesion.id;
    document.getElementById('processBillingBillId').value = first.bill.id;
    setProcessBillingClaim([]);
    const patient = first.lesion.patientName || first.bill.patientName || 'Patient';
    const n = bills.length;
    document.getElementById('processBillingSummary').textContent = patient
        + ' — ' + n + ' lesion' + (n === 1 ? '' : 's')
        + ' · one consult item for the procedure';
    refreshProcessBillingPreview();
    document.getElementById('processBillingModal')?.classList.remove('hidden');
}

function closeProcessBillingModal() {
    document.getElementById('processBillingModal')?.classList.add('hidden');
    processBillingContext = { lesionId: '', billId: '', group: [], allGroup: [], items: [], accepted: {}, rejected: {}, customByKey: {}, noConsult: false };
}

function refreshProcessBillingPreview() {
    const group = processBillingContext.group && processBillingContext.group.length
        ? processBillingContext.group
        : [managedLesions.find((item) => String(item.id) === String(processBillingContext.lesionId))].filter(Boolean);
    if (!group.length) return;
    const built = buildProcessBillingSuggestedItems(group);
    processBillingContext.items = built.items;
    processBillingContext.suggestionNotes = built.suggestion.notes || [];
    const typeWrap = document.getElementById('processBillingTypeWrap');
    if (typeWrap) typeWrap.classList.add('hidden');
    const meta = document.getElementById('processBillingMeta');
    if (meta) {
        meta.innerHTML = '<div class="space-y-3">' + group.map((lesion) => {
            const bill = typeof billingForLesion === 'function' ? billingForLesion(lesion.id) : null;
            const view = bill && typeof billingViewModel === 'function' ? billingViewModel(bill) : lesion;
            return renderProcessBillingLesionDetails(view, { typeSelect: true });
        }).join('') + '</div>';
    }
    renderProcessBillingSuggestedItems();
    const note = document.getElementById('processBillingGateNote');
    if (note) {
        note.textContent = claimCodesFromBox().length
            ? 'Confirm to add this session claim to Confirmed billings for the practice manager.'
            : 'Accept or reject the session consult and each lesion item. Confirm when the claim is ready.';
    }
    updateProcessBillingSendState();
}

function onProcessBillingLesionTypeChange(lesionId) {
    processBillingContext.accepted = {};
    processBillingContext.rejected = {};
    processBillingContext.customByKey = {};
    processBillingContext.noConsult = false;
    setProcessBillingClaim([]);
    const type = document.getElementById('processBillingType-' + String(lesionId || '').replace(/'/g, ''))?.value || '';
    const bill = typeof billingForLesion === 'function' ? billingForLesion(lesionId) : null;
    const lesion = managedLesions.find((item) => String(item.id) === String(lesionId));
    if (bill) bill.billingLesionType = type;
    if (lesion) lesion.billingLesionType = type;
    refreshProcessBillingPreview();
}

function onProcessBillingTypeChange() {
    const lesionId = processBillingContext.lesionId;
    if (lesionId) onProcessBillingLesionTypeChange(lesionId);
}

function updateProcessBillingSendState() {
    const sendBtn = document.getElementById('btnProcessBillingSend');
    if (sendBtn) sendBtn.disabled = !claimCodesFromBox().length;
}

async function submitProcessBilling() {
    const codes = claimCodesFromBox();
    if (!codes.length) {
        showToast('Accept at least one item, or enter a custom item number.');
        return;
    }
    const group = processBillingContext.group && processBillingContext.group.length
        ? processBillingContext.group
        : [managedLesions.find((item) => String(item.id) === String(processBillingContext.lesionId))].filter(Boolean);
    const consultAccepted = !!processBillingContext.accepted.consult
        && codes.includes(CONSULT_ITEM_CODE);
    let consultAssigned = false;
    let confirmed = 0;
    for (const lesion of group) {
        let bill = typeof billingForLesion === 'function' ? billingForLesion(lesion.id) : null;
        if (bill && billingHasBeenSent(bill)) continue;
        if (!bill && typeof createOrUpdateBillingFromLesion === 'function') {
            bill = await createOrUpdateBillingFromLesion(lesion);
        }
        if (!bill || billingHasBeenSent(bill)) continue;
        const typeEl = document.getElementById('processBillingType-' + String(lesion.id).replace(/'/g, ''));
        if (typeEl?.value) {
            bill.billingLesionType = typeEl.value;
            lesion.billingLesionType = typeEl.value;
        }
        const procCodes = processBillingContext.items
            .filter((item) => item.lesionId === String(lesion.id) && processBillingContext.accepted[item.key])
            .map((item) => processBillingContext.accepted[item.key]);
        const giveConsult = consultAccepted && !consultAssigned;
        const claim = giveConsult ? [CONSULT_ITEM_CODE].concat(procCodes) : procCodes;
        if (!claim.length) continue;
        if (giveConsult) consultAssigned = true;
        await persistProcessedBilling(bill, claim.join(' + '), {
            excludeConsult: !giveConsult,
            consultItem: giveConsult ? CONSULT_ITEM_CODE : '',
            recommendationAccepted: true,
            silentToast: true
        });
        confirmed += 1;
    }
    if (!confirmed) {
        showToast('Accept at least one item for a lesion in this procedure.');
        return;
    }
    closeProcessBillingModal();
    showToast('Session billing confirmed for ' + confirmed + ' lesion' + (confirmed === 1 ? '' : 's') + '. Print for the practice manager from Billing.');
    if (typeof hasCurrentPatient === 'function' && hasCurrentPatient()) {
        if (typeof renderManagedLesions === 'function') renderManagedLesions();
    } else {
        setMgmtFilter('billing');
    }
}

async function markSuspectedMelanomaForBilling(id) {
    const bill = findManagedBilling(id);
    const lesion = managedLesions.find((item) => item.id === id) || (bill && managedLesions.find((item) => String(item.id) === String(bill.lesionId)));
    if (lesion) lesion.billingLesionType = 'suspected_melanoma';
    if (bill) {
        bill.billingLesionType = 'suspected_melanoma';
        await saveManagedBillingRecord(bill, 'billing:suspected_melanoma', 'Marked suspected melanoma for billing');
    } else if (lesion) {
        await saveManagedLesionRecord(lesion, 'billing:suspected_melanoma', 'Marked suspected melanoma for billing');
    }
    showToast('Marked as suspected melanoma. You can assign item numbers now.');
    renderManagedLesions();
}

async function returnBillingToAwaiting(id) {
    const bill = findManagedBilling(id);
    if (!bill) return;
    bill.status = 'awaiting';
    bill.confirmedAt = '';
    bill.processedAt = '';
    bill.expiresAt = '';
    await saveManagedBillingRecord(bill, 'returned', 'Returned to awaiting processing');
    showToast('Billing returned to awaiting processing. Management is locked until it is confirmed again.');
    renderManagedLesions();
}

async function returnBillingToConfirmed(id) {
    const bill = findManagedBilling(id);
    if (!bill || bill.status !== 'processed') return;
    bill.status = 'confirmed';
    bill.processedAt = '';
    bill.expiresAt = '';
    if (!bill.confirmedAt) bill.confirmedAt = new Date().toISOString();
    const lesion = managedLesions.find((item) => String(item.id) === String(bill.lesionId));
    if (lesion) {
        lesion.billingStatus = 'confirmed';
        lesion.billingProcessedAt = '';
        if (isVaultLoggedIn()) {
            try { await saveManagedLesionRecord(lesion, 'billing:returned', 'Returned to confirmed', { silent: true }); } catch (err) { /* bill is source of truth */ }
        }
    }
    await saveManagedBillingRecord(bill, 'returned:confirmed', 'Returned to confirmed queue');
    showToast('Returned to confirmed billings.');
    renderManagedLesions();
}

function setMgmtFilter(filter) {
    mgmtActiveFilter = filter === 'active' ? 'open' : filter;
    renderManagedLesions();
}

function toggleMgmtPatientScope() {
    if (hasCurrentPatient()) {
        if (typeof requestClosePatientChart === 'function') requestClosePatientChart();
        else if (typeof closePatientChart === 'function') closePatientChart();
        return;
    }
    focusPracticeBoardSearch();
}

function toggleAllBillingChecks(on) {
    toggleAllConfirmedBillingChecks(on);
}

function toggleAllConfirmedBillingChecks(on) {
    document.querySelectorAll('.billing-confirmed-check').forEach((el) => { el.checked = !!on; });
}

function selectedConfirmedBillingIds() {
    return Array.from(document.querySelectorAll('.billing-confirmed-check:checked')).map((el) => el.value);
}

function billingViewsByStatus(status) {
    return adminBillings().filter((item) => item.status === status).map(billingViewModel);
}

function billingViewsForPrint(status, onlyId) {
    const views = billingViewsByStatus(status);
    if (onlyId) {
        return views.filter((view) => String(view.id) === String(onlyId) || String(view.lesionId) === String(onlyId));
    }
    if (status === 'confirmed') {
        const selected = selectedConfirmedBillingIds();
        if (selected.length) {
            return views.filter((view) => selected.includes(String(view.id)) || selected.includes(String(view.lesionId)));
        }
    }
    return views;
}

async function processSelectedBilling() {
    const ids = selectedConfirmedBillingIds();
    if (!ids.length) {
        showToast('Select one or more confirmed billings to mark processed.');
        return;
    }
    await markBillingsAsProcessed(ids);
}

async function markBillingsAsProcessed(ids, extra) {
    const silentToast = !!(extra && extra.silentToast);
    const list = (ids || []).map((id) => findManagedBilling(id)).filter((bill) => bill && bill.status === 'confirmed');
    if (!list.length) {
        if (!silentToast) showToast('Select confirmed billings to mark processed.');
        return;
    }
    const now = new Date().toISOString();
    for (const bill of list) {
        bill.status = 'processed';
        bill.processedAt = now;
        bill.expiresAt = typeof billingProcessedExpiresAt === 'function' ? billingProcessedExpiresAt(now) : '';
        if (!bill.confirmedAt) bill.confirmedAt = now;
        await saveManagedBillingRecord(bill, 'processed', bill.assignedMbsItems || '');
        if (typeof stampLesionBillingProcessed === 'function') {
            await stampLesionBillingProcessed(bill.lesionId, now);
        }
    }
    if (!silentToast) {
        showToast(list.length === 1 ? 'Moved to processed billings.' : list.length + ' billings moved to processed.');
    }
    renderManagedLesions();
}

function printConfirmedBillings(onlyId) {
    const views = billingViewsForPrint('confirmed', onlyId);
    if (!views.length) {
        showToast('No confirmed billings to print.');
        return;
    }
    printBillingSheet(views, {
        title: 'Confirmed billings',
        subtitle: 'For the practice manager — enter these item numbers, then mark them processed in DermRecord.',
        dateLabel: 'Confirmed'
    });
}

function printProcessedBillings() {
    const views = billingViewsByStatus('processed');
    if (!views.length) {
        showToast('No processed billings to print.');
        return;
    }
    printBillingSheet(views, {
        title: 'Processed billings',
        subtitle: 'Record of billings already entered.',
        dateLabel: 'Processed'
    });
}

function billingPrintRow(view) {
    const codes = view.assignedMbsItems || view.suggestedMbsItems || '';
    const kind = typeof billingProcedureKind === 'function' ? billingProcedureKind(view) : '';
    const isShave = kind === 'biopsy' && ((typeof lesionType === 'function' ? lesionType(view) : view.type) === 'shave'
        || /shave/i.test(String(view.biopsyType || view.procedure || '')));
    const type = kind === 'biopsy'
        ? (isShave ? 'Shave biopsy' : 'Punch biopsy')
        : ((typeof BILLING_LESION_TYPES !== 'undefined' ? BILLING_LESION_TYPES.find((t) => t.id === inferBillingLesionType(view))?.label : '') || '');
    const ned = typeof formatNedDisplay === 'function' && typeof lesionNedMm === 'function' ? formatNedDisplay(lesionNedMm(view)) : '';
    const shaveSize = [view.length, view.width].filter(Boolean).join(' × ');
    const size = [view.excisionLengthMm, view.excisionWidthMm].filter(Boolean).join(' × ');
    const sizeText = kind === 'biopsy'
        ? (isShave
            ? (shaveSize ? shaveSize + ' mm' : 'Shave')
            : (view.punchSize ? 'Punch ' + view.punchSize + ' mm' : 'Punch'))
        : (size ? size + ' mm' + (view.excisionMarginMm ? ', margin ' + view.excisionMarginMm + ' mm' : '') + (ned ? ', NED ' + ned + ' mm' : '')
            : (view.punchSize ? 'Punch ' + view.punchSize + ' mm' : (ned ? 'NED ' + ned + ' mm' : '')));
    const when = formatLesionWhen(view.processedAt || view.confirmedAt || view.updatedAt);
    return {
        patient: view.patientName || '',
        dob: view.patientDob || '',
        clinician: view.clinician || '',
        site: view.location || '',
        diagnosis: (typeof billingDisplayDiagnosis === 'function' ? billingDisplayDiagnosis(view) : '')
            || view.histologyDiagnosis
            || view.histologyResult
            || view.impression
            || '',
        procedure: kind === 'biopsy' ? (isShave ? 'Shave' : 'Punch') : (view.procedure || view.procedureType || view.excisionClosureType || ''),
        codes,
        type,
        sizeText,
        when
    };
}

function printBillingSheet(views, options) {
    const rows = views.map(billingPrintRow);
    const printed = new Date().toLocaleString('en-AU', {
        weekday: 'short',
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
    const user = (typeof vaultAuth !== 'undefined' && vaultAuth.username) ? vaultAuth.username : '';
    const clinician = rows.find((row) => row.clinician)?.clinician || '';
    const body = rows.map((row, idx) => `
        <tr>
            <td>${idx + 1}</td>
            <td>
                <strong>${escapeHtml(row.patient)}</strong><br>
                <span style="font-size:8.5pt;color:#444;">DOB ${escapeHtml(row.dob || '—')}</span>
            </td>
            <td>${escapeHtml(row.site || '—')}<br><span style="font-size:8.5pt;color:#444;">${escapeHtml(row.diagnosis || '')}</span></td>
            <td>${escapeHtml(row.procedure || '—')}</td>
            <td>${escapeHtml(row.sizeText || '—')}${row.type ? '<br><span style="font-size:8.5pt;color:#444;">' + escapeHtml(row.type) + '</span>' : ''}</td>
            <td style="font-weight:800;letter-spacing:0.04em;font-size:12pt;">${escapeHtml(row.codes || '—')}</td>
            <td>${escapeHtml(row.when || '')}</td>
        </tr>`).join('');
    const html = `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>${escapeHtml(options.title)} — DermRecord</title>
    <style>
        @page { size: A4 landscape; margin: 12mm; }
        body { font-family: Calibri, Arial, sans-serif; color: #111; margin: 0; }
        h1 { font-size: 16pt; margin: 0 0 4px; }
        p { margin: 0 0 8px; font-size: 9.5pt; color: #333; }
        .meta { display: flex; justify-content: space-between; gap: 16px; margin-bottom: 12px; font-size: 9pt; }
        table { width: 100%; border-collapse: collapse; font-size: 9.5pt; }
        th, td { border: 1px solid #cbd5e1; padding: 6px 8px; vertical-align: top; text-align: left; }
        th { background: #0f172a; color: #fff; font-size: 8.5pt; text-transform: uppercase; letter-spacing: 0.04em; }
        tr:nth-child(even) td { background: #f8fafc; }
        .codes { white-space: nowrap; }
        .footer { margin-top: 16px; display: flex; justify-content: space-between; gap: 24px; font-size: 10pt; }
        .line { border-bottom: 1px solid #111; min-width: 220px; display: inline-block; height: 18px; }
        @media print { .no-print { display: none; } }
    </style>
</head>
<body>
    <h1>DermRecord — ${escapeHtml(options.title)}</h1>
    <p>${escapeHtml(options.subtitle || '')}</p>
    <div class="meta">
        <div>Printed ${escapeHtml(printed)}${user ? ' · by ' + escapeHtml(user) : ''}${clinician ? ' · ' + escapeHtml(clinician) : ''}</div>
        <div>${rows.length} item${rows.length === 1 ? '' : 's'}</div>
    </div>
    <table>
        <thead>
            <tr>
                <th style="width:4%;">#</th>
                <th style="width:18%;">Patient</th>
                <th style="width:18%;">Site</th>
                <th style="width:12%;">Procedure</th>
                <th style="width:16%;">Size</th>
                <th style="width:20%;">MBS items</th>
                <th style="width:12%;">${escapeHtml(options.dateLabel || 'Date')}</th>
            </tr>
        </thead>
        <tbody>${body}</tbody>
    </table>
    <div class="footer">
        <div>Received / entered by: <span class="line"></span></div>
        <div>Date: <span class="line"></span></div>
    </div>
    <p class="no-print" style="margin-top:12px;"><button onclick="window.print()">Print</button></p>
    <script>window.onload = function () { window.print(); };<\/script>
</body>
</html>`;
    const printWin = window.open('', '_blank', 'width=1100,height=800');
    if (!printWin) {
        showToast('Unable to open print window. Please allow pop-ups for this app.');
        return;
    }
    printWin.document.open();
    printWin.document.write(html);
    printWin.document.close();
}

function fillHistologyCaseShareUI(lesion) {
    const wrap = document.getElementById('histologyCaseShareWrap');
    const countEl = document.getElementById('histologyCaseShareCount');
    const listEl = document.getElementById('histologyCaseShareList');
    const kindEl = document.getElementById('histologyCaseShareKind');
    const box = document.getElementById('histologyApplyCaseToSiblings');
    const fromBatch = !!(typeof histologyBatchIdOf === 'function' && histologyBatchIdOf(lesion));
    const siblings = typeof histologyCaseShareSiblings === 'function' && lesion
        ? histologyCaseShareSiblings(lesion)
        : (typeof sameDayHistologyCaseSiblings === 'function' && lesion ? sameDayHistologyCaseSiblings(lesion) : []);
    if (!wrap) return;
    if (!siblings.length) {
        wrap.classList.add('hidden');
        if (box) box.checked = false;
        if (countEl) countEl.textContent = '0';
        if (listEl) listEl.textContent = '';
        return;
    }
    wrap.classList.remove('hidden');
    if (countEl) countEl.textContent = String(siblings.length);
    if (kindEl) {
        kindEl.textContent = fromBatch
            ? ('other pot' + (siblings.length === 1 ? '' : 's') + ' from this procedure')
            : ('other same-day biops' + (siblings.length === 1 ? 'y' : 'ies'));
    }
    if (box) box.checked = fromBatch;
    if (listEl) {
        listEl.textContent = siblings.map((item) => {
            const site = item.location || 'No site';
            const pot = typeof normalizeHistologyPot === 'function' ? normalizeHistologyPot(item.histologyPot) : (item.histologyPot || '');
            const label = pot ? (site + ', pot ' + pot) : site;
            const existing = typeof formatHistologyAccession === 'function' ? formatHistologyAccession(item, 'own') : (item.histologyCaseNumber || '');
            return existing ? (label + ' (currently ' + existing + ')') : label;
        }).join('; ');
    }
}

function fillAssignExcisionPriorHistoFields(lesion) {
    const wrap = document.getElementById('assignExcisionPriorHistoWrap');
    const caseEl = document.getElementById('assignExcisionPriorCaseNumber');
    const potEl = document.getElementById('assignExcisionPriorPot');
    const resolved = typeof resolveExcisionAssignTarget === 'function'
        ? resolveExcisionAssignTarget(lesion)
        : { mode: 'create', lesion: null, prior: null };
    const child = (resolved.lesion && resolved.lesion.priorLesionId)
        ? resolved.lesion
        : (lesion?.priorLesionId ? lesion : null);
    const prior = resolved.prior || null;
    const isReex = resolved.mode === 'spawn' || !!(child || (resolved.mode === 'update' && prior));
    if (wrap) wrap.classList.toggle('hidden', !isReex);
    if (!isReex) {
        if (caseEl) caseEl.value = '';
        if (potEl) potEl.value = '';
        return;
    }
    const cited = child && typeof lesionWithPriorHistologyCitation === 'function'
        ? lesionWithPriorHistologyCitation(child)
        : null;
    if (caseEl) {
        caseEl.value = cited?.priorHistologyCaseNumber
            || child?.priorHistologyCaseNumber
            || prior?.histologyCaseNumber
            || '';
    }
    if (potEl) {
        potEl.value = cited?.priorHistologyPot
            || child?.priorHistologyPot
            || prior?.histologyPot
            || '';
    }
}

function syncHistologyBillingTypeFromResult() {
    const resultEl = document.getElementById('histologyResultText');
    const typeEl = document.getElementById('histologyBillingType');
    if (!typeEl) return;
    const id = document.getElementById('histologyLesionId')?.value;
    const lesion = managedLesions.find((item) => String(item.id) === String(id)) || {};
    const structured = typeof readDiagnosisTypeahead === 'function'
        ? readDiagnosisTypeahead('histologyDiagnosis')
        : (document.getElementById('histologyDiagnosis')?.value || '');
    const result = String(resultEl?.value || '').trim();
    const combined = [structured, result].filter(Boolean).join('\n');
    if (combined && typeof histologyIndicatesMelanoma === 'function' && histologyIndicatesMelanoma(combined)) {
        typeEl.value = 'confirmed_melanoma';
    } else if (combined && typeof inferBillingLesionType === 'function') {
        const inferred = inferBillingLesionType({
            ...lesion,
            histologyDiagnosis: structured,
            histologyResult: result,
            billingLesionType: ''
        });
        if (inferred) typeEl.value = inferred;
    } else if (!combined) {
        const inferred = typeof inferBillingLesionType === 'function'
            ? inferBillingLesionType({ ...lesion, histologyResult: '', histologyDiagnosis: '' })
            : '';
        typeEl.value = inferred || lesion.billingLesionType || '';
    }
    if (typeof syncHistologyFollowUpUi === 'function') syncHistologyFollowUpUi();
}

function histologyDraftLesion() {
    const id = document.getElementById('histologyLesionId')?.value;
    return managedLesions.find((item) => String(item.id) === String(id)) || null;
}

function syncHistologyFollowUpUi() {
    const lesion = histologyDraftLesion();
    const plan = document.querySelector('input[name="histologyNext"]:checked')?.value || '';
    const contact = document.querySelector('input[name="histologyContact"]:checked')?.value || 'mark_for_contact';
    const further = plan === 'further_management' || plan === 'plan_excision';
    const melanoma = !!(lesion && typeof histologyIndicatesMelanoma === 'function' && histologyIndicatesMelanoma({
        ...lesion,
        histologyDiagnosis: typeof readDiagnosisTypeahead === 'function'
            ? readDiagnosisTypeahead('histologyDiagnosis')
            : (document.getElementById('histologyDiagnosis')?.value || ''),
        histologyResult: document.getElementById('histologyResultText')?.value || lesion.histologyResult
    }));
    const urgent = document.getElementById('histologyUrgentNote');
    if (urgent) urgent.classList.toggle('hidden', !melanoma);
    const proposedWrap = document.getElementById('histologyProposedPlanWrap');
    if (proposedWrap) proposedWrap.classList.toggle('hidden', !further);
    const fileWrap = document.getElementById('histologyFileNoCallWrap');
    const fileEl = document.getElementById('histologyFileNoCall');
    const showFile = plan === 'no_followup' && contact === 'mark_for_contact' && !melanoma;
    if (fileWrap) {
        fileWrap.classList.toggle('hidden', !showFile);
        fileWrap.classList.toggle('flex', showFile);
    }
    if (fileEl && !showFile) fileEl.checked = false;
}

function copyHistologyResultNote() {
    return copyHistologyOutput('note');
}

function copyHistologyReceptionMessage() {
    return copyHistologyOutput('reception');
}

async function copyHistologyOutput(kind) {
    const saved = await ensureHistologyDraftSaved();
    if (!saved) return;
    const lesion = histologyDraftLesion();
    const draft = histologyModalDraft();
    if (kind === 'reception') {
        const text = typeof generateResultReceptionMessage === 'function' ? generateResultReceptionMessage(lesion, draft) : '';
        if (!text) {
            showToast('No reception line for this contact choice.');
            return;
        }
        copyTextToClipboard(text, 'Reception message copied.');
        return;
    }
    const text = typeof generateResultIemrNote === 'function' ? generateResultIemrNote(lesion, draft) : '';
    if (!text) {
        showToast('Enter the histology result.');
        return;
    }
    copyTextToClipboard(text, 'Result note copied.');
}

async function ensureHistologyDraftSaved() {
    const lesion = histologyDraftLesion();
    const draft = histologyModalDraft();
    if (!draft.result) {
        showToast('Enter the histology result.');
        return false;
    }
    const savedResult = String(lesion?.histologyResult || '').trim();
    const savedDx = String(lesion?.histologyDiagnosis || '').trim();
    const stillAwaiting = (typeof lesionLifecycleStatus === 'function'
        ? lesionLifecycleStatus(lesion)
        : lesion?.managementStatus) === 'awaiting_histology';
    if (savedResult === draft.result && savedDx === String(draft.diagnosis || '').trim() && !stillAwaiting) {
        return true;
    }
    return await submitHistologyModal();
}

function histologyModalDraft() {
    return {
        plan: document.querySelector('input[name="histologyNext"]:checked')?.value || '',
        proposedPlan: document.querySelector('input[name="histologyProposedPlan"]:checked')?.value || '',
        proposedPlanNote: document.getElementById('histologyProposedPlanNote')?.value.trim() || '',
        contact: document.querySelector('input[name="histologyContact"]:checked')?.value || 'mark_for_contact',
        fileNoCall: !!document.getElementById('histologyFileNoCall')?.checked,
        result: document.getElementById('histologyResultText')?.value.trim() || '',
        diagnosis: typeof readDiagnosisTypeahead === 'function'
            ? readDiagnosisTypeahead('histologyDiagnosis')
            : (document.getElementById('histologyDiagnosis')?.value.trim() || ''),
        callNote: document.getElementById('histologyCallNote')?.value.trim() || ''
    };
}

function openHistologyModal(id) {
    const lesion = managedLesions.find((item) => item.id === id);
    const modal = document.getElementById('histologyModal');
    const idEl = document.getElementById('histologyLesionId');
    const resultEl = document.getElementById('histologyResultText');
    const typeEl = document.getElementById('histologyBillingType');
    const summaryEl = document.getElementById('histologyLesionSummary');
    const noteEl = document.getElementById('histologyCallNote');
    if (idEl) idEl.value = id;
    if (resultEl) resultEl.value = lesion?.histologyResult || '';
    if (typeof setDiagnosisTypeahead === 'function') {
        setDiagnosisTypeahead('histologyDiagnosis', lesion?.histologyDiagnosis || '');
    } else {
        const dxEl = document.getElementById('histologyDiagnosis');
        if (dxEl) dxEl.value = lesion?.histologyDiagnosis || '';
    }
    const caseEl = document.getElementById('histologyCaseNumber');
    const potEl = document.getElementById('histologyPot');
    if (caseEl) {
        caseEl.value = lesion?.histologyCaseNumber
            || (typeof histologyBatchSharedCaseNumber === 'function' ? histologyBatchSharedCaseNumber(lesion) : '')
            || '';
    }
    if (potEl) potEl.value = lesion?.histologyPot || '';
    fillHistologyCaseShareUI(lesion);
    if (summaryEl) {
        summaryEl.textContent = lesion
            ? `${lesion.patientName || currentPatient.name || ''} — ${lesion.location || 'site'} · ${lesion.impression || ''}`
            : '';
    }
    fillLesionPatientContactEl(document.getElementById('histologyPatientContact'), lesion);
    if (typeof syncHistologyBillingTypeFromResult === 'function') {
        syncHistologyBillingTypeFromResult();
    } else if (typeEl) {
        typeEl.value = lesion?.billingLesionType || inferBillingLesionType(lesion || {}) || '';
    }
    if (noteEl) noteEl.value = lesion?.adminCallNote || '';
    const planVal = (lesion?.resultPlan === 'further_management' || lesion?.resultPlan === 'plan_excision')
        ? 'further_management'
        : 'no_followup';
    const planEl = document.querySelector('input[name="histologyNext"][value="' + planVal + '"]');
    if (planEl) planEl.checked = true;
    const proposed = String(lesion?.proposedPlan || '').trim();
    const proposedEl = document.querySelector('input[name="histologyProposedPlan"][value="' + (proposed || '') + '"]')
        || document.querySelector('input[name="histologyProposedPlan"][value=""]');
    if (proposedEl) proposedEl.checked = true;
    const proposedNoteEl = document.getElementById('histologyProposedPlanNote');
    if (proposedNoteEl) proposedNoteEl.value = lesion?.proposedPlanNote || '';
    const contactVal = lesion?.contactState === 'advised_now' || lesion?.resultAdvisedAt
        ? 'advised_now'
        : (lesion?.contactState === 'appointment_requested' ? 'appointment_requested'
            : (lesion?.contactState === 'not_reached' ? 'not_reached' : 'mark_for_contact'));
    const contactEl = document.querySelector('input[name="histologyContact"][value="' + contactVal + '"]');
    if (contactEl) contactEl.checked = true;
    else {
        const mark = document.querySelector('input[name="histologyContact"][value="mark_for_contact"]');
        if (mark) mark.checked = true;
    }
    const fileEl = document.getElementById('histologyFileNoCall');
    if (fileEl) fileEl.checked = lesion?.contactState === 'file_no_call';
    syncHistologyFollowUpUi();
    if (modal) modal.classList.remove('hidden');
}

function closeHistologyModal() {
    const modal = document.getElementById('histologyModal');
    if (modal) modal.classList.add('hidden');
}

async function submitHistologyModal() {
    const id = document.getElementById('histologyLesionId')?.value;
    const result = document.getElementById('histologyResultText')?.value.trim();
    const histologyDiagnosis = typeof readDiagnosisTypeahead === 'function'
        ? readDiagnosisTypeahead('histologyDiagnosis')
        : (document.getElementById('histologyDiagnosis')?.value.trim() || '');
    let billingType = document.getElementById('histologyBillingType')?.value || '';
    const next = document.querySelector('input[name="histologyNext"]:checked')?.value || '';
    const proposedPlan = document.querySelector('input[name="histologyProposedPlan"]:checked')?.value || '';
    const proposedPlanNote = document.getElementById('histologyProposedPlanNote')?.value.trim() || '';
    const contact = document.querySelector('input[name="histologyContact"]:checked')?.value || 'mark_for_contact';
    const fileNoCall = !!document.getElementById('histologyFileNoCall')?.checked;
    const callNote = document.getElementById('histologyCallNote')?.value.trim() || '';
    const caseNumber = document.getElementById('histologyCaseNumber')?.value.trim() || '';
    const pot = document.getElementById('histologyPot')?.value.trim() || '';
    const applySiblings = !!document.getElementById('histologyApplyCaseToSiblings')?.checked;
    if (!id) return false;
    if (!result) {
        showToast('Enter the histology result.');
        return false;
    }
    if (next !== 'no_followup' && next !== 'further_management' && next !== 'plan_excision') {
        showToast('Choose no further action, or needs further management.');
        return false;
    }
    if (typeof histologyIndicatesMelanoma === 'function' && histologyIndicatesMelanoma({ histologyDiagnosis, histologyResult: result })) {
        billingType = 'confirmed_melanoma';
        const typeEl = document.getElementById('histologyBillingType');
        if (typeEl) typeEl.value = 'confirmed_melanoma';
        if (fileNoCall) {
            showToast('File, no call cannot be used for melanoma.');
            return false;
        }
    }
    if (!billingType) {
        showToast('Assign the lesion type from histology (or suspected melanoma).');
        return false;
    }
    if (fileNoCall && next !== 'no_followup') {
        showToast('File, no call is only for no further action.');
        return false;
    }
    const lesion = managedLesions.find((item) => String(item.id) === String(id));
    if (lesion) lesion.billingLesionType = billingType;
    const saved = await recordHistologyOutcome(id, result, next, billingType, {
        callNote,
        contact,
        fileNoCall,
        urgent: billingType === 'confirmed_melanoma',
        histologyCaseNumber: caseNumber,
        histologyPot: pot,
        histologyDiagnosis,
        proposedPlan: (next === 'further_management' || next === 'plan_excision') ? proposedPlan : '',
        proposedPlanNote: (next === 'further_management' || next === 'plan_excision') ? proposedPlanNote : ''
    });
    let siblingNote = '';
    if (applySiblings && caseNumber && typeof applyHistologyCaseToSiblings === 'function') {
        const share = await applyHistologyCaseToSiblings(id, caseNumber);
        const applied = typeof share === 'number' ? share : (share?.applied || 0);
        const skipped = typeof share === 'object' ? (share?.skipped || 0) : 0;
        if (applied) {
            siblingNote = ' Case number also set on ' + applied + ' other pot' + (applied === 1 ? '' : 's') + ' from this procedure.';
        }
        if (skipped) {
            siblingNote += ' Left ' + skipped + ' pot' + (skipped === 1 ? '' : 's') + ' that already had a different lab number.';
        }
    }
    closeHistologyModal();
    const further = next === 'further_management' || next === 'plan_excision';
    const messages = {
        advised_now: further
            ? 'Result saved. Patient advised. Further management opened on a linked lesion.'
            : (saved?.billingHold
                ? 'Result saved. Patient advised. Confirm billing before the lesion can leave the board.'
                : 'Result saved. Patient advised. No further action.'),
        appointment_requested: further
            ? 'Result saved. Appointment requested — contact stays on the linked management lesion.'
            : 'Result saved. Appointment requested to discuss the result.',
        not_reached: further
            ? 'Result saved. Not reached — linked management lesion stays on Needs contact.'
            : 'Result saved. Not reached — stays on Needs contact.',
        mark_for_contact: further
            ? 'Result saved. Linked management lesion marked for contact.'
            : 'Result saved. Marked for contact.',
        file_no_call: saved?.billingHold
            ? 'Result saved. Filed with no call. Confirm billing before the lesion can leave the board.'
            : 'Result saved. Filed with no call. No further action.'
    };
    const key = fileNoCall ? 'file_no_call' : contact;
    showToast((messages[key] || 'Result saved.') + siblingNote);
    if (saved?.needResult) {
        showToast('Save a histology result before opening further management.');
        return true;
    }
    const openId = saved?.openChildId || id;
    if (saved?.openExcision) openLesionDocumentation(openId);
    return true;
}

function findLesionForExcisionProcedure(id) {
    if (!id) return null;
    return managedLesions.find((item) => String(item.id) === String(id))
        || lesions.find((item) => String(item.id) === String(id))
        || null;
}

function lesionsAvailableForExcisionProcedure() {
    const map = new Map();
    const add = (item) => {
        if (!item?.id) return;
        map.set(String(item.id), item);
    };
    if (hasCurrentPatient()) {
        lesionsForCurrentChart().forEach(add);
        lesions.forEach(add);
    } else {
        managedLesions.forEach(add);
        lesions.forEach(add);
    }
    return Array.from(map.values());
}

function populateExcisionProcedureLesionSelect(selectedId) {
    const select = document.getElementById('assignExcisionLesionSelect');
    if (!select) return;
    const items = lesionsAvailableForExcisionProcedure();
    select.innerHTML = '<option value="">New lesion</option>' + items.map((item) => {
        const label = [item.location || 'No site', item.impression || ''].filter(Boolean).join(' · ');
        const selected = String(item.id) === String(selectedId) ? ' selected' : '';
        return `<option value="${escapeHtml(String(item.id))}"${selected}>${escapeHtml(label)}</option>`;
    }).join('');
    if (selectedId) select.value = selectedId;
}

function fillExcisionProcedureForm(lesion) {
    const locEl = document.getElementById('assignExcisionLocation');
    const dxEl = document.getElementById('assignExcisionDiagnosis');
    const marginEl = document.getElementById('assignExcisionMargin');
    const closureEl = document.getElementById('assignExcisionClosure');
    const graftEl = document.getElementById('assignExcisionGraftType');
    const noteEl = document.getElementById('assignExcisionNote');
    const idEl = document.getElementById('assignExcisionLesionId');
    const priorEl = document.getElementById('assignExcisionPriorLesionId');
    const summaryEl = document.getElementById('assignExcisionSummary');
    if (idEl) idEl.value = lesion?.id || '';
    if (priorEl) priorEl.value = lesion?.priorLesionId || '';
    if (locEl) locEl.value = lesion?.location || '';
    if (typeof setDiagnosisTypeahead === 'function') {
        setDiagnosisTypeahead('assignExcisionDiagnosis', lesion?.impression || '');
    } else if (dxEl) {
        dxEl.value = lesion?.impression || '';
    }
    if (marginEl) {
        if (typeof setMmInputValue === 'function') {
            setMmInputValue(marginEl, lesion?.excisionMarginMm || lesion?.excisionMargin);
        } else {
            marginEl.value = typeof parseMarginMm === 'function'
                ? parseMarginMm(lesion?.excisionMarginMm || lesion?.excisionMargin)
                : (lesion?.excisionMarginMm || '');
        }
    }
    if (closureEl) closureEl.value = normalizeExcisionClosure(lesion);
    if (graftEl) graftEl.value = lesion?.graftType || lesion?.billingGraftType || 'Full-Thickness Skin Graft (FTSG)';
    if (noteEl) noteEl.value = lesion?.adminCallNote || '';
    if (summaryEl) {
        summaryEl.textContent = hasCurrentPatient()
            ? `${currentPatient.name} · ${currentPatient.dob}`
            : (lesion?.patientName ? `${lesion.patientName} · ${lesion.patientDob || ''}` : '');
    }
    updateExcisionProcedureClosureUI();
    updateAssignExcisionReexcisionBanner(lesion);
    fillAssignExcisionPriorHistoFields(lesion);
}

function resolveExcisionAssignTarget(source) {
    if (!source?.id) return { mode: 'create', lesion: null, prior: null };
    const tip = typeof latestReexcisionEpisode === 'function' ? latestReexcisionEpisode(source) : source;
    const target = tip || source;
    const priorOfTarget = target.priorLesionId
        ? findLesionForExcisionProcedure(target.priorLesionId)
        : null;
    const targetOpen = typeof lesionIsOpenReexcisionPlan === 'function'
        ? lesionIsOpenReexcisionPlan(target)
        : ((target.managementStatus === 'planned_procedure' || target.managementStatus === 'current_case')
            && !(typeof lesionProcedureDone === 'function' && lesionProcedureDone(target)));
    // Management / re-excision child: always update in place (do not spawn a grandchild).
    if (target.priorLesionId && !(typeof lesionProcedureDone === 'function' && lesionProcedureDone(target))) {
        const childStatus = typeof lesionLifecycleStatus === 'function'
            ? lesionLifecycleStatus(target)
            : target.managementStatus;
        if (childStatus !== 'no_followup' && childStatus !== 'awaiting_histology') {
            return { mode: 'update', lesion: target, prior: priorOfTarget };
        }
    }
    if (targetOpen) {
        return { mode: 'update', lesion: target, prior: priorOfTarget };
    }
    const procedureDone = typeof lesionProcedureDone === 'function'
        ? lesionProcedureDone(target)
        : !!(target.procedureCompletedAt || target.excisionFinalisedAt);
    const hasHisto = typeof lesionHasSavedHistology === 'function'
        ? lesionHasSavedHistology(target)
        : !!String(target.histologyResult || '').trim();
    if (procedureDone && !hasHisto) {
        return {
            mode: 'blocked',
            lesion: target,
            prior: null,
            reason: 'Save histology before booking a re-excision. A new excision episode needs the prior result.'
        };
    }
    const canSpawn = typeof lesionCanSpawnReexcision === 'function'
        ? lesionCanSpawnReexcision(target)
        : (hasHisto && !(typeof findLinkedReexcisionChild === 'function' && findLinkedReexcisionChild(target.id)));
    if (canSpawn && (typeof lesionNeedsNewReexcisionRecord === 'function'
        ? lesionNeedsNewReexcisionRecord(target)
        : (typeof lesionIsCompletedEpisode === 'function' && lesionIsCompletedEpisode(target)))) {
        return { mode: 'spawn', lesion: null, prior: target };
    }
    return { mode: 'update', lesion: target, prior: priorOfTarget };
}

function updateAssignExcisionReexcisionBanner(lesion) {
    const banner = document.getElementById('assignExcisionReexcisionBanner');
    const priorEl = document.getElementById('assignExcisionPriorLesionId');
    const resolved = resolveExcisionAssignTarget(lesion);
    if (priorEl) {
        priorEl.value = resolved.prior?.id || lesion?.priorLesionId || '';
    }
    if (!banner) return;
    if (resolved.mode === 'spawn' && resolved.prior) {
        const kind = typeof lesionOwnProcedureKind === 'function'
            ? lesionOwnProcedureKind(resolved.prior)
            : (typeof priorProcedureKindForReexcision === 'function'
                ? priorProcedureKindForReexcision(resolved.prior)
                : 'procedure');
        banner.classList.remove('hidden');
        banner.innerHTML = '<p class="font-semibold text-purple-950">This books a <span class="underline">new</span> re-excision lesion.</p>'
            + '<p class="mt-1">The previous ' + escapeHtml(kind) + ' at ' + escapeHtml(resolved.prior.location || 'this site')
            + ' becomes clinically complete (histology already saved). Any unpaid billing stays on the Billing tab. Written consent is required for the new excision — prior consent is not reused.</p>';
        fillAssignExcisionPriorHistoFields(resolved.prior);
        return;
    }
    if (resolved.mode === 'blocked') {
        banner.classList.remove('hidden');
        banner.innerHTML = '<p class="font-semibold text-amber-950">Cannot book re-excision yet.</p>'
            + '<p class="mt-1">' + escapeHtml(resolved.reason || 'Save histology first.') + '</p>';
        fillAssignExcisionPriorHistoFields(resolved.lesion || lesion);
        return;
    }
    if (resolved.mode === 'update' && (resolved.lesion?.priorLesionId || resolved.prior)) {
        banner.classList.remove('hidden');
        banner.innerHTML = '<p class="font-semibold text-purple-950">Updating the linked re-excision.</p>'
            + '<p class="mt-1">Start Procedure only after written consent is generated for this new lesion.</p>';
        fillAssignExcisionPriorHistoFields(resolved.lesion || lesion);
        return;
    }
    banner.classList.add('hidden');
    banner.innerHTML = '';
    fillAssignExcisionPriorHistoFields(lesion);
}

function updateExcisionProcedureClosureUI() {
    const closure = document.getElementById('assignExcisionClosure')?.value || '';
    const wrap = document.getElementById('assignExcisionGraftWrap');
    if (wrap) wrap.classList.toggle('hidden', !closureNeedsGraftType(closure));
}

function onExcisionProcedureLesionChange() {
    const id = document.getElementById('assignExcisionLesionSelect')?.value || '';
    const source = findLesionForExcisionProcedure(id);
    const resolved = resolveExcisionAssignTarget(source);
    if (resolved.mode === 'update' && resolved.lesion) fillExcisionProcedureForm(resolved.lesion);
    else fillExcisionProcedureForm(source);
}

function openAssignExcisionModal(id) {
    openExcisionProcedureModal(id);
}

function openExcisionProcedureModal(id) {
    if (!id && !hasCurrentPatient()) {
        requireCurrentPatient('Select a patient first so the excision is saved to their chart.');
        return;
    }
    let lesion = findLesionForExcisionProcedure(id);
    if (lesion?.patientName && lesion?.patientDob && !hasCurrentPatient()) {
        setCurrentPatient({
            name: lesion.patientName,
            dob: lesion.patientDob,
            clinician: lesion.clinician || ''
        });
    }
    const resolved = resolveExcisionAssignTarget(lesion);
    if (resolved.mode === 'blocked') {
        closeAssignExcisionModal();
        showToast(resolved.reason || 'Save histology before booking a re-excision.');
        if (resolved.lesion?.id && typeof openHistologyModal === 'function') {
            openHistologyModal(resolved.lesion.id);
        }
        return;
    }
    const formLesion = resolved.mode === 'update' && resolved.lesion ? resolved.lesion : lesion;
    populateExcisionProcedureLesionSelect(formLesion?.id || lesion?.id || '');
    fillExcisionProcedureForm(formLesion);
    if (resolved.mode === 'spawn' && resolved.prior) {
        const idEl = document.getElementById('assignExcisionLesionId');
        if (idEl) idEl.value = '';
        const select = document.getElementById('assignExcisionLesionSelect');
        if (select && resolved.prior.id) select.value = String(resolved.prior.id);
        updateAssignExcisionReexcisionBanner(resolved.prior);
    }
    const modal = document.getElementById('assignExcisionModal');
    if (modal) modal.classList.remove('hidden');
    document.getElementById('assignExcisionLocation')?.focus();
}

function closeAssignExcisionModal() {
    const modal = document.getElementById('assignExcisionModal');
    if (modal) modal.classList.add('hidden');
}

function syncSessionLesionFromProcedure(lesion) {
    const idx = lesions.findIndex((item) => String(item.id) === String(lesion.id));
    const sessionFields = {
        id: lesion.id,
        location: lesion.location,
        impression: lesion.impression,
        plan: lesion.plan,
        type: lesion.type || 'excision',
        priorLesionId: lesion.priorLesionId || '',
        reexcisionOf: lesion.reexcisionOf || '',
        priorProcedureKind: lesion.priorProcedureKind || '',
        managementStatus: lesion.managementStatus || (lesion.priorLesionId ? 'planned_procedure' : ''),
        chartId: lesion.chartId || (typeof hasCurrentPatient === 'function' && hasCurrentPatient() ? currentPatient.chartId : ''),
        excisionMargin: lesion.excisionMargin,
        excisionClosureType: lesion.excisionClosureType,
        excisionReconstruction: lesion.excisionReconstruction,
        graftType: lesion.graftType,
        macroscopic: lesion.macroscopic || 'Unspecified',
        dermoscopy: lesion.dermoscopy || 'Unspecified',
        consentStatus: lesion.consentStatus || '',
        procedureCompletedAt: lesion.procedureCompletedAt || '',
        procedureDetail: lesion.procedureDetail || null,
        priorHistologyCaseNumber: lesion.priorHistologyCaseNumber || '',
        priorHistologyPot: lesion.priorHistologyPot || '',
        priorHistologyResult: lesion.priorHistologyResult || '',
        excisionMarginMm: lesion.excisionMarginMm || '',
        suggestedMarginMm: lesion.suggestedMarginMm || '',
        marginSuggestionReason: lesion.marginSuggestionReason || ''
    };
    if (idx === -1) lesions.push(sessionFields);
    else lesions[idx] = { ...lesions[idx], ...sessionFields };
    if (typeof renderLesionsTable === 'function') renderLesionsTable();
    if (typeof updateOutput === 'function') updateOutput();
}

async function submitAssignExcisionModal() {
    if (!hasCurrentPatient()) {
        requireCurrentPatient('Select a patient first so the excision is saved to their chart.');
        return;
    }
    const location = document.getElementById('assignExcisionLocation')?.value.trim() || '';
    if (!location) {
        showToast('Enter the site for this excision.');
        return;
    }
    const selectedId = document.getElementById('assignExcisionLesionSelect')?.value
        || document.getElementById('assignExcisionLesionId')?.value
        || '';
    const source = findLesionForExcisionProcedure(selectedId);
    const resolved = resolveExcisionAssignTarget(source);
    if (resolved.mode === 'blocked') {
        showToast(resolved.reason || 'Save histology before booking a re-excision.');
        if (resolved.lesion?.id && typeof openHistologyModal === 'function') {
            closeAssignExcisionModal();
            openHistologyModal(resolved.lesion.id);
        }
        return;
    }
    if (resolved.mode === 'spawn' && resolved.prior
        && typeof lesionHasSavedHistology === 'function'
        && !lesionHasSavedHistology(resolved.prior)) {
        showToast('Save histology before booking a re-excision.');
        return;
    }
    const diagnosis = typeof readDiagnosisTypeahead === 'function'
        ? readDiagnosisTypeahead('assignExcisionDiagnosis')
        : (document.getElementById('assignExcisionDiagnosis')?.value.trim() || '');
    const marginNum = typeof readMmInputValue === 'function'
        ? readMmInputValue('assignExcisionMargin')
        : (document.getElementById('assignExcisionMargin')?.value.trim() || '');
    const marginMeta = typeof plannedMarginFieldsFromNumber === 'function'
        ? plannedMarginFieldsFromNumber(marginNum, typeof suggestionMetaIfMatches === 'function' ? suggestionMetaIfMatches('assignExcisionMargin') : null)
        : { excisionMarginMm: marginNum, excisionMargin: marginNum };
    const margin = marginMeta.excisionMargin;
    const closure = document.getElementById('assignExcisionClosure')?.value || 'Ellipse';
    const reconstruction = closureToReconstruction(closure);
    const graftType = closureNeedsGraftType(closure)
        ? (document.getElementById('assignExcisionGraftType')?.value || 'Full-Thickness Skin Graft (FTSG)')
        : '';
    const note = document.getElementById('assignExcisionNote')?.value.trim() || '';
    const priorCaseNumber = document.getElementById('assignExcisionPriorCaseNumber')?.value.trim() || '';
    const priorPot = document.getElementById('assignExcisionPriorPot')?.value.trim() || '';
    const now = new Date().toISOString();
    const planAfter = note || (resolved.mode === 'spawn' ? 'Re-excision planned' : 'Excision planned');

    const applyPlanning = (lesion) => {
        lesion.location = location;
        lesion.impression = diagnosis || lesion.impression || '';
        lesion.excisionMargin = marginMeta.excisionMargin;
        lesion.excisionMarginMm = marginMeta.excisionMarginMm;
        if (marginMeta.suggestedMarginMm) lesion.suggestedMarginMm = marginMeta.suggestedMarginMm;
        if (marginMeta.marginSuggestionReason) lesion.marginSuggestionReason = marginMeta.marginSuggestionReason;
        lesion.excisionClosureType = closure;
        lesion.excisionReconstruction = reconstruction;
        lesion.graftType = graftType;
        lesion.billingGraftType = graftType;
        lesion.billingReconstruction = inferBillingReconstruction({
            excisionReconstruction: reconstruction,
            excisionClosureType: closure
        });
        lesion.type = 'excision';
        lesion.excisionAssignedAt = now;
        lesion.plan = 'Formally Book Excision Procedure';
        lesion.currentPlan = planAfter;
        return lesion;
    };

    let lesion;
    let spawned = false;
    if (resolved.mode === 'spawn' && resolved.prior && typeof buildReexcisionLesionFromPrior === 'function') {
        lesion = applyPlanning(buildReexcisionLesionFromPrior(resolved.prior, {
            location,
            impression: diagnosis,
            excisionMargin: margin,
            excisionClosureType: closure,
            excisionReconstruction: reconstruction,
            graftType,
            billingReconstruction: inferBillingReconstruction({
                excisionReconstruction: reconstruction,
                excisionClosureType: closure
            }),
            currentPlan: planAfter
        }));
        const histo = typeof copyPriorHistologyFromLesion === 'function'
            ? copyPriorHistologyFromLesion(resolved.prior, {
                priorHistologyCaseNumber: priorCaseNumber,
                priorHistologyPot: priorPot
            })
            : {
                priorHistologyCaseNumber: priorCaseNumber,
                priorHistologyPot: priorPot,
                priorHistologyResult: resolved.prior.histologyResult || ''
            };
        Object.assign(lesion, histo);
        spawned = true;
    } else if (resolved.mode === 'update' && resolved.lesion) {
        lesion = applyPlanning(resolved.lesion);
        if (lesion.priorLesionId || resolved.prior) {
            const histo = typeof copyPriorHistologyFromLesion === 'function'
                ? copyPriorHistologyFromLesion(resolved.prior || {}, {
                    priorHistologyCaseNumber: priorCaseNumber,
                    priorHistologyPot: priorPot,
                    priorHistologyResult: lesion.priorHistologyResult || resolved.prior?.histologyResult || ''
                })
                : {
                    priorHistologyCaseNumber: priorCaseNumber,
                    priorHistologyPot: priorPot,
                    priorHistologyResult: lesion.priorHistologyResult || resolved.prior?.histologyResult || ''
                };
            Object.assign(lesion, histo);
        }
    } else {
        lesion = applyPlanning({
            id: newLesionId(),
            macroscopic: 'Unspecified',
            dermoscopy: 'Unspecified',
            createdAt: now
        });
    }

    syncSessionLesionFromProcedure(lesion);

    try {
        if (spawned && typeof persistReexcisionChild === 'function' && isVaultLoggedIn()) {
            await persistReexcisionChild(lesion);
        } else if (typeof persistSessionLesionToVault === 'function' && isVaultLoggedIn()) {
            await persistSessionLesionToVault(lesion);
        }
        if (typeof setManagedLesionStatus === 'function' && isVaultLoggedIn()) {
            const summary = [margin && ('margin ' + margin), closure, note].filter(Boolean).join(' · ');
            await setManagedLesionStatus(lesion.id, 'planned_procedure', summary || planAfter, {
                type: 'excision',
                currentPlan: planAfter
            });
        }
        if (spawned && resolved.prior && typeof closePriorLesionAfterReexcision === 'function') {
            await closePriorLesionAfterReexcision(resolved.prior, lesion);
        }
        if ((spawned || lesion.priorLesionId) && resolved.prior && (priorCaseNumber || priorPot) && typeof writeManagedLesion === 'function') {
            const prior = managedLesions.find((item) => String(item.id) === String(resolved.prior.id));
            if (prior) {
                if (priorCaseNumber && !normalizeHistologyCaseNumber(prior.histologyCaseNumber)) {
                    prior.histologyCaseNumber = priorCaseNumber;
                }
                if (priorPot && !normalizeHistologyPot(prior.histologyPot)) {
                    prior.histologyPot = priorPot;
                }
                await writeManagedLesion(prior);
                upsertManagedLesionMemory(prior);
            }
        }
    } catch (err) {
        showToast(err.message || 'Excision planned in this session, but the encrypted file was not written.');
        closeAssignExcisionModal();
        return;
    }

    closeAssignExcisionModal();
    if (typeof offerLesionToProcedureSession === 'function') offerLesionToProcedureSession(lesion);
    if (typeof renderProcedureWorkspace === 'function') renderProcedureWorkspace();
    if (spawned) {
        showToast('Re-excision planned as a new lesion. Generate written consent before starting Procedure.');
    } else {
        showToast('Excision plan saved.');
    }
    if (activeWorkspaceTab === 'management') {
        if (hasCurrentPatient()) setMgmtFilter('active');
        else setMgmtFilter('planned_procedure');
    }
    if (typeof renderLesionsTable === 'function') renderLesionsTable();
    if (typeof renderChartSidebar === 'function') renderChartSidebar();
}

async function allocateManagedLesionAsCurrentCase(id) {
    const lesion = managedLesions.find((item) => item.id === id);
    if (!lesion) return;
    if (lesion.patientName && lesion.patientDob) {
        const nextId = lesion.chartId || (typeof patientChartId === 'function' ? patientChartId(lesion.patientName, lesion.patientDob) : '');
        if (typeof blockOpenChartWhileVisitActive === 'function' && blockOpenChartWhileVisitActive(nextId)) return;
        setCurrentPatient({
            name: lesion.patientName,
            dob: lesion.patientDob,
            clinician: lesion.clinician || ''
        });
    }
    await setManagedLesionStatus(id, 'current_case', 'Allocated as current operative case');
    currentManagedCaseId = id;
    applyManagedLesionToExcisionForm(lesion);
    updateCurrentCaseBanner();
    switchWorkspaceTab('excision-generator');
    showToast('Current case loaded into the operative form.');
}

function applyManagedLesionToExcisionForm(lesion) {
    const setVal = (elId, val) => {
        const el = document.getElementById(elId);
        if (el) el.value = val || '';
    };
    setVal('exLesionLocation', lesion.location);
    if (typeof setProcedurePathologyDisplay === 'function') {
        setProcedurePathologyDisplay(lesion.impression);
    } else {
        setVal('exProvisionalDiagnoses', lesion.impression);
    }
    if (lesion.excisionLengthMm) setVal('exLesionLength', lesion.excisionLengthMm);
    if (lesion.excisionWidthMm) setVal('exLesionWidth', lesion.excisionWidthMm);
    const marginNum = typeof parseMarginMm === 'function'
        ? parseMarginMm(lesion.excisionMarginMm || lesion.excisionMargin)
        : String(lesion.excisionMargin || lesion.excisionMarginMm || '').replace(/[^\d.]/g, '');
    if (marginNum) setVal('exMargin', marginNum);
    const region = lesion.billingRegion || billingRegionFromBodyArea(lesion.bodyAreaId);
    if (region) setVal('exBillingRegion', String(region));
    setVal('exProcedureType', 'Excision');
    setVal('exExcisionClosureType', normalizeExcisionClosure(lesion));
    if (lesion.billingGraftType || lesion.graftType) setVal('exGraftType', lesion.billingGraftType || lesion.graftType);
    if (typeof updateExFormUI === 'function') updateExFormUI();
    if (typeof validateExForm === 'function') validateExForm();
}

function updateCurrentCaseBanner() {
    const banner = document.getElementById('exCurrentCaseBanner');
    if (!banner) return;
    const text = document.getElementById('exCurrentCaseText');
    const lesion = managedLesions.find((item) => item.id === currentManagedCaseId && item.managementStatus === 'current_case');
    if (!banner) return;
    if (!lesion) {
        banner.classList.add('hidden');
        if (text) text.textContent = '';
        return;
    }
    banner.classList.remove('hidden');
    if (text) {
        const area = lesion.billingRegion ? ` · ${procedureAreaLabel(lesion.billingRegion)}` : '';
        text.textContent = `${lesion.patientName || 'Patient'} — ${lesion.location || 'site'}${area} (${lesion.impression || 'diagnosis'})`;
    }
}

async function finaliseCurrentCaseToBilling() {
    const lesion = managedLesions.find((item) => item.id === currentManagedCaseId);
    if (!lesion) {
        showToast('Allocate a planned excision as the current case first.');
        return;
    }
    const length = document.getElementById('exLesionLength')?.value.trim();
    const width = document.getElementById('exLesionWidth')?.value.trim();
    const margin = document.getElementById('exMargin')?.value.trim();
    const region = document.getElementById('exBillingRegion')?.value;
    if (!length || !width || !margin || !region) {
        showToast('Enter lesion length, width, margin, and procedure area (Region 1 / 2 / 3).');
        return;
    }
    lesion.excisionLengthMm = length;
    lesion.excisionWidthMm = width;
    lesion.excisionMarginMm = margin;
    lesion.billingRegion = Number(region);
    lesion.bodyAreaLabel = procedureAreaLabel(region);
    lesion.excisionFinalisedAt = new Date().toISOString();
    lesion.procedureCompletedAt = lesion.procedureCompletedAt || lesion.excisionFinalisedAt;
    lesion.type = 'excision';
    lesion.excisionClosureType = document.getElementById('exExcisionClosureType')?.value || '';
    lesion.graftType = document.getElementById('exGraftType')?.value || '';
    lesion.billingGraftType = lesion.graftType;
    lesion.billingReconstruction = inferBillingReconstruction({
        excisionClosureType: lesion.excisionClosureType
    });
    if (typeof applyInferredBillingLesionType === 'function') {
        applyInferredBillingLesionType(lesion);
    } else if (!lesion.histologyResult && typeof clinicalDiagnosisIsMelanoma === 'function' && clinicalDiagnosisIsMelanoma(lesion)) {
        lesion.billingLesionType = lesion.billingLesionType || 'suspected_melanoma';
    }
    const suggestion = canAssignBillingCodes(lesion) ? suggestMbsItems(lesion) : { summary: '', nedMm: necessaryExcisionDiameterMm(length, width, margin) };
    lesion.suggestedMbsItems = suggestion.summary || '';
    lesion.necessaryExcisionDiameterMm = suggestion.nedMm;
    if (typeof createOrUpdateBillingFromLesion === 'function') {
        await createOrUpdateBillingFromLesion(lesion);
    }
    if (typeof appendLesionTimeline === 'function') {
        appendLesionTimeline(lesion, {
            type: 'procedure',
            note: `R${region}; ${length}×${width} mm; ${lesion.excisionClosureType || 'ellipse'}`,
            planAfter: 'Awaiting histology'
        });
    }
    lesion.managementStatus = 'awaiting_histology';
    lesion.currentPlan = 'Awaiting histology';
    await setManagedLesionStatus(lesion.id, 'awaiting_histology', `R${region}; ${length}×${width} mm; ${lesion.excisionClosureType || 'ellipse'}`, {
        type: 'excision',
        currentPlan: 'Awaiting histology'
    });
    currentManagedCaseId = null;
    updateCurrentCaseBanner();
    if (typeof addOrUpdateExLesion === 'function' && document.getElementById('exProcedureType')?.value) {
        try { addOrUpdateExLesion(); } catch (err) { /* Operative form may still be incomplete. */ }
    }
    showToast('Excision finalised. Specimen sent — Awaiting results until the report is filed. Billing can be confirmed separately.');
    switchWorkspaceTab('management');
    setMgmtFilter('awaiting_histology');
}
