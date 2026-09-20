// ─── Global Reactive State Store (Zustand) ───────────────────────────────────

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { v4 as uuid } from 'uuid';
import toast from 'react-hot-toast';
import {
  Patient, Resource, AmbulanceUnit, AuditEvent, ThroughputPoint,
  ChatMessage, Strategy, Role, ESILevel, Department, ResourceType, AuditEventType,
  AuthResult, NewPatientInput, PatientReport, PatientReportKind, PortalAccess, StaffRole,
  BedAllocation, PortalMessage, AmbulanceArrivalPattern, DeletedPatientRecord,
} from './types';
import { computeScore, sortByStrategy, overallUtilization, generateArrivalPattern, inferDepartmentFromCondition } from './engine';
import {
  authenticateStaff, canActOnPatientRecord, deriveDateOfBirth, deriveMrn,
  findPatientByCredentials, findPatientByFamilyCode,
} from './auth';

// ── Seed Data ─────────────────────────────────────────────────────────────────

const INITIAL_RESOURCES: Resource[] = [
  { type: 'Acute ER Bays',      total: 20, occupied: 12 },
  { type: 'ICU Critical Beds',  total: 15, occupied: 11 },
  { type: 'Operating Theatres', total: 6,  occupied: 3  },
  { type: 'Physicians',         total: 18, occupied: 14 },
  { type: 'Nurses',             total: 40, occupied: 28 },
  { type: 'Ventilators',        total: 12, occupied: 7  },
  { type: 'CT Scanners',        total: 4,  occupied: 2  },
];

const mkPatient = (
  name: string, age: number, esi: ESILevel, condition: string,
  dept: Department, res: ResourceType, risk: number, waitMins: number
): Patient => {
  const id = uuid();
  return {
    id,
    mrn: deriveMrn(id),
    dob: deriveDateOfBirth(id, age),
    name, age, esi, condition, department: dept,
    targetResource: res,
    vitals: { bp: `${110 + Math.floor(Math.random()*40)}/${70 + Math.floor(Math.random()*20)}`, hr: 60 + Math.floor(Math.random()*60), spo2: 88 + Math.floor(Math.random()*12), temp: parseFloat((36.5 + Math.random()*2).toFixed(1)) },
    deteriorationRisk: risk, arrivalTime: Date.now() - waitMins * 60000,
    waitMinutes: waitMins, score: 0, allocated: false,
  };
};
const SEED_PATIENTS: Patient[] = [
  mkPatient('James Harlow',   54, 1, 'STEMI – Cardiac Arrest',        'ICU',       'ICU Critical Beds',  0.92, 8),
  mkPatient('Priya Sharma',   31, 2, 'Severe Respiratory Distress',   'Trauma ER', 'Acute ER Bays',      0.74, 22),
  mkPatient('Carlos Mendez',  67, 2, 'Hemorrhagic Stroke',            'Neurology', 'CT Scanners',        0.81, 15),
  mkPatient('Aisha Okonkwo',  45, 3, 'Acute Appendicitis',            'OR Suites', 'Operating Theatres', 0.55, 40),
  mkPatient('Tom Nguyen',     28, 3, 'Compound Femur Fracture',       'Orthopedics','Acute ER Bays',     0.48, 35),
  mkPatient('Linda Park',     72, 2, 'Septic Shock',                  'ICU',       'ICU Critical Beds',  0.88, 18),
  mkPatient('Marcus Webb',    39, 4, 'Laceration – Deep Hand',        'Trauma ER', 'Acute ER Bays',      0.22, 55),
  mkPatient('Sofia Reyes',    19, 5, 'Mild Ankle Sprain',             'Orthopedics','Acute ER Bays',     0.05, 90),
];

