// ============================================
// Purchase Order Template - Safe Version
// ============================================

// NATIVE FORMATTING HELPERS (No dependencies to avoid compilation errors)
#let format-num(val, decimal: ".", group: ",") = {
  let s = str(val)
  // Basic pass-through as Typst string manipulation is limited without regex plugin
  s 
}

#let safe-text(value, default: "") = {
  if value == none { default } else { str(value) }
}

#let format-currency(amount, currency: "USD") = {
  let amt = if type(amount) == none or amount == none { 0 } else { amount }
  let symbol = if currency == "USD" { "$" } else if currency == "EUR" { "€" } else if currency == "GBP" { "£" } else { currency + " " }
  symbol + format-num(amt, decimal: ".", group: ",")
}

// ============================================
// DATA INJECTION - Safe data access
// ============================================
#let json-data = sys.inputs.data
#let data = if json-data != none and json-data != "" {
  json.decode(json-data)
} else {
  json.decode("{\"po_number\":\"PO-ERROR-001\",\"date\":\"2025-01-30\",\"vendor\":{\"name\":\"ERROR: No Data\",\"address\":\"Please check data input\",\"tax_id\":\"N/A\",\"contact\":\"N/A\",\"email\":\"error@example.com\"},\"ship_to\":{\"warehouse\":\"ERROR\",\"address\":\"No data provided\"},\"line_items\":[{\"sku\":\"ERROR\",\"description\":\"No line items\",\"qty\":0,\"unit_price\":0,\"total\":0}],\"summary\":{\"subtotal\":0,\"tax_rate\":0,\"tax_amount\":0,\"total\":0,\"currency\":\"USD\",\"notes\":\"ERROR: Data not received\"}}")
}

// Safe field access helper
#let get-field(obj, field, default: "") = {
  if obj == none { return default }
  if type(obj) != dictionary { return default }
  obj.at(field, default: default)
}

// ============================================
// BRAND COLORS
// ============================================
#let brand-colors = (
  primary: rgb("#1a365d"),
  secondary: rgb("#2c5282"),
  accent: rgb("#3182ce"),
  text: rgb("#1a202c"),
  text-light: rgb("#4a5568"),
  border: rgb("#e2e8f0"),
  background: rgb("#f7fafc"),
  success: rgb("#38a169"),
  warning: rgb("#d69e2e"),
)

// ============================================
// DOCUMENT CONFIGURATION
// ============================================
// ============================================
// DOCUMENT CONFIGURATION
// ============================================

#let config = get-field(data, "config", default: (:))
#let print-decoration = get-field(config, "print_decoration", default: true)

#set page(
  paper: "a4",
  margin: if print-decoration { (top: 1.5cm, bottom: 2cm, left: 1.5cm, right: 1.5cm) } else { (top: 5cm, bottom: 2cm, left: 1.5cm, right: 1.5cm) },
  
  footer: if print-decoration {
    context {
      box(width: 100%, stroke: (top: 0.5pt + brand-colors.border), inset: (top: 8pt))[
        #grid(
          columns: (1fr, 1fr, 1fr),
          align(left)[#text(size: 7pt, fill: brand-colors.text-light)[Generated: #datetime.today().display("[year]-[month]-[day]")]],
          align(center)[#text(size: 7pt, fill: brand-colors.text-light)[Page #counter(page).display("1 of 1", both: true)]],
          align(right)[#text(size: 7pt, fill: brand-colors.text-light)[CONFIDENTIAL]]
        )
      ]
    }
  } else {
    none
  }
)

#set text(size: 10pt, fill: brand-colors.text, lang: "en")

// ============================================
// DATA EXTRACTION
// ============================================
#let po-number = get-field(data, "po_number", default: "N/A")
#let po-date = get-field(data, "date", default: "N/A")

#let vendor = get-field(data, "vendor", default: (:))
#let vendor-name = get-field(vendor, "name", default: "Unknown Vendor")
#let vendor-address = get-field(vendor, "address", default: "")
#let vendor-tax-id = get-field(vendor, "tax_id", default: "N/A")
#let vendor-contact = get-field(vendor, "contact", default: "N/A")
#let vendor-email = get-field(vendor, "email", default: "N/A")

#let ship-to = get-field(data, "ship_to", default: (:))
#let ship-warehouse = get-field(ship-to, "warehouse", default: "Main Warehouse")
#let ship-address = get-field(ship-to, "address", default: "")

#let line-items = get-field(data, "line_items", default: ())

#let summary = get-field(data, "summary", default: (:))
#let subtotal = get-field(summary, "subtotal", default: 0)
#let subtotal-formatted = get-field(summary, "subtotal_formatted", default: format-currency(subtotal, currency: "IDR"))
#let tax-rate = get-field(summary, "tax_rate", default: 11)
#let tax-amount = get-field(summary, "tax_amount", default: 0)
#let tax-formatted = get-field(summary, "tax_formatted", default: format-currency(tax-amount, currency: "IDR"))
#let total = get-field(summary, "total", default: 0)
#let total-formatted = get-field(summary, "total_formatted", default: format-currency(total, currency: "IDR"))
#let currency = get-field(summary, "currency", default: "IDR")
#let notes = get-field(summary, "notes", default: "")
#let discount = get-field(summary, "discount", default: 0)

// Helper to format address
#let format-address(addr) = {
  if addr == none or addr == "" { "N/A" } else { addr }
}

