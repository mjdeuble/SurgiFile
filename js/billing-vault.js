/* Encrypted billing records, stored separately from lesion management JSON. */

const BILLING_STATUSES = {
    awaiting: 'Awaiting processing',
    confirmed: 'Confirmed',
    processed: 'Processed'
};

function billingHasBeenSent(bill) {
    return bill?.status === 'confirmed' || bill?.status === 'processed';
}

function newBillingId() {
    if (crypto.randomUUID) return 'bill-' + crypto.randomUUID();
    return 'bill-' + Date.now() + '-' + Math.random().toString(16).slice(2);
}

function billingForLesion(lesionId) {
    return (typeof managedBillings !== 'undefined' ? managedBillings : []).find((item) => String(item.lesionId) === String(lesionId)) || null;
}

function findManagedBilling(id) {
    return (typeof managedBillings !== 'undefined' ? managedBillings : []).find((item) => String(item.id) === String(id))
        || billingForLesion(id);
}

function isLesionBillingProcessed(lesionId) {
    return billingHasBeenSent(billingForLesion(lesionId));
}

function billingStatusLabel(bill) {
    if (!bill) return 'No billing';
    return BILLING_STATUSES[bill.status] || bill.status;
}

function snapshotBillingFromLesion(lesion, existing) {
    const now = new Date().toISOString();
    const patient = sessionPatientSnapshot();
    const detail = typeof procedureDetailForLesion === 'function' ? procedureDetailForLesion(lesion) : {};
    const kind = typeof billingProcedureKind === 'function' ? billingProcedureKind(lesion) : '';
    const biopsy = kind === 'biopsy';
    const suggestion = typeof suggestMbsItems === 'function' ? suggestMbsItems(lesion) : null;
    return {
        ...(existing || {}),
        id: existing?.id || newBillingId(),
        lesionId: lesion.id,
        chartId: lesion.chartId || patient.chartId || '',
        patientName: lesion.patientName || patient.patientName || '',
        patientDob: lesion.patientDob || patient.patientDob || '',
        patientPhone: lesion.patientPhone || patient.patientPhone || '',
        clinician: lesion.clinician || patient.clinician || '',
        location: detail.location || lesion.location || '',
        impression: detail.pathology || lesion.impression || '',
        procedureType: detail.procedure || lesion.procedure || '',
        punchSize: detail.punchSize || lesion.punchSize || '',
        type: lesion.type || (typeof lesionType === 'function' ? lesionType(lesion) : '') || existing?.type || '',
        biopsyType: lesion.biopsyType || existing?.biopsyType || '',
        punchType: detail.punchType || lesion.punchType || '',
        procedure: detail.procedure || lesion.procedure || '',
        billingRegion: detail.billingRegion || lesion.billingRegion || '',
        excisionLengthMm: biopsy ? '' : (detail.length || lesion.excisionLengthMm || ''),
        excisionWidthMm: biopsy ? '' : (detail.width || lesion.excisionWidthMm || ''),
        excisionMarginMm: biopsy ? '' : (detail.margin || lesion.excisionMarginMm || ''),
        excisionClosureType: biopsy ? '' : (detail.excisionClosureType || lesion.excisionClosureType || ''),
        graftType: detail.graftType || lesion.graftType || lesion.billingGraftType || '',
        billingGraftType: lesion.billingGraftType || detail.graftType || existing?.billingGraftType || '',
        billingLesionType: (typeof inferBillingLesionType === 'function' ? inferBillingLesionType(lesion) : '')
            || lesion.billingLesionType
            || existing?.billingLesionType
            || '',
        billingReconstruction: biopsy ? '' : (lesion.billingReconstruction || existing?.billingReconstruction || ''),
        includeFlapGraft: lesion.includeFlapGraft ?? existing?.includeFlapGraft,
        histologyResult: lesion.histologyResult || existing?.histologyResult || '',
        suggestedMbsItems: (suggestion && suggestion.ready && suggestion.summary)
            || lesion.suggestedMbsItems
            || existing?.suggestedMbsItems
            || '',
        assignedMbsItems: existing?.assignedMbsItems || lesion.assignedMbsItems || '',
        excludeConsult: existing?.excludeConsult ?? false,
        consultItem: existing?.consultItem || '',
        recommendationAccepted: existing?.recommendationAccepted || false,
        status: existing?.status || 'awaiting',
        billWhen: existing?.billWhen || '',
        receptionNote: existing?.receptionNote || '',
        createdAt: existing?.createdAt || now,
        updatedAt: now,
        confirmedAt: existing?.confirmedAt || '',
        processedAt: existing?.processedAt || '',
        owner: vaultAuth.username || existing?.owner || '',
        history: existing?.history || []
    };
}

