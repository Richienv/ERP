# CEO Role: Database Schema & Data Analysis

This document details the data structure required to power the **CEO "Eagle Eye" Dashboard**.

## 1. Functional Analysis
The CEO needs **Synthesis**, not raw data. The system must aggregate thousands of rows (sales, tasks, logs) into single "Health Score" metrics.
1.  **Strategic Oversight**: Are we hitting our monthly/quarterly targets?
2.  **Trend Analysis**: Comparison over time (Q1 vs Q2).
3.  **AI Querying**: The schema must be optimized for questions like "Why is margin down?"

## 2. Proposed Table Schema

The core elements are **`executive_snapshots`** (Historical Trends) and **`strategic_goals`** (The Yardstick).

### A. The "Daily Pulse": `executive_snapshots`
This is a pre-aggregated table populated every night (or hourly). It powers the "Finance Snapshot" and trend charts.

| Column Name | Data Type | Key | Description |
| :--- | :--- | :--- | :--- |
| `date` | `DATE` | PK | The reference day. |
| `total_revenue` | `DECIMAL` | | Sum(Invoices posted today). |
| `total_cost` | `DECIMAL` | | Sum(Bills + Payroll + Ops Cost). |
| `net_profit` | `DECIMAL` | | Revenue - Cost. |
| `cash_balance` | `DECIMAL` | | Closing Bank Balance. |
| `total_production` | `INT` | | Total Units produced. |
| `avg_oee` | `FLOAT` | | Factory Efficiency Score. |
| `active_headcount`| `INT` | | Number of Staff present. |

### B. The "North Star": `strategic_goals`
Defines what "Good" looks like. Used for the Red/Green variance indicators.

| Column Name | Data Type | Key | Description |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | PK | |
| `period` | `VARCHAR` | | '2024-Q1', 'Jan-2024'. |
| `metric_name` | `VARCHAR` | | 'Revenue', 'OEE', 'CSAT'. |
| `target_value` | `DECIMAL` | | e.g., 5,000,000,000 (5M). |
| `actual_value` | `DECIMAL` | | Updated in real-time. |
| `status` | `ENUM` | | 'on_track', 'at_risk', 'behind' |

### C. The "Virtual View" Layer (For AI)
Except for the Snapshot table, the CEO dashboard relies heavily on **Database Views** that aggregate data from other schemas (Staff, Manager, Accountant).

*   `view_production_health`: Joins `machines` (Manager) + `daily_tasks` (Staff) to show "Line Status".
*   `view_cash_runway`: Joins `general_ledger` (Accountant) + `recurring_expenses` to predict "Days until zero cash".

## 3. Explanation of the Schema

### Why this structure?
*   **Performance**: The CEO dashboard often loads heavily calculated data (e.g., "Year-over-Year Growth"). Running this on raw invoice rows every time is too slow. The `executive_snapshots` table acts as a Data Mart, making the dashboard load instantly.
*   **AI Context**: When the user asks Tanya AI "How is Q1?", the LLM doesn't scan 1M rows. It scans the `executive_snapshots` table for dates between Jan 1 - Mar 31. This is efficient and cheaper for token usage.
*   **Strategic Alignment**: By explicitly defining `strategic_goals`, the system can visually alert the CEO (Green/Red colors) without complex logic in the frontend.

### Data Flow Example (End of Month Review)
1.  **Scheduled Job** (Midnight):
    *   Queries `invoices` (Accountant) -> Calculates Total Revenue.
    *   Queries `machines` (Manager) -> Calculates Avg OEE.
    *   **Inserts** row into `executive_snapshots` for Yesterday.
2.  **CEO Dashboard Load**:
    *   Fetches last 30 rows of `executive_snapshots` -> Renders "Revenue Trend" Chart.
    *   Fetches `strategic_goals` where period='Current Month' -> Renders "Target Progress" bars.
3.  **Tanya AI Query**: "Compare Q1 vs Q2".
    *   AI sums `total_revenue` from `executive_snapshots` for Q1 range vs Q2 range.
    *   Returns the comparison table (as implemented in the previous step).
