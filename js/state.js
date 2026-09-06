/* Shared session state. Keep new feature data here rather than scattering lets across files. */

let activeWorkspaceTab = 'management';
let managedLesions = [];
let managedBillings = [];
let currentManagedCaseId = null;
let currentPatient = { name: '', firstName: '', lastName: '', dob: '', phone: '', clinician: '', chartId: '' };
let lastChartSearchHits = [];
let chartSearchActiveIndex = 0;
let managedCharts = [];
let managedVisitNotes = [];
let pendingWorkspaceTab = '';
let pendingSanitise = false;

let procedureSession = {
    chartId: '',
    selectedIds: [],
    deselectedIds: [],
    lockedIds: [],
    started: false,
    startedAt: '',
    completedAt: '',
    detailLesionId: '',
    complications: {
        none: true,
        bleeding: false,
        vasovagal: false,
        other: false
    },
    complicationNotes: ''
};

// Skin Check View State
let isBedSanitised = false;
let shaveConsentVerified = false;
let patientConcerns = [];
let noPatientConcerns = false;
let screeningMarkedComplete = false;
let lesions = [];
let customConsentRisks = [];
let consentProcedures = [];

let groupStates = {
    canc: 'unset',
    all: 'unset',
    bld: 'unset',
    dia: 'unset',
    hea: 'unset'
};

// Excision Operative Generator Module State
let exLesions = [];
let exLesionCounter = 0;
let editingExLesionId = null;
let exModalSelectedLocationElement = null;

const exPathologyOptions = {
    'BCC': 'Basal cell carcinoma', 'SCC': 'Squamous cell carcinoma', 'IEC': 'IEC/Bowen\'s disease',
    'MMis': 'Melanoma in situ', 'MMinv': 'Melanoma invasive', 'DN': 'Naevus: dysplastic', 'BN': 'Naevus: banal',
    'SebK': 'Seborrhoeic keratosis', 'SK': 'Solar keratosis', 'KA': 'Keratoacanthoma', 'B Cyst': 'Benign cyst',
    'DF': 'Dermatofibroma', 'LPLK': 'Lichen planus-like keratosis', 'MCC': 'Merkel cell carcinoma',
    'OB': 'Other benign', 'OM': 'Other malignant', 'SGH': 'Sebaceous gland hyperplasia', 'SL': 'Solar lentigo',
    'HMF': 'Hutchinson\'s melanotic freckle', 'MMmet': 'Melanoma, metastasis', 'SN': 'Naevus: Spitz'
};

const DIAGNOSIS_ALIASES = {
    'Basal Cell Carcinoma (BCC)': 'BCC',
    'Basal cell carcinoma (BCC)': 'BCC',
    'Squamous Cell Carcinoma (SCC)': 'SCC',
    'Squamous cell carcinoma (SCC)': 'SCC',
    'Intraepidermal Carcinoma / Bowen Disease': 'IEC',
    'Intraepidermal Carcinoma (IEC / Bowen\'s)': 'IEC',
    'Actinic Keratosis (AK)': 'SK',
    'Atypical / Dysplastic Nevus': 'DN',
    'Benign Seborrheic Keratosis': 'SebK',
    'Benign Melanocytic Nevus': 'BN',
    'Dermatofibroma': 'DF',
    'Other / Non-specific Lesion': 'OB'
};

function diagnosisCodeFromText(text) {
    const t = String(text || '').trim();
    if (!t) return '';
    if (exPathologyOptions[t]) return t;
    if (DIAGNOSIS_ALIASES[t]) return DIAGNOSIS_ALIASES[t];
    const lower = t.toLowerCase();
    const aliasHit = Object.keys(DIAGNOSIS_ALIASES).find((key) => key.toLowerCase() === lower);
    if (aliasHit) return DIAGNOSIS_ALIASES[aliasHit];
    const labelHit = Object.entries(exPathologyOptions).find(([, label]) => String(label).toLowerCase() === lower);
    if (labelHit) return labelHit[0];
    return '';
}

function normalizePathologyString(raw) {
    return String(raw || '').split(';').map((part) => {
        const t = part.trim();
        if (!t) return '';
        return diagnosisCodeFromText(t) || t;
    }).filter(Boolean).join(';');
}

function formatDiagnosisDisplay(raw) {
    return String(raw || '').split(';').map((part) => {
        const t = part.trim();
        if (!t) return '';
        if (exPathologyOptions[t]) return t + ' (' + exPathologyOptions[t] + ')';
        return t;
    }).filter(Boolean).join(', ');
}

const PROC_SUPPLIES_STORAGE_KEY = 'dermRecordProcSupplies';
const DEFAULT_PROC_SUPPLIES = {
    anesthetics: [
        'Lignocaine 1% with Adrenaline 1:100,000',
        'Lignocaine 1% without Adrenaline',
        'Bupivacaine 0.5%'
    ],
    sutures: ['Vicryl', 'Monocryl', 'PDS II', 'Monosyn', 'Prolene', 'Nylon'],
    preps: [
        'Chlorhexidine 0.5% in alcohol',
        'Chlorhexidine aqueous',
        'Povidone-iodine',
        'Isopropyl alcohol'
    ]
};
let procSupplies = {
    anesthetics: DEFAULT_PROC_SUPPLIES.anesthetics.slice(),
    sutures: DEFAULT_PROC_SUPPLIES.sutures.slice(),
    preps: DEFAULT_PROC_SUPPLIES.preps.slice()
};

// Tracks whether generated output text has been copied since it last changed
const outputCopyState = {
    emr: { copied: false, lastCopiedText: '' },
    path: { copied: false, lastCopiedText: '' },
    supp: { copied: false, lastCopiedText: '' },
    rec: { copied: false, lastCopiedText: '' }
};

function getBiopsyLesions() {
    return lesions.filter(l => (l.plan || '').includes('Biopsy'));
}

function getBookedExcisionLesions() {
    return lesions.filter(l => (l.plan || '').includes('Excision'));
}
