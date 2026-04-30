import { AdjustmentForm } from "@/components/inventory/adjustment-form"
import { prisma } from "@/lib/db"
import { ClipboardEdit } from "lucide-react"

export const dynamic = "force-dynamic"

export default async function StockAdjustmentsPage() {
    const [warehouses, products] = await Promise.all([
        prisma.warehouse.findMany({
            where: { isActive: true },
            select: { id: true, name: true },
            orderBy: { name: "asc" },
        }),
        prisma.product.findMany({
            where: { isActive: true },
            select: { id: true, name: true, code: true, unit: true },
            orderBy: { name: "asc" },
            take: 500,
        }),
    ])

    return (
        <div className="mf-page">
            <div className="border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] overflow-hidden bg-white">
                <div className="px-6 py-4 border-l-[6px] border-l-amber-400">
                    <div className="flex items-center gap-3 mb-1">
                        <ClipboardEdit className="h-5 w-5 text-amber-500" />
                        <h1 className="text-xl font-black uppercase tracking-tight">Penyesuaian Stok</h1>
                    </div>
                    <p className="text-zinc-400 text-xs font-medium">
                        Catat penyesuaian stok masuk, keluar, atau transfer antar gudang.
                    </p>
                </div>
            </div>

            <div className="border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] bg-white p-6">
                <AdjustmentForm products={products} warehouses={warehouses} />
            </div>
        </div>
    )
}
