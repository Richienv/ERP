import { z } from 'zod'

// Product validation schema
export const createProductSchema = z.object({
  code: z.string().min(1, 'Kode produk wajib diisi').max(50, 'Kode produk maksimal 50 karakter'),
  name: z.string().min(1, 'Nama produk wajib diisi').max(200, 'Nama produk maksimal 200 karakter'),
  description: z.string().optional(),
  categoryId: z.string().optional(),
  unit: z.string().min(1, 'Satuan wajib diisi').max(20, 'Satuan maksimal 20 karakter'),
  costPrice: z.number().min(0, 'Harga beli tidak boleh negatif').optional().default(0),
  sellingPrice: z.number().min(0, 'Harga jual tidak boleh negatif').optional().default(0),
  minStock: z.number().int().min(0, 'Stok minimum tidak boleh negatif').optional().default(0),
  maxStock: z.number().int().min(0, 'Stok maksimum tidak boleh negatif').optional().default(0),
  reorderLevel: z.number().int().min(0, 'Level reorder tidak boleh negatif').optional().default(0),
  barcode: z.string().optional(),
}).refine(
  (data) => !data.maxStock || !data.minStock || data.maxStock >= data.minStock,
  {
    message: 'Stok maksimum harus lebih besar atau sama dengan stok minimum',
    path: ['maxStock'],
  }
).refine(
  (data) => !data.sellingPrice || !data.costPrice || data.sellingPrice >= data.costPrice,
  {
    message: 'Harga jual harus lebih besar atau sama dengan harga beli',
    path: ['sellingPrice'],
  }
)

export const updateProductSchema = createProductSchema.partial().extend({
  id: z.string().min(1, 'ID produk wajib diisi'),
})

// Category validation schema
export const createCategorySchema = z.object({
  code: z.string().min(1, 'Kode kategori wajib diisi').max(50, 'Kode kategori maksimal 50 karakter'),
  name: z.string().min(1, 'Nama kategori wajib diisi').max(100, 'Nama kategori maksimal 100 karakter'),
  description: z.string().optional(),
  parentId: z.string().optional(),
})

// Warehouse validation schema
export const createWarehouseSchema = z.object({
  code: z.string().min(1, 'Kode gudang wajib diisi').max(50, 'Kode gudang maksimal 50 karakter'),
  name: z.string().min(1, 'Nama gudang wajib diisi').max(200, 'Nama gudang maksimal 200 karakter'),
  address: z.string().optional(),
  city: z.string().optional(),
  province: z.string().optional(),
  postalCode: z.string().optional(),
  capacity: z.number().int().min(0, 'Kapasitas tidak boleh negatif').optional(),
})

// Stock movement validation schema
export const createStockMovementSchema = z.object({
  productId: z.string().min(1, 'ID produk wajib diisi'),
  warehouseId: z.string().min(1, 'ID gudang wajib diisi'),
  locationId: z.string().optional(),
  movementType: z.enum(['IN', 'OUT', 'ADJUSTMENT', 'TRANSFER', 'RESERVED', 'RELEASED'], {
    required_error: 'Tipe pergerakan wajib dipilih',
  }),
  quantity: z.number().int().min(1, 'Jumlah harus lebih dari 0'),
  unitCost: z.number().min(0, 'Harga satuan tidak boleh negatif').optional(),
  reference: z.string().optional(),
  notes: z.string().optional(),
})

// User validation schema
export const signInSchema = z.object({
  email: z.string().email('Format email tidak valid'),
  password: z.string().min(1, 'Password wajib diisi'),
})

export const signUpSchema = z.object({
  name: z.string().min(1, 'Nama wajib diisi').max(100, 'Nama maksimal 100 karakter'),
  email: z.string().email('Format email tidak valid'),
  password: z.string().min(6, 'Password minimal 6 karakter'),
  confirmPassword: z.string().min(1, 'Konfirmasi password wajib diisi'),
}).refine(
  (data) => data.password === data.confirmPassword,
  {
    message: 'Password dan konfirmasi password tidak sama',
    path: ['confirmPassword'],
  }
)

// Search and filter schemas
export const productFiltersSchema = z.object({
  search: z.string().optional(),
  categoryId: z.string().optional(),
  status: z.enum(['active', 'inactive']).optional(),
  stockStatus: z.enum(['normal', 'low', 'critical', 'out']).optional(),
  sortBy: z.enum(['name', 'code', 'createdAt', 'updatedAt']).optional().default('name'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('asc'),
  page: z.number().int().min(1).optional().default(1),
  limit: z.number().int().min(1).max(100).optional().default(10),
})

// Type exports
export type CreateProductInput = z.infer<typeof createProductSchema>
export type UpdateProductInput = z.infer<typeof updateProductSchema>
export type CreateCategoryInput = z.infer<typeof createCategorySchema>
export type CreateWarehouseInput = z.infer<typeof createWarehouseSchema>
export type CreateStockMovementInput = z.infer<typeof createStockMovementSchema>
export type SignInInput = z.infer<typeof signInSchema>
export type SignUpInput = z.infer<typeof signUpSchema>
export type ProductFiltersInput = z.infer<typeof productFiltersSchema>