"use client";

import { useState, useMemo } from "react";
import { createPortal } from "react-dom";
import {
    DndContext,
    DragOverlay,
    useSensor,
    useSensors,
    PointerSensor,
    KeyboardSensor,
    DragStartEvent,
    DragOverEvent,
    DragEndEvent,
    closestCorners,
    pointerWithin,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates, arrayMove } from "@dnd-kit/sortable";
import { Lead, LEAD_STATUS_LABELS, mockLeads } from "./data";
import { LeadCard } from "./lead-card";
import { LeadColumn } from "./lead-column";
import { LeadStatus } from "@prisma/client";

export function LeadKanban() {
    const [leads, setLeads] = useState<Lead[]>(mockLeads);
    const [activeLead, setActiveLead] = useState<Lead | null>(null);

    const columns = useMemo(() => Object.keys(LEAD_STATUS_LABELS) as LeadStatus[], []);

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 5,
            },
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    function onDragStart(event: DragStartEvent) {
        if (event.active.data.current?.type === "Lead") {
            setActiveLead(event.active.data.current.lead);
        }
    }

    function onDragOver(event: DragOverEvent) {
        const { active, over } = event;
        if (!over) return;

        const activeId = active.id;
        const overId = over.id;

        if (activeId === overId) return;

        const isActiveALead = active.data.current?.type === "Lead";
        const isOverALead = over.data.current?.type === "Lead";
        const isOverAColumn = over.data.current?.type === "Column";

        if (!isActiveALead) return;

        // Dropping a Lead over another Lead
        if (isActiveALead && isOverALead) {
            const overLead = over.data.current?.lead as Lead;
            setLeads((leads) => {
                const activeIndex = leads.findIndex((l) => l.id === activeId);
                const overIndex = leads.findIndex((l) => l.id === overId);

                if (leads[activeIndex].status !== leads[overIndex].status) {
                    // Moving to a different column
                    const newLeads = [...leads];
                    newLeads[activeIndex] = { ...newLeads[activeIndex], status: leads[overIndex].status };
                    return arrayMove(newLeads, activeIndex, overIndex);
                }

                // Reordering in same column
                return arrayMove(leads, activeIndex, overIndex);
            });
        }

        // Dropping a Lead over a Column
        if (isActiveALead && isOverAColumn) {
            const overColumnId = overId as LeadStatus;
            setLeads((leads) => {
                const activeIndex = leads.findIndex((l) => l.id === activeId);
                if (leads[activeIndex].status !== overColumnId) {
                    const newLeads = [...leads];
                    newLeads[activeIndex] = { ...newLeads[activeIndex], status: overColumnId };
                    return arrayMove(newLeads, activeIndex, activeIndex); // Keep position roughly
                }
                return leads;
            });
        }
    }

    function onDragEnd(event: DragEndEvent) {
        setActiveLead(null);
    }

    return (
        <DndContext
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragStart={onDragStart}
            onDragOver={onDragOver}
            onDragEnd={onDragEnd}
        >
            <div className="flex h-full gap-4 overflow-x-auto pb-4 items-start">
                {columns.map((colId) => (
                    <LeadColumn
                        key={colId}
                        id={colId}
                        leads={leads.filter((l) => l.status === colId)}
                    />
                ))}
            </div>

            {typeof document !== "undefined" &&
                createPortal(
                    <DragOverlay>
                        {activeLead && <LeadCard lead={activeLead} />}
                    </DragOverlay>,
                    document.body
                )}
        </DndContext>
    );
}
