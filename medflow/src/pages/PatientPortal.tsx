import React, { useState, useEffect } from 'react';
import { Users, Clock, AlertTriangle, CheckCircle, Info, Bell, Share2, Copy, MessageSquare, Activity, MapPin, Car, FileText, UserPlus, Globe, Heart, LogOut, Lock, Send } from 'lucide-react';
import toast from 'react-hot-toast';
import { useMedFlow } from '../store';
import { deriveFamilyCode, formatDobForDisplay } from '../auth';
import { PatientReport, PortalMessage } from '../types';
import { TRANSLATIONS, LANG_OPTIONS, Lang } from '../i18n';

type TabId = 'status' | 'communicate' | 'info' | 'family' | 'waiting-room' | 'faq';

const URGENCY_COLORS: Record<string, string> = {
  critical: 'var(--danger)',
  high: 'var(--warning)',
  medium: 'var(--cyan)',
  low: 'var(--text-muted)',
};

const URGENCY_LABELS: Record<string, string> = {
  critical: 'CRITICAL',
  high: 'HIGH',
  medium: 'MEDIUM',
  low: 'LOW',
};

const ESI_META: Record<number, { label: string; color: string; wait: string; plain: string }> = {
  1: { label: 'Resuscitation', color: '#ef4444', wait: 'Immediate', plain: 'Your condition is life-threatening. You are our absolute highest priority and are being seen right now.' },
  2: { label: 'Emergent',      color: '#f59e0b', wait: '< 15 min',  plain: 'Your condition is high-risk. A physician will assess you within 15 minutes. Please stay seated and alert staff if you feel worse.' },
  3: { label: 'Urgent',        color: '#60a5fa', wait: '< 30 min',  plain: 'Your condition needs prompt attention. Expected wait is 30–60 minutes. You will be called shortly.' },
  4: { label: 'Less Urgent',   color: '#22c55e', wait: '< 60 min',  plain: 'Your condition is stable. Expected wait is 1–2 hours. Please remain in the waiting area.' },
  5: { label: 'Non-Urgent',    color: '#94a3b8', wait: '< 2 hrs',   plain: 'Your condition is non-urgent. Expected wait is 2–4 hours. You may use the comfort request panel for any needs.' },
};

const TIMELINE_STEPS = ['step_checkin', 'step_triage', 'step_doctor', 'step_treatment', 'step_discharge'];

const COMFORT_ITEMS = ['Blanket', 'Water', 'Wheelchair', 'Extra Pillow', 'Phone Charger', 'Translator'];

