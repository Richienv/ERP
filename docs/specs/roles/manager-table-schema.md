# Manager Role: Database Schema & Data Analysis

This document details the data structure required to power the **Manager "Factory Command Center" (God Mode)**.

## 1. Functional Analysis
The Manager needs **Visibility** and **Orchestration** capabilities.
1.  **Status Monitoring**: Live state of every machine and line (Running/Down).
2.  **Exception Handling**: A centralized log of all high-priority alerts.
3.  **Accountability**: Tracking who is doing what (linking back to Staff tasks).

## 2. Proposed Table Schema

The core elements are **`machines`** (Physical Assets) and **`system_alerts`** (The "Nerve Center" for issues).

### A. Asset Management: `machines` & `production_lines`
Captures the "Physical Twins" of the factory floor.

| Column Name | Data Type | Key | Description |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | PK | Unique Machine ID (e.g., "M-WEAV-01") |
| `name` | `VARCHAR` | | Display Name (e.g., "Loom #1") |
| `line_id` | `UUID` | FK | The Production Line it belongs to. |
| `status` | `ENUM` | | 'idle', 'running', 'maintenance', 'breakdown' |
| `current_operator_id`| `UUID` | FK | Who is logged in right now? |
| `oee_score` | `FLOAT` | | **Real-time KPI**: Performance score (0-100%). |
| `last_maintenance` | `DATETIME` | | For preventative scheduling. |
| `next_maintenance` | `DATETIME` | | |

### B. Exception Handling: `system_alerts`
The central registry for all "Red Flags" (Machine down, Stock low, Staff absent).

| Column Name | Data Type | Key | Description |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | PK | |
| `type` | `ENUM` | | 'machine_down', 'material_low', 'quality_issue', 'staff_absent' |
| `severity` | `ENUM` | | 'info', 'warning', 'critical' |
| `reference_id` | `UUID` | FK | Links to Machine ID, Product ID, etc. |
| `message` | `TEXT` | | e.g., "Loom #1 stopped - Warp Break" |
| `created_at` | `DATETIME` | | Timestamp of the event. |
| `status` | `ENUM` | | 'open', 'acknowledged', 'resolved' |
| `resolved_by` | `UUID` | FK | Audit trail of who fixed it. |

### C. Accountability: `staff_performance_kpis` (Aggregated)
Used for the "Manager Workload" and "Staff Tracking" cards.

| Column Name | Data Type | Key | Description |
| :--- | :--- | :--- | :--- |
| `user_id` | `UUID` | PK | Link to `users`. |
| `date` | `DATE` | PK | Daily aggregation. |
| `tasks_completed` | `INT` | | Count of Done tasks. |
| `tasks_overdue` | `INT` | | **Accountability**: How many missed deadlines? |
| `avg_cycle_time` | `FLOAT` | | Efficiency metric (mins). |
| `attendance_status` | `ENUM` | | 'present', 'absent', 'late' |

## 3. Explanation of the Schema

### Why this structure?
*   **Real-Time "God Mode"**: The `machines` table is designed to be updated frequently (e.g., via IoT sensors or operator input). The Manager Dashboard simply polls `SELECT * FROM machines` to render the **Visual Map**.
*   **Alert Management**: Separation of `system_alerts` allows the dashboard to filter noise. The Manager only sees `status='open'` AND `severity='critical'` items in the top "Executive Alerts" banner.
*   **Orchestration**:
    *   Manager sees an Alert (`system_alerts`).
    *   Identifies the Machine (`machines`).
    *   Looks up Available Staff (`staff_performance_kpis` / `daily_tasks`).
    *   Assigns a new Task (`daily_tasks` table from Staff Schema).

### Data Flow Example (Machine Breakdown)
1.  **IoT Sensor** detects stoppage on Loom #1 -> Updates `machines.status` = 'breakdown'.
2.  **Trigger**: DB Trigger creates a row in `system_alerts` (Severity: Critical).
3.  **Visual**: Manager Dashboard polls table -> Loom #1 turns RED. Alert Banner appears.
4.  **Action**: Manager clicks the Loom. Finds "Teknisi Budi" (who is 'Idle' in `users`).
5.  **Assignment**: Manager drags "Fix Ticket" to Budi.
    *   Inserts row into `daily_tasks`.
    *   Updates `system_alerts` -> 'acknowledged'.
6.  **Staff View**: Budi sees phone notification.
