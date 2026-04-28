// ============================================
// Invoice (Faktur) Template
// Indonesian Commercial Invoice
// ============================================

#let safe-text(value, default: "") = {
  if value == none { default } else { str(value) }
}

#let format-num(val) = {
  if val == none { "0" } else { str(val) }
}

// ============================================
// DATA INJECTION
// ============================================
#let json-data = sys.inputs.data
#let data = if json-data != none and json-data != "" {
  json.decode(json-data)
} else {
  json.decode("{\"number\":\"INV-000\",\"status\":\"DRAFT\",\"type\":\"INV_OUT\",\"issue_date\":\"\",\"due_date\":\"\",\"seller\":{\"name\":\"ERROR\",\"npwp\":\"\",\"address\":\"\"},\"buyer\":{\"name\":\"ERROR\",\"npwp\":\"\",\"address\":\"\"},\"items\":[],\"summary\":{\"dpp\":\"0\",\"ppn\":\"0\",\"discount\":\"0\",\"total\":\"0\"},\"payment\":{}}")
}

#let get-field(obj, field, default: "") = {
  if obj == none { return default }
  if type(obj) != dictionary { return default }
  obj.at(field, default: default)
}

// ============================================
// SHARED BRAND MODULE
// ============================================
#import "../_shared/brand.typ": header, footer, brand-color, brand-muted

// ============================================
// PAGE SETUP
// ============================================
#set page(
  paper: "a4",
  margin: (top: 2cm, bottom: 2.5cm, left: 1.5cm, right: 1.5cm),
  footer: footer(label: get-field(data, "number", default: "")),
)

#set text(font: "Inter", size: 9pt, fill: rgb("#1a202c"))

#let colors = (
  primary: rgb("#1a365d"),
  accent: rgb("#2b6cb0"),
  text-light: rgb("#4a5568"),
  border: rgb("#cbd5e0"),
  bg-light: rgb("#f7fafc"),
  bg-header: rgb("#ebf4ff"),
  danger: rgb("#e53e3e"),
)

// ============================================
// DRAFT WATERMARK
// ============================================
#let status = get-field(data, "status", default: "")
#if status == "DRAFT" {
  place(
    center + horizon,
    rotate(
      -45deg,
      text(size: 72pt, weight: "black", fill: rgb("#e2e8f0").transparentize(40%))[DRAFT]
    ),
  )
}

// ============================================
// HEADER
// ============================================
#header()
#v(12pt)

#align(center)[
  #text(size: 18pt, weight: "black", fill: colors.primary)[FAKTUR]
  #v(6pt)
  #rect(
    fill: colors.bg-header,
    stroke: 1pt + colors.primary,
    inset: 8pt,
    radius: 2pt,
  )[
    #grid(
      columns: (1fr, 1fr, 1fr),
      gutter: 4pt,
      align(center)[
        #text(size: 8pt, fill: colors.text-light)[No. Faktur]
        #v(2pt)
        #text(size: 10pt, weight: "bold", font: "Courier New")[#safe-text(get-field(data, "number"))]
      ],
      align(center)[
        #text(size: 8pt, fill: colors.text-light)[Tanggal Terbit]
        #v(2pt)
        #text(size: 9pt, weight: "bold")[#safe-text(get-field(data, "issue_date"))]
      ],
      align(center)[
        #text(size: 8pt, fill: colors.text-light)[Jatuh Tempo]
        #v(2pt)
        #text(size: 9pt, weight: "bold", fill: colors.danger)[#safe-text(get-field(data, "due_date"))]
      ],
    )
  ]
]

#v(8pt)
#line(length: 100%, stroke: 1.5pt + colors.primary)
#v(12pt)

// ============================================
// SELLER (Penjual)
// ============================================
#let seller = get-field(data, "seller", default: (:))

