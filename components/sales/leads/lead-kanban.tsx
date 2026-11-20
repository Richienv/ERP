"use client"

import { useEffect, useMemo, useState, useCallback } from "react"
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
} from "@dnd-kit/core"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Calendar, Flame, User, Building2 } from "lucide-react"
import { cn } from "@/lib/utils"

export type LeadStage =
  | "NEW"
  | "FOLLOW_UP"
  | "WON"
  | "LOST"

export interface LeadKanbanItem {
  id: string
  title: string
  company: string | null
  contactName: string
  status: LeadStage
  probability: number
  estimatedValue: number
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT"
  updatedAt: string | Date
}

interface LeadKanbanProps {
  leads: LeadKanbanItem[]
  isLoading?: boolean
  onStatusChange?: (leadId: string, status: LeadStage) => Promise<void> | void
}

const STATUS_META: Record<LeadStage, { title: string; accent: string; badgeClass: string; borderColor: string }> = {
  NEW: {
    title: "Baru",
    accent: "bg-sky-500",
    badgeClass: "bg-sky-100 text-sky-800 border-sky-200",
    borderColor: "border-sky-200"
  },
  FOLLOW_UP: {
    title: "Follow Up",
    accent: "bg-indigo-500",
    badgeClass: "bg-indigo-100 text-indigo-800 border-indigo-200",
    borderColor: "border-indigo-200"
  },
  WON: {
    title: "Menang",
    accent: "bg-emerald-500",
    badgeClass: "bg-emerald-100 text-emerald-800 border-emerald-200",
    borderColor: "border-emerald-200"
  },
  LOST: {
    title: "Kalah",
    accent: "bg-rose-500",
    badgeClass: "bg-rose-100 text-rose-800 border-rose-200",
    borderColor: "border-rose-200"
  },
}

const STATUS_ORDER: LeadStage[] = [
  "NEW",
  "FOLLOW_UP",
  "WON",
  "LOST",
]

const formatIDR = (value: number) => {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value)
}

const formatDate = (value: string | Date) => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "-"
  return date.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
  })
}

const getHeatClass = (probability: number) => {
  if (probability >= 80) return "bg-gradient-to-r from-rose-500 to-blue-500"
  if (probability >= 50) return "bg-amber-500"
  return "bg-sky-500"
}

