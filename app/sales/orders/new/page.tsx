import { Suspense } from 'react'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { SalesOrderForm } from '@/components/sales/sales-order-form'

type SearchParamsValue = string | string[] | undefined

const readSearchParam = (params: Record<string, SearchParamsValue>, key: string) => {
  const value = params[key]
  if (Array.isArray(value)) return value[0]
  return value
}

export default async function NewSalesOrderPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, SearchParamsValue>> | Record<string, SearchParamsValue>
}) {
  const resolvedSearchParams = searchParams
    ? (typeof (searchParams as Promise<Record<string, SearchParamsValue>>).then === "function"
      ? await (searchParams as Promise<Record<string, SearchParamsValue>>)
      : (searchParams as Record<string, SearchParamsValue>))
    : {}

  const quotationId = readSearchParam(resolvedSearchParams, "quotationId") || undefined
  const initialCustomerId = readSearchParam(resolvedSearchParams, "customerId") || undefined

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <div className="flex items-center space-x-2">
        <Link href="/sales/orders">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Kembali ke Pesanan
          </Button>
        </Link>
      </div>

      <div className="space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">Pesanan Penjualan Baru</h2>
        <p className="text-muted-foreground">
          Buat pesanan penjualan baru dari customer atau konversi dari quotation
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Informasi Pesanan</CardTitle>
          <CardDescription>
            Lengkapi detail pesanan penjualan untuk customer
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Suspense fallback={<div>Loading form...</div>}>
            <SalesOrderForm quotationId={quotationId} initialCustomerId={initialCustomerId} />
          </Suspense>
        </CardContent>
      </Card>
    </div>
  )
}
