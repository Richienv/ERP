"use client"
import { MessageSquare, Mail, Phone } from "lucide-react"
import { EmptyState } from "@/components/integra"

/**
 * Komunikasi tab — surfaces requester contact (since PR doesn't have a
 * single vendor) plus aggregates any preferred suppliers from the PR
 * line items, and a placeholder for the future internal discussion thread.
 */
export function KomunikasiTab({ data }: { data: any }) {
    const items = data.items ?? []
    const preferredSuppliers = Array.from(
        new Map(
            items
                .filter((i: any) => i.preferredSupplier)
                .map((i: any) => [i.preferredSupplier.id, i.preferredSupplier]),
        ).values(),
    ) as Array<{ id: string; name: string; email?: string | null; phone?: string | null }>

    const requesterName = data.requester
        ? `${data.requester.firstName ?? ""} ${data.requester.lastName ?? ""}`.trim()
        : null

    return (
        <div className="space-y-6">
            {/* Requester contact */}
            <section>
                <h3 className="text-[11px] font-medium uppercase tracking-wider text-[var(--integra-muted)] mb-3">
                    Kontak Pemohon
                </h3>
                {data.requester ? (
                    <div className="space-y-2 text-[12.5px]">
                        {requesterName && (
                            <div>
                                <span className="text-[var(--integra-muted)] mr-2">Nama:</span>
                                <span className="text-[var(--integra-ink)]">{requesterName}</span>
                            </div>
                        )}
                        {data.requester.email && (
                            <div className="flex items-center gap-2">
                                <Mail className="size-3 text-[var(--integra-muted)]" />
                                <a
                                    href={`mailto:${data.requester.email}?subject=Pertanyaan PR ${data.number}`}
                                    className="text-[var(--integra-liren-blue)] hover:underline"
                                >
                                    {data.requester.email}
                                </a>
                            </div>
                        )}
                        {data.requester.department && (
                            <div>
                                <span className="text-[var(--integra-muted)] mr-2">Departemen:</span>
                                <span className="text-[var(--integra-ink)]">{data.requester.department}</span>
                            </div>
                        )}
                    </div>
                ) : (
                    <EmptyState
                        title="Pemohon tidak ditemukan"
                        description="Data kontak pemohon belum tersedia."
                    />
                )}
            </section>

            {/* Preferred suppliers (if any) */}
            {preferredSuppliers.length > 0 && (
                <section className="border-t border-[var(--integra-hairline)] pt-6">
                    <h3 className="text-[11px] font-medium uppercase tracking-wider text-[var(--integra-muted)] mb-3">
                        Vendor Preferensi pada Item
                    </h3>
                    <ul className="space-y-2 m-0 p-0 list-none">
                        {preferredSuppliers.map((s) => (
                            <li
                                key={s.id}
                                className="border border-[var(--integra-hairline)] rounded-[3px] px-3 py-2 text-[12.5px]"
                            >
                                <div className="font-medium text-[var(--integra-ink)]">{s.name}</div>
                                <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-[11.5px]">
                                    {s.email && (
                                        <span className="flex items-center gap-1">
                                            <Mail className="size-3 text-[var(--integra-muted)]" />
                                            <a
                                                href={`mailto:${s.email}`}
                                                className="text-[var(--integra-liren-blue)] hover:underline"
                                            >
                                                {s.email}
                                            </a>
                                        </span>
                                    )}
                                    {s.phone && (
                                        <span className="flex items-center gap-1">
                                            <Phone className="size-3 text-[var(--integra-muted)]" />
                                            <a
                                                href={`tel:${s.phone}`}
                                                className="text-[var(--integra-liren-blue)] hover:underline font-mono"
                                            >
                                                {s.phone}
                                            </a>
                                        </span>
                                    )}
                                </div>
                            </li>
                        ))}
                    </ul>
                </section>
            )}

            {/* Comment thread placeholder */}
            <section className="border-t border-[var(--integra-hairline)] pt-6">
                <h3 className="text-[11px] font-medium uppercase tracking-wider text-[var(--integra-muted)] mb-3">
                    Diskusi Internal
                </h3>
                <div className="border border-dashed border-[var(--integra-hairline)] rounded-[3px] p-8 text-center">
                    <MessageSquare className="size-6 text-[var(--integra-muted)] mx-auto mb-2 opacity-50" />
                    <p className="text-[12.5px] text-[var(--integra-ink-soft)] mb-1">Belum ada diskusi</p>
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
