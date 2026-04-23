import { beforeEach, describe, expect, it, vi } from "vitest"

const {
  getAuthzUserMock,
  withPrismaAuthMock,
  resolveEmployeeContextMock,
} = vi.hoisted(() => ({
  getAuthzUserMock: vi.fn(),
  withPrismaAuthMock: vi.fn(),
  resolveEmployeeContextMock: vi.fn(),
}))

vi.mock("@/lib/db", () => ({
  withPrismaAuth: withPrismaAuthMock,
  prisma: {},
}))

vi.mock("@/lib/authz", () => ({
  getAuthzUser: getAuthzUserMock,
  assertRole: vi.fn(),
}))

vi.mock("@/lib/employee-context", () => ({
  resolveEmployeeContext: resolveEmployeeContextMock,
  canApproveForDepartment: vi.fn(() => true),
}))

vi.mock("@/lib/actions/finance-invoices", () => ({
  recordPendingBillFromPO: vi.fn(),
}))

vi.mock("@/lib/db-fallbacks", () => ({
  FALLBACK_PURCHASE_ORDERS: [],
  FALLBACK_VENDORS: [],
}))

vi.mock("@/lib/po-state-machine", () => ({
  assertPOTransition: vi.fn(),
}))

vi.mock("@/lib/gl-accounts", () => ({
  SYS_ACCOUNTS: {},
}))

vi.mock("@/lib/period-helpers", () => ({
  assertPeriodOpen: vi.fn(),
}))

import { createPurchaseRequest } from "@/lib/actions/procurement"

describe("createPurchaseRequest", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("creates a PR using the transaction-scoped prisma client without calling $transaction", async () => {
    getAuthzUserMock.mockResolvedValue({
      id: "user-1",
      role: "ROLE_ADMIN",
      email: "buyer@example.com",
    })

    const txLikeClient = {
      employee: {
        findUnique: vi.fn().mockResolvedValue({
          id: "emp-1",
          status: "ACTIVE",
        }),
      },
      purchaseRequest: {
        count: vi.fn().mockResolvedValue(0),
        create: vi.fn().mockResolvedValue({ id: "pr-1" }),
      },
      // DocumentCounter — used by getNextDocNumber for atomic numbering
      documentCounter: {
        upsert: vi.fn().mockResolvedValue({ value: 1 }),
      },
    }

    withPrismaAuthMock.mockImplementation(async (operation: (prisma: any) => Promise<any>) => {
      return operation(txLikeClient)
    })

    resolveEmployeeContextMock.mockResolvedValue({
      id: "emp-1",
      department: "Procurement",
    })

    const result = await createPurchaseRequest({
      requesterId: "emp-1",
      department: "Procurement",
      priority: "HIGH",
      notes: "Need fabric urgently",
      items: [
        { productId: "prod-1", quantity: 12, notes: "For batch A" },
      ],
    })

    expect(result).toEqual({ success: true, prId: "pr-1" })
    // count() no longer called — replaced by atomic DocumentCounter upsert
    expect(txLikeClient.documentCounter.upsert).toHaveBeenCalledOnce()
    expect(txLikeClient.purchaseRequest.create).toHaveBeenCalledOnce()
    expect("$transaction" in txLikeClient).toBe(false)
  })
})
