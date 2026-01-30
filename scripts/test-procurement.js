
// Simple test script for procurement stats
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function testGetProcurementStats() {
    console.log("🚀 Testing getProcurementStats logic...")

    try {
        // 1. Spend Velocity (Current Month vs Last Month)
        const now = new Date()
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
        const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
        const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0)

        console.log("Querying currentMonthSpend...")
        const currentMonthSpend = await prisma.purchaseOrder.aggregate({
            _sum: { totalAmount: true },
            where: {
                status: { in: ["OPEN", "PARTIAL", "COMPLETED", "RECEIVED"] },
                createdAt: { gte: startOfMonth }
            }
        })
        console.log("✅ currentMonthSpend:", currentMonthSpend)

        console.log("Querying lastMonthSpend...")
        const lastMonthSpend = await prisma.purchaseOrder.aggregate({
            _sum: { totalAmount: true },
            where: {
                status: { in: ["OPEN", "PARTIAL", "COMPLETED", "RECEIVED"] },
                createdAt: { gte: startOfLastMonth, lte: endOfLastMonth }
            }
        })
        console.log("✅ lastMonthSpend:", lastMonthSpend)

        const currentSpend = Number(currentMonthSpend._sum?.totalAmount || 0)
        const lastSpend = Number(lastMonthSpend._sum?.totalAmount || 0)
        const spendGrowth = lastSpend > 0 ? ((currentSpend - lastSpend) / lastSpend) * 100 : 0
        console.log("✅ Spend analysis:", { currentSpend, lastSpend, spendGrowth })

        // 2. Urgent Needs (Low Stock Items)
        console.log("Querying lowStockCount...")
        const lowStockCount = await prisma.product.count({
            where: {
                isActive: true,
                stockLevels: {
                    some: {
                        quantity: { lt: 10 }
                    }
                }
            }
        })
        console.log("✅ lowStockCount:", lowStockCount)

        // 3. Needs Approval (For Manager)
        console.log("Querying pendingPRs...")
        const pendingPRs = await prisma.purchaseRequest.count({
            where: { status: 'PENDING' }
        })
        console.log("✅ pendingPRs:", pendingPRs)

        // 4. Vendor Health
        console.log("Querying vendors...")
        const vendors = await prisma.supplier.findMany({ select: { rating: true, onTimeRate: true } })
        const avgRating = vendors.length > 0
            ? vendors.reduce((sum, v) => sum + v.rating, 0) / vendors.length
            : 0
        const avgOnTime = vendors.length > 0
            ? vendors.reduce((sum, v) => sum + v.onTimeRate, 0) / vendors.length
            : 0
        console.log("✅ Vendor Health:", { avgRating, avgOnTime, vendorCount: vendors.length })

        // 5. Incoming Goods (Open POs)
        console.log("Querying incomingCount...")
        const incomingCount = await prisma.purchaseOrder.count({
            where: { status: { in: ["OPEN", "PARTIAL"] } }
        })
        console.log("✅ incomingCount:", incomingCount)

        // 6. Recent Activity
        console.log("Querying recentActivity...")
        const recentActivity = await prisma.purchaseOrder.findMany({
            take: 5,
            orderBy: { createdAt: "desc" },
            include: { supplier: { select: { name: true } } }
        })
        console.log("✅ recentActivity count:", recentActivity.length)

        console.log("\n========================================")
        console.log("🎉 ALL QUERIES PASSED SUCCESSFULLY!")
        console.log("========================================")

        return {
            spend: { current: currentSpend, growth: spendGrowth },
            needsApproval: pendingPRs,
            urgentNeeds: lowStockCount,
            vendorHealth: { rating: avgRating, onTime: avgOnTime },
            incomingCount,
            recentActivity
        }

    } catch (error) {
        console.error("❌ ERROR:", error)
        throw error
    }
}

testGetProcurementStats()
    .then(result => {
        console.log("\nFinal Result:", JSON.stringify(result, null, 2))
    })
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect()
    })
