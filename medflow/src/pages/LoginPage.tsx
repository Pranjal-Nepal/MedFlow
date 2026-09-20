import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, Activity, Eye, EyeOff, Users, Stethoscope, LayoutDashboard, Bell, Lock, Share2, CheckCircle } from 'lucide-react';
import { useMedFlow } from '../store';
import { STAFF_ACCOUNTS, formatDobForDisplay } from '../auth';

type SelectableRole = 'director' | 'clinical' | 'patient';

const ROLES: { role: SelectableRole; title: string; shortTitle: string; desc: string; color: string; bg: string; icon: React.ReactNode; perms: string[] }[] = [
  {
    role: 'director',
    title: 'Hospital Operations Director',
    shortTitle: 'Operations Director',
    desc: 'Full administrative authority over all hospital systems',
    color: '#ef4444',
    bg: 'rgba(239,68,68,0.08)',
    icon: <LayoutDashboard size={18} />,
    perms: ['Emergency simulations', 'Diversion triggers', 'All analytics'],
  },
  {
    role: 'clinical',
    title: 'Clinical Staff / Triage Nurse',
    shortTitle: 'Clinical / Triage',
    desc: 'Patient intake, bed allocation and vitals management',
    color: '#38bdf8',
    bg: 'rgba(56,189,248,0.08)',
    icon: <Stethoscope size={18} />,
    perms: ['Walk-in triage', 'Bed allocation', 'EMS tracking'],
  },
  {
    role: 'patient',
    title: 'Patient & Family Portal',
    shortTitle: 'Patient & Family',
    desc: 'Your own queue status, vitals and nurse assistance',
    color: '#22c55e',
    bg: 'rgba(34,197,94,0.08)',
    icon: <Users size={18} />,
    perms: ['Your own record only', 'Wait estimates', 'Nurse alert'],
  },
];

const STATS = [
  { label: 'Patients Managed', value: '2,847' },
  { label: 'Avg Response Time', value: '4.2m' },
  { label: 'Resource Utilization', value: '78%' },
  { label: 'Departments Active', value: '6' },
];

