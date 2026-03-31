/**
 * Clear all business data from the database.
 * Keeps: users, accounts, sessions, system_roles, verificationtokens
 * Deletes: everything else (CASCADE handles FK dependencies)
 *
 * Usage: npx tsx scripts/clear-business-data.ts
 */

import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

const TABLES_TO_CLEAR = [
  // Finance - child tables first
  "journal_lines",
  "journal_entries",
  "invoice_items",
  "invoice_attachments",
  "payments",
  "withholding_taxes",
  "invoices",
  "gl_accounts",
  "fiscal_periods",
  "petty_cash_transactions",
  "debit_credit_note_items",
  "debit_credit_note_settlements",
  "debit_credit_notes",
  "bank_reconciliation_items",
  "bank_reconciliations",
  "budget_lines",
  "budgets",
  "currencies",
  "exchange_rates",
  "cashflow_plan_items",
  "cashflow_snapshots",
  "cashflow_scenarios",

  // Fixed Assets
  "fixed_asset_deprec_entries",
  "fixed_asset_deprec_schedules",
  "fixed_asset_deprec_runs",
  "fixed_asset_movements",
  "fixed_assets",
  "fixed_asset_categories",

  // Procurement - child tables first
  "grn_items",
  "goods_received_notes",
  "purchase_order_events",
  "purchase_order_items",
  "purchase_orders",
  "purchase_request_items",
  "purchase_requests",
  "supplier_products",
  "supplier_categories",
  "suppliers",

  // Sales - child tables first
  "quotation_items",
  "quotations",
  "sales_order_items",
  "sales_orders",
  "leads",
  "price_list_items",
  "price_lists",
  "customer_addresses",
  "customer_contacts",
  "customers",
  "customer_categories",
  "payment_terms",
  "payment_term_lines",
  "salespersons",
  "discount_schemes",

  // Manufacturing
  "routing_steps",
  "routings",
  "bom_items",
  "bill_of_materials",
  "production_bom_step_materials",
  "production_bom_steps",
  "production_bom_items",
  "production_bom_allocations",
  "production_bom_attachments",
  "production_boms",
  "bom_templates",
  "bom_edit_logs",
  "work_orders",
  "maintenance_logs",
  "machines",
  "work_center_groups",
  "work_center_calendars",
  "shift_notes",
  "machine_downtime_logs",
  "operator_skills",
  "quality_inspections",
  "inspection_defects",
  "garment_measurements",
  "process_stations",
  "garment_cost_sheets",
  "cost_sheet_items",
  "cut_plan_layers",
  "cut_plan_outputs",
  "cut_plans",
  "style_variants",
  "subcontract_shipments",
  "subcontract_order_items",
  "subcontract_orders",
  "subcontractor_rates",
  "subcontractors",

  // Inventory
  "fabric_roll_transactions",
  "fabric_rolls",
  "stock_audit_items",
  "stock_audits",
  "stock_alerts",
  "inventory_transactions",
  "stock_levels",
  "stock_reservations",
  "stock_transfers",
  "cost_layers",
  "uom_conversions",
  "locations",
  "products",
  "warehouses",
  "categories",
  "units",
  "brands",
  "colors",

  // HCM
  "attendance",
  "leave_requests",
  "employee_tasks",
  "onboarding_progress",
  "onboarding_templates",
  "employees",

  // Executive
  "executive_snapshots",
  "strategic_goals",
  "ceo_flags",
  "flag_status",
  "audit_logs",

  // System (non-auth)
  "tenant_config",
  "system_settings",
]

async function main() {
  console.log("🗑️  Clearing all business data (keeping auth tables)...\n")

  let cleared = 0
  let skipped = 0

  for (const table of TABLES_TO_CLEAR) {
    try {
      await prisma.$executeRawUnsafe(`TRUNCATE TABLE "${table}" CASCADE`)
      console.log(`  ✓ ${table}`)
      cleared++
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      if (msg.includes("does not exist")) {
        console.log(`  - ${table} (not found, skipping)`)
        skipped++
      } else {
        console.error(`  ✗ ${table}: ${msg}`)
      }
    }
  }

  console.log(`\n✅ Done. Cleared ${cleared} tables, skipped ${skipped}.`)
  console.log("🔒 Auth tables preserved: users, accounts, sessions, system_roles, verificationtokens")
}

main()
  .catch((e) => {
    console.error("Fatal error:", e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
