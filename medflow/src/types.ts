// ─── Core Domain Types ────────────────────────────────────────────────────────

export type ESILevel = 1 | 2 | 3 | 4 | 5;
export type Department = 'Trauma ER' | 'ICU' | 'OR Suites' | 'Cardiology' | 'Neurology' | 'Orthopedics';
export type ResourceType = 'Acute ER Bays' | 'ICU Critical Beds' | 'Operating Theatres' | 'Physicians' | 'Nurses' | 'Ventilators' | 'CT Scanners';
export type Strategy = 'Dynamic Multi-Objective' | 'Urgency-Only' | 'Capacity-Preserving' | 'First-Come First-Served';
export type Role = 'director' | 'clinical' | 'patient';
export type AuditEventType = 'TRIAGE' | 'BED_ALLOC' | 'THRESHOLD' | 'DIVERSION' | 'SURGE' | 'FAILURE' | 'DISCHARGE' | 'AI_ACTION';

export interface Resource {
  type: ResourceType;
  total: number;
  occupied: number;
}

export interface Patient {
  id: string;
  name: string;
  age: number;
  esi: ESILevel;
  condition: string;
  department: Department;
  targetResource: ResourceType;
  vitals: { bp: string; hr: number; spo2: number; temp: number };
  deteriorationRisk: number; // 0–1
  arrivalTime: number; // timestamp ms
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
