// ─── Nurse Triage Intake – Smart Walk-In Patient Registration ────────────────
// Nurse enters condition + vitals → system auto-suggests ESI, dept, resource
// → live priority score preview → one-click register into queue

import React, { useState, useMemo } from 'react';
import { Stethoscope, Zap, CheckCircle, RefreshCw, AlertTriangle } from 'lucide-react';
import { useMedFlow } from '../store';
import { computeScore, ESI_URGENCY, sigmoid } from '../engine';
import { Department, ESILevel, ResourceType } from '../types';

// ── Condition → ESI / Dept / Resource inference rules ────────────────────────
interface TriageRule {
  keywords: string[];
  esi: ESILevel;
  department: Department;
  resource: ResourceType;
  risk: number;
}

const TRIAGE_RULES: TriageRule[] = [
  { keywords: ['cardiac arrest','heart attack','stemi','ventricular fibrillation','vf','pulseless'],
    esi: 1, department: 'ICU',       resource: 'ICU Critical Beds',  risk: 0.95 },
  { keywords: ['stroke','hemorrhagic','brain bleed','intracranial'],
    esi: 1, department: 'Neurology', resource: 'CT Scanners',        risk: 0.92 },
  { keywords: ['respiratory arrest','not breathing','apnea','airway obstruction'],
    esi: 1, department: 'Trauma ER', resource: 'Ventilators',        risk: 0.93 },
  { keywords: ['hemorrhagic shock','massive bleeding','uncontrolled hemorrhage'],
    esi: 1, department: 'Trauma ER', resource: 'ICU Critical Beds',  risk: 0.96 },
  { keywords: ['polytrauma','multiple trauma','blast','explosion'],
    esi: 1, department: 'Trauma ER', resource: 'Acute ER Bays',      risk: 0.94 },
  { keywords: ['septic shock','sepsis','severe sepsis'],
    esi: 2, department: 'ICU',       resource: 'ICU Critical Beds',  risk: 0.85 },
  { keywords: ['chest pain','angina','acute coronary'],
    esi: 2, department: 'Cardiology',resource: 'Acute ER Bays',      risk: 0.72 },
  { keywords: ['respiratory distress','difficulty breathing','shortness of breath','dyspnea'],
    esi: 2, department: 'Trauma ER', resource: 'Acute ER Bays',      risk: 0.70 },
  { keywords: ['burns','burn injury'],
    esi: 2, department: 'Trauma ER', resource: 'Acute ER Bays',      risk: 0.75 },
  { keywords: ['overdose','poisoning','toxic ingestion'],
    esi: 2, department: 'Trauma ER', resource: 'Acute ER Bays',      risk: 0.78 },
  { keywords: ['appendicitis','acute abdomen','bowel obstruction'],
    esi: 3, department: 'OR Suites', resource: 'Operating Theatres', risk: 0.55 },
  { keywords: ['fracture','broken bone','compound fracture'],
    esi: 3, department: 'Orthopedics',resource:'Acute ER Bays',      risk: 0.45 },
  { keywords: ['diabetic ketoacidosis','dka','hypoglycemia','hyperglycemia'],
    esi: 3, department: 'Trauma ER', resource: 'Acute ER Bays',      risk: 0.50 },
  { keywords: ['pneumonia','lung infection'],
    esi: 3, department: 'Trauma ER', resource: 'Acute ER Bays',      risk: 0.48 },
  { keywords: ['laceration','deep cut','wound'],
    esi: 4, department: 'Trauma ER', resource: 'Acute ER Bays',      risk: 0.20 },
  { keywords: ['sprain','strain','minor injury'],
    esi: 5, department: 'Orthopedics',resource:'Acute ER Bays',      risk: 0.05 },
  { keywords: ['headache','migraine'],
    esi: 4, department: 'Neurology', resource: 'Acute ER Bays',      risk: 0.18 },
  { keywords: ['fever','high temperature'],
    esi: 4, department: 'Trauma ER', resource: 'Acute ER Bays',      risk: 0.22 },
  { keywords: ['abdominal pain','stomach pain'],
    esi: 3, department: 'Trauma ER', resource: 'Acute ER Bays',      risk: 0.38 },
  { keywords: ['back pain','lower back'],
    esi: 5, department: 'Orthopedics',resource:'Acute ER Bays',      risk: 0.08 },
];

