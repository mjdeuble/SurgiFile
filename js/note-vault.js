/* Encrypted 7-day visit note snapshots: consult and procedure text, labelled by patient and time. */

const VISIT_NOTE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
let visitNoteSaveTimer = null;

function visitNoteFileName(chartId, visitDate) {
    const stem = String(chartId || 'patient')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 50) || 'patient';
    return 'visit-' + stem + '-' + visitDate + '.json.enc';
}

function visitNoteExpiresAt(fromIso) {
    const t = Date.parse(fromIso);
    const start = Number.isNaN(t) ? Date.now() : t;
    return new Date(start + VISIT_NOTE_TTL_MS).toISOString();
}

function visitNoteIsExpired(note) {
    const expiry = Date.parse(note?.expiresAt || '');
    if (!Number.isNaN(expiry)) return expiry <= Date.now();
    const created = Date.parse(note?.createdAt || '');
    if (Number.isNaN(created)) return false;
    return created + VISIT_NOTE_TTL_MS <= Date.now();
}

function consultNoteIsSavable(text) {
    const t = String(text || '').trim();
    if (t.length < 40) return false;
    if (/^Your (generated|clinical)/i.test(t)) return false;
    return t.includes('SKIN EXAMINATION CLINICAL NOTE') || t.includes('PRE-PROCEDURAL') || t.includes('DOCUMENTED SKIN LESIONS');
}

function procedureNoteIsSavable(text) {
    const t = String(text || '').trim();
    if (t.length < 40) return false;
    if (/^Your (generated|clinical)/i.test(t)) return false;
    return t.includes('OBJECTIVE:') || t.includes('PROCEDURE ') || t.includes('OPERATIVE NOTE');
}

function currentProcedureNoteText() {
    if (typeof generateExEntryNote !== 'function') return '';
    const note = generateExEntryNote();
    if (!procedureNoteIsSavable(note)) return '';
    let request = '';
    if (typeof generateExClinicalRequest === 'function') {
        const req = generateExClinicalRequest();
        if (req && !/^Your /i.test(req.trim())) request = '\n\n---\n\nCLINICAL REQUEST:\n' + req.trim();
    }
    return (note.trim() + request).trim();
}

function currentConsultNoteText() {
    if (typeof generateEMRNotePlainText !== 'function') return '';
    return generateEMRNotePlainText({ includeFullScreening: true, forceFull: true });
}

function notesPendingCopy() {
    const consultText = currentConsultNoteText();
    const procedureText = currentProcedureNoteText();
    const consultExists = consultNoteIsSavable(consultText);
    const procedureExists = procedureNoteIsSavable(procedureText);
    const hasContent = consultExists || procedureExists;
    const copyCurrent = typeof chartExamCopyIsCurrent === 'function' && chartExamCopyIsCurrent();
    const pending = hasContent && !copyCurrent;
    return {
        pending,
        consultPending: consultExists && !copyCurrent,
        procedurePending: procedureExists && !copyCurrent,
        consultExists,
        procedureExists,
        todayPending: pending
    };
}

function findVisitNote(id) {
    return (managedVisitNotes || []).find((item) => String(item.id) === String(id)) || null;
}

function findVisitNoteForDay(chartId, visitDate) {
    return (managedVisitNotes || []).find((item) => item.chartId === chartId && item.visitDate === visitDate) || null;
}

function upsertVisitNoteMemory(note) {
    const idx = managedVisitNotes.findIndex((item) => item.id === note.id);
    if (idx === -1) managedVisitNotes.unshift(note);
    else managedVisitNotes[idx] = note;
    managedVisitNotes.sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));
}

function adminVisitNotes() {
    const notes = (managedVisitNotes || []).filter((item) => !visitNoteIsExpired(item));
    if (hasCurrentPatient()) {
        return notes.filter((item) => item.chartId === currentPatient.chartId);
    }
    return notes;
}

async function writeManagedVisitNote(note) {
    if (!isVaultLoggedIn() || !note?.id) return;
    const dir = await getUserNotesDir(vaultAuth.username, true);
    const name = note.fileName || visitNoteFileName(note.chartId, note.visitDate);
    note.fileName = name;
    const payload = await encryptJson(vaultAuth.key, note);
    await writeTextFile(dir, name, JSON.stringify(payload));
}

async function deleteManagedVisitNoteFile(note) {
    if (!isVaultLoggedIn() || !note) return;
    const dir = await getUserNotesDir(vaultAuth.username, true);
    await deleteTextFile(dir, note.fileName || visitNoteFileName(note.chartId, note.visitDate));
}

