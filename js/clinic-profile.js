/* Clinic-wide settings: contact profile + procedure supplies. Stored in the clinic folder root. */

let clinicProfile = emptyClinicProfile();

function emptyClinicProfile() {
    return {
        clinicName: '',
        address: '',
        phone: '',
        afterHoursPhone: '',
        email: '',
        smsInfo: '',
        website: '',
        urgentAdvice: 'If you have heavy bleeding that will not stop, rapidly spreading infection, shortness of breath, or feel severely unwell, seek urgent care (this clinic if open, your GP, or a hospital emergency department). Take this sheet with you.',
        updatedAt: ''
    };
}

function clinicProfileFileName() {
    return 'clinic-profile.json';
}

function clinicSuppliesFileName() {
    return 'clinic-supplies.json';
}

function clinicPdtPricesFileName() {
    return 'clinic-pdt-prices.json';
}

function normalizeProcSuppliesData(data) {
    const src = data && typeof data === 'object' ? data : {};
    const list = (arr, fallback) => {
        if (Array.isArray(arr) && arr.length) {
            return arr.map((item) => String(item || '').trim()).filter(Boolean);
        }
        return fallback.slice();
    };
    return {
        anesthetics: list(src.anesthetics, DEFAULT_PROC_SUPPLIES.anesthetics),
        sutures: list(src.sutures, DEFAULT_PROC_SUPPLIES.sutures),
        preps: list(src.preps, DEFAULT_PROC_SUPPLIES.preps),
        updatedAt: String(src.updatedAt || '')
    };
}

function readLocalProcSuppliesFallback() {
    try {
        const raw = localStorage.getItem(PROC_SUPPLIES_STORAGE_KEY);
        if (!raw) return null;
        return normalizeProcSuppliesData(JSON.parse(raw));
    } catch (err) {
        return null;
    }
}

function clearLocalProcSuppliesFallback() {
    try {
        localStorage.removeItem(PROC_SUPPLIES_STORAGE_KEY);
    } catch (err) {
        /* ignore */
    }
}

async function loadClinicProfile() {
    clinicProfile = emptyClinicProfile();
    if (!vaultRootHandle) return clinicProfile;
    try {
        const text = await readTextFile(vaultRootHandle, clinicProfileFileName());
        const data = JSON.parse(text);
        clinicProfile = {
            ...emptyClinicProfile(),
            ...data,
            clinicName: String(data.clinicName || '').trim(),
            address: String(data.address || '').trim(),
            phone: String(data.phone || '').trim(),
            afterHoursPhone: String(data.afterHoursPhone || '').trim(),
            email: String(data.email || '').trim(),
            smsInfo: String(data.smsInfo || '').trim(),
            website: String(data.website || '').trim(),
            urgentAdvice: String(data.urgentAdvice || emptyClinicProfile().urgentAdvice).trim()
        };
    } catch (err) {
        /* File may not exist yet. */
    }
    return clinicProfile;
}

async function saveClinicProfile(profile) {
    if (!vaultRootHandle) throw new Error('Connect the clinic folder first.');
    const next = {
        ...emptyClinicProfile(),
        ...clinicProfile,
        ...profile,
        updatedAt: new Date().toISOString()
    };
    next.clinicName = String(next.clinicName || '').trim();
    next.address = String(next.address || '').trim();
    next.phone = String(next.phone || '').trim();
    next.afterHoursPhone = String(next.afterHoursPhone || '').trim();
    next.email = String(next.email || '').trim();
    next.smsInfo = String(next.smsInfo || '').trim();
    next.website = String(next.website || '').trim();
    next.urgentAdvice = String(next.urgentAdvice || emptyClinicProfile().urgentAdvice).trim();
    await writeTextFile(vaultRootHandle, clinicProfileFileName(), JSON.stringify(next, null, 2));
    clinicProfile = next;
    return clinicProfile;
}

async function loadClinicSupplies() {
    let fromVault = null;
    if (vaultRootHandle) {
        try {
            const text = await readTextFile(vaultRootHandle, clinicSuppliesFileName());
            fromVault = normalizeProcSuppliesData(JSON.parse(text));
        } catch (err) {
            /* File may not exist yet. */
        }
    }

    if (fromVault) {
        procSupplies = {
            anesthetics: fromVault.anesthetics.slice(),
            sutures: fromVault.sutures.slice(),
            preps: fromVault.preps.slice()
        };
        clearLocalProcSuppliesFallback();
        return procSupplies;
    }

    const fromLocal = readLocalProcSuppliesFallback();
    if (fromLocal) {
        procSupplies = {
            anesthetics: fromLocal.anesthetics.slice(),
            sutures: fromLocal.sutures.slice(),
            preps: fromLocal.preps.slice()
        };
        if (vaultRootHandle) {
            try {
                await saveClinicSupplies();
                clearLocalProcSuppliesFallback();
            } catch (err) {
                /* Keep using in-memory / local until write succeeds. */
            }
        }
        return procSupplies;
    }

    procSupplies = {
        anesthetics: DEFAULT_PROC_SUPPLIES.anesthetics.slice(),
        sutures: DEFAULT_PROC_SUPPLIES.sutures.slice(),
        preps: DEFAULT_PROC_SUPPLIES.preps.slice()
    };
    if (vaultRootHandle) {
        try {
            await saveClinicSupplies();
        } catch (err) {
            /* Defaults stay in memory. */
        }
    }
    return procSupplies;
}

