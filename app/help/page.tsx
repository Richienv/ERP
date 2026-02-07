"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/ui/accordion";
import {
    HelpCircle,
    MessageSquare,
    Phone,
    Mail,
    Video,
    FileText,
    Send,
    Search,
    Clock,
    CheckCircle,
    AlertCircle,
    PlayCircle,
    BookOpen,
    Headphones
} from "lucide-react";
import { mockFAQs, mockTickets, mockTutorials, supportChannels } from "@/components/help/data";

export default function HelpSupportPage() {
    const getCategoryIcon = (category: string) => {
        switch (category) {
            case 'GENERAL': return <HelpCircle className="h-4 w-4" />;
            case 'INVENTORY': return <FileText className="h-4 w-4" />;
            case 'SALES': return <MessageSquare className="h-4 w-4" />;
            case 'FINANCE': return <FileText className="h-4 w-4" />;
            case 'MANUFACTURING': return <FileText className="h-4 w-4" />;
            case 'TECHNICAL': return <AlertCircle className="h-4 w-4" />;
            default: return <HelpCircle className="h-4 w-4" />;
        }
    };

    const getTicketStatusColor = (status: string) => {
        switch (status) {
            case 'OPEN': return 'bg-blue-100 text-blue-700 border-blue-200';
            case 'IN_PROGRESS': return 'bg-yellow-100 text-yellow-700 border-yellow-200';
            case 'RESOLVED': return 'bg-green-100 text-green-700 border-green-200';
            case 'CLOSED': return 'bg-gray-100 text-gray-700 border-gray-200';
            default: return 'bg-gray-100 text-gray-700';
        }
    };

    const getPriorityColor = (priority: string) => {
        switch (priority) {
            case 'URGENT': return 'bg-red-100 text-red-700 border-red-200';
            case 'HIGH': return 'bg-orange-100 text-orange-700 border-orange-200';
            case 'MEDIUM': return 'bg-yellow-100 text-yellow-700 border-yellow-200';
            case 'LOW': return 'bg-green-100 text-green-700 border-green-200';
            default: return 'bg-gray-100 text-gray-700';
        }
    };

    const categories = Array.from(new Set(mockFAQs.map(f => f.category)));

    return (
        <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
            <div className="flex items-center justify-between space-y-2">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Bantuan & Dukungan</h2>
                    <p className="text-muted-foreground">
                        Pusat bantuan untuk sistem ERP - FAQ, tutorial, dan kontak support.
                    </p>
                </div>
            </div>

            {/* Quick Actions */}
            <div className="grid gap-4 md:grid-cols-4">
                <Card className="hover:bg-accent transition-colors cursor-pointer">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Live Chat</CardTitle>
                        <MessageSquare className="h-4 w-4 text-green-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-xs text-muted-foreground">
                            <div className="flex items-center">
                                <div className="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse" />
                                Online Sekarang
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card className="hover:bg-accent transition-colors cursor-pointer">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Email Support</CardTitle>
                        <Mail className="h-4 w-4 text-blue-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-xs text-muted-foreground">
                            Response dalam 24 jam
                        </div>
                    </CardContent>
                </Card>
                <Card className="hover:bg-accent transition-colors cursor-pointer">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Telepon</CardTitle>
                        <Phone className="h-4 w-4 text-purple-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-xs text-muted-foreground">
                            08:00 - 17:00 WIB
                        </div>
                    </CardContent>
                </Card>
                <Card className="hover:bg-accent transition-colors cursor-pointer">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Video Tutorial</CardTitle>
                        <Video className="h-4 w-4 text-orange-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-xs text-muted-foreground">
                            {mockTutorials.length} video tersedia
                        </div>
                    </CardContent>
                </Card>
            </div>

            <Tabs defaultValue="faq" className="space-y-4">
                <TabsList>
                    <TabsTrigger value="faq" className="flex items-center">
                        <BookOpen className="mr-2 h-4 w-4" />
                        FAQ
                    </TabsTrigger>
                    <TabsTrigger value="tickets" className="flex items-center">
                        <MessageSquare className="mr-2 h-4 w-4" />
                        My Tickets
                    </TabsTrigger>
                    <TabsTrigger value="tutorials" className="flex items-center">
                        <Video className="mr-2 h-4 w-4" />
                        Video Tutorial
                    </TabsTrigger>
                    <TabsTrigger value="contact" className="flex items-center">
                        <Headphones className="mr-2 h-4 w-4" />
                        Kontak Support
                    </TabsTrigger>
                </TabsList>

                {/* FAQ Tab */}
                <TabsContent value="faq" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <div className="flex items-center justify-between">
                                <div>
                                    <CardTitle>Frequently Asked Questions</CardTitle>
                                    <CardDescription>Pertanyaan umum seputar penggunaan sistem ERP</CardDescription>
                                </div>
                                <div className="relative w-[300px]">
                                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                                    <Input placeholder="Cari pertanyaan..." className="pl-8" />
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <Tabs defaultValue={categories[0]}>
                                <TabsList className="grid grid-cols-6 w-full">
                                    {categories.map((cat) => (
                                        <TabsTrigger key={cat} value={cat} className="text-xs">
                                            {cat}
                                        </TabsTrigger>
                                    ))}
                                </TabsList>
                                {categories.map((category) => (
                                    <TabsContent key={category} value={category}>
                                        <Accordion type="single" collapsible className="w-full">
                                            {mockFAQs.filter(f => f.category === category).map((faq, index) => (
                                                <AccordionItem key={faq.id} value={`item-${index}`}>
                                                    <AccordionTrigger className="text-left">
                                                        <div className="flex items-center">
                                                            {getCategoryIcon(faq.category)}
                                                            <span className="ml-2">{faq.question}</span>
                                                        </div>
                                                    </AccordionTrigger>
                                                    <AccordionContent className="text-muted-foreground">
                                                        {faq.answer}
                                                    </AccordionContent>
                                                </AccordionItem>
                                            ))}
                                        </Accordion>
                                    </TabsContent>
                                ))}
                            </Tabs>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Tickets Tab */}
                <TabsContent value="tickets" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <div className="flex items-center justify-between">
                                <div>
                                    <CardTitle>Support Tickets</CardTitle>
                                    <CardDescription>Riwayat permintaan bantuan Anda</CardDescription>
                                </div>
                                <Button>
                                    <Send className="mr-2 h-4 w-4" />
                                    Submit Ticket Baru
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {mockTickets.map((ticket) => (
                                <div key={ticket.id} className="border rounded-lg p-4 hover:bg-accent transition-colors">
                                    <div className="flex items-start justify-between">
                                        <div className="space-y-2 flex-1">
                                            <div className="flex items-center space-x-2">
                                                <h4 className="font-medium">{ticket.title}</h4>
                                                <Badge variant="outline" className={getTicketStatusColor(ticket.status)}>
                                                    {ticket.status}
                                                </Badge>
                                                <Badge variant="outline" className={getPriorityColor(ticket.priority)}>
                                                    {ticket.priority}
                                                </Badge>
                                            </div>
                                            <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                                                <span className="flex items-center">
                                                    <FileText className="mr-1 h-3 w-3" />
                                                    {ticket.id}
                                                </span>
                                                <span>•</span>
                                                <span>{ticket.category}</span>
                                                <span>•</span>
                                                <span className="flex items-center">
                                                    <Clock className="mr-1 h-3 w-3" />
                                                    {ticket.createdAt.toLocaleDateString('id-ID')}
                                                </span>
                                            </div>
                                        </div>
                                        <Button variant="outline" size="sm">
                                            Lihat Detail
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </CardContent>
                    </Card>

                    {/* Submit New Ticket Form */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Buat Ticket Baru</CardTitle>
                            <CardDescription>Sampaikan masalah atau pertanyaan Anda</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid gap-4 md:grid-cols-2">
                                <div className="space-y-2">
                                    <Label htmlFor="ticket-category">Kategori</Label>
                                    <Select>
                                        <SelectTrigger id="ticket-category">
                                            <SelectValue placeholder="Pilih kategori" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="technical">Technical Issue</SelectItem>
                                            <SelectItem value="access">Access Request</SelectItem>
                                            <SelectItem value="training">Training</SelectItem>
                                            <SelectItem value="feature">Feature Request</SelectItem>
                                            <SelectItem value="other">Lainnya</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="ticket-priority">Prioritas</Label>
                                    <Select>
                                        <SelectTrigger id="ticket-priority">
                                            <SelectValue placeholder="Pilih prioritas" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="LOW">Low</SelectItem>
                                            <SelectItem value="MEDIUM">Medium</SelectItem>
                                            <SelectItem value="HIGH">High</SelectItem>
                                            <SelectItem value="URGENT">Urgent</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="ticket-title">Judul</Label>
                                <Input id="ticket-title" placeholder="Deskripsi singkat masalah" />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="ticket-description">Deskripsi Detail</Label>
                                <Textarea
                                    id="ticket-description"
                                    placeholder="Jelaskan masalah Anda secara detail..."
                                    rows={4}
                                />
                            </div>
                            <Button className="w-full">
                                <Send className="mr-2 h-4 w-4" />
                                Submit Ticket
                            </Button>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Tutorials Tab */}
                <TabsContent value="tutorials" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>Video Tutorial</CardTitle>
                            <CardDescription>Panduan video untuk berbagai modul ERP</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="grid gap-4 md:grid-cols-2">
                                {mockTutorials.map((tutorial) => (
                                    <div key={tutorial.id} className="border rounded-lg p-4 hover:bg-accent transition-colors cursor-pointer group">
                                        <div className="space-y-3">
                                            <div className="aspect-video bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                                                <PlayCircle className="h-16 w-16 text-white group-hover:scale-110 transition-transform" />
                                            </div>
                                            <div>
                                                <div className="flex items-center justify-between mb-2">
                                                    <Badge variant="secondary">{tutorial.module}</Badge>
                                                    <span className="text-xs text-muted-foreground flex items-center">
                                                        <Clock className="mr-1 h-3 w-3" />
                                                        {tutorial.duration}
                                                    </span>
                                                </div>
                                                <h4 className="font-medium group-hover:text-primary transition-colors">
                                                    {tutorial.title}
                                                </h4>
                                                <p className="text-sm text-muted-foreground mt-1">
                                                    {tutorial.description}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Contact Tab */}
                <TabsContent value="contact" className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-2">
                        {supportChannels.map((channel, idx) => (
                            <Card key={idx} className="hover:shadow-md transition-shadow">
                                <CardHeader>
                                    <CardTitle className="flex items-center text-lg">
                                        {channel.icon === 'Mail' && <Mail className="mr-2 h-5 w-5 text-blue-600" />}
                                        {channel.icon === 'Phone' && <Phone className="mr-2 h-5 w-5 text-green-600" />}
                                        {channel.icon === 'MessageSquare' && <MessageSquare className="mr-2 h-5 w-5 text-purple-600" />}
                                        {channel.icon === 'MessageCircle' && <MessageSquare className="mr-2 h-5 w-5 text-orange-600" />}
                                        {channel.name}
                                    </CardTitle>
                                    <CardDescription>{channel.description}</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <p className="text-lg font-medium">{channel.contact}</p>
                                    <Button className="w-full mt-4" variant="outline">
                                        Hubungi Sekarang
                                    </Button>
                                </CardContent>
                            </Card>
                        ))}
                    </div>

                    {/* Business Hours */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center">
                                <Clock className="mr-2 h-5 w-5" />
                                Jam Operasional Support
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="grid gap-2">
                            <div className="flex justify-between border-b pb-2">
                                <span className="font-medium">Senin - Jumat</span>
                                <span className="text-muted-foreground">08:00 - 17:00 WIB</span>
                            </div>
                            <div className="flex justify-between border-b pb-2">
                                <span className="font-medium">Sabtu</span>
                                <span className="text-muted-foreground">09:00 - 13:00 WIB</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="font-medium">Minggu & Libur</span>
                                <span className="text-muted-foreground">Tutup (Email Only)</span>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}
