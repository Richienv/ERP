# ERP Master Database Specification

> **For Future AI / Developers:** This document is the **Comprehensive Source of Truth** for the ERP Database. It contains the complete SQL Schema, Design Rationale, and Automation Logic. **Read this entire file before making schema changes.**

## 1. System Overview
This is a **Unified ERP System** designed for a Textile Factory. It integrates 4 distinct roles into a single shared PostgreSQL database on Supabase.

*   **Unified Truth:** No data silos. Staff execution directly impacts Finance and Executive dashboards.
*   **Real-time:** Utilizing Supabase Realtime for live updates (Machine Status, Dashboard Alerts).
*   **Automation:** Database Triggers handle the cross-role logic (the "Golden Thread").

---

## 2. The Unified Schema (Full Definition)

Below is the production-ready SQL schema. This defines the structure of the entire system.

```sql
-- MASTER UNIFIED ERP SCHEMA
-- Combines: Staff, Manager, Accountant, CEO into one seamless system.

-- ==========================================
-- 1. CORE IDENTITY & PROFILES (Common)
-- ==========================================
CREATE TYPE user_role AS ENUM ('staff', 'manager', 'accountant', 'ceo', 'admin');

CREATE TABLE public.profiles (
    id UUID REFERENCES auth.users(id) PRIMARY KEY,
    full_name TEXT NOT NULL,
    role user_role NOT NULL,
    department TEXT, -- 'weaving', 'dyeing', 'finance', 'executive'
    current_shift TEXT, -- 'Shift A', 'Shift B'
    current_station_id UUID, -- For Staff (Machine assign)
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- 2. PARTNERS & PRODUCTS (Common)
-- ==========================================
CREATE TABLE public.partners (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL, -- "Zara", "PT Benang Jaya"
    type TEXT CHECK (type IN ('customer', 'supplier', 'both')),
    email TEXT,
    phone TEXT,
    payment_behavior_score FLOAT DEFAULT 10.0, -- AI Score (0-10)
    credit_limit DECIMAL DEFAULT 0,
    is_on_credit_hold BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.products (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL, -- "Cotton 30s Navy"
    sku TEXT UNIQUE NOT NULL,
    cost_price DECIMAL DEFAULT 0,
    sales_price DECIMAL DEFAULT 0,
    unit TEXT DEFAULT 'meters',
    stock_quantity DECIMAL DEFAULT 0, -- Updated via Trigger
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- 3. MANAGER MODULE (Operations)
-- Machines, Maintenance, Production Orders
-- ==========================================
CREATE TYPE machine_status AS ENUM ('idle', 'running', 'maintenance', 'breakdown', 'offline');

CREATE TABLE public.machines (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL, -- "Loom #1"
    code TEXT UNIQUE NOT NULL,
    status machine_status DEFAULT 'idle',
    oee_score FLOAT DEFAULT 100.0,
    current_operator_id UUID REFERENCES public.profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.maintenance_schedules (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    machine_id UUID REFERENCES public.machines(id),
    title TEXT NOT NULL,
    type TEXT NOT NULL, -- 'preventive', 'corrective'
    scheduled_date DATE NOT NULL,
    status TEXT DEFAULT 'pending'
);

CREATE TYPE order_status AS ENUM ('draft', 'confirmed', 'in_progress', 'completed', 'cancelled');

CREATE TABLE public.production_orders (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    order_number TEXT UNIQUE NOT NULL, -- "WO-2026-001"
    product_id UUID REFERENCES public.products(id),
    quantity_planned DECIMAL NOT NULL,
    quantity_actual DECIMAL DEFAULT 0, -- Updated via Trigger
    start_date TIMESTAMPTZ NOT NULL,
    end_date TIMESTAMPTZ NOT NULL,
    assigned_line_id UUID,
    status order_status DEFAULT 'draft',
    priority INT DEFAULT 1,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.material_requisitions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    production_order_id UUID REFERENCES public.production_orders(id),
    item_name TEXT NOT NULL,
    quantity_required DECIMAL NOT NULL,
    status TEXT DEFAULT 'draft', -- 'approved', 'ordered'
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- 4. STAFF MODULE (Execution)
-- Tasks, Checklists, Defects, Downtime
-- ==========================================
CREATE TABLE public.tasks (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    production_order_id UUID REFERENCES public.production_orders(id), -- LINK TO MANAGER
    title TEXT NOT NULL,
    assigned_to UUID REFERENCES public.profiles(id),
    type TEXT CHECK (type IN ('production', 'qc', 'maintenance', 'warehouse')),
    status TEXT DEFAULT 'pending', -- 'running', 'done'
    
    -- Execution Timing
    planned_start TIMESTAMPTZ,
    actual_start TIMESTAMPTZ,
    actual_end TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.task_checklists (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    task_id UUID REFERENCES public.tasks(id) ON DELETE CASCADE,
    instruction TEXT NOT NULL,
    is_completed BOOLEAN DEFAULT false
);

CREATE TABLE public.defects (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    task_id UUID REFERENCES public.tasks(id),
    defect_code TEXT NOT NULL, -- "WEFT_BAR"
    severity TEXT CHECK (severity IN ('minor', 'major', 'critical')),
    photo_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.downtime_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    machine_id UUID REFERENCES public.machines(id),
    task_id UUID REFERENCES public.tasks(id),
    reason TEXT NOT NULL,
    start_time TIMESTAMPTZ DEFAULT NOW(),
    end_time TIMESTAMPTZ,
    duration_minutes INT GENERATED ALWAYS AS (EXTRACT(EPOCH FROM (end_time - start_time))/60) STORED
);

-- ==========================================
-- 5. ACCOUNTANT MODULE (Finance)
-- Invoices, Ledger, Stock Moves, Reconciliation
-- ==========================================
CREATE TABLE public.invoices (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    invoice_number TEXT NOT NULL UNIQUE,
    partner_id UUID REFERENCES public.partners(id),
    type TEXT NOT NULL, -- 'customer_invoice', 'vendor_bill'
    
    amount_total DECIMAL NOT NULL,
    amount_residual DECIMAL NOT NULL,
    date_due DATE NOT NULL,
    status TEXT DEFAULT 'draft',
    
    -- Collections AI
    reminder_level INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.collection_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    invoice_id UUID REFERENCES public.invoices(id),
    action_type TEXT, -- 'email', 'call'
    outcome TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.stock_moves (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    product_id UUID REFERENCES public.products(id),
    quantity DECIMAL NOT NULL, -- (+/-)
    location_from TEXT,
    location_to TEXT,
    reference_doc TEXT, -- Link to Task or Invoice
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.general_ledger (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    account_code TEXT NOT NULL, -- "10100" (Cash), "40000" (Revenue)
    debit DECIMAL DEFAULT 0,
    credit DECIMAL DEFAULT 0,
    reference TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Bank Reconciliation
CREATE TABLE public.bank_transactions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    date DATE NOT NULL,
    description TEXT NOT NULL,
    amount DECIMAL NOT NULL,
    is_reconciled BOOLEAN DEFAULT false
);

CREATE TABLE public.reconciliation_suggestions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    bank_transaction_id UUID REFERENCES public.bank_transactions(id),
    matched_invoice_id UUID REFERENCES public.invoices(id),
    ai_confidence_score FLOAT CHECK (ai_confidence_score BETWEEN 0.0 AND 1.0)
);

-- ==========================================
-- 6. CEO MODULE (Strategy)
-- Goals, Snapshots, Alerts
-- ==========================================
CREATE TABLE public.company_goals (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title TEXT NOT NULL,
    target_value DECIMAL NOT NULL,
    current_value DECIMAL DEFAULT 0,
    status TEXT DEFAULT 'on_track', -- 'at_risk'
    end_date DATE NOT NULL
);

CREATE TABLE public.executive_snapshots (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    snapshot_date DATE NOT NULL,
    total_revenue DECIMAL DEFAULT 0,
    net_profit DECIMAL DEFAULT 0,
    avg_oee_score FLOAT DEFAULT 0,
    defect_rate FLOAT DEFAULT 0
);

CREATE TABLE public.system_alerts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    message TEXT NOT NULL,
    severity TEXT CHECK (severity IN ('info', 'warning', 'critical')),
    is_acknowledged BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 3. Automation Logic ("The Golden Thread")

These triggers are the brain of the ERP. They ensure that an action in one role instantly reflects in others.

### Trigger A: Downtime -> CEO Alert
**Problem:** CEO dashboard is often "green" even when machines are down because manual reporting is slow.
**Solution:**
```sql
CREATE OR REPLACE FUNCTION handle_machine_down() RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.machines SET status = 'breakdown' WHERE id = NEW.machine_id;
    INSERT INTO public.system_alerts (message, severity)
    VALUES ('Machine ' || NEW.machine_id || ' reported DOWN: ' || NEW.reason, 'critical');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

