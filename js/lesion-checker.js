/* Clinic settings: review lesions that other records place on a different chart. */

let lesionCheckerFindings = [];

function lesionCheckerLabel(identity) {
    if (!identity) return 'Unnamed patient';
    const name = typeof formatPatientSearchName === 'function'
        ? formatPatientSearchName(identity)
        : (identity.name || 'Unnamed patient');
    return identity.dob ? name + ' · DOB ' + identity.dob : name;
}

function lesionCheckerStatus(lesion) {
    if (!lesion) return '';
    if (typeof lesionStatusLabel === 'function') return lesionStatusLabel(lesion);
    return lesion.managementStatus || '';
}

async function loadLesionIdentityBackup() {
    if (typeof vaultRootHandle === 'undefined' || !vaultRootHandle) return [];
    if (typeof vaultAuth === 'undefined' || !vaultAuth.key || !vaultAuth.username) return [];
    if (typeof listLesionConversionBackupNames !== 'function' || typeof decryptJson !== 'function') return [];
    const names = await listLesionConversionBackupNames();
    if (!names.length) return [];
    const latest = names[names.length - 1];
    const backupsRoot = await vaultRootHandle.getDirectoryHandle('backups', { create: false });
    const runDir = await backupsRoot.getDirectoryHandle(latest, { create: false });
    const usersDir = await runDir.getDirectoryHandle('users', { create: false });
    const userDir = await usersDir.getDirectoryHandle(vaultAuth.username, { create: false });
    const lesionsDir = await userDir.getDirectoryHandle('lesions', { create: false });
    const copies = [];
    for await (const [name, handle] of lesionsDir.entries()) {
        if (handle.kind !== 'file' || !name.endsWith('.json.enc')) continue;
        try {
            const text = await handle.getFile().then((file) => file.text());
            const lesion = await decryptJson(vaultAuth.key, JSON.parse(text));
            if (!lesion?.id) continue;
            copies.push({
                id: lesion.id,
                patientName: lesion.patientName || '',
                patientDob: lesion.patientDob || '',
                chartId: lesion.chartId || ''
            });
        } catch (err) {
            console.warn('Skipped backup lesion', name);
        }
    }
    return copies;
}

function renderLesionCheckerResults() {
    const host = document.getElementById('lesionCheckerResults');
    if (!host) return;
    if (!lesionCheckerFindings.length) {
        host.innerHTML = '<p class="text-sm text-slate-500">No lesion looks misplaced from the notes, consents, bills, visit lists, and backup that were checked.</p>';
        return;
    }
    const count = lesionCheckerFindings.length;
    host.innerHTML = `<p class="text-[11px] font-semibold text-slate-500">${count} lesion${count === 1 ? '' : 's'} to check. Assign only when the suggested chart is the right patient.</p>`
        + lesionCheckerFindings.map((finding) => {
            const lesion = (typeof managedLesions !== 'undefined' ? managedLesions : [])
                .find((item) => String(item.id) === String(finding.lesionId));
            const site = finding.location || 'No site';
            const detail = [finding.impression, finding.caseNumber ? 'Case ' + finding.caseNumber : '', lesionCheckerStatus(lesion)]
                .filter(Boolean)
                .join(' · ');
            const buttons = (finding.suggestions || []).map((suggestion) => {
                const id = escapeHtml(String(finding.lesionId));
                const chartId = escapeHtml(String(suggestion.chartId));
                const why = (suggestion.reasons || []).join(' ');
                const shortName = typeof formatPatientSearchName === 'function'
                    ? formatPatientSearchName(suggestion)
                    : (suggestion.name || 'this chart');
                return `<div class="rounded-lg border border-emerald-200 bg-emerald-50/60 p-2.5 space-y-2">
                    <p class="text-[11px] text-slate-500">Suggested chart</p>
                    <p class="text-sm font-semibold text-slate-900">${escapeHtml(lesionCheckerLabel(suggestion))}</p>
                    <p class="text-[11px] text-slate-600">${escapeHtml(why)}</p>
                    <button type="button" class="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white text-[11px] font-bold rounded-lg cursor-pointer" data-assign-lesion="${id}" data-assign-chart="${chartId}">Assign to ${escapeHtml(shortName)}</button>
                </div>`;
            }).join('');
            return `<article class="rounded-xl border border-slate-200 bg-white p-3 space-y-2">
                <div>
                    <p class="text-sm font-semibold text-slate-900">${escapeHtml(site)}</p>
                    ${detail ? `<p class="text-[11px] text-slate-500">${escapeHtml(detail)}</p>` : ''}
                </div>
                <div>
                    <p class="text-[11px] text-slate-500">Current chart</p>
                    <p class="text-sm text-slate-800">${escapeHtml(lesionCheckerLabel(finding.current))}</p>
                </div>
                <div class="space-y-2">${buttons}</div>
            </article>`;
        }).join('');
}