function upsertManagedBillingMemory(bill) {
    const idx = managedBillings.findIndex((item) => item.id === bill.id);
    if (idx === -1) managedBillings.unshift(bill);
    else managedBillings[idx] = bill;
}

async function writeManagedBilling(bill) {
    if (!isVaultLoggedIn()) return;
    const dir = await getUserBillingDir(vaultAuth.username, true);
    const payload = await encryptJson(vaultAuth.key, bill);
    await writeTextFile(dir, bill.id + '.json.enc', JSON.stringify(payload));
}

async function saveManagedBillingRecord(bill, action, note) {
    bill.updatedAt = new Date().toISOString();
    if (!Array.isArray(bill.history)) bill.history = [];
    bill.history.push({
        at: bill.updatedAt,
        action: action || bill.status,
        note: note || '',
        by: vaultAuth.username || ''
    });
    if (bill.history.length > 40) bill.history = bill.history.slice(-40);
    upsertManagedBillingMemory(bill);
    if (isVaultLoggedIn()) await writeManagedBilling(bill);
}

async function loadManagedBillingsFromVault() {
    managedBillings = [];
    if (!isVaultLoggedIn()) return;
    const dir = await getUserBillingDir(vaultAuth.username, true);
    for await (const [name, handle] of dir.entries()) {
        if (handle.kind !== 'file' || !name.endsWith('.json.enc')) continue;
        try {
            const text = await handle.getFile().then((f) => f.text());
            const bill = await decryptJson(vaultAuth.key, JSON.parse(text));
            if (bill && bill.id) managedBillings.push(bill);
        } catch (err) {
            console.warn('Skipped unreadable billing file', name);
        }
    }
    managedBillings.sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));
    await migrateBillingQueueStatuses();
}

async function migrateBillingQueueStatuses() {
    for (const bill of managedBillings) {
        if (bill.status === 'processed' && !bill.confirmedAt) {
            bill.status = 'confirmed';
            bill.confirmedAt = bill.processedAt || bill.updatedAt || new Date().toISOString();
            bill.processedAt = '';
            await saveManagedBillingRecord(bill, 'migrated:confirmed', 'Moved previously sent billing into confirmed queue');
        }
    }
}

async function createOrUpdateBillingFromLesion(lesion) {
    if (!lesion?.id) return null;
    if (typeof applyInferredBillingLesionType === 'function') {
        applyInferredBillingLesionType(lesion);
    } else if (typeof inferBillingLesionType === 'function' && !lesion.billingLesionType) {
        const inferred = inferBillingLesionType(lesion);
        if (inferred) lesion.billingLesionType = inferred;
    }
    if (typeof suggestMbsItems === 'function') {
        const suggestion = suggestMbsItems(lesion);
        if (suggestion.ready && suggestion.summary) lesion.suggestedMbsItems = suggestion.summary;
    }
    const existing = billingForLesion(lesion.id);
    const bill = snapshotBillingFromLesion(lesion, existing);
    if (!existing) bill.status = 'awaiting';
    if (typeof lesionCanBillAtProcedure === 'function') {
        const readiness = lesionCanBillAtProcedure(lesion);
        bill.billWhen = readiness.hold ? 'hold' : 'now';
        bill.receptionNote = readiness.reason || '';
    }
    lesion.billingRecordId = bill.id;
    await saveManagedBillingRecord(bill, existing ? 'updated' : 'created', lesion.location || '');
    const managed = managedLesions.find((item) => String(item.id) === String(lesion.id));
    if (managed) {
        managed.billingRecordId = bill.id;
        if (lesion.billingLesionType) managed.billingLesionType = lesion.billingLesionType;
        if (isVaultLoggedIn()) {
            try { await writeManagedLesion(managed); } catch (err) { /* billing file is the source of truth */ }
        }
    }
    return bill;
}

