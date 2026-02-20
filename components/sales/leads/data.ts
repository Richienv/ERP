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
  FOLLOW_UP: "Follow Up",
  WON: "Menang",
  LOST: "Kalah",
};

export const LEAD_STATUS_COLORS: Record<LeadStatus, string> = {
  NEW: "bg-blue-100 text-blue-700 border-blue-200",
  FOLLOW_UP: "bg-indigo-100 text-indigo-700 border-indigo-200",
  WON: "bg-green-100 text-green-700 border-green-200",
  LOST: "bg-red-100 text-red-700 border-red-200",
};

export const mockLeads: Lead[] = [
  {
    id: "lead-1",
    title: "Pengadaan Kain Cotton",
    company: "PT Tekstil Maju",
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
    title: "Order Seragam 500pcs",
    company: "CV Berkah Abadi",
    contactName: "Siti Aminah",
    contactEmail: "siti@berkah.com",
    status: "FOLLOW_UP",
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
    id: "lead-4",
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
