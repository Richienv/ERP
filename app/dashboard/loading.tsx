import { Skeleton } from "@/components/ui/skeleton"
import { FinanceGridSkeleton, KPIGridSkeleton, OperationsSkeleton } from "@/components/dashboard/skeletons"

export default function Loading() {
    return (
        <div className="relative min-h-[calc(100vh-theme(spacing.16))] w-full bg-zinc-50 dark:bg-black font-sans selection:bg-zinc-200 dark:selection:bg-zinc-800">
            <div className="relative z-10 container mx-auto p-4 md:p-8 space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-6 gap-6 auto-rows-min">
                    {/* Morning Focus Skeleton */}
                    <div className="md:col-span-3 md:row-span-2">
                        <div className="relative overflow-hidden rounded-3xl bg-card border border-border/50 p-8 shadow-sm min-h-[300px] flex flex-col justify-between">
                            <div className="space-y-6">
                                <div className="inline-flex items-center gap-2 rounded-full bg-secondary/50 px-3 py-1 border border-border/50">
                                    <Skeleton className="h-3 w-3 rounded-full" />
                                    <Skeleton className="h-3 w-20" />
                                </div>
                                <div className="space-y-3">
                                    <Skeleton className="h-10 w-56" />
                                    <Skeleton className="h-10 w-40" />
                                </div>
                                <div className="space-y-2 max-w-md">
                                    <Skeleton className="h-4 w-full" />
                                    <Skeleton className="h-4 w-[85%]" />
                                    <Skeleton className="h-4 w-[70%]" />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* AI Search Skeleton */}
                    <div className="md:col-span-3 md:row-span-2 h-full">
                        <div className="relative overflow-hidden rounded-3xl bg-card border border-border/50 p-6 md:p-8 flex flex-col h-full shadow-sm">
                            <div className="flex items-center gap-3">
                                <div className="p-3 rounded-xl bg-primary/5 border border-primary/10">
                                    <Skeleton className="h-6 w-6 rounded" />
                                </div>
                                <div className="space-y-2">
                                    <Skeleton className="h-5 w-28" />
                                    <Skeleton className="h-3 w-40" />
                                </div>
                            </div>

                            <div className="flex-1 flex flex-col justify-center gap-4 mt-6">
                                <div className="space-y-2">
                                    <Skeleton className="h-4 w-[80%]" />
                                    <Skeleton className="h-4 w-[60%]" />
                                </div>

                                <div className="relative">
                                    <Skeleton className="h-16 w-full rounded-2xl" />
                                    <div className="absolute inset-y-2 right-2">
                                        <Skeleton className="h-12 w-12 rounded-xl" />
                                    </div>
                                </div>

                                <div className="flex gap-2 flex-wrap mt-2">
                                    <Skeleton className="h-6 w-32 rounded" />
                                    <Skeleton className="h-6 w-28 rounded" />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Metrics Skeleton (Full Width) */}
                    <div className="md:col-span-6 space-y-6">
                        <FinanceGridSkeleton />
                        <KPIGridSkeleton />
                    </div>

                    {/* Operations Skeleton */}
                    <OperationsSkeleton />

                    {/* Launcher Skeleton */}
                    <div className="md:col-span-6">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2">
                                <Skeleton className="h-6 w-1 rounded-full" />
                                <Skeleton className="h-6 w-24" />
                            </div>
                            <Skeleton className="h-9 w-9 rounded-md" />
                        </div>

                        <div className="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
                            {Array.from({ length: 9 }).map((_, i) => (
                                <div key={i} className="rounded-2xl border border-border/50 bg-card shadow-sm p-5">
                                    <div className="flex items-start gap-4">
                                        <Skeleton className="h-12 w-12 rounded-xl" />
                                        <div className="flex-1 space-y-2">
                                            <Skeleton className="h-4 w-28" />
                                            <Skeleton className="h-3 w-[90%]" />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
