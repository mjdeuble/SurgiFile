/* Chart list width. The list stays visible; drag the splitter to resize. */

const CHART_TREE_WIDTH_KEY = 'dermrecord.chartTreeWidth';
const CHART_TREE_DEFAULT_WIDTH = 264;
const CHART_TREE_MIN_WIDTH = 192;
const CHART_TREE_MAX_WIDTH = 352;

let chartTreeWidthPx = CHART_TREE_DEFAULT_WIDTH;
let chartTreeLayoutBound = false;

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

function chartTreeLayoutState(input) {
    const visible = !!input.visible;
    const width = clampChartTreeWidth(input.width, input.viewportWidth);
    return {
        visible,
        showResize: visible,
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
    if (store) {
        try {
            width = parseStoredChartTreeWidth(store.getItem(CHART_TREE_WIDTH_KEY));
        } catch (err) {
            width = CHART_TREE_DEFAULT_WIDTH;
        }
    }
    return {
        width: clampChartTreeWidth(width, 1600)
    };
}

function writeChartTreeWidth(px, storage) {
    const store = storage || chartTreeStorage();
    if (!store) return;
    try {
        store.setItem(CHART_TREE_WIDTH_KEY, String(clampChartTreeWidth(px, 2400)));
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
        width: chartTreeWidthPx
    });
    chartTreeWidthPx = state.width;
    const shell = document.getElementById('appShell');
    if (shell) {
        shell.classList.remove('is-compact', 'is-tree-collapsed');
        shell.style.setProperty('--chart-tree-width', state.width + 'px');
    }
    const resize = document.getElementById('chartTreeResize');
    if (resize) {
        resize.classList.toggle('hidden', !state.showResize);
        resize.setAttribute('aria-valuenow', String(state.width));
    }
}

function onChartTreeViewportResize() {
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
    bindChartTreeResize();
    window.addEventListener('resize', onChartTreeViewportResize);
}

function initChartTreeLayout() {
    const prefs = readChartTreeLayoutPrefs();
    chartTreeWidthPx = prefs.width;
    bindChartTreeLayoutEvents();
    syncChartTreeLayout();
}

if (typeof window !== 'undefined') {
    window.syncChartTreeLayout = syncChartTreeLayout;
    window.initChartTreeLayout = initChartTreeLayout;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        CHART_TREE_DEFAULT_WIDTH,
        CHART_TREE_MIN_WIDTH,
        CHART_TREE_MAX_WIDTH,
        CHART_TREE_WIDTH_KEY,
        clampChartTreeWidth,
        parseStoredChartTreeWidth,
        chartTreeLayoutState,
        readChartTreeLayoutPrefs,
        writeChartTreeWidth
    };
}
