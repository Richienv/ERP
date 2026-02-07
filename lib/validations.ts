import { z } from 'zod'

// Product validation schema - base object for type inference
export const createProductSchemaBase = z.object({
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
})

// Product validation schema with refinements
export const createProductSchema = createProductSchemaBase.refine(
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
    message: 'Tipe pergerakan wajib dipilih',
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

// ================================
// Sales & CRM Validation Schemas
// ================================

// Customer validation schema - base for type inference
export const createCustomerSchemaBase = z.object({
  code: z.string().min(1, 'Kode pelanggan wajib diisi').max(50, 'Kode pelanggan maksimal 50 karakter'),
  name: z.string().min(1, 'Nama pelanggan wajib diisi').max(200, 'Nama pelanggan maksimal 200 karakter'),
  legalName: z.string().optional(),
  customerType: z.enum(['INDIVIDUAL', 'COMPANY', 'GOVERNMENT'], {
    message: 'Tipe pelanggan wajib dipilih',
  }),
  categoryId: z.string().optional(),
  
  // Indonesian Business Information
  npwp: z.string().optional(),
  nik: z.string().optional(),
  taxAddress: z.string().optional(),
  isTaxable: z.boolean().optional().default(true),
  taxStatus: z.enum(['PKP', 'NON_PKP', 'EXEMPT']).optional().default('PKP'),
  
  // Contact Information
  phone: z.string().optional(),
  email: z.string().email('Format email tidak valid').optional().or(z.literal('')),
  website: z.string().url('Format website tidak valid').optional().or(z.literal('')),
  
  // Credit Management
  creditLimit: z.number().min(0, 'Limit kredit tidak boleh negatif').optional().default(0),
  creditTerm: z.number().int().min(0, 'Term kredit tidak boleh negatif').optional().default(30),
  paymentTerm: z.enum(['CASH', 'NET_15', 'NET_30', 'NET_45', 'NET_60', 'NET_90', 'COD']).optional().default('NET_30'),
  
  // Settings
  currency: z.string().optional().default('IDR'),
  priceListId: z.string().optional(),
  salesPersonId: z.string().optional(),
  
  // Status
  isActive: z.boolean().optional().default(true),
  isProspect: z.boolean().optional().default(false),
})

// Customer validation schema with refinements for server-side validation
export const createCustomerSchema = createCustomerSchemaBase

// Customer Address validation schema
export const createCustomerAddressSchema = z.object({
  customerId: z.string().min(1, 'ID pelanggan wajib diisi'),
  type: z.enum(['BILLING', 'SHIPPING', 'OFFICE', 'WAREHOUSE']).optional().default('BILLING'),
  
  // Indonesian Address Components
  address1: z.string().min(1, 'Alamat wajib diisi'),
  address2: z.string().optional(),
  kelurahan: z.string().optional(),
  kecamatan: z.string().optional(),
  kabupaten: z.string().min(1, 'Kabupaten/Kota wajib diisi'),
  provinsi: z.string().min(1, 'Provinsi wajib diisi'),
  postalCode: z.string().min(1, 'Kode pos wajib diisi'),
  country: z.string().optional().default('Indonesia'),
  
  // Flags
  isPrimary: z.boolean().optional().default(false),
  isActive: z.boolean().optional().default(true),
})

// Customer Contact validation schema
export const createCustomerContactSchema = z.object({
  customerId: z.string().min(1, 'ID pelanggan wajib diisi'),
  
  // Contact Information
  name: z.string().min(1, 'Nama kontak wajib diisi'),
  title: z.string().optional(),
  department: z.string().optional(),
  phone: z.string().optional(),
  mobile: z.string().optional(),
  email: z.string().email('Format email tidak valid').optional().or(z.literal('')),
  
  // Flags
  isPrimary: z.boolean().optional().default(false),
  isActive: z.boolean().optional().default(true),
})

// Quotation validation schema
export const createQuotationSchema = z.object({
  customerId: z.string().min(1, 'Pelanggan wajib dipilih'),
  customerRef: z.string().optional(),
  validUntil: z.date({
    message: 'Tanggal berlaku sampai wajib diisi',
  }),
  paymentTerm: z.enum(['CASH', 'NET_15', 'NET_30', 'NET_45', 'NET_60', 'NET_90', 'COD']).optional().default('NET_30'),
  deliveryTerm: z.string().optional(),
  notes: z.string().optional(),
  internalNotes: z.string().optional(),
})

// Quotation Item validation schema
export const createQuotationItemSchema = z.object({
  productId: z.string().min(1, 'Produk wajib dipilih'),
  description: z.string().optional(),
  quantity: z.number().min(0.001, 'Jumlah harus lebih dari 0'),
  unitPrice: z.number().min(0, 'Harga satuan tidak boleh negatif'),
  discount: z.number().min(0, 'Diskon tidak boleh negatif').max(100, 'Diskon maksimal 100%').optional().default(0),
  taxRate: z.number().min(0, 'Tarif pajak tidak boleh negatif').max(100, 'Tarif pajak maksimal 100%').optional().default(11),
})

// Complete quotation with items schema
export const createCompleteQuotationSchema = z.object({
  quotation: createQuotationSchema,
  items: z.array(createQuotationItemSchema).min(1, 'Minimal harus ada 1 item quotation'),
})

// Search and filter schemas for customers
export const customerFiltersSchema = z.object({
  search: z.string().optional(),
  customerType: z.enum(['INDIVIDUAL', 'COMPANY', 'GOVERNMENT']).optional(),
  categoryId: z.string().optional(),
  creditStatus: z.enum(['GOOD', 'WATCH', 'HOLD', 'BLOCKED']).optional(),
  taxStatus: z.enum(['PKP', 'NON_PKP', 'EXEMPT']).optional(),
  isActive: z.boolean().optional(),
  isProspect: z.boolean().optional(),
  sortBy: z.enum(['name', 'code', 'createdAt', 'updatedAt', 'totalOrderValue']).optional().default('name'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('asc'),
  page: z.number().int().min(1).optional().default(1),
  limit: z.number().int().min(1).max(100).optional().default(10),
})

// Sales Order Validation Schemas
export const createSalesOrderSchema = z.object({
  customerId: z.string().min(1, 'Customer wajib diisi'),
  quotationId: z.string().optional(),
  customerRef: z.string().optional(),
  orderDate: z.date().default(() => new Date()),
  requestedDate: z.date().optional(),
  paymentTerm: z.enum(['CASH', 'NET_15', 'NET_30', 'NET_45', 'NET_60', 'NET_90', 'COD']).default('NET_30'),
  deliveryTerm: z.string().optional(),
  notes: z.string().optional(),
  internalNotes: z.string().optional(),
})

export const createSalesOrderItemSchema = z.object({
  productId: z.string().min(1, 'Produk wajib diisi'),
  description: z.string().optional(),
  quantity: z.number().positive('Quantity harus lebih dari 0'),
  unitPrice: z.number().positive('Harga satuan harus lebih dari 0'),
  discount: z.number().min(0).max(100, 'Diskon maksimal 100%').default(0),
  taxRate: z.number().min(0).max(100, 'Tarif pajak maksimal 100%').default(11),
})

export const createCompleteSalesOrderSchema = z.object({
  salesOrder: createSalesOrderSchema,
  items: z.array(createSalesOrderItemSchema).min(1, 'Minimal harus ada 1 item pesanan'),
})

export const salesOrderFiltersSchema = z.object({
  search: z.string().optional(),
  status: z.enum(['DRAFT', 'CONFIRMED', 'IN_PROGRESS', 'DELIVERED', 'INVOICED', 'COMPLETED', 'CANCELLED']).optional(),
  customerId: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  page: z.number().int().min(1).optional().default(1),
  limit: z.number().int().min(1).max(100).optional().default(10),
})

// Type exports
export type CreateProductInput = z.input<typeof createProductSchemaBase>
export type UpdateProductInput = z.infer<typeof updateProductSchema>
export type CreateCategoryInput = z.infer<typeof createCategorySchema>
export type CreateWarehouseInput = z.infer<typeof createWarehouseSchema>
export type CreateStockMovementInput = z.infer<typeof createStockMovementSchema>
export type SignInInput = z.infer<typeof signInSchema>
export type SignUpInput = z.infer<typeof signUpSchema>
export type ProductFiltersInput = z.infer<typeof productFiltersSchema>

// Sales & CRM Type exports
export type CreateCustomerInput = z.input<typeof createCustomerSchemaBase>
export type CreateCustomerAddressInput = z.infer<typeof createCustomerAddressSchema>
export type CreateCustomerContactInput = z.infer<typeof createCustomerContactSchema>
export type CreateQuotationInput = z.infer<typeof createQuotationSchema>
export type CreateQuotationItemInput = z.infer<typeof createQuotationItemSchema>
export type CreateCompleteQuotationInput = z.infer<typeof createCompleteQuotationSchema>
export type CustomerFiltersInput = z.infer<typeof customerFiltersSchema>
export type CreateSalesOrderInput = z.input<typeof createSalesOrderSchema>
export type CreateSalesOrderItemInput = z.input<typeof createSalesOrderItemSchema>
export type CreateCompleteSalesOrderInput = z.input<typeof createCompleteSalesOrderSchema>
export type SalesOrderFiltersInput = z.infer<typeof salesOrderFiltersSchema>