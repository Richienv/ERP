"use client";

import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { Lead, LEAD_STATUS_LABELS, LEAD_STATUS_COLORS } from "./data";
import { LeadCard } from "./lead-card";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

interface LeadColumnProps {
    id: string;
    leads: Lead[];
}

export function LeadColumn({ id, leads }: LeadColumnProps) {
    const { setNodeRef } = useDroppable({
        id: id,
        data: {
            type: "Column",
            id: id,
        },
    });

    const statusLabel = LEAD_STATUS_LABELS[id as keyof typeof LEAD_STATUS_LABELS];
    const statusColor = LEAD_STATUS_COLORS[id as keyof typeof LEAD_STATUS_COLORS];

    // Extract background color class for the header accent
    const accentColor = statusColor.split(" ")[0];
    const textColor = statusColor.split(" ")[1];
    const borderColor = statusColor.split(" ")[2];

    const totalValue = leads.reduce((sum, lead) => sum + Number(lead.estimatedValue), 0);

    return (
        <div className="flex flex-col h-full min-w-[280px] w-[280px] rounded-lg bg-muted/30 border border-border/50">
            <div className={cn("p-3 border-b flex flex-col gap-1 bg-background/50 rounded-t-lg backdrop-blur-sm sticky top-0 z-10")}>
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className={cn("w-2 h-2 rounded-full", accentColor.replace("bg-", "bg-").replace("-100", "-500"))} />
                        <h3 className="font-semibold text-sm">{statusLabel}</h3>
                    </div>
                    <Badge variant="secondary" className="text-xs px-1.5 h-5 min-w-5 flex justify-center">
                        {leads.length}
                    </Badge>
                </div>
                <div className="text-xs text-muted-foreground pl-4">
                    {new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(totalValue)}
                </div>
            </div>

            <div ref={setNodeRef} className="flex-1 p-2 overflow-y-auto min-h-[150px]">
                <SortableContext items={leads.map((l) => l.id)} strategy={verticalListSortingStrategy}>
                    <div className="flex flex-col min-h-full">
                        {leads.map((lead) => (
                            <LeadCard key={lead.id} lead={lead} />
                        ))}
                        {leads.length === 0 && (
                            <div className="h-full flex items-center justify-center text-muted-foreground/40 text-xs italic py-8 border-2 border-dashed border-muted rounded-md m-1">
                                Kosong
                            </div>
                        )}
                    </div>
                </SortableContext>
            </div>
        </div>
    );
}
