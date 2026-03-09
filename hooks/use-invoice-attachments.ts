"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import { toast } from "sonner"

interface InvoiceAttachment {
    id: string
    invoiceId: string
    fileName: string
    fileUrl: string
    fileType: string
    fileSize: number
    uploadedAt: string
}

export function useInvoiceAttachments(invoiceId: string | null) {
    return useQuery({
        queryKey: queryKeys.invoices.attachments(invoiceId ?? ""),
        queryFn: async () => {
            const res = await fetch(`/api/finance/invoices/${invoiceId}/attachments`)
            const json = await res.json()
            if (!json.success) throw new Error(json.error)
            return json.data as InvoiceAttachment[]
        },
        enabled: !!invoiceId,
    })
}

export function useUploadInvoiceAttachment(invoiceId: string) {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: async (file: File) => {
            const formData = new FormData()
            formData.append("file", file)
            const res = await fetch(`/api/finance/invoices/${invoiceId}/attachments`, {
                method: "POST",
                body: formData,
            })
            const json = await res.json()
            if (!json.success) throw new Error(json.error)
            return json.data as InvoiceAttachment
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.invoices.attachments(invoiceId) })
            toast.success("Lampiran berhasil diupload")
        },
        onError: (err: Error) => {
            toast.error(err.message || "Gagal mengupload lampiran")
        },
    })
}

export function useDeleteInvoiceAttachment(invoiceId: string) {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: async (attachmentId: string) => {
            const res = await fetch(`/api/finance/invoice-attachments/${attachmentId}`, {
                method: "DELETE",
            })
            const json = await res.json()
            if (!json.success) throw new Error(json.error)
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.invoices.attachments(invoiceId) })
            toast.success("Lampiran berhasil dihapus")
        },
        onError: (err: Error) => {
            toast.error(err.message || "Gagal menghapus lampiran")
        },
    })
}
