
export type BOMItem = {
    id: string;
    componentId: string;
    componentName: string;
    quantity: number;
    unit: string;
    cost: number;
    wastePercentage: number;
};

export type BOM = {
    id: string;
    code: string;
    productName: string;
    productCode: string;
    version: string;
    status: "ACTIVE" | "DRAFT" | "OBSOLETE";
    totalCost: number;
    items: BOMItem[];
    createdAt: Date;
    updatedAt: Date;
};

export const mockBOMs: BOM[] = [
    {
        id: "BOM-001",
        code: "BOM-CHAIR-001",
        productName: "Kursi Kantor Ergonomis X1",
        productCode: "PRD-FURN-001",
        version: "v1.0",
        status: "ACTIVE",
        totalCost: 450000,
        createdAt: new Date("2024-10-15"),
        updatedAt: new Date("2024-11-01"),
        items: [
            { id: "BI-001", componentId: "MAT-001", componentName: "Rangka Besi", quantity: 1, unit: "pcs", cost: 150000, wastePercentage: 0 },
            { id: "BI-002", componentId: "MAT-002", componentName: "Busa Dudukan", quantity: 1, unit: "pcs", cost: 80000, wastePercentage: 2 },
            { id: "BI-003", componentId: "MAT-003", componentName: "Kain Pelapis", quantity: 1.5, unit: "meter", cost: 45000, wastePercentage: 5 },
        ]
    },
    {
        id: "BOM-002",
        code: "BOM-TABLE-002",
        productName: "Meja Kerja L-Shape",
        productCode: "PRD-FURN-005",
        version: "v2.1",
        status: "ACTIVE",
        totalCost: 850000,
        createdAt: new Date("2024-09-20"),
        updatedAt: new Date("2024-10-25"),
        items: [
            { id: "BI-004", componentId: "MAT-005", componentName: "Papan Kayu Jati", quantity: 3, unit: "lembar", cost: 200000, wastePercentage: 3 },
            { id: "BI-005", componentId: "MAT-006", componentName: "Kaki Meja Besi", quantity: 4, unit: "pcs", cost: 50000, wastePercentage: 0 },
        ]
    },
    {
        id: "BOM-003",
        code: "BOM-CABINET-003",
        productName: "Lemari Arsip 3 Pintu",
        productCode: "PRD-FURN-012",
        version: "v1.0",
        status: "DRAFT",
        totalCost: 1200000,
        createdAt: new Date("2024-11-18"),
        updatedAt: new Date("2024-11-18"),
        items: []
    },
    {
        id: "BOM-004",
        code: "BOM-CHAIR-OLD",
        productName: "Kursi Kantor Standard (Lama)",
        productCode: "PRD-FURN-001-OLD",
        version: "v0.9",
        status: "OBSOLETE",
        totalCost: 380000,
        createdAt: new Date("2023-01-10"),
        updatedAt: new Date("2023-12-31"),
        items: []
    }
];
