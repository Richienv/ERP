"use client"
import { cn } from '@/lib/utils'

interface Props { version: number; isLatest?: boolean; className?: string }

export function DocumentVersionPill({ version, isLatest, className }: Props) {
    return (
        <span className={cn(
            'inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-none border',
            isLatest ? 'bg-orange-500 text-white border-orange-600' : 'bg-zinc-100 text-zinc-700 border-zinc-300',
            className,
        )}>
            v{version}
            {isLatest && <span className="text-[8px]">TERBARU</span>}
        </span>
    )
}
