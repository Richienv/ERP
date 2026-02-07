
export type ManufacturingOrder = {
    id: string;
    moNumber: string;
    productName: string;
    productCode: string;
    quantity: number;
    uom: string; // Unit of Measure
    startDate: Date;
    deadline: Date;
    status: "PLANNED" | "CONFIRMED" | "IN_PROGRESS" | "DONE" | "CANCELLED";
    progress: number; // 0-100
    priority: "LOW" | "MEDIUM" | "HIGH";
    bomId: string;
    assignedTo?: string; // Supervisor or Work Center
};

export const mockManufacturingOrders: ManufacturingOrder[] = [
    {
        id: "MO-001",
        moNumber: "MO-2024-089",
        productName: "Kursi Ergonomis X1",
        productCode: "PRD-FURN-001",
        quantity: 50,
        uom: "Unit",
        startDate: new Date("2024-11-20"),
        deadline: new Date("2024-11-25"),
        status: "DONE",
        progress: 100,
        priority: "HIGH",
        bomId: "BOM-001",
        assignedTo: "Line Assembly A"
    },
    {
        id: "MO-002",
        moNumber: "MO-2024-090",
        productName: "Meja Kantor L-Shape",
        productCode: "PRD-FURN-005",
        quantity: 20,
        uom: "Unit",
        startDate: new Date("2024-11-21"),
        deadline: new Date("2024-11-28"),
        status: "IN_PROGRESS",
        progress: 45,
        priority: "MEDIUM",
        bomId: "BOM-002",
        assignedTo: "Line Woodworking B"
    },
    {
        id: "MO-003",
        moNumber: "MO-2024-091",
        productName: "Lemari Arsip 3 Pintu",
        productCode: "PRD-FURN-012",
        quantity: 15,
        uom: "Unit",
        startDate: new Date("2024-11-22"),
        deadline: new Date("2024-11-30"),
        status: "CONFIRMED",
        progress: 0,
        priority: "MEDIUM",
        bomId: "BOM-003",
        assignedTo: "Line Assembly C"
    },
    {
        id: "MO-004",
        moNumber: "MO-2024-092",
        productName: "Rak Buku Minimalis",
        productCode: "PRD-FURN-008",
        quantity: 100,
        uom: "Unit",
        startDate: new Date("2024-11-25"),
        deadline: new Date("2024-12-05"),
        status: "PLANNED",
        progress: 0,
        priority: "LOW",
        bomId: "BOM-005",
    },
    {
        id: "MO-005",
        moNumber: "MO-2024-093",
        productName: "Kursi Ergonomis X1",
        productCode: "PRD-FURN-001",
        quantity: 200,
        uom: "Unit",
        startDate: new Date("2024-11-26"),
        deadline: new Date("2024-12-10"),
        status: "PLANNED",
        progress: 0,
        priority: "HIGH",
        bomId: "BOM-001",
    }
];
