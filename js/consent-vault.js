/* Encrypted 7-day surgical consent snapshots for BP Premier copy / reprint. */

const CONSENT_DOC_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function consentDocFileName(chartId, createdAt) {
    const stem = String(chartId || 'patient')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 50) || 'patient';
    const stamp = String(createdAt || new Date().toISOString()).replace(/[:.]/g, '-');
    return 'consent-' + stem + '-' + stamp + '.json.enc';
}

function consentDocExpiresAt(fromIso) {
    const t = Date.parse(fromIso);
    const start = Number.isNaN(t) ? Date.now() : t;
    return new Date(start + CONSENT_DOC_TTL_MS).toISOString();
}

function consentDocIsExpired(doc) {
    const expiry = Date.parse(doc?.expiresAt || '');
    if (!Number.isNaN(expiry)) return expiry <= Date.now();
    const created = Date.parse(doc?.createdAt || '');
    if (Number.isNaN(created)) return false;
    return created + CONSENT_DOC_TTL_MS <= Date.now();
}

function consentDocDaysLeft(doc) {
    const expiry = Date.parse(doc?.expiresAt || consentDocExpiresAt(doc?.createdAt));
    if (Number.isNaN(expiry)) return 7;
    return Math.max(0, Math.ceil((expiry - Date.now()) / (24 * 60 * 60 * 1000)));
}

function findConsentDoc(id) {
    return (managedConsents || []).find((item) => String(item.id) === String(id)) || null;
}

function upsertConsentDocMemory(doc) {
    const idx = managedConsents.findIndex((item) => item.id === doc.id);
    if (idx === -1) managedConsents.unshift(doc);
    else managedConsents[idx] = doc;
    managedConsents.sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
}

function adminConsentDocs() {
    const docs = (managedConsents || []).filter((item) => !consentDocIsExpired(item));
    if (hasCurrentPatient()) {
        return docs.filter((item) => item.chartId === currentPatient.chartId);
    }
    return docs;
}

async function writeManagedConsentDoc(doc) {
    if (!isVaultLoggedIn() || !doc?.id) return;
    const dir = await getUserConsentsDir(vaultAuth.username, true);
    const name = doc.fileName || consentDocFileName(doc.chartId, doc.createdAt);
    doc.fileName = name;
    const payload = await encryptJson(vaultAuth.key, doc);
    await writeTextFile(dir, name, JSON.stringify(payload));
}

async function deleteManagedConsentDocFile(doc) {
    if (!isVaultLoggedIn() || !doc) return;
    const dir = await getUserConsentsDir(vaultAuth.username, true);
    await deleteTextFile(dir, doc.fileName || consentDocFileName(doc.chartId, doc.createdAt));
}

async function pruneExpiredConsentDocs() {
    const keep = [];
    for (const doc of managedConsents.slice()) {
        if (!consentDocIsExpired(doc)) {
            keep.push(doc);
            continue;
        }
        await deleteManagedConsentDocFile(doc);
    }
    managedConsents = keep;
}

async function loadManagedConsentsFromVault() {
    managedConsents = [];
    if (!isVaultLoggedIn()) return;
    const dir = await getUserConsentsDir(vaultAuth.username, true);
    for await (const [name, handle] of dir.entries()) {
        if (handle.kind !== 'file' || !name.endsWith('.json.enc')) continue;
        try {
            const text = await handle.getFile().then((f) => f.text());
            const doc = await decryptJson(vaultAuth.key, JSON.parse(text));
            if (doc && doc.id) {
                doc.fileName = name;
                managedConsents.push(doc);
            }
        } catch (err) {
            console.warn('Skipped unreadable consent doc', name);
        }
    }
    await pruneExpiredConsentDocs();
    managedConsents.sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
}

async function saveGeneratedConsentDoc(data, plainText, printHtml) {
    if (!hasCurrentPatient()) return null;
    const text = String(plainText || '').trim();
    if (text.length < 40) return null;
    const patient = typeof sessionPatientSnapshot === 'function' ? sessionPatientSnapshot() : currentPatient;
    const chartId = patient.chartId || currentPatient.chartId;
    if (!chartId) return null;
    const now = new Date().toISOString();
    const procedures = Array.isArray(data?.procedures) ? data.procedures : [];
    const doc = {
        id: 'consent-' + chartId + '-' + Date.now(),
        chartId,
        patientName: patient.patientName || currentPatient.name || data?.name || '',
        patientDob: patient.patientDob || currentPatient.dob || data?.dob || '',
        clinician: patient.clinician || currentPatient.clinician || data?.doctor || '',
        createdAt: now,
        expiresAt: consentDocExpiresAt(now),
        plainText: text,
        printHtml: String(printHtml || ''),
        lesionIds: [...new Set(procedures.map((p) => p.lesionId).filter(Boolean).map(String))],
        procedures: procedures.map((p) => ({
            lesionId: p.lesionId || '',
            procedureKind: p.procedureKind || '',
            location: p.location || '',
            diagnosis: p.diagnosis || ''
        })),
        fileName: consentDocFileName(chartId, now),
        owner: (typeof vaultAuth !== 'undefined' && vaultAuth.username) || ''
    };
    upsertConsentDocMemory(doc);
    if (isVaultLoggedIn()) await writeManagedConsentDoc(doc);
    if (mgmtActiveFilter === 'notes' && typeof renderManagedLesions === 'function') renderManagedLesions();
    return doc;
}