const SEED_AMBULANCES: AmbulanceUnit[] = [
  { id: uuid(), origin: 'Downtown Intersection 5th & Main', patientName: 'Robert Chen', esi: 1, condition: 'Polytrauma – MVA', etaSeconds: 180, targetBay: 'Trauma Bay 1', arrived: false },
  { id: uuid(), origin: 'Riverside Industrial Park',        patientName: 'Maria Santos', esi: 2, condition: 'Burns 40% BSA',   etaSeconds: 420, targetBay: 'Burn Unit Bay 2', arrived: false },
  { id: uuid(), origin: 'Northgate Community Center',       patientName: 'David Kim',   esi: 3, condition: 'Diabetic Ketoacidosis', etaSeconds: 720, targetBay: 'ER Bay 7', arrived: false },
];

const SEED_THROUGHPUT: ThroughputPoint[] = Array.from({ length: 12 }, (_, i) => ({
  hour: `${String(i + 8).padStart(2, '0')}:00`,
  arrivals: 4 + Math.floor(Math.random() * 14),
  discharges: 3 + Math.floor(Math.random() * 10),
  capacity: 20,
}));

// ── Store Interface ───────────────────────────────────────────────────────────

interface MedFlowState {
  // Auth — every session is bound to exactly one principal
  role: Role | null;
  authedUser: string;
  /** The single patient record this session may read; null for staff. */
  authedPatientId: string | null;
  /** 'full' only for a signed-in patient acting on their own record. */
  portalAccess: PortalAccess;
  loginAsStaff: (role: StaffRole, email: string, password: string) => AuthResult;
  loginAsPatient: (mrn: string, dob: string) => AuthResult;
  loginAsFamily: (familyCode: string) => AuthResult;
  /** Raises a self-service report for the session's own record, or refuses. */
  submitPatientReport: (patientId: string, report: PatientReport) => AuthResult;
  logout: () => void;

  // Theme
  darkMode: boolean;
  toggleTheme: () => void;

  // Simulation clock
  simTime: Date;
  tickClock: () => void;

  // Resources
  resources: Resource[];
  updateResource: (type: ResourceType, delta: number) => void;

  // Bed Allocation Log
  bedAllocations: BedAllocation[];
  getBedAllocations: () => BedAllocation[];

  // Deleted Patients Archive
  deletedPatients: DeletedPatientRecord[];
  getDeletedPatients: () => DeletedPatientRecord[];

  // Patients / Queue
  patients: Patient[];
  strategy: Strategy;
  weights: { wu: number; ww: number; wr: number };
  setStrategy: (s: Strategy) => void;
  setWeights: (w: Partial<{ wu: number; ww: number; wr: number }>) => void;
  /** Registers a patient and returns the record with its issued portal identity. */
  addPatient: (p: NewPatientInput) => Patient;
  allocateBed: (patientId: string) => void;
  dischargePatient: (patientId: string) => void;
  deletePatient: (patientId: string) => void;
  tickWaitTimes: () => void;
  sortedQueue: () => Patient[];
  utilizationStats: () => { type: ResourceType; pct: number; available: number; total: number }[];
  conflictLog: string[];

  // Ambulances
  ambulances: AmbulanceUnit[];
  arrivalPatterns: AmbulanceArrivalPattern[];
  tickAmbulances: () => void;
  fastForwardAmbulance: (id: string) => void;
  generateArrivalPatterns: () => void;

  // Throughput
  throughput: ThroughputPoint[];

  // Audit
  auditLog: AuditEvent[];
  addAudit: (type: AuditEventType, message: string, severity: 'info' | 'warning' | 'critical', actor?: string) => void;

  // AI Chat
  chatMessages: ChatMessage[];
  sendChat: (msg: string) => void;

  // Portal Messages
  portalMessages: PortalMessage[];
  sendPortalMessage: (msg: Omit<PortalMessage, 'id' | 'timestamp'>) => void;
  getSortedPortalMessages: (patientId: string) => PortalMessage[];

  // Diversion
  diversionActive: boolean;
  overallUtil: number;

