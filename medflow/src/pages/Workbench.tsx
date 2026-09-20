// ─── Page 2: Data Workbench & Mathematical Engine ────────────────────────────

import React, { useState } from 'react';
import { FlaskConical, Calculator, ChevronDown } from 'lucide-react';
import { useMedFlow } from '../store';
import { scoreBreakdown } from '../engine';
import { Department, ESILevel, ResourceType, Strategy } from '../types';

const ESI_LABELS: Record<ESILevel, string> = {
  1: 'ESI 1 – Resuscitation (Immediate)',
  2: 'ESI 2 – Emergent (< 15 min)',
  3: 'ESI 3 – Urgent (< 30 min)',
  4: 'ESI 4 – Less Urgent (< 60 min)',
  5: 'ESI 5 – Non-Urgent (< 120 min)',
};

const STRATEGIES: Strategy[] = ['Dynamic Multi-Objective', 'Urgency-Only', 'Capacity-Preserving', 'First-Come First-Served'];
const DEPARTMENTS: Department[] = ['Trauma ER', 'ICU', 'OR Suites', 'Cardiology', 'Neurology', 'Orthopedics'];
const RESOURCES: ResourceType[] = ['Acute ER Bays', 'ICU Critical Beds', 'Operating Theatres', 'Physicians', 'Nurses', 'Ventilators', 'CT Scanners'];

