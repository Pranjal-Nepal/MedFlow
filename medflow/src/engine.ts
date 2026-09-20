import { ESILevel, Patient, Resource, ResourceType, Department, AmbulanceArrivalPattern } from './types';

export const ESI_URGENCY: Record<ESILevel, number> = { 1: 100, 2: 78, 3: 45, 4: 20, 5: 5 };

export const DEPARTMENT_ARRIVAL_PATTERNS: Record<Department, AmbulanceArrivalPattern> = {
  'Trauma ER':     { hour: 0, expectedArrivals: 4, intervalMinutes: 30, peakMultiplier: 1.8 },
  'ICU':           { hour: 0, expectedArrivals: 2, intervalMinutes: 60, peakMultiplier: 1.3 },
  'OR Suites':     { hour: 0, expectedArrivals: 1, intervalMinutes: 90, peakMultiplier: 1.5 },
  'Cardiology':    { hour: 0, expectedArrivals: 2, intervalMinutes: 60, peakMultiplier: 2.0 },
  'Neurology':     { hour: 0, expectedArrivals: 1, intervalMinutes: 75, peakMultiplier: 1.4 },
  'Orthopedics':   { hour: 0, expectedArrivals: 1, intervalMinutes: 120, peakMultiplier: 1.2 },
};

export const PEAK_HOURS: number[] = [8, 9, 10, 11, 12, 13, 14, 17, 18, 19, 20];

export const computeArrivalRate = (hour: number, baseRate: number, peakMultiplier: number): number => {
  const isPeak = PEAK_HOURS.includes(hour);
  return isPeak ? Math.round(baseRate * peakMultiplier) : baseRate;
};

export const generateArrivalPattern = (): AmbulanceArrivalPattern[] => {
  return Object.entries(DEPARTMENT_ARRIVAL_PATTERNS).map(([dept, pattern]) => {
    const hour = new Date().getHours();
    const adjustedRate = computeArrivalRate(hour, pattern.expectedArrivals, pattern.peakMultiplier);
    return {
      ...pattern,
      hour,
      expectedArrivals: adjustedRate,
    };
  });
};

export const predictAmbulanceArrivals = (
  patterns: AmbulanceArrivalPattern[],
  minutesAhead: number
): { hour: number; expectedCount: number }[] => {
  const hour = new Date().getHours();
  const futureHour = (hour + Math.floor(minutesAhead / 60)) % 24;
  return patterns.map(p => {
    const isPeak = PEAK_HOURS.includes(futureHour);
    const multiplier = isPeak ? p.peakMultiplier : 1;
    return {
      hour: futureHour,
      expectedCount: Math.max(0, Math.round(p.expectedArrivals * multiplier * (minutesAhead / 60))),
    };
  });
};

export const sigmoid = (z: number): number => 1 / (1 + Math.exp(-4 * (z - 0.5)));

export const scarcityCost = (resources: Resource[], type: ResourceType): number => {
  const r = resources.find(r => r.type === type);
  if (!r || r.total === 0) return 1;
  return r.occupied / r.total;
};

export const computeScore = (
  patient: Pick<Patient, 'esi' | 'waitMinutes' | 'deteriorationRisk' | 'targetResource'>,
  resources: Resource[],
  weights: { wu: number; ww: number; wr: number }
): number => {
  const U = ESI_URGENCY[patient.esi];
  const tw = patient.waitMinutes;
  const Cr = scarcityCost(resources, patient.targetResource);
  const Z = patient.deteriorationRisk;
  return weights.wu * U + weights.ww * Math.log(1 + tw) - weights.wr * Cr + 15 * sigmoid(Z);
};

export const scoreBreakdown = (
  patient: Patient,
  resources: Resource[],
  weights: { wu: number; ww: number; wr: number }
) => {
  const U = ESI_URGENCY[patient.esi];
  const tw = patient.waitMinutes;
  const Cr = scarcityCost(resources, patient.targetResource);
  const Z = patient.deteriorationRisk;
  const sig = sigmoid(Z);
  const urgencyTerm = weights.wu * U;
  const waitTerm = weights.ww * Math.log(1 + tw);
  const scarcityTerm = weights.wr * Cr;
  const deteriorationTerm = 15 * sig;
  const total = urgencyTerm + waitTerm - scarcityTerm + deteriorationTerm;
  return { U, tw, Cr, Z, sig, urgencyTerm, waitTerm, scarcityTerm, deteriorationTerm, total };
};

