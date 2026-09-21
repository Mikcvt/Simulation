/**
 * Case B - Library Borrowing Desk Simulation Engine & Controller
 * Group 3: Cervantes, Miko et al.
 * Modelling and Simulation - Midterm Activity V1
 */

// ==========================================
// 1. SEEDED RANDOM NUMBER GENERATOR (Mulberry32)
// ==========================================
class SeededRNG {
    constructor(seed = 42) {
        this.setSeed(seed);
    }

    setSeed(seed) {
        this.seed = Math.floor(Math.abs(seed)) || 1;
    }

    // Returns float in [0, 1)
    next() {
        let t = (this.seed += 0x6D2B79F5);
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }

    // Exponential distribution with mean (same as random.expovariate(1.0 / mean))
    exponential(mean) {
        const u = Math.max(1e-12, 1.0 - this.next());
        return -Math.log(u) * mean;
    }
}

// ==========================================
// 2. DISCRETE EVENT SIMULATION GENERATOR
// ==========================================
class LibrarySimulation {
    constructor(params = {}) {
        this.params = {
            seed: 42,
            numStaff: 2,
            simTime: 480,
            meanBorrowTime: 5.0,
            meanReturnTime: 2.0,
            probBorrow: 0.70,
            peakStart: 120,
            peakEnd: 300,
            peakArrivalMean: 2.0,
            offpeakArrivalMean: 5.0,
            ...params
        };

        this.rng = new SeededRNG(this.params.seed);
        this.reset();
    }

    getInterarrivalMean(time) {
        if (time >= this.params.peakStart && time < this.params.peakEnd) {
            return this.params.peakArrivalMean;
        }
        return this.params.offpeakArrivalMean;
    }

    reset() {
        this.rng.setSeed(this.params.seed);
        this.currentTime = 0;
        this.students = [];
        this.events = []; // Detailed event timeline
        this.queueHistory = [{ time: 0, length: 0 }];
        this.completedBorrow = 0;
        this.completedReturn = 0;
        this.waitTimes = [];
        this.serviceTimes = [];
        this.totalServerBusyTime = 0;
        this.staffStats = Array.from({ length: this.params.numStaff }, (_, i) => ({
            id: i + 1,
            busyTime: 0,
            servedCount: 0,
            currentStudent: null
        }));

        this.generateFullSimulation();
    }

    generateFullSimulation() {
        // Step 1: Pre-generate all arrivals up to simTime
        let simClock = 0;
        let studentId = 1;
        const arrivals = [];

        while (simClock < this.params.simTime) {
            const iatMean = this.getInterarrivalMean(simClock);
            const iat = this.rng.exponential(iatMean);
            simClock += iat;
            if (simClock > this.params.simTime) break;

            const isBorrow = this.rng.next() < this.params.probBorrow;
            const serviceMean = isBorrow ? this.params.meanBorrowTime : this.params.meanReturnTime;
            const serviceDuration = this.rng.exponential(serviceMean);

            arrivals.push({
                id: studentId++,
                arrivalTime: simClock,
                type: isBorrow ? 'Borrow' : 'Return',
                serviceDuration: serviceDuration,
                waitTime: 0,
                serviceStartTime: null,
                departureTime: null,
                staffId: null
            });
        }

        // Step 2: Simulate multi-server FCFS queue execution
        // Priority queue for staff availability [ { staffId, freeAt } ]
        const staffList = Array.from({ length: this.params.numStaff }, (_, i) => ({
            staffId: i + 1,
            freeAt: 0,
            busyTime: 0,
            servedCount: 0
        }));

        const queueTimeline = [{ time: 0, length: 0 }];
        const activeQueue = []; // currently in line
        let arrivalIdx = 0;

        // Collect all distinct discrete event timestamps to build accurate timeline
        // Events: ARRIVAL, SERVICE_START, SERVICE_END
        const allEvents = [];
        arrivals.forEach(st => {
            allEvents.push({ type: 'ARRIVAL', time: st.arrivalTime, student: st });
        });

        // Compute service starts and departures
        const computedStudents = [];
        const queueWaitingList = [];

        // Track when each staff becomes free
        const staffAvailableAt = Array(this.params.numStaff).fill(0);

        arrivals.forEach(student => {
            // Find earliest available staff member
            let earliestStaffIdx = 0;
            for (let i = 1; i < this.params.numStaff; i++) {
                if (staffAvailableAt[i] < staffAvailableAt[earliestStaffIdx]) {
                    earliestStaffIdx = i;
                }
            }

            const staffId = earliestStaffIdx + 1;
            const serviceStart = Math.max(student.arrivalTime, staffAvailableAt[earliestStaffIdx]);
            const waitTime = serviceStart - student.arrivalTime;
            const departureTime = serviceStart + student.serviceDuration;

            student.staffId = staffId;
            student.waitTime = waitTime;
            student.serviceStartTime = serviceStart;
            student.departureTime = departureTime;

            staffAvailableAt[earliestStaffIdx] = departureTime;
            staffList[earliestStaffIdx].busyTime += student.serviceDuration;
            staffList[earliestStaffIdx].servedCount += 1;

            computedStudents.push(student);

            // Record events
            allEvents.push({ type: 'SERVICE_START', time: serviceStart, student, staffId });
            allEvents.push({ type: 'SERVICE_END', time: departureTime, student, staffId });
        });

        // Sort all events chronologically
        allEvents.sort((a, b) => a.time - b.time);

        // Build accurate queue length timeline
        let currentQueueCount = 0;
        const recordedQueueEvents = [];
        allEvents.forEach(evt => {
            if (evt.time > this.params.simTime) return;
            if (evt.type === 'ARRIVAL') {
                currentQueueCount++;
                recordedQueueEvents.push({ time: evt.time, length: currentQueueCount, event: evt });
            } else if (evt.type === 'SERVICE_START') {
                currentQueueCount = Math.max(0, currentQueueCount - 1);
                recordedQueueEvents.push({ time: evt.time, length: currentQueueCount, event: evt });
            }
        });

        this.students = computedStudents;
        this.allEvents = allEvents;
        this.queueEvents = recordedQueueEvents;
        this.staffList = staffList;
    }

