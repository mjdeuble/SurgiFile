/* Node checks: chart-list width stays visible and persists. */
const {
    CHART_TREE_DEFAULT_WIDTH,
    CHART_TREE_MIN_WIDTH,
    CHART_TREE_MAX_WIDTH,
    CHART_TREE_WIDTH_KEY,
    clampChartTreeWidth,
    parseStoredChartTreeWidth,
    chartTreeLayoutState,
    readChartTreeLayoutPrefs,
    writeChartTreeWidth
} = require('../js/chart-layout.js');

let failed = 0;
function eq(actual, expected, label) {
    if (!Object.is(actual, expected)) {
        failed += 1;
        console.error('FAIL', label, { actual, expected });
    } else {
        console.log('ok', label);
    }
}

eq(clampChartTreeWidth(264, 1600), CHART_TREE_DEFAULT_WIDTH, 'default width passes through');
eq(clampChartTreeWidth(80, 1600), CHART_TREE_MIN_WIDTH, 'width will not go below 12rem');
eq(clampChartTreeWidth(800, 1600), CHART_TREE_MAX_WIDTH, 'width will not go above 22rem');
eq(clampChartTreeWidth(300, 600), 240, 'width also caps at 40% of a narrow viewport');
eq(clampChartTreeWidth('nope', 1600), CHART_TREE_DEFAULT_WIDTH, 'invalid width falls back to default');

eq(parseStoredChartTreeWidth(null), CHART_TREE_DEFAULT_WIDTH, 'missing stored width uses default');
eq(parseStoredChartTreeWidth('280'), 280, 'stored width parses');
eq(parseStoredChartTreeWidth('abc'), CHART_TREE_DEFAULT_WIDTH, 'junk stored width uses default');

const wide = chartTreeLayoutState({
    visible: true,
    viewportWidth: 1400,
    width: 264
});
eq(wide.visible, true, 'wide: list stays visible');
eq(wide.showResize, true, 'wide: drag handle is available');
eq(wide.width, CHART_TREE_DEFAULT_WIDTH, 'wide: default width');

const snapped = chartTreeLayoutState({
    visible: true,
    viewportWidth: 960,
    width: 264
});
eq(snapped.visible, true, 'half-screen: list stays visible');
eq(snapped.showResize, true, 'half-screen: drag handle stays available');
eq(snapped.width, CHART_TREE_DEFAULT_WIDTH, 'half-screen: width is not tucked away');

const hidden = chartTreeLayoutState({
    visible: false,
    viewportWidth: 1400,
    width: 264
});
eq(hidden.showResize, false, 'no chart: handle hidden with the list');

const store = {
    data: {},
    getItem(key) { return Object.prototype.hasOwnProperty.call(this.data, key) ? this.data[key] : null; },
    setItem(key, value) { this.data[key] = String(value); }
};
writeChartTreeWidth(280, store);
eq(store.data[CHART_TREE_WIDTH_KEY], '280', 'width persists');
const prefs = readChartTreeLayoutPrefs(store);
eq(prefs.width, 280, 'prefs restore width');
eq(prefs.collapsed, undefined, 'collapse pref is gone');

if (failed) {
    console.error('\n' + failed + ' failing check(s)');
    process.exit(1);
}
console.log('\nall chart-tree layout checks passed');
