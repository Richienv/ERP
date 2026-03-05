"use client"

import { useState } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useSearchParams } from "next/navigation"
import dynamic from "next/dynamic"
import { NotaKreditTab } from "@/components/finance/nota-kredit-tab"
import { TablePageSkeleton } from "@/components/ui/page-skeleton"

const PaymentsTab = dynamic(() => import("@/app/finance/payments/page"), {
    ssr: false,
    loading: () => <TablePageSkeleton accentColor="bg-green-400" />,
})

export default function ReceivablesPage() {
    const searchParams = useSearchParams()
    const initialTab = searchParams.get("tab") || "penerimaan"
    const [activeTab, setActiveTab] = useState(initialTab)

    return (
        <div className="mf-page">
            <div className="flex items-center justify-between mb-4">
                <div>
                    <h1 className="text-2xl font-black tracking-tight">Piutang Usaha (AR)</h1>
                    <p className="text-xs text-zinc-500 font-medium mt-1">Kelola penerimaan pembayaran dan nota kredit pelanggan</p>
                </div>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="border-2 border-black bg-white h-10 p-1 gap-1">
                    <TabsTrigger value="penerimaan" className="font-bold text-xs uppercase tracking-wider data-[state=active]:bg-black data-[state=active]:text-white">
                        Penerimaan
                    </TabsTrigger>
                    <TabsTrigger value="nota-kredit" className="font-bold text-xs uppercase tracking-wider data-[state=active]:bg-black data-[state=active]:text-white">
                        Nota Kredit
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="penerimaan" className="mt-4 [&>.mf-page]:p-0 [&>.mf-page]:pt-0 [&>.mf-page]:bg-transparent">
                    <PaymentsTab />
                </TabsContent>
                <TabsContent value="nota-kredit" className="mt-4">
                    <NotaKreditTab />
                </TabsContent>
            </Tabs>
        </div>
    )
}