    // State at any time T (0 <= T <= simTime)
    getStateAt(time) {
        const t = Math.min(time, this.params.simTime);

        // Arrived so far
        const arrived = this.students.filter(s => s.arrivalTime <= t);
        // Waiting in queue: arrived, but service has not started yet
        const inQueue = this.students.filter(s => s.arrivalTime <= t && s.serviceStartTime > t);
        // Currently in service: service started <= t and departure > t
        const inService = this.students.filter(s => s.serviceStartTime <= t && s.departureTime > t);
        // Completed: departure <= t
        const completed = this.students.filter(s => s.departureTime <= t);

        // Completed borrow & return
        const completedBorrow = completed.filter(s => s.type === 'Borrow').length;
        const completedReturn = completed.filter(s => s.type === 'Return').length;

        // Wait times of completed students or all who started service
        const started = this.students.filter(s => s.serviceStartTime <= t);
        const waitTimes = started.map(s => s.waitTime);
        const avgWait = waitTimes.length > 0 ? (waitTimes.reduce((a, b) => a + b, 0) / waitTimes.length) : 0;
        const maxWait = waitTimes.length > 0 ? Math.max(...waitTimes) : 0;

        // Current queue length
        const currentQueueLen = inQueue.length;

        // Max queue length observed up to t
        const queueEventsUpToT = this.queueEvents.filter(e => e.time <= t);
        let maxQueueLen = 0;
        queueEventsUpToT.forEach(e => {
            if (e.length > maxQueueLen) maxQueueLen = e.length;
        });

        // Time-weighted average queue length up to t
        let timeWeightedQueue = 0;
        if (t > 0 && queueEventsUpToT.length > 0) {
            let area = 0;
            for (let i = 0; i < queueEventsUpToT.length - 1; i++) {
                const dt = queueEventsUpToT[i + 1].time - queueEventsUpToT[i].time;
                area += queueEventsUpToT[i].length * dt;
            }
            const lastEvt = queueEventsUpToT[queueEventsUpToT.length - 1];
            area += lastEvt.length * (t - lastEvt.time);
            timeWeightedQueue = area / t;
        }

        // Staff stats at time t
        const staffStatus = Array.from({ length: this.params.numStaff }, (_, i) => {
            const staffId = i + 1;
            const currentServing = inService.find(s => s.staffId === staffId) || null;
            
            // Calculate total busy time for this staff up to t
            let busyTime = 0;
            this.students.filter(s => s.staffId === staffId && s.serviceStartTime <= t).forEach(s => {
                const start = s.serviceStartTime;
                const end = Math.min(t, s.departureTime);
                if (end > start) {
                    busyTime += (end - start);
                }
            });

            const utilization = t > 0 ? (busyTime / t) * 100 : 0;

            return {
                staffId,
                isBusy: !!currentServing,
                currentStudent: currentServing,
                busyTime,
                utilization: Math.min(100, utilization),
                completedCount: completed.filter(s => s.staffId === staffId).length
            };
        });

        const totalBusy = staffStatus.reduce((acc, s) => acc + s.busyTime, 0);
        const overallUtilization = (t > 0 && this.params.numStaff > 0) ? 
            Math.min(100, (totalBusy / (this.params.numStaff * t)) * 100) : 0;

        // Recent events up to time t
        const recentEvents = this.allEvents
            .filter(e => e.time <= t)
            .slice(-30)
            .reverse();

        return {
            time: t,
            isPeak: t >= this.params.peakStart && t < this.params.peakEnd,
            arrivedCount: arrived.length,
            inQueue,
            inService,
            completedCount: completed.length,
            completedBorrow,
            completedReturn,
            currentQueueLen,
            maxQueueLen,
            avgWait,
            maxWait,
            timeWeightedQueue,
            staffStatus,
            overallUtilization,
            recentEvents
        };
    }
}

