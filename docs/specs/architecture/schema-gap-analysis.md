# Gap Analysis: From Silos to Unified ERP

You are absolutely right. While the individual schemas handle the *experience* of each role perfectly, sticking them together reveals **4 Critical Gaps** in data flow.

## The Gaps Identified

### 1. The "Execution Gap" (Manager vs. Staff)
*   **Gap:** Managers plan `production_orders`, but Staff execute `tasks`. In the previous design, they were loosely linked.
*   **Risk:** Staff could complete a task, but the "Progress Bar" on the Manager's dashboard wouldn't move automatically.
*   **Fix:** `tasks` must be a direct *child* of `production_orders`.
    *   *Logic:* When `task.status` -> 'done', Trigger updates `production_orders.quantity_actual`.

### 2. The "Financial Inventory Gap" (Staff vs. Accountant)
*   **Gap:** Staff reports "100 meters produced", but the Accountant needs "Asset Value Increase (Debit Inventory)".
*   **Risk:** The Financial Statement lags behind reality. The CEO sees "Production is up" but "Assets are flat".
*   **Fix:** **`stock_moves`** Table.
    *   *Logic:* Task completion -> Creates `stock_move` (+100m) -> Trigger writes to `general_ledger` (Debit Inventory, Credit WIP).

### 3. The "Procurement Black Hole" (Manager vs. Accountant)
*   **Gap:** Manager creates `material_requisitions`. Accountant pays `invoices`. The middle step involves a Supplier.
*   **Risk:** Accountant pays for material that never arrived, or Manager waits for material that was never ordered.
*   **Fix:** **`purchase_orders`** Table.
    *   *Logic:* Requisition -> PO (Sent to Supplier) -> Goods Receipt -> Vendor Bill (Invoice).

### 4. The "Alert Disconnect" (Staff vs. CEO)
*   **Gap:** Staff logs `downtime_logs` (Machine stopped). CEO watches `system_alerts`.
*   **Risk:** A machine breaks down, but the CEO's dashboard stays Green because nobody manually created an Alert.
*   **Fix:** **Database Triggers**.
    *   *Logic:* Insert into `downtime_logs` -> AUTOMATICALLY sets `machines.status`='breakdown' AND inserts into `system_alerts`.

---

## The Unified Solution

I have designed `unified-erp-architecture.sql` which connects these dots. It introduces the **"Golden Thread"** tables (`stock_moves`, `purchase_orders`) that glue the roles together.
