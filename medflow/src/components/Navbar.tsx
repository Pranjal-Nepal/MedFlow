// ─── Navbar Component ─────────────────────────────────────────────────────────

import React from 'react';
import { Activity, Moon, Sun, LogOut } from 'lucide-react';
import { useMedFlow } from '../store';

const TelemetrySVG: React.FC<{ load: number }> = ({ load }) => {
  // Simple ECG-style micro-telemetry SVG
  const pts = [0,2,2,4,8,0,-4,0,2,2,0].map((y, i) => `${i * 8},${20 - y * (load / 100) * 3}`).join(' ');
  return (
    <svg width="88" height="24" className="telemetry-svg">
      <polyline points={pts} fill="none" stroke="#38bdf8" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
};

const Navbar: React.FC = () => {
  const { simTime, resources, patients, diversionActive, darkMode, toggleTheme, logout, authedUser } = useMedFlow();
  const icu = resources.find(r => r.type === 'ICU Critical Beds')!;
  const icuPct = Math.round((icu.occupied / icu.total) * 100);
  const queueCount = patients.filter(p => !p.allocated).length;
  const timeStr = simTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  return (
    <nav className="navbar">
      <div className="navbar-brand">
        <Activity size={18} />
        MED<span>FLOW</span>
        <span className="navbar-tagline">Prioritize Patients. Optimize Resources</span>
      </div>
      <div className="navbar-spacer" />
      <TelemetrySVG load={icuPct} />
      <div className="navbar-pill">
        <span>SIM</span>
        <span className="val">{timeStr}</span>
      </div>
      <div className="navbar-pill">
        <span>ICU</span>
        <span className="val" style={{ color: icuPct >= 80 ? 'var(--danger)' : icuPct >= 60 ? 'var(--warning)' : 'var(--success)' }}>
          {icuPct}%
        </span>
      </div>
      <div className="navbar-pill">
        <span>QUEUE</span>
        <span className="val">{queueCount}</span>
      </div>
      {diversionActive && <div className="diversion-badge">⚡ REGIONAL DIVERSION ACTIVE</div>}
      <button className="btn btn-ghost btn-sm" onClick={toggleTheme} title="Toggle theme">
        {darkMode ? <Sun size={14} /> : <Moon size={14} />}
      </button>
      {authedUser && (
        <button className="btn btn-ghost btn-sm" onClick={logout} title="Logout">
          <LogOut size={14} />
          <span>{authedUser}</span>
        </button>
      )}
    </nav>
  );
};

export default Navbar;