// ==========================================
// 3. UI CONTROLLER & VISUALIZATION
// ==========================================
class UIController {
    constructor() {
        this.sim = new LibrarySimulation();
        this.currentTime = 0;
        this.isPlaying = false;
        this.hasStarted = false;
        this.speed = 5; // Sim minutes per real second
        this.lastFrameTimestamp = null;
        this.animationFrameId = null;

        this.initDOM();
        this.attachEventListeners();
        this.render();
    }

    initDOM() {
        // Control elements
        this.btnPlay = document.getElementById('btnPlay');
        this.btnPause = document.getElementById('btnPause');
        this.btnStep = document.getElementById('btnStep');
        this.btnReset = document.getElementById('btnReset');
        this.btnInstant = document.getElementById('btnInstant');
        this.speedSlider = document.getElementById('speedSlider');
        this.speedDisplay = document.getElementById('speedDisplay');
        this.timelineProgress = document.getElementById('timelineProgress');
        this.clockDisplay = document.getElementById('clockDisplay');
        this.timeMinuteDisplay = document.getElementById('timeMinuteDisplay');
        this.periodBadge = document.getElementById('periodBadge');

        // Stage elements
        this.queueLineContainer = document.getElementById('queueLineContainer');
        this.staffDesksContainer = document.getElementById('staffDesksContainer');
        this.exitContainer = document.getElementById('exitContainer');
        this.queueCountBadge = document.getElementById('queueCountBadge');
        this.arrivalCountBadge = document.getElementById('arrivalCountBadge');
        this.entranceDoorCard = document.getElementById('entranceDoorCard');
        this.doorStatusBadge = document.getElementById('doorStatusBadge');
        this.doorRateBadge = document.getElementById('doorRateBadge');
        this.doorNextArrival = document.getElementById('doorNextArrival');
        this.doorPatronAvatar = document.getElementById('doorPatronAvatar');
        this.entranceContainer = document.getElementById('entranceContainer');
        this.entranceTotalCount = document.getElementById('entranceTotalCount');
        this.entranceTypeBreakdown = document.getElementById('entranceTypeBreakdown');

        // Metric Card elements
        this.kpiCompleted = document.getElementById('kpiCompleted');
        this.kpiBorrowCount = document.getElementById('kpiBorrowCount');
        this.kpiReturnCount = document.getElementById('kpiReturnCount');
        this.kpiQueueCurrent = document.getElementById('kpiQueueCurrent');
        this.kpiQueueMax = document.getElementById('kpiQueueMax');
        this.kpiAvgWait = document.getElementById('kpiAvgWait');
        this.kpiMaxWait = document.getElementById('kpiMaxWait');
        this.kpiAvgQueueTime = document.getElementById('kpiAvgQueueTime');
        this.kpiUtilization = document.getElementById('kpiUtilization');
        this.staffUtilList = document.getElementById('staffUtilList');

        // Event Log element
        this.eventLogList = document.getElementById('eventLogList');

        // Canvas Charts
        this.queueChartCanvas = document.getElementById('queueChartCanvas');
        this.waitChartCanvas = document.getElementById('waitChartCanvas');

        // Settings inputs
        this.inputStaff = document.getElementById('inputStaff');
        this.inputBorrowMean = document.getElementById('inputBorrowMean');
        this.inputReturnMean = document.getElementById('inputReturnMean');
        this.inputProbBorrow = document.getElementById('inputProbBorrow');
        this.inputPeakStart = document.getElementById('inputPeakStart');
        this.inputPeakEnd = document.getElementById('inputPeakEnd');
        this.inputPeakMean = document.getElementById('inputPeakMean');
        this.inputOffpeakMean = document.getElementById('inputOffpeakMean');
        this.inputSeed = document.getElementById('inputSeed');
        this.btnApplySettings = document.getElementById('btnApplySettings');
        this.btnDefaultSettings = document.getElementById('btnDefaultSettings');
    }

    attachEventListeners() {
        this.btnPlay.addEventListener('click', () => this.play());
        this.btnPause.addEventListener('click', () => this.pause());
        this.btnStep.addEventListener('click', () => this.step());
        this.btnReset.addEventListener('click', () => this.reset());
        this.btnInstant.addEventListener('click', () => this.jumpToEnd());

        this.speedSlider.addEventListener('input', (e) => {
            this.speed = parseFloat(e.target.value);
            this.speedDisplay.textContent = `${this.speed}x`;
        });

        this.timelineProgress.addEventListener('input', (e) => {
            this.hasStarted = true;
            this.currentTime = parseFloat(e.target.value);
            this.render();
        });

        this.btnApplySettings.addEventListener('click', () => {
            this.applyCustomSettings();
        });

        this.btnDefaultSettings.addEventListener('click', () => {
            this.restoreDefaultSettings();
        });

        // Window resize re-renders canvas
        window.addEventListener('resize', () => {
            this.renderCharts(this.sim.getStateAt(this.currentTime));
        });
    }

