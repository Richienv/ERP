"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  IconChevronDown,
  IconChevronUp,
  IconCheck,
  IconAlertTriangle,
} from "@tabler/icons-react"
import type { TrialBalanceData } from "@/lib/actions/finance-gl"
import { NB } from "@/lib/dialog-styles"

function formatIDR(n: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(n)
}

const TYPE_LABELS: Record<string, string> = {
  ASSET: "Aset",
  LIABILITY: "Kewajiban",
  EQUITY: "Ekuitas",
  REVENUE: "Pendapatan",
  EXPENSE: "Beban",
}

interface TrialBalancePanelProps {
  data: TrialBalanceData
  onReconcile: () => void
}

export function TrialBalancePanel({ data, onReconcile }: TrialBalancePanelProps) {
  const [expanded, setExpanded] = useState(false)
  const [showAll, setShowAll] = useState(false)

  const displayRows = showAll
    ? data.rows
    : data.rows.filter((r) => Math.abs(r.difference) > 0.01)

  return (
    <div className="border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] bg-white">
      {/* Collapsible Header */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between bg-black text-white px-4 py-3 hover:bg-zinc-800 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="text-sm font-black uppercase tracking-wider">
            Neraca Saldo (Trial Balance)
          </span>
          {data.mismatchCount > 0 && (
            <Badge className="bg-red-500 text-white border-0 text-[10px] font-black">
              {data.mismatchCount} selisih
            </Badge>
          )}
          {data.mismatchCount === 0 && (
            <Badge className="bg-emerald-500 text-white border-0 text-[10px] font-black">
              Seimbang
            </Badge>
          )}
        </div>
        {expanded ? (
          <IconChevronUp className="h-5 w-5" />
        ) : (
          <IconChevronDown className="h-5 w-5" />
        )}
      </button>

      {expanded && (
        <div className="p-4 space-y-4">
          {/* Filter Toggle */}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowAll(false)}
              className={`rounded-none border-2 border-black text-xs font-black uppercase tracking-wider ${
                !showAll
                  ? "bg-black text-white"
                  : "bg-white text-black hover:bg-zinc-100"
              }`}
            >
              Hanya Selisih
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowAll(true)}
              className={`rounded-none border-2 border-black text-xs font-black uppercase tracking-wider ${
                showAll
                  ? "bg-black text-white"
                  : "bg-white text-black hover:bg-zinc-100"
              }`}
            >
              Semua Akun
            </Button>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <div className={NB.tableWrap}>
              <table className="w-full text-sm">
                <thead>
                  <tr className={NB.tableHead}>
                    <th className={NB.tableHeadCell}>Kode</th>
                    <th className={NB.tableHeadCell}>Nama Akun</th>
                    <th className={NB.tableHeadCell}>Tipe</th>
                    <th className={`${NB.tableHeadCell} text-right`}>Total Debit</th>
                    <th className={`${NB.tableHeadCell} text-right`}>Total Credit</th>
                    <th className={`${NB.tableHeadCell} text-right`}>Saldo Tersimpan</th>
                    <th className={`${NB.tableHeadCell} text-right`}>Saldo Seharusnya</th>
                    <th className={`${NB.tableHeadCell} text-right`}>Selisih</th>
                  </tr>
                </thead>
                <tbody>
                  {displayRows.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-4 py-6 text-center text-zinc-400 text-sm font-medium">
                        {showAll
                          ? "Tidak ada data akun"
                          : "Semua akun sudah seimbang"}
                      </td>
                    </tr>
                  )}
                  {displayRows.map((row) => {
                    const hasMismatch = Math.abs(row.difference) > 0.01
                    return (
                      <tr
                        key={row.accountId}
                        className={`${NB.tableRow} ${
                          hasMismatch ? "bg-red-50" : ""
                        }`}
                      >
                        <td className={`${NB.tableCell} font-mono`}>
                          {row.accountCode}
                        </td>
                        <td className={NB.tableCell}>{row.accountName}</td>
                        <td className={NB.tableCell}>
                          <Badge
                            variant="outline"
                            className="border-black text-[10px] font-bold rounded-none"
                          >
                            {TYPE_LABELS[row.accountType] || row.accountType}
                          </Badge>
                        </td>
                        <td className={`${NB.tableCell} text-right font-mono`}>
                          {formatIDR(row.totalDebit)}
                        </td>
                        <td className={`${NB.tableCell} text-right font-mono`}>
                          {formatIDR(row.totalCredit)}
                        </td>
                        <td className={`${NB.tableCell} text-right font-mono`}>
                          {formatIDR(row.storedBalance)}
                        </td>
                        <td className={`${NB.tableCell} text-right font-mono`}>
                          {formatIDR(row.calculatedBalance)}
                        </td>
                        <td className={`${NB.tableCell} text-right font-mono`}>
                          {hasMismatch ? (
                            <span className="text-red-600 font-bold">
                              {formatIDR(row.difference)}
                            </span>
                          ) : (
                            <span className="text-emerald-600">
                              <IconCheck className="h-4 w-4 inline" />
                            </span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                {/* Footer Grand Totals */}
                <tfoot>
                  <tr className="border-t-2 border-black bg-zinc-100">
                    <td
                      colSpan={3}
                      className={`${NB.tableCell} font-black uppercase text-xs tracking-wider`}
                    >
                      Grand Total
                    </td>
                    <td className={`${NB.tableCell} text-right font-mono font-bold`}>
                      {formatIDR(data.totalDebit)}
                    </td>
                    <td className={`${NB.tableCell} text-right font-mono font-bold`}>
                      {formatIDR(data.totalCredit)}
                    </td>
                    <td colSpan={2} />
                    <td className={`${NB.tableCell} text-right`}>
                      {data.isBalanced ? (
                        <Badge className="bg-emerald-500 text-white border-0 text-[10px] font-black rounded-none">
                          Seimbang
                        </Badge>
                      ) : (
                        <Badge className="bg-red-500 text-white border-0 text-[10px] font-black rounded-none">
                          Tidak Seimbang
                        </Badge>
                      )}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Reconcile Button */}
          {data.mismatchCount > 0 && (
            <div className="flex items-center justify-between pt-2">
              <div className="flex items-center gap-2 text-amber-600 text-xs font-bold">
                <IconAlertTriangle className="h-4 w-4" />
                <span>
                  {data.mismatchCount} akun memiliki selisih saldo
                </span>
              </div>
              <Button onClick={onReconcile} className={NB.submitBtn}>
                Rekonsiliasi Saldo
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
