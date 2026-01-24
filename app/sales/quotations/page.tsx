
import { getQuotations } from "@/lib/actions/sales"
import QuotationsClient from "./client-view"

export default async function QuotationsPage() {
  const quotations = await getQuotations()

  return <QuotationsClient initialQuotations={quotations} />
}