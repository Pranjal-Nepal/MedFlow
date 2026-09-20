export type ESILevel = 1 | 2 | 3 | 4 | 5;
export type Department = 'Trauma ER' | 'ICU' | 'OR Suites' | 'Cardiology' | 'Neurology' | 'Orthopedics';
export type ResourceType = 'Acute ER Bays' | 'ICU Critical Beds' | 'Operating Theatres' | 'Physicians' | 'Nurses' | 'Ventilators' | 'CT Scanners';
export type Strategy = 'Dynamic Multi-Objective' | 'Urgency-Only' | 'Capacity-Preserving' | 'First-Come First-Served';
export type Role = 'director' | 'clinical' | 'patient' | 'family';
export type StaffRole = 'director' | 'clinical';
export type PortalAccess = 'full' | 'readonly';

export interface AuthResult {
  ok: boolean;
  error?: string;
}

export type PatientReportKind = 'pain_alert' | 'message' | 'symptoms' | 'comfort' | 'family_checkin';

export interface PatientReport {
  kind: PatientReportKind;
  message: string;
  toast: string;
  toastLevel?: 'success' | 'error';
}
export type AuditEventType = 'TRIAGE' | 'BED_ALLOC' | 'THRESHOLD' | 'DIVERSION' | 'SURGE' | 'FAILURE' | 'DISCHARGE' | 'AI_ACTION';

export interface Resource {
  type: ResourceType;
  total: number;
  occupied: number;
}

export interface Patient {
  id: string;
  mrn: string;
  dob: string;
  name: string;
  age: number;
  esi: ESILevel;
  condition: string;
  department: Department;
  targetResource: ResourceType;
  vitals: { bp: string; hr: number; spo2: number; temp: number };
  deteriorationRisk: number;
  arrivalTime: number;
  waitMinutes: number;
  score: number;
  allocated: boolean;
  allocatedBay?: string;
}

export interface AmbulanceUnit {
  id: string;
  origin: string;
  patientName: string;
  esi: ESILevel;
  condition: string;
  etaSeconds: number;
  targetBay: string;
  arrived: boolean;
}

export interface AuditEvent {
  id: string;
  timestamp: number;
  type: AuditEventType;
  message: string;
  severity: 'info' | 'warning' | 'critical';
  actor: string;
}

export interface ThroughputPoint {
  hour: string;
  arrivals: number;
  discharges: number;
  capacity: number;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'ai';
  content: string;
  timestamp: number;
}

export type NewPatientInput = Omit<
  Patient,
  'id' | 'mrn' | 'dob' | 'score' | 'allocated' | 'arrivalTime' | 'waitMinutes'
>;
