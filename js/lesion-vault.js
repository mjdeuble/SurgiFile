/* Encrypted per-user lesion records and management-status transitions. */

const LESION_STATUSES = {
    awaiting_assessment: 'Awaiting Assessment',
    awaiting_biopsy: 'Awaiting Biopsy',
    awaiting_histology: 'Awaiting Histology',
    topical_followup: 'Topical Follow-up',
    planned_excision: 'Planned Excision',
    current_case: 'Current Case',
    no_followup: 'No Follow-up'
};

const ACTIVE_MANAGEMENT_STATUSES = [
    'awaiting_assessment',
    'awaiting_biopsy',
    'awaiting_histology',
    'topical_followup',
    'planned_excision',
    'current_case'
];

function newLesionId() {
    if (crypto.randomUUID) return crypto.randomUUID();
    return 'lesion-' + Date.now() + '-' + Math.random().toString(16).slice(2);
}

function isShaveBiopsyLesion(lesion) {
    if (!lesion) return false;
    if (String(lesion.biopsyType || '').includes('Shave')) return true;
    const procedure = String(lesion.procedureDetail?.procedure || lesion.procedure || '');
    return /^shave$/i.test(procedure);
}

function deriveLesionStatusFromPlan(record) {
    const plan = record.plan || '';
    if (plan.includes('Biopsy')) {
        return isShaveBiopsyLesion(record) ? 'awaiting_biopsy' : 'awaiting_histology';
    }
    if (plan.includes('Excision')) return 'planned_excision';
    if (isTopicalPlan(plan)) {
        if (record.topicalDecision === 'declined') return 'no_followup';
        if (record.topicalFollowUp && record.topicalFollowUp !== 'none') return 'topical_followup';
        return 'no_followup';
    }
    if (plan.includes('Monitor')) return 'no_followup';
    return 'awaiting_assessment';
}

