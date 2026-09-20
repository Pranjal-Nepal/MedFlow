// ─── Mathematical Scoring Engine ─────────────────────────────────────────────
// Formula: S_i = w_u·U_i + w_w·ln(1+t_w) - w_r·C_r + 15·σ(Z_risk)
// Strategies: Dynamic Multi-Objective | Urgency-Only | Capacity-Preserving | FCFS

import { ESILevel, Patient, Resource, ResourceType } from './types';

export const ESI_URGENCY: Record<ESILevel, number> = { 1: 100, 2: 78, 3: 45, 4: 20, 5: 5 };

/** Sigmoid clinical deterioration curve */
export const sigmoid = (z: number): number => 1 / (1 + Math.exp(-4 * (z - 0.5)));

/** Resource scarcity cost C_r = occupied / total */
export const scarcityCost = (resources: Resource[], type: ResourceType): number => {
  const r = resources.find(r => r.type === type);
  if (!r || r.total === 0) return 1;
  return r.occupied / r.total;
};

/** Core priority score */
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

/** Step-by-step breakdown for Formula Inspector */
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

/** Sort patients by strategy */
export const sortByStrategy = (
  patients: Patient[],
  strategy: string,
  resources: Resource[],
  weights: { wu: number; ww: number; wr: number }
): Patient[] => {
  const scored = patients.map(p => ({ ...p, score: computeScore(p, resources, weights) }));
  switch (strategy) {
    case 'Urgency-Only':
      // Pure ESI rank — ignores wait time and resource state
      return [...scored].sort((a, b) => ESI_URGENCY[b.esi] - ESI_URGENCY[a.esi]);
    case 'Capacity-Preserving':
      // Prefer patients whose target resource is LEAST scarce to avoid bottlenecks
      return [...scored].sort((a, b) => scarcityCost(resources, a.targetResource) - scarcityCost(resources, b.targetResource));
    case 'First-Come First-Served':
      // Strict arrival order — no clinical weighting
      return [...scored].sort((a, b) => a.arrivalTime - b.arrivalTime);
    default:
      // Dynamic Multi-Objective: full formula balancing urgency + wait aging + scarcity + deterioration
      return [...scored].sort((a, b) => b.score - a.score);
  }
};

/** Resource utilization % per type */
export const utilizationPct = (resources: Resource[], type: ResourceType): number => {
  const r = resources.find(x => x.type === type);
  if (!r || r.total === 0) return 0;
  return Math.round((r.occupied / r.total) * 100);
};

/** Overall hospital utilization across all resources */
export const overallUtilization = (resources: Resource[]): number => {
  const total   = resources.reduce((s, r) => s + r.total, 0);
  const occupied = resources.reduce((s, r) => s + r.occupied, 0);
  return total === 0 ? 0 : Math.round((occupied / total) * 100);
};

/** Predict minutes until a resource hits 100% given current arrival rate */
export const predictSaturationMinutes = (resources: Resource[], type: ResourceType, arrivalRatePerHour: number): number | null => {
  const r = resources.find(x => x.type === type);
  if (!r) return null;
  const available = r.total - r.occupied;
  if (available <= 0) return 0;
  if (arrivalRatePerHour <= 0) return null;
  return Math.round((available / arrivalRatePerHour) * 60);
};

/** Live strategy comparison — simulate each strategy score distribution */
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
