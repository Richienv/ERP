import { describe, it, expect } from 'vitest'
import { Prisma } from '@prisma/client'

describe('Decimal serialization (TypstService replacer)', () => {
    it('Prisma.Decimal.isDecimal correctly identifies Decimal instances', () => {
        const d = new Prisma.Decimal('123.45')
        expect(Prisma.Decimal.isDecimal(d)).toBe(true)
        expect(Prisma.Decimal.isDecimal(123)).toBe(false)
        expect(Prisma.Decimal.isDecimal('123')).toBe(false)
        expect(Prisma.Decimal.isDecimal(null)).toBe(false)
        expect(Prisma.Decimal.isDecimal({})).toBe(false)
    })

    it('JSON.stringify with replacer serializes Decimal as string', () => {
        const d = new Prisma.Decimal('99.99')
        const result = JSON.stringify({ amount: d, nested: { tax: new Prisma.Decimal('11.11') } }, (_k, v) =>
            Prisma.Decimal.isDecimal(v) ? v.toString() : v
        )
        expect(result).toBe('{"amount":"99.99","nested":{"tax":"11.11"}}')
    })

    it('non-Decimal values pass through unchanged', () => {
        const result = JSON.stringify(
            { name: 'Test', count: 5, active: true, tags: ['a', 'b'] },
            (_k, v) => (Prisma.Decimal.isDecimal(v) ? v.toString() : v),
        )
        expect(result).toBe('{"name":"Test","count":5,"active":true,"tags":["a","b"]}')
    })
})
