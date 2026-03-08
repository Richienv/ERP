import { prisma } from "@/lib/db"

/**
 * System setting keys used by the inventory module.
 */
export const INVENTORY_SETTING_KEYS = {
  ALLOW_NEGATIVE_STOCK: "allowNegativeStock",
} as const

/**
 * Fetch the negative stock policy.
 * Returns `true` if stock can go negative (pre-selling), `false` otherwise.
 * Default: `false` (reject transactions that cause negative stock).
 */
export async function getNegativeStockPolicy(): Promise<boolean> {
  try {
    const setting = await prisma.systemSetting.findUnique({
      where: { key: INVENTORY_SETTING_KEYS.ALLOW_NEGATIVE_STOCK },
    })
    return setting?.value === "true"
  } catch {
    // If table doesn't exist yet or DB error, default to false (safe mode)
    return false
  }
}

/**
 * Update the negative stock policy.
 */
export async function setNegativeStockPolicy(allow: boolean): Promise<void> {
  await prisma.systemSetting.upsert({
    where: { key: INVENTORY_SETTING_KEYS.ALLOW_NEGATIVE_STOCK },
    update: { value: String(allow) },
    create: {
      key: INVENTORY_SETTING_KEYS.ALLOW_NEGATIVE_STOCK,
      value: String(allow),
      label: "Izinkan Stok Negatif",
    },
  })
}

/**
 * Fetch a generic system setting by key.
 */
export async function getSystemSetting(key: string): Promise<string | null> {
  try {
    const setting = await prisma.systemSetting.findUnique({ where: { key } })
    return setting?.value ?? null
  } catch {
    return null
  }
}
