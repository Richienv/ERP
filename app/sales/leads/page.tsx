"use client";

import { LeadKanban } from "@/components/sales/leads/lead-kanban";
import { Button } from "@/components/ui/button";
import { Plus, LayoutGrid, List as ListIcon } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Link from "next/link";

export default function LeadsPage() {
    return (
        <div className="flex flex-col h-[calc(100vh-4rem)] space-y-4 p-4 md:p-8 pt-6">
            <div className="flex items-center justify-between space-y-2">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Pipeline & Prospek</h2>
                    <p className="text-muted-foreground">
                        Kelola prospek dan pantau pipeline penjualan Anda.
                    </p>
                </div>
                <div className="flex items-center space-x-2">
                    <Button asChild>
                        <Link href="/sales/leads/new">
                            <Plus className="mr-2 h-4 w-4" />
                            Prospek Baru
                        </Link>
                    </Button>
                </div>
            </div>

            <Tabs defaultValue="kanban" className="flex-1 flex flex-col space-y-4 overflow-hidden">
                <div className="flex items-center justify-between">
                    <TabsList>
                        <TabsTrigger value="kanban" className="flex items-center gap-2">
                            <LayoutGrid className="h-4 w-4" />
                            Kanban
                        </TabsTrigger>
                        <TabsTrigger value="list" className="flex items-center gap-2">
                            <ListIcon className="h-4 w-4" />
                            Daftar
                        </TabsTrigger>
                    </TabsList>
                </div>

                <TabsContent value="kanban" className="flex-1 h-full overflow-hidden border-none p-0 outline-none mt-0">
                    <LeadKanban />
                </TabsContent>

                <TabsContent value="list" className="h-full mt-0">
                    <div className="flex items-center justify-center h-[400px] border rounded-lg bg-muted/10 border-dashed">
                        <div className="text-center">
                            <ListIcon className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
                            <h3 className="text-lg font-medium">Tampilan Daftar</h3>
                            <p className="text-muted-foreground">Fitur ini akan segera hadir.</p>
                        </div>
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    );
}
