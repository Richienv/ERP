import { beforeEach, describe, expect, it, vi } from "vitest"
import { isStaleSystemAccountName, SYS_ACCOUNTS } from "@/lib/gl-accounts"

describe("isStaleSystemAccountName", () => {
    it("flags the live-tenant 2200 placeholder Other liabilities", () => {
        expect(isStaleSystemAccountName("Other liabilities", "Utang Gaji")).toBe(true)
        expect(isStaleSystemAccountName("other liabilities", "Utang Gaji")).toBe(true)
    })

    it("leaves a customized Indonesian name alone", () => {
        expect(isStaleSystemAccountName("Utang Gaji Site Tabang", "Utang Gaji")).toBe(false)
    })

    it("is a no-op when the name is already canonical", () => {
        expect(isStaleSystemAccountName("Utang Gaji", "Utang Gaji")).toBe(false)
    })
})

describe("ensureSystemAccounts stale-name refresh", () => {
    beforeEach(() => {
        vi.resetModules()
    })

    it("renames 2200 Other liabilities to Utang Gaji and does not touch a custom 6100", async () => {
        const rows = [
            { code: SYS_ACCOUNTS.SALARY_PAYABLE, name: "Other liabilities" },
            { code: SYS_ACCOUNTS.SALARY_EXPENSE, name: "Beban Gaji Site" },
        ]
        const db = {
            gLAccount: {
                upsert: vi.fn(async () => ({})),
                findMany: vi.fn(async () => rows),
                update: vi.fn(async ({ where, data }: { where: { code: string }; data: { name: string } }) => {
                    const row = rows.find((r) => r.code === where.code)
                    if (row) Object.assign(row, data)
                    return row
                }),
            },
        }

        const { ensureSystemAccounts } = await import("@/lib/gl-accounts-server")
        await ensureSystemAccounts(db as never)

        expect(db.gLAccount.update).toHaveBeenCalledTimes(1)
        expect(db.gLAccount.update).toHaveBeenCalledWith({
            where: { code: SYS_ACCOUNTS.SALARY_PAYABLE },
            data: { name: "Utang Gaji", isSystem: true },
        })
        expect(rows.find((r) => r.code === SYS_ACCOUNTS.SALARY_EXPENSE)?.name).toBe("Beban Gaji Site")
    })
})
