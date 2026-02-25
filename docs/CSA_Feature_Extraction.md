# CSA Software Help Manual — Complete Feature Extraction (Pages 100-250)

> Exhaustive listing of every feature, function, report, utility, parameter, menu item, sub-function, field, and master data item.
> Extracted from: CSA_Software_Help_Manual.pdf, pages 100-250.

---

## 1. PURCHASE ORDERS MODULE

### 1.1 PO Entry
- **Menu**: Purchase Orders > PO Entry
- **Header Fields**:
  - PO Number (auto-generated or manual)
  - Vendor Number (lookup)
  - Vendor Name (auto-filled)
  - Ship To (address selection)
  - PO Date
  - Required Date
  - Terms Code (dropdown)
  - FOB Point
  - Ship Via (carrier selection)
  - Buyer Code
  - Confirm To
  - Comments/Notes
- **Line Item Fields**:
  - Line Number
  - Item Number (lookup from Inventory)
  - Description (auto-filled, editable)
  - Quantity Ordered
  - Unit of Measure (UM)
  - Unit Price
  - Extension (calculated: Qty x Price)
  - Due Date (per line)
  - GL Account (default from item or manual)
  - Job Number
  - Received Quantity (display)
  - Open Quantity (calculated)
- **Functions**:
  - Add new PO
  - Edit existing PO
  - Delete PO
  - Copy PO
  - Add/Edit/Delete line items
  - Vendor lookup (search by number, name)
  - Item lookup (search by number, description)
  - Calculate PO total
  - Print PO from entry screen
  - Place PO on hold
  - Close PO
  - Cancel PO

### 1.2 PO Print / Reprint
- **Menu**: Purchase Orders > Print POs
- **Parameters**:
  - PO Number range (From/To)
  - Vendor range (From/To)
  - Print Date
  - Number of copies
  - Reprint previously printed POs (checkbox)
  - Print alignment test
- **Output**: Formatted PO document with header, line items, totals

### 1.3 PO Receipt Entry
- **Menu**: Purchase Orders > Receipt Entry
- **Fields**:
  - Receipt Number (auto-generated)
  - PO Number (lookup)
  - Vendor Number (auto-filled from PO)
  - Receipt Date
  - Packing Slip Number
  - Freight Amount
  - Tax Amount
- **Line Item Fields**:
  - Item Number (from PO)
  - Description
  - Quantity Ordered (display from PO)
  - Quantity Previously Received (display)
  - Quantity Received (this receipt)
  - Unit Cost
  - GL Account
  - Warehouse/Location
- **Functions**:
  - Receive full PO
  - Partial receipt
  - Over-receipt (with warning)
  - Auto-create AP invoice from receipt
  - Update inventory quantities on posting
  - Update item costs (Average, Last)
  - Close PO line on full receipt
  - Reject/return items

### 1.4 PO Reports
- **Purchase Order Listing**
  - Parameters: PO range, Vendor range, Date range, Status filter (Open/Closed/All)
  - Output: PO number, vendor, date, total, status, line details
- **Open PO Report**
  - Parameters: Vendor range, Buyer range, Due date range
  - Output: All open POs with quantities ordered, received, open
- **PO Receipt Register**
  - Parameters: Date range, Vendor range
  - Output: Receipts posted, quantities, costs, GL distributions
- **Purchase History Report**
  - Parameters: Item range, Vendor range, Date range
  - Output: Purchase history by item/vendor with quantities and costs
- **Vendor Purchase Analysis**
  - Parameters: Vendor range, Date range
  - Output: Total purchases by vendor, item breakdown

---

## 2. INVENTORY MODULE

### 2.1 Item Maintenance
- **Menu**: Inventory > Item Maintenance
- **Fields**:
  - Item Number (primary key, alphanumeric)
  - Description (primary)
  - Extended Description / Secondary Description
  - Product Class / Category
  - Item Type (Stock, Non-Stock, Service, Kit)
  - Unit of Measure (UM) - Stocking
  - Unit of Measure - Purchasing
  - Unit of Measure - Selling
  - UM Conversion Factor
  - Standard Cost
  - Average Cost (system-calculated)
  - Last Cost (from last PO receipt)
  - List Price / Selling Price
  - Price Levels (Price 1 through Price 5 or more)
  - Weight
  - Buyer Code
  - Primary Vendor Number
  - Vendor Item Number
  - Lead Time (days)
  - Reorder Point (ROP)
  - Reorder Quantity (ROQ) / Economic Order Quantity
  - Safety Stock
  - ABC Classification (A, B, C)
  - Lot Tracked (Yes/No)
  - Serial Number Tracked (Yes/No)
  - Taxable (Yes/No)
  - GL Account - Inventory Asset
  - GL Account - COGS
  - GL Account - Sales Revenue
  - GL Account - Purchase Variance
  - Warehouse / Default Location
  - Bin Location
  - Quantity On Hand (display, system-maintained)
  - Quantity On Order (display, from open POs)
  - Quantity Committed / Allocated (display, from open SOs)
  - Quantity Available (calculated: On Hand - Committed + On Order)
  - Last Sale Date
  - Last Receipt Date
  - Year-to-Date Sales Quantity
  - Year-to-Date Sales Amount
  - Year-to-Date Purchase Quantity
  - Year-to-Date Purchase Amount
  - Date Created
  - Last Modified Date
  - Status (Active/Inactive)
  - Notes/Comments
- **Functions**:
  - Add new item
  - Edit item
  - Delete item (with dependency check)
  - Copy item
  - Item inquiry (view without edit)
  - Search/lookup by number, description, vendor, class
  - View transaction history
  - View where-used (BOM)
  - Print item label
  - Mass update (price, class, status)

### 2.2 Inventory Transactions
- **Menu**: Inventory > Transactions
- **Transaction Types**:
  - **Issue** (reduce stock): Item Number, Quantity, UM, Unit Cost, GL Account, Reference, Date, Warehouse, Bin
  - **Receipt** (increase stock - manual, non-PO): Item Number, Quantity, UM, Unit Cost, GL Account, Reference, Date, Warehouse, Bin
  - **Transfer** (move between warehouses/locations): Item Number, Quantity, From Warehouse, From Bin, To Warehouse, To Bin, Reference, Date
  - **Adjustment** (correct quantity/cost): Item Number, Quantity (+/-), UM, Unit Cost, GL Account, Reference, Reason Code, Date
