# Database Architecture - Inventory Module

## Overview
Database schema design untuk modul inventori ERP system Indonesia. Documentation ini untuk future implementation dengan database.

## Core Tables

### 1. products
```sql
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(50) UNIQUE NOT NULL,  -- Kode produk
  name VARCHAR(255) NOT NULL,        -- Nama produk
  description TEXT,                  -- Deskripsi
  category_id UUID REFERENCES categories(id),
  unit_id UUID REFERENCES units(id), -- Satuan (pcs, kg, liter, etc)
  cost_price DECIMAL(15,2),         -- Harga pokok
  selling_price DECIMAL(15,2),      -- Harga jual
  minimum_stock INTEGER DEFAULT 0,   -- Stok minimum
  maximum_stock INTEGER,             -- Stok maksimum
  reorder_point INTEGER DEFAULT 0,   -- Titik pemesanan ulang
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by UUID REFERENCES users(id),
  updated_by UUID REFERENCES users(id)
);
```

### 2. categories
```sql
CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(20) UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  parent_id UUID REFERENCES categories(id), -- Untuk hierarchical categories
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### 3. units
```sql
CREATE TABLE units (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(10) UNIQUE NOT NULL,  -- pcs, kg, ltr, m2, etc
  name VARCHAR(50) NOT NULL,         -- pieces, kilogram, liter, meter persegi
  symbol VARCHAR(10),                -- simbol satuan
  is_base_unit BOOLEAN DEFAULT false, -- satuan dasar
  conversion_factor DECIMAL(10,4) DEFAULT 1, -- faktor konversi ke satuan dasar
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### 4. warehouses
```sql
CREATE TABLE warehouses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(20) UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  address TEXT,
  city VARCHAR(100),
  province VARCHAR(100),
  postal_code VARCHAR(10),
  manager_id UUID REFERENCES employees(id),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### 5. stock_locations
```sql
CREATE TABLE stock_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  warehouse_id UUID REFERENCES warehouses(id),
  zone VARCHAR(50),     -- Zona (A, B, C)
  rack VARCHAR(50),     -- Rak (A1, A2, B1)
  shelf VARCHAR(50),    -- Shelf (1, 2, 3)
  bin VARCHAR(50),      -- Bin (A, B, C)
  location_code VARCHAR(100) UNIQUE NOT NULL, -- WH01-A-A1-1-A
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### 6. stock
```sql
CREATE TABLE stock (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES products(id),
  warehouse_id UUID REFERENCES warehouses(id),
  location_id UUID REFERENCES stock_locations(id),
  quantity_on_hand DECIMAL(15,4) DEFAULT 0,
  quantity_reserved DECIMAL(15,4) DEFAULT 0, -- Reserved untuk sales order
  quantity_available DECIMAL(15,4) DEFAULT 0, -- on_hand - reserved
  average_cost DECIMAL(15,2) DEFAULT 0,
  last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(product_id, warehouse_id, location_id)
);
```

### 7. stock_movements
```sql
CREATE TABLE stock_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES products(id),
  warehouse_id UUID REFERENCES warehouses(id),
  location_id UUID REFERENCES stock_locations(id),
  movement_type VARCHAR(20) NOT NULL, -- IN, OUT, ADJUSTMENT, TRANSFER
  movement_reason VARCHAR(50), -- PURCHASE, SALE, ADJUSTMENT, TRANSFER_IN, TRANSFER_OUT
  reference_type VARCHAR(50), -- PURCHASE_ORDER, SALES_ORDER, STOCK_ADJUSTMENT
  reference_id UUID, -- ID dari dokumen reference
  quantity DECIMAL(15,4) NOT NULL,
  unit_cost DECIMAL(15,2),
  total_cost DECIMAL(15,2),
  quantity_before DECIMAL(15,4),
  quantity_after DECIMAL(15,4),
  notes TEXT,
  movement_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by UUID REFERENCES users(id)
);
```

### 8. stock_adjustments
```sql
CREATE TABLE stock_adjustments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  adjustment_number VARCHAR(50) UNIQUE NOT NULL,
  warehouse_id UUID REFERENCES warehouses(id),
  adjustment_date DATE NOT NULL,
  adjustment_type VARCHAR(20) NOT NULL, -- INCREASE, DECREASE, RECOUNT
  reason VARCHAR(100),
  notes TEXT,
  status VARCHAR(20) DEFAULT 'DRAFT', -- DRAFT, APPROVED, POSTED
  total_value DECIMAL(15,2) DEFAULT 0,
  approved_by UUID REFERENCES users(id),
  approved_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by UUID REFERENCES users(id)
);
```

### 9. stock_adjustment_lines
```sql
CREATE TABLE stock_adjustment_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  adjustment_id UUID REFERENCES stock_adjustments(id),
  product_id UUID REFERENCES products(id),
  location_id UUID REFERENCES stock_locations(id),
  quantity_system DECIMAL(15,4), -- Qty di system
  quantity_physical DECIMAL(15,4), -- Qty hasil physical count
  quantity_difference DECIMAL(15,4), -- Selisih
  unit_cost DECIMAL(15,2),
  total_value DECIMAL(15,2),
  notes TEXT
);
```

### 10. stock_transfers
```sql
CREATE TABLE stock_transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transfer_number VARCHAR(50) UNIQUE NOT NULL,
  from_warehouse_id UUID REFERENCES warehouses(id),
  to_warehouse_id UUID REFERENCES warehouses(id),
  transfer_date DATE NOT NULL,
  status VARCHAR(20) DEFAULT 'DRAFT', -- DRAFT, APPROVED, IN_TRANSIT, RECEIVED
  notes TEXT,
  approved_by UUID REFERENCES users(id),
  approved_at TIMESTAMP,
  shipped_by UUID REFERENCES users(id),
  shipped_at TIMESTAMP,
  received_by UUID REFERENCES users(id),
  received_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by UUID REFERENCES users(id)
);
```

### 11. stock_transfer_lines
```sql
CREATE TABLE stock_transfer_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transfer_id UUID REFERENCES stock_transfers(id),
  product_id UUID REFERENCES products(id),
  from_location_id UUID REFERENCES stock_locations(id),
  to_location_id UUID REFERENCES stock_locations(id),
  quantity_shipped DECIMAL(15,4),
  quantity_received DECIMAL(15,4),
  unit_cost DECIMAL(15,2),
  notes TEXT
);
```

## Indexes

```sql
-- Product indexes
CREATE INDEX idx_products_code ON products(code);
CREATE INDEX idx_products_category ON products(category_id);
CREATE INDEX idx_products_active ON products(is_active);

-- Stock indexes
CREATE INDEX idx_stock_product_warehouse ON stock(product_id, warehouse_id);
CREATE INDEX idx_stock_warehouse ON stock(warehouse_id);
CREATE INDEX idx_stock_location ON stock(location_id);

-- Stock movements indexes
CREATE INDEX idx_stock_movements_product ON stock_movements(product_id);
CREATE INDEX idx_stock_movements_warehouse ON stock_movements(warehouse_id);
CREATE INDEX idx_stock_movements_date ON stock_movements(movement_date);
CREATE INDEX idx_stock_movements_type ON stock_movements(movement_type);
CREATE INDEX idx_stock_movements_reference ON stock_movements(reference_type, reference_id);
```

## Views

### Current Stock View
```sql
CREATE VIEW view_current_stock AS
SELECT 
  p.id as product_id,
  p.code as product_code,
  p.name as product_name,
  c.name as category_name,
  u.symbol as unit_symbol,
  w.id as warehouse_id,
  w.name as warehouse_name,
  s.quantity_on_hand,
  s.quantity_reserved,
  s.quantity_available,
  s.average_cost,
  p.minimum_stock,
  p.reorder_point,
  CASE 
    WHEN s.quantity_available <= p.reorder_point THEN 'LOW_STOCK'
    WHEN s.quantity_available <= p.minimum_stock THEN 'CRITICAL'
    ELSE 'NORMAL'
  END as stock_status
FROM stock s
JOIN products p ON s.product_id = p.id
JOIN categories c ON p.category_id = c.id
JOIN units u ON p.unit_id = u.id
JOIN warehouses w ON s.warehouse_id = w.id
WHERE p.is_active = true AND w.is_active = true;
```

### Stock Movement Summary View
```sql
CREATE VIEW view_stock_movement_summary AS
SELECT 
  product_id,
  warehouse_id,
  movement_type,
  DATE_TRUNC('month', movement_date) as month_year,
  SUM(CASE WHEN movement_type = 'IN' THEN quantity ELSE 0 END) as total_in,
  SUM(CASE WHEN movement_type = 'OUT' THEN quantity ELSE 0 END) as total_out,
  SUM(CASE WHEN movement_type = 'IN' THEN total_cost ELSE 0 END) as total_value_in,
  SUM(CASE WHEN movement_type = 'OUT' THEN total_cost ELSE 0 END) as total_value_out
FROM stock_movements
GROUP BY product_id, warehouse_id, movement_type, DATE_TRUNC('month', movement_date);
```

## Business Rules

1. **Stock Quantity**: quantity_available = quantity_on_hand - quantity_reserved
2. **Stock Movement**: Setiap perubahan stock harus dicatat di stock_movements
3. **Average Cost**: Update menggunakan weighted average method
4. **Negative Stock**: Tidak diperbolehkan (kecuali setting khusus)
5. **Location Management**: Setiap stock harus memiliki lokasi yang jelas
6. **Stock Transfer**: Harus melalui approval process
7. **Stock Adjustment**: Harus ada approval untuk nilai tertentu

## Data Validation

1. Product code harus unique dan follow format standar
2. Stock quantity tidak boleh negatif (kecuali setting khusus)
3. Movement quantity harus > 0
4. Unit cost harus >= 0
5. Reorder point <= minimum stock <= maximum stock
6. Transfer antar warehouse yang sama tidak diperbolehkan

## Future Enhancements

1. **Batch/Lot Tracking**: Untuk produk yang memerlukan tracking batch
2. **Serial Number**: Untuk produk dengan serial number
3. **Expiry Date Management**: Untuk produk dengan tanggal kadaluarsa
4. **Multi-Currency**: Support multiple currency untuk cost
5. **Barcode Integration**: QR code/barcode untuk produk
6. **Mobile Scanning**: Mobile app untuk stock counting
7. **Integration**: API untuk integration dengan sistem lain