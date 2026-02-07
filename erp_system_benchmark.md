# ERP System Functional Benchmark

This document outlines the functional requirements for the ERP system based on the `ERP-SYSTEM-FUNCTION.pdf` provided. It serves as a checklist for implementation.

## 1. Manufacturing Management
### Bill of Materials Management
- List Required Materials to create a Finished Good
- Single or Multi Level BoM
- Gain / Loss Materials per Production

### Manufacturing Order
- Sales Order can auto create Manufacturing Orders
- Transfer Stock
- Manage production by manufacturing order
- Manage production by work order
- Manufacturing Finished Goods Revaluation (Inventory Revaluation Manufacturing)

### Other Manufacturing Operations
- Internal Transfer
- Product Usage/Scrap
- Purchase Request for Materials
- Sub-Contracting
- Cost Forecasting based on Work Center / BoM
- Auto Create Manufacturing Order based on Sales Order

### Work Order
- Work Order Message
- Assign Employee
- Traceability Lots
- Track Full & Partial Production
- Capacity exceed production
- Costing Method Standard, FIFO, Average
- Track the Routing Process needed for the BoM
- BoM Creation Wizard
- Work Order Time Tracking (Production Duration)
- Work Order Finished Goods & Timeline Performance
- Work Order Material and Finished Goods Output
- By Products Management

### Work Centers Management
- Auto Assign Work Centre by Work Center Group
- Manage list of Work Centers and its Locations
- Manage Work Center Groups
- Set the Overhead Time & Overhead Material Usage per Hour
- Define standard working hours per Work Center

### Routing Management
- Define the process of which work centers to use during Manufacturing
- Define the duration a manufacturing process will take
- Link materials to Routing
- Cost Analysis Report per Manufacturing Order & Work Order

### Manufacturing Reports
- Finished Goods Report
- Work Centre Report
- Material Usage Report
- Overall Equipment Effectiveness
- Production Gantt Chart
- Work Centre Gantt Chart

### Manufacturing Plan
- Auto Create & Track Manufacturing Orders based on their BoM
- Track the WIP creation for each Production Plan
- Track the Required Materials to finish a Manufacturing Plan
- Auto create Purchase Request (PR) based on lack of required materials
- Auto create Request for Quotation (RFQ) based on lack of required materials
- Auto create Material Request (MR) based on lack of required materials
- Auto Scheduling the Manufacturing Orders based on duration needed and Work Center Availability
- Sales Order can auto create Manufacturing Plan
- Manufacturing Plan Approval Matrix
- Manufacturing Plan Gantt Chart
- Manufacturing Plan vs Actual Report

### Work Order Quality Control
- Quality Control per Work In Progress
- Quality Control per Finish Goods
- Single or Multiple Quality Control per WIP and Finish Good

### Machine Kiosk Mode
- Tablet / Laptop Kiosk Mode for each Work Center
- Employees can tap to mark their attendance
- Materials can be scanned in real time to update the materials used
- Finished Goods to be inputted in real time during production

### Manufacturing Forecast
- Calculate Materials to Purchase based on existing Manufacturing Orders & Qty in Warehouse
- Plan Manufacturing Orders & Materials needed based on manual inputted forecast Finished Goods needed
- Manufacturing Demand Planning

## 2. CRM Sales Management
### CRM Dashboard
- Overview of Sales Performance, Pipeline, and Activities

### Customer Management
- Company & Contact Person Management
- Customer Contacts & Addresses Management
- Customer Tagging
- Customer E-Faktur Credentials
- Customer Target & Reward

### Quotations & Sales Order Management
- Send by Email from System
- Payment Terms Management
- Multiple Delivery per Sales Order
- Quotation Printout
- Discount & Global Discount Calculation
- Quotation Margin Calculation
- Quotation Revision Management
- Quotation Delivery Method
- Quotation Expiry & Notification
- Fiscal Position to manage taxes per customer
- Quotation / SO Line to Track Delivered Qty and Invoiced Qty
- Approval matrix based on margin, discount, and total
- Send quotation via email & WhatsApp

### Upsell Recommendation
- Auto Upselling Recommendation per SO Line
- Sales to Invoice vs Sales to Deliver analysis

