// ============================================
// Production BOM Report Template
// ============================================

#let safe-text(value, default: "") = {
  if value == none { default } else { str(value) }
}

#let format-currency(amount) = {
  let amt = if amount == none { 0 } else { amount }
  "Rp " + str(amt)
}

// ============================================
// DATA INJECTION
// ============================================
#let json-data = sys.inputs.data
#let data = if json-data != none and json-data != "" {
  json.decode(json-data)
} else {
  json.decode("{\"product_name\":\"ERROR\",\"product_code\":\"ERR\",\"version\":\"v1\",\"total_qty\":0,\"steps\":[],\"items\":[],\"summary\":{}}")
}

#let get-field(obj, field, default: "") = {
  if obj == none { return default }
  if type(obj) != dictionary { return default }
  obj.at(field, default: default)
}

// ============================================
// PAGE SETUP
// ============================================
#set page(
  paper: "a4",
  margin: (top: 2cm, bottom: 2cm, left: 2cm, right: 2cm),
  header: context {
    if counter(page).get().first() > 1 [
      #set text(8pt, fill: gray)
      Production BOM — #get-field(data, "product_name") (#get-field(data, "version"))
      #h(1fr)
      Halaman #counter(page).display()
    ]
  },
  footer: [
    #set text(7pt, fill: gray)
    #h(1fr) Dicetak dari ERP System #h(1fr)
  ]
)

#set text(font: "Inter", size: 10pt)

// ============================================
// COVER
// ============================================
#align(center)[
  #text(18pt, weight: "black")[PRODUCTION BOM]
  #v(0.3cm)
  #text(14pt, weight: "bold")[#get-field(data, "product_name")]
  #v(0.2cm)
  #text(10pt, fill: gray)[#get-field(data, "product_code") — #get-field(data, "version")]
]

#v(0.5cm)

#table(
  columns: (1fr, 1fr, 1fr, 1fr),
  stroke: 0.5pt + gray,
  inset: 8pt,
  [*Total Produksi*], [*Material*], [*Proses*], [*Tanggal*],
  [#get-field(data, "total_qty", default: "0") pcs],
  [#get-field(get-field(data, "summary"), "material_count", default: "0") item],
  [#get-field(get-field(data, "summary"), "step_count", default: "0") step],
  [#get-field(data, "date", default: "-")],
)

#v(0.5cm)
#line(length: 100%, stroke: 1pt + black)
#v(0.3cm)

// ============================================
// PRODUCTION STEPS
// ============================================
#text(14pt, weight: "bold")[Alur Produksi]
#v(0.3cm)

#let steps = get-field(data, "steps", default: ())
#for step in steps [
  #block(
    width: 100%,
    stroke: 0.5pt + black,
    inset: 10pt,
    radius: 0pt,
  )[
    #text(11pt, weight: "bold")[Step #get-field(step, "sequence"): #get-field(step, "station_name")]
    #h(1fr)
    #text(9pt, fill: gray)[#get-field(step, "operation_type")]
    #v(0.2cm)

    #if get-field(step, "subcontractor", default: "") != "" [
      Subkontraktor: *#get-field(step, "subcontractor")*
      #v(0.1cm)
    ]

    #if get-field(step, "duration", default: "") != "" [
      Durasi: #get-field(step, "duration") menit
      #v(0.1cm)
    ]

    // Materials for this step
    #let materials = get-field(step, "materials", default: ())
    #if materials.len() > 0 [
      #v(0.2cm)
      #table(
        columns: (auto, 1fr, auto, auto),
        stroke: 0.5pt + gray,
        inset: 6pt,
        fill: (x, y) => if y == 0 { luma(240) },
        [*No*], [*Material*], [*Qty/Unit*], [*Unit*],
        ..materials.enumerate().map(((i, m)) => (
          str(i + 1),
          get-field(m, "name"),
          get-field(m, "qty", default: "-"),
          get-field(m, "unit", default: "-"),
        )).flatten()
      )
    ]

    // Allocations
    #let allocations = get-field(step, "allocations", default: ())
    #if allocations.len() > 0 [
      #v(0.2cm)
      #text(9pt, weight: "bold")[Alokasi Produksi:]
      #for alloc in allocations [
        - #get-field(alloc, "station_name"): *#get-field(alloc, "quantity")* pcs
      ]
    ]
  ]
  #v(0.3cm)
]

// ============================================
// MATERIAL SUMMARY
// ============================================
#v(0.5cm)
#text(14pt, weight: "bold")[Daftar Material Lengkap]
#v(0.3cm)

#let items = get-field(data, "items", default: ())
#table(
  columns: (auto, 1fr, auto, auto, auto, auto),
  stroke: 0.5pt + gray,
  inset: 6pt,
  fill: (x, y) => if y == 0 { luma(220) },
  [*No*], [*Material*], [*Qty/Unit*], [*Waste %*], [*Unit*], [*Harga*],
  ..items.enumerate().map(((i, item)) => (
    str(i + 1),
    get-field(item, "name"),
    get-field(item, "qty_per_unit", default: "-"),
    get-field(item, "waste_pct", default: "0") + "%",
    get-field(item, "unit", default: "-"),
    get-field(item, "cost", default: "-"),
  )).flatten()
)

// ============================================
// COST SUMMARY
// ============================================
#v(0.5cm)
#let summary = get-field(data, "summary", default: (:))
#table(
  columns: (1fr, auto),
  stroke: 0.5pt + gray,
  inset: 8pt,
  [Total Biaya Material], [#get-field(summary, "material_cost", default: "Rp 0")],
  [Total Biaya Proses], [#get-field(summary, "labor_cost", default: "Rp 0")],
  table.hline(stroke: 1pt),
  [*Total Biaya per Unit*], [*#get-field(summary, "cost_per_unit", default: "Rp 0")*],
  [*Total Biaya Produksi*], [*#get-field(summary, "total_cost", default: "Rp 0")*],
)
