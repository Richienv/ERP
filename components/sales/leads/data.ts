import { LeadStatus, Priority, LeadSource } from "@prisma/client";

export type Lead = {
  id: string;
  title: string;
  company: string;
  contactName: string;
  contactEmail: string;
  status: LeadStatus;
  priority: Priority;
  source: LeadSource;
  estimatedValue: number;
  probability: number;
  createdAt: Date;
  updatedAt: Date;
  assignedTo?: {
    name: string;
    image?: string;
  };
};

export const LEAD_STATUS_LABELS: Record<LeadStatus, string> = {
  NEW: "Baru",
  CONTACTED: "Dihubungi",
  QUALIFIED: "Terkualifikasi",
  PROPOSAL: "Proposal",
  NEGOTIATION: "Negosiasi",
  WON: "Menang",
  LOST: "Kalah",
};

export const LEAD_STATUS_COLORS: Record<LeadStatus, string> = {
  NEW: "bg-blue-100 text-blue-700 border-blue-200",
  CONTACTED: "bg-indigo-100 text-indigo-700 border-indigo-200",
  QUALIFIED: "bg-purple-100 text-purple-700 border-purple-200",
  PROPOSAL: "bg-yellow-100 text-yellow-700 border-yellow-200",
  NEGOTIATION: "bg-orange-100 text-orange-700 border-orange-200",
  WON: "bg-green-100 text-green-700 border-green-200",
  LOST: "bg-red-100 text-red-700 border-red-200",
};

export const mockLeads: Lead[] = [
  {
    id: "lead-1",
    title: "Pengadaan Laptop Kantor",
    company: "PT Teknologi Maju",
    contactName: "Budi Santoso",
    contactEmail: "budi@tekno.co.id",
    status: "NEW",
    priority: "HIGH",
    source: "WEBSITE",
    estimatedValue: 150000000,
    probability: 20,
    createdAt: new Date(),
    updatedAt: new Date(),
    assignedTo: { name: "Andi Sales" },
  },
  {
    id: "lead-2",
    title: "Sistem ERP Manufaktur",
    company: "CV Berkah Abadi",
    contactName: "Siti Aminah",
    contactEmail: "siti@berkah.com",
    status: "QUALIFIED",
    priority: "MEDIUM",
    source: "REFERRAL",
    estimatedValue: 450000000,
    probability: 40,
    createdAt: new Date(),
    updatedAt: new Date(),
    assignedTo: { name: "Budi Sales" },
  },
  {
    id: "lead-3",
    title: "Maintenance Server Tahunan",
    company: "PT Global Network",
    contactName: "Rudi Hermawan",
    contactEmail: "rudi@global.net",
    status: "PROPOSAL",
    priority: "LOW",
    source: "EMAIL",
    estimatedValue: 75000000,
    probability: 60,
    createdAt: new Date(),
    updatedAt: new Date(),
    assignedTo: { name: "Andi Sales" },
  },
  {
    id: "lead-4",
    title: "Upgrade Jaringan WiFi",
    company: "Hotel Bintang Lima",
    contactName: "Dewi Lestari",
    contactEmail: "dewi@hotel.com",
    status: "NEGOTIATION",
    priority: "URGENT",
    source: "COLD_CALL",
    estimatedValue: 200000000,
    probability: 80,
    createdAt: new Date(),
    updatedAt: new Date(),
    assignedTo: { name: "Citra Sales" },
  },
  {
    id: "lead-5",
    title: "Lisensi Software Design",
    company: "Studio Kreatif",
    contactName: "Eko Prasetyo",
    contactEmail: "eko@studio.id",
    status: "WON",
    priority: "MEDIUM",
    source: "WEBSITE",
    estimatedValue: 50000000,
    probability: 100,
    createdAt: new Date(),
    updatedAt: new Date(),
    assignedTo: { name: "Budi Sales" },
  },
  {
    id: "lead-6",
    title: "Konsultasi Keamanan Siber",
    company: "Bank Sejahtera",
    contactName: "Fajar Nugraha",
    contactEmail: "fajar@bank.co.id",
    status: "CONTACTED",
    priority: "HIGH",
    source: "EXHIBITION",
    estimatedValue: 300000000,
    probability: 30,
    createdAt: new Date(),
    updatedAt: new Date(),
    assignedTo: { name: "Citra Sales" },
  },
  {
    id: "lead-7",
    title: "Aplikasi Mobile Banking",
    company: "Koperasi Unit Desa",
    contactName: "Gita Pertiwi",
    contactEmail: "gita@kud.id",
    status: "LOST",
    priority: "LOW",
    source: "SOCIAL_MEDIA",
    estimatedValue: 120000000,
    probability: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    assignedTo: { name: "Andi Sales" },
  }
];
