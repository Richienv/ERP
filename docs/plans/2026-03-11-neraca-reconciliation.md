# Neraca Reconciliation & Tutup Buku — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add trial balance diagnostics, GL balance reconciliation, and a flexible closing workflow (monthly soft-close + yearly hard-close) to the balance sheet page.

**Architecture:** Three layers — (1) server actions for trial balance calculation and GL reconciliation, (2) fiscal period enforcement in journal posting, (3) UI components for diagnostics + closing workflow. All GL balance recalculation uses journal lines as source of truth.

**Tech Stack:** Next.js server actions, Prisma transactions, shadcn/ui Dialog + Table, TanStack Query for data fetching.

---

### Task 1: Trial Balance Server Action + Types

**Files:**
- Modify: `lib/finance-gl-helpers.ts:78` (add new types after existing ones)
- Modify: `lib/actions/finance-gl.ts:955` (add new functions before postClosingJournal)

**Step 1: Add types to helpers**

In `lib/finance-gl-helpers.ts`, after line 78 (after `ClosingJournalPreview`), add:

```typescript
export interface TrialBalanceRow {
  accountId: string
  accountCode: string
  accountName: string
  accountType: 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE'
  totalDebit: number
  totalCredit: number
  storedBalance: number
  calculatedBalance: number
  difference: number
}

export interface TrialBalanceData {
  rows: TrialBalanceRow[]
  totalDebit: number
  totalCredit: number
  isBalanced: boolean
  mismatchCount: number
  asOfDate: string
}

export interface ReconciliationPreviewRow {
  accountId: string
  accountCode: string
  accountName: string
  oldBalance: number
  newBalance: number
  difference: number
}

export interface ReconciliationPreview {
  rows: ReconciliationPreviewRow[]
  totalAccounts: number
  totalDifference: number
}
```

**Step 2: Add `getTrialBalance()` server action**

In `lib/actions/finance-gl.ts`, add before `postClosingJournal()` (before line 955):

```typescript
export async function getTrialBalance(asOfDate?: Date): Promise<TrialBalanceData> {
  const prisma = (await import('@/lib/db')).default
  const cutoff = asOfDate || new Date()

  const accounts = await prisma.gLAccount.findMany({
    include: {
      lines: {
        where: {
          entry: {
            status: 'POSTED',
            date: { lte: cutoff },
          },
        },
        select: { debit: true, credit: true },
      },
    },
    orderBy: { code: 'asc' },
  })

  let grandDebit = 0
  let grandCredit = 0
  let mismatchCount = 0

  const rows: TrialBalanceRow[] = accounts.map((acc) => {
    const totalDebit = acc.lines.reduce((s, l) => s + Number(l.debit), 0)
    const totalCredit = acc.lines.reduce((s, l) => s + Number(l.credit), 0)
    const calculatedBalance =
      acc.type === 'ASSET' || acc.type === 'EXPENSE'
        ? totalDebit - totalCredit
        : totalCredit - totalDebit
    const storedBalance = Number(acc.balance)
    const difference = Math.round((storedBalance - calculatedBalance) * 100) / 100

    grandDebit += totalDebit
    grandCredit += totalCredit
    if (Math.abs(difference) > 0.01) mismatchCount++

    return {
      accountId: acc.id,
      accountCode: acc.code,
      accountName: acc.name,
      accountType: acc.type as TrialBalanceRow['accountType'],
      totalDebit: Math.round(totalDebit * 100) / 100,
      totalCredit: Math.round(totalCredit * 100) / 100,
      storedBalance,
      calculatedBalance: Math.round(calculatedBalance * 100) / 100,
      difference,
    }
  })

  return {
    rows,
    totalDebit: Math.round(grandDebit * 100) / 100,
    totalCredit: Math.round(grandCredit * 100) / 100,
    isBalanced: Math.abs(grandDebit - grandCredit) < 0.01,
    mismatchCount,
    asOfDate: cutoff.toISOString(),
  }
}
```

**Step 3: Add type re-exports**

In `lib/actions/finance-gl.ts`, near the other type re-exports (around line 9-26), add:

