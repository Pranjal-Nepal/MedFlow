# MEDFLOW — Hospital Operations Command Platform
> **Prioritize Patients. Optimize Resources.**

---

## 📌 Project Overview

In high-volume emergency departments, static triage rules and simple First-Come, First-Served (FCFS) queues create dangerous operational bottlenecks. Misaligned bed allocation, unexpected ambulance surges, and hidden clinical deterioration lead to prolonged wait times and compromised care.

**MEDFLOW** is an end-to-end Hospital Resource Management & Operational Simulator designed to balance clinical urgency with dynamic capacity constraints. By integrating real-time telemetry, a multi-objective mathematical ranking engine, inbound EMS radar tracking, an autonomous clinical AI supervisor, and transparent patient communication, MEDFLOW transforms hospital logistics into a synchronized, life-saving command center.

---

## 🏆 Hackathon Scope & Problem Statement Alignment

MEDFLOW was developed to address the core requirements and bonus criteria of the Hospital Resource Management challenge:

### Core Requirements Met:
* **Multi-Acuity Patient Representation:** Built-in ESI (Emergency Severity Index) triage model (ESI 1 through 5).
* **Dynamic Patient Queue:** Continuous real-time queue ranking based on mathematical scoring rather than static arrival order.
* **Hospital Resource Telemetry:** Live tracking of Acute ER Bays, ICU Critical Beds, Operating Theatres, Physicians, Nurses, Ventilators, and CT Scanners.
* **Intelligent Resource Allocation:** Direct assignment of beds, physicians, and care plans without data races or double-booking.
* **Wait-Time & Deterioration Aging:** Mathematical compensation that prevents lower-acuity starvation while auto-escalating unstable vitals.
* **Conflict Prevention & Capacity Limits:** Built-in threshold guards that warn operators when departments approach saturation.
* **Resource Utilization Analytics:** Real-time percentage occupancy, intake-vs-discharge time-series graphs, and telemetry headroom bars.

### Bonus Features Implemented:
* **Emergency Surge & Inbound EMS Fleet Simulation:** Live regional radar tracking inbound ambulances with estimated arrival waves.
* **Dynamic Staff Shortage & Bed Bottlenecks:** Real-time load warnings (e.g., ICU High Load triggers).
* **Strategy Switchboard:** Instant benchmarking between Dynamic Multi-Objective, Urgency-Only, Capacity-Preserving, and FCFS policies.
* **Sentinel AI Assistant:** Conversational dispatcher providing capacity analysis and diversion protocol recommendations.
* **Immutable Audit Ledger:** Auditable compliance ledger capturing every login, triage event, allocation, and threshold crossing.
* **Patient & Family Transparency Portal:** Dedicated, secure portal reducing waiting-room panic with live wait times and queue position telemetry.

---

## 🧮 Mathematical Engine & Formulation

Traditional triage suffers from two extremes:
1. **Urgency-Only:** Lower-acuity patients suffer indefinite starvation.
2. **First-Come, First-Served (FCFS):** High-acuity trauma cases wait behind non-emergent complaints.

MEDFLOW implements a **Dynamic Multi-Objective Objective Function**:

$$S_i = w_u \cdot U_i + w_w \cdot \ln(1 + t_w) - w_r \cdot C_r + 15 \cdot \sigma(Z_{risk})$$

### Component Breakdown:
* **$U_i$ (Clinical Urgency):** Base acuity score derived from standardized ESI triage parameters ($1 = \text{Resuscitation}$, $5 = \text{Non-Urgent}$).
* **$\ln(1 + t_w)$ (Wait Aging):** A logarithmic wait penalty. As wait time ($t_w$ in minutes) increases, stable patients climb the queue smoothly without abruptly leapfrogging acute cardiac or trauma arrivals.
* **$C_r$ (Resource Scarcity Penalty):** Calculated as $\frac{\text{Occupied Resources}}{\text{Total Resources}}$. Discourages pipeline deadlock when critical units (such as ICU beds) are near saturation.
* **$\sigma(Z_{risk})$ (Nonlinear Deterioration Sigmoid):**
  $$\sigma(Z) = \frac{1}{1 + e^{-4 \cdot (Z - 0.5)}}$$
  Where $Z_{risk} \in [0, 1]$ represents composite physiological instability (e.g., dropping $\text{SpO}_2$, erratic heart rate). When vitals cross clinical thresholds, the sigmoid spikes priority rapidly to trigger immediate resuscitation workflows.

---

## 🏗️ Architecture & Technical Stack

### Frontend & Interface:
* **React / Next.js / TypeScript:** Modern responsive user interface with role-based routing.
* **Tailwind CSS:** Clean, medical-grade UI styling with color-coded status badges and indicators.
* **Lucide React:** Clinical and operational iconography.
* **Recharts / Charting Libraries:** Time-series telemetry graphs for intake vs. discharge and headroom utilization.

### Simulation & Logic Engine:
* **Simulation Core:** Discrete-event simulation tracking clock progression, inbound ambulances, and vital sign degradation.
* **State Management:** Reactive local/central store maintaining synchronized status across clinical, administrative, and patient views.
* **Multi-Role Access Control (RBAC):**
  * `Operations Director`: Full administrative analytics, capacity overviews, and policy switchboards.
  * `Clinical / Triage (Nurse & Doctor)`: Patient intake, vitals evaluation, room assignment, and disposition orders.
  * `Patient & Family`: Privacy-bound view displaying only personal status, queue standing, and wait times.

---

## 📂 Key Platform Routes

* `/` — Sign-in Gateway with Role-Based Authentication
* `/operations` (`localhost:3005`) — Operations Command Dashboard & Live Resource Telemetry
* `/workbench` — Data Workbench, Coefficient Sliders, and Step-by-Step Formula Breakdown
* `/nurse-triage` — Nurse Intake Portal with Automated Vital Scoring & ESI Suggestions
* `/doctor-triage` — Doctor Allocation, Queue Assignment, Disposition, and Order Sets
* `/ems` — Inbound EMS Fleet Telemetry & Regional Dispatch Radar
* `/sentinel` — Autonomous AI Clinical Dispatcher & Immutable Audit Ledger
* `/portal` — Patient & Family Real-Time Care Telemetry

---

## 🚀 Installation & Local Setup

### Prerequisites:
* **Node.js** (v18.x or higher recommended)
* **npm**, **yarn**, or **pnpm**
* **Git**

📜 Open Source Libraries & Credits
We extend sincere gratitude to the maintainers of the following open-source libraries and frameworks used in building MEDFLOW:

React: The library for web and native user interfaces.

Next.js: The React Framework for the Web by Vercel.

Tailwind CSS: A utility-first CSS framework for rapid UI development.

Lucide Icons: Beautiful & consistent icon toolkit.

Recharts: Redefined chart library built with React and P3.

clsx & tailwind-merge: Efficient utility helpers for conditional CSS class composition.