    play() {
        if (this.isPlaying) return;
        this.hasStarted = true;
        this.isPlaying = true;
        this.btnPlay.classList.add('active-btn');
        this.btnPause.classList.remove('active-btn');
        this.lastFrameTimestamp = performance.now();
        this.animationLoop(this.lastFrameTimestamp);
    }

    pause() {
        this.isPlaying = false;
        this.btnPlay.classList.remove('active-btn');
        this.btnPause.classList.add('active-btn');
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
    }

    step() {
        this.pause();
        this.hasStarted = true;
        this.currentTime = Math.min(this.sim.params.simTime, this.currentTime + 2.0);
        this.render();
    }

    reset() {
        this.pause();
        this.hasStarted = false;
        this.currentTime = 0;
        this.sim.reset();
        this.render();
    }

    jumpToEnd() {
        this.pause();
        this.hasStarted = true;
        this.currentTime = this.sim.params.simTime;
        this.render();
    }

    applyCustomSettings() {
        const numStaff = parseInt(this.inputStaff.value, 10) || 2;
        const meanBorrow = parseFloat(this.inputBorrowMean.value) || 5.0;
        const meanReturn = parseFloat(this.inputReturnMean.value) || 2.0;
        const probBorrow = (parseFloat(this.inputProbBorrow.value) || 70) / 100.0;
        const peakStart = Math.max(0, Math.min(479, parseFloat(this.inputPeakStart.value) || 120));
        const peakEnd = Math.max(peakStart + 1, Math.min(480, parseFloat(this.inputPeakEnd.value) || 300));
        const peakMean = parseFloat(this.inputPeakMean.value) || 2.0;
        const offpeakMean = parseFloat(this.inputOffpeakMean.value) || 5.0;
        const seed = parseInt(this.inputSeed.value, 10) || 42;

        this.sim = new LibrarySimulation({
            numStaff,
            meanBorrowTime: meanBorrow,
            meanReturnTime: meanReturn,
            probBorrow,
            peakStart,
            peakEnd,
            peakArrivalMean: peakMean,
            offpeakArrivalMean: offpeakMean,
            seed
        });

        this.reset();
    }

    restoreDefaultSettings() {
        this.inputStaff.value = 2;
        this.inputBorrowMean.value = 5.0;
        this.inputReturnMean.value = 2.0;
        this.inputProbBorrow.value = 70;
        this.inputPeakStart.value = 120;
        this.inputPeakEnd.value = 300;
        this.inputPeakMean.value = 2.0;
        this.inputOffpeakMean.value = 5.0;
        this.inputSeed.value = 42;
        this.applyCustomSettings();
    }

    animationLoop(currentTimestamp) {
        if (!this.isPlaying) return;

        const deltaMs = currentTimestamp - this.lastFrameTimestamp;
        this.lastFrameTimestamp = currentTimestamp;

        // Advance simulation time: speed minutes per real second (1000ms)
        const deltaSimMinutes = (deltaMs / 1000) * this.speed;
        this.currentTime += deltaSimMinutes;

        if (this.currentTime >= this.sim.params.simTime) {
            this.currentTime = this.sim.params.simTime;
            this.render();
            this.pause();
            return;
        }

        this.render();
        this.animationFrameId = requestAnimationFrame((ts) => this.animationLoop(ts));
    }

    formatClock(minutes) {
        // Starts at 09:00 AM
        const totalMinutesFromMidnight = 9 * 60 + minutes;
        const hours = Math.floor(totalMinutesFromMidnight / 60);
        const mins = Math.floor(totalMinutesFromMidnight % 60);
        const ampm = hours >= 12 ? 'PM' : 'AM';
        const displayHours = hours > 12 ? hours - 12 : hours;
        return `${String(displayHours).padStart(2, '0')}:${String(mins).padStart(2, '0')} ${ampm}`;
    }

