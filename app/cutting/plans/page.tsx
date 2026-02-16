import { Suspense } from "react"
import { getCutPlans } from "@/lib/actions/cutting"
import { cutPlanStatusLabels, cutPlanStatusColors } from "@/lib/cut-plan-state-machine"
import { Scissors } from "lucide-react"

export const dynamic = "force-dynamic"

async function PlansContent() {
    const plans = await getCutPlans()

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Scissors className="h-5 w-5" />
                    <h2 className="text-sm font-black uppercase tracking-widest">
                        Daftar Cut Plan
                    </h2>
                    <span className="text-[9px] font-black px-2 py-0.5 bg-zinc-100 border-2 border-black">
                        {plans.length}
                    </span>
                </div>
            </div>

            {plans.length === 0 ? (
                <div className="bg-white border-2 border-black p-8 text-center">
                    <Scissors className="h-8 w-8 mx-auto text-zinc-300 mb-2" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">
                        Belum ada cut plan
                    </span>
                </div>
            ) : (
                <div className="bg-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] overflow-hidden">
                    <table className="w-full">
                        <thead className="bg-zinc-100 border-b-2 border-black">
                            <tr>
                                <th className="text-[10px] font-black uppercase tracking-widest text-zinc-500 px-3 py-2 text-left">
                                    No.
                                </th>
                                <th className="text-[10px] font-black uppercase tracking-widest text-zinc-500 px-3 py-2 text-left">
                                    Kain
                                </th>
                                <th className="text-[10px] font-black uppercase tracking-widest text-zinc-500 px-3 py-2 text-center">
                                    Status
                                </th>
                                <th className="text-[10px] font-black uppercase tracking-widest text-zinc-500 px-3 py-2 text-right">
                                    Layer
                                </th>
                                <th className="text-[10px] font-black uppercase tracking-widest text-zinc-500 px-3 py-2 text-right">
                                    Kain (m)
                                </th>
                                <th className="text-[10px] font-black uppercase tracking-widest text-zinc-500 px-3 py-2 text-right">
                                    Efisiensi
                                </th>
                                <th className="text-[10px] font-black uppercase tracking-widest text-zinc-500 px-3 py-2 text-left">
                                    Tanggal
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {plans.map((p) => (
                                <tr
                                    key={p.id}
                                    className="border-b border-zinc-200 last:border-b-0 hover:bg-zinc-50"
                                >
                                    <td className="px-3 py-2 text-xs font-black">
                                        {p.number}
                                    </td>
                                    <td className="px-3 py-2">
                                        <div className="text-xs font-bold">{p.fabricProductName}</div>
                                        <div className="text-[9px] text-zinc-400 font-mono">
                                            {p.fabricProductCode}
                                        </div>
                                    </td>
                                    <td className="px-3 py-2 text-center">
                                        <span
                                            className={`text-[8px] font-black px-1.5 py-0.5 border ${
                                                cutPlanStatusColors[p.status]
                                            }`}
                                        >
                                            {cutPlanStatusLabels[p.status]}
                                        </span>
                                    </td>
                                    <td className="px-3 py-2 text-xs font-mono text-right">
                                        {p.totalLayers ?? '—'}
                                    </td>
                                    <td className="px-3 py-2 text-xs font-mono text-right">
                                        {p.totalFabricMeters?.toFixed(1) ?? '—'}
                                    </td>
                                    <td className="px-3 py-2 text-xs font-mono text-right">
                                        {p.markerEfficiency ? `${p.markerEfficiency}%` : '—'}
                                    </td>
                                    <td className="px-3 py-2 text-[10px] text-zinc-500 font-bold">
                                        {p.plannedDate
                                            ? new Date(p.plannedDate).toLocaleDateString('id-ID')
                                            : '—'}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    )
}

export default function CutPlansPage() {
    return (
        <div className="p-6 space-y-6">
            <Suspense
                fallback={
                    <div className="flex items-center gap-2 text-zinc-400">
                        <Scissors className="h-5 w-5 animate-pulse" />
                        <span className="text-[10px] font-black uppercase tracking-widest">
                            Memuat cut plan...
                        </span>
                    </div>
                }
            >
                <PlansContent />
            </Suspense>
        </div>
    )
}
