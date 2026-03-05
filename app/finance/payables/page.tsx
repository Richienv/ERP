"use client"

import { useState } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useSearchParams } from "next/navigation"
import dynamic from "next/dynamic"
import { NotaDebitTab } from "@/components/finance/nota-debit-tab"
import { TablePageSkeleton } from "@/components/ui/page-skeleton"

const BillsTab = dynamic(() => import("@/app/finance/bills/page"), {
    ssr: false,
    loading: () => <TablePageSkeleton accentColor="bg-red-400" />,
})
const VendorPaymentsTab = dynamic(() => import("@/app/finance/vendor-payments/page"), {
    ssr: false,
    loading: () => <TablePageSkeleton accentColor="bg-emerald-400" />,
})

export default function PayablesPage() {
    const searchParams = useSearchParams()
    const initialTab = searchParams.get("tab") || "tagihan"
    const [activeTab, setActiveTab] = useState(initialTab)

    return (
        <div className="mf-page">
            <div className="flex items-center justify-between mb-4">
                <div>
                    <h1 className="text-2xl font-black tracking-tight">Hutang Usaha (AP)</h1>
                    <p className="text-xs text-zinc-500 font-medium mt-1">Kelola tagihan vendor, pembayaran, dan nota debit</p>
                </div>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="border-2 border-black bg-white h-10 p-1 gap-1">
                    <TabsTrigger value="tagihan" className="font-bold text-xs uppercase tracking-wider data-[state=active]:bg-black data-[state=active]:text-white">
                        Tagihan
                    </TabsTrigger>
                    <TabsTrigger value="pembayaran" className="font-bold text-xs uppercase tracking-wider data-[state=active]:bg-black data-[state=active]:text-white">
                        Pembayaran
                    </TabsTrigger>
                    <TabsTrigger value="nota-debit" className="font-bold text-xs uppercase tracking-wider data-[state=active]:bg-black data-[state=active]:text-white">
                        Nota Debit
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="tagihan" className="mt-4 [&>.mf-page]:p-0 [&>.mf-page]:pt-0 [&>.mf-page]:bg-transparent">
                    <BillsTab />
                </TabsContent>
                <TabsContent value="pembayaran" className="mt-4 [&>.mf-page]:p-0 [&>.mf-page]:pt-0 [&>.mf-page]:bg-transparent">
                    <VendorPaymentsTab />
                </TabsContent>
                <TabsContent value="nota-debit" className="mt-4">
                    <NotaDebitTab />
                </TabsContent>
            </Tabs>
        </div>
    )
}
