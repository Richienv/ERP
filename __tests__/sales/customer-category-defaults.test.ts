import { describe, expect, it, vi } from "vitest"

import { ensureCustomerCategories } from "@/lib/customer-category-defaults"

describe("ensureCustomerCategories", () => {
  it("returns existing active categories without creating defaults", async () => {
    const findMany = vi.fn().mockResolvedValue([
      { id: "cat-1", code: "VIP", name: "VIP" },
    ])
    const upsert = vi.fn()

    const result = await ensureCustomerCategories({
      customerCategory: {
        findMany,
        upsert,
        count: vi.fn(),
      },
    })

    expect(result).toEqual([{ id: "cat-1", code: "VIP", name: "VIP" }])
    expect(upsert).not.toHaveBeenCalled()
  })

  it("creates default categories when none exist", async () => {
    const findMany = vi
      .fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        { id: "cat-gen", code: "GEN", name: "General" },
        { id: "cat-vip", code: "VIP", name: "VIP" },
      ])
    const upsert = vi.fn().mockImplementation(async ({ where, create }: any) => ({
      id: `cat-${where.code.toLowerCase()}`,
      code: create.code,
      name: create.name,
    }))

    const result = await ensureCustomerCategories({
      customerCategory: {
        findMany,
        upsert,
        count: vi.fn(),
      },
    })

    expect(upsert).toHaveBeenCalledTimes(2)
    expect(result).toEqual([
      { id: "cat-gen", code: "GEN", name: "General" },
      { id: "cat-vip", code: "VIP", name: "VIP" },
    ])
  })
})
