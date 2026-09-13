/* Per-user login. Password never leaves memory; it only derives the AES key. */

let vaultAuth = {
    username: '',
    key: null,
    displayName: ''
};
let vaultPasswordNeedsUpgrade = false;
let vaultPasswordChangeBusy = false;

const VAULT_UNLOCK_FILE = 'unlock.enc';
const VAULT_ACCOUNT_FILE = 'account.json';
const VAULT_UNLOCK_NEXT = 'unlock.enc.next';
const VAULT_ACCOUNT_NEXT = 'account.json.next';

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
    if (vaultPasswordChangeBusy) {
        if (typeof showToast === 'function') {
            showToast('Wait until the password change finishes.');
        }
        return;
    }
    stopVaultIdleTimer();
    let saveFailed = false;
    try {
        if (typeof chartSaveTimer !== 'undefined' && chartSaveTimer) {
            clearTimeout(chartSaveTimer);
            chartSaveTimer = null;
        }
        if (typeof visitNoteSaveTimer !== 'undefined' && visitNoteSaveTimer) {
            clearTimeout(visitNoteSaveTimer);
            visitNoteSaveTimer = null;
        }
        if (typeof flushVisitPersistence === 'function') {
            const result = await flushVisitPersistence();
            if (result && result.ok === false) saveFailed = true;
        } else {
            if (hasCurrentPatient() && typeof saveCurrentChartFromDom === 'function') {
                await saveCurrentChartFromDom();
            }
            if (hasCurrentPatient() && typeof saveCurrentVisitNotes === 'function') {
                await saveCurrentVisitNotes();
            }
        }
        if (typeof persistUiSession === 'function') {
            await persistUiSession(hasCurrentPatient() ? currentPatient.chartId : '');
        }
        if (typeof waitForPendingVaultWrites === 'function') {
            await waitForPendingVaultWrites();
        }
        if (typeof clearPlaintextLastChartStorage === 'function') {
            clearPlaintextLastChartStorage();
        }
    } catch (err) {
        saveFailed = true;
        console.warn('Save before lock failed', err);
    }
    if (saveFailed) {
        if (typeof toastVaultWriteError === 'function') {
            toastVaultWriteError('Could not save the last visit before lock. Sign in again and check the clinic folder.');
        } else if (typeof showToast === 'function') {
            showToast('Could not save the last visit before lock. Sign in again and check the clinic folder.');
        }
    }
    vaultPasswordNeedsUpgrade = false;
    closeHeaderAuthMenu();
    vaultAuth = { username: '', key: null, displayName: '' };
    managedLesions = [];
    managedBillings = [];
    currentManagedCaseId = null;
    currentPatient = { name: '', firstName: '', lastName: '', dob: '', phone: '', clinician: '', chartId: '' };
    stopVaultIdleTimer();
    managedCharts = [];
    if (typeof loadedUiSession !== 'undefined') loadedUiSession = { chartId: '' };
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

const VAULT_PASSWORD_MIN_LENGTH = 12;

async function createVaultUser(rawUsername, password, displayName) {
    const username = sanitizeUsername(rawUsername);
    if (username.length < 2) throw new Error('Choose a username of at least 2 characters.');
    if (!password || password.length < VAULT_PASSWORD_MIN_LENGTH) {
        throw new Error('Password must be at least ' + VAULT_PASSWORD_MIN_LENGTH + ' characters.');
    }
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
    vaultPasswordNeedsUpgrade = false;
    return username;
}

async function readCompleteVaultJson(dir, name) {
    const text = await readTextFile(dir, name);
    if (typeof vaultPayloadLooksComplete === 'function' && !vaultPayloadLooksComplete(text)) {
        throw new Error('Incomplete vault file');
    }
    return { text, data: JSON.parse(text) };
}

async function unlockWithAccountEnvelope(account, envelope, password) {
    const salt = b64ToBytes(account.salt);
    const iterations = account.kdf?.iterations || VAULT_KDF_ITERATIONS;
    const key = await deriveVaultKey(password, salt, iterations);
    const unlocked = await decryptJson(key, envelope);
    if (!unlocked || unlocked.ok !== true) throw new Error('Unable to unlock this user.');
    return key;
}

async function tryUnlockVaultPair(userDir, accountName, unlockName, password) {
    if (!(await fileExists(userDir, accountName)) || !(await fileExists(userDir, unlockName))) return null;
    try {
        const accountPack = await readCompleteVaultJson(userDir, accountName);
        const unlockPack = await readCompleteVaultJson(userDir, unlockName);
        const key = await unlockWithAccountEnvelope(accountPack.data, unlockPack.data, password);
        return {
            account: accountPack.data,
            accountText: accountPack.text,
            unlockText: unlockPack.text,
            key
        };
    } catch (err) {
        return null;
    }
}

