import React from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar
} from 'recharts';
import { LayoutDashboard, BedDouble, Stethoscope, Wind, Scan, Users, Activity } from 'lucide-react';
import { useMedFlow } from '../store';
import { Resource, ResourceType } from '../types';
import { compareStrategies } from '../engine';

const RESOURCE_ICONS: Record<ResourceType, React.ReactNode> = {
  'Acute ER Bays':      <BedDouble size={16} />,
  'ICU Critical Beds':  <Activity size={16} />,
  'Operating Theatres': <Stethoscope size={16} />,
  'Physicians':         <Users size={16} />,
  'Nurses':             <Users size={16} />,
  'Ventilators':        <Wind size={16} />,
  'CT Scanners':        <Scan size={16} />,
};

const DEPARTMENTS = ['Trauma ER', 'ICU', 'OR Suites', 'Cardiology', 'Neurology', 'Orthopedics'];
const DEPT_LOAD = [72, 87, 50, 45, 63, 38];

const ResourceCard: React.FC<{ resource: Resource }> = ({ resource: r }) => {
  const pct = r.total > 0 ? (r.occupied / r.total) * 100 : 0;
  const isCritical = pct >= 90;
  const isWarning  = pct >= 70 && pct < 90;
  const fillClass  = isCritical ? 'fill-critical' : isWarning ? 'fill-warn' : 'fill-ok';
  const cardClass  = isCritical ? 'resource-card critical' : isWarning ? 'resource-card warning' : 'resource-card';
  const available  = r.total - r.occupied;

  return (
    <div className={cardClass}>
      <div className="flex items-center gap-6">
        <span style={{ color: 'var(--accent-light)' }}>{RESOURCE_ICONS[r.type]}</span>
        <span className="resource-card-label">{r.type}</span>
      </div>
      <div className="resource-card-value">{available}<span style={{ fontSize: 14, color: 'var(--text-muted)', fontWeight: 400 }}>/{r.total}</span></div>
      <div className="resource-card-sub">
        {available} available · {r.occupied} occupied
        {isCritical && <span className="tag tag-danger" style={{ marginLeft: 6 }}>CRITICAL</span>}
        {isWarning  && <span className="tag tag-warning" style={{ marginLeft: 6 }}>HIGH LOAD</span>}
      </div>
      <div className="progress-bar">
        <div className={`progress-fill ${fillClass}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
};

const ESIBadge: React.FC<{ esi: number }> = ({ esi }) => (
  <span className={`esi-badge esi-${esi}`}>{esi}</span>
);

const Dashboard: React.FC = () => {
  const { resources, patients, throughput, allocateBed, dischargePatient, deletePatient, deletedPatients, strategy } = useMedFlow();
  const queue = patients.filter(p => !p.allocated).sort((a, b) => b.score - a.score);

  return (
    <div className="flex-col gap-20">
      <div className="page-title">
        <LayoutDashboard size={20} />
        Operations Command Dashboard
        <span className="tag tag-info" style={{ marginLeft: 8 }}>LIVE</span>
      </div>

      <div>
        <div className="section-header">
          <div className="section-title"><Activity size={15} />Live Resource Capacity</div>
        </div>
        <div className="grid-7">
          {resources.map(r => <ResourceCard key={r.type} resource={r} />)}
        </div>
      </div>

      <div className="grid-2">
        <div className="card">
          <div className="section-title mb-12"><Activity size={14} />Patient Intake vs Discharge (Hourly)</div>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={throughput} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="arrGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#2563eb" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="disGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#38bdf8" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="hour" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Area type="monotone" dataKey="arrivals"   stroke="#2563eb" fill="url(#arrGrad)" strokeWidth={2} name="Arrivals" />
              <Area type="monotone" dataKey="discharges" stroke="#38bdf8" fill="url(#disGrad)" strokeWidth={2} name="Discharges" />
              <Area type="monotone" dataKey="capacity"   stroke="#ef4444" fill="none" strokeWidth={1} strokeDasharray="4 2" name="Capacity" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <div className="section-title mb-12"><Activity size={14} />Department Headroom Telemetry</div>
          {DEPARTMENTS.map((dept, i) => {
            const pct = DEPT_LOAD[i];
            const color = pct >= 80 ? 'var(--danger)' : pct >= 60 ? 'var(--warning)' : 'var(--success)';
            return (
              <div key={dept} className="headroom-row">
                <span className="headroom-label">{dept}</span>
                <div className="headroom-bar">
                  <div className="progress-fill" style={{ width: `${pct}%`, background: color }} />
                </div>
                <span className="headroom-pct" style={{ color }}>{pct}%</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="card">
        <div className="section-header">
          <div className="section-title"><Users size={15} />Real-Time Triage Queue · <span className="text-accent">{strategy}</span></div>
          <span className="tag tag-info">{queue.length} pending</span>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Rank</th><th>Patient</th><th>ESI</th><th>Condition</th>
                <th>Department</th><th>Wait</th><th>Risk</th><th>Score</th><th>Action</th>
              </tr>
            </thead>
            <tbody>
              {queue.map((p, i) => {
                const riskColor = p.deteriorationRisk > 0.7 ? 'var(--danger)' : p.deteriorationRisk > 0.4 ? 'var(--warning)' : 'var(--success)';
                const res = resources.find(r => r.type === p.targetResource);
                const canAllocate = res && res.occupied < res.total;
                return (
                  <tr key={p.id}>
                    <td><span className="font-mono text-muted">#{i + 1}</span></td>
                    <td className="primary">{p.name}<div className="text-xs text-muted">{p.age}y · {p.vitals.hr}bpm · SpO₂ {p.vitals.spo2}%</div></td>
                    <td><ESIBadge esi={p.esi} /></td>
                    <td>{p.condition}</td>
                    <td><span className="tag tag-info">{p.department}</span></td>
                    <td className="font-mono">{p.waitMinutes}m</td>
                    <td>
                      <div className="risk-bar">
                        <div className="risk-fill" style={{ width: `${p.deteriorationRisk * 48}px`, background: riskColor, height: 6, borderRadius: 3 }} />
                        <span style={{ fontSize: 10, color: riskColor }}>{(p.deteriorationRisk * 100).toFixed(0)}%</span>
                      </div>
                    </td>
                    <td><span className="score-badge">{p.score.toFixed(1)}</span></td>
                    <td>
                      <div className="flex gap-4">
                        <button
                          className="btn btn-sm btn-primary"
                          onClick={() => allocateBed(p.id)}
                          disabled={!canAllocate}
                          title={canAllocate ? `Allocate ${p.targetResource}` : 'No capacity available'}
                        >
                          {canAllocate ? 'Allocate' : 'Full'}
                        </button>
                        {p.allocated && (
                          <button
                            className="btn btn-sm btn-danger"
                            onClick={() => dischargePatient(p.id)}
                            title="Discharge patient & free bed"
                          >
                            Discharge
                          </button>
                        )}
                        <button
                          className="btn btn-sm btn-ghost"
                          onClick={() => deletePatient(p.id)}
                          title="Delete patient record"
                          style={{ color: 'var(--danger)', borderColor: 'rgba(239,68,68,0.3)' }}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {queue.length === 0 && (
                <tr><td colSpan={9} style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)' }}>All patients allocated ✓</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <div className="section-title mb-12"><Activity size={14} />Scheduling Strategy Comparison (Live)</div>
        <ComparisonTable />
      </div>

      <DeletedPatientsArchive />
    </div>
  );
};

const ComparisonTable: React.FC = () => {
  const { patients, resources, weights } = useMedFlow();
  const comparison = compareStrategies(patients, resources, weights);
  const [dynamic, urgency, capacity, fcfs] = comparison;

  const metrics = [
    { label: 'Avg Wait (min)', d: dynamic.avgWait, u: urgency.avgWait, c: capacity.avgWait, f: fcfs.avgWait },
    { label: 'ESI-1 Response', d: dynamic.esi1Rank, u: urgency.esi1Rank, c: capacity.esi1Rank, f: fcfs.esi1Rank },
    { label: 'Starvation Risk', d: dynamic.starvationRisk, u: urgency.starvationRisk, c: capacity.starvationRisk, f: fcfs.starvationRisk },
    { label: 'Throughput/hr', d: dynamic.throughput, u: urgency.throughput, c: capacity.throughput, f: fcfs.throughput },
  ];

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th className="matrix-header">Metric</th>
            <th className="matrix-header" style={{ color: 'var(--accent-light)' }}>Dynamic Multi-Obj ★</th>
            <th className="matrix-header">Urgency-Only</th>
            <th className="matrix-header">Capacity-Preserving</th>
            <th className="matrix-header">FCFS</th>
          </tr>
        </thead>
        <tbody>
          {metrics.map((row) => (
            <tr key={row.label}>
              <td className="matrix-cell primary">{row.label}</td>
              <td className="matrix-cell matrix-best">{row.d}</td>
              <td className="matrix-cell">{row.u}</td>
              <td className="matrix-cell">{row.c}</td>
              <td className="matrix-cell">{row.f}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const DeletedPatientsArchive: React.FC = () => {
  const { deletedPatients, getDeletedPatients } = useMedFlow();
  const records = getDeletedPatients();

  if (records.length === 0) return null;

  return (
    <div className="card">
      <div className="section-title mb-12"><Users size={14} />Deleted Patients Archive ({records.length})</div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Name</th><th>MRN</th><th>Condition</th><th>Dept</th><th>ESI</th><th>Arrived</th><th>Deleted At</th><th>Bed Freed</th>
            </tr>
          </thead>
          <tbody>
            {records.slice(0, 20).map(r => (
              <tr key={r.id}>
                <td className="primary">{r.name}</td>
                <td className="font-mono">{r.mrn}</td>
                <td>{r.condition}</td>
                <td><span className="tag tag-info">{r.department}</span></td>
                <td><span className={`esi-badge esi-${r.esi}`}>{r.esi}</span></td>
                <td className="font-mono text-xs">{new Date(r.arrivalTime).toLocaleString()}</td>
                <td className="font-mono text-xs">{new Date(r.deletionTime).toLocaleString()}</td>
                <td>{r.wasAllocated ? <span style={{ color: 'var(--success)' }}>✓ {r.allocatedBay}</span> : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Dashboard;