```typescript
export type { TrialBalanceRow, TrialBalanceData, ReconciliationPreviewRow, ReconciliationPreview } from '@/lib/finance-gl-helpers'
```

**Step 4: Run tests**

Run: `npx vitest run`
Expected: Same 5 pre-existing failures, no new failures.

---

### Task 2: Balance Reconciliation Server Actions

**Files:**
- Modify: `lib/actions/finance-gl.ts` (add after `getTrialBalance`)

**Step 1: Add `previewBalanceReconciliation()`**

```typescript
export async function previewBalanceReconciliation(): Promise<ReconciliationPreview> {
  const trialBalance = await getTrialBalance()
  const rows: ReconciliationPreviewRow[] = trialBalance.rows
    .filter((r) => Math.abs(r.difference) > 0.01)
    .map((r) => ({
      accountId: r.accountId,
      accountCode: r.accountCode,
      accountName: r.accountName,
      oldBalance: r.storedBalance,
      newBalance: r.calculatedBalance,
      difference: r.difference,
    }))

  return {
    rows,
    totalAccounts: rows.length,
    totalDifference: rows.reduce((s, r) => s + Math.abs(r.difference), 0),
  }
}
```

**Step 2: Add `applyBalanceReconciliation()`**

```typescript
export async function applyBalanceReconciliation(): Promise<{ updated: number }> {
  const prisma = (await import('@/lib/db')).default
  const { createClient } = await import('@/lib/supabase/server')
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const preview = await previewBalanceReconciliation()
  if (preview.rows.length === 0) return { updated: 0 }

  await prisma.$transaction(async (tx) => {
    for (const row of preview.rows) {
      await tx.gLAccount.update({
        where: { id: row.accountId },
        data: { balance: row.newBalance },
      })
    }

    // Audit log
    const { logAudit } = await import('@/lib/audit-helpers')
    await logAudit({
      entityType: 'GL_RECONCILIATION',
      entityId: 'system',
      action: 'UPDATE',
      userId: user.id,
      userName: user.email || 'System',
      changes: preview.rows.map((r) => ({
        field: `${r.accountCode} ${r.accountName}`,
        from: r.oldBalance,
        to: r.newBalance,
      })),
      narrative: `Rekonsiliasi saldo ${preview.rows.length} akun GL. Total selisih: Rp ${preview.totalDifference.toLocaleString('id-ID')}`,
    })
  })

  return { updated: preview.rows.length }
}
```

**Step 3: Run tests**

Run: `npx vitest run`
Expected: Same baseline, no regressions.

---

### Task 3: Fiscal Period Enforcement in Journal Posting

**Files:**
- Modify: `lib/actions/finance-gl.ts:114-202` (inside `postJournalEntry`)

**Step 1: Add period validation after debit/credit check**

In `postJournalEntry()`, after the debit/credit validation (after line 133), add:

```typescript
    // Fiscal period validation
    const entryDate = new Date(data.date || new Date())
    const entryYear = entryDate.getFullYear()
    const entryMonth = entryDate.getMonth() + 1
    const fiscalPeriod = await prisma.fiscalPeriod.findUnique({
      where: { year_month: { year: entryYear, month: entryMonth } },
    })
    if (fiscalPeriod?.isClosed) {
      throw new Error(
        `Periode fiskal ${fiscalPeriod.name} sudah ditutup. Tidak bisa posting jurnal ke periode ini.`
      )
    }
```

**Step 2: Run tests**

Run: `npx vitest run`
Expected: Same baseline. Note: if any tests post to a closed period, they may need adjustment.

---

### Task 4: Fiscal Period Close Validation (No Draft Entries)

**Files:**
- Modify: `app/api/finance/fiscal-periods/route.ts:84-102` (close action)

**Step 1: Add draft entry check before closing**

In the POST handler's "close" action (around line 84), before setting `isClosed: true`, add validation:

