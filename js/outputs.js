/* EMR note, pathology request, reception message, and action-card status */

function generateRegionalClearanceSummary() {
    const scopeVal = document.querySelector('input[name="scopeConsent"]:checked')?.value || '';
    if (!scopeVal.includes("Full body")) {
        return "";
    }

    const regions = [
        { name: 'Head & Neck', keywords: ['head', 'scalp', 'face', 'nose', 'cheek', 'ear', 'forehead', 'neck', 'lip', 'chin', 'temple'] },
        { name: 'Anterior Trunk', keywords: ['chest', 'breast', 'abdomen', 'flank', 'groin'] },
        { name: 'Posterior Trunk', keywords: ['back', 'shoulder', 'scapula', 'lumbar', 'gluteal'] },
        { name: 'Upper Limbs', keywords: ['arm', 'elbow', 'forearm', 'wrist', 'hand', 'axilla'] },
        { name: 'Lower Limbs', keywords: ['thigh', 'knee', 'calf', 'ankle', 'foot', 'toe', 'shin'] }
    ];

    let regionalFindings = {};
    regions.forEach(r => { regionalFindings[r.name] = []; });

    lesions.forEach(l => {
        const locLower = l.location.toLowerCase();
        let matched = false;
        regions.forEach(r => {
            if (r.keywords.some(k => locLower.includes(k))) {
                regionalFindings[r.name].push(l.location);
                matched = true;
            }
        });
        if (!matched) {
            regionalFindings['Posterior Trunk'].push(l.location);
        }
    });

    let summaryText = `=== REGIONAL ANATOMICAL CLEARANCE SUMMARY ===\n\n`;
    
    regions.forEach(r => {
        const found = regionalFindings[r.name];
        if (found.length === 0) {
            summaryText += `- ${r.name}: Examined in full; no dysplastic or suspicious lesions identified.\n`;
        } else {
            summaryText += `- ${r.name}: Lesion(s) identified at [${found.join(', ')}]. Remainder of region examined; no further suspicious lesions identified.\n`;
        }
    });

    return summaryText + `\n`;
}

