"use client"
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/lib/query-keys'
import { toast } from 'sonner'

export function useDocumentSnapshots(type: string, entityId: string) {
    return useQuery({
        queryKey: queryKeys.documents.list(type, entityId),
        queryFn: async () => {
            const res = await fetch(`/api/documents/snapshots?type=${type}&entityId=${entityId}`)
            if (!res.ok) {
                if (res.status === 403) throw new Error('Anda tidak memiliki akses ke dokumen ini')
                throw new Error('Gagal memuat dokumen')
            }
            const json = await res.json()
            return json.data ?? []
        },
        enabled: !!entityId,
        // No polling — snapshot generation is async but explicit. User can
        // click "Generate Sekarang" in the empty state, and useGenerateSnapshot
        // / useRegenerateSnapshot mutations invalidate this query on success.
        // The previous 2s poll wasted ~1.5 req/s on every PO/PR/GRN detail open.
    })
}

export function useGenerateSnapshot(type: string, entityId: string) {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: async () => {
            const res = await fetch('/api/documents/snapshots', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type, entityId }),
            })
            if (!res.ok) throw new Error('Generate failed')
            return res.json()
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: queryKeys.documents.list(type, entityId) })
            toast.success('PDF dibuat')
        },
        onError: () => toast.error('Gagal membuat PDF'),
    })
}

export function useRegenerateSnapshot(type: string, entityId: string) {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: async (snapshotId: string) => {
            const res = await fetch('/api/documents/regenerate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ snapshotId }),
            })
            if (!res.ok) throw new Error('Regenerate failed')
            return res.json()
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: queryKeys.documents.list(type, entityId) })
            toast.success('Versi baru dibuat')
        },
    })
}

export function useLogDistribution() {
    return useMutation({
        mutationFn: async (input: { snapshotId: string; action: string; recipientEmail?: string; notes?: string }) => {
            await fetch('/api/documents/distributions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(input),
            })
        },
    })
}

export async function fetchSignedUrl(snapshotId: string): Promise<string> {
    const res = await fetch(`/api/documents/snapshots/${snapshotId}`)
    const json = await res.json()
    return json.data.signedUrl
}