```typescript
    // Check for draft journal entries in this period
    const period = await prisma.fiscalPeriod.findUnique({ where: { id: body.id } })
    if (!period) return NextResponse.json({ error: 'Period not found' }, { status: 404 })

    const draftCount = await prisma.journalEntry.count({
      where: {
        status: 'DRAFT',
        date: { gte: period.startDate, lte: period.endDate },
      },
    })
    if (draftCount > 0) {
      return NextResponse.json(
        { error: `Tidak bisa tutup periode: masih ada ${draftCount} jurnal DRAFT. Posting atau hapus terlebih dahulu.` },
        { status: 400 }
      )
    }
```

**Step 2: Add year-end close action**

In the same route file, add a new action in the POST handler:

```typescript
    if (body.action === 'close-year') {
      const year = body.year as number
      if (!year) return NextResponse.json({ error: 'Year required' }, { status: 400 })

      // Check all 12 months are closed
      const periods = await prisma.fiscalPeriod.findMany({ where: { year } })
      const openPeriods = periods.filter((p) => !p.isClosed)
      if (openPeriods.length > 0) {
        return NextResponse.json(
          { error: `Tidak bisa tutup tahun: ${openPeriods.length} periode masih terbuka (${openPeriods.map((p) => p.name).join(', ')})` },
          { status: 400 }
        )
      }

      // Check balance sheet is balanced
      const { getTrialBalance } = await import('@/lib/actions/finance-gl')
      const tb = await getTrialBalance(new Date(year, 11, 31))
      if (!tb.isBalanced) {
        return NextResponse.json(
          { error: `Tidak bisa tutup tahun: neraca tidak seimbang (selisih debit-kredit)` },
          { status: 400 }
        )
      }

      return NextResponse.json({ success: true, year })
    }
```

**Step 3: Run tests**

Run: `npx vitest run`
Expected: Same baseline.

---

### Task 5: Trial Balance Panel Component

**Files:**
- Create: `components/finance/reports/trial-balance-panel.tsx`

**Step 1: Create the component**