const PatientPortal: React.FC = () => {
  const { patients, role, portalAccess, authedUser, authedPatientId, submitPatientReport, logout, sendPortalMessage, getSortedPortalMessages } = useMedFlow();
  const [lang, setLang] = useState<Lang>('en');
  const t = (k: string) => TRANSLATIONS[lang][k] || k;

  const isStaffView = role === 'director' || role === 'clinical';
  const isFamilyView = role === 'family';
  const isBoundSession = !isStaffView;
  const canCommunicate = role === 'patient' && portalAccess === 'full';

  const [staffPatientId, setStaffPatientId] = useState<string>(() => patients[0]?.id ?? '');
  const [activeTab, setActiveTab] = useState<TabId>('status');
  const [alertSent, setAlertSent] = useState(false);
  const [message, setMessage] = useState('');
  const [roomNumber, setRoomNumber] = useState('ER-1');
  const [symptom, setSymptom] = useState('');
  const [symptomSeverity, setSymptomSeverity] = useState(5);
  const [codeCopied, setCodeCopied] = useState(false);
  const [consentSigned, setConsentSigned] = useState(false);
  const [parkingRequested, setParkingRequested] = useState(false);
  const [familyName, setFamilyName] = useState('');
  const [familyRelation, setFamilyRelation] = useState('');
  const [familyCheckedIn, setFamilyCheckedIn] = useState(false);
  const [comfortSent, setComfortSent] = useState<string[]>([]);
  const [lastUpdated, setLastUpdated] = useState(new Date());

  const staffSelection = patients.some(p => p.id === staffPatientId) ? staffPatientId : (patients[0]?.id ?? '');
  const boundPatientId = isStaffView ? staffSelection : (authedPatientId ?? '');
  const patient = patients.find(p => p.id === boundPatientId);
  const sortedMessages = patient ? getSortedPortalMessages(patient.id) : [];

  const queuedPatients = patients.filter(p => !p.allocated).sort((a, b) => b.score - a.score);
  const queuePosition = patient && !patient.allocated ? queuedPatients.findIndex(p => p.id === patient.id) + 1 : null;
  const esiMeta = patient ? ESI_META[patient.esi] : null;

  const totalER = patients.length;
  const busyLevel = totalER < 5 ? 'quiet' : totalER < 10 ? 'moderate' : totalER < 15 ? 'busy' : 'surge';
  const busyColor = { quiet: '#22c55e', moderate: '#f59e0b', busy: '#ef4444', surge: '#dc2626' }[busyLevel];

  const avgServiceMins = 18;
  const estWait = queuePosition ? Math.max(0, (queuePosition - 1) * avgServiceMins) : 0;

  const familyCode = patient ? deriveFamilyCode(patient.id) : '';

  const timelineStep = patient
    ? patient.allocated ? 3
    : patient.waitMinutes > 20 ? 2
    : patient.waitMinutes > 5 ? 1
    : 0
    : 0;

  useEffect(() => {
    const timer = setInterval(() => setLastUpdated(new Date()), 30000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!canCommunicate && activeTab !== 'status' && activeTab !== 'info') setActiveTab('status');
  }, [canCommunicate, activeTab]);

  useEffect(() => {
    if (isFamilyView && activeTab !== 'status' && activeTab !== 'waiting-room' && activeTab !== 'info' && activeTab !== 'faq') setActiveTab('status');
  }, [isFamilyView, activeTab]);

  const raiseReport = (report: PatientReport): boolean => {
    if (!patient) return false;
    const result = submitPatientReport(patient.id, report);
    if (!result.ok) {
      toast.error(result.error ?? 'Report rejected.', { duration: 5000 });
      return false;
    }
    return true;
  };

  const handleNurseAlert = () => {
    const sent = raiseReport({
      kind: 'pain_alert',
      message: 'Requested immediate assessment — reported pain / deterioration',
      toast: `NURSE ALERT: ${patient?.name} reports pain/deterioration!`,
      toastLevel: 'error',
    });
    if (!sent) return;
    setAlertSent(true);
    setTimeout(() => setAlertSent(false), 10000);
  };

  const handleSendMessage = () => {
    if (!message.trim()) return;
    const urgency = symptomSeverity <= 3 ? 'critical' : symptomSeverity <= 5 ? 'high' : symptomSeverity <= 7 ? 'medium' : 'low';
    const sent = raiseReport({
      kind: 'message',
      message: `"${message.trim()}"`,
      toast: t('messageSent'),
    });
    if (sent) {
      sendPortalMessage({
        patientId: patient!.id,
        patientName: patient!.name,
        senderName: patient!.name,
        roomNumber: roomNumber,
        urgency,
        content: message.trim(),
      });
      setMessage('');
    }
  };

  const handleSymptomSubmit = () => {
    if (!symptom.trim()) return;
    const sent = raiseReport({
      kind: 'symptoms',
      message: `Severity ${symptomSeverity}/10 — ${symptom.trim()}`,
      toast: 'Symptom update sent to triage nurse',
    });
    if (sent) setSymptom('');
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(familyCode).catch(() => {});
    setCodeCopied(true);
    setTimeout(() => setCodeCopied(false), 3000);
    toast.success('Family access code copied!', { duration: 2000 });
  };

  const handleComfort = (item: string) => {
    if (comfortSent.includes(item)) return;
    const sent = raiseReport({
      kind: 'comfort',
      message: `Requested ${item}`,
      toast: `${item} request sent`,
    });
    if (sent) setComfortSent(prev => [...prev, item]);
  };

  const handleFamilyCheckin = () => {
    if (!familyName.trim()) return;
    const relation = familyRelation || 'relation not given';
    const sent = raiseReport({
      kind: 'family_checkin',
      message: `${familyName.trim()} (${relation}) checked in to the waiting room`,
      toast: `${familyName.trim()} ${t('familyCheckedIn')}`,
    });
    if (sent) setFamilyCheckedIn(true);
  };

  const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
    { id: 'status',      label: 'Status & Queue', icon: <Activity size={14} /> },
    { id: 'communicate', label: 'Communicate',    icon: <MessageSquare size={14} /> },
    { id: 'info',        label: 'Information',    icon: <Info size={14} /> },
    { id: 'family',      label: 'Family',         icon: <Users size={14} /> },
  ];

  const FAMILY_TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
    { id: 'status',         label: 'Status',        icon: <Activity size={14} /> },
    { id: 'waiting-room',   label: 'Waiting Room',  icon: <Users size={14} /> },
    { id: 'info',           label: 'Info',          icon: <Info size={14} /> },
    { id: 'faq',            label: 'FAQ',           icon: <FileText size={14} /> },
  ];

  const PATIENT_TABS = canCommunicate ? TABS : TABS.filter(tab => tab.id === 'status' || tab.id === 'info');
  const visibleTabs = isFamilyView ? FAMILY_TABS : PATIENT_TABS;

  const busyBadge = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', background: 'var(--bg-elevated)', borderRadius: 8, border: '1px solid var(--border)' }}>
      <div style={{ width: 8, height: 8, borderRadius: '50%', background: busyColor, boxShadow: `0 0 6px ${busyColor}` }} />
      <span style={{ fontSize: 11, color: busyColor, fontWeight: 700, textTransform: 'uppercase' }}>{t(busyLevel)}</span>
      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>· {totalER} pts</span>
    </div>
  );

  if (isBoundSession && !patient) {
    return (
      <div style={{ maxWidth: 560, margin: '72px auto' }}>
        <div className="card" style={{ textAlign: 'center', padding: '32px 24px' }}>
          <CheckCircle size={34} style={{ color: 'var(--success)' }} />
          <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)', marginTop: 12 }}>
            {t('recordClosed')}
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 6, lineHeight: 1.6 }}>
            {t('recordClosedMsg')}
          </div>
          <button className="btn btn-primary w-full" style={{ marginTop: 20, justifyContent: 'center' }} onClick={logout}>
            <LogOut size={14} /> {t('signOut')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Heart size={20} style={{ color: 'var(--accent-light)' }} />
          <span style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)' }}>{t('title')}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Globe size={14} style={{ color: 'var(--text-muted)' }} />
          <select
            style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 8px', color: 'var(--text-primary)', fontSize: 12, cursor: 'pointer' }}
            value={lang} onChange={e => setLang(e.target.value as Lang)}
          >
            {LANG_OPTIONS.map(l => <option key={l.code} value={l.code}>{l.flag} {l.label}</option>)}
          </select>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        {isStaffView ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ flex: 1 }}>
              <label className="form-label">{t('viewingPatient')}</label>
              <select className="form-select" value={staffSelection}
                onChange={e => { setStaffPatientId(e.target.value); setAlertSent(false); setActiveTab('status'); }}>
                {patients.map(p => <option key={p.id} value={p.id}>{p.name} — ESI {p.esi} — {p.allocated ? t('admitted') : t('inQueue')}</option>)}
              </select>
            </div>
            {patient && busyBadge}
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Lock size={16} style={{ color: 'var(--accent-light)', flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.8 }}>
                  {canCommunicate ? t('yourRecord') : t('signedInAs')}
                </div>
                <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)' }}>
                  {patient?.name ?? authedUser}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  {canCommunicate ? t('boundNotice') : t('readOnlyNotice')}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              {!canCommunicate && (
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 20,
                  background: 'rgba(148,163,184,0.12)', border: '1px solid var(--border)',
                  color: 'var(--text-secondary)', fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5,
                }}>
                  <Lock size={11} /> {t('readOnlyView')}
                </span>
              )}
              {patient && busyBadge}
            </div>
          </div>
        )}
      </div>

      {patient && (
        <div>
          <div style={{ display: 'flex', gap: 4, marginBottom: 16, background: 'var(--bg-surface)', borderRadius: 8, padding: 4, border: '1px solid var(--border)' }}>
            {visibleTabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`btn ${activeTab === tab.id ? 'btn-primary' : 'btn-ghost'}`}
                style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: 13 }}
              >
                {tab.icon}
                <span>{tab.label}</span>
              </button>
            ))}
          </div>

          {activeTab === 'status' && (
            <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Status</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: esiMeta?.color }}>
                  {esiMeta?.label} (ESI {patient.esi})
                </div>
                <p style={{ margin: '8px 0 0', fontSize: 14, color: 'var(--text-secondary)' }}>
                  {esiMeta?.plain}
                </p>
              </div>

              <div style={{ display: 'flex', gap: 24, padding: '12px 0', borderTop: '1px solid var(--border)' }}>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Queue Position</div>
                  <div style={{ fontSize: 20, fontWeight: 700 }}>
                    {queuePosition ? `#${queuePosition}` : 'Being Seen'}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Est. Wait Time</div>
                  <div style={{ fontSize: 20, fontWeight: 700 }}>
                    {queuePosition ? `~${estWait} mins` : esiMeta?.wait}
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'communicate' && canCommunicate && (
            <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label className="form-label">Send Message to Care Team</label>
                <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                  <input
                    className="form-input"
                    style={{ flex: 1 }}
                    value={message}
                    onChange={e => setMessage(e.target.value)}
                    placeholder="Type an update or request..."
                  />
                  <button className="btn btn-primary" onClick={handleSendMessage}>
                    <Send size={14} /> Send
                  </button>
                </div>
                <div style={{ marginTop: 6, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <span className="form-label" style={{ marginBottom: 0 }}>Room:</span>
                  <input className="form-input" value={roomNumber} onChange={e => setRoomNumber(e.target.value)} style={{ width: 100, fontSize: 12, height: 30 }} />
                  <span className="text-xs text-muted">— Severity:</span>
                  <select className="form-select" value={symptomSeverity} onChange={e => setSymptomSeverity(+e.target.value)} style={{ width: 90, fontSize: 12, height: 30, padding: '2px 4px' }}>
                    {[1,2,3,4,5,6,7,8,9,10].map(n => <option key={n} value={n}>{n}</option>)}
                  </select>
                </div>
              </div>

              <div style={{ paddingTop: 12, borderTop: '1px solid var(--border)' }}>
                <button
                  className="btn btn-danger"
                  style={{ width: '100%', justifyContent: 'center' }}
                  disabled={alertSent}
                  onClick={handleNurseAlert}
                >
                  <AlertTriangle size={16} />
                  {alertSent ? 'Nurse Alerted' : 'Report Severe Pain / Urgent Deterioration'}
                </button>
              </div>

              {sortedMessages.length > 0 && (
                <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12 }}>
                  <div className="section-title mb-8" style={{ fontSize: 12 }}>Message History (Urgency Sorted)</div>
                  {sortedMessages.map(msg => (
                    <div key={msg.id} style={{ padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: URGENCY_COLORS[msg.urgency] }}>
                          ● {URGENCY_LABELS[msg.urgency]}
                        </span>
                        <span className="text-xs text-muted font-mono">{new Date(msg.timestamp).toLocaleTimeString()}</span>
                      </div>
                      <div className="text-xs" style={{ color: 'var(--text-secondary)', marginBottom: 2 }}>
                        <strong style={{ color: 'var(--text-primary)' }}>{msg.senderName}</strong> · Room {msg.roomNumber}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{msg.content}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'info' && (
            <div className="card">
              <h4 style={{ margin: '0 0 8px 0', fontSize: 16 }}>Visit Information</h4>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0 }}>
                DOB: {formatDobForDisplay(patient.dob)}
              </p>
              <div style={{ marginTop: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>Need Comfort Items?</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {COMFORT_ITEMS.map(item => (
                    <button
                      key={item}
                      className={`btn ${comfortSent.includes(item) ? 'btn-secondary' : 'btn-ghost'}`}
                      style={{ fontSize: 12 }}
                      disabled={comfortSent.includes(item) || !canCommunicate}
                      onClick={() => handleComfort(item)}
                    >
                      {item} {comfortSent.includes(item) && '✓'}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'family' && (
            <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {isFamilyView && (
                <>
                  <div>
                    <label className="form-label">Family Access Code</label>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 6 }}>
                      <code style={{ fontSize: 16, fontWeight: 700, padding: '4px 10px', background: 'var(--bg-elevated)', borderRadius: 4 }}>
                        {familyCode}
                      </code>
                      <button className="btn btn-secondary" onClick={handleCopyCode}>
                        <Copy size={14} /> {codeCopied ? 'Copied' : 'Copy'}
                      </button>
                    </div>
                  </div>
                </>
              )}
              {!isFamilyView && (
                <>
                  <div>
                    <label className="form-label">Family Access Code</label>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 6 }}>
                      <code style={{ fontSize: 16, fontWeight: 700, padding: '4px 10px', background: 'var(--bg-elevated)', borderRadius: 4 }}>
                        {familyCode}
                      </code>
                      <button className="btn btn-secondary" onClick={handleCopyCode}>
                        <Copy size={14} /> {codeCopied ? 'Copied' : 'Copy'}
                      </button>
                    </div>
                    <div style={{ fontSize: 10.5, color: 'var(--text-muted)', marginTop: 4 }}>
                      Share this code with family members so they can view your status.
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {activeTab === 'waiting-room' && (
            <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <div className="section-title mb-8"><Users size={14} /> Waiting Room Status</div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                  {isFamilyView
                    ? `${authedUser} — You are in the family waiting room. The patient will be notified when visitors are welcome.`
                    : `Family members waiting for ${patient?.name ?? 'the patient'} are registered in the waiting room.`}
                </div>
              </div>
              {isFamilyView && (
                <div style={{ paddingTop: 12, borderTop: '1px solid var(--border)' }}>
                  <div className="section-title mb-8" style={{ fontSize: 12 }}>Family Check-In</div>
                  <div className="form-grid">
                    <div className="form-group">
                      <label className="form-label">Your Name</label>
                      <input className="form-input" value={familyName} onChange={e => setFamilyName(e.target.value)} placeholder="Full name" />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Relation to Patient</label>
                      <select className="form-select" value={familyRelation} onChange={e => setFamilyRelation(e.target.value)}>
                        <option value="">Select...</option>
                        <option value="Spouse">Spouse</option>
                        <option value="Parent">Parent</option>
                        <option value="Child">Child</option>
                        <option value="Sibling">Sibling</option>
                        <option value="Friend">Friend</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>
                  </div>
                  <button
                    className="btn btn-primary"
                    style={{ marginTop: 8, justifyContent: 'center' }}
                    onClick={handleFamilyCheckin}
                    disabled={!familyName.trim()}
                  >
                    <CheckCircle size={14} /> Check In to Waiting Room
                  </button>
                  {familyCheckedIn && (
                    <div style={{ marginTop: 8, fontSize: 12, color: 'var(--success)' }}>✓ Checked in — staff have been notified</div>
                  )}
                </div>
              )}
            </div>
          )}

          {activeTab === 'faq' && (
            <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div className="section-title mb-8"><Info size={14} /> Frequently Asked Questions</div>
              {[
                { q: 'When will I be seen?', a: 'Based on your ESI level and current queue. ESI-1 patients are seen immediately, ESI-2 within 15 minutes, ESI-3 within 30 minutes, ESI-4 within 60 minutes, and ESI-5 within 2 hours.' },
                { q: 'Where is the cafeteria?', a: 'The cafeteria is open 24/7 on Level 2, accessible from the main lobby elevator.' },
                { q: 'Can family visit?', a: 'Visiting hours are 8 AM – 8 PM. ICU visits are limited to 2 visitors at a time. Check with the nurse station for current restrictions.' },
                { q: 'How do I pay my bill?', a: 'Billing questions can be directed to the front desk on Level 1. Payment plans are available upon request.' },
                { q: 'Parking?', a: 'Free parking validation is available at the information desk. Self-parking is on Level B1.' },
              ].map((item, i) => (
                <div key={i} style={{ padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>Q: {item.q}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>A: {item.a}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default PatientPortal;