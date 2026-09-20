import React, { useState, useEffect } from 'react';
import { Users, Clock, AlertTriangle, CheckCircle, Info, Bell, Share2, Copy, MessageSquare, Activity, MapPin, Car, FileText, UserPlus, Globe, Heart } from 'lucide-react';
import { useMedFlow } from '../store';
import toast from 'react-hot-toast';
import { TRANSLATIONS, Lang } from '../i18n';

type TabId = 'status' | 'communicate' | 'info' | 'family';

const ESI_META: Record<number, { label: string; color: string; wait: string; plain: string }> = {
  1: { label: 'Resuscitation', color: '#ef4444', wait: 'Immediate', plain: 'Your condition is life-threatening. You are our absolute highest priority and are being seen right now.' },
  2: { label: 'Emergent',      color: '#f59e0b', wait: '< 15 min',  plain: 'Your condition is high-risk. A physician will assess you within 15 minutes. Please stay seated and alert staff if you feel worse.' },
  3: { label: 'Urgent',        color: '#60a5fa', wait: '< 30 min',  plain: 'Your condition needs prompt attention. Expected wait is 30–60 minutes. You will be called shortly.' },
  4: { label: 'Less Urgent',   color: '#22c55e', wait: '< 60 min',  plain: 'Your condition is stable. Expected wait is 1–2 hours. Please remain in the waiting area.' },
  5: { label: 'Non-Urgent',    color: '#94a3b8', wait: '< 2 hrs',   plain: 'Your condition is non-urgent. Expected wait is 2–4 hours. You may use the comfort request panel for any needs.' },
};

const TIMELINE_STEPS = ['step_checkin','step_triage','step_doctor','step_treatment','step_discharge'];

const COMFORT_ITEMS = ['Blanket','Water','Wheelchair','Extra Pillow','Phone Charger','Translator'];

const LANG_OPTIONS: { code: Lang; label: string; flag: string }[] = [
  { code: 'en', label: 'English', flag: '🇺🇸' },
];

