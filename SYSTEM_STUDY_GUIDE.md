# Library Borrowing Desk Simulation
## System Study Guide

This document explains the structure, logic, and purpose of the simulation for presentation and instructor questions.

## 1. Project Purpose

The project models a library circulation desk where students arrive, wait for service, complete either a borrowing or returning transaction, and leave.

The simulation measures:

- Student waiting time
- Current and maximum queue length
- Completed transactions
- Staff utilization
- The effect of peak-hour demand

Simulation is useful because arrivals and service times are random. A simple calculation using only the daily average would not show temporary rush-hour bottlenecks.

## 2. File Structure

| File | Purpose |
| --- | --- |
| `index.html` | Defines the web page structure and UI elements. |
| `app.js` | Contains the JavaScript simulation engine and UI controller. |
| `style.css` | Defines the visual design, layout, colors, and animations. |
| `Cervantes.py` | Contains the Python SimPy discrete-event version. |
| `run_app.py` | Starts a local web server and opens the web interface. |
| `README.md` | General project documentation and run instructions. |
| `PRESENTATION_GUIDE.md` | Presentation script, results, assumptions, and Q&A. |

## 3. How to Run the System

For the visual application:

```bash
python run_app.py
```

Then open the displayed local URL, normally `http://localhost:8000`.

The HTML file can also be opened directly in a browser.

For the Python command-line simulation:

```bash
python Cervantes.py
```

## 4. JavaScript Architecture

### `SeededRNG`

`SeededRNG` produces repeatable random numbers. The seed is normally `42`.

Using the same seed and parameters produces the same simulation results. This is important for testing and for demonstrating the same scenario to an instructor.

The exponential distribution is generated using:

```text
X = -ln(1 - U) * mean
```

where `U` is a random value between 0 and 1.

### `LibrarySimulation`

This class contains the mathematical model. Its main parameters are:

- `numStaff`: number of circulation staff
- `simTime`: total simulation time, normally 480 minutes
- `meanBorrowTime`: average borrowing service time
- `meanReturnTime`: average returning service time
- `probBorrow`: probability of a borrowing transaction
- `peakStart` and `peakEnd`: peak-hour boundaries
- `peakArrivalMean`: average interarrival time during peak hours
- `offpeakArrivalMean`: average interarrival time outside peak hours

### `UIController`

This class connects the simulation to the HTML interface. It controls playback, settings, the entrance, the waiting queue, staff desks, the exit, KPI cards, charts, and the event log.

## 5. Simulation Process

### Step 1: Generate students

`generateFullSimulation()` creates students until the 480-minute shift ends.

For every student, the program:

1. Generates an interarrival time.
2. Calculates the arrival time.
3. Chooses `Borrow` or `Return`.
4. Generates a service duration.
5. Stores the student in the simulation list.

The normal transaction split is 70 percent Borrow and 30 percent Return.

### Step 2: Assign a staff member

The program searches for the staff member with the earliest availability.

```javascript
serviceStart = Math.max(arrivalTime, staffAvailableAt[staffIndex]);
waitTime = serviceStart - arrivalTime;
departureTime = serviceStart + serviceDuration;
```

If a staff member is free when the student arrives, the student starts immediately. Otherwise, the student waits in the shared FCFS queue.

### Step 3: Record events

The system records three event types:

- `ARRIVAL`
- `SERVICE_START`
- `SERVICE_END`

The events are sorted by time and used to calculate queue history and recent activity.

### Step 4: Calculate the state at a selected time

`getStateAt(time)` classifies every student:

- Not arrived: `arrivalTime > time`
- Waiting: arrived but service has not started
- In service: service started but has not ended
- Completed: departure time has passed

This lets the interface display the system at any point during the shift.

## 6. Student Data

Each student is represented by an object similar to this:

```javascript
{
    id: 1,
    arrivalTime: 12.5,
    type: "Borrow",
    serviceDuration: 4.2,
    waitTime: 0,
    serviceStartTime: 12.5,
    departureTime: 16.7,
    staffId: 1
}
```

The fields mean:

- `id`: student number
- `arrivalTime`: time the student enters
- `type`: Borrow or Return
- `serviceDuration`: time needed by staff
- `waitTime`: time spent in line
- `serviceStartTime`: time service begins
- `departureTime`: time the student exits
- `staffId`: assigned staff member

## 7. Entrance Display

`renderEntrance()` controls the entrance area.

It displays:

- Number of students who have arrived
- Borrow and Return counts
- Current arrival period
- The next scheduled student
- The next four students expected to enter

The door animation shows the most recent student who entered. The incoming stream shows future arrivals so the user can see who will enter next before the simulation reaches their arrival time.

## 8. Queue, Staff, and Exit Displays

