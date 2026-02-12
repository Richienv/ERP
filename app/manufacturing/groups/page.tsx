"use client";

import { useEffect, useState } from "react";
import {
    Plus,
    Search,
    RefreshCw,
    AlertCircle,
    FolderKanban,
    ChevronRight,
    Activity,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
} from "@/components/ui/sheet";
import { GroupFormDialog } from "@/components/manufacturing/group-form-dialog";
import { AssignMachineGroupDialog } from "@/components/manufacturing/assign-machine-group-dialog";

interface Machine {
    id: string;
    code: string;
    name: string;
    status: string;
    healthScore: number;
    isActive: boolean;
}

interface WorkCenterGroup {
    id: string;
    code: string;
    name: string;
    description?: string | null;
    isActive: boolean;
    machineCount: number;
    activeMachines: number;
    avgHealth: number;
    machines: Machine[];
    createdAt: string;
    updatedAt: string;
}

export default function WorkCenterGroupsPage() {
    const [groups, setGroups] = useState<WorkCenterGroup[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedGroup, setSelectedGroup] = useState<WorkCenterGroup | null>(null);
    const [sheetOpen, setSheetOpen] = useState(false);
    const [groupFormOpen, setGroupFormOpen] = useState(false);
    const [editingGroup, setEditingGroup] = useState<WorkCenterGroup | null>(null);
    const [assignMachineOpen, setAssignMachineOpen] = useState(false);

    const fetchGroups = async () => {
        setLoading(true);
        setError(null);
        try {
            const params = new URLSearchParams();
            if (searchQuery) params.append('search', searchQuery);

            const response = await fetch(`/api/manufacturing/groups?${params.toString()}`);
            const data = await response.json();

            if (data.success) {
                setGroups(data.data);
            } else {
                setError(data.error || 'Failed to fetch groups');
            }
        } catch (err) {
            setError('Network error. Please try again.');
            console.error('Error fetching groups:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchGroups();
    }, []);

    // Debounced search
    useEffect(() => {
        const timer = setTimeout(() => {
            fetchGroups();
        }, 300);
        return () => clearTimeout(timer);
    }, [searchQuery]);

    const handleGroupClick = (group: WorkCenterGroup) => {
        setSelectedGroup(group);
        setSheetOpen(true);
    };

    const handleCreateGroup = () => {
        setEditingGroup(null);
        setGroupFormOpen(true);
    };

    const handleEditGroup = () => {
        if (!selectedGroup) return;
        setEditingGroup(selectedGroup);
        setGroupFormOpen(true);
    };

    const refreshGroupsAndSelection = async () => {
        await fetchGroups();
        if (selectedGroup?.id) {
            try {
                const response = await fetch(`/api/manufacturing/groups/${selectedGroup.id}`);
                const payload = await response.json();
                if (payload.success) {
                    setSelectedGroup(payload.data);
                }
            } catch (error) {
                console.error("Error refreshing selected group:", error);
            }
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'RUNNING':
                return 'bg-emerald-500';
            case 'IDLE':
                return 'bg-zinc-400';
            case 'MAINTENANCE':
                return 'bg-amber-500';
            case 'BREAKDOWN':
                return 'bg-red-500';
            default:
                return 'bg-zinc-300';
        }
    };

    return (
        <div className="mf-page">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="mf-title">Work Center Groups</h2>
                    <p className="text-muted-foreground">Kelompokkan mesin/work center berdasarkan area atau fungsi.</p>
                </div>
                <div className="flex gap-2">
                    <Button
                        variant="outline"
                        size="icon"
                        onClick={fetchGroups}
                        disabled={loading}
                        className="border-black"
                    >
                        <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                    </Button>
                    <Button
                        className="bg-black text-white hover:bg-zinc-800 border border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] uppercase font-bold tracking-wide"
                        onClick={handleCreateGroup}
                    >
                        <Plus className="mr-2 h-4 w-4" /> New Group
                    </Button>
                </div>
            </div>

            {/* Search */}
            <div className="flex items-center gap-4">
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search groups..."
                        className="pl-9 border-black/20"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
            </div>

            {/* Error State */}
            {error && (
                <Card className="border-red-300 bg-red-50">
                    <CardContent className="p-4 flex items-center gap-3 text-red-700">
                        <AlertCircle className="h-5 w-5" />
                        <span>{error}</span>
                        <Button variant="outline" size="sm" onClick={fetchGroups} className="ml-auto">
                            Retry
                        </Button>
                    </CardContent>
                </Card>
            )}

            {/* Loading State */}
            {loading && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {[1, 2, 3, 4, 5, 6].map((i) => (
                        <Card key={i} className="border border-black/20">
                            <CardHeader className="pb-2">
                                <Skeleton className="h-5 w-24" />
                                <Skeleton className="h-4 w-full mt-2" />
                            </CardHeader>
                            <CardContent className="pt-2">
                                <Skeleton className="h-12 w-full" />
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            {/* Empty State */}
            {!loading && !error && groups.length === 0 && (
                <Card className="border-dashed border-2 border-zinc-300">
                    <CardContent className="p-12 flex flex-col items-center justify-center text-center">
                        <FolderKanban className="h-12 w-12 text-zinc-300 mb-4" />
                        <h3 className="text-lg font-bold text-zinc-600">No work center groups found</h3>
                        <p className="text-sm text-muted-foreground mt-1">
                            {searchQuery ? 'Try adjusting your search.' : 'Create your first group to organize machines.'}
                        </p>
                        <Button className="mt-4 bg-black text-white" onClick={handleCreateGroup}>
                            <Plus className="mr-2 h-4 w-4" /> New Group
                        </Button>
                    </CardContent>
                </Card>
            )}

            {/* Group Cards */}
            {!loading && !error && groups.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {groups.map((group) => (
                        <Card
                            key={group.id}
                            className="group border border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all cursor-pointer"
                            onClick={() => handleGroupClick(group)}
                        >
                            <CardHeader className="pb-2">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <CardTitle className="text-lg font-black flex items-center gap-2">
                                            <FolderKanban className="h-5 w-5" />
                                            {group.name}
                                        </CardTitle>
                                        <p className="text-xs font-mono text-muted-foreground">{group.code}</p>
                                    </div>
                                    <Badge
                                        variant={group.isActive ? "default" : "secondary"}
                                        className={`text-[10px] ${group.isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-zinc-100'} border-black`}
                                    >
                                        {group.isActive ? 'Active' : 'Inactive'}
                                    </Badge>
                                </div>
                            </CardHeader>
                            <CardContent className="pt-2 space-y-4">
                                {group.description && (
                                    <p className="text-sm text-muted-foreground line-clamp-2">{group.description}</p>
                                )}

                                {/* Machine summary */}
                                <div className="grid grid-cols-3 gap-2 text-center">
                                    <div className="p-2 bg-zinc-50 rounded border">
                                        <p className="text-xl font-black">{group.machineCount}</p>
                                        <p className="text-[10px] text-muted-foreground uppercase">Total</p>
                                    </div>
                                    <div className="p-2 bg-emerald-50 rounded border border-emerald-200">
                                        <p className="text-xl font-black text-emerald-600">{group.activeMachines}</p>
                                        <p className="text-[10px] text-muted-foreground uppercase">Running</p>
                                    </div>
                                    <div className="p-2 bg-zinc-50 rounded border">
                                        <p className="text-xl font-black">{group.avgHealth}%</p>
                                        <p className="text-[10px] text-muted-foreground uppercase">Health</p>
                                    </div>
                                </div>

                                {/* Machine status dots */}
                                {group.machines.length > 0 && (
                                    <div className="flex items-center gap-1 pt-2 border-t border-dashed">
                                        {group.machines.slice(0, 8).map((m) => (
                                            <div
                                                key={m.id}
                                                className={`w-3 h-3 rounded-full ${getStatusColor(m.status)}`}
                                                title={`${m.name}: ${m.status}`}
                                            />
                                        ))}
                                        {group.machines.length > 8 && (
                                            <span className="text-xs text-muted-foreground ml-1">
                                                +{group.machines.length - 8}
                                            </span>
                                        )}
                                        <ChevronRight className="h-4 w-4 ml-auto text-muted-foreground" />
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            {/* Detail Sheet */}
            <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
                <SheetContent className="sm:max-w-lg overflow-y-auto">
                    <SheetHeader>
                        <SheetTitle className="flex items-center gap-2">
                            <FolderKanban className="h-5 w-5" />
                            {selectedGroup?.name}
                        </SheetTitle>
                        <SheetDescription className="font-mono">{selectedGroup?.code}</SheetDescription>
                    </SheetHeader>

                    {selectedGroup && (
                        <div className="mt-6 space-y-6">
                            {/* Summary */}
                            <div className="grid grid-cols-3 gap-3">
                                <div className="text-center p-3 bg-zinc-50 rounded-lg border">
                                    <p className="text-2xl font-black">{selectedGroup.machineCount}</p>
                                    <p className="text-xs text-muted-foreground uppercase">Machines</p>
                                </div>
                                <div className="text-center p-3 bg-emerald-50 rounded-lg border border-emerald-200">
                                    <p className="text-2xl font-black text-emerald-600">{selectedGroup.activeMachines}</p>
                                    <p className="text-xs text-muted-foreground uppercase">Running</p>
                                </div>
                                <div className="text-center p-3 bg-zinc-50 rounded-lg border">
                                    <p className="text-2xl font-black">{selectedGroup.avgHealth}%</p>
                                    <p className="text-xs text-muted-foreground uppercase">Avg Health</p>
                                </div>
                            </div>

                            {/* Description */}
                            {selectedGroup.description && (
                                <div>
                                    <h4 className="font-bold text-sm uppercase mb-2">Description</h4>
                                    <p className="text-sm text-muted-foreground">{selectedGroup.description}</p>
                                </div>
                            )}

                            {/* Machines List */}
                            <div>
                                <h4 className="font-bold text-sm uppercase mb-3">Machines ({selectedGroup.machines.length})</h4>
                                {selectedGroup.machines.length === 0 ? (
                                    <p className="text-sm text-muted-foreground">No machines in this group</p>
                                ) : (
                                    <div className="space-y-2">
                                        {selectedGroup.machines.map((machine) => (
                                            <div
                                                key={machine.id}
                                                className="flex items-center justify-between p-3 bg-zinc-50 rounded-lg border"
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className={`w-3 h-3 rounded-full ${getStatusColor(machine.status)}`} />
                                                    <div>
                                                        <p className="font-bold text-sm">{machine.name}</p>
                                                        <p className="text-xs text-muted-foreground font-mono">{machine.code}</p>
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <Badge
                                                        className={`text-[10px] ${machine.status === 'RUNNING' ? 'bg-emerald-100 text-emerald-800' :
                                                                machine.status === 'BREAKDOWN' ? 'bg-red-100 text-red-800' :
                                                                    'bg-zinc-100 text-zinc-600'
                                                            } border-black`}
                                                    >
                                                        {machine.status}
                                                    </Badge>
                                                    <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                                                        <Activity className="h-3 w-3" />
                                                        {machine.healthScore}%
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Actions */}
                            <div className="pt-4 border-t flex gap-2">
                                <Button className="flex-1 bg-black text-white hover:bg-zinc-800" onClick={handleEditGroup}>
                                    Edit Group
                                </Button>
                                <Button variant="outline" className="border-black" onClick={() => setAssignMachineOpen(true)}>
                                    Add Machine
                                </Button>
                            </div>
                        </div>
                    )}
                </SheetContent>
            </Sheet>

            <GroupFormDialog
                open={groupFormOpen}
                onOpenChange={setGroupFormOpen}
                initialData={editingGroup}
                onSaved={refreshGroupsAndSelection}
            />

            {selectedGroup && (
                <AssignMachineGroupDialog
                    open={assignMachineOpen}
                    onOpenChange={setAssignMachineOpen}
                    groupId={selectedGroup.id}
                    groupName={selectedGroup.name}
                    onAssigned={refreshGroupsAndSelection}
                />
            )}
        </div>
    );
}
