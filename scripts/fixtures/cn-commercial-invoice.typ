#set page(paper: "a4", margin: (x: 1.6cm, y: 1.6cm))
#set text(font: "Helvetica", size: 9pt)

#grid(columns: (1fr, auto),
  [#text(size: 14pt, weight: "bold")[GUANGZHOU RUIXIANG AUTO PARTS CO., LTD.] \
   No. 88 Jichang Road, Baiyun District, Guangzhou, China \
   Tel: +86 20 8888 0000 · Email: sales\@ruixiang-parts.example],
  align(right)[#text(size: 16pt, weight: "bold")[COMMERCIAL INVOICE]]
)

#v(10pt)
#grid(columns: (1fr, 1fr), gutter: 12pt,
  [*Bill To:* \ PT Contoh Sparepart Nusantara \ Jl. Industri Raya No. 12, Jakarta Utara \ Indonesia],
  [Invoice No.: RX-2026-1108 \
   Invoice Date: 2026-11-08 \
   PO Ref: PO-SP-0012 \
   Payment Terms: T/T 30% deposit, 70% before shipment \
   Currency: RMB \
   Shipment: FOB Guangzhou, by sea]
)

#v(12pt)
#table(
  columns: (auto, auto, 1fr, auto, auto, auto),
  stroke: 0.5pt,
  align: (center, left, left, right, right, right),
  [*No.*], [*OE Number*], [*Description*], [*Qty*], [*Unit Price (RMB)*], [*Amount (RMB)*],
  [1], [2304A078], [COVER ASSY,CLUTCH], [100 PCS], [180.00], [18,000.00],
  [2], [2301A084], [DISC,CLUTCH], [100 PCS], [115.00], [11,500.00],
  [3], [MN171419], [BEARING, CLUTCH RELEASE], [200 PCS], [45.00], [9,000.00],
  [4], [1460A037], [DIESEL PUMP VACUUM PRESSURE \ VALVE], [80 PCS], [125.00], [10,000.00],
  [5], [1465A041], [INJECTOR ASSEMBLY/FUEL], [50 PCS], [585.00], [29,250.00],
  [6], [MR985041], [ECCENTRIC SHAFT POSITION SENSOR], [100 PCS], [55.00], [5,500.00],
  [7], [2324A080], [CYL,CLT RELEASE CONCENTRIC], [60 PCS], [90.00], [5,400.00],
)

#v(6pt)
#align(right)[
  #table(columns: (auto, auto), stroke: none, align: (right, right),
    [Sub Total:], [88,650.00],
    [Freight:], [0.00],
    [*TOTAL AMOUNT (RMB):*], [*88,650.00*],
  )
]

#v(8pt)
SAY TOTAL: RMB EIGHTY EIGHT THOUSAND SIX HUNDRED FIFTY ONLY

#v(10pt)
*Bank Information:* Bank of China, Guangzhou Branch · SWIFT: BKCHCNBJ400 · A/C: 6000 0000 0000 0000

#v(30pt)
#text(size: 7pt, fill: gray)[Sample document generated for software testing. Not a real invoice.]