function generateEMRNotePlainText(options) {
    const dateStr = new Date().toLocaleDateString('en-AU', { day: '2-digit', month: '2-digit', year: 'numeric' });

    let scopeVal = document.querySelector('input[name="scopeConsent"]:checked')?.value || '';
    if (scopeVal.includes('Regional Area')) {
        const regText = document.getElementById('regionalAreaInput')?.value.trim() || '';
        scopeVal = regText ? `Regional skin check (${regText})` : '';
    }

    const fitz = document.getElementById('fitzpatrick')?.value || '';
    const lastCheck = document.getElementById('lastSkinCheck')?.value || '';

    let txt = `=== SKIN EXAMINATION CLINICAL NOTE (${dateStr}) ===\n\n`;

    if (isBedSanitised) {
        txt += `- Pre-Exam Sanitation: Couch sanitised, disposable liner fitted, dermatoscope disinfected.\n\n`;
    }

    txt += `=== EXAMINATION SCOPE & PATIENT PHENOTYPE ===\n\n`;
    if (scopeVal) txt += `- Consented Scope: ${scopeVal}\n`;
    if (fitz) txt += `- Skin Phenotype: ${fitz}\n`;
    if (lastCheck) txt += `- Interval Since Last Skin Check: ${lastCheck}\n`;
    txt += `\n`;

    if (patientConcerns.length > 0) {
        txt += `=== PATIENT REPORTED CONCERNS ===\n\n`;
        patientConcerns.forEach(c => {
            txt += `- ${c}\n`;
        });
        txt += `\n`;
    } else if (noPatientConcerns) {
        txt += `=== PATIENT REPORTED CONCERNS ===\n\n`;
        txt += `- No patient-reported lesion concerns today.\n\n`;
    }

    if (typeof generateScreeningEmrSection === 'function') {
        txt += generateScreeningEmrSection({
            forceFull: !!(options && (options.forceFull || options.includeFullScreening))
        });
    }

    txt += generateRegionalClearanceSummary();

    txt += `=== DOCUMENTED SKIN LESIONS & DERMOSCOPY ===\n\n`;
    if (lesions.length === 0) {
        if (scopeVal.includes('Full body')) {
            txt += `- Full body skin examination performed. No dysplastic or suspicious lesions requiring biopsy or excision identified today.\n\n`;
        } else if (scopeVal) {
            txt += `- Examination performed (${scopeVal}). No dysplastic or suspicious lesions requiring biopsy or excision identified today.\n\n`;
        } else {
            txt += `- No dysplastic or suspicious lesions requiring biopsy or excision identified today.\n\n`;
        }
    } else {
        lesions.forEach((l, idx) => {
            txt += `Lesion #${idx + 1}: ${l.location}\n`;
            if (l.billingRegion) {
                txt += `    - Procedure area: ${procedureAreaLabel(l.billingRegion)}\n`;
            }
            txt += `    - Provisional Diagnosis: ${typeof formatDiagnosisDisplay === 'function' ? formatDiagnosisDisplay(l.impression) : l.impression}\n`;
            txt += `    - Macroscopic Description: ${l.macroscopic}\n`;
            txt += `    - Dermoscopic Features: ${l.dermoscopy}\n`;
            txt += `    - Management Plan: ${isTopicalPlan(l.plan) ? 'Topical / Field Treatment' : l.plan}${l.biopsyType ? ' (' + l.biopsyType + ')' : ''}\n`;
            if (l.punchSize) txt += `    - Punch size: ${l.punchSize}mm\n`;
            else {
                const sizeBits = [];
                if (l.length && l.width) sizeBits.push(`${l.length}x${l.width}mm`);
                else if (l.length) sizeBits.push(`${l.length}mm`);
                else if (l.width) sizeBits.push(`${l.width}mm`);
                if (l.margin) sizeBits.push(`margin ${l.margin}mm`);
                if (sizeBits.length) txt += `    - Size / margin: ${sizeBits.join(', ')}\n`;
            }
            txt += formatTopicalEmrLines(l);
            if (l.plan.includes('Biopsy') || l.plan.includes('Excision')) {
                txt += `    - SMS Normal Results Consent: ${l.smsConsent !== false ? 'Agreed' : 'Declined'}\n`;
            }
            txt += `\n`;
        });
    }

    if (procedureSession.started || procedureSession.completedAt) {
        txt += `=== PROCEDURE SESSION ===\n\n`;
        const allocated = typeof procedureSelectedLesions === 'function' && procedureSession.started
            ? procedureSelectedLesions()
            : (typeof chartLesions === 'function' ? chartLesions() : []).filter((item) => item.procedureCompletedAt);
        if (allocated.length) {
            allocated.forEach((l, idx) => {
                const detail = typeof procedureDetailForLesion === 'function' ? procedureDetailForLesion(l) : null;
                const kind = detail?.procedure || l.biopsyType || l.plan || 'procedure';
                txt += `- ${idx + 1}. ${l.location || 'Site'} (${detail?.pathology || l.impression || 'diagnosis'}) — ${kind}\n`;
            });
        }
        const comp = typeof formatProcedureComplications === 'function' ? formatProcedureComplications() : '';
        txt += `- Complications: ${comp || 'Not recorded.'}\n\n`;
    }

    const biopsiesCount = typeof sessionBiopsyCount === 'function' ? sessionBiopsyCount() : getBiopsyLesions().length;
    if (biopsiesCount > 0) {
        txt += generateBiopsyFinancialEmrSection(biopsiesCount);
        if (shaveConsentVerified) {
            txt += `- Shave / Saucerisation Safety Checklist Verified: Reticular dermis depth confirmed, bleeding risk checked, Hyfrecator safety confirmed, skin prep completely dry.\n`;
        }
        txt += `\n`;
    }

    const pdtQuotes = lesions.filter(l => isTopicalPlan(l.plan) && l.topicalDecision === 'pdt');
    if (pdtQuotes.length > 0) {
        txt += `=== RED LIGHT PDT QUOTE & FINANCIAL DISCLOSURE ===\n\n`;
        pdtQuotes.forEach((l, idx) => {
            const area = l.pdtAreaName || 'Body area not specified';
            const fee = l.pdtQuotedPrice > 0 ? formatPdtMoney(l.pdtQuotedPrice) + ' OOP' : 'Fee not yet set in the saved PDT price list';
            txt += `- Lesion ${idx + 1} (${l.location}): Red Light PDT to ${area}. Quoted fee: ${fee}.\n`;
        });
        txt += `\n`;
    }

    if (typeof generateAkComparisonEmrSection === 'function') {
        txt += generateAkComparisonEmrSection();
    }

    if (typeof generateAftercareEmrSection === 'function') {
        txt += generateAftercareEmrSection();
    }

    const recallTitle = typeof computedRecallInterval === 'function' ? computedRecallInterval() : '';
    if (recallTitle) {
        const recallReason = (typeof computedRecallReason === 'function' && computedRecallReason())
            || document.getElementById('recallRecommendationReason')?.innerText
            || 'Standard annual recall.';
        txt += `=== RECOMMENDED RECALL SURVEILLANCE & CLINICAL RATIONALE ===\n\n`;
        txt += `- Recommended Repeat Skin Check Interval: ${recallTitle}\n`;
        txt += `- Clinical Rationale: ${recallReason} (Based on Cancer Council Australia clinical guidelines).\n`;
    }

    return txt;
}

