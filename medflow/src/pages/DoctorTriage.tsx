import React, { useState, useMemo } from 'react';
import { Stethoscope, Zap, CheckCircle, AlertTriangle, ClipboardList, Activity, LogOut, Trash2 } from 'lucide-react';
import { useMedFlow } from '../store';
import { computeScore } from '../engine';
import { Department, ESILevel, ResourceType } from '../types';

const ESI_META: Record<ESILevel, { label: string; color: string; wait: string }> = {
  1: { label: 'Resuscitation',  color: '#ef4444', wait: 'Immediate' },
  2: { label: 'Emergent',       color: '#f59e0b', wait: '< 15 min'  },
  3: { label: 'Urgent',         color: '#60a5fa', wait: '< 30 min'  },
  4: { label: 'Less Urgent',    color: '#22c55e', wait: '< 60 min'  },
  5: { label: 'Non-Urgent',     color: '#94a3b8', wait: '< 2 hrs'   },
};

const DEPARTMENTS: Department[]   = ['Trauma ER','ICU','OR Suites','Cardiology','Neurology','Orthopedics'];
const RESOURCES:   ResourceType[] = ['Acute ER Bays','ICU Critical Beds','Operating Theatres','Physicians','Nurses','Ventilators','CT Scanners'];

const DIAGNOSIS_OPTIONS = [
  'Acute MI – STEMI', 'Acute MI – NSTEMI', 'Congestive Heart Failure', 'Atrial Fibrillation',
  'Ischemic Stroke', 'Hemorrhagic Stroke', 'TIA', 'Meningitis', 'Encephalitis',
  'Sepsis – Mild', 'Sepsis – Severe', 'Septic Shock', 'Pneumonia', 'COPD Exacerbation',
  'Acute Appendicitis', 'Bowel Obstruction', 'Diverticulitis', 'Cholecystitis',
  'Fracture – Simple', 'Fracture – Compound', 'Joint Dislocation', 'Soft Tissue Injury',
  'Laceration – Minor', 'Laceration – Major', 'Burn – Minor', 'Burn – Major',
  'Renal Colic', 'GI Bleed', 'Anaphylaxis', 'Diabetic Emergency',
];

