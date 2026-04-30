"use client"
import { Camera, Paperclip, Plus } from "lucide-react"
import { LinkedDocsPanel } from "@/components/integra/linked-docs-panel"
import { EmptyState } from "@/components/integra"
import { buildLinkedDocs } from "../_helpers/build-linked-docs"
import { DocumentSnapshotList } from "@/components/documents/document-snapshot-list"

export function LampiranTab({ data }: { data: any }) {
    const trail = buildLinkedDocs(data)
    const hasRelated = trail.length > 1

    return (
        <div className="space-y-6">
            {/* Versioned PDF snapshots — Surat Jalan Masuk */}
            <section>
                <h3 className="text-[11px] font-medium uppercase tracking-wider text-[var(--integra-muted)] mb-3">
                    Dokumen PDF (versi tercatat)
                </h3>
                <DocumentSnapshotList type="GRN" entityId={data.id} />
            </section>

            {/* Vendor delivery docket placeholder */}
            <section className="border-t border-[var(--integra-hairline)] pt-6">
                <div className="flex items-center justify-between mb-3">
                    <h3 className="text-[11px] font-medium uppercase tracking-wider text-[var(--integra-muted)]">
                        Surat Jalan Vendor
                    </h3>
                    <button
                        className="text-[11px] text-[var(--integra-liren-blue)] opacity-60 cursor-not-allowed"
                        title="Fitur upload akan tersedia di rilis berikutnya"
                        disabled
                    >
                        <Plus className="size-3 inline-block mr-1" />
                        Upload scan
                    </button>
                </div>
                <div className="border border-dashed border-[var(--integra-hairline)] rounded-[3px] p-8 text-center">
                    <Paperclip className="size-6 text-[var(--integra-muted)] mx-auto mb-2 opacity-50" />
                    <p className="text-[12.5px] text-[var(--integra-ink-soft)] mb-1">
                        Belum ada surat jalan vendor
                    </p>
                    <p className="text-[11px] text-[var(--integra-muted)]">
                        Upload scan surat jalan dari pemasok untuk verifikasi silang.
                    </p>
                </div>
            </section>

            {/* Inspection photos placeholder */}
            <section className="border-t border-[var(--integra-hairline)] pt-6">
                <h3 className="text-[11px] font-medium uppercase tracking-wider text-[var(--integra-muted)] mb-3">
                    Foto Penerimaan
                </h3>
                <div className="border border-dashed border-[var(--integra-hairline)] rounded-[3px] p-8 text-center">
                    <Camera className="size-6 text-[var(--integra-muted)] mx-auto mb-2 opacity-50" />
                    <p className="text-[12.5px] text-[var(--integra-ink-soft)] mb-1">
                        Belum ada foto barang masuk
                    </p>
                    <p className="text-[11px] text-[var(--integra-muted)]">
                        Fitur foto inspeksi akan tersedia di rilis berikutnya.
                    </p>
                </div>
            </section>

            {/* Linked documents */}
            <section className="border-t border-[var(--integra-hairline)] pt-6">
                <h3 className="text-[11px] font-medium uppercase tracking-wider text-[var(--integra-muted)] mb-3">
                    Dokumen Terkait
                </h3>
                {hasRelated ? (
                    <LinkedDocsPanel trail={trail} />
                ) : (
                    <EmptyState
                        title="Belum ada dokumen terkait"
                        description="GRN ini belum tertaut ke Bill manapun."
                    />
                )}
            </section>
        </div>
    )
}
