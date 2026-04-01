-- Migration: Change DECIMAL(15,2) to DECIMAL(20,2) for all financial amount columns
-- Run this on production Supabase SQL Editor if `prisma db push` can't connect
-- 97 columns across 37 tables

ALTER TABLE "products"
  ALTER COLUMN "costPrice" TYPE DECIMAL(20,2),
  ALTER COLUMN "sellingPrice" TYPE DECIMAL(20,2);

ALTER TABLE "inventory_transactions"
  ALTER COLUMN "unitCost" TYPE DECIMAL(20,2),
  ALTER COLUMN "totalValue" TYPE DECIMAL(20,2);

ALTER TABLE "customers"
  ALTER COLUMN "creditLimit" TYPE DECIMAL(20,2),
  ALTER COLUMN "totalOrderValue" TYPE DECIMAL(20,2);

ALTER TABLE "price_list_items"
  ALTER COLUMN "price" TYPE DECIMAL(20,2);

ALTER TABLE "quotations"
  ALTER COLUMN "subtotal" TYPE DECIMAL(20,2),
  ALTER COLUMN "taxAmount" TYPE DECIMAL(20,2),
  ALTER COLUMN "discountAmount" TYPE DECIMAL(20,2),
  ALTER COLUMN "total" TYPE DECIMAL(20,2);

ALTER TABLE "quotation_items"
  ALTER COLUMN "unitPrice" TYPE DECIMAL(20,2),
  ALTER COLUMN "lineTotal" TYPE DECIMAL(20,2);

ALTER TABLE "sales_orders"
  ALTER COLUMN "subtotal" TYPE DECIMAL(20,2),
  ALTER COLUMN "taxAmount" TYPE DECIMAL(20,2),
  ALTER COLUMN "discountAmount" TYPE DECIMAL(20,2),
  ALTER COLUMN "total" TYPE DECIMAL(20,2);

ALTER TABLE "sales_order_items"
  ALTER COLUMN "unitPrice" TYPE DECIMAL(20,2),
  ALTER COLUMN "lineTotal" TYPE DECIMAL(20,2);

ALTER TABLE "leads"
  ALTER COLUMN "estimatedValue" TYPE DECIMAL(20,2);

ALTER TABLE "executive_snapshots"
  ALTER COLUMN "totalRevenue" TYPE DECIMAL(20,2),
  ALTER COLUMN "totalCost" TYPE DECIMAL(20,2),
  ALTER COLUMN "netProfit" TYPE DECIMAL(20,2),
  ALTER COLUMN "cashBalance" TYPE DECIMAL(20,2),
  ALTER COLUMN "accountsReceivable" TYPE DECIMAL(20,2),
  ALTER COLUMN "accountsPayable" TYPE DECIMAL(20,2),
  ALTER COLUMN "burnRate" TYPE DECIMAL(20,2);

ALTER TABLE "strategic_goals"
  ALTER COLUMN "targetValue" TYPE DECIMAL(20,2),
  ALTER COLUMN "actualValue" TYPE DECIMAL(20,2);

ALTER TABLE "supplier_products"
  ALTER COLUMN "price" TYPE DECIMAL(20,2);

ALTER TABLE "purchase_orders"
  ALTER COLUMN "totalAmount" TYPE DECIMAL(20,2),
  ALTER COLUMN "taxAmount" TYPE DECIMAL(20,2),
  ALTER COLUMN "netAmount" TYPE DECIMAL(20,2),
  ALTER COLUMN "landedCostTotal" TYPE DECIMAL(20,2);

ALTER TABLE "purchase_order_items"
  ALTER COLUMN "unitPrice" TYPE DECIMAL(20,2),
  ALTER COLUMN "totalPrice" TYPE DECIMAL(20,2);

ALTER TABLE "grn_items"
  ALTER COLUMN "unitCost" TYPE DECIMAL(20,2);

ALTER TABLE "employees"
  ALTER COLUMN "baseSalary" TYPE DECIMAL(20,2),
  ALTER COLUMN "hourlyRate" TYPE DECIMAL(20,2),
  ALTER COLUMN "pieceRate" TYPE DECIMAL(20,2);

ALTER TABLE "work_orders"
  ALTER COLUMN "estimatedCostTotal" TYPE DECIMAL(20,2),
  ALTER COLUMN "actualCostTotal" TYPE DECIMAL(20,2);

ALTER TABLE "invoices"
  ALTER COLUMN "subtotal" TYPE DECIMAL(20,2),
  ALTER COLUMN "taxAmount" TYPE DECIMAL(20,2),
  ALTER COLUMN "discountAmount" TYPE DECIMAL(20,2),
  ALTER COLUMN "totalAmount" TYPE DECIMAL(20,2),
  ALTER COLUMN "balanceDue" TYPE DECIMAL(20,2),
  ALTER COLUMN "amountInIDR" TYPE DECIMAL(20,2);

ALTER TABLE "invoice_items"
  ALTER COLUMN "unitPrice" TYPE DECIMAL(20,2),
  ALTER COLUMN "amount" TYPE DECIMAL(20,2);

ALTER TABLE "payments"
  ALTER COLUMN "amount" TYPE DECIMAL(20,2),
  ALTER COLUMN "whtAmount" TYPE DECIMAL(20,2);

