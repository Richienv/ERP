"use client"
import { LinkedDocsPanel } from "@/components/integra/linked-docs-panel"
import { EmptyState } from "@/components/integra"
import { Paperclip, FileText, Plus } from "lucide-react"
import { buildLinkedDocs } from "../_helpers/build-linked-docs"

/**
 * Lampiran tab — PR doesn't have a formal PDF template (unlike PO). For
 * now we surface the linked docs trail (PR → PO if converted) and a
 * placeholder for manual file uploads.
 */
export function LampiranTab({ data }: { data: any }) {
    const trail = buildLinkedDocs(data)
    const hasRelated = trail.length > 1

    return (
        <div className="space-y-6">
            {/* Generated PDF placeholder */}
            <section>
                <h3 className="text-[11px] font-medium uppercase tracking-wider text-[var(--integra-muted)] mb-3">
                    Dokumen Otomatis
                </h3>
                <div className="border border-[var(--integra-hairline)] rounded-[3px] p-3 flex items-center gap-3">
                    <div className="w-10 h-10 bg-[#F1EFE8] rounded-[3px] grid place-items-center">
                        <FileText className="size-5 text-[var(--integra-muted)] opacity-60" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="text-[12.5px] text-[var(--integra-ink-soft)]">
                            Tidak ada PDF PR formal
                        </div>
                        <div className="text-[10.5px] text-[var(--integra-muted)]">
                            PR adalah dokumen internal — PDF formal hanya diterbitkan untuk Purchase Order. Lihat PO terkait di bagian Dokumen Terkait.
                        </div>
                    </div>
                </div>
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
