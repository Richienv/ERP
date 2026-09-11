import Link from "next/link"
import { IconAlertTriangle, IconCircleCheck, IconClock } from "@tabler/icons-react"
import { NB } from "@/lib/dialog-styles"
import {
    formatDaysRemaining,
    formatExpiryDate,
    vehicleDocStatuses,
    type DocStatus,
} from "./expiry-buckets"

export function VehicleComplianceStrip({
    vehicleId,
    stnkExpiry,
    kirExpiry,
    insuranceExpiry,
}: {
    vehicleId: string
    stnkExpiry?: Date | string | null
    kirExpiry?: Date | string | null
    insuranceExpiry?: Date | string | null
}) {
    const docs = vehicleDocStatuses({ stnkExpiry, kirExpiry, insuranceExpiry })
    const worst = worstBucket(docs)
    const accent = worst === "OVERDUE" ? "from-red-500 via-orange-400 to-red-500"
        : worst === "DUE_SOON" ? "from-amber-500 via-orange-400 to-amber-500"
        : worst === "MISSING" ? "from-zinc-400 via-zinc-300 to-zinc-400"
        : "from-emerald-500 via-teal-400 to-emerald-500"

    return (
        <div className={`${NB.pageCard} md:col-span-3`}>
            <div className={`h-1 bg-gradient-to-r ${accent}`} />
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-zinc-200">
                <div>
                    <h2 className="text-[10px] font-black uppercase tracking-widest text-zinc-600">Kepatuhan dokumen</h2>
                    <p className="text-[11px] text-zinc-500">Hari tersisa dan jatuh tempo STNK / KIR / asuransi — bukan hanya kapitalisasi aset</p>
                </div>
                <Link
                    href={`/fleet/${vehicleId}?edit=1`}
                    className={`${NB.toolbarBtn} inline-flex items-center`}
                >
                    Perbarui tanggal
                </Link>
            </div>
            <div className={NB.kpiStrip}>
                {docs.map((doc) => (
                    <DocCell key={doc.kind} doc={doc} />
                ))}
            </div>
        </div>
    )
}

function worstBucket(docs: DocStatus[]) {
    if (docs.some((d) => d.bucket === "OVERDUE")) return "OVERDUE"
    if (docs.some((d) => d.bucket === "DUE_SOON")) return "DUE_SOON"
    if (docs.some((d) => d.bucket === "MISSING")) return "MISSING"
    return "OK"
}

function DocCell({ doc }: { doc: DocStatus }) {
    const tone = cellTone(doc.bucket)
    const Icon = doc.bucket === "OVERDUE" ? IconAlertTriangle
        : doc.bucket === "DUE_SOON" ? IconClock
        : IconCircleCheck

    return (
        <div className={NB.kpiCell}>
            <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                    <Icon className={`w-3.5 h-3.5 ${tone.icon}`} />
                    <span className="text-[10px] uppercase tracking-wider font-bold text-zinc-600">{doc.label}</span>
                </div>
                <div className={`text-sm font-black mt-1 ${tone.text}`}>
                    {formatDaysRemaining(doc.daysRemaining)}
                </div>
                <div className="text-[10px] font-mono font-bold text-zinc-500 mt-0.5">
                    {doc.expiry ? `Jatuh tempo ${formatExpiryDate(doc.expiry)}` : "Tanggal belum diisi"}
                </div>
            </div>
        </div>
    )
}

function cellTone(bucket: DocStatus["bucket"]) {
    if (bucket === "OVERDUE") return { icon: "text-red-600", text: "text-red-600" }
    if (bucket === "DUE_SOON") return { icon: "text-amber-600", text: "text-amber-700" }
    if (bucket === "MISSING") return { icon: "text-zinc-400", text: "text-zinc-500" }
    return { icon: "text-emerald-600", text: "text-emerald-700" }
}