function copyEMRNotePlainText() {
    const text = generateEMRNotePlainText();
    if (!text) return;
    const chart = typeof currentManagedChart === 'function' ? currentManagedChart() : null;
    if (typeof chartExamCopyIsCurrent === 'function' && chartExamCopyIsCurrent(chart)) {
        showToast('Already copied to IEMR. Screening stays on the chart for consent forms.');
        return;
    }
    copyTextToClipboard(text, 'Clinical EMR Note copied to clipboard!', () => {
        markOutputCopied('emr', text);
        if (typeof markChartIemrCopied === 'function') markChartIemrCopied(text);
    });
}

function generateBiopsyFinancialEmrSection(biopsiesCount) {
    const count = Number(biopsiesCount);
    if (!count) return '';
    const bBilling = typeof currentBiopsyBilling === 'function' ? currentBiopsyBilling() : (document.getElementById('modalBiopsyBilling')?.value || '$20 OOP per biopsy (Item 30071)');
    const cBilling = typeof currentConsultBilling === 'function' ? currentConsultBilling() : (document.getElementById('modalConsultBilling')?.value || 'Private Bill');
    const oopUnit = typeof biopsyOopUnitAmount === 'function' ? biopsyOopUnitAmount(bBilling) : (bBilling.includes('$20') ? 20 : 0);
    const oopTotal = count * oopUnit;
    let txt = `=== PROCEDURAL CONSENT & INFORMED FINANCIAL DISCLOSURE ===\n\n`;
    txt += `- Informed Verbal Consent Obtained: YES\n`;
    txt += `- Specific Clinical Risks Discussed: Intraoperative & postoperative bleeding, local hematoma formation, wound infection, permanent scarring, keloid risk, dyspigmentation, incomplete excision risk, and potential need for further definitive surgical management.\n`;
    txt += `- Financial Consent & Billing Structure:\n`;
    txt += `    - Consultation Billing: ${cBilling}\n`;
    txt += `    - Biopsy Fee Option: ${bBilling}\n`;
    txt += `    - Total Out-of-Pocket Biopsy Cost: ${oopTotal > 0 ? '$' + oopTotal + ' Total' : '$0'} (${count} biopsy procedure${count === 1 ? '' : 's'} performed today).\n`;
    return txt;
}

function generateProcedureIemrAddendum() {
    const dateStr = new Date().toLocaleDateString('en-AU', { day: '2-digit', month: '2-digit', year: 'numeric' });
    let txt = `=== PROCEDURE ADDENDUM (${dateStr}) ===\n\n`;
    txt += `- Examination / screening already copied to IEMR. This addendum is for today’s procedure only.\n\n`;
    if (typeof generateExEntryNote === 'function' && Array.isArray(exLesions) && exLesions.length) {
        const op = generateExEntryNote();
        if (op && !op.startsWith('Your')) txt += `=== OPERATIVE NOTE ===\n\n${op}\n`;
    }
    const comp = typeof formatProcedureComplications === 'function' ? formatProcedureComplications() : '';
    if (comp) txt += `- Complications: ${comp}\n`;
    const biopsiesCount = typeof sessionBiopsyCount === 'function' ? sessionBiopsyCount() : getBiopsyLesions().length;
    if (biopsiesCount > 0) txt += '\n' + generateBiopsyFinancialEmrSection(biopsiesCount);
    if (typeof generateAkComparisonEmrSection === 'function') txt += '\n' + generateAkComparisonEmrSection();
    if (typeof generateAftercareEmrSection === 'function') txt += '\n' + generateAftercareEmrSection();
    return txt.trim();
}

function generateCompleteInteractionNote() {
    if (typeof chartExamAlreadyCopiedToday === 'function' && chartExamAlreadyCopiedToday()) {
        return generateProcedureIemrAddendum();
    }
    let txt = generateEMRNotePlainText() || '';
    if (typeof generateExEntryNote === 'function' && Array.isArray(exLesions) && exLesions.length) {
        const op = generateExEntryNote();
        if (op && !op.startsWith('Your')) {
            txt += `\n=== OPERATIVE NOTE ===\n\n${op}\n`;
        }
    }
    return txt.trim();
}

function histoClinicalDx(impression) {
    const raw = String(impression || '').trim();
    if (!raw) return '?Lesion';
    const first = raw.split(';')[0].trim()
        .replace(' (Suspected)', '')
        .replace(' / Bowen Disease', '');
    return first.startsWith('?') ? first : '?' + first;
}