async function syncBillingFromLesion(lesion) {
    const existing = billingForLesion(lesion.id);
    if (!existing) return null;
    const bill = snapshotBillingFromLesion(lesion, existing);
    await saveManagedBillingRecord(bill, 'synced', lesion.histologyResult || '');
    return bill;
}

function billingViewModel(bill) {
    const lesion = managedLesions.find((item) => String(item.id) === String(bill.lesionId)) || {};
    const merged = {
        ...lesion,
        ...bill,
        id: bill.id,
        lesionId: bill.lesionId,
        billingStatus: bill.status,
        excisionClosureType: firstFilled(lesion.excisionClosureType, bill.excisionClosureType),
        excisionLengthMm: firstFilled(lesion.excisionLengthMm, bill.excisionLengthMm),
        excisionWidthMm: firstFilled(lesion.excisionWidthMm, bill.excisionWidthMm),
        excisionMarginMm: firstFilled(lesion.excisionMarginMm, bill.excisionMarginMm),
        histologyResult: firstFilled(lesion.histologyResult, bill.histologyResult),
        billingRegion: firstFilled(lesion.billingRegion, bill.billingRegion),
        billingLesionType: firstFilled(lesion.billingLesionType, bill.billingLesionType),
        impression: firstFilled(lesion.impression, bill.impression)
    };
    if (typeof inferBillingLesionType === 'function') {
        const inferred = inferBillingLesionType(merged);
        if (inferred) merged.billingLesionType = inferred;
    }
    const kind = typeof billingProcedureKind === 'function' ? billingProcedureKind(merged) : '';
    if (kind === 'biopsy') {
        if (!merged.procedure) {
            const t = typeof lesionType === 'function' ? lesionType(merged) : merged.type;
            merged.procedure = (t === 'shave' || /shave/i.test(String(merged.biopsyType || ''))) ? 'Shave' : 'Punch';
        }
    } else if (closureLooksLikeExcision(merged.excisionClosureType)) {
        merged.procedure = 'Excision';
    }
    return merged;
}

async function migrateEmbeddedBillingFromLesions() {
    for (const lesion of managedLesions) {
        const oldStatus = lesion.managementStatus;
        const needsBilling = oldStatus === 'awaiting_billing'
            || oldStatus === 'billing_processed'
            || lesion.billingStatus === 'awaiting'
            || lesion.billingStatus === 'confirmed'
            || !!lesion.procedureCompletedAt
            || !!lesion.assignedMbsItems;
        if (needsBilling && !billingForLesion(lesion.id)) {
            const bill = snapshotBillingFromLesion(lesion, null);
            if (oldStatus === 'billing_processed' || lesion.billingStatus === 'confirmed') {
                bill.status = 'confirmed';
                bill.confirmedAt = lesion.billingConfirmedAt || lesion.billingProcessedAt || bill.updatedAt;
            }
            await saveManagedBillingRecord(bill, 'migrated', oldStatus || 'legacy billing');
            lesion.billingRecordId = bill.id;
        }
        if (oldStatus === 'awaiting_billing' || oldStatus === 'billing_processed') {
            lesion.managementStatus = 'awaiting_histology';
            try {
                if (isVaultLoggedIn()) await writeManagedLesion(lesion);
                upsertManagedLesionMemory(lesion);
            } catch (err) {
                upsertManagedLesionMemory(lesion);
            }
        }
    }
}
