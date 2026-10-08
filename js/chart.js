/* Patient chart: BP-style text tree, consult-type gate, session toolbar, lesion inspector. */

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

function chartTreeLesions() {
    const items = typeof clinicalChartLesions === 'function' ? clinicalChartLesions() : [];
    return items.filter((item) => typeof isClinicalLesionTile !== 'function' || isClinicalLesionTile(item));
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
        label = lesion?.priorLesionId
            ? 'Planned procedure · Re-excision'
            : ((typeof lesionHasCopiedPriorHistology === 'function' && lesionHasCopiedPriorHistology(lesion))
                ? 'Planned procedure · Excision after prior histology'
                : 'Planned procedure · Excision');
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
    return false;
}

function toggleLesionFlyout() {
    /* Lesion-list flyout removed — lesions live on the Lesions workspace. */
}

function openLesionFlyout() {
    /* Lesion-list flyout removed. */
}

function closeLesionFlyout() {
    /* Lesion-list flyout removed. */
}

function toggleChartSidebar() {
    /* Lesion-list flyout removed. */
}

function closeChartSidebar() {
    /* Lesion-list flyout removed. */
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
        ? 'Face to face — room marked sanitised. History, Lesions, Procedure, and Consent unlocked.'
        : label + ' — History, Lesions, Procedure, and Consent unlocked (no sanitation note).');
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
        requireCurrentPatient('Select a patient first. Choose consult type to unlock History, Lesions, Procedure, and Consent.');
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
    const clinical = typeof isClinicalWorkspaceTab === 'function'
        ? isClinicalWorkspaceTab(tabName)
        : (tabName === 'history' || tabName === 'skin-check' || tabName === 'excision-generator' || tabName === 'consent');
    if (clinical) {
        if (!hasCurrentPatient()) {
            pendingWorkspaceTab = tabName;
            openPatientModal();
            showToast('Search for a patient in the header, or add a new patient.');
            return false;
        }
        if (!visitClinicalUnlocked()) {
            pendingWorkspaceTab = tabName;
            pulseSanitiseControl();
            openConsultTypeModal();
            showToast('Choose consult type to unlock History, Lesions, Procedure, and Consent.');
            return false;
        }
    }
    return true;
}

let chartTreeCompletedCollapsed = true;

function chartLesionInspectorVisible() {
    if (typeof hasCurrentPatient !== 'function' || !hasCurrentPatient()) return false;
    const tab = typeof activeWorkspaceTab !== 'undefined' ? activeWorkspaceTab : '';
    return tab === 'management' || tab === 'skin-check';
}

function ensureSelectedChartLesion() {
    const items = typeof chartTreeLesions === 'function' ? chartTreeLesions() : [];
    if (!items.length) {
        selectedChartLesionId = '';
        return null;
    }
    const current = items.find((item) => String(item.id) === String(selectedChartLesionId));
    if (current) return current;
    const child = items.find((item) => String(item.priorLesionId || '') === String(selectedChartLesionId));
    if (child) {
        selectedChartLesionId = String(child.id || '');
        return child;
    }
    const live = items.find((item) => !(typeof lesionIsClinicallyFinalised === 'function' && lesionIsClinicallyFinalised(item)));
    const pick = live || items[0];
    selectedChartLesionId = String(pick.id || '');
    return pick;
}

function chartLesionTreeModel() {
    const items = typeof chartTreeLesions === 'function' ? chartTreeLesions() : [];
    const byId = new Map(items.map((item) => [String(item.id), item]));
    const children = new Map();
    const roots = [];
    items.forEach((item) => {
        const pid = item.priorLesionId ? String(item.priorLesionId) : '';
        if (pid && byId.has(pid)) {
            if (!children.has(pid)) children.set(pid, []);
            children.get(pid).push(item);
        } else {
            roots.push(item);
        }
    });
    const isLiveBranch = (item) => {
        const done = typeof lesionIsClinicallyFinalised === 'function' && lesionIsClinicallyFinalised(item);
        const kids = children.get(String(item.id)) || [];
        if (kids.some(isLiveBranch)) return true;
        return !done;
    };
    return {
        live: roots.filter(isLiveBranch),
        done: roots.filter((item) => !isLiveBranch(item)),
        children,
        total: items.length
    };
}