- **Common Fields**:
  - Transaction Number (auto-generated)
  - Transaction Date
  - Reference / Document Number
  - Lot Number (if lot tracked)
  - Serial Number (if serial tracked)
  - Notes
- **Functions**:
  - Enter single transaction
  - Batch entry (multiple items)
  - Post transactions (updates inventory, GL)
  - Print transaction register
  - Reverse/correct posted transactions

### 2.3 Physical Inventory Processing
- **Menu**: Inventory > Physical Inventory
- **Steps/Functions**:
  1. **Generate Count Sheets**: Parameters: Item range, Product Class range, Warehouse, Location/Bin range, ABC Class filter. Options: Include zero-quantity items, Freeze inventory (snapshot), Print by location sequence
  2. **Print Count Sheets / Tags**: Output: Formatted count sheets with Item Number, Description, Location, Bin, blank count field. Options: Blind count (hide system quantity) or show system quantity
  3. **Enter Physical Counts**: Fields: Item Number, Location, Count Quantity, UM, Lot/Serial (if tracked), Count Date, Counted By
  4. **Variance Report**: Output: Items with discrepancies - Item, Description, System Qty, Count Qty, Variance Qty, Variance Value, Variance %. Options: Print all items or only variances, Tolerance threshold
  5. **Post Physical Inventory**: Updates system quantities to counted quantities, Creates adjustment transactions, Creates GL entries for inventory adjustments
  6. **Unfreeze Inventory**: Releases frozen quantities after posting

### 2.4 Inventory Reports
- **Inventory Valuation Report**: Parameters: Item range, Product Class range, Warehouse, Valuation method (Standard/Average/Last/FIFO/LIFO), As-of date. Output: Item, Description, Qty On Hand, Unit Cost, Extended Value, totals by class/warehouse/grand total
- **Inventory Status Report**: Parameters: Item range, Product Class, Warehouse, Status filter. Output: Item, Description, On Hand, On Order, Committed, Available, Reorder Point, Reorder Qty
- **Reorder Report / Suggested Purchase Orders**: Parameters: Item range, Buyer range, Vendor range. Output: Items below reorder point. Option: Auto-generate POs from reorder suggestions
- **Item Listing / Master File Report**: Parameters: Item range, Product Class, Sort by (Number/Description/Class/Vendor). Output: Complete item master data listing
- **Transaction History Report**: Parameters: Item range, Date range, Transaction type filter. Output: All inventory transactions
- **Slow Moving / Obsolete Inventory Report**: Parameters: Item range, No-activity threshold (days), Product Class. Output: Items with no transactions within threshold
- **ABC Analysis Report**: Parameters: Analysis basis (Sales Value, Usage Value, Cost Value), Date range. Output: Items ranked and classified A/B/C with cumulative percentages
- **Serial/Lot Number Tracking Report**: Parameters: Item range, Lot/Serial number range. Output: Where items are located, transaction history by lot/serial

### 2.5 Price List Maintenance
- **Menu**: Inventory > Price List
- **Fields**:
  - Item Number
  - Price Level (1-5 or named levels)
  - Price Amount
  - Discount Percent (from List Price)
  - Quantity Break levels (Qty From, Qty To, Price)
  - Effective Date / Expiration Date
  - Currency Code
- **Functions**:
  - Maintain multiple price levels per item
  - Quantity break pricing
  - Customer-specific pricing (linked to Customer)
  - Mass price update (by percentage or amount)
  - Print price list / catalog

---

## 3. BILL OF MATERIALS (BOM) MODULE

### 3.1 BOM Entry / Maintenance
- **Menu**: Bill of Materials > BOM Entry
- **Header Fields**:
  - Parent Item Number (finished good / assembly)
  - Parent Description (auto-filled)
  - Revision Level
  - Effective Date
  - Obsolete Date
  - BOM Type (Standard, Planning, Phantom)
  - Batch/Lot Size (standard quantity)
  - Notes/Comments
- **Component Line Fields**:
  - Line/Sequence Number
  - Component Item Number (lookup)
  - Component Description (auto-filled)
  - Quantity Per (quantity of component per 1 parent)
  - Unit of Measure
  - Scrap Percentage
  - Operation/Step Number (link to routing)
  - Effective Date (component level)
  - Obsolete Date (component level)
  - Reference Designator
  - Fixed Quantity flag (vs. proportional)
  - Comments
- **Functions**:
  - Add new BOM
  - Edit BOM
  - Delete BOM
  - Copy BOM (to new parent item)
  - Add/Edit/Delete components
  - Multi-level BOM view (indented display)
  - Single-level BOM view
  - Roll up costs (calculate parent cost from components)
  - Component item lookup
  - Check for circular references
  - BOM revision control / history

### 3.2 BOM Listing / Report
- **Parameters**: Parent Item range, Product Class range, Single Level or Multi-Level (indented/exploded), Show costs (Yes/No), Print effective components only or all
- **Output**: Parent item, components with quantities, costs, levels (if multi-level)

### 3.3 Where-Used Report
- **Parameters**: Component Item range, Single Level or Multi-Level (all levels up)
- **Output**: For each component - list of parent assemblies that use it, with quantity per, level

### 3.4 BOM Cost Rollup
- **Function**: Calculate parent item cost by summing component costs x quantities
- **Options**: Standard cost, Average cost, Last cost basis
- **Update**: Optionally update parent item standard cost in Item Maintenance

---

## 4. ORDER ENTRY MODULE

### 4.1 Sales Order Entry
- **Menu**: Order Entry > Order Entry
- **Header Fields**:
  - Order Number (auto-generated or manual)
  - Order Type (Order, Quote, Blanket, Credit Memo, Debit Memo)
  - Customer Number (lookup)
  - Customer Name (auto-filled)
  - Customer PO Number
  - Ship-To Address (selection from customer ship-to records)
  - Bill-To Address (auto-filled from customer)
  - Order Date
  - Required Date / Promised Date
  - Ship Date
  - Ship Via (carrier)
  - Terms Code (default from customer, editable)
  - Salesperson Code
  - Territory Code
  - Tax Code / Tax Rate
  - Tax Exempt Number
  - Freight Amount
  - Discount Percent (order level)
  - Warehouse (default)
  - Hold flag (Yes/No)
  - Comments / Notes (header level)
  - Approval Status
