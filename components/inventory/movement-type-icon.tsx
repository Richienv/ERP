import { 
  Plus, 
  Minus,
  RotateCcw,
  ArrowRightLeft,
  Package
} from "lucide-react"

interface MovementTypeIconProps {
  type: 'IN' | 'OUT' | 'ADJUSTMENT' | 'TRANSFER' | 'RESERVED' | 'RELEASED'
  className?: string
}

export function MovementTypeIcon({ type, className = "h-4 w-4" }: MovementTypeIconProps) {
  const getIconAndColor = () => {
    switch (type) {
      case 'IN':
        return { Icon: Plus, color: 'text-green-600' }
      case 'OUT':
        return { Icon: Minus, color: 'text-red-600' }
      case 'ADJUSTMENT':
        return { Icon: RotateCcw, color: 'text-blue-600' }
      case 'TRANSFER':
        return { Icon: ArrowRightLeft, color: 'text-purple-600' }
      case 'RESERVED':
        return { Icon: Package, color: 'text-yellow-600' }
      case 'RELEASED':
        return { Icon: Package, color: 'text-gray-600' }
      default:
        return { Icon: Package, color: 'text-gray-600' }
    }
  }

  const { Icon, color } = getIconAndColor()

  return <Icon className={`${className} ${color}`} />
}

export function getMovementTypeText(type: string): string {
  switch (type) {
    case 'IN':
      return 'Stok Masuk'
    case 'OUT':
      return 'Stok Keluar'
    case 'ADJUSTMENT':
      return 'Penyesuaian'
    case 'TRANSFER':
      return 'Transfer'
    case 'RESERVED':
      return 'Reservasi'
    case 'RELEASED':
      return 'Pelepasan'
    default:
      return 'Tidak Diketahui'
  }
}