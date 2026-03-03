// ============================================
// SURAT PERINTAH KERJA (SPK) — Production Run
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
  json.decode("{\"spk_number\":\"ERR\",\"product_name\":\"ERROR\",\"steps\":[],\"items\":[]}")
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
  margin: (top: 2.5cm, bottom: 2cm, left: 2cm, right: 2cm),
  header: context {
    if counter(page).get().first() > 1 [
      #set text(8pt, fill: gray)
      SPK #get-field(data, "spk_number") — #get-field(data, "product_name")
      #h(1fr)
      Halaman #counter(page).display()
    ]
  },
  footer: [
    #set text(7pt, fill: gray)
    #h(1fr) Dicetak dari ERP System — #get-field(data, "print_date") #h(1fr)
  ]
)

#set text(size: 10pt)

// ============================================
// HEADER / KOP SURAT
// ============================================
#let company = get-field(data, "company", default: (:))

#align(center)[
  #text(14pt, weight: "bold")[#get-field(company, "name", default: "PT PERUSAHAAN")]
  #v(0.1cm)
  #text(9pt, fill: gray)[#get-field(company, "address", default: "")]
  #v(0.05cm)
  #text(9pt, fill: gray)[#get-field(company, "contact", default: "")]
]

#v(0.3cm)
#line(length: 100%, stroke: 2pt + black)
#v(0.1cm)
#line(length: 100%, stroke: 0.5pt + black)
#v(0.4cm)

// ============================================
// TITLE
// ============================================
#align(center)[
  #text(16pt, weight: "black", tracking: 0.1em)[SURAT PERINTAH KERJA]
  #v(0.1cm)
  #text(11pt)[Nomor: #get-field(data, "spk_number")]
]
#v(0.5cm)

// ============================================
// PRODUCT INFO
// ============================================
#text(11pt, weight: "bold")[1. Informasi Produk]
#v(0.2cm)

#table(
  columns: (3.5cm, auto),
  stroke: none,
  inset: 4pt,
  [Nama Produk], [: *#get-field(data, "product_name")*],
  [Kode Produk], [: #get-field(data, "product_code")],
  [Versi BOM], [: #get-field(data, "bom_version")],
  [Target Produksi], [: *#get-field(data, "total_qty") pcs*],
  [Tanggal SPK], [: #get-field(data, "spk_date")],
  [Batas Waktu], [: #get-field(data, "due_date", default: "-")],
  [Prioritas], [: #get-field(data, "priority", default: "NORMAL")],
)

#v(0.4cm)

// ============================================
// MATERIAL (BOM ITEMS)
// ============================================
#text(11pt, weight: "bold")[2. Kebutuhan Material]
#v(0.2cm)

#let items = get-field(data, "items", default: ())
#if items.len() > 0 [
  #table(
    columns: (auto, 1fr, auto, auto, auto, auto),
    stroke: 0.5pt + black,
    inset: 6pt,
    fill: (x, y) => if y == 0 { luma(220) },
    [*No*], [*Material*], [*Kode*], [*Qty/Unit*], [*Waste*], [*Satuan*],
    ..items.enumerate().map(((i, item)) => (
      str(i + 1),
      get-field(item, "name"),
      get-field(item, "code", default: "-"),
      get-field(item, "qty_per_unit", default: "-"),
      get-field(item, "waste_pct", default: "0") + "%",
      get-field(item, "unit", default: "-"),
    )).flatten()
  )

  #let total_material = get-field(data, "total_material_qty", default: "")
  #if total_material != "" [
    #v(0.1cm)
    #text(9pt, fill: gray)[Total kebutuhan material dihitung berdasarkan target produksi #get-field(data, "total_qty") pcs termasuk waste.]
  ]
] else [
  #text(fill: gray)[Tidak ada material.]
]

#v(0.4cm)

// ============================================
// ALUR PRODUKSI (PRODUCTION STEPS)
// ============================================
#text(11pt, weight: "bold")[3. Alur Proses Produksi]
#v(0.2cm)

#let steps = get-field(data, "steps", default: ())
#if steps.len() > 0 [
  #for step in steps [
    #block(
      width: 100%,
      stroke: (left: 3pt + black, top: 0.5pt + luma(200), bottom: 0.5pt + luma(200), right: 0.5pt + luma(200)),
      inset: 10pt,
    )[
      #grid(
        columns: (auto, 1fr, auto),
        gutter: 8pt,
        [
          #box(
            fill: black,
            inset: (x: 6pt, y: 3pt),
          )[#text(fill: white, weight: "bold", size: 9pt)[#get-field(step, "sequence")]]
        ],
        [
          #text(11pt, weight: "bold")[#get-field(step, "station_name")]
          #h(0.5cm)
          #text(9pt, fill: gray)[#get-field(step, "station_type")]
        ],
        [
          #text(9pt, weight: "bold")[#get-field(step, "operation_label")]
        ],
      )

      #if get-field(step, "subcontractor", default: "") != "" [
        #v(0.1cm)
        #text(9pt)[Subkontraktor: *#get-field(step, "subcontractor")*]
      ]

      #if get-field(step, "duration", default: "") != "" [
        #text(9pt)[ · Durasi: #get-field(step, "duration") menit]
      ]

      // Materials for this step
      #let materials = get-field(step, "materials", default: ())
      #if materials.len() > 0 [
        #v(0.15cm)
        #text(9pt, weight: "bold")[Material:]
        #for m in materials [
          #text(9pt)[ · #get-field(m, "name") (#get-field(m, "qty", default: "-") #get-field(m, "unit", default: ""))]
        ]
      ]

      // Allocations (subkon)
      #let allocations = get-field(step, "allocations", default: ())
      #if allocations.len() > 0 [
        #v(0.1cm)
        #text(9pt, weight: "bold")[Alokasi:]
        #for alloc in allocations [
          #text(9pt)[ · #get-field(alloc, "station_name"): #get-field(alloc, "quantity") pcs]
        ]
      ]
    ]
    #v(0.2cm)
  ]
] else [
  #text(fill: gray)[Belum ada langkah proses.]
]

