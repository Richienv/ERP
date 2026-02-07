
export type JournalEntryLine = {
    id: string;
    accountId: string;
    accountName: string;
    accountCode: string;
    description?: string;
    debit: number;
    credit: number;
};

export type JournalEntry = {
    id: string;
    transactionDate: Date;
    referenceNumber: string;
    description: string;
    status: "DRAFT" | "POSTED" | "VOID";
    lines: JournalEntryLine[];
    totalAmount: number;
    createdAt: Date;
    createdBy: string;
};

export const mockJournalEntries: JournalEntry[] = [
    {
        id: "JE-2024-001",
        transactionDate: new Date("2024-11-01"),
        referenceNumber: "INV-2024-001",
        description: "Penjualan Kredit ke PT. Maju Bersama",
        status: "POSTED",
        totalAmount: 15000000,
        createdAt: new Date("2024-11-01"),
        createdBy: "Admin Finance",
        lines: [
            {
                id: "JEL-001-1",
                accountId: "ACC-1101",
                accountCode: "1-1101",
                accountName: "Piutang Usaha",
                debit: 16650000,
                credit: 0,
            },
            {
                id: "JEL-001-2",
                accountId: "ACC-4101",
                accountCode: "4-1101",
                accountName: "Penjualan Barang",
                debit: 0,
                credit: 15000000,
            },
            {
                id: "JEL-001-3",
                accountId: "ACC-2105",
                accountCode: "2-1105",
                accountName: "PPN Keluaran",
                debit: 0,
                credit: 1650000,
            },
        ],
    },
    {
        id: "JE-2024-002",
        transactionDate: new Date("2024-11-02"),
        referenceNumber: "PO-2024-005",
        description: "Pembelian Perlengkapan Kantor",
        status: "POSTED",
        totalAmount: 2500000,
        createdAt: new Date("2024-11-02"),
        createdBy: "Admin Finance",
        lines: [
            {
                id: "JEL-002-1",
                accountId: "ACC-6105",
                accountCode: "6-1105",
                accountName: "Beban Perlengkapan Kantor",
                debit: 2500000,
                credit: 0,
            },
            {
                id: "JEL-002-2",
                accountId: "ACC-1101",
                accountCode: "1-1101",
                accountName: "Kas Kecil",
                debit: 0,
                credit: 2500000,
            },
        ],
    },
    {
        id: "JE-2024-003",
        transactionDate: new Date("2024-11-03"),
        referenceNumber: "PAY-2024-012",
        description: "Pembayaran Gaji Karyawan Oktober",
        status: "POSTED",
        totalAmount: 45000000,
        createdAt: new Date("2024-11-03"),
        createdBy: "HR Manager",
        lines: [
            {
                id: "JEL-003-1",
                accountId: "ACC-6201",
                accountCode: "6-2101",
                accountName: "Beban Gaji",
                debit: 45000000,
                credit: 0,
            },
            {
                id: "JEL-003-2",
                accountId: "ACC-1102",
                accountCode: "1-1102",
                accountName: "Bank BCA",
                debit: 0,
                credit: 45000000,
            },
        ],
    },
    {
        id: "JE-2024-004",
        transactionDate: new Date("2024-11-05"),
        referenceNumber: "ADJ-2024-001",
        description: "Penyesuaian Stok Opname",
        status: "DRAFT",
        totalAmount: 1200000,
        createdAt: new Date("2024-11-05"),
        createdBy: "Warehouse Manager",
        lines: [
            {
                id: "JEL-004-1",
                accountId: "ACC-5101",
                accountCode: "5-1101",
                accountName: "Harga Pokok Penjualan",
                debit: 1200000,
                credit: 0,
            },
            {
                id: "JEL-004-2",
                accountId: "ACC-1105",
                accountCode: "1-1105",
                accountName: "Persediaan Barang Dagang",
                debit: 0,
                credit: 1200000,
            },
        ],
    },
];
