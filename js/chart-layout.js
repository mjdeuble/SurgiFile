/* Chart list width, collapse, and half-screen overlay (beside Best Practice). */

const CHART_TREE_WIDTH_KEY = 'dermrecord.chartTreeWidth';
const CHART_TREE_COLLAPSED_KEY = 'dermrecord.chartTreeCollapsed';
const CHART_TREE_DEFAULT_WIDTH = 264;
const CHART_TREE_MIN_WIDTH = 192;
const CHART_TREE_MAX_WIDTH = 352;
const CHART_COMPACT_MAX_WIDTH = 1100;

let chartTreeWidthPx = CHART_TREE_DEFAULT_WIDTH;
let chartTreeWideCollapsed = false;
let chartTreeCompactOpen = false;
let chartTreeLastCompact = null;
let chartTreeLayoutBound = false;

function chartLayoutIsCompact(viewportWidth) {
    return Number(viewportWidth) <= CHART_COMPACT_MAX_WIDTH;
}

function clampChartTreeWidth(px, viewportWidth) {
    const raw = Number(px);
    const value = Number.isFinite(raw) ? raw : CHART_TREE_DEFAULT_WIDTH;
    const view = Number(viewportWidth);
    const viewMax = Number.isFinite(view) && view > 0
        ? Math.floor(view * 0.4)
        : CHART_TREE_MAX_WIDTH;
    const max = Math.max(CHART_TREE_MIN_WIDTH, Math.min(CHART_TREE_MAX_WIDTH, viewMax));
    return Math.round(Math.min(max, Math.max(CHART_TREE_MIN_WIDTH, value)));
}

function parseStoredChartTreeWidth(raw) {
    if (raw == null || raw === '') return CHART_TREE_DEFAULT_WIDTH;
    const n = Number(raw);
    return Number.isFinite(n) ? n : CHART_TREE_DEFAULT_WIDTH;
}

function parseStoredChartTreeCollapsed(raw) {
    return raw === '1' || raw === 'true';
}

function chartTreeIsCollapsed(visible, compact, wideCollapsed, compactOpen) {
    if (!visible) return true;
    return compact ? !compactOpen : !!wideCollapsed;
}

function chartTreeLayoutState(input) {
    const visible = !!input.visible;
    const compact = chartLayoutIsCompact(input.viewportWidth);
    const collapsed = chartTreeIsCollapsed(visible, compact, input.wideCollapsed, input.compactOpen);
    const width = clampChartTreeWidth(input.width, input.viewportWidth);
    return {
        visible,
        compact,
        collapsed,
        showRail: visible && collapsed,
        showResize: visible && !compact && !collapsed,
        showBackdrop: visible && compact && !collapsed,
        width
    };
}

function chartTreeStorage() {
    try {
        return typeof localStorage !== 'undefined' ? localStorage : null;
    } catch (err) {
        return null;
    }
}

function readChartTreeLayoutPrefs(storage) {
    const store = storage || chartTreeStorage();
    let width = CHART_TREE_DEFAULT_WIDTH;
    let collapsed = false;
    if (store) {
        try {
            width = parseStoredChartTreeWidth(store.getItem(CHART_TREE_WIDTH_KEY));
            collapsed = parseStoredChartTreeCollapsed(store.getItem(CHART_TREE_COLLAPSED_KEY));
        } catch (err) {
            width = CHART_TREE_DEFAULT_WIDTH;
            collapsed = false;
        }
    }
    return {
        width: clampChartTreeWidth(width, 1600),
        collapsed
    };
}

function writeChartTreeWidth(px, storage) {
    const store = storage || chartTreeStorage();
    if (!store) return;
    try {
        store.setItem(CHART_TREE_WIDTH_KEY, String(clampChartTreeWidth(px, 2400)));
    } catch (err) { /* quota / private mode */ }
}