### Waiting queue

The queue uses `state.inQueue`. It displays students who have arrived but have not started service.

Their current waiting time is:

```text
current simulation time - arrival time
```

### Staff desks

Each desk displays whether it is available or processing a student. It also shows the current student, transaction type, service progress, remaining time, and utilization.

### Exit

Students appear at the exit after:

```text
departureTime <= current simulation time
```

## 9. Important Metrics

### Average waiting time

```text
Average wait = total waiting time / number of students who started service
```

### Maximum waiting time

The longest waiting time experienced by any student.

### Maximum queue length

The largest number of students waiting at the same time.

### Time-weighted average queue

The program calculates the area under the queue-length curve divided by the total simulation time:

```text
Average queue = area under queue curve / total time
```

This is better than averaging a few manually selected queue values.

### Staff utilization

```text
Utilization = total busy staff time
              / (number of staff * simulation time)
              * 100
```

## 10. Main User Controls

- `Play`: advances the simulation continuously
- `Pause`: stops time advancement
- `Step`: advances the simulation by two minutes
- `Reset`: recreates the simulation from time zero
- `Instant Finish`: jumps to the end of the 480-minute shift
- Speed slider: changes animation speed
- Timeline slider: jumps to a selected time
- Apply and Run: applies custom parameters
- Reset Defaults: restores the original scenario

## 11. Demonstration Script

Use this script while presenting the visual simulation. The text under each step is what you can say to the instructor.

### Opening

Say:

> This project simulates a library circulation desk. Students arrive randomly, choose either a borrowing or returning transaction, wait if both staff members are busy, receive service, and then leave. The purpose is to measure congestion and staff performance during a normal shift and during peak hours.

### Step 1: Introduce the interface

1. Open `index.html` or run `python run_app.py`.
2. Point to the top control bar.
3. Point to the clock, timeline, and speed control.
4. Point to the four stage zones: Entrance, Waiting Line, Service Desks, and Exit.

Say:

> The top controls allow us to play, pause, step through, reset, or finish the simulation. The simulation represents 480 minutes, which is an eight-hour shift from 9:00 AM to 5:00 PM. The stage below shows the movement of students through the system.

### Step 2: Explain the starting parameters

Point to the Simulation Parameters panel and identify:

- 2 circulation staff
- 5.0-minute mean borrowing service time
- 2.0-minute mean returning service time
- 70 percent probability of borrowing
- 2.0-minute peak interarrival mean
- 5.0-minute off-peak interarrival mean
- Random seed 42

Say:

> The model has two staff members. Borrowing takes longer on average than returning. Seventy percent of students borrow, while thirty percent return items. The random seed makes this demonstration repeatable, so the same settings produce the same student schedule.

### Step 3: Demonstrate the entrance

1. Keep the simulation at time zero.
2. Point to the Entrance panel.
3. Point to the `Next` student indicator.
4. Point to the incoming stream of scheduled students.
5. Click `Play` at 5x or 10x speed.

Say:

> The entrance uses a random arrival process. The incoming stream shows the next students who are scheduled to enter, including their transaction type and expected arrival time. When a student arrives, the door indicator changes and the student is counted in the total arrivals.

### Step 4: Demonstrate the queue

1. Let the simulation run until several students have arrived.
2. Point to the FCFS Waiting Line.
3. Point to a student's transaction icon, ID, and wait-time badge.
4. Pause the simulation.

Say:

> Students who arrive while both desks are occupied enter one shared first-come, first-served queue. The wait badge shows how long each student has been waiting. The queue is shared so the next available staff member receives the next student in line.

### Step 5: Demonstrate the service desks

1. Point to the Service Desks section.
2. Identify an available desk and a processing desk.
3. Point to the current student, progress bar, and remaining service time.

Say:

> Each desk is a server. When a staff member begins service, the student's wait time stops and the service timer begins. The progress bar represents the elapsed service duration. When service ends, the student leaves through the exit.

### Step 6: Demonstrate the exit

1. Continue the simulation until at least one student completes service.
2. Point to the Exit section.
3. Point to the completion mark and departure time.

Say:

> The Exit section shows students whose departure time has been reached. A student is counted as completed only after their service duration finishes.

### Step 7: Show the KPI cards

Pause the simulation and point to the KPI cards.

Say:

> These cards summarize the current state of the model. Completed Visits counts finished students. Queue Length shows the current and maximum queue. Average Wait Time summarizes the waiting experience. Time-Weighted Queue measures the average queue over time, and Staff Utilization shows how much of the available staff capacity has been used.

### Step 8: Show peak-hour behavior

1. Move the timeline to approximately 120 minutes, or continue playing.
2. Point to the peak-hours indicator.
3. Let the simulation continue through the period from 120 to 300 minutes.
4. Point to the queue and wait times as they increase.

