"use client"
import { LinkedDocsPanel } from "@/components/integra/linked-docs-panel"
import { EmptyState } from "@/components/integra"
import { Paperclip, Plus } from "lucide-react"
import { buildLinkedDocs } from "../_helpers/build-linked-docs"
import { DocumentSnapshotList } from "@/components/documents/document-snapshot-list"

export function LampiranTab({ data }: { data: any }) {
    const trail = buildLinkedDocs(data)
    const hasRelated = trail.length > 1

    return (
        <div className="space-y-6">
            {/* Versioned PDF snapshots */}
            <section>
                <h3 className="text-[11px] font-medium uppercase tracking-wider text-[var(--integra-muted)] mb-3">
                    Dokumen PDF (versi tercatat)
                </h3>
                <DocumentSnapshotList type="PR" entityId={data.id} />
            </section>

            {/* Uploaded attachments — placeholder */}
            <section className="border-t border-[var(--integra-hairline)] pt-6">
                <div className="flex items-center justify-between mb-3">
                    <h3 className="text-[11px] font-medium uppercase tracking-wider text-[var(--integra-muted)]">
                        Lampiran Manual
                    </h3>
                    <button
                        type="button"
                        className="text-[11px] text-[var(--integra-liren-blue)] hover:underline opacity-60 cursor-not-allowed"
                        title="Fitur upload akan tersedia di rilis berikutnya"
                        disabled
                    >
                        <Plus className="size-3 inline-block mr-1" />
                        Upload file
                    </button>
                </div>
                <div className="border border-dashed border-[var(--integra-hairline)] rounded-[3px] p-8 text-center">
                    <Paperclip className="size-6 text-[var(--integra-muted)] mx-auto mb-2 opacity-50" />
                    <p className="text-[12.5px] text-[var(--integra-ink-soft)] mb-1">
                        Belum ada lampiran manual
                    </p>
                    <p className="text-[11px] text-[var(--integra-muted)]">
                        Fitur upload (spesifikasi teknis, justifikasi pengadaan, kuotasi vendor pendukung) akan tersedia di rilis berikutnya.
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
                        description="PR ini belum dikonversi ke Purchase Order."
                    />
                )}
            </section>
        </div>
    )
}