function normalizeChartName(name) {
    return String(name || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function normalizeChartDob(dob) {
    return String(dob || '').trim().replace(/[^\d]/g, '');
}

function patientChartId(name, dob) {
    const n = normalizeChartName(name);
    const d = normalizeChartDob(dob);
    if (!n || !d) return '';
    return n + '|' + d;
}

function lesionChartId(lesion) {
    return lesion?.chartId || patientChartId(lesion?.patientName, lesion?.patientDob);
}

function hasCurrentPatient() {
    return !!(currentPatient && currentPatient.chartId);
}

function splitPatientName(full) {
    const raw = String(full || '').trim();
    if (!raw) return { firstName: '', lastName: '' };
    if (raw.includes(',')) {
        const bits = raw.split(',');
        return { lastName: (bits.shift() || '').trim(), firstName: bits.join(',').trim() };
    }
    const parts = raw.split(/\s+/).filter(Boolean);
    if (parts.length === 1) return { firstName: parts[0], lastName: '' };
    return { firstName: parts.slice(0, -1).join(' '), lastName: parts[parts.length - 1] };
}

function composePatientName(firstName, lastName, fallback) {
    const combined = [firstName, lastName].map((part) => String(part || '').trim()).filter(Boolean).join(' ');
    return combined || String(fallback || '').trim();
}

function normalizePhoneDigits(phone) {
    return String(phone || '').replace(/\D/g, '');
}

function patientIdentityFromRecord(source) {
    const firstName = String(source?.firstName || '').trim();
    const lastName = String(source?.lastName || '').trim();
    const name = composePatientName(firstName, lastName, source?.name || source?.patientName);
    const split = splitPatientName(name);
    return {
        name,
        firstName: firstName || split.firstName,
        lastName: lastName || split.lastName,
        dob: String(source?.dob || source?.patientDob || '').trim(),
        phone: String(source?.phone || source?.patientPhone || '').trim(),
        clinician: String(source?.clinician || '').trim(),
        chartId: source?.chartId || patientChartId(name, source?.dob || source?.patientDob)
    };
}

function sessionPatientSnapshot() {
    if (hasCurrentPatient()) {
        return {
            patientName: currentPatient.name,
            patientDob: currentPatient.dob,
            patientPhone: currentPatient.phone || '',
        clinician: (typeof loggedInDoctorName === 'function' && loggedInDoctorName()) || currentPatient.clinician || '',
            chartId: currentPatient.chartId
        };
    }
    const name = document.getElementById('mainPatientName')?.value.trim() || '';
    const dob = document.getElementById('mainPatientDOB')?.value.trim() || '';
    return {
        patientName: name,
        patientDob: dob,
        patientPhone: currentPatient.phone || '',
        clinician: (typeof loggedInDoctorName === 'function' && loggedInDoctorName()) || document.getElementById('mainDoctorName')?.value.trim() || '',
        chartId: patientChartId(name, dob)
    };
}

function lastChartStorageKey() {
    return 'dermrecord.lastChart.' + (vaultAuth.username || 'session');
}

function rememberLastPatient() {
    try {
        if (hasCurrentPatient()) {
            localStorage.setItem(lastChartStorageKey(), JSON.stringify({
                name: currentPatient.name,
                firstName: currentPatient.firstName || '',
                lastName: currentPatient.lastName || '',
                dob: currentPatient.dob,
                phone: currentPatient.phone || '',
                clinician: currentPatient.clinician || ''
            }));
        } else {
            localStorage.removeItem(lastChartStorageKey());
        }
    } catch (err) {
        /* Private mode may block storage. */
    }
}

function restoreLastPatient() {
    try {
        const raw = localStorage.getItem(lastChartStorageKey());
        if (!raw) return false;
        const saved = JSON.parse(raw);
        if (!saved?.name || !saved?.dob) return false;
        setCurrentPatient(patientIdentityFromRecord(saved), { silentRestore: true });
        return true;
    } catch (err) {
        return false;
    }
}

function applyCurrentPatientToForms() {
    const name = currentPatient.name || '';
    const dob = currentPatient.dob || '';
    const doctor = (typeof currentDoctorName === 'function' && currentDoctorName())
        || (typeof loggedInDoctorName === 'function' && loggedInDoctorName())
        || '';
    const nameEl = document.getElementById('mainPatientName');
    const dobEl = document.getElementById('mainPatientDOB');
    const docEl = document.getElementById('mainDoctorName');
    if (nameEl) nameEl.value = name;
    if (dobEl) dobEl.value = dob;
    if (docEl) docEl.value = doctor;
    const nameDisplay = document.getElementById('mainPatientNameDisplay');
    const dobDisplay = document.getElementById('mainPatientDobDisplay');
    const docDisplay = document.getElementById('mainDoctorNameDisplay');
    if (nameDisplay) nameDisplay.textContent = name || '—';
    if (dobDisplay) dobDisplay.textContent = dob || '—';
    if (docDisplay) docDisplay.textContent = doctor || '—';
    const consentNameDisplay = document.getElementById('consentPatientNameDisplay');
    const consentDobDisplay = document.getElementById('consentPatientDobDisplay');
    if (consentNameDisplay) consentNameDisplay.textContent = name || '—';
    if (consentDobDisplay) consentDobDisplay.textContent = dob || '—';
    if (typeof applyLoggedInDoctorToForms === 'function') applyLoggedInDoctorToForms();
    if (typeof syncPatientIdentifiers === 'function') syncPatientIdentifiers('main');
}

function updateHeaderPatient() {
    const nameEl = document.getElementById('headerPatientName');
    const dobEl = document.getElementById('headerPatientDob');
    if (nameEl) nameEl.textContent = hasCurrentPatient() ? currentPatient.name : 'No chart open';
    if (dobEl) {
        dobEl.textContent = hasCurrentPatient()
            ? [currentPatient.dob, currentPatient.phone, currentPatient.clinician].filter(Boolean).join(' · ')
            : 'Search the practice board to open a chart';
    }
    if (typeof renderChartSidebar === 'function') renderChartSidebar();
}

function knownPatientsFromLesions() {
    const map = new Map();
    managedLesions.forEach((lesion) => {
        const id = lesionChartId(lesion);
        if (!id || map.has(id)) return;
        map.set(id, patientIdentityFromRecord({
            chartId: id,
            name: lesion.patientName || '',
            dob: lesion.patientDob || '',
            phone: lesion.patientPhone || lesion.phone || '',
            clinician: lesion.clinician || ''
        }));
    });
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }));
}