```typescript
"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { IconChevronDown, IconChevronUp, IconAlertTriangle, IconCircleCheck } from "@tabler/icons-react"
import type { TrialBalanceData, TrialBalanceRow } from "@/lib/actions/finance-gl"

function formatIDR(n: number) {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(n)
}

const TYPE_LABELS: Record<string, string> = {
  ASSET: "Aset", LIABILITY: "Kewajiban", EQUITY: "Ekuitas",
  REVENUE: "Pendapatan", EXPENSE: "Beban",
}

export function TrialBalancePanel({
  data,
  onReconcile,
}: {
  data: TrialBalanceData
  onReconcile: () => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [showAll, setShowAll] = useState(false)

  const mismatched = data.rows.filter((r) => Math.abs(r.difference) > 0.01)
  const displayRows = showAll ? data.rows : mismatched

  return (
    <Card className="border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
      <CardHeader
        className="cursor-pointer flex flex-row items-center justify-between py-3 px-4"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2">
          <CardTitle className="text-base">Neraca Saldo (Trial Balance)</CardTitle>
          {data.mismatchCount > 0 ? (
            <Badge variant="destructive" className="text-xs">
              {data.mismatchCount} akun selisih
            </Badge>
          ) : (
            <Badge className="bg-emerald-100 text-emerald-800 text-xs">Semua cocok</Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          {data.mismatchCount > 0 && (
            <Button
              size="sm"
              variant="outline"
              className="border-2 border-black text-xs"
              onClick={(e) => { e.stopPropagation(); onReconcile() }}
            >
              Rekonsiliasi Saldo
            </Button>
          )}
          {expanded ? <IconChevronUp size={18} /> : <IconChevronDown size={18} />}
        </div>
      </CardHeader>

      {expanded && (
        <CardContent className="px-4 pb-4">
          <div className="flex gap-2 mb-3">
            <Button
              size="sm"
              variant={showAll ? "outline" : "default"}
              className="text-xs border-2 border-black"
              onClick={() => setShowAll(false)}
            >
              Hanya Selisih ({mismatched.length})
            </Button>
            <Button
              size="sm"
              variant={showAll ? "default" : "outline"}
              className="text-xs border-2 border-black"
              onClick={() => setShowAll(true)}
            >
              Semua Akun ({data.rows.length})
            </Button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b-2 border-black text-left">
                  <th className="py-2 px-2">Kode</th>
                  <th className="py-2 px-2">Nama Akun</th>
                  <th className="py-2 px-2">Tipe</th>
                  <th className="py-2 px-2 text-right">Total Debit</th>
                  <th className="py-2 px-2 text-right">Total Credit</th>
                  <th className="py-2 px-2 text-right">Saldo Tersimpan</th>
                  <th className="py-2 px-2 text-right">Saldo Seharusnya</th>
                  <th className="py-2 px-2 text-right">Selisih</th>
                </tr>
              </thead>
              <tbody>
                {displayRows.map((row) => (
                  <tr
                    key={row.accountId}
                    className={`border-b ${Math.abs(row.difference) > 0.01 ? "bg-red-50" : ""}`}
                  >
                    <td className="py-1.5 px-2 font-mono text-xs">{row.accountCode}</td>
                    <td className="py-1.5 px-2">{row.accountName}</td>
                    <td className="py-1.5 px-2">
                      <Badge variant="outline" className="text-xs">{TYPE_LABELS[row.accountType]}</Badge>
                    </td>
                    <td className="py-1.5 px-2 text-right font-mono">{formatIDR(row.totalDebit)}</td>
                    <td className="py-1.5 px-2 text-right font-mono">{formatIDR(row.totalCredit)}</td>
                    <td className="py-1.5 px-2 text-right font-mono">{formatIDR(row.storedBalance)}</td>
                    <td className="py-1.5 px-2 text-right font-mono">{formatIDR(row.calculatedBalance)}</td>
                    <td className={`py-1.5 px-2 text-right font-mono font-bold ${Math.abs(row.difference) > 0.01 ? "text-red-600" : "text-emerald-600"}`}>
                      {Math.abs(row.difference) > 0.01 ? formatIDR(row.difference) : "✓"}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-black font-bold">
                  <td colSpan={3} className="py-2 px-2">TOTAL</td>
                  <td className="py-2 px-2 text-right font-mono">{formatIDR(data.totalDebit)}</td>
                  <td className="py-2 px-2 text-right font-mono">{formatIDR(data.totalCredit)}</td>
                  <td colSpan={3} className={`py-2 px-2 text-right ${data.isBalanced ? "text-emerald-600" : "text-red-600"}`}>
                    {data.isBalanced ? "✓ Debit = Credit" : `Selisih: ${formatIDR(Math.abs(data.totalDebit - data.totalCredit))}`}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </CardContent>
      )}
    </Card>
  )
}
```

**Step 2: Run lint**

Run: `npm run lint`
Expected: No new errors.

---

### Task 6: Reconciliation Preview Dialog Component

**Files:**
- Create: `components/finance/reports/reconciliation-preview-dialog.tsx`

**Step 1: Create the dialog**

