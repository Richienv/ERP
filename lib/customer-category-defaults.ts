type CustomerCategoryAccess = {
  customerCategory: {
    findMany: (args: {
      where: { isActive: boolean }
      select: { id: true; code: true; name: true }
      orderBy: { name: "asc" }
    }) => Promise<Array<{ id: string; code: string; name: string }>>
    upsert: (args: {
      where: { code: string }
      update: { isActive: boolean }
      create: { code: string; name: string; description: string; isActive: boolean }
      select: { id: true; code: true; name: true }
    }) => Promise<{ id: string; code: string; name: string }>
    count: (args: { where: { isActive: boolean } }) => Promise<number>
  }
}

const DEFAULT_CUSTOMER_CATEGORY_DEFS = [
  {
    code: "GEN",
    name: "General",
    description: "Pelanggan umum",
  },
  {
    code: "VIP",
    name: "VIP",
    description: "Pelanggan prioritas / high value",
  },
] as const

export async function ensureCustomerCategories(
  prismaClient: CustomerCategoryAccess
): Promise<Array<{ id: string; code: string; name: string }>> {
  const existing = await prismaClient.customerCategory.findMany({
    where: { isActive: true },
    select: { id: true, code: true, name: true },
    orderBy: { name: "asc" },
  })

  if (existing.length > 0) {
    return existing
  }

  await Promise.all(
    DEFAULT_CUSTOMER_CATEGORY_DEFS.map((def) =>
      prismaClient.customerCategory.upsert({
        where: { code: def.code },
        update: { isActive: true },
        create: {
          code: def.code,
          name: def.name,
          description: def.description,
          isActive: true,
        },
        select: { id: true, code: true, name: true },
      })
    )
  )

  return prismaClient.customerCategory.findMany({
    where: { isActive: true },
    select: { id: true, code: true, name: true },
    orderBy: { name: "asc" },
  })
}
