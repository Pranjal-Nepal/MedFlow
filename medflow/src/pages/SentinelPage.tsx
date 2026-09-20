// ─── Page 4: Sentinel AI Operations Hub & Audit Ledger ───────────────────────

import React, { useState, useRef, useEffect } from 'react';
import { Bot, Send, Shield, Clock, Filter } from 'lucide-react';
import { useMedFlow } from '../store';
import { AuditEventType } from '../types';

const TYPE_COLORS: Record<AuditEventType, string> = {
  TRIAGE:    'var(--accent-light)',
  BED_ALLOC: 'var(--success)',
  THRESHOLD: 'var(--warning)',
  DIVERSION: 'var(--danger)',
  SURGE:     'var(--danger)',
  FAILURE:   'var(--warning)',
  DISCHARGE: 'var(--success)',
  AI_ACTION: 'var(--cyan)',
};

const SentinelPage: React.FC = () => {
  const { chatMessages, sendChat, auditLog } = useMedFlow();
  const [input, setInput] = useState('');
  const [filter, setFilter] = useState<AuditEventType | 'ALL'>('ALL');
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [chatMessages]);

  const handleSend = () => {
    if (!input.trim()) return;
    sendChat(input.trim());
    setInput('');
  };

  const filteredLog = filter === 'ALL' ? auditLog : auditLog.filter(e => e.type === filter);

  const QUICK_PROMPTS = [
    'What is the current ICU capacity status?',
    'Which patients need immediate triage attention?',
    'Should we activate regional diversion?',
    'What is the nurse-to-patient ratio?',
    'Ventilator availability analysis',
  ];

  return (
    <div className="flex-col gap-20">
      <div className="page-title"><Bot size={20} />Sentinel AI Operations Hub</div>

      <div className="grid-2">
        {/* AI Chat */}
        <div className="card card-accent">
          <div className="section-title mb-12">
            <Bot size={14} />
            Autonomous Clinical Dispatcher
            <span className="tag tag-success" style={{ marginLeft: 8 }}>ONLINE</span>
          </div>

          <div className="chat-wrap">
            <div className="chat-messages">
              {chatMessages.map(msg => (
                <div key={msg.id} className={`chat-bubble ${msg.role}`}>
                  {msg.role === 'ai' && (
                    <div style={{ fontSize: 10, color: 'var(--cyan)', marginBottom: 4, fontWeight: 700 }}>
                      SENTINEL AI · {new Date(msg.timestamp).toLocaleTimeString()}
                    </div>
                  )}
                  {msg.content}
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>
            <div className="chat-input-row">
              <input
                className="chat-input"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSend()}
                placeholder="Ask about capacity, triage, staffing, diversion..."
              />
              <button className="btn btn-primary" onClick={handleSend}><Send size={14} /></button>
            </div>
          </div>

          {/* Quick prompts */}
          <div className="mt-12">
            <div className="text-xs text-muted mb-8">Quick Prompts:</div>
            <div className="flex-col gap-4">
              {QUICK_PROMPTS.map(p => (
                <button key={p} className="btn btn-ghost btn-sm" style={{ justifyContent: 'flex-start', fontSize: 11 }} onClick={() => { setInput(p); }}>
                  {p}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Audit Ledger */}
        <div className="card">
          <div className="section-header">
            <div className="section-title"><Shield size={14} />Immutable Audit Ledger</div>
            <span className="tag tag-info">{auditLog.length} events</span>
          </div>

          {/* Filter */}
          <div className="flex gap-6 mb-12" style={{ flexWrap: 'wrap' }}>
            {(['ALL', 'TRIAGE', 'BED_ALLOC', 'THRESHOLD', 'DIVERSION', 'SURGE', 'FAILURE', 'AI_ACTION'] as const).map(t => (
              <button
                key={t}
                className={`btn btn-sm ${filter === t ? 'btn-primary' : 'btn-ghost'}`}
                style={{ fontSize: 10, padding: '3px 8px' }}
                onClick={() => setFilter(t)}
              >
                {t}
              </button>
            ))}
          </div>

          <div style={{ maxHeight: 480, overflowY: 'auto' }}>
            {filteredLog.map(event => (
              <div key={event.id} className="audit-item">
                <div className={`audit-dot ${event.severity}`} />
                <div className="flex-col gap-4" style={{ flex: 1 }}>
                  <div className="flex items-center gap-8">
                    <span className="tag" style={{ background: 'rgba(37,99,235,0.1)', color: TYPE_COLORS[event.type], fontSize: 9, padding: '1px 6px' }}>
                      {event.type}
                    </span>
                    <span className="audit-time">{new Date(event.timestamp).toLocaleTimeString()}</span>
                    <span className="audit-actor">· {event.actor}</span>
                  </div>
                  <div className="audit-msg">{event.message}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SentinelPage;