    render() {
        const state = this.sim.getStateAt(this.currentTime);

        // Update Timeline & Clocks
        this.timelineProgress.value = this.currentTime;
        this.timelineProgress.max = this.sim.params.simTime;
        this.clockDisplay.textContent = this.formatClock(this.currentTime);
        this.timeMinuteDisplay.textContent = `${this.currentTime.toFixed(1)} / ${this.sim.params.simTime} mins`;

        // Update Period Badge
        const peakStartClock = this.formatClock(this.sim.params.peakStart);
        const peakEndClock = this.formatClock(this.sim.params.peakEnd);
        if (state.isPeak) {
            this.periodBadge.className = 'period-badge peak';
            this.periodBadge.innerHTML = `<span class="pulse-dot"></span> ⚡ PEAK RUSH (${peakStartClock} - ${peakEndClock})`;
        } else {
            this.periodBadge.className = 'period-badge offpeak';
            this.periodBadge.innerHTML = `<span class="pulse-dot off"></span> OFF-PEAK (Peak: ${peakStartClock} - ${peakEndClock})`;
        }

        // Update KPI Cards
        this.kpiCompleted.textContent = state.completedCount;
        const borrowPct = state.completedCount > 0 ? ((state.completedBorrow / state.completedCount) * 100).toFixed(1) : '0.0';
        const returnPct = state.completedCount > 0 ? ((state.completedReturn / state.completedCount) * 100).toFixed(1) : '0.0';
        this.kpiBorrowCount.textContent = `📘 Borrow: ${state.completedBorrow} (${borrowPct}%)`;
        this.kpiReturnCount.textContent = `🔄 Return: ${state.completedReturn} (${returnPct}%)`;

        this.kpiQueueCurrent.textContent = state.currentQueueLen;
        this.kpiQueueMax.textContent = `Peak Max: ${state.maxQueueLen} students`;
        this.queueCountBadge.textContent = `${state.currentQueueLen} in line`;

        this.kpiAvgWait.textContent = `${state.avgWait.toFixed(2)} min`;
        this.kpiMaxWait.textContent = `Longest: ${state.maxWait.toFixed(2)} min`;

        this.kpiAvgQueueTime.textContent = `${state.timeWeightedQueue.toFixed(2)} students`;
        this.kpiUtilization.textContent = `${state.overallUtilization.toFixed(1)}%`;

        // Update Staff Utilization List
        this.staffUtilList.innerHTML = state.staffStatus.map(s => `
            <div class="staff-util-item">
                <div class="util-meta">
                    <span>Desk ${s.staffId}</span>
                    <span class="util-pct">${s.utilization.toFixed(1)}% (${s.completedCount} served)</span>
                </div>
                <div class="util-bar-bg">
                    <div class="util-bar-fill" style="width: ${s.utilization}%"></div>
                </div>
            </div>
        `).join('');

        // Render Visual Desks & Queue Avatars
        this.renderStage(state);

        // Render Charts
        this.renderCharts(state);

        // Render Event Logs
        this.renderEventLog(state);
    }

    renderStage(state) {
        // Render Entrance Arrivals
        this.renderEntrance(state);

        // Render Waiting Queue
        if (state.inQueue.length === 0) {
            this.queueLineContainer.innerHTML = '<div class="empty-queue-msg">✨ Queue is clear. No waiting students.</div>';
        } else {
            const maxVisible = 12;
            const visibleQueue = state.inQueue.slice(0, maxVisible);
            const extraCount = state.inQueue.length - maxVisible;

            let html = visibleQueue.map((st, idx) => {
                const waitSoFar = this.currentTime - st.arrivalTime;
                let waitColorClass = 'wait-normal';
                if (waitSoFar > 15) waitColorClass = 'wait-severe';
                else if (waitSoFar > 5) waitColorClass = 'wait-warning';

                return `
                    <div class="student-avatar ${waitColorClass}" title="Student #${st.id} (${st.type}) arrived at ${st.arrivalTime.toFixed(1)}m">
                        <div class="student-bubble">
                            <span class="avatar-icon">${st.type === 'Borrow' ? '📘' : '🔄'}</span>
                            <span class="avatar-id">#${st.id}</span>
                        </div>
                        <div class="student-wait-badge">${waitSoFar.toFixed(1)}m</div>
                    </div>
                `;
            }).join('');

            if (extraCount > 0) {
                html += `<div class="student-avatar extra-avatar">+${extraCount} more</div>`;
            }
            this.queueLineContainer.innerHTML = html;
        }

        // Render Staff Desks
        this.staffDesksContainer.innerHTML = state.staffStatus.map(staff => {
            const isBusy = staff.isBusy && staff.currentStudent;
            const student = staff.currentStudent;

            let progressPct = 0;
            let remainingMins = 0;
            if (isBusy) {
                const elapsed = this.currentTime - student.serviceStartTime;
                progressPct = Math.min(100, Math.max(0, (elapsed / student.serviceDuration) * 100));
                remainingMins = Math.max(0, student.departureTime - this.currentTime);
            }

            return `
                <div class="staff-station ${isBusy ? 'status-busy' : 'status-idle'}">
                    <div class="station-header">
                        <div class="station-title">
                            <span class="desk-icon">🖥️</span>
                            <span>Circulation Desk ${staff.staffId}</span>
                        </div>
                        <span class="station-badge ${isBusy ? 'badge-busy' : 'badge-idle'}">
                            ${isBusy ? 'PROCESSING' : 'AVAILABLE'}
                        </span>
                    </div>

                    <div class="station-body">
                        ${isBusy ? `
                            <div class="serving-student-card">
                                <div class="serving-top">
                                    <span class="trans-pill ${student.type.toLowerCase()}">
                                        ${student.type === 'Borrow' ? '📘 Borrowing' : '🔄 Returning'}
                                    </span>
                                    <span class="serving-id">Student #${student.id}</span>
                                </div>
                                <div class="progress-section">
                                    <div class="progress-bar-bg">
                                        <div class="progress-bar-fill" style="width: ${progressPct}%"></div>
                                    </div>
                                    <div class="progress-labels">
                                        <span>Est. Service: ${student.serviceDuration.toFixed(1)}m</span>
                                        <span>Left: ${remainingMins.toFixed(1)}m</span>
                                    </div>
                                </div>
                            </div>
                        ` : `
                            <div class="idle-placeholder">
                                <span>🟢 Ready to assist students</span>
                            </div>
                        `}
                    </div>

                    <div class="station-footer">
                        <span>Total Served: <strong>${staff.completedCount}</strong></span>
                        <span>Utilization: <strong>${staff.utilization.toFixed(1)}%</strong></span>
                    </div>
                </div>
            `;
        }).join('');

        // Render Departures (last 4 completed)
        const recentDeparted = this.sim.students
            .filter(s => s.departureTime <= this.currentTime)
            .slice(-4)
            .reverse();

        if (recentDeparted.length === 0) {
            this.exitContainer.innerHTML = '<div class="empty-exit">No departures yet.</div>';
        } else {
            this.exitContainer.innerHTML = recentDeparted.map(st => `
                <div class="departed-card">
                    <span class="departed-check">✅</span>
                    <span class="departed-info">#${st.id} (${st.type})</span>
                    <span class="departed-time">${st.departureTime.toFixed(1)}m</span>
                </div>
            `).join('');
        }
    }

