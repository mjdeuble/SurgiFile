/* Shared UI helpers: toasts, workspace tabs, accordions, clipboard */

function showToast(msg) {
    const toast = document.getElementById('toastNotification');
    const toastMsg = document.getElementById('toastMessage');
    if (!toast || !toastMsg) return;

    toastMsg.innerText = msg;
    toast.classList.remove('translate-y-20', 'opacity-0');
    toast.classList.add('translate-y-0', 'opacity-100');

    setTimeout(() => {
        toast.classList.remove('translate-y-0', 'opacity-100');
        toast.classList.add('translate-y-20', 'opacity-0');
    }, 3000);
}

function escapeHtml(str) {
    return String(str ?? '').replace(/[&<>"']/g, (ch) => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    }[ch]));
}

function isClinicalWorkspaceTab(tabName) {
    const tab = tabName || (typeof activeWorkspaceTab !== 'undefined' ? activeWorkspaceTab : '');
    return tab === 'history' || tab === 'skin-check' || tab === 'excision-generator' || tab === 'consent';
}

function switchWorkspaceTab(tabName, options) {
    if (typeof requireRoomReady === 'function' && !requireRoomReady(tabName)) return;

    if (tabName !== 'management' && tabName !== 'skin-check'
        && typeof inspectorToolMode === 'function' && inspectorToolMode()) {
        inspectorPaneMode = 'view';
    }

    activeWorkspaceTab = tabName;
    const viewSkinCheck = document.getElementById('view-skin-check');
    const viewExcisionGen = document.getElementById('view-excision-generator');
    const viewConsent = document.getElementById('view-consent');
    const viewManagement = document.getElementById('view-management');
    const examHistoryBlock = document.getElementById('examHistoryBlock');
    const examLesionsBlock = document.getElementById('examLesionsBlock');

    const btnHistory = document.getElementById('navTabHistory');
    const btnSkinCheck = document.getElementById('navTabSkinCheck');
    const btnExcisionGen = document.getElementById('navTabExcisionGen');
    const btnConsent = document.getElementById('navTabConsent');
    const btnManagement = document.getElementById('navTabManagement');

    const headerRecall = document.getElementById('headerRecallBadgeContainer');
    const accordionControls = document.getElementById('accordionHeaderControls');

    const setTab = (btn, on) => {
        if (!btn) return;
        btn.classList.toggle('is-active', on);
        btn.setAttribute('aria-selected', on ? 'true' : 'false');
    };
    setTab(btnHistory, tabName === 'history');
    setTab(btnSkinCheck, tabName === 'skin-check');
    setTab(btnExcisionGen, tabName === 'excision-generator');
    setTab(btnConsent, tabName === 'consent');
    setTab(btnManagement, tabName === 'management');

    const showExam = tabName === 'history' || tabName === 'skin-check';
    if (viewSkinCheck) viewSkinCheck.classList.toggle('hidden', !showExam);
    if (examHistoryBlock) examHistoryBlock.classList.toggle('hidden', tabName !== 'history');
    if (examLesionsBlock) examLesionsBlock.classList.toggle('hidden', tabName !== 'skin-check');
    if (viewExcisionGen) viewExcisionGen.classList.toggle('hidden', tabName !== 'excision-generator');
    if (viewConsent) viewConsent.classList.toggle('hidden', tabName !== 'consent');
    if (viewManagement) viewManagement.classList.toggle('hidden', tabName !== 'management');

    if (headerRecall) headerRecall.classList.toggle('hidden', tabName !== 'history');
    if (accordionControls) accordionControls.classList.toggle('hidden', tabName !== 'history' && tabName !== 'skin-check');

    if ((tabName === 'history' || tabName === 'skin-check') && typeof updateExamRequiredFields === 'function') {
        updateExamRequiredFields();
    }
    if (tabName === 'skin-check' && typeof setAccordionCollapsed === 'function') {
        setAccordionCollapsed('sec-lesions', false);
    }
    if (tabName === 'excision-generator') {
        updateExOutputVisibility();
        if (typeof procedureSession !== 'undefined' && procedureSession.started) {
            if (typeof applyProcedureComplicationFields === 'function') applyProcedureComplicationFields();
            if (typeof refreshProcedureCompleteOutputs === 'function') refreshProcedureCompleteOutputs();
        }
        if (typeof renderProcedureWorkspace === 'function') renderProcedureWorkspace();
    }
    if (tabName === 'consent' && typeof prepareExcisionConsentWorkspace === 'function') {
        prepareExcisionConsentWorkspace();
    }
    if (tabName === 'management') renderManagedLesions();
    if (typeof syncChartLesionWorkspace === 'function') syncChartLesionWorkspace();
    const sanitation = document.getElementById('sanitationModal');
    if (sanitation) sanitation.classList.add('hidden');
    if (typeof renderChartSidebar === 'function') renderChartSidebar();
    if (!options?.skipPersist && typeof scheduleChartSave === 'function') scheduleChartSave();
}

const HISTORY_ACCORDION_IDS = ['sec-metadata', 'sec-concerns', 'sec-risks'];
const LESION_ACCORDION_IDS = ['sec-lesions'];
const EXAM_ACCORDION_IDS = HISTORY_ACCORDION_IDS.concat(LESION_ACCORDION_IDS);

function currentExamAccordionIds() {
    const visit = typeof selectedVisitSection !== 'undefined' ? selectedVisitSection : '';
    if (visit === 'scope') return ['sec-metadata'];
    if (visit === 'concerns') return ['sec-concerns'];
    if (visit === 'risks') return ['sec-risks'];
    if (typeof activeWorkspaceTab !== 'undefined' && activeWorkspaceTab === 'history') return HISTORY_ACCORDION_IDS;
    if (typeof activeWorkspaceTab !== 'undefined' && activeWorkspaceTab === 'skin-check') return LESION_ACCORDION_IDS;
    return EXAM_ACCORDION_IDS;
}

function setAccordionCollapsed(id, collapsed) {
    const el = document.getElementById(id);
    const arrow = document.getElementById('arrow-' + id);
    if (!el) return;
    el.classList.toggle('hidden', !!collapsed);
    if (arrow) arrow.style.transform = collapsed ? 'rotate(-90deg)' : 'rotate(0deg)';
}

function isAccordionCollapsed(id) {
    const el = document.getElementById(id);
    return !el || el.classList.contains('hidden');
}

function toggleAccordion(id) {
    setAccordionCollapsed(id, !isAccordionCollapsed(id));
}

function expandAllAccordions() {
    currentExamAccordionIds().forEach((id) => setAccordionCollapsed(id, false));
}

function collapseAllAccordions() {
    currentExamAccordionIds().forEach((id) => setAccordionCollapsed(id, true));
}

function collapseExamSectionWhenComplete(id) {
    if (typeof applyingChartRecord !== 'undefined' && applyingChartRecord) return;
    setAccordionCollapsed(id, true);
}

function copyViaTextarea(text) {
    const tempArea = document.createElement('textarea');
    tempArea.value = text;
    tempArea.setAttribute('readonly', '');
    tempArea.style.position = 'fixed';
    tempArea.style.left = '-9999px';
    tempArea.style.top = '0';
    document.body.appendChild(tempArea);
    tempArea.focus();
    tempArea.select();
    try {
        tempArea.setSelectionRange(0, tempArea.value.length);
    } catch (err) {
        /* Selection range is best-effort. */
    }
    let successful = false;
    try {
        successful = document.execCommand('copy');
    } catch (err) {
        successful = false;
    }
    document.body.removeChild(tempArea);
    return successful;
}

let appBusy = {
    depth: 0,
    label: '',
    actionLabel: '',
    button: null,
    buttonText: '',
    frac: 0
};

function isAppBusy() {
    return appBusy.depth > 0 || (typeof vaultAuthBusy !== 'undefined' && vaultAuthBusy);
}

function paintAppBusy() {
    const overlay = document.getElementById('appBusyOverlay');
    const bar = document.getElementById('appBusyBar');
    const label = document.getElementById('appBusyLabel');
    const track = overlay ? overlay.querySelector('[role="progressbar"]') : null;
    const on = appBusy.depth > 0;
    if (overlay) {
        overlay.classList.toggle('hidden', !on);
        overlay.setAttribute('aria-hidden', on ? 'false' : 'true');
    }
    document.body.classList.toggle('is-app-busy', on);
    if (label) label.textContent = appBusy.label || 'Working…';
    if (bar) {
        if (appBusy.frac > 0) {
            bar.classList.remove('is-indeterminate');
            bar.style.width = Math.round(appBusy.frac * 100) + '%';
        } else {
            bar.classList.add('is-indeterminate');
            bar.style.width = '';
        }
    }
    if (track) {
        track.setAttribute('aria-valuenow', String(Math.round((appBusy.frac || 0) * 100)));
        track.setAttribute('aria-busy', on ? 'true' : 'false');
    }
}

function updateAppBusyProgress(label, fraction) {
    if (label) appBusy.label = String(label);
    if (fraction != null && Number.isFinite(Number(fraction))) {
        appBusy.frac = Math.max(0, Math.min(1, Number(fraction)));
    }
    paintAppBusy();
}

function beginAppBusy(label, options) {
    options = options || {};
    if (appBusy.depth > 0) {
        appBusy.depth += 1;
        if (label) updateAppBusyProgress(label);
        return false;
    }
    appBusy.depth = 1;
    appBusy.label = label || 'Working…';
    appBusy.actionLabel = appBusy.label;
    appBusy.frac = Number(options.fraction) || 0;
    const btn = options.button || null;
    appBusy.button = btn;
    appBusy.buttonText = btn ? String(btn.textContent || '') : '';
    if (btn) {
        btn.disabled = true;
        btn.setAttribute('aria-busy', 'true');
        if (options.buttonText) btn.textContent = options.buttonText;
    }
    paintAppBusy();
    return true;
}

function endAppBusy() {
    if (appBusy.depth <= 0) return;
    appBusy.depth -= 1;
    if (appBusy.depth > 0) return;
    const btn = appBusy.button;
    if (btn) {
        btn.disabled = false;
        btn.removeAttribute('aria-busy');
        if (appBusy.buttonText) btn.textContent = appBusy.buttonText;
    }
    appBusy.button = null;
    appBusy.buttonText = '';
    appBusy.label = '';
    appBusy.actionLabel = '';
    appBusy.frac = 0;
    paintAppBusy();
}

async function runBusyAction(label, work, options) {
    options = options || {};
    if (typeof vaultAuthBusy !== 'undefined' && vaultAuthBusy) {
        if (typeof showToast === 'function') showToast('Wait until sign-in finishes.');
        return;
    }
    if (appBusy.depth > 0 && !options.join) {
        if (typeof showToast === 'function') {
            showToast('Wait until ' + (appBusy.actionLabel || appBusy.label || 'the current action') + ' finishes.');
        }
        return;
    }
    beginAppBusy(label, options);
    try {
        return await work({
            progress: updateAppBusyProgress
        });
    } finally {
        endAppBusy();
    }
}

function copyTextToClipboard(text, successMsg, onSuccess) {
    if (!text) {
        showToast('No text available to copy.');
        return false;
    }

    const notifySuccess = () => {
        if (successMsg) showToast(successMsg);
        if (typeof onSuccess === 'function') onSuccess(text);
    };

    if (copyViaTextarea(text)) {
        notifySuccess();
        return true;
    }

    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(() => {
            notifySuccess();
        }).catch(() => {
            showToast('Copy failed. Please copy manually.');
        });
        return true;
    }

    showToast('Copy failed. Please copy manually.');
    return false;
}

