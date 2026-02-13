import { Suspense } from 'react'
import { ArrowLeft, FileText } from 'lucide-react'
import Link from 'next/link'

import { QuotationForm } from '@/components/sales/quotation-form'

type SearchParamsValue = string | string[] | undefined

const readSearchParam = (params: Record<string, SearchParamsValue>, key: string) => {
  const value = params[key]
  if (Array.isArray(value)) return value[0]
  return value
}

function FormSkeleton() {
  return (
    <div className="animate-pulse space-y-3">
      <div className="border-2 border-black bg-white p-6">
        <div className="h-6 w-48 bg-zinc-200 rounded mb-4" />
        <div className="grid grid-cols-2 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="space-y-2">
              <div className="h-3 w-20 bg-zinc-200 rounded" />
              <div className="h-10 bg-zinc-100 rounded border border-zinc-200" />
            </div>
          ))}
        </div>
      </div>
      <div className="border-2 border-black bg-white p-6">
        <div className="h-6 w-32 bg-zinc-200 rounded mb-4" />
        <div className="h-40 bg-zinc-50 rounded" />
      </div>
    </div>
  )
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
    <div className="flex-1 p-4 md:p-8 pt-6 max-w-5xl mx-auto">
      {/* Back Button */}
      <Link
        href="/sales/quotations"
        className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-widest text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors mb-5"
      >
        <ArrowLeft className="h-4 w-4" />
        Kembali ke Quotation
      </Link>

      {/* Page Header */}
      <div className="border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] mb-6 overflow-hidden bg-white dark:bg-zinc-900">
        <div className="px-6 py-4 flex items-center gap-3 border-l-[6px] border-l-blue-400">
          <FileText className="h-5 w-5 text-blue-500" />
          <div>
            <h1 className="text-xl font-black uppercase tracking-tight text-zinc-900 dark:text-white">
              Buat Quotation Baru
            </h1>
            <p className="text-zinc-400 text-xs font-medium mt-0.5">
              Buat penawaran harga baru untuk pelanggan
            </p>
          </div>
        </div>
      </div>

      {/* Form */}
      <Suspense fallback={<FormSkeleton />}>
        <QuotationForm initialCustomerId={initialCustomerId} />
      </Suspense>
    </div>
  )
}
