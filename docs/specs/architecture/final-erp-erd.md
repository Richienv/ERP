# Final Master ERP Database Diagram

This is the **Unified Database Design** connecting all 4 roles.

```mermaid
erDiagram
    %% CORE
    PROFILES ||--o{ PRODUCTION_ORDERS : "manages"
    PROFILES ||--o{ TASKS : "executes"
    PROFILES ||--o{ MACHINES : "operates"
    PROFILES ||--o{ COLLECTION_LOGS : "performs"
    PROFILES ||--o| COMPANY_GOALS : "owns"

    %% MANAGER MODULE (Operations)
    MACHINES ||--o{ MAINTENANCE_SCHEDULES : "requires"
    MACHINES ||--o{ MACHINE_LOGS : "telemetry"
    MACHINES ||--o{ DOWNTIME_LOGS : "halts"
    
    PRODUCTION_ORDERS ||--o{ MATERIAL_REQUISITIONS : "needs"
    PRODUCTION_ORDERS ||--|{ TASKS : "executed_via"
    PRODUCTION_ORDERS }|--|| PRODUCTS : "manufactures"
    
    %% STAFF MODULE (Execution)
    TASKS ||--o{ TASK_CHECKLISTS : "steps"
    TASKS ||--o{ DEFECTS : "yields"
    TASKS ||--o{ DOWNTIME_LOGS : "interrupted_by"
    
    %% FINANCE MODULE (Accountant)
    INVOICES ||--o{ COLLECTION_LOGS : "chased_via"
    INVOICES ||--o{ GENERAL_LEDGER : "posts"
    INVOICES }|--|| PARTNERS : "billed_to"
    
    BANK_TRANSACTIONS |o--o| RECONCILIATION_SUGGESTIONS : "matches"
    RECONCILIATION_SUGGESTIONS }o--|| INVOICES : "against"

    %% CONNECTION POINTS (The "Glue")
    TASKS ||--o{ STOCK_MOVES : "triggers_inventory"
    DOWNTIME_LOGS ||--o{ SYSTEM_ALERTS : "triggers_alert"
    
    %% CEO MODULE (Strategy)
    EXECUTIVE_SNAPSHOTS }|--|| INVOICES : "aggregates"
    EXECUTIVE_SNAPSHOTS }|--|| MACHINES : "aggregates"
    COMPANY_GOALS ||--o{ EXECUTIVE_SNAPSHOTS : "tracks_progress"
```

## How It Counts & Connects
1.  **Counting Production**: `TASKS` (Staff) updates `PRODUCTION_ORDERS.quantity_actual` (Manager).
2.  **Counting Money**: `INVOICES` (Accountant) and `STOCK_MOVES` (Staff) feed `GENERAL_LEDGER` and `EXECUTIVE_SNAPSHOTS` (CEO).
3.  **Counting Efficiency**: `DOWNTIME_LOGS` (Staff) updates `MACHINES.oee_score` (Manager).
