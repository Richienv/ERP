"use client"

import { StatusPill } from "@/components/integra"
import { fmtDateShort } from "@/lib/integra-tokens"
import type { VendorDetailPayload } from "@/hooks/use-vendor-detail"

const PAYMENT_TERM_LABEL: Record<string, string> = {
    CASH: "Tunai",
    COD: "COD",
    NET_15: "NET 15 hari",
    NET_30: "NET 30 hari",
    NET_45: "NET 45 hari",
    NET_60: "NET 60 hari",
    NET_90: "NET 90 hari",
}

function paymentTermLabel(v: string | null): string {
    if (!v) return "—"
    return PAYMENT_TERM_LABEL[v] ?? v
}

function ratingStars(n: number): string {
    if (!n || n <= 0) return "—"
    const safe = Math.max(0, Math.min(5, Math.round(n)))
    return "★".repeat(safe) + "☆".repeat(5 - safe)
}

export function ProfilTab({ data }: { data: VendorDetailPayload }) {
    return (
        <div className="grid grid-cols-2 gap-x-12 gap-y-6">
            {/* Left: Identitas Vendor */}
            <section>
                <h3 className="text-[11px] font-medium uppercase tracking-wider text-[var(--integra-muted)] mb-3">
                    Identitas
                </h3>
                <dl className="space-y-2">
                    <Row label="Kode">
                        <span className="font-mono text-[12.5px] text-[var(--integra-ink)]">
                            {data.code}
                        </span>
                    </Row>
                    <Row label="Nama">
                        <span className="text-[12.5px] text-[var(--integra-ink)]">{data.name}</span>
                    </Row>
                    <Row label="Status">
                        {data.isActive ? (
                            <StatusPill kind="ok">Aktif</StatusPill>
                        ) : (
                            <StatusPill kind="neutral">Nonaktif</StatusPill>
                        )}
                    </Row>
                    <Row label="NPWP">
                        <span className="font-mono text-[12.5px]">{data.npwp ?? "—"}</span>
                    </Row>
                    <Row label="Pembayaran">
                        <StatusPill kind="neutral">{paymentTermLabel(data.paymentTerm)}</StatusPill>
                    </Row>
                    <Row label="Rating">
                        {data.rating > 0 ? (
                            <span className="text-[14px] text-[var(--integra-amber)]">
                                {ratingStars(data.rating)}
                                <span className="ml-2 text-[11.5px] text-[var(--integra-muted)] font-mono">
                                    ({data.rating}/5)
                                </span>
                            </span>
                        ) : (
                            <span className="text-[var(--integra-muted)]">Belum dinilai</span>
                        )}
                    </Row>
                    <Row label="Bergabung Sejak">
                        <span className="font-mono text-[12.5px]">
                            {data.createdAt ? fmtDateShort(new Date(data.createdAt)) : "—"}
                        </span>
                    </Row>
                    <Row label="Update Terakhir">
                        <span className="font-mono text-[12.5px]">
                            {data.updatedAt ? fmtDateShort(new Date(data.updatedAt)) : "—"}
                        </span>
                    </Row>
                </dl>
            </section>

            {/* Right: Kontak & PIC */}
            <section>
                <h3 className="text-[11px] font-medium uppercase tracking-wider text-[var(--integra-muted)] mb-3">
                    Kontak / PIC
                </h3>
                <dl className="space-y-2">
                    <Row label="Nama PIC">
                        <span className="text-[12.5px]">
                            {data.contactTitle ? `${data.contactTitle} ` : ""}
                            {data.contactName ?? "—"}
                        </span>
                    </Row>
                    <Row label="Email">
                        {data.email ? (
                            <a
                                href={`mailto:${data.email}`}
                                className="text-[12.5px] text-[var(--integra-liren-blue)] hover:underline"
                            >
                                {data.email}
                            </a>
                        ) : (
                            <span className="text-[var(--integra-muted)]">—</span>
                        )}
                    </Row>
                    <Row label="No. HP PIC">
                        <span className="font-mono text-[12.5px]">
                            {data.picPhone ?? data.phone ?? "—"}
                        </span>
                    </Row>
                    <Row label="No. Telp Kantor">
                        <span className="font-mono text-[12.5px]">
                            {data.officePhone ?? "—"}
                        </span>
                    </Row>
                </dl>
            </section>

            {/* Left bottom: Alamat */}
            <section className="col-span-2 pt-4 border-t border-[var(--integra-hairline)]">
                <h3 className="text-[11px] font-medium uppercase tracking-wider text-[var(--integra-muted)] mb-3">
                    Alamat
                </h3>
                <div className="grid grid-cols-2 gap-6">
                    <div>
                        <p className="text-[10.5px] uppercase tracking-wider text-[var(--integra-muted)] mb-1">
                            Alamat Utama
                        </p>
                        <p className="text-[12.5px] text-[var(--integra-ink-soft)] whitespace-pre-wrap">
                            {data.address ?? "—"}
                        </p>
                    </div>
                    {data.address2 ? (
                        <div>
                            <p className="text-[10.5px] uppercase tracking-wider text-[var(--integra-muted)] mb-1">
                                Alamat Sekunder / Cabang
                            </p>
                            <p className="text-[12.5px] text-[var(--integra-ink-soft)] whitespace-pre-wrap">
                                {data.address2}
                            </p>
                        </div>
                    ) : null}
                </div>
            </section>

            {/* Bank details */}
            {(data.bankName || data.bankAccountNumber) && (
                <section className="col-span-2 pt-4 border-t border-[var(--integra-hairline)]">
                    <h3 className="text-[11px] font-medium uppercase tracking-wider text-[var(--integra-muted)] mb-3">
                        Rekening Bank (untuk pembayaran)
                    </h3>
                    <div className="grid grid-cols-3 gap-6">
                        <Row label="Bank">
                            <span className="text-[12.5px]">{data.bankName ?? "—"}</span>
                        </Row>
                        <Row label="No. Rekening">
                            <span className="font-mono text-[12.5px]">
                                {data.bankAccountNumber ?? "—"}
                            </span>
                        </Row>
                        <Row label="Atas Nama">
                            <span className="text-[12.5px]">{data.bankAccountName ?? "—"}</span>
                        </Row>
                    </div>
                </section>
            )}

            {/* Categories */}
            {data.categories.length > 0 && (
                <section className="col-span-2 pt-4 border-t border-[var(--integra-hairline)]">
                    <h3 className="text-[11px] font-medium uppercase tracking-wider text-[var(--integra-muted)] mb-3">
                        Kategori Pemasok
                    </h3>
                    <div className="flex flex-wrap gap-1.5">
                        {data.categories.map((c) => (
                            <StatusPill key={c.id} kind="info">
                                {c.name}
                            </StatusPill>
                        ))}
                    </div>
                </section>
            )}
        </div>
    )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div className="grid grid-cols-[140px_1fr] items-baseline gap-3">
            <dt className="text-[11.5px] text-[var(--integra-muted)]">{label}</dt>
            <dd className="text-[12.5px]">{children}</dd>
        </div>
    )
}