async function saveClinicSupplies() {
    if (!vaultRootHandle) {
        try {
            localStorage.setItem(PROC_SUPPLIES_STORAGE_KEY, JSON.stringify({
                anesthetics: procSupplies.anesthetics,
                sutures: procSupplies.sutures,
                preps: procSupplies.preps
            }));
        } catch (err) {
            throw new Error('Connect the clinic folder to save supplies, or allow local storage.');
        }
        return procSupplies;
    }
    const payload = {
        anesthetics: (procSupplies.anesthetics || []).map((item) => String(item || '').trim()).filter(Boolean),
        sutures: (procSupplies.sutures || []).map((item) => String(item || '').trim()).filter(Boolean),
        preps: (procSupplies.preps || []).map((item) => String(item || '').trim()).filter(Boolean),
        updatedAt: new Date().toISOString()
    };
    await writeTextFile(vaultRootHandle, clinicSuppliesFileName(), JSON.stringify(payload, null, 2));
    procSupplies = {
        anesthetics: payload.anesthetics.slice(),
        sutures: payload.sutures.slice(),
        preps: payload.preps.slice()
    };
    clearLocalProcSuppliesFallback();
    return procSupplies;
}

function normalizePdtPriceListData(data) {
    const rows = Array.isArray(data) ? data : (Array.isArray(data?.areas) ? data.areas : []);
    return rows.map((item) => ({
        id: String(item.id || ('pdt-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7))),
        area: String(item.area || '').trim() || 'Unnamed area',
        price: Math.max(0, Number(item.price) || 0)
    })).filter((item) => item.area);
}

function readLocalPdtPricesFallback() {
    try {
        const raw = localStorage.getItem(PDT_PRICE_STORAGE_KEY);
        if (!raw) return null;
        const normalized = normalizePdtPriceListData(JSON.parse(raw));
        return normalized.length ? normalized : null;
    } catch (err) {
        return null;
    }
}

function clearLocalPdtPricesFallback() {
    try {
        localStorage.removeItem(PDT_PRICE_STORAGE_KEY);
    } catch (err) {
        /* ignore */
    }
}

async function loadClinicPdtPrices() {
    let fromVault = null;
    if (vaultRootHandle) {
        try {
            const text = await readTextFile(vaultRootHandle, clinicPdtPricesFileName());
            fromVault = normalizePdtPriceListData(JSON.parse(text));
        } catch (err) {
            /* File may not exist yet. */
        }
    }

    if (fromVault && fromVault.length) {
        pdtPriceList = fromVault.map((item) => ({ ...item }));
        clearLocalPdtPricesFallback();
        return pdtPriceList;
    }

    const fromLocal = readLocalPdtPricesFallback();
    if (fromLocal) {
        pdtPriceList = fromLocal.map((item) => ({ ...item }));
        if (vaultRootHandle) {
            try {
                await saveClinicPdtPrices();
                clearLocalPdtPricesFallback();
            } catch (err) {
                /* Keep local until vault write works. */
            }
        }
        return pdtPriceList;
    }

    pdtPriceList = DEFAULT_PDT_PRICE_LIST.map((item) => ({ ...item }));
    if (vaultRootHandle) {
        try {
            await saveClinicPdtPrices();
        } catch (err) {
            /* Defaults stay in memory. */
        }
    }
    return pdtPriceList;
}

async function saveClinicPdtPrices() {
    const payload = {
        areas: (pdtPriceList || []).map((item) => ({
            id: item.id,
            area: String(item.area || '').trim() || 'Unnamed area',
            price: Math.max(0, Number(item.price) || 0)
        })),
        updatedAt: new Date().toISOString()
    };
    if (!vaultRootHandle) {
        try {
            localStorage.setItem(PDT_PRICE_STORAGE_KEY, JSON.stringify(payload.areas));
        } catch (err) {
            throw new Error('Connect the clinic folder to save PDT prices, or allow local storage.');
        }
        pdtPriceList = payload.areas.map((item) => ({ ...item }));
        return pdtPriceList;
    }
    await writeTextFile(vaultRootHandle, clinicPdtPricesFileName(), JSON.stringify(payload, null, 2));
    pdtPriceList = payload.areas.map((item) => ({ ...item }));
    clearLocalPdtPricesFallback();
    return pdtPriceList;
}

function fillClinicProfileSettingsFields() {
    const fill = (id, value) => {
        const el = document.getElementById(id);
        if (el) el.value = value || '';
    };
    fill('clinicProfileName', clinicProfile.clinicName);
    fill('clinicProfileAddress', clinicProfile.address);
    fill('clinicProfilePhone', clinicProfile.phone);
    fill('clinicProfileAfterHours', clinicProfile.afterHoursPhone);
    fill('clinicProfileEmail', clinicProfile.email);
    fill('clinicProfileSms', clinicProfile.smsInfo);
    fill('clinicProfileWebsite', clinicProfile.website);
    fill('clinicProfileUrgent', clinicProfile.urgentAdvice || emptyClinicProfile().urgentAdvice);
}

function switchClinicSettingsTab(tab) {
    const details = document.getElementById('clinicSettingsPanelDetails');
    const supplies = document.getElementById('clinicSettingsPanelSupplies');
    const pdt = document.getElementById('clinicSettingsPanelPdt');
    const btnDetails = document.getElementById('clinicSettingsTabDetails');
    const btnSupplies = document.getElementById('clinicSettingsTabSupplies');
    const btnPdt = document.getElementById('clinicSettingsTabPdt');
    const active = tab === 'supplies' ? 'supplies' : (tab === 'pdt' ? 'pdt' : 'details');
    if (details) details.classList.toggle('hidden', active !== 'details');
    if (supplies) supplies.classList.toggle('hidden', active !== 'supplies');
    if (pdt) pdt.classList.toggle('hidden', active !== 'pdt');
    const styleTab = (btn, on) => {
        if (!btn) return;
        btn.classList.toggle('bg-slate-900', on);
        btn.classList.toggle('text-white', on);
        btn.classList.toggle('bg-white', !on);
        btn.classList.toggle('text-slate-700', !on);
        btn.setAttribute('aria-selected', on ? 'true' : 'false');
    };
    styleTab(btnDetails, active === 'details');
    styleTab(btnSupplies, active === 'supplies');
    styleTab(btnPdt, active === 'pdt');
    const saveClinic = document.getElementById('clinicSettingsSaveClinicBtn');
    if (saveClinic) saveClinic.classList.toggle('hidden', active !== 'details');
    if (active === 'pdt' && typeof renderPdtPriceEditor === 'function') renderPdtPriceEditor();
}

function openClinicSettingsModal(tab) {
    if (!vaultRootHandle) {
        showToast('Connect the clinic folder first.');
        if (typeof openAuthModal === 'function') openAuthModal();
        return;
    }
    if (!isVaultLoggedIn || !isVaultLoggedIn()) {
        showToast('Sign in to edit clinic settings.');
        if (typeof openAuthModal === 'function') openAuthModal();
        return;
    }
    const modal = document.getElementById('clinicSettingsModal');
    if (!modal) return;
    fillClinicProfileSettingsFields();
    if (typeof renderProcSupplyEditors === 'function') renderProcSupplyEditors();
    if (typeof renderPdtPriceEditor === 'function') renderPdtPriceEditor();
    const nextTab = (tab === 'supplies' || tab === 'pdt') ? tab : 'details';
    switchClinicSettingsTab(nextTab);
    modal.classList.remove('hidden');
}

function closeClinicSettingsModal() {
    const modal = document.getElementById('clinicSettingsModal');
    if (modal) modal.classList.add('hidden');
}

function openClinicProfileModal() {
    openClinicSettingsModal('details');
}

function closeClinicProfileModal() {
    closeClinicSettingsModal();
}

async function saveClinicProfileFromModal() {
    try {
        await saveClinicProfile({
            clinicName: document.getElementById('clinicProfileName')?.value,
            address: document.getElementById('clinicProfileAddress')?.value,
            phone: document.getElementById('clinicProfilePhone')?.value,
            afterHoursPhone: document.getElementById('clinicProfileAfterHours')?.value,
            email: document.getElementById('clinicProfileEmail')?.value,
            smsInfo: document.getElementById('clinicProfileSms')?.value,
            website: document.getElementById('clinicProfileWebsite')?.value,
            urgentAdvice: document.getElementById('clinicProfileUrgent')?.value
        });
        showToast('Clinic contact details saved for patient advice sheets.');
    } catch (err) {
        showToast(err.message || 'Could not save clinic profile.');
    }
}

function clinicProfileContactLines() {
    const p = clinicProfile || emptyClinicProfile();
    const lines = [];
    if (p.clinicName) lines.push(p.clinicName);
    if (p.address) lines.push(p.address);
    if (p.phone) lines.push('Phone: ' + p.phone);
    if (p.afterHoursPhone) lines.push('After hours: ' + p.afterHoursPhone);
    if (p.email) lines.push('Email: ' + p.email);
    if (p.smsInfo) lines.push(p.smsInfo);
    if (p.website) lines.push(p.website);
    return lines;
}

function clinicProfileHasContacts() {
    return clinicProfileContactLines().length > 0;
}
