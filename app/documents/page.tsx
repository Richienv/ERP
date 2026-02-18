"use client"

import { useDocuments } from "@/hooks/use-documents"
import { DocumentSystemControlCenter } from "@/components/documents/document-system-control-center"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { AlertTriangle } from "lucide-react"
import { TablePageSkeleton } from "@/components/ui/page-skeleton"

export default function DocumentsPage() {
    const { data, isLoading, error } = useDocuments()

    if (isLoading) {
        return <TablePageSkeleton accentColor="bg-indigo-400" />
    }

    if (error || !data) {
        return (
            <div className="space-y-6 p-4 md:p-8">
                <Card className="border-red-200 bg-red-50/50">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-red-700">
                            <AlertTriangle className="h-5 w-5" />
                            Gagal Memuat Dokumen & Sistem
                        </CardTitle>
                        <CardDescription className="text-red-700/80">
                            Terjadi kendala saat mengambil data. Periksa koneksi Supabase dan hak akses akun Anda.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="text-sm text-red-800">
                        {error?.message || "Unknown error"}
                    </CardContent>
                </Card>
            </div>
        )
    }

    return <DocumentSystemControlCenter initialData={data} />
}
