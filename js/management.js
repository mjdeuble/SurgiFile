/* Admin: practice lesion list, filters, and separate billing queue. */

let mgmtActiveFilter = 'open';

function initManagementModule() {
    renderManagedLesions();
    updateCurrentCaseBanner();
    if (typeof updateChartChrome === 'function') updateChartChrome();
}

function lesionsForCurrentChart() {
    if (!hasCurrentPatient()) return managedLesions;
    const id = currentPatient.chartId;
    return managedLesions.filter((item) => lesionChartId(item) === id);
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
    return adminLesions().filter((item) => item.managementStatus === status);
}

function lesionMatchesFilter(lesion, filter) {
    if (filter === 'open' || filter === 'active') return ACTIVE_MANAGEMENT_STATUSES.includes(lesion.managementStatus);
    if (filter === 'billing' || filter === 'notes') return false;
    return lesion.managementStatus === filter;
}

function formatLesionWhen(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleString('en-AU', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function renderManagedLesions() {
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
    const open = chart.filter((item) => ACTIVE_MANAGEMENT_STATUSES.includes(item.managementStatus)).length;
    const awaitingBill = bills.filter((item) => item.status === 'awaiting' || !item.status).length;
    const confirmedBill = bills.filter((item) => item.status === 'confirmed').length;
    const processedBill = bills.filter((item) => item.status === 'processed').length;
    if (counts) {
        if (!isVaultLoggedIn()) {
            counts.textContent = 'Sign in to load encrypted charts, billing, and results.';
        } else {
            const scope = hasCurrentPatient() ? currentPatient.name + ' · ' : 'All patients · ';
            counts.textContent = `${scope}${open} open · ${awaitingBill} awaiting · ${confirmedBill} confirmed · ${processedBill} processed · ${(typeof adminVisitNotes === 'function' ? adminVisitNotes().length : 0)} notes`;
        }
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
        if (empty) empty.classList.toggle('hidden', notes.length > 0);
        root.innerHTML = typeof renderSavedVisitNotesQueue === 'function'
            ? renderSavedVisitNotesQueue(notes)
            : '<p class="text-sm text-slate-400 italic lg:col-span-2">Saved notes are not available.</p>';
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
    const groups = [
        { status: 'awaiting_histology', title: 'Awaiting results' },
        { status: 'planned_excision', title: 'Assigned excision' },
        { status: 'current_case', title: 'Current case' },
        { status: 'awaiting_biopsy', title: 'Awaiting biopsy' },
        { status: 'awaiting_assessment', title: 'Awaiting assessment' },
        { status: 'topical_followup', title: 'Topical follow-up' }
    ];
    const html = groups.map((group) => {
        const grouped = items.filter((item) => item.managementStatus === group.status);
        if (!grouped.length) return '';
        return renderNamedStatusColumn(group.title, grouped);
    }).join('');
    return html || '<p class="text-sm text-slate-400 italic lg:col-span-2">No open lesions.</p>';
}

function renderNamedStatusColumn(title, items) {
    return `
        <section class="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <header class="px-4 py-3 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
                <h3 class="text-sm font-bold text-slate-800">${escapeHtml(title)}</h3>
                <span class="text-[11px] font-semibold text-slate-500">${items.length}</span>
            </header>
            <div class="p-3 space-y-2">
                ${items.map(renderManagedLesionCard).join('')}
            </div>
        </section>`;
}

function renderStatusColumn(status, items) {
    const title = status === 'planned_excision' ? 'Assigned excision' : status === 'awaiting_histology' ? 'Awaiting results' : (LESION_STATUSES[status] || status);
    return renderNamedStatusColumn(title, items);
}

function renderManagedLesionCard(lesion) {
    const patient = lesion.patientName || 'Unnamed patient';
    const identity = typeof patientIdentityFromRecord === 'function' ? patientIdentityFromRecord(lesion) : null;
    const canFocus = !!(identity?.chartId || (lesion.patientName && lesion.patientDob));
    const fu = lesion.topicalFollowUp && lesion.topicalFollowUp !== 'none'
        ? `Follow-up: ${escapeHtml(lesion.topicalFollowUp)}`
        : '';
    const region = lesion.billingRegion ? procedureAreaLabel(lesion.billingRegion) : '';
    const dims = [lesion.excisionLengthMm, lesion.excisionWidthMm].filter(Boolean).length === 2
        ? `${lesion.excisionLengthMm} × ${lesion.excisionWidthMm} mm`
        : '';
    const bill = typeof billingForLesion === 'function' ? billingForLesion(lesion.id) : null;
    const billLabel = bill ? billingStatusLabel(bill) : '';
    const safeId = String(lesion.id || '').replace(/'/g, '');
    const nameHtml = canFocus
        ? `<button type="button" onclick="openChartFromLesion('${safeId}')" class="text-left min-w-0 cursor-pointer group">
                <span class="text-sm font-semibold text-slate-800 truncate group-hover:text-blue-700">${escapeHtml(patient)}</span>${hasCurrentPatient() ? '' : ' <span class="text-[10px] font-semibold text-blue-700">Open chart</span>'}
           </button>`
        : `<p class="text-sm font-semibold text-slate-800 truncate">${escapeHtml(patient)}</p>`;
    return `
        <article class="p-3 rounded-lg border border-slate-200 bg-slate-50/70 space-y-2">
            <div class="flex justify-between gap-2">
                <div class="min-w-0">
                    ${nameHtml}
                    <p class="text-xs text-slate-600">${escapeHtml(lesion.location || 'No site')} · ${escapeHtml(lesion.impression || '')}</p>
                </div>
                <span class="text-[10px] text-slate-400 shrink-0">${escapeHtml(formatLesionWhen(lesion.updatedAt))}</span>
            </div>
            <p class="text-[11px] text-slate-500">${escapeHtml(typeof lesionStatusLabel === 'function' ? lesionStatusLabel(lesion) : (lesion.plan || ''))}${fu ? ' · ' + fu : ''}${region ? ' · ' + escapeHtml(region) : ''}${dims ? ' · ' + dims : ''}${billLabel ? ' · Billing: ' + escapeHtml(billLabel) : ''}</p>
            ${lesion.histologyResult ? `<p class="text-[11px] text-slate-600">Result: ${escapeHtml(lesion.histologyResult)}</p>` : ''}
            <div class="flex flex-wrap gap-1.5">${renderManagedLesionActions(lesion)}</div>
        </article>`;
}

function canUpdateResult(lesion) {
    return lesion.managementStatus === 'awaiting_histology' || !!lesion.procedureCompletedAt || !!lesion.histologyResult;
}

function canAssignExcision(lesion) {
    if (lesion.managementStatus === 'awaiting_histology') {
        return typeof isLesionBillingProcessed === 'function' && isLesionBillingProcessed(lesion.id);
    }
    return ['awaiting_assessment', 'awaiting_biopsy', 'topical_followup', 'planned_excision'].includes(lesion.managementStatus);
}

function renderManagedLesionActions(lesion) {
    const id = String(lesion.id || '').replace(/'/g, '');
    const status = lesion.managementStatus;
    const bill = typeof billingForLesion === 'function' ? billingForLesion(id) : null;
    const billingDone = typeof billingHasBeenSent === 'function' ? billingHasBeenSent(bill) : bill?.status === 'confirmed' || bill?.status === 'processed';
    const btns = [];
    if (canUpdateResult(lesion)) {
        btns.push(`<button type="button" onclick="openHistologyModal('${id}')" class="mgmt-action-btn">Update result</button>`);
    }
    if (bill && bill.status !== 'confirmed' && bill.status !== 'processed') {
        btns.push(`<button type="button" onclick="openProcessBillingModal('${id}')" class="mgmt-action-btn mgmt-action-btn-primary">Process billing</button>`);
    }
    if (status === 'awaiting_histology') {
        if (billingDone) {
            btns.push(`<button type="button" onclick="openAssignExcisionModal('${id}')" class="mgmt-action-btn mgmt-action-btn-primary">Rebook excision</button>`);
            btns.push(actionBtn(id, 'no_followup', 'No further action'));
        } else {
            btns.push(`<span class="text-[11px] text-amber-800">Billing must be confirmed before closing this lesion.</span>`);
        }
    } else if (canAssignExcision(lesion)) {
        const label = status === 'planned_excision' ? 'Update excision' : 'Assign excision';
        const action = status === 'planned_excision'
            ? `openChartFromLesion('${id}')`
            : `openAssignExcisionModal('${id}')`;
        btns.push(`<button type="button" onclick="${action}" class="mgmt-action-btn mgmt-action-btn-primary">${label}</button>`);
    }
    if (status === 'awaiting_assessment') {
        btns.push(actionBtn(id, 'awaiting_biopsy', 'Needs biopsy'));
        btns.push(actionBtn(id, 'no_followup', 'No follow-up'));
    }
    if (status === 'awaiting_biopsy') {
        if (!(typeof isShaveBiopsyLesion === 'function' && isShaveBiopsyLesion(lesion))) {
            btns.push(actionBtn(id, 'awaiting_histology', 'Mark biopsied'));
        }
        btns.push(actionBtn(id, 'no_followup', 'No follow-up'));
    }
    if (status === 'topical_followup') {
        btns.push(actionBtn(id, 'no_followup', 'Complete follow-up'));
        btns.push(actionBtn(id, 'awaiting_biopsy', 'Needs biopsy'));
    }
    if (status === 'planned_excision') {
        btns.push(`<button type="button" onclick="allocateManagedLesionAsCurrentCase('${id}')" class="mgmt-action-btn">Use as current case</button>`);
        btns.push(actionBtn(id, 'no_followup', 'Cancel plan'));
    }
    if (status === 'current_case') {
        btns.push(`<button type="button" onclick="allocateManagedLesionAsCurrentCase('${id}')" class="mgmt-action-btn mgmt-action-btn-primary">Open in operative</button>`);
        btns.push(actionBtn(id, 'planned_excision', 'Unassign'));
    }
    return btns.join('');
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
    if (typeof selectChartLesion === 'function') selectChartLesion(id);
}

function focusPatientFromLesion(id) {
    return openChartFromLesion(id);
}

function actionBtn(id, status, label) {
    return `<button type="button" onclick="setManagedLesionStatus('${id}', '${status}')" class="mgmt-action-btn">${label}</button>`;
}

function renderBillingQueue(items) {
    return `
        <section class="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <header class="px-4 py-3 bg-amber-50 border-b border-amber-200 flex flex-wrap justify-between items-center gap-2">
                <div>
                    <h3 class="text-sm font-bold text-slate-800">Awaiting billings</h3>
                    <p class="text-[11px] text-slate-500 mt-0.5">Separate from clinical management. Confirm item numbers here; they move to Confirmed billings for the practice manager.</p>
                </div>
                <span class="text-[11px] font-semibold text-slate-500">${items.length}</span>
            </header>
            <div class="divide-y divide-slate-100">
                ${items.length ? items.map(renderBillingQueueCard).join('') : '<p class="p-4 text-slate-400 italic text-sm">No lesions awaiting billing.</p>'}
            </div>
        </section>`;
}

function renderConfirmedBillingQueue(items) {
    return `
        <section class="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
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
            <div class="divide-y divide-slate-100">
                ${items.length ? items.map(renderConfirmedBillingCard).join('') : '<p class="p-4 text-slate-400 italic text-sm">No confirmed billings yet.</p>'}
            </div>
        </section>`;
}

function renderProcessedBillingQueue(items) {
    return `
        <section class="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <header class="px-4 py-3 bg-slate-50 border-b border-slate-200 flex flex-wrap justify-between items-center gap-2">
                <div>
                    <h3 class="text-sm font-bold text-slate-800">Processed billings</h3>
                    <p class="text-[11px] text-slate-500 mt-0.5">Entered by the practice manager. Print again if you need a record.</p>
                </div>
                <div class="flex flex-wrap items-center gap-1.5">
                    <span class="text-[11px] font-semibold text-slate-500">${items.length}</span>
                    ${items.length ? `<button type="button" onclick="printProcessedBillings()" class="mgmt-action-btn">Print processed</button>` : ''}
                </div>
            </header>
            <div class="divide-y divide-slate-100">
                ${items.length ? items.map(renderProcessedBillingCard).join('') : '<p class="p-4 text-slate-400 italic text-sm">No processed billings yet.</p>'}
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
        lesion.histologyResult ? 'Histo: ' + lesion.histologyResult : '',
        lesion.punchSize ? 'Punch ' + lesion.punchSize + ' mm' : ''
    ].filter(Boolean).join(' · ');
}

function renderBillingQueueCard(view) {
    const type = inferBillingLesionType(view);
    const suggestionLesion = { ...view, billingLesionType: type };
    const suggestion = suggestMbsItems(suggestionLesion);
    return `
        <article class="p-4 space-y-3">
            <div class="min-w-0">
                <p class="text-sm font-semibold text-slate-800">${escapeHtml(view.patientName || '')}</p>
                <p class="text-xs text-slate-600">${escapeHtml(view.location || '')} · ${escapeHtml(view.impression || '')}</p>
                <p class="text-[11px] text-slate-500">${escapeHtml(billingCardMeta(view))}</p>
            </div>
            ${view.billWhen === 'hold' || (typeof lesionCanBillAtProcedure === 'function' && lesionCanBillAtProcedure(view).hold)
                ? '<p class="text-[11px] font-semibold text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1">Reception: HOLD billing until histology is known.</p>'
                : '<p class="text-[11px] font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg px-2 py-1">Reception: OK to bill now — enter codes in Best Practice.</p>'}
            ${!suggestion.ready ? `<p class="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-2.5">Need location and size (and type for excision) to suggest items. You can still process billing and enter type there.</p>` : ''}
            <div id="billingSuggest-${view.id}" class="p-2.5 rounded-lg border border-emerald-200 bg-emerald-50/60">
                ${renderBillingSuggestionHtml(suggestionLesion)}
            </div>
            <div class="flex flex-wrap gap-1.5">
                <button type="button" onclick="openProcessBillingModal('${escapeHtml(String(view.lesionId || ''))}')" class="mgmt-action-btn mgmt-action-btn-primary">Process billing</button>
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

function renderConfirmedBillingCard(lesion) {
    const codes = lesion.assignedMbsItems || lesion.suggestedMbsItems || '';
    const type = BILLING_LESION_TYPES.find((t) => t.id === inferBillingLesionType(lesion))?.label || '';
    const billId = escapeHtml(String(lesion.id || ''));
    return `
        <article class="p-4 space-y-2">
            <div class="flex flex-wrap justify-between gap-2">
                <label class="flex items-start gap-2 min-w-0 cursor-pointer">
                    <input type="checkbox" class="billing-confirmed-check mt-1 rounded text-emerald-700" value="${billId}">
                    <span class="min-w-0">
                        <span class="block text-sm font-semibold text-slate-800">${escapeHtml(lesion.patientName || '')}</span>
                        <span class="block text-xs text-slate-600">${escapeHtml(lesion.location || '')} · ${escapeHtml(lesion.impression || '')}</span>
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

function renderProcessedBillingCard(lesion) {
    const codes = lesion.assignedMbsItems || lesion.suggestedMbsItems || '';
    const type = BILLING_LESION_TYPES.find((t) => t.id === inferBillingLesionType(lesion))?.label || '';
    const billId = escapeHtml(String(lesion.id || ''));
    return `
        <article class="p-4 space-y-2">
            <div class="flex flex-wrap justify-between gap-2">
                <div class="min-w-0">
                    <p class="text-sm font-semibold text-slate-800">${escapeHtml(lesion.patientName || '')}</p>
                    <p class="text-xs text-slate-600">${escapeHtml(lesion.location || '')} · ${escapeHtml(lesion.impression || '')}</p>
                    <p class="text-[11px] text-slate-500">${escapeHtml(billingCardMeta(lesion))}${type ? ' · ' + escapeHtml(type) : ''}</p>
                </div>
                <span class="text-[10px] text-slate-400 shrink-0">${escapeHtml(formatLesionWhen(lesion.processedAt))}</span>
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
        if (isVaultLoggedIn()) {
            try { await saveManagedLesionRecord(lesion, 'billing:confirmed', codes, { silent: true }); } catch (err) { /* keep billing record even if lesion write fails */ }
        }
    }
    await saveManagedBillingRecord(bill, 'confirmed', codes);
    showToast('Billing confirmed: ' + codes + '. Print for the practice manager from Billing.');
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
        `<button type="button" class="billing-claim-chip" onclick="removeProcessBillingClaimCode('${escapeHtml(code)}')" title="Remove ${escapeHtml(code)}">${escapeHtml(code)}</button>`
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

function buildProcessBillingSuggestedItems(view) {
    const suggestion = suggestMbsItems(view || {});
    const flap = typeof flapWasUsed === 'function' && flapWasUsed(view);
    const items = [{
        key: 'consult',
        code: CONSULT_ITEM_CODE,
        label: itemLabel(CONSULT_ITEM_CODE),
        kind: 'consult'
    }];
    (suggestion.items || []).forEach((item, index) => {
        items.push({
            key: 'proc-' + index,
            code: item.code,
            label: item.label || itemLabel(item.code, { flap }),
            kind: item.code === '45201' ? 'flap' : 'procedure'
        });
    });
    return { suggestion, items };
}

function processBillingItemStatus(item) {
    if (processBillingContext.accepted[item.key]) return 'accepted';
    if (processBillingContext.rejected[item.key]) return 'rejected';
    return 'pending';
}

function renderProcessBillingLesionDetails(view) {
    const detail = typeof procedureDetailForLesion === 'function' ? procedureDetailForLesion(view) : {};
    const length = firstFilled(view.excisionLengthMm, detail.length);
    const width = firstFilled(view.excisionWidthMm, detail.width);
    const margin = firstFilled(view.excisionMarginMm, detail.margin);
    const punch = firstFilled(view.punchSize, detail.punchSize);
    const ned = lesionNedMm(view);
    const region = procedureAreaLabel(view.billingRegion || billingRegionFromBodyArea(view.bodyAreaId)) || '—';
    const type = BILLING_LESION_TYPES.find((opt) => opt.id === inferBillingLesionType(view))?.label || '—';
    const closure = firstFilled(view.excisionClosureType, detail.excisionClosureType) || '—';
    const kind = billingProcedureKind(view);
    const histo = view.histologyResult || '';
    const diagnosis = firstFilled(view.impression, view.pathology, detail.pathology);
    const flap = flapWasUsed(view);
    const lesionSize = length && width ? `${length} × ${width} mm` : (length ? `${length} mm` : '—');
    const nedText = ned != null ? formatNedDisplay(ned) + ' mm' : '—';
    const nedCalc = length && width && margin
        ? `(${length} + ${width}) ÷ 2 + 2 × ${margin}`
        : '(length + width) ÷ 2 + 2 × margin';
    const sizeRows = kind === 'biopsy'
        ? `<div><dt>Lesion size</dt><dd>${punch ? escapeHtml(String(punch)) + ' mm punch' : '—'}</dd></div>`
        : `<div><dt>Lesion size</dt><dd>${escapeHtml(lesionSize)}</dd></div>
           <div><dt>Margin</dt><dd>${margin ? escapeHtml(String(margin)) + ' mm' : '—'}</dd></div>
           <div><dt>Overall size</dt><dd>${escapeHtml(nedText)}<span class="billing-detail-sub">NED ${escapeHtml(nedCalc)}</span></dd></div>`;
    return `
        <div class="billing-detail-card space-y-2">
            <h4>Lesion details</h4>
            <dl class="billing-detail-grid">
                <div><dt>Site</dt><dd>${escapeHtml(view.location || '—')}</dd></div>
                <div><dt>Diagnosis</dt><dd>${escapeHtml(diagnosis || '—')}</dd></div>
                <div><dt>Region</dt><dd>${escapeHtml(region)}</dd></div>
                <div><dt>Type</dt><dd>${escapeHtml(type)}</dd></div>
                <div><dt>Closure</dt><dd>${escapeHtml(closure)}</dd></div>
                <div><dt>Flap used</dt><dd>${flap ? 'Yes — 45201 can be claimed' : 'No'}</dd></div>
                ${histo ? `<div><dt>Histology</dt><dd>${escapeHtml(histo)}</dd></div>` : ''}
            </dl>
            <h4>Lesion size</h4>
            <dl class="billing-detail-grid">
                ${sizeRows}
            </dl>
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
    let bill = typeof billingForLesion === 'function' ? billingForLesion(lesion.id) : null;
    if (billingHasBeenSent(bill)) {
        showToast('This billing has already been confirmed. Print or mark it processed from Billing.');
        return;
    }
    if (typeof createOrUpdateBillingFromLesion === 'function') {
        bill = await createOrUpdateBillingFromLesion(lesion) || bill;
    }
    if (!bill) {
        showToast('Could not open billing for this lesion.');
        return;
    }
    processBillingContext = { lesionId: lesion.id, billId: bill.id, items: [], accepted: {}, rejected: {}, customByKey: {}, noConsult: false };
    document.getElementById('processBillingLesionId').value = lesion.id;
    document.getElementById('processBillingBillId').value = bill.id;
    setProcessBillingClaim([]);
    const patient = lesion.patientName || bill.patientName || 'Patient';
    const site = lesion.location || bill.location || 'site';
    document.getElementById('processBillingSummary').textContent = patient + ' — ' + site;
    fillProcessBillingTypeSelect(inferBillingLesionType(billingViewModel(bill)));
    refreshProcessBillingPreview();
    document.getElementById('processBillingModal')?.classList.remove('hidden');
}

function closeProcessBillingModal() {
    document.getElementById('processBillingModal')?.classList.add('hidden');
    processBillingContext = { lesionId: '', billId: '', items: [], accepted: {}, rejected: {}, customByKey: {}, noConsult: false };
}

function refreshProcessBillingPreview() {
    const bill = findManagedBilling(processBillingContext.billId);
    if (!bill) return;
    const typeEl = document.getElementById('processBillingType');
    if (typeEl?.value) bill.billingLesionType = typeEl.value;
    const view = billingViewModel(bill);
    const built = buildProcessBillingSuggestedItems(view);
    processBillingContext.items = built.items;
    processBillingContext.suggestionNotes = built.suggestion.notes || [];
    const typeWrap = document.getElementById('processBillingTypeWrap');
    if (typeWrap) typeWrap.classList.toggle('hidden', built.suggestion.kind === 'biopsy');
    const meta = document.getElementById('processBillingMeta');
    if (meta) meta.innerHTML = renderProcessBillingLesionDetails(view);
    renderProcessBillingSuggestedItems();
    const note = document.getElementById('processBillingGateNote');
    if (note) {
        note.textContent = claimCodesFromBox().length
            ? 'Confirm to add this claim to Confirmed billings for the practice manager. You can then review management.'
            : 'Accept or reject each suggested item. After billing is confirmed you can review management.';
    }
    updateProcessBillingSendState();
}

function onProcessBillingTypeChange() {
    processBillingContext.accepted = {};
    processBillingContext.rejected = {};
    processBillingContext.customByKey = {};
    processBillingContext.noConsult = false;
    setProcessBillingClaim([]);
    const bill = findManagedBilling(processBillingContext.billId);
    const lesion = managedLesions.find((item) => String(item.id) === String(processBillingContext.lesionId));
    const type = document.getElementById('processBillingType')?.value || '';
    if (bill) bill.billingLesionType = type;
    if (lesion) lesion.billingLesionType = type;
    refreshProcessBillingPreview();
}

function updateProcessBillingSendState() {
    const sendBtn = document.getElementById('btnProcessBillingSend');
    if (sendBtn) sendBtn.disabled = !claimCodesFromBox().length;
}

async function submitProcessBilling() {
    const codes = claimCodesFromBox().join(' + ');
    if (!codes) {
        showToast('Accept at least one item, or enter a custom item number.');
        return;
    }
    const bill = findManagedBilling(processBillingContext.billId);
    if (!bill || billingHasBeenSent(bill)) return;
    const typeEl = document.getElementById('processBillingType');
    if (typeEl?.value) bill.billingLesionType = typeEl.value;
    const exclude = !!processBillingContext.noConsult || !claimCodesFromBox().includes(CONSULT_ITEM_CODE);
    await persistProcessedBilling(bill, codes, {
        excludeConsult: exclude,
        consultItem: exclude ? '' : CONSULT_ITEM_CODE,
        recommendationAccepted: true
    });
    closeProcessBillingModal();
    setMgmtFilter('billing');
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
    await saveManagedBillingRecord(bill, 'returned', 'Returned to awaiting processing');
    showToast('Billing returned to awaiting processing. Management is locked until it is confirmed again.');
    renderManagedLesions();
}

async function returnBillingToConfirmed(id) {
    const bill = findManagedBilling(id);
    if (!bill || bill.status !== 'processed') return;
    bill.status = 'confirmed';
    bill.processedAt = '';
    if (!bill.confirmedAt) bill.confirmedAt = new Date().toISOString();
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

async function markBillingsAsProcessed(ids) {
    const list = (ids || []).map((id) => findManagedBilling(id)).filter((bill) => bill && bill.status === 'confirmed');
    if (!list.length) {
        showToast('Select confirmed billings to mark processed.');
        return;
    }
    const now = new Date().toISOString();
    for (const bill of list) {
        bill.status = 'processed';
        bill.processedAt = now;
        if (!bill.confirmedAt) bill.confirmedAt = now;
        await saveManagedBillingRecord(bill, 'processed', bill.assignedMbsItems || '');
    }
    showToast(list.length === 1 ? 'Moved to processed billings.' : list.length + ' billings moved to processed.');
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
    const type = (typeof BILLING_LESION_TYPES !== 'undefined' ? BILLING_LESION_TYPES.find((t) => t.id === inferBillingLesionType(view))?.label : '') || '';
    const ned = typeof formatNedDisplay === 'function' && typeof lesionNedMm === 'function' ? formatNedDisplay(lesionNedMm(view)) : '';
    const size = [view.excisionLengthMm, view.excisionWidthMm].filter(Boolean).join(' × ');
    const sizeText = size ? size + ' mm' + (view.excisionMarginMm ? ', margin ' + view.excisionMarginMm + ' mm' : '') + (ned ? ', NED ' + ned + ' mm' : '')
        : (view.punchSize ? 'Punch ' + view.punchSize + ' mm' : (ned ? 'NED ' + ned + ' mm' : ''));
    const when = formatLesionWhen(view.processedAt || view.confirmedAt || view.updatedAt);
    return {
        patient: view.patientName || '',
        dob: view.patientDob || '',
        clinician: view.clinician || '',
        site: view.location || '',
        diagnosis: view.impression || view.histologyResult || '',
        procedure: view.procedure || view.procedureType || view.excisionClosureType || '',
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

function openHistologyModal(id) {
    const lesion = managedLesions.find((item) => item.id === id);
    const modal = document.getElementById('histologyModal');
    const idEl = document.getElementById('histologyLesionId');
    const resultEl = document.getElementById('histologyResultText');
    const typeEl = document.getElementById('histologyBillingType');
    const summaryEl = document.getElementById('histologyLesionSummary');
    const noteEl = document.getElementById('histologyCallNote');
    const advisedEl = document.getElementById('histologyAdvisedCall');
    if (idEl) idEl.value = id;
    if (resultEl) resultEl.value = lesion?.histologyResult || '';
    if (typeEl) typeEl.value = lesion?.billingLesionType || inferBillingLesionType(lesion || {}) || '';
    if (summaryEl) {
        summaryEl.textContent = lesion
            ? `${lesion.patientName || currentPatient.name || ''} — ${lesion.location || 'site'} · ${lesion.impression || ''}`
            : '';
    }
    if (noteEl) noteEl.value = lesion?.adminCallNote || '';
    if (advisedEl) advisedEl.checked = true;
    const billingDone = !!(lesion && typeof isLesionBillingProcessed === 'function' && isLesionBillingProcessed(lesion.id));
    const gate = document.getElementById('histologyBillingGateNote');
    if (gate) {
        gate.textContent = billingDone
            ? 'Billing has been confirmed. You can close this lesion with no further action, or rebook excision.'
            : 'Billing has not been confirmed yet. You can save the result, but management stays as awaiting histology until billing is confirmed.';
        gate.className = billingDone
            ? 'text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg p-2.5'
            : 'text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-2.5';
    }
    const stay = document.querySelector('input[name="histologyNext"][value="stay"]');
    const none = document.querySelector('input[name="histologyNext"][value="no_followup"]');
    const excision = document.querySelector('input[name="histologyNext"][value="plan_excision"]');
    if (stay) stay.checked = true;
    [none, excision].forEach((el) => {
        if (!el) return;
        el.disabled = !billingDone;
        el.closest('label')?.classList.toggle('opacity-40', !billingDone);
    });
    if (modal) modal.classList.remove('hidden');
}

function closeHistologyModal() {
    const modal = document.getElementById('histologyModal');
    if (modal) modal.classList.add('hidden');
}

async function submitHistologyModal() {
    const id = document.getElementById('histologyLesionId')?.value;
    const result = document.getElementById('histologyResultText')?.value.trim();
    const billingType = document.getElementById('histologyBillingType')?.value || '';
    const next = document.querySelector('input[name="histologyNext"]:checked')?.value || 'stay';
    const callNote = document.getElementById('histologyCallNote')?.value.trim() || '';
    const advised = document.getElementById('histologyAdvisedCall')?.checked;
    if (!id) return;
    if (!result) {
        showToast('Enter the histology result.');
        return;
    }
    if (!billingType) {
        showToast('Assign the lesion type from histology (or suspected melanoma).');
        return;
    }
    if ((next === 'plan_excision' || next === 'no_followup') && typeof isLesionBillingProcessed === 'function' && !isLesionBillingProcessed(id)) {
        showToast('Process billing before choosing management.');
        return;
    }
    await recordHistologyOutcome(id, result, next, billingType, { callNote, advised });
    closeHistologyModal();
    const messages = {
        plan_excision: 'Result saved. Rebook the excision next.',
        no_followup: 'Result saved. No further action.',
        stay: 'Result saved. Lesion remains awaiting histology until billing is confirmed and management is chosen.'
    };
    showToast(messages[next] || 'Result saved.');
    if (next === 'plan_excision') openExcisionProcedureModal(id);
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
    const smsEl = document.getElementById('assignExcisionSms');
    const noteEl = document.getElementById('assignExcisionNote');
    const idEl = document.getElementById('assignExcisionLesionId');
    const summaryEl = document.getElementById('assignExcisionSummary');
    if (idEl) idEl.value = lesion?.id || '';
    if (locEl) locEl.value = lesion?.location || '';
    if (dxEl) dxEl.value = lesion?.impression || '';
    if (marginEl) marginEl.value = lesion?.excisionMargin || (lesion?.excisionMarginMm ? lesion.excisionMarginMm + ' mm' : '');
    if (closureEl) closureEl.value = normalizeExcisionClosure(lesion);
    if (graftEl) graftEl.value = lesion?.graftType || lesion?.billingGraftType || 'Full-Thickness Skin Graft (FTSG)';
    if (smsEl) smsEl.checked = lesion ? lesion.smsConsent !== false : true;
    if (noteEl) noteEl.value = lesion?.adminCallNote || '';
    if (summaryEl) {
        summaryEl.textContent = hasCurrentPatient()
            ? `${currentPatient.name} · ${currentPatient.dob}`
            : (lesion?.patientName ? `${lesion.patientName} · ${lesion.patientDob || ''}` : '');
    }
    updateExcisionProcedureClosureUI();
}

function updateExcisionProcedureClosureUI() {
    const closure = document.getElementById('assignExcisionClosure')?.value || '';
    const wrap = document.getElementById('assignExcisionGraftWrap');
    if (wrap) wrap.classList.toggle('hidden', !closureNeedsGraftType(closure));
}

function onExcisionProcedureLesionChange() {
    const id = document.getElementById('assignExcisionLesionSelect')?.value || '';
    fillExcisionProcedureForm(findLesionForExcisionProcedure(id));
}

function openAssignExcisionModal(id) {
    openExcisionProcedureModal(id);
}

function openExcisionProcedureModal(id) {
    if (!id && !hasCurrentPatient()) {
        requireCurrentPatient('Select a patient first so the excision is saved to their chart.');
        return;
    }
    const lesion = findLesionForExcisionProcedure(id);
    if (lesion?.patientName && lesion?.patientDob && !hasCurrentPatient()) {
        setCurrentPatient({
            name: lesion.patientName,
            dob: lesion.patientDob,
            clinician: lesion.clinician || ''
        });
    }
    populateExcisionProcedureLesionSelect(lesion?.id || '');
    fillExcisionProcedureForm(lesion);
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
        excisionMargin: lesion.excisionMargin,
        excisionClosureType: lesion.excisionClosureType,
        excisionReconstruction: lesion.excisionReconstruction,
        graftType: lesion.graftType,
        smsConsent: lesion.smsConsent,
        macroscopic: lesion.macroscopic || 'Unspecified',
        dermoscopy: lesion.dermoscopy || 'Unspecified'
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
    let lesion = findLesionForExcisionProcedure(selectedId);
    const diagnosis = document.getElementById('assignExcisionDiagnosis')?.value.trim() || '';
    const margin = document.getElementById('assignExcisionMargin')?.value.trim() || '';
    const closure = document.getElementById('assignExcisionClosure')?.value || 'Ellipse';
    const reconstruction = closureToReconstruction(closure);
    const graftType = closureNeedsGraftType(closure)
        ? (document.getElementById('assignExcisionGraftType')?.value || 'Full-Thickness Skin Graft (FTSG)')
        : '';
    const smsConsent = document.getElementById('assignExcisionSms')?.checked !== false;
    const note = document.getElementById('assignExcisionNote')?.value.trim() || '';
    const now = new Date().toISOString();

    if (!lesion) {
        lesion = {
            id: newLesionId(),
            macroscopic: 'Unspecified',
            dermoscopy: 'Unspecified',
            createdAt: now
        };
    }

    lesion.location = location;
    lesion.impression = diagnosis || lesion.impression || '';
    lesion.excisionMargin = margin;
    lesion.excisionClosureType = closure;
    lesion.excisionReconstruction = reconstruction;
    lesion.graftType = graftType;
    lesion.billingGraftType = graftType;
    lesion.billingReconstruction = inferBillingReconstruction({
        excisionReconstruction: reconstruction,
        excisionClosureType: closure
    });
    lesion.smsConsent = smsConsent;
    if (note) lesion.adminCallNote = note;
    lesion.excisionAssignedAt = now;
    lesion.plan = 'Formally Book Excision Procedure';

    syncSessionLesionFromProcedure(lesion);

    try {
        if (typeof persistSessionLesionToVault === 'function' && isVaultLoggedIn()) {
            await persistSessionLesionToVault(lesion);
        }
        if (typeof setManagedLesionStatus === 'function' && isVaultLoggedIn()) {
            const summary = [margin && ('margin ' + margin), closure, note].filter(Boolean).join(' · ');
            await setManagedLesionStatus(lesion.id, 'planned_excision', summary || 'Assigned excision');
        }
    } catch (err) {
        showToast(err.message || 'Excision planned in this session, but the encrypted file was not written.');
        closeAssignExcisionModal();
        return;
    }

    closeAssignExcisionModal();
    showToast('Excision plan saved.');
    if (activeWorkspaceTab === 'management') {
        if (hasCurrentPatient()) setMgmtFilter('active');
        else setMgmtFilter('planned_excision');
    }
}

async function allocateManagedLesionAsCurrentCase(id) {
    const lesion = managedLesions.find((item) => item.id === id);
    if (!lesion) return;
    if (lesion.patientName && lesion.patientDob) {
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
    setVal('exProvisionalDiagnoses', lesion.impression);
    const displayEl = document.getElementById('exPathologyDisplay');
    if (displayEl && lesion.impression) {
        displayEl.textContent = lesion.impression;
        displayEl.classList.remove('italic', 'text-slate-500');
    }
    if (lesion.excisionLengthMm) setVal('exLesionLength', lesion.excisionLengthMm);
    if (lesion.excisionWidthMm) setVal('exLesionWidth', lesion.excisionWidthMm);
    const marginNum = String(lesion.excisionMargin || lesion.excisionMarginMm || '').replace(/[^\d.]/g, '');
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
    lesion.excisionClosureType = document.getElementById('exExcisionClosureType')?.value || '';
    lesion.graftType = document.getElementById('exGraftType')?.value || '';
    lesion.billingGraftType = lesion.graftType;
    lesion.billingReconstruction = inferBillingReconstruction({
        excisionClosureType: lesion.excisionClosureType
    });
    if (!lesion.histologyResult && String(lesion.impression || '').toLowerCase().includes('melanoma')) {
        lesion.billingLesionType = lesion.billingLesionType || 'suspected_melanoma';
    }
    const suggestion = canAssignBillingCodes(lesion) ? suggestMbsItems(lesion) : { summary: '', nedMm: necessaryExcisionDiameterMm(length, width, margin) };
    lesion.suggestedMbsItems = suggestion.summary || '';
    lesion.necessaryExcisionDiameterMm = suggestion.nedMm;
    if (typeof createOrUpdateBillingFromLesion === 'function') {
        await createOrUpdateBillingFromLesion(lesion);
    }
    lesion.managementStatus = 'awaiting_histology';
    await setManagedLesionStatus(lesion.id, 'awaiting_histology', `R${region}; ${length}×${width} mm; ${lesion.excisionClosureType || 'ellipse'}`);
    currentManagedCaseId = null;
    updateCurrentCaseBanner();
    if (typeof addOrUpdateExLesion === 'function' && document.getElementById('exProcedureType')?.value) {
        try { addOrUpdateExLesion(); } catch (err) { /* Operative form may still be incomplete. */ }
    }
    showToast('Excision finalised. Billing is waiting to be confirmed. Lesion stays awaiting histology until billing is confirmed, then choose management.');
    switchWorkspaceTab('management');
    setMgmtFilter('billing');
}