  // Simulation triggers
  triggerMCI: () => void;
  triggerStaffShortage: () => void;
  triggerICUCrisis: () => void;
  triggerEquipmentFailure: () => void;
}

// ── AI Response Generator ─────────────────────────────────────────────────────

const generateAIResponse = (msg: string, resources: Resource[], patients: Patient[]): string => {
  const lower = msg.toLowerCase();
  const icuRes = resources.find(r => r.type === 'ICU Critical Beds')!;
  const icuLoad = Math.round((icuRes.occupied / icuRes.total) * 100);
  const criticalCount = patients.filter(p => p.esi <= 2 && !p.allocated).length;

  if (lower.includes('icu') || lower.includes('capacity'))
    return `ICU is at ${icuLoad}% capacity (${icuRes.occupied}/${icuRes.total} beds). ${icuLoad >= 80 ? '⚠️ CRITICAL: Recommend activating regional diversion protocol and contacting St. Mary\'s for overflow capacity.' : 'Capacity is within safe operational range. Monitor for deterioration.'}`;
  if (lower.includes('triage') || lower.includes('queue') || lower.includes('priority'))
    return `Current queue has ${criticalCount} ESI 1-2 patients awaiting allocation. Recommend immediate escalation for ${patients.filter(p=>p.esi===1&&!p.allocated).map(p=>p.name).join(', ') || 'none pending'}. Dynamic Multi-Objective scoring is optimal for current surge conditions.`;
  if (lower.includes('staff') || lower.includes('nurse') || lower.includes('doctor'))
    return `Nurse-to-patient ratio is currently ${(resources.find(r=>r.type==='Nurses')!.occupied / Math.max(patients.filter(p=>p.allocated).length,1)).toFixed(1)}:1. Safe threshold is 1:4 for ICU, 1:6 for general ward. Consider activating on-call roster if ratio exceeds threshold.`;
  if (lower.includes('diversion') || lower.includes('redirect'))
    return `Regional diversion analysis: ICU at ${icuLoad}%, ER bays at ${Math.round((resources.find(r=>r.type==='Acute ER Bays')!.occupied/resources.find(r=>r.type==='Acute ER Bays')!.total)*100)}%. ${icuLoad >= 80 ? 'Recommend activating diversion to Metro General and Riverside Medical.' : 'Diversion not warranted at current load levels.'}`;
  if (lower.includes('ventilator') || lower.includes('vent'))
    return `Ventilator inventory: ${resources.find(r=>r.type==='Ventilators')!.occupied}/${resources.find(r=>r.type==='Ventilators')!.total} in use. Reserve 2 units for incoming ESI-1 cases. Contact respiratory therapy for rapid deployment protocol.`;
  return `SENTINEL AI analysis: ${patients.length} patients in system, ${criticalCount} critical. ICU load ${icuLoad}%. Recommend prioritizing ESI 1-2 allocations and monitoring deterioration risk scores above 0.75. All systems nominal.`;
};

// ── Patient Report Ledger Mapping ─────────────────────────────────────────────

const REPORT_META: Record<PatientReportKind, { type: AuditEventType; severity: 'info' | 'warning' | 'critical'; label: string }> = {
  pain_alert:     { type: 'THRESHOLD', severity: 'critical', label: 'Pain / deterioration alert raised' },
  message:        { type: 'THRESHOLD', severity: 'warning',  label: 'Message to triage nurse' },
  symptoms:       { type: 'THRESHOLD', severity: 'warning',  label: 'Symptom update' },
  comfort:        { type: 'TRIAGE',    severity: 'info',     label: 'Comfort request' },
  family_checkin: { type: 'TRIAGE',    severity: 'info',     label: 'Family waiting-room check-in' },
};

const REPORT_TOAST_DURATION = { success: 3000, error: 6000 } as const;

// ── Store Implementation ──────────────────────────────────────────────────────

