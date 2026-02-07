"use client"

import { useState } from "react"
import {
    DragDropContext,
    Droppable,
    Draggable,
    DropResult
} from "@hello-pangea/dnd"
import {
    Card,
    CardContent
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
    Calendar,
    Flame, // For "Hot" leads
    MoreHorizontal,
    ThumbsUp
} from "lucide-react"
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

// --- Mock Data ---

type Lead = {
    id: string
    name: string
    company: string
    value: number
    hotness: number // 0-100, determines "Thermal" color
    lastContact: string
    status: 'NEW' | 'QUALIFIED' | 'PROPOSAL' | 'NEGOTIATION'
}

const INITIAL_LEADS: Lead[] = [
    { id: 'l1', name: "Budi Santoso", company: "PT. Tekstil Maju", value: 550000000, hotness: 90, lastContact: "2h ago", status: 'NEW' },
    { id: 'l2', name: "Siti Aminah", company: "CV. Indah Busana", value: 125000000, hotness: 45, lastContact: "1d ago", status: 'NEW' },
    { id: 'l3', name: "John Doe", company: "Global Garment Ltd", value: 850000000, hotness: 85, lastContact: "4h ago", status: 'QUALIFIED' },
    { id: 'l4', name: "Rina Wati", company: "Fashion Nova Indo", value: 35000000, hotness: 20, lastContact: "5d ago", status: 'QUALIFIED' },
    { id: 'l5', name: "Ahmad Rizki", company: "Distro Keren", value: 75000000, hotness: 60, lastContact: "1w ago", status: 'PROPOSAL' },
    { id: 'l6', name: "Kevin Sanjaya", company: "Sport Wear ID", value: 200000000, hotness: 95, lastContact: "30m ago", status: 'NEGOTIATION' },
]

const COLUMNS = [
    { id: 'NEW', title: 'Dingin / Baru', color: 'border-blue-500', bg: 'bg-blue-500/5', badgeColor: 'bg-blue-100 text-blue-700' },
    { id: 'QUALIFIED', title: 'Hangat / Kualifikasi', color: 'border-orange-500', bg: 'bg-orange-500/5', badgeColor: 'bg-orange-100 text-orange-700' },
    { id: 'PROPOSAL', title: 'Panas / Proposal', color: 'border-red-500', bg: 'bg-red-500/5', badgeColor: 'bg-red-100 text-red-700' },
    { id: 'NEGOTIATION', title: 'Mendidih / Negosiasi', color: 'border-rose-600', bg: 'bg-rose-600/5', badgeColor: 'bg-rose-100 text-rose-700' },
]

