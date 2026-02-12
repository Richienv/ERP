import { getDocumentSystemOverview } from "@/app/actions/documents-system"
import { DocumentSystemControlCenter } from "@/components/documents/document-system-control-center"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { AlertTriangle } from "lucide-react"

export const dynamic = "force-dynamic"

type SearchParamsValue = string | string[] | undefined

const readSearchParam = (params: Record<string, SearchParamsValue>, key: string) => {
    const value = params[key]
    if (Array.isArray(value)) return value[0]
    return value
}

const readSearchParamInt = (params: Record<string, SearchParamsValue>, key: string) => {
    const value = Number(readSearchParam(params, key))
    if (!Number.isFinite(value)) return undefined
    return Math.trunc(value)
}

export default async function DocumentsPage({
    searchParams,
}: {
    searchParams?: Promise<Record<string, SearchParamsValue>> | Record<string, SearchParamsValue>
}) {
    const resolvedSearchParams = searchParams
        ? (typeof (searchParams as Promise<Record<string, SearchParamsValue>>).then === "function"
            ? await (searchParams as Promise<Record<string, SearchParamsValue>>)
            : (searchParams as Record<string, SearchParamsValue>))
        : {}

    const overview = await getDocumentSystemOverview({
        registryQuery: {
            purchaseOrders: {
                q: readSearchParam(resolvedSearchParams, "po_q"),
                status: readSearchParam(resolvedSearchParams, "po_status"),
                from: readSearchParam(resolvedSearchParams, "po_from"),
                to: readSearchParam(resolvedSearchParams, "po_to"),
                page: readSearchParamInt(resolvedSearchParams, "po_page"),
                pageSize: readSearchParamInt(resolvedSearchParams, "po_size"),
            },
            invoices: {
                q: readSearchParam(resolvedSearchParams, "inv_q"),
                status: readSearchParam(resolvedSearchParams, "inv_status"),
                type: readSearchParam(resolvedSearchParams, "inv_type"),
                from: readSearchParam(resolvedSearchParams, "inv_from"),
                to: readSearchParam(resolvedSearchParams, "inv_to"),
                page: readSearchParamInt(resolvedSearchParams, "inv_page"),
                pageSize: readSearchParamInt(resolvedSearchParams, "inv_size"),
            },
            goodsReceipts: {
                q: readSearchParam(resolvedSearchParams, "grn_q"),
                status: readSearchParam(resolvedSearchParams, "grn_status"),
                from: readSearchParam(resolvedSearchParams, "grn_from"),
                to: readSearchParam(resolvedSearchParams, "grn_to"),
                page: readSearchParamInt(resolvedSearchParams, "grn_page"),
                pageSize: readSearchParamInt(resolvedSearchParams, "grn_size"),
            },
            payrollRuns: {
                q: readSearchParam(resolvedSearchParams, "pay_q"),
                status: readSearchParam(resolvedSearchParams, "pay_status"),
                from: readSearchParam(resolvedSearchParams, "pay_from"),
                to: readSearchParam(resolvedSearchParams, "pay_to"),
                page: readSearchParamInt(resolvedSearchParams, "pay_page"),
                pageSize: readSearchParamInt(resolvedSearchParams, "pay_size"),
            },
        },
    })

    if (!overview.success || !overview.data) {
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
                        {overview.error || "Unknown error"}
                    </CardContent>
                </Card>
            </div>
        )
    }

    return <DocumentSystemControlCenter initialData={overview.data} />
}
