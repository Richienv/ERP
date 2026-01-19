
import { getLatestSnapshot } from './app/actions/dashboard.ts'
import { getFinancialMetrics } from './lib/actions/finance.ts'

async function main() {
    try {
        console.log("Testing getFinancialMetrics...")
        const metrics = await getFinancialMetrics()
        console.log("Metrics Result:", JSON.stringify(metrics, null, 2))

        console.log("Testing getLatestSnapshot (Dashboard Action)...")
        const snapshot = await getLatestSnapshot()
        console.log("Snapshot Result:", JSON.stringify(snapshot, null, 2))

    } catch (e) {
        console.error("Test Failed:", e)
    }
}

main()
