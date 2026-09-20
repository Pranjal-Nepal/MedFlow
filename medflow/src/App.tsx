// ─── MEDFLOW App Root ─────────────────────────────────────────────────────────

import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { useMedFlow } from './store';
import Navbar from './components/Navbar';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import Workbench from './pages/Workbench';
import EMSPage from './pages/EMSPage';
import SentinelPage from './pages/SentinelPage';
import PatientPortal from './pages/PatientPortal';
import NurseTriage from './pages/NurseTriage';
import LoginPage from './pages/LoginPage';
import './index.css';

const AppShell: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { role } = useMedFlow();
  // Patient role gets no sidebar — just the main content
  if (role === 'patient') {
    return (
      <div className="app-shell">
        <Navbar />
        <div className="app-body">
          <main className="main-content">{children}</main>
        </div>
      </div>
    );
  }
  return (
    <div className="app-shell">
      <Navbar />
      <div className="app-body">
        <Sidebar />
        <main className="main-content">{children}</main>
      </div>
    </div>
  );
};

const App: React.FC = () => {
  const { darkMode, tickClock, tickWaitTimes, tickAmbulances, role } = useMedFlow();

  // Apply theme class to root
  useEffect(() => {
    document.documentElement.className = darkMode ? '' : 'light-mode';
  }, [darkMode]);

  // Simulation ticks
  useEffect(() => {
    const clockTick = setInterval(tickClock, 1000);          // sim clock: 1s = 1 sim-min
    const waitTick  = setInterval(tickWaitTimes, 30000);     // wait times: every 30s
    const emsTick   = setInterval(tickAmbulances, 1000);     // EMS countdown: every 1s
    return () => { clearInterval(clockTick); clearInterval(waitTick); clearInterval(emsTick); };
  }, [tickClock, tickWaitTimes, tickAmbulances]);

  return (
    <BrowserRouter>
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: 'var(--bg-card)',
            color: 'var(--text-primary)',
            border: '1px solid var(--border)',
            fontSize: '13px',
            maxWidth: '420px',
          },
          error: { style: { borderColor: 'var(--danger)', boxShadow: '0 0 12px rgba(239,68,68,0.3)' } },
          success: { style: { borderColor: 'var(--success)' } },
        }}
      />
      <Routes>
        {/* Login – no shell */}
        <Route path="/login" element={<LoginPage />} />

        {/* Director + Clinical: full access */}
        <Route path="/" element={
          <AppShell>
            {!role ? <Navigate to="/login" replace /> : role === 'patient' ? <Navigate to="/portal" replace /> : <Dashboard />}
          </AppShell>
        } />
        <Route path="/workbench" element={
          <AppShell>
            {!role ? <Navigate to="/login" replace /> : role === 'patient' ? <Navigate to="/portal" replace /> : <Workbench />}
          </AppShell>
        } />
        <Route path="/ems" element={
          <AppShell>
            {!role ? <Navigate to="/login" replace /> : role === 'patient' ? <Navigate to="/portal" replace /> : <EMSPage />}
          </AppShell>
        } />
        <Route path="/sentinel" element={
          <AppShell>
            {!role ? <Navigate to="/login" replace /> : role === 'patient' ? <Navigate to="/portal" replace /> : <SentinelPage />}
          </AppShell>
        } />

        {/* Clinical + Director: nurse triage intake */}
        <Route path="/nurse-triage" element={
          <AppShell>
            {!role ? <Navigate to="/login" replace /> : role === 'patient' ? <Navigate to="/portal" replace /> : <NurseTriage />}
          </AppShell>
        } />

        {/* All roles: patient portal */}
        <Route path="/portal" element={
          <AppShell>
            {!role ? <Navigate to="/login" replace /> : <PatientPortal />}
          </AppShell>
        } />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
};

export default App;
