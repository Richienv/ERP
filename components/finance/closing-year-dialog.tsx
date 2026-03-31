"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  IconCheck,
  IconX,
  IconLoader2,
  IconAlertTriangle,
  IconLock,
} from "@tabler/icons-react"
import { toast } from "sonner"
import {
  NBDialog,
  NBDialogHeader,
  NBDialogBody,
  NBDialogFooter,
} from "@/components/ui/nb-dialog"
import {
  previewClosingJournal,
  postClosingJournal,
} from "@/lib/actions/finance-gl"
import type { ClosingJournalPreview } from "@/lib/actions/finance-gl"

function formatIDR(n: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(n)
}

interface ClosingYearDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  fiscalYear: number
  periods: { id: string; month: number; name: string; isClosed: boolean }[]
  onComplete: () => void
}

type CheckStatus = "loading" | "pass" | "fail"

export function ClosingYearDialog({
  open,
  onOpenChange,
  fiscalYear,
  periods,
  onComplete,
}: ClosingYearDialogProps) {
  const [checkPeriods, setCheckPeriods] = useState<CheckStatus>("loading")
  const [checkBalance, setCheckBalance] = useState<CheckStatus>("loading")
  const [checkNotClosed, setCheckNotClosed] = useState<CheckStatus>("loading")
  const [preview, setPreview] = useState<ClosingJournalPreview | null>(null)
  const [posting, setPosting] = useState(false)
  const [completed, setCompleted] = useState(false)

  const runChecks = useCallback(async () => {
    setCheckPeriods("loading")
    setCheckBalance("loading")
    setCheckNotClosed("loading")
    setPreview(null)
    setCompleted(false)

    // Check 1: All 12 periods closed
    const allClosed = periods.length >= 12 && periods.every((p) => p.isClosed)
    setCheckPeriods(allClosed ? "pass" : "fail")

    // Checks 2 & 3: Preview closing journal
    try {
      const result = await previewClosingJournal(fiscalYear)
      if (result.success && result.data) {
        // Check 2: Balance is balanced (has lines means we can close)
        setCheckBalance("pass")
        // Check 3: Not already closed
        if (result.data.alreadyClosed) {
          setCheckNotClosed("fail")
        } else {
          setCheckNotClosed("pass")
          setPreview(result.data)
        }
      } else {
        setCheckBalance("fail")
        setCheckNotClosed("fail")
      }
    } catch {
      setCheckBalance("fail")
      setCheckNotClosed("fail")
    }
  }, [periods, fiscalYear])

  useEffect(() => {
    if (open) {
      runChecks()
    }
  }, [open, runChecks])

  const allPassed =
    checkPeriods === "pass" &&
    checkBalance === "pass" &&
    checkNotClosed === "pass"

  async function handlePost() {
    setPosting(true)
    try {
      const result = await postClosingJournal(fiscalYear)
      if (result.success) {
        setCompleted(true)
        toast.success(`Tahun fiskal ${fiscalYear} berhasil ditutup`)
        onComplete()
      } else {
        toast.error(result.error || "Gagal memposting jurnal penutup")
      }
    } catch {
      toast.error("Gagal memposting jurnal penutup")
    } finally {
      setPosting(false)
    }
  }

  function StatusIcon({ status }: { status: CheckStatus }) {
    if (status === "loading") {
      return <IconLoader2 className="h-5 w-5 text-zinc-400 animate-spin" />
    }
    if (status === "pass") {
      return (
        <div className="h-5 w-5 rounded-full bg-emerald-100 flex items-center justify-center">
          <IconCheck className="h-3.5 w-3.5 text-emerald-600" />
        </div>
      )
    }
    return (
      <div className="h-5 w-5 rounded-full bg-red-100 flex items-center justify-center">
        <IconX className="h-3.5 w-3.5 text-red-600" />
      </div>
    )
  }

  return (
    <NBDialog open={open} onOpenChange={onOpenChange}>
      <NBDialogHeader
        icon={IconLock}
        title={`Tutup Tahun Fiskal ${fiscalYear}`}
        subtitle="Posting jurnal penutup dan tutup tahun fiskal"
      />

      <NBDialogBody>
        {/* Completion screen */}
        {completed ? (
          <div className="flex flex-col items-center justify-center py-8 gap-4">
            <div className="h-16 w-16 rounded-full bg-emerald-100 flex items-center justify-center">
              <IconCheck className="h-8 w-8 text-emerald-600" />
            </div>
            <div className="text-center space-y-1">
              <p className="text-lg font-black">
                Tahun Fiskal {fiscalYear} Berhasil Ditutup
              </p>
              <p className="text-sm text-zinc-500">
                Jurnal penutup telah diposting
              </p>
            </div>
            <Button
              onClick={() => onOpenChange(false)}
              className="bg-black text-white border border-black hover:bg-zinc-800 font-black uppercase text-[10px] tracking-wider px-5 h-8 rounded-none"
            >
              Tutup
            </Button>
          </div>
        ) : (
          <>
            {/* Pre-checks */}
            <div className="space-y-1">
              <p className="text-xs font-black uppercase tracking-wider text-zinc-500 mb-3">
                Pra-Pemeriksaan
              </p>
              <div className="border-2 border-black divide-y-2 divide-black">
                {/* Check 1: Periods */}
                <div className="flex items-center gap-3 px-4 py-3">
                  <StatusIcon status={checkPeriods} />
                  <span className="text-sm font-medium">
                    12 periode fiskal {fiscalYear} sudah ditutup
                  </span>
                  {checkPeriods === "fail" && (
                    <Badge className="bg-red-100 text-red-700 border-0 text-[10px] font-bold ml-auto">
                      Belum lengkap
                    </Badge>
                  )}
                </div>
                {/* Check 2: Balance */}
                <div className="flex items-center gap-3 px-4 py-3">
                  <StatusIcon status={checkBalance} />
                  <span className="text-sm font-medium">
                    Neraca seimbang
                  </span>
                </div>
                {/* Check 3: Not already closed */}
                <div className="flex items-center gap-3 px-4 py-3">
                  <StatusIcon status={checkNotClosed} />
                  <span className="text-sm font-medium">
                    Closing journal belum ada
                  </span>
                  {checkNotClosed === "fail" && (
                    <Badge className="bg-red-100 text-red-700 border-0 text-[10px] font-bold ml-auto">
                      Sudah ditutup
                    </Badge>
                  )}
                </div>
              </div>
            </div>

            {/* Closing journal preview -- only if all checks pass */}
            {allPassed && preview && (
              <div className="space-y-3">
                <p className="text-xs font-black uppercase tracking-wider text-zinc-500">
                  Preview Jurnal Penutup
                </p>
                <div className="border-2 border-black">
                  <div className="divide-y divide-zinc-200">
                    <div className="flex items-center justify-between px-4 py-3">
                      <span className="text-sm font-medium">
                        Total Pendapatan
                      </span>
                      <span className="font-mono font-bold text-sm text-emerald-600">
                        {formatIDR(preview.revenueTotal)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between px-4 py-3">
                      <span className="text-sm font-medium">
                        Total Beban
                      </span>
                      <span className="font-mono font-bold text-sm text-red-600">
                        {formatIDR(preview.expenseTotal)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between px-4 py-3 bg-zinc-50 border-t-2 border-black">
                      <span className="text-sm font-black">
                        Laba Bersih
                      </span>
                      <span
                        className={`font-mono font-black text-sm ${
                          preview.netIncome >= 0
                            ? "text-emerald-600"
                            : "text-red-600"
                        }`}
                      >
                        {formatIDR(preview.netIncome)}
                      </span>
                    </div>
                  </div>
                </div>

                {preview.retainedEarningsAccount && (
                  <p className="text-xs text-zinc-500">
                    Laba bersih akan ditransfer ke akun{" "}
                    <span className="font-bold">
                      {preview.retainedEarningsAccount.code} -{" "}
                      {preview.retainedEarningsAccount.name}
                    </span>
                  </p>
                )}

                {/* Warning */}
                <div className="flex items-start gap-3 border-2 border-amber-400 bg-amber-50 p-3">
                  <IconAlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                  <p className="text-xs font-medium text-amber-800">
                    Tindakan ini akan memposting jurnal penutup dan menutup
                    tahun fiskal {fiscalYear}. Proses ini tidak dapat
                    dibatalkan.
                  </p>
                </div>
              </div>
            )}
          </>
        )}
      </NBDialogBody>

      {/* Footer actions -- only when not completed */}
      {!completed && (
        <NBDialogFooter
          onCancel={() => onOpenChange(false)}
          onSubmit={handlePost}
          submitting={posting}
          submitLabel="Posting Jurnal Penutup & Tutup Tahun"
          disabled={!allPassed}
        />
      )}
    </NBDialog>
  )
}