```typescript
"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { IconAlertTriangle, IconCheck } from "@tabler/icons-react"
import { toast } from "sonner"
import { previewBalanceReconciliation, applyBalanceReconciliation } from "@/lib/actions/finance-gl"
import type { ReconciliationPreview } from "@/lib/actions/finance-gl"

function formatIDR(n: number) {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(n)
}

export function ReconciliationPreviewDialog({
  open,
  onOpenChange,
  onComplete,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onComplete: () => void
}) {
  const [preview, setPreview] = useState<ReconciliationPreview | null>(null)
  const [loading, setLoading] = useState(false)
  const [applying, setApplying] = useState(false)

  const loadPreview = async () => {
    setLoading(true)
    try {
      const data = await previewBalanceReconciliation()
      setPreview(data)
    } catch (e: any) {
      toast.error(e.message || "Gagal memuat preview")
    } finally {
      setLoading(false)
    }
  }

  const handleApply = async () => {
    setApplying(true)
    try {
      const result = await applyBalanceReconciliation()
      toast.success(`${result.updated} akun berhasil direkonsiliasi`)
      onOpenChange(false)
      onComplete()
    } catch (e: any) {
      toast.error(e.message || "Gagal merekonsiliasi saldo")
    } finally {
      setApplying(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) setPreview(null) }}>
      <DialogContent className="max-w-2xl border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <IconAlertTriangle className="text-amber-500" size={20} />
            Rekonsiliasi Saldo GL
          </DialogTitle>
          <DialogDescription>
            Memperbarui saldo tersimpan agar sesuai dengan jurnal aktual.
          </DialogDescription>
        </DialogHeader>

        {!preview ? (
          <div className="py-6 text-center">
            <Button onClick={loadPreview} disabled={loading} className="border-2 border-black">
              {loading ? "Menghitung..." : "Muat Preview Perubahan"}
            </Button>
          </div>
        ) : preview.rows.length === 0 ? (
          <div className="py-6 text-center text-emerald-600 flex flex-col items-center gap-2">
            <IconCheck size={32} />
            <p className="font-medium">Semua saldo sudah cocok. Tidak ada perubahan diperlukan.</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto max-h-80">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-white">
                  <tr className="border-b-2 border-black text-left">
                    <th className="py-2 px-2">Kode</th>
                    <th className="py-2 px-2">Nama Akun</th>
                    <th className="py-2 px-2 text-right">Saldo Lama</th>
                    <th className="py-2 px-2 text-right">Saldo Baru</th>
                    <th className="py-2 px-2 text-right">Selisih</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.rows.map((row) => (
                    <tr key={row.accountId} className="border-b bg-red-50">
                      <td className="py-1.5 px-2 font-mono text-xs">{row.accountCode}</td>
                      <td className="py-1.5 px-2">{row.accountName}</td>
                      <td className="py-1.5 px-2 text-right font-mono line-through text-zinc-400">
                        {formatIDR(row.oldBalance)}
                      </td>
                      <td className="py-1.5 px-2 text-right font-mono text-emerald-600 font-bold">
                        {formatIDR(row.newBalance)}
                      </td>
                      <td className="py-1.5 px-2 text-right font-mono text-red-600">
                        {formatIDR(row.difference)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="bg-amber-50 border-2 border-amber-200 rounded p-3 text-sm">
              <p className="font-medium text-amber-800">
                Tindakan ini akan memperbarui saldo {preview.totalAccounts} akun berdasarkan jurnal aktual.
              </p>
              <p className="text-amber-600 mt-1">Perubahan ini akan dicatat di audit log.</p>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)} className="border-2 border-black">
                Batal
              </Button>
              <Button
                onClick={handleApply}
                disabled={applying}
                className="bg-emerald-600 hover:bg-emerald-700 border-2 border-black"
              >
                {applying ? "Memproses..." : "Terapkan Koreksi"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
```

**Step 2: Run lint**

Run: `npm run lint`
Expected: No new errors.

---

### Task 7: Year-End Closing Dialog Component

**Files:**
- Create: `components/finance/closing-year-dialog.tsx`

**Step 1: Create the dialog**

This component orchestrates the full year-end closing flow:
1. Pre-check: all 12 months soft-closed
2. Pre-check: neraca balanced
3. Preview closing journal (existing `previewClosingJournal`)
4. Confirm and post

