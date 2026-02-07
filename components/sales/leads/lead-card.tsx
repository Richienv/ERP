"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Lead } from "./data";
import { Calendar, Building2, User, MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface LeadCardProps {
    lead: Lead;
}

export function LeadCard({ lead }: LeadCardProps) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: lead.id, data: { type: "Lead", lead } });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
    };

    if (isDragging) {
        return (
            <div
                ref={setNodeRef}
                style={style}
                className="opacity-50 bg-muted/50 border-2 border-dashed border-primary/50 rounded-lg h-[180px] mb-3"
            />
        );
    }

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat("id-ID", {
            style: "currency",
            currency: "IDR",
            maximumFractionDigits: 0,
        }).format(value);
    };

    const getPriorityColor = (priority: string) => {
        switch (priority) {
            case "URGENT":
                return "#ef4444"; // red-500
            case "HIGH":
                return "#f97316"; // orange-500
            case "MEDIUM":
                return "#3b82f6"; // blue-500
            case "LOW":
                return "#10b981"; // green-500
            default:
                return "#94a3b8"; // slate-400
        }
    };

    return (
        <div ref={setNodeRef} style={style} {...attributes} {...listeners} className="mb-3 touch-none group">
            <Card className="hover:shadow-md transition-all duration-200 cursor-grab active:cursor-grabbing border-l-4 overflow-hidden" style={{ borderLeftColor: getPriorityColor(lead.priority) }}>
                <CardHeader className="p-3 pb-2 space-y-0">
                    <div className="flex justify-between items-start gap-2">
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 font-normal text-muted-foreground">
                            {lead.source}
                        </Badge>
                        <Button variant="ghost" size="icon" className="h-6 w-6 -mr-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
                        </Button>
                    </div>
                    <CardTitle className="text-sm font-semibold leading-tight mt-1">
                        {lead.title}
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-3 pt-1">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-2">
                        <Building2 className="h-3 w-3" />
                        <span className="truncate font-medium">{lead.company}</span>
                    </div>

                    <div className="flex justify-between items-end mt-3">
                        <div>
                            <p className="text-[10px] text-muted-foreground mb-0.5">Nilai Estimasi</p>
                            <p className="text-sm font-bold text-primary">
                                {formatCurrency(lead.estimatedValue)}
                            </p>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <div className="text-[10px] font-medium bg-secondary px-1.5 py-0.5 rounded text-secondary-foreground">
                                {lead.probability}%
                            </div>
                            <Avatar className="h-6 w-6 border-2 border-background">
                                <AvatarFallback className="text-[10px] bg-primary/10 text-primary">
                                    {lead.assignedTo?.name.charAt(0) || "U"}
                                </AvatarFallback>
                            </Avatar>
                        </div>
                    </div>

                    <div className="mt-3 pt-2 border-t flex justify-between items-center text-[10px] text-muted-foreground">
                        <div className="flex items-center gap-1">
                            <User className="h-3 w-3" />
                            <span className="truncate max-w-[80px]">{lead.contactName}</span>
                        </div>
                        <div className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            <span>{new Date(lead.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}</span>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
