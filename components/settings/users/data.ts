
export type UserRole = "ADMIN" | "MANAGER" | "STAFF" | "VIEWER";
export type UserStatus = "ACTIVE" | "INACTIVE" | "SUSPENDED";

export type User = {
    id: string;
    name: string;
    email: string;
    role: UserRole;
    department: string;
    status: UserStatus;
    lastLogin: Date;
    createdAt: Date;
    avatar?: string;
    phoneNumber?: string;
};

export const mockUsers: User[] = [
    {
        id: "USR-001",
        name: "Admin John",
        email: "admin@perusahaan.com",
        role: "ADMIN",
        department: "IT",
        status: "ACTIVE",
        lastLogin: new Date("2024-11-21T08:30:00"),
        createdAt: new Date("2023-01-15"),
        phoneNumber: "+62 812-3456-7890"
    },
    {
        id: "USR-002",
        name: "Siti Aminah",
        email: "siti.aminah@perusahaan.com",
        role: "MANAGER",
        department: "Sales",
        status: "ACTIVE",
        lastLogin: new Date("2024-11-21T09:15:00"),
        createdAt: new Date("2023-03-20"),
        phoneNumber: "+62 813-7654-3210"
    },
    {
        id: "USR-003",
        name: "Budi Santoso",
        email: "budi.santoso@perusahaan.com",
        role: "MANAGER",
        department: "Finance",
        status: "ACTIVE",
        lastLogin: new Date("2024-11-20T16:45:00"),
        createdAt: new Date("2023-02-10"),
        phoneNumber: "+62 812-1111-2222"
    },
    {
        id: "USR-004",
        name: "Rudi Hermawan",
        email: "rudi.h@perusahaan.com",
        role: "STAFF",
        department: "Warehouse",
        status: "ACTIVE",
        lastLogin: new Date("2024-11-21T07:00:00"),
        createdAt: new Date("2023-06-05"),
        phoneNumber: "+62 815-3333-4444"
    },
    {
        id: "USR-005",
        name: "Dewi Lestari",
        email: "dewi.lestari@perusahaan.com",
        role: "STAFF",
        department: "Procurement",
        status: "ACTIVE",
        lastLogin: new Date("2024-11-21T08:00:00"),
        createdAt: new Date("2023-04-12"),
        phoneNumber: "+62 816-5555-6666"
    },
    {
        id: "USR-006",
        name: "Ahmad Yusuf",
        email: "ahmad.y@perusahaan.com",
        role: "STAFF",
        department: "Manufacturing",
        status: "ACTIVE",
        lastLogin: new Date("2024-11-20T14:30:00"),
        createdAt: new Date("2023-08-01"),
        phoneNumber: "+62 817-7777-8888"
    },
    {
        id: "USR-007",
        name: "Rina Wijaya",
        email: "rina.wijaya@perusahaan.com",
        role: "VIEWER",
        department: "Finance",
        status: "ACTIVE",
        lastLogin: new Date("2024-11-19T10:00:00"),
        createdAt: new Date("2024-01-10"),
        phoneNumber: "+62 818-9999-0000"
    },
    {
        id: "USR-008",
        name: "Fajar Nugroho",
        email: "fajar.n@perusahaan.com",
        role: "STAFF",
        department: "Sales",
        status: "INACTIVE",
        lastLogin: new Date("2024-10-15T12:00:00"),
        createdAt: new Date("2023-05-15"),
        phoneNumber: "+62 819-1234-5678"
    },
    {
        id: "USR-009",
        name: "Maya Sari",
        email: "maya.sari@perusahaan.com",
        role: "MANAGER",
        department: "HR",
        status: "SUSPENDED",
        lastLogin: new Date("2024-09-30T15:30:00"),
        createdAt: new Date("2023-07-20"),
        phoneNumber: "+62 811-9876-5432"
    }
];

export const rolePermissions = {
    ADMIN: ["Full Access", "User Management", "System Settings", "All Modules"],
    MANAGER: ["Department Access", "Approval Rights", "Reports", "Team Management"],
    STAFF: ["Module Access", "Create/Edit Records", "View Reports"],
    VIEWER: ["Read-Only Access", "View Reports"]
};

export const departments = [
    "IT",
    "Sales",
    "Finance",
    "Warehouse",
    "Procurement",
    "Manufacturing",
    "HR"
];
