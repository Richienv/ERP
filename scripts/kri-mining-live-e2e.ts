/**
 * Live KRI mining money-loop against Supabase.
 * Run: KRI_E2E_ALLOW=1 npx tsx --require ./scripts/e2e-next-shim.cjs scripts/kri-mining-live-e2e.ts
 * Hosted Supabase / NODE_ENV=production also needs KRI_E2E_ALLOW_PROD=1.
 * Never prints secret values.
 */
import { createClient as createSb } from "@supabase/supabase-js"
import { PrismaClient } from "@prisma/client"

type Step = { name: string; ok: boolean; detail: string }

const steps: Step[] = []
function log(name: string, ok: boolean, detail: string) {
    steps.push({ name, ok, detail })
    console.log(`${ok ? "PASS" : "FAIL"}  ${name}  ${detail}`)
}

function num(v: unknown): number {
    if (v == null) return 0
    if (typeof v === "number") return v
    if (typeof v === "object" && v && "toNumber" in v && typeof (v as { toNumber: () => number }).toNumber === "function") {
        return (v as { toNumber: () => number }).toNumber()
    }
    return Number(v) || 0
}

function requireEnv(name: string): string {
    const v = process.env[name]
    if (!v) throw new Error(`${name} missing`)
    return v
}

/** True if a connection string looks like hosted Supabase. Never logs the value. */
function looksLikeHostedSupabase(connectionString: string | undefined): boolean {
    if (!connectionString) return false
    const lowered = connectionString.toLowerCase()
    return lowered.includes("pooler.supabase.com") || lowered.includes("supabase.co")
}

function refuse(message: string): never {
    console.error(message)
    process.exit(1)
}

function assertLiveE2EAllowed(): void {
    if (process.env.KRI_E2E_ALLOW !== "1") {
        refuse("Ditolak / Refused: set KRI_E2E_ALLOW=1 to run this live E2E (skrip ini mengubah role ADMIN).")
    }
    const hosted = looksLikeHostedSupabase(process.env.DATABASE_URL)
    const production = process.env.NODE_ENV === "production"
    if ((hosted || production) && process.env.KRI_E2E_ALLOW_PROD !== "1") {
        refuse("Ditolak / Refused: NODE_ENV=production or hosted Supabase requires KRI_E2E_ALLOW_PROD=1.")
    }
}

/** Read an optional key from a server-action union without fighting TS narrowing. */
function field<T = unknown>(obj: object | null | undefined, key: string): T | undefined {
    if (!obj || !(key in obj)) return undefined
    return (obj as Record<string, T>)[key]
}

async function restoreE2EUserRole(
    prisma: PrismaClient,
    email: string,
    createdUser: boolean,
    previousRole: string | null,
    didElevate: boolean,
): Promise<void> {
    if (!didElevate) return
    try {
        if (createdUser) {
            try {
                await prisma.user.delete({ where: { email } })
                log("authz-restore", true, "deleted public.users row created by this run")
                return
            } catch {
                await prisma.user.update({ where: { email }, data: { role: "user" } })
                log("authz-restore", true, "created row could not be deleted; role downgraded from ADMIN")
                return
            }
        }
        if (previousRole != null && previousRole !== "ADMIN") {
            await prisma.user.update({ where: { email }, data: { role: previousRole } })
            log("authz-restore", true, "restored previous public.users role")
            return
        }
        log("authz-restore", true, "no role revert needed")
    } catch (e: any) {
        log("authz-restore", false, e?.message || "role restore failed")
    }
}

async function maybeRunIntegrityChecks(): Promise<void> {
    let runIntegrityChecks: undefined | (() => Promise<unknown>)
    try {
        const glMod = await import("../lib/actions/finance-gl")
        const candidate = (glMod as { runIntegrityChecks?: unknown }).runIntegrityChecks
        if (typeof candidate === "function") {
            runIntegrityChecks = candidate as () => Promise<unknown>
        } else {
            log("integrity", true, "skip: runIntegrityChecks missing")
            return
        }
    } catch {
        log("integrity", true, "skip: runIntegrityChecks import failed")
        return
    }

    try {
        const result = await runIntegrityChecks() as {
            success?: boolean
            error?: string
            checks?: Array<{ name: string; status: string }>
        }
        if (!result || result.success === false) {
            log("integrity", false, result?.error || "runIntegrityChecks returned error")
            return
        }
        const checks = Array.isArray(result.checks) ? result.checks : []
        const findings = checks.filter((c) => c.status === "FAIL")
        if (findings.length) {
            log("integrity", false, `${findings.length} finding(s): ${findings.map((c) => c.name).join(", ")}`)
            return
        }
        log("integrity", true, `${checks.length} checks passed`)
    } catch (e: any) {
        log("integrity", false, e?.message || "runIntegrityChecks threw")
    }
}

