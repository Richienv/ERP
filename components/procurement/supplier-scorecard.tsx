"use client"

import {
    RadarChart,
    PolarGrid,
    PolarAngleAxis,
    PolarRadiusAxis,
    Radar,
    ResponsiveContainer,
} from "recharts"
import { Award, TrendingUp, Package, Clock, ShieldCheck, Zap } from "lucide-react"

// ==============================================================================
// Types
// ==============================================================================

interface SupplierScorecardData {
    supplier: {
        id: string
        name: string
        code: string
        rating: number
        onTimeRate: number
        qualityScore: number
        responsiveness: number
    }
    metrics: {
        totalPOs: number
        completedPOs: number
        avgLeadTimeDays: number
        totalSpend: number
        defectRate: number
        onTimeDeliveryPct: number
    }
}

interface SupplierScorecardProps {
    data: SupplierScorecardData
}

// ==============================================================================
// Pure Functions
// ==============================================================================

export function calculateOverallScore(data: SupplierScorecardData): number {
    const { supplier, metrics } = data
    // Weighted average: delivery 30%, quality 30%, price(rating) 20%, responsiveness 20%
    const deliveryScore = metrics.onTimeDeliveryPct
    const qualityScore = Math.max(0, 100 - metrics.defectRate * 10) // defect rate penalizes
    const priceScore = (supplier.rating / 5) * 100
    const responseScore = Number(supplier.responsiveness) || 50

    return Math.round(
        deliveryScore * 0.3 +
        qualityScore * 0.3 +
        priceScore * 0.2 +
        responseScore * 0.2
    )
}

export function getGrade(score: number): { letter: string; color: string; bg: string } {
    if (score >= 90) return { letter: 'A', color: 'text-emerald-700', bg: 'bg-emerald-100' }
    if (score >= 80) return { letter: 'B', color: 'text-blue-700', bg: 'bg-blue-100' }
    if (score >= 70) return { letter: 'C', color: 'text-amber-700', bg: 'bg-amber-100' }
    if (score >= 60) return { letter: 'D', color: 'text-blue-700', bg: 'bg-blue-100' }
    return { letter: 'F', color: 'text-red-700', bg: 'bg-red-100' }
}

// ==============================================================================
// Component
// ==============================================================================

export function SupplierScorecard({ data }: SupplierScorecardProps) {
    const { supplier, metrics } = data
    const overallScore = calculateOverallScore(data)
    const grade = getGrade(overallScore)

    const radarData = [
        { subject: 'Pengiriman', value: metrics.onTimeDeliveryPct, fullMark: 100 },
        { subject: 'Kualitas', value: Number(supplier.qualityScore) || Math.max(0, 100 - metrics.defectRate * 10), fullMark: 100 },
        { subject: 'Harga', value: (supplier.rating / 5) * 100, fullMark: 100 },
        { subject: 'Responsif', value: Number(supplier.responsiveness) || 50, fullMark: 100 },
        { subject: 'Keandalan', value: metrics.totalPOs > 0 ? Math.round((metrics.completedPOs / metrics.totalPOs) * 100) : 0, fullMark: 100 },
    ]

    const formatIDR = (n: number) => n.toLocaleString('id-ID')

    return (
        <div className="bg-white border border-border shadow-sm">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-zinc-50">
                <div className="flex items-center gap-2">
                    <Award className="h-4 w-4 text-zinc-500" />
                    <span className="text-xs font-semibold text-zinc-500">
                        Scorecard Vendor
                    </span>
                </div>
                <span className="text-xs font-bold text-zinc-400 font-mono">
                    {supplier.code}
                </span>
            </div>

            {/* Supplier name + grade */}
            <div className="px-4 py-3 border-b border-zinc-200 flex items-center justify-between">
                <div>
                    <h3 className="text-sm font-semibold">{supplier.name}</h3>
                    <span className="text-xs text-zinc-400 font-bold">
                        {metrics.totalPOs} PO · {metrics.completedPOs} selesai
                    </span>
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-2xl font-semibold font-mono">{overallScore}</span>
                    <span className={`text-lg font-semibold px-2 py-0.5 border border-border ${grade.bg} ${grade.color}`}>
                        {grade.letter}
                    </span>
                </div>
            </div>

            {/* Radar Chart */}
            <div className="px-4 py-3 border-b border-zinc-200">
                <ResponsiveContainer width="100%" height={220}>
                    <RadarChart data={radarData}>
                        <PolarGrid stroke="#e4e4e7" />
                        <PolarAngleAxis
                            dataKey="subject"
                            tick={{ fontSize: 12, fontWeight: 700, fill: '#71717a' }}
                        />
                        <PolarRadiusAxis
                            angle={90}
                            domain={[0, 100]}
                            tick={{ fontSize: 12 }}
                            tickCount={5}
                        />
                        <Radar
                            name="Skor"
                            dataKey="value"
                            stroke="#18181b"
                            fill="#18181b"
                            fillOpacity={0.15}
                            strokeWidth={2}
                        />
                    </RadarChart>
                </ResponsiveContainer>
            </div>

            {/* Metrics grid */}
            <div className="grid grid-cols-3 divide-x divide-zinc-200">
                <MetricCell
                    icon={<Clock className="h-3.5 w-3.5" />}
                    label="Tepat Waktu"
                    value={`${metrics.onTimeDeliveryPct}%`}
                    color={metrics.onTimeDeliveryPct >= 80 ? 'text-emerald-600' : 'text-amber-600'}
                />
                <MetricCell
                    icon={<ShieldCheck className="h-3.5 w-3.5" />}
                    label="Defect Rate"
                    value={`${metrics.defectRate}%`}
                    color={metrics.defectRate <= 2 ? 'text-emerald-600' : 'text-red-600'}
                />
                <MetricCell
                    icon={<TrendingUp className="h-3.5 w-3.5" />}
                    label="Lead Time"
                    value={`${metrics.avgLeadTimeDays}d`}
                    color="text-zinc-700"
                />
            </div>

            {/* Bottom stats */}
            <div className="px-4 py-2.5 border-t border-border bg-zinc-50 flex items-center justify-between">
                <div className="flex items-center gap-1 text-xs font-bold text-zinc-400">
                    <Package className="h-3 w-3" />
                    Total Spend
                </div>
                <span className="text-xs font-semibold font-mono">
                    Rp {formatIDR(metrics.totalSpend)}
                </span>
            </div>
        </div>
    )
}

function MetricCell({
    icon,
    label,
    value,
    color,
}: {
    icon: React.ReactNode
    label: string
    value: string
    color: string
}) {
    return (
        <div className="px-3 py-2.5 text-center">
            <div className="flex items-center justify-center gap-1 text-zinc-400 mb-1">
                {icon}
                <span className="text-xs font-semibold  ">{label}</span>
            </div>
            <span className={`text-sm font-semibold font-mono ${color}`}>{value}</span>
        </div>
    )
}
