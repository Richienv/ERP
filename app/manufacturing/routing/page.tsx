"use client"

import { useMfgRouting } from "@/hooks/use-mfg-routing"
import { RoutingClient } from "./routing-client"
import { TablePageSkeleton } from "@/components/ui/page-skeleton"

export default function RoutingPage() {
    const { data, isLoading } = useMfgRouting()

    if (isLoading) {
        return <TablePageSkeleton accentColor="bg-cyan-400" />
    }

    return <RoutingClient initialRoutings={data ?? []} />
}
