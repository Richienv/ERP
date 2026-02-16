import { describe, it, expect } from 'vitest'
import { calculateOEE } from '@/lib/dashboard-textile-helpers'

describe('OEE Calculation', () => {
    it('should calculate world-class OEE correctly', () => {
        const result = calculateOEE({
            scheduledMinutes: 480, // 8 hours
            downtimeMinutes: 24,  // 5% downtime
            totalProduced: 450,
            theoreticalCapacity: 480,
            defects: 5,
        })

        // Availability: (480-24)/480 = 95%
        expect(result.availability).toBe(95)
        // Performance: 450/480 = 93.8%
        expect(result.performance).toBe(93.8)
        // Quality: (450-5)/450 = 98.9%
        expect(result.quality).toBe(98.9)
        // OEE: 0.95 * 0.938 * 0.989 = 88.1%
        expect(result.oee).toBeGreaterThan(85)
        expect(result.oee).toBeLessThan(95)
    })

    it('should handle zero scheduled time', () => {
        const result = calculateOEE({
            scheduledMinutes: 0,
            downtimeMinutes: 0,
            totalProduced: 0,
            theoreticalCapacity: 0,
            defects: 0,
        })

        expect(result.availability).toBe(0)
        expect(result.performance).toBe(0)
        expect(result.quality).toBe(0)
        expect(result.oee).toBe(0)
    })

    it('should handle 100% downtime', () => {
        const result = calculateOEE({
            scheduledMinutes: 480,
            downtimeMinutes: 480,
            totalProduced: 0,
            theoreticalCapacity: 480,
            defects: 0,
        })

        expect(result.availability).toBe(0)
        expect(result.oee).toBe(0)
        expect(result.totalDowntimeMinutes).toBe(480)
    })

    it('should handle all defects', () => {
        const result = calculateOEE({
            scheduledMinutes: 480,
            downtimeMinutes: 0,
            totalProduced: 100,
            theoreticalCapacity: 100,
            defects: 100,
        })

        expect(result.availability).toBe(100)
        expect(result.performance).toBe(100)
        expect(result.quality).toBe(0)
        expect(result.oee).toBe(0)
    })

    it('should cap performance at 100%', () => {
        const result = calculateOEE({
            scheduledMinutes: 480,
            downtimeMinutes: 0,
            totalProduced: 600,
            theoreticalCapacity: 480,
            defects: 0,
        })

        expect(result.performance).toBe(100)
    })

    it('should calculate typical factory scenario', () => {
        // Typical textile factory: 8h shift, 45min downtime, 85% performance, 2% defects
        const result = calculateOEE({
            scheduledMinutes: 480,
            downtimeMinutes: 45,
            totalProduced: 370,
            theoreticalCapacity: 435, // theoretical for 435 min of run time
            defects: 8,
        })

        // Availability: (480-45)/480 = 90.6%
        expect(result.availability).toBeGreaterThan(90)
        expect(result.availability).toBeLessThan(91)
        // Performance: 370/435 = 85.1%
        expect(result.performance).toBeGreaterThan(84)
        expect(result.performance).toBeLessThan(86)
        // Quality: (370-8)/370 = 97.8%
        expect(result.quality).toBeGreaterThan(97)
        expect(result.quality).toBeLessThan(99)
        // OEE should be around 75%
        expect(result.oee).toBeGreaterThan(70)
        expect(result.oee).toBeLessThan(80)
    })

    it('should return correct raw values', () => {
        const result = calculateOEE({
            scheduledMinutes: 960,
            downtimeMinutes: 120,
            totalProduced: 800,
            theoreticalCapacity: 900,
            defects: 20,
        })

        expect(result.totalScheduledMinutes).toBe(960)
        expect(result.totalDowntimeMinutes).toBe(120)
        expect(result.totalProduced).toBe(800)
        expect(result.totalDefects).toBe(20)
    })

    it('should handle negative downtime gracefully', () => {
        const result = calculateOEE({
            scheduledMinutes: 480,
            downtimeMinutes: -10, // data error
            totalProduced: 100,
            theoreticalCapacity: 100,
            defects: 0,
        })

        // runTime = max(480 - (-10), 0) = 490, but availability can't exceed the formula
        // availability = (480-(-10))/480 = 490/480 = ~102%
        // This is a data integrity issue; the function should still not crash
        expect(result.availability).toBeGreaterThan(100)
        expect(result.oee).toBeGreaterThan(0)
    })
})