function setCurrentPatient(patient, options) {
    const identity = patientIdentityFromRecord(patient);
    const name = identity.name;
    const dob = identity.dob;
    const clinician = (typeof loggedInDoctorName === 'function' && loggedInDoctorName()) || '';
    const chartId = identity.chartId || patientChartId(name, dob);
    const changed = chartId !== (currentPatient.chartId || '');
    currentPatient = {
        name,
        firstName: identity.firstName,
        lastName: identity.lastName,
        dob,
        phone: identity.phone,
        clinician,
        chartId
    };
    if (changed && !options?.silentRestore) {
        isBedSanitised = false;
        lesions = [];
        patientConcerns = [];
        noPatientConcerns = false;
        screeningMarkedComplete = false;
        selectedChartLesionId = '';
        if (typeof resetProcedureSession === 'function') resetProcedureSession();
        if (typeof renderLesionsTable === 'function') renderLesionsTable();
        if (typeof renderPatientConcerns === 'function') renderPatientConcerns();
        if (typeof updateOutput === 'function') updateOutput();
        if (activeWorkspaceTab === 'skin-check' || activeWorkspaceTab === 'excision-generator') {
            switchWorkspaceTab('management');
        }
    }
    applyCurrentPatientToForms();
    updateHeaderPatient();
    rememberLastPatient();
    if (typeof renderManagedLesions === 'function') renderManagedLesions();
    if (typeof renderChartSidebar === 'function') renderChartSidebar();
}

function clearCurrentPatient() {
    currentPatient = { name: '', firstName: '', lastName: '', dob: '', phone: '', clinician: '', chartId: '' };
    pendingWorkspaceTab = '';
    pendingSanitise = false;
    isBedSanitised = false;
    lesions = [];
    patientConcerns = [];
    noPatientConcerns = false;
    screeningMarkedComplete = false;
    selectedChartLesionId = '';
    updateHeaderPatient();
    rememberLastPatient();
    if (typeof renderManagedLesions === 'function') renderManagedLesions();
    if (typeof renderChartSidebar === 'function') renderChartSidebar();
}