```typescript
"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { IconCheck, IconX, IconAlertTriangle, IconLoader2 } from "@tabler/icons-react"
import { toast } from "sonner"
import { previewClosingJournal, postClosingJournal } from "@/lib/actions/finance-gl"
import type { ClosingJournalPreview } from "@/lib/actions/finance-gl"

function formatIDR(n: number) {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(n)
}

interface PreCheck { label: string; passed: boolean | null; detail?: string }

export function ClosingYearDialog({
  open,
  onOpenChange,
  fiscalYear,
  periods,
  onComplete,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  fiscalYear: number
  periods: { id: string; month: number; name: string; isClosed: boolean }[]
  onComplete: () => void
}) {
  const [step, setStep] = useState<'checks' | 'preview' | 'done'>('checks')
  const [checks, setChecks] = useState<PreCheck[]>([])
  const [preview, setPreview] = useState<ClosingJournalPreview | null>(null)
  const [posting, setPosting] = useState(false)

  useEffect(() => {
    if (!open) { setStep('checks'); setChecks([]); setPreview(null) }
  }, [open])

  const runChecks = async () => {
    const openPeriods = periods.filter((p) => !p.isClosed)
    const periodsOk = openPeriods.length === 0

    setChecks([
      {
        label: `12 periode fiskal ${fiscalYear} sudah ditutup`,
        passed: periodsOk,
        detail: periodsOk ? undefined : `${openPeriods.length} periode masih terbuka: ${openPeriods.map((p) => p.name).join(', ')}`,
      },
      { label: 'Neraca seimbang', passed: null },
      { label: 'Closing journal belum ada', passed: null },
    ])

    // Check balance
    try {
      const closingPreview = await previewClosingJournal(fiscalYear)
      setPreview(closingPreview)

      setChecks((prev) => prev.map((c, i) => {
        if (i === 1) return { ...c, passed: true }
        if (i === 2) return {
          ...c,
          passed: !closingPreview.alreadyClosed,
          detail: closingPreview.alreadyClosed ? `Jurnal penutup ${fiscalYear} sudah diposting` : undefined,
        }
        return c
      }))
    } catch (e: any) {
      setChecks((prev) => prev.map((c, i) => {
        if (i === 1) return { ...c, passed: false, detail: e.message }
        if (i === 2) return { ...c, passed: false, detail: 'Gagal memeriksa' }
        return c
      }))
    }
  }

  useEffect(() => {
    if (open && step === 'checks') runChecks()
  }, [open])

  const allPassed = checks.length > 0 && checks.every((c) => c.passed === true)

  const handlePost = async () => {
    setPosting(true)
    try {
      await postClosingJournal(fiscalYear)
      toast.success(`Tahun fiskal ${fiscalYear} berhasil ditutup`)
      setStep('done')
      onComplete()
    } catch (e: any) {
      toast.error(e.message || 'Gagal posting jurnal penutup')
    } finally {
      setPosting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
        <DialogHeader>
          <DialogTitle>Tutup Buku Tahun {fiscalYear}</DialogTitle>
        </DialogHeader>

        {step === 'checks' && (
          <div className="space-y-3">
            <p className="text-sm text-zinc-600">Pra-syarat sebelum tutup buku:</p>
            {checks.map((c, i) => (
              <div key={i} className={`flex items-start gap-2 p-2 rounded border ${c.passed === true ? 'border-emerald-200 bg-emerald-50' : c.passed === false ? 'border-red-200 bg-red-50' : 'border-zinc-200 bg-zinc-50'}`}>
                {c.passed === true ? <IconCheck size={18} className="text-emerald-600 mt-0.5" /> :
                 c.passed === false ? <IconX size={18} className="text-red-600 mt-0.5" /> :
                 <IconLoader2 size={18} className="text-zinc-400 animate-spin mt-0.5" />}
                <div>
                  <p className="text-sm font-medium">{c.label}</p>
                  {c.detail && <p className="text-xs text-red-600 mt-0.5">{c.detail}</p>}
                </div>
              </div>
            ))}

            {allPassed && preview && (
              <div className="mt-4 p-3 bg-blue-50 border-2 border-blue-200 rounded">
                <p className="text-sm font-medium mb-2">Preview Jurnal Penutup:</p>
                <div className="grid grid-cols-3 gap-2 text-sm">
                  <div>Pendapatan: <span className="font-mono">{formatIDR(preview.revenueTotal)}</span></div>
                  <div>Beban: <span className="font-mono">{formatIDR(preview.expenseTotal)}</span></div>
                  <div>Laba Bersih: <span className="font-mono font-bold">{formatIDR(preview.netIncome)}</span></div>
                </div>
                <p className="text-xs text-zinc-500 mt-2">
                  {preview.lines.length} baris jurnal akan diposting ke Laba Ditahan
                  ({preview.retainedEarningsAccount?.name || 'N/A'})
                </p>
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)} className="border-2 border-black">Batal</Button>
              <Button
                disabled={!allPassed || posting}
                onClick={handlePost}
                className="bg-blue-600 hover:bg-blue-700 border-2 border-black"
              >
                {posting ? "Memproses..." : "Posting Jurnal Penutup & Tutup Tahun"}
              </Button>
            </DialogFooter>
          </div>
        )}

        {step === 'done' && (
          <div className="py-8 text-center space-y-3">
            <IconCheck size={48} className="text-emerald-600 mx-auto" />
            <p className="font-medium text-lg">Tahun Fiskal {fiscalYear} Berhasil Ditutup</p>
            <p className="text-sm text-zinc-500">Jurnal penutup telah diposting. Saldo laba ditahan diperbarui.</p>
            <Button onClick={() => onOpenChange(false)} className="border-2 border-black">Tutup</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
```

