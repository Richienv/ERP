"use client"

import { useEffect, useMemo, useState } from "react"
import {
  DragDropContext,
  Droppable,
  Draggable,
  DropResult,
  DroppableProvided,
  DroppableStateSnapshot
} from "@hello-pangea/dnd"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Calendar, Flame, User, Building2 } from "lucide-react"
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"

export type LeadStage =
  | "NEW"
  | "CONTACTED"
  | "QUALIFIED"
  | "PROPOSAL"
  | "NEGOTIATION"
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
  CONTACTED: {
    title: "Dihubungi",
    accent: "bg-indigo-500",
    badgeClass: "bg-indigo-100 text-indigo-800 border-indigo-200",
    borderColor: "border-indigo-200"
  },
  QUALIFIED: {
    title: "Terkualifikasi",
    accent: "bg-violet-500",
    badgeClass: "bg-violet-100 text-violet-800 border-violet-200",
    borderColor: "border-violet-200"
  },
  PROPOSAL: {
    title: "Proposal",
    accent: "bg-amber-500",
    badgeClass: "bg-amber-100 text-amber-800 border-amber-200",
    borderColor: "border-amber-200"
  },
  NEGOTIATION: {
    title: "Negosiasi",
    accent: "bg-orange-500",
    badgeClass: "bg-orange-100 text-orange-800 border-orange-200",
    borderColor: "border-orange-200"
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
  "CONTACTED",
  "QUALIFIED",
  "PROPOSAL",
  "NEGOTIATION",
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
  if (probability >= 80) return "bg-gradient-to-r from-rose-500 to-orange-500"
  if (probability >= 50) return "bg-amber-500"
  return "bg-sky-500"
}

export function LeadKanban({ leads, isLoading = false, onStatusChange }: LeadKanbanProps) {
  const [boardLeads, setBoardLeads] = useState<LeadKanbanItem[]>([])

  useEffect(() => {
    setBoardLeads(leads)
  }, [leads])

  const grouped = useMemo(() => {
    return STATUS_ORDER.reduce<Record<LeadStage, LeadKanbanItem[]>>((acc, status) => {
      acc[status] = boardLeads.filter((lead) => lead.status === status)
      return acc
    }, {
      NEW: [],
      CONTACTED: [],
      QUALIFIED: [],
      PROPOSAL: [],
      NEGOTIATION: [],
      WON: [],
      LOST: [],
    })
  }, [boardLeads])

  const onDragEnd = async (result: DropResult) => {
    const { destination, source, draggableId } = result
    if (!destination) return
    if (source.droppableId === destination.droppableId) return

    const newStatus = destination.droppableId as LeadStage
    const previous = boardLeads

    setBoardLeads((current) =>
      current.map((lead) =>
        lead.id === draggableId
          ? {
            ...lead,
            status: newStatus,
          }
          : lead
      )
    )

    if (!onStatusChange) return

    try {
      await onStatusChange(draggableId, newStatus)
    } catch {
      setBoardLeads(previous)
    }
  }

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="space-y-3">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        ))}
      </div>
    )
  }

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <ScrollArea className="h-full w-full whitespace-nowrap bg-zinc-100/50">
        <div className="flex space-x-4 p-4">
          {STATUS_ORDER.map((status) => {
            const meta = STATUS_META[status]
            const statusLeads = grouped[status]
            const totalValue = statusLeads.reduce((sum, lead) => sum + lead.estimatedValue, 0)

            return (
              <div key={status} className="w-[300px] flex-shrink-0 flex flex-col space-y-3">
                {/* Column Header */}
                <div className="p-3 border-2 border-black bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] relative overflow-hidden rounded-none">
                  <div className={cn("absolute top-0 left-0 w-full h-1.5", meta.accent)} />
                  <div className="flex items-center justify-between mb-2 mt-1">
                    <h3 className="font-black text-xs uppercase tracking-wider text-zinc-800">{meta.title}</h3>
                    <Badge className={cn("border-2 rounded-none font-bold h-5 px-1.5", meta.badgeClass)}>{statusLeads.length}</Badge>
                  </div>
                  <p className="text-sm font-black text-zinc-900 tracking-tight">{formatIDR(totalValue)}</p>
                </div>

                <Droppable droppableId={status}>
                  {(provided: DroppableProvided, snapshot: DroppableStateSnapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={cn(
                        "min-h-[500px] p-2 border-2 border-dashed transition-colors rounded-none",
                        snapshot.isDraggingOver ? "border-black bg-zinc-200/50" : "border-zinc-300 bg-zinc-50"
                      )}
                    >
                      {statusLeads.map((lead, index) => (
                        <Draggable key={lead.id} draggableId={lead.id} index={index}>
                          {(dragProvided, dragSnapshot) => (
                            <div
                              ref={dragProvided.innerRef}
                              {...dragProvided.draggableProps}
                              {...dragProvided.dragHandleProps}
                              style={dragProvided.draggableProps.style}
                              className="mb-3"
                            >
                              <div
                                className={cn(
                                  "border-2 border-black bg-white overflow-hidden transition-all rounded-none",
                                  dragSnapshot.isDragging
                                    ? "shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] rotate-2 scale-105 z-50"
                                    : "shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[-2px] hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]"
                                )}
                              >
                                <div className={cn("h-1.5 w-full", getHeatClass(lead.probability))} />
                                <div className="p-3 space-y-3">
                                  <div>
                                    <p className="text-xs font-black leading-tight line-clamp-2 uppercase tracking-wide mb-1">
                                      {lead.title}
                                    </p>
                                    <div className="flex items-center gap-1.5 text-[10px] uppercase font-bold text-zinc-500">
                                      <Building2 className="h-3 w-3" />
                                      <span className="truncate max-w-[180px]">{lead.company || "No Company"}</span>
                                    </div>
                                  </div>

                                  <div className="space-y-1.5 pt-2 border-t border-dashed border-zinc-200">
                                    <div className="flex items-center gap-2 text-[10px] font-medium text-zinc-600">
                                      <User className="h-3 w-3" />
                                      <span className="truncate">{lead.contactName}</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-[10px] font-medium text-zinc-400">
                                      <Calendar className="h-3 w-3" />
                                      <span>{formatDate(lead.updatedAt)}</span>
                                    </div>
                                  </div>

                                  <div className="pt-2 flex items-center justify-between">
                                    <p className="text-sm font-black text-zinc-900">{formatIDR(lead.estimatedValue)}</p>

                                    {lead.probability >= 80 ? (
                                      <div className="flex items-center gap-1 bg-orange-100 text-orange-700 border-2 border-orange-200 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider">
                                        <Flame className="h-3 w-3 fill-orange-500" /> HOT
                                      </div>
                                    ) : (
                                      <div className="text-[10px] font-bold text-zinc-400">
                                        {lead.probability}% Prob.
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </div>
            )
          })}
        </div>
        <ScrollBar orientation="horizontal" className="h-2.5" />
      </ScrollArea>
    </DragDropContext>
  )
}
