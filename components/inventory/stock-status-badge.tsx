import { Badge } from "@/components/ui/badge"
import { type StockStatus } from "@/lib/types"
import { getStockStatusText, getStockStatusColor } from "@/lib/inventory-utils"

interface StockStatusBadgeProps {
  status: StockStatus
  className?: string
}

export function StockStatusBadge({ status, className }: StockStatusBadgeProps) {
  const statusText = getStockStatusText(status)
  
  const getVariant = (status: StockStatus) => {
    switch (status) {
      case 'out':
      case 'critical':
        return 'destructive'
      case 'low':
        return 'secondary'
      case 'normal':
        return 'default'
      default:
        return 'outline'
    }
  }

  return (
    <Badge variant={getVariant(status)} className={className}>
      {statusText}
    </Badge>
  )
}