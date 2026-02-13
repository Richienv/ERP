import { QuotationForm } from "@/components/sales/quotation-form"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"

type SearchParamsValue = string | string[] | undefined

const readSearchParam = (params: Record<string, SearchParamsValue>, key: string) => {
  const value = params[key]
  if (Array.isArray(value)) return value[0]
  return value
}

export default async function NewQuotationPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, SearchParamsValue>> | Record<string, SearchParamsValue>
}) {
  const resolvedSearchParams = searchParams
    ? (typeof (searchParams as Promise<Record<string, SearchParamsValue>>).then === "function"
      ? await (searchParams as Promise<Record<string, SearchParamsValue>>)
      : (searchParams as Record<string, SearchParamsValue>))
    : {}
  const initialCustomerId = readSearchParam(resolvedSearchParams, "customerId") || undefined

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      {/* Header */}
      <div className="flex items-center justify-between space-y-2">
        <div className="flex items-center space-x-4">
          <Button variant="outline" size="sm" asChild>
            <Link href="/sales/quotations">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Kembali
            </Link>
          </Button>
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Buat Quotation Baru</h2>
            <p className="text-muted-foreground">
              Buat penawaran harga baru untuk pelanggan
            </p>
          </div>
        </div>
      </div>

      {/* Form */}
      <Card>
        <CardHeader>
          <CardTitle>Form Quotation</CardTitle>
          <CardDescription>
            Lengkapi informasi quotation dan pilih produk yang akan ditawarkan
          </CardDescription>
        </CardHeader>
        <CardContent>
          <QuotationForm initialCustomerId={initialCustomerId} />
        </CardContent>
      </Card>
    </div>
  )
}