    renderEntrance(state) {
        if (!this.entranceContainer) return;

        if (!this.hasStarted) {
            this.arrivalCountBadge.textContent = '0 arrived';
            this.doorStatusBadge.className = 'door-status-badge idle';
            this.doorStatusBadge.textContent = 'Ready to Start';
            this.doorNextArrival.innerHTML = '<span>Press Play to start arrivals</span>';
            this.doorPatronAvatar.classList.add('hidden');
            this.entranceDoorCard.classList.remove('door-active');
            this.entranceContainer.innerHTML = '<div class="empty-entrance">Press Play to begin the simulation.</div>';
            this.entranceTotalCount.textContent = '0';
            this.entranceTypeBreakdown.textContent = 'No arrivals yet';
            return;
        }

        const arrived = this.sim.students.filter(s => s.arrivalTime <= this.currentTime);
        const totalArrived = arrived.length;
        const borrowCount = arrived.filter(s => s.type === 'Borrow').length;
        const returnCount = arrived.filter(s => s.type === 'Return').length;

        // Badge in zone header
        if (this.arrivalCountBadge) {
            this.arrivalCountBadge.textContent = `${totalArrived} arrived`;
        }

        // Rate & Schedule indicator
        const isPeak = this.currentTime >= this.sim.params.peakStart && this.currentTime < this.sim.params.peakEnd;
        if (this.doorRateBadge) {
            if (isPeak) {
                this.doorRateBadge.className = 'door-rate peak';
                this.doorRateBadge.innerHTML = `⚡ Peak Rush: Exp(${this.sim.params.peakArrivalMean.toFixed(1)}m)`;
            } else {
                this.doorRateBadge.className = 'door-rate offpeak';
                this.doorRateBadge.innerHTML = `🌿 Off-Peak: Exp(${this.sim.params.offpeakArrivalMean.toFixed(1)}m)`;
            }
        }

        // Next arrival countdown
        const nextStudent = this.sim.students.find(s => s.arrivalTime > this.currentTime);
        if (this.doorNextArrival) {
            if (nextStudent) {
                const waitToNext = Math.max(0, nextStudent.arrivalTime - this.currentTime);
                this.doorNextArrival.innerHTML = `<span>Next: <strong>#${nextStudent.id}</strong></span> <span>in ${waitToNext.toFixed(1)}m</span>`;
            } else {
                this.doorNextArrival.innerHTML = `<span>Status:</span> <span>🏁 Shift Completed</span>`;
            }
        }

        // Recent arrivals (last 4 arrivals up to currentTime)
        const recentArrivals = arrived.slice(-4).reverse();
        const latest = recentArrivals[0];
        const isRecent = latest && (this.currentTime - latest.arrivalTime) < 1.8;

        // Door status badge & animated patron avatar
        if (this.doorStatusBadge) {
            if (isRecent) {
                this.doorStatusBadge.className = 'door-status-badge arriving';
                this.doorStatusBadge.innerHTML = `🚶 #${latest.id} Entered`;
                if (this.doorPatronAvatar) this.doorPatronAvatar.classList.remove('hidden');
                if (this.entranceDoorCard) this.entranceDoorCard.classList.add('door-active');
            } else {
                this.doorStatusBadge.className = 'door-status-badge idle';
                this.doorStatusBadge.innerHTML = `Doors Open`;
                if (this.doorPatronAvatar) this.doorPatronAvatar.classList.add('hidden');
                if (this.entranceDoorCard) this.entranceDoorCard.classList.remove('door-active');
            }
        }

        // Render the next students scheduled to enter the library.
        const upcomingArrivals = this.sim.students
            .filter(st => st.arrivalTime > this.currentTime)
            .slice(0, 4);

        if (upcomingArrivals.length === 0) {
            this.entranceContainer.innerHTML = '<div class="empty-entrance">🏁 No more scheduled arrivals.</div>';
        } else {
            this.entranceContainer.innerHTML = upcomingArrivals.map((st) => {
                const timeToArrival = st.arrivalTime - this.currentTime;

                return `
                    <div class="arrived-card upcoming-card" title="Student #${st.id} scheduled at ${st.arrivalTime.toFixed(1)}m">
                        <div class="arrived-main">
                            <div class="arrived-details">
                                <div class="arrived-row">
                                    <span class="arrived-id">Student #${st.id}</span>
                                </div>
                                <div class="arrived-dest">Scheduled arrival</div>
                            </div>
                        </div>
                        <div class="arrived-time">in ${timeToArrival.toFixed(1)}m</div>
                    </div>
                `;
            }).join('');
        }

        // Footer summary
        if (this.entranceTotalCount) {
            this.entranceTotalCount.textContent = totalArrived;
        }
        if (this.entranceTypeBreakdown) {
            this.entranceTypeBreakdown.textContent = `📘 ${borrowCount} | 🔄 ${returnCount}`;
        }
    }

