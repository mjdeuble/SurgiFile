/* Node checks: half-screen compact layout and chart-list width/collapse prefs. */
const {
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

eq(chartLayoutIsCompact(1100), true, '1100px is compact (half-screen / beside BP)');
eq(chartLayoutIsCompact(1101), false, '1101px stays wide two-pane');
eq(chartLayoutIsCompact(900), true, '900px snapped half of 1920 is compact');
eq(chartLayoutIsCompact(CHART_COMPACT_MAX_WIDTH), true, 'compact max is inclusive');

eq(clampChartTreeWidth(264, 1600), CHART_TREE_DEFAULT_WIDTH, 'default width passes through');
eq(clampChartTreeWidth(80, 1600), CHART_TREE_MIN_WIDTH, 'width will not go below 12rem');
eq(clampChartTreeWidth(800, 1600), CHART_TREE_MAX_WIDTH, 'width will not go above 22rem');
eq(clampChartTreeWidth(300, 600), 240, 'width also caps at 40% of a narrow viewport');
eq(clampChartTreeWidth('nope', 1600), CHART_TREE_DEFAULT_WIDTH, 'invalid width falls back to default');

eq(parseStoredChartTreeWidth(null), CHART_TREE_DEFAULT_WIDTH, 'missing stored width uses default');
eq(parseStoredChartTreeWidth('280'), 280, 'stored width parses');
eq(parseStoredChartTreeWidth('abc'), CHART_TREE_DEFAULT_WIDTH, 'junk stored width uses default');
eq(parseStoredChartTreeCollapsed('1'), true, 'stored collapsed 1 is true');
eq(parseStoredChartTreeCollapsed('0'), false, 'stored collapsed 0 is false');
eq(parseStoredChartTreeCollapsed('true'), true, 'stored collapsed true is true');

eq(chartTreeIsCollapsed(false, false, false, false), true, 'hidden nav counts as collapsed');
eq(chartTreeIsCollapsed(true, false, false, false), false, 'wide expanded stays open');
eq(chartTreeIsCollapsed(true, false, true, false), true, 'wide user collapse hides the list');
eq(chartTreeIsCollapsed(true, true, false, false), true, 'compact defaults to drawer closed');
eq(chartTreeIsCollapsed(true, true, true, true), false, 'compact drawer open even if wide pref is collapsed');

const wide = chartTreeLayoutState({
    visible: true,
    viewportWidth: 1400,
    width: 264,
    wideCollapsed: false,
    compactOpen: false
});
eq(wide.compact, false, 'wide state is not compact');
eq(wide.collapsed, false, 'wide default shows the list');
eq(wide.showResize, true, 'wide expanded shows the drag handle');
eq(wide.showRail, false, 'wide expanded hides the rail');
eq(wide.showBackdrop, false, 'wide never uses the overlay');

const snapped = chartTreeLayoutState({
    visible: true,
    viewportWidth: 960,
    width: 264,
    wideCollapsed: false,
    compactOpen: false
});
eq(snapped.compact, true, 'half-screen is compact');
eq(snapped.collapsed, true, 'snap tucks the list by default');
eq(snapped.showRail, true, 'compact closed shows the Chart rail');
eq(snapped.showResize, false, 'compact does not show the drag handle');
eq(snapped.showBackdrop, false, 'closed drawer has no backdrop');

const overlay = chartTreeLayoutState({
    visible: true,
    viewportWidth: 960,
    width: 264,
    wideCollapsed: false,
    compactOpen: true
});
eq(overlay.collapsed, false, 'compact open shows the list');
eq(overlay.showBackdrop, true, 'compact open uses a backdrop');
eq(overlay.showRail, false, 'compact open hides the rail');
eq(overlay.showResize, false, 'overlay does not show the drag handle');

const store = {
    data: {},
    getItem(key) { return Object.prototype.hasOwnProperty.call(this.data, key) ? this.data[key] : null; },
    setItem(key, value) { this.data[key] = String(value); }
};
writeChartTreeWidth(280, store);
writeChartTreeCollapsed(true, store);
eq(store.data[CHART_TREE_WIDTH_KEY], '280', 'width persists');
eq(store.data[CHART_TREE_COLLAPSED_KEY], '1', 'collapse persists');
const prefs = readChartTreeLayoutPrefs(store);
eq(prefs.width, 280, 'prefs restore width');
eq(prefs.collapsed, true, 'prefs restore collapse');

if (failed) {
    console.error('\n' + failed + ' failing check(s)');
    process.exit(1);
}
console.log('\nall chart-tree layout checks passed');