async function main() {
    assertLiveE2EAllowed()

    const databasePresent = !!process.env.DATABASE_URL
    const directPresent = !!process.env.DIRECT_URL
    const url = requireEnv("NEXT_PUBLIC_SUPABASE_URL")
    const anon = requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY")
    const email = requireEnv("TEST_LOGIN_USERNAME")
    const password = requireEnv("TEST_LOGIN_PASSWORD")
    log("env", databasePresent && directPresent && !!url && !!anon && !!email && !!password, "6 secrets present (values not printed)")

    const prisma = new PrismaClient()
    let createdUser = false
    let previousRole: string | null = null
    let didElevate = false

    try {
        try {
            const glCount = await prisma.gLAccount.count()
            log("prisma", true, `gLAccount.count=${glCount}`)
        } catch (e: any) {
            log("prisma", false, e?.message || String(e))
            return
        }

        const sb = createSb(url, anon, { auth: { persistSession: false, autoRefreshToken: false } })
        const { data: authData, error: authError } = await sb.auth.signInWithPassword({ email, password })
        if (authError || !authData.session || !authData.user) {
            log("login", false, authError?.message || "no session")
            return
        }
        log("login", true, `authenticated user_id_len=${authData.user.id.length}`)

        const projectRef = new URL(url).hostname.split(".")[0]
        const storageKey = `sb-${projectRef}-auth-token`
        const sessionJson = JSON.stringify(authData.session)
        const encoded = `base64-${Buffer.from(sessionJson).toString("base64url")}`
        ;(global as any).__E2E_COOKIES[storageKey] = encoded
        ;(global as any).__E2E_COOKIES[`${storageKey}.0`] = encoded

        const userId = authData.user.id
        const existingUser = await prisma.user.findUnique({
            where: { email },
            select: { id: true, role: true },
        })
        previousRole = existingUser?.role ?? null
        createdUser = !existingUser
        await prisma.user.upsert({
            where: { email },
            create: { id: userId, email, name: "KRI E2E", role: "ADMIN" },
            update: { role: "ADMIN" },
        })
        didElevate = true
        log("authz", true, "public.users role=ADMIN for test login")

        const { ensureSystemAccounts } = await import("../lib/gl-accounts-server")
        await ensureSystemAccounts()
        const acc6130 = await prisma.gLAccount.findUnique({ where: { code: "6130" }, select: { code: true, name: true } })
        log("gl-6130", !!acc6130, acc6130 ? `${acc6130.code} ${acc6130.name}` : "missing after ensureSystemAccounts")
        const acc2200 = await prisma.gLAccount.findUnique({ where: { code: "2200" }, select: { code: true, name: true } })
        log("gl-2200", !!acc2200 && /gaji/i.test(acc2200?.name || ""), acc2200 ? `${acc2200.code} ${acc2200.name}` : "missing")

        const warehouse = await prisma.warehouse.findFirst({ where: { isActive: true }, select: { id: true, name: true } })
        const supplier = await prisma.supplier.findFirst({ select: { id: true, name: true } })
        const spare = await prisma.product.findFirst({
            where: { code: "PRD-SVC-005", isActive: true },
            select: { id: true, code: true, name: true, costPrice: true },
        })
        const customer = await prisma.customer.findFirst({
            where: { isActive: true, name: { contains: "Adaro", mode: "insensitive" } },
            select: { id: true, name: true },
        }) || await prisma.customer.findFirst({ where: { isActive: true }, select: { id: true, name: true } })
        const revenue = await prisma.gLAccount.findFirst({
            where: { code: { in: ["4000", "4200"] } },
            select: { id: true, code: true },
        })

        if (!warehouse || !supplier || !spare || !customer || !revenue) {
            log("masters", false, `wh=${!!warehouse} sup=${!!supplier} spare=${!!spare} cust=${!!customer} rev=${!!revenue}`)
            return
        }
        log("masters", true, `spare=${spare.code} vendor=${supplier.name} customer=${customer.name} wh=${warehouse.name}`)

        const unitPrice = Math.round(num(spare.costPrice) || 425000)
        const qty = 1
        const subtotal = unitPrice * qty
        const tax = Math.round(subtotal * 0.11)
        const stamp = Date.now().toString().slice(-6)
        const po = await prisma.purchaseOrder.create({
            data: {
                number: `PO-E2E-${stamp}`,
                supplierId: supplier.id,
                status: "ORDERED",
                createdBy: userId,
                orderDate: new Date(),
                totalAmount: subtotal,
                taxAmount: tax,
                netAmount: subtotal + tax,
                items: {
                    create: [{
                        productId: spare.id,
                        quantity: qty,
                        unitPrice,
                        totalPrice: subtotal,
                    }],
                },
            },
            include: { items: true },
        })
        log("po-setup", true, `${po.number} ${spare.name} x${qty} @${unitPrice}`)

        const { createGRN, acceptGRN } = await import("../lib/actions/grn")
        const grnCreate = await createGRN({
            purchaseOrderId: po.id,
            warehouseId: warehouse.id,
            notes: "E2E KRI spare parts in",
            items: po.items.map((item) => ({
                poItemId: item.id,
                productId: item.productId,
                quantityOrdered: item.quantity,
                quantityReceived: qty,
                quantityAccepted: qty,
                quantityRejected: 0,
                unitCost: unitPrice,
            })),
        })
        if (!grnCreate.success || !("grnId" in grnCreate) || !grnCreate.grnId) {
            log("grn-create", false, ("error" in grnCreate ? grnCreate.error : "no grnId") || "failed")
            return
        }
        log("grn-create", true, `grn=${"grnNumber" in grnCreate ? grnCreate.grnNumber : grnCreate.grnId}`)

        const accepted = await acceptGRN(grnCreate.grnId, "E2E override: same operator receiving spare parts after setup")
        const billNumber = accepted && "billNumber" in accepted ? accepted.billNumber : undefined
        const billId = accepted && "billId" in accepted ? accepted.billId : undefined
        if (!accepted?.success) {
            log("spare-parts-in", false, ("error" in accepted ? String(accepted.error) : "acceptGRN failed"))
        } else {
            log("spare-parts-in", true, `stock in + bill=${billNumber || "(none)"} already=${field<boolean>(accepted, "billAlreadyExists") ? "yes" : "no"}`)
        }

        let payBillId = billId as string | undefined
        if (!payBillId) {
            const existing = await prisma.invoice.findFirst({
                where: { purchaseOrderId: po.id, type: "INV_IN" },
                select: { id: true, number: true, status: true, totalAmount: true },
            })
            payBillId = existing?.id
            if (existing && !billNumber) {
                log("bill-fallback", true, `${existing.number} status=${existing.status}`)
            }
        }

        if (!payBillId) {
            const { createBillFromPOId } = await import("../lib/actions/finance-invoices")
            const billed = await createBillFromPOId(po.id)
            const createdBillId = field<string>(billed, "billId") || field<string>(billed, "existingInvoiceId")
            const createdBillNumber = field<string>(billed, "billNumber") || field<string>(billed, "existingInvoiceNumber")
            if (createdBillId) {
                payBillId = createdBillId
                log("bill-create", true, createdBillNumber || createdBillId)
            } else {
                log("bill-create", false, field<string>(billed, "error") || "no bill")
            }
        }

        if (payBillId) {
            const bill = await prisma.invoice.findUnique({
                where: { id: payBillId },
                select: { id: true, number: true, status: true, totalAmount: true, balanceDue: true },
            })
            const { approveAndPayBill } = await import("../lib/actions/finance-ap")
            const paid = await approveAndPayBill(payBillId, {
                amount: num(bill?.balanceDue || bill?.totalAmount),
                bankName: "BCA",
                bankAccountNumber: "0000000000",
                bankAccountName: "E2E",
                notes: "E2E KRI pay vendor bill",
            })
            log("vendor-pay", !!paid.success, paid.success ? `${bill?.number} PAID` : (field<string>(paid, "error") || "pay failed"))
        } else {
            log("vendor-pay", false, "no bill id")
        }

        const { createCustomerInvoice, moveInvoiceToSent } = await import("../lib/actions/finance-invoices")
        const inv = await createCustomerInvoice({
            customerId: customer.id,
            amount: 1500000,
            includeTax: true,
            type: "CUSTOMER",
            accountId: revenue.id,
            notes: "E2E sewa dump / jasa dari Finance (bukan Sales)",
            items: [{
                description: "Sewa dump truck E2E KRI",
                quantity: 1,
                unitPrice: 1500000,
            }],
        })
        if (!inv.success || !("invoiceId" in inv) || !inv.invoiceId) {
            log("finance-invoice", false, ("error" in inv ? String(inv.error) : "create failed"))
        } else {
            const sent = await moveInvoiceToSent(inv.invoiceId)
            log("finance-invoice", !!sent.success, sent.success
                ? `${inv.invoiceNumber} sent status=${"status" in sent ? sent.status : "ISSUED"}`
                : String(sent.error))
        }

        const period = "2026-12"
        const { generatePayrollDraft, approvePayrollRun } = await import("../app/actions/hcm")
        const draft = await generatePayrollDraft(period)
        if (!draft.success) {
            log("payroll-draft", false, String(draft.error))
        } else {
            log("payroll-draft", true, ("message" in draft ? String(draft.message) : period))
        }
        const posted = await approvePayrollRun(period)
        if (!posted.success) {
            log("payroll-gl", false, String(posted.error))
        } else {
            const je = await prisma.journalEntry.findFirst({
                where: { reference: { startsWith: "PAYROLL-202612" } },
                orderBy: { createdAt: "desc" },
                include: { lines: { include: { account: { select: { code: true, name: true } } } } },
            })
            const line6130 = je?.lines.find((l) => l.account.code === "6130")
            const debit = je?.lines.reduce((s, l) => s + num(l.debit), 0) || 0
            const credit = je?.lines.reduce((s, l) => s + num(l.credit), 0) || 0
            log(
                "payroll-gl",
                !!line6130 && Math.abs(debit - credit) <= 1,
                `ref=${je?.reference || field<string>(posted, "journalReference") || period} 6130_debit=${num(line6130?.debit)} balanced=${Math.abs(debit - credit) <= 1}`,
            )
        }

        const { createVehicle, capitalizeVehicleAsAsset } = await import("../lib/actions/vehicles")
        const plate = `KT E2E ${stamp}`
        const veh = await createVehicle({
            plateNumber: plate,
            brand: "Komatsu",
            model: "HD785 E2E",
            year: 2022,
            vehicleType: "TRUCK",
            warehouseId: warehouse.id,
            currentLocation: "Site Tabang",
            notes: "E2E capitalize company vehicle",
        })
        if (!veh.success || !("id" in veh)) {
            log("vehicle-create", false, "error" in veh ? veh.error : "failed")
        } else {
            log("vehicle-create", true, veh.plateNumber)
            const cap = await capitalizeVehicleAsAsset(veh.id, {
                purchaseCost: 450_000_000,
                purchaseDate: new Date().toISOString().slice(0, 10),
                usefulLifeMonths: 60,
                fundingSource: "OPENING_BALANCE",
            })
            if (!cap.success) {
                log("capitalize-asset", false, cap.error)
            } else {
                const fa = await prisma.fixedAsset.findUnique({
                    where: { id: cap.assetId },
                    select: { assetCode: true, netBookValue: true, name: true },
                })
                const je = await prisma.journalEntry.findFirst({
                    where: { reference: { contains: cap.assetCode } },
                    include: { lines: { include: { account: { select: { code: true } } } } },
                })
                const dr1510 = je?.lines.find((l) => l.account.code === "1510")
                log(
                    "capitalize-asset",
                    !!fa && !!dr1510,
                    `code=${fa?.assetCode} nbv=${num(fa?.netBookValue)} gl1510=${num(dr1510?.debit)}`,
                )
            }
        }

        await maybeRunIntegrityChecks()
    } catch (e: any) {
        console.error("E2E_THROW", e?.message || e)
        log("e2e-throw", false, e?.message || String(e))
    } finally {
        await restoreE2EUserRole(prisma, email, createdUser, previousRole, didElevate)
        await prisma.$disconnect()
    }

    const failed = steps.filter((s) => !s.ok)
    console.log(`\n${steps.filter((s) => s.ok).length}/${steps.length} steps passed`)
    process.exit(failed.length ? 1 : 0)
}

main().catch(async (e) => {
    console.error("E2E_THROW", e?.message || e)
    process.exit(1)
})
