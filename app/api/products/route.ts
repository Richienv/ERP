import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'

import { ApiResponse, PaginatedResponse, ProductWithRelations } from '@/lib/types'

// Allowed sort columns — explicit allowlist to prevent column enumeration via Prisma
const SORTABLE_COLUMNS = [
  'name',
  'code',
  'createdAt',
  'updatedAt',
  'costPrice',
  'sellingPrice',
  'minStock',
  'maxStock',
] as const

// Matches Prisma enum ProductType { MANUFACTURED, TRADING, RAW_MATERIAL, WIP }
const PRODUCT_TYPE_VALUES = ['MANUFACTURED', 'TRADING', 'RAW_MATERIAL', 'WIP'] as const

// Matches Prisma enum CostingMethod { AVERAGE, FIFO }
const COSTING_METHOD_VALUES = ['AVERAGE', 'FIFO'] as const

const ProductGetQuerySchema = z.object({
  search: z.string().trim().max(200).optional(),
  categoryId: z.string().uuid().optional(),
  status: z.enum(['active', 'inactive']).optional(),
  stockStatus: z.enum(['normal', 'low', 'critical', 'out']).optional(),
  sortBy: z.enum(SORTABLE_COLUMNS).default('name'),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  productType: z
    .string()
    .optional()
    .transform((v) =>
      v
        ? v
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean)
        : []
    )
    .pipe(z.array(z.enum(PRODUCT_TYPE_VALUES))),
})

const ProductCreateSchema = z.object({
  code: z.string().trim().min(1).max(50),
  name: z.string().trim().min(1).max(200),
  description: z.string().max(2000).optional().nullable(),
  categoryId: z.string().uuid().optional().nullable(),
  productType: z.enum(PRODUCT_TYPE_VALUES).optional(),
  unit: z.string().trim().min(1).max(20),
  costPrice: z.coerce.number().min(0).max(1e12).default(0),
  sellingPrice: z.coerce.number().min(0).max(1e12).optional().nullable(),
  costingMethod: z.enum(COSTING_METHOD_VALUES).optional(),
  minStock: z.coerce.number().int().min(0).max(1e9).default(0),
  maxStock: z.coerce.number().int().min(0).max(1e9).default(0),
  reorderLevel: z.coerce.number().int().min(0).max(1e9).default(0),
  barcode: z.string().trim().max(100).optional().nullable(),
})

// GET /api/products - Fetch products with filtering and pagination
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const parsed = ProductGetQuerySchema.safeParse(Object.fromEntries(searchParams))
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Parameter pencarian tidak valid',
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 400 }
      )
    }
    const filters = parsed.data

    // Build where clause
    const whereClause: any = {}

    if (filters.search) {
      whereClause.OR = [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { code: { contains: filters.search, mode: 'insensitive' } },
        { description: { contains: filters.search, mode: 'insensitive' } },
      ]
    }

    if (filters.categoryId) {
      whereClause.categoryId = filters.categoryId
    }

    if (filters.status === 'active') {
      whereClause.isActive = true
    } else if (filters.status === 'inactive') {
      whereClause.isActive = false
    }

    if (filters.productType.length === 1) {
      whereClause.productType = filters.productType[0]
    } else if (filters.productType.length > 1) {
      whereClause.productType = { in: filters.productType }
    }

    // Calculate offset for pagination
    const offset = (filters.page - 1) * filters.limit

    // Fetch products with relations
    const [products, totalCount] = await Promise.all([
      prisma.product.findMany({
        where: whereClause,
        include: {
          category: true,
          stockLevels: {
            include: {
              warehouse: true,
            },
          },
          _count: {
            select: {
              stockLevels: true,
              transactions: true,
            },
          },
        },
        orderBy: {
          [filters.sortBy]: filters.sortOrder,
        },
        skip: offset,
        take: filters.limit,
      }),
      prisma.product.count({ where: whereClause }),
    ])

    // Calculate stock status for each product
    const productsWithStockStatus = products.map((product) => {
      const totalStock = product.stockLevels.reduce((sum, level) => sum + Number(level.quantity), 0)

      let stockStatus = 'normal'
      if (totalStock <= 0) {
        stockStatus = 'out'
      } else if (totalStock <= product.minStock * 0.5) {
        stockStatus = 'critical'
      } else if (totalStock <= product.minStock) {
        stockStatus = 'low'
      }

      return {
        ...product,
        currentStock: totalStock,
        stockStatus,
      }
    })

    // Filter by stock status if specified
    let filteredProducts = productsWithStockStatus
    if (filters.stockStatus) {
      filteredProducts = productsWithStockStatus.filter(
        (product) => product.stockStatus === filters.stockStatus
      )
    }

    const totalPages = Math.ceil(totalCount / filters.limit)

    const response: PaginatedResponse<ProductWithRelations> = {
      success: true,
      data: filteredProducts,
      pagination: {
        page: filters.page,
        limit: filters.limit,
        total: totalCount,
        totalPages,
      },
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Error fetching products:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch products' },
      { status: 500 }
    )
  }
}

// POST /api/products - Create new product
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json().catch(() => null)
    if (!body || typeof body !== 'object') {
      return NextResponse.json(
        { success: false, error: 'Body permintaan tidak valid' },
        { status: 400 }
      )
    }

    const parsed = ProductCreateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Data produk tidak valid',
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 400 }
      )
    }
    const data = parsed.data

    // Check if product code already exists
    const existingProduct = await prisma.product.findUnique({
      where: { code: data.code },
    })

    if (existingProduct) {
      return NextResponse.json(
        { success: false, error: 'Kode produk sudah digunakan' },
        { status: 409 }
      )
    }

    // Create new product
    const product = await prisma.product.create({
      data: {
        code: data.code,
        name: data.name,
        description: data.description ?? null,
        categoryId: data.categoryId ?? null,
        productType: data.productType,
        unit: data.unit,
        costPrice: data.costPrice,
        sellingPrice: data.sellingPrice ?? null,
        minStock: data.minStock,
        maxStock: data.maxStock,
        reorderLevel: data.reorderLevel,
        barcode: data.barcode ?? null,
        costingMethod: data.costingMethod,
        isActive: true,
      },
      include: {
        category: true,
      },
    })

    const response: ApiResponse<ProductWithRelations> = {
      success: true,
      data: product,
      message: 'Product created successfully',
    }

    return NextResponse.json(response, { status: 201 })
  } catch (error) {
    console.error('Error creating product:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to create product' },
      { status: 500 }
    )
  }
}