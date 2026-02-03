"use client"

import {
    Users,
    ShoppingCart,
    FileText,
    ClipboardCheck
} from "lucide-react"
import { BentoLauncher, BentoLauncherItem } from "@/components/dashboard/bento-launcher"

const procurementModules: BentoLauncherItem[] = [
    {
        title: "Pemasok (Vendor)",
        href: "/procurement/vendors",
        icon: Users,
        color: "text-blue-600",
        description: "Database relasi & performa supplier"
    },
    {
        title: "Pesanan (PO)",
        href: "/procurement/orders",
        icon: ShoppingCart,
        color: "text-emerald-600",
        description: "Status order & pembayaran"
    },
    {
        title: "Permintaan (PR)",
        href: "/procurement/requests",
        icon: FileText,
        color: "text-amber-600",
        description: "Inbox persetujuan pembelian"
    },
    {
        title: "Penerimaan (GRN)",
        href: "/procurement/receiving",
        icon: ClipboardCheck,
        color: "text-purple-600",
        description: "Terima & verifikasi barang masuk"
    },
]

export function ProcurementModules() {
    return (
        <section className="bg-zinc-50 p-6 rounded-3xl border border-black/10">
            <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-black uppercase tracking-tight flex items-center gap-2">
                    Module Shortcuts
                </h2>
            </div>
            <BentoLauncher items={procurementModules} columns={4} />
        </section>
    )
}
