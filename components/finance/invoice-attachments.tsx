"use client"

import { useRef } from "react"
import { useInvoiceAttachments, useUploadInvoiceAttachment, useDeleteInvoiceAttachment } from "@/hooks/use-invoice-attachments"
import { Button } from "@/components/ui/button"
import { IconUpload, IconTrash, IconFile, IconLoader2, IconPaperclip } from "@tabler/icons-react"

function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

interface InvoiceAttachmentSectionProps {
    invoiceId: string
}

export function InvoiceAttachmentSection({ invoiceId }: InvoiceAttachmentSectionProps) {
    const fileInputRef = useRef<HTMLInputElement>(null)
    const { data: attachments, isLoading } = useInvoiceAttachments(invoiceId)
    const uploadMutation = useUploadInvoiceAttachment(invoiceId)
    const deleteMutation = useDeleteInvoiceAttachment(invoiceId)

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (file) {
            uploadMutation.mutate(file)
            // Reset input so same file can be selected again
            e.target.value = ""
        }
    }

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault()
        const file = e.dataTransfer.files?.[0]
        if (file) {
            uploadMutation.mutate(file)
        }
    }

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault()
    }

    const isImage = (fileType: string) => fileType.startsWith("image/")

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold flex items-center gap-1.5">
                    <IconPaperclip className="h-4 w-4" />
                    Lampiran
                    {attachments && attachments.length > 0 && (
                        <span className="ml-1 text-xs text-muted-foreground">({attachments.length})</span>
                    )}
                </h4>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadMutation.isPending}
                    className="h-7 text-xs border-2 border-black rounded-none shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                >
                    {uploadMutation.isPending ? (
                        <IconLoader2 className="h-3 w-3 animate-spin mr-1" />
                    ) : (
                        <IconUpload className="h-3 w-3 mr-1" />
                    )}
                    Upload
                </Button>
                <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png,.webp"
                    onChange={handleFileSelect}
                    className="hidden"
                />
            </div>

            {/* Drop zone - shown when no attachments */}
            {(!attachments || attachments.length === 0) && !isLoading && (
                <div
                    onDrop={handleDrop}
                    onDragOver={handleDragOver}
                    className="border-2 border-dashed border-zinc-300 rounded-none p-6 text-center cursor-pointer hover:border-zinc-400 transition-colors"
                    onClick={() => fileInputRef.current?.click()}
                >
                    <IconUpload className="h-6 w-6 mx-auto mb-2 text-zinc-400" />
                    <p className="text-xs text-muted-foreground">
                        Seret file ke sini atau klik untuk upload
                    </p>
                    <p className="text-[10px] text-zinc-400 mt-1">
                        PDF, JPG, PNG, WebP · Maks 10MB
                    </p>
                </div>
            )}

            {isLoading && (
                <div className="flex items-center justify-center py-4">
                    <IconLoader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    <span className="ml-2 text-xs text-muted-foreground">Memuat lampiran...</span>
                </div>
            )}

            {/* Attachment list */}
            {attachments && attachments.length > 0 && (
                <div className="space-y-2" onDrop={handleDrop} onDragOver={handleDragOver}>
                    {attachments.map((att) => (
                        <div
                            key={att.id}
                            className="flex items-center gap-3 p-2 border-2 border-zinc-200 rounded-none hover:border-zinc-300 transition-colors group"
                        >
                            {/* Thumbnail or icon */}
                            {isImage(att.fileType) ? (
                                <a href={att.fileUrl} target="_blank" rel="noopener noreferrer" className="shrink-0">
                                    <img
                                        src={att.fileUrl}
                                        alt={att.fileName}
                                        className="h-10 w-10 object-cover border border-zinc-200"
                                    />
                                </a>
                            ) : (
                                <a href={att.fileUrl} target="_blank" rel="noopener noreferrer" className="shrink-0">
                                    <div className="h-10 w-10 flex items-center justify-center bg-red-50 border border-red-200">
                                        <IconFile className="h-5 w-5 text-red-500" />
                                    </div>
                                </a>
                            )}

                            {/* File info */}
                            <div className="flex-1 min-w-0">
                                <a
                                    href={att.fileUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-xs font-medium truncate block hover:underline"
                                >
                                    {att.fileName}
                                </a>
                                <p className="text-[10px] text-muted-foreground">
                                    {formatFileSize(att.fileSize)} · {new Date(att.uploadedAt).toLocaleDateString("id-ID")}
                                </p>
                            </div>

                            {/* Delete */}
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => deleteMutation.mutate(att.id)}
                                disabled={deleteMutation.isPending}
                                className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity text-red-500 hover:text-red-700 hover:bg-red-50"
                            >
                                <IconTrash className="h-3.5 w-3.5" />
                            </Button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}
