import { describe, it, expect } from "vitest"
import { isDraftNewer, serializeDraft, deserializeDraft, type DraftState } from "@/app/manufacturing/bom/[id]/hooks/use-auto-save"

describe("isDraftNewer", () => {
  it("returns true when draft timestamp is newer than server updatedAt", () => {
    const draftTs = new Date("2026-03-11T10:05:00Z").getTime()
    const serverTs = new Date("2026-03-11T10:00:00Z")
    expect(isDraftNewer(draftTs, serverTs)).toBe(true)
  })

  it("returns false when server is newer", () => {
    const draftTs = new Date("2026-03-11T09:00:00Z").getTime()
    const serverTs = new Date("2026-03-11T10:00:00Z")
    expect(isDraftNewer(draftTs, serverTs)).toBe(false)
  })

  it("returns false when timestamps are equal", () => {
    const ts = new Date("2026-03-11T10:00:00Z")
    expect(isDraftNewer(ts.getTime(), ts)).toBe(false)
  })
})

describe("serializeDraft / deserializeDraft", () => {
  it("round-trips draft state correctly", () => {
    const draft: DraftState = {
      items: [{ id: "1", materialId: "m1", quantityPerUnit: 2, wastePct: 5, material: { id: "m1", code: "C", name: "Kain", unit: "m" }, stepMaterials: [] }],
      steps: [],
      totalQty: 100,
      savedAt: 1741700000000,
    }
    const serialized = serializeDraft(draft)
    const deserialized = deserializeDraft(serialized)
    expect(deserialized?.totalQty).toBe(100)
    expect(deserialized?.items[0].materialId).toBe("m1")
    expect(deserialized?.savedAt).toBe(1741700000000)
  })

  it("returns null for invalid JSON", () => {
    expect(deserializeDraft("not-json")).toBeNull()
  })

  it("returns null for JSON missing required fields", () => {
    expect(deserializeDraft('{"foo":"bar"}')).toBeNull()
  })
})
