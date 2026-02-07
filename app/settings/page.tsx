"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
    Settings,
    Shield,
    Bell,
    Zap,
    Info,
    Save,
    RotateCcw,
    Database,
    Server,
    Clock
} from "lucide-react";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { mockSystemSettings, systemInfo } from "@/components/settings/data";

export default function SystemSettingsPage() {
    const categories = Array.from(new Set(mockSystemSettings.map(s => s.category)));

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
        <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
            <div className="flex items-center justify-between space-y-2">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Pengaturan Sistem</h2>
                    <p className="text-muted-foreground">
                        Kelola konfigurasi dan preferensi sistem ERP.
                    </p>
                </div>
                <div className="flex items-center space-x-2">
                    <Button variant="outline">
                        <RotateCcw className="mr-2 h-4 w-4" />
                        Reset Default
                    </Button>
                    <Button>
                        <Save className="mr-2 h-4 w-4" />
                        Simpan Perubahan
                    </Button>
                </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Versi Sistem</CardTitle>
                        <Info className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{systemInfo.version}</div>
                        <p className="text-xs text-muted-foreground">
                            Build: {systemInfo.buildDate}
                        </p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Environment</CardTitle>
                        <Server className="h-4 w-4 text-green-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            <Badge variant="default" className="bg-green-600">
                                {systemInfo.environment}
                            </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">
                            {systemInfo.database}
                        </p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Uptime</CardTitle>
                        <Clock className="h-4 w-4 text-blue-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{systemInfo.uptime.split(' ')[0]}</div>
                        <p className="text-xs text-muted-foreground">
                            hari tanpa gangguan
                        </p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Last Backup</CardTitle>
                        <Database className="h-4 w-4 text-purple-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-lg font-bold">
                            {new Date(systemInfo.lastBackup).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                        </div>
                        <p className="text-xs text-muted-foreground">
                            {new Date(systemInfo.lastBackup).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                    </CardContent>
                </Card>
            </div>

            <Tabs defaultValue="Umum" className="space-y-4">
                <TabsList>
                    {categories.map((category) => (
                        <TabsTrigger key={category} value={category} className="flex items-center">
                            {category === 'Umum' && <Settings className="mr-2 h-4 w-4" />}
                            {category === 'Keamanan' && <Shield className="mr-2 h-4 w-4" />}
                            {category === 'Notifikasi' && <Bell className="mr-2 h-4 w-4" />}
                            {category === 'Performa' && <Zap className="mr-2 h-4 w-4" />}
                            {category}
                        </TabsTrigger>
                    ))}
                </TabsList>

                {categories.map((category) => (
                    <TabsContent key={category} value={category} className="space-y-4">
                        <Card>
                            <CardHeader>
                                <CardTitle>Pengaturan {category}</CardTitle>
                                <CardDescription>
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
            <Card className="border-orange-200 bg-orange-50/50">
                <CardHeader>
                    <CardTitle className="flex items-center text-orange-900">
                        <Shield className="mr-2 h-5 w-5" />
                        Tindakan Sistem Kritis
                    </CardTitle>
                    <CardDescription>
                        Operasi berikut memerlukan konfirmasi dan dapat mempengaruhi seluruh sistem.
                    </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-2">
                    <Button variant="outline" className="border-blue-600 text-blue-600 hover:bg-blue-50">
                        <Database className="mr-2 h-4 w-4" />
                        Backup Database Sekarang
                    </Button>
                    <Button variant="outline" className="border-purple-600 text-purple-600 hover:bg-purple-50">
                        <RotateCcw className="mr-2 h-4 w-4" />
                        Clear Cache Sistem
                    </Button>
                    <Button variant="outline" className="border-orange-600 text-orange-600 hover:bg-orange-50">
                        <Server className="mr-2 h-4 w-4" />
                        Restart Services
                    </Button>
                </CardContent>
            </Card>
        </div>
    );
}
