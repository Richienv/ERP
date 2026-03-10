"use client"

import { ReactNode } from "react"
import Link from "next/link"
import { IconArrowRight } from "@tabler/icons-react"
import type { Icon } from "@tabler/icons-react"

interface ModuleStripProps {
    title: string
    icon: Icon
    href: string
    accentColor: string
    children: ReactNode
}

export function ModuleStrip({ title, icon: IconComponent, href, accentColor, children }: ModuleStripProps) {
    return (
        <div className="border-2 border-black bg-white dark:bg-zinc-900 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] overflow-hidden">
            {/* Accent bar */}
            <div className={`h-1 ${accentColor}`} />

            {/* Header */}
            <div className="flex items-center gap-2 px-4 py-2.5 border-b border-zinc-100 dark:border-zinc-800">
                <IconComponent className="w-4 h-4 text-zinc-500" />
                <Link href={href} className="text-[11px] font-black uppercase tracking-widest text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors">
                    {title}
                </Link>
                <Link
                    href={href}
                    className="ml-auto flex items-center gap-1 text-[10px] font-bold text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
                >
                    Lihat Semua <IconArrowRight className="w-3 h-3" />
                </Link>
            </div>

            {/* Metrics grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-zinc-100 dark:divide-zinc-800">
                {children}
            </div>
        </div>
    )
}