/* ── Lead Card Content (shared between inline + drag overlay) ── */
function LeadCardContent({ lead }: { lead: LeadKanbanItem }) {
  return (
    <div
      className={cn(
        "border border-border bg-white overflow-hidden transition-all rounded-md",
        "shadow-sm hover:translate-y-[-2px] hover:shadow-sm"
      )}
    >
      <div className={cn("h-1.5 w-full", getHeatClass(lead.probability))} />
      <div className="p-3 space-y-3">
        <div>
          <p className="text-xs font-semibold leading-tight line-clamp-2 mb-1">
            {lead.title}
          </p>
          <div className="flex items-center gap-1.5 text-xs font-bold text-zinc-500">
            <Building2 className="h-3 w-3 flex-shrink-0" />
            <span className="truncate">{lead.company || "No Company"}</span>
          </div>
        </div>

        <div className="space-y-1.5 pt-2 border-t border-dashed border-zinc-200">
          <div className="flex items-center gap-2 text-xs font-medium text-zinc-600">
            <User className="h-3 w-3" />
            <span className="truncate">{lead.contactName}</span>
          </div>
          <div className="flex items-center gap-2 text-xs font-medium text-zinc-400">
            <Calendar className="h-3 w-3" />
            <span>{formatDate(lead.updatedAt)}</span>
          </div>
        </div>

        <div className="pt-2 flex items-center justify-between">
          <p className="text-sm font-semibold text-zinc-900">{formatIDR(lead.estimatedValue)}</p>

          {lead.probability >= 80 ? (
            <div className="flex items-center gap-1 bg-blue-100 text-blue-700 border border-blue-200 px-1.5 py-0.5 text-xs font-semibold  ">
              <Flame className="h-3 w-3 fill-blue-500" /> HOT
            </div>
          ) : (
            <div className="text-xs font-bold text-zinc-400">
              {lead.probability}% Prob.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/* ── Draggable Card ── */
function DraggableLeadCard({ lead, isDragOverlay = false }: { lead: LeadKanbanItem; isDragOverlay?: boolean }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: lead.id,
    data: { lead },
  })

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={cn("mb-3", isDragging && "opacity-30")}
    >
      {isDragOverlay ? (
        <div
          className={cn(
            "border border-border bg-white overflow-hidden rounded-md",
            "shadow-sm rotate-2 scale-105 z-50"
          )}
        >
          <div className={cn("h-1.5 w-full", getHeatClass(lead.probability))} />
          <div className="p-3 space-y-3">
            <div>
              <p className="text-xs font-semibold leading-tight line-clamp-2 mb-1">
                {lead.title}
              </p>
              <div className="flex items-center gap-1.5 text-xs font-bold text-zinc-500">
                <Building2 className="h-3 w-3 flex-shrink-0" />
                <span className="truncate">{lead.company || "No Company"}</span>
              </div>
            </div>

            <div className="space-y-1.5 pt-2 border-t border-dashed border-zinc-200">
              <div className="flex items-center gap-2 text-xs font-medium text-zinc-600">
                <User className="h-3 w-3" />
                <span className="truncate">{lead.contactName}</span>
              </div>
              <div className="flex items-center gap-2 text-xs font-medium text-zinc-400">
                <Calendar className="h-3 w-3" />
                <span>{formatDate(lead.updatedAt)}</span>
              </div>
            </div>

            <div className="pt-2 flex items-center justify-between">
              <p className="text-sm font-semibold text-zinc-900">{formatIDR(lead.estimatedValue)}</p>

              {lead.probability >= 80 ? (
                <div className="flex items-center gap-1 bg-blue-100 text-blue-700 border border-blue-200 px-1.5 py-0.5 text-xs font-semibold  ">
                  <Flame className="h-3 w-3 fill-blue-500" /> HOT
                </div>
              ) : (
                <div className="text-xs font-bold text-zinc-400">
                  {lead.probability}% Prob.
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <LeadCardContent lead={lead} />
      )}
    </div>
  )
}

/* ── Droppable Column ── */
function DroppableColumn({ status, children }: { status: LeadStage; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({
    id: status,
    data: { type: "Column", status },
  })

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex-1 min-h-[200px] p-2 border border-dashed transition-colors rounded-md overflow-y-auto",
        isOver ? "border-border bg-zinc-200/50" : "border-zinc-300 bg-zinc-50"
      )}
    >
      {children}
    </div>
  )
}

/* ── Main Kanban ── */
export function LeadKanban({ leads, isLoading = false, onStatusChange }: LeadKanbanProps) {
  const [boardLeads, setBoardLeads] = useState<LeadKanbanItem[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)

  useEffect(() => {
    setBoardLeads(leads)
  }, [leads])

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    })
  )

  const grouped = useMemo(() => {
    return STATUS_ORDER.reduce<Record<LeadStage, LeadKanbanItem[]>>((acc, status) => {
      acc[status] = boardLeads.filter((lead) => lead.status === status)
      return acc
    }, {
      NEW: [],
      FOLLOW_UP: [],
      WON: [],
      LOST: [],
    })
  }, [boardLeads])

  const activeLead = useMemo(() => {
    if (!activeId) return null
    return boardLeads.find((lead) => lead.id === activeId) ?? null
  }, [activeId, boardLeads])

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as string)
  }, [])

  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    setActiveId(null)

    const { active, over } = event
    if (!over) return

    const leadId = active.id as string
    // over.id is the column status (droppable id)
    const newStatus = over.id as LeadStage

    // Find the current lead to check its status
    const currentLead = boardLeads.find((l) => l.id === leadId)
    if (!currentLead) return
    if (currentLead.status === newStatus) return

    const previous = boardLeads

    setBoardLeads((current) =>
      current.map((lead) =>
        lead.id === leadId
          ? { ...lead, status: newStatus }
          : lead
      )
    )

    if (!onStatusChange) return

    try {
      await onStatusChange(leadId, newStatus)
    } catch {
      setBoardLeads(previous)
    }
  }, [boardLeads, onStatusChange])

  if (isLoading) {
    return (
      <div className="flex gap-3 p-4 h-full">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="flex-1 min-w-[180px] space-y-3">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        ))}
      </div>
    )
  }

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="h-full w-full bg-zinc-100/50 overflow-x-auto overflow-y-hidden">
        <div className="flex gap-3 p-4 h-full min-w-0">
          {STATUS_ORDER.map((status) => {
            const meta = STATUS_META[status]
            const statusLeads = grouped[status]
            const totalValue = statusLeads.reduce((sum, lead) => sum + lead.estimatedValue, 0)

            return (
              <div key={status} className="flex-1 min-w-[200px] flex flex-col space-y-3">
                {/* Column Header */}
                <div className="p-3 border border-border bg-white shadow-sm relative overflow-hidden rounded-md">
                  <div className={cn("absolute top-0 left-0 w-full h-1.5", meta.accent)} />
                  <div className="flex items-center justify-between mb-2 mt-1">
                    <h3 className="font-semibold text-xs text-zinc-800">{meta.title}</h3>
                    <Badge className={cn("border rounded-md font-bold h-5 px-1.5", meta.badgeClass)}>{statusLeads.length}</Badge>
                  </div>
                  <p className="text-sm font-semibold text-zinc-900 tracking-tight">{formatIDR(totalValue)}</p>
                </div>

                <DroppableColumn status={status}>
                  {statusLeads.map((lead) => (
                    <DraggableLeadCard key={lead.id} lead={lead} />
                  ))}
                </DroppableColumn>
              </div>
            )
          })}
        </div>
      </div>

      <DragOverlay dropAnimation={null}>
        {activeLead ? (
          <DraggableLeadCard lead={activeLead} isDragOverlay />
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}
