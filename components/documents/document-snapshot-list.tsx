"use client"
import { Button } from '@/components/ui/button'
import { FileText, Plus } from 'lucide-react'
import { DocumentVersionRow } from './document-version-row'
import { useDocumentSnapshots, useGenerateSnapshot } from '@/hooks/use-document-snapshots'

interface Props {
    type: string
    entityId: string
}

export function DocumentSnapshotList({ type, entityId }: Props) {
    const { data: snapshots = [], isLoading } = useDocumentSnapshots(type, entityId)
    const generate = useGenerateSnapshot(type, entityId)

    if (isLoading) {
        return <div className="p-8 text-center text-sm text-zinc-500">Memuat dokumen...</div>
    }

    if (snapshots.length === 0) {
        return (
            <div className="p-8 text-center border border-dashed border-zinc-300 rounded">
                <FileText className="h-8 w-8 mx-auto text-zinc-400 mb-2" />
                <p className="text-sm text-zinc-500 mb-3">Belum ada dokumen tercatat</p>
                <Button size="sm" onClick={() => generate.mutate()} disabled={generate.isPending}>
                    <Plus className="h-3.5 w-3.5 mr-1" />
                    {generate.isPending ? 'Membuat...' : 'Generate Sekarang'}
                </Button>
            </div>
        )
    }

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <div className="text-sm font-medium">{snapshots.length} versi</div>
                <Button size="sm" variant="outline" onClick={() => generate.mutate()} disabled={generate.isPending}>
                    <Plus className="h-3.5 w-3.5 mr-1" /> Versi Baru
                </Button>
            </div>
            <div className="border border-zinc-200 rounded">
                {snapshots.map((s: any, i: number) => (
                    <DocumentVersionRow
                        key={s.id}
                        snapshot={s}
                        isLatest={i === 0}
                        type={type}
                        entityId={entityId}
                    />
                ))}
            </div>
        </div>
    )
}
