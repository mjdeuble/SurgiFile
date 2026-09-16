/* Patient chart rail: workspace icons, sanitise unlock, context actions, one lesion list. */

let selectedChartLesionId = '';

function chartLesions() {
    if (!hasCurrentPatient()) return [];
    const chartId = currentPatient.chartId;
    const map = new Map();
    managedLesions.forEach((item) => {
        const onChart = typeof lesionBelongsToOpenChart === 'function'
            ? lesionBelongsToOpenChart(item)
            : lesionChartId(item) === chartId;
        if (onChart) map.set(String(item.id), item);
    });
    lesions.forEach((item) => {
        const id = String(item.id);
        const existing = map.get(id);
        map.set(id, existing ? { ...existing, ...item } : item);
    });
    return Array.from(map.values()).sort((a, b) => String(b.updatedAt || b.createdAt || '').localeCompare(String(a.updatedAt || a.createdAt || '')));
}

function clinicalChartLesions() {
    const items = typeof chartLesions === 'function' ? chartLesions() : [];
    return items.filter((item) => !(typeof lesionIsHiddenByReexcisionLink === 'function' && lesionIsHiddenByReexcisionLink(item)));
}

function isVisitLesion(id) {
    return lesions.some((item) => String(item.id) === String(id));
}

function lesionStatusLabel(lesion) {
    const status = typeof lesionLifecycleStatus === 'function' ? lesionLifecycleStatus(lesion) : (lesion.managementStatus || deriveLesionStatusFromPlan(lesion));
    const type = typeof lesionType === 'function' ? lesionType(lesion) : '';
    let label = '';
    if (lesion?.linkedReexcisionId) {
        const child = typeof findLinkedReexcisionChild === 'function' ? findLinkedReexcisionChild(lesion.id) : null;
        const childIsExcision = child && (
            (typeof lesionType === 'function' ? lesionType(child) : child.type) === 'excision'
            || child.managementStatus === 'planned_procedure'
            || child.managementStatus === 'current_case'
        );
        const billing = /billing/i.test(String(lesion.currentPlan || ''));
        if (childIsExcision) {
            label = billing ? 'Done · re-excision booked · billing pending' : 'Done · re-excision booked';
        } else {
            label = billing ? 'Done · further management open · billing pending' : 'Done · further management open';
        }
    }
    else if (lesion?.priorLesionId && status === 'needs_contact') {
        label = lesion?.contactUrgent ? 'Needs contact · Further management · Urgent' : 'Needs contact · Further management';
    }
    else if (lesion?.priorLesionId && status === 'awaiting_assessment') {
        const proposed = typeof proposedPlanLabel === 'function' ? proposedPlanLabel(lesion.proposedPlan) : '';
        label = proposed ? ('Further management · ' + proposed) : 'Further management';
    }
    else if (status === 'planned_procedure' && type === 'excision') {
        label = lesion?.priorLesionId ? 'Planned procedure · Re-excision' : 'Planned procedure · Excision';
    }
    else if (status === 'planned_procedure' && type === 'punch') label = 'Planned procedure · Punch';
    else if (status === 'planned_procedure' && type === 'shave') label = 'Planned procedure · Shave';
    else if (status === 'planned_procedure') label = 'Planned procedure';
    else if (status === 'awaiting_histology') label = 'Awaiting results';
    else if (status === 'needs_contact') label = lesion?.contactUrgent ? 'Needs contact · Urgent' : 'Needs contact';
    else if (status === 'appointment_requested') label = 'Appointment requested';
    else label = LESION_STATUSES[status] || status || 'On chart';
    const consent = typeof lesionConsentLabel === 'function' ? lesionConsentLabel(lesion) : '';
    return consent ? label + ' · ' + consent : label;
}

function isLesionFlyoutOpen() {
    const fly = document.getElementById('chartLesionFlyout');
    return !!(fly && !fly.classList.contains('hidden'));
}

function toggleLesionFlyout() {
    if (isLesionFlyoutOpen()) closeLesionFlyout();
    else openLesionFlyout();
}

function openLesionFlyout() {
    const fly = document.getElementById('chartLesionFlyout');
    const btn = document.getElementById('btnRailLesions');
    if (fly) fly.classList.remove('hidden');
    if (btn) btn.classList.add('is-active');
}

function closeLesionFlyout() {
    const fly = document.getElementById('chartLesionFlyout');
    const btn = document.getElementById('btnRailLesions');
    if (fly) fly.classList.add('hidden');
    if (btn) btn.classList.remove('is-active');
}

