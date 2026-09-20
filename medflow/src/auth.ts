import { Patient, PortalAccess, Role, StaffRole } from './types';

export const MRN_PREFIX = 'M';
export const FAMILY_CODE_PREFIX = 'FAM';
const MRN_DIGITS = 6;

const hashString = (value: string): number => {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

const toIsoDate = (date: Date): string => {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
};

export const deriveMrn = (patientId: string): string => {
  let digits = '';
  let seed = hashString(patientId);
  while (digits.length < MRN_DIGITS) {
    seed = hashString(`${seed}:mrn`);
    digits += String(seed % 10);
  }
  return `${MRN_PREFIX}${digits}`;
};

export const deriveDateOfBirth = (patientId: string, age: number): string => {
  const birth = new Date();
  birth.setFullYear(birth.getFullYear() - age);
  birth.setDate(birth.getDate() - (hashString(`${patientId}:dob`) % 364));
  return toIsoDate(birth);
};

export const deriveFamilyCode = (patientId: string): string =>
  `${FAMILY_CODE_PREFIX}-${hashString(`${patientId}:family`).toString(16).toUpperCase().padStart(8, '0').slice(0, MRN_DIGITS)}`;

export const mrnDigits = (raw: string): string => raw.replace(/\D/g, '');

export const normalizeDob = (raw: string): string => {
  const parts = raw.trim().split(/[./-]/).filter(Boolean);
  if (parts.length !== 3) return '';
  const [first, middle, last] = parts;
  const month = middle.padStart(2, '0');
  if (first.length === 4) return `${first}-${month}-${last.padStart(2, '0')}`;
  if (last.length === 4) return `${last}-${month}-${first.padStart(2, '0')}`;
  return '';
};

export const formatDobForDisplay = (dob: string): string => {
  const [year, month, day] = dob.split('-');
  if (!year || !month || !day) return dob;
  return `${day}/${month}/${year}`;
};

export const findPatientByCredentials = (
  patients: Patient[],
  mrn: string,
  dob: string
): Patient | undefined => {
  const digits = mrnDigits(mrn);
  const birthDate = normalizeDob(dob);
  if (digits.length !== MRN_DIGITS || !birthDate) return undefined;
  return patients.find(
    patient => mrnDigits(patient.mrn) === digits && normalizeDob(patient.dob) === birthDate
  );
};

export const findPatientByFamilyCode = (
  patients: Patient[],
  code: string
): Patient | undefined => {
  const normalized = code.trim().toUpperCase().replace(/[\s_]/g, '');
  if (!normalized.startsWith(FAMILY_CODE_PREFIX)) return undefined;
  return patients.find(patient => deriveFamilyCode(patient.id) === normalized);
};

export interface StaffAccount {
  email: string;
  password: string;
  name: string;
}

export const STAFF_ACCOUNTS: Record<StaffRole, StaffAccount> = {
  director: { email: 'director@medflow.io', password: 'Director@2025', name: 'Dr. Sarah Chen' },
  clinical: { email: 'nurse@medflow.io', password: 'Clinical@2025', name: 'Nurse Rivera' },
};

export const authenticateStaff = (
  role: StaffRole,
  email: string,
  password: string
): StaffAccount | undefined => {
  const account = STAFF_ACCOUNTS[role];
  if (email.trim().toLowerCase() !== account.email || password !== account.password) return undefined;
  return account;
};

export interface Session {
  role: Role | null;
  authedPatientId: string | null;
  portalAccess: PortalAccess;
}

export const isPortalRole = (role: Role | null): boolean => role === 'patient' || role === 'family';

export const canActOnPatientRecord = (session: Session, patientId: string): boolean =>
  session.role === 'patient' &&
  session.portalAccess === 'full' &&
  session.authedPatientId !== null &&
  session.authedPatientId === patientId;
