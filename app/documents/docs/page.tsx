"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
    BookOpen,
    Search,
    FileText,
    Code,
    Megaphone,
    Shield,
    Clock,
    User,
    Tag,
    ExternalLink
} from "lucide-react";
import { mockDocs } from "@/components/documents/docs/data";

export default function DocumentationPage() {
    const getCategoryIcon = (category: string) => {
        switch (category) {
            case 'USER_GUIDE': return <BookOpen className="h-4 w-4" />;
            case 'API': return <Code className="h-4 w-4" />;
            case 'RELEASE_NOTE': return <Megaphone className="h-4 w-4" />;
            case 'POLICY': return <Shield className="h-4 w-4" />;
            default: return <FileText className="h-4 w-4" />;
        }
    };

    const getCategoryColor = (category: string) => {
        switch (category) {
            case 'USER_GUIDE': return 'bg-blue-100 text-blue-700 border-blue-200';
            case 'API': return 'bg-purple-100 text-purple-700 border-purple-200';
            case 'RELEASE_NOTE': return 'bg-green-100 text-green-700 border-green-200';
            case 'POLICY': return 'bg-orange-100 text-orange-700 border-orange-200';
            default: return 'bg-gray-100 text-gray-700';
        }
    };

    const getCategoryLabel = (category: string) => {
        switch (category) {
            case 'USER_GUIDE': return 'Panduan Pengguna';
            case 'API': return 'API Reference';
            case 'RELEASE_NOTE': return 'Release Notes';
            case 'POLICY': return 'Kebijakan';
            default: return category;
        }
    };

    return (
        <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
            <div className="flex items-center justify-between space-y-2">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Dokumentasi</h2>
                    <p className="text-muted-foreground">
                        Panduan lengkap, referensi API, dan kebijakan sistem ERP.
                    </p>
                </div>
            </div>

            {/* Search and Filter */}
            <div className="flex items-center space-x-2">
                <div className="relative flex-1 max-w-xl">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input placeholder="Cari dokumentasi, panduan, atau kebijakan..." className="pl-8" />
                </div>
                <Button variant="outline">
                    <FileText className="mr-2 h-4 w-4" />
                    Semua Kategori
                </Button>
            </div>

            {/* Quick Stats */}
            <div className="grid gap-4 md:grid-cols-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Dokumen</CardTitle>
                        <FileText className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{mockDocs.length}</div>
                        <p className="text-xs text-muted-foreground">
                            Tersedia untuk dibaca
                        </p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Panduan Pengguna</CardTitle>
                        <BookOpen className="h-4 w-4 text-blue-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {mockDocs.filter(d => d.category === 'USER_GUIDE').length}
                        </div>
                        <p className="text-xs text-muted-foreground">
                            Tutorial & SOP
                        </p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">API Docs</CardTitle>
                        <Code className="h-4 w-4 text-purple-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {mockDocs.filter(d => d.category === 'API').length}
                        </div>
                        <p className="text-xs text-muted-foreground">
                            Referensi Developer
                        </p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Terakhir Update</CardTitle>
                        <Clock className="h-4 w-4 text-green-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {new Date(Math.max(...mockDocs.map(d => d.lastUpdated.getTime()))).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                        </div>
                        <p className="text-xs text-muted-foreground">
                            Update terbaru
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Documentation List */}
            <div className="grid gap-4 md:grid-cols-2">
                {mockDocs.map((doc) => (
                    <Card key={doc.id} className="hover:shadow-md transition-shadow cursor-pointer group">
                        <CardHeader>
                            <div className="flex items-start justify-between">
                                <div className="flex items-center space-x-2">
                                    <div className={`p-2 rounded-lg ${getCategoryColor(doc.category)}`}>
                                        {getCategoryIcon(doc.category)}
                                    </div>
                                    <div>
                                        <Badge variant="outline" className={getCategoryColor(doc.category)}>
                                            {getCategoryLabel(doc.category)}
                                        </Badge>
                                    </div>
                                </div>
                                <ExternalLink className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                            </div>
                            <CardTitle className="mt-4 group-hover:text-primary transition-colors">
                                {doc.title}
                            </CardTitle>
                            <CardDescription className="line-clamp-2">
                                {doc.excerpt}
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="flex items-center justify-between text-sm text-muted-foreground">
                                <div className="flex items-center space-x-4">
                                    <div className="flex items-center">
                                        <User className="mr-1 h-3 w-3" />
                                        {doc.author}
                                    </div>
                                    <div className="flex items-center">
                                        <Clock className="mr-1 h-3 w-3" />
                                        {doc.readTime}
                                    </div>
                                </div>
                                <div className="text-xs">
                                    {doc.lastUpdated.toLocaleDateString('id-ID')}
                                </div>
                            </div>
                            <div className="flex flex-wrap gap-1 mt-3">
                                {doc.tags.map((tag, idx) => (
                                    <Badge key={idx} variant="secondary" className="text-xs">
                                        <Tag className="mr-1 h-2 w-2" />
                                        {tag}
                                    </Badge>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Help Section */}
            <Card className="bg-gradient-to-r from-blue-50 to-purple-50 border-blue-200">
                <CardHeader>
                    <CardTitle className="flex items-center">
                        <BookOpen className="mr-2 h-5 w-5 text-blue-600" />
                        Butuh Bantuan?
                    </CardTitle>
                    <CardDescription>
                        Tidak menemukan dokumentasi yang Anda cari? Tim support kami siap membantu.
                    </CardDescription>
                </CardHeader>
                <CardContent className="flex space-x-2">
                    <Button>
                        Hubungi Support
                    </Button>
                    <Button variant="outline">
                        Request Dokumentasi
                    </Button>
                </CardContent>
            </Card>
        </div>
    );
}