- **Line Item Fields**:
  - Line Number
  - Item Number (lookup from Inventory)
  - Description (auto-filled, editable)
  - Quantity Ordered
  - Quantity Shipped (entry during shipping)
  - Quantity Backordered (calculated or manual)
  - Unit of Measure
  - Unit Price (from price list / manual)
  - Price Level used
  - Discount Percent (line level)
  - Extension Amount (calculated)
  - Tax flag (Taxable Yes/No)
  - GL Revenue Account
  - GL COGS Account
  - Warehouse
  - Bin Location
  - Requested Date (line level)
  - Ship Date (line level)
  - Commission Percent
  - Job Number
  - Lot/Serial Number (if tracked)
  - Notes (line level)
- **Functions**:
  - Add new order
  - Edit existing order
  - Delete order
  - Copy order (from existing order or quote)
  - Convert Quote to Order
  - Place order on hold / release hold
  - Cancel order
  - Add/Edit/Delete line items
  - Customer lookup (by number, name, phone)
  - Item lookup (by number, description)
  - Check stock availability
  - Check customer credit limit
  - Credit limit warning/override
  - Calculate order totals (subtotal, tax, freight, discount, total)
  - Apply customer-specific pricing
  - Quantity break pricing
  - Print order confirmation / acknowledgment
  - View order history for customer
  - Duplicate order detection

### 4.2 Shipping / Invoicing
- **Menu**: Order Entry > Shipping / Invoicing
- **Shipping Entry**: Select order(s) to ship, Enter quantities shipped per line, Partial shipment handling, Assign lot/serial numbers on shipment, Print packing slip / pick list, Generate Bill of Lading, Ship complete order or selected lines
- **Invoice Generation**: Generate invoice from shipped order, Auto-number invoices, Invoice date entry, Print invoices (single or batch), Post invoices (updates AR, Inventory, GL), Consolidated invoicing (multiple shipments on one invoice)
- **Invoice Fields**: Invoice Number, Invoice Date, Order Number (reference), Customer Number, Ship-To Address, Line items (shipped items with prices), Subtotal, Tax, Freight, Discount, Invoice Total, Terms / Due Date, Salesperson
- **Posting Effects**: Debit: Accounts Receivable, Credit: Sales Revenue, Debit: COGS, Credit: Inventory, Update customer balance, Update item sales history, Update salesperson commissions

### 4.3 Order Status Inquiry
- **Menu**: Order Entry > Order Inquiry
- **Lookup By**: Order Number, Customer Number, Customer PO Number, Item Number
- **Display**: Order header, line items, quantities (ordered/shipped/backordered), shipment history, invoice history, payment status
- **Functions**: View only (no editing), drill-down to shipments and invoices

### 4.4 Backorder Processing
- **Menu**: Order Entry > Backorder Processing
- **Functions**: List all open backorders, Filter by customer/item/date, Auto-fill backorders from available stock, Partial fill backorders, Cancel backorders, Print backorder report, Convert backorders to new orders

### 4.5 Order Entry Reports
- **Open Order Report**: Parameters: Customer range, Order date range, Salesperson, Status filter. Output: Open orders with quantities, values, ship dates
- **Backorder Report**: Parameters: Customer range, Item range. Output: All backordered items with quantities and dates
- **Sales Analysis Report**: Parameters: Date range, Item range, Customer range, Salesperson range, Territory. Output: Sales by item, customer, salesperson, territory - Qty, Amount, Cost, Margin, Margin %. Sort/Subtotal options: by Customer, Item, Salesperson, Territory, Product Class
- **Booking Report**: Parameters: Date range, Customer range. Output: Orders booked (entered) during period
- **Shipping Log / Report**: Parameters: Date range, Customer range, Ship Via. Output: Shipments with tracking, quantities, dates
- **Commission Report**: Parameters: Salesperson range, Date range. Output: Sales, commission rate, commission amount by salesperson
- **Sales Tax Report**: Parameters: Date range, Tax code range. Output: Taxable sales, tax collected by tax jurisdiction

---

## 5. ACCOUNTS RECEIVABLE MODULE

### 5.1 Customer Maintenance
- **Menu**: Accounts Receivable > Customer Maintenance
- **Fields**:
  - Customer Number (primary key)
  - Customer Name
  - Address Line 1
  - Address Line 2
  - City
  - State / Province
  - Zip / Postal Code
  - Country
  - Contact Name
  - Phone Number
  - Fax Number
  - Email Address
  - Web Site
  - Terms Code (lookup - NET30, NET60, etc.)
  - Credit Limit
  - Credit Status (Good/Hold/COD)
  - Tax Code / Tax Rate
  - Tax Exempt (Yes/No)
  - Tax Exempt Number / Certificate
  - Salesperson Code
  - Territory Code
  - Ship Via (default carrier)
  - Statement Type (Balance Forward / Open Item)
  - Finance Charge flag (Yes/No)
  - Price Level (1-5 or custom)
  - Currency Code
  - GL Account - Receivable
  - Default Ship-To Address
  - Customer Type / Category
  - Customer Since Date
  - Last Activity Date
  - Balance (display, system-maintained)
  - YTD Sales
  - YTD Payments
  - Prior Year Sales
  - Highest Balance
  - Average Days to Pay
  - Notes / Comments
  - Status (Active/Inactive)
- **Functions**: Add new customer, Edit customer, Delete customer (with dependency check), Customer inquiry, Search/lookup by number/name/phone/contact, View transaction history, View open invoices, View aging, Print customer labels, Mass update

### 5.2 Ship-To Address Maintenance
- **Fields**: Ship-To Code, Ship-To Name, Address Line 1/2, City, State, Zip, Country, Contact Name, Phone Number, Tax Code (ship-to specific), Ship Via (ship-to specific), Notes
- **Functions**: Add, Edit, Delete ship-to addresses per customer

### 5.3 AR Invoice Entry (Direct / Non-Order)
- **Menu**: Accounts Receivable > Invoice Entry
- **Fields**: Invoice Number (auto or manual), Invoice Date, Customer Number (lookup), Customer Name (auto-filled), Due Date (calculated from terms), Discount Date, Discount Amount, PO Number (reference), Salesperson, Terms Code
- **Line Items**: GL Account, Description, Amount, Tax Code, Department, Job Number
- **Functions**: Enter AR invoice directly (not from Order Entry), Post invoices (updates AR, GL), Print invoice, Batch entry

