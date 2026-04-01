"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  IconAlertTriangle,
  IconCheck,
  IconLoader2,
  IconScale,
} from "@tabler/icons-react"
import { toast } from "sonner"
import { NB } from "@/lib/dialog-styles"
import { TableProperties } from "lucide-react"
import {
  NBDialog,
  NBDialogHeader,
  NBDialogBody,
  NBDialogFooter,
  NBSection,
} from "@/components/ui/nb-dialog"
import {
  previewBalanceReconciliation,
  applyBalanceReconciliation,
} from "@/lib/actions/finance-gl"
import type { ReconciliationPreview } from "@/lib/actions/finance-gl"

function formatIDR(n: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(n)
}

interface ReconciliationPreviewDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onComplete: () => void
}

export function ReconciliationPreviewDialog({
  open,
  onOpenChange,
  onComplete,
}: ReconciliationPreviewDialogProps) {
  const [preview, setPreview] = useState<ReconciliationPreview | null>(null)
  const [loadingPreview, setLoadingPreview] = useState(false)
  const [applying, setApplying] = useState(false)

  async function handleLoadPreview() {
    setLoadingPreview(true)
    try {
      const result = await previewBalanceReconciliation()
      setPreview(result)
    } catch {
      toast.error("Gagal memuat preview rekonsiliasi")
    } finally {
      setLoadingPreview(false)
    }
  }

  async function handleApply() {
    setApplying(true)
    try {
      const result = await applyBalanceReconciliation()
      toast.success(`${result.updated} akun berhasil direkonsiliasi`)
      onComplete()
      onOpenChange(false)
      setPreview(null)
    } catch {
      toast.error("Gagal menerapkan rekonsiliasi")
    } finally {
      setApplying(false)
    }
  }

  function handleClose(value: boolean) {
    if (!value) {
      setPreview(null)
    }
    onOpenChange(value)
  }

  const hasChanges = preview && preview.rows.length > 0

  return (
    <NBDialog open={open} onOpenChange={handleClose} size="wide">
      <NBDialogHeader
        icon={IconScale}
        title="Rekonsiliasi Saldo GL"
        subtitle="Preview dan terapkan koreksi saldo berdasarkan jurnal aktual"
      />

      <NBDialogBody>
        {/* Initial state: show load button */}
        {!preview && !loadingPreview && (
          <div className="flex justify-center py-8">
            <Button onClick={handleLoadPreview} className={NB.submitBtn}>
              Muat Preview Perubahan
            </Button>
          </div>
        )}

        {/* Loading state */}
        {loadingPreview && (
          <div className="flex items-center justify-center py-8 gap-3 text-zinc-500">
            <IconLoader2 className="h-5 w-5 animate-spin" />
            <span className="text-sm font-bold">Memuat preview...</span>
          </div>
        )}

        {/* No mismatches — success */}
        {preview && preview.rows.length === 0 && (
          <div className="flex flex-col items-center justify-center py-8 gap-3">
            <div className="h-12 w-12 rounded-full bg-emerald-100 flex items-center justify-center">
              <IconCheck className="h-6 w-6 text-emerald-600" />
            </div>
            <p className="text-sm font-bold text-emerald-700">
              Semua saldo akun sudah sesuai dengan jurnal aktual
            </p>
          </div>
        )}

        {/* Has changes — show table */}
        {hasChanges && (
          <>
            <NBSection icon={TableProperties} title="Koreksi Saldo">
              <div className="overflow-x-auto -mx-3">
                <div className={NB.tableWrap}>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className={NB.tableHead}>
                        <th className={NB.tableHeadCell}>Kode</th>
                        <th className={NB.tableHeadCell}>Nama Akun</th>
                        <th className={`${NB.tableHeadCell} text-right`}>
                          Saldo Lama
                        </th>
                        <th className={`${NB.tableHeadCell} text-right`}>
                          Saldo Baru
                        </th>
                        <th className={`${NB.tableHeadCell} text-right`}>
                          Selisih
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.rows.map((row) => (
                        <tr key={row.accountId} className={NB.tableRow}>
                          <td className={`${NB.tableCell} font-mono`}>
                            {row.accountCode}
                          </td>
                          <td className={NB.tableCell}>{row.accountName}</td>
                          <td className={`${NB.tableCell} text-right font-mono line-through text-zinc-400`}>
                            {formatIDR(row.oldBalance)}
                          </td>
                          <td className={`${NB.tableCell} text-right font-mono text-emerald-600 font-bold`}>
                            {formatIDR(row.newBalance)}
                          </td>
                          <td className={`${NB.tableCell} text-right font-mono text-red-600 font-bold`}>
                            {formatIDR(row.difference)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </NBSection>

            {/* Warning */}
            <div className="flex items-start gap-3 border-2 border-amber-400 bg-amber-50 p-3">
              <IconAlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-xs font-medium text-amber-800">
                Tindakan ini akan memperbarui saldo{" "}
                <span className="font-black">{preview.totalAccounts} akun</span>{" "}
                berdasarkan jurnal aktual. Perubahan ini akan dicatat di audit log.
              </p>
            </div>
          </>
        )}
      </NBDialogBody>

      {hasChanges && (
        <NBDialogFooter
          onCancel={() => handleClose(false)}
          onSubmit={handleApply}
          submitting={applying}
          submitLabel="Terapkan Koreksi"
        />
      )}
    </NBDialog>
  )
}
