import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

export default function LoadingRequests() {
    return (
        <div className="flex-1 space-y-6 p-4 md:p-8 pt-6 font-sans">
            {/* Header Skeleton */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <Skeleton className="h-10 w-64 mb-2 bg-zinc-200" />
                    <Skeleton className="h-5 w-96 bg-zinc-100" />
                </div>
            </div>

            {/* Content Skeleton */}
            <div className="space-y-6">
                {/* Toolbar Skeleton */}
                <div className="flex flex-col sm:flex-row items-center gap-4 bg-white p-2 border border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] rounded-xl">
                    <Skeleton className="h-10 w-full flex-1 rounded-lg bg-zinc-100" />
                    <div className="flex bg-zinc-100 p-1 rounded-lg gap-1">
                        <Skeleton className="h-8 w-20 rounded-md bg-white" />
                        <Skeleton className="h-8 w-20 rounded-md bg-zinc-200" />
                        <Skeleton className="h-8 w-20 rounded-md bg-zinc-200" />
                    </div>
                </div>

                {/* Grid Skeleton */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {[1, 2, 3, 4].map((i) => (
                        <Card key={i} className="border border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] bg-white rounded-xl overflow-hidden opacity-60">
                            <CardHeader className="flex-row items-start justify-between pb-2">
                                <div className="flex items-center gap-3">
                                    <Skeleton className="h-12 w-12 rounded-full bg-zinc-200" />
                                    <div className="space-y-2">
                                        <Skeleton className="h-5 w-32 bg-zinc-200" />
                                        <Skeleton className="h-4 w-24 bg-zinc-100" />
                                    </div>
                                </div>
                                <Skeleton className="h-6 w-20 rounded-full bg-zinc-100" />
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <Skeleton className="h-24 w-full rounded-lg bg-zinc-50" />
                            </CardContent>
                            <CardFooter className="pt-4 border-t border-black bg-zinc-50 flex gap-2">
                                <Skeleton className="h-10 w-full rounded-md bg-zinc-200" />
                                <Skeleton className="h-10 w-full rounded-md bg-zinc-200" />
                            </CardFooter>
                        </Card>
                    ))}
                </div>
            </div>
        </div>
    )
}
