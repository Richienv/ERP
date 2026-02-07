import { formatCurrency } from "@/lib/inventory-utils"

interface CurrencyDisplayProps {
  amount: number
  className?: string
  showSymbol?: boolean
}

export function CurrencyDisplay({ amount, className = "", showSymbol = true }: CurrencyDisplayProps) {
  if (showSymbol) {
    return <span className={className}>{formatCurrency(amount)}</span>
  }
  
  return <span className={className}>{amount.toLocaleString('id-ID')}</span>
}