async function loginVaultUser(rawUsername, password) {
    const username = sanitizeUsername(rawUsername);
    if (!username || !password) throw new Error('Enter username and password.');
    const userDir = await getUserDir(username, false);
    if (typeof recoverIncompleteVaultWrites === 'function') {
        await recoverIncompleteVaultWrites(userDir);
    }
    const hasNext = (await fileExists(userDir, VAULT_ACCOUNT_NEXT)) && (await fileExists(userDir, VAULT_UNLOCK_NEXT));
    let unlocked = null;
    if (hasNext) {
        unlocked = await tryUnlockVaultPair(userDir, VAULT_ACCOUNT_NEXT, VAULT_UNLOCK_NEXT, password);
        if (!unlocked) {
            throw new Error('A password change did not finish. Sign in with the new password.');
        }
        await writeTextFile(userDir, VAULT_UNLOCK_FILE, unlocked.unlockText);
        await writeTextFile(userDir, VAULT_ACCOUNT_FILE, unlocked.accountText);
        if (typeof waitForPendingVaultWrites === 'function') await waitForPendingVaultWrites();
        await deleteTextFile(userDir, VAULT_UNLOCK_NEXT);
        await deleteTextFile(userDir, VAULT_ACCOUNT_NEXT);
    } else {
        unlocked = await tryUnlockVaultPair(userDir, VAULT_ACCOUNT_FILE, VAULT_UNLOCK_FILE, password);
        if (!unlocked) throw new Error('Unable to unlock this user.');
    }
    vaultAuth = { username, key: unlocked.key, displayName: String(unlocked.account.displayName || '').trim() };
    vaultPasswordNeedsUpgrade = password.length < VAULT_PASSWORD_MIN_LENGTH;
    return username;
}

async function listUserEncryptedVaultFiles(username) {
    const files = [];
    const userDir = await getUserDir(username, false);
    for await (const [name, handle] of userDir.entries()) {
        if (handle.kind === 'file' && (name === VAULT_UNLOCK_FILE || name.endsWith('.json.enc'))) {
            if (name.endsWith('.tmp') || name.endsWith('.next') || name.endsWith('.prev')) continue;
            files.push({ dir: userDir, name });
        }
    }
    const dirs = [
        await getUserLesionsDir(username, true),
        await getUserBillingDir(username, true),
        await getUserChartsDir(username, true),
        await getUserNotesDir(username, true),
        await getUserConsentsDir(username, true)
    ];
    for (const dir of dirs) {
        for await (const [name, handle] of dir.entries()) {
            if (handle.kind === 'file' && name.endsWith('.json.enc') && !name.endsWith('.tmp')) files.push({ dir, name });
        }
    }
    return files;
}

async function reencryptVaultFile(dir, name, fromKey, toKey) {
    const envelope = JSON.parse(await readTextFile(dir, name));
    const data = await decryptJson(fromKey, envelope);
    await writeTextFile(dir, name, JSON.stringify(await encryptJson(toKey, data)));
}

async function assertCurrentVaultPassword(password) {
    if (!isVaultLoggedIn()) throw new Error('Sign in first.');
    if (!password) throw new Error('Enter your current password.');
    try {
        const userDir = await getUserDir(vaultAuth.username, false);
        if (typeof recoverIncompleteVaultWrites === 'function') {
            await recoverIncompleteVaultWrites(userDir);
        }
        const account = JSON.parse(await readTextFile(userDir, VAULT_ACCOUNT_FILE));
        const envelope = JSON.parse(await readTextFile(userDir, VAULT_UNLOCK_FILE));
        await unlockWithAccountEnvelope(account, envelope, password);
    } catch (err) {
        if (err && /current password/i.test(String(err.message || ''))) throw err;
        throw new Error('Current password is incorrect.');
    }
}

async function flushOpenVaultWork() {
    if (typeof chartSaveTimer !== 'undefined' && chartSaveTimer) {
        clearTimeout(chartSaveTimer);
        chartSaveTimer = null;
    }
    if (typeof visitNoteSaveTimer !== 'undefined' && visitNoteSaveTimer) {
        clearTimeout(visitNoteSaveTimer);
        visitNoteSaveTimer = null;
    }
    if (typeof flushVisitPersistence === 'function') {
        const result = await flushVisitPersistence();
        if (result && result.ok === false) throw new Error('Could not save the open visit before changing the password.');
    } else {
        if (hasCurrentPatient() && typeof saveCurrentChartFromDom === 'function') {
            await saveCurrentChartFromDom();
        }
        if (hasCurrentPatient() && typeof saveCurrentVisitNotes === 'function') {
            await saveCurrentVisitNotes();
        }
    }
    if (typeof persistUiSession === 'function') {
        await persistUiSession(hasCurrentPatient() ? currentPatient.chartId : '');
    }
    if (typeof waitForPendingVaultWrites === 'function') await waitForPendingVaultWrites();
}

