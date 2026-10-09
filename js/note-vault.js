/* Encrypted 7-day visit note snapshots: consult and procedure text, labelled by patient and time. */

const VISIT_NOTE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
let visitNoteSaveTimer = null;

function visitNoteFileName() {
    return typeof newOpaqueEncFileName === 'function'
        ? newOpaqueEncFileName('visit')
        : 'visit-' + Date.now() + '-' + Math.random().toString(16).slice(2) + '.json.enc';
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
    return /CLINICAL NOTE|PRE-PROCEDURAL|DOCUMENTED SKIN LESIONS|LESIONS DISCUSSED|OPERATIVE NOTE/i.test(t);
}

function procedureNoteIsSavable(text) {
    const t = String(text || '').trim();
    if (t.length < 40) return false;
    if (/^Your (generated|clinical)/i.test(t)) return false;
    return t.includes('OBJECTIVE:') || t.includes('PROCEDURE ') || t.includes('OPERATIVE NOTE');
}

function currentProcedureNoteText() {
    if (typeof visitProcedureWorkDone === 'function' && !visitProcedureWorkDone()) return '';
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
    if (typeof generateCompleteInteractionNote === 'function') {
        return generateCompleteInteractionNote();
    }
    if (typeof generateEMRNotePlainText !== 'function') return '';
    const includeScreening = typeof screeningAskedThisVisit === 'function' && screeningAskedThisVisit();
    return generateEMRNotePlainText({
        includeFullScreening: includeScreening,
        forceFull: includeScreening
    });
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
    await writeOpaqueEncryptedJson(dir, note, 'visit', vaultAuth.key);
}

async function deleteManagedVisitNoteFile(note) {
    if (!isVaultLoggedIn() || !note?.fileName) return false;
    const dir = await getUserNotesDir(vaultAuth.username, true);
    return await deleteTextFile(dir, note.fileName);
}

async function pruneExpiredVisitNotes() {
    const keep = [];
    let failed = 0;
    for (const note of managedVisitNotes.slice()) {
        if (!visitNoteIsExpired(note)) {
            keep.push(note);
            continue;
        }
        const ok = await deleteManagedVisitNoteFile(note);
        if (ok) continue;
        keep.push(note);
        failed += 1;
    }
    managedVisitNotes = keep;
    if (failed && typeof toastVaultDeleteFailure === 'function') toastVaultDeleteFailure('notes');
}

async function loadManagedVisitNotesFromVault() {
    managedVisitNotes = [];
    if (!isVaultLoggedIn()) return;
    const dir = await getUserNotesDir(vaultAuth.username, true);
    if (typeof recoverIncompleteVaultWrites === 'function') await recoverIncompleteVaultWrites(dir);
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
        if (typeof vaultLoadTickFile === 'function') vaultLoadTickFile();
    }
    await pruneExpiredVisitNotes();
    if (typeof dedupeVaultRecordsById === 'function') {
        managedVisitNotes = await dedupeVaultRecordsById(managedVisitNotes, 'visit', dir);
    }
    if (typeof migrateIdentifyingEncFilenames === 'function') {
        await migrateIdentifyingEncFilenames(managedVisitNotes, 'visit', dir, vaultAuth.key);
    }
    if (typeof migrateIdentifyingRecordIds === 'function') {
        await migrateIdentifyingRecordIds(managedVisitNotes, 'visit', (note) => writeManagedVisitNote(note));
    }
    managedVisitNotes.sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));
}

function visitNoteHasHistology(note) {
    return !!(String(note?.histologySlipText || '').trim() || String(note?.histologyPrintHtml || '').trim());
}

function visitNoteHasAdvice(note) {
    return !!String(note?.aftercareHtml || '').trim();
}

function collectVisitHistologyArtefact() {
    if (typeof currentHistologyRequestBundle !== 'function') return null;
    return currentHistologyRequestBundle();
}

function collectVisitAftercareArtefact() {
    if (typeof currentAftercareSheetBundle !== 'function') return null;
    const bundle = currentAftercareSheetBundle();
    if (!bundle || !String(bundle.html || '').trim()) return null;
    return bundle;
}

