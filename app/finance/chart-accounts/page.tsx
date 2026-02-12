"use client"

import { useEffect, useState } from "react"
import {
  Search,
  Plus,
  ChevronRight,
  ChevronDown,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardHeader,
} from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { getChartOfAccountsTree, createGLAccount, type GLAccountNode } from "@/lib/actions/finance"
import { formatIDR } from "@/lib/utils"
import { toast } from "sonner"

// Recursive Tree Node Component
const AccountNode = ({ node, level }: { node: GLAccountNode, level: number }) => {
  const [isOpen, setIsOpen] = useState(true)
  const hasChildren = node.children && node.children.length > 0
  const paddingLeft = level * 24

  return (
    <div className="select-none group">
      <div
        className={`flex items-center py-2 px-4 hover:bg-zinc-100 transition-colors border-b border-zinc-100 ${level === 0 ? 'bg-zinc-50 font-black uppercase text-sm border-y-2 border-black mt-2' : ''}`}
        style={{ paddingLeft: `${paddingLeft + 16}px` }}
      >
        {/* Expander */}
        <div
          className="w-6 h-6 flex items-center justify-center mr-2 cursor-pointer hover:text-emerald-500 transition-colors"
          onClick={() => hasChildren && setIsOpen(!isOpen)}
        >
          {hasChildren && (
            isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />
          )}
          {!hasChildren && <div className="w-4" />}
        </div>

        {/* Code & Name */}
        <div className="flex-1 flex items-center gap-4">
          <span className={`font-mono ${level === 0 ? 'text-black' : 'text-zinc-500'} font-bold`}>{node.code}</span>
          <span className={`${level === 0 ? 'text-base' : level === 1 ? 'font-bold text-black' : 'font-medium text-zinc-700'}`}>
            {node.name}
          </span>
          <Badge variant="outline" className="text-[10px] h-5 border-zinc-200 text-zinc-400 font-mono">
            {node.type}
          </Badge>
        </div>

        {/* Balance */}
        <div className={`text-right font-mono font-bold text-sm tracking-tight w-40 ${node.balance < 0 ? 'text-red-500' : 'text-black'}`}>
          {formatIDR(node.balance)}
        </div>
      </div>

      {/* Recursion */}
      {isOpen && hasChildren && (
        <div>
          {node.children.map((child: GLAccountNode) => (
            <AccountNode key={child.id} node={child} level={level + 1} />
          ))}
        </div>
      )}
    </div>
  )
}