// Vitals-based ESI escalation
const escalateByVitals = (
  esi: ESILevel, hr: number, spo2: number, sbp: number, temp: number
): { esi: ESILevel; flags: string[] } => {
  const flags: string[] = [];
  let escalated = esi;
  if (spo2 < 90)  { flags.push(`SpO₂ critically low (${spo2}%)`);  escalated = Math.min(escalated, 2) as ESILevel; }
  if (hr > 130)   { flags.push(`Tachycardia (${hr} bpm)`);          escalated = Math.min(escalated, 2) as ESILevel; }
  if (hr < 40)    { flags.push(`Bradycardia (${hr} bpm)`);          escalated = Math.min(escalated, 1) as ESILevel; }
  if (sbp < 80)   { flags.push(`Hypotension (SBP ${sbp} mmHg)`);   escalated = Math.min(escalated, 1) as ESILevel; }
  if (temp > 39.5){ flags.push(`High fever (${temp}°C)`);           escalated = Math.min(escalated, 3) as ESILevel; }
  if (temp < 35)  { flags.push(`Hypothermia (${temp}°C)`);          escalated = Math.min(escalated, 2) as ESILevel; }
  return { esi: escalated as ESILevel, flags };
};

const inferFromCondition = (condition: string): TriageRule | null => {
  const lower = condition.toLowerCase();
  for (const rule of TRIAGE_RULES) {
    if (rule.keywords.some(k => lower.includes(k))) return rule;
  }
  return null;
};

const ESI_META: Record<ESILevel, { label: string; color: string; bg: string; wait: string }> = {
  1: { label: 'Resuscitation',  color: '#ef4444', bg: 'rgba(239,68,68,0.12)',   wait: 'Immediate' },
  2: { label: 'Emergent',       color: '#f59e0b', bg: 'rgba(245,158,11,0.12)',  wait: '< 15 min'  },
  3: { label: 'Urgent',         color: '#60a5fa', bg: 'rgba(96,165,250,0.12)',  wait: '< 30 min'  },
  4: { label: 'Less Urgent',    color: '#22c55e', bg: 'rgba(34,197,94,0.12)',   wait: '< 60 min'  },
  5: { label: 'Non-Urgent',     color: '#94a3b8', bg: 'rgba(148,163,184,0.12)', wait: '< 2 hrs'   },
};

const DEPARTMENTS: Department[]   = ['Trauma ER','ICU','OR Suites','Cardiology','Neurology','Orthopedics'];
const RESOURCES:   ResourceType[] = ['Acute ER Bays','ICU Critical Beds','Operating Theatres','Physicians','Nurses','Ventilators','CT Scanners'];