### Credit Limit Management
- Default Credit Limit
- Credit Limit Request Approving Matrix
- One Time Transaction Over Credit Approving Matrix
- Overlimit Credit Approval
- Automatic Creditor Status Formula
- Credit Limit lock Quotation / Sales Order Settings
- Credit Limit per Customer Contacts
- Quotation Approval Matrix - Amount, Margin, Discount Branch Based
- Change of Payment Terms Approval Matrix
- Multiple Currency Management

### Products & Services Management
- Product Database Management
- Product Bundling Management
- Alternative Product Management
- Product Variants & Attributes Management
- SKU & Barcode Generation per Product

### Sales Pricelist
- Pricelist per Contact Person / Company
- Pricelist per Fixed Amount / Fixed Discount
- Import Pricelist Function

### RFM Analysis
- Automated customers' segmentation based on: recency, frequency, and monetary
- Available customers' profile analysis: champion, loyal, highest spending, faithful, needing attention, new customers, and sleeping customers
- View ratio (%) based on profile: customer, revenue, and orders
- RFM reporting & analytics

### Sales Reporting
- Sales Pivot Analysis
- Sales Details Report
- Sales Margin Pivot Analysis
- Sales Margin Report
- Day Wise Sales Report
- Sales Report by Salespersons
- Sale Invoice Summary
- Invoice Payment Report
- Customer Sales Analysis
- Top Customers Report
- Customer Credit Limit Analysis
- Top Selling Products
- Update Top Selling Products
- Sales Product Profit
- Sales By Product Category
- Sales product Indent

### Sales Agreement / Blanket Order
- Sales Agreement with different deliveries
- Sales Agreement / Blanket Order Printout

### Sales Team & Salesperson Management
- Multi Level Sales Team
- Team Leader & Team Members Management
- Multi Level Sales Team Access Rights

### Leads / Pipeline Management
- Stages Management
- Interested Products for Quotation
- Activity Tracking & Reminder per Lead per Salesperson
- Meetings & Call Log Tracking per Lead
- Won & Lost Reasons Analysis
- Leads / Pipeline Pivot Analysis
- Online Lead Form

### Salesperson Activity Targeting
- Set activity target and track realization
- Trackable Activity: #meetings, #calls, #emails, #follow-up

### Sales Forecast
- Forecast Methods: Moving Average, Autoregression, ARIMA, Holt Winter's, etc.
- Configure Sales Forecast based on: Start/End Date, Forecast Base, Products, Period, Unit
- View Forecast Report & Predicted Result

### Sales Apps
- Android & iOS App
- Leads Management
- Customer Management
- Quotation & Sales Order Management
- GPS Tracking for meeting
- View Stocks
- Call Logging
- KPI Tracking
- Sales Analysis
- Offline & Hybrid Connection

### Sales Promotions Program
- Sales Coupon Generation: Link Orders to Coupons, Rewards, Limits
- Apply Promotion based on Customers Category & Products
- Promotions Validity Management
- Promotions Reward Type: Discount, Free Product, Free Shipping

### Loyalty Point
- Points weightage per Product / Category per Period
- Gifts from Loyalty Point
- Discounts from Loyalty Point
- Loyalty Point History
- Points cancellation if SO cancelled / returned

## 3. Consignment Management
- Create, Edit, and Manage Consignment Agents
- Manage Consignment Commission per Agent
- Create, Edit, and Manage Consignment Pricelist
- Manage Consignment Location
- Manage Consignment Inventory Valuation
- Consignment Stock Adjustment
- View Consignment Reports

## 4. Inventory Management
### Inventory Operations Management
- Manage Receiving, Internal Transfer, Delivery, and other Operation Types
- Online Signature for Delivery / Delivery Boy
- Operations Dashboard with Upcoming Schedules
- Create and Manage Operation Types
- Comprehensive Return Merchandise Authorization (RMA) Management
- Track Initial Demand and Actual Delivery
- Barcode / QR Code / RFID Scanner Interface
- Stock Reservation per Delivery Note
- Track related Source Document
- Combine multiple deliveries from or to the same partner to one
- Manage Product Alternative upon each Operation

