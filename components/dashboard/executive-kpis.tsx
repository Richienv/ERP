"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { TrendingUp, CheckCircle2, Factory, Clock } from "lucide-react"

export function ExecutiveKPIs() {
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card className="bg-card hover:shadow-md transition-shadow">
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground flex items-center justify-between">
                        Efficiency
                        <TrendingUp className="h-4 w-4 text-emerald-500" />
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">87%</div>
                    <p className="text-xs text-muted-foreground mt-1">Target: 85%</p>
                </CardContent>
            </Card>

            <Card className="bg-card hover:shadow-md transition-shadow">
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground flex items-center justify-between">
                        Orders On-Track
                        <Clock className="h-4 w-4 text-amber-500" />
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">23 / 28</div>
                    <p className="text-xs text-muted-foreground mt-1">5 At Risk</p>
                </CardContent>
            </Card>

            <Card className="bg-card hover:shadow-md transition-shadow">
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground flex items-center justify-between">
                        Quality Pass Rate
                        <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">94%</div>
                    <p className="text-xs text-muted-foreground mt-1">Target: 95%</p>
                </CardContent>
            </Card>

            <Card className="bg-card hover:shadow-md transition-shadow">
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground flex items-center justify-between">
                        Lines Active
                        <Factory className="h-4 w-4 text-blue-500" />
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">4 / 5</div>
                    <p className="text-xs text-muted-foreground mt-1">Line 3 Down</p>
                </CardContent>
            </Card>
        </div>
    )
}
