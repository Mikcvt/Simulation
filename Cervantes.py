import random
import simpy
import numpy as np

# ==========================================
# 1. PARAMETERS & CONFIGURATION SETUP
# ==========================================
RANDOM_SEED = 42
NUM_STAFF = 2                  # Number of circulation staff (Resources)[cite: 1]
SIM_TIME = 480                 # Total duration in minutes (8-hour shift)[cite: 1]

# Service Time Parameters (in minutes)
MEAN_BORROW_TIME = 5.0        # Exponential mean for borrowing[cite: 1]
MEAN_RETURN_TIME = 2.0        # Exponential mean for returning[cite: 1]
PROB_BORROW = 0.70            # 70% Borrow, 30% Return[cite: 1]

# Inter-arrival Time Parameters (in minutes)
# Example Non-Stationary Schedule:
# 0 to 120 min (Off-peak): Mean = 5.0 min
# 120 to 300 min (Peak/Rush): Mean = 2.0 min
# 300 to 480 min (Off-peak): Mean = 5.0 min
def get_current_interarrival_mean(current_time):
    if 120 <= current_time < 300:
        return 2.0  # Peak hours inter-arrival mean[cite: 1]
    else:
        return 5.0  # Off-peak hours inter-arrival mean[cite: 1]


# ==========================================
# 2. DATA COLLECTOR CLASS
# ==========================================
class PerformanceMonitor:
    """Class to track performance metrics across the simulation run[cite: 1]."""
    def __init__(self):
        self.wait_times = []
        self.service_times = []
        self.queue_lengths = []
        self.queue_timestamps = []
        self.completed_borrow = 0
        self.completed_return = 0
        self.server_busy_time = 0.0

    def record_queue_length(self, time, length):
        self.queue_timestamps.append(time)
        self.queue_lengths.append(length)

    def get_max_queue_length(self):
        return max(self.queue_lengths) if self.queue_lengths else 0

    def get_time_weighted_avg_queue(self, total_time):
        if not self.queue_lengths:
            return 0.0
        # Compute time-weighted average using trapezoidal rule/area under curve
        area = 0.0
        for i in range(len(self.queue_lengths) - 1):
            dt = self.queue_timestamps[i+1] - self.queue_timestamps[i]
            area += self.queue_lengths[i] * dt
        # Add tail duration to simulation end
        area += self.queue_lengths[-1] * (total_time - self.queue_timestamps[-1])
        return area / total_time


# ==========================================
# 3. DISCRETE EVENT PROCESSES
# ==========================================
def student_process(env, student_id, staff_resource, monitor):
    """Models arrival, queuing, service, and departure of a student[cite: 1]."""
    arrival_time = env.now
    
    # Determine Transaction Type
    is_borrow = random.random() < PROB_BORROW
    trans_type = "Borrow" if is_borrow else "Return"
    
    # Record queue size prior to joining line
    monitor.record_queue_length(env.now, len(staff_resource.queue))
    
    # Request a staff member (FCFS)[cite: 1]
    with staff_resource.request() as req:
        yield req  # Wait in queue until a staff member is free[cite: 1]
        
        # Calculate Wait Time
        wait_time = env.now - arrival_time
        monitor.wait_times.append(wait_time)
        
        # Record queue size right after being pulled from queue
        monitor.record_queue_length(env.now, len(staff_resource.queue))
        
        # Determine Service Duration based on exponential distribution[cite: 1]
        if is_borrow:
            service_duration = random.expovariate(1.0 / MEAN_BORROW_TIME)
        else:
            service_duration = random.expovariate(1.0 / MEAN_RETURN_TIME)
            
        yield env.timeout(service_duration)  # Simulate processing duration[cite: 1]
        
        # Record Completed Transactions and Busy Time
        monitor.service_times.append(service_duration)
        monitor.server_busy_time += service_duration
        if is_borrow:
            monitor.completed_borrow += 1
        else:
            monitor.completed_return += 1


def student_generator(env, staff_resource, monitor):
    """Generates continuous student arrivals based on non-stationary arrival rates[cite: 1]."""
    student_id = 0
    while True:
        # Fetch current mean inter-arrival time according to time-block schedule[cite: 1]
        mean_iat = get_current_interarrival_mean(env.now)
        inter_arrival = random.expovariate(1.0 / mean_iat)
        
        yield env.timeout(inter_arrival)
        
        student_id += 1
        # Launch independent process per student
        env.process(student_process(env, student_id, staff_resource, monitor))


# ==========================================
# 4. SIMULATION EXECUTION & REPORTING
# ==========================================
def run_simulation():
    random.seed(RANDOM_SEED)
    np.random.seed(RANDOM_SEED)
    
    # Step 1: Initialize Environment[cite: 1]
    env = simpy.Environment()
    
    # Step 2: Create Staff Resources[cite: 1]
    staff_resource = simpy.Resource(env, capacity=NUM_STAFF)
    
    # Step 3: Initialize Performance Monitor
    monitor = PerformanceMonitor()
    
    # Step 4: Start Generator Process
    env.process(student_generator(env, staff_resource, monitor))
    
    # Step 5: Run Environment for 480 units (8 hours)[cite: 1]
    env.run(until=SIM_TIME)
    
    # Step 6: Compute Output Metrics[cite: 1]
    total_completed = monitor.completed_borrow + monitor.completed_return
    avg_wait = np.mean(monitor.wait_times) if monitor.wait_times else 0.0
    max_wait = max(monitor.wait_times) if monitor.wait_times else 0.0
    max_queue = monitor.get_max_queue_length()
    avg_queue = monitor.get_time_weighted_avg_queue(SIM_TIME)
    
    # Staff Utilization = (Total Service Time Rendered) / (Total Capacity * Total Simulation Run Time)
    staff_utilization = (monitor.server_busy_time / (NUM_STAFF * SIM_TIME)) * 100.0

    # Print Output Dashboard
    print("=" * 55)
    print("      LIBRARY BORROWING DESK SIMULATION RESULTS       ")
    print("=" * 55)
    print(f"Total Operating Duration  : {SIM_TIME} minutes ({SIM_TIME/60:.1f} hours)")
    print(f"Total Completed Visits    : {total_completed} students")
    print(f"  - Borrow Transactions   : {monitor.completed_borrow} ({monitor.completed_borrow/total_completed*100:.1f}%)")
    print(f"  - Return Transactions   : {monitor.completed_return} ({monitor.completed_return/total_completed*100:.1f}%)")
    print("-" * 55)
    print(f"Average Waiting Time      : {avg_wait:.2f} minutes")
    print(f"Maximum Waiting Time      : {max_wait:.2f} minutes")
    print(f"Maximum Queue Length      : {max_queue} students")
    print(f"Average Queue Length      : {avg_queue:.2f} students")
    print(f"Staff Utilization Rate    : {staff_utilization:.2f}%")
    print("=" * 55)

if __name__ == "__main__":
    run_simulation()