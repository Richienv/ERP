"use client"

import { CheckCircle2, Clock, AlertCircle, FileText, ArrowRight } from "lucide-react"
import { cn } from "@/lib/utils"
import Link from "next/link"

interface FinanceActionItem {
    id: string
    title: string
    type: "urgent" | "pending" | "warning" | "info"
    due: string
    href: string
}

export function ActionItemsWidget({ actions }: { actions: FinanceActionItem[] }) {
    return (
        <div className="bg-card border border-border/50 rounded-2xl p-6 shadow-sm h-full flex flex-col">
            <div className="flex justify-between items-center mb-6">
                <h3 className="font-serif text-lg font-medium">To-Do Accounting</h3>
                <span className="bg-primary/10 text-primary text-xs font-semibold px-2 py-1 rounded-full">{actions.length} Pending</span>
            </div>

            <div className="space-y-4 flex-1">
                {actions.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
                        Tidak ada action item saat ini.
                    </div>
                ) : actions.map((action) => (
                    <Link
                        key={action.id}
                        href={action.href}
                        className="flex items-start gap-3 p-3 rounded-xl hover:bg-muted/50 transition-colors group cursor-pointer border border-transparent hover:border-border/40"
                    >
                        <div className={cn(
                            "mt-0.5 p-1.5 rounded-full shrink-0",
                            action.type === 'urgent' && "bg-rose-100 text-rose-600 dark:bg-rose-900/30",
                            action.type === 'pending' && "bg-amber-100 text-amber-600 dark:bg-amber-900/30",
                            action.type === 'warning' && "bg-blue-100 text-blue-600 dark:bg-blue-900/30",
                            action.type === 'info' && "bg-zinc-100 text-zinc-600 dark:bg-zinc-800",
                        )}>
                            {action.type === 'urgent' && <AlertCircle size={16} />}
                            {action.type === 'pending' && <Clock size={16} />}
                            {action.type === 'warning' && <FileText size={16} />}
                            {action.type === 'info' && <CheckCircle2 size={16} />}
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground truncate group-hover:text-primary transition-colors">{action.title}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">Jatuh tempo: {action.due}</p>
                        </div>
                        <ArrowRight size={14} className="text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity mt-1.5" />
                    </Link>
                ))}
            </div>

            <Link href="/finance/reports" className="w-full mt-4 py-2 text-sm text-muted-foreground hover:text-foreground font-medium border-t border-dashed border-border pt-4 transition-colors text-center">
                Lihat Semua Tugas
            </Link>
        </div>
    )
}
