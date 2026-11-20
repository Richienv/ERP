#set page(paper: "a4", margin: (x: 1.6cm, y: 1.6cm))
#set text(font: "Helvetica", size: 9pt)

#grid(columns: (1fr, auto),
  [#text(size: 14pt, weight: "bold")[CV SUMBER TEKNIK MOTOR] \
   Jl. Gunung Sahari Raya No. 45, Jakarta Pusat \
   Telp: (021) 555-0145 · NPWP: 01.234.567.8-901.000],
  align(right)[#text(size: 16pt, weight: "bold")[FAKTUR PENJUALAN]]
)

#v(10pt)
#grid(columns: (1fr, 1fr), gutter: 12pt,
  [*Kepada Yth:* \ PT Contoh Sparepart Nusantara \ Jl. Industri Raya No. 12, Jakarta Utara],
  [No. Faktur: INV/STM/2026/11/0457 \
   Tanggal: 12/11/2026 \
   Jatuh Tempo: 12/12/2026 \
   Termin: Net 30 \
   Mata Uang: IDR]
)

#v(12pt)
#table(
  columns: (auto, auto, 1fr, auto, auto, auto, auto, auto),
  stroke: 0.5pt,
  align: (center, left, left, right, left, right, right, right),
  [*No*], [*Kode Barang*], [*Nama Barang*], [*Qty*], [*Satuan*], [*Harga Satuan*], [*Disc*], [*Jumlah*],
  [1], [MZ690070], [Filter Oli Mitsubishi L200], [24], [PCS], [85.000], [0%], [2.040.000],
  [2], [1770A033], [Filter Solar L200], [12], [PCS], [165.000], [0%], [1.980.000],
  [3], [4605A558], [Kampas Rem Depan L200], [10], [SET], [425.000], [5%], [4.037.500],
  [4], [MR968274], [Filter Udara L200], [15], [PCS], [120.000], [0%], [1.800.000],
)

#v(6pt)
#align(right)[
  #table(columns: (auto, auto), stroke: none, align: (right, right),
    [Subtotal:], [Rp 9.857.500],
    [PPN 11%:], [Rp 1.084.325],
    [*Total:*], [*Rp 10.941.825*],
  )
]

#v(8pt)
Terbilang: Sepuluh juta sembilan ratus empat puluh satu ribu delapan ratus dua puluh lima rupiah

#v(10pt)
Pembayaran ke: BCA 123-456-7890 a.n. CV Sumber Teknik Motor

#v(30pt)
#text(size: 7pt, fill: gray)[Contoh dokumen untuk pengujian software. Bukan faktur asli.]