function toggleChartSidebar() {
    toggleLesionFlyout();
}

function closeChartSidebar() {
    closeLesionFlyout();
}

function visitConsultTypeLabel(type) {
    const key = String(type || visitConsultType || '').trim();
    if (key === 'phone') return 'Phone consult';
    if (key === 'chart_review') return 'Chart review';
    if (key === 'face_to_face') return 'Face to face';
    return '';
}

function isRemoteOrDeskConsult(type) {
    const key = String(type || visitConsultType || '').trim();
    return key === 'phone' || key === 'chart_review';
}

function visitClinicalUnlocked() {
    return !!visitConsultType || !!isBedSanitised;
}

function openConsultTypeModal() {
    const modal = document.getElementById('consultTypeModal');
    if (modal) modal.classList.remove('hidden');
}

function closeConsultTypeModal() {
    const modal = document.getElementById('consultTypeModal');
    if (modal) modal.classList.add('hidden');
}

function maybePromptConsultType(options) {
    if (!hasCurrentPatient()) return false;
    if (visitConsultType || isBedSanitised) return false;
    if (options?.skipConsultTypePrompt) return false;
    openConsultTypeModal();
    return true;
}

function selectVisitConsultType(type) {
    const key = String(type || '').trim();
    if (key !== 'chart_review' && key !== 'phone' && key !== 'face_to_face') return;
    if (!hasCurrentPatient()) {
        showToast('Select a patient first.');
        return;
    }
    visitConsultType = key;
    pendingSanitise = false;
    if (key === 'face_to_face') {
        isBedSanitised = true;
        if (typeof setModalBedSanitation === 'function') setModalBedSanitation(true);
    } else {
        isBedSanitised = false;
        if (typeof setModalBedSanitation === 'function') setModalBedSanitation(false);
    }
    closeConsultTypeModal();
    renderChartSidebar();
    if (typeof updateOutput === 'function') updateOutput();
    const label = visitConsultTypeLabel(key);
    showToast(key === 'face_to_face'
        ? 'Face to face — room marked sanitised. Lesions and Procedure unlocked.'
        : label + ' — Lesions and Procedure unlocked (no sanitation note).');
    if (pendingWorkspaceTab) {
        const tab = pendingWorkspaceTab;
        pendingWorkspaceTab = '';
        switchWorkspaceTab(tab);
    }
    if (typeof scheduleChartSave === 'function') scheduleChartSave();
}

function markChartSanitised() {
    if (!hasCurrentPatient()) {
        pendingSanitise = true;
        requireCurrentPatient('Select a patient first. Choose consult type to unlock Lesions and Procedure.');
        return;
    }
    if (visitConsultType === 'face_to_face' && isBedSanitised) {
        showToast('Already marked face to face / sanitised for this chart. Close the chart to end the visit.');
        return;
    }
    selectVisitConsultType('face_to_face');
}

function pulseSanitiseControl() {
    const btn = document.getElementById('sidebarSanitiseBtn');
    if (!btn) return;
    btn.classList.add('is-pulse');
    setTimeout(() => btn.classList.remove('is-pulse'), 1600);
}

function requireRoomReady(tabName) {
    if (tabName === 'management') return true;
    if (tabName === 'skin-check' || tabName === 'excision-generator') {
        if (!hasCurrentPatient()) {
            pendingWorkspaceTab = tabName;
            openPatientModal();
            showToast('Search for a patient on the practice board, or add a new patient.');
            return false;
        }
    }
    if (tabName !== 'skin-check' && tabName !== 'excision-generator') return true;
    if (!visitClinicalUnlocked()) {
        pendingWorkspaceTab = tabName;
        pulseSanitiseControl();
        openConsultTypeModal();
        showToast('Choose consult type to unlock Lesions and Procedure.');
        return false;
    }
    return true;
}

