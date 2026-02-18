"use client";

import { useState } from "react";
import {
    Plus,
    Search,
    RefreshCw,
    AlertCircle,
    FolderKanban,
    ChevronRight,
    Activity,
    Trash2,
    Settings,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
} from "@/components/ui/sheet";
import { GroupFormDialog } from "@/components/manufacturing/group-form-dialog";
import { AssignMachineGroupDialog } from "@/components/manufacturing/assign-machine-group-dialog";
import { toast } from "sonner";
import Link from "next/link";

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

interface Props {
    initialGroups: WorkCenterGroup[];
}

function getStatusColor(status: string) {
    switch (status) {
        case 'RUNNING': return 'bg-emerald-500';
        case 'IDLE': return 'bg-zinc-400';
        case 'MAINTENANCE': return 'bg-amber-500';
        case 'BREAKDOWN': return 'bg-red-500';
        default: return 'bg-zinc-300';
    }
}

function getStatusBadge(status: string) {
    const map: Record<string, { label: string; dot: string; bg: string; text: string }> = {
        RUNNING: { label: 'Running', dot: 'bg-emerald-500', bg: 'bg-emerald-50 border-emerald-300', text: 'text-emerald-700' },
        IDLE: { label: 'Idle', dot: 'bg-zinc-400', bg: 'bg-zinc-100 border-zinc-300', text: 'text-zinc-600' },
        MAINTENANCE: { label: 'Maintenance', dot: 'bg-amber-500', bg: 'bg-amber-50 border-amber-300', text: 'text-amber-700' },
        BREAKDOWN: { label: 'Breakdown', dot: 'bg-red-500', bg: 'bg-red-50 border-red-300', text: 'text-red-700' },
        OFFLINE: { label: 'Offline', dot: 'bg-zinc-400', bg: 'bg-zinc-100 border-zinc-300', text: 'text-zinc-500' },
    };
    return map[status] || { label: status, dot: 'bg-zinc-400', bg: 'bg-zinc-100 border-zinc-300', text: 'text-zinc-600' };
}