async function pruneExpiredVisitNotes() {
    const keep = [];
    for (const note of managedVisitNotes.slice()) {
        if (!visitNoteIsExpired(note)) {
            keep.push(note);
            continue;
        }
        await deleteManagedVisitNoteFile(note);
    }
    managedVisitNotes = keep;
}

async function loadManagedVisitNotesFromVault() {
    managedVisitNotes = [];
    if (!isVaultLoggedIn()) return;
    const dir = await getUserNotesDir(vaultAuth.username, true);
    for await (const [name, handle] of dir.entries()) {
        if (handle.kind !== 'file' || !name.endsWith('.json.enc')) continue;
        try {
            const text = await handle.getFile().then((f) => f.text());
            const note = await decryptJson(vaultAuth.key, JSON.parse(text));
            if (note && note.id) {
                note.fileName = name;
                managedVisitNotes.push(note);
            }
        } catch (err) {
            console.warn('Skipped unreadable visit note', name);
        }
    }
    await pruneExpiredVisitNotes();
    managedVisitNotes.sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));
}

async function saveCurrentVisitNotes() {
    if (typeof applyingChartRecord !== 'undefined' && applyingChartRecord) return null;
    if (!hasCurrentPatient()) return null;
    const patient = typeof sessionPatientSnapshot === 'function' ? sessionPatientSnapshot() : currentPatient;
    const chartId = patient.chartId || currentPatient.chartId;
    if (!chartId) return null;

    const consult = currentConsultNoteText();
    const procedure = currentProcedureNoteText();
    const consultOk = consultNoteIsSavable(consult);
    const procedureOk = procedureNoteIsSavable(procedure);
    if (!consultOk && !procedureOk) return null;

    const visitDate = typeof todayVisitKey === 'function' ? todayVisitKey() : new Date().toISOString().slice(0, 10);
    const now = new Date().toISOString();
    let note = findVisitNoteForDay(chartId, visitDate);
    if (!note) {
        note = {
            id: 'visit-' + chartId + '-' + visitDate,
            chartId,
            patientName: patient.patientName || currentPatient.name || '',
            patientDob: patient.patientDob || currentPatient.dob || '',
            clinician: patient.clinician || currentPatient.clinician || '',
            visitDate,
            createdAt: now,
            updatedAt: now,
            expiresAt: visitNoteExpiresAt(now),
            consultText: '',
            procedureText: '',
            fileName: visitNoteFileName(chartId, visitDate),
            owner: (typeof vaultAuth !== 'undefined' && vaultAuth.username) || ''
        };
    }
    if (consultOk) note.consultText = consult;
    if (procedureOk) note.procedureText = procedure;
    note.patientName = patient.patientName || currentPatient.name || note.patientName;
    note.patientDob = patient.patientDob || currentPatient.dob || note.patientDob;
    note.clinician = patient.clinician || currentPatient.clinician || note.clinician;
    note.updatedAt = now;
    if (!note.expiresAt) note.expiresAt = visitNoteExpiresAt(note.createdAt || now);
    upsertVisitNoteMemory(note);
    if (isVaultLoggedIn()) await writeManagedVisitNote(note);
    if (mgmtActiveFilter === 'notes' && typeof renderManagedLesions === 'function') renderManagedLesions();
    return note;
}

function scheduleVisitNoteSave() {
    if (typeof applyingChartRecord !== 'undefined' && applyingChartRecord) return;
    if (!hasCurrentPatient()) return;
    clearTimeout(visitNoteSaveTimer);
    visitNoteSaveTimer = setTimeout(() => {
        saveCurrentVisitNotes().catch((err) => {
            console.warn('Could not autosave visit notes', err);
        });
    }, 1200);
}

function visitNoteDaysLeft(note) {
    const expiry = Date.parse(note?.expiresAt || visitNoteExpiresAt(note?.createdAt));
    if (Number.isNaN(expiry)) return 7;
    return Math.max(0, Math.ceil((expiry - Date.now()) / (24 * 60 * 60 * 1000)));
}

function renderSavedVisitNotesQueue(notes) {
    const items = notes || adminVisitNotes();
    return `
        <section class="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden lg:col-span-2">
            <header class="px-4 py-3 bg-sky-50 border-b border-sky-200 flex flex-wrap justify-between items-center gap-2">
                <div>
                    <h3 class="text-sm font-bold text-slate-800">Saved notes</h3>
                    <p class="text-[11px] text-slate-500 mt-0.5">Autosaved consult and procedure notes, labelled by patient and time. Kept for 7 days, then deleted.</p>
                </div>
                <span class="text-[11px] font-semibold text-slate-500">${items.length}</span>
            </header>
            <div class="divide-y divide-slate-100">
                ${items.length ? items.map(renderSavedVisitNoteCard).join('') : '<p class="p-4 text-slate-400 italic text-sm">No autosaved notes in the last 7 days.</p>'}
            </div>
        </section>`;
}

