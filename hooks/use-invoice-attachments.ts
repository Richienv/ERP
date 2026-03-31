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
    const qk = queryKeys.invoices.attachments(invoiceId)

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
        onMutate: async (file: File) => {
            await queryClient.cancelQueries({ queryKey: qk })
            const previous = queryClient.getQueryData<InvoiceAttachment[]>(qk)
            // Add optimistic placeholder with temp ID
            const optimistic: InvoiceAttachment = {
                id: `temp-${Date.now()}`,
                invoiceId,
                fileName: file.name,
                fileUrl: "",
                fileType: file.type,
                fileSize: file.size,
                uploadedAt: new Date().toISOString(),
            }
            queryClient.setQueryData<InvoiceAttachment[]>(qk, (old) => [...(old ?? []), optimistic])
            return { previous }
        },
        onSuccess: (serverData) => {
            // Replace temp placeholder with real server data
            queryClient.setQueryData<InvoiceAttachment[]>(qk, (old) =>
                old?.map((a) => a.id.startsWith("temp-") ? serverData : a) ?? [serverData]
            )
            toast.success("Lampiran berhasil diupload")
        },
        onError: (err: Error, _vars, context) => {
            if (context?.previous) {
                queryClient.setQueryData(qk, context.previous)
            }
            toast.error(err.message || "Gagal mengupload lampiran")
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: qk })
        },
    })
}

export function useDeleteInvoiceAttachment(invoiceId: string) {
    const queryClient = useQueryClient()
    const qk = queryKeys.invoices.attachments(invoiceId)

    return useMutation({
        mutationFn: async (attachmentId: string) => {
            const res = await fetch(`/api/finance/invoice-attachments/${attachmentId}`, {
                method: "DELETE",
            })
            const json = await res.json()
            if (!json.success) throw new Error(json.error)
        },
        onMutate: async (attachmentId: string) => {
            await queryClient.cancelQueries({ queryKey: qk })
            const previous = queryClient.getQueryData<InvoiceAttachment[]>(qk)
            // Optimistically remove from list
            queryClient.setQueryData<InvoiceAttachment[]>(qk, (old) =>
                old?.filter((a) => a.id !== attachmentId) ?? []
            )
            return { previous }
        },
        onError: (err: Error, _vars, context) => {
            if (context?.previous) {
                queryClient.setQueryData(qk, context.previous)
            }
            toast.error(err.message || "Gagal menghapus lampiran")
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: qk })
        },
    })
}
