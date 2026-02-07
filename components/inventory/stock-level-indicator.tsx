import { Progress } from "@/components/ui/progress"
import { getStockPercentage } from "@/lib/inventory-utils"

interface StockLevelIndicatorProps {
  current: number
  min: number
  max: number
  className?: string
  showText?: boolean
}

export function StockLevelIndicator({ 
  current, 
  min, 
  max, 
  className = "",
  showText = true 
}: StockLevelIndicatorProps) {
  const percentage = getStockPercentage(current, max)
  
  const getColor = () => {
    if (current === 0) return "bg-red-500"
    if (current <= min * 0.5) return "bg-red-500"
    if (current <= min) return "bg-yellow-500"
    return "bg-green-500"
  }

  return (
    <div className={`space-y-2 ${className}`}>
      <Progress value={percentage} className="h-2" />
      {showText && (
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Min: {min}</span>
          <span>{current} / {max}</span>
        </div>
      )}
    </div>
  )
}