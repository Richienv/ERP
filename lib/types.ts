// Prisma generated types
import type {
  Product as PrismaProduct,
  Category as PrismaCategory,
  Warehouse as PrismaWarehouse,
  Location as PrismaLocation,
  StockLevel as PrismaStockLevel,
  InventoryTransaction as PrismaInventoryTransaction,
  StockAlert as PrismaStockAlert,
  User as PrismaUser,
  TransactionType,
  StockAlertType,
} from '@prisma/client'

// Re-export for convenience
export type Product = PrismaProduct
export type Category = PrismaCategory
export type Warehouse = PrismaWarehouse
export type Location = PrismaLocation
export type StockLevel = PrismaStockLevel
export type InventoryTransaction = PrismaInventoryTransaction
export type StockAlert = PrismaStockAlert
export type User = PrismaUser
export type { TransactionType, StockAlertType }

// Extended types for API responses
export interface ProductWithRelations extends PrismaProduct {
  category?: PrismaCategory | null
  stockLevels?: PrismaStockLevel[]
  currentStock?: number
  _count?: {
    stockLevels: number
    transactions: number
  }
}

// Inventory KPIs type (used by inventory-stats-hud and other components)
export interface InventoryKPIs {
  totalValue: number
  totalSKUs: number
  lowStockCount: number
  pendingInbound: number
}

export interface StockLevelWithRelations extends StockLevel {
  product: Product
  warehouse: Warehouse
  location?: Location | null
}

export interface InventoryTransactionWithRelations extends InventoryTransaction {
  product: Product
  warehouse: Warehouse
  location?: Location | null // Optional: Specific Bin/Rack location
}

// Form schemas using Zod
export interface CreateProductData {
  code: string
  name: string
  description?: string
  categoryId?: string
  unit: string
  costPrice: number
  sellingPrice: number
  minStock: number
  maxStock: number
  reorderLevel: number
  barcode?: string
}

export interface UpdateProductData extends Partial<CreateProductData> {
  id: string
}

// API Response types
export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

// Filter and search types
export interface ProductFilters {
  search?: string
  categoryId?: string
  status?: 'active' | 'inactive'
  stockStatus?: 'normal' | 'low' | 'critical' | 'out'
  sortBy?: 'name' | 'code' | 'createdAt' | 'updatedAt'
  sortOrder?: 'asc' | 'desc'
  page?: number
  limit?: number
}

// Stock status helpers
export type StockStatus = 'normal' | 'low' | 'critical' | 'out'

export interface ProductStockInfo {
  currentStock: number
  minStock: number
  maxStock: number
  status: StockStatus
}

// Dashboard metrics
export interface InventoryMetrics {
  totalProducts: number
  totalCategories: number
  totalWarehouses: number
  lowStockItems: number
  outOfStockItems: number
  totalStockValue: number
  monthlyMovements: {
    stockIn: number
    stockOut: number
  }
}