function chartTreeNodeLabel(lesion) {
    const site = String(lesion?.location || 'No site');
    const dx = typeof formatDiagnosisDisplay === 'function'
        ? formatDiagnosisDisplay(lesion?.impression || '')
        : (lesion?.impression || '');
    const status = typeof lesionStatusLabel === 'function' ? lesionStatusLabel(lesion) : (lesion?.managementStatus || '');
    const today = typeof isVisitLesion === 'function' && isVisitLesion(lesion.id) ? 'Today' : '';
    const meta = [dx, status, today].filter(Boolean).join(' · ');
    return { site, meta };
}

function renderChartTreeNode(lesion, depth, childrenMap) {
    const id = String(lesion.id || '');
    const selected = id && id === String(selectedChartLesionId);
    const done = typeof lesionIsClinicallyFinalised === 'function' && lesionIsClinicallyFinalised(lesion);
    const label = chartTreeNodeLabel(lesion);
    const kids = childrenMap.get(id) || [];
    const cls = ['chart-tree-node', selected ? 'is-selected' : '', done ? 'is-done' : ''].filter(Boolean).join(' ');
    const self = `<button type="button" role="treeitem" aria-selected="${selected ? 'true' : 'false'}" class="${cls}" style="--depth:${depth}" onclick="selectChartLesion('${id.replace(/'/g, '')}', { fromTree: true })">
        <span class="chart-tree-node-site">${escapeHtml(label.site)}</span>
        <span class="chart-tree-node-meta">${escapeHtml(label.meta)}</span>
    </button>`;
    return self + kids.map((child) => renderChartTreeNode(child, depth + 1, childrenMap)).join('');
}

function toggleChartTreeCompleted() {
    chartTreeCompletedCollapsed = !chartTreeCompletedCollapsed;
    renderChartLesionTree();
}

function selectChartFolder(tabName) {
    if (typeof switchWorkspaceTab === 'function') switchWorkspaceTab(tabName);
}

function chartTreeSavedDocItems() {
    const notes = typeof adminVisitNotes === 'function' ? adminVisitNotes() : [];
    const consents = typeof adminConsentDocs === 'function' ? adminConsentDocs() : [];
    const items = [];
    notes.forEach((note) => {
        const kinds = [];
        if (typeof consultNoteIsSavable === 'function' && consultNoteIsSavable(note.consultText)) kinds.push('Consult');
        if (typeof procedureNoteIsSavable === 'function' && procedureNoteIsSavable(note.procedureText)) kinds.push('Procedure');
        const when = typeof formatLesionWhen === 'function'
            ? formatLesionWhen(note.updatedAt || note.createdAt)
            : (note.updatedAt || note.createdAt || '');
        items.push({
            kind: 'note',
            id: String(note.id || ''),
            site: kinds.join(' / ') || 'Visit note',
            meta: when
        });
    });
    consents.forEach((doc) => {
        const when = typeof formatLesionWhen === 'function'
            ? formatLesionWhen(doc.createdAt)
            : (doc.createdAt || '');
        const n = Array.isArray(doc.procedures) ? doc.procedures.length : 0;
        items.push({
            kind: 'consent',
            id: String(doc.id || ''),
            site: 'Consent',
            meta: [when, n ? (n + ' procedure' + (n === 1 ? '' : 's')) : ''].filter(Boolean).join(' · ')
        });
    });
    return items;
}

