"use client"
import { MessageSquare } from "lucide-react"
import { EmptyState } from "@/components/integra"

export function KomunikasiTab({ data }: { data: any }) {
    return (
        <div className="space-y-6">
            {/* Vendor email/contact info */}
            <section>
                <h3 className="text-[11px] font-medium uppercase tracking-wider text-[var(--integra-muted)] mb-3">
                    Kontak Pemasok
                </h3>
                {data.supplier ? (
                    <div className="space-y-2 text-[12.5px]">
                        {data.supplier.email && (
                            <div>
                                <span className="text-[var(--integra-muted)] mr-2">Email:</span>
                                <a href={`mailto:${data.supplier.email}?subject=Pertanyaan PO ${data.number}`} className="text-[var(--integra-liren-blue)] hover:underline">
                                    {data.supplier.email}
                                </a>
                            </div>
                        )}
                        {data.supplier.phone && (
                            <div>
                                <span className="text-[var(--integra-muted)] mr-2">Telepon:</span>
                                <a href={`tel:${data.supplier.phone}`} className="text-[var(--integra-liren-blue)] hover:underline">
                                    {data.supplier.phone}
                                </a>
                            </div>
                        )}
                        {data.supplier.contactName && (
                            <div>
                                <span className="text-[var(--integra-muted)] mr-2">PIC:</span>
                                <span className="text-[var(--integra-ink)]">{data.supplier.contactName}</span>
                            </div>
                        )}
                    </div>
                ) : (
                    <EmptyState
                        title="Pemasok tidak ditemukan"
                        description="Data kontak pemasok belum tersedia. Tambahkan pemasok di modul Master Pemasok."
                    />
                )}
            </section>

            {/* Comment thread placeholder */}
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
                        Fitur diskusi internal (komentar, mention tim, attachment) akan tersedia di rilis berikutnya. Untuk sekarang, gunakan WhatsApp / email perusahaan.
                    </p>
                </div>
            </section>

            {/* Activity log preview */}
            <section className="border-t border-[var(--integra-hairline)] pt-6">
                <h3 className="text-[11px] font-medium uppercase tracking-wider text-[var(--integra-muted)] mb-3">
                    Aktivitas Sistem
                </h3>
                <p className="text-[12.5px] text-[var(--integra-muted)]">
                    Lihat tab <em>History</em> untuk timeline aktivitas otomatis (status changes, approvals, dll).
                </p>
            </section>
        </div>
    )
}