ALTER TABLE "withholding_taxes"
  ALTER COLUMN "baseAmount" TYPE DECIMAL(20,2),
  ALTER COLUMN "amount" TYPE DECIMAL(20,2);

ALTER TABLE "machines"
  ALTER COLUMN "overheadMaterialCostPerHour" TYPE DECIMAL(20,2);

ALTER TABLE "maintenance_logs"
  ALTER COLUMN "cost" TYPE DECIMAL(20,2);

ALTER TABLE "gl_accounts"
  ALTER COLUMN "balance" TYPE DECIMAL(20,2);

ALTER TABLE "journal_lines"
  ALTER COLUMN "debit" TYPE DECIMAL(20,2),
  ALTER COLUMN "credit" TYPE DECIMAL(20,2);

ALTER TABLE "subcontractor_rates"
  ALTER COLUMN "ratePerUnit" TYPE DECIMAL(20,2);

ALTER TABLE "garment_cost_sheets"
  ALTER COLUMN "targetPrice" TYPE DECIMAL(20,2),
  ALTER COLUMN "totalCost" TYPE DECIMAL(20,2);

ALTER TABLE "cost_sheet_items"
  ALTER COLUMN "unitCost" TYPE DECIMAL(20,2),
  ALTER COLUMN "totalCost" TYPE DECIMAL(20,2),
  ALTER COLUMN "actualUnitCost" TYPE DECIMAL(20,2),
  ALTER COLUMN "actualTotalCost" TYPE DECIMAL(20,2);

ALTER TABLE "bank_accounts"
  ALTER COLUMN "openingBalance" TYPE DECIMAL(20,2);

ALTER TABLE "bank_reconciliations"
  ALTER COLUMN "bankStatementBalance" TYPE DECIMAL(20,2),
  ALTER COLUMN "bookBalanceSnapshot" TYPE DECIMAL(20,2);

ALTER TABLE "bank_reconciliation_items"
  ALTER COLUMN "bankAmount" TYPE DECIMAL(20,2);

ALTER TABLE "petty_cash_transactions"
  ALTER COLUMN "amount" TYPE DECIMAL(20,2),
  ALTER COLUMN "balanceAfter" TYPE DECIMAL(20,2);

ALTER TABLE "debit_credit_notes"
  ALTER COLUMN "subtotal" TYPE DECIMAL(20,2),
  ALTER COLUMN "ppnAmount" TYPE DECIMAL(20,2),
  ALTER COLUMN "totalAmount" TYPE DECIMAL(20,2),
  ALTER COLUMN "settledAmount" TYPE DECIMAL(20,2);

ALTER TABLE "debit_credit_note_items"
  ALTER COLUMN "quantity" TYPE DECIMAL(20,2),
  ALTER COLUMN "unitPrice" TYPE DECIMAL(20,2),
  ALTER COLUMN "amount" TYPE DECIMAL(20,2),
  ALTER COLUMN "ppnAmount" TYPE DECIMAL(20,2),
  ALTER COLUMN "totalAmount" TYPE DECIMAL(20,2);

ALTER TABLE "debit_credit_note_settlements"
  ALTER COLUMN "amount" TYPE DECIMAL(20,2);

ALTER TABLE "budget_lines"
  ALTER COLUMN "amount" TYPE DECIMAL(20,2);

ALTER TABLE "discount_schemes"
  ALTER COLUMN "value" TYPE DECIMAL(20,2),
  ALTER COLUMN "minOrderValue" TYPE DECIMAL(20,2);

ALTER TABLE "CashflowScenario"
  ALTER COLUMN "totalIn" TYPE DECIMAL(20,2),
  ALTER COLUMN "totalOut" TYPE DECIMAL(20,2),
  ALTER COLUMN "netFlow" TYPE DECIMAL(20,2);

ALTER TABLE "fixed_assets"
  ALTER COLUMN "purchaseCost" TYPE DECIMAL(20,2),
  ALTER COLUMN "residualValue" TYPE DECIMAL(20,2),
  ALTER COLUMN "accumulatedDepreciation" TYPE DECIMAL(20,2),
  ALTER COLUMN "netBookValue" TYPE DECIMAL(20,2);

ALTER TABLE "fixed_asset_deprec_schedules"
  ALTER COLUMN "depreciationAmount" TYPE DECIMAL(20,2),
  ALTER COLUMN "accumulatedAmount" TYPE DECIMAL(20,2),
  ALTER COLUMN "bookValueAfter" TYPE DECIMAL(20,2);

ALTER TABLE "fixed_asset_deprec_runs"
  ALTER COLUMN "totalDepreciation" TYPE DECIMAL(20,2);

ALTER TABLE "fixed_asset_deprec_entries"
  ALTER COLUMN "depreciationAmount" TYPE DECIMAL(20,2),
  ALTER COLUMN "accumulatedAfter" TYPE DECIMAL(20,2),
  ALTER COLUMN "bookValueAfter" TYPE DECIMAL(20,2);

ALTER TABLE "fixed_asset_movements"
  ALTER COLUMN "proceeds" TYPE DECIMAL(20,2),
  ALTER COLUMN "gainLoss" TYPE DECIMAL(20,2);
