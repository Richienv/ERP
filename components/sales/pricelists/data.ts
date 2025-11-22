
export type PriceList = {
    id: string;
    code: string;
    name: string;
    description: string;
    currency: string;
    type: "SALES" | "PURCHASE";
    status: "ACTIVE" | "INACTIVE" | "DRAFT";
    validFrom?: Date;
    validTo?: Date;
    itemCount: number;
    lastUpdated: Date;
};

export const mockPriceLists: PriceList[] = [
    {
        id: "PL-001",
        code: "PL-RET-001",
        name: "Harga Retail Standar",
        description: "Daftar harga standar untuk pelanggan retail umum",
        currency: "IDR",
        type: "SALES",
        status: "ACTIVE",
        itemCount: 156,
        lastUpdated: new Date("2024-11-20"),
    },
    {
        id: "PL-002",
        code: "PL-WHS-001",
        name: "Harga Grosir (Wholesale)",
        description: "Harga khusus untuk pembelian dalam jumlah besar (>100 unit)",
        currency: "IDR",
        type: "SALES",
        status: "ACTIVE",
        itemCount: 142,
        lastUpdated: new Date("2024-11-18"),
    },
    {
        id: "PL-003",
        code: "PL-VIP-001",
        name: "Harga Member VIP",
        description: "Harga spesial untuk pelanggan dengan status VIP",
        currency: "IDR",
        type: "SALES",
        status: "ACTIVE",
        itemCount: 156,
        lastUpdated: new Date("2024-11-15"),
    },
    {
        id: "PL-004",
        code: "PL-DIST-001",
        name: "Harga Distributor Area Jawa",
        description: "Harga untuk distributor wilayah Jawa",
        currency: "IDR",
        type: "SALES",
        status: "DRAFT",
        itemCount: 0,
        lastUpdated: new Date("2024-11-21"),
    },
    {
        id: "PL-005",
        code: "PL-PROMO-1212",
        name: "Promo 12.12",
        description: "Daftar harga khusus event 12.12",
        currency: "IDR",
        type: "SALES",
        status: "INACTIVE",
        validFrom: new Date("2024-12-12"),
        validTo: new Date("2024-12-13"),
        itemCount: 50,
        lastUpdated: new Date("2024-10-30"),
    },
];
