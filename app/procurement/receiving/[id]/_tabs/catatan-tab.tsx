"use client"
import { MessageSquare } from "lucide-react"
import { EmptyState } from "@/components/integra"

type Item = {
    id: string
    quantityRejected: number
    inspectionNotes: string | null
    product: { code: string; name: string } | null
}

export function CatatanTab({ data }: { data: any }) {
    const items: Item[] = data.items ?? []
    const itemsWithNotes = items.filter((i) => i.inspectionNotes)

    return (
        <div className="space-y-6">
            {/* Receiver notes */}
            <section>
                <h3 className="text-[11px] font-medium uppercase tracking-wider text-[var(--integra-muted)] mb-3">
                    Catatan Penerima
                </h3>
                {data.notes ? (
                    <div className="border border-[var(--integra-hairline)] rounded-[3px] p-3 bg-[var(--integra-canvas-pure)]">
                        <p className="text-[12.5px] text-[var(--integra-ink-soft)] whitespace-pre-wrap leading-relaxed">
                            {data.notes}
                        </p>
                    </div>
                ) : (
                    <EmptyState
                        title="Tidak ada catatan penerima"
                        description="Penerima tidak menambahkan catatan untuk GRN ini."
                    />
                )}
            </section>

            {/* Rejection reason — only when GRN was REJECTED */}
            {data.status === "REJECTED" && data.rejectionReason && (
                <section className="border-t border-[var(--integra-hairline)] pt-6">
                    <h3 className="text-[11px] font-medium uppercase tracking-wider text-[var(--integra-muted)] mb-3">
                        Alasan Penolakan
                    </h3>
                    <div className="border border-[var(--integra-red)]/30 bg-[var(--integra-red-bg)] rounded-[3px] p-3">
                        <p className="text-[12.5px] text-[var(--integra-red)] whitespace-pre-wrap leading-relaxed">
                            {data.rejectionReason}
                        </p>
                    </div>
                </section>
            )}

            {/* Per-item inspection notes */}
            <section className="border-t border-[var(--integra-hairline)] pt-6">
                <h3 className="text-[11px] font-medium uppercase tracking-wider text-[var(--integra-muted)] mb-3">
                    Catatan Per Item
                </h3>
                {itemsWithNotes.length === 0 ? (
                    <p className="text-[12.5px] text-[var(--integra-muted)]">
                        Belum ada catatan per item. Catatan inspeksi akan muncul di sini.
                    </p>
                ) : (
                    <ul className="space-y-2 list-none m-0 p-0">
                        {itemsWithNotes.map((item) => (
                            <li
                                key={item.id}
                                className="border border-[var(--integra-hairline)] rounded-[3px] p-3 bg-[var(--integra-canvas-pure)]"
                            >
                                <div className="flex items-baseline gap-2 flex-wrap mb-1">
                                    <span className="font-mono text-[11px] text-[var(--integra-muted)]">
                                        {item.product?.code ?? "—"}
                                    </span>
                                    <span className="text-[12.5px] text-[var(--integra-ink)]">
                                        {item.product?.name ?? "—"}
                                    </span>
                                    {item.quantityRejected > 0 && (
                                        <span className="text-[11px] text-[var(--integra-red)]">
                                            · {item.quantityRejected} ditolak
                                        </span>
                                    )}
                                </div>
                                <p className="text-[11.5px] text-[var(--integra-ink-soft)] whitespace-pre-wrap">
                                    {item.inspectionNotes}
                                </p>
                            </li>
                        ))}
                    </ul>
                )}
            </section>

            {/* Internal discussion placeholder */}
            <section className="border-t border-[var(--integra-hairline)] pt-6">
                <h3 className="text-[11px] font-medium uppercase tracking-wider text-[var(--integra-muted)] mb-3">
                    Diskusi Internal
                </h3>
                <div className="border border-dashed border-[var(--integra-hairline)] rounded-[3px] p-8 text-center">
                    <MessageSquare className="size-6 text-[var(--integra-muted)] mx-auto mb-2 opacity-50" />
                    <p className="text-[12.5px] text-[var(--integra-ink-soft)] mb-1">
                        Belum ada diskusi
                    </p>
                    <p className="text-[11px] text-[var(--integra-muted)] max-w-md mx-auto">
                        Fitur komentar tim & mention akan tersedia di rilis berikutnya.
                    </p>
                </div>
            </section>
        </div>
    )
}
