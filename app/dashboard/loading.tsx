export default function Loading() {
    return (
        <div className="w-full bg-zinc-50 dark:bg-black font-sans min-h-[calc(100svh-theme(spacing.16))]">
            <div className="flex flex-col gap-4 p-4 md:p-5 lg:p-6 h-[calc(100svh-theme(spacing.16))]">

                {/* Row 1: Pulse Bar Skeleton */}
                <div className="flex-none">
                    <div className="bg-black border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] h-[100px] animate-pulse">
                        <div className="grid grid-cols-2 md:grid-cols-5 h-full">
                            {[...Array(5)].map((_, i) => (
                                <div key={i} className={`p-5 ${i < 4 ? "md:border-r-2 border-white/10" : ""}`}>
                                    <div className="h-3 w-12 bg-white/10 rounded mb-3" />
                                    <div className="h-7 w-24 bg-white/10 rounded mb-2" />
                                    <div className="h-2 w-16 bg-white/10 rounded" />
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Row 2: Middle Row Skeleton */}
                <div className="flex-1 grid grid-cols-1 md:grid-cols-12 gap-4 min-h-0">
                    {/* Action Center */}
                    <div className="md:col-span-3">
                        <div className="h-full bg-white dark:bg-zinc-900 border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] animate-pulse">
                            <div className="h-12 bg-amber-400/30 border-b-2 border-black" />
                            <div className="h-10 border-b-2 border-black bg-zinc-50 dark:bg-zinc-800" />
                            <div className="p-4 space-y-3">
                                <div className="h-16 bg-zinc-100 dark:bg-zinc-800 rounded" />
                                <div className="h-16 bg-zinc-100 dark:bg-zinc-800 rounded" />
                            </div>
                        </div>
                    </div>
                    {/* Financial Health */}
                    <div className="md:col-span-5">
                        <div className="h-full bg-white dark:bg-zinc-900 border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] animate-pulse">
                            <div className="h-12 border-b-2 border-black bg-zinc-50 dark:bg-zinc-800" />
                            <div className="h-[120px] p-4">
                                <div className="h-full bg-zinc-100 dark:bg-zinc-800 rounded" />
                            </div>
                            <div className="grid grid-cols-2 border-t-2 border-dashed border-zinc-200 dark:border-zinc-700">
                                <div className="p-4 border-r-2 border-dashed border-zinc-200 dark:border-zinc-700">
                                    <div className="h-3 w-16 bg-zinc-100 dark:bg-zinc-800 rounded mb-2" />
                                    <div className="h-6 w-20 bg-zinc-100 dark:bg-zinc-800 rounded" />
                                </div>
                                <div className="p-4">
                                    <div className="h-3 w-16 bg-zinc-100 dark:bg-zinc-800 rounded mb-2" />
                                    <div className="h-6 w-20 bg-zinc-100 dark:bg-zinc-800 rounded" />
                                </div>
                            </div>
                        </div>
                    </div>
                    {/* AI Search */}
                    <div className="md:col-span-4">
                        <div className="h-full bg-white dark:bg-zinc-900 border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] animate-pulse">
                            <div className="p-6 space-y-4">
                                <div className="flex items-center gap-3">
                                    <div className="h-10 w-10 bg-zinc-100 dark:bg-zinc-800 rounded" />
                                    <div className="space-y-2">
                                        <div className="h-4 w-20 bg-zinc-100 dark:bg-zinc-800 rounded" />
                                        <div className="h-3 w-32 bg-zinc-100 dark:bg-zinc-800 rounded" />
                                    </div>
                                </div>
                                <div className="h-12 bg-zinc-100 dark:bg-zinc-800 rounded" />
                                <div className="flex gap-2">
                                    <div className="h-6 w-28 bg-zinc-100 dark:bg-zinc-800 rounded" />
                                    <div className="h-6 w-24 bg-zinc-100 dark:bg-zinc-800 rounded" />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Row 3: Operations Strip Skeleton */}
                <div className="flex-none">
                    <div className="bg-white dark:bg-zinc-900 border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] animate-pulse">
                        <div className="grid grid-cols-2 md:grid-cols-5 h-[90px]">
                            {[...Array(5)].map((_, i) => (
                                <div key={i} className={`p-4 ${i < 4 ? "md:border-r-2 border-black" : ""}`}>
                                    <div className="h-3 w-16 bg-zinc-100 dark:bg-zinc-800 rounded mb-3" />
                                    <div className="h-6 w-12 bg-zinc-100 dark:bg-zinc-800 rounded mb-2" />
                                    <div className="h-2 w-14 bg-zinc-100 dark:bg-zinc-800 rounded" />
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Row 4: Bottom Row Skeleton */}
                <div className="flex-none grid grid-cols-1 md:grid-cols-12 gap-4" style={{ height: "180px" }}>
                    <div className="md:col-span-8">
                        <div className="h-full bg-white dark:bg-zinc-900 border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] animate-pulse">
                            <div className="h-10 bg-zinc-50 dark:bg-zinc-800 border-b-2 border-black" />
                            <div className="p-3 space-y-3">
                                {[...Array(4)].map((_, i) => (
                                    <div key={i} className="flex gap-3">
                                        <div className="h-4 w-4 bg-zinc-100 dark:bg-zinc-800 rounded" />
                                        <div className="flex-1 space-y-1">
                                            <div className="h-3 w-3/4 bg-zinc-100 dark:bg-zinc-800 rounded" />
                                            <div className="h-2 w-1/2 bg-zinc-100 dark:bg-zinc-800 rounded" />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                    <div className="md:col-span-4">
                        <div className="h-full bg-white dark:bg-zinc-900 border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] animate-pulse">
                            <div className="h-10 bg-zinc-50 dark:bg-zinc-800 border-b-2 border-black" />
                            <div className="p-4 space-y-3">
                                {[...Array(4)].map((_, i) => (
                                    <div key={i} className="flex items-center gap-3">
                                        <div className="h-4 w-4 bg-zinc-100 dark:bg-zinc-800 rounded" />
                                        <div className="flex-1">
                                            <div className="h-1.5 bg-zinc-100 dark:bg-zinc-800 rounded w-full" />
                                        </div>
                                        <div className="h-4 w-6 bg-zinc-100 dark:bg-zinc-800 rounded" />
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    )
}
