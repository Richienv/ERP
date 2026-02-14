"use client"

import { Skeleton } from "@/components/ui/skeleton"

export function KPISkeleton() {
    return (
        <div className="bg-white overflow-hidden">
            <div className="grid grid-cols-2 md:grid-cols-5">
                {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className={`p-4 md:p-5 ${i < 5 ? "md:border-r-2 border-b-2 md:border-b-0 border-zinc-100" : ""}`}>
                        <div className="flex items-center gap-2 mb-2">
                            <Skeleton className="h-5 w-5" />
                            <Skeleton className="h-3 w-20" />
                        </div>
                        <Skeleton className="h-8 w-24 mb-1.5" />
                        <Skeleton className="h-3 w-16" />
                    </div>
                ))}
            </div>
        </div>
    )
}

export function MaterialTableSkeleton() {
    return (
        <div className="bg-white h-full overflow-hidden flex flex-col rounded-none border-0 shadow-none">
            <div className="border-b-2 border-black px-4 py-3 flex items-center justify-between">
                <Skeleton className="h-5 w-48" />
                <div className="flex gap-2">
                    <Skeleton className="h-8 w-20" />
                    <Skeleton className="h-8 w-20" />
                </div>
            </div>
            <div className="flex-1 p-0">
                <div className="divide-y">
                    {[1, 2, 3, 4, 5, 6].map((i) => (
                        <div key={i} className="flex items-center gap-4 p-3">
                            <Skeleton className="h-8 w-8" />
                            <div className="flex-1 space-y-1.5">
                                <Skeleton className="h-4 w-40" />
                                <Skeleton className="h-3 w-20" />
                            </div>
                            <Skeleton className="h-5 w-14" />
                            <Skeleton className="h-5 w-16" />
                            <Skeleton className="h-7 w-20" />
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}

export function ProcurementInsightsSkeleton() {
    return (
        <div className="bg-white overflow-hidden h-full">
            <div className="px-4 py-3 border-b border-zinc-100 flex items-center justify-between">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-5 w-16" />
            </div>
            <div className="px-4 py-3 flex items-center gap-6">
                <div>
                    <Skeleton className="h-6 w-20 mb-1" />
                    <Skeleton className="h-3 w-16" />
                </div>
                <div>
                    <Skeleton className="h-6 w-24 mb-1" />
                    <Skeleton className="h-3 w-20" />
                </div>
            </div>
        </div>
    )
}

export function WarehouseCardsSkeleton() {
    return (
        <div className="flex flex-col gap-3">
            {[1, 2, 3].map((i) => (
                <div key={i} className="bg-white border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
                    <div className="px-3 py-2.5 border-b-2 border-black bg-zinc-50">
                        <Skeleton className="h-4 w-32 mb-1" />
                        <Skeleton className="h-3 w-20" />
                    </div>
                    <div className="px-3 py-2.5 space-y-2">
                        <Skeleton className="h-6 w-24" />
                        <div className="grid grid-cols-3 gap-1.5">
                            <Skeleton className="h-10 w-full" />
                            <Skeleton className="h-10 w-full" />
                            <Skeleton className="h-10 w-full" />
                        </div>
                        <Skeleton className="h-7 w-full" />
                    </div>
                </div>
            ))}
        </div>
    )
}
