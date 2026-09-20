// ─── MEDFLOW App Root ─────────────────────────────────────────────────────────

import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { useMedFlow } from './store';
import { isPortalRole } from './auth';
import Navbar from './components/Navbar';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import Workbench from './pages/Workbench';
import EMSPage from './pages/EMSPage';
import SentinelPage from './pages/SentinelPage';
import PatientPortal from './pages/PatientPortal';
import NurseTriage from './pages/NurseTriage';
import DoctorTriage from './pages/DoctorTriage';
import LoginPage from './pages/LoginPage';
import './index.css';

const AppShell: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { role } = useMedFlow();
  // Patient and family sessions get no clinical sidebar — just the main content
  if (isPortalRole(role)) {
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

/** Clinical console route — staff sessions only. */
const StaffRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { role } = useMedFlow();
  if (!role) return <Navigate to="/login" replace />;
  if (isPortalRole(role)) return <Navigate to="/portal" replace />;
  return <AppShell>{children}</AppShell>;
};

/**
 * Portal route. A patient or family session must carry the id of the record it
 * is bound to; without one there is nothing legitimate to show, so it goes back
 * to sign-in rather than falling through to a browsable patient list.
 */
const PortalRoute: React.FC = () => {
  const { role, authedPatientId } = useMedFlow();
  if (!role) return <Navigate to="/login" replace />;
  if (isPortalRole(role) && !authedPatientId) return <Navigate to="/login" replace />;
  return (
    <AppShell>
      <PatientPortal />
    </AppShell>
  );
};

/** Sends an already-authenticated session straight to the screen it may use. */
const LoginRoute: React.FC = () => {
  const { role, authedPatientId } = useMedFlow();
  if (!role) return <LoginPage />;
  if (isPortalRole(role)) {
    return authedPatientId ? <Navigate to="/portal" replace /> : <LoginPage />;
  }
  return <Navigate to="/" replace />;
};

const App: React.FC = () => {
  const { darkMode, tickClock, tickWaitTimes, tickAmbulances } = useMedFlow();

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
        <Route path="/login" element={<LoginRoute />} />

        {/* Clinical console: director + clinical staff only */}
        <Route path="/" element={<StaffRoute><Dashboard /></StaffRoute>} />
        <Route path="/workbench" element={<StaffRoute><Workbench /></StaffRoute>} />
        <Route path="/ems" element={<StaffRoute><EMSPage /></StaffRoute>} />
        <Route path="/sentinel" element={<StaffRoute><SentinelPage /></StaffRoute>} />
        <Route path="/nurse-triage" element={<StaffRoute><NurseTriage /></StaffRoute>} />
        <Route path="/doctor-triage" element={<StaffRoute><DoctorTriage /></StaffRoute>} />

        {/* Patient portal: bound patient/family sessions, plus a read-only staff view */}
        <Route path="/portal" element={<PortalRoute />} />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
};

export default App;
