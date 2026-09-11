import { describe, expect, it } from "vitest"
import { isLocalDemoAllowed, isLocalDemoUiEnabled } from "@/lib/local-demo"

describe("isLocalDemoAllowed", () => {
    it("requires the explicit flag and rejects production / Vercel", () => {
        expect(isLocalDemoAllowed({
            ALLOW_LOCAL_DEMO: "1",
            NODE_ENV: "development",
        })).toBe(true)

        expect(isLocalDemoAllowed({
            ALLOW_LOCAL_DEMO: "1",
            NODE_ENV: "production",
        })).toBe(false)

        expect(isLocalDemoAllowed({
            ALLOW_LOCAL_DEMO: "1",
            NODE_ENV: "development",
            VERCEL: "1",
        })).toBe(false)

        expect(isLocalDemoAllowed({
            ALLOW_LOCAL_DEMO: "0",
            NODE_ENV: "development",
        })).toBe(false)
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
