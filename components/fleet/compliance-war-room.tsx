"use client"

import { useMemo } from "react"
import Link from "next/link"
import { IconAlertTriangle, IconCircleCheck, IconFileAlert } from "@tabler/icons-react"
import { NB } from "@/lib/dialog-styles"
import {
    buildWarRoomBuckets,
    formatDaysRemaining,
    formatExpiryDate,
    type VehicleExpiryFields,
    type WarRoomVehicleRow,
} from "./expiry-buckets"

export function ComplianceWarRoom({ vehicles }: { vehicles: VehicleExpiryFields[] }) {
    const room = useMemo(() => buildWarRoomBuckets(vehicles), [vehicles])
    const hasAction = room.actionVehicleCount > 0
    const hasMissing = room.missingVehicleCount > 0

    return (
        <div className={NB.pageCard}>
            <div className={NB.pageAccent} />
            <div className="flex items-start justify-between gap-4 px-4 py-3 border-b border-zinc-200">
                <div className="flex items-start gap-3">
                    <div className={`p-2 ${hasAction ? "bg-red-500" : "bg-emerald-500"}`}>
                        {hasAction ? (
                            <IconAlertTriangle className="w-4 h-4 text-white" />
                        ) : (
                            <IconCircleCheck className="w-4 h-4 text-white" />
                        )}
                    </div>
                    <div>
                        <h2 className="text-sm font-black uppercase tracking-wider">Armada yang butuh tindakan</h2>
                        <p className="text-[11px] text-zinc-500 mt-0.5">
                            Ruang siaga dokumen: STNK, KIR, dan asuransi — habis tempo vs jatuh tempo ≤ 30 hari
                        </p>
                    </div>
                </div>
                <div className="text-right shrink-0">
                    <div className={`text-2xl font-black ${hasAction ? "text-red-600" : "text-emerald-700"}`}>
                        {room.actionVehicleCount}
                    </div>
                    <div className="text-xs font-bold uppercase tracking-wider text-zinc-500">
                        unit perlu tindakan
                    </div>
                </div>
            </div>

            <div className="grid md:grid-cols-2 md:divide-x divide-zinc-200">
                <BucketColumn
                    tone="overdue"
                    title="Habis tempo"
                    hint="Tidak boleh jalan di site"
                    count={room.overdueVehicleCount}
                    rows={room.overdue}
                    empty="Tidak ada dokumen yang sudah habis"
                />
                <BucketColumn
                    tone="soon"
                    title="Jatuh tempo ≤ 30 hari"
                    hint="Urus perpanjangan sekarang"
                    count={room.dueSoonVehicleCount}
                    rows={room.dueSoon}
                    empty="Tidak ada yang jatuh tempo 30 hari ke depan"
                />
            </div>

            {hasMissing && (
                <div className="border-t border-zinc-200 bg-zinc-50/80 px-4 py-3">
                    <div className="flex items-center gap-2 mb-2">
                        <IconFileAlert className="w-3.5 h-3.5 text-zinc-500" />
                        <span className="text-xs font-black uppercase tracking-wider text-zinc-600">
                            Tanggal belum tercatat · {room.missingVehicleCount} unit
                        </span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {room.missing.map((row) => (
                            <Link
                                key={row.id}
                                href={`/fleet/${row.id}`}
                                className="inline-flex items-center gap-1.5 border border-zinc-300 bg-white px-2 py-1 hover:border-orange-400 hover:bg-orange-50/50"
                            >
                                <span className="font-mono text-xs font-bold">{row.plateNumber}</span>
                                <span className="text-xs text-zinc-500">
                                    {row.docs.map((d) => d.label).join(" · ")}
                                </span>
                            </Link>
                        ))}
                    </div>
                </div>
            )}
        </div>
    )
}

function BucketColumn({
    tone,
    title,
    hint,
    count,
    rows,
    empty,
}: {
    tone: "overdue" | "soon"
    title: string
    hint: string
    count: number
    rows: WarRoomVehicleRow[]
    empty: string
}) {
    const isOverdue = tone === "overdue"
    const countColor = isOverdue ? "text-red-600" : "text-orange-700"
    const bar = isOverdue ? "border-l-red-500" : "border-l-orange-500"

    return (
        <div className="min-w-0">
            <div className="flex items-center justify-between px-4 py-2.5 bg-zinc-50/80 border-b border-zinc-200">
                <div>
                    <div className="text-xs font-black uppercase tracking-wider text-zinc-700">{title}</div>
                    <div className="text-xs text-zinc-500">{hint}</div>
                </div>
                <div className="text-right">
                    <span className={`text-xl font-black ${count > 0 ? countColor : "text-zinc-400"}`}>{count}</span>
                    <span className="block text-xs font-bold uppercase tracking-wider text-zinc-400">plat</span>
                </div>
            </div>
            {rows.length === 0 ? (
                <div className="px-4 py-6 text-xs text-zinc-500">{empty}</div>
            ) : (
                <ul className="divide-y divide-zinc-100">
                    {rows.map((row) => (
                        <li key={row.id}>
                            <Link
                                href={`/fleet/${row.id}`}
                                className={`flex items-center justify-between gap-3 px-4 py-2.5 border-l-4 ${bar} hover:bg-orange-50/60`}
                            >
                                <div className="min-w-0">
                                    <div className="font-mono text-sm font-black">{row.plateNumber}</div>
                                    <div className="flex flex-wrap gap-1 mt-1">
                                        {row.docs.map((doc) => (
                                            <span
                                                key={doc.kind}
                                                className={`text-xs font-black uppercase tracking-widest px-1.5 py-0.5 border ${
                                                    isOverdue
                                                        ? "bg-red-50 text-red-700 border-red-200"
                                                        : "bg-orange-50 text-orange-800 border-orange-200"
                                                }`}
                                            >
                                                {doc.label}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                                <div className="text-right shrink-0">
                                    {row.docs.map((doc) => (
                                        <div key={doc.kind} className={`text-xs font-bold ${countColor}`}>
                                            {formatDaysRemaining(doc.daysRemaining)}
                                        </div>
                                    ))}
                                    <div className="text-xs font-mono text-zinc-500">
                                        {formatExpiryDate(row.docs[0]?.expiry)}
                                    </div>
                                </div>
                            </Link>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    )
}
