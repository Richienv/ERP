import { afterEach, describe, expect, it } from "vitest"
import { isLocalDemoAllowed, isLocalDemoUiEnabled } from "@/lib/local-demo"

const KEYS = ["ALLOW_LOCAL_DEMO", "NODE_ENV", "VERCEL"] as const

const original = Object.fromEntries(KEYS.map((key) => [key, process.env[key]]))

afterEach(() => {
    for (const key of KEYS) {
        if (original[key] === undefined) delete process.env[key]
        else process.env[key] = original[key]
    }
})

describe("isLocalDemoAllowed", () => {
    it("requires the explicit flag and rejects production / Vercel", () => {
        process.env.ALLOW_LOCAL_DEMO = "1"
        process.env.NODE_ENV = "development"
        delete process.env.VERCEL
        expect(isLocalDemoAllowed()).toBe(true)

        process.env.NODE_ENV = "production"
        expect(isLocalDemoAllowed()).toBe(false)

        process.env.NODE_ENV = "development"
        process.env.VERCEL = "1"
        expect(isLocalDemoAllowed()).toBe(false)

        delete process.env.VERCEL
        process.env.ALLOW_LOCAL_DEMO = "0"
        expect(isLocalDemoAllowed()).toBe(false)
    })

    it("exposes a compile-time UI flag separate from the server gate", () => {
        const previous = process.env.NEXT_PUBLIC_ALLOW_LOCAL_DEMO
        process.env.NEXT_PUBLIC_ALLOW_LOCAL_DEMO = "1"
        expect(isLocalDemoUiEnabled()).toBe(true)
        process.env.NEXT_PUBLIC_ALLOW_LOCAL_DEMO = "0"
        expect(isLocalDemoUiEnabled()).toBe(false)
        if (previous === undefined) delete process.env.NEXT_PUBLIC_ALLOW_LOCAL_DEMO
        else process.env.NEXT_PUBLIC_ALLOW_LOCAL_DEMO = previous
    })
})
