"use client"

import { Lock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useRouter } from "next/navigation"

export default function PosPage() {
    const router = useRouter()

    return (
        <div className="mf-page flex items-center justify-center min-h-[60vh]">
            <div className="border border-border shadow-sm bg-white p-10 max-w-md text-center space-y-5">
                <div className="h-16 w-16 bg-zinc-100 border border-border shadow-sm flex items-center justify-center mx-auto">
                    <Lock className="h-8 w-8 text-zinc-400" />
                </div>
                <h1 className="text-xl font-semibold tracking-tight">
                    Point of Sale (POS)
                </h1>
                <p className="text-sm text-zinc-500 font-medium">
                    Modul ini sedang dalam pengembangan dan belum tersedia untuk digunakan.
                </p>
                <div className="inline-block px-3 py-1 bg-amber-50 border border-amber-300 text-amber-700 text-xs font-semibold  ">
                    Segera Hadir
                </div>
                <div className="pt-2">
                    <Button
                        onClick={() => router.push("/dashboard")}
                        className="bg-slate-900 text-white border border-border shadow-sm hover:shadow-sm transition-all font-semibold text-xs"
                    >
                        Kembali ke Dasbor
                    </Button>
                </div>
            </div>
        </div>
    )
}