async function saveCurrentVisitNotes(options) {
    if (typeof applyingChartRecord !== 'undefined' && applyingChartRecord) return null;
    if (!hasCurrentPatient()) return null;
    const patient = typeof sessionPatientSnapshot === 'function' ? sessionPatientSnapshot() : currentPatient;
    const chartId = patient.chartId || currentPatient.chartId;
    if (!chartId) return null;

    let consult = options && options.consultText != null ? String(options.consultText) : '';
    if (!consult) {
        const chart = typeof currentManagedChart === 'function' ? currentManagedChart() : null;
        const copied = String(chart?.iemr?.examHash || '').trim();
        if (copied
            && typeof chartExamCopyIsCurrent === 'function'
            && chartExamCopyIsCurrent(chart)
            && consultNoteIsSavable(copied)) {
            consult = copied;
        } else {
            consult = currentConsultNoteText();
        }
    }
    const procedure = currentProcedureNoteText();
    const consultOk = consultNoteIsSavable(consult);
    const procedureOk = procedureNoteIsSavable(procedure);
    const histology = collectVisitHistologyArtefact();
    const advice = collectVisitAftercareArtefact();
    const procedureDone = typeof visitProcedureWorkDone === 'function' && visitProcedureWorkDone();
    const visitDate = typeof todayVisitKey === 'function' ? todayVisitKey() : new Date().toISOString().slice(0, 10);
    const now = new Date().toISOString();
    let note = findVisitNoteForDay(chartId, visitDate);
    const staleProcedureDocs = !!(note && !procedureDone && (
        String(note.procedureText || '').trim()
        || String(note.histologySlipText || '').trim()
        || String(note.histologyPrintHtml || '').trim()
    ));
    if (!consultOk && !procedureOk && !histology && !advice && !staleProcedureDocs) return null;
    if (!note) {
        note = {
            id: (typeof newOpaqueRecordId === 'function' ? newOpaqueRecordId('visit') : 'visit-' + Date.now()),
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
            histologySlipText: '',
            histologyReportText: '',
            histologyPrintHtml: '',
            aftercareHtml: '',
            aftercareTopics: [],
            fileName: visitNoteFileName(),
            owner: (typeof vaultAuth !== 'undefined' && vaultAuth.username) || ''
        };
    }
    if (consultOk) note.consultText = consult;
    if (procedureOk) note.procedureText = procedure;
    else if (!procedureDone) note.procedureText = '';
    if (histology) {
        note.histologySlipText = histology.slipText || '';
        note.histologyReportText = histology.reportText || '';
        note.histologyPrintHtml = histology.printHtml || '';
    } else if (!procedureDone) {
        note.histologySlipText = '';
        note.histologyReportText = '';
        note.histologyPrintHtml = '';
    }
    if (advice) {
        note.aftercareHtml = advice.html || '';
        note.aftercareTopics = Array.isArray(advice.topics) ? advice.topics.slice() : [];
    }
    note.patientName = patient.patientName || currentPatient.name || note.patientName;
    note.patientDob = patient.patientDob || currentPatient.dob || note.patientDob;
    note.clinician = patient.clinician || currentPatient.clinician || note.clinician;
    note.updatedAt = now;
    if (!note.expiresAt) note.expiresAt = visitNoteExpiresAt(note.createdAt || now);
    upsertVisitNoteMemory(note);
    if (isVaultLoggedIn()) await writeManagedVisitNote(note);
    if (typeof mgmtActiveFilter !== 'undefined' && mgmtActiveFilter === 'notes' && typeof renderManagedLesions === 'function') {
        renderManagedLesions();
    }
    if (typeof hasCurrentPatient === 'function' && hasCurrentPatient() && typeof renderChartTreeSavedDocs === 'function') {
        renderChartTreeSavedDocs();
    }
    return note;
}

function scheduleVisitNoteSave() {
    if (typeof applyingChartRecord !== 'undefined' && applyingChartRecord) return;
    if (!hasCurrentPatient()) return;
    clearTimeout(visitNoteSaveTimer);
    visitNoteSaveTimer = setTimeout(() => {
        saveCurrentVisitNotes().catch((err) => {
            console.warn('Could not autosave visit notes', err);
            if (typeof toastVaultWriteError === 'function') {
                toastVaultWriteError('Visit notes could not be saved to the clinic folder. Check folder access.');
            } else if (typeof showToast === 'function') {
                showToast('Visit notes could not be saved to the clinic folder. Check folder access.');
            }
        });
    }, 1200);
}