### Internal Transfer
- Create Internal Transfers that Will Auto Create 2 Documents: Delivery & Receiving
- Track Status of the Internal Transfer

### Product Usage / Scrap
- Manage Product Usage Requests
- Define Usage Reasons with Expense Account Setup
- Approval Matrix Setup based on Usage Reason
- Stock Deduction after Product Usage / Scrap is Approved

### Low Stock Notifications
- Define Min qty rules for each product in each location
- Notifications sent for low stocks

### Stock Count & Inventory Adjustment
- Stock Count for user to calculate & input real stocks which will link to Inventory Adjustment
- Inventory adjustmnet to adjust the qty in each location after approval
- Input unit price when doing inventory adjustment
- Inventory adjustment report

### Product Unit of Measure
- Each product can be received in various unit of measures of the same category
- Multi Unit of Measure Management with Smaller / Bigger Ratio

### Warehouse & Locations
- Manage a list of Warehouses and Locations
- Manage removal strategy of each location (FIFO, LIFO, FEFO)
- Direct Dropship from Supplier to Customer Tracking
- Auto Serialize / Scan / Input Serial & Lot Numbers

### Lot / Serial Number Tracking
- Track Lot & Serial Number per Product
- Have Traceability of each Product from the Incoming to the Outgoing
- Manage Settings to Auto Serialize Each Products based on Categories
- Track Expiry of each Batch
- Upcoming Expiry / Expired Product Batch Report & Notification

### Material Request
- Material Requests Management with Approval Matrix
- Generate Internal Transfer and Purchase Request based on MR

### Picking Waves
- Track and group Delivery Notes in Picking Waves
- Generate picking list based on the grouped delivery notes
- Mass update all deliveries of that picking wave

### Barcode & QR Code Management
- SKU / lot number / serial number Printout in master data & during receiving
- Barcode Serializer to auto generate SKU / lot number / serial number
- Serializer Rules can be set per product category
- Barcode Scanning with Camera

### Product Database Management
- Product Information: SKU, Item Name, Variants, Attributes, Vendor Tagging, Lifetime, Historical Transactions, UOM, Etc
- Unlimited Product Category Management
- Product Costing Management: Standard, FIFO, and Average

### Inventory Reports
- Operations Report: Inventory Report, Operations Analysis, Forecasted Inventory, Fulfillment Analysis, Returned Product, Stock per-Warehouse
- Inventory Control Report: Product Moves, Stock Reservation, Inventory In Transit, Stock Card, Inventory Adjustment Report
- Tracking Report: Expiring & Expired Stocks, Inventory Age Analysis, Inventory Age Breakdown Analysis
- Inventory Analysis: Turnover Analysis, Inventory Demand Forecast Analysis, Overstock Analysis, FSN Analysis, XYZ Analysis, FSN-XYZ Analysis
- Warehouse Capacity Report
- Inventory Valuation Report
- Stock In/Out Report
- Moving Average Cost Report (Only Applicable if bought with Purchase)

### Reordering Rules & Replenishment Automation
- Define Min & Max qty rules for each product in each location
- Define actions to take for the trigger (PR, MR, RFQ, PO, Internal Transfer, & email)
- Use run rates per reordering rules based on past stock movement data to auto compute min and max level

### Operations Mobile App (Android)
- Receiving
- Internal Transfer
- Picking
- Delivery
- Stock take
- Stock Check
- Hybrid based connection (can work offline after initial connection)
- Online Signature for Delivery / Delivery Boy

### Packages
- Track types of packages / cartons
- Track packages in each warehouse that contains multiple items
- Packages can be unpacked to take out its items

## 5. Accounting Management
### Revenue, Account Receivable & Receipts Management
- Manage Customer Invoices
- Customer Down Payment & Deposit Management
- Multi Payment Registration per Customer Invoice
- Reconcile over / under payment amount with various accounts
- Manage Customer Debit Notes
- Manage Credit Note/Customer Refunds
- Offset Invoice with Credit Note Management
- Manage Other Income
- Customer Receipts Management from Single / Multiple Invoices
- Generate Statement of Account per Customer
- AR Exchange Management

