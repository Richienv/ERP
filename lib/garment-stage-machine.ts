import { GarmentStage } from "@prisma/client"

/**
 * Garment Stage State Machine
 *
 * Production flow: CUTTING → SEWING → FINISHING → QC → PACKING → DONE
 *
 * Each stage can only transition forward or back one step (for rework).
 */

export const STAGE_ORDER: GarmentStage[] = [
    'CUTTING',
    'SEWING',
    'FINISHING',
    'QC',
    'PACKING',
    'DONE',
]

export const STAGE_LABELS: Record<GarmentStage, string> = {
    CUTTING: 'Potong',
    SEWING: 'Jahit',
    FINISHING: 'Finishing',
    QC: 'Quality Control',
    PACKING: 'Packing',
    DONE: 'Selesai',
}

export const STAGE_COLORS: Record<GarmentStage, { bg: string; text: string; accent: string }> = {
    CUTTING: { bg: 'bg-amber-100', text: 'text-amber-700', accent: 'bg-amber-500' },
    SEWING: { bg: 'bg-blue-100', text: 'text-blue-700', accent: 'bg-blue-500' },
    FINISHING: { bg: 'bg-violet-100', text: 'text-violet-700', accent: 'bg-violet-500' },
    QC: { bg: 'bg-emerald-100', text: 'text-emerald-700', accent: 'bg-emerald-500' },
    PACKING: { bg: 'bg-orange-100', text: 'text-orange-700', accent: 'bg-orange-500' },
    DONE: { bg: 'bg-zinc-100', text: 'text-zinc-700', accent: 'bg-zinc-900' },
}

/** Allowed forward transitions (normal flow) */
const FORWARD_TRANSITIONS: Record<GarmentStage, GarmentStage | null> = {
    CUTTING: 'SEWING',
    SEWING: 'FINISHING',
    FINISHING: 'QC',
    QC: 'PACKING',
    PACKING: 'DONE',
    DONE: null,
}

/** Allowed rework transitions (back one step for QC failures) */
const REWORK_TRANSITIONS: Partial<Record<GarmentStage, GarmentStage>> = {
    QC: 'FINISHING',      // QC fail → back to finishing
    FINISHING: 'SEWING',  // Finishing rework → back to sewing
}

export function getNextStage(current: GarmentStage): GarmentStage | null {
    return FORWARD_TRANSITIONS[current]
}

export function getReworkStage(current: GarmentStage): GarmentStage | null {
    return REWORK_TRANSITIONS[current] ?? null
}

export function getAllowedTransitions(current: GarmentStage): GarmentStage[] {
    const transitions: GarmentStage[] = []

    const next = getNextStage(current)
    if (next) transitions.push(next)

    const rework = getReworkStage(current)
    if (rework) transitions.push(rework)

    return transitions
}

export function assertStageTransition(current: GarmentStage, next: GarmentStage): void {
    const allowed = getAllowedTransitions(current)
    if (!allowed.includes(next)) {
        throw new Error(
            `Transisi stage tidak valid: ${STAGE_LABELS[current]} → ${STAGE_LABELS[next]}. ` +
            `Yang diperbolehkan: ${allowed.map(s => STAGE_LABELS[s]).join(', ') || 'tidak ada'}`
        )
    }
}

export function getStageIndex(stage: GarmentStage): number {
    return STAGE_ORDER.indexOf(stage)
}

export function getStageProgress(stage: GarmentStage): number {
    const idx = getStageIndex(stage)
    return Math.round(((idx + 1) / STAGE_ORDER.length) * 100)
}

export function isTerminal(stage: GarmentStage): boolean {
    return stage === 'DONE'
}

export function isRework(current: GarmentStage, next: GarmentStage): boolean {
    return getStageIndex(next) < getStageIndex(current)
}
