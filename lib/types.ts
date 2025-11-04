// Prisma generated types
export type {
  Product,
  Category,
  Warehouse,
  Location,
  StockLevel,
  StockMovement,
  StockAlert,
  User,
  StockMovementType,
  StockAlertType,
} from '@prisma/client'

// Extended types for API responses
export interface ProductWithRelations extends Product {
  category?: Category | null
  stockLevels?: StockLevel[]
  _count?: {
    stockLevels: number
    stockMovements: number
  }
}

export interface StockLevelWithRelations extends StockLevel {
  product: Product
  warehouse: Warehouse
  location?: Location | null
}

export interface StockMovementWithRelations extends StockMovement {
  product: Product
  warehouse: Warehouse
  location?: Location | null
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
export interface ApiResponse<T = any> {
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