### Trigger B: Production Done -> Financial Asset
**Problem:** Finance team doesn't know about new inventory until end-of-month stock count.
**Solution:** Every time a staff member finishes a task:
1.  **Inventory:** A `stock_move` is created (+1 unit).
2.  **Accounting:** A Double-Entry Ledger Transaction is posted automatically.
    *   **Debit:** Finished Goods (Asset)
    *   **Credit:** Work in Process (Asset Reduction)

```sql
CREATE OR REPLACE FUNCTION handle_production_done() RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'completed' AND NEW.type = 'production' THEN
        INSERT INTO public.stock_moves (...) VALUES (...);
        UPDATE public.production_orders SET quantity_actual = quantity_actual + 1 ...;
        INSERT INTO public.general_ledger (...) VALUES (...);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

---

## 4. Design Decisions & Rationale

*   **`profiles` vs `auth.users`**: We keep ERP-specific data (shift, station) in `profiles` to keep the Auth table clean.
*   **`partners.payment_behavior_score`**: This is an AI-calculated field (0-10) updated nightly based on average days overdue.
*   **`executive_snapshots`**: This is a "Data Warehouse" table. Instead of querying millions of invoice rows for a dashboard, we aggregate them nightly into this table for instant load times.
*   **`reconciliation_suggestions`**: Designed for the AI Agent. It stores "Draft Matches" (Bank TX <-> Invoice) with a confidence score, waiting for human approval.

---

## 5. Real-Time Capabilities

Supabase Realtime is ENABLED on these tables to drive the UI:
1.  `public.tasks` -> Updates the Shop Floor Tablet instantly.
2.  `public.machines` -> Updates the Manager's Digital Twin Map.
3.  `public.system_alerts` -> Pop-up notifications for the CEO.
4.  `public.executive_snapshots` -> Live ticking charts.

---

**End of Specification.**