function selectChartLesion(id, options) {
    selectedChartLesionId = String(id || '');
    renderChartSidebar();
    const lesion = chartLesions().find((item) => String(item.id) === selectedChartLesionId);
    if (!lesion) return;

    if (activeWorkspaceTab === 'management') {
        if (!options?.skipComms && typeof openLesionCommsModal === 'function') openLesionCommsModal(lesion.id);
        return;
    }

    if (!visitClinicalUnlocked()) {
        pulseSanitiseControl();
        openConsultTypeModal();
        showToast('Choose consult type to examine or operate on this lesion.');
        return;
    }

    closeLesionFlyout();

    if (activeWorkspaceTab === 'excision-generator') {
        if (typeof openProcedureLesionDetail === 'function') {
            openProcedureLesionDetail(lesion.id);
        } else if (typeof allocateManagedLesionAsCurrentCase === 'function' && (typeof lesionType === 'function' ? lesionType(lesion) === 'excision' : (lesion.managementStatus === 'planned_excision' || lesion.managementStatus === 'current_case' || String(lesion.plan || '').includes('Excision')))) {
            allocateManagedLesionAsCurrentCase(lesion.id);
        } else if (typeof applyManagedLesionToExcisionForm === 'function') {
            applyManagedLesionToExcisionForm(lesion);
            showToast('Lesion loaded into the procedure form.');
        }
        return;
    }

    if (typeof openLesionModal === 'function') openLesionModal(lesion.id);
}

function railModeVisible(mode, tab) {
    if (mode === 'never') return false;
    if (!mode || mode === 'always') return true;
    if (mode === 'exam') return tab === 'skin-check';
    if (mode === 'clinical') return tab === 'skin-check' || tab === 'excision-generator';
    if (mode === 'admin') return tab === 'management';
    return true;
}