function renderSavedConsentDocsQueue(docs) {
    const items = docs || adminConsentDocs();
    return `
        <section class="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden lg:col-span-2">
            <header class="px-4 py-3 bg-violet-50 border-b border-violet-200 flex flex-wrap justify-between items-center gap-2">
                <div>
                    <h3 class="text-sm font-bold text-slate-800">Saved consents</h3>
                    <p class="text-[11px] text-slate-500 mt-0.5">Generated surgical consent text for BP Premier copy or reprint. Kept for 7 days, then deleted. Email from BP Premier after paste.</p>
                </div>
                <span class="text-[11px] font-semibold text-slate-500">${items.length}</span>
            </header>
            <div class="divide-y divide-slate-100">
                ${items.length ? items.map(renderSavedConsentDocCard).join('') : '<p class="p-4 text-slate-400 italic text-sm">No saved consents in the last 7 days.</p>'}
            </div>
        </section>`;
}

function renderSavedConsentDocCard(doc) {
    const when = typeof formatLesionWhen === 'function'
        ? formatLesionWhen(doc.createdAt)
        : (doc.createdAt || '');
    const days = consentDocDaysLeft(doc);
    const id = String(doc.id || '').replace(/'/g, '');
    const n = Array.isArray(doc.procedures) ? doc.procedures.length : 0;
    const sites = (doc.procedures || []).map((p) => p.location).filter(Boolean).slice(0, 3).join(', ');
    return `
        <article class="p-4 space-y-2">
            <div class="flex flex-wrap justify-between gap-2">
                <div class="min-w-0">
                    <p class="text-sm font-semibold text-slate-800">${escapeHtml(doc.patientName || 'Unnamed patient')}</p>
                    <p class="text-xs text-slate-600">${escapeHtml(doc.patientDob || '')}${doc.clinician ? ' · ' + escapeHtml(doc.clinician) : ''}</p>
                    <p class="text-[11px] text-slate-500">Saved ${escapeHtml(when)} · kept ${days} more day${days === 1 ? '' : 's'} · ${n} procedure${n === 1 ? '' : 's'}${sites ? ' · ' + escapeHtml(sites) : ''}</p>
                </div>
                <span class="inline-flex items-center px-2 py-0.5 rounded bg-violet-100 text-violet-900 text-[10px] font-bold shrink-0">Consent</span>
            </div>
            <div class="flex flex-wrap gap-1.5">
                <button type="button" onclick="openSavedConsentDoc('${id}')" class="mgmt-action-btn">View</button>
                <button type="button" onclick="copySavedConsentDoc('${id}')" class="mgmt-action-btn mgmt-action-btn-primary">Copy for BP</button>
                <button type="button" onclick="printSavedConsentDoc('${id}')" class="mgmt-action-btn">Print</button>
            </div>
        </article>`;
}

function openSavedConsentDoc(id) {
    const doc = findConsentDoc(id);
    const modal = document.getElementById('savedConsentModal');
    if (!doc || !modal) {
        showToast('Saved consent not found.');
        return;
    }
    const title = document.getElementById('savedConsentTitle');
    const meta = document.getElementById('savedConsentMeta');
    const body = document.getElementById('savedConsentBody');
    if (title) title.textContent = doc.patientName || 'Saved consent';
    if (meta) {
        const when = typeof formatLesionWhen === 'function' ? formatLesionWhen(doc.createdAt) : doc.createdAt;
        const n = Array.isArray(doc.procedures) ? doc.procedures.length : 0;
        meta.textContent = (doc.patientDob || '') + (when ? ' · Saved ' + when : '') + ' · ' + n + ' procedure' + (n === 1 ? '' : 's') + ' · Deletes after 7 days';
    }
    if (body) body.value = doc.plainText || '';
    modal.dataset.consentId = doc.id;
    modal.classList.remove('hidden');
}

function closeSavedConsentDoc() {
    const modal = document.getElementById('savedConsentModal');
    if (modal) {
        modal.classList.add('hidden');
        delete modal.dataset.consentId;
    }
}

function copySavedConsentDoc(id) {
    const doc = findConsentDoc(id) || findConsentDoc(document.getElementById('savedConsentModal')?.dataset.consentId);
    if (!doc) {
        showToast('Saved consent not found.');
        return;
    }
    if (!String(doc.plainText || '').trim()) {
        showToast('No consent text was saved.');
        return;
    }
    copyTextToClipboard(doc.plainText, 'Consent copied for BP Premier.');
}

function copySavedConsentDocFromModal() {
    copySavedConsentDoc(document.getElementById('savedConsentModal')?.dataset.consentId);
}

function printSavedConsentDoc(id) {
    const doc = findConsentDoc(id) || findConsentDoc(document.getElementById('savedConsentModal')?.dataset.consentId);
    if (!doc) {
        showToast('Saved consent not found.');
        return;
    }
    const html = String(doc.printHtml || '').trim()
        || ('<pre style="white-space:pre-wrap;font-family:system-ui,sans-serif;font-size:12px;padding:16px;">'
            + String(doc.plainText || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            + '</pre><script>window.onload=function(){window.print();}</script>');
    if (!String(doc.plainText || '').trim() && !String(doc.printHtml || '').trim()) {
        showToast('No consent content was saved.');
        return;
    }
    const printWin = window.open('', '_blank', 'width=850,height=950');
    if (printWin) {
        printWin.document.open();
        printWin.document.write(html);
        printWin.document.close();
        return;
    }
    showToast('Unable to open print window. Please check popup permissions.');
}

function printSavedConsentDocFromModal() {
    printSavedConsentDoc(document.getElementById('savedConsentModal')?.dataset.consentId);
}