const DoctorTriage: React.FC = () => {
  const { patients, resources, weights, dischargePatient, deletePatient } = useMedFlow();

  const [form, setForm] = useState({
    patientId: '',
    diagnosis: '',
    treatmentPlan: '',
    disposition: 'Observe' as string,
    notes: '',
  });

  const [confirmations, setConfirmations] = useState<Record<string, boolean>>({});

  const selectedPatient = patients.find(p => p.id === form.patientId);

  const previewScore = useMemo(() => {
    if (!selectedPatient) return 0;
    return computeScore(selectedPatient, resources, weights);
  }, [selectedPatient, resources, weights]);

  const unallocated = patients.filter(p => !p.allocated).sort((a, b) => b.score - a.score);

  const handleConfirmDisposition = (patientId: string) => {
    setConfirmations(prev => ({ ...prev, [patientId]: true }));
  };

  return (
    <div className="flex-col gap-20">
      <div className="page-title">
        <Stethoscope size={20} />
        Doctor Clinical Triage
        <span className="tag tag-info" style={{ marginLeft: 8 }}>Clinical Decision Support</span>
      </div>

      <div className="grid-2" style={{ alignItems: 'start' }}>
        <div className="card">
          <div className="section-title mb-16"><Stethoscope size={14} />Patient Assignment & Disposition</div>
          <form onSubmit={e => e.preventDefault()} className="flex-col gap-14">
            <div className="form-group">
              <label className="form-label">Assign Patient</label>
              <select className="form-select" value={form.patientId} onChange={e => { setForm(f => ({ ...f, patientId: e.target.value })); setConfirmations({}); }}>
                <option value="">— Select unallocated patient —</option>
                {unallocated.map(p => (
                  <option key={p.id} value={p.id}>{p.name} — ESI {p.esi} — {p.condition}</option>
                ))}
              </select>
            </div>

            {selectedPatient && (
              <div style={{ background: 'var(--bg-surface)', borderRadius: 8, padding: 12, border: '1px solid var(--border)' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
                  {selectedPatient.name} <span className={`esi-badge esi-${selectedPatient.esi}`}>{selectedPatient.esi}</span>
                </div>
                <div className="text-xs text-muted" style={{ marginTop: 4 }}>
                  {selectedPatient.age}y · {selectedPatient.department} · {selectedPatient.condition}
                </div>
                <div className="text-xs font-mono" style={{ marginTop: 4, color: 'var(--accent-light)' }}>
                  Priority Score: {previewScore.toFixed(1)} · Wait: {selectedPatient.waitMinutes}m · Risk: {(selectedPatient.deteriorationRisk * 100).toFixed(0)}%
                </div>
              </div>
            )}

            <div className="form-group">
              <label className="form-label">Diagnosis</label>
              <select className="form-select" value={form.diagnosis} onChange={e => setForm(f => ({ ...f, diagnosis: e.target.value }))}>
                <option value="">— Select diagnosis —</option>
                {DIAGNOSIS_OPTIONS.map(d => <option key={d}>{d}</option>)}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Treatment Plan</label>
              <textarea
                className="form-input"
                style={{ minHeight: 80, resize: 'vertical', fontFamily: 'inherit' }}
                value={form.treatmentPlan}
                onChange={e => setForm(f => ({ ...f, treatmentPlan: e.target.value }))}
                placeholder="Enter treatment plan, medications, procedures..."
              />
            </div>

            <div className="form-grid">
              <div className="form-group">
                <label className="form-label">Disposition</label>
                <select className="form-select" value={form.disposition} onChange={e => setForm(f => ({ ...f, disposition: e.target.value }))}>
                  <option>Observe</option>
                  <option>Admit</option>
                  <option>Discharge</option>
                  <option>Transfer</option>
                  <option>OR Schedule</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Room Assignment</label>
                <select className="form-select">
                  <option>Auto-assign</option>
                  {['ER-1','ER-2','ER-3','ER-4','ER-5'].map(r => <option key={r}>{r}</option>)}
                  {['ICU-1','ICU-2','ICU-3'].map(r => <option key={r}>{r}</option>)}
                </select>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Clinical Notes</label>
              <textarea
                className="form-input"
                style={{ minHeight: 50, resize: 'vertical', fontFamily: 'inherit' }}
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="Additional clinical observations..."
              />
            </div>

            {selectedPatient && !confirmations[selectedPatient.id] && (
              <button
                className="btn btn-primary w-full"
                onClick={() => handleConfirmDisposition(selectedPatient.id)}
              >
                <ClipboardList size={14} /> Confirm Disposition
              </button>
            )}
            {selectedPatient && confirmations[selectedPatient.id] && (
              <div style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid var(--success)', borderRadius: 8, padding: '12px', textAlign: 'center' }}>
                <CheckCircle size={18} style={{ color: 'var(--success)' }} />
                <div style={{ fontSize: 12, color: 'var(--success)', marginTop: 4, fontWeight: 600 }}>Disposition confirmed for {selectedPatient.name}</div>
              </div>
            )}
          </form>
        </div>

        <div className="flex-col gap-16">
          <div className="card">
            <div className="section-title mb-12"><Activity size={14} />Unallocated Queue (Priority Order)</div>
            <div style={{ maxHeight: 340, overflowY: 'auto' }}>
              {unallocated.map((p, i) => (
                <div key={p.id} className={`audit-item ${form.patientId === p.id ? 'highlighted' : ''}`} style={{ cursor: 'pointer' }}
                  onClick={() => { setForm(f => ({ ...f, patientId: p.id })); setConfirmations({}); }}>
                  <div className="flex-col gap-4" style={{ flex: 1 }}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-8">
                        <span className="font-mono text-xs text-muted">#{i + 1}</span>
                        <span className={`esi-badge esi-${p.esi}`}>{p.esi}</span>
                        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{p.name}</span>
                        <span className="tag tag-info" style={{ fontSize: 9 }}>{p.department}</span>
                      </div>
                      <div className="flex gap-4" onClick={e => e.stopPropagation()}>
                        <button
                          className="btn btn-sm btn-ghost"
                          onClick={() => dischargePatient(p.id)}
                          title="Discharge & free bed"
                          style={{ fontSize: 10, padding: '2px 6px' }}
                        >
                          <LogOut size={10} /> Discharge
                        </button>
                        <button
                          className="btn btn-sm btn-ghost"
                          onClick={() => deletePatient(p.id)}
                          title="Delete patient record"
                          style={{ fontSize: 10, padding: '2px 6px', color: 'var(--danger)', borderColor: 'rgba(239,68,68,0.3)' }}
                        >
                          <Trash2 size={10} /> Delete
                        </button>
                      </div>
                    </div>
                    <div className="text-xs text-muted">{p.condition} · Arrived {new Date(p.arrivalTime).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})} · Wait {p.waitMinutes}m · Score {p.score.toFixed(1)}</div>
                  </div>
                </div>
              ))}
              {unallocated.length === 0 && (
                <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-muted)', fontSize: 13 }}>All patients allocated ✓</div>
              )}
            </div>
          </div>

          {selectedPatient && (
            <div className="card">
              <div className="section-title mb-12"><Stethoscope size={14} />Clinical Decision Support</div>
              <div style={{ background: 'var(--bg-surface)', borderRadius: 8, padding: 12 }}>
                <div className="flex items-center justify-between mb-8">
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Computed Priority Score</span>
                  <span style={{ fontFamily: 'JetBrains Mono', fontSize: 22, fontWeight: 900, color: 'var(--accent-light)' }}>
                    {previewScore.toFixed(1)}
                  </span>
                </div>
                <div className="progress-bar" style={{ height: 6 }}>
                  <div className="progress-fill" style={{
                    width: `${Math.min(100, (previewScore / 120) * 100)}%`,
                    background: ESI_META[selectedPatient.esi].color
                  }} />
                </div>
              </div>
              <div style={{ marginTop: 12 }}>
                {ESI_META[selectedPatient.esi].color !== 'var(--success)' && ESI_META[selectedPatient.esi].color !== 'var(--text-muted)' && (
                  <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 6, padding: '8px 12px', marginBottom: 8 }}>
                    <div className="flex items-center gap-6">
                      <AlertTriangle size={12} style={{ color: 'var(--danger)' }} />
                      <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--danger)' }}>
                        {selectedPatient.esi <= 2 ? 'CRITICAL – Immediate physician assessment required' : 'URGENT – Physician review within 15 min'}
                      </span>
                    </div>
                  </div>
                )}
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  <strong>Recommended:</strong>{' '}
                  {selectedPatient.esi === 1 ? 'Immediate resuscitation team, monitor vitals q2min' :
                   selectedPatient.esi === 2 ? 'Urgent diagnostics, fast-track to specialist' :
                   selectedPatient.esi === 3 ? 'Standard evaluation, labs/imaging as indicated' :
                   'Routine assessment, discharge planning'}
                </div>
              </div>
            </div>
          )}

          <div className="card">
            <div className="section-title mb-10" style={{ fontSize: 12 }}><ClipboardList size={14} />Order Sets</div>
            <div className="flex-col gap-6">
              {['CBC + CMP', 'Type & Screen', 'CT Abdomen/Pelvis', 'Troponin x2', 'Lactate', 'ABG'].map(order => (
                <div key={order} className="flex items-center gap-8" style={{ padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
                  <input type="checkbox" style={{ accentColor: 'var(--accent)' }} />
                  <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{order}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DoctorTriage;
