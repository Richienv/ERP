"use client"

import { useEffect, useState } from "react"
import {
  Search,
  Plus,
  ChevronRight,
  ChevronDown,
  Tag,
  FolderOpen
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardHeader,
} from "@/components/ui/card"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { getChartOfAccountsTree, type GLAccountNode } from "@/lib/actions/finance"
import { formatIDR } from "@/lib/utils"

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

  useEffect(() => {
    loadAccounts()
  }, [])

  async function loadAccounts() {
    setLoading(true)
    const data = await getChartOfAccountsTree()
    setAccounts(data)
    setLoading(false)
  }

  const filteredAccounts = accounts.filter(acc =>
    acc.name.toLowerCase().includes(search.toLowerCase()) ||
    acc.code.includes(search)
  )

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
          <Button className="bg-black text-white hover:bg-zinc-800 border border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] uppercase font-bold tracking-wide active:shadow-none active:translate-y-[2px] transition-all">
            <Plus className="mr-2 h-4 w-4" /> Add Account
          </Button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex items-center gap-2 pb-2 overflow-x-auto">
        <Badge variant="outline" className="bg-white hover:bg-zinc-100 cursor-pointer border-black text-black px-3 py-1 font-bold shadow-sm">
          All Accounts
        </Badge>
        <Badge variant="outline" className="bg-transparent hover:bg-zinc-100 cursor-pointer border-zinc-300 text-zinc-500 px-3 py-1 font-bold">
          Assets
        </Badge>
        <Badge variant="outline" className="bg-transparent hover:bg-zinc-100 cursor-pointer border-zinc-300 text-zinc-500 px-3 py-1 font-bold">
          Liabilities
        </Badge>
        <Badge variant="outline" className="bg-transparent hover:bg-zinc-100 cursor-pointer border-zinc-300 text-zinc-500 px-3 py-1 font-bold">
          Equity
        </Badge>
        <div className="w-px h-6 bg-zinc-200 mx-2" />
        <Badge variant="outline" className="bg-amber-50 hover:bg-amber-100 cursor-pointer border-amber-200 text-amber-700 px-3 py-1 font-bold border-dashed">
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