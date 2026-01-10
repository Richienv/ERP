import { Button } from "@/components/ui/button"
import { Download, Filter, Share2 } from "lucide-react"

import { ExecutiveScorecard } from "@/components/analytics/dashboard/executive-scorecard"
import { ProfitLossView } from "@/components/analytics/dashboard/profit-loss-view"
import { EfficiencyCockpit } from "@/components/analytics/dashboard/efficiency-view"
import { InventoryCashView } from "@/components/analytics/dashboard/inventory-cash-view"
import { OperationsCockpit } from "@/components/analytics/dashboard/operations-cockpit"
// import { ReportLibrarySidebar } from "@/components/analytics/dashboard/report-library" 
import { ReportCatalog } from "@/components/analytics/dashboard/report-catalog"

export default function AnalyticsPage() {
    return (
        <div className="min-h-screen w-full bg-zinc-50/50 dark:bg-black p-6 md:p-8 space-y-8">

            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Laporan & Analisis</h1>
                    <p className="text-muted-foreground">Wawasan real-time untuk kesehatan finansial & operasional.</p>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm">
                        <Filter className="mr-2 h-4 w-4" /> Filter: Bulan Ini
                    </Button>
                    <Button variant="outline" size="sm">
                        <Share2 className="mr-2 h-4 w-4" /> Share
                    </Button>
                    <Button size="sm">
                        <Download className="mr-2 h-4 w-4" /> Export PDF
                    </Button>
                </div>
            </div>

            {/* Section 1: Executive Scorecard (Visual Update) */}
            <section>
                <ExecutiveScorecard />
            </section>

            {/* Section 2: Report Library Catalog (Re-positioned) */}
            <section>
                <ReportCatalog />
            </section>

            {/* Section 3: Profit & Loss Analysis */}
            <section>
                <h3 className="text-lg font-semibold mb-4 text-zinc-800 dark:text-zinc-200 border-b pb-2">Analisis Keuntungan</h3>
                <ProfitLossView />
            </section>

            {/* Section 4: Efficiency & Production */}
            <section>
                <h3 className="text-lg font-semibold mb-4 text-zinc-800 dark:text-zinc-200 border-b pb-2">Efisiensi Produksi</h3>
                <EfficiencyCockpit />
            </section>

            {/* Section 5: Inventory & Cash Impact */}
            <section>
                <h3 className="text-lg font-semibold mb-4 text-zinc-800 dark:text-zinc-200 border-b pb-2">Kesehatan Cash & Stok</h3>
                <InventoryCashView />
            </section>

            {/* Section 5: Operations Cockpit (AI) */}
            <section>
                <h3 className="text-lg font-semibold mb-4 text-zinc-800 dark:text-zinc-200 border-b pb-2">AI Operations Assistant</h3>
                <OperationsCockpit />
            </section>

        </div>
    )
}
