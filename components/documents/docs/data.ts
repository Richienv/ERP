
export type DocCategory = "USER_GUIDE" | "API" | "RELEASE_NOTE" | "POLICY";

export type DocumentationItem = {
    id: string;
    title: string;
    category: DocCategory;
    lastUpdated: Date;
    author: string;
    readTime: string;
    tags: string[];
    excerpt: string;
};

export const mockDocs: DocumentationItem[] = [
    {
        id: "DOC-001",
        title: "Panduan Penggunaan Modul Sales",
        category: "USER_GUIDE",
        lastUpdated: new Date("2024-11-15"),
        author: "Tim Training",
        readTime: "10 min",
        tags: ["Sales", "CRM", "Tutorial"],
        excerpt: "Pelajari cara membuat lead baru, mengelola pipeline, dan membuat penawaran harga."
    },
    {
        id: "DOC-002",
        title: "API Reference: Inventory Management",
        category: "API",
        lastUpdated: new Date("2024-11-20"),
        author: "Dev Team",
        readTime: "15 min",
        tags: ["API", "Inventory", "Integration"],
        excerpt: "Dokumentasi lengkap endpoint API untuk manajemen stok dan gudang."
    },
    {
        id: "DOC-003",
        title: "Release Notes v2.1.0",
        category: "RELEASE_NOTE",
        lastUpdated: new Date("2024-11-10"),
        author: "Product Owner",
        readTime: "5 min",
        tags: ["Update", "Changelog"],
        excerpt: "Pembaruan fitur pada modul Keuangan dan perbaikan bug pada sistem notifikasi."
    },
    {
        id: "DOC-004",
        title: "Kebijakan Retur Barang",
        category: "POLICY",
        lastUpdated: new Date("2024-10-01"),
        author: "Legal Dept",
        readTime: "8 min",
        tags: ["Policy", "Compliance", "Sales"],
        excerpt: "Syarat dan ketentuan pengembalian barang untuk pelanggan B2B dan B2C."
    },
    {
        id: "DOC-005",
        title: "Cara Melakukan Stock Opname",
        category: "USER_GUIDE",
        lastUpdated: new Date("2024-11-05"),
        author: "Warehouse Mgr",
        readTime: "12 min",
        tags: ["Inventory", "SOP", "Gudang"],
        excerpt: "Langkah-langkah standar operasional prosedur untuk melakukan perhitungan stok fisik."
    },
    {
        id: "DOC-006",
        title: "Setup Chart of Accounts",
        category: "USER_GUIDE",
        lastUpdated: new Date("2024-09-20"),
        author: "Finance Lead",
        readTime: "20 min",
        tags: ["Finance", "Accounting", "Setup"],
        excerpt: "Panduan awal konfigurasi akun-akun akuntansi untuk pelaporan keuangan yang akurat."
    }
];
