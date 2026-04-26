"use client"

import { Panel, EmptyState } from "@/components/integra"
import type { VendorDetailPayload } from "@/hooks/use-vendor-detail"

export function CatatanTab({ data: _data }: { data: VendorDetailPayload }) {
    // Placeholder — vendor notes are not yet stored in the schema.
    // When the schema adds a `notes` / `internalNotes` field on Supplier,
    // wire it up here with a rich-text editor + audit trail.
    return (
        <div className="space-y-4">
            <Panel title="Catatan Internal" meta="Hanya tim procurement yang bisa lihat">
                <EmptyState
                    title="Belum ada catatan internal"
                    description="Fitur catatan vendor (riwayat negosiasi, masalah QC, masukan tim, dll) akan tersedia di rilis berikutnya. Sementara ini gunakan tab Performa untuk konteks vendor."
                />
            </Panel>

            <Panel title="Riwayat Aktivitas" meta="Audit log perubahan vendor">
                <EmptyState
                    title="Belum ada aktivitas tercatat"
                    description="Audit log perubahan data vendor (harga, kontak, status) akan tersedia di rilis berikutnya."
                />
            </Panel>
        </div>
    )
}
