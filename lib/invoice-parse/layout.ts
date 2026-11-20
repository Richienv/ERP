import type { Box, TextItem } from "./types"

/**
 * Turns loose positioned text items into lines and cells.
 * A "cell" is a run of items on one line with no big horizontal gap between them.
 */

export type Cell = {
    text: string
    x: number
    x2: number
    y: number
    h: number
    page: number
}

export type Line = {
    page: number
    /** Baseline y of the line (top-left origin). */
    y: number
    h: number
    cells: Cell[]
    text: string
}

function median(values: number[]): number {
    if (values.length === 0) return 0
    const sorted = [...values].sort((a, b) => a - b)
    return sorted[Math.floor(sorted.length / 2)]
}

export function cellBox(cell: Cell): Box {
    return { page: cell.page, x: cell.x, y: cell.y - cell.h, w: cell.x2 - cell.x, h: cell.h * 1.25 }
}

export function lineBox(line: Line): Box {
    const x = Math.min(...line.cells.map((c) => c.x))
    const x2 = Math.max(...line.cells.map((c) => c.x2))
    return { page: line.page, x, y: line.y - line.h, w: x2 - x, h: line.h * 1.25 }
}

/** Group items into lines (same page, baselines within tolerance), then into cells. */
export function buildLines(items: TextItem[]): Line[] {
    const clean = items.filter((it) => it.str && it.str.trim().length > 0)
    if (clean.length === 0) return []
    const typicalH = median(clean.map((it) => it.h)) || 10
    const tolerance = Math.max(1.5, typicalH * 0.35)

    const sorted = [...clean].sort((a, b) => a.page - b.page || a.y - b.y || a.x - b.x)
    const groups: TextItem[][] = []
    for (const item of sorted) {
        const last = groups[groups.length - 1]
        if (last && last[0].page === item.page && Math.abs(last[0].y - item.y) <= tolerance) {
            last.push(item)
        } else {
            groups.push([item])
        }
    }

    return groups.map((group) => {
        const byX = [...group].sort((a, b) => a.x - b.x)
        const h = median(byX.map((it) => it.h)) || typicalH
        const gapLimit = Math.max(3, h * 0.85)
        const cells: Cell[] = []
        for (const item of byX) {
            const prev = cells[cells.length - 1]
            const gap = prev ? item.x - prev.x2 : Infinity
            // A different font size on the same baseline is a different block (e.g. company name + document title).
            const sameSize = prev ? Math.abs((item.h || h) - prev.h) <= Math.max(prev.h, item.h || h) * 0.12 : false
            const solid = item.solid || (prev && byX[byX.indexOf(item) - 1]?.solid)
            if (prev && gap <= gapLimit && sameSize && !solid) {
                const joiner = gap > h * 0.15 && !prev.text.endsWith(" ") && !item.str.startsWith(" ") ? " " : ""
                prev.text += joiner + item.str
                prev.x2 = Math.max(prev.x2, item.x + item.w)
            } else {
                cells.push({ text: item.str, x: item.x, x2: item.x + item.w, y: item.y, h: item.h || h, page: item.page })
            }
        }
        for (const cell of cells) cell.text = cell.text.replace(/\s+/g, " ").trim()
        const nonEmpty = cells.filter((c) => c.text.length > 0)
        return {
            page: group[0].page,
            y: median(group.map((it) => it.y)),
            h,
            cells: nonEmpty,
            text: nonEmpty.map((c) => c.text).join("  "),
        }
    }).filter((line) => line.cells.length > 0)
}

/** Lower-case, strip punctuation/brackets, collapse spaces. Used for vocabulary matching. */
export function normaliseLabel(text: string): string {
    return text
        .toLowerCase()
        .replace(/\(.*?\)|\[.*?\]/g, " ")
        .replace(/[：:.#'’/\\_-]/g, " ")
        .replace(/\s+/g, " ")
        .trim()
}
