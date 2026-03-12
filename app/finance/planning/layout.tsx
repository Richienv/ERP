"use client"

import { useState, createContext, useContext } from "react"
import { usePathname, useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { IconChevronLeft, IconChevronRight, IconCash } from "@tabler/icons-react"

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"]

interface PlanningContextType {
    month: number
    year: number
    setMonth: (m: number) => void
    setYear: (y: number) => void
}

export const PlanningContext = createContext<PlanningContextType>({
    month: new Date().getMonth() + 1,
    year: new Date().getFullYear(),
    setMonth: () => {},
    setYear: () => {},
})

export function usePlanningContext() {
    return useContext(PlanningContext)
}

export default function PlanningLayout({ children }: { children: React.ReactNode }) {
    const now = new Date()
    const [month, setMonth] = useState(now.getMonth() + 1)
    const [year, setYear] = useState(now.getFullYear())
    const pathname = usePathname()
    const router = useRouter()

    const isSimulasi = pathname.includes("/simulasi")
    const isAktual = pathname.includes("/aktual")
    const isSubPage = isSimulasi || isAktual

    // If on the landing page (no sub-route), don't show the new layout — let the old page render
    if (!isSubPage) {
        return (
            <PlanningContext.Provider value={{ month, year, setMonth, setYear }}>
                {children}
            </PlanningContext.Provider>
        )
    }

    const prevMonth = () => {
        if (month === 1) { setMonth(12); setYear(y => y - 1) }
        else setMonth(m => m - 1)
    }
    const nextMonth = () => {
        if (month === 12) { setMonth(1); setYear(y => y + 1) }
        else setMonth(m => m + 1)
    }

    return (
        <PlanningContext.Provider value={{ month, year, setMonth, setYear }}>
            <div className="mf-page">
                {/* Header */}
                <div className="flex items-center justify-between flex-wrap gap-3">
                    <div className="flex items-center gap-3">
                        <div className="flex h-12 w-12 items-center justify-center border-2 border-black bg-emerald-400 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
                            <IconCash size={24} />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold tracking-tight">PERENCANAAN ARUS KAS</h1>
                            <p className="text-xs text-zinc-500">Cashflow Planning by Management</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        {/* Month picker */}
                        <div className="flex items-center border-2 border-black bg-white shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
                            <Button variant="ghost" size="sm" className="rounded-none border-r-2 border-black h-10 px-3" onClick={prevMonth}>
                                <IconChevronLeft size={18} />
                            </Button>
                            <span className="px-5 font-black text-sm uppercase min-w-[130px] text-center">
                                {MONTHS[month - 1]} {year}
                            </span>
                            <Button variant="ghost" size="sm" className="rounded-none border-l-2 border-black h-10 px-3" onClick={nextMonth}>
                                <IconChevronRight size={18} />
                            </Button>
                        </div>

                        {/* Tab bar */}
                        <div className="flex border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
                            <button
                                className={cn(
                                    "px-4 py-2 text-xs font-black uppercase tracking-wider transition-colors",
                                    isSimulasi ? "bg-emerald-400 text-black" : "bg-white text-zinc-400 hover:bg-zinc-50"
                                )}
                                onClick={() => router.push("/finance/planning/simulasi")}
                            >
                                Simulasi
                            </button>
                            <button
                                className={cn(
                                    "px-4 py-2 text-xs font-black uppercase tracking-wider border-l-2 border-black transition-colors",
                                    isAktual ? "bg-emerald-400 text-black" : "bg-white text-zinc-400 hover:bg-zinc-50"
                                )}
                                onClick={() => router.push("/finance/planning/aktual")}
                            >
                                Aktual
                            </button>
                        </div>
                    </div>
                </div>

                {/* Sub-page content */}
                {children}
            </div>
        </PlanningContext.Provider>
    )
}