// ============================================
// DOCUMENT HEADER
// ============================================
#if print-decoration [
  #box(width: 100%, inset: (bottom: 16pt), stroke: (bottom: 2pt + brand-colors.primary))[
    #grid(
      columns: (1fr, auto),
      gutter: 16pt,
      align(left)[
        #text(size: 16pt, weight: "bold", fill: brand-colors.primary)[PURCHASE ORDER]
      ],
      align(right)[
        #grid(
          columns: (auto, auto),
          column-gutter: 16pt,
          row-gutter: 4pt,
          align(right)[#text(fill: brand-colors.text-light)[PO Number:]], align(left)[#text(weight: "bold")[#po-number]],
          align(right)[#text(fill: brand-colors.text-light)[Date:]], align(left)[#po-date],
          align(right)[#text(fill: brand-colors.text-light)[Currency:]], align(left)[#currency]
        )
      ]
    )
  ]
] else [
  // Plain Header (Just PO info, no fancy box or title if pre-printed)
  // Actually, PO Number and Date might need to be printed EVEN on COP paper, but positioned carefully.
  // Usually COP has Logo on left/center.
  // We'll print the PO info cleanly.
  #align(right)[
    #grid(
          columns: (auto, auto),
          column-gutter: 16pt,
          row-gutter: 4pt,
          align(right)[#text(fill: brand-colors.text-light)[PO Number:]], align(left)[#text(weight: "bold")[#po-number]],
          align(right)[#text(fill: brand-colors.text-light)[Date:]], align(left)[#po-date]
    )
  ]
  #v(1cm)
]

// ============================================
// VENDOR & SHIP TO
// ============================================
#v(16pt)
#grid(
  columns: (1fr, 1fr),
  gutter: 24pt,
  box(fill: if print-decoration { brand-colors.background } else { white }, radius: 4pt, inset: 12pt, width: 100%, stroke: if print-decoration { none } else { 0.5pt + brand-colors.border })[
    #text(size: 8pt, fill: brand-colors.text-light, upper("Vendor"))
    #v(4pt)
    #text(size: 12pt, weight: "bold")[#vendor-name]
    #v(4pt)
    #text(size: 9pt)[#format-address(vendor-address)]
    #v(4pt)
    #text(size: 8pt, fill: brand-colors.text-light)[Tax ID: #vendor-tax-id]
    #v(2pt)
    #text(size: 8pt, fill: brand-colors.text-light)[Contact: #vendor-contact | #link("mailto:" + vendor-email)[#vendor-email]]
  ],
  box(fill: if print-decoration { brand-colors.background } else { white }, radius: 4pt, inset: 12pt, width: 100%, stroke: if print-decoration { none } else { 0.5pt + brand-colors.border })[
    #text(size: 8pt, fill: brand-colors.text-light, upper("Ship To"))
    #v(4pt)
    #text(size: 12pt, weight: "bold")[#ship-warehouse]
    #v(4pt)
    #text(size: 9pt)[#format-address(ship-address)]
  ]
)

// ============================================
// LINE ITEMS TABLE
// ============================================
#v(24pt)
#text(size: 10pt, weight: "bold", fill: brand-colors.primary)[Line Items]
#v(8pt)