export const sortByStrategy = (
  patients: Patient[],
  strategy: string,
  resources: Resource[],
  weights: { wu: number; ww: number; wr: number }
): Patient[] => {
  const scored = patients.map(p => ({ ...p, score: computeScore(p, resources, weights) }));
  switch (strategy) {
    case 'Urgency-Only':
      return [...scored].sort((a, b) => ESI_URGENCY[b.esi] - ESI_URGENCY[a.esi]);
    case 'Capacity-Preserving':
      return [...scored].sort((a, b) => scarcityCost(resources, a.targetResource) - scarcityCost(resources, b.targetResource));
    case 'First-Come First-Served':
      return [...scored].sort((a, b) => a.arrivalTime - b.arrivalTime);
    default:
      return [...scored].sort((a, b) => b.score - a.score);
  }
};

export const utilizationPct = (resources: Resource[], type: ResourceType): number => {
  const r = resources.find(x => x.type === type);
  if (!r || r.total === 0) return 0;
  return Math.round((r.occupied / r.total) * 100);
};

export const overallUtilization = (resources: Resource[]): number => {
  const total   = resources.reduce((s, r) => s + r.total, 0);
  const occupied = resources.reduce((s, r) => s + r.occupied, 0);
  return total === 0 ? 0 : Math.round((occupied / total) * 100);
};

export const predictSaturationMinutes = (resources: Resource[], type: ResourceType, arrivalRatePerHour: number): number | null => {
  const r = resources.find(x => x.type === type);
  if (!r) return null;
  const available = r.total - r.occupied;
  if (available <= 0) return 0;
  if (arrivalRatePerHour <= 0) return null;
  return Math.round((available / arrivalRatePerHour) * 60);
};

export const compareStrategies = (
  patients: Patient[],
  resources: Resource[],
  weights: { wu: number; ww: number; wr: number }
) => {
  const unallocated = patients.filter(p => !p.allocated);
  const strategies = ['Dynamic Multi-Objective','Urgency-Only','Capacity-Preserving','First-Come First-Served'] as const;
  return strategies.map(s => {
    const sorted = sortByStrategy(unallocated, s, resources, weights);
    const avgWait = sorted.length ? sorted.reduce((a, p) => a + p.waitMinutes, 0) / sorted.length : 0;
    const esi1ResponseRank = sorted.findIndex(p => p.esi === 1);
    const starvationRisk = sorted.filter(p => p.esi >= 4 && p.waitMinutes > 60).length;
    return { strategy: s, avgWait: +avgWait.toFixed(1), esi1Rank: esi1ResponseRank === -1 ? 'N/A' : `#${esi1ResponseRank + 1}`, starvationRisk, throughput: sorted.length };
  });
};

export const inferDepartmentFromCondition = (condition: string): Department => {
  const lower = condition.toLowerCase();
  if (['cardiac arrest','heart attack','stemi','chest pain','angina','acute coronary'].some(k => lower.includes(k))) return 'Cardiology';
  if (['stroke','hemorrhagic','brain bleed','intracranial','tbi','traumatic brain'].some(k => lower.includes(k))) return 'Neurology';
  if (['septic shock','sepsis','appendicitis','acute abdomen','bowel obstruction'].some(k => lower.includes(k))) return 'ICU';
  if (['polytrauma','multiple trauma','blast','explosion','burns','burn injury'].some(k => lower.includes(k))) return 'Trauma ER';
  if (['fracture','broken bone','sprain','strain','ankle'].some(k => lower.includes(k))) return 'Orthopedics';
  if (['respiratory arrest','not breathing','apnea','airway obstruction','respiratory distress','difficulty breathing'].some(k => lower.includes(k))) return 'Trauma ER';
  return 'Trauma ER';
};
