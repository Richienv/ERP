# Staff Role: Database Schema & Data Analysis

This document details the data structure required to power the **Staff "Cockpit" Dashboard**.

## 1. Functional Analysis (What Staff Data do we need?)
Based on the **Staff User Flow**, the system needs to track:
1.  **Who** is working? (User/Operator ID)
2.  **What** do they need to do? (The specific Task)
3.  **Where** is it? (Location/Machine ID)
4.  **When** did they start/finish? (Timestamps for KPI/Efficiency)
5.  **What happened?** (Status updates: Done vs Issue)

## 2. Proposed Table Schema

The core element for the Staff view is a simplified **`daily_tasks`** table that aggregates work from different modules (Production, Warehouse, Quality) into a single "To-Do" list for the user.

### A. Core Table: `daily_tasks`
This is the "Screen" the staff sees. It links a worker to a specific job.

| Column Name | Data Type | Key | Description |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | PK | Unique Task ID (e.g., "T-101") |
| `user_id` | `UUID` | FK | **Assigned To**. Links to `users` table. |
| `task_type` | `ENUM` | | 'production', 'quality', 'warehouse', 'maintenance' |
| `reference_id` | `UUID` | FK | ID of the source document (e.g., WO ID, Transfer ID) |
| `title` | `VARCHAR` | | Display title (e.g., "WO-WEAV-1023") |
| `description` | `TEXT` | | Simplified instructions for the operator. |
| `location_code` | `VARCHAR` | | e.g., "Loom L-12", "Zone A" |
| `priority` | `INT` | | 1 (Low) to 5 (Critical) - Sort order. |
| `status` | `ENUM` | | 'pending', 'running', 'completed', 'issue' |
| `planned_start` | `DATETIME` | | Shift planning time. |
| `actual_start` | `DATETIME` | | **KPI**: When user clicked 'Mulai'. |
| `actual_end` | `DATETIME` | | **KPI**: When user clicked 'Selesai'. |
| `issue_log` | `TEXT` | | Content if user clicked "Lapor Isu". |

### B. Supporting Reference Tables (Simplified)

**1. `users`** (The Staff Member)
*   `id`, `full_name`, `role` ('staff'), `shift_id` (e.g., 'Shift Pagi'), `current_station` (Where they are logged in).

**2. `production_orders`** (Source for 'Production' tasks)
*   The master WO that generates the task. When `daily_tasks.status` -> 'completed', this table updates its progress (e.g., +100 meters produced).

**3. `quality_inspections`** (Source for 'Quality' tasks)
*   Validations required. When `daily_tasks` is done, this record is marked as 'Inspected'.

## 3. Explanation of the Schema

### Why this structure?
Instead of making the Staff search through the entire "Production Order" table or "Warehouse Transfer" table, we create a specialized **`daily_tasks`** table.

*   **The Aggregation Layer**: The Manager (or the System) creates rows in `daily_tasks`.
    *   *Example*: Manager creates a Production Order for 1000 items. The system automatically generates 5 `daily_tasks` (200 items each) for 5 different operators or time slots.
*   **Performance**: The Staff Dashboard only needs to query `SELECT * FROM daily_tasks WHERE user_id = [Current User] AND status != 'completed'`. This is heavily indexed and extremely fast.
*   **KPI Tracking**: By having `actual_start` and `actual_end`, we can calculate **OEE (Overall Equipment Effectiveness)** and Worker Efficiency automatically.
    *   *Formula*: `(actual_end - actual_start)` vs `standard_time`.

### Data Flow Example
1.  **Manager** assigns "Fix Loom" to **Budi**.
2.  **Database** inserts row into `daily_tasks`:
    *   `user_id`: Budi
    *   `task_type`: 'maintenance'
    *   `status`: 'pending'
3.  **Budi** logs in. API queries `daily_tasks`.
4.  **Budi** clicks "Start". DB updates `status` -> 'running', `actual_start` -> `NOW()`.
5.  **Budi** clicks "Done". DB updates `status` -> 'completed', `actual_end` -> `NOW()`.
