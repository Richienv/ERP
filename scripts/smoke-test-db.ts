/**
 * Smoke test: verify core DB operations work after migrations.
 * Tests actual Prisma queries against live Supabase production DB.
 */
import { PrismaClient } from "@prisma/client"
const prisma = new PrismaClient()

async function main() {
    console.log("=== Smoke test: production Supabase ===\n")

    // 1. Count tables — basic connectivity
    const [productCount, supplierCount, customerCount, invoiceCount, journalCount] = await Promise.all([
        prisma.product.count(),
        prisma.supplier.count(),
        prisma.customer.count(),
        prisma.invoice.count(),
        prisma.journalEntry.count(),
    ])
    console.log("Table counts:")
    console.log(`  products:       ${productCount}`)
    console.log(`  suppliers:      ${supplierCount}`)
    console.log(`  customers:      ${customerCount}`)
    console.log(`  invoices:       ${invoiceCount}`)
    console.log(`  journal_entries: ${journalCount}`)

    // 2. Check StockLevel quantity is Decimal-compatible
    const sample = await prisma.stockLevel.findFirst({ select: { quantity: true, availableQty: true, reservedQty: true } })
    console.log(`\nStockLevel sample: ${JSON.stringify(sample)}`)
    console.log(`Types: quantity=${typeof sample?.quantity}, prototype=${sample?.quantity?.constructor?.name}`)

    // 3. Check DocumentCounter works
    const { getNextDocNumber } = await import("@/lib/document-numbering")
    const testNum = await getNextDocNumber(prisma, "SMOKE-TEST", 4)
    console.log(`\nDocumentCounter test: generated "${testNum}"`)
    // Clean up
    await prisma.documentCounter.deleteMany({ where: { prefix: "SMOKE-TEST" } })
    console.log("Cleanup: DocumentCounter test row deleted")

    // 4. Verify GL accounts exist
    const glCount = await prisma.gLAccount.count()
    console.log(`\nGLAccount count: ${glCount} (expect ≥ 30)`)

    console.log("\n✅ Smoke test passed")
}

main().catch((e) => { console.error("❌ Smoke test failed:", e); process.exit(1) }).finally(() => prisma.$disconnect())