async function reviewLesionChartsFromSettings() {
    if (typeof reviewLesionChartMismatches !== 'function') {
        showToast('Lesion checker is not available.');
        return;
    }
    const run = async ({ progress }) => {
        let priorCopies = [];
        let backupNote = '';
        if (progress) progress('Reading notes, bills, and any lesion backup…', 0.2);
        try {
            priorCopies = await loadLesionIdentityBackup();
        } catch (err) {
            backupNote = ' The lesion backup could not be read.';
            console.warn('Lesion backup was not reviewed', err);
        }
        if (progress) progress('Comparing lesions with the other records…', 0.7);
        lesionCheckerFindings = reviewLesionChartMismatches({
            lesions: typeof managedLesions !== 'undefined' ? managedLesions : [],
            charts: typeof managedCharts !== 'undefined' ? managedCharts : [],
            bills: typeof managedBillings !== 'undefined' ? managedBillings : [],
            notes: typeof managedVisitNotes !== 'undefined' ? managedVisitNotes : [],
            consents: typeof managedConsents !== 'undefined' ? managedConsents : [],
            priorCopies
        });
        renderLesionCheckerResults();
        if (progress) progress('Review finished', 1);
        const count = lesionCheckerFindings.length;
        showToast((count
            ? count + ' lesion' + (count === 1 ? '' : 's') + ' to check.'
            : 'No misplaced lesions found.') + backupNote);
    };
    if (typeof runBusyAction === 'function') {
        return runBusyAction('Reviewing lesions…', run, {
            button: document.getElementById('btnReviewLesionCharts'),
            buttonText: 'Reviewing…'
        });
    }
    return run({});
}

async function assignLesionChartFromChecker(lesionId, chartId) {
    const finding = lesionCheckerFindings.find((item) => String(item.lesionId) === String(lesionId));
    const suggestion = finding?.suggestions?.find((item) => String(item.chartId) === String(chartId));
    const lesion = (typeof managedLesions !== 'undefined' ? managedLesions : [])
        .find((item) => String(item.id) === String(lesionId));
    const chart = typeof findChartById === 'function'
        ? findChartById(chartId)
        : ((typeof managedCharts !== 'undefined' ? managedCharts : []).find((item) => item.id === chartId) || null);
    if (!finding || !suggestion || !lesion || !chart) {
        showToast('That suggestion is no longer available. Review the lesions again.');
        return;
    }
    const name = composePatientName(chart.firstName, chart.lastName, chart.name) || suggestion.name;
    lesion.chartId = chart.id;
    lesion.patientName = name;
    lesion.patientDob = chart.dob || suggestion.dob || lesion.patientDob || '';
    if (chart.phone) {
        lesion.phone = chart.phone;
        lesion.patientPhone = chart.phone;
    }
    if (typeof saveManagedLesionRecord === 'function') {
        await saveManagedLesionRecord(lesion, 'repair:chart', 'Assigned to ' + name + ' from the lesion checker', { silent: true });
    }
    const bills = (typeof managedBillings !== 'undefined' ? managedBillings : [])
        .filter((bill) => String(bill.lesionId) === String(lesion.id));
    for (const bill of bills) {
        bill.chartId = chart.id;
        bill.patientName = name;
        bill.patientDob = chart.dob || suggestion.dob || bill.patientDob || '';
        if (chart.phone) bill.patientPhone = chart.phone;
        if (typeof saveManagedBillingRecord === 'function') {
            await saveManagedBillingRecord(bill, 'repair:chart', 'Moved with the lesion to ' + name);
        }
    }
    lesionCheckerFindings = lesionCheckerFindings.filter((item) => String(item.lesionId) !== String(lesion.id));
    renderLesionCheckerResults();
    if (typeof renderManagedLesions === 'function') renderManagedLesions();
    if (typeof renderChartSidebar === 'function') renderChartSidebar();
    if (typeof renderChartLesionTree === 'function') renderChartLesionTree();
    showToast('Assigned ' + (lesion.location || 'lesion') + ' to ' + name + '.');
}

function bindLesionCheckerActions() {
    const host = document.getElementById('lesionCheckerResults');
    if (!host || host.dataset.checkerBound === '1') return;
    host.dataset.checkerBound = '1';
    host.addEventListener('click', (event) => {
        const btn = event.target.closest('[data-assign-lesion]');
        if (!btn || !host.contains(btn)) return;
        const lesionId = btn.getAttribute('data-assign-lesion') || '';
        const chartId = btn.getAttribute('data-assign-chart') || '';
        assignLesionChartFromChecker(lesionId, chartId).catch((err) => {
            showToast(err.message || 'Could not assign that lesion.');
        });
    });
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bindLesionCheckerActions);
else bindLesionCheckerActions();