function renderChartTreeSavedDocs() {
    const root = document.getElementById('chartTreeSavedDocs');
    if (!root) return;
    const items = chartTreeSavedDocItems();
    if (!items.length) {
        root.innerHTML = '<p class="chart-tree-empty">No saved notes yet</p>';
        return;
    }
    root.innerHTML = items.map((item) => {
        const id = String(item.id || '').replace(/'/g, '');
        const onclick = item.kind === 'consent'
            ? `openSavedConsentDoc('${id}')`
            : `openSavedVisitNote('${id}')`;
        return `<button type="button" role="treeitem" class="chart-tree-node" style="--depth:1" onclick="${onclick}">
            <span class="chart-tree-node-site">${escapeHtml(item.site)}</span>
            <span class="chart-tree-node-meta">${escapeHtml(item.meta)}</span>
        </button>`;
    }).join('');
}

function renderChartLesionTree() {
    const tree = document.getElementById('chartLesionTree');
    const list = document.getElementById('chartLesionTreeLesions');
    const empty = document.getElementById('chartLesionTreeEmpty');
    const status = document.getElementById('chartLesionTreeStatus');
    const toolbar = document.getElementById('chartActionToolbar');
    const open = typeof hasCurrentPatient === 'function' && hasCurrentPatient();
    if (tree) tree.classList.toggle('hidden', !open);
    if (toolbar) toolbar.classList.toggle('hidden', !open);
    const shell = document.getElementById('appShell');
    if (shell) shell.classList.toggle('is-chart-open', !!open);
    if (!open) return;
    ensureSelectedChartLesion();
    const model = chartLesionTreeModel();
    if (list) {
        if (!model.total) {
            list.innerHTML = '';
        } else {
            let html = '';
            if (model.live.length) {
                html += model.live.map((item) => renderChartTreeNode(item, 1, model.children)).join('');
            }
            if (model.done.length) {
                const label = chartTreeCompletedCollapsed
                    ? 'Completed (' + model.done.length + ')'
                    : 'Completed';
                html += `<button type="button" class="chart-tree-group" onclick="toggleChartTreeCompleted()">${escapeHtml(label)}</button>`;
                if (!chartTreeCompletedCollapsed) {
                    html += model.done.map((item) => renderChartTreeNode(item, 1, model.children)).join('');
                }
            }
            list.innerHTML = html;
        }
    }
    if (empty) empty.classList.add('hidden');
    renderChartTreeSavedDocs();
    if (status) {
        if (!model.total) {
            status.textContent = 'No lesions';
        } else {
            const liveCount = model.live.length;
            status.textContent = model.total + ' lesion' + (model.total === 1 ? '' : 's')
                + (liveCount ? ' · ' + liveCount + ' current' : '');
        }
    }
}

function renderChartLesionInspector() {
    const pane = document.getElementById('chartLesionInspector');
    if (!pane) return;
    const show = chartLesionInspectorVisible();
    pane.classList.toggle('hidden', !show);
    if (!show) return;
    const lesion = ensureSelectedChartLesion();
    if (!lesion) {
        pane.innerHTML = '<div class="chart-inspector-empty">No lesions on this chart. Click Add lesion to document a spot.</div>';
        return;
    }
    const id = String(lesion.id || '').replace(/'/g, '');
    const status = typeof lesionStatusLabel === 'function' ? lesionStatusLabel(lesion) : (lesion.plan || '');
    const dx = typeof formatDiagnosisDisplay === 'function'
        ? formatDiagnosisDisplay(lesion.impression || '')
        : (lesion.impression || '');
    const history = typeof renderChartLesionHistory === 'function'
        ? renderChartLesionHistory(lesion)
        : { historyHtml: '', currentProc: '' };
    const canResult = typeof canUpdateResult === 'function' && canUpdateResult(lesion);
    const refer = String(lesion.proposedPlan || '') === 'refer'
        || (typeof isReferLesionPlan === 'function' && isReferLesionPlan(lesion.plan));
    const pendingBill = typeof lesionIsClinicallyFinalised === 'function' && lesionIsClinicallyFinalised(lesion)
        && typeof lesionCanCloseNoFollowup === 'function' && !lesionCanCloseNoFollowup(lesion);
    pane.innerHTML = `
        <div class="chart-inspector-caption">
            <h2>${escapeHtml(lesion.location || 'No site')}</h2>
            <p>${escapeHtml([dx, status].filter(Boolean).join(' · '))}</p>
        </div>
        <div class="chart-inspector-toolbar">
            <button type="button" onclick="documentChartLesion('${id}')">Document</button>
            <button type="button" onclick="openManageLesionModal('${id}')">Manage lesion</button>
            ${canResult ? `<button type="button" onclick="openHistologyModal('${id}')">Update result</button>` : ''}
            ${refer ? `<button type="button" onclick="openLetterModalForRefer('${id}')">Generate letter</button>` : ''}
        </div>
        <div class="chart-inspector-body">
            ${pendingBill ? '<p class="text-[11px] font-semibold text-amber-800 mb-2">Clinically finalised · billing still pending</p>' : ''}
            ${lesion.currentPlan ? `<p class="text-[12px] text-slate-800 mb-2"><strong>Plan:</strong> ${escapeHtml(lesion.currentPlan)}</p>` : ''}
            ${history.historyHtml || ''}
            ${history.currentProc || ''}
            ${typeof renderLesionContactBlock === 'function' ? renderLesionContactBlock(lesion) : ''}
            ${typeof renderLesionActionLog === 'function' ? renderLesionActionLog(lesion) : ''}
        </div>`;
}

function syncChartLesionWorkspace() {
    const open = typeof hasCurrentPatient === 'function' && hasCurrentPatient();
    const inspectorOn = chartLesionInspectorVisible();
    const shell = document.getElementById('appShell');
    if (shell) shell.classList.toggle('is-chart-open', !!open);
    document.body.classList.toggle('chart-open', !!open);
    renderChartLesionTree();
    renderChartLesionInspector();
    const viewMgmt = document.getElementById('view-management');
    const header = document.getElementById('mgmtWorkspaceHeader');
    const board = document.getElementById('mgmtBoard');
    const empty = document.getElementById('mgmtEmptyState');
    if (header) header.classList.toggle('hidden', inspectorOn);
    if (board) board.classList.toggle('hidden', inspectorOn);
    if (empty && inspectorOn) empty.classList.add('hidden');
    const examLesions = document.getElementById('examLesionsBlock');
    if (examLesions && inspectorOn && activeWorkspaceTab === 'skin-check') {
        examLesions.classList.add('hidden');
    }
    const viewSkin = document.getElementById('view-skin-check');
    if (viewSkin && inspectorOn && activeWorkspaceTab === 'skin-check') {
        viewSkin.classList.add('hidden');
    }
    if (viewMgmt && inspectorOn && activeWorkspaceTab === 'management') {
        viewMgmt.classList.add('hidden');
    } else if (viewMgmt && activeWorkspaceTab === 'management' && !inspectorOn) {
        viewMgmt.classList.remove('hidden');
    }
}

function documentChartLesion(id) {
    if (typeof visitClinicalUnlocked === 'function' && !visitClinicalUnlocked()) {
        pendingWorkspaceTab = 'skin-check';
        if (typeof pulseSanitiseControl === 'function') pulseSanitiseControl();
        if (typeof openConsultTypeModal === 'function') openConsultTypeModal();
        showToast('Choose consult type to document a lesion.');
        return;
    }
    if (typeof openLesionModal === 'function') openLesionModal(id);
}

function selectChartLesion(id, options) {
    selectedChartLesionId = String(id || '');
    const fromTree = !!(options && options.fromTree);
    if (typeof renderChartSidebar === 'function') renderChartSidebar();
    if (fromTree || chartLesionInspectorVisible()) {
        syncChartLesionWorkspace();
    }
    const lesion = (typeof chartLesions === 'function' ? chartLesions() : []).find((item) => String(item.id) === selectedChartLesionId);
    if (!lesion) return;

    if (fromTree) {
        if (activeWorkspaceTab === 'excision-generator' && typeof visitClinicalUnlocked === 'function' && visitClinicalUnlocked()) {
            if (typeof openProcedureLesionDetail === 'function') openProcedureLesionDetail(lesion.id);
            else if (typeof applyManagedLesionToExcisionForm === 'function') applyManagedLesionToExcisionForm(lesion);
            return;
        }
        if (activeWorkspaceTab !== 'management' && activeWorkspaceTab !== 'skin-check') {
            if (typeof switchWorkspaceTab === 'function') switchWorkspaceTab('management', { skipPersist: true });
        }
        return;
    }

    if (activeWorkspaceTab === 'management') {
        if (!options?.skipComms && typeof openManageLesionModal === 'function') openManageLesionModal(lesion.id);
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
    if (mode === 'exam') return tab === 'history' || tab === 'skin-check';
    if (mode === 'clinical') {
        return typeof isClinicalWorkspaceTab === 'function'
            ? isClinicalWorkspaceTab(tab)
            : (tab === 'history' || tab === 'skin-check' || tab === 'excision-generator' || tab === 'consent');
    }
    if (mode === 'admin') return tab === 'management';
    return true;
}

function renderChartSidebar() {
    const patientOn = hasCurrentPatient();
    const tab = activeWorkspaceTab;
    const toolbar = document.getElementById('chartActionToolbar');
    if (toolbar) toolbar.classList.toggle('hidden', !patientOn);

    const sanitiseBtn = document.getElementById('sidebarSanitiseBtn');
    const sanitiseLabel = document.getElementById('sidebarSanitiseLabel');
    const sanitiseHint = document.getElementById('sidebarSanitiseHint');
    const unlocked = visitClinicalUnlocked();
    const typeLabel = visitConsultTypeLabel();
    if (sanitiseBtn) {
        sanitiseBtn.classList.toggle('is-on', !!isBedSanitised || visitConsultType === 'face_to_face');
        sanitiseBtn.setAttribute('aria-label', typeLabel || 'Consult type');
    }
    if (sanitiseLabel) sanitiseLabel.textContent = typeLabel || 'Consult type';
    if (sanitiseHint) {
        if (visitConsultType === 'face_to_face' || isBedSanitised) {
            sanitiseHint.textContent = 'Face to face — room sanitised for this visit. Close the chart to end the visit.';
        } else if (visitConsultType === 'phone') {
            sanitiseHint.textContent = 'Phone consult — no sanitation note. Close the chart to end the visit.';
        } else if (visitConsultType === 'chart_review') {
            sanitiseHint.textContent = 'Chart review — no sanitation note. Close the chart to end the visit.';
        } else {
            sanitiseHint.textContent = 'Choose consult type (chart review, phone, or face to face) to unlock History, Lesions, Procedure, and Consent.';
        }
    }

    const historyBtn = document.getElementById('navTabHistory');
    const examBtn = document.getElementById('navTabSkinCheck');
    const procBtn = document.getElementById('navTabExcisionGen');
    const consentBtn = document.getElementById('navTabConsent');
    const adminBtn = document.getElementById('navTabManagement');
    const clinicalLocked = !unlocked;
    const setNav = (btn, workspace) => {
        if (!btn) return;
        btn.classList.toggle('is-active', tab === workspace);
        btn.classList.toggle('is-locked', workspace !== 'management' && clinicalLocked);
        btn.setAttribute('aria-selected', tab === workspace ? 'true' : 'false');
    };
    setNav(historyBtn, 'history');
    setNav(examBtn, 'skin-check');
    setNav(procBtn, 'excision-generator');
    setNav(consentBtn, 'consent');
    setNav(adminBtn, 'management');
    if (examBtn) examBtn.setAttribute('aria-expanded', 'true');

    document.querySelectorAll('#chartActionToolbar [data-rail]').forEach((el) => {
        el.classList.toggle('hidden', !patientOn || !railModeVisible(el.getAttribute('data-rail'), tab));
    });

    const recall = document.getElementById('headerRecallBadgeContainer');
    const accordion = document.getElementById('accordionHeaderControls');
    if (recall) recall.classList.toggle('hidden', !patientOn || tab !== 'history');
    if (accordion) accordion.classList.toggle('hidden', !patientOn || (tab !== 'history' && tab !== 'skin-check'));

    if (tab === 'excision-generator' && typeof renderProcedureWorkspace === 'function') renderProcedureWorkspace();
    if (typeof syncChartLesionWorkspace === 'function') syncChartLesionWorkspace();
}