### 5.4 Cash Receipts Entry
- **Menu**: Accounts Receivable > Cash Receipts
- **Fields**: Receipt Number (auto-generated), Customer Number (lookup), Customer Name (auto-filled), Receipt Date, Check Number, Check Date, Bank Account (deposit to), Receipt Amount, Discount Taken, Write-off Amount, GL Account (for write-offs)
- **Application**: Apply to specific invoices (select from open invoices), Auto-apply (oldest first), Partial payment on invoice, Overpayment handling (leave on account / refund), Prepayment / Deposit entry
- **Functions**: Enter cash receipt, Apply to invoices, Post receipts (updates AR, GL, Bank), Print deposit slip, Print cash receipts journal, Void receipt, NSF check processing (reverse receipt, reinstate invoices)

### 5.5 Credit Memo Entry
- **Menu**: Accounts Receivable > Credit Memo
- **Fields**: Credit Memo Number, Customer Number, Date, Reason Code, Amount, GL Account, Reference (original invoice), Apply to invoice (optional)
- **Functions**: Enter credit memos, apply against invoices, post

### 5.6 Adjustment Entry
- **Menu**: Accounts Receivable > Adjustments
- **Fields**: Adjustment Number, Customer Number, Date, Amount (+/-), GL Account, Reference, Reason
- **Functions**: Adjust customer balance, post adjustments

### 5.7 Finance Charge Processing
- **Menu**: Accounts Receivable > Finance Charges
- **Parameters**: Cutoff Date, Minimum charge amount, Annual rate / Monthly rate, Customer range, Assess on past due balances, Grace period (days), Charge on previously assessed charges (compound)
- **Functions**: Calculate finance charges, Print finance charge report (preview), Post finance charges (creates invoices on customer accounts)

### 5.8 Statement Printing
- **Menu**: Accounts Receivable > Statements
- **Parameters**: Customer range, Statement Date, Minimum balance threshold, Statement Type (Balance Forward or Open Item), Include finance charges, Message / dunning text (by aging bucket)
- **Output**: Customer statements with open items, aging, balance due

### 5.9 AR Reports
- **Customer List / Master File Report**: Parameters: Customer range, Status filter, Sort by. Output: Complete customer master data
- **Aged Trial Balance (AR Aging)**: Parameters: Customer range, As-of date, Aging buckets (Current/30/60/90/120+), Detail or Summary. Output: Customer, invoices, amounts by aging bucket, totals
- **Cash Receipts Journal / Register**: Parameters: Date range, Customer range. Output: Receipts posted - customer, check, amount, invoices applied, discounts, GL distribution
- **Sales Tax Report**: Parameters: Date range, Tax code range. Output: Taxable sales, exempt sales, tax amounts by jurisdiction
- **Open Invoice Report**: Parameters: Customer range, Date range, Sort by (Customer/Date/Amount). Output: All open (unpaid) invoices
- **Customer Activity Report**: Parameters: Customer range, Date range. Output: All transactions per customer
- **AR Distribution Report / GL Distribution**: Parameters: Date range. Output: AR transactions distributed to GL accounts
- **Collection Follow-Up Report**: Parameters: Days past due threshold, Customer range. Output: Past due customers with contact info, amounts, days late

---

## 6. ACCOUNTS PAYABLE MODULE

### 6.1 Vendor Maintenance
- **Menu**: Accounts Payable > Vendor Maintenance
- **Fields**:
  - Vendor Number (primary key)
  - Vendor Name
  - Address Line 1
  - Address Line 2
  - City
  - State / Province
  - Zip / Postal Code
  - Country
  - Contact Name
  - Phone Number
  - Fax Number
  - Email Address
  - Web Site
  - Terms Code (lookup)
  - 1099 Type (None, Miscellaneous, Interest, Dividends, etc.)
  - 1099 Box Number
  - Tax ID / Federal ID (for 1099)
  - Social Security Number (if individual)
  - Default GL Account (expense)
  - Payment Priority
  - Hold flag (Yes/No - hold payments)
  - Separate Check flag (Yes/No)
  - Currency Code
  - Bank Account (for EFT/ACH)
  - Payment Method (Check, EFT, Wire, Manual)
  - GL Account - Payable
  - Vendor Type / Category
  - Discount Percent (default)
  - Vendor Since Date
  - Last Activity Date
  - Balance (display, system-maintained)
  - YTD Purchases
  - YTD Payments
  - 1099 YTD Amount
  - Prior Year Purchases
  - Notes / Comments
  - Status (Active/Inactive)
- **Functions**: Add new vendor, Edit vendor, Delete vendor (with dependency check), Vendor inquiry, Search/lookup by number/name/phone, View transaction history, View open invoices, View aging, Print vendor labels, Print 1099 data report, Mass update