function writeChartTreeCollapsed(collapsed, storage) {
    const store = storage || chartTreeStorage();
    if (!store) return;
    try {
        store.setItem(CHART_TREE_COLLAPSED_KEY, collapsed ? '1' : '0');
    } catch (err) { /* quota / private mode */ }
}

function chartTreeNavVisible() {
    const tree = document.getElementById('chartLesionTree');
    return !!(tree && !tree.classList.contains('hidden'));
}

function syncChartTreeLayout() {
    const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 1400;
    const state = chartTreeLayoutState({
        visible: chartTreeNavVisible(),
        viewportWidth,
        width: chartTreeWidthPx,
        wideCollapsed: chartTreeWideCollapsed,
        compactOpen: chartTreeCompactOpen
    });
    chartTreeWidthPx = state.width;
    const shell = document.getElementById('appShell');
    if (shell) {
        shell.classList.toggle('is-compact', state.compact);
        shell.classList.toggle('is-tree-collapsed', state.collapsed);
        shell.style.setProperty('--chart-tree-width', state.width + 'px');
    }
    const resize = document.getElementById('chartTreeResize');
    const rail = document.getElementById('chartTreeRail');
    const backdrop = document.getElementById('chartTreeBackdrop');
    const collapseBtn = document.getElementById('btnCollapseChartTree');
    if (resize) {
        resize.classList.toggle('hidden', !state.showResize);
        resize.setAttribute('aria-valuenow', String(state.width));
    }
    if (rail) rail.classList.toggle('hidden', !state.showRail);
    if (backdrop) backdrop.classList.toggle('hidden', !state.showBackdrop);
    if (collapseBtn) {
        const label = state.compact ? 'Hide chart list' : 'Collapse chart list';
        collapseBtn.setAttribute('aria-expanded', state.collapsed ? 'false' : 'true');
        collapseBtn.setAttribute('aria-label', label);
        collapseBtn.title = label;
    }
}

function toggleChartTreeCollapsed() {
    if (typeof window !== 'undefined' && chartLayoutIsCompact(window.innerWidth)) {
        chartTreeCompactOpen = !chartTreeCompactOpen;
    } else {
        chartTreeWideCollapsed = !chartTreeWideCollapsed;
        writeChartTreeCollapsed(chartTreeWideCollapsed);
    }
    syncChartTreeLayout();
}

function collapseChartTree() {
    if (typeof window !== 'undefined' && chartLayoutIsCompact(window.innerWidth)) {
        chartTreeCompactOpen = false;
    } else {
        chartTreeWideCollapsed = true;
        writeChartTreeCollapsed(true);
    }
    syncChartTreeLayout();
}

function expandChartTree() {
    if (typeof window !== 'undefined' && chartLayoutIsCompact(window.innerWidth)) {
        chartTreeCompactOpen = true;
    } else {
        chartTreeWideCollapsed = false;
        writeChartTreeCollapsed(false);
    }
    syncChartTreeLayout();
}

function closeChartTreeOverlayIfCompact() {
    if (typeof window === 'undefined' || !chartLayoutIsCompact(window.innerWidth)) return;
    if (!chartTreeCompactOpen) return;
    chartTreeCompactOpen = false;
    syncChartTreeLayout();
}

function chartLayoutModalOpen() {
    return Array.from(document.querySelectorAll('[id$="Modal"]')).some((el) => !el.classList.contains('hidden'));
}

function onChartTreeNavClick(event) {
    const nav = event.target.closest('#chartLesionTree button.chart-tree-folder, #chartLesionTree button.chart-tree-node, #chartLesionTree button[role="treeitem"]');
    if (!nav || nav.id === 'btnCollapseChartTree') return;
    if (nav.classList.contains('chart-tree-group')) return;
    closeChartTreeOverlayIfCompact();
}

function onChartTreeViewportResize() {
    const compact = chartLayoutIsCompact(window.innerWidth);
    if (chartTreeLastCompact === false && compact) {
        chartTreeCompactOpen = false;
    }
    chartTreeLastCompact = compact;
    syncChartTreeLayout();
}

