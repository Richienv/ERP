# Unified ERP Master Architecture Diagram

This diagram visualizes the **Unified "Golden Thread" Architecture**, connecting Staff, Managers, Accountants, and the CEO into a single cohesive system.

```mermaid
erDiagram
    %% CORE USERS & PARTNERS
    PROFILES ||--o{ TASKS : "executes"
    PROFILES ||--o{ PRODUCTION_ORDERS : "manages"
    PROFILES ||--o{ INVOICES : "audits"
    
    PARTNERS ||--o{ INVOICES : "billed_via"
    PARTNERS ||--o{ PRODUCTION_ORDERS : "requests_via_sales"

    %% OPERATIONS (Manager & Staff)
    PRODUCTION_ORDERS ||--|{ TASKS : "broken_down_into"
    PRODUCTS ||--o{ PRODUCTION_ORDERS : "manufactured"
    MACHINES ||--o{ DOWNTIME_LOGS : "logs_uptime"
    MACHINES ||--o{ PROFILES : "operated_by"

    %% "THE GOLDEN THREAD" (Data Flow)
    %% 1. Manager Plans -> Staff Executes
    PRODUCTION_ORDERS {
        uuid id PK
        string status "Draft -> Confirmed"
        decimal quantity_planned
        decimal quantity_actual "Updated by Trigger"
    }
    
    TASKS {
        uuid id PK
        uuid production_order_id FK "The Link"
        enum status "Pending -> Done"
    }

    %% 2. Execution -> Finance (Inventory)
    TASKS ||--o{ STOCK_MOVES : "triggers_creation_of"
    
    STOCK_MOVES {
        uuid id PK
        uuid product_id FK
        decimal quantity
        string origin "Task-123"
    }

    %% 3. Ops -> CEO (Strategy)
    DOWNTIME_LOGS ||--o{ SYSTEM_ALERTS : "triggers_critical_alert"
    
    EXECUTIVE_SNAPSHOTS {
        date date
        decimal total_revenue
        float avg_oee "Aggregated from Machines"
    }
    EXECUTIVE_SNAPSHOTS }|--|| INVOICES : "aggregates"
    
    %% FINANCE (Accountant)
    INVOICES ||--o{ GENERAL_LEDGER : "posts_to"
    STOCK_MOVES ||--o{ GENERAL_LEDGER : "posts_asset_value"

```

## Key Integration Points ("The Glue")

1.  **Execution Link**: `PRODUCTION_ORDERS` (Manager) are the parents of `TASKS` (Staff).
    *   *Automation:* Completing a Task *automatically* updates the Order progress.
2.  **Financial Link**: `TASKS` create `STOCK_MOVES`.
    *   *Automation:* A finished task *automatically* increments inventory Assets in the Ledger.
3.  **Strategic Link**: `DOWNTIME_LOGS` (Staff) create `SYSTEM_ALERTS` (CEO).
    *   *Automation:* A machine breakdown *automatically* notifies the CEO.