function normalizeSearchQuery(query) {
    return String(query || '')
        .toLowerCase()
        .replace(/,/g, ' ')
        .replace(/[.'’]/g, '')
        .replace(/[^a-z0-9\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function formatPatientSearchName(patient) {
    const identity = patientIdentityFromRecord(patient);
    if (identity.lastName && identity.firstName) return identity.lastName + ', ' + identity.firstName;
    return identity.name || 'Unnamed patient';
}

function patientSearchHaystack(patient) {
    const identity = patientIdentityFromRecord(patient);
    const dobDigits = normalizeChartDob(identity.dob);
    const phoneDigits = normalizePhoneDigits(identity.phone);
    const first = identity.firstName.toLowerCase();
    const last = identity.lastName.toLowerCase();
    return [
        identity.name.toLowerCase(),
        first,
        last,
        [last, first].filter(Boolean).join(' '),
        [last, first].filter(Boolean).join(', '),
        [first, last].filter(Boolean).join(' '),
        String(identity.dob || '').toLowerCase(),
        dobDigits,
        String(identity.phone || '').toLowerCase(),
        phoneDigits
    ].filter(Boolean).map((value) => value.replace(/,/g, ' ').replace(/[.'’]/g, ''));
}

function patientMatchesQuery(patient, query) {
    const raw = normalizeSearchQuery(query);
    if (!raw) return false;
    const tokens = raw.split(/\s+/).filter(Boolean);
    const hay = patientSearchHaystack(patient);
    return tokens.every((token) => {
        const digits = token.replace(/\D/g, '');
        return hay.some((value) => {
            if (value.includes(token)) return true;
            return digits.length >= 2 && String(value).replace(/\D/g, '').includes(digits);
        });
    });
}

function searchPatientCharts(query) {
    const known = typeof knownPatientCharts === 'function' ? knownPatientCharts() : knownPatientsFromLesions();
    const q = normalizeSearchQuery(query);
    const firstToken = q.split(/\s+/)[0] || '';
    return known
        .filter((patient) => patientMatchesQuery(patient, q))
        .sort((a, b) => {
            const lastA = patientIdentityFromRecord(a).lastName.toLowerCase();
            const lastB = patientIdentityFromRecord(b).lastName.toLowerCase();
            const rank = (last) => {
                if (firstToken && last.startsWith(firstToken)) return 0;
                if (firstToken && last.includes(firstToken)) return 1;
                return 2;
            };
            const byLast = rank(lastA) - rank(lastB);
            if (byLast) return byLast;
            return formatPatientSearchName(a).localeCompare(formatPatientSearchName(b), 'en', { sensitivity: 'base' });
        })
        .slice(0, 8);
}

function hideChartSearchResults() {
    ['headerChartSearchResults', 'boardChartSearchResults'].forEach((id) => {
        const el = document.getElementById(id);
        if (!el) return;
        el.classList.add('hidden');
        el.innerHTML = '';
    });
    lastChartSearchHits = [];
    chartSearchActiveIndex = 0;
}

function renderChartSearchResults(rootId, query) {
    const root = document.getElementById(rootId);
    if (!root) return;
    const q = String(query || '').trim();
    if (!q) {
        root.classList.add('hidden');
        root.innerHTML = '';
        lastChartSearchHits = [];
        return;
    }
    lastChartSearchHits = searchPatientCharts(q);
    chartSearchActiveIndex = 0;
    if (!lastChartSearchHits.length) {
        root.innerHTML = '<p class="chart-search-empty">No matching chart. Use <strong>Add new patient</strong> if this is a first visit.</p>';
        root.classList.remove('hidden');
        return;
    }
    root.innerHTML = lastChartSearchHits.map((patient, idx) => `
        <button type="button" role="option" data-search-idx="${idx}" onclick="openPatientFromSearchIndex(${idx})" class="chart-search-hit ${idx === 0 ? 'is-active' : ''}">
            <span class="chart-search-hit-name">${escapeHtml(formatPatientSearchName(patient))}</span>
            <span class="chart-search-hit-meta">${escapeHtml([patient.dob, patient.phone].filter(Boolean).join(' · ') || 'No DOB or phone on file')}</span>
        </button>
    `).join('');
    root.classList.remove('hidden');
}

function highlightChartSearchHit() {
    document.querySelectorAll('.chart-search-hit').forEach((btn) => {
        const idx = Number(btn.getAttribute('data-search-idx'));
        btn.classList.toggle('is-active', idx === chartSearchActiveIndex);
    });
}

function onChartSearchInput(input, resultsId) {
    const other = resultsId === 'boardChartSearchResults' ? 'headerChartSearchResults' : 'boardChartSearchResults';
    const otherEl = document.getElementById(other);
    if (otherEl) {
        otherEl.classList.add('hidden');
        otherEl.innerHTML = '';
    }
    renderChartSearchResults(resultsId, input?.value || '');
}

function onChartSearchKeydown(event, resultsId) {
    if (event.key === 'Escape') {
        hideChartSearchResults();
        event.target.blur();
        return;
    }
    if (event.key === 'ArrowDown') {
        event.preventDefault();
        if (!lastChartSearchHits.length) return;
        chartSearchActiveIndex = (chartSearchActiveIndex + 1) % lastChartSearchHits.length;
        highlightChartSearchHit();
        return;
    }
    if (event.key === 'ArrowUp') {
        event.preventDefault();
        if (!lastChartSearchHits.length) return;
        chartSearchActiveIndex = (chartSearchActiveIndex - 1 + lastChartSearchHits.length) % lastChartSearchHits.length;
        highlightChartSearchHit();
        return;
    }
    if (event.key === 'Enter') {
        event.preventDefault();
        if (lastChartSearchHits.length) openPatientFromSearchIndex(chartSearchActiveIndex);
    }
}

async function openPatientFromSearchIndex(idx) {
    const patient = lastChartSearchHits[idx];
    if (!patient) return;
    hideChartSearchResults();
    const headerSearch = document.getElementById('headerChartSearch');
    const boardSearch = document.getElementById('boardChartSearch');
    if (headerSearch) headerSearch.value = '';
    if (boardSearch) boardSearch.value = '';
    if (typeof openPatientChart === 'function') await openPatientChart(patient);
    else setCurrentPatient(patient);
    if (pendingSanitise) {
        pendingSanitise = false;
        markChartSanitised();
        return;
    }
    if (pendingWorkspaceTab) {
        const tab = pendingWorkspaceTab;
        pendingWorkspaceTab = '';
        switchWorkspaceTab(tab);
    }
}

function focusPracticeBoardSearch() {
    if (typeof switchWorkspaceTab === 'function') switchWorkspaceTab('management');
    const input = document.getElementById('boardChartSearch') || document.getElementById('headerChartSearch');
    if (input) {
        input.focus();
        input.select();
    }
}

function renderKnownPatientList() {
    /* Opening charts is done from the practice-board search. */
}

function fillPatientModalFromKnown() {
    /* Replaced by searchable open-chart. */
}

function selectKnownPatientByIndex() {
    /* Replaced by searchable open-chart. */
}

async function openKnownPatientByIndex(idx) {
    const known = (typeof knownPatientCharts === 'function' ? knownPatientCharts() : knownPatientsFromLesions())[idx];
    if (!known) return;
    if (typeof openPatientChart === 'function') await openPatientChart(known);
    else setCurrentPatient(known);
}

function openAddPatientModal() {
    if (typeof loggedInDoctorName === 'function' && !loggedInDoctorName()) {
        showToast('Sign in with a user that has a full doctor name. Charts attach to that doctor automatically.');
        return;
    }
    const modal = document.getElementById('patientModal');
    const firstEl = document.getElementById('chartPatientFirstName');
    const lastEl = document.getElementById('chartPatientLastName');
    const dobEl = document.getElementById('chartPatientDob');
    const phoneEl = document.getElementById('chartPatientPhone');
    if (firstEl) firstEl.value = '';
    if (lastEl) lastEl.value = '';
    if (dobEl) dobEl.value = '';
    if (phoneEl) phoneEl.value = '';
    const addConsult = document.getElementById('chartPatientConsultBilling');
    const addBiopsy = document.getElementById('chartPatientBiopsyBilling');
    if (addConsult) addConsult.value = typeof DEFAULT_CONSULT_BILLING !== 'undefined' ? DEFAULT_CONSULT_BILLING : 'Private Bill';
    if (addBiopsy) addBiopsy.value = typeof DEFAULT_BIOPSY_BILLING !== 'undefined' ? DEFAULT_BIOPSY_BILLING : '$20 OOP per biopsy (Item 30071)';
    if (modal) modal.classList.remove('hidden');
    if (firstEl) firstEl.focus();
}

function openPatientModal(mode) {
    if (mode === 'add') {
        openAddPatientModal();
        return;
    }
    focusPracticeBoardSearch();
}

function closePatientModal() {
    const modal = document.getElementById('patientModal');
    if (modal) modal.classList.add('hidden');
}

async function submitAddPatientModal() {
    const firstName = document.getElementById('chartPatientFirstName')?.value.trim() || '';
    const lastName = document.getElementById('chartPatientLastName')?.value.trim() || '';
    const dob = document.getElementById('chartPatientDob')?.value.trim() || '';
    const phone = document.getElementById('chartPatientPhone')?.value.trim() || '';
    const clinician = (typeof loggedInDoctorName === 'function' && loggedInDoctorName()) || '';
    const name = composePatientName(firstName, lastName);
    if (!clinician) {
        showToast('Sign in with a user that has a full doctor name. Charts attach to that doctor automatically.');
        return;
    }
    if (!firstName || !lastName || !dob) {
        showToast('Enter first name, last name, and date of birth.');
        return;
    }
    if (normalizePhoneDigits(phone).length < 8) {
        showToast('Enter a phone number so reception can contact the patient.');
        return;
    }
    if (!patientChartId(name, dob)) {
        showToast('Date of birth needs digits so the chart can be identified.');
        return;
    }
    closePatientModal();
    const billing = typeof readAddPatientBilling === 'function'
        ? readAddPatientBilling()
        : { consultBilling: 'Private Bill', biopsyBilling: '$20 OOP per biopsy (Item 30071)' };
    const patient = { name, firstName, lastName, dob, phone, clinician, ...billing };
    if (typeof openPatientChart === 'function') {
        await openPatientChart(patient);
    } else {
        setCurrentPatient(patient);
        showToast('Chart set to ' + name + '.');
    }
    if (pendingSanitise) {
        pendingSanitise = false;
        markChartSanitised();
        return;
    }
    if (pendingWorkspaceTab) {
        const tab = pendingWorkspaceTab;
        pendingWorkspaceTab = '';
        switchWorkspaceTab(tab);
    }
}

async function submitPatientModal() {
    await submitAddPatientModal();
}

function requireCurrentPatient(message) {
    if (hasCurrentPatient()) return true;
    showToast(message || 'Search for a patient on the practice board, or add a new patient.');
    focusPracticeBoardSearch();
    return false;
}

function appendLesionHistory(lesion, action, note) {
    if (!Array.isArray(lesion.history)) lesion.history = [];
    lesion.history.push({
        at: new Date().toISOString(),
        action,
        note: note || '',
        by: vaultAuth.username || ''
    });
    if (lesion.history.length > 40) lesion.history = lesion.history.slice(-40);
}

async function writeManagedLesion(lesion) {
    upsertManagedLesionMemory(lesion);
    if (!isVaultLoggedIn()) return;
    const dir = await getUserLesionsDir(vaultAuth.username, true);
    const payload = await encryptJson(vaultAuth.key, lesion);
    await writeTextFile(dir, lesion.id + '.json.enc', JSON.stringify(payload));
}

async function deleteManagedLesionFile(id) {
    if (!isVaultLoggedIn()) return;
    try {
        const dir = await getUserLesionsDir(vaultAuth.username, false);
        await dir.removeEntry(id + '.json.enc');
    } catch (err) {
        /* File may not exist yet. */
    }
}

async function loadManagedLesionsFromVault() {
    managedLesions = [];
    if (!isVaultLoggedIn()) return;
    const dir = await getUserLesionsDir(vaultAuth.username, true);
    for await (const [name, handle] of dir.entries()) {
        if (handle.kind !== 'file' || !name.endsWith('.json.enc')) continue;
        try {
            const text = await handle.getFile().then((f) => f.text());
            const lesion = await decryptJson(vaultAuth.key, JSON.parse(text));
            if (lesion && lesion.id) managedLesions.push(lesion);
        } catch (err) {
            console.warn('Skipped unreadable lesion file', name);
        }
    }
    managedLesions.sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));
    if (typeof loadManagedChartsFromVault === 'function') {
        await loadManagedChartsFromVault();
    }
    if (typeof loadManagedVisitNotesFromVault === 'function') {
        await loadManagedVisitNotesFromVault();
    }
    if (typeof loadManagedBillingsFromVault === 'function') {
        await loadManagedBillingsFromVault();
    }
    if (typeof migrateEmbeddedBillingFromLesions === 'function') {
        await migrateEmbeddedBillingFromLesions();
    }
}

function upsertManagedLesionMemory(lesion) {
    const idx = managedLesions.findIndex((item) => item.id === lesion.id);
    if (idx === -1) managedLesions.unshift(lesion);
    else managedLesions[idx] = lesion;
}

async function persistSessionLesionToVault(sessionLesion) {
    if (!isVaultLoggedIn()) return null;
    const existing = managedLesions.find((item) => item.id === sessionLesion.id) || {};
    const now = new Date().toISOString();
    const patient = sessionPatientSnapshot();
    const next = {
        ...existing,
        ...sessionLesion,
        ...patient,
        id: sessionLesion.id,
        createdAt: existing.createdAt || now,
        updatedAt: now,
        owner: vaultAuth.username,
        managementStatus: (!existing.managementStatus || existing.managementStatus === 'awaiting_assessment')
            ? deriveLesionStatusFromPlan(sessionLesion)
            : existing.managementStatus,
        billingStatus: existing.billingStatus || 'none',
        history: existing.history || []
    };
    if (isShaveBiopsyLesion(sessionLesion) && !existing.procedureCompletedAt && !sessionLesion.procedureCompletedAt) {
        if (!existing.managementStatus || ['awaiting_assessment', 'awaiting_histology', 'awaiting_biopsy'].includes(existing.managementStatus)) {
            next.managementStatus = 'awaiting_biopsy';
        }
    }
    if (isTopicalPlan(sessionLesion.plan)) {
        next.topicalFollowUp = sessionLesion.topicalFollowUp || 'none';
        if (!existing.managementStatus || ['awaiting_assessment', 'topical_followup', 'no_followup'].includes(existing.managementStatus)) {
            next.managementStatus = deriveLesionStatusFromPlan(next);
        }
    }
    if (!existing.id) appendLesionHistory(next, 'created', sessionLesion.plan || '');
    else appendLesionHistory(next, 'updated', sessionLesion.plan || '');
    await writeManagedLesion(next);
    upsertManagedLesionMemory(next);
    if (typeof offerLesionToProcedureSession === 'function') offerLesionToProcedureSession(next);
    renderManagedLesions();
    if (typeof renderChartSidebar === 'function') renderChartSidebar();
    return next;
}

async function saveManagedLesionRecord(lesion, action, note, options) {
    lesion.updatedAt = new Date().toISOString();
    appendLesionHistory(lesion, action, note);
    await writeManagedLesion(lesion);
    upsertManagedLesionMemory(lesion);
    if (!options?.silent) {
        renderManagedLesions();
        updateCurrentCaseBanner();
        if (typeof renderChartSidebar === 'function') renderChartSidebar();
    }
}

async function setManagedLesionStatus(id, status, note) {
    const lesion = managedLesions.find((item) => item.id === id);
    if (!lesion) return;
    if (status === 'current_case') {
        for (const item of managedLesions) {
            if (item.id !== id && item.managementStatus === 'current_case') {
                item.managementStatus = 'planned_excision';
                appendLesionHistory(item, 'status:planned_excision', 'Replaced as current case');
                item.updatedAt = new Date().toISOString();
                await writeManagedLesion(item);
            }
        }
        currentManagedCaseId = id;
    }
    if (status === 'no_followup') {
        lesion.billingStatus = lesion.billingStatus || 'none';
    }
    if (status === 'planned_excision' || status === 'no_followup') {
        if (lesion.managementStatus === 'awaiting_histology' && typeof isLesionBillingProcessed === 'function' && !isLesionBillingProcessed(id)) {
            showToast('Process billing for this lesion before choosing management.');
            return;
        }
    }
    lesion.managementStatus = status;
    await saveManagedLesionRecord(lesion, 'status:' + status, note || LESION_STATUSES[status] || status);
}

async function recordHistologyOutcome(id, resultText, nextAction, billingType, extras) {
    const lesion = managedLesions.find((item) => item.id === id);
    if (!lesion) return;
    extras = extras || {};
    lesion.histologyResult = resultText;
    lesion.histologyAt = new Date().toISOString();
    if (billingType) lesion.billingLesionType = billingType;
    if (extras.callNote) lesion.adminCallNote = extras.callNote;
    if (extras.advised) lesion.resultAdvisedAt = new Date().toISOString();
    if (typeof syncBillingFromLesion === 'function') {
        await syncBillingFromLesion(lesion);
    }
    const note = extras.callNote ? resultText + ' · ' + extras.callNote : resultText;
    if (nextAction === 'plan_excision' || nextAction === 'no_followup') {
        await setManagedLesionStatus(id, nextAction === 'plan_excision' ? 'planned_excision' : 'no_followup', note);
        return;
    }
    if (lesion.managementStatus !== 'awaiting_histology') {
        lesion.managementStatus = 'awaiting_histology';
    }
    await saveManagedLesionRecord(lesion, 'histology', note);
}

async function markBillingProcessed(ids) {
    if (typeof markBillingsAsProcessed === 'function') {
        await markBillingsAsProcessed(ids);
        return;
    }
    for (const id of ids) {
        if (typeof confirmBillingCodes === 'function') await confirmBillingCodes(id);
    }
}