Say:

> At 120 minutes, the simulation enters the peak period. The average time between arrivals decreases from 5 minutes to 2 minutes. This creates more pressure on the two staff members, so the queue and waiting times can increase. This demonstrates why an overall daily average can hide a serious short-term bottleneck.

### Step 9: Explain the charts

Point to the Queue Length Timeline and Wait Time Distribution charts.

Say:

> The queue chart shows how the number of waiting students changes over the shift. The peak period is highlighted so we can compare normal and rush-hour behavior. The wait-time chart groups students according to how long they waited.

### Step 10: Run a what-if scenario

1. Change Circulation Staff from `2` to `3`.
2. Click `Apply & Run`.
3. Click `Instant Finish`.
4. Compare the queue, wait time, and utilization with the original run.

Say:

> This is a what-if experiment. By adding one staff member, we can test whether the peak-hour bottleneck improves. We compare maximum queue length, average wait, maximum wait, and utilization instead of judging the result only by appearance.

### Step 11: Finish with the conclusion

Say:

> The simulation shows that two staff members may be acceptable during off-peak hours but can become overloaded during the peak period. A practical recommendation is to schedule an additional temporary staff member during the busiest hours instead of adding permanent staff for the entire day.

### Optional Python demonstration

If the instructor asks about the numerical model, open a terminal and run:

```bash
python Cervantes.py
```

Say:

> The Python version uses the same deterministic model as the web interface. The web version is intended for visualization and interaction, while the Python version prints the same calculated performance metrics.

## 12. Python SimPy Command-Line Version

`Cervantes.py` is the SimPy command-line version of the same deterministic model used by `app.js`. It uses SimPy's environment and two-server resource, while the Python implementation of Mulberry32 ensures both versions produce the same student schedule and final metrics.

### `student_generator()`

The browser version pre-generates students, so the Python version uses `generate_students()` to create the same arrival, transaction, and service data before passing each student process to SimPy.

### `student_process()`

SimPy performs the student life cycle through the shared resource:

1. Arrival
2. Earliest staff assignment
3. Waiting calculation
4. Service start
5. Departure calculation

### `PerformanceMonitor`

Calculates waiting times, queue lengths, completed transaction counts, time-weighted queue length, and staff utilization from the shared student schedule.

### `run_simulation()`

Generates the students, assigns staff, calculates the final metrics, and prints the command-line report.

## 13. JavaScript and Python Comparison

The JavaScript version is designed for visualization. It pre-generates the schedule and allows the user to move backward and forward through the simulation timeline.

The Python version is designed for numerical output and uses SimPy for event execution while mirroring the JavaScript calculations so the final report matches the browser dashboard.

Both versions represent the same conceptual model:

- Exponential arrivals
- Exponential service durations
- Borrow and Return transactions
- Multiple staff members
- One FCFS queue
- An eight-hour operating period

## 14. Model Assumptions

The current version assumes:

- Two staff members by default
- One shared FCFS queue
- No student abandons the line
- No staff breaks
- Staff members have equal performance
- Students arrive individually
- Borrowing takes longer than returning on average
- Arrival rates increase during peak hours

## 15. Instructor-Ready Explanation

You can say:

> Our project is a multi-server queuing simulation for a library circulation desk. Students arrive according to a non-stationary Poisson process, meaning the arrival rate changes during the day. Each student is randomly assigned a Borrow or Return transaction, and service duration follows an exponential distribution. Students use one shared first-come, first-served queue and are assigned to whichever staff member becomes available first. The system records arrivals, service starts, and departures, then calculates waiting time, queue length, completed visits, and staff utilization. The JavaScript version visualizes the model in real time, while the SimPy Python version produces the same numerical results.

## 16. Common Questions and Answers

### Why use simulation instead of simple arithmetic?

Simple arithmetic gives only an average. Simulation shows random arrivals, long service times, peak-hour congestion, and temporary queues.

### Why use an exponential distribution?

Poisson arrivals produce exponential interarrival times. Exponential service times also model many short transactions with occasional longer transactions.

### Why use one queue?

A shared queue is fairer and usually more efficient. It prevents one staff member from being idle while another line is long.

### What is FCFS?

FCFS means First-Come, First-Served. Students are handled in the order they enter the queue.

### What is the purpose of the random seed?

The seed makes the experiment reproducible. The same inputs produce the same result, which helps testing and presentation.

### What is the main limitation?

The model does not yet include student abandonment, staff breaks, different staff speeds, or more detailed transaction types.

### What improvement could be tested?

A third staff member could be added during the 120-to-300-minute peak period to reduce waiting time and queue length.