function persistCopiedIemrNote(text) {
    const copied = String(text || '').trim();
    if (!copied) {
        scheduleVisitNoteSave();
        return;
    }
    if (visitNoteSaveTimer) {
        clearTimeout(visitNoteSaveTimer);
        visitNoteSaveTimer = null;
    }
    saveCurrentVisitNotes({ consultText: copied }).catch((err) => {
        console.warn('Could not save copied IEMR as visit note', err);
        if (typeof toastVaultWriteError === 'function') {
            toastVaultWriteError('Visit notes could not be saved to the clinic folder. Check folder access.');
        }
    });
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
                    <p class="text-[11px] text-slate-500 mt-0.5">Autosaved consult notes, histology requests, and patient advice. Kept for 7 days, then deleted.</p>
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
    const id = String(note.id || '');
    const hasConsult = consultNoteIsSavable(note.consultText);
    const hasProc = procedureNoteIsSavable(note.procedureText);
    const idAttr = escapeHtml(id);
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
                    ${visitNoteHasHistology(note) ? '<span class="inline-flex items-center px-2 py-0.5 rounded bg-rose-100 text-rose-900 text-[10px] font-bold">Histology</span>' : ''}
                    ${visitNoteHasAdvice(note) ? '<span class="inline-flex items-center px-2 py-0.5 rounded bg-teal-100 text-teal-900 text-[10px] font-bold">Advice</span>' : ''}
                </div>
            </div>
            <div class="flex flex-wrap gap-1.5">
                ${(hasConsult || hasProc) ? `<button type="button" data-note-action="open" data-note-id="${idAttr}" class="mgmt-action-btn">View</button>` : ''}
                ${hasConsult ? `<button type="button" data-note-action="copy-consult" data-note-id="${idAttr}" class="mgmt-action-btn mgmt-action-btn-primary">Copy consult</button>` : ''}
                ${hasProc ? `<button type="button" data-note-action="copy-procedure" data-note-id="${idAttr}" class="mgmt-action-btn">Copy procedure</button>` : ''}
                ${visitNoteHasHistology(note) ? `<button type="button" data-note-action="open-histology" data-note-id="${idAttr}" class="mgmt-action-btn">Histology request</button>` : ''}
                ${visitNoteHasAdvice(note) ? `<button type="button" data-note-action="open-advice" data-note-id="${idAttr}" class="mgmt-action-btn">Patient advice</button>` : ''}
            </div>
        </article>`;
}

function openSavedVisitNote(id) {
    const note = findVisitNote(id);
    if (!note) {
        showToast('Saved note not found.');
        return;
    }
    const kind = (typeof consultNoteIsSavable === 'function' && consultNoteIsSavable(note.consultText))
        ? 'consult'
        : ((typeof procedureNoteIsSavable === 'function' && procedureNoteIsSavable(note.procedureText))
            ? 'procedure'
            : '');
    if (kind && typeof openSavedDocumentInInspector === 'function' && openSavedDocumentInInspector(kind, note.id)) {
        return;
    }
    const modal = document.getElementById('savedNoteModal');
    if (!modal) {
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

function visitArtefactPlainText(note, artefact) {
    if (artefact === 'histology') {
        const slip = String(note?.histologySlipText || '').trim();
        const report = String(note?.histologyReportText || '').trim();
        if (slip && report && slip !== report) return slip + '\n\n' + report;
        return slip || report;
    }
    return '';
}

function visitArtefactHtml(note, artefact) {
    if (artefact === 'histology') return String(note?.histologyPrintHtml || '').trim();
    if (artefact === 'advice') return String(note?.aftercareHtml || '').trim();
    return '';
}

function visitArtefactFilename(note, artefact) {
    const slug = String(note?.patientName || 'patient').replace(/[^\w]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
    const day = note?.visitDate || (typeof todayVisitKey === 'function' ? todayVisitKey() : 'visit');
    if (artefact === 'histology') return 'Histology-request-' + slug + '-' + day + '.html';
    return 'Patient-advice-' + slug + '-' + day + '.html';
}

function openSavedVisitArtefact(id, artefact) {
    const note = findVisitNote(id);
    const kind = artefact === 'advice' ? 'advice' : 'histology';
    if (!note) {
        showToast('Saved document not found.');
        return;
    }
    if (typeof openSavedDocumentInInspector === 'function' && openSavedDocumentInInspector(kind, note.id)) {
        return;
    }
    const modal = document.getElementById('savedHtmlDocModal');
    if (!modal) {
        showToast('Saved document not found.');
        return;
    }
    const html = visitArtefactHtml(note, kind);
    const text = visitArtefactPlainText(note, kind);
    if (!html && !text) {
        showToast(kind === 'advice' ? 'No patient advice was saved for this visit.' : 'No histology request was saved for this visit.');
        return;
    }
    const title = document.getElementById('savedHtmlDocTitle');
    const meta = document.getElementById('savedHtmlDocMeta');
    const textWrap = document.getElementById('savedHtmlDocTextWrap');
    const textEl = document.getElementById('savedHtmlDocText');
    const frame = document.getElementById('savedHtmlDocFrame');
    const copyBtn = document.getElementById('btnSavedHtmlDocCopy');
    if (title) title.textContent = kind === 'advice' ? 'Patient advice' : 'Histology request';
    if (meta) {
        const when = typeof formatLesionWhen === 'function' ? formatLesionWhen(note.updatedAt) : note.updatedAt;
        meta.textContent = [note.patientName, note.patientDob, when ? 'Saved ' + when : ''].filter(Boolean).join(' · ');
    }
    if (textEl) textEl.value = text;
    if (textWrap) textWrap.classList.toggle('hidden', !text);
    if (copyBtn) copyBtn.classList.toggle('hidden', !text);
    if (frame) frame.srcdoc = html || '<p style="padding:16px;font-family:system-ui">No printable copy was saved.</p>';
    modal.dataset.noteId = note.id;
    modal.dataset.artefact = kind;
    modal.classList.remove('hidden');
}

function closeSavedHtmlDoc() {
    const modal = document.getElementById('savedHtmlDocModal');
    if (modal) {
        modal.classList.add('hidden');
        delete modal.dataset.noteId;
        delete modal.dataset.artefact;
    }
    const frame = document.getElementById('savedHtmlDocFrame');
    if (frame) frame.srcdoc = '';
}

function savedHtmlDocContext() {
    const modal = document.getElementById('savedHtmlDocModal');
    const note = findVisitNote(modal?.dataset.noteId);
    const artefact = modal?.dataset.artefact || 'histology';
    return { note, artefact };
}

function copySavedHtmlDoc() {
    const { note, artefact } = savedHtmlDocContext();
    if (!note) {
        showToast('Saved document not found.');
        return;
    }
    const text = visitArtefactPlainText(note, artefact);
    if (!text) {
        showToast('No text to copy. Use Print for the PDF copy.');
        return;
    }
    copyTextToClipboard(text, artefact === 'histology' ? 'Histology request copied.' : 'Patient advice copied.');
}

function printSavedHtmlDoc() {
    const { note, artefact } = savedHtmlDocContext();
    if (!note) {
        showToast('Saved document not found.');
        return;
    }
    const html = visitArtefactHtml(note, artefact);
    const text = visitArtefactPlainText(note, artefact);
    const payload = html || ('<pre style="white-space:pre-wrap;font-family:system-ui,sans-serif;font-size:12px;padding:16px;">'
        + String(text || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        + '</pre><script>window.onload=function(){window.print();}</script>');
    if (!html && !text) {
        showToast('No document content was saved.');
        return;
    }
    const printWin = window.open('', '_blank', 'width=850,height=950');
    if (!printWin) {
        showToast('Unable to open print window. Please check popup permissions.');
        return;
    }
    printWin.document.open();
    printWin.document.write(html ? html : payload);
    if (html) {
        printWin.document.close();
        printWin.focus();
        printWin.print();
        return;
    }
    printWin.document.close();
}

function downloadSavedHtmlDoc() {
    const { note, artefact } = savedHtmlDocContext();
    if (!note) {
        showToast('Saved document not found.');
        return;
    }
    const html = visitArtefactHtml(note, artefact);
    const text = visitArtefactPlainText(note, artefact);
    const body = html || ('<!DOCTYPE html><pre style="white-space:pre-wrap;font-family:system-ui,sans-serif;font-size:12px;padding:16px;">'
        + String(text || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        + '</pre>');
    if (!html && !text) {
        showToast('No document content was saved.');
        return;
    }
    const blob = new Blob([body], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = visitArtefactFilename(note, artefact);
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
}