### Expenses, Account Payables & Payment Voucher Management
- Vendor Bills Management
- Vendor Down Payment & Supplier Deposit Management
- Multi Payment Registration per Vendor Bills
- Manage Payment Vouchers to Single / Multiple Vendor Bills from a Single or Multiple Vendor
- Payment Voucher Approval Request
- Manage Other Expenses
- Debit Note Management
- Manage Supplier Deposit
- Payables per Vendor Report Generation
- AP Exchange Management

### GIRO
- Manage GIRO Payments from single / multiple invoice
- Update GIRO status: open, posted, cleared and rejected

### Bank & Cash Statements
- Cashbox & Bank Account Tracking & Ledger
- Internal Cash / Bank Transfer
- Bank Statement Import Reconciliation
- Multi Petty Cash Account Management

### Accrual & Amortization Accounting
- Accrued Revenue, Expenses, Receivables, and Payables
- Amortize Incoming & Outgoing Payments (Prepayments)

### Financial Reports
- Profit Loss Statement
- Balance Sheet
- Cash Flow Statement
- Tax Report
- General Ledger
- Trial Balance
- Partner Ledger
- Ageing Receivable Report
- Ageing Payable Report
- Journal Entries Pivot Table
- Invoices Pivot Analysis
- Ageing Partner Balance

### Accounting Configuration (Taxes, Ledgers, Payment Terms, Fiscal Periods)
- Manage Journals / Sub Ledgers
- Define accounts in Product Categories which is triggered for different types of transactions
- Payment Terms Management
- Manage Fiscal Years & Periods
- Track & manage customer taxes to pay
- Manage tax payments to government for VAT
- Manage different tax Fiscal Positions per customer & vendor for different tax applications

### Chart of Account & Journal Entries
- Journal Entries Tracking
- Journal Entries Reversal & Reversal Scheduling
- Auto Recurring Entries based on templates / models
- Chart of Accounts tracking
- Chart of Account Tags
- Parent Accounts for each account
- Manual payments & Invoice Matching

### Assets Management
- Manage asset categories
- Define accounts in asset categories for various triggers
- Assets Depreciation Tracking with Linear, Degressive & Double Declining Methods
- Track assets gross value, salvage value & residual value
- Asset Revaluation Management & Revaluation History Tracking
- Asset Disposal
- Assets Pivot Report

### Multi Currency
- Multi Currencies Settings and Manual Rate Update
- KMK Currency set up for Taxes
- Currency Revaluation to revalue open AP / AR
- Currency unrealized Gain / Loss
- Currency realized Gain / Loss
- Foreign Currency Invoice & Payments, with Realized & Unrealized Exchange Gain / Loss
- Foreign currency vendor bills from PO with rate difference
- Foreign currency PO with manual rate/rate from settings

### E-Faktur
- Manage E-Faktur Customer & Vendor Types
- Manage & Generate Nomor Seri Faktur Pajak
- Manual selection of Faktur Pajak / auto numbering of Faktur Pajak
- Combine multiple invoices to one Faktur Pajak
- Re-use Faktur Pajak for Cancelled Invoices
- Export Product & Partner for DJP
- Export Faktor Pajak Keluaran based on Period
- Export Faktor Pajak Masukan based on Period

### Bank Integration
- Bank Integration to BCA and CIMB
- BCA & CIMB : Send Payment, Sync Reconciliation, Pull Bank Mutation

### Petty Cash
- Petty Cash Tracking
- Petty Cash Top Up Management
- Petty Cash Expense Voucher Submission & Approval

### Analytic Accounting
- Analytic Accounting to Track Profit / Loss per Cost Center
- Analytic Accounts Tags Tracking
- Analytic Entries Tracking
- Financial Reports per Analytic Account Management

### Financial Ratios
- Analyze based on Periodic Range
- Liquidity Ratio: Current Ration, Quick Ratio, Net Working Capital Ratio, Cash Ratio
- Solvability Ratio: Debt to Asset Ratio, Debt to Equity Ratio, Long Term Debt to Equity Ratio, Times Interest Earned Ratio, EBITDA
- Profitability Ratio: Return on Asset, Return on Equity, Net Profit Margin, Gross Profit Margin
- Activity Ratio: Account Receivable Turnover Ratio, Merchandise Inventory Turnover Ratio
- Print Financial Ratio Report / Export to Excel