const Workbench: React.FC = () => {
  const { addPatient, strategy, setStrategy, weights, setWeights, patients, resources } = useMedFlow();
  const [selectedPatientId, setSelectedPatientId] = useState<string>('');
  const [form, setForm] = useState({
    name: '', age: 35, esi: 3 as ESILevel,
    condition: '', department: 'Trauma ER' as Department,
    targetResource: 'Acute ER Bays' as ResourceType,
    bp: '120/80', hr: 80, spo2: 98, temp: 37.0,
    deteriorationRisk: 0.3,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.condition) return;
    addPatient({
      name: form.name, age: form.age, esi: form.esi,
      condition: form.condition, department: form.department,
      targetResource: form.targetResource,
      vitals: { bp: form.bp, hr: form.hr, spo2: form.spo2, temp: form.temp },
      deteriorationRisk: form.deteriorationRisk,
    });
    setForm(f => ({ ...f, name: '', condition: '' }));
  };

  const selectedPatient = patients.find(p => p.id === selectedPatientId);
  const breakdown = selectedPatient ? scoreBreakdown(selectedPatient, resources, weights) : null;

  return (
    <div className="flex-col gap-20">
      <div className="page-title"><FlaskConical size={20} />Data Workbench & Mathematical Engine</div>

      <div className="grid-2">
        {/* Intake Form */}
        <div className="card">
          <div className="section-title mb-16"><FlaskConical size={14} />Clinical Patient Intake Triage</div>
          <form onSubmit={handleSubmit} className="flex-col gap-12">
            <div className="form-grid">
              <div className="form-group">
                <label className="form-label">Patient Name</label>
                <input className="form-input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Full name" required />
              </div>
              <div className="form-group">
                <label className="form-label">Age</label>
                <input className="form-input" type="number" min={1} max={120} value={form.age} onChange={e => setForm(f => ({ ...f, age: +e.target.value }))} />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">ESI Triage Level</label>
              <select className="form-select" value={form.esi} onChange={e => setForm(f => ({ ...f, esi: +e.target.value as ESILevel }))}>
                {([1,2,3,4,5] as ESILevel[]).map(l => <option key={l} value={l}>{ESI_LABELS[l]}</option>)}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Chief Complaint / Condition</label>
              <input className="form-input" value={form.condition} onChange={e => setForm(f => ({ ...f, condition: e.target.value }))} placeholder="e.g. Acute MI, Respiratory Distress" required />
            </div>

            <div className="form-grid">
              <div className="form-group">
                <label className="form-label">Department</label>
                <select className="form-select" value={form.department} onChange={e => setForm(f => ({ ...f, department: e.target.value as Department }))}>
                  {DEPARTMENTS.map(d => <option key={d}>{d}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Target Resource</label>
                <select className="form-select" value={form.targetResource} onChange={e => setForm(f => ({ ...f, targetResource: e.target.value as ResourceType }))}>
                  {RESOURCES.map(r => <option key={r}>{r}</option>)}
                </select>
              </div>
            </div>

            <div className="section-title" style={{ fontSize: 12, marginTop: 4 }}>Vitals</div>
            <div className="form-grid-3">
              <div className="form-group">
                <label className="form-label">BP (mmHg)</label>
                <input className="form-input" value={form.bp} onChange={e => setForm(f => ({ ...f, bp: e.target.value }))} placeholder="120/80" />
              </div>
              <div className="form-group">
                <label className="form-label">HR (bpm)</label>
                <input className="form-input" type="number" value={form.hr} onChange={e => setForm(f => ({ ...f, hr: +e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">SpO₂ (%)</label>
                <input className="form-input" type="number" min={50} max={100} value={form.spo2} onChange={e => setForm(f => ({ ...f, spo2: +e.target.value }))} />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Deterioration Risk (0–1): <span className="font-mono text-accent">{form.deteriorationRisk.toFixed(2)}</span></label>
              <input type="range" min={0} max={1} step={0.01} value={form.deteriorationRisk} onChange={e => setForm(f => ({ ...f, deteriorationRisk: +e.target.value }))} />
            </div>

            <button type="submit" className="btn btn-primary w-full">Submit Triage Intake</button>
          </form>
        </div>

        {/* Strategy + Weights */}
        <div className="flex-col gap-16">
          <div className="card">
            <div className="section-title mb-12"><Calculator size={14} />Strategy Switchboard</div>
            <div className="flex-col gap-8">
              {STRATEGIES.map(s => (
                <button
                  key={s}
                  className={`btn ${strategy === s ? 'btn-primary' : 'btn-ghost'} w-full`}
                  style={{ justifyContent: 'flex-start' }}
                  onClick={() => setStrategy(s)}
                >
                  {strategy === s && '▶ '}{s}
                </button>
              ))}
            </div>
          </div>

          <div className="card">
            <div className="section-title mb-12"><Calculator size={14} />Formula Coefficient Sliders</div>
            <div className="flex-col gap-12">
              {[
                { key: 'wu', label: 'w_u — Urgency Weight', color: 'var(--danger)' },
                { key: 'ww', label: 'w_w — Wait Aging Weight', color: 'var(--warning)' },
                { key: 'wr', label: 'w_r — Resource Scarcity Weight', color: 'var(--cyan)' },
              ].map(({ key, label, color }) => (
                <div key={key} className="slider-wrap">
                  <div className="flex items-center justify-between mb-4">
                    <span className="form-label font-mono">{label}</span>
                    <span className="slider-val" style={{ color }}>{(weights as any)[key].toFixed(2)}</span>
                  </div>
                  <input
                    type="range" min={0} max={2} step={0.05}
                    value={(weights as any)[key]}
                    onChange={e => setWeights({ [key]: +e.target.value })}
                    style={{ accentColor: color }}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Formula Inspector */}
      <div className="card card-accent">
        <div className="section-title mb-12"><Calculator size={14} />Mathematical Formula Inspector</div>
        <div className="formula-box mb-12" style={{ fontSize: 13, color: 'var(--cyan)', letterSpacing: 0.3 }}>
          S_i = w_u · U_i + w_w · ln(1 + t_w) - w_r · C_r + 15 · σ(Z_risk)
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>
            σ(Z) = 1 / (1 + e^(-4·(Z - 0.5)))  ·  C_r = occupied / total
          </div>
        </div>

        <div className="form-group mb-12">
          <label className="form-label">Select Patient for Step-by-Step Breakdown</label>
          <select className="form-select" value={selectedPatientId} onChange={e => setSelectedPatientId(e.target.value)}>
            <option value="">— Select patient —</option>
            {patients.map(p => (
              <option key={p.id} value={p.id}>{p.name} (ESI {p.esi}, {p.allocated ? 'Allocated' : 'Queued'})</option>
            ))}
          </select>
        </div>

        {breakdown && selectedPatient && (
          <div className="formula-box">
            <div className="formula-row"><span className="formula-label">Patient</span><span className="formula-val">{selectedPatient.name} · ESI {selectedPatient.esi}</span></div>
            <div className="formula-row"><span className="formula-label">U_i (ESI urgency score)</span><span className="formula-val">{breakdown.U}</span></div>
            <div className="formula-row"><span className="formula-label">t_w (wait minutes)</span><span className="formula-val">{breakdown.tw} min</span></div>
            <div className="formula-row"><span className="formula-label">C_r (resource scarcity)</span><span className="formula-val">{breakdown.Cr.toFixed(4)}</span></div>
            <div className="formula-row"><span className="formula-label">Z_risk (deterioration)</span><span className="formula-val">{breakdown.Z.toFixed(4)}</span></div>
            <div className="formula-row"><span className="formula-label">σ(Z_risk) sigmoid</span><span className="formula-val">{breakdown.sig.toFixed(4)}</span></div>
            <div className="formula-row" style={{ borderTop: '1px solid var(--border)', marginTop: 4, paddingTop: 4 }}>
              <span className="formula-label">w_u · U_i = {weights.wu.toFixed(2)} × {breakdown.U}</span>
              <span className="formula-val">+{breakdown.urgencyTerm.toFixed(2)}</span>
            </div>
            <div className="formula-row">
              <span className="formula-label">w_w · ln(1+t_w) = {weights.ww.toFixed(2)} × ln({1 + breakdown.tw})</span>
              <span className="formula-val">+{breakdown.waitTerm.toFixed(2)}</span>
            </div>
            <div className="formula-row">
              <span className="formula-label">-w_r · C_r = -{weights.wr.toFixed(2)} × {breakdown.Cr.toFixed(4)}</span>
              <span className="formula-val" style={{ color: 'var(--danger)' }}>-{breakdown.scarcityTerm.toFixed(2)}</span>
            </div>
            <div className="formula-row">
              <span className="formula-label">15 · σ(Z) = 15 × {breakdown.sig.toFixed(4)}</span>
              <span className="formula-val">+{breakdown.deteriorationTerm.toFixed(2)}</span>
            </div>
            <div className="formula-row">
              <span className="formula-label">TOTAL PRIORITY SCORE S_i</span>
              <span className="formula-val" style={{ fontSize: 16 }}>{breakdown.total.toFixed(3)}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Workbench;