async function changeVaultPassword(newPassword, options) {
    const opts = options || {};
    if (!isVaultLoggedIn()) throw new Error('Sign in first.');
    if (!newPassword || newPassword.length < VAULT_PASSWORD_MIN_LENGTH) {
        throw new Error('Password must be at least ' + VAULT_PASSWORD_MIN_LENGTH + ' characters.');
    }
    if (opts.requireCurrent) {
        await assertCurrentVaultPassword(opts.currentPassword);
        if (opts.currentPassword === newPassword) {
            throw new Error('Choose a different password.');
        }
    }
    if (vaultPasswordChangeBusy) throw new Error('A password change is already running.');
    vaultPasswordChangeBusy = true;
    stopVaultIdleTimer();
    const oldKey = vaultAuth.key;
    const username = vaultAuth.username;
    const converted = [];
    let committed = false;
    let userDir;
    let oldUnlockText = '';
    let oldAccountText = '';
    let newKey = null;
    try {
        await flushOpenVaultWork();
        userDir = await getUserDir(username, false);
        if (typeof recoverIncompleteVaultWrites === 'function') {
            await recoverIncompleteVaultWrites(userDir);
        }
        oldUnlockText = await readTextFile(userDir, VAULT_UNLOCK_FILE);
        oldAccountText = await readTextFile(userDir, VAULT_ACCOUNT_FILE);
        const salt = randomBytes(16);
        newKey = await deriveVaultKey(newPassword, salt);
        const files = await listUserEncryptedVaultFiles(username);
        for (const file of files) {
            if (file.name === VAULT_UNLOCK_FILE) continue;
            await reencryptVaultFile(file.dir, file.name, oldKey, newKey);
            converted.push(file);
        }
        const account = JSON.parse(oldAccountText);
        account.salt = bytesToB64(salt);
        account.kdf = { name: 'PBKDF2', hash: 'SHA-256', iterations: VAULT_KDF_ITERATIONS };
        account.passwordUpdatedAt = new Date().toISOString();
        const newAccountText = JSON.stringify(account, null, 2);
        const newUnlockText = JSON.stringify(await encryptJson(newKey, { ok: true, username }));
        await writeTextFile(userDir, VAULT_UNLOCK_NEXT, newUnlockText);
        await writeTextFile(userDir, VAULT_ACCOUNT_NEXT, newAccountText);
        if (typeof waitForPendingVaultWrites === 'function') await waitForPendingVaultWrites();
        await writeTextFile(userDir, VAULT_UNLOCK_FILE, newUnlockText);
        await writeTextFile(userDir, VAULT_ACCOUNT_FILE, newAccountText);
        if (typeof waitForPendingVaultWrites === 'function') await waitForPendingVaultWrites();
        await deleteTextFile(userDir, VAULT_UNLOCK_NEXT);
        await deleteTextFile(userDir, VAULT_ACCOUNT_NEXT);
        vaultAuth.key = newKey;
        vaultPasswordNeedsUpgrade = false;
        committed = true;
        try {
            let leftoverBackups = 0;
            if (typeof pruneLesionConversionBackups === 'function') {
                await pruneLesionConversionBackups(0);
            }
            if (typeof leftoverLesionConversionBackupCount === 'function') {
                leftoverBackups = await leftoverLesionConversionBackupCount();
            }
            if (leftoverBackups && typeof showToast === 'function') {
                showToast('Password updated. Delete backups/lesions-v1 folders in the clinic folder — those copies still use the old password.');
            }
        } catch (backupErr) {
            console.warn('Could not remove old-key lesion backups after password change', backupErr);
            if (typeof showToast === 'function') {
                showToast('Password updated. Delete backups/lesions-v1 folders in the clinic folder — those copies still use the old password.');
            }
        }
    } catch (err) {
        console.warn('Password change failed', err);
        if (!committed) {
            if (userDir) {
                try { await deleteTextFile(userDir, VAULT_UNLOCK_NEXT); } catch (delErr) { /* continue rollback */ }
                try { await deleteTextFile(userDir, VAULT_ACCOUNT_NEXT); } catch (delErr) { /* continue rollback */ }
                if (oldUnlockText && oldAccountText) {
                    try {
                        await writeTextFile(userDir, VAULT_UNLOCK_FILE, oldUnlockText);
                        await writeTextFile(userDir, VAULT_ACCOUNT_FILE, oldAccountText);
                        if (typeof waitForPendingVaultWrites === 'function') await waitForPendingVaultWrites();
                    } catch (restoreErr) {
                        console.warn('Could not restore unlock files after password change', restoreErr);
                    }
                }
            }
            if (newKey && converted.length) {
                for (const file of converted.slice().reverse()) {
                    try { await reencryptVaultFile(file.dir, file.name, newKey, oldKey); } catch (rollErr) {
                        console.warn('Could not roll back vault file after password change', file.name, rollErr);
                    }
                }
            }
            vaultAuth.key = oldKey;
        }
        if (/save the open visit|current password|at least|different password|Sign in first|already running/i.test(String(err.message || ''))) {
            throw err;
        }
        throw new Error('Could not update the password. Clinic files were left on the previous password.');
    } finally {
        vaultPasswordChangeBusy = false;
        if (isVaultLoggedIn()) startVaultIdleLock();
    }
}

