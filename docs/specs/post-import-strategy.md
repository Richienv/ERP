# Post-Import Strategy: Bridging Blueprint to Reality

**The Challenge**: We have a visual Diagram (the Blueprint), but the System is still generic.
**The Goal**: Turn the "Diagram" into "Operational Configuration" instantly.

Here are 3 Strategic Directions, inspired by how **SAP**, **Odoo**, and **Celonis** handle this.

---

## 1. The "Instant Setup" (Configuration Bridge)
**Concept**: If the Blueprint doesn't use it, the System shouldn't show it.
**Inspiration**: **Odoo** (Module Installation) / **SAP** (Model Companies).

*   **How it works**:
    *   The Parser analyzes the `Mapped_Module_Key` column.
    *   *Result*: It detects "Sales", "Inventory", "Finance". It detects **absence** of "HR", "Manufacturing".
    *   **Action**: The System automatically **disables/hides** the HR and Manufacturing sidebar items.
*   **Business Value**:
    *   **Zero Bloat**: The client sees *exactly* what they defined.
    *   **"Custom-Fit" Feeling**: The ERP feels tailored to them in seconds.

## 2. Role & Permission Auto-Provisioning
**Concept**: The Blueprint defines *Who* does *What*. The System should enforce this.
**Inspiration**: **Salesforce** (Profile Mapping).

*   **How it works**:
    *   The Parser reads the `Role` column (e.g., "Warehouse Supervisor").
    *   **Action 1**: Check if `Role` exists in DB. If not, **Create "Warehouse Supervisor"**.
    *   **Action 2 (Advanced)**: Read `Action`. If Action is "Approve", automatically assign `PERMISSION_APPROVE` to that Role.
*   **Business Value**:
    *   **Security by Design**: Permissions match the process exactly.
    *   **Speed**: Saves hours of manual user setup.

## 3. The "Live Process" Dashboard (Process Mining Lite)
**Concept**: Don't just show the map during setup. Make it the **Main Dashboard**.
**Inspiration**: **Celonis** / **SAP Signavio**.

*   **How it works**:
    *   Embed the Diagram on the Dashboard.
    *   **Live Overlay**: Query the DB for the number of active items at each step.
        *   *Step [Approve Order]* -> Show Badge: 🔴 **"5 Pending"**
        *   *Step [Ship Order]* -> Show Badge: 🟢 **"120 Shipped"**
*   **Business Value**:
    *   **Executive Visibility**: The CEO sees the *flow* of money/goods, not just static tables.
    *   **Bottleneck Detection**: If "Check Stock" has 50 items pending, they know exactly where the problem is.

---

## Technical Recommendation (Next Steps)

I recommend implementing **Option 1 (Configuration)** and **Option 2 (Role Provisioning)** immediately, as they are pure logic extensions of what we just built.

**Option 3 (Live Dashboard)** is the "Killer Feature" that distinguishes you from standard ERPs, but requires significant frontend work (binding DB counts to Mermaid nodes).

### Proposed Action Plan
1.  **Add `required_modules`** output to the Parser.
2.  **Create a `WorkflowContext`** that controls Sidebar visibility based on the imported file.
3.  **Auto-Create Roles** upon import confirmation.