export function GroupsClient({ initialGroups }: Props) {
    const [groups, setGroups] = useState<WorkCenterGroup[]>(initialGroups);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedGroup, setSelectedGroup] = useState<WorkCenterGroup | null>(null);
    const [sheetOpen, setSheetOpen] = useState(false);
    const [groupFormOpen, setGroupFormOpen] = useState(false);
    const [editingGroup, setEditingGroup] = useState<WorkCenterGroup | null>(null);
    const [assignMachineOpen, setAssignMachineOpen] = useState(false);
    const [deleting, setDeleting] = useState(false);

    const fetchGroups = async () => {
        setRefreshing(true);
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
            setRefreshing(false);
        }
    };

    const handleSearchChange = (value: string) => {
        setSearchQuery(value);
        setTimeout(() => fetchGroups(), 300);
    };

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

    const handleDeleteGroup = async () => {
        if (!selectedGroup) return;
        const confirmed = window.confirm(`Hapus grup "${selectedGroup.name}" (${selectedGroup.code})?\n\nMesin di grup ini tidak akan dihapus, hanya dicopot dari grup.`);
        if (!confirmed) return;

        setDeleting(true);
        try {
            const response = await fetch(`/api/manufacturing/groups/${selectedGroup.id}`, { method: 'DELETE' });
            const payload = await response.json();
            if (!payload.success) {
                toast.error(payload.error || 'Gagal menghapus grup');
                return;
            }
            toast.success('Grup berhasil dihapus');
            setSheetOpen(false);
            setSelectedGroup(null);
            await fetchGroups();
        } catch (err) {
            console.error(err);
            toast.error('Network error saat menghapus grup');
        } finally {
            setDeleting(false);
        }
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

    // Summary counts
    const totalMachines = groups.reduce((sum, g) => sum + g.machineCount, 0);
    const totalRunning = groups.reduce((sum, g) => sum + g.activeMachines, 0);
    const avgHealth = groups.length > 0
        ? Math.round(groups.reduce((sum, g) => sum + g.avgHealth, 0) / groups.length)
        : 0;
    const activeGroups = groups.filter(g => g.isActive).length;

    return (
        <div className="mf-page">

            {/* ── Page Header ─────────────────────────────────────────── */}
            <div className="border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] overflow-hidden bg-white dark:bg-zinc-900">
                <div className="px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-3 border-l-[6px] border-l-blue-400">
                    <div className="flex items-center gap-3">
                        <FolderKanban className="h-5 w-5 text-blue-500" />
                        <div>
                            <h1 className="text-xl font-black uppercase tracking-tight text-zinc-900 dark:text-white">
                                Grup Pusat Kerja
                            </h1>
                            <p className="text-zinc-400 text-xs font-medium mt-0.5">
                                Kelompokkan mesin berdasarkan area atau fungsi
                            </p>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <Link href="/manufacturing">
                            <Button variant="outline" className="border-2 border-zinc-300 dark:border-zinc-600 font-bold uppercase text-[10px] tracking-wide h-10 px-4 hover:border-zinc-500 transition-colors">
                                <Settings className="mr-1.5 h-3.5 w-3.5" /> Dashboard
                            </Button>
                        </Link>
                        <Button
                            variant="outline"
                            onClick={fetchGroups}
                            disabled={refreshing}
                            className="border-2 border-zinc-300 dark:border-zinc-600 font-bold uppercase text-[10px] tracking-wide h-10 px-4 hover:border-zinc-500 transition-colors"
                        >
                            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
                        </Button>
                        <Button
                            className="bg-blue-500 text-white hover:bg-blue-600 border-2 border-blue-600 font-black uppercase text-[10px] tracking-wide h-10 px-5 shadow-[3px_3px_0px_0px_rgba(0,0,0,0.2)] active:shadow-none active:translate-y-[1px] transition-all"
                            onClick={handleCreateGroup}
                        >
                            <Plus className="h-3.5 w-3.5 mr-1.5" /> Buat Grup
                        </Button>
                    </div>
                </div>
            </div>

            {/* ── KPI Cards ───────────────────────────────────────────── */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] bg-white dark:bg-zinc-900 overflow-hidden">
                    <div className="p-4">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Total Grup</span>
                            <FolderKanban className="h-4 w-4 text-blue-500" />
                        </div>
                        <div className="text-xl font-black text-zinc-900 dark:text-white">{groups.length}</div>
                        <span className="text-[10px] text-zinc-400 font-medium mt-1 block">
                            {activeGroups} aktif
                        </span>
                    </div>
                </div>
                <div className="border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] bg-white dark:bg-zinc-900 overflow-hidden">
                    <div className="p-4">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Total Mesin</span>
                            <Settings className="h-4 w-4 text-zinc-400" />
                        </div>
                        <div className="text-xl font-black text-zinc-900 dark:text-white">{totalMachines}</div>
                        <span className="text-[10px] text-zinc-400 font-medium mt-1 block">
                            Di semua grup
                        </span>
                    </div>
                </div>
                <div className="border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] bg-white dark:bg-zinc-900 overflow-hidden">
                    <div className="p-4">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Running</span>
                            <Activity className="h-4 w-4 text-emerald-500" />
                        </div>
                        <div className="text-xl font-black text-emerald-600">{totalRunning}</div>
                        <span className="text-[10px] text-zinc-400 font-medium mt-1 block">
                            Mesin berjalan
                        </span>
                    </div>
                </div>
                <div className="border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] bg-white dark:bg-zinc-900 overflow-hidden">
                    <div className="p-4">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Avg Health</span>
                            <Activity className="h-4 w-4 text-blue-500" />
                        </div>
                        <div className={`text-xl font-black ${avgHealth >= 80 ? 'text-emerald-600' : avgHealth >= 60 ? 'text-amber-600' : 'text-red-600'}`}>
                            {avgHealth}%
                        </div>
                        <span className="text-[10px] text-zinc-400 font-medium mt-1 block">
                            Rata-rata kesehatan
                        </span>
                    </div>
                </div>
            </div>

            {/* ── Search Bar ─────────────────────────────────────────── */}
            <div className="border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] bg-white dark:bg-zinc-900 overflow-hidden">
                <div className="px-4 py-3 flex items-center gap-3">
                    <Search className="h-4 w-4 text-zinc-400 shrink-0" />
                    <Input
                        placeholder="Cari grup..."
                        className="border-0 shadow-none focus-visible:ring-0 px-0 text-sm font-medium placeholder:text-zinc-400"
                        value={searchQuery}
                        onChange={(e) => handleSearchChange(e.target.value)}
                    />
                </div>
            </div>

            {/* ── Error State ─────────────────────────────────────────── */}
            {error && (
                <div className="border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] overflow-hidden bg-red-50 dark:bg-red-950/20 border-l-[5px] border-l-red-500">
                    <div className="px-5 py-3 flex items-center gap-3">
                        <AlertCircle className="h-4 w-4 text-red-600 shrink-0" />
                        <span className="text-xs font-bold text-red-700 flex-1">{error}</span>
                        <Button
                            variant="outline"
                            onClick={fetchGroups}
                            className="border-2 border-zinc-300 font-bold uppercase text-[10px] tracking-wide h-8 px-3"
                        >
                            Retry
                        </Button>
                    </div>
                </div>
            )}

            {/* ── Empty State ─────────────────────────────────────────── */}
            {groups.length === 0 && !error && (
                <div className="border-2 border-black border-dashed bg-white dark:bg-zinc-900 overflow-hidden">
                    <div className="py-16 flex flex-col items-center justify-center text-center px-4">
                        <FolderKanban className="h-10 w-10 text-zinc-300 mb-4" />
                        <h3 className="text-sm font-black uppercase tracking-wide text-zinc-600 dark:text-zinc-300">
                            {searchQuery ? 'Tidak ada grup ditemukan' : 'Belum ada grup pusat kerja'}
                        </h3>
                        <p className="text-[11px] text-zinc-400 mt-1">
                            {searchQuery ? 'Coba ubah kata pencarian.' : 'Buat grup pertama untuk mengorganisir mesin.'}
                        </p>
                        {!searchQuery && (
                            <Button
                                className="mt-4 bg-blue-500 text-white hover:bg-blue-600 border-2 border-blue-600 font-black uppercase text-[10px] tracking-wide h-10 px-5 shadow-[3px_3px_0px_0px_rgba(0,0,0,0.2)] active:shadow-none active:translate-y-[1px] transition-all"
                                onClick={handleCreateGroup}
                            >
                                <Plus className="h-3.5 w-3.5 mr-1.5" /> Buat Grup
                            </Button>
                        )}
                    </div>
                </div>
            )}

            {/* ── Group Cards ─────────────────────────────────────────── */}
            {groups.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {groups.map((group) => (
                        <div
                            key={group.id}
                            className="border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] bg-white dark:bg-zinc-900 overflow-hidden hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all cursor-pointer"
                            onClick={() => handleGroupClick(group)}
                        >
                            {/* Card Header */}
                            <div className="px-4 py-3 border-b-2 border-black flex items-start justify-between gap-2 border-l-[5px] border-l-blue-400">
                                <div className="min-w-0">
                                    <div className="flex items-center gap-2">
                                        <FolderKanban className="h-4 w-4 text-blue-600 shrink-0" />
                                        <h3 className="text-sm font-black uppercase tracking-wide text-zinc-900 dark:text-white truncate">
                                            {group.name}
                                        </h3>
                                    </div>
                                    <span className="text-[10px] font-mono text-zinc-400 ml-6">{group.code}</span>
                                </div>
                                <span className={`inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-wide px-2 py-0.5 border whitespace-nowrap shrink-0 ${
                                    group.isActive
                                        ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
                                        : 'bg-zinc-100 border-zinc-300 text-zinc-500'
                                }`}>
                                    <span className={`w-1.5 h-1.5 rounded-full ${group.isActive ? 'bg-emerald-500' : 'bg-zinc-400'}`} />
                                    {group.isActive ? 'Aktif' : 'Nonaktif'}
                                </span>
                            </div>

                            {/* Description */}
                            {group.description && (
                                <div className="px-4 pt-3">
                                    <p className="text-[11px] text-zinc-500 line-clamp-2">{group.description}</p>
                                </div>
                            )}

                            {/* Stats */}
                            <div className="p-4">
                                <div className="grid grid-cols-3 gap-2 text-center">
                                    <div className="p-2 border-2 border-zinc-200 bg-zinc-50 dark:bg-zinc-800/50">
                                        <p className="text-xl font-black text-zinc-900 dark:text-white">{group.machineCount}</p>
                                        <p className="text-[10px] font-black text-zinc-500 uppercase tracking-wide">Total</p>
                                    </div>
                                    <div className="p-2 border-2 border-emerald-300 bg-emerald-50 dark:bg-emerald-950/20">
                                        <p className="text-xl font-black text-emerald-600">{group.activeMachines}</p>
                                        <p className="text-[10px] font-black text-zinc-500 uppercase tracking-wide">Running</p>
                                    </div>
                                    <div className="p-2 border-2 border-zinc-200 bg-zinc-50 dark:bg-zinc-800/50">
                                        <p className={`text-xl font-black ${group.avgHealth >= 80 ? 'text-emerald-600' : group.avgHealth >= 60 ? 'text-amber-600' : 'text-red-600'}`}>
                                            {group.avgHealth}%
                                        </p>
                                        <p className="text-[10px] font-black text-zinc-500 uppercase tracking-wide">Health</p>
                                    </div>
                                </div>
                            </div>

                            {/* Machine dots */}
                            {group.machines.length > 0 && (
                                <div className="px-4 pb-3 flex items-center gap-1.5 border-t border-zinc-100 dark:border-zinc-800 pt-3">
                                    {group.machines.slice(0, 8).map((m) => (
                                        <div
                                            key={m.id}
                                            className={`w-2.5 h-2.5 rounded-full ${getStatusColor(m.status)}`}
                                            title={`${m.name}: ${m.status}`}
                                        />
                                    ))}
                                    {group.machines.length > 8 && (
                                        <span className="text-[10px] font-bold text-zinc-400 ml-1">
                                            +{group.machines.length - 8}
                                        </span>
                                    )}
                                    <ChevronRight className="h-3.5 w-3.5 ml-auto text-zinc-400" />
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {/* ── Detail Sheet ─────────────────────────────────────────── */}
            <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
                <SheetContent className="sm:max-w-lg overflow-y-auto border-l-2 border-black rounded-none p-0">
                    {selectedGroup && (
                        <>
                            {/* Sheet Header */}
                            <div className="px-6 py-4 border-b-2 border-black border-l-[5px] border-l-blue-400 bg-blue-50 dark:bg-blue-950/20">
                                <SheetHeader className="space-y-0">
                                    <SheetTitle className="flex items-center gap-2 text-sm font-black uppercase tracking-wide">
                                        <FolderKanban className="h-4 w-4 text-blue-600" />
                                        {selectedGroup.name}
                                    </SheetTitle>
                                    <SheetDescription className="font-mono text-[10px] text-zinc-400 ml-6">
                                        {selectedGroup.code}
                                    </SheetDescription>
                                </SheetHeader>
                            </div>

                            <div className="p-6 space-y-5">
                                {/* Stats */}
                                <div className="grid grid-cols-3 gap-3">
                                    <div className="text-center p-3 border-2 border-zinc-200 bg-zinc-50 dark:bg-zinc-800/50">
                                        <p className="text-2xl font-black text-zinc-900 dark:text-white">{selectedGroup.machineCount}</p>
                                        <p className="text-[10px] font-black text-zinc-500 uppercase tracking-wide">Mesin</p>
                                    </div>
                                    <div className="text-center p-3 border-2 border-emerald-300 bg-emerald-50 dark:bg-emerald-950/20">
                                        <p className="text-2xl font-black text-emerald-600">{selectedGroup.activeMachines}</p>
                                        <p className="text-[10px] font-black text-zinc-500 uppercase tracking-wide">Running</p>
                                    </div>
                                    <div className="text-center p-3 border-2 border-zinc-200 bg-zinc-50 dark:bg-zinc-800/50">
                                        <p className={`text-2xl font-black ${selectedGroup.avgHealth >= 80 ? 'text-emerald-600' : selectedGroup.avgHealth >= 60 ? 'text-amber-600' : 'text-red-600'}`}>
                                            {selectedGroup.avgHealth}%
                                        </p>
                                        <p className="text-[10px] font-black text-zinc-500 uppercase tracking-wide">Health</p>
                                    </div>
                                </div>

                                {/* Description */}
                                {selectedGroup.description && (
                                    <div className="border-2 border-black/10 bg-zinc-50 dark:bg-zinc-800/30 px-4 py-3">
                                        <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400 block mb-1">Deskripsi</span>
                                        <p className="text-xs text-zinc-600 dark:text-zinc-300">{selectedGroup.description}</p>
                                    </div>
                                )}

                                {/* Machine List */}
                                <div>
                                    <div className="flex items-center justify-between mb-3">
                                        <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">
                                            Mesin ({selectedGroup.machines.length})
                                        </span>
                                    </div>
                                    {selectedGroup.machines.length === 0 ? (
                                        <div className="text-center py-8 text-zinc-400 text-xs font-bold uppercase tracking-widest border-2 border-dashed border-zinc-200">
                                            Tidak ada mesin di grup ini
                                        </div>
                                    ) : (
                                        <div className="border-2 border-black overflow-hidden">
                                            <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                                                {selectedGroup.machines.map((machine, idx) => {
                                                    const cfg = getStatusBadge(machine.status);
                                                    return (
                                                        <div
                                                            key={machine.id}
                                                            className={`px-4 py-2.5 flex items-center justify-between gap-2 ${idx % 2 === 0 ? '' : 'bg-zinc-50/50 dark:bg-zinc-800/10'}`}
                                                        >
                                                            <div className="flex items-center gap-3 min-w-0">
                                                                <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${getStatusColor(machine.status)}`} />
                                                                <div className="min-w-0">
                                                                    <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100 block">{machine.name}</span>
                                                                    <span className="text-[10px] font-mono text-zinc-400">{machine.code}</span>
                                                                </div>
                                                            </div>
                                                            <div className="flex items-center gap-2 shrink-0">
                                                                <span className="text-[10px] font-bold text-zinc-500 flex items-center gap-1">
                                                                    <Activity className="h-3 w-3" />
                                                                    {machine.healthScore}%
                                                                </span>
                                                                <span className={`inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-wide px-2 py-0.5 border whitespace-nowrap ${cfg.bg} ${cfg.text}`}>
                                                                    <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                                                                    {cfg.label}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Actions */}
                                <div className="pt-4 border-t-2 border-black/10 flex gap-2">
                                    <Button
                                        className="flex-1 bg-blue-500 text-white hover:bg-blue-600 border-2 border-blue-600 font-black uppercase text-[10px] tracking-wide h-10 shadow-[3px_3px_0px_0px_rgba(0,0,0,0.2)] active:shadow-none active:translate-y-[1px] transition-all"
                                        onClick={handleEditGroup}
                                    >
                                        Edit Grup
                                    </Button>
                                    <Button
                                        variant="outline"
                                        className="border-2 border-zinc-300 font-bold uppercase text-[10px] tracking-wide h-10 px-4 hover:border-zinc-500 transition-colors"
                                        onClick={() => setAssignMachineOpen(true)}
                                    >
                                        Tambah Mesin
                                    </Button>
                                    <Button
                                        variant="outline"
                                        className="border-2 border-red-300 text-red-600 hover:bg-red-50 hover:border-red-400 h-10 px-3 transition-colors"
                                        onClick={handleDeleteGroup}
                                        disabled={deleting}
                                    >
                                        <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                </div>
                            </div>
                        </>
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
