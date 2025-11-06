// --- MODAL LOGIC ---

// This file contains all logic for the Pathology (PDx) Modal
// and the Orientation (Clock) Modal.

/**
 * Populates the pathology modal with checkboxes from appSettings.
 */
window.populatePathologyModal = function() {
    pathologyCheckboxesEl.innerHTML = ''; // Clear any existing
    Object.entries(pathologyOptions).forEach(([key, value]) => {
        const label = document.createElement('label');
        label.className = 'flex items-center space-x-2 text-sm cursor-pointer';
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.value = key;
        checkbox.className = 'h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500';
        label.appendChild(checkbox);
        const span = document.createElement('span');
        span.textContent = `${key} (${value})`;
        label.appendChild(span);
        pathologyCheckboxesEl.appendChild(label);
    });
}

/**
 * Opens the Pathology (PDx) modal and pre-selects items.
 */
window.openPathologyModal = function() {
    const selected = (getEl('provisionalDiagnoses').value || '').split(';').filter(Boolean);
    pathologyCheckboxesEl.querySelectorAll('input').forEach(input => {
        input.checked = selected.includes(input.value);
    });
    const otherValue = selected.find(s => !pathologyOptions[s]);
    otherPathologyInput.value = otherValue || '';
    pathologyModal.classList.remove('hidden');
}

/**
 * Confirms the pathology selection, updates the form, and closes the modal.
 */
window.confirmPathologySelection = function() {
    const selected = [];
    pathologyCheckboxesEl.querySelectorAll('input:checked').forEach(input => {
        selected.push(input.value);
    });
    const otherValue = otherPathologyInput.value.trim();
    if (otherValue) {
        selected.push(otherValue);
    }
    
    getEl('provisionalDiagnoses').value = selected.join(';');
    
    if (selected.length > 0) {
        pathologyDisplayEl.textContent = selected.join(', ');
        pathologyDisplayEl.classList.remove('italic', 'text-slate-500');
    } else {
        pathologyDisplayEl.textContent = 'Click to select...';
        pathologyDisplayEl.classList.add('italic', 'text-slate-500');
    }
    
    pathologyModal.classList.add('hidden');
    checkLesionFormCompleteness(); // Re-validate the form
}


/**
 * Opens the Orientation (Clock) modal and selects the current value.
 */
window.openOrientationModal = function() {
    if (modalSelectedLocationElement) {
        modalSelectedLocationElement.classList.remove('selected');
    }
    
    const currentDescription = getEl('orientationDescription').value;
    if(currentDescription) {
        const currentLocationEl = modalLocationSelector.querySelector(`[data-value="${currentDescription}"]`);
        if(currentLocationEl) {
            currentLocationEl.classList.add('selected');
            modalSelectedLocationElement = currentLocationEl;
        }
    }
    
    orientationModal.classList.remove('hidden');
}

/**
 * Draws the SVG clock face in the orientation modal.
 */
window.drawOrientationClock = function() {
    const radius = 90;
    const center = 100;
    const face = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    face.setAttribute('cx', center);
    face.setAttribute('cy', center);
    face.setAttribute('r', radius);
    face.classList.add('clock-face');
    clock.appendChild(face);
    
    for (let i = 1; i <= 12; i++) {
        const angle = (i - 3) * (Math.PI / 6);
        const textX = center + (radius - 22) * Math.cos(angle);
        const textY = center + (radius - 22) * Math.sin(angle);
        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        text.setAttribute('x', textX);
        text.setAttribute('y', textY);
        text.textContent = i;
        text.classList.add('hour-text');
        text.dataset.value = `${i} O'Clock`;
        clock.appendChild(text);
    }
    
    const centerDot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    centerDot.setAttribute('cx', center);
    centerDot.setAttribute('cy', center);
    centerDot.setAttribute('r', 4);
    centerDot.classList.add('center-dot');
    clock.appendChild(centerDot);
}