#table(
  columns: (auto, 1fr, auto, auto, auto),
  fill: (x, y) => if y == 0 { if print-decoration { brand-colors.primary } else { rgb(220, 220, 220) } } else { white },
  align: (x, y) => if y == 0 { center + horizon } else if x == 1 { left + horizon } else { right + horizon },
  inset: (x, y) => if y == 0 { (x: 8pt, y: 10pt) } else { (x: 8pt, y: 8pt) },
  stroke: (x, y) => if y == 0 { none } else { (top: 0.5pt + brand-colors.border) },
  text(size: 8pt, weight: "bold", fill: if print-decoration { white } else { black }, upper("SKU")),
  text(size: 8pt, weight: "bold", fill: if print-decoration { white } else { black }, upper("Description")),
  text(size: 8pt, weight: "bold", fill: if print-decoration { white } else { black }, upper("Qty")),
  text(size: 8pt, weight: "bold", fill: if print-decoration { white } else { black }, upper("Unit Price")),
  text(size: 8pt, weight: "bold", fill: if print-decoration { white } else { black }, upper("Total")),
  
  ..if line-items.len() > 0 {
    for item in line-items {
      let sku = get-field(item, "sku", default: "N/A")
      let desc = get-field(item, "description", default: "No description")
      let qty = get-field(item, "qty", default: 0)
      let price = get-field(item, "unit_price", default: 0)
      let price-formatted = get-field(item, "unit_price_formatted", default: format-currency(price, currency: currency))

      let total-line = get-field(item, "total", default: 0)
      let total-line-formatted = get-field(item, "total_formatted", default: format-currency(total-line, currency: currency))
      
      (
        text(size: 9pt)[#sku],
        text(size: 9pt)[#desc],
        text(size: 9pt)[#format-num(qty)],
        text(size: 9pt)[#price-formatted],
        text(size: 9pt, weight: "bold")[#total-line-formatted]
      )
    }
  } else {
    (
      text(size: 9pt)[N/A],
      text(size: 9pt)[No items],
      text(size: 9pt)[0],
      text(size: 9pt)[#format-currency(0, currency: currency)],
      text(size: 9pt)[#format-currency(0, currency: currency)]
    )
  }
)

// ============================================
// SUMMARY
// ============================================
#v(24pt)
#align(right)[
  #box(width: 50%)[
    #grid(
      columns: (1fr, auto),
      column-gutter: 24pt,
      row-gutter: 8pt,
      align(right)[#text(fill: brand-colors.text-light)[Subtotal:]],
      align(right)[#subtotal-formatted],
      
      ..if discount != none and discount > 0 {
        (align(right)[#text(fill: brand-colors.text-light)[Discount:]], align(right)[#text(fill: brand-colors.success)[-#format-currency(discount, currency: currency)]])
      } else { () },
      
      align(right)[#text(fill: brand-colors.text-light)[Tax (#tax-rate%):]],
      align(right)[#tax-formatted],
      
      grid.cell(colspan: 2, line(length: 100%, stroke: 1pt + brand-colors.border)),
      
      align(right)[#text(size: 12pt, weight: "bold", fill: brand-colors.primary)[Total:]],
      align(right)[#text(size: 14pt, weight: "bold", fill: brand-colors.primary)[#total-formatted]]
    )
  ]
]

// ============================================
// NOTES & QR CODE
// ============================================
#v(24pt)
#grid(
  columns: (2fr, 1fr),
  gutter: 24pt,
  box(stroke: (left: 3pt + brand-colors.accent), inset: (left: 12pt))[
    #text(size: 8pt, fill: brand-colors.text-light, upper("Notes & Instructions"))
    #v(4pt)
    #text(size: 9pt)[#notes]
  ],
  align(center)[
    #text(size: 7pt, fill: brand-colors.text-light)[Scan to verify]
    #v(4pt)
    // #qr-code("PO:" + po-number + ":" + po-date, width: 2.5cm)
    #text(size: 8pt)[(QR Code Placeholder)]
  ]
)

// ============================================
// AUTHORIZATION
// ============================================
#v(32pt)
#grid(
  columns: (1fr, 1fr, 1fr),
  gutter: 32pt,
  align(left)[#line(length: 60%) #v(4pt) #text(size: 8pt, fill: brand-colors.text-light)[Requested By]],
  align(left)[#line(length: 60%) #v(4pt) #text(size: 8pt, fill: brand-colors.text-light)[Approved By]],
  align(left)[#line(length: 60%) #v(4pt) #text(size: 8pt, fill: brand-colors.text-light)[Date]]
)

// ============================================
// TERMS
// ============================================
#v(24pt)
#text(size: 7pt, fill: brand-colors.text-light)[*Terms & Conditions:* Payment due within 30 days of invoice date. Late payments subject to 1.5% monthly service charge. All sales final. Returns accepted only with prior authorization within 14 days of receipt.]
