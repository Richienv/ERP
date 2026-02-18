"use client"

import { useMfgGroups } from "@/hooks/use-mfg-groups"
import { GroupsClient } from "./groups-client"
import { CardPageSkeleton } from "@/components/ui/page-skeleton"

export default function WorkCenterGroupsPage() {
    const { data, isLoading } = useMfgGroups()

    if (isLoading) {
        return <CardPageSkeleton accentColor="bg-violet-400" />
    }

    return <GroupsClient initialGroups={data ?? []} />
}