const SESSION_STORAGE_KEY = 'medflow.session';
const SESSION_STORAGE_VERSION = 1;

export const useMedFlow = create<MedFlowState>()(
  persist(
    (set, get) => ({
  role: null,
  authedUser: '',
  authedPatientId: null,
  portalAccess: 'readonly',

  loginAsStaff: (staffRole, email, password) => {
    const account = authenticateStaff(staffRole, email, password);
    if (!account) return { ok: false, error: 'Invalid email or password for this role.' };
    set({ role: staffRole, authedUser: account.name, authedPatientId: null, portalAccess: 'readonly' });
    get().addAudit('TRIAGE', `${account.name} signed in as ${staffRole}`, 'info', account.name);
    return { ok: true };
  },

  loginAsPatient: (mrn, dob) => {
    const match = findPatientByCredentials(get().patients, mrn, dob);
    if (!match) return { ok: false, error: 'No patient record matches that MRN and date of birth.' };
    set({ role: 'patient', authedUser: match.name, authedPatientId: match.id, portalAccess: 'full' });
    get().addAudit('TRIAGE', `${match.name} signed in to the patient portal (MRN ${match.mrn})`, 'info', match.name);
    return { ok: true };
  },

  loginAsFamily: (familyCode) => {
    const match = findPatientByFamilyCode(get().patients, familyCode);
    if (!match) return { ok: false, error: 'That family access code is not valid.' };
    set({
      role: 'family',
      authedUser: `Family of ${match.name}`,
      authedPatientId: match.id,
      portalAccess: 'readonly',
    });
    get().addAudit('TRIAGE', `Family member signed in with the share code for ${match.name} (read-only)`, 'info', `Family of ${match.name}`);
    return { ok: true };
  },

  /**
   * The single choke point for patient-authored writes. Anything that is not the
   * bound patient acting on their own record is refused here, regardless of what
   * the UI renders.
   */
  submitPatientReport: (patientId, report) => {
    const session = get();
    if (!canActOnPatientRecord(session, patientId)) {
      return { ok: false, error: 'You are not authorised to act on this patient record.' };
    }
    const patient = session.patients.find(p => p.id === patientId);
    if (!patient) return { ok: false, error: 'Your patient record is no longer available.' };

    const meta = REPORT_META[report.kind];
    session.addAudit(meta.type, `${meta.label} — ${report.message}`, meta.severity, patient.name);
    if (report.toastLevel === 'error') toast.error(report.toast, { duration: REPORT_TOAST_DURATION.error });
    else toast.success(report.toast, { duration: REPORT_TOAST_DURATION.success });
    return { ok: true };
  },

  logout: () => set({ role: null, authedUser: '', authedPatientId: null, portalAccess: 'readonly' }),

  darkMode: true,
  toggleTheme: () => set(s => ({ darkMode: !s.darkMode })),

  simTime: new Date(),
  tickClock: () => set(s => ({ simTime: new Date(s.simTime.getTime() + 60000) })),

  resources: INITIAL_RESOURCES,
  updateResource: (type, delta) => set(s => ({
    resources: s.resources.map(r => r.type === type
      ? { ...r, occupied: Math.max(0, Math.min(r.total, r.occupied + delta)) }
      : r)
  })),

  bedAllocations: [] as BedAllocation[],
  getBedAllocations: () => get().bedAllocations,

  deletedPatients: [] as DeletedPatientRecord[],
  getDeletedPatients: () => get().deletedPatients,

  patients: SEED_PATIENTS,
  strategy: 'Dynamic Multi-Objective',
  weights: { wu: 1.0, ww: 0.5, wr: 0.3 },
  setStrategy: (strategy) => set({ strategy }),
  setWeights: (w) => set(s => ({ weights: { ...s.weights, ...w } })),

  addPatient: (p) => {
    const { resources, weights, addAudit } = get();
    const id = uuid();
    const newPatient: Patient = {
      ...p,
      id,
      mrn: deriveMrn(id),
      dob: deriveDateOfBirth(id, p.age),
      score: 0, allocated: false,
      arrivalTime: Date.now(), waitMinutes: 0,
    };
    newPatient.score = computeScore(newPatient, resources, weights);
    set(s => ({ patients: [...s.patients, newPatient] }));
    addAudit('TRIAGE', `New patient ${p.name} (ESI ${p.esi}) triaged to ${p.department}`, p.esi <= 2 ? 'critical' : p.esi === 3 ? 'warning' : 'info', 'Triage Nurse');
    if (p.esi === 1) toast.error(`🚨 ESI-1 CRITICAL: ${p.name} – Immediate intervention required!`, { duration: 6000 });
    else if (p.esi === 2) toast(`⚠️ ESI-2 Urgent: ${p.name} triaged to ${p.department}`, { duration: 4000 });
    return newPatient;
  },

  allocateBed: (patientId) => {
    const { resources, patients, addAudit } = get();
    const patient = patients.find(p => p.id === patientId);
    if (!patient) return;
    if (patient.allocated) {
      toast.error('CONFLICT: ' + patient.name + ' already allocated to ' + patient.allocatedBay, { duration: 4000 });
      set(s => ({ conflictLog: ['Double-allocation blocked: ' + patient.name, ...s.conflictLog].slice(0, 50) }));
      return;
    }
    const res = resources.find(r => r.type === patient.targetResource);
    if (!res || res.occupied >= res.total) {
      toast.error('CAPACITY VIOLATION: No ' + patient.targetResource + ' available for ' + patient.name, { duration: 5000 });
      addAudit('THRESHOLD', 'Bed allocation DENIED for ' + patient.name + ' - ' + patient.targetResource + ' at full capacity', 'critical', 'System');
      set(s => ({ conflictLog: ['CAPACITY VIOLATION - ' + patient.targetResource + ' full, ' + patient.name + ' denied', ...s.conflictLog].slice(0, 50) }));
      return;
    }
    const bayNum = res.occupied + 1;
    const bayLabel = patient.targetResource.split(' ')[0] + ' Bay ' + bayNum;
    const updatedResources = resources.map(r => r.type === patient.targetResource ? { ...r, occupied: Math.min(r.occupied + 1, r.total) } : r);
    const bedAlloc: BedAllocation = {
      id: uuid(),
      patientId: patient.id,
      patientName: patient.name,
      resourceType: patient.targetResource,
      bayLabel,
      timestamp: Date.now(),
      esi: patient.esi,
    };
    set(s => ({
      patients: s.patients.map(p => p.id === patientId ? { ...p, allocated: true, allocatedBay: bayLabel, allocatedAt: Date.now() } : p),
      resources: updatedResources,
      bedAllocations: [bedAlloc, ...s.bedAllocations],
      overallUtil: overallUtilization(updatedResources),
    }));
    addAudit('BED_ALLOC', patient.name + ' (ESI ' + patient.esi + ') allocated to ' + bayLabel, 'info', 'Clinical Staff');
    toast.success(patient.name + ' -> ' + bayLabel, { duration: 3000 });
    const updatedICU = get().resources.find(r => r.type === 'ICU Critical Beds');
    if (updatedICU && updatedICU.occupied / updatedICU.total >= 0.8) {
      addAudit('THRESHOLD', 'ICU at ' + Math.round(updatedICU.occupied/updatedICU.total*100) + '% - Regional Diversion Protocol ACTIVATED', 'critical', 'System');
      set({ diversionActive: true });
      toast.error('ICU >=80% - Regional Diversion ACTIVATED', { duration: 8000 });
    }
  },

  deletePatient: (patientId) => {
    const { patients, addAudit } = get();
    const patient = patients.find(p => p.id === patientId);
    if (!patient) return;
    const record: DeletedPatientRecord = {
      id: uuid(),
      patientId: patient.id,
      name: patient.name,
      mrn: patient.mrn,
      condition: patient.condition,
      department: patient.department,
      esi: patient.esi,
      arrivalTime: patient.arrivalTime,
      deletionTime: Date.now(),
      wasAllocated: patient.allocated,
      allocatedBay: patient.allocatedBay,
    };
    set(s => ({
      patients: s.patients.filter(p => p.id !== patientId),
      resources: patient.allocated ? s.resources.map(r => r.type === patient.targetResource ? { ...r, occupied: Math.max(0, r.occupied - 1) } : r) : s.resources,
      deletedPatients: [record, ...s.deletedPatients].slice(0, 100),
      overallUtil: overallUtilization(s.resources),
    }));
    addAudit('DISCHARGE', `Patient DELETED & ARCHIVED: ${patient.name} | MRN ${patient.mrn} | Condition: ${patient.condition} | Dept: ${patient.department} | ESI ${patient.esi} | Arrived ${new Date(patient.arrivalTime).toLocaleString()}` + (patient.allocated ? ` | Bed freed from ${patient.allocatedBay}` : ''), 'info', 'Clinical Staff');
    toast.success(`${patient.name} deleted & archived` + (patient.allocated ? ` · Bed freed from ${patient.allocatedBay}` : ''), { duration: 4000 });
  },

  dischargePatient: (patientId) => {
    const { patients, addAudit } = get();
    const patient = patients.find(p => p.id === patientId);
    if (!patient || !patient.allocated) return;
    set(s => ({
      patients: s.patients.filter(p => p.id !== patientId),
      resources: s.resources.map(r => r.type === patient.targetResource ? { ...r, occupied: Math.max(0, r.occupied - 1) } : r),
      overallUtil: overallUtilization(s.resources),
    }));
    addAudit('DISCHARGE', patient.name + ' discharged from ' + patient.allocatedBay + ' - bed freed', 'info', 'Clinical Staff');
    toast.success(patient.name + ' discharged - bed freed', { duration: 3000 });
  },

  sortedQueue: () => {
    const { patients, resources, strategy, weights } = get();
    return sortByStrategy(patients.filter(p => !p.allocated), strategy, resources, weights);
  },

  utilizationStats: () => {
    const { resources } = get();
    return resources.map(r => ({
      type: r.type,
      pct: r.total > 0 ? Math.round((r.occupied / r.total) * 100) : 0,
      available: r.total - r.occupied,
      total: r.total,
    }));
  },

  tickWaitTimes: () => set(s => {
    const { resources, weights } = s;
    return {
      patients: s.patients.map(p => p.allocated ? p : {
        ...p,
        waitMinutes: p.waitMinutes + 1,
        score: computeScore({ ...p, waitMinutes: p.waitMinutes + 1 }, resources, weights),
      })
    };
  }),

  ambulances: SEED_AMBULANCES,
  arrivalPatterns: generateArrivalPattern(),
  tickAmbulances: () => set(s => ({
    ambulances: s.ambulances.map(a => a.arrived ? a : { ...a, etaSeconds: Math.max(0, a.etaSeconds - 5) })
  })),
  fastForwardAmbulance: (id) => {
    const { ambulances, addPatient, addAudit } = get();
    const unit = ambulances.find(a => a.id === id);
    if (!unit || unit.arrived) return;
    set(s => ({ ambulances: s.ambulances.map(a => a.id === id ? { ...a, arrived: true, etaSeconds: 0 } : a) }));
    addPatient({
      name: unit.patientName, age: 35 + Math.floor(Math.random() * 30),
      esi: unit.esi, condition: unit.condition,
      department: inferDepartmentFromCondition(unit.condition),
      targetResource: unit.esi <= 2 ? 'Acute ER Bays' : 'Acute ER Bays',
      vitals: { bp: '90/60', hr: 110, spo2: 92, temp: 37.2 },
      deteriorationRisk: unit.esi === 1 ? 0.9 : 0.65,
    });
    addAudit('TRIAGE', `EMS Unit arrived: ${unit.patientName} from ${unit.origin} → ${unit.targetBay}`, 'warning', 'EMS Dispatch');
    toast(`🚑 EMS Arrived: ${unit.patientName} → ${unit.targetBay}`, { duration: 4000 });
  },
  generateArrivalPatterns: () => set({ arrivalPatterns: generateArrivalPattern() }),

  throughput: SEED_THROUGHPUT,

  auditLog: [
    { id: uuid(), timestamp: Date.now() - 3600000, type: 'TRIAGE', message: 'System initialized – MEDFLOW v2.0 operational', severity: 'info', actor: 'System' },
    { id: uuid(), timestamp: Date.now() - 1800000, type: 'THRESHOLD', message: 'ICU load reached 73% – monitoring elevated', severity: 'warning', actor: 'System' },
  ],
  addAudit: (type, message, severity, actor = 'System') => set(s => ({
    auditLog: [{ id: uuid(), timestamp: Date.now(), type, message, severity, actor }, ...s.auditLog].slice(0, 200)
  })),

  chatMessages: [
    { id: uuid(), role: 'ai', content: 'SENTINEL AI online. I\'m monitoring all hospital systems in real-time. Ask me about ICU capacity, triage priorities, staffing ratios, or diversion protocols.', timestamp: Date.now() }
  ],
  sendChat: (msg) => {
    const { resources, patients, addAudit } = get();
    const userMsg: ChatMessage = { id: uuid(), role: 'user', content: msg, timestamp: Date.now() };
    const aiContent = generateAIResponse(msg, resources, patients);
    const aiMsg: ChatMessage = { id: uuid(), role: 'ai', content: aiContent, timestamp: Date.now() + 1000 };
    set(s => ({ chatMessages: [...s.chatMessages, userMsg, aiMsg] }));
    addAudit('AI_ACTION', `AI consulted: "${msg.slice(0, 60)}..."`, 'info', 'Sentinel AI');
  },

  diversionActive: false,
  overallUtil: overallUtilization(INITIAL_RESOURCES),
  conflictLog: [] as string[],

  portalMessages: [],
  sendPortalMessage: (msg) => {
    const { patients, addAudit } = get();
    const patient = patients.find(p => p.id === msg.patientId);
    const patientName = patient?.name || 'Unknown';
    const message: PortalMessage = {
      ...msg,
      id: uuid(),
      timestamp: Date.now(),
      patientName,
    };
    set(s => ({ portalMessages: [...s.portalMessages, message] }));
    addAudit('TRIAGE', `Patient message [${msg.urgency}]: "${msg.content.slice(0, 60)}..." from ${msg.senderName} in ${msg.roomNumber}`, msg.urgency === 'critical' ? 'critical' : msg.urgency === 'high' ? 'warning' : 'info', patientName);
  },
  getSortedPortalMessages: (patientId) => {
    const { portalMessages } = get();
    const urgencyOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    return portalMessages
      .filter(m => m.patientId === patientId)
      .sort((a, b) => urgencyOrder[a.urgency] - urgencyOrder[b.urgency] || b.timestamp - a.timestamp);
  },

  // ── Simulation Triggers ───────────────────────────────────────────

  triggerMCI: () => {
    const { addPatient, addAudit } = get();
    const mciPatients = [
      { name: 'MCI-Alpha', age: 34, esi: 1 as ESILevel, condition: 'Blast Trauma – Polytrauma', department: 'Trauma ER' as Department, targetResource: 'Acute ER Bays' as ResourceType, vitals: { bp: '70/40', hr: 140, spo2: 84, temp: 36.1 }, deteriorationRisk: 0.95 },
      { name: 'MCI-Bravo', age: 28, esi: 1 as ESILevel, condition: 'Penetrating Chest Wound', department: 'Trauma ER' as Department, targetResource: 'ICU Critical Beds' as ResourceType, vitals: { bp: '80/50', hr: 130, spo2: 86, temp: 35.8 }, deteriorationRisk: 0.93 },
      { name: 'MCI-Charlie', age: 45, esi: 2 as ESILevel, condition: 'Crush Injury – Lower Extremity', department: 'OR Suites' as Department, targetResource: 'Operating Theatres' as ResourceType, vitals: { bp: '95/65', hr: 118, spo2: 91, temp: 36.5 }, deteriorationRisk: 0.78 },
      { name: 'MCI-Delta', age: 52, esi: 2 as ESILevel, condition: 'Traumatic Brain Injury', department: 'Neurology' as Department, targetResource: 'CT Scanners' as ResourceType, vitals: { bp: '160/100', hr: 55, spo2: 93, temp: 37.8 }, deteriorationRisk: 0.82 },
      { name: 'MCI-Echo', age: 19, esi: 1 as ESILevel, condition: 'Hemorrhagic Shock', department: 'ICU' as Department, targetResource: 'ICU Critical Beds' as ResourceType, vitals: { bp: '60/30', hr: 155, spo2: 80, temp: 35.2 }, deteriorationRisk: 0.97 },
    ];
    mciPatients.forEach(p => addPatient(p));
    addAudit('SURGE', '🚨 MASS CASUALTY INCIDENT DECLARED – 5 critical patients incoming', 'critical', 'Emergency Director');
    toast.error('🚨 MCI ACTIVATED – 5 trauma patients injected into queue', { duration: 8000 });
  },

  triggerStaffShortage: () => {
    const { resources, addAudit } = get();
    const physicians = resources.find(r => r.type === 'Physicians')!;
    const nurses = resources.find(r => r.type === 'Nurses')!;
    set(s => ({
      resources: s.resources.map(r => {
        if (r.type === 'Physicians') return { ...r, total: Math.max(1, Math.floor(r.total * 0.7)) };
        if (r.type === 'Nurses') return { ...r, total: Math.max(1, Math.floor(r.total * 0.7)) };
        return r;
      })
    }));
    addAudit('THRESHOLD', `Staff shortage: Physicians reduced to ${Math.floor(physicians.total*0.7)}, Nurses to ${Math.floor(nurses.total*0.7)} (30% reduction)`, 'critical', 'HR System');
    toast.error('⚠️ STAFF SHORTAGE: 30% reduction in physicians & nurses', { duration: 6000 });
  },

  triggerICUCrisis: () => {
    const { addAudit } = get();
    set(s => ({
      resources: s.resources.map(r => r.type === 'ICU Critical Beds' ? { ...r, occupied: r.total } : r),
      diversionActive: true,
    }));
    addAudit('DIVERSION', '🚨 ICU at 100% – Emergency Regional Diversion Protocol ACTIVATED', 'critical', 'System');
    toast.error('🚨 ICU FULL – Regional Diversion Protocol ACTIVE', { duration: 8000 });
  },

  triggerEquipmentFailure: () => {
    const { addAudit } = get();
    set(s => ({
      resources: s.resources.map(r => {
        if (r.type === 'CT Scanners') return { ...r, total: Math.max(1, r.total - 2) };
        if (r.type === 'Operating Theatres') return { ...r, total: Math.max(1, r.total - 1) };
        return r;
      })
    }));
    addAudit('FAILURE', '⚙️ CT Scanner tube failure (2 units offline) + OR Theatre HVAC shutdown (1 theatre offline)', 'critical', 'Facilities');
    toast.error('⚙️ EQUIPMENT FAILURE: CT Scanner & OR Theatre offline', { duration: 6000 });
  },
    }),
    {
      name: SESSION_STORAGE_KEY,
      version: SESSION_STORAGE_VERSION,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => {
        const { simTime, ...persisted } = state;
        return persisted;
      },
    }
  )
);
