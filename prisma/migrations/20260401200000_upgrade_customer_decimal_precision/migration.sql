-- Upgrade Customer financial columns from Decimal(15,2) to Decimal(20,2)
-- Fixes "numeric field overflow" 500 error when creditLimit > Rp 9,999,999,999,999
-- Supports up to Rp 999,999,999,999,999,999 (999 quadrillion)
ALTER TABLE "customers"
  ALTER COLUMN "creditLimit" TYPE DECIMAL(20,2),
  ALTER COLUMN "totalOrderValue" TYPE DECIMAL(20,2);