function onChartTreeEscape(event) {
    if (event.key !== 'Escape') return;
    if (!chartLayoutIsCompact(window.innerWidth) || !chartTreeCompactOpen) return;
    if (chartLayoutModalOpen()) return;
    event.preventDefault();
    chartTreeCompactOpen = false;
    syncChartTreeLayout();
}

function bindChartTreeResize() {
    const handle = document.getElementById('chartTreeResize');
    if (!handle || handle.dataset.bound === '1') return;
    handle.dataset.bound = '1';
    handle.addEventListener('pointerdown', (event) => {
        if (event.button != null && event.button !== 0) return;
        event.preventDefault();
        const startX = event.clientX;
        const startW = chartTreeWidthPx;
        handle.classList.add('is-dragging');
        document.body.classList.add('is-tree-resizing');
        if (handle.setPointerCapture) {
            try { handle.setPointerCapture(event.pointerId); } catch (err) { /* older engines */ }
        }
        const move = (ev) => {
            chartTreeWidthPx = clampChartTreeWidth(startW + (ev.clientX - startX), window.innerWidth);
            syncChartTreeLayout();
        };
        const up = () => {
            handle.classList.remove('is-dragging');
            document.body.classList.remove('is-tree-resizing');
            writeChartTreeWidth(chartTreeWidthPx);
            handle.removeEventListener('pointermove', move);
            handle.removeEventListener('pointerup', up);
            handle.removeEventListener('pointercancel', up);
        };
        handle.addEventListener('pointermove', move);
        handle.addEventListener('pointerup', up);
        handle.addEventListener('pointercancel', up);
    });
    handle.addEventListener('keydown', (event) => {
        if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
        event.preventDefault();
        const step = (event.shiftKey ? 64 : 16) * (event.key === 'ArrowRight' ? 1 : -1);
        chartTreeWidthPx = clampChartTreeWidth(chartTreeWidthPx + step, window.innerWidth);
        writeChartTreeWidth(chartTreeWidthPx);
        syncChartTreeLayout();
    });
}

function bindChartTreeLayoutEvents() {
    if (chartTreeLayoutBound) return;
    chartTreeLayoutBound = true;
    const tree = document.getElementById('chartLesionTree');
    if (tree) tree.addEventListener('click', onChartTreeNavClick);
    bindChartTreeResize();
    window.addEventListener('resize', onChartTreeViewportResize);
    document.addEventListener('keydown', onChartTreeEscape);
}

function initChartTreeLayout() {
    const prefs = readChartTreeLayoutPrefs();
    chartTreeWidthPx = prefs.width;
    chartTreeWideCollapsed = prefs.collapsed;
    chartTreeCompactOpen = false;
    chartTreeLastCompact = typeof window !== 'undefined'
        ? chartLayoutIsCompact(window.innerWidth)
        : false;
    bindChartTreeLayoutEvents();
    syncChartTreeLayout();
}

if (typeof window !== 'undefined') {
    window.toggleChartTreeCollapsed = toggleChartTreeCollapsed;
    window.collapseChartTree = collapseChartTree;
    window.expandChartTree = expandChartTree;
    window.syncChartTreeLayout = syncChartTreeLayout;
    window.initChartTreeLayout = initChartTreeLayout;
    window.closeChartTreeOverlayIfCompact = closeChartTreeOverlayIfCompact;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        CHART_TREE_DEFAULT_WIDTH,
        CHART_TREE_MIN_WIDTH,
        CHART_TREE_MAX_WIDTH,
        CHART_COMPACT_MAX_WIDTH,
        CHART_TREE_WIDTH_KEY,
        CHART_TREE_COLLAPSED_KEY,
        chartLayoutIsCompact,
        clampChartTreeWidth,
        parseStoredChartTreeWidth,
        parseStoredChartTreeCollapsed,
        chartTreeIsCollapsed,
        chartTreeLayoutState,
        readChartTreeLayoutPrefs,
        writeChartTreeWidth,
        writeChartTreeCollapsed
    };
}
