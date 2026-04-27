import { test, expect } from "@playwright/test"

// IMPORTANT: This test assumes:
// 1. Dev server is running (auto-spawned by Playwright config)
// 2. Demo seed data has been loaded (npx tsx prisma/seed-kri-demo.ts)
// 3. Auth is bypassed OR test login credentials work
//
// For now, the test starts at /procurement/orders directly assuming
// either Supabase auth cookie is pre-set or middleware allows test.
//
// If the middleware redirects to /login, set up an authenticated
// storageState (see https://playwright.dev/docs/auth) before running:
//   npx playwright codegen --save-storage=auth.json http://localhost:3000/login
// Then add storageState: "auth.json" to use{} in playwright.config.ts.

test.describe("Demo Journey — Procurement Flagship", () => {
    test("end-to-end: list → filter → detail → approve → print", async ({ page }) => {
        // 1. Navigate to PO list
        await page.goto("/procurement/orders")
        // Note: if redirected to /login, tests need auth setup. For demo prep, manually
        // login first OR add NEXT_PUBLIC_E2E_BYPASS_AUTH env var support to middleware.

        await expect(page).toHaveURL(/\/procurement\/orders/)
        await expect(page.locator("h1, h2, [class*='font-display']").first()).toContainText(/Pesanan Pembelian/i)

        // 2. Search for "PT" (broad filter for any vendor)
        const searchInput = page.locator('input[placeholder*="Cari"]').first()
        await searchInput.fill("PT")
        await page.waitForTimeout(400) // debounce 300ms
        await expect(page.locator("table tbody tr").first()).toBeVisible()

        // 3. Open Filter panel
        await page.locator('button:has-text("Filter")').first().click()
        await expect(page.locator("[data-filter-panel]")).toBeVisible()

        // 4. Pick a status (Disetujui)
        await page.locator('label:has-text("Disetujui")').click()
        await page.locator('button:has-text("Terapkan")').click()

        // Wait for filter to apply
        await page.waitForTimeout(500)

        // 5. Click first row → detail page
        const firstRow = page.locator("table tbody tr").first()
        await firstRow.click()
        await expect(page).toHaveURL(/\/procurement\/orders\/[a-f0-9-]+/)

        // 6. Verify detail page tabs visible
        await expect(page.locator('[role="tab"]:has-text("Header")')).toBeVisible()
        await expect(page.locator('[role="tab"]:has-text("Item")')).toBeVisible()
        await expect(page.locator('[role="tab"]:has-text("Approval")')).toBeVisible()
        await expect(page.locator('[role="tab"]:has-text("History")')).toBeVisible()

        // 7. Switch to History tab
        await page.locator('[role="tab"]:has-text("History")').click()
        await expect(page).toHaveURL(/#history/)

        // 8. Switch to Approval tab
        await page.locator('[role="tab"]:has-text("Approval")').click()
        await expect(page).toHaveURL(/#approval/)
        await expect(page.locator("text=Alur Approval").first()).toBeVisible()

        // 9. Verify Print PDF button visible
        await expect(page.locator('button:has-text("Print PDF")')).toBeVisible()

        // 10. Back to list, verify keyboard shortcuts work
        await page.goBack()
        await page.keyboard.press("?")
        await expect(page.locator("text=Pintasan Keyboard")).toBeVisible()
        await page.keyboard.press("Escape")

        // 11. Test bulk select
        const checkboxes = page.locator('table tbody tr input[type="checkbox"]')
        const count = await checkboxes.count()
        if (count > 0) {
            await checkboxes.nth(0).check()
            await expect(page.locator("[data-bulk-toolbar]")).toBeVisible()
            await expect(page.locator("[data-bulk-toolbar]")).toContainText(/dipilih/)
        }
    })
})
