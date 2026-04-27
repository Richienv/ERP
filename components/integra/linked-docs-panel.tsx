"use client"

import Link from "next/link"
import { cn } from "@/lib/utils"

export type LinkedDoc = {
    type: "PR" | "PO" | "GRN" | "BILL"
    number: string
    status: string
    href?: string
    current?: boolean
    deleted?: boolean
}

export function LinkedDocsPanel({ trail }: { trail: LinkedDoc[] }) {
    if (trail.length === 0) return null

    return (
        <nav
            aria-label="Dokumen terkait"
            data-linked-panel
            className="border border-[var(--integra-hairline)] rounded-[3px] bg-[var(--integra-canvas-pure)]"
        >
            <div className="px-3.5 py-2.5 border-b border-[var(--integra-hairline)] text-[11px] font-medium uppercase tracking-wider text-[var(--integra-muted)]">
                Dokumen Terkait
            </div>
            <ol className="p-2 space-y-1 list-none">
                {trail.map((doc, i) => {
                    const isLink = Boolean(doc.href) && !doc.deleted
                    const ariaCurrent = doc.current ? "step" : undefined

                    const inner = (
                        <div
                            data-current={doc.current ? "true" : "false"}
                            className={cn(
                                "flex items-center gap-2 px-2.5 py-1.5 rounded-[2px] text-[12px] transition-colors",
                                doc.current
                                    ? "bg-[#F1EFE8]"
                                    : isLink
                                        ? "hover:bg-[var(--integra-heat-1)]"
                                        : "",
                            )}
                        >
                            <span className="font-mono text-[10.5px] uppercase text-[var(--integra-muted)] w-12 shrink-0">
                                {doc.type}
                            </span>
                            <span
                                className={cn(
                                    "font-mono",
                                    doc.deleted
                                        ? "text-[var(--integra-muted)] line-through"
                                        : "text-[var(--integra-ink)]",
                                )}
                            >
                                {doc.number}
                            </span>
                            <span className="ml-auto">
                                {doc.deleted ? (
                                    <span className="text-[10.5px] text-[var(--integra-red)]">Dihapus</span>
                                ) : (
                                    <span className="text-[10.5px] text-[var(--integra-muted)] font-mono">
                                        {doc.status}
                                    </span>
                                )}
                            </span>
                        </div>
                    )

                    return (
                        <li key={doc.number} aria-current={ariaCurrent}>
                            {isLink ? (
                                <Link href={doc.href!} className="block focus:outline-none focus:ring-2 focus:ring-[var(--integra-liren-blue)]/30 rounded-[2px]">
                                    {inner}
                                </Link>
                            ) : (
                                inner
                            )}
                            {i < trail.length - 1 && (
                                <div
                                    aria-hidden="true"
                                    className="ml-[58px] my-0.5 text-[var(--integra-muted)] text-[10px] leading-none"
                                >
                                    ↓
                                </div>
                            )}
                        </li>
                    )
                })}
            </ol>
        </nav>
    )
}
