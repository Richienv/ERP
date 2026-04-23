import { PrismaClient } from "@prisma/client"
const prisma = new PrismaClient()
async function main() {
    const checks: any = await prisma.$queryRawUnsafe(`
        SELECT
            (SELECT data_type FROM information_schema.columns WHERE table_name = 'stock_levels' AND column_name = 'quantity') as stock_qty_type,
            (SELECT column_name FROM information_schema.columns WHERE table_name = 'suppliers' AND column_name = 'npwp') as supplier_npwp,
            (SELECT column_name FROM information_schema.columns WHERE table_name = 'purchase_order_items' AND column_name = 'purchaseRequestItemId') as po_item_pr_fk,
            (SELECT table_name FROM information_schema.tables WHERE table_name = 'document_counters') as doc_counter,
            (SELECT table_name FROM information_schema.views WHERE table_name = 'mv_inventory_status') as mv_view,
            (SELECT matviewname FROM pg_matviews WHERE matviewname = 'mv_inventory_status') as mv_matview
    `)
    console.log(JSON.stringify(checks[0], null, 2))
}
main().catch(console.error).finally(() => prisma.$disconnect())
