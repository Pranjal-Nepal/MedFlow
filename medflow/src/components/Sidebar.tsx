import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, FlaskConical, Ambulance, Bot, Users, Shield,
  Zap, AlertTriangle, Activity, Cpu, ClipboardPlus
} from 'lucide-react';
import { useMedFlow } from '../store';

const NAV_ITEMS = [
  { to: '/',             icon: LayoutDashboard, label: 'Operations Command', roles: ['director','clinical'] },
  { to: '/workbench',   icon: FlaskConical,    label: 'Data Workbench',     roles: ['director','clinical'] },
  { to: '/nurse-triage',icon: ClipboardPlus,   label: 'Walk-In Triage',     roles: ['director','clinical'] },
  { to: '/ems',         icon: Ambulance,       label: 'EMS Fleet',          roles: ['director','clinical'] },
  { to: '/sentinel',    icon: Bot,             label: 'Sentinel AI',        roles: ['director','clinical'] },
  { to: '/portal',      icon: Users,           label: 'Patient Portal',     roles: ['director','clinical','patient'] },
];

const SIM_TRIGGERS = [
  { label: 'Mass Casualty Incident', action: 'triggerMCI',              icon: AlertTriangle, cls: 'btn-danger' },
  { label: 'Staff Shortage –30%',    action: 'triggerStaffShortage',    icon: Activity,      cls: 'btn-danger' },
  { label: 'ICU Crisis',             action: 'triggerICUCrisis',        icon: Zap,           cls: 'btn-danger' },
  { label: 'Equipment Failure',      action: 'triggerEquipmentFailure', icon: Cpu,           cls: 'btn-danger' },
];

const Sidebar: React.FC = () => {
  const store = useMedFlow();
  const { role } = store;

  return (
    <aside className="sidebar">
      <div className="sidebar-section">Navigation</div>
      {NAV_ITEMS.filter(item => item.roles.includes(role || '')).map(({ to, icon: Icon, label }) => (
        <NavLink
          key={to} to={to} end={to === '/'}
          className={({ isActive }) => `sidebar-item${isActive ? ' active' : ''}`}
        >
          <Icon size={16} />
          {label}
        </NavLink>
      ))}

      {(role === 'director') && (
        <>
          <div className="sidebar-section" style={{ marginTop: 12 }}>Simulation</div>
          {SIM_TRIGGERS.map(({ label, action, icon: Icon }) => (
            <button
              key={action}
              className="sidebar-item"
              style={{ background: 'none', border: 'none', width: '100%', textAlign: 'left', cursor: 'pointer', color: 'var(--danger)', fontSize: 12 }}
              onClick={() => (store as any)[action]()}
            >
              <Icon size={14} />
              {label}
            </button>
          ))}
        </>
      )}

      <div className="sidebar-bottom">
        <NavLink to="/login" className="sidebar-item" style={{ fontSize: 11 }}>
          <Shield size={14} />
          Auth Gateway
        </NavLink>
      </div>
    </aside>
  );
};

export default Sidebar;
