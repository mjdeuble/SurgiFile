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

function switchWorkspaceTab(tabName, options) {
    if (typeof requireRoomReady === 'function' && !requireRoomReady(tabName)) return;

    activeWorkspaceTab = tabName;
    const viewSkinCheck = document.getElementById('view-skin-check');
    const viewExcisionGen = document.getElementById('view-excision-generator');
    const viewManagement = document.getElementById('view-management');
    
    const btnSkinCheck = document.getElementById('navTabSkinCheck');
    const btnExcisionGen = document.getElementById('navTabExcisionGen');
    const btnManagement = document.getElementById('navTabManagement');

    const headerRecall = document.getElementById('headerRecallBadgeContainer');
    const accordionControls = document.getElementById('accordionHeaderControls');

    const setTab = (btn, on) => {
        if (!btn) return;
        btn.classList.toggle('is-active', on);
        btn.setAttribute('aria-selected', on ? 'true' : 'false');
    };
    setTab(btnSkinCheck, tabName === 'skin-check');
    setTab(btnExcisionGen, tabName === 'excision-generator');
    setTab(btnManagement, tabName === 'management');

    if (viewSkinCheck) viewSkinCheck.classList.toggle('hidden', tabName !== 'skin-check');
    if (viewExcisionGen) viewExcisionGen.classList.toggle('hidden', tabName !== 'excision-generator');
    if (viewManagement) viewManagement.classList.toggle('hidden', tabName !== 'management');

    if (headerRecall) headerRecall.classList.toggle('hidden', tabName !== 'skin-check');
    if (accordionControls) accordionControls.classList.toggle('hidden', tabName !== 'skin-check');

    if (tabName === 'skin-check' && typeof updateExamRequiredFields === 'function') {
        updateExamRequiredFields();
    }
    if (tabName === 'excision-generator') {
        updateExOutputVisibility();
        if (typeof renderProcedureWorkspace === 'function') renderProcedureWorkspace();
        if (!options?.skipCompleteModal && typeof procedureSession !== 'undefined' && procedureSession.started && typeof openProcedureCompleteModal === 'function') {
            openProcedureCompleteModal();
        }
    }
    if (tabName === 'management') renderManagedLesions();
    const sanitation = document.getElementById('sanitationModal');
    if (sanitation) sanitation.classList.add('hidden');
    if (typeof renderChartSidebar === 'function') renderChartSidebar();
    if (typeof closeLesionFlyout === 'function') closeLesionFlyout();
    if (!options?.skipPersist && typeof scheduleChartSave === 'function') scheduleChartSave();
}

const EXAM_ACCORDION_IDS = ['sec-metadata', 'sec-concerns', 'sec-risks', 'sec-lesions'];

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
    EXAM_ACCORDION_IDS.forEach((id) => setAccordionCollapsed(id, false));
}

function collapseAllAccordions() {
    EXAM_ACCORDION_IDS.forEach((id) => setAccordionCollapsed(id, true));
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

