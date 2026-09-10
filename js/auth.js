/* Per-user login. Password never leaves memory; it only derives the AES key. */

let vaultAuth = {
    username: '',
    key: null,
    displayName: ''
};

function sanitizeUsername(name) {
    return String(name || '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9_-]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 40);
}

function isVaultLoggedIn() {
    return !!(vaultAuth.username && vaultAuth.key);
}

function loggedInDoctorName() {
    return String(vaultAuth.displayName || '').trim();
}

function currentDoctorName() {
    return loggedInDoctorName();
}

function applyLoggedInDoctorToForms() {
    const name = loggedInDoctorName();
    ['mainDoctorName', 'consentDoctorName'].forEach((id) => {
        const el = document.getElementById(id);
        if (!el) return;
        el.value = name;
        el.readOnly = true;
    });
    ['mainDoctorNameDisplay', 'consentDoctorNameDisplay'].forEach((id) => {
        const el = document.getElementById(id);
        if (el) el.textContent = name || '—';
    });
}

async function saveVaultDisplayName(displayName) {
    const name = String(displayName || '').trim();
    if (!name) throw new Error('Enter your full doctor name.');
    if (!isVaultLoggedIn()) throw new Error('Sign in first.');
    const userDir = await getUserDir(vaultAuth.username, false);
    const account = JSON.parse(await readTextFile(userDir, 'account.json'));
    account.displayName = name;
    await writeTextFile(userDir, 'account.json', JSON.stringify(account, null, 2));
    vaultAuth.displayName = name;
    applyLoggedInDoctorToForms();
    updateAuthHeader();
    if (hasCurrentPatient()) {
        currentPatient.clinician = name;
        if (typeof updateHeaderPatient === 'function') updateHeaderPatient();
        if (typeof updateChartChrome === 'function') updateChartChrome();
    }
    return name;
}

function dismissAuthModal() {
    if (authCreateMode && authKnownUserCount > 0) {
        setAuthCreateMode(false);
        return;
    }
    closeAuthModal();
}

async function lockVaultSession() {
    try {
        if (hasCurrentPatient() && typeof rememberLastPatient === 'function') {
            rememberLastPatient();
        }
        if (hasCurrentPatient() && typeof saveCurrentChartFromDom === 'function') {
            await saveCurrentChartFromDom();
        }
        if (hasCurrentPatient() && typeof saveCurrentVisitNotes === 'function') {
            await saveCurrentVisitNotes();
        }
    } catch (err) {
        /* Still lock the session if a last write fails. */
    }
    vaultAuth = { username: '', key: null, displayName: '' };
    managedLesions = [];
    managedBillings = [];
    currentManagedCaseId = null;
    currentPatient = { name: '', firstName: '', lastName: '', dob: '', phone: '', clinician: '', chartId: '' };
    stopVaultIdleTimer();
    managedCharts = [];
    managedVisitNotes = [];
    managedConsents = [];
    pendingWorkspaceTab = '';
    pendingSanitise = false;
    isBedSanitised = false;
    shaveConsentVerified = false;
    pendingShaveConsentAction = '';
    lesions = [];
    patientConcerns = [];
    noPatientConcerns = false;
    screeningMarkedComplete = false;
    smsNormalResultsConsent = '';
    selectedChartLesionId = '';
    if (typeof resetProcedureSession === 'function') resetProcedureSession();
    if (typeof resetScreeningAndExamForm === 'function') resetScreeningAndExamForm();
    updateHeaderPatient();
    updateAuthHeader();
    if (typeof updateChartChrome === 'function') updateChartChrome();
    if (typeof renderChartSidebar === 'function') renderChartSidebar();
    openAuthModal();
}

async function createVaultUser(rawUsername, password, displayName) {
    const username = sanitizeUsername(rawUsername);
    if (username.length < 2) throw new Error('Choose a username of at least 2 characters.');
    if (!password || password.length < 8) throw new Error('Password must be at least 8 characters.');
    const fullName = String(displayName || '').trim();
    if (fullName.length < 3) throw new Error('Enter your full doctor name, e.g. Dr Jane Smith.');
    if (!vaultRootHandle) throw new Error('Connect the clinic folder first.');

    const userDir = await getUserDir(username, true);
    if (await fileExists(userDir, 'account.json')) {
        throw new Error('That username already exists in this folder.');
    }

    const salt = randomBytes(16);
    const key = await deriveVaultKey(password, salt);
    const account = {
        username,
        displayName: fullName,
        createdAt: new Date().toISOString(),
        kdf: { name: 'PBKDF2', hash: 'SHA-256', iterations: VAULT_KDF_ITERATIONS },
        salt: bytesToB64(salt)
    };
    await writeTextFile(userDir, 'account.json', JSON.stringify(account, null, 2));
    await writeTextFile(userDir, 'unlock.enc', JSON.stringify(await encryptJson(key, { ok: true, username })));
    await userDir.getDirectoryHandle('lesions', { create: true });
    await userDir.getDirectoryHandle('billing', { create: true });
    await userDir.getDirectoryHandle('charts', { create: true });
    await userDir.getDirectoryHandle('notes', { create: true });
    await userDir.getDirectoryHandle('consents', { create: true });

    vaultAuth = { username, key, displayName: fullName };
    return username;
}

async function loginVaultUser(rawUsername, password) {
    const username = sanitizeUsername(rawUsername);
    if (!username || !password) throw new Error('Enter username and password.');
    const userDir = await getUserDir(username, false);
    const account = JSON.parse(await readTextFile(userDir, 'account.json'));
    const salt = b64ToBytes(account.salt);
    const iterations = account.kdf?.iterations || VAULT_KDF_ITERATIONS;
    const key = await deriveVaultKey(password, salt, iterations);
    const envelope = JSON.parse(await readTextFile(userDir, 'unlock.enc'));
    const unlocked = await decryptJson(key, envelope);
    if (!unlocked || unlocked.ok !== true) throw new Error('Unable to unlock this user.');
    vaultAuth = { username, key, displayName: String(account.displayName || '').trim() };
    return username;
}

function updateAuthHeader() {
    const label = document.getElementById('headerAuthUserLabel');
    const wrap = document.getElementById('headerAuthWrap');
    if (label) label.textContent = loggedInDoctorName() || vaultAuth.username || 'Not signed in';
    if (wrap) wrap.classList.toggle('is-signed-in', isVaultLoggedIn());
}

function openAuthModal() {
    const modal = document.getElementById('authModal');
    if (modal) modal.classList.remove('hidden');
    authCreateMode = false;
    refreshAuthFolderStatus();
    populateAuthUserList();
}

function closeAuthModal() {
    const modal = document.getElementById('authModal');
    if (modal) modal.classList.add('hidden');
    authCreateMode = false;
    if (typeof setAuthCreateMode === 'function' && authKnownUserCount > 0) {
        setAuthCreateMode(false, { force: true });
    }
}

let authCreateMode = false;
let authKnownUserCount = 0;

function lastVaultUsername() {
    try {
        return localStorage.getItem('dermrecord.lastUser') || '';
    } catch (err) {
        return '';
    }
}

function rememberVaultUsername(username) {
    try {
        if (username) localStorage.setItem('dermrecord.lastUser', username);
    } catch (err) {
        /* Private mode may block storage. */
    }
}

function setAuthCreateMode(on, options) {
    const force = options && options.force;
    authCreateMode = !!on;
    const noUsers = authKnownUserCount === 0;
    const create = authCreateMode || (noUsers && vaultRootHandle);
    if (noUsers && vaultRootHandle) authCreateMode = true;

    const signInFields = document.getElementById('authSignInFields');
    const createFields = document.getElementById('authCreateFields');
    const confirmWrap = document.getElementById('authConfirmWrap');
    const signInBtn = document.getElementById('authSignInBtn');
    const createBtn = document.getElementById('authCreateBtn');
    const showCreateBtn = document.getElementById('authShowCreateBtn');
    const showSignInBtn = document.getElementById('authShowSignInBtn');
    const subtitle = document.getElementById('authModalSubtitle');
    const password = document.getElementById('authPassword');

    if (signInFields) signInFields.classList.toggle('hidden', create);
    if (createFields) createFields.classList.toggle('hidden', !create);
    if (confirmWrap) confirmWrap.classList.toggle('hidden', !create);
    if (signInBtn) signInBtn.classList.toggle('hidden', create);
    if (createBtn) createBtn.classList.toggle('hidden', !create);
    if (showCreateBtn) showCreateBtn.classList.toggle('hidden', create);
    if (showSignInBtn) {
        showSignInBtn.classList.toggle('hidden', !create || noUsers);
    }
    if (subtitle) {
        subtitle.textContent = create
            ? 'Create a user for this clinic folder. Password is never stored.'
            : 'Connect the clinic folder, then sign in.';
    }
    if (password) password.autocomplete = create ? 'new-password' : 'current-password';
    if (create && !force) {
        const input = document.getElementById('authUsernameInput');
        if (input && !input.value) input.focus();
    }
}

function submitAuthForm() {
    if (authCreateMode || (authKnownUserCount === 0 && vaultRootHandle)) {
        handleCreateVaultUser();
        return;
    }
    handleLoginVaultUser();
}

function setAuthFolderStatus(message, tone) {
    const status = document.getElementById('authFolderStatus');
    if (!status) return;
    status.textContent = message;
    status.classList.remove('text-slate-500', 'text-emerald-700', 'text-red-700', 'text-amber-700');
    if (tone === 'ok') status.classList.add('text-emerald-700');
    else if (tone === 'error') status.classList.add('text-red-700');
    else if (tone === 'warn') status.classList.add('text-amber-700');
    else status.classList.add('text-slate-500');
}

async function refreshAuthFolderStatus() {
    if (!vaultFsSupported()) {
        setAuthFolderStatus('Folder access needs Chrome or Edge (or the installed PWA).', 'error');
        return;
    }
    if (vaultRootHandle) {
        const name = vaultRootHandle.name || 'selected folder';
        setAuthFolderStatus('Clinic folder connected (' + name + '). Select your user and enter your password.', 'ok');
        return;
    }
    setAuthFolderStatus('No clinic folder connected yet.', 'info');
}

async function populateAuthUserList() {
    const select = document.getElementById('authUsernameSelect');
    if (!select) return;
    select.innerHTML = '<option value="">Select user...</option>';
    authKnownUserCount = 0;
    if (!vaultRootHandle) {
        setAuthCreateMode(false, { force: true });
        return;
    }
    try {
        const names = await listVaultUsernames();
        authKnownUserCount = names.length;
        const last = lastVaultUsername();
        names.forEach((name) => {
            const opt = document.createElement('option');
            opt.value = name;
            opt.textContent = name;
            select.appendChild(opt);
        });
        if (names.includes(last)) select.value = last;
        else if (names.length) select.value = names[0];
        if (!names.length) setAuthCreateMode(true, { force: true });
        else setAuthCreateMode(authCreateMode, { force: true });
    } catch (err) {
        setAuthCreateMode(true, { force: true });
    }
}

function authUsernameFromForm() {
    if (authCreateMode || (authKnownUserCount === 0 && vaultRootHandle)) {
        return document.getElementById('authUsernameInput')?.value.trim() || '';
    }
    return document.getElementById('authUsernameSelect')?.value.trim() || '';
}

async function handleConnectClinicFolder() {
    const btn = document.getElementById('authConnectFolderBtn');
    try {
        if (btn) btn.disabled = true;
        setAuthFolderStatus('Opening folder picker…', 'info');
        await pickClinicFolder();
        await refreshAuthFolderStatus();
        await populateAuthUserList();
        showToast('Clinic folder connected.');
    } catch (err) {
        if (err && err.name === 'AbortError') {
            setAuthFolderStatus('No folder selected. Choose the clinic folder again.', 'warn');
            return;
        }
        const message = folderErrorMessage(err);
        setAuthFolderStatus(message, 'error');
        showToast(message);
    } finally {
        if (btn) btn.disabled = false;
    }
}

async function handleCreateVaultUser() {
    const username = authUsernameFromForm();
    const password = document.getElementById('authPassword')?.value || '';
    const confirm = document.getElementById('authPasswordConfirm')?.value || '';
    if (!username) {
        showToast('Enter a username for the new user.');
        return;
    }
    if (password !== confirm) {
        showToast('Passwords do not match.');
        return;
    }
    try {
        await createVaultUser(username, password, document.getElementById('authDisplayName')?.value.trim() || '');
        rememberVaultUsername(sanitizeUsername(username));
        await afterVaultLogin();
        showToast('User created and signed in.');
    } catch (err) {
        showToast(err.message || 'Could not create user.');
    }
}

async function handleLoginVaultUser() {
    const username = authUsernameFromForm();
    const password = document.getElementById('authPassword')?.value || '';
    if (!username) {
        showToast('Select your user.');
        return;
    }
    try {
        if (!vaultRootHandle) {
            const restored = await restoreClinicFolder(true);
            if (!restored) throw new Error('Connect the clinic folder first.');
        }
        await loginVaultUser(username, password);
        rememberVaultUsername(sanitizeUsername(username));
        await afterVaultLogin();
        showToast('Signed in.');
    } catch (err) {
        showToast(err.message || 'Sign-in failed. Check username and password.');
    }
}

async function afterVaultLogin() {
    updateAuthHeader();
    applyLoggedInDoctorToForms();
    const pw = document.getElementById('authPassword');
    const confirm = document.getElementById('authPasswordConfirm');
    const display = document.getElementById('authDisplayName');
    if (pw) pw.value = '';
    if (confirm) confirm.value = '';
    if (display) display.value = '';
    closeAuthModal();
    if (typeof loadClinicProfile === 'function') await loadClinicProfile();
    if (typeof loadClinicSupplies === 'function') {
        await loadClinicSupplies();
        if (typeof populateProcSupplySelects === 'function') populateProcSupplySelects();
    }
    if (typeof loadClinicPdtPrices === 'function') {
        await loadClinicPdtPrices();
        if (typeof renderPdtAreaSelect === 'function') renderPdtAreaSelect();
        if (typeof renderPdtPriceEditor === 'function') renderPdtPriceEditor();
    }
    await loadManagedLesionsFromVault();
    updateHeaderPatient();
    if (typeof updateChartChrome === 'function') updateChartChrome();
    renderManagedLesions();
    const resumeKind = typeof resumeLastChartAfterLogin === 'function'
        ? await resumeLastChartAfterLogin()
        : false;
    if (resumeKind !== 'procedure' && resumeKind !== 'visit') {
        switchWorkspaceTab('management');
    }
    startVaultIdleLock();
}

async function initAuthModule() {
    updateAuthHeader();
    if (!vaultFsSupported()) {
        openAuthModal();
        refreshAuthFolderStatus();
        return;
    }
    try {
        await restoreClinicFolder(false);
    } catch (err) {
        vaultRootHandle = null;
    }
    openAuthModal();
}

const VAULT_IDLE_MS = 15 * 60 * 1000;
let vaultIdleTimer = null;
let vaultIdleLastAt = 0;
let vaultIdleListenersBound = false;

function stopVaultIdleTimer() {
    if (vaultIdleTimer) {
        clearTimeout(vaultIdleTimer);
        vaultIdleTimer = null;
    }
}

function startVaultIdleLock() {
    if (!isVaultLoggedIn()) return;
    vaultIdleLastAt = Date.now();
    bumpVaultIdleTimer();
}

function bumpVaultIdleTimer() {
    if (!isVaultLoggedIn()) return;
    vaultIdleLastAt = Date.now();
    stopVaultIdleTimer();
    vaultIdleTimer = setTimeout(() => {
        if (!isVaultLoggedIn()) return;
        lockVaultSession().then(() => {
            showToast('Locked after 15 minutes of inactivity.');
        });
    }, VAULT_IDLE_MS);
}

function checkVaultIdleOnVisible() {
    if (document.visibilityState !== 'visible' || !isVaultLoggedIn()) return;
    if (Date.now() - vaultIdleLastAt >= VAULT_IDLE_MS) {
        lockVaultSession().then(() => {
            showToast('Locked after 15 minutes of inactivity.');
        });
        return;
    }
    bumpVaultIdleTimer();
}

function initVaultIdleLock() {
    if (vaultIdleListenersBound) return;
    vaultIdleListenersBound = true;
    const bump = () => {
        if (!isVaultLoggedIn()) return;
        bumpVaultIdleTimer();
    };
    ['pointerdown', 'keydown', 'mousemove', 'wheel', 'touchstart', 'scroll'].forEach((eventName) => {
        document.addEventListener(eventName, bump, { passive: true });
    });
    document.addEventListener('visibilitychange', checkVaultIdleOnVisible);
    document.addEventListener('click', (event) => {
        if (typeof hideChartSearchResults === 'function' && !event.target.closest('.chart-search')) {
            hideChartSearchResults();
        }
    });
}