function histoTechniqueLabel(l) {
    const raw = String(l?.biopsyType || l?.procedure || '');
    if (!raw) return 'Bx';
    if (/shave/i.test(raw)) return 'Shave Bx';
    if (/punch/i.test(raw)) return /excision/i.test(raw) ? 'Punch excision' : 'Punch Bx';
    if (/excision/i.test(raw)) return 'Excision';
    return raw;
}

function histoSizeSuffix(l) {
    const kind = String(l?.procedure || l?.biopsyType || '');
    const isPunchBx = /punch/i.test(kind) && !/excision/i.test(kind);
    if (isPunchBx) return l?.punchSize ? `, ${l.punchSize}mm punch` : '';
    const bits = [];
    if (l?.length && l?.width) bits.push(`${l.length}x${l.width}mm`);
    else if (l?.length) bits.push(`${l.length}mm`);
    else if (l?.width) bits.push(`${l.width}mm`);
    if (l?.margin) bits.push(`margin ${l.margin}mm`);
    return bits.length ? `, ${bits.join(', ')}` : '';
}

function histoSizeLine(l) {
    return histoSizeSuffix(l).replace(/^, /, '');
}

function histoFeatureHtml(l) {
    const bits = [];
    const size = histoSizeLine(l);
    if (size) bits.push(`<strong>Size / margin:</strong> ${size}`);
    if (l.excisionClosureType) bits.push(`<strong>Closure:</strong> ${l.excisionClosureType}`);
    if (l.orientationType && l.orientationType !== 'None') {
        bits.push(`<strong>Orientation:</strong> ${l.orientationType}${l.orientationDescription ? ' at ' + l.orientationDescription : ''}`);
    }
    bits.push(`<strong>Macro:</strong> ${l.macroscopic && l.macroscopic !== 'Unspecified' ? l.macroscopic : 'Unspecified'}`);
    bits.push(`<strong>Dermoscopy:</strong> ${l.dermoscopy && l.dermoscopy !== 'Unspecified' ? l.dermoscopy : 'Unspecified'}`);
    return bits.join('<br>');
}

function generatePathologyOutputs(lesionList) {
    const biopsyLesions = Array.isArray(lesionList) ? lesionList : getBiopsyLesions();
    
    if (biopsyLesions.length === 0) {
        return {
            slipText: "No biopsies documented for today's examination.",
            reportText: "",
            requiresAttachment: false
        };
    }

    let testDetailedLines = biopsyLesions.map((l, idx) => {
        let diag = histoClinicalDx(l.impression);
        let bType = histoTechniqueLabel(l);
        let macro = l.macroscopic && l.macroscopic !== 'Unspecified' ? `${l.macroscopic}` : '';
        let dermo = l.dermoscopy && l.dermoscopy !== 'Unspecified' ? `${l.dermoscopy}` : '';
        let details = [macro, dermo].filter(Boolean).join(', ');
        let detailsStr = details ? `. ${details}` : '';
        return `${idx + 1}. ${(l.location || 'UNSPECIFIED SITE').toUpperCase()}: ${diag}, ${bType}${histoSizeSuffix(l)}${detailsStr}`;
    });

    let fullDetailedText = testDetailedLines.join('\n');

    const requiresAttachment = biopsyLesions.length > 2 || fullDetailedText.length > 180;

    let slipText = "";
    let reportText = "";

    if (!requiresAttachment) {
        slipText = fullDetailedText;
    } else {
        slipText = `*** SEE ATTACHED REPORT FOR FULL CLINICAL DETAILS ***\n`;
        slipText += biopsyLesions.map((l, idx) => {
            let diag = histoClinicalDx(l.impression);
            let bType = histoTechniqueLabel(l);
            return `${idx + 1}. ${(l.location || 'UNSPECIFIED SITE').toUpperCase()}: ${diag}, ${bType}${histoSizeSuffix(l)}`;
        }).join('\n');

        const dateStr = new Date().toLocaleDateString('en-AU', { day: '2-digit', month: '2-digit', year: 'numeric' });
        
        reportText = `==================================================\n`;
        reportText += `SUPPLEMENTARY PATHOLOGY CLINICAL REPORT (${dateStr})\n`;
        reportText += `[STAPLE TO MAIN PATHOLOGY REQUEST PAD]\n`;
        reportText += `==================================================\n\n`;
        
        reportText += biopsyLesions.map((l, idx) => {
            let text = `SPECIMEN #${idx + 1}: ${(l.location || 'UNSPECIFIED SITE').toUpperCase()}\n`;
            text += `  - Clinical Provisional Diagnosis: ${l.impression}\n`;
            text += `  - Technique: ${l.biopsyType || l.procedure || 'Biopsy'}\n`;
            if (l.excisionClosureType) text += `  - Closure: ${l.excisionClosureType}\n`;
            const sizeLine = histoSizeLine(l);
            if (sizeLine) text += `  - Size / margin: ${sizeLine}\n`;
            if (l.orientationType && l.orientationType !== 'None') {
                text += `  - Orientation: ${l.orientationType}${l.orientationDescription ? ' at ' + l.orientationDescription : ''}\n`;
            }
            text += `  - Macroscopic Description: ${l.macroscopic || 'Unspecified'}\n`;
            text += `  - Dermoscopic Features: ${l.dermoscopy || 'Unspecified'}\n`;
            return text;
        }).join('\n');
    }

    return { slipText, reportText, requiresAttachment };
}