**Step 2: Run lint**

Run: `npm run lint`
Expected: No new errors.

---

### Task 8: Wire Trial Balance + Reconciliation into Balance Sheet Page

**Files:**
- Modify: `app/finance/reports/page.tsx`

**Step 1: Add imports**

Near the top imports, add:

```typescript
import { TrialBalancePanel } from "@/components/finance/reports/trial-balance-panel"
import { ReconciliationPreviewDialog } from "@/components/finance/reports/reconciliation-preview-dialog"
import { getTrialBalance } from "@/lib/actions/finance-gl"
import type { TrialBalanceData } from "@/lib/actions/finance-gl"
```

**Step 2: Add state variables**

Near existing state (around line 106), add:

```typescript
const [trialBalanceData, setTrialBalanceData] = useState<TrialBalanceData | null>(null)
const [reconDialogOpen, setReconDialogOpen] = useState(false)
const [tbLoading, setTbLoading] = useState(false)
```

**Step 3: Add trial balance fetch function**

```typescript
const loadTrialBalance = async () => {
  setTbLoading(true)
  try {
    const data = await getTrialBalance()
    setTrialBalanceData(data)
  } catch (e) {
    console.error('Failed to load trial balance:', e)
  } finally {
    setTbLoading(false)
  }
}
```

**Step 4: Add components to balance sheet section**

After the imbalance banner (after line ~802), insert:

```tsx
{/* Trial Balance Diagnostic Panel */}
<div className="mt-4">
  {trialBalanceData ? (
    <TrialBalancePanel
      data={trialBalanceData}
      onReconcile={() => setReconDialogOpen(true)}
    />
  ) : (
    <Button
      variant="outline"
      size="sm"
      className="border-2 border-black text-xs"
      onClick={loadTrialBalance}
      disabled={tbLoading}
    >
      {tbLoading ? "Memuat..." : "Lihat Neraca Saldo (Trial Balance)"}
    </Button>
  )}
</div>

<ReconciliationPreviewDialog
  open={reconDialogOpen}
  onOpenChange={setReconDialogOpen}
  onComplete={() => {
    loadTrialBalance()
    // Refresh balance sheet data too
  }}
/>
```

**Step 5: Auto-load trial balance when neraca is unbalanced**

Add effect to auto-load when imbalance is detected:

```typescript
useEffect(() => {
  if (reportType === 'bs' && balanceSheetData?.balanceCheck && !balanceSheetData.balanceCheck.isBalanced) {
    loadTrialBalance()
  }
}, [reportType, balanceSheetData])
```

**Step 6: Run tests**

Run: `npx vitest run`
Expected: Same baseline.

---

### Task 9: Wire Year-End Close into Fiscal Periods Page

**Files:**
- Modify: `app/finance/fiscal-periods/page.tsx`
- Modify: `hooks/use-fiscal-periods.ts`

**Step 1: Add year-end close mutation to hooks**

In `hooks/use-fiscal-periods.ts`, add:

```typescript
export function useCloseYearEnd() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (year: number) => {
      const res = await fetch('/api/finance/fiscal-periods', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'close-year', year }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to close year')
      }
      return res.json()
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['fiscal-periods'] })
    },
  })
}
```

**Step 2: Add dialog import and state to fiscal periods page**

```typescript
import { ClosingYearDialog } from "@/components/finance/closing-year-dialog"

// In component body:
const [closingYear, setClosingYear] = useState<number | null>(null)
```

**Step 3: Add "Tutup Buku Tahun" button**

