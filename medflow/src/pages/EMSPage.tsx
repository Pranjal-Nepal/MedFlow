// ─── Page 3: EMS Ambulance Fleet Telemetry ───────────────────────────────────

import React from 'react';
import { Ambulance, MapPin, Clock, Zap, CheckCircle } from 'lucide-react';
import { useMedFlow } from '../store';
import { ESILevel } from '../types';

const ESI_COLORS: Record<ESILevel, string> = {
  1: 'var(--danger)', 2: 'var(--warning)', 3: 'var(--accent-light)', 4: 'var(--success)', 5: 'var(--text-muted)'
};

const formatETA = (secs: number): string => {
  if (secs <= 0) return '00:00';
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

// Simple animated radar SVG
const RadarSVG: React.FC = () => (
  <svg width="120" height="120" viewBox="0 0 120 120">
    <circle cx="60" cy="60" r="55" fill="none" stroke="rgba(37,99,235,0.15)" strokeWidth="1" />
    <circle cx="60" cy="60" r="38" fill="none" stroke="rgba(37,99,235,0.1)" strokeWidth="1" />
    <circle cx="60" cy="60" r="20" fill="none" stroke="rgba(37,99,235,0.1)" strokeWidth="1" />
    <line x1="60" y1="5" x2="60" y2="115" stroke="rgba(37,99,235,0.1)" strokeWidth="1" />
    <line x1="5" y1="60" x2="115" y2="60" stroke="rgba(37,99,235,0.1)" strokeWidth="1" />
    {/* Sweep animation */}
    <path d="M60,60 L60,5 A55,55 0 0,1 115,60 Z" fill="rgba(37,99,235,0.08)">
      <animateTransform attributeName="transform" type="rotate" from="0 60 60" to="360 60 60" dur="3s" repeatCount="indefinite" />
    </path>
    {/* Blips */}
    <circle cx="82" cy="35" r="3" fill="#ef4444"><animate attributeName="opacity" values="1;0.2;1" dur="1.5s" repeatCount="indefinite" /></circle>
    <circle cx="45" cy="75" r="2.5" fill="#f59e0b"><animate attributeName="opacity" values="1;0.2;1" dur="2s" repeatCount="indefinite" /></circle>
    <circle cx="70" cy="85" r="2" fill="#60a5fa"><animate attributeName="opacity" values="1;0.2;1" dur="2.5s" repeatCount="indefinite" /></circle>
    <circle cx="60" cy="60" r="3" fill="#38bdf8" />
  </svg>
);

const EMSPage: React.FC = () => {
  const { ambulances, fastForwardAmbulance } = useMedFlow();

  return (
    <div className="flex-col gap-20">
      <div className="page-title"><Ambulance size={20} />EMS Ambulance Fleet Telemetry</div>

      <div className="grid-2">
        {/* Radar */}
        <div className="card card-accent flex-col items-center gap-12" style={{ alignItems: 'center' }}>
          <div className="section-title">Regional Dispatch Radar</div>
          <RadarSVG />
          <div className="flex gap-12" style={{ flexWrap: 'wrap', justifyContent: 'center' }}>
            <span className="tag tag-danger">● ESI-1 Inbound</span>
            <span className="tag tag-warning">● ESI-2 Inbound</span>
            <span className="tag tag-info">● ESI-3 Inbound</span>
            <span className="tag tag-cyan">◉ MEDFLOW HQ</span>
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center' }}>
            {ambulances.filter(a => !a.arrived).length} units in transit · {ambulances.filter(a => a.arrived).length} arrived
          </div>
        </div>

        {/* Stats */}
        <div className="flex-col gap-12">
          <div className="card">
            <div className="section-title mb-8">Fleet Status</div>
            <div className="grid-3">
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--accent-light)', fontFamily: 'JetBrains Mono' }}>{ambulances.length}</div>
                <div className="text-xs text-muted">Total Units</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--warning)', fontFamily: 'JetBrains Mono' }}>{ambulances.filter(a => !a.arrived).length}</div>
                <div className="text-xs text-muted">In Transit</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--success)', fontFamily: 'JetBrains Mono' }}>{ambulances.filter(a => a.arrived).length}</div>
                <div className="text-xs text-muted">Arrived</div>
              </div>
            </div>
          </div>
          <div className="card">
            <div className="section-title mb-8">Critical Inbound</div>
            {ambulances.filter(a => !a.arrived && a.esi <= 2).map(a => (
              <div key={a.id} className="flex items-center gap-8 mb-8">
                <span className={`esi-badge esi-${a.esi}`}>{a.esi}</span>
                <span style={{ fontSize: 12, color: 'var(--text-primary)' }}>{a.patientName}</span>
                <span className="font-mono text-xs" style={{ color: ESI_COLORS[a.esi] }}>{formatETA(a.etaSeconds)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Unit Cards */}
      <div>
        <div className="section-title mb-12"><Ambulance size={14} />Inbound Transit Units</div>
        <div className="grid-3">
          {ambulances.map(unit => (
            <div key={unit.id} className={`ems-card ${unit.esi === 1 && !unit.arrived ? 'critical' : ''}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-8">
                  <span className={`esi-badge esi-${unit.esi}`}>{unit.esi}</span>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-primary)' }}>{unit.patientName}</div>
                    <div className="text-xs text-muted">{unit.condition}</div>
                  </div>
                </div>
                {unit.arrived
                  ? <span className="ems-arrived flex items-center gap-4"><CheckCircle size={14} /> Arrived</span>
                  : <div className="ems-eta">{formatETA(unit.etaSeconds)}</div>
                }
              </div>

              <div className="flex items-center gap-6 text-xs text-secondary">
                <MapPin size={11} style={{ color: 'var(--accent-light)' }} />
                {unit.origin}
              </div>

              <div className="flex items-center gap-6 text-xs text-secondary">
                <Clock size={11} style={{ color: 'var(--cyan)' }} />
                Target: <span style={{ color: 'var(--cyan)', fontWeight: 600 }}>{unit.targetBay}</span>
              </div>

              {!unit.arrived && (
                <div className="flex gap-8">
                  <button className="btn btn-cyan btn-sm flex-1" onClick={() => fastForwardAmbulance(unit.id)}>
                    <Zap size={12} /> Fast-Forward Arrival
                  </button>
                </div>
              )}

              {!unit.arrived && (
                <div className="progress-bar">
                  <div
                    className="progress-fill"
                    style={{
                      width: `${Math.max(5, 100 - (unit.etaSeconds / 900) * 100)}%`,
                      background: unit.esi === 1 ? 'var(--danger)' : unit.esi === 2 ? 'var(--warning)' : 'var(--accent)',
                      transition: 'width 1s linear'
                    }}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default EMSPage;
