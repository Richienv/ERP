"use client"

import { useEffect, useMemo, useState } from "react"
import {
  DragDropContext,
  Droppable,
  Draggable,
  DropResult,
} from "@hello-pangea/dnd"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Calendar, Flame, User } from "lucide-react"
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

const STATUS_META: Record<LeadStage, { title: string; accent: string; badgeClass: string }> = {
  NEW: {
    title: "Baru",
    accent: "bg-sky-500",
    badgeClass: "bg-sky-100 text-sky-800 border-sky-200",
  },
  CONTACTED: {
    title: "Dihubungi",
    accent: "bg-indigo-500",
    badgeClass: "bg-indigo-100 text-indigo-800 border-indigo-200",
  },
  QUALIFIED: {
    title: "Terkualifikasi",
    accent: "bg-violet-500",
    badgeClass: "bg-violet-100 text-violet-800 border-violet-200",
  },
  PROPOSAL: {
    title: "Proposal",
    accent: "bg-amber-500",
    badgeClass: "bg-amber-100 text-amber-800 border-amber-200",
  },
  NEGOTIATION: {
    title: "Negosiasi",
    accent: "bg-orange-500",
    badgeClass: "bg-orange-100 text-orange-800 border-orange-200",
  },
  WON: {
    title: "Menang",
    accent: "bg-emerald-500",
    badgeClass: "bg-emerald-100 text-emerald-800 border-emerald-200",
  },
  LOST: {
    title: "Kalah",
    accent: "bg-rose-500",
    badgeClass: "bg-rose-100 text-rose-800 border-rose-200",
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
  if (probability >= 80) return "bg-gradient-to-b from-rose-500 to-orange-500"
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
      <ScrollArea className="h-full w-full whitespace-nowrap rounded-md p-4">
        <div className="flex space-x-5 pb-4">
          {STATUS_ORDER.map((status) => {
            const meta = STATUS_META[status]
            const statusLeads = grouped[status]
            const totalValue = statusLeads.reduce((sum, lead) => sum + lead.estimatedValue, 0)

            return (
              <div key={status} className="w-[320px] flex-shrink-0 flex flex-col space-y-3">
                <div className="p-4 rounded-xl border-2 border-black bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] relative overflow-hidden">
                  <div className={cn("absolute top-0 left-0 w-full h-1", meta.accent)} />
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-black text-xs uppercase tracking-wider">{meta.title}</h3>
                    <Badge className={cn("border font-bold", meta.badgeClass)}>{statusLeads.length}</Badge>
                  </div>
                  <p className="text-sm font-semibold text-zinc-600">{formatIDR(totalValue)}</p>
                </div>

                <Droppable droppableId={status}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={cn(
                        "rounded-xl min-h-[420px] p-2 border-2 border-dashed border-transparent transition-colors",
                        snapshot.isDraggingOver ? "border-black/50 bg-zinc-100/70" : "bg-zinc-50/70"
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
                              <Card
                                className={cn(
                                  "border-2 border-black bg-white overflow-hidden",
                                  dragSnapshot.isDragging
                                    ? "shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] rotate-1"
                                    : "shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
                                )}
                              >
                                <div className={cn("h-1", getHeatClass(lead.probability))} />
                                <CardContent className="p-4 space-y-3">
                                  <div>
                                    <p className="text-sm font-black leading-tight line-clamp-2">{lead.title}</p>
                                    <p className="text-xs text-muted-foreground line-clamp-1">{lead.company || "Tanpa perusahaan"}</p>
                                  </div>

                                  <div className="space-y-1 text-xs text-zinc-600">
                                    <div className="flex items-center gap-2">
                                      <User className="h-3 w-3" />
                                      <span className="truncate">{lead.contactName}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <Calendar className="h-3 w-3" />
                                      <span>{formatDate(lead.updatedAt)}</span>
                                    </div>
                                  </div>

                                  <div className="flex items-center justify-between">
                                    <p className="text-sm font-extrabold">{formatIDR(lead.estimatedValue)}</p>
                                    <Badge variant="outline" className="font-bold">
                                      {lead.probability}%
                                    </Badge>
                                  </div>

                                  {lead.probability >= 80 && (
                                    <div className="inline-flex items-center gap-1 text-[11px] font-bold text-orange-700 bg-orange-100 border border-orange-200 rounded-full px-2 py-1">
                                      <Flame className="h-3 w-3" /> Hot Lead
                                    </div>
                                  )}
                                </CardContent>
                              </Card>
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
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </DragDropContext>
  )
}