// ── Component ─────────────────────────────────────────────────────────────────
const NurseTriage: React.FC = () => {
  const { addPatient, resources, weights, patients } = useMedFlow();

  const [form, setForm] = useState({
    name: '', age: '' as string | number,
    condition: '',
    hr: '' as string | number,
    spo2: '' as string | number,
    bp: '',
    temp: '' as string | number,
  });

  // Derived suggestion state
  const [overrideESI,  setOverrideESI]  = useState<ESILevel | null>(null);
  const [overrideDept, setOverrideDept] = useState<Department | null>(null);
  const [overrideRes,  setOverrideRes]  = useState<ResourceType | null>(null);
  const [submitted, setSubmitted]       = useState<string | null>(null); // patient name after submit

  // Parse vitals
  const hr   = Number(form.hr)   || 80;
  const spo2 = Number(form.spo2) || 98;
  const temp = Number(form.temp) || 37.0;
  const sbp  = parseInt(form.bp?.split('/')[0]) || 120;

  // Infer from condition text
  const inferred = useMemo(() => inferFromCondition(form.condition), [form.condition]);

  // Vitals escalation on top of inferred ESI
  const baseESI: ESILevel = overrideESI ?? inferred?.esi ?? 3;
  const { esi: finalESI, flags: vitalFlags } = useMemo(
    () => escalateByVitals(baseESI, hr, spo2, sbp, temp),
    [baseESI, hr, spo2, sbp, temp]
  );

  const finalDept = overrideDept ?? inferred?.department ?? 'Trauma ER';
  const finalRes  = overrideRes  ?? inferred?.resource   ?? 'Acute ER Bays';
  const finalRisk = inferred?.risk ?? 0.3;

  // Live score preview
  const previewScore = useMemo(() => computeScore(
    { esi: finalESI, waitMinutes: 0, deteriorationRisk: finalRisk, targetResource: finalRes },
    resources, weights
  ), [finalESI, finalRisk, finalRes, resources, weights]);

  // Queue position preview — how many unallocated patients have higher score
  const queueAhead = useMemo(
    () => patients.filter(p => !p.allocated && p.score > previewScore).length,
    [patients, previewScore]
  );

  const esiMeta = ESI_META[finalESI];
  const canSubmit = form.name.trim() && form.condition.trim() && form.age;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    addPatient({
      name: String(form.name).trim(),
      age: Number(form.age),
      esi: finalESI,
      condition: form.condition.trim(),
      department: finalDept,
      targetResource: finalRes,
      vitals: { bp: form.bp || '120/80', hr, spo2, temp },
      deteriorationRisk: finalRisk,
    });
    setSubmitted(form.name.trim());
    // Reset
    setForm({ name: '', age: '', condition: '', hr: '', spo2: '', bp: '', temp: '' });
    setOverrideESI(null); setOverrideDept(null); setOverrideRes(null);
    setTimeout(() => setSubmitted(null), 5000);
  };

  const reset = () => {
    setForm({ name: '', age: '', condition: '', hr: '', spo2: '', bp: '', temp: '' });
    setOverrideESI(null); setOverrideDept(null); setOverrideRes(null);
    setSubmitted(null);
  };

  return (
    <div className="flex-col gap-20">
      <div className="page-title">
        <Stethoscope size={20} />
        Walk-In Patient Triage
        <span className="tag tag-info" style={{ marginLeft: 8 }}>Nurse Portal</span>
      </div>

      {/* Success banner */}
      {submitted && (
        <div style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid var(--success)', borderRadius: 10, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 10 }}>
          <CheckCircle size={18} style={{ color: 'var(--success)', flexShrink: 0 }} />
          <div>
            <div style={{ fontWeight: 700, color: 'var(--success)' }}>{submitted} registered & added to priority queue</div>
            <div className="text-xs text-muted" style={{ marginTop: 2 }}>Priority score computed. Dashboard and audit ledger updated in real-time.</div>
          </div>
        </div>
      )}

      <div className="grid-2" style={{ alignItems: 'start' }}>

        {/* ── Left: Input Form ── */}
        <div className="card">
          <div className="section-title mb-16"><Stethoscope size={14} />Patient Information</div>
          <form onSubmit={handleSubmit} className="flex-col gap-14">

            {/* Name + Age */}
            <div className="form-grid">
              <div className="form-group">
                <label className="form-label">Full Name *</label>
                <input className="form-input" value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. John Smith" required />
              </div>
              <div className="form-group">
                <label className="form-label">Age *</label>
                <input className="form-input" type="number" min={1} max={120}
                  value={form.age}
                  onChange={e => setForm(f => ({ ...f, age: e.target.value }))}
                  placeholder="e.g. 45" required />
              </div>
            </div>

            {/* Condition — the key field that drives inference */}
            <div className="form-group">
              <label className="form-label">Chief Complaint / Condition *</label>
              <input className="form-input" value={form.condition}
                onChange={e => { setForm(f => ({ ...f, condition: e.target.value })); setOverrideESI(null); setOverrideDept(null); setOverrideRes(null); }}
                placeholder="e.g. chest pain, respiratory distress, fracture…" required />
              {form.condition && !inferred && (
                <div className="text-xs" style={{ color: 'var(--warning)', marginTop: 4 }}>
                  ⚠ No exact match — defaulting to ESI 3 Urgent. Override below if needed.
                </div>
              )}
              {inferred && (
                <div className="text-xs" style={{ color: 'var(--success)', marginTop: 4 }}>
                  ✓ Condition recognised — auto-suggested ESI {inferred.esi}, {inferred.department}
                </div>
              )}
            </div>

            {/* Vitals */}
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14 }}>
              <div className="section-title mb-12" style={{ fontSize: 12 }}>Vitals <span className="text-muted" style={{ fontWeight: 400, fontSize: 11 }}>(used to escalate ESI if critical)</span></div>
              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">Heart Rate (bpm)</label>
                  <input className="form-input" type="number" value={form.hr}
                    onChange={e => setForm(f => ({ ...f, hr: e.target.value }))}
                    placeholder="e.g. 88" />
                </div>
                <div className="form-group">
                  <label className="form-label">SpO₂ (%)</label>
                  <input className="form-input" type="number" min={50} max={100} value={form.spo2}
                    onChange={e => setForm(f => ({ ...f, spo2: e.target.value }))}
                    placeholder="e.g. 97" />
                </div>
                <div className="form-group">
                  <label className="form-label">Blood Pressure</label>
                  <input className="form-input" value={form.bp}
                    onChange={e => setForm(f => ({ ...f, bp: e.target.value }))}
                    placeholder="e.g. 120/80" />
                </div>
                <div className="form-group">
                  <label className="form-label">Temperature (°C)</label>
                  <input className="form-input" type="number" step={0.1} value={form.temp}
                    onChange={e => setForm(f => ({ ...f, temp: e.target.value }))}
                    placeholder="e.g. 37.2" />
                </div>
              </div>
            </div>

            {/* Manual overrides */}
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14 }}>
              <div className="section-title mb-12" style={{ fontSize: 12 }}>Override Suggestions <span className="text-muted" style={{ fontWeight: 400, fontSize: 11 }}>(optional)</span></div>
              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">ESI Override</label>
                  <select className="form-select" value={overrideESI ?? ''}
                    onChange={e => setOverrideESI(e.target.value ? +e.target.value as ESILevel : null)}>
                    <option value="">— Use auto-suggest —</option>
                    {([1,2,3,4,5] as ESILevel[]).map(l => <option key={l} value={l}>ESI {l} – {ESI_META[l].label}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Department Override</label>
                  <select className="form-select" value={overrideDept ?? ''}
                    onChange={e => setOverrideDept(e.target.value as Department || null)}>
                    <option value="">— Use auto-suggest —</option>
                    {DEPARTMENTS.map(d => <option key={d}>{d}</option>)}
                  </select>
                </div>
              </div>
              <div className="form-group" style={{ marginTop: 12 }}>
                <label className="form-label">Target Resource Override</label>
                <select className="form-select" value={overrideRes ?? ''}
                  onChange={e => setOverrideRes(e.target.value as ResourceType || null)}>
                  <option value="">— Use auto-suggest —</option>
                  {RESOURCES.map(r => <option key={r}>{r}</option>)}
                </select>
              </div>
            </div>

            <div className="flex gap-8" style={{ marginTop: 4 }}>
              <button type="submit" className="btn btn-primary" style={{ flex: 1, justifyContent: 'center', padding: '10px' }} disabled={!canSubmit}>
                <Zap size={15} /> Register & Assign Priority
              </button>
              <button type="button" className="btn btn-ghost" onClick={reset} title="Reset form">
                <RefreshCw size={14} />
              </button>
            </div>
          </form>
        </div>

        {/* ── Right: Live Priority Preview ── */}
        <div className="flex-col gap-16">

          {/* ESI Result Card */}
          <div className="card" style={{ border: `2px solid ${esiMeta.color}`, background: esiMeta.bg }}>
            <div className="flex items-center justify-between mb-12">
              <div className="section-title" style={{ color: esiMeta.color }}>
                <Zap size={15} /> Auto-Assigned Priority
              </div>
              {vitalFlags.length > 0 && (
                <span className="tag tag-danger" style={{ fontSize: 10 }}>Vitals Escalated</span>
              )}
            </div>

            {/* Big ESI display */}
            <div className="flex items-center gap-16 mb-16">
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 64, fontWeight: 900, color: esiMeta.color, lineHeight: 1, fontFamily: 'JetBrains Mono' }}>
                  {finalESI}
                </div>
                <div style={{ fontSize: 10, color: esiMeta.color, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 }}>ESI Level</div>
              </div>
              <div className="flex-col gap-6">
                <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)' }}>{esiMeta.label}</div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Target response: <strong style={{ color: esiMeta.color }}>{esiMeta.wait}</strong></div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Department: <strong style={{ color: 'var(--text-primary)' }}>{finalDept}</strong></div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Resource: <strong style={{ color: 'var(--text-primary)' }}>{finalRes}</strong></div>
              </div>
            </div>

            {/* Vital flags */}
            {vitalFlags.length > 0 && (
              <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid var(--danger)', borderRadius: 6, padding: '8px 12px', marginBottom: 12 }}>
                <div className="flex items-center gap-6 mb-4">
                  <AlertTriangle size={12} style={{ color: 'var(--danger)' }} />
                  <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--danger)' }}>ESI escalated due to critical vitals:</span>
                </div>
                {vitalFlags.map(f => (
                  <div key={f} style={{ fontSize: 11, color: 'var(--danger)', paddingLeft: 18 }}>• {f}</div>
                ))}
              </div>
            )}

            {/* Priority Score */}
            <div style={{ background: 'var(--bg-elevated)', borderRadius: 8, padding: 12 }}>
              <div className="flex items-center justify-between mb-8">
                <span style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Computed Priority Score</span>
                <span style={{ fontFamily: 'JetBrains Mono', fontSize: 22, fontWeight: 900, color: 'var(--accent-light)' }}>
                  {previewScore.toFixed(1)}
                </span>
              </div>
              <div className="progress-bar" style={{ height: 6 }}>
                <div className="progress-fill" style={{
                  width: `${Math.min(100, (previewScore / 120) * 100)}%`,
                  background: esiMeta.color
                }} />
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>
                S = {weights.wu}·{ESI_URGENCY[finalESI]} + {weights.ww}·ln(1+0) − {weights.wr}·Cr + 15·σ({finalRisk.toFixed(2)})
              </div>
            </div>
          </div>

          {/* Queue Position Preview */}
          <div className="card">
            <div className="section-title mb-12">Estimated Queue Position</div>
            <div className="flex items-center gap-16">
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 48, fontWeight: 900, color: 'var(--accent-light)', fontFamily: 'JetBrains Mono', lineHeight: 1 }}>
                  #{queueAhead + 1}
                </div>
                <div className="text-xs text-muted">in queue</div>
              </div>
              <div className="flex-col gap-4">
                <div className="text-sm text-secondary">{queueAhead} patient{queueAhead !== 1 ? 's' : ''} currently ahead</div>
                <div className="text-xs text-muted">Based on live priority scores</div>
                <div className="text-xs text-muted">Score updates every 30s as wait time grows</div>
              </div>
            </div>
          </div>

          {/* Score breakdown */}
          <div className="card">
            <div className="section-title mb-10" style={{ fontSize: 12 }}>Score Breakdown</div>
            <div className="formula-box">
              {[
                { label: `w_u · U_i  (${weights.wu} × ${ESI_URGENCY[finalESI]})`,  val: `+${(weights.wu * ESI_URGENCY[finalESI]).toFixed(2)}`, color: 'var(--danger)' },
                { label: `w_w · ln(1+0)  (wait = 0 min)`,                           val: `+0.00`,                                                color: 'var(--warning)' },
                { label: `-w_r · C_r  (resource scarcity)`,                          val: `-${(weights.wr * (resources.find(r=>r.type===finalRes)?.occupied??0) / (resources.find(r=>r.type===finalRes)?.total??1)).toFixed(2)}`, color: 'var(--cyan)' },
                { label: `15 · σ(${finalRisk.toFixed(2)})  (deterioration)`,        val: `+${(15 * sigmoid(finalRisk)).toFixed(2)}`,             color: 'var(--success)' },
              ].map(row => (
                <div key={row.label} className="formula-row">
                  <span className="formula-label">{row.label}</span>
                  <span style={{ fontFamily: 'JetBrains Mono', fontSize: 12, color: row.color }}>{row.val}</span>
                </div>
              ))}
              <div className="formula-row" style={{ borderTop: '1px solid var(--border)', marginTop: 4, paddingTop: 6 }}>
                <span className="formula-label" style={{ fontWeight: 700, color: 'var(--text-primary)' }}>TOTAL S_i</span>
                <span style={{ fontFamily: 'JetBrains Mono', fontSize: 15, fontWeight: 900, color: 'var(--accent-light)' }}>{previewScore.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Quick reference */}
          <div className="card">
            <div className="section-title mb-10" style={{ fontSize: 12 }}>ESI Quick Reference</div>
            {([1,2,3,4,5] as ESILevel[]).map(l => (
              <div key={l} className="flex items-center gap-10" style={{ padding: '5px 0', borderBottom: '1px solid var(--border)' }}>
                <span className={`esi-badge esi-${l}`}>{l}</span>
                <span style={{ fontSize: 12, color: 'var(--text-secondary)', flex: 1 }}>{ESI_META[l].label}</span>
                <span style={{ fontSize: 11, color: ESI_META[l].color, fontWeight: 600 }}>{ESI_META[l].wait}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default NurseTriage;
