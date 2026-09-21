import math
import simpy


# ==========================================
# 1. PARAMETERS & SEEDED RANDOM GENERATOR
# ==========================================
RANDOM_SEED = 42
NUM_STAFF = 2
SIM_TIME = 480
MEAN_BORROW_TIME = 5.0
MEAN_RETURN_TIME = 2.0
PROB_BORROW = 0.70
PEAK_START = 120
PEAK_END = 300
PEAK_ARRIVAL_MEAN = 2.0
OFFPEAK_ARRIVAL_MEAN = 5.0


class SeededRNG:
    """Python implementation of the Mulberry32 generator used by app.js."""

    def __init__(self, seed=RANDOM_SEED):
        self.seed = int(abs(seed)) or 1

    def next(self):
        self.seed = (self.seed + 0x6D2B79F5) & 0xFFFFFFFF
        value = self.seed
        value = ((value ^ (value >> 15)) * (value | 1)) & 0xFFFFFFFF
        value ^= (value + (((value ^ (value >> 7)) * (value | 61)) & 0xFFFFFFFF)) & 0xFFFFFFFF
        value &= 0xFFFFFFFF
        return ((value ^ (value >> 14)) & 0xFFFFFFFF) / 4294967296

    def exponential(self, mean):
        random_value = max(1e-12, 1.0 - self.next())
        return -math.log(random_value) * mean


def get_interarrival_mean(current_time):
    if PEAK_START <= current_time < PEAK_END:
        return PEAK_ARRIVAL_MEAN
    return OFFPEAK_ARRIVAL_MEAN


# ==========================================
# 2. SAME PRE-GENERATED MODEL AS app.js
# ==========================================
def generate_students():
    rng = SeededRNG(RANDOM_SEED)
    current_time = 0.0
    students = []
    student_id = 1

    while current_time < SIM_TIME:
        current_time += rng.exponential(get_interarrival_mean(current_time))
        if current_time > SIM_TIME:
            break

        is_borrow = rng.next() < PROB_BORROW
        service_mean = MEAN_BORROW_TIME if is_borrow else MEAN_RETURN_TIME
        students.append({
            "id": student_id,
            "arrival_time": current_time,
            "type": "Borrow" if is_borrow else "Return",
            "service_duration": rng.exponential(service_mean),
        })
        student_id += 1

    staff_available_at = [0.0] * NUM_STAFF
    for student in students:
        staff_index = min(range(NUM_STAFF), key=lambda index: staff_available_at[index])
        service_start = max(student["arrival_time"], staff_available_at[staff_index])
        student["staff_id"] = staff_index + 1
        student["wait_time"] = service_start - student["arrival_time"]
        student["service_start_time"] = service_start
        student["departure_time"] = service_start + student["service_duration"]
        staff_available_at[staff_index] = student["departure_time"]

    return students


def build_queue_events(students):
    events = []
    for student in students:
        events.append((student["arrival_time"], 0, "ARRIVAL", student))
        events.append((student["service_start_time"], 1, "SERVICE_START", student))
        events.append((student["departure_time"], 2, "SERVICE_END", student))

    events.sort(key=lambda event: (event[0], event[1]))
    queue_length = 0
    queue_events = []
    for event_time, _, event_type, student in events:
        if event_time > SIM_TIME:
            continue
        if event_type == "ARRIVAL":
            queue_length += 1
            queue_events.append((event_time, queue_length))
        elif event_type == "SERVICE_START":
            queue_length = max(0, queue_length - 1)
            queue_events.append((event_time, queue_length))

    return events, queue_events


def run_simpy_processes(students):
    """Execute the generated schedule through SimPy's environment and resource."""
    env = simpy.Environment()
    staff_resource = simpy.Resource(env, capacity=NUM_STAFF)

    def student_process(student):
        yield env.timeout(student["arrival_time"] - env.now)
        with staff_resource.request() as request:
            yield request
            yield env.timeout(student["service_duration"])

    for student in students:
        env.process(student_process(student))

    env.run(until=SIM_TIME)


def calculate_results():
    students = generate_students()
    run_simpy_processes(students)
    events, queue_events = build_queue_events(students)
    arrived = [student for student in students if student["arrival_time"] <= SIM_TIME]
    completed = [student for student in students if student["departure_time"] <= SIM_TIME]
    started = [student for student in students if student["service_start_time"] <= SIM_TIME]

    completed_borrow = sum(student["type"] == "Borrow" for student in completed)
    completed_return = sum(student["type"] == "Return" for student in completed)
    wait_times = [student["wait_time"] for student in started]

    max_queue = max((length for _, length in queue_events), default=0)
    area = 0.0
    visible_events = [(time, length) for time, length in queue_events if time <= SIM_TIME]
    if visible_events:
        for index in range(len(visible_events) - 1):
            current_time, current_length = visible_events[index]
            next_time = visible_events[index + 1][0]
            area += current_length * (next_time - current_time)
        last_time, last_length = visible_events[-1]
        area += last_length * (SIM_TIME - last_time)

    total_busy = sum(
        min(SIM_TIME, student["departure_time"]) - student["service_start_time"]
        for student in started
    )

    return {
        "arrived": len(arrived),
        "completed": len(completed),
        "completed_borrow": completed_borrow,
        "completed_return": completed_return,
        "avg_wait": sum(wait_times) / len(wait_times) if wait_times else 0.0,
        "max_wait": max(wait_times, default=0.0),
        "max_queue": max_queue,
        "avg_queue": area / SIM_TIME,
        "utilization": (total_busy / (NUM_STAFF * SIM_TIME)) * 100,
        "events": events,
    }


def run_simulation():
    results = calculate_results()
    total_completed = results["completed"]
    borrow_percentage = results["completed_borrow"] / total_completed * 100 if total_completed else 0
    return_percentage = results["completed_return"] / total_completed * 100 if total_completed else 0

    print("=" * 55)
    print("      LIBRARY BORROWING DESK SIMULATION RESULTS       ")
    print("=" * 55)
    print(f"Total Operating Duration  : {SIM_TIME} minutes ({SIM_TIME / 60:.1f} hours)")
    print(f"Total Completed Visits    : {total_completed} students")
    print(f"  - Borrow Transactions   : {results['completed_borrow']} ({borrow_percentage:.1f}%)")
    print(f"  - Return Transactions   : {results['completed_return']} ({return_percentage:.1f}%)")
    print("-" * 55)
    print(f"Average Waiting Time      : {results['avg_wait']:.2f} minutes")
    print(f"Maximum Waiting Time      : {results['max_wait']:.2f} minutes")
    print(f"Maximum Queue Length      : {results['max_queue']} students")
    print(f"Average Queue Length      : {results['avg_queue']:.2f} students")
    print(f"Staff Utilization Rate    : {results['utilization']:.2f}%")
    print("=" * 55)


if __name__ == "__main__":
    run_simulation()