export function LeadKanban() {
    const [leads, setLeads] = useState<Lead[]>(INITIAL_LEADS)

    const onDragEnd = (result: DropResult) => {
        const { source, destination } = result
        if (!destination) return

        if (source.droppableId === destination.droppableId && source.index === destination.index) {
            return
        }

        const newLeads = Array.from(leads)
        // Mock reorder logic
        const itemToMove = leads.filter(l => l.status === source.droppableId)[source.index]

        if (itemToMove) {
            const updatedLeads = leads.map(l =>
                l.id === itemToMove.id ? { ...l, status: destination.droppableId as any } : l
            )
            setLeads(updatedLeads)
        }
    }

    const formatRupiah = (num: number) => {
        return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(num);
    };

    const getThermalColor = (hotness: number) => {
        if (hotness >= 80) return "bg-gradient-to-b from-red-500 to-orange-500" // Inferno
        if (hotness >= 50) return "bg-orange-400" // Hot
        return "bg-blue-400" // Cold
    }

    return (
        <DragDropContext onDragEnd={onDragEnd}>
            <ScrollArea className="h-full w-full whitespace-nowrap rounded-md border-0 bg-transparent p-4">
                <div className="flex space-x-6 pb-4">
                    {COLUMNS.map((column) => {
                        const columnLeads = leads.filter(l => l.status === column.id)
                        const totalValue = columnLeads.reduce((sum, l) => sum + l.value, 0)

                        return (
                            <div key={column.id} className="w-[380px] flex-shrink-0 flex flex-col space-y-4">
                                {/* Column Header - Ritchie Minimal Style */}
                                <div className={cn("p-4 rounded-xl border-2 border-black bg-white dark:bg-zinc-900 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] relative overflow-hidden group")}>
                                    <div className={cn("absolute top-0 left-0 w-full h-1", column.color.replace('border-', 'bg-'))} />

                                    <div className="flex items-center justify-between mb-3">
                                        <h3 className="font-black text-sm tracking-wide uppercase text-zinc-800 dark:text-zinc-200">
                                            {column.title}
                                        </h3>
                                        <Badge variant="secondary" className="font-mono font-bold border-2 border-black bg-zinc-100">{columnLeads.length}</Badge>
                                    </div>
                                    <div className="text-3xl font-black tracking-tighter text-zinc-900 dark:text-zinc-100">
                                        {formatRupiah(totalValue).replace(",00", "").replace("Rp", "")}
                                    </div>
                                </div>

                                {/* Droppable Area */}
                                <Droppable droppableId={column.id}>
                                    {(provided, snapshot) => (
                                        <div
                                            {...provided.droppableProps}
                                            ref={provided.innerRef}
                                            className={cn(
                                                "flex-1 rounded-xl p-2 transition-colors min-h-[500px]",
                                                snapshot.isDraggingOver ? "bg-zinc-200/50 dark:bg-zinc-800/50 border-2 border-dashed border-zinc-400" : ""
                                            )}
                                        >
                                            {columnLeads.map((lead, index) => (
                                                <Draggable key={lead.id} draggableId={lead.id} index={index}>
                                                    {(provided, snapshot) => (
                                                        <div
                                                            ref={provided.innerRef}
                                                            {...provided.draggableProps}
                                                            {...provided.dragHandleProps}
                                                            className="mb-4"
                                                            style={provided.draggableProps.style}
                                                        >
                                                            <Card
                                                                className={cn(
                                                                    "border-2 border-black bg-white dark:bg-zinc-900 transition-all group relative overflow-hidden",
                                                                    snapshot.isDragging
                                                                        ? "shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] scale-105 rotate-2 z-50 ring-2 ring-black cursor-grabbing"
                                                                        : "shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] cursor-grab"
                                                                )}
                                                            >
                                                                {/* Thermal Bar Indicator */}
                                                                <div className={cn("absolute left-0 top-0 bottom-0 w-3 h-full z-10 border-r-2 border-black", getThermalColor(lead.hotness))} />

                                                                <CardContent className="p-5 pl-8 relative">
                                                                    <div className="flex justify-between items-start mb-4">
                                                                        <div className="space-y-1">
                                                                            <h4 className="font-black text-lg leading-tight uppercase tracking-tight">{lead.company}</h4>
                                                                            <p className="text-sm font-bold text-muted-foreground">{lead.name}</p>
                                                                        </div>
                                                                        {lead.hotness >= 80 && (
                                                                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-orange-100 border-2 border-black text-orange-600 animate-pulse shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                                                                                <Flame className="h-4 w-4 fill-orange-600" />
                                                                            </div>
                                                                        )}
                                                                    </div>

                                                                    <div className="flex items-center gap-3 mb-0">
                                                                        <Badge variant="outline" className="font-mono text-xs border-2 border-zinc-200 bg-zinc-50 font-bold px-2 py-1">
                                                                            {formatRupiah(lead.value).replace(",00", "")}
                                                                        </Badge>
                                                                        <span className="text-xs font-bold text-muted-foreground flex items-center bg-zinc-100 px-2 py-1 rounded-md border border-zinc-200">
                                                                            <Calendar className="mr-1.5 h-3 w-3" /> {lead.lastContact}
                                                                        </span>
                                                                    </div>

                                                                    {/* Quick Actions (Appear on Hover) */}
                                                                    <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity absolute right-4 bottom-4">
                                                                        <Button size="icon" className="h-8 w-8 border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[1px] hover:shadow-none bg-white text-black hover:bg-green-100 p-0">
                                                                            <ThumbsUp className="h-4 w-4" />
                                                                        </Button>
                                                                        <Button size="icon" className="h-8 w-8 border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[1px] hover:shadow-none bg-white text-black hover:bg-zinc-100 p-0">
                                                                            <MoreHorizontal className="h-4 w-4" />
                                                                        </Button>
                                                                    </div>
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
