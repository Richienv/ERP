
export type SystemSetting = {
    id: string;
    category: string;
    name: string;
    value: string | boolean | number;
    description: string;
    type: "text" | "boolean" | "number" | "select";
    options?: string[];
};

export const mockSystemSettings: SystemSetting[] = [
    // General Settings
    {
        id: "SET-001",
        category: "Umum",
        name: "Nama Perusahaan",
        value: "PT Maju Bersama Indonesia",
        description: "Nama perusahaan yang akan ditampilkan di seluruh sistem",
        type: "text"
    },
    {
        id: "SET-002",
        category: "Umum",
        name: "Zona Waktu",
        value: "Asia/Jakarta",
        description: "Zona waktu default untuk sistem",
        type: "select",
        options: ["Asia/Jakarta", "Asia/Makassar", "Asia/Jayapura"]
    },
    {
        id: "SET-003",
        category: "Umum",
        name: "Bahasa Sistem",
        value: "Bahasa Indonesia",
        description: "Bahasa default untuk antarmuka pengguna",
        type: "select",
        options: ["Bahasa Indonesia", "English"]
    },
    {
        id: "SET-004",
        category: "Umum",
        name: "Format Tanggal",
        value: "DD/MM/YYYY",
        description: "Format tampilan tanggal di seluruh sistem",
        type: "select",
        options: ["DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"]
    },

    // Security Settings
    {
        id: "SET-005",
        category: "Keamanan",
        name: "Autentikasi Dua Faktor",
        value: true,
        description: "Wajibkan pengguna menggunakan 2FA untuk login",
        type: "boolean"
    },
    {
        id: "SET-006",
        category: "Keamanan",
        name: "Masa Berlaku Sesi (menit)",
        value: 60,
        description: "Durasi sesi pengguna sebelum logout otomatis",
        type: "number"
    },
    {
        id: "SET-007",
        category: "Keamanan",
        name: "Panjang Password Minimum",
        value: 8,
        description: "Jumlah karakter minimum untuk password",
        type: "number"
    },
    {
        id: "SET-008",
        category: "Keamanan",
        name: "Log Aktivitas Pengguna",
        value: true,
        description: "Catat semua aktivitas pengguna untuk audit",
        type: "boolean"
    },

    // Notification Settings
    {
        id: "SET-009",
        category: "Notifikasi",
        name: "Email Notifikasi",
        value: true,
        description: "Kirim notifikasi melalui email",
        type: "boolean"
    },
    {
        id: "SET-010",
        category: "Notifikasi",
        name: "Notifikasi Stok Rendah",
        value: true,
        description: "Kirim peringatan saat stok di bawah minimum",
        type: "boolean"
    },
    {
        id: "SET-011",
        category: "Notifikasi",
        name: "Notifikasi Approval",
        value: true,
        description: "Kirim notifikasi untuk permintaan persetujuan",
        type: "boolean"
    },

    // System Performance
    {
        id: "SET-012",
        category: "Performa",
        name: "Cache Aktif",
        value: true,
        description: "Gunakan cache untuk meningkatkan kecepatan sistem",
        type: "boolean"
    },
    {
        id: "SET-013",
        category: "Performa",
        name: "Jumlah Data per Halaman",
        value: 50,
        description: "Jumlah baris data yang ditampilkan per halaman",
        type: "number"
    },
    {
        id: "SET-014",
        category: "Performa",
        name: "Auto-Backup Harian",
        value: true,
        description: "Jalankan backup database otomatis setiap hari",
        type: "boolean"
    }
];

export const systemInfo = {
    version: "2.1.0",
    buildDate: "2024-11-15",
    environment: "Production",
    database: "PostgreSQL 15.3",
    uptime: "45 hari 12 jam",
    lastBackup: "2024-11-21 02:00:00"
};
