
export type FAQCategory = "GENERAL" | "INVENTORY" | "SALES" | "FINANCE" | "MANUFACTURING" | "TECHNICAL";

export type FAQ = {
    id: string;
    category: FAQCategory;
    question: string;
    answer: string;
};

export type SupportTicket = {
    id: string;
    title: string;
    category: string;
    status: "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED";
    priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
    createdAt: Date;
    updatedAt: Date;
};

export type VideoTutorial = {
    id: string;
    title: string;
    description: string;
    duration: string;
    module: string;
    thumbnail?: string;
};

export const mockFAQs: FAQ[] = [
    {
        id: "FAQ-001",
        category: "GENERAL",
        question: "Bagaimana cara login ke sistem ERP?",
        answer: "Gunakan email dan password yang diberikan oleh administrator. Jika Anda lupa password, klik 'Lupa Password' di halaman login untuk reset. Pastikan autentikasi dua faktor (2FA) sudah diaktifkan untuk keamanan tambahan."
    },
    {
        id: "FAQ-002",
        category: "INVENTORY",
        question: "Bagaimana cara menambahkan produk baru ke inventori?",
        answer: "Masuk ke menu Inventori > Kelola Produk, lalu klik tombol 'Tambah Produk'. Isi informasi lengkap seperti nama, kode SKU, kategori, unit, dan harga. Jangan lupa set level stok minimum untuk notifikasi otomatis."
    },
    {
        id: "FAQ-003",
        category: "INVENTORY",
        question: "Bagaimana cara melakukan stock opname?",
        answer: "Buka menu Inventori > Penyesuaian Stok. Pilih gudang yang akan diopname, masukkan jumlah fisik aktual, sistem akan otomatis menghitung selisih dan membuat jurnal penyesuaian."
    },
    {
        id: "FAQ-004",
        category: "SALES",
        question: "Bagaimana cara membuat penawaran harga (quotation)?",
        answer: "Masuk ke Sales & CRM > Penawaran, klik 'Buat Penawaran Baru'. Pilih customer, tambahkan produk dengan quantity, sistem akan otomatis menghitung harga berdasarkan price list yang aktif. Anda bisa memberikan diskon jika diperlukan."
    },
    {
        id: "FAQ-005",
        category: "SALES",
        question: "Bagaimana mengelola pipeline penjualan?",
        answer: "Gunakan fitur Lead & Pipeline di menu Sales. Drag-and-drop lead antar stage (New, Qualified, Proposal, Negotiation, Won/Lost). Update status dan notes secara berkala untuk tracking yang lebih baik."
    },
    {
        id: "FAQ-006",
        category: "FINANCE",
        question: "Bagaimana cara membuat jurnal umum?",
        answer: "Buka menu Keuangan > Jurnal Umum, klik 'Entri Baru'. Masukkan tanggal, referensi, dan detail transaksi. Pastikan total Debit sama dengan Credit sebelum posting. Sistem akan validasi otomatis."
    },
    {
        id: "FAQ-007",
        category: "FINANCE",
        question: "Bagaimana melihat laporan laba rugi?",
        answer: "Masuk ke Keuangan > Laporan Keuangan, pilih tab 'Laba Rugi'. Anda bisa filter berdasarkan periode tertentu. Laporan akan menampilkan pendapatan, beban, dan laba bersih secara otomatis."
    },
    {
        id: "FAQ-008",
        category: "MANUFACTURING",
        question: "Bagaimana cara membuat Bill of Materials (BoM)?",
        answer: "Buka Manufaktur > Bill of Materials, klik 'Buat BoM Baru'. Pilih produk jadi, tambahkan komponen-komponen yang diperlukan beserta quantity. Simpan sebagai draft terlebih dahulu, lalu aktifkan setelah review."
    },
    {
        id: "FAQ-009",
        category: "MANUFACTURING",
        question: "Bagaimana cara membuat Manufacturing Order?",
        answer: "Masuk ke Manufaktur > Order Produksi, klik 'MO Baru'. Pilih produk, quantity, dan deadline. Sistem akan otomatis mereserve material berdasarkan BoM. Anda bisa tracking progress di dashboard manufaktur."
    },
    {
        id: "FAQ-010",
        category: "TECHNICAL",
        question: "Sistem lambat atau error, apa yang harus dilakukan?",
        answer: "Coba refresh browser atau clear cache terlebih dahulu. Jika masih bermasalah, cek koneksi internet Anda. Untuk error persisten, screenshot pesan error dan submit ticket ke IT Support dengan prioritas sesuai urgensi."
    }
];

export const mockTickets: SupportTicket[] = [
    {
        id: "TKT-001",
        title: "Error saat export laporan keuangan",
        category: "Technical",
        status: "IN_PROGRESS",
        priority: "HIGH",
        createdAt: new Date("2024-11-20T10:00:00"),
        updatedAt: new Date("2024-11-21T08:30:00")
    },
    {
        id: "TKT-002",
        title: "Request akses ke modul Manufacturing",
        category: "Access Request",
        status: "RESOLVED",
        priority: "MEDIUM",
        createdAt: new Date("2024-11-18T14:00:00"),
        updatedAt: new Date("2024-11-19T09:00:00")
    },
    {
        id: "TKT-003",
        title: "Training untuk modul Sales & CRM",
        category: "Training",
        status: "OPEN",
        priority: "LOW",
        createdAt: new Date("2024-11-21T09:00:00"),
        updatedAt: new Date("2024-11-21T09:00:00")
    }
];

export const mockTutorials: VideoTutorial[] = [
    {
        id: "VID-001",
        title: "Memulai dengan ERP - Panduan Lengkap",
        description: "Video tutorial dasar untuk pengguna baru sistem ERP",
        duration: "15:30",
        module: "General"
    },
    {
        id: "VID-002",
        title: "Manajemen Inventori - Stock In & Out",
        description: "Cara mencatat penerimaan dan pengeluaran barang",
        duration: "12:45",
        module: "Inventory"
    },
    {
        id: "VID-003",
        title: "Sales Pipeline - Dari Lead sampai Closing",
        description: "Mengelola prospek penjualan hingga deal selesai",
        duration: "18:20",
        module: "Sales"
    },
    {
        id: "VID-004",
        title: "Membuat Laporan Keuangan Bulanan",
        description: "Step-by-step generate laporan keuangan",
        duration: "10:15",
        module: "Finance"
    },
    {
        id: "VID-005",
        title: "Production Planning dengan MRP",
        description: "Perencanaan produksi dan material requirement",
        duration: "22:00",
        module: "Manufacturing"
    }
];

export const supportChannels = [
    {
        name: "Email Support",
        contact: "support@perusahaan.com",
        description: "Response dalam 24 jam",
        icon: "Mail"
    },
    {
        name: "Telepon",
        contact: "+62 21 1234 5678",
        description: "Senin - Jumat, 08:00 - 17:00 WIB",
        icon: "Phone"
    },
    {
        name: "WhatsApp",
        contact: "+62 812 3456 7890",
        description: "Fast response untuk urgent issue",
        icon: "MessageSquare"
    },
    {
        name: "Live Chat",
        contact: "Dalam Aplikasi",
        description: "Available 24/7",
        icon: "MessageCircle"
    }
];
