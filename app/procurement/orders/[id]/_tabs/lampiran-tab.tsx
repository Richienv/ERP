"use client"
import { TypstPdfButton } from "@/components/integra/typst-pdf-button"
import { LinkedDocsPanel } from "@/components/integra/linked-docs-panel"
import { Paperclip, FileText, Plus } from "lucide-react"
import { buildLinkedDocs } from "../_helpers/build-linked-docs"

export function LampiranTab({ data }: { data: any }) {
    const trail = buildLinkedDocs(data)
    const hasRelated = trail.length > 1

    // Auto-generated PDF "attachment" — always available via Typst
    const generatedPdf = {
        type: "auto",
        name: `${data.number}.pdf`,
        size: "Generated on demand",
        date: data.orderDate,
    }

    return (
        <div className="space-y-6">
            {/* Generated PDF section */}
            <section>
                <h3 className="text-[11px] font-medium uppercase tracking-wider text-[var(--integra-muted)] mb-3">
                    Dokumen Otomatis
                </h3>
                <div className="border border-[var(--integra-hairline)] rounded-[3px] p-3 flex items-center gap-3">
                    <div className="w-10 h-10 bg-[#F1EFE8] rounded-[3px] grid place-items-center">
                        <FileText className="size-5 text-[var(--integra-ink-soft)]" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="text-[12.5px] text-[var(--integra-ink)]">{generatedPdf.name}</div>
                        <div className="text-[10.5px] text-[var(--integra-muted)]">
                            PO formal · Generated dari template Typst
                        </div>
                    </div>
                    <TypstPdfButton
                        endpoint={`/api/procurement/orders/${data.id}/pdf`}
                        filename={generatedPdf.name}
                        label="Download PDF"
                    />
                </div>
            </section>

            {/* Uploaded attachments — placeholder */}
            <section className="border-t border-[var(--integra-hairline)] pt-6">
                <div className="flex items-center justify-between mb-3">
                    <h3 className="text-[11px] font-medium uppercase tracking-wider text-[var(--integra-muted)]">
                        Lampiran Manual
                    </h3>
                    <button
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
                        Fitur upload (kontrak vendor, invoice scan, dll) akan tersedia di rilis berikutnya.
                    </p>
                </div>
            </section>

            {/* Linked documents — PR asal → PO ini → GRN tujuan → Bill */}
            <section className="border-t border-[var(--integra-hairline)] pt-6">
                <h3 className="text-[11px] font-medium uppercase tracking-wider text-[var(--integra-muted)] mb-3">
                    Dokumen Terkait
                </h3>
                {hasRelated ? (
                    <LinkedDocsPanel trail={trail} />
                ) : (
                    <p className="text-[12.5px] text-[var(--integra-muted)]">
                        Belum ada dokumen terkait (PR asal, GRN, atau Bill).
                    </p>
                )}
            </section>
        </div>
    )
}