    renderCharts(state) {
        this.renderQueueChart();
        this.renderWaitChart();
    }

    renderQueueChart() {
        const canvas = this.queueChartCanvas;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const dpr = window.devicePixelRatio || 1;
        
        // Match display dimensions
        const rect = canvas.getBoundingClientRect();
        if (canvas.width !== rect.width * dpr || canvas.height !== rect.height * dpr) {
            canvas.width = rect.width * dpr;
            canvas.height = rect.height * dpr;
        }

        ctx.save();
        ctx.scale(dpr, dpr);
        const w = rect.width;
        const h = rect.height;

        ctx.clearRect(0, 0, w, h);

        const padLeft = 35;
        const padRight = 15;
        const padTop = 15;
        const padBottom = 25;
        const chartW = w - padLeft - padRight;
        const chartH = h - padTop - padBottom;

        const maxSimTime = this.sim.params.simTime;
        const maxQ = Math.max(10, ...this.sim.queueEvents.map(e => e.length));

        // Background grid & Peak region shading (120 to 300 min)
        const peakX1 = padLeft + (this.sim.params.peakStart / maxSimTime) * chartW;
        const peakX2 = padLeft + (this.sim.params.peakEnd / maxSimTime) * chartW;

        ctx.fillStyle = 'rgba(239, 68, 68, 0.1)';
        ctx.fillRect(peakX1, padTop, peakX2 - peakX1, chartH);

        // Peak Label
        ctx.fillStyle = 'rgba(239, 68, 68, 0.6)';
        ctx.font = '10px Inter, sans-serif';
        ctx.fillText(`Peak Rush (${this.sim.params.peakStart}-${this.sim.params.peakEnd}m)`, peakX1 + 6, padTop + 14);

        // Grid lines
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
        ctx.lineWidth = 1;
        for (let i = 0; i <= 4; i++) {
            const y = padTop + (chartH / 4) * i;
            ctx.beginPath();
            ctx.moveTo(padLeft, y);
            ctx.lineTo(w - padRight, y);
            ctx.stroke();

            // Y Axis labels
            const val = Math.round(maxQ - (maxQ / 4) * i);
            ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
            ctx.font = '9px Inter, sans-serif';
            ctx.textAlign = 'right';
            ctx.fillText(val, padLeft - 6, y + 3);
        }

        // Draw Queue Length curve up to current time
        const visibleEvents = this.sim.queueEvents.filter(e => e.time <= this.currentTime);
        if (visibleEvents.length > 0) {
            ctx.beginPath();
            const startX = padLeft;
            const startY = padTop + chartH - (visibleEvents[0].length / maxQ) * chartH;
            ctx.moveTo(startX, startY);

            visibleEvents.forEach(evt => {
                const x = padLeft + (evt.time / maxSimTime) * chartW;
                const y = padTop + chartH - (evt.length / maxQ) * chartH;
                ctx.lineTo(x, y);
            });

            // Add point at currentTime
            const currX = padLeft + (this.currentTime / maxSimTime) * chartW;
            const lastY = padTop + chartH - (visibleEvents[visibleEvents.length - 1].length / maxQ) * chartH;
            ctx.lineTo(currX, lastY);

            // Stroke line
            ctx.strokeStyle = '#06B6D4';
            ctx.lineWidth = 2;
            ctx.stroke();

            // Area fill
            ctx.lineTo(currX, padTop + chartH);
            ctx.lineTo(padLeft, padTop + chartH);
            ctx.closePath();
            const gradient = ctx.createLinearGradient(0, padTop, 0, padTop + chartH);
            gradient.addColorStop(0, 'rgba(6, 182, 212, 0.35)');
            gradient.addColorStop(1, 'rgba(6, 182, 212, 0.0)');
            ctx.fillStyle = gradient;
            ctx.fill();
        }

        // Current time scrubber bar
        const scrubX = padLeft + (this.currentTime / maxSimTime) * chartW;
        ctx.strokeStyle = '#F59E0B';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(scrubX, padTop);
        ctx.lineTo(scrubX, padTop + chartH);
        ctx.stroke();

        // X Axis Labels
        ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.font = '9px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('0m', padLeft, h - 8);
        ctx.fillText('120m', peakX1, h - 8);
        ctx.fillText('300m', peakX2, h - 8);
        ctx.fillText('480m', w - padRight, h - 8);

        ctx.restore();
    }

