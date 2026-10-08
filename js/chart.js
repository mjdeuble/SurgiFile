/* Patient chart: BP-style text tree, consult-type gate, session toolbar, lesion inspector. */

let selectedChartLesionId = '';
let inspectorRenderedLesionId = '';
let inspectorRenderedMode = '';
let inspectorPaneMode = 'view';
let inspectorFormLesionId = '';
let manageLesionUiSource = 'modal';

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
    if (pendingVisitSection) {
        selectedVisitSection = pendingVisitSection;
        pendingVisitSection = '';
        if (typeof switchWorkspaceTab === 'function') switchWorkspaceTab('history', { skipPersist: true });
        if (typeof syncChartLesionWorkspace === 'function') syncChartLesionWorkspace();
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
let selectedVisitSection = '';
let pendingVisitSection = '';

function chartLesionInspectorVisible() {
    if (typeof hasCurrentPatient !== 'function' || !hasCurrentPatient()) return false;
    const tab = typeof activeWorkspaceTab !== 'undefined' ? activeWorkspaceTab : '';
    if (tab === 'history') return false;
    return tab === 'management' || tab === 'skin-check';
}

function selectChartVisitItem(section) {
    const key = section === 'scope' || section === 'concerns' || section === 'risks' ? section : 'all';
    pendingVisitSection = key;
    if (typeof requireRoomReady === 'function' && !requireRoomReady('history')) return;
    pendingVisitSection = '';
    selectedVisitSection = key;
    if (typeof switchWorkspaceTab === 'function') switchWorkspaceTab('history');
}

function syncChartVisitTreeStatus() {
    const unlocked = typeof visitClinicalUnlocked === 'function' ? visitClinicalUnlocked() : true;
    const pairs = [
        ['navVisitScope', typeof examMetadataSectionComplete === 'function' && examMetadataSectionComplete()],
        ['navVisitConcerns', typeof concernsSectionComplete === 'function' && concernsSectionComplete()],
        ['navVisitRisks', typeof screeningSectionComplete === 'function' && screeningSectionComplete()]
    ];
    pairs.forEach(([id, done]) => {
        const btn = document.getElementById(id);
        if (!btn) return;
        const key = id === 'navVisitScope' ? 'scope' : (id === 'navVisitConcerns' ? 'concerns' : 'risks');
        btn.classList.toggle('is-complete', !!done);
        btn.classList.toggle('is-incomplete', !done);
        btn.classList.toggle('is-selected', selectedVisitSection === key);
        btn.classList.toggle('is-locked', !unlocked);
        btn.setAttribute('aria-selected', selectedVisitSection === key ? 'true' : 'false');
    });
}

function applyVisitSectionVisibility() {
    const onHistory = (typeof activeWorkspaceTab !== 'undefined' ? activeWorkspaceTab : '') === 'history';
    const section = selectedVisitSection || '';
    const showAll = !onHistory || !section || section === 'all';
    const cards = {
        scope: document.getElementById('examCardMetadata'),
        concerns: document.getElementById('examCardConcerns'),
        risks: document.getElementById('examCardRisks')
    };
    Object.entries(cards).forEach(([key, el]) => {
        if (!el) return;
        el.classList.toggle('hidden', onHistory && !showAll && key !== section);
    });
    if (!onHistory) return;
    const openId = section === 'scope' ? 'sec-metadata'
        : (section === 'concerns' ? 'sec-concerns'
            : (section === 'risks' ? 'sec-risks' : ''));
    if (openId && typeof setAccordionCollapsed === 'function') setAccordionCollapsed(openId, false);
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
    const selected = inspectorPaneMode === 'form'
        ? !!(inspectorFormLesionId && id === String(inspectorFormLesionId))
        : (id && id === String(selectedChartLesionId) && !selectedVisitSection);
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
    selectedVisitSection = '';
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
    const addBtn = document.getElementById('btnTreeAddLesion');
    if (addBtn) addBtn.classList.toggle('is-selected', inspectorPaneMode === 'form' && !inspectorFormLesionId);
    renderChartTreeSavedDocs();
    syncChartVisitTreeStatus();
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

function inspectorLesionMode(lesion) {
    const done = !!(lesion && typeof lesionProcedureDone === 'function' && lesionProcedureDone(lesion));
    const unlocked = typeof visitClinicalUnlocked === 'function' ? visitClinicalUnlocked() : true;
    return (done ? 'done' : 'doc') + ':' + (unlocked ? 'open' : 'lock');
}

function paintInspectorCaption(lesion) {
    const cap = document.querySelector('#chartLesionInspector .chart-inspector-caption');
    if (!cap || !lesion) return;
    const status = typeof lesionStatusLabel === 'function' ? lesionStatusLabel(lesion) : (lesion.plan || '');
    const dx = typeof formatDiagnosisDisplay === 'function'
        ? formatDiagnosisDisplay(lesion.impression || '')
        : (lesion.impression || '');
    const h2 = cap.querySelector('h2');
    const p = cap.querySelector('p');
    if (h2) h2.textContent = lesion.location || 'No site';
    if (p) p.textContent = [dx, status].filter(Boolean).join(' · ');
}

function inspectorOpt(current, value) {
    return String(current || '') === String(value) ? ' selected' : '';
}

function inspectorChecked(current, value) {
    return String(current || '') === String(value) ? ' checked' : '';
}

function inspectorDocPlanValue(lesion) {
    const planElValue = String(lesion?.plan || '');
    if (typeof isPunchShaveBiopsyPlan === 'function' && isPunchShaveBiopsyPlan(planElValue)) {
        return typeof PUNCH_SHAVE_BIOPSY_PLAN === 'string' ? PUNCH_SHAVE_BIOPSY_PLAN : 'Punch / Shave Biopsy';
    }
    if (typeof isTopicalPlan === 'function' && isTopicalPlan(planElValue)) return 'Topical / Field Treatment';
    if (typeof isConfirmedHistologyExcisionPlan === 'function'
        && (isConfirmedHistologyExcisionPlan(planElValue)
            || (!lesion?.priorLesionId && typeof lesionHasCopiedPriorHistology === 'function' && lesionHasCopiedPriorHistology(lesion)))) {
        return typeof CONFIRMED_HISTOLOGY_EXCISION_PLAN === 'string'
            ? CONFIRMED_HISTOLOGY_EXCISION_PLAN
            : 'Histology already confirmed — book excision';
    }
    return planElValue || 'Awaiting Assessment';
}

function renderInspectorDocumentationForm(lesion, unlocked) {
    const plan = inspectorDocPlanValue(lesion);
    const biopsyType = lesion.biopsyType || 'Shave / Deep Saucerisation Biopsy';
    const punch = /punch/i.test(biopsyType);
    const closure = (typeof normalizeExcisionClosure === 'function' ? normalizeExcisionClosure(lesion) : '') || lesion.excisionClosureType || 'Ellipse';
    const discussed = Array.isArray(lesion.topicalDiscussed) ? lesion.topicalDiscussed : [];
    const disabled = unlocked ? '' : ' disabled';
    const lockHint = unlocked
        ? ''
        : '<p class="insp-warn">Choose consult type in the toolbar to edit examination details.</p>';
    const mm = (id, value, placeholder) => `<div class="mm-field">
        <input type="number" id="${id}" value="${escapeHtml(value || '')}" placeholder="${placeholder}" min="0" step="0.1" inputmode="decimal" class="insp-input"${disabled}>
        <span class="mm-unit">mm</span>
    </div>`;
    const isAdd = !String(lesion.id || '').trim();
    return `<section class="insp-card" id="inspDocCard">
        <div class="insp-card-head">${isAdd ? 'Add lesion' : 'Edit lesion'}</div>
        <div class="insp-card-body">
            ${lockHint}
            <input type="hidden" id="inspEditLesionId" value="${escapeHtml(String(lesion.id || ''))}">
            <div class="insp-grid">
                <div>
                    <label class="insp-label" for="inspLesionLocation">Anatomical location</label>
                    <input type="text" id="inspLesionLocation" class="insp-input" value="${escapeHtml(lesion.location || '')}" placeholder="e.g. Right cheek"${disabled}>
                </div>
                <div>
                    <label class="insp-label" for="inspLesionImpression">Provisional diagnosis</label>
                    <div class="dx-typeahead dx-typeahead-multi">
                        <div class="dx-chips"></div>
                        <input type="text" id="inspLesionImpression" class="insp-input" placeholder="Start typing to add one or more diagnoses"${disabled} autocomplete="off">
                        <div class="dx-suggest hidden" role="listbox"></div>
                        <input type="hidden" id="inspLesionImpressionCodes" value="${escapeHtml(lesion.impression || '')}">
                    </div>
                    <p class="insp-hint">Type to add each diagnosis. You can record more than one.</p>
                </div>
            </div>
            <div>
                <label class="insp-label" for="inspLesionMacroscopic">Macroscopic features</label>
                <input type="text" id="inspLesionMacroscopic" class="insp-input" value="${escapeHtml(lesion.macroscopic === 'Unspecified' ? '' : (lesion.macroscopic || ''))}" placeholder="e.g. 6mm erythematous pink nodule"${disabled}>
            </div>
            <div>
                <label class="insp-label" for="inspLesionDermoscopy">Dermoscopic features</label>
                <input type="text" id="inspLesionDermoscopy" class="insp-input" value="${escapeHtml(lesion.dermoscopy === 'Unspecified' ? '' : (lesion.dermoscopy || ''))}" placeholder="e.g. Arborising vessels, spoke-wheel areas"${disabled}>
            </div>
            <div>
                <label class="insp-label" for="inspLesionPlan">Management plan</label>
                <select id="inspLesionPlan" class="insp-select" onchange="handleInspectorPlanChange()"${disabled}>
                    <option value="Awaiting Assessment"${inspectorOpt(plan, 'Awaiting Assessment')}>Awaiting Assessment</option>
                    <option value="Monitor / Reassure (Benign)"${inspectorOpt(plan, 'Monitor / Reassure (Benign)')}>Monitor / Reassure (Benign)</option>
                    <option value="Punch / Shave Biopsy"${inspectorOpt(plan, 'Punch / Shave Biopsy')}>Punch / Shave Biopsy</option>
                    <option value="Formally Book Excision Procedure"${inspectorOpt(plan, 'Formally Book Excision Procedure')}>Formally Book Excision Procedure</option>
                    <option value="Histology already confirmed — book excision"${inspectorOpt(plan, 'Histology already confirmed — book excision')}>Histology already confirmed — book excision</option>
                    <option value="Topical / Field Treatment"${inspectorOpt(plan, 'Topical / Field Treatment')}>Topical / Field Treatment</option>
                    <option value="Refer / Specialist"${inspectorOpt(plan, 'Refer / Specialist')}>Refer / Specialist</option>
                </select>
            </div>
            <div id="inspPlanBiopsyFields" class="insp-sub hidden">
                <p class="insp-label" style="margin:0">Biopsy technique</p>
                <div class="insp-choice-row">
                    <label class="insp-choice"><input type="radio" name="inspBiopsyType" value="Shave / Deep Saucerisation Biopsy"${punch ? '' : ' checked'} onchange="handleInspectorBiopsyTypeChange()"${disabled}> Shave / deep saucerisation</label>
                    <label class="insp-choice"><input type="radio" name="inspBiopsyType" value="Punch Biopsy"${punch ? ' checked' : ''} onchange="handleInspectorBiopsyTypeChange()"${disabled}> Punch biopsy</label>
                </div>
                <div id="inspExamShaveMeasureFields" class="${punch ? 'hidden' : ''}">
                    <p class="insp-hint">Lesion size / margin (optional)</p>
                    <div class="insp-grid" style="grid-template-columns:1fr 1fr 1fr">
                        ${mm('inspExamLesionLength', lesion.length, 'Length')}
                        ${mm('inspExamLesionWidth', lesion.width, 'Width')}
                        ${mm('inspExamLesionMargin', lesion.margin, 'Margin')}
                    </div>
                    <button type="button" class="btn-margin-suggest-link" onclick="openMarginSuggestModal('inspExamLesionMargin')"${disabled}>Suggest margin</button>
                </div>
                <div id="inspExamPunchMeasureFields" class="${punch ? '' : 'hidden'}">
                    <label class="insp-label" for="inspExamPunchSize">Punch size</label>
                    ${mm('inspExamPunchSize', lesion.punchSize, 'e.g. 3')}
                </div>
            </div>
            <div id="inspPlanConfirmedHistoFields" class="insp-sub is-histo hidden">
                <p class="insp-label" style="margin:0">Previous biopsy / histology</p>
                <p class="insp-hint">Copy a prior result — old chart or a colleague’s biopsy. This is not billed here.</p>
                <div class="insp-grid">
                    <div>
                        <label class="insp-label" for="inspPriorHistologyDiagnosis">Confirmed diagnosis</label>
                        <div class="dx-typeahead">
                            <input type="text" id="inspPriorHistologyDiagnosis" class="insp-input" value="${escapeHtml(lesion.priorHistologyDiagnosis || '')}" placeholder="e.g. BCC"${disabled} autocomplete="off">
                            <div class="dx-suggest hidden" role="listbox"></div>
                        </div>
                    </div>
                    <div>
                        <label class="insp-label" for="inspPriorProcedureKind">Prior procedure</label>
                        <select id="inspPriorProcedureKind" class="insp-select"${disabled}>
                            <option value="">Unknown</option>
                            <option value="punch"${inspectorOpt(lesion.priorProcedureKind, 'punch')}>Punch biopsy</option>
                            <option value="shave"${inspectorOpt(lesion.priorProcedureKind, 'shave')}>Shave / saucerisation</option>
                            <option value="excision"${inspectorOpt(lesion.priorProcedureKind, 'excision')}>Excision</option>
                            <option value="incisional"${inspectorOpt(lesion.priorProcedureKind, 'incisional')}>Incisional biopsy</option>
                        </select>
                    </div>
                    <div>
                        <label class="insp-label" for="inspPriorProcedureDate">Date of biopsy</label>
                        <input type="date" id="inspPriorProcedureDate" class="insp-input" value="${escapeHtml(String(lesion.priorProcedureAt || '').slice(0, 10))}"${disabled}>
                    </div>
                    <div>
                        <label class="insp-label" for="inspPriorHistologySource">Source</label>
                        <select id="inspPriorHistologySource" class="insp-select" onchange="syncInspectorPriorHistoSource()"${disabled}>
                            <option value="own_notes"${inspectorOpt(lesion.priorHistologySource || 'own_notes', 'own_notes')}>Own previous notes / old chart</option>
                            <option value="colleague"${inspectorOpt(lesion.priorHistologySource, 'colleague')}>Colleague / another clinic</option>
                        </select>
                    </div>
                    <div id="inspPriorHistologySourceNameWrap" class="${lesion.priorHistologySource === 'colleague' ? '' : 'hidden'}" style="grid-column:1 / -1">
                        <label class="insp-label" for="inspPriorHistologySourceName">Colleague / clinic</label>
                        <input type="text" id="inspPriorHistologySourceName" class="insp-input" value="${escapeHtml(lesion.priorHistologySourceName || '')}"${disabled}>
                    </div>
                    <div>
                        <label class="insp-label" for="inspPriorHistologyCaseNumber">Lab case number</label>
                        <input type="text" id="inspPriorHistologyCaseNumber" class="insp-input" value="${escapeHtml(lesion.priorHistologyCaseNumber || '')}"${disabled}>
                    </div>
                    <div>
                        <label class="insp-label" for="inspPriorHistologyPot">Pot / specimen</label>
                        <input type="text" id="inspPriorHistologyPot" class="insp-input" value="${escapeHtml(lesion.priorHistologyPot || '')}"${disabled}>
                    </div>
                </div>
                <div>
                    <label class="insp-label" for="inspPriorHistologyResult">Result / report</label>
                    <textarea id="inspPriorHistologyResult" rows="3" class="insp-textarea"${disabled}>${escapeHtml(lesion.priorHistologyResult || '')}</textarea>
                </div>
            </div>
            <div id="inspPlanExcisionFields" class="insp-sub is-excision hidden">
                <p class="insp-label" style="margin:0">Excision you are organising</p>
                <div class="insp-grid">
                    <div>
                        <label class="insp-label" for="inspExcisionMargin">Planned surgical margin</label>
                        <div class="mm-field-row">
                            ${mm('inspExcisionMargin', lesion.excisionMarginMm || lesion.excisionMargin, 'e.g. 4')}
                            <button type="button" class="btn-margin-suggest" onclick="openMarginSuggestModal('inspExcisionMargin')"${disabled}>Suggest</button>
                        </div>
                    </div>
                    <div>
                        <label class="insp-label" for="inspExcisionReconstruction">Closure type</label>
                        <select id="inspExcisionReconstruction" class="insp-select" onchange="handleInspectorClosureChange()"${disabled}>
                            <option value="Ellipse"${inspectorOpt(closure, 'Ellipse')}>Simple ellipse</option>
                            <option value="Secondary Intention"${inspectorOpt(closure, 'Secondary Intention')}>Secondary intention</option>
                            <option value="Flap"${inspectorOpt(closure, 'Flap')}>Flap</option>
                            <option value="Graft"${inspectorOpt(closure, 'Graft')}>Graft</option>
                            <option value="Graft + Flap"${inspectorOpt(closure, 'Graft + Flap')}>Flap + Graft</option>
                        </select>
                    </div>
                </div>
                <div id="inspConsultExcisionGraftWrap" class="hidden">
                    <label class="insp-label" for="inspConsultExcisionGraftType">Graft type</label>
                    <select id="inspConsultExcisionGraftType" class="insp-select"${disabled}>
                        <option value="Full-Thickness Skin Graft (FTSG)"${inspectorOpt(lesion.graftType || lesion.billingGraftType, 'Full-Thickness Skin Graft (FTSG)')}>Full-thickness (FTSG)</option>
                        <option value="Split-Skin Graft (SSG)"${inspectorOpt(lesion.graftType || lesion.billingGraftType, 'Split-Skin Graft (SSG)')}>Split-skin (SSG)</option>
                    </select>
                </div>
            </div>
            <div id="inspPlanTopicalFields" class="insp-sub is-topical hidden">
                <p class="insp-label" style="margin:0">Topical / field treatment</p>
                <div class="insp-choice-list">
                    ${['cryotherapy|Cryotherapy', 'efudix|Efudix (5-fluorouracil)', 'efudix-calcipotriol|Efudix + Calcipotriol', 'aldara|Aldara (imiquimod)', 'pdt|Red Light PDT'].map((row) => {
                        const [value, label] = row.split('|');
                        return `<label class="insp-choice"><input type="checkbox" name="inspTopicalDiscussed" value="${value}"${discussed.includes(value) ? ' checked' : ''}${disabled}> ${label}</label>`;
                    }).join('')}
                </div>
                <p class="insp-label">Patient decision</p>
                <div class="insp-choice-row">
                    ${['cryotherapy|Cryotherapy', 'efudix|Efudix', 'efudix-calcipotriol|Efudix + Calcipotriol', 'aldara|Aldara', 'pdt|PDT', 'declined|Declined'].map((row) => {
                        const [value, label] = row.split('|');
                        return `<label class="insp-choice"><input type="radio" name="inspTopicalDecision" value="${value}"${inspectorChecked(lesion.topicalDecision, value)}${disabled}> ${label}</label>`;
                    }).join('')}
                </div>
                <div>
                    <label class="insp-label" for="inspTopicalFollowUp">Follow-up</label>
                    <select id="inspTopicalFollowUp" class="insp-select"${disabled}>
                        <option value="none"${inspectorOpt(lesion.topicalFollowUp || 'none', 'none')}>No scheduled follow-up</option>
                        <option value="2 weeks"${inspectorOpt(lesion.topicalFollowUp, '2 weeks')}>Review in 2 weeks</option>
                        <option value="4 weeks"${inspectorOpt(lesion.topicalFollowUp, '4 weeks')}>Review in 4 weeks</option>
                        <option value="8 weeks"${inspectorOpt(lesion.topicalFollowUp, '8 weeks')}>Review in 8 weeks</option>
                        <option value="3 months"${inspectorOpt(lesion.topicalFollowUp, '3 months')}>Review in 3 months</option>
                        <option value="6 months"${inspectorOpt(lesion.topicalFollowUp, '6 months')}>Review in 6 months</option>
                    </select>
                </div>
                <div>
                    <label class="insp-label" for="inspTopicalNotes">Notes</label>
                    <input type="text" id="inspTopicalNotes" class="insp-input" value="${escapeHtml(lesion.topicalNotes || '')}"${disabled}>
                </div>
            </div>
            <div class="insp-actions">
                <button type="button" onclick="cancelInspectorLesionForm()">Cancel</button>
                <button type="button" class="insp-save" id="btnSaveInspectorDoc" onclick="saveInspectorLesionDocumentation()"${disabled}>Save lesion</button>
            </div>
        </div>
    </section>`;
}

function renderInspectorPlanContactForm(lesion) {
    const alreadyNfa = typeof lesionAlreadyClinicallyFinalised === 'function'
        ? lesionAlreadyClinicallyFinalised(lesion)
        : (lesion?.resultPlan === 'no_followup' || lesion?.managementStatus === 'no_followup');
    const further = lesion?.resultPlan === 'further_management' || lesion?.resultPlan === 'plan_excision';
    const planVal = further ? 'further_management' : (alreadyNfa ? 'no_followup' : '');
    const proposed = String(lesion?.proposedPlan || '').trim();
    const contactVal = lesion?.contactState === 'advised_now' || lesion?.resultAdvisedAt
        ? 'advised_now'
        : (lesion?.contactState === 'appointment_requested' ? 'appointment_requested'
            : (lesion?.contactState === 'not_reached' ? 'not_reached' : 'mark_for_contact'));
    const events = lesion && typeof lesionTimelineNewestFirst === 'function' ? lesionTimelineNewestFirst(lesion) : [];
    const timeline = events.length
        ? `<div><p class="insp-label">Previous contact</p><ul class="lesion-timeline">${events.map(typeof formatTimelineEvent === 'function' ? formatTimelineEvent : (e) => `<li>${escapeHtml(e.note || '')}</li>`).join('')}</ul></div>`
        : '';
    return `<section class="insp-card" id="inspPlanContactCard">
        <div class="insp-card-head">Plan and contact</div>
        <div class="insp-card-body">
            <input type="hidden" id="inspManageLesionId" value="${escapeHtml(String(lesion.id || ''))}">
            <div>
                <p class="insp-label">Clinical plan</p>
                <div class="insp-choice-list">
                    <label class="insp-choice"><input type="radio" name="inspHistologyNext" value="no_followup"${inspectorChecked(planVal, 'no_followup')} onchange="onInspectorManagePlanChange()"> No further action</label>
                    <label class="insp-choice"><input type="radio" name="inspHistologyNext" value="further_management"${inspectorChecked(planVal, 'further_management')} onchange="onInspectorManagePlanChange()"> Needs further management</label>
                </div>
                <p id="inspManageLesionNfaHint" class="insp-hint${planVal === 'no_followup' ? '' : ' hidden'}">Confirming no further action clinically finalises this lesion. You can reopen it later if more treatment is needed.</p>
            </div>
            <div id="inspProposedPlanWrap" class="${further ? '' : 'hidden'} space-y-2">
                <p class="insp-label">Proposed plan <span style="font-weight:500;text-transform:none;letter-spacing:0">(optional)</span></p>
                <div class="insp-choice-row">
                    <label class="insp-choice"><input type="radio" name="inspHistologyProposedPlan" value=""${inspectorChecked(proposed, '') || !proposed ? ' checked' : ''}> Undecided</label>
                    <label class="insp-choice"><input type="radio" name="inspHistologyProposedPlan" value="topical"${inspectorChecked(proposed, 'topical')}> Topical / field</label>
                    <label class="insp-choice"><input type="radio" name="inspHistologyProposedPlan" value="excision"${inspectorChecked(proposed, 'excision')}> Excision</label>
                    <label class="insp-choice"><input type="radio" name="inspHistologyProposedPlan" value="biopsy"${inspectorChecked(proposed, 'biopsy')}> Biopsy</label>
                    <label class="insp-choice"><input type="radio" name="inspHistologyProposedPlan" value="monitor"${inspectorChecked(proposed, 'monitor')}> Monitor</label>
                    <label class="insp-choice"><input type="radio" name="inspHistologyProposedPlan" value="refer"${inspectorChecked(proposed, 'refer')}> Refer</label>
                </div>
                <div>
                    <label class="insp-label" for="inspHistologyProposedPlanNote">Note</label>
                    <input type="text" id="inspHistologyProposedPlanNote" class="insp-input" value="${escapeHtml(lesion.proposedPlanNote || '')}" placeholder="e.g. Efudix forehead · discuss with patient">
                </div>
            </div>
            <div>
                <p class="insp-label">Contact</p>
                <div class="insp-choice-list">
                    <label class="insp-choice"><input type="radio" name="inspHistologyContact" value="mark_for_contact"${inspectorChecked(contactVal, 'mark_for_contact')} onchange="syncInspectorFollowUpUi()"> Mark for contact</label>
                    <label class="insp-choice"><input type="radio" name="inspHistologyContact" value="advised_now"${inspectorChecked(contactVal, 'advised_now')} onchange="syncInspectorFollowUpUi()"> Advised now</label>
                    <label class="insp-choice"><input type="radio" name="inspHistologyContact" value="appointment_requested"${inspectorChecked(contactVal, 'appointment_requested')} onchange="syncInspectorFollowUpUi()"> Appointment requested — discuss result</label>
                    <label class="insp-choice"><input type="radio" name="inspHistologyContact" value="not_reached"${inspectorChecked(contactVal, 'not_reached')} onchange="syncInspectorFollowUpUi()"> Not reached</label>
                </div>
                <div>
                    <label class="insp-label" for="inspHistologyCallNote">Call / review note (optional)</label>
                    <textarea id="inspHistologyCallNote" rows="2" class="insp-textarea" placeholder="e.g. Morning review — desk to phone after 10">${escapeHtml(lesion.adminCallNote || '')}</textarea>
                </div>
            </div>
            ${timeline}
            <div class="insp-actions">
                <button type="button" class="insp-save" id="btnSaveInspectorManage" onclick="submitInspectorManageLesion()">Save plan and contact</button>
            </div>
        </div>
    </section>`;
}

function bindInspectorTypeaheads() {
    if (typeof bindDiagnosisTypeahead !== 'function') return;
    bindDiagnosisTypeahead('inspLesionImpression', {
        multi: true,
        hiddenId: 'inspLesionImpressionCodes',
        onChange: () => {
            if (typeof handleExamDiagnosisChange === 'function') handleExamDiagnosisChange();
        }
    });
    bindDiagnosisTypeahead('inspPriorHistologyDiagnosis', {
        onChange: (value) => {
            const existing = typeof readInspectorImpression === 'function' ? readInspectorImpression() : '';
            if (!existing && value && typeof setDiagnosisTypeahead === 'function') {
                setDiagnosisTypeahead('inspLesionImpression', value);
            }
        }
    });
    if (typeof setDiagnosisTypeahead === 'function') {
        const hidden = document.getElementById('inspLesionImpressionCodes');
        setDiagnosisTypeahead('inspLesionImpression', hidden?.value || '');
        const prior = document.getElementById('inspPriorHistologyDiagnosis');
        if (prior) setDiagnosisTypeahead('inspPriorHistologyDiagnosis', prior.value);
    }
}

function handleInspectorPlanChange() {
    const plan = document.getElementById('inspLesionPlan')?.value || '';
    const bFields = document.getElementById('inspPlanBiopsyFields');
    const eFields = document.getElementById('inspPlanExcisionFields');
    const tFields = document.getElementById('inspPlanTopicalFields');
    const hFields = document.getElementById('inspPlanConfirmedHistoFields');
    if (bFields) bFields.classList.add('hidden');
    if (eFields) eFields.classList.add('hidden');
    if (tFields) tFields.classList.add('hidden');
    if (hFields) hFields.classList.add('hidden');
    if (typeof isPunchShaveBiopsyPlan === 'function' && isPunchShaveBiopsyPlan(plan)) {
        if (bFields) bFields.classList.remove('hidden');
        handleInspectorBiopsyTypeChange();
    } else if (typeof isConfirmedHistologyExcisionPlan === 'function' && isConfirmedHistologyExcisionPlan(plan)) {
        if (hFields) hFields.classList.remove('hidden');
        if (eFields) eFields.classList.remove('hidden');
        syncInspectorPriorHistoSource();
        handleInspectorClosureChange();
    } else if (typeof isExcisionBookingPlan === 'function' && isExcisionBookingPlan(plan)) {
        if (eFields) eFields.classList.remove('hidden');
        handleInspectorClosureChange();
    } else if (typeof isTopicalPlan === 'function' && isTopicalPlan(plan)) {
        if (tFields) tFields.classList.remove('hidden');
    }
}

function handleInspectorBiopsyTypeChange() {
    let biopsyType = '';
    document.getElementsByName('inspBiopsyType').forEach((r) => { if (r.checked) biopsyType = r.value; });
    const isPunch = /punch/i.test(biopsyType);
    document.getElementById('inspExamShaveMeasureFields')?.classList.toggle('hidden', isPunch);
    document.getElementById('inspExamPunchMeasureFields')?.classList.toggle('hidden', !isPunch);
}

function handleInspectorClosureChange() {
    const closure = document.getElementById('inspExcisionReconstruction')?.value || '';
    const wrap = document.getElementById('inspConsultExcisionGraftWrap');
    if (wrap) wrap.classList.toggle('hidden', !(typeof closureNeedsGraftType === 'function' && closureNeedsGraftType(closure)));
}

function syncInspectorPriorHistoSource() {
    const source = document.getElementById('inspPriorHistologySource')?.value || '';
    document.getElementById('inspPriorHistologySourceNameWrap')?.classList.toggle('hidden', source !== 'colleague');
}

function syncInspectorFollowUpUi() {
    const plan = document.querySelector('input[name="inspHistologyNext"]:checked')?.value || '';
    const proposedWrap = document.getElementById('inspProposedPlanWrap');
    if (proposedWrap) proposedWrap.classList.toggle('hidden', plan !== 'further_management' && plan !== 'plan_excision');
    const nfaHint = document.getElementById('inspManageLesionNfaHint');
    if (nfaHint) nfaHint.classList.toggle('hidden', plan !== 'no_followup');
}

function onInspectorManagePlanChange() {
    manageLesionUiSource = 'inspector';
    const next = document.querySelector('input[name="inspHistologyNext"]:checked')?.value || '';
    const lesion = typeof histologyDraftLesion === 'function' ? histologyDraftLesion() : null;
    if (next === 'no_followup' && !manageLesionNfaConfirmed
        && !(typeof lesionAlreadyClinicallyFinalised === 'function' && lesionAlreadyClinicallyFinalised(lesion))) {
        const nfaEl = document.querySelector('input[name="inspHistologyNext"][value="no_followup"]');
        if (nfaEl) nfaEl.checked = false;
        const prev = manageLesionPrevPlan && manageLesionPrevPlan !== 'no_followup'
            ? document.querySelector('input[name="inspHistologyNext"][value="' + manageLesionPrevPlan + '"]')
            : null;
        if (prev) prev.checked = true;
        manageLesionPendingSave = true;
        if (typeof openManageLesionNfaConfirm === 'function') openManageLesionNfaConfirm();
        return;
    }
    if (next === 'further_management') manageLesionNfaConfirmed = false;
    if (next) manageLesionPrevPlan = next;
    syncInspectorFollowUpUi();
}

function readInspectorImpression() {
    if (typeof readDiagnosisTypeahead === 'function') return readDiagnosisTypeahead('inspLesionImpression');
    return document.getElementById('inspLesionImpression')?.value.trim() || '';
}

function collectInspectorCopiedPriorHistology() {
    const diagnosis = typeof readDiagnosisTypeahead === 'function'
        ? readDiagnosisTypeahead('inspPriorHistologyDiagnosis')
        : (document.getElementById('inspPriorHistologyDiagnosis')?.value.trim() || '');
    const result = document.getElementById('inspPriorHistologyResult')?.value.trim() || '';
    const caseNumber = typeof normalizeHistologyCaseNumber === 'function'
        ? normalizeHistologyCaseNumber(document.getElementById('inspPriorHistologyCaseNumber')?.value)
        : (document.getElementById('inspPriorHistologyCaseNumber')?.value.trim() || '');
    const pot = typeof normalizeHistologyPot === 'function'
        ? normalizeHistologyPot(document.getElementById('inspPriorHistologyPot')?.value)
        : (document.getElementById('inspPriorHistologyPot')?.value.trim() || '');
    return {
        priorHistologyDiagnosis: diagnosis,
        priorHistologyResult: result || diagnosis,
        priorHistologyCaseNumber: caseNumber,
        priorHistologyPot: pot,
        priorProcedureKind: document.getElementById('inspPriorProcedureKind')?.value || '',
        priorProcedureAt: document.getElementById('inspPriorProcedureDate')?.value || '',
        priorHistologySource: document.getElementById('inspPriorHistologySource')?.value || 'own_notes',
        priorHistologySourceName: document.getElementById('inspPriorHistologySourceName')?.value.trim() || '',
        priorBreslowMm: ''
    };
}

function readInspectorTopicalFields() {
    const discussed = [];
    document.querySelectorAll('input[name="inspTopicalDiscussed"]:checked').forEach((el) => discussed.push(el.value));
    const decision = document.querySelector('input[name="inspTopicalDecision"]:checked')?.value || '';
    const emptyCryo = typeof emptyCryoFields === 'function' ? emptyCryoFields() : {};
    return {
        topicalDiscussed: discussed,
        topicalDecision: decision,
        topicalNotes: document.getElementById('inspTopicalNotes')?.value.trim() || '',
        topicalFollowUp: document.getElementById('inspTopicalFollowUp')?.value || 'none',
        pdtRegions: [],
        pdtAreaId: '',
        pdtAreaName: '',
        pdtQuotedPrice: 0,
        ...emptyCryo
    };
}

function patchSessionAndManagedLesion(id, fields) {
    const apply = (arr) => {
        if (!Array.isArray(arr)) return;
        const idx = arr.findIndex((item) => String(item.id) === String(id));
        if (idx !== -1) arr[idx] = { ...arr[idx], ...fields, id: arr[idx].id };
    };
    if (typeof lesions !== 'undefined') apply(lesions);
    if (typeof managedLesions !== 'undefined') apply(managedLesions);
}

function saveInspectorLesionDocumentation() {
    if (typeof visitClinicalUnlocked === 'function' && !visitClinicalUnlocked()) {
        if (typeof pulseSanitiseControl === 'function') pulseSanitiseControl();
        if (typeof openConsultTypeModal === 'function') openConsultTypeModal();
        showToast('Choose consult type to document a lesion.');
        return;
    }
    if (typeof requireCurrentPatient === 'function' && !requireCurrentPatient('Select a patient so this lesion is saved to their chart.')) return;
    const loc = document.getElementById('inspLesionLocation')?.value.trim() || '';
    if (!loc) {
        showToast('Please enter an anatomical location for the lesion.');
        return;
    }
    const editId = document.getElementById('inspEditLesionId')?.value || '';
    const plan = document.getElementById('inspLesionPlan')?.value || '';
    let impression = readInspectorImpression();
    let copiedPrior = null;
    if (typeof isConfirmedHistologyExcisionPlan === 'function' && isConfirmedHistologyExcisionPlan(plan)) {
        copiedPrior = collectInspectorCopiedPriorHistology();
        if (!copiedPrior.priorHistologyDiagnosis && !copiedPrior.priorHistologyResult) {
            showToast('Enter the confirmed diagnosis or the prior histology result.');
            return;
        }
        if (!impression) impression = copiedPrior.priorHistologyDiagnosis || copiedPrior.priorHistologyResult;
    } else if (!impression) {
        showToast('Please choose or enter a diagnosis.');
        return;
    }
    const macroscopic = document.getElementById('inspLesionMacroscopic')?.value.trim() || 'Unspecified';
    const dermoscopy = document.getElementById('inspLesionDermoscopy')?.value.trim() || 'Unspecified';
    let biopsyType = '';
    let excisionMargin = '';
    let excisionReconstruction = '';
    let excisionClosureType = '';
    let graftType = '';
    let topicalFields = typeof emptyTopicalFields === 'function' ? emptyTopicalFields() : {};
    let length = '';
    let width = '';
    let margin = '';
    let punchSize = '';
    if (typeof isPunchShaveBiopsyPlan === 'function' && isPunchShaveBiopsyPlan(plan)) {
        document.getElementsByName('inspBiopsyType').forEach((r) => { if (r.checked) biopsyType = r.value; });
        if (biopsyType.includes('Punch')) {
            punchSize = document.getElementById('inspExamPunchSize')?.value.trim() || '';
        } else {
            length = typeof parseMarginMm === 'function'
                ? (parseMarginMm(document.getElementById('inspExamLesionLength')?.value) || document.getElementById('inspExamLesionLength')?.value.trim() || '')
                : (document.getElementById('inspExamLesionLength')?.value.trim() || '');
            width = typeof parseMarginMm === 'function'
                ? (parseMarginMm(document.getElementById('inspExamLesionWidth')?.value) || document.getElementById('inspExamLesionWidth')?.value.trim() || '')
                : (document.getElementById('inspExamLesionWidth')?.value.trim() || '');
            margin = typeof readMmInputValue === 'function'
                ? readMmInputValue('inspExamLesionMargin')
                : (document.getElementById('inspExamLesionMargin')?.value.trim() || '');
        }
        if (biopsyType.includes('Shave')) {
            const existingLesion = editId
                ? ((typeof lesions !== 'undefined' ? lesions : []).find((item) => String(item.id) === String(editId))
                    || (typeof chartLesions === 'function' ? chartLesions() : []).find((item) => String(item.id) === String(editId)))
                : null;
            const existingConsent = typeof lesionConsentStatus === 'function' ? lesionConsentStatus(existingLesion) : '';
            const alreadyConsented = existingConsent === 'verbal' || existingConsent === 'written';
            if (!alreadyConsented && pendingShaveConsentAction !== 'verbal' && pendingShaveConsentAction !== 'skip') {
                pendingLesionSaveSource = 'inspector';
                if (typeof openShaveConsentModal === 'function') openShaveConsentModal();
                return;
            }
        }
    } else if (typeof isExcisionBookingPlan === 'function' && isExcisionBookingPlan(plan)) {
        const excisionMarginNum = typeof readMmInputValue === 'function'
            ? readMmInputValue('inspExcisionMargin')
            : (document.getElementById('inspExcisionMargin')?.value.trim() || '');
        const excisionMeta = typeof plannedMarginFieldsFromNumber === 'function'
            ? plannedMarginFieldsFromNumber(excisionMarginNum, typeof suggestionMetaIfMatches === 'function' ? suggestionMetaIfMatches('inspExcisionMargin') : null)
            : { excisionMargin: excisionMarginNum, excisionMarginMm: excisionMarginNum };
        excisionMargin = excisionMeta.excisionMargin;
        excisionClosureType = document.getElementById('inspExcisionReconstruction')?.value || 'Ellipse';
        excisionReconstruction = typeof closureToReconstruction === 'function'
            ? closureToReconstruction(excisionClosureType)
            : excisionClosureType;
        graftType = document.getElementById('inspConsultExcisionGraftType')?.value || '';
        if (typeof closureNeedsGraftType === 'function' && !closureNeedsGraftType(excisionClosureType)) graftType = '';
    } else if (typeof isTopicalPlan === 'function' && isTopicalPlan(plan)) {
        topicalFields = readInspectorTopicalFields();
        if (!topicalFields.topicalDiscussed.length) {
            showToast('Select at least one treatment that was discussed.');
            return;
        }
        if (!topicalFields.topicalDecision) {
            showToast('Record the patient decision, or mark treatment as declined.');
            return;
        }
    }
    pendingLesionSaveSource = '';
    inspectorPaneMode = 'view';
    inspectorFormLesionId = editId || '';
    const patientSnap = typeof sessionPatientSnapshot === 'function' ? sessionPatientSnapshot() : null;
    const lesionRecord = {
        location: loc,
        impression,
        macroscopic,
        dermoscopy,
        plan,
        biopsyType,
        length,
        width,
        margin,
        punchSize,
        excisionMargin,
        excisionMarginMm: typeof parseMarginMm === 'function' ? parseMarginMm(excisionMargin) : excisionMargin,
        excisionReconstruction,
        excisionClosureType,
        graftType,
        billingGraftType: graftType,
        billingReconstruction: typeof isExcisionBookingPlan === 'function' && isExcisionBookingPlan(plan)
            && typeof inferBillingReconstruction === 'function'
            ? inferBillingReconstruction({ excisionReconstruction, excisionClosureType })
            : '',
        ...topicalFields,
        ...(copiedPrior || {}),
        ...(patientSnap || {})
    };
    if (typeof applyInferredBillingLesionType === 'function') applyInferredBillingLesionType(lesionRecord);
    else if (typeof inferBillingLesionType === 'function') lesionRecord.billingLesionType = inferBillingLesionType(lesionRecord);
    const suggestMeta = typeof suggestionMetaIfMatches === 'function'
        ? (suggestionMetaIfMatches('inspExcisionMargin') || suggestionMetaIfMatches('inspExamLesionMargin'))
        : null;
    if (suggestMeta) {
        lesionRecord.suggestedMarginMm = suggestMeta.suggestedMm || suggestMeta.mm || '';
        lesionRecord.marginSuggestionReason = suggestMeta.reason || '';
    }
    if (biopsyType.includes('Shave') && pendingShaveConsentAction === 'verbal') {
        const existingConsent = editId && typeof lesionConsentStatus === 'function'
            ? lesionConsentStatus((typeof lesions !== 'undefined' ? lesions : []).find((item) => String(item.id) === String(editId))
                || (typeof chartLesions === 'function' ? chartLesions() : []).find((item) => String(item.id) === String(editId)))
            : '';
        if (existingConsent !== 'written') {
            lesionRecord.consentStatus = 'verbal';
            lesionRecord.consentedAt = new Date().toISOString();
        }
        if (typeof shaveConsentVerified !== 'undefined') shaveConsentVerified = true;
    }
    pendingShaveConsentAction = '';
    if (typeof isPunchShaveBiopsyPlan === 'function' && isPunchShaveBiopsyPlan(plan)) {
        lesionRecord.type = biopsyType.includes('Punch') ? 'punch' : 'shave';
    } else if (typeof isExcisionBookingPlan === 'function' && isExcisionBookingPlan(plan)) {
        lesionRecord.type = 'excision';
        lesionRecord.managementStatus = 'planned_procedure';
        if (copiedPrior) lesionRecord.currentPlan = 'Excision planned after prior histology';
    } else if (typeof isTopicalPlan === 'function' && isTopicalPlan(plan)) {
        lesionRecord.type = 'topical';
    } else {
        lesionRecord.type = 'none';
    }
    if (typeof commitLesionRecordToSession === 'function') {
        return commitLesionRecordToSession(editId, lesionRecord, {
            button: document.getElementById('btnSaveInspectorDoc'),
            closeModal: false,
            forceInspector: true
        });
    }
}

async function submitInspectorManageLesion() {
    manageLesionUiSource = 'inspector';
    const id = document.getElementById('inspManageLesionId')?.value;
    const next = document.querySelector('input[name="inspHistologyNext"]:checked')?.value || '';
    const proposedPlan = document.querySelector('input[name="inspHistologyProposedPlan"]:checked')?.value || '';
    const proposedPlanNote = document.getElementById('inspHistologyProposedPlanNote')?.value.trim() || '';
    const contact = document.querySelector('input[name="inspHistologyContact"]:checked')?.value || 'mark_for_contact';
    const callNote = document.getElementById('inspHistologyCallNote')?.value.trim() || '';
    if (!id) return false;
    const lesion = (typeof managedLesions !== 'undefined' ? managedLesions : [])
        .find((item) => String(item.id) === String(id))
        || (typeof lesions !== 'undefined' ? lesions : []).find((item) => String(item.id) === String(id));
    if (!lesion) {
        showToast('Could not find that lesion.');
        return false;
    }
    const hasExistingResult = typeof lesionHasSavedHistology === 'function'
        ? lesionHasSavedHistology(lesion)
        : !!String(lesion?.histologyResult || '').trim();
    const procedureDone = typeof lesionProcedureDone === 'function' && lesionProcedureDone(lesion);
    if (next === 'no_followup' && !manageLesionNfaConfirmed
        && !(typeof lesionAlreadyClinicallyFinalised === 'function' && lesionAlreadyClinicallyFinalised(lesion))) {
        manageLesionPendingSave = true;
        if (typeof openManageLesionNfaConfirm === 'function') openManageLesionNfaConfirm();
        return false;
    }
    if (next === 'further_management' && !hasExistingResult && procedureDone) {
        showToast('Save a histology result before opening further management.');
        if (typeof openHistologyModal === 'function') openHistologyModal(id);
        return false;
    }
    const extras = {
        callNote,
        contact,
        fileNoCall: false,
        proposedPlan: (next === 'further_management' || next === 'plan_excision') ? proposedPlan : '',
        proposedPlanNote: (next === 'further_management' || next === 'plan_excision') ? proposedPlanNote : ''
    };
    const saveContactOnly = async () => {
        const fields = {
            contactState: contact,
            adminCallNote: callNote
        };
        if (contact === 'advised_now') fields.resultAdvisedAt = new Date().toISOString();
        if (next === 'further_management') {
            fields.resultPlan = 'further_management';
            fields.proposedPlan = proposedPlan;
            fields.proposedPlanNote = proposedPlanNote;
            const proposedLabel = typeof proposedPlanLabel === 'function' ? proposedPlanLabel(proposedPlan) : proposedPlan;
            fields.currentPlan = proposedPlanNote || proposedLabel || 'Needs further management';
            if (lesion.managementStatus === 'no_followup') {
                fields.managementStatus = 'awaiting_assessment';
                fields.clinicallyFinalisedAt = '';
            }
        } else if (contact === 'appointment_requested') {
            fields.managementStatus = 'appointment_requested';
            fields.currentPlan = 'Appointment requested — discuss result';
        } else if (lesion.managementStatus !== 'no_followup') {
            fields.managementStatus = 'needs_contact';
            fields.currentPlan = callNote || (contact === 'not_reached' ? 'Not reached' : 'Marked for contact');
        }
        if (typeof appendLesionTimeline === 'function') {
            appendLesionTimeline(lesion, {
                type: contact === 'advised_now' ? 'result_advised' : (contact === 'not_reached' ? 'call_attempt' : 'plan'),
                outcome: contact === 'not_reached' ? 'no answer' : '',
                note: callNote,
                planAfter: fields.currentPlan || lesion.currentPlan || ''
            });
            fields.timeline = lesion.timeline;
        }
        patchSessionAndManagedLesion(id, fields);
        const saved = (typeof managedLesions !== 'undefined' ? managedLesions : [])
            .find((item) => String(item.id) === String(id))
            || (typeof lesions !== 'undefined' ? lesions : []).find((item) => String(item.id) === String(id));
        if (saved && typeof persistSessionLesionToVault === 'function') {
            try { await persistSessionLesionToVault(saved); } catch (err) { /* session copy kept */ }
        } else if (saved && typeof saveManagedLesionRecord === 'function' && typeof isVaultLoggedIn === 'function' && isVaultLoggedIn()) {
            await saveManagedLesionRecord(saved, 'plan', callNote || fields.currentPlan || '');
        }
        showToast(next === 'further_management' ? 'Further management recorded on this lesion.' : 'Contact updated.');
        renderChartLesionInspector({ force: true });
        if (typeof renderChartLesionTree === 'function') renderChartLesionTree();
        return true;
    };
    const save = async ({ progress }) => {
        if (progress) progress('Saving lesion…', 0.25);
        if (next === 'no_followup' || (next === 'further_management' && hasExistingResult)) {
            if (typeof recordHistologyOutcome !== 'function') return false;
            if (typeof upsertManagedLesionMemory === 'function') upsertManagedLesionMemory(lesion);
            const saved = await recordHistologyOutcome(id, '', next, lesion?.billingLesionType || '', extras);
            const live = saved?.lesion || lesion;
            if (live) patchSessionAndManagedLesion(id, {
                resultPlan: live.resultPlan,
                contactState: live.contactState,
                adminCallNote: callNote,
                managementStatus: live.managementStatus,
                currentPlan: live.currentPlan,
                clinicallyFinalisedAt: live.clinicallyFinalisedAt,
                resultAdvisedAt: live.resultAdvisedAt,
                proposedPlan: live.proposedPlan,
                proposedPlanNote: live.proposedPlanNote,
                timeline: live.timeline
            });
            let message = 'Lesion updated.';
            if (next === 'further_management') message = 'Further management opened on a linked lesion.';
            else if (next === 'no_followup') {
                message = saved?.billingHold
                    ? 'Lesion clinically finalised. Unbilled items stay on Billing.'
                    : 'Lesion clinically finalised. No further action.';
            }
            showToast(message);
            if (saved?.openChildId) selectedChartLesionId = String(saved.openChildId);
            renderChartLesionInspector({ force: true });
            if (typeof renderChartLesionTree === 'function') renderChartLesionTree();
            return true;
        }
        return saveContactOnly();
    };
    if (typeof runBusyAction === 'function') {
        return runBusyAction('Saving lesion…', save, {
            button: document.getElementById('btnSaveInspectorManage'),
            buttonText: 'Saving…'
        });
    }
    return save({});
}

function openLesionInInspector(lesionId) {
    if (typeof visitClinicalUnlocked === 'function' && !visitClinicalUnlocked()) {
        pendingWorkspaceTab = 'skin-check';
        if (typeof pulseSanitiseControl === 'function') pulseSanitiseControl();
        if (typeof openConsultTypeModal === 'function') openConsultTypeModal();
        showToast('Choose consult type to document a lesion.');
        return;
    }
    inspectorPaneMode = 'form';
    inspectorFormLesionId = lesionId ? String(lesionId) : '';
    if (lesionId) selectedChartLesionId = String(lesionId);
    selectedVisitSection = '';
    if (typeof switchWorkspaceTab === 'function'
        && activeWorkspaceTab !== 'management'
        && activeWorkspaceTab !== 'skin-check') {
        switchWorkspaceTab('management', { skipPersist: true });
    }
    renderChartLesionInspector({ force: true });
    if (typeof renderChartLesionTree === 'function') renderChartLesionTree();
}

function cancelInspectorLesionForm() {
    inspectorPaneMode = 'view';
    inspectorFormLesionId = '';
    renderChartLesionInspector({ force: true });
    if (typeof renderChartLesionTree === 'function') renderChartLesionTree();
}

function editChartLesion(id) {
    openLesionInInspector(id);
}

function inspectorFormLesion() {
    const id = String(inspectorFormLesionId || '');
    if (!id) return {};
    const items = typeof chartLesions === 'function' ? chartLesions() : [];
    return items.find((item) => String(item.id) === id) || {};
}

function renderChartLesionInspector(options) {
    const pane = document.getElementById('chartLesionInspector');
    if (!pane) return;
    const show = chartLesionInspectorVisible();
    pane.classList.toggle('hidden', !show);
    if (!show) return;
    const force = !!(options && options.force);
    const unlocked = typeof visitClinicalUnlocked === 'function' ? visitClinicalUnlocked() : true;
    if (inspectorPaneMode === 'form') {
        const lesion = inspectorFormLesion();
        const formKey = 'form:' + (inspectorFormLesionId || 'new') + ':' + (unlocked ? 'open' : 'lock');
        if (!force && inspectorRenderedMode === formKey && pane.querySelector('[data-inspector-form]')) return;
        const title = inspectorFormLesionId ? (lesion.location || 'Edit lesion') : 'Add lesion';
        const sub = inspectorFormLesionId ? 'Update the examination details, then save.' : 'Document a new spot on this chart.';
        pane.innerHTML = `
            <div class="chart-inspector-caption">
                <h2>${escapeHtml(title)}</h2>
                <p>${escapeHtml(sub)}</p>
            </div>
            <div class="chart-inspector-body" data-inspector-form="1">
                ${renderInspectorDocumentationForm(lesion, unlocked)}
            </div>`;
        inspectorRenderedLesionId = inspectorFormLesionId || 'new';
        inspectorRenderedMode = formKey;
        bindInspectorTypeaheads();
        handleInspectorPlanChange();
        handleInspectorClosureChange();
        syncInspectorPriorHistoSource();
        return;
    }
    const lesion = ensureSelectedChartLesion();
    if (!lesion) {
        inspectorRenderedLesionId = '';
        inspectorRenderedMode = '';
        pane.innerHTML = '<div class="chart-inspector-empty">No lesions on this chart. Click Add lesion to document a spot.</div>';
        return;
    }
    const id = String(lesion.id || '');
    const mode = 'view:' + inspectorLesionMode(lesion);
    if (!force && inspectorRenderedLesionId === id && inspectorRenderedMode === mode && pane.querySelector('[data-inspector-view]')) {
        paintInspectorCaption(lesion);
        return;
    }
    const safeId = id.replace(/'/g, '');
    const status = typeof lesionStatusLabel === 'function' ? lesionStatusLabel(lesion) : (lesion.plan || '');
    const dx = typeof formatDiagnosisDisplay === 'function'
        ? formatDiagnosisDisplay(lesion.impression || '')
        : (lesion.impression || '');
    const dossier = typeof renderInspectorLesionDossier === 'function'
        ? renderInspectorLesionDossier(lesion)
        : '';
    const canResult = typeof canUpdateResult === 'function' && canUpdateResult(lesion);
    const refer = String(lesion.proposedPlan || '') === 'refer'
        || (typeof isReferLesionPlan === 'function' && isReferLesionPlan(lesion.plan));
    const pendingBill = typeof lesionIsClinicallyFinalised === 'function' && lesionIsClinicallyFinalised(lesion)
        && typeof lesionCanCloseNoFollowup === 'function' && !lesionCanCloseNoFollowup(lesion);
    const toolbar = [
        `<button type="button" onclick="editChartLesion('${safeId}')">Edit lesion</button>`,
        canResult ? `<button type="button" onclick="openHistologyModal('${safeId}')">${lesion.histologyResult ? 'Edit result' : 'Enter result'}</button>` : '',
        refer ? `<button type="button" onclick="openLetterModalForRefer('${safeId}')">Generate letter</button>` : ''
    ].filter(Boolean).join('');
    pane.innerHTML = `
        <div class="chart-inspector-caption">
            <h2>${escapeHtml(lesion.location || 'No site')}</h2>
            <p>${escapeHtml([dx, status].filter(Boolean).join(' · '))}</p>
        </div>
        ${toolbar ? `<div class="chart-inspector-toolbar">${toolbar}</div>` : ''}
        <div class="chart-inspector-body" data-inspector-view="1">
            ${pendingBill ? '<p class="insp-warn" style="margin-bottom:0.45rem">Clinically finalised · billing still pending</p>' : ''}
            ${lesion.currentPlan ? `<p class="insp-hint" style="margin-bottom:0.45rem"><strong>Plan:</strong> ${escapeHtml(lesion.currentPlan)}</p>` : ''}
            ${dossier}
            ${renderInspectorPlanContactForm(lesion)}
            ${typeof renderLesionActionLog === 'function' ? renderLesionActionLog(lesion) : ''}
        </div>`;
    inspectorRenderedLesionId = id;
    inspectorRenderedMode = mode;
    manageLesionPrevPlan = document.querySelector('input[name="inspHistologyNext"]:checked')?.value || '';
    manageLesionNfaConfirmed = manageLesionPrevPlan === 'no_followup';
    syncInspectorFollowUpUi();
}

function syncChartLesionWorkspace() {
    const open = typeof hasCurrentPatient === 'function' && hasCurrentPatient();
    const inspectorOn = chartLesionInspectorVisible();
    const shell = document.getElementById('appShell');
    if (shell) shell.classList.toggle('is-chart-open', !!open);
    document.body.classList.toggle('chart-open', !!open);
    renderChartLesionTree();
    renderChartLesionInspector();
    applyVisitSectionVisibility();
    syncChartVisitTreeStatus();
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
    openLesionInInspector(id);
}

function selectChartLesion(id, options) {
    inspectorPaneMode = 'view';
    inspectorFormLesionId = '';
    selectedChartLesionId = String(id || '');
    selectedVisitSection = '';
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
    if (adminBtn) {
        const visitOn = tab === 'history';
        adminBtn.classList.toggle('is-active', visitOn);
        adminBtn.setAttribute('aria-selected', visitOn ? 'true' : 'false');
    }
    if (examBtn) examBtn.setAttribute('aria-expanded', 'true');
    syncChartVisitTreeStatus();

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
