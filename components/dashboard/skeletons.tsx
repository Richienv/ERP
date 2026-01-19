import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent, CardHeader } from "@/components/ui/card"

export function MetricCardSkeleton() {
    return (
        <Card className="border-2 border-black/5 dark:border-white/10 shadow-sm h-full">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <Skeleton className="h-4 w-[100px]" />
                <Skeleton className="h-4 w-4 rounded-full" />
            </CardHeader>
            <CardContent>
                <Skeleton className="h-8 w-[120px] mb-2" />
                <Skeleton className="h-4 w-[80px]" />
                <div className="mt-4 space-y-2">
                    <Skeleton className="h-3 w-full" />
                    <Skeleton className="h-3 w-[80%]" />
                </div>
            </CardContent>
        </Card>
    )
}

export function KPICardSkeleton() {
    return (
        <Card className="border-2 border-dashed border-zinc-200 shadow-none h-full bg-zinc-50/50">
            <CardHeader className="pb-2 border-b-2 border-dashed border-zinc-200/50">
                <div className="flex items-center justify-between">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-5 w-16 rounded" />
                </div>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
                {/* Main KPI Number */}
                <div className="flex justify-between items-start">
                    <div className="space-y-1">
                        <Skeleton className="h-3 w-12" />
                        <Skeleton className="h-8 w-20" />
                    </div>
                    <Skeleton className="h-8 w-8 rounded-full" />
                </div>

                {/* Sub List */}
                <div className="space-y-2">
                    <div className="flex justify-between">
                        <Skeleton className="h-3 w-20" />
                        <Skeleton className="h-3 w-8" />
                    </div>
                    <div className="flex justify-between">
                        <Skeleton className="h-3 w-16" />
                        <Skeleton className="h-3 w-10" />
                    </div>
                </div>
            </CardContent>
        </Card>
    )
}

export function FinanceGridSkeleton() {
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <MetricCardSkeleton />
            <MetricCardSkeleton />
            <MetricCardSkeleton />
            <MetricCardSkeleton />
        </div>
    )
}

export function KPIGridSkeleton() {
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <KPICardSkeleton />
            <KPICardSkeleton />
            <KPICardSkeleton />
            <KPICardSkeleton />
        </div>
    )
}

export function OperationsSkeleton() {
    return (
        <div className="md:col-span-6 grid grid-cols-1 md:grid-cols-6 gap-6">
            {/* Rows matching the OperationsWrapper layout */}
            <div className="md:col-span-4 h-full min-h-[400px]">
                <div className="bg-zinc-100 dark:bg-zinc-800 rounded-xl h-full animate-pulse" />
            </div>
            <div className="md:col-span-2 h-full min-h-[400px]">
                <div className="bg-zinc-100 dark:bg-zinc-800 rounded-xl h-full animate-pulse" />
            </div>
            <div className="md:col-span-6 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
                {[1, 2, 3, 4].map(i => (
                    <div key={i} className="min-h-[400px] bg-zinc-100 dark:bg-zinc-800 rounded-xl animate-pulse" />
                ))}
            </div>
        </div>
    )
}
