"use client"

import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

export function KPISkeleton() {
    return (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
                <Card key={i} className="bg-white border-2 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
                    <CardHeader className="pb-2 border-b-2 border-black">
                        <Skeleton className="h-4 w-32" />
                    </CardHeader>
                    <CardContent className="pt-6">
                        <Skeleton className="h-8 w-24 mb-4" />
                        <div className="space-y-2">
                            <Skeleton className="h-3 w-full" />
                            <Skeleton className="h-3 w-full" />
                            <Skeleton className="h-3 w-3/4" />
                        </div>
                    </CardContent>
                </Card>
            ))}
        </div>
    )
}

export function MaterialTableSkeleton() {
    return (
        <Card className="border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] bg-white mt-6">
            <CardHeader className="border-b-2 border-black">
                <div className="flex items-center justify-between">
                    <Skeleton className="h-6 w-48" />
                    <div className="flex gap-2">
                        <Skeleton className="h-9 w-24" />
                        <Skeleton className="h-9 w-24" />
                    </div>
                </div>
            </CardHeader>
            <CardContent className="p-0">
                <div className="divide-y">
                    {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                        <div key={i} className="flex items-center gap-4 p-4">
                            <Skeleton className="h-10 w-10 rounded" />
                            <div className="flex-1 space-y-2">
                                <Skeleton className="h-4 w-48" />
                                <Skeleton className="h-3 w-24" />
                            </div>
                            <Skeleton className="h-6 w-16" />
                            <Skeleton className="h-6 w-20" />
                            <Skeleton className="h-8 w-24" />
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    )
}

export function ProcurementInsightsSkeleton() {
    return (
        <div className="space-y-6">
            <Skeleton className="h-7 w-64" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card className="border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] bg-white">
                    <CardHeader className="bg-red-50 border-b-2 border-black pb-3">
                        <Skeleton className="h-5 w-48" />
                    </CardHeader>
                    <CardContent className="pt-6 space-y-4">
                        <Skeleton className="h-10 w-40" />
                        <Skeleton className="h-3 w-56" />
                        <div className="space-y-2 mt-4">
                            {[1, 2, 3, 4].map((i) => (
                                <Skeleton key={i} className="h-12 w-full" />
                            ))}
                        </div>
                    </CardContent>
                </Card>
                <Card className="border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] bg-white">
                    <CardHeader className="bg-indigo-50 border-b-2 border-black pb-3">
                        <Skeleton className="h-5 w-40" />
                    </CardHeader>
                    <CardContent className="pt-6 space-y-4">
                        <Skeleton className="h-8 w-32" />
                        <div className="space-y-3 mt-4">
                            {[1, 2, 3].map((i) => (
                                <Skeleton key={i} className="h-16 w-full" />
                            ))}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}

export function WarehouseCardsSkeleton() {
    return (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
                <Card key={i} className="border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] bg-white">
                    <CardHeader className="border-b-2 border-black">
                        <div className="flex items-center justify-between">
                            <Skeleton className="h-6 w-40" />
                            <Skeleton className="h-5 w-16" />
                        </div>
                    </CardHeader>
                    <CardContent className="pt-4 space-y-3">
                        <div className="grid grid-cols-2 gap-4">
                            <Skeleton className="h-16 w-full" />
                            <Skeleton className="h-16 w-full" />
                        </div>
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-4 w-3/4" />
                    </CardContent>
                </Card>
            ))}
        </div>
    )
}