function printSupplementaryReportSheet(lesionList) {
    const biopsyLesions = Array.isArray(lesionList) ? lesionList : getBiopsyLesions();
    if (biopsyLesions.length === 0) return;

    const name = currentPatient?.name
        || document.getElementById('mainPatientName')?.value.trim()
        || document.getElementById('consentPatientName')?.value.trim()
        || "___________________________________";
    const dob = currentPatient?.dob
        || document.getElementById('mainPatientDOB')?.value.trim()
        || document.getElementById('consentPatientDOB')?.value.trim()
        || "____ / ____ / ________";
    const doctor = (typeof currentDoctorName === 'function' && currentDoctorName())
        || (typeof loggedInDoctorName === 'function' && loggedInDoctorName())
        || currentPatient?.clinician
        || "________________________";

    const dateStr = new Date().toLocaleDateString('en-AU', { day: '2-digit', month: '2-digit', year: 'numeric' });

    const printHtml = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>Supplementary Pathology Clinical Report - ${dateStr}</title>
            <style>
                body { font-family: Arial, Helvetica, sans-serif; font-size: 10pt; line-height: 1.4; color: #000; margin: 12mm; }
                .header { border-bottom: 2.5px solid #000; padding-bottom: 6px; margin-bottom: 12px; display: flex; justify-content: space-between; align-items: flex-end; }
                .title { font-size: 13pt; font-weight: bold; text-transform: uppercase; letter-spacing: 0.02em; }
                .subtitle { font-size: 9pt; color: #333; font-weight: bold; }
                .patient-box { border: 1.5px solid #000; padding: 8px 12px; margin-bottom: 14px; background: #fafafa; }
                .patient-grid { display: grid; grid-template-columns: 2fr 1fr; gap: 10px; font-size: 9.5pt; }
                .alert-banner { background-color: #fef3c7; border: 1px solid #f59e0b; color: #92400e; padding: 6px 10px; font-size: 8.5pt; font-weight: bold; margin-bottom: 12px; border-radius: 4px; text-align: center; }
                table { width: 100%; border-collapse: collapse; margin-top: 6px; font-size: 9.5pt; }
                th, td { border: 1px solid #000; padding: 6px 8px; text-align: left; vertical-align: top; }
                th { background-color: #f3f4f6; font-weight: bold; text-transform: uppercase; font-size: 8.5pt; }
                .sig-box { margin-top: 30px; border-top: 1.5px solid #000; padding-top: 8px; display: flex; justify-content: space-between; font-size: 9pt; }
                @media print { body { margin: 8mm; } }
            </style>
        </head>
        <body>
            <div class="header">
                <div>
                    <div class="title">SUPPLEMENTARY PATHOLOGY CLINICAL REPORT</div>
                    <div class="subtitle">Detailed clinical findings for laboratory histology</div>
                </div>
                <div style="font-size: 10pt; font-weight: bold;">Date: ${dateStr}</div>
            </div>

            <div class="alert-banner">
                📌 CLINICAL ACTION: STAPLE THIS SHEET TO THE PRIMARY PATHOLOGY REQUEST SLIP
            </div>

            <div class="patient-box">
                <div class="patient-grid">
                    <div><strong>Patient Full Name:</strong> ${name}</div>
                    <div><strong>DOB:</strong> ${dob}</div>
                </div>
            </div>

            <table>
                <thead>
                    <tr>
                        <th style="width: 5%; text-align: center;">#</th>
                        <th style="width: 25%;">Anatomical Location</th>
                        <th style="width: 20%;">Clinical Provisional Dx</th>
                        <th style="width: 15%;">Technique</th>
                        <th style="width: 35%;">Size, closure, macroscopic &amp; dermoscopic features</th>
                    </tr>
                </thead>
                <tbody>
                    ${biopsyLesions.map((l, idx) => `
                        <tr>
                            <td style="font-weight: bold; text-align: center;">${idx + 1}</td>
                            <td style="font-weight: bold; text-transform: uppercase;">${l.location || 'Unspecified site'}</td>
                            <td>${l.impression}</td>
                            <td>${l.biopsyType || l.procedure || 'Biopsy'}</td>
                            <td>
                                ${typeof histoFeatureHtml === 'function' ? histoFeatureHtml(l) : `
                                <strong>Macro:</strong> ${l.macroscopic || 'Unspecified'}<br>
                                <strong>Dermoscopy:</strong> ${l.dermoscopy || 'Unspecified'}
                                `}
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>

            <div style="margin-top: 15px; font-size: 8.5pt; color: #444; font-style: italic;">
                * Note for Histopathology Laboratory: Specimen jar numbers correspond directly to the numbered table items above.
            </div>

            <div class="sig-box">
                <div><strong>Requesting Medical Practitioner Signature:</strong> ___________________________________</div>
                <div><strong>Provider / Dr Name:</strong> ${doctor}</div>
            </div>

            \x3Cscript>
                window.onload = function() { window.print(); }
            \x3C/script>
        </body>
        </html>
    `;

    const printWin = window.open('', '_blank', 'width=800,height=900');
    if (printWin) {
        printWin.document.open();
        printWin.document.write(printHtml);
        printWin.document.close();
        const suppText = document.getElementById('supplementaryReportText')?.value || '';
        markOutputCopied('supp', suppText);
        showToast('Supplementary pathology report sent to printer.');
    } else {
        showToast('Unable to open print window. Please check popup permissions.');
    }
}

function generateReceptionMessage() {
    const cBilling = typeof currentConsultBilling === 'function' ? currentConsultBilling() : (document.getElementById('modalConsultBilling')?.value || 'Private Bill');
    const bBilling = typeof currentBiopsyBilling === 'function' ? currentBiopsyBilling() : (document.getElementById('modalBiopsyBilling')?.value || '$20 OOP per biopsy (Item 30071)');

    const consultLesions = typeof lesions !== 'undefined' ? lesions : [];
    const biopsiesCount = typeof sessionBiopsyCount === 'function' ? sessionBiopsyCount() : getBiopsyLesions().length;
    const excisionsCount = getBookedExcisionLesions().length;
    const procedureLesions = typeof procedureSelectedLesions === 'function' ? procedureSelectedLesions() : [];
    const hasConsult = consultLesions.length > 0 || biopsiesCount > 0 || excisionsCount > 0
        || (typeof isSection1RiskComplete === 'function' && isSection1RiskComplete());
    const hasProcedure = procedureLesions.length > 0 || !!(typeof procedureSession !== 'undefined' && procedureSession.started);

    const recallTitle = typeof computedRecallInterval === 'function' ? computedRecallInterval() : '';

    const parts = [];

    if (hasConsult || !hasProcedure) {
        parts.push(`Consult Billing: ${cBilling}`);
        const biopsyBit = typeof receptionBiopsyBillingBit === 'function'
            ? receptionBiopsyBillingBit(biopsiesCount, bBilling)
            : '';
        if (biopsyBit) {
            parts.push(biopsyBit);
        } else if (!hasProcedure) {
            parts.push('Procedures Today: None');
        }
        if (excisionsCount > 0 && !hasProcedure) {
            parts.push(`Bookings Required: BOOK FORMAL EXCISION for ${excisionsCount} lesion(s)`);
        }
        const topicalBits = typeof getTopicalReceptionBits === 'function' ? getTopicalReceptionBits() : [];
        if (topicalBits.length > 0) {
            parts.push(`Topical / Field Rx: ${topicalBits.join('; ')}`);
        }
        if (recallTitle) parts.push(`Follow-Up Recall: ${recallTitle}`);
    }

    if (hasProcedure) {
        const sites = procedureLesions.map((lesion) => {
            const detail = typeof procedureDetailForLesion === 'function' ? procedureDetailForLesion(lesion) : {};
            const kind = detail.procedure || lesion.biopsyType || 'procedure';
            return `${kind} ${detail.location || lesion.location || 'site'}`;
        });
        if (sites.length) parts.push('Procedure: ' + sites.join('; '));
        const ros = typeof procedureRosSummary === 'function' ? procedureRosSummary(procedureLesions) : '';
        if (ros) parts.push('ROS: ' + ros);
        const summary = typeof procedureSessionBillingSummary === 'function'
            ? procedureSessionBillingSummary(procedureLesions)
            : null;
        const billingLine = typeof receptionBillingInstruction === 'function' ? receptionBillingInstruction(summary) : '';
        if (billingLine) parts.push(billingLine);
        const biopsyBit = typeof receptionBiopsyBillingBit === 'function'
            ? receptionBiopsyBillingBit(biopsiesCount, bBilling)
            : '';
        if (biopsyBit && !parts.some((part) => part.startsWith('Biopsy OOP:') || part === 'Biopsy Bulk Bill')) {
            parts.push(biopsyBit);
        }
        if (!parts.some((part) => part.startsWith('Consult Billing:'))) {
            parts.push(`Consult Billing: ${cBilling}`);
        }
        if (recallTitle && !parts.some((part) => part.startsWith('Follow-Up Recall:'))) {
            parts.push(`Follow-Up Recall: ${recallTitle}`);
        }
    }

    return parts.join(' | ');
}

function syncCopyFlag(key, currentText) {
    const state = outputCopyState[key];
    if (!state) return;
    if (state.lastCopiedText !== currentText) {
        state.copied = false;
    }
}

function markOutputCopied(key, text) {
    if (!outputCopyState[key]) return;
    outputCopyState[key].copied = true;
    outputCopyState[key].lastCopiedText = text || '';
    updateActionCardStatuses();
}

function setActionButtonState(btn, enabled) {
    if (!btn) return;
    btn.disabled = !enabled;
}

function applyStatusCard(cardId, theme) {
    const card = document.getElementById(cardId);
    if (!card) return;
    const themeClass = {
        pending: 'is-pending',
        done: 'is-done',
        idle: 'is-idle',
        ready: 'is-pending',
        purpleIdle: 'is-idle'
    }[theme] || 'is-idle';
    card.className = `output-action-btn-wrap ${themeClass}`;
}

function setStatusBadge(badgeId, dotId, theme, label) {
    const badge = document.getElementById(badgeId);
    const dot = document.getElementById(dotId);
    if (badge) badge.textContent = label;
    if (dot) {
        const dotTheme = theme === 'pending' || theme === 'ready' ? 'is-pending' : (theme === 'done' ? 'is-done' : 'is-idle');
        dot.className = `output-action-dot ${dotTheme}`;
    }
}

function updateActionCardStatuses() {
    const biopsyLesions = getBiopsyLesions();
    const histoData = generatePathologyOutputs();
    const biopsyCount = biopsyLesions.length;

    const emrText = document.getElementById('emrNoteTextContainer')?.value || '';
    const pathText = document.getElementById('pathologyRequestText')?.value || '';
    const suppText = document.getElementById('supplementaryReportText')?.value || '';
    const recText = document.getElementById('receptionMessageText')?.value || '';

    const emrCopied = outputCopyState.emr.copied && outputCopyState.emr.lastCopiedText === emrText;
    const pathCopied = outputCopyState.path.copied && outputCopyState.path.lastCopiedText === pathText;
    const suppCopied = outputCopyState.supp.copied && outputCopyState.supp.lastCopiedText === suppText;
    const recCopied = outputCopyState.rec.copied && outputCopyState.rec.lastCopiedText === recText;
    const examCopiedToday = typeof chartExamCopyIsCurrent === 'function' && chartExamCopyIsCurrent();
    const emrTheme = (emrCopied || examCopiedToday) ? 'done' : 'pending';
    applyStatusCard('cardStatusEmr', emrTheme);
    setStatusBadge('textEmrStatus', 'dotEmr', emrTheme, (emrCopied || examCopiedToday) ? 'Copied to IEMR' : 'Pending copy');
    setActionButtonState(document.getElementById('btnCopyEmr'), !examCopiedToday);

    const pathNeeded = biopsyCount > 0;
    const pathTheme = !pathNeeded ? 'idle' : (pathCopied ? 'done' : 'pending');
    applyStatusCard('cardStatusPath', pathTheme);
    setStatusBadge(
        'textPathStatus',
        'dotPath',
        pathTheme,
        !pathNeeded ? 'Not required' : (pathCopied ? 'Copied' : 'Pending copy')
    );
    const descPath = document.getElementById('descPathStatus');
    if (descPath) {
        descPath.textContent = !pathNeeded
            ? 'No biopsies documented for today\'s session.'
            : `${biopsyCount} biopsy specimen${biopsyCount === 1 ? '' : 's'} ready to copy onto the pathology pad.`;
    }
    setActionButtonState(document.getElementById('btnCopyPath'), pathNeeded);

    const suppNeeded = pathNeeded && !!histoData.requiresAttachment;
    const suppTheme = !suppNeeded ? 'idle' : (suppCopied ? 'done' : 'pending');
    applyStatusCard('cardStatusSupp', suppTheme);
    setStatusBadge(
        'textSuppStatus',
        'dotSupp',
        suppTheme,
        !suppNeeded ? 'Not required' : (suppCopied ? 'Copied' : 'Pending copy')
    );
    const descSupp = document.getElementById('descSuppStatus');
    if (descSupp) {
        descSupp.textContent = !suppNeeded
            ? (pathNeeded ? 'Standard request fits directly on the pathology pad.' : 'No attached report required.')
            : 'Request exceeds pad space — copy or print and staple the attached report.';
    }
    const printBtn = document.getElementById('btnPrintSupp');
    if (printBtn) {
        printBtn.classList.toggle('hidden', !suppNeeded);
        printBtn.disabled = !suppNeeded;
    }
    setActionButtonState(document.getElementById('btnCopySupp'), suppNeeded);

    const recTheme = recCopied ? 'done' : 'pending';
    applyStatusCard('cardStatusRec', recTheme);
    setStatusBadge('textRecStatus', 'dotRec', recTheme, recCopied ? 'Copied' : 'Pending copy');
    setActionButtonState(document.getElementById('btnCopyRec'), true);
    if (typeof updateChartBillingButtonStatus === 'function') updateChartBillingButtonStatus();
    setActionButtonState(document.getElementById('btnChartBilling'), typeof hasCurrentPatient === 'function' && hasCurrentPatient());

    const aftercareGiven = typeof aftercareWasGivenToday === 'function' && aftercareWasGivenToday();
    const aftercareTheme = aftercareGiven ? 'done' : 'pending';
    applyStatusCard('cardStatusAftercare', aftercareTheme);
    const aftercareCard = document.getElementById('cardStatusAftercare');
    if (aftercareCard) {
        aftercareCard.classList.add('is-aftercare');
    }
    setStatusBadge(
        'textAftercareStatus',
        'dotAftercare',
        aftercareTheme,
        aftercareGiven ? 'Given to patient' : 'Give to patient'
    );
    const aftercareOn = typeof hasCurrentPatient === 'function' && hasCurrentPatient();
    setActionButtonState(document.getElementById('btnPrintAftercare'), aftercareOn);
    setActionButtonState(document.getElementById('btnDownloadAftercare'), aftercareOn);

    if (typeof updateAkComparisonControls === 'function') updateAkComparisonControls();
}

function updateOutput() {
    if (typeof updateExamRequiredFields === 'function') updateExamRequiredFields();
    const plainContainer = document.getElementById('emrNoteTextContainer');
    const pathEl = document.getElementById('pathologyRequestText');
    const suppTextEl = document.getElementById('supplementaryReportText');
    const recEl = document.getElementById('receptionMessageText');

    if (plainContainer) plainContainer.value = generateEMRNotePlainText();

    const histoData = generatePathologyOutputs();
    const biopsyCount = getBiopsyLesions().length;

    if (pathEl) {
        pathEl.value = biopsyCount > 0 ? histoData.slipText : '';
    }
    if (suppTextEl) suppTextEl.value = histoData.reportText;
    if (recEl) recEl.value = generateReceptionMessage();

    syncCopyFlag('emr', plainContainer?.value || '');
    syncCopyFlag('path', pathEl?.value || '');
    syncCopyFlag('supp', suppTextEl?.value || '');
    syncCopyFlag('rec', recEl?.value || '');

    updateActionCardStatuses();
    if (typeof scheduleChartSave === 'function') scheduleChartSave();
    if (typeof scheduleVisitNoteSave === 'function') scheduleVisitNoteSave();
}

function copyPathologyRequestAction() {
    const text = document.getElementById('pathologyRequestText')?.value;
    if (!text) {
        showToast('No biopsy pathology request to copy yet.');
        return;
    }
    copyTextToClipboard(text, 'Pathology request copied for BP Premier!', () => markOutputCopied('path', text));
}

function copySupplementaryAction() {
    const text = document.getElementById('supplementaryReportText')?.value;
    if (!text) {
        showToast('No attached pathology report to copy yet.');
        return;
    }
    copyTextToClipboard(text, 'Attached Pathology Report copied!', () => markOutputCopied('supp', text));
}

function copyReceptionAction() {
    const text = document.getElementById('receptionMessageText')?.value;
    copyTextToClipboard(text, 'Reception message copied!', () => markOutputCopied('rec', text));
}

function toggleNotePreviewModal() {
    const modal = document.getElementById('notePreviewModal');
    const view = document.getElementById('previewModalRtfView');
    if (!modal) return;
    if (modal.classList.contains('hidden')) {
        if (view) view.innerText = generateEMRNotePlainText();
        modal.classList.remove('hidden');
    } else {
        modal.classList.add('hidden');
    }
}

