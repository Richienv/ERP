"use client"
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Printer, Download, Mail, RotateCw } from 'lucide-react'
import { DocumentVersionPill } from './document-version-pill'
import { DistributionDialog } from './distribution-dialog'
import { useLogDistribution, useRegenerateSnapshot, fetchSignedUrl } from '@/hooks/use-document-snapshots'

interface Snapshot {
    id: string
    version: number
    triggerEvent: string
    generatedAt: string | Date
    label?: string | null
}

interface Props {
    snapshot: Snapshot
    isLatest: boolean
    type: string
    entityId: string
}

export function DocumentVersionRow({ snapshot, isLatest, type, entityId }: Props) {
    const [emailOpen, setEmailOpen] = useState(false)
    const logDist = useLogDistribution()
    const regen = useRegenerateSnapshot(type, entityId)

    async function handleOpen(action: 'PRINT' | 'DOWNLOAD') {
        const url = await fetchSignedUrl(snapshot.id)
        await logDist.mutateAsync({ snapshotId: snapshot.id, action })
        window.open(url, '_blank')
    }

    return (
        <div className="flex items-center gap-3 p-3 border-b border-zinc-200 last:border-b-0">
            <DocumentVersionPill version={snapshot.version} isLatest={isLatest} />
            <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{snapshot.label ?? snapshot.triggerEvent}</div>
                <div className="text-[11px] text-zinc-500">
                    {new Date(snapshot.generatedAt).toLocaleString('id-ID')} • {snapshot.triggerEvent}
                </div>
            </div>
            <div className="flex gap-1">
                <Button size="sm" variant="ghost" onClick={() => handleOpen('PRINT')}>
                    <Printer className="h-3.5 w-3.5" />
                </Button>
                <Button size="sm" variant="ghost" onClick={() => handleOpen('DOWNLOAD')}>
                    <Download className="h-3.5 w-3.5" />
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setEmailOpen(true)}>
                    <Mail className="h-3.5 w-3.5" />
                </Button>
                <Button size="sm" variant="ghost" onClick={() => regen.mutate(snapshot.id)} disabled={regen.isPending}>
                    <RotateCw className="h-3.5 w-3.5" />
                </Button>
            </div>
            <DistributionDialog
                open={emailOpen}
                onClose={() => setEmailOpen(false)}
                onSubmit={async (email, notes) => {
                    await logDist.mutateAsync({ snapshotId: snapshot.id, action: 'EMAIL', recipientEmail: email, notes })
                }}
            />
        </div>
    )
}
