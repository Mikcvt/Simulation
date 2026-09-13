# Case B: Library Borrowing Desk - Discrete Event Simulation

**Modelling and Simulation — Midterm Activity: Simulation Model V1**  
**Group 3:** Alberto, Cervantes (Miko), Combes, Estanislao, Fernandez, General, Magistrado, Martin, San Luis, Torrecampo

---

## 📁 Organized Folder Contents (`simulation/`)

All files needed for the project are organized in this `simulation` directory:

| File | Purpose |
| :--- | :--- |
| **`index.html`** | The complete interactive visual UI / 2D animation simulation web application. |
| **`app.js`** | Discrete event simulation engine, FCFS multi-server queuing logic, live charts & rendering. |
| **`style.css`** | Modern glassmorphic dark-mode UI styling and animations. |
| **`run_app.py`** | One-click Python script to launch the visual simulation in your browser. |
| **`Cervantes.py`** | The core SimPy discrete-event simulation Python script. |

---

## 🚀 How to Run

### Method 1: Launch the Interactive Visual UI (Recommended)
You can launch the visual application in two simple ways:

1. **Using Python**:
   ```bash
   python c:\Users\cerva\Downloads\simulation\run_app.py
   ```
   This starts a local server and opens the interactive dashboard in your browser.

2. **Or Directly**:
   Double-click `index.html` in the `simulation` folder to open it directly in your browser.

---

### Method 2: Run the Original SimPy CLI Script
```bash
python c:\Users\cerva\Downloads\simulation\Cervantes.py
```

Output:
```text
=======================================================
      LIBRARY BORROWING DESK SIMULATION RESULTS       
=======================================================
Total Operating Duration  : 480 minutes (8.0 hours)
Total Completed Visits    : 157 students
  - Borrow Transactions   : 112 (71.3%)
  - Return Transactions   : 45 (28.7%)
-------------------------------------------------------
Average Waiting Time      : 14.69 minutes
Maximum Waiting Time      : 52.93 minutes
Maximum Queue Length      : 19 students
Average Queue Length      : 4.56 students
Staff Utilization Rate    : 78.76%
=======================================================
```

---

## 🌟 Visual UI/UX Features

- **2D Animated Simulation Stage**:
  - **Entrance Gate**: Animated student arrivals.
  - **FCFS Queue Line**: Avatars with student IDs, transaction icons (📘 *Borrow* or 🔄 *Return*), and color-coded wait duration badges.
  - **Circulation Desks (Desk 1 & Desk 2)**: Real-time status (`AVAILABLE` vs `PROCESSING`), student being served, and countdown progress bars.
  - **Exit Gate**: Happy student departures upon service completion.
- **Real-Time Digital Clock**: Displays shift hours from **09:00 AM to 05:00 PM** (0 to 480 minutes) with a dynamic **⚡ PEAK RUSH HOURS (120m – 300m)** indicator badge.
- **Speed & Playback Controls**: Play, Pause, Step forward (+2m), Reset, and a Speed Multiplier slider (1x up to 50x) plus **Instant Finish** button.
- **Live Metric KPI Dashboard**:
  - Completed Visits (Borrow vs Return counts and percentages).
  - Current Queue Length & Peak Maximum Queue Length.
  - Average Wait Time & Longest Wait Time recorded.
  - Time-Weighted Average Queue Length (area-under-curve).
  - Staff Utilization Rate (%) and individual staff workloads.
- **Live Dynamic Charts**:
  - Real-time Queue Length timeline with the peak rush hour zone (120–300 min) highlighted.
  - Wait Time distribution histogram.
- **Scenario Parameter Tuning (What-If Analysis)**:
  - Modify staff count (1 to 5), service times, transaction split %, arrival rates, and random seed.
  - "Reset Defaults" restores the baseline Case B parameters.
- **Event Feed & Export**:
  - Real-time discrete event feed.
  - "Export Report" button for class presentations and PDF reports.