### 6.2 AP Invoice Entry
- **Menu**: Accounts Payable > Invoice Entry
- **Fields**: Invoice Number (vendor's invoice number), Vendor Number (lookup), Vendor Name (auto-filled), Invoice Date, Due Date (calculated from terms, editable), Discount Date, Discount Amount, Invoice Amount (total), PO Number (reference / link to PO), Hold flag, Separate Check flag, 1099 flag / 1099 Amount, Payment Terms
- **GL Distribution Lines**: GL Account Number (lookup), Account Description (auto-filled), Debit Amount, Credit Amount, Description / Memo, Department, Job Number
- **Functions**: Enter AP invoice, Match to PO (auto-fill from PO receipt), Three-way match (PO, Receipt, Invoice), Distribute to multiple GL accounts, Post invoices (updates AP, GL), Batch entry, Recurring invoice entry (templates), Duplicate invoice detection (vendor + invoice number), Place invoice on hold, Quick entry (single GL account)

### 6.3 Payment Selection
- **Menu**: Accounts Payable > Payment Selection
- **Selection Criteria**: Due Date cutoff, Discount Date cutoff, Vendor range (From/To), Amount range (minimum/maximum), Select All / Deselect All, Individual invoice selection/deselection, Priority-based selection
- **Display**: Vendor, Invoice Number, Invoice Date, Due Date, Discount Date, Amount, Discount, Net Amount, Selected (checkbox)
- **Functions**: Auto-select by due date, Auto-select by discount date, Manual select/deselect, Edit payment amount (partial payment), Force discount on past-discount invoices, Calculate total selected, Print selection report, Clear all selections

### 6.4 Check Printing
- **Menu**: Accounts Payable > Print Checks
- **Parameters**: Bank Account (selection), Check Date, Starting Check Number, Check Format / Form selection, Number of copies, Print alignment/test check, Sort by (Vendor Number, Vendor Name, Zip Code)
- **Options**: Separate check per invoice or combine, Overflow stub handling, Print company name on check, Signature line / facsimile signature
- **Functions**: Print checks for all selected invoices, Reprint checks (with void/reissue), Print check register, Post checks (updates AP, GL, Bank, Vendor balances, clears invoices)

### 6.5 Manual Check Entry
- **Menu**: Accounts Payable > Manual Checks
- **Fields**: Check Number, Bank Account, Check Date, Vendor Number, Check Amount, Apply to invoices, GL Distribution
- **Functions**: Record manually written checks, apply to invoices, post

### 6.6 Void Check Processing
- **Menu**: Accounts Payable > Void Checks
- **Fields**: Check Number, Bank Account, Void Date, Reason
- **Options**: Void and reopen invoices (reinstate to unpaid), Void only (no invoice reinstatement)
- **Functions**: Void printed or manual checks, reverse GL entries, reinstate invoices

### 6.7 1099 Processing
- **Menu**: Accounts Payable > 1099 Processing
- **Functions**: 1099 Edit List (review amounts by vendor), Adjust 1099 amounts (manual override), Print 1099 Forms (1099-MISC, 1099-INT, 1099-DIV - parameters: Tax year, Vendor range, Minimum amount, Form type), Print 1099 Summary (1096), E-File 1099s (electronic filing export), Copy B (Vendor)/Copy A (IRS)/Copy C (Payer), Reset 1099 YTD amounts (after year-end)

### 6.8 AP Reports
- **Vendor List / Master File Report**: Parameters: Vendor range, Status filter, Sort by. Output: Complete vendor master data
- **Aged Trial Balance (AP Aging)**: Parameters: Vendor range, As-of date, Aging buckets (Current/30/60/90+), Detail or Summary. Output: Vendor, invoices, amounts by aging bucket, totals
- **Cash Requirements Report / Forecast**: Parameters: Date range (future due dates), Vendor range, Include discounts. Output: Cash needed by date
- **Check Register**: Parameters: Date range, Bank Account, Vendor range. Output: Checks issued - number, date, vendor, amount, invoices paid
- **AP Distribution Report**: Parameters: Date range. Output: AP transactions distributed by GL account
- **Open Invoice Report**: Parameters: Vendor range, Date range. Output: All open vendor invoices
- **Vendor Activity Report**: Parameters: Vendor range, Date range. Output: All transactions per vendor
- **Purchase Journal / Invoice Register**: Parameters: Date range, Vendor range. Output: All invoices entered with GL distribution
- **Expense Distribution Report**: Parameters: Date range, GL Account range. Output: Expenses by GL account with vendor/invoice detail

---

## 7. GENERAL LEDGER MODULE

### 7.1 Chart of Accounts Maintenance
- **Menu**: General Ledger > Chart of Accounts
- **Fields**:
  - Account Number (structured: segment-segment, e.g., 1000-00)
  - Account Description
  - Account Type (Asset, Liability, Equity, Revenue, Expense)
  - Account Sub-Type / Category
  - Normal Balance (Debit/Credit - auto-set by type)
  - Department / Cost Center (if segmented)
  - Active flag (Yes/No)
  - Budget flag (allow budgets Yes/No)
  - Cash Flow Category
  - Financial Statement Group / Line
  - Subtotal Level
  - Beginning Balance
  - Current Balance (display, system-maintained)
  - Notes / Description (extended)
- **Functions**: Add new account, Edit account, Delete account (only if no transactions), Inactivate account, Account inquiry (view balance and history), Search/lookup by number/description/type, Print chart of accounts, Copy account structure, Account renumber utility

### 7.2 Journal Entry
- **Menu**: General Ledger > Journal Entry
- **Header Fields**: Journal Entry Number (auto-generated), Journal Date, Reference / Source, Description / Memo, Reversing Entry flag (auto-reverse next period), Reversing Date
- **Line Item Fields**: Account Number (lookup), Account Description (auto-filled), Debit Amount, Credit Amount, Description / Memo (line level), Department, Job Number, Reference
- **Validation**: Total Debits must equal Total Credits (balanced entry)
- **Functions**: Add new journal entry, Edit unposted JE, Delete unposted JE, Post journal entries (single or batch), Print journal entry, Copy journal entry, Auto-reverse entries, Intercompany entries

### 7.3 Recurring Journal Entry
- **Menu**: General Ledger > Recurring Entries
- **Fields**: Recurring Entry Code / ID, Description, Frequency (Monthly, Quarterly, Annually, Custom), Next Run Date, End Date (optional), Amount Type (Fixed or Variable), Account lines (same as Journal Entry)
- **Functions**: Create recurring template, Edit template, Delete template, Generate entries from template, Auto-generate on schedule, Review before posting

### 7.4 Budget Maintenance
- **Menu**: General Ledger > Budgets
- **Fields**: Account Number, Budget Year, Budget Version / Scenario, Period 1 through Period 12 (or Period 13 for adjusting), Annual Total (calculated or entered, with auto-spread)
- **Functions**: Enter budgets by account/period, Copy prior year actuals as budget base, Copy prior year budget, Spread annual amount evenly across periods, Increase/decrease by percentage, Import budgets from spreadsheet, Export budgets to spreadsheet, Print budget worksheets, Budget by department

### 7.5 Period End Processing
- **Menu**: General Ledger > Period End
- **Functions**: Close current period, Open next period, Print period-end reports before closing, Prevent posting to closed periods, Allow adjusting entries to closed period (with override), Period status display (Open/Closed for each period)

### 7.6 Year End Processing
- **Menu**: General Ledger > Year End
- **Functions**: Close fiscal year, Zero out Revenue and Expense accounts, Post net income/loss to Retained Earnings, Roll beginning balances forward for Balance Sheet accounts, Create opening balances for new year, Print year-end reports, Allow posting to prior year (with override), Set up new fiscal year periods

### 7.7 Financial Statements
- **Balance Sheet**: Parameters: As-of date, Department, Comparative (prior period, prior year). Output: Assets, Liabilities, Equity with subtotals and totals. Format: Classified or single-step
- **Income Statement / Profit and Loss**: Parameters: Period range or single period, Department, Budget comparison, Prior year comparison. Output: Revenue, Expenses, Net Income with subtotals. Variance columns: Actual vs Budget (dollar and %), Actual vs Prior Year
- **Financial Statement Designer / Custom Statements**: Define row layout (account ranges, subtotals, descriptions), Define column layout (actual, budget, prior year, variance, percentage), Save statement formats for reuse, Print custom financial reports

### 7.8 Trial Balance
- **Parameters**: As-of date, Account range, Department, Include zero-balance accounts, Detail or Summary
- **Output**: Account Number, Description, Debit Balance, Credit Balance, with totals (must balance)
- **Types**: Working Trial Balance, Adjusted Trial Balance

### 7.9 GL Reports
- **Chart of Accounts Listing**: Parameters: Account range, Type filter, Active/Inactive. Output: Account number, description, type, normal balance, status
- **Journal Entry Listing**: Parameters: Date range, JE number range, Source filter, Posted/Unposted. Output: JE header and line details
- **Transaction Detail Report**: Parameters: Account range, Date range, Department, Source module. Output: Every transaction posted to each account
- **Budget vs Actual Report**: Parameters: Period range, Account range, Department. Output: Account, Budget amount, Actual amount, Variance (dollar and %), Year-to-Date columns
- **Department Reports**: Parameters: Department range, Period range. Output: Income statement by department
- **Account Inquiry / Drill-Down**: View account balance, period balances, transaction detail. Drill-down from balance to transactions to source documents
- **GL Activity Report**: Parameters: Date range, Account range. Output: All activity (debits, credits) by account by period
- **Source Journal Report**: Parameters: Source (AR, AP, PR, INV, OE, JE), Date range. Output: All GL entries originating from specified source module

---

## 8. PAYROLL MODULE

### 8.1 Employee Maintenance
- **Menu**: Payroll > Employee Maintenance
- **Personal Information Fields**: Employee Number (primary key), First Name, Middle Name / Initial, Last Name, Suffix (Jr., Sr., etc.), Social Security Number (SSN), Address Line 1, Address Line 2, City, State, Zip Code, Phone Number, Date of Birth, Gender, Marital Status, Emergency Contact Name, Emergency Contact Phone, Email Address
- **Employment Information Fields**: Hire Date, Termination Date, Rehire Date, Employee Status (Active, Inactive, Terminated, On Leave), Department Code, Division, Position / Job Title, Supervisor / Manager, Work Location, Employee Type (Full-Time, Part-Time, Temporary, Contract), Pay Frequency (Weekly, Bi-Weekly, Semi-Monthly, Monthly), Pay Type (Hourly, Salary, Commission, Piecework), Pay Rate / Salary Amount, Standard Hours per period, Overtime eligible (Yes/No), Shift / Shift Differential, Workers Compensation Code, EEO Classification, Union Code
- **Tax Information Fields**: Federal Filing Status (Single, Married, Head of Household), Federal Exemptions / Allowances, Additional Federal Withholding, Federal Tax Exempt (Yes/No), State Tax Code, State Filing Status, State Exemptions / Allowances, Additional State Withholding, State Tax Exempt (Yes/No), Local Tax Code(s), Local Tax Exemptions, FICA Exempt (Yes/No), SUI/SUTA State, W-4 Date, Earned Income Credit (EIC) flag
- **Direct Deposit Fields**: Direct Deposit Enabled (Yes/No), Bank Name, Bank Routing Number (ABA), Account Number, Account Type (Checking/Savings), Amount or Percentage (per account), Multiple accounts (split deposit), Prenote status
- **Pay Codes Assigned**: List of active pay codes for this employee
- **Deductions Assigned**: List of active deductions with employee amount, employer match
- **Accumulators / YTD Fields** (system-maintained): YTD Gross Pay, YTD Federal Tax Withheld, YTD State Tax Withheld, YTD Local Tax Withheld, YTD FICA (Social Security + Medicare), YTD Deductions (by code), YTD Net Pay, QTD equivalents, MTD equivalents, Prior Year amounts, Hours worked (YTD, QTD, MTD), Vacation hours accrued / used / available, Sick hours accrued / used / available, Personal hours accrued / used / available
- **Functions**: Add new employee, Edit employee, Delete/Terminate employee, Employee inquiry, Search/lookup by number/name/SSN/department, View pay history, View check history, Print employee information, Mass update (department, rate, status), Rehire terminated employee

### 8.2 Pay Code Maintenance
- **Menu**: Payroll > Pay Codes
- **Fields**: Pay Code (alphanumeric ID), Description, Pay Type (Regular, Overtime, Double Time, Holiday, Vacation, Sick, Personal, Bonus, Commission, Piecework, Tip, Reimbursement, Other), Rate Factor / Multiplier (e.g., 1.0 for regular, 1.5 for OT, 2.0 for double time), GL Account - Expense (Debit), GL Account - Liability (Credit), Workers Compensation Code, Subject to Federal Tax (Yes/No), Subject to State Tax (Yes/No), Subject to Local Tax (Yes/No), Subject to FICA (Yes/No), Subject to FUTA (Yes/No), Subject to SUTA (Yes/No), Include in Regular Pay calculation, Accrual flag (for vacation/sick accrual), Memo/Non-Cash (Yes/No), Active (Yes/No)
- **Functions**: Add new pay code, Edit pay code, Delete pay code, Print pay code listing

### 8.3 Deduction Code Maintenance
- **Menu**: Payroll > Deduction Codes
- **Fields**: Deduction Code (alphanumeric ID), Description, Calculation Method (Flat Amount, Percentage of Gross, Percentage of Net, Rate per Hour, Rate per Unit), Employee Amount / Rate, Employer Match Amount / Rate, Employer Match Maximum, GL Account - Employee Deduction Liability, GL Account - Employer Expense, GL Account - Employer Liability, Pre-Tax (Yes/No - 401k, Section 125, etc.), Affects Federal Tax, Affects State Tax, Affects FICA, Deduction Limit (per period), Annual Limit / Cap, YTD Limit tracking, Frequency (Every pay, Monthly, Quarterly, Annual, One-time), Start Date, End Date / Goal Amount, Garnishment Priority, Active (Yes/No)
- **Common Deductions**: Federal Tax, State Tax, Local Tax, FICA SS, FICA Medicare, 401(k), Health Insurance, Dental, Vision, Life Insurance, HSA, FSA, Garnishments, Union Dues, Parking, Charitable
- **Functions**: Add new deduction code, Edit deduction code, Delete deduction code, Print deduction code listing

### 8.4 Tax Table Maintenance
- **Menu**: Payroll > Tax Tables
- **Tax Types**:
  - **Federal Income Tax**: Tax brackets by filing status, Annualized calculation method, Withholding tables or percentage method
  - **State Income Tax**: State-specific tables, Flat rate or graduated brackets, State-specific exemptions and credits
  - **Local / City Tax**: Flat percentage, Resident vs non-resident rates
  - **Social Security (FICA - OASDI)**: Tax rate (employee and employer), Wage base limit (annual)
  - **Medicare (FICA - HI)**: Tax rate (employee and employer), Additional Medicare Tax threshold and rate, No wage base limit
  - **FUTA (Federal Unemployment)**: Tax rate, Wage base, Credit reduction states
  - **SUTA / SUI (State Unemployment)**: Employer rate (varies by experience rating), Wage base (state-specific), Employee contribution (some states)
  - **Workers Compensation**: Rate per $100 of payroll, By classification code
- **Functions**: View/Edit tax tables, Import updated tax tables (annual updates), Print tax table listing, Override rates per company

### 8.5 Payroll Entry / Time Entry
- **Menu**: Payroll > Payroll Entry / Time Entry
- **Entry Fields**: Employee Number (lookup), Employee Name (auto-filled), Pay Period Begin Date, Pay Period End Date, Check Date, Pay Code, Hours (for hourly), Rate (default from employee, editable), Amount (for salary/flat), Department (override), Job Number / Cost Center, Shift, Pieces / Units (for piecework), Weeks (for weekly salary), Override deductions, Memo / Notes
- **Entry Methods**: Manual entry by employee, Batch entry (quick entry grid), Import from time clock / timesheet system, Copy from prior period (salaried employees), Auto-generate salaried entries
- **Functions**: Add time/pay entries, Edit entries, Delete entries, Validate entries

### 8.6 Payroll Calculation and Preview
- **Menu**: Payroll > Calculate Payroll
- **Process**: Select employees (all, range, department, individual). System calculates: Gross pay, Pre-tax deductions, Federal income tax, State income tax, Local tax, Social Security (up to wage base), Medicare, Post-tax deductions, Net pay, Employer taxes (FICA match, FUTA, SUTA), Employer-paid benefits
- **Preview / Pre-Check Report**: Output: Employee, Gross, Taxes, Deductions, Net, Check Amount. Review for errors before printing checks. Edit/correct entries and recalculate if needed

### 8.7 Payroll Check Printing
- **Menu**: Payroll > Print Checks
- **Parameters**: Bank Account, Check Date, Starting Check Number, Check Format (check on top/middle/bottom), Sort by (Employee Number, Name, Department), Separate checks for special pay codes (bonus check)
- **Stub Information**: Earnings detail (hours, rate, amount by pay code), Tax withholdings, Deductions, YTD totals, Net pay
- **Functions**: Print payroll checks, Print direct deposit vouchers/stubs, Reprint checks, Print check register, Create direct deposit file (ACH/NACHA format)

### 8.8 Payroll Posting
- **Menu**: Payroll > Post Payroll
- **Functions**: Post payroll to General Ledger, Update employee YTD/QTD/MTD accumulators, Update vacation/sick accruals, Update deduction goal/limit tracking, Create GL journal entries (payroll expense, tax liabilities, deduction liabilities, bank credit), Lock posted payroll, Print posting journal

### 8.9 Quarterly Tax Processing
- **Menu**: Payroll > Quarterly Processing
- **Reports/Functions**:
  - **Federal Form 941**: Total wages/tips/compensation, Federal income tax withheld, Social Security wages and tax, Medicare wages and tax, Total tax liability by month
  - **State Quarterly Report**: Employee listing with wages, State unemployment tax calculation, State income tax withholding totals
  - **941 Schedule B**: Daily tax liability for semi-weekly depositors
  - **Quarterly Wage Listing**: Per employee wages for state
  - **FUTA Worksheet**: Quarterly calculation
  - **Electronic Filing**: Export for quarterly reports
  - **Quarter End Processing**: Clear quarterly accumulators, Roll QTD to prior QTD, Verify quarter totals balance

### 8.10 W-2 Processing
- **Menu**: Payroll > W-2 Processing
- **Functions**: W-2 Edit List (preview all W-2 data), Adjust W-2 amounts (manual corrections), Print W-2 Forms (Copy A/SSA, Copy B/Employee Federal, Copy C/Employee File, Copy D/Employer, Copy 1/State-Local, Copy 2/State-Local Employee - pre-printed forms or plain paper), Print W-3 (Transmittal of Wage and Tax Statements), E-File W-2s (electronic filing - SSA format), Reprint individual W-2s, Year-end adjustment entries

### 8.11 Payroll Reports
- **Employee List / Master File Report**: Parameters: Employee range, Department, Status filter, Sort by. Output: Employee master data, pay rates, tax info
- **Payroll Register / Check Register**: Parameters: Check date range, Department, Employee range. Output: Employee, gross, taxes (itemized), deductions (itemized), net, check number
- **Earnings Report**: Parameters: Date range, Employee range, Department, Pay Code. Output: Earnings by pay code
- **Deduction Report**: Parameters: Date range, Deduction code range, Employee range. Output: Deductions by code with employee and employer amounts
- **Tax Report / Tax Liability Report**: Parameters: Date range, Tax type. Output: Tax liabilities by period
- **Labor Distribution Report**: Parameters: Date range, Department range, Job range. Output: Payroll costs by department, job, cost center
- **Department Summary Report**: Parameters: Date range, Department range. Output: Payroll totals by department
- **Accrual Report (Vacation/Sick/Personal)**: Parameters: Employee range, Accrual type. Output: Hours accrued, used, available
- **Workers Compensation Report**: Parameters: Date range, WC Code range. Output: Wages by WC classification, rate, premium estimate
- **Certified Payroll Report**: Parameters: Job, Date range. Output: Davis-Bacon format
- **New Hire Report**: Parameters: Date range. Output: New employees for state reporting compliance
- **Pay History Report**: Parameters: Employee, Date range. Output: Complete check history

---

## 9. SYSTEM ADMINISTRATION MODULE

### 9.1 Company Maintenance
- **Menu**: System > Company Maintenance
- **Fields**: Company Number / Code, Company Name, Address Line 1, Address Line 2, City, State, Zip Code, Phone Number, Fax Number, Federal Tax ID (EIN), State Tax ID, Fiscal Year Start Month, GL Account Number Structure (segments, lengths), Number of GL Segments, Segment Separators, Current Fiscal Year, Current Period, Multi-Currency (Yes/No), Logo / Letterhead
- **Functions**: Edit company information, Set up GL account structure, Configure fiscal year

### 9.2 User Maintenance
- **Menu**: System > User Maintenance
- **Fields**: User ID (login name), User Full Name, Password (encrypted), Password Expiration Date, Security Level (numeric level or role), Security Group assignment, Module Access (checkboxes per module: GL, AP, AR, PR, INV, OE, PO, BOM), Menu Access restrictions, Function-level access (Add, Edit, Delete, View, Post, Print per module), Active (Yes/No), Last Login Date (display), Failed Login Attempts, Account Locked flag, Email
- **Functions**: Add new user, Edit user, Delete user, Reset password, Lock/Unlock account, Copy user (template), Print user list, View login history

### 9.3 Security Group Setup
- **Menu**: System > Security Groups
- **Fields**: Group Name / Code, Description, Module access matrix (per module: None, View, Entry, Supervisor, Full), Menu item access (enable/disable per menu item), Function access (Add, Edit, Delete, Post, Print, Void per function), Report access (which reports the group can run), Field-level security (hide sensitive fields like SSN, pay rates)
- **Functions**: Create security group, Edit group permissions, Delete group, Assign users to groups, Print security report, Copy group

### 9.4 System Parameters / Preferences
- **Menu**: System > System Parameters
- **Numbering**: Next PO Number, Next Invoice Number (AR), Next Invoice Number (AP), Next Receipt Number, Next Journal Entry Number, Next Check Number (by bank), Next Order Number, Next Customer Number, Next Vendor Number, Next Employee Number, Next Item Number
- **Defaults and Options**: Default Terms Code (AR and AP), Aging Periods (days: 30, 60, 90, 120 - configurable), Decimal Precision (quantities, costs, prices, amounts)
- **Posting Options**: Real-time posting vs batch posting, Require posting password, Allow posting to closed periods
- **Business Rules**: Inventory Costing Method (Standard, Average, Last, FIFO, LIFO), Tax Calculation Method (per line item, per invoice), Credit Limit Enforcement (None, Warning, Hard Stop), Duplicate Invoice Checking (AP - by vendor + invoice number)
- **Security Settings**: Password Policy (minimum length, complexity, expiration days), Session Timeout (minutes of inactivity), Audit Trail (enable/disable, which events to log)
- **Integration Settings**: Email / SMTP Settings (for emailing reports, statements, POs), Currency Settings (base currency, exchange rates), Fiscal Period Configuration, Report Settings (default printer, output format)

### 9.5 Period Maintenance
- **Menu**: System > Period Maintenance
- **Functions**: View fiscal periods (Period 1-12 or 1-13) with start/end dates, Open period (allow transactions), Close period (prevent new transactions), Adjusting period (period 13 for year-end adjustments), Set current period, View period status for all modules (GL, AP, AR, PR), Synchronize module periods

### 9.6 Audit Trail / Transaction Log
- **Menu**: System > Audit Trail
- **Logged Events**: Login/Logout (user, date/time, workstation), Record changes (field modified, old value, new value, user, date/time), Transaction posting (module, document number, user, date/time), Deletions (record type, key, user, date/time), Void transactions, Password changes, Security changes, System parameter changes, Failed login attempts
- **Report Parameters**: Date range, User, Module, Event type
- **Functions**: View audit trail, Print audit trail report, Export audit trail, Purge old audit records

### 9.7 Data Utilities
- **Menu**: System > Utilities
- **Rebuild Indexes**: Rebuild database indexes for all or selected tables, Fix data integrity issues, Recalculate balances (customer, vendor, inventory, GL)
- **Purge Data**: Purge closed/paid transactions (AR, AP invoices), Purge posted transactions (by date cutoff), Purge history (by date cutoff), Purge audit trail (by date cutoff). Parameters: Module, Cutoff date, Transaction types. Confirmation/warning before purge
- **Export Data**: Export to CSV, TXT, or fixed-width format, Export master files (Customers, Vendors, Items, Employees, COA), Export transaction data, Export for external reporting / BI tools, Field selection
- **Import Data**: Import master files from CSV/TXT, Import transactions, Field mapping interface, Preview/validate before importing, Error log for rejected records
- **Verify Data Integrity**: Check referential integrity, Check out-of-balance conditions, Verify control totals (sub-ledger to GL), Report discrepancies

### 9.8 Printer Setup
- **Menu**: System > Printer Setup
- **Settings**: Default printer selection, Printer assignments by report/form type, Form alignment test, Print to screen (preview) option, Print to file (PDF, TXT) option, Print to email option, Custom paper sizes, Check printer configuration (MICR), Label printer configuration, Number of copies (by report type), Landscape / Portrait orientation defaults

### 9.9 Custom Report Writer
- **Menu**: System > Report Writer
- **Functions**: Create custom reports from any data table, Select fields (columns), Set filters (criteria/conditions), Set sort order, Grouping and subtotals, Calculated fields (formulas), Headers/footers/page layout, Save report definitions, Edit saved reports, Delete saved reports, Schedule reports, Export report output (CSV, PDF, Excel)

### 9.10 Crystal Reports Integration
- **Functions**: Launch Crystal Reports viewer, Run pre-built Crystal Reports, Pass parameters to Crystal Reports, Custom Crystal Reports connecting to database, Print/Export Crystal Reports, Report gallery / selection screen

### 9.11 Help / About
- **Menu**: Help > About
- **Information**: Software version number, Build date, License information (serial number, registered user, module licenses), Database version, System information (OS, memory, etc.), Support contact information, Check for updates, Module activation status

---

*End of extraction - Pages 100-250, CSA Software Help Manual*