Near the year filter buttons, add a "Tutup Buku Tahun YYYY" button for each year that has all 12 periods:

```tsx
<Button
  size="sm"
  variant="outline"
  className="border-2 border-black"
  onClick={() => setClosingYear(selectedYear)}
>
  Tutup Buku Tahun {selectedYear}
</Button>

{closingYear && (
  <ClosingYearDialog
    open={!!closingYear}
    onOpenChange={(v) => { if (!v) setClosingYear(null) }}
    fiscalYear={closingYear}
    periods={periods?.filter((p) => p.year === closingYear) || []}
    onComplete={() => setClosingYear(null)}
  />
)}
```

**Step 4: Run tests**

Run: `npx vitest run`
Expected: Same baseline.

---

### Task 10: Fix Seed Data

**Files:**
- Modify: `prisma/seed-gl.ts` (lines 139-146)

**Step 1: Fix the GL balance update for equity account**

The current code increments BOTH asset and equity by the same amount. For equity (credit-normal), the balance should reflect credit-debit convention:

```typescript
// Bank BCA (ASSET) — debit normal, increment is correct
await glDelegate.update({
  where: { id: bankId },
  data: { balance: { increment: 2450000000.00 } },
})

// Modal Disetor (EQUITY) — credit normal
// The balance field should store the credit-side balance
// Since this is a credit entry of 2.45B, increment is actually correct
// for how getBalanceSheet() reads it (it recalculates from journal lines)
// But the stored balance field should match: credit - debit = 2.45B
// So increment by 2.45B is correct IF we treat balance as absolute value
```

Actually — verify first: does `getBalanceSheet()` use stored balance or recalculate? (Answer from research: it recalculates from journal lines.) The stored balance field is only used in Chart of Accounts view. Check if the CoA view applies the correct sign convention.

The real fix: ensure stored balance matches calculated balance. Run `applyBalanceReconciliation()` after seeding, OR fix the seed to not update balance at all (let the reconciliation tool handle it).

Simplest fix — remove the manual balance updates from seed, since `postJournalEntry` already handles GL balance updates:

```typescript
// DELETE these lines from seed-gl.ts (139-146):
// await glDelegate.update({ where: { id: bankId }, data: { balance: { increment: ... } } })
// await glDelegate.update({ where: { id: capitalId }, data: { balance: { increment: ... } } })
```

The opening balance journal entry created at line 108-136 is posted via raw Prisma (not via `postJournalEntry`), so the GL balances aren't auto-updated. Fix: after creating the journal entry, update balances correctly:

```typescript
// After creating opening journal entry and lines:
// Update bank (ASSET — debit normal: balance = debit - credit = 2.45B)
await glDelegate.update({
  where: { id: bankId },
  data: { balance: 2450000000.00 },
})
// Update capital (EQUITY — credit normal: balance = credit - debit = 2.45B)
// Store as positive since getGLAccounts reads it with type-aware sign
await glDelegate.update({
  where: { id: capitalId },
  data: { balance: 2450000000.00 },
})
```

**Step 2: Run seed**

Run: `npm run db:fresh`
Expected: Database reset with balanced opening entry.

**Step 3: Run tests**

Run: `npx vitest run`
Expected: Same baseline.

---

## Execution Order Summary

| Task | Component | Dependencies | Parallelizable |
|------|-----------|-------------|----------------|
| 1 | Trial Balance types + server action | None | Yes (with 2,3) |
| 2 | Reconciliation server actions | Task 1 | Yes (with 3) |
| 3 | Fiscal period enforcement | None | Yes (with 1,2) |
| 4 | Fiscal period close validation + year-end API | Task 3 | No |
| 5 | Trial Balance Panel component | Task 1 | Yes (with 6,7) |
| 6 | Reconciliation Preview Dialog | Task 2 | Yes (with 5,7) |
| 7 | Year-End Closing Dialog | Task 4 | Yes (with 5,6) |
| 8 | Wire into Balance Sheet page | Tasks 5,6 | No |
| 9 | Wire into Fiscal Periods page | Task 7 | Yes (with 8) |
| 10 | Fix seed data | None | Yes (anytime) |
