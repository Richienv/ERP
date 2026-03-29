import { describe, expect, it } from "vitest"

import { createCustomerSchema } from "@/lib/validations"
import { normalizePaymentTermOptions } from "@/lib/payment-term-options"

describe("normalizePaymentTermOptions", () => {
  it("provides the legacy payment-term fallback set when the master table is empty", () => {
    const options = normalizePaymentTermOptions([])

    expect(options.map((option) => option.code)).toEqual([
      "CASH",
      "NET_15",
      "NET_30",
      "NET_45",
      "NET_60",
      "NET_90",
      "COD",
    ])
  })

  it("normalizes database codes to backend-safe legacy enum values", () => {
    const options = normalizePaymentTermOptions([
      { id: "net30", code: "NET30", name: "30 Hari", days: 30, isActive: true },
      { id: "cod", code: "COD", name: "Bayar Saat Barang Datang", days: 0, isActive: true },
    ])

    expect(options.find((option) => option.code === "NET_30")).toMatchObject({
      id: "net30",
      code: "NET_30",
      name: "30 Hari",
      days: 30,
    })
    expect(options.find((option) => option.code === "COD")).toMatchObject({
      id: "cod",
      code: "COD",
      name: "Bayar Saat Barang Datang",
      days: 0,
    })
  })
})

describe("createCustomerSchema NPWP validation", () => {
  const validBase = {
    code: "CUST-2026-0001",
    name: "PT Contoh",
    customerType: "COMPANY" as const,
    paymentTerm: "NET_30" as const,
  }

  it("accepts a 15-digit NPWP", () => {
    const parsed = createCustomerSchema.parse({
      ...validBase,
      npwp: "12.345.678.9-012.345",
    })

    expect(parsed.npwp).toBe("12.345.678.9-012.345")
  })

  it("accepts a 16-digit NPWP", () => {
    const parsed = createCustomerSchema.parse({
      ...validBase,
      npwp: "12.345.678.9-012.3456",
    })

    expect(parsed.npwp).toBe("12.345.678.9-012.3456")
  })

  it("rejects NPWP values outside the allowed length", () => {
    const result = createCustomerSchema.safeParse({
      ...validBase,
      npwp: "12.345.678.9-012.34",
    })

    expect(result.success).toBe(false)
  })
})