const LoginPage: React.FC = () => {
  const { patients, loginAsStaff, loginAsPatient, loginAsFamily, darkMode } = useMedFlow();
  const navigate = useNavigate();

  const [selectedRole, setSelectedRole] = useState<SelectableRole>('director');
  const [familyMode, setFamilyMode] = useState(false);
  const [email, setEmail] = useState(STAFF_ACCOUNTS.director.email);
  const [password, setPassword] = useState(STAFF_ACCOUNTS.director.password);
  const [mrn, setMrn] = useState('');
  const [dob, setDob] = useState('');
  const [familyCode, setFamilyCode] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState('');

  const demoPatient = patients[0];

  const handleRoleSelect = (role: SelectableRole) => {
    setSelectedRole(role);
    setFamilyMode(false);
    setError('');
    if (role !== 'patient') {
      setEmail(STAFF_ACCOUNTS[role].email);
      setPassword(STAFF_ACCOUNTS[role].password);
    }
  };

  const fillDemoPatient = () => {
    if (!demoPatient) return;
    setMrn(demoPatient.mrn);
    setDob(demoPatient.dob);
    setError('');
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (selectedRole === 'patient' && familyMode) {
      const result = loginAsFamily(familyCode);
      if (!result.ok) {
        setError(result.error ?? 'Sign-in failed.');
        return;
      }
      navigate('/portal');
      return;
    }

    if (selectedRole === 'patient') {
      const result = loginAsPatient(mrn, dob);
      if (!result.ok) {
        setError(result.error ?? 'Sign-in failed.');
        return;
      }
      navigate('/portal');
      return;
    }

    const result = loginAsStaff(selectedRole, email, password);
    if (!result.ok) {
      setError(result.error ?? 'Sign-in failed.');
      return;
    }
    navigate('/');
  };

  const activeRoleConfig = ROLES.find(r => r.role === selectedRole)!;
  const patientMode = selectedRole === 'patient';

  return (
    <div style={{
      height: '100vh',
      display: 'flex',
      background: 'var(--bg-base)',
      overflowY: 'auto',
    }}>
      <div style={{
        flex: '1 1 50%',
        background: darkMode
          ? 'linear-gradient(135deg, #090d16 0%, #0f172a 50%, #1e293b 100%)'
          : 'linear-gradient(135deg, #f8faff 0%, #eef2ff 50%, #e0e7ff 100%)',
        borderRight: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '36px 48px',
        position: 'relative',
        overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute', top: -80, left: -80,
          width: 320, height: 320, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(37,99,235,0.15) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />
        <div style={{
          position: 'absolute', bottom: -60, right: -60,
          width: 260, height: 260, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(56,189,248,0.1) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, zIndex: 1 }}>
          <div style={{
            width: 38, height: 38, borderRadius: 8,
            background: 'linear-gradient(135deg, #2563eb, #38bdf8)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Activity size={20} color="#fff" />
          </div>
          <div>
            <div style={{ fontSize: 22, fontWeight: 900, color: 'var(--accent-light)', letterSpacing: -0.5, lineHeight: 1 }}>
              MED<span style={{ color: 'var(--cyan)' }}>FLOW</span>
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
              Prioritize Patients. Optimize Resources
            </div>
          </div>
        </div>

        <div style={{ margin: 'auto 0', zIndex: 1, padding: '16px 0' }}>
          <h1 style={{ fontSize: ' clamp(24px, 2.2vw, 32px)', fontWeight: 900, color: 'var(--text-primary)', lineHeight: 1.15, marginBottom: 12 }}>
            Hospital Operations<br />
            <span style={{ color: 'var(--accent-light)' }}>Command Platform</span>
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: 24, maxWidth: 420 }}>
            Real-time patient triage, resource allocation, and multi-department coordination — all in one intelligent platform.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, marginBottom: 24, maxWidth: 440 }}>
            {STATS.map(s => (
              <div key={s.label} style={{
                background: darkMode ? 'rgba(255,255,255,0.03)' : 'rgba(37,99,235,0.05)',
                border: '1px solid var(--border)',
                borderRadius: 8, padding: '10px 14px',
              }}>
                <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--accent-light)', fontFamily: 'JetBrains Mono, monospace' }}>
                  {s.value}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>{s.label}</div>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {['Live Triage Queue', 'ESI Scoring Engine', 'EMS Fleet Tracking', 'Sentinel AI', 'Audit Ledger'].map(f => (
              <span key={f} style={{
                background: 'rgba(37,99,235,0.08)', border: '1px solid rgba(37,99,235,0.2)',
                color: 'var(--accent-light)', borderRadius: 16, padding: '3px 10px',
                fontSize: 10, fontWeight: 600,
              }}>{f}</span>
            ))}
          </div>
        </div>

        <div style={{ fontSize: 11, color: 'var(--text-muted)', zIndex: 1 }}>
          MEDFLOW v2.0 · HIPAA Compliant · 256-bit Encrypted
        </div>
      </div>

      <div style={{
        flex: '1 1 50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '32px 48px',
        overflowY: 'auto',
      }}>
        <div style={{ width: '100%', maxWidth: 440 }}>
          <div style={{ marginBottom: 20 }}>
            <h2 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 4 }}>
              Sign in to MEDFLOW
            </h2>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              Select your role and authenticate to continue
            </div>
          </div>

          <div style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 }}>
              Access Role
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
              {ROLES.map(({ role, shortTitle, color, bg, icon }) => {
                const isSelected = selectedRole === role;
                return (
                  <button
                    key={role}
                    type="button"
                    onClick={() => handleRoleSelect(role)}
                    style={{
                      background: isSelected ? bg : 'var(--bg-card)',
                      border: `1.5px solid ${isSelected ? color : 'var(--border)'}`,
                      borderRadius: 8, padding: '10px 8px',
                      cursor: 'pointer',
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                      textAlign: 'center',
                      transition: 'border-color 0.15s ease, background 0.15s ease',
                    }}
                  >
                    <div style={{
                      color: isSelected ? color : 'var(--text-muted)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      {icon}
                    </div>
                    <span style={{
                      fontSize: 11, fontWeight: 700,
                      color: isSelected ? color : 'var(--text-primary)',
                      lineHeight: 1.2,
                    }}>
                      {shortTitle}
                    </span>
                  </button>
                );
              })}
            </div>

            <div style={{
              marginTop: 8, padding: '6px 10px', borderRadius: 6,
              background: activeRoleConfig.bg, border: `1px solid ${activeRoleConfig.color}33`,
              display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap',
            }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: activeRoleConfig.color }}>
                {activeRoleConfig.title}:
              </span>
              {activeRoleConfig.perms.map(p => (
                <span key={p} style={{ fontSize: 9.5, color: 'var(--text-secondary)' }}>
                  • {p}
                </span>
              ))}
            </div>
          </div>

          {patientMode && (
            <div style={{
              display: 'flex', gap: 4, marginBottom: 14,
              background: 'var(--bg-surface)', borderRadius: 8, padding: 4, border: '1px solid var(--border)',
            }}>
              {[
                { id: false, label: 'I am the patient', icon: <Users size={13} /> },
                { id: true,  label: 'I have a family code', icon: <Share2 size={13} /> },
              ].map(option => (
                <button
                  key={String(option.id)}
                  type="button"
                  onClick={() => { setFamilyMode(option.id); setError(''); }}
                  style={{
                    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                    padding: '8px 10px', borderRadius: 6, border: 'none', cursor: 'pointer',
                    fontSize: 11.5, fontWeight: 600, fontFamily: 'inherit',
                    background: familyMode === option.id ? 'var(--accent)' : 'transparent',
                    color: familyMode === option.id ? '#fff' : 'var(--text-secondary)',
                    transition: 'all 0.15s',
                  }}
                >
                  {option.icon}{option.label}
                </button>
              ))}
            </div>
          )}

          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.8 }}>
              Credentials
            </div>

            {!patientMode && (
              <>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label" style={{ fontSize: 11, marginBottom: 4 }}>Email Address</label>
                  <input
                    className="form-input"
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    style={{ fontSize: 12, height: 36 }}
                    autoComplete="username"
                    required
                  />
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label" style={{ fontSize: 11, marginBottom: 4 }}>Password</label>
                  <div style={{ position: 'relative' }}>
                    <input
                      className="form-input w-full"
                      type={showPass ? 'text' : 'password'}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      style={{ paddingRight: 36, fontSize: 12, height: 36 }}
                      autoComplete="current-password"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPass(s => !s)}
                      style={{
                        position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                        background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)',
                        display: 'flex', padding: 0,
                      }}
                    >
                      {showPass ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                </div>
              </>
            )}

            {patientMode && !familyMode && (
              <>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label" style={{ fontSize: 11, marginBottom: 4 }}>
                    Medical Record Number (MRN)
                  </label>
                  <input
                    className="form-input"
                    value={mrn}
                    onChange={e => setMrn(e.target.value)}
                    placeholder="M123456"
                    style={{ fontSize: 12, height: 36, fontFamily: 'JetBrains Mono, monospace' }}
                    autoComplete="off"
                    spellCheck={false}
                    required
                  />
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label" style={{ fontSize: 11, marginBottom: 4 }}>Date of Birth</label>
                  <input
                    className="form-input"
                    type="date"
                    value={dob}
                    onChange={e => setDob(e.target.value)}
                    style={{ fontSize: 12, height: 36 }}
                    autoComplete="bday"
                    required
                  />
                </div>
              </>
            )}

            {patientMode && familyMode && (
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ fontSize: 11, marginBottom: 4 }}>
                  Family Access Code
                </label>
                <input
                  className="form-input"
                  value={familyCode}
                  onChange={e => setFamilyCode(e.target.value)}
                  placeholder="FAM-1A2B3C"
                  style={{ fontSize: 12, height: 36, fontFamily: 'JetBrains Mono, monospace', letterSpacing: 1 }}
                  autoComplete="off"
                  spellCheck={false}
                  required
                />
                <div style={{ fontSize: 10.5, color: 'var(--text-muted)', marginTop: 4 }}>
                  Read-only access to the queue status of one patient — issued by the patient.
                </div>
              </div>
            )}

            {error && (
              <div style={{
                color: 'var(--danger)', fontSize: 11,
                background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)',
                padding: '8px 12px', borderRadius: 6,
              }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              className="btn btn-primary"
              style={{
                height: 38, fontSize: 13, fontWeight: 600,
                justifyContent: 'center', marginTop: 2, borderRadius: 6, gap: 8,
              }}
            >
              <Lock size={14} />
              {patientMode
                ? familyMode ? 'View Patient Status' : 'Access My Record'
                : 'Authenticate & Enter MEDFLOW'}
            </button>
          </form>

          <div style={{
            marginTop: 14, padding: '10px 12px',
            background: 'var(--bg-elevated)', borderRadius: 6,
            border: '1px solid var(--border)',
            fontSize: 11, color: 'var(--text-muted)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Bell size={12} style={{ color: 'var(--accent-light)', flexShrink: 0 }} />
              <span>
                <strong style={{ color: 'var(--accent-light)' }}>Demo mode:</strong>{' '}
                {patientMode
                  ? familyMode
                    ? 'Use the share code displayed in a patient portal\u2019s Family tab.'
                    : 'Staff credentials auto-fill above. Patients sign in with their own MRN.'
                  : 'Credentials auto-fill when switching roles above.'}
              </span>
            </div>

            {patientMode && !familyMode && demoPatient && (
              <button
                type="button"
                onClick={fillDemoPatient}
                style={{
                  marginTop: 8, width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  gap: 8, padding: '8px 10px', borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit',
                  background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-secondary)',
                }}
              >
                <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 2 }}>
                  <span style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--accent-light)' }}>
                    Use demo record
                  </span>
                  <span style={{ fontSize: 10, fontFamily: 'JetBrains Mono, monospace' }}>
                    {demoPatient.mrn} · DOB {formatDobForDisplay(demoPatient.dob)}
                  </span>
                </span>
                <CheckCircle size={14} style={{ color: 'var(--accent-light)', flexShrink: 0 }} />
              </button>
            )}
          </div>

          <div style={{ marginTop: 14, textAlign: 'center', fontSize: 10.5, color: 'var(--text-muted)' }}>
            Protected by end-to-end encryption · MEDFLOW v2.0
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