const PatientPortal: React.FC = () => {
  const { patients, addAudit, resources } = useMedFlow();
  const [lang, setLang] = useState<Lang>('en');
  const t = (k: string) => TRANSLATIONS[lang][k] || k;

  const [selectedId, setSelectedId] = useState<string>(patients[0]?.id || '');
  const [activeTab, setActiveTab] = useState<TabId>('status');
  const [alertSent, setAlertSent] = useState(false);
  const [message, setMessage] = useState('');
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

  const queuedPatients = patients.filter(p => !p.allocated).sort((a, b) => b.score - a.score);
  const patient = patients.find(p => p.id === selectedId);
  const queuePosition = patient && !patient.allocated ? queuedPatients.findIndex(p => p.id === selectedId) + 1 : null;
  const esiMeta = patient ? ESI_META[patient.esi] : null;

  const totalER = patients.length;
  const busyLevel = totalER < 5 ? 'quiet' : totalER < 10 ? 'moderate' : totalER < 15 ? 'busy' : 'surge';
  const busyColor = { quiet: '#22c55e', moderate: '#f59e0b', busy: '#ef4444', surge: '#dc2626' }[busyLevel];

  const avgServiceMins = 18;
  const estWait = queuePosition ? Math.max(0, (queuePosition - 1) * avgServiceMins) : 0;

  const shareCode = patient ? `MF-${patient.id.slice(0,6).toUpperCase()}` : '';

  const timelineStep = patient
    ? patient.allocated ? 3
    : patient.waitMinutes > 20 ? 2
    : patient.waitMinutes > 5 ? 1
    : 0
    : 0;

  useEffect(() => {
    const t = setInterval(() => setLastUpdated(new Date()), 30000);
    return () => clearInterval(t);
  }, []);

  const handleNurseAlert = () => {
    if (!patient) return;
    addAudit('THRESHOLD', `Patient ${patient.name} reported pain/deterioration via portal`, 'critical', 'Patient Portal');
    toast.error(`NURSE ALERT: ${patient.name} reports pain/deterioration!`, { duration: 6000 });
    setAlertSent(true);
    setTimeout(() => setAlertSent(false), 10000);
  };

  const handleSendMessage = () => {
    if (!message.trim() || !patient) return;
    addAudit('THRESHOLD', `Message from ${patient.name}: "${message}"`, 'warning', 'Patient Portal');
    toast.success(t('messageSent'), { duration: 3000 });
    setMessage('');
  };

  const handleSymptomSubmit = () => {
    if (!symptom.trim() || !patient) return;
    addAudit('THRESHOLD', `Symptom update from ${patient.name} (severity ${symptomSeverity}/10): ${symptom}`, 'warning', 'Patient Portal');
    toast.success('Symptom update sent to triage nurse', { duration: 3000 });
    setSymptom('');
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(shareCode).catch(() => {});
    setCodeCopied(true);
    setTimeout(() => setCodeCopied(false), 3000);
    toast.success('Family access code copied!', { duration: 2000 });
  };

  const handleComfort = (item: string) => {
    if (comfortSent.includes(item)) return;
    setComfortSent(p => [...p, item]);
    addAudit('TRIAGE', `Comfort request from ${patient?.name}: ${item}`, 'info', 'Patient Portal');
    toast.success(`${item} request sent`, { duration: 2000 });
  };

  const handleFamilyCheckin = () => {
    if (!familyName.trim()) return;
    setFamilyCheckedIn(true);
    addAudit('TRIAGE', `Family member ${familyName} (${familyRelation}) checked in for ${patient?.name}`, 'info', 'Patient Portal');
    toast.success(`${familyName} ${t('familyCheckedIn')}`, { duration: 3000 });
  };


  const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
    { id: 'status',      label: 'Status & Queue', icon: <Activity size={14} /> },
    { id: 'communicate', label: 'Communicate',    icon: <MessageSquare size={14} /> },
    { id: 'info',        label: 'Information',    icon: <Info size={14} /> },
    { id: 'family',      label: 'Family',         icon: <Users size={14} /> },
  ];

  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      {/* Header row */}
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

      {/* Patient selector */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ flex: 1 }}>
            <label className="form-label">{t('selectPatient')}</label>
            <select className="form-select" value={selectedId}
              onChange={e => { setSelectedId(e.target.value); setAlertSent(false); setActiveTab('status'); }}>
              {patients.map(p => <option key={p.id} value={p.id}>{p.name} — ESI {p.esi} — {p.allocated ? t('admitted') : t('inQueue')}</option>)}
            </select>
          </div>
          {patient && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', background: 'var(--bg-elevated)', borderRadius: 8, border: '1px solid var(--border)' }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: busyColor, boxShadow: `0 0 6px ${busyColor}` }} />
              <span style={{ fontSize: 11, color: busyColor, fontWeight: 700, textTransform: 'uppercase' }}>{t(busyLevel)}</span>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>· {totalER} pts</span>
            </div>
          )}
        </div>
      </div>


      {patient && (
        <div>
          {/* Tabs */}
          <div style={{ display: 'flex', gap: 4, marginBottom: 16, background: 'var(--bg-surface)', borderRadius: 8, padding: 4, border: '1px solid var(--border)' }}>
            {TABS.map(tab => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  padding: '8px 12px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, fontFamily: 'inherit',
                  background: activeTab === tab.id ? 'var(--accent)' : 'transparent',
                  color: activeTab === tab.id ? '#fff' : 'var(--text-secondary)',
                  transition: 'all 0.15s',
                }}>
                {tab.icon}{tab.label}
              </button>
            ))}
          </div>

          {/* ── TAB: STATUS ── */}
          {activeTab === 'status' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

              {/* Status header card */}
              <div className="card" style={{ border: `2px solid ${esiMeta?.color}`, background: `${esiMeta?.color}08` }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1 }}>Patient</div>
                    <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)' }}>{patient.name}</div>
                    <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{patient.age} yrs · {patient.condition}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 20,
                      background: patient.allocated ? 'rgba(34,197,94,0.15)' : 'rgba(245,158,11,0.15)',
                      border: `1px solid ${patient.allocated ? 'var(--success)' : 'var(--warning)'}`,
                      color: patient.allocated ? 'var(--success)' : 'var(--warning)', fontWeight: 700, fontSize: 12 }}>
                      {patient.allocated ? <><CheckCircle size={13} /> {t('admitted')}</> : <><Clock size={13} /> {t('inQueue')}</>}
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>
                      Updated {lastUpdated.toLocaleTimeString()}
                    </div>
                  </div>
                </div>

                {/* Queue stats */}
                {!patient.allocated && queuePosition !== null && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 12, borderTop: '1px solid var(--border)', paddingTop: 16, marginBottom: 16 }}>
                    {[
                      { label: t('queuePosition'), val: `#${queuePosition}`, sub: `${t('of')} ${queuedPatients.length} ${t('waiting')}`, color: esiMeta?.color },
                      { label: t('elapsedWait'),   val: `${patient.waitMinutes}m`, sub: 'since arrival', color: 'var(--text-primary)' },
                      { label: t('estimatedWait'), val: `~${estWait}m`, sub: 'to be seen', color: 'var(--cyan)' },
                      { label: t('department'),    val: patient.department, sub: patient.targetResource, color: 'var(--accent-light)' },
                    ].map(s => (
                      <div key={s.label} style={{ textAlign: 'center', padding: '10px 8px', background: 'var(--bg-elevated)', borderRadius: 8 }}>
                        <div style={{ fontSize: 18, fontWeight: 800, color: s.color, fontFamily: 'JetBrains Mono, monospace', lineHeight: 1.2 }}>{s.val}</div>
                        <div style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 2 }}>{s.label}</div>
                        <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{s.sub}</div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Queue progress bar */}
                {!patient.allocated && queuePosition !== null && queuedPatients.length > 0 && (
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-muted)', marginBottom: 4 }}>
                      <span>Queue Progress</span>
                      <span>{Math.round(((queuedPatients.length - queuePosition) / queuedPatients.length) * 100)}% through queue</span>
                    </div>
                    <div style={{ height: 8, background: 'var(--bg-elevated)', borderRadius: 4, overflow: 'hidden' }}>
                      <div style={{ height: '100%', borderRadius: 4, background: `linear-gradient(90deg, ${esiMeta?.color}, var(--cyan))`,
                        width: `${Math.round(((queuedPatients.length - queuePosition) / queuedPatients.length) * 100)}%`, transition: 'width 1s ease' }} />
                    </div>
                  </div>
                )}

                {/* Admitted banner */}
                {patient.allocated && (
                  <div style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid var(--success)', borderRadius: 8, padding: 14, marginBottom: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <CheckCircle size={16} style={{ color: 'var(--success)' }} />
                      <span style={{ fontWeight: 700, color: 'var(--success)' }}>You have been admitted</span>
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 6 }}>
                      Assigned to: <strong style={{ color: 'var(--text-primary)' }}>{patient.allocatedBay}</strong>
                    </div>
                  </div>
                )}

                {/* Nurse alert */}
                {!patient.allocated && (
                  <button className={`btn w-full ${alertSent ? 'btn-success' : 'btn-danger'}`}
                    style={{ padding: '11px', fontSize: 13, justifyContent: 'center' }}
                    onClick={handleNurseAlert} disabled={alertSent}>
                    {alertSent ? <><CheckCircle size={15} /> {t('alertSent')}</> : <><Bell size={15} /> {t('nurseAlert')}</>}
                  </button>
                )}
              </div>


              {/* ESI explanation */}
              {esiMeta && (
                <div className="card" style={{ border: `1px solid ${esiMeta.color}` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                    <div style={{ width: 36, height: 36, borderRadius: '50%', background: `${esiMeta.color}20`,
                      border: `2px solid ${esiMeta.color}`, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 16, fontWeight: 900, color: esiMeta.color, fontFamily: 'JetBrains Mono, monospace' }}>
                      {patient.esi}
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, color: esiMeta.color, fontSize: 14 }}>ESI Level {patient.esi} — {esiMeta.label}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Target response: {esiMeta.wait}</div>
                    </div>
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>{esiMeta.plain}</div>
                </div>
              )}

              {/* Care timeline */}
              <div className="card">
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 16 }}>{t('timeline')}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
                  {TIMELINE_STEPS.map((step, i) => {
                    const done = i <= timelineStep;
                    const active = i === timelineStep;
                    return (
                      <React.Fragment key={step}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
                          <div style={{ width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            background: done ? 'var(--accent)' : 'var(--bg-elevated)',
                            border: `2px solid ${active ? 'var(--cyan)' : done ? 'var(--accent)' : 'var(--border)'}`,
                            boxShadow: active ? '0 0 10px rgba(56,189,248,0.4)' : 'none',
                            transition: 'all 0.3s', fontSize: 12, color: done ? '#fff' : 'var(--text-muted)', fontWeight: 700 }}>
                            {done ? <CheckCircle size={14} /> : i + 1}
                          </div>
                          <div style={{ fontSize: 9, color: done ? 'var(--accent-light)' : 'var(--text-muted)', marginTop: 6, textAlign: 'center', fontWeight: done ? 700 : 400 }}>
                            {t(step)}
                          </div>
                        </div>
                        {i < TIMELINE_STEPS.length - 1 && (
                          <div style={{ flex: 1, height: 2, background: i < timelineStep ? 'var(--accent)' : 'var(--border)', marginBottom: 20, transition: 'background 0.3s' }} />
                        )}
                      </React.Fragment>
                    );
                  })}
                </div>
              </div>

              {/* Vitals */}
              <div className="card">
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 }}>{t('yourVitals')}</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10 }}>
                  {[
                    { label: 'Blood Pressure', val: patient.vitals.bp, unit: 'mmHg' },
                    { label: 'Heart Rate',      val: patient.vitals.hr, unit: 'bpm' },
                    { label: 'SpO\u2082',       val: patient.vitals.spo2, unit: '%' },
                    { label: 'Temperature',     val: patient.vitals.temp, unit: '\u00b0C' },
                  ].map(v => (
                    <div key={v.label} style={{ textAlign: 'center', padding: '10px 6px', background: 'var(--bg-elevated)', borderRadius: 8 }}>
                      <div style={{ fontSize: 20, fontWeight: 800, fontFamily: 'JetBrains Mono, monospace', color: 'var(--text-primary)' }}>{v.val}</div>
                      <div style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase', marginTop: 2 }}>{v.label}</div>
                      <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>{v.unit}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}


          {/* ── TAB: COMMUNICATE ── */}
          {activeTab === 'communicate' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

              {/* Message nurse */}
              <div className="card">
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <MessageSquare size={15} style={{ color: 'var(--accent-light)' }} />{t('sendMessage')}
                </div>
                <textarea
                  style={{ width: '100%', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8,
                    padding: '10px 12px', color: 'var(--text-primary)', fontSize: 13, fontFamily: 'inherit',
                    resize: 'vertical', minHeight: 90, outline: 'none' }}
                  placeholder={t('messagePlaceholder')}
                  value={message} onChange={e => setMessage(e.target.value)}
                />
                <button className="btn btn-primary" style={{ marginTop: 10, justifyContent: 'center', width: '100%' }}
                  onClick={handleSendMessage} disabled={!message.trim()}>
                  {t('send')}
                </button>
              </div>

              {/* Symptom update */}
              <div className="card">
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <AlertTriangle size={15} style={{ color: 'var(--warning)' }} />{t('symptoms')}
                </div>
                <div style={{ marginBottom: 12 }}>
                  <label className="form-label">{t('symptomSeverity')}: <span style={{ color: symptomSeverity >= 8 ? 'var(--danger)' : symptomSeverity >= 5 ? 'var(--warning)' : 'var(--success)', fontWeight: 700 }}>{symptomSeverity}/10</span></label>
                  <input type="range" min={1} max={10} value={symptomSeverity} onChange={e => setSymptomSeverity(+e.target.value)}
                    style={{ width: '100%', accentColor: symptomSeverity >= 8 ? '#ef4444' : symptomSeverity >= 5 ? '#f59e0b' : '#22c55e' }} />
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-muted)' }}>
                    <span>Mild</span><span>Moderate</span><span>Severe</span>
                  </div>
                </div>
                <textarea
                  style={{ width: '100%', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8,
                    padding: '10px 12px', color: 'var(--text-primary)', fontSize: 13, fontFamily: 'inherit',
                    resize: 'vertical', minHeight: 70, outline: 'none' }}
                  placeholder="Describe new or worsening symptoms..."
                  value={symptom} onChange={e => setSymptom(e.target.value)}
                />
                <button className="btn btn-danger" style={{ marginTop: 10, justifyContent: 'center', width: '100%' }}
                  onClick={handleSymptomSubmit} disabled={!symptom.trim()}>
                  {t('submitSymptoms')}
                </button>
              </div>

              {/* Comfort requests */}
              <div className="card">
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Heart size={15} style={{ color: 'var(--success)' }} />{t('comfortRequest')}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
                  {COMFORT_ITEMS.map(item => (
                    <button key={item} onClick={() => handleComfort(item)}
                      style={{ padding: '10px 8px', borderRadius: 8, border: `1px solid ${comfortSent.includes(item) ? 'var(--success)' : 'var(--border)'}`,
                        background: comfortSent.includes(item) ? 'rgba(34,197,94,0.1)' : 'var(--bg-elevated)',
                        color: comfortSent.includes(item) ? 'var(--success)' : 'var(--text-secondary)',
                        fontSize: 12, fontWeight: 600, cursor: comfortSent.includes(item) ? 'default' : 'pointer',
                        fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                      {comfortSent.includes(item) ? <CheckCircle size={12} /> : null}{item}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}


          {/* ── TAB: INFO ── */}
          {activeTab === 'info' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

              {/* Hospital status */}
              <div className="card">
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 14 }}>{t('hospitalBusy')}</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div style={{ padding: 14, background: 'var(--bg-elevated)', borderRadius: 8, textAlign: 'center' }}>
                    <div style={{ fontSize: 32, fontWeight: 900, color: busyColor, fontFamily: 'JetBrains Mono, monospace' }}>{totalER}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{t('totalPatients')}</div>
                  </div>
                  <div style={{ padding: 14, background: `${busyColor}12`, border: `1px solid ${busyColor}`, borderRadius: 8, textAlign: 'center' }}>
                    <div style={{ fontSize: 22, fontWeight: 800, color: busyColor }}>{t(busyLevel).toUpperCase()}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>Current Load</div>
                    <div style={{ height: 6, background: 'var(--bg-elevated)', borderRadius: 3, marginTop: 8, overflow: 'hidden' }}>
                      <div style={{ height: '100%', borderRadius: 3, background: busyColor,
                        width: busyLevel === 'quiet' ? '25%' : busyLevel === 'moderate' ? '50%' : busyLevel === 'busy' ? '75%' : '95%' }} />
                    </div>
                  </div>
                </div>
              </div>

              {/* Department map */}
              <div className="card">
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <MapPin size={14} style={{ color: 'var(--accent-light)' }} />Department Map
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
                  {['Trauma ER','ICU','OR Suites','Cardiology','Neurology','Orthopedics'].map(dept => {
                    const isYours = patient.department === dept;
                    return (
                      <div key={dept} style={{ padding: '10px 12px', borderRadius: 8,
                        background: isYours ? 'rgba(37,99,235,0.15)' : 'var(--bg-elevated)',
                        border: `1px solid ${isYours ? 'var(--accent)' : 'var(--border)'}`,
                        textAlign: 'center' }}>
                        <div style={{ fontSize: 12, fontWeight: isYours ? 700 : 500, color: isYours ? 'var(--accent-light)' : 'var(--text-secondary)' }}>{dept}</div>
                        {isYours && <div style={{ fontSize: 9, color: 'var(--accent-light)', marginTop: 2 }}>YOUR DESTINATION</div>}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Parking + Consent */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div className="card">
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Car size={14} style={{ color: 'var(--cyan)' }} />{t('parking')}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 12 }}>Request free parking validation for your visit.</div>
                  <button className={`btn w-full ${parkingRequested ? 'btn-success' : 'btn-ghost'}`}
                    style={{ justifyContent: 'center' }} onClick={() => { setParkingRequested(true); toast.success(t('requestSent')); }} disabled={parkingRequested}>
                    {parkingRequested ? <><CheckCircle size={13} /> Requested</> : 'Request Validation'}
                  </button>
                </div>
                <div className="card">
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <FileText size={14} style={{ color: 'var(--warning)' }} />{t('consent')}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 12 }}>I consent to treatment and data processing by MEDFLOW Hospital.</div>
                  <button className={`btn w-full ${consentSigned ? 'btn-success' : 'btn-primary'}`}
                    style={{ justifyContent: 'center' }} onClick={() => { setConsentSigned(true); toast.success(t('consentSigned')); }} disabled={consentSigned}>
                    {consentSigned ? <><CheckCircle size={13} /> Signed</> : 'Sign Consent'}
                  </button>
                </div>
              </div>
            </div>
          )}


          {/* ── TAB: FAMILY ── */}
          {activeTab === 'family' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

              {/* Share status */}
              <div className="card" style={{ border: '1px solid var(--accent)' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Share2 size={14} style={{ color: 'var(--accent-light)' }} />{t('shareStatus')}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 14 }}>
                  Share this code with family members so they can view your queue status from their device.
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ flex: 1, background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8,
                    padding: '12px 16px', fontFamily: 'JetBrains Mono, monospace', fontSize: 20, fontWeight: 800,
                    color: 'var(--accent-light)', letterSpacing: 3, textAlign: 'center' }}>
                    {shareCode}
                  </div>
                  <button className={`btn ${codeCopied ? 'btn-success' : 'btn-primary'}`} onClick={handleCopyCode} style={{ padding: '12px 16px' }}>
                    {codeCopied ? <><CheckCircle size={14} /> {t('copied')}</> : <><Copy size={14} /> {t('copyCode')}</>}
                  </button>
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 10 }}>
                  Family members can enter this code at the Patient Portal to view live status updates.
                </div>
              </div>

              {/* Family waiting room check-in */}
              <div className="card">
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <UserPlus size={14} style={{ color: 'var(--success)' }} />{t('familyCheckin')}
                </div>
                {!familyCheckedIn ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                      <div className="form-group">
                        <label className="form-label">{t('familyName')}</label>
                        <input className="form-input" value={familyName} onChange={e => setFamilyName(e.target.value)} placeholder="e.g. Jane Smith" />
                      </div>
                      <div className="form-group">
                        <label className="form-label">{t('familyRelation')}</label>
                        <select className="form-select" value={familyRelation} onChange={e => setFamilyRelation(e.target.value)}>
                          <option value="">Select...</option>
                          {['Spouse','Parent','Child','Sibling','Friend','Other'].map(r => <option key={r}>{r}</option>)}
                        </select>
                      </div>
                    </div>
                    <button className="btn btn-primary" style={{ justifyContent: 'center' }}
                      onClick={handleFamilyCheckin} disabled={!familyName.trim()}>
                      <UserPlus size={14} /> {t('checkin')}
                    </button>
                  </div>
                ) : (
                  <div style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid var(--success)', borderRadius: 8, padding: 14, display: 'flex', alignItems: 'center', gap: 10 }}>
                    <CheckCircle size={18} style={{ color: 'var(--success)' }} />
                    <div>
                      <div style={{ fontWeight: 700, color: 'var(--success)' }}>{familyName} is checked in</div>
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                        {familyRelation} · Waiting room registered · Staff have been notified
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Family info */}
              <div className="card">
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 10 }}>For Family Members</div>
                {[
                  { icon: '📍', text: 'Waiting room is located on the ground floor, left of the main entrance.' },
                  { icon: '☕', text: 'Cafeteria is open 24/7 on Level 2.' },
                  { icon: '📵', text: 'Please keep phones on silent in clinical areas.' },
                  { icon: '🔔', text: 'Staff will notify you when the patient is ready for visitors.' },
                ].map((item, i) => (
                  <div key={i} style={{ display: 'flex', gap: 10, padding: '8px 0', borderBottom: i < 3 ? '1px solid var(--border)' : 'none' }}>
                    <span style={{ fontSize: 16 }}>{item.icon}</span>
                    <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{item.text}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      )}
    </div>
  );
};

export default PatientPortal;