#rect(
  width: 100%,
  stroke: 0.5pt + colors.border,
  inset: 10pt,
)[
  #text(size: 8pt, weight: "bold", fill: colors.accent)[PENJUAL]
  #v(6pt)
  #grid(
    columns: (80pt, auto),
    gutter: 4pt,
    text(size: 9pt, fill: colors.text-light)[Nama],
    text(size: 9pt, weight: "bold")[: #safe-text(get-field(seller, "name"))],
    text(size: 9pt, fill: colors.text-light)[NPWP],
    text(size: 9pt, weight: "bold", font: "Courier New")[: #safe-text(get-field(seller, "npwp"))],
    text(size: 9pt, fill: colors.text-light)[Alamat],
    text(size: 9pt)[: #safe-text(get-field(seller, "address"))],
  )
]

#v(6pt)

// ============================================
// BUYER (Pembeli)
// ============================================
#let buyer = get-field(data, "buyer", default: (:))

#rect(
  width: 100%,
  stroke: 0.5pt + colors.border,
  inset: 10pt,
)[
  #text(size: 8pt, weight: "bold", fill: colors.accent)[PEMBELI]
  #v(6pt)
  #grid(
    columns: (80pt, auto),
    gutter: 4pt,
    text(size: 9pt, fill: colors.text-light)[Nama],
    text(size: 9pt, weight: "bold")[: #safe-text(get-field(buyer, "name"))],
    text(size: 9pt, fill: colors.text-light)[NPWP],
    text(size: 9pt, weight: "bold", font: "Courier New")[: #safe-text(get-field(buyer, "npwp"))],
    text(size: 9pt, fill: colors.text-light)[Alamat],
    text(size: 9pt)[: #safe-text(get-field(buyer, "address"))],
  )
]

#v(12pt)

// ============================================
// ITEMS TABLE
// ============================================
#let items = get-field(data, "items", default: ())

#table(
  columns: (auto, 1fr, auto, auto, auto),
  stroke: 0.5pt + colors.border,
  fill: (col, row) => if row == 0 { colors.primary } else if calc.rem(row, 2) == 0 { colors.bg-light } else { white },

  text(size: 8pt, weight: "bold", fill: white)[No.],
  text(size: 8pt, weight: "bold", fill: white)[Deskripsi],
  text(size: 8pt, weight: "bold", fill: white)[Qty],
  text(size: 8pt, weight: "bold", fill: white)[Harga Satuan],
  text(size: 8pt, weight: "bold", fill: white)[Jumlah],

  ..items.enumerate().map(((idx, item)) => {
    (
      text(size: 9pt)[#{idx + 1}],
      {
        let desc = safe-text(get-field(item, "description"))
        let code = safe-text(get-field(item, "code"))
        if code != "" {
          [#text(size: 9pt)[#desc] #text(size: 7pt, fill: colors.text-light)[(#code)]]
        } else {
          text(size: 9pt)[#desc]
        }
      },
      align(center, text(size: 9pt, weight: "bold")[#format-num(get-field(item, "qty"))]),
      align(right, text(size: 9pt, font: "Courier New")[Rp #safe-text(get-field(item, "unit_price"))]),
      align(right, text(size: 9pt, weight: "bold", font: "Courier New")[Rp #safe-text(get-field(item, "total"))]),
    )
  }).flatten()
)

#v(12pt)

// ============================================
// SUMMARY
// ============================================
#let summary = get-field(data, "summary", default: (:))

#align(right)[
  #rect(
    width: 50%,
    stroke: 0.5pt + colors.border,
    inset: 10pt,
  )[
    #grid(
      columns: (1fr, auto),
      gutter: 6pt,
      text(size: 9pt, fill: colors.text-light)[Dasar Pengenaan Pajak (DPP)],
      align(right, text(size: 9pt, font: "Courier New")[Rp #safe-text(get-field(summary, "dpp"))]),
      text(size: 9pt, fill: colors.text-light)[PPN (11%)],
      align(right, text(size: 9pt, font: "Courier New")[Rp #safe-text(get-field(summary, "ppn"))]),
      text(size: 9pt, fill: colors.text-light)[Diskon],
      align(right, text(size: 9pt, font: "Courier New")[\- Rp #safe-text(get-field(summary, "discount"))]),
      line(length: 100%, stroke: 1pt + colors.primary),
      [],
      text(size: 11pt, weight: "black")[Total],
      align(right, text(size: 11pt, weight: "black", font: "Courier New")[Rp #safe-text(get-field(summary, "total"))]),
    )
  ]
]

#v(12pt)

// ============================================
// PAYMENT INFO
// ============================================
#let payment = get-field(data, "payment", default: (:))
#let has-payment = get-field(payment, "bank") != "" or get-field(payment, "terms") != ""

#if has-payment {
  rect(
    width: 100%,
    stroke: 0.5pt + colors.border,
    inset: 10pt,
  )[
    #text(size: 8pt, weight: "bold", fill: colors.accent)[INFORMASI PEMBAYARAN]
    #v(6pt)
    #grid(
      columns: (100pt, auto),
      gutter: 4pt,
      text(size: 9pt, fill: colors.text-light)[Syarat Bayar],
      text(size: 9pt, weight: "bold")[: #safe-text(get-field(payment, "terms"))],
      text(size: 9pt, fill: colors.text-light)[Bank],
      text(size: 9pt, weight: "bold")[: #safe-text(get-field(payment, "bank"))],
      text(size: 9pt, fill: colors.text-light)[No. Rekening],
      text(size: 9pt, weight: "bold", font: "Courier New")[: #safe-text(get-field(payment, "account_number"))],
      text(size: 9pt, fill: colors.text-light)[Atas Nama],
      text(size: 9pt, weight: "bold")[: #safe-text(get-field(payment, "account_name"))],
    )
  ]
  v(12pt)
}

// ============================================
// SIGNATURES
// ============================================
#v(8pt)
#grid(
  columns: (1fr, 1fr),
  gutter: 20pt,
  [
    #align(center)[
      #text(size: 8pt, fill: colors.text-light)[#safe-text(get-field(data, "issue_date"))]
      #v(4pt)
      #text(size: 9pt, weight: "bold")[Penjual]
      #v(50pt)
      #line(length: 60%, stroke: 0.5pt + colors.border)
      #v(2pt)
      #text(size: 8pt)[#safe-text(get-field(seller, "name"))]
    ]
  ],
  [
    #align(center)[
      #v(4pt)
      #text(size: 9pt, weight: "bold")[Pembeli]
      #v(50pt)
      #line(length: 60%, stroke: 0.5pt + colors.border)
      #v(2pt)
      #text(size: 8pt)[#safe-text(get-field(buyer, "name"))]
    ]
  ],
)