function renderChartSidebar() {
    const patientOn = hasCurrentPatient();
    const tab = activeWorkspaceTab;
    const patientTools = document.getElementById('railPatientTools');
    if (patientTools) patientTools.classList.toggle('hidden', !patientOn);

    const sanitiseBtn = document.getElementById('sidebarSanitiseBtn');
    const sanitiseHint = document.getElementById('sidebarSanitiseHint');
    const unlocked = visitClinicalUnlocked();
    if (sanitiseBtn) {
        sanitiseBtn.classList.toggle('is-on', !!isBedSanitised || visitConsultType === 'face_to_face');
        const typeLabel = visitConsultTypeLabel();
        sanitiseBtn.setAttribute('aria-label', typeLabel || 'Consult type');
    }
    if (sanitiseHint) {
        if (visitConsultType === 'face_to_face' || isBedSanitised) {
            sanitiseHint.textContent = 'Face to face — room sanitised for this visit. Close the chart to end the visit.';
        } else if (visitConsultType === 'phone') {
            sanitiseHint.textContent = 'Phone consult — no sanitation note. Close the chart to end the visit.';
        } else if (visitConsultType === 'chart_review') {
            sanitiseHint.textContent = 'Chart review — no sanitation note. Close the chart to end the visit.';
        } else {
            sanitiseHint.textContent = 'Choose consult type (chart review, phone, or face to face) to unlock Lesions and Procedure.';
        }
    }

    const examBtn = document.getElementById('navTabSkinCheck');
    const procBtn = document.getElementById('navTabExcisionGen');
    const adminBtn = document.getElementById('navTabManagement');
    const setNav = (btn, workspace) => {
        if (!btn) return;
        btn.classList.toggle('is-active', tab === workspace);
        btn.classList.toggle('is-locked', (workspace === 'skin-check' || workspace === 'excision-generator') && !unlocked);
        btn.setAttribute('aria-selected', tab === workspace ? 'true' : 'false');
    };
    setNav(examBtn, 'skin-check');
    setNav(procBtn, 'excision-generator');
    setNav(adminBtn, 'management');

    document.querySelectorAll('#chartSidebar [data-rail]').forEach((el) => {
        el.classList.toggle('hidden', !patientOn || !railModeVisible(el.getAttribute('data-rail'), tab));
    });

    const recall = document.getElementById('headerRecallBadgeContainer');
    const accordion = document.getElementById('accordionHeaderControls');
    if (recall) recall.classList.toggle('hidden', !patientOn || tab !== 'skin-check');
    if (accordion) accordion.classList.toggle('hidden', !patientOn || tab !== 'skin-check');

    const lesionsBtn = document.getElementById('btnRailLesions');
    if (lesionsBtn) lesionsBtn.classList.toggle('is-active', isLesionFlyoutOpen());

    if (!patientOn) closeLesionFlyout();

    if (tab === 'excision-generator' && typeof renderProcedureWorkspace === 'function') renderProcedureWorkspace();

    const list = document.getElementById('sidebarLesionList');
    if (!list) return;
    if (!patientOn) {
        list.innerHTML = '<p class="text-[11px] text-slate-400 italic px-0.5">Select a patient to see their lesions and concerns.</p>';
        return;
    }

    const items = typeof clinicalChartLesions === 'function' ? clinicalChartLesions() : chartLesions();
    const concernRows = patientConcerns.filter((text) => !items.some((item) => String(item.location || '').toLowerCase() === String(text).toLowerCase()));
    if (!items.length && !concernRows.length) {
        list.innerHTML = '<p class="text-[11px] text-slate-400 italic px-0.5">No lesions on this chart yet.</p>';
        return;
    }

    const episodes = typeof groupRecordsByPatientEpisode === 'function'
        ? groupRecordsByPatientEpisode(items).flatMap((group) => group.episodeList || [])
        : [{ key: 'all', at: '', items }];
    const lesionHtml = episodes.map((ep) => {
        const label = typeof formatEpisodeDayLabel === 'function'
            ? formatEpisodeDayLabel(ep.key, ep.at)
            : '';
        const rows = (ep.items || []).map((lesion) => {
            const today = isVisitLesion(lesion.id);
            const concern = !!(lesion.isConcern);
            const selected = String(lesion.id) === String(selectedChartLesionId);
            const classes = ['chart-lesion-item'];
            if (selected) classes.push('is-selected');
            if (today) classes.push('is-today');
            if (concern) classes.push('is-concern');
            const tag = concern ? 'Concern' : today ? 'This visit' : 'On chart';
            const dx = typeof billingDisplayDiagnosis === 'function'
                ? billingDisplayDiagnosis(lesion)
                : (typeof formatDiagnosisDisplay === 'function' ? formatDiagnosisDisplay(lesion.impression) : (lesion.impression || ''));
            return `
            <button type="button" class="${classes.join(' ')}" onclick="selectChartLesion('${String(lesion.id).replace(/'/g, '')}')">
                <span class="block text-xs font-semibold text-slate-800 truncate">${escapeHtml(lesion.location || 'No site')}</span>
                <span class="block text-[10px] text-slate-500 truncate">${escapeHtml(dx)}</span>
                <span class="mt-0.5 flex justify-between gap-1 text-[10px] font-semibold">
                    <span class="text-blue-800">${escapeHtml(lesionStatusLabel(lesion))}</span>
                    <span class="text-slate-400">${tag}</span>
                </span>
                ${lesion.currentPlan ? `<span class="mt-0.5 block text-[10px] text-slate-600 truncate">${escapeHtml(lesion.currentPlan)}</span>` : ''}
                ${typeof formatPriorHistologyCitation === 'function' && lesion.priorLesionId && formatPriorHistologyCitation(lesion)
                    ? `<span class="mt-0.5 block text-[10px] text-slate-500 truncate">${escapeHtml(formatPriorHistologyCitation(lesion))}</span>`
                    : (typeof formatHistologyAccession === 'function' && formatHistologyAccession(lesion, 'own')
                        ? `<span class="mt-0.5 block text-[10px] text-slate-500 truncate">Lab case ${escapeHtml(formatHistologyAccession(lesion, 'own'))}</span>`
                        : (lesion.histologyPot
                            ? `<span class="mt-0.5 block text-[10px] text-slate-500 truncate">Pot ${escapeHtml(String(lesion.histologyPot))}${lesion.histologyBatchId ? ' · this procedure' : ''}</span>`
                            : ''))}
                ${typeof lastUnsuccessfulCall === 'function' && lastUnsuccessfulCall(lesion)
                    ? `<span class="lesion-call-badge">${escapeHtml(formatCallBadge(lastUnsuccessfulCall(lesion)))}</span>`
                    : ''}
            </button>`;
        }).join('');
        return `<div class="space-y-1">
            ${label ? `<p class="px-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">${escapeHtml(label)}</p>` : ''}
            ${rows}
        </div>`;
    }).join('');

    list.innerHTML = lesionHtml + concernRows.map((text) => `
        <div class="chart-lesion-item is-concern">
            <span class="block text-xs font-semibold text-amber-950 truncate">${escapeHtml(text)}</span>
            <span class="block text-[10px] font-semibold text-amber-800">Patient concern</span>
        </div>
    `).join('');
}

document.addEventListener('click', (event) => {
    const fly = document.getElementById('chartLesionFlyout');
    const btn = document.getElementById('btnRailLesions');
    if (!fly || fly.classList.contains('hidden')) return;
    if (fly.contains(event.target) || (btn && btn.contains(event.target))) return;
    closeLesionFlyout();
});