    renderWaitChart() {
        const canvas = this.waitChartCanvas;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const dpr = window.devicePixelRatio || 1;

        const rect = canvas.getBoundingClientRect();
        if (canvas.width !== rect.width * dpr || canvas.height !== rect.height * dpr) {
            canvas.width = rect.width * dpr;
            canvas.height = rect.height * dpr;
        }

        ctx.save();
        ctx.scale(dpr, dpr);
        const w = rect.width;
        const h = rect.height;

        ctx.clearRect(0, 0, w, h);

        const padLeft = 30;
        const padRight = 15;
        const padTop = 15;
        const padBottom = 25;
        const chartW = w - padLeft - padRight;
        const chartH = h - padTop - padBottom;

        // Histogram of completed wait times up to currentTime
        const started = this.sim.students.filter(s => s.serviceStartTime <= this.currentTime);
        const bins = [
            { label: '0-5m', min: 0, max: 5, count: 0, color: '#10B981' },
            { label: '5-15m', min: 5, max: 15, count: 0, color: '#06B6D4' },
            { label: '15-30m', min: 15, max: 30, count: 0, color: '#F59E0B' },
            { label: '30-45m', min: 30, max: 45, count: 0, color: '#F97316' },
            { label: '45m+', min: 45, max: 999, count: 0, color: '#EF4444' }
        ];

        started.forEach(s => {
            for (const b of bins) {
                if (s.waitTime >= b.min && s.waitTime < b.max) {
                    b.count++;
                    break;
                }
            }
        });

        const maxCount = Math.max(5, ...bins.map(b => b.count));
        const barWidth = chartW / bins.length - 8;

        bins.forEach((b, i) => {
            const barH = (b.count / maxCount) * chartH;
            const x = padLeft + i * (barWidth + 8) + 4;
            const y = padTop + chartH - barH;

            // Bar fill
            ctx.fillStyle = b.color;
            ctx.beginPath();
            ctx.roundRect(x, y, barWidth, barH, [4, 4, 0, 0]);
            ctx.fill();

            // Count label on top of bar
            if (b.count > 0) {
                ctx.fillStyle = '#FFFFFF';
                ctx.font = 'bold 9px Inter, sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText(b.count, x + barWidth / 2, y - 4);
            }

            // X Label
            ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
            ctx.font = '9px Inter, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(b.label, x + barWidth / 2, h - 8);
        });

        ctx.restore();
    }

    renderEventLog(state) {
        if (state.recentEvents.length === 0) {
            this.eventLogList.innerHTML = '<div class="empty-log">Awaiting first arrival...</div>';
            return;
        }

        this.eventLogList.innerHTML = state.recentEvents.map(evt => {
            let icon = '📢';
            let label = '';
            let detail = '';
            let typeClass = '';

            if (evt.type === 'ARRIVAL') {
                icon = '🚶';
                typeClass = 'log-arrival';
                label = `Student #${evt.student.id} Arrived`;
                detail = `Wants to <strong>${evt.student.type}</strong>. Joined queue.`;
            } else if (evt.type === 'SERVICE_START') {
                icon = '🖥️';
                typeClass = 'log-start';
                label = `Service Started for #${evt.student.id}`;
                detail = `Staff at Desk ${evt.staffId}. Waited ${evt.student.waitTime.toFixed(1)}m.`;
            } else if (evt.type === 'SERVICE_END') {
                icon = '✅';
                typeClass = 'log-end';
                label = `Student #${evt.student.id} Completed`;
                detail = `Completed ${evt.student.type} in ${evt.student.serviceDuration.toFixed(1)}m. Departing.`;
            }

            return `
                <div class="log-item ${typeClass}">
                    <span class="log-time">${evt.time.toFixed(1)}m</span>
                    <span class="log-icon">${icon}</span>
                    <div class="log-content">
                        <div class="log-title">${label}</div>
                        <div class="log-desc">${detail}</div>
                    </div>
                </div>
            `;
        }).join('');
    }
}

// Instantiate on DOM load
window.addEventListener('DOMContentLoaded', () => {
    window.app = new UIController();
});
