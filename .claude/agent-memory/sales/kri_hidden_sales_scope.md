---
name: KRI mining edition hides the sales pipeline
description: Sales/POS/manufacturing are flagged off for KRI — what that means for customer master, invoicing, and any future sales work in this repo
type: project
---

The mining edition (KRI) runs with `MODULE_FLAGS.sales`, `pos`, and `manufacturing`
set to false, so quotations, leads, sales orders, POS, and work orders are
unreachable. Customers are still first-class: they are billed from Finance
(`/finance/invoices`), and `/api/sales/customers` is the only customer read API
left in use (global search + Finance depend on it).

**Why:** KRI's B2B rental/service flow does not use a quote→SO→invoice pipeline,
so the generic sales module was hidden rather than deleted — other tenants may
turn it back on via `ENABLED_MODULES`.

**How to apply:**
- Do not rebuild or "restore" sales features for KRI. Anything sales-shaped needs
  to justify itself against Finance-first invoicing.
- Any new work must keep hidden modules from costing anything: no queries behind
  gated cards, no prefetch, no palette entries, no links into hidden routes.
- Known product gap (not a bug to fix silently): KRI has **no customer master
  page**. Customers can only be created through the quick-create inside the
  "Buat Invoice" dialog, and there is no list/edit screen. If the user asks for
  customer management, this is the gap to fill — likely under Finance, not
  `/sales/customers`.
- Changes must stay reversible for tenants with sales enabled: filter at the
  render/query site, keep the underlying registry/action/route intact.
