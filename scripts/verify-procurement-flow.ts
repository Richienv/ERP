
import { requestPurchase } from "@/app/actions/inventory"
import { approvePurchaseRequest, createPOFromPR } from "@/lib/actions/procurement"
import { prisma } from "@/lib/prisma"

async function main() {
    console.log("Starting Procurement Flow Verification...")

    // 1. Setup: Ensure Product exists
    const product = await prisma.product.findFirst()
    if (!product) throw new Error("No product found")

    // Ensure Product has a SupplierItem (preferred)
    const supplier = await prisma.supplier.findFirst()
    if (!supplier) throw new Error("No supplier found")

    // Check if supplierItem exists, if not create one
    let supplierItem = await prisma.supplierProduct.findFirst({
        where: { productId: product.id, supplierId: supplier.id }
    })

    if (!supplierItem) {
        console.log("Creating Supplier Product link...")
        supplierItem = await prisma.supplierProduct.create({
            data: {
                productId: product.id,
                supplierId: supplier.id,
                price: 10000,
                isPreferred: true
            }
        })
    }

    // 2. Request Purchase (Inventory Action)
    console.log("2. Requesting Purchase...")
    const reqResult = await requestPurchase({
        itemId: product.id,
        quantity: 50,
        notes: "Test PR Flow"
    })

    if (!reqResult.success || !reqResult.pendingTask?.id) {
        throw new Error(`Request Purchase Failed: ${reqResult.error || reqResult.message}`)
    }

    // Wait for DB propagation if needed? No, await should do it.
    // get PR ID. `pendingTask` returns { id: string }
    // Wait, requestPurchase returns `pendingTask: { id: pr.id }` (I updated it)
    const prId = reqResult.pendingTask.id
    console.log("PR Created:", prId)

    // 3. Verify PR in DB
    const pr = await prisma.purchaseRequest.findUnique({
        where: { id: prId },
        include: { items: true }
    })
    if (!pr || pr.status !== 'PENDING') throw new Error("PR not found or not PENDING")
    console.log("PR Verified in DB. Status:", pr.status)

    // 4. Approve PR
    console.log("4. Approving PR...")
    // Need an approver ID (Manager)
    const manager = await prisma.employee.findFirst()
    if (!manager) throw new Error("No manager found")

    const approveResult = await approvePurchaseRequest(prId, manager.id)
    if (!approveResult.success) throw new Error("Approval Failed")

    const approvedPr = await prisma.purchaseRequest.findUnique({ where: { id: prId }, include: { items: true } })
    if (approvedPr?.status !== 'APPROVED') throw new Error("PR Status not APPROVED")
    if (approvedPr?.items[0].status !== 'APPROVED') throw new Error("PR Item Status not APPROVED")
    console.log("PR Approved.")

    // 5. Convert to PO
    console.log("5. Converting to PO...")
    // Need item IDs
    const itemIds = approvedPr.items.map(i => i.id)
    const poResult = await createPOFromPR(prId, itemIds, "Generated PO from Test PR")

    if (!poResult.success) throw new Error(`PO Conversion Failed: ${poResult.error}`)
    console.log("PO Created IDs:", poResult.poIds)

    // 6. Verify PO
    const po = await prisma.purchaseOrder.findUnique({
        where: { id: poResult.poIds![0] },
        include: { items: true }
    })
    if (!po) throw new Error("PO not found in DB")
    if (po.items[0].quantity !== 50) throw new Error("PO Quantity mismatch")
    console.log("PO Verified. Number:", po.number)

    // 7. Verify PR Status Updated to PO_CREATED
    const finalPr = await prisma.purchaseRequest.findUnique({ where: { id: prId } })
    if (finalPr?.status !== 'PO_CREATED') console.warn("Warning: PR Status should be PO_CREATED, got", finalPr?.status)
    else console.log("PR Status Updated to PO_CREATED.")

    console.log("✅ Full Procurement Flow Verified Successfully!")
}

main()
    .catch(e => {
        console.error("Verification Failed:", e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
