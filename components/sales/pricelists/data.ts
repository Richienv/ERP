
export const mockPriceLists = [
    {
        id: "PL-001",
        code: "PL-SUMMER-24",
        name: "Koleksi Musim Panas 2024",
        description: "Harga ritel standar untuk musim panas mendatang. Termasuk kain cerah dan bahan campuran ringan.",
        currency: "IDR",
        itemCount: 45,
        status: "ACTIVE",
        lastUpdated: new Date("2024-06-15"),
        coverColor: "bg-yellow-400",
        items: [
            { name: "Cotton Combed 30s", price: 125000 },
            { name: "Rayon Viscose", price: 95000 },
            { name: "Linen Pure", price: 150000 },
            { name: "Bamboo Jersey", price: 135000 },
        ]
    },
    {
        id: "PL-002",
        code: "PL-DISTRIBUTOR-VIP",
        name: "Distributor VIP",
        description: "Tarif diskon khusus untuk Distributor Tingkat 1. Memerlukan MOQ 500 yard.",
        currency: "IDR",
        itemCount: 120,
        status: "ACTIVE",
        lastUpdated: new Date("2024-01-10"),
        coverColor: "bg-black text-white",
        items: [
            { name: "Cotton Combed 30s", price: 110000 },
            { name: "Rayon Viscose", price: 85000 },
            { name: "Linen Pure", price: 135000 },
            { name: "Polyester Blend", price: 45000 },
        ]
    },
    {
        id: "PL-003",
        code: "PL-CLEARANCE",
        name: "Cuci Gudang Akhir Tahun",
        description: "Obral penghabisan stok barang 2023. Harga berlaku selama persediaan masih ada.",
        currency: "IDR",
        itemCount: 15,
        status: "INACTIVE",
        lastUpdated: new Date("2023-12-01"),
        coverColor: "bg-red-500 text-white",
        items: [
            { name: "Stok Lama Cotton", price: 65000 },
            { name: "Kain Defect Minor", price: 40000 },
        ]
    },
    {
        id: "PL-004",
        code: "PL-PROMO-LEBARAN",
        name: "Promo Spesial Lebaran",
        description: "Spesial musim liburan dengan fokus pada kain sutra premium dan bordir.",
        currency: "IDR",
        itemCount: 30,
        status: "DRAFT",
        lastUpdated: new Date("2024-07-01"),
        coverColor: "bg-green-600 text-white",
        items: [
            { name: "Silk Satin Premium", price: 180000 },
            { name: "Jacquard Gold", price: 210000 },
        ]
    },
    {
        id: "PL-005",
        code: "PL-EXPORT-USD",
        name: "Ekspor (USD) - Pasar AS",
        description: "Penetapan harga untuk mitra Amerika Serikat, termasuk penyangga biaya pengiriman.",
        currency: "USD",
        itemCount: 80,
        status: "ACTIVE",
        lastUpdated: new Date("2024-05-20"),
        coverColor: "bg-blue-600 text-white",
        items: [
            { name: "Cotton Combed 30s", price: 8.5 },
            { name: "Bamboo Jersey", price: 9.2 },
        ]
    }
];