### Budget
- Budget Set Up per Budgetary Position (Group of Accounts)
- Analytic Account Budget to Manage Budget per Cost Center
- Budgetary Positions to Define the Accounts to Budget
- Analytic Account Budget Request with Approval Matrix
- Budget Plan vs Actual Pivot Analysis
- Analytic Account Budget Plan vs Actual Pivot Analysis
- Budget Analysis Pivot Report
- Analytic Budget Pivot Analysis to analyze budgets per Analytic Accounts

### Multi-Level Analytic Accounting
- Multi Level Analytical / Cost Center Analysis in Profit Loss & Balance Sheet
- Analytic Category, Distribution & Priority set up for Multi Level Analytical Analysis

## 6. Purchase Management
### Purchase Dashboard
- Request for Quotation
- Create Draft RFQ and Convert to PO
- Send RFQ to Multiple Vendors via Email
- RFQ Comparison

### Purchase Order
- Multiple PO Types: Goods, Services, and Assets
- Purchase Order Expiry Tracking
- Schedule Multiple Deliveries per Date and Warehouse
- See the Last Purchased Price & Average Price per Product / Services
- Create Good Receiving Note for Goods
- Create Service Receiving Note for Services
- Create Asset Master During Receiving of Asset Purchase (Applicable with Asset Management Module)
- Global Discount / Discounts per Line in Fixed Amount / Percentage
- Limit Quantity Received Based on / over PO
- Track Purchased, Delivered, and Billed Quantity
- Purchase UoM & MoQ Management
- Purchase Terms & Conditions

### Vendors Management
- Vendors & Contact Person Management
- Vendor Tagging
- Purchase Lead Time per Vendor Management
- Vendor Payment Terms Tracking

### Purchase Requests Management
- Approval Matrix PR per Branch, Quantity & Amount
- Purchase Request Status Report (RFQ, Tendered, Purchased, Received, Reference and Qty)
- See Current Qty in Warehouse (Applicable with Inventory Module)
- Purchase Request to RFQ
- Combine Multiple PR to one RFQ
- Split one PR to multiple RFQ
- Multiple Currency Options in Purchase Order
- Approval Matrix RFQ per Branch, Product Category, Quantity & Amount
- Landed Costs for Import Products in PO

### Purchase Direct
- Direct Purchasing without RFQ/PR flow if configured

### Vendors Pricelist Management
- Product MoQ & Pricing Management per Vendor
- Product & SKU Alias per Vendor
- Auto Update to RFQ / PO Based on Quantity & Vendor
- Vendor Pricelist Approval Matrix

### Procurement Analysis
- Purchase Analysis: Pivot, Details Report, Day Wise, Purchase Report by Purchase Representative
- Purchase Bill Summary & Bill Payment Report
- Purchase Request Analysis
- Vendor Purchase Analysis
- Top Vendors Analysis
- Product Analysis: Report by Product, Top Purchased products, Purchase Product Profit, by Product Category, Product Indent Analysis

### Purchase Tender Management
- Multiple RFQ Comparisons from various vendors
- Track Purchased Quantity
- Analytic Account / Cost Center Selection

### Blanket Order Management
- Track Purchased, Delivered, and Billed Quantity
- Track PO History
- Vendors Promotion Agreement (Reach a Target Get Free Items)
- Purchase Request to Blanket Order / Tender
- Combine multiple PR to one Blanket Order / Tender
- Split one PR to multiple Blanket Order / Tender

### E-Budgeting
- Parent & Child Budget Management
- Budget Code Management
- Budget Period Settings
- Budget Amount Management: Budgeted, Reserved, Spent, and Balance
- PR & PO linked to Budget
- Budget Analysis

## 7. Cloud & Licensing
- Server: Ubuntu, 4 Core, 8GB RAM, 100GB Storage
- Backups: 30 days retention