export default function CoALedgerPage() {
  const [accounts, setAccounts] = useState<GLAccountNode[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [filterType, setFilterType] = useState<"ALL" | "ASSET" | "LIABILITY" | "EQUITY" | "AUDIT_READY">("ALL")
  const [createOpen, setCreateOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [newCode, setNewCode] = useState("")
  const [newName, setNewName] = useState("")
  const [newType, setNewType] = useState<"ASSET" | "LIABILITY" | "EQUITY" | "REVENUE" | "EXPENSE">("ASSET")

  useEffect(() => {
    loadAccounts()
  }, [])

  async function loadAccounts() {
    setLoading(true)
    const data = await getChartOfAccountsTree()
    setAccounts(data)
    setLoading(false)
  }

  const filteredAccounts = accounts.filter((acc) => {
    const matchesSearch = acc.name.toLowerCase().includes(search.toLowerCase()) || acc.code.includes(search)
    if (!matchesSearch) return false
    if (filterType === "ALL") return true
    if (filterType === "AUDIT_READY") return Math.abs(acc.balance) > 0
    return acc.type === filterType
  })

  async function handleCreateAccount() {
    if (!newCode.trim() || !newName.trim()) {
      toast.error("Code dan name akun wajib diisi")
      return
    }

    setSubmitting(true)
    try {
      const result = await createGLAccount({
        code: newCode.trim(),
        name: newName.trim(),
        type: newType,
      })
      if (!result.success) {
        toast.error(("error" in result ? result.error : null) || "Gagal membuat account")
        return
      }

      toast.success("Account berhasil dibuat")
      setNewCode("")
      setNewName("")
      setNewType("ASSET")
      setCreateOpen(false)
      await loadAccounts()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex-1 space-y-6 p-4 md:p-8 pt-6 font-sans h-[calc(100vh-theme(spacing.16))] flex flex-col">

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0">
        <div>
          <h2 className="text-3xl font-black font-serif tracking-tight text-black flex items-center gap-2">
            Master Chart of Accounts
          </h2>
          <p className="text-muted-foreground mt-1 font-medium">The Living Ledger • Recursive Structure & Analytics</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative w-64">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search code or name..."
              className="pl-8 bg-white border-black shadow-sm font-medium"
            />
          </div>
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button className="bg-black text-white hover:bg-zinc-800 border border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] uppercase font-bold tracking-wide active:shadow-none active:translate-y-[2px] transition-all">
                <Plus className="mr-2 h-4 w-4" /> Add Account
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add COA Account</DialogTitle>
                <DialogDescription>Buat akun baru agar langsung masuk ke chart of accounts.</DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Account Code</Label>
                    <Input value={newCode} onChange={(e) => setNewCode(e.target.value)} placeholder="Contoh: 6100" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Account Type</Label>
                    <Select value={newType} onValueChange={(v) => setNewType(v as "ASSET" | "LIABILITY" | "EQUITY" | "REVENUE" | "EXPENSE")}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ASSET">ASSET</SelectItem>
                        <SelectItem value="LIABILITY">LIABILITY</SelectItem>
                        <SelectItem value="EQUITY">EQUITY</SelectItem>
                        <SelectItem value="REVENUE">REVENUE</SelectItem>
                        <SelectItem value="EXPENSE">EXPENSE</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Account Name</Label>
                  <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Contoh: Biaya Listrik" />
                </div>
                <Button onClick={handleCreateAccount} disabled={submitting} className="w-full">
                  {submitting ? "Saving..." : "Save Account"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex items-center gap-2 pb-2 overflow-x-auto">
        <Badge onClick={() => setFilterType("ALL")} variant="outline" className={`cursor-pointer px-3 py-1 font-bold shadow-sm ${filterType === "ALL" ? "bg-white border-black text-black" : "bg-transparent border-zinc-300 text-zinc-500"}`}>
          All Accounts
        </Badge>
        <Badge onClick={() => setFilterType("ASSET")} variant="outline" className={`cursor-pointer px-3 py-1 font-bold ${filterType === "ASSET" ? "bg-emerald-50 border-emerald-400 text-emerald-700" : "bg-transparent border-zinc-300 text-zinc-500 hover:bg-zinc-100"}`}>
          Assets
        </Badge>
        <Badge onClick={() => setFilterType("LIABILITY")} variant="outline" className={`cursor-pointer px-3 py-1 font-bold ${filterType === "LIABILITY" ? "bg-red-50 border-red-400 text-red-700" : "bg-transparent border-zinc-300 text-zinc-500 hover:bg-zinc-100"}`}>
          Liabilities
        </Badge>
        <Badge onClick={() => setFilterType("EQUITY")} variant="outline" className={`cursor-pointer px-3 py-1 font-bold ${filterType === "EQUITY" ? "bg-blue-50 border-blue-400 text-blue-700" : "bg-transparent border-zinc-300 text-zinc-500 hover:bg-zinc-100"}`}>
          Equity
        </Badge>
        <div className="w-px h-6 bg-zinc-200 mx-2" />
        <Badge onClick={() => setFilterType("AUDIT_READY")} variant="outline" className={`cursor-pointer px-3 py-1 font-bold border-dashed ${filterType === "AUDIT_READY" ? "bg-amber-50 border-amber-300 text-amber-700" : "bg-transparent border-zinc-300 text-zinc-500 hover:bg-zinc-100"}`}>
          #AuditReady
        </Badge>
      </div>

      {/* The Tree Canvas */}
      <Card className="flex-1 border-2 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] overflow-hidden flex flex-col bg-white">
        <CardHeader className="bg-zinc-50 border-b border-black/10 py-3">
          <div className="flex items-center justify-between text-xs font-black uppercase tracking-widest text-muted-foreground px-4">
            <span>Structure Hierarchy</span>
            <span>Balance (IDR)</span>
          </div>
        </CardHeader>
        <div className="flex-1 overflow-y-auto pb-8">
          {loading ? (
            <div className="p-8 text-center text-zinc-400 font-bold uppercase animate-pulse">Synchronizing Ledger...</div>
          ) : filteredAccounts.length === 0 ? (
            <div className="p-12 text-center text-zinc-400 font-medium italic">No accounts found matching your criteria</div>
          ) : (
            filteredAccounts.map((node) => (
              <AccountNode key={node.id} node={node} level={0} />
            ))
          )}

          {/* Visual End of List */}
          {!loading && (
            <div className="mt-8 flex justify-center">
              <div className="h-2 w-2 rounded-full bg-zinc-300 mx-1" />
              <div className="h-2 w-2 rounded-full bg-zinc-300 mx-1" />
              <div className="h-2 w-2 rounded-full bg-zinc-300 mx-1" />
            </div>
          )}
        </div>
      </Card>

    </div>
  )
}
