"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    Settings,
    Shield,
    Bell,
    Zap,
    Save,
    RotateCcw,
    Database,
    Server,
    Factory,
} from "lucide-react";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { mockSystemSettings, systemInfo } from "@/components/settings/data";
import { useWorkingHours, useSaveWorkingHours } from "@/hooks/use-working-hours";
import { toast } from "sonner";
import { NB } from "@/lib/dialog-styles";

export default function SystemSettingsPage() {
    const categories = Array.from(new Set(mockSystemSettings.map(s => s.category)));
    const workingHours = useWorkingHours()
    const [workingHoursInput, setWorkingHoursInput] = useState<string>("")
    const saveWorkingHours = useSaveWorkingHours()

    const effectiveHours = workingHoursInput !== "" ? Number(workingHoursInput) : workingHours

    const renderSettingInput = (setting: typeof mockSystemSettings[0]) => {
        switch (setting.type) {
            case "boolean":
                return (
                    <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                            <Label htmlFor={setting.id}>{setting.name}</Label>
                            <p className="text-sm text-muted-foreground">{setting.description}</p>
                        </div>
                        <Switch id={setting.id} checked={setting.value as boolean} />
                    </div>
                );
            case "number":
                return (
                    <div className="space-y-2">
                        <Label htmlFor={setting.id}>{setting.name}</Label>
                        <Input
                            id={setting.id}
                            type="number"
                            defaultValue={setting.value as number}
                            className="max-w-xs"
                        />
                        <p className="text-sm text-muted-foreground">{setting.description}</p>
                    </div>
                );
            case "select":
                return (
                    <div className="space-y-2">
                        <Label htmlFor={setting.id}>{setting.name}</Label>
                        <Select defaultValue={setting.value as string}>
                            <SelectTrigger className="max-w-xs">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {setting.options?.map((option) => (
                                    <SelectItem key={option} value={option}>
                                        {option}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <p className="text-sm text-muted-foreground">{setting.description}</p>
                    </div>
                );
            default:
                return (
                    <div className="space-y-2">
                        <Label htmlFor={setting.id}>{setting.name}</Label>
                        <Input
                            id={setting.id}
                            defaultValue={setting.value as string}
                            className="max-w-xl"
                        />
                        <p className="text-sm text-muted-foreground">{setting.description}</p>
                    </div>
                );
        }
    };

    return (
        <div className="mf-page">
            <div className={NB.pageCard}>
                <div className={NB.pageAccent} />
                <div className={`px-5 py-3.5 flex items-center justify-between ${NB.pageRowBorder}`}>
                    <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center bg-zinc-800 text-white">
                            <Settings className="h-4 w-4" />
                        </div>
                        <div>
                            <h1 className="text-base font-black uppercase tracking-wider text-zinc-900 dark:text-white">
                                Pengaturan Sistem
                            </h1>
                            <p className="text-xs font-medium text-zinc-400">
                                Kelola konfigurasi dan preferensi sistem ERP.
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-0">
                        <Button variant="outline" className={`${NB.toolbarBtn} ${NB.toolbarBtnJoin}`}>
                            <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                            Reset Default
                        </Button>
                        <Button className={NB.toolbarBtnPrimary}>
                            <Save className="mr-1.5 h-3.5 w-3.5" />
                            Simpan Perubahan
                        </Button>
                    </div>
                </div>

                <div className={`${NB.kpiStrip} ${NB.pageRowBorder}`}>
                    <div className={NB.kpiCell}>
                        <div className="flex items-center gap-1.5">
                            <span className="h-2 w-2 bg-zinc-400" />
                            <span className={NB.kpiLabel}>Versi</span>
                        </div>
                        <div className="text-right">
                            <span className={NB.kpiCount}>{systemInfo.version}</span>
                            <p className="text-xs font-medium text-zinc-400">Build {systemInfo.buildDate}</p>
                        </div>
                    </div>
                    <div className={NB.kpiCell}>
                        <div className="flex items-center gap-1.5">
                            <span className="h-2 w-2 bg-zinc-400" />
                            <span className={NB.kpiLabel}>Environment</span>
                        </div>
                        <div className="text-right">
                            <span className="text-sm font-black uppercase text-zinc-900 dark:text-white">
                                {systemInfo.environment}
                            </span>
                            <p className="text-xs font-medium text-zinc-400">{systemInfo.database}</p>
                        </div>
                    </div>
                    <div className={NB.kpiCell}>
                        <div className="flex items-center gap-1.5">
                            <span className="h-2 w-2 bg-zinc-400" />
                            <span className={NB.kpiLabel}>Uptime</span>
                        </div>
                        <div className="text-right">
                            <span className={NB.kpiCount}>{systemInfo.uptime.split(" ")[0]}</span>
                            <p className="text-xs font-medium text-zinc-400">hari tanpa gangguan</p>
                        </div>
                    </div>
                    <div className={NB.kpiCell}>
                        <div className="flex items-center gap-1.5">
                            <span className="h-2 w-2 bg-zinc-400" />
                            <span className={NB.kpiLabel}>Last Backup</span>
                        </div>
                        <div className="text-right">
                            <span className="text-sm font-black text-zinc-900 dark:text-white">
                                {new Date(systemInfo.lastBackup).toLocaleDateString("id-ID", { day: "numeric", month: "short" })}
                            </span>
                            <p className="text-xs font-medium text-zinc-400">
                                {new Date(systemInfo.lastBackup).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            <Tabs defaultValue="Manufaktur" className="space-y-4">
                <TabsList className="h-10 rounded-none border-2 border-black bg-zinc-100 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] dark:bg-zinc-800">
                    <TabsTrigger value="Manufaktur" className="flex items-center rounded-none text-xs font-bold uppercase tracking-wider data-[state=active]:bg-white data-[state=active]:shadow-none">
                        <Factory className="mr-2 h-4 w-4" />
                        Manufaktur
                    </TabsTrigger>
                    {categories.map((category) => (
                        <TabsTrigger key={category} value={category} className="flex items-center rounded-none text-xs font-bold uppercase tracking-wider data-[state=active]:bg-white data-[state=active]:shadow-none">
                            {category === 'Umum' && <Settings className="mr-2 h-4 w-4" />}
                            {category === 'Keamanan' && <Shield className="mr-2 h-4 w-4" />}
                            {category === 'Notifikasi' && <Bell className="mr-2 h-4 w-4" />}
                            {category === 'Performa' && <Zap className="mr-2 h-4 w-4" />}
                            {category}
                        </TabsTrigger>
                    ))}
                </TabsList>

                {/* ── Manufaktur settings (real DB-backed) ── */}
                <TabsContent value="Manufaktur" className="space-y-4">
                    <Card className="rounded-none border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                        <CardHeader>
                            <CardTitle className="text-sm font-black uppercase tracking-wider">Pengaturan Manufaktur</CardTitle>
                            <CardDescription className="text-xs">
                                Konfigurasi parameter produksi dan kalkulasi biaya.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="space-y-2">
                                <Label htmlFor="working-hours">Jam Kerja per Bulan</Label>
                                <div className="flex items-center gap-3">
                                    <Input
                                        id="working-hours"
                                        type="number"
                                        min={1}
                                        max={744}
                                        value={workingHoursInput !== "" ? workingHoursInput : workingHours}
                                        onChange={(e) => setWorkingHoursInput(e.target.value)}
                                        className={`max-w-xs rounded-none ${effectiveHours ? NB.inputActive : NB.inputEmpty}`}
                                    />
                                    <Button
                                        onClick={async () => {
                                            const val = Number(workingHoursInput !== "" ? workingHoursInput : workingHours)
                                            if (!val || val < 1) return
                                            await saveWorkingHours.mutateAsync(val)
                                            setWorkingHoursInput("")
                                            toast.success(`Jam kerja diperbarui: ${val} jam/bulan`)
                                        }}
                                        disabled={saveWorkingHours.isPending}
                                        className={NB.toolbarBtnPrimary + " !ml-0"}
                                    >
                                        <Save className="mr-2 h-4 w-4" />
                                        {saveWorkingHours.isPending ? "Menyimpan..." : "Simpan"}
                                    </Button>
                                </div>
                                <p className="text-sm text-muted-foreground">
                                    Standar UU Ketenagakerjaan Indonesia: <strong>172 jam/bulan</strong> (26 hari kerja × ~6.6 jam).
                                    Digunakan untuk menghitung biaya tenaga kerja per pcs dari gaji bulanan operator.
                                </p>
                                <div className="mt-2 p-3 bg-zinc-50 border border-zinc-200 rounded text-xs text-zinc-600 font-mono">
                                    Biaya TK/pcs = Gaji Bulanan × Durasi (menit) ÷ ({effectiveHours} jam × 60)
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {categories.map((category) => (
                    <TabsContent key={category} value={category} className="space-y-4">
                        <Card className="rounded-none border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                            <CardHeader>
                                <CardTitle className="text-sm font-black uppercase tracking-wider">Pengaturan {category}</CardTitle>
                                <CardDescription className="text-xs">
                                    Konfigurasi untuk {category.toLowerCase()} sistem.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                {mockSystemSettings
                                    .filter(s => s.category === category)
                                    .map((setting) => (
                                        <div key={setting.id} className="border-b pb-6 last:border-0 last:pb-0">
                                            {renderSettingInput(setting)}
                                        </div>
                                    ))}
                            </CardContent>
                        </Card>
                    </TabsContent>
                ))}
            </Tabs>

            {/* System Actions */}
            <Card className="rounded-none border-2 border-black bg-zinc-50 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:bg-zinc-900">
                <CardHeader>
                    <CardTitle className="flex items-center text-sm font-black uppercase tracking-wider text-zinc-900 dark:text-white">
                        <Shield className="mr-2 h-5 w-5 text-zinc-600" />
                        Tindakan Sistem Kritis
                    </CardTitle>
                    <CardDescription className="text-xs">
                        Operasi berikut memerlukan konfirmasi dan dapat mempengaruhi seluruh sistem.
                    </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-2">
                    <Button variant="outline" className={NB.toolbarBtn}>
                        <Database className="mr-2 h-4 w-4" />
                        Backup Database Sekarang
                    </Button>
                    <Button variant="outline" className={NB.toolbarBtn}>
                        <RotateCcw className="mr-2 h-4 w-4" />
                        Clear Cache Sistem
                    </Button>
                    <Button variant="outline" className={NB.toolbarBtn}>
                        <Server className="mr-2 h-4 w-4" />
                        Restart Services
                    </Button>
                </CardContent>
            </Card>
        </div>
    );
}