#v(0.4cm)

// ============================================
// RINGKASAN BIAYA
// ============================================
#text(11pt, weight: "bold")[4. Ringkasan Biaya]
#v(0.2cm)

#let summary = get-field(data, "summary", default: (:))
#table(
  columns: (1fr, auto),
  stroke: 0.5pt + black,
  inset: 8pt,
  fill: (x, y) => if y >= 2 { luma(240) },
  [Biaya Material per Unit], [#get-field(summary, "material_cost_per_unit", default: "Rp 0")],
  [Biaya Proses per Unit], [#get-field(summary, "labor_cost_per_unit", default: "Rp 0")],
  [*Total HPP per Unit*], [*#get-field(summary, "cost_per_unit", default: "Rp 0")*],
  [*Total Biaya Produksi (#get-field(data, "total_qty") pcs)*], [*#get-field(summary, "total_cost", default: "Rp 0")*],
)

#v(0.4cm)

// ============================================
// CATATAN
// ============================================
#let notes = get-field(data, "notes", default: "")
#if notes != "" [
  #text(11pt, weight: "bold")[5. Catatan]
  #v(0.2cm)
  #block(
    width: 100%,
    stroke: 0.5pt + luma(200),
    inset: 10pt,
    fill: luma(250),
  )[#text(9pt)[#notes]]
  #v(0.4cm)
]

// ============================================
// TANDA TANGAN
// ============================================
#v(1cm)

#text(9pt, fill: gray)[Demikian Surat Perintah Kerja ini dibuat untuk dilaksanakan dengan sebaik-baiknya.]
#v(0.5cm)

#let sign_date = get-field(data, "spk_date", default: "-")
#text(10pt)[#get-field(company, "city", default: ""), #sign_date]
#v(0.5cm)

#grid(
  columns: (1fr, 1fr),
  gutter: 2cm,
  [
    #align(center)[
      #text(10pt, weight: "bold")[Pemberi Perintah,]
      #v(2.5cm)
      #line(length: 80%, stroke: 0.5pt + black)
      #v(0.1cm)
      #text(9pt)[Kepala Produksi]
    ]
  ],
  [
    #align(center)[
      #text(10pt, weight: "bold")[Mengetahui,]
      #v(2.5cm)
      #line(length: 80%, stroke: 0.5pt + black)
      #v(0.1cm)
      #text(9pt)[Direktur / GM]
    ]
  ],
)
