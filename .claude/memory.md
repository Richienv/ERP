# Claude Code Memory

## Session Patterns & Workflows

### Full-Page Audit System (Parallel Agent Bug Sweep)

We have an established workflow for systematically auditing every page in a module using parallel agents. This has been done previously on **Finance** and **Inventory** modules.

#### How It Works

1. **Identify all pages** in the target module (e.g., `/inventory/products`, `/inventory/stock`, `/inventory/warehouses/[id]`, etc.) — including all sub-pages, detail pages, and dialog/modal flows.

2. **Dispatch parallel agents** (one per page or page group) to check:
   - **Buttons & actions**: Every button, link, and interactive element actually works (not just visual)
   - **Forms & dialogs**: Can save, edit, create, delete from popups/sheets/dialogs — full CRUD validation
   - **Data integrity**: No static/hardcoded/mock data — everything pulls from the database
   - **Cross-page data flow**: Data saved on one page appears correctly on related pages (e.g., a product created in inventory shows in procurement dropdowns)
   - **Backend connectivity**: Server actions, API routes, and database queries are wired up and returning real data
   - **Error handling**: Forms show proper validation errors, loading states work, empty states are handled
   - **Navigation**: Links between pages work, breadcrumbs are correct, back navigation functions

3. **Each agent reports findings** in a structured format:
   - Page/component checked
   - What works correctly
   - What is broken or blocked
   - What uses static/mock data instead of real database data
   - What actions are non-functional (dead buttons, unconnected forms)

4. **Create a consolidated fix plan** with these columns:
   | What to Change | Why It Needs Changing | Why It's Important | How to Verify the Fix |
   |---|---|---|---|
   | Description of the issue | Root cause explanation | User/business impact | Steps to confirm it works |

5. **Execute fixes** — prioritized by severity (blocking issues first, then data integrity, then UX polish).

#### Modules Already Audited
- Finance (completed)
- Inventory (completed)

#### Modules Pending Audit
- Sales & CRM
- Procurement
- Manufacturing
- HCM
- Dashboard
- Documents
- Settings

#### Key Principles
- **No visual-only pages**: Every page must be functional, not just look good
- **No static data**: All displayed data must come from the database
- **Full action coverage**: If a button exists, it must do something real
- **Cross-module validation**: Data flows between modules must work end-to-end
- **Parallel execution**: Agents run simultaneously for speed — one agent per page or page group
