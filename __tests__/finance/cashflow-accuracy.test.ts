import { describe, it, expect } from "vitest"

describe("accuracy calculation", () => {
    it("returns 100% accuracy when plan matches actual exactly", () => {
        const planned = 1000000
        const actual = 1000000
        const variance = ((actual - planned) / planned) * 100
        const accuracy = Math.max(0, 100 - Math.abs(variance))
        expect(accuracy).toBe(100)
    })

    it("returns 90% accuracy when 10% off", () => {
        const planned = 1000000
        const actual = 1100000
        const variance = ((actual - planned) / planned) * 100
        const accuracy = Math.max(0, 100 - Math.abs(variance))
        expect(accuracy).toBe(90)
    })

    it("returns 0% accuracy when >100% off", () => {
        const planned = 1000000
        const actual = 2100000
        const variance = ((actual - planned) / planned) * 100
        const accuracy = Math.max(0, 100 - Math.abs(variance))
        expect(accuracy).toBe(0)
    })

    it("handles zero planned gracefully", () => {
        const planned = 0
        const actual = 500000
        const variance = planned === 0 ? null : ((actual - planned) / planned) * 100
        expect(variance).toBeNull()
    })
})
