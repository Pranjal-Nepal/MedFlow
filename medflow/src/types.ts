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
  arrivalPattern?: AmbulanceArrivalPattern;
}

export interface AmbulanceArrivalPattern {
  hour: number;
  expectedArrivals: number;
  intervalMinutes: number;
  peakMultiplier: number;
}

export interface BedAllocation {
  id: string;
  patientId: string;
  patientName: string;
  resourceType: ResourceType;
  bayLabel: string;
  timestamp: number;
  esi: ESILevel;
}

export interface AuditEvent {
  id: string;
  timestamp: number;
  type: AuditEventType;
  message: string;
  severity: 'info' | 'warning' | 'critical';
  actor: string;
}

export interface DeletedPatientRecord {
  id: string;
  patientId: string;
  name: string;
  mrn: string;
  condition: string;
  department: Department;
  esi: ESILevel;
  arrivalTime: number;
  deletionTime: number;
  wasAllocated: boolean;
  allocatedBay?: string;
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

export interface PortalMessage {
  id: string;
  patientId: string;
  patientName: string;
  senderName: string;
  roomNumber: string;
  urgency: 'low' | 'medium' | 'high' | 'critical';
  content: string;
  timestamp: number;
}

export interface DepartmentConfig {
  name: Department;
  head: string;
  phoneExtension: string;
  color: string;
}

export type NewPatientInput = Omit<
  Patient,
  'id' | 'mrn' | 'dob' | 'score' | 'allocated' | 'arrivalTime' | 'waitMinutes'
>;