let passwordChangeMode = 'upgrade';

function fillPasswordChangeFields() {
    const current = document.getElementById('passwordChangeCurrent');
    const next = document.getElementById('passwordUpgradeNew');
    const confirm = document.getElementById('passwordUpgradeConfirm');
    if (current) current.value = '';
    if (next) next.value = '';
    if (confirm) confirm.value = '';
}

function setPasswordChangeMode(mode) {
    passwordChangeMode = mode === 'change' ? 'change' : 'upgrade';
    const isChange = passwordChangeMode === 'change';
    const title = document.getElementById('passwordChangeTitle');
    const lead = document.getElementById('passwordChangeLead');
    const currentWrap = document.getElementById('passwordChangeCurrentWrap');
    const dismiss = document.getElementById('passwordChangeDismiss');
    const submit = document.getElementById('passwordUpgradeSubmit');
    if (title) title.textContent = isChange ? 'Change vault password' : 'Set a longer vault password';
    if (lead) {
        lead.textContent = isChange
            ? 'Re-encrypts your clinic files with a new password. Enter the current password first.'
            : 'Your current password is shorter than 12 characters. That password is the only secret for the encrypted clinic files.';
    }
    if (currentWrap) currentWrap.classList.toggle('hidden', !isChange);
    if (dismiss) dismiss.textContent = isChange ? 'Cancel' : 'Later';
    if (submit) submit.textContent = isChange ? 'Change password' : 'Update password';
}

function openPasswordUpgradeModal() {
    const modal = document.getElementById('passwordUpgradeModal');
    if (!modal) return;
    closeHeaderAuthMenu();
    setPasswordChangeMode('upgrade');
    fillPasswordChangeFields();
    modal.classList.remove('hidden');
    const next = document.getElementById('passwordUpgradeNew');
    if (next) next.focus();
}

function openPasswordChangeModal() {
    if (!isVaultLoggedIn()) {
        showToast('Sign in first.');
        openAuthModal();
        return;
    }
    const modal = document.getElementById('passwordUpgradeModal');
    if (!modal) return;
    closeHeaderAuthMenu();
    setPasswordChangeMode('change');
    fillPasswordChangeFields();
    modal.classList.remove('hidden');
    const current = document.getElementById('passwordChangeCurrent');
    if (current) current.focus();
}

function dismissPasswordUpgrade() {
    const modal = document.getElementById('passwordUpgradeModal');
    if (modal) modal.classList.add('hidden');
    fillPasswordChangeFields();
    passwordChangeMode = 'upgrade';
}

async function submitPasswordUpgrade() {
    const current = document.getElementById('passwordChangeCurrent')?.value || '';
    const next = document.getElementById('passwordUpgradeNew')?.value || '';
    const confirm = document.getElementById('passwordUpgradeConfirm')?.value || '';
    if (next !== confirm) {
        showToast('Passwords do not match.');
        return;
    }
    const btn = document.getElementById('passwordUpgradeSubmit');
    if (btn) {
        btn.disabled = true;
        btn.textContent = 'Re-encrypting clinic files…';
    }
    try {
        if (passwordChangeMode === 'change') {
            await changeVaultPassword(next, { requireCurrent: true, currentPassword: current });
        } else {
            await changeVaultPassword(next);
        }
        dismissPasswordUpgrade();
        showToast('Vault password updated.');
    } catch (err) {
        showToast(err.message || 'Could not update the password.');
        if (btn) btn.textContent = passwordChangeMode === 'change' ? 'Change password' : 'Update password';
    } finally {
        if (btn) btn.disabled = false;
        if (btn && document.getElementById('passwordUpgradeModal')?.classList.contains('hidden')) {
            btn.textContent = 'Update password';
        }
    }
}

