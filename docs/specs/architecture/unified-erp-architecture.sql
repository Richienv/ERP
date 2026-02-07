-- UNIFIED ERP MASTER SCHEMA
-- Connecting: Staff (Execution) <-> Manager (Ops) <-> Accountant (Finance) <-> CEO (Strategy)

-- ==========================================
-- 1. CORE IDENTITY & PROFILES
-- ==========================================
CREATE TYPE user_role AS ENUM ('staff', 'manager', 'accountant', 'ceo', 'admin');

CREATE TABLE public.profiles (
    id UUID REFERENCES auth.users(id) PRIMARY KEY,
    full_name TEXT NOT NULL,
    role user_role NOT NULL,
    department TEXT, -- 'weaving', 'finance', 'executive'
    current_shift TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- 2. PARTNERS (CRM / VENDOR / CUSTOMER)
-- Used by: Accountant (Invoices), Manager (PO)
-- ==========================================
CREATE TABLE public.partners (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT CHECK (type IN ('customer', 'supplier', 'both')),
    email TEXT,
    payment_behavior_score FLOAT DEFAULT 10.0, -- AI Score
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- 3. PRODUCTS & INVENTORY (The Physical Goods)
-- Connecting Ops to Finance
-- ==========================================
CREATE TABLE public.products (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    sku TEXT UNIQUE NOT NULL,
    cost_price DECIMAL DEFAULT 0, -- Standard Cost
    sales_price DECIMAL DEFAULT 0,
    stock_quantity DECIMAL DEFAULT 0, -- Updated via Triggers
    unit TEXT DEFAULT 'pcs'
);

-- STOCK MOVES (The Ledger of Things)
-- Every production/shipment creates a row here
CREATE TABLE public.stock_moves (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    product_id UUID REFERENCES public.products(id),
    quantity DECIMAL NOT NULL, -- Positive (In) or Negative (Out)
    location_from TEXT,
    location_to TEXT,
    reference_doc TEXT, -- "WO-2024-001" or "INV-001"
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- 4. OPERATIONS (Machines & Orders)
-- Domain: Manager
-- ==========================================
CREATE TABLE public.machines (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    status TEXT DEFAULT 'idle', -- idle, running, breakdown
    oee_score FLOAT DEFAULT 100.0,
    current_operator_id UUID REFERENCES public.profiles(id)
);

CREATE TABLE public.production_orders (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    order_number TEXT UNIQUE NOT NULL,
    product_id UUID REFERENCES public.products(id),
    quantity_planned DECIMAL NOT NULL,
    quantity_actual DECIMAL DEFAULT 0, -- Updates via Task Trigger
    status TEXT DEFAULT 'draft',
    start_date TIMESTAMPTZ,
    end_date TIMESTAMPTZ
);

-- ==========================================
-- 5. EXECUTION (Tasks & Logs)
-- Domain: Staff -> Feeds Manager
-- ==========================================
CREATE TABLE public.tasks (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    production_order_id UUID REFERENCES public.production_orders(id), -- THE KEY LINK
    title TEXT NOT NULL,
    assigned_to UUID REFERENCES public.profiles(id),
    type TEXT CHECK (type IN ('production', 'maintenance', 'qc')),
    status TEXT DEFAULT 'pending',
    metrics_result JSONB, -- For QC values
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- DOWNTIME LOGS (The Alert Trigger)
CREATE TABLE public.downtime_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    machine_id UUID REFERENCES public.machines(id),
    reason TEXT,
    duration_minutes INT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- 6. FINANCE (Money)
-- Domain: Accountant
-- ==========================================
CREATE TABLE public.invoices (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    partner_id UUID REFERENCES public.partners(id),
    type TEXT NOT NULL, -- customer_invoice / vendor_bill
    amount_total DECIMAL NOT NULL,
    amount_residual DECIMAL NOT NULL,
    date_due DATE,
    status TEXT DEFAULT 'draft'
);

CREATE TABLE public.general_ledger (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    account_code TEXT NOT NULL,
    reference TEXT,
    debit DECIMAL DEFAULT 0,
    credit DECIMAL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- 7. STRATEGY (CEO)
-- ==========================================
CREATE TABLE public.system_alerts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    message TEXT NOT NULL,
    severity TEXT CHECK (severity IN ('info', 'critical')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.executive_snapshots (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    date DATE NOT NULL,
    total_revenue DECIMAL,
    avg_oee FLOAT
);

-- ==========================================
-- 8. AUTOMATION TRIGGERS (The "Magic Glue")
-- ==========================================

-- TRIGGER A: Downtime -> Machine Status + System Alert
CREATE OR REPLACE FUNCTION handle_machine_down() RETURNS TRIGGER AS $$
BEGIN
    -- 1. Set Machine to Breakdown
    UPDATE public.machines SET status = 'breakdown' WHERE id = NEW.machine_id;
    -- 2. Alert the CEO/Manager
    INSERT INTO public.system_alerts (message, severity)
    VALUES ('Machine ' || NEW.machine_id || ' reported DOWN: ' || NEW.reason, 'critical');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_downtime_logged
AFTER INSERT ON public.downtime_logs
FOR EACH ROW EXECUTE FUNCTION handle_machine_down();

-- TRIGGER B: Task Done -> Inventory Move
CREATE OR REPLACE FUNCTION handle_production_done() RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'completed' AND NEW.type = 'production' THEN
        -- 1. Create Stock Move (+1 Product)
        INSERT INTO public.stock_moves (product_id, quantity, reference_doc, location_to)
        VALUES ((SELECT product_id FROM production_orders WHERE id = NEW.production_order_id), 1, 'Task-' || NEW.id, 'Warehouse');
        
        -- 2. Update Production Order Actuals
        UPDATE public.production_orders 
        SET quantity_actual = quantity_actual + 1 
        WHERE id = NEW.production_order_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_task_completed
AFTER UPDATE ON public.tasks
FOR EACH ROW EXECUTE FUNCTION handle_production_done();