function renderSavedVisitNoteCard(note) {
    const when = typeof formatLesionWhen === 'function'
        ? formatLesionWhen(note.updatedAt || note.createdAt)
        : (note.updatedAt || '');
    const days = visitNoteDaysLeft(note);
    const id = String(note.id || '').replace(/'/g, '');
    const hasConsult = consultNoteIsSavable(note.consultText);
    const hasProc = procedureNoteIsSavable(note.procedureText);
    return `
        <article class="p-4 space-y-2">
            <div class="flex flex-wrap justify-between gap-2">
                <div class="min-w-0">
                    <p class="text-sm font-semibold text-slate-800">${escapeHtml(note.patientName || 'Unnamed patient')}</p>
                    <p class="text-xs text-slate-600">${escapeHtml(note.patientDob || '')}${note.clinician ? ' · ' + escapeHtml(note.clinician) : ''}</p>
                    <p class="text-[11px] text-slate-500">Saved ${escapeHtml(when)} · kept ${days} more day${days === 1 ? '' : 's'}</p>
                </div>
                <div class="flex flex-wrap gap-1 shrink-0">
                    ${hasConsult ? '<span class="inline-flex items-center px-2 py-0.5 rounded bg-sky-100 text-sky-900 text-[10px] font-bold">Consult</span>' : ''}
                    ${hasProc ? '<span class="inline-flex items-center px-2 py-0.5 rounded bg-violet-100 text-violet-900 text-[10px] font-bold">Procedure</span>' : ''}
                </div>
            </div>
            <div class="flex flex-wrap gap-1.5">
                <button type="button" onclick="openSavedVisitNote('${id}')" class="mgmt-action-btn">View</button>
                ${hasConsult ? `<button type="button" onclick="copySavedVisitNote('${id}', 'consult')" class="mgmt-action-btn mgmt-action-btn-primary">Copy consult</button>` : ''}
                ${hasProc ? `<button type="button" onclick="copySavedVisitNote('${id}', 'procedure')" class="mgmt-action-btn">Copy procedure</button>` : ''}
            </div>
        </article>`;
}

function openSavedVisitNote(id) {
    const note = findVisitNote(id);
    const modal = document.getElementById('savedNoteModal');
    if (!note || !modal) {
        showToast('Saved note not found.');
        return;
    }
    const title = document.getElementById('savedNoteTitle');
    const meta = document.getElementById('savedNoteMeta');
    const consultEl = document.getElementById('savedNoteConsult');
    const procEl = document.getElementById('savedNoteProcedure');
    const consultWrap = document.getElementById('savedNoteConsultWrap');
    const procWrap = document.getElementById('savedNoteProcedureWrap');
    if (title) title.textContent = note.patientName || 'Saved note';
    if (meta) {
        const when = typeof formatLesionWhen === 'function' ? formatLesionWhen(note.updatedAt) : note.updatedAt;
        meta.textContent = (note.patientDob || '') + (when ? ' · Saved ' + when : '') + ' · Deletes after 7 days';
    }
    if (consultEl) consultEl.value = note.consultText || '';
    if (procEl) procEl.value = note.procedureText || '';
    if (consultWrap) consultWrap.classList.toggle('hidden', !consultNoteIsSavable(note.consultText));
    if (procWrap) procWrap.classList.toggle('hidden', !procedureNoteIsSavable(note.procedureText));
    modal.dataset.noteId = note.id;
    modal.classList.remove('hidden');
}

function closeSavedVisitNote() {
    const modal = document.getElementById('savedNoteModal');
    if (modal) {
        modal.classList.add('hidden');
        delete modal.dataset.noteId;
    }
}

function copySavedVisitNote(id, kind) {
    const note = findVisitNote(id) || findVisitNote(document.getElementById('savedNoteModal')?.dataset.noteId);
    if (!note) {
        showToast('Saved note not found.');
        return;
    }
    const text = kind === 'procedure' ? note.procedureText : note.consultText;
    const label = kind === 'procedure' ? 'Procedure note copied.' : 'Consult note copied.';
    if (!String(text || '').trim()) {
        showToast(kind === 'procedure' ? 'No procedure note was saved for this visit.' : 'No consult note was saved for this visit.');
        return;
    }
    copyTextToClipboard(text, label);
}

function copySavedVisitNoteFromModal(kind) {
    copySavedVisitNote(document.getElementById('savedNoteModal')?.dataset.noteId, kind);
}