function closeHeaderAuthMenu() {
    const menu = document.getElementById('headerAuthMenu');
    const btn = document.getElementById('headerAuthButton');
    if (menu) menu.classList.add('hidden');
    if (btn) btn.setAttribute('aria-expanded', 'false');
}

function toggleHeaderAuthMenu() {
    const menu = document.getElementById('headerAuthMenu');
    const btn = document.getElementById('headerAuthButton');
    if (!menu || !btn) return;
    const open = menu.classList.contains('hidden');
    if (open) {
        menu.classList.remove('hidden');
        btn.setAttribute('aria-expanded', 'true');
    } else {
        closeHeaderAuthMenu();
    }
}

function onHeaderAuthButtonClick() {
    if (!isVaultLoggedIn()) {
        closeHeaderAuthMenu();
        openAuthModal();
        return;
    }
    toggleHeaderAuthMenu();
}

function lockVaultFromHeaderMenu() {
    closeHeaderAuthMenu();
    lockVaultSession();
}

function updateAuthHeader() {
    const label = document.getElementById('headerAuthUserLabel');
    const wrap = document.getElementById('headerAuthWrap');
    const menuName = document.getElementById('headerAuthMenuName');
    const btn = document.getElementById('headerAuthButton');
    const signedIn = isVaultLoggedIn();
    const who = loggedInDoctorName() || vaultAuth.username || 'Not signed in';
    if (label) label.textContent = who;
    if (menuName) menuName.textContent = signedIn ? who : '';
    if (wrap) wrap.classList.toggle('is-signed-in', signedIn);
    if (btn) {
        btn.setAttribute('aria-label', signedIn ? 'Account menu' : 'Account');
        btn.setAttribute('aria-haspopup', signedIn ? 'menu' : 'false');
    }
    if (!signedIn) closeHeaderAuthMenu();
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
    if (password) {
        password.autocomplete = create ? 'new-password' : 'current-password';
        if (create) password.setAttribute('minlength', String(VAULT_PASSWORD_MIN_LENGTH));
        else password.removeAttribute('minlength');
    }
    const hint = document.getElementById('authPasswordHint');
    if (hint) hint.classList.toggle('hidden', !create);
    const confirm = document.getElementById('authPasswordConfirm');
    if (confirm) {
        if (create) confirm.setAttribute('minlength', String(VAULT_PASSWORD_MIN_LENGTH));
        else confirm.removeAttribute('minlength');
    }
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
    try {
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
        if (typeof loadUiSessionFromVault === 'function') await loadUiSessionFromVault();
        if (typeof adoptPlaintextLastChartIfNeeded === 'function') await adoptPlaintextLastChartIfNeeded();
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
    } catch (err) {
        console.warn('Vault load after sign-in failed', err);
        vaultPasswordNeedsUpgrade = false;
        if (typeof lockVaultSession === 'function') await lockVaultSession();
        throw new Error('Could not load encrypted files from the clinic folder. Check folder access and sign in again.');
    }
    const pw = document.getElementById('authPassword');
    const confirm = document.getElementById('authPasswordConfirm');
    const display = document.getElementById('authDisplayName');
    if (pw) pw.value = '';
    if (confirm) confirm.value = '';
    if (display) display.value = '';
    closeAuthModal();
    if (vaultPasswordNeedsUpgrade) openPasswordUpgradeModal();
}

async function initAuthModule() {
    updateAuthHeader();
    document.addEventListener('click', (event) => {
        if (!event.target.closest('#headerAuthWrap')) closeHeaderAuthMenu();
    });
    document.addEventListener('keydown', (event) => {
        if (event.key !== 'Escape') return;
        closeHeaderAuthMenu();
        const modal = document.getElementById('passwordUpgradeModal');
        if (modal && !modal.classList.contains('hidden') && passwordChangeMode === 'change') {
            dismissPasswordUpgrade();
        }
    });
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
    if (!isVaultLoggedIn() || vaultPasswordChangeBusy) return;
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
    if (document.visibilityState !== 'visible' || !isVaultLoggedIn() || vaultPasswordChangeBusy) return;
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
        if (!isVaultLoggedIn() || vaultPasswordChangeBusy) return;
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

