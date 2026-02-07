
export type MasterDataCategory = {
    id: string;
    name: string;
    code: string;
    description: string;
    status: "ACTIVE" | "INACTIVE";
    itemCount: number;
};

export type UnitOfMeasure = {
    id: string;
    name: string;
    symbol: string;
    type: "WEIGHT" | "LENGTH" | "VOLUME" | "QUANTITY";
    status: "ACTIVE" | "INACTIVE";
};

export type Warehouse = {
    id: string;
    name: string;
    code: string;
    location: string;
    capacity: number;
    manager: string;
    status: "ACTIVE" | "MAINTENANCE";
};

export const mockCategories: MasterDataCategory[] = [
    { id: "CAT-001", name: "Elektronik", code: "ELEC", description: "Perangkat elektronik dan gadget", status: "ACTIVE", itemCount: 150 },
    { id: "CAT-002", name: "Furniture", code: "FURN", description: "Perabot kantor dan rumah", status: "ACTIVE", itemCount: 85 },
    { id: "CAT-003", name: "ATK", code: "STAT", description: "Alat Tulis Kantor", status: "ACTIVE", itemCount: 320 },
    { id: "CAT-004", name: "Bahan Baku", code: "RAW", description: "Material mentah produksi", status: "ACTIVE", itemCount: 45 },
    { id: "CAT-005", name: "Jasa", code: "SERV", description: "Layanan dan jasa konsultasi", status: "ACTIVE", itemCount: 12 },
];

export const mockUnits: UnitOfMeasure[] = [
    { id: "UOM-001", name: "Pieces", symbol: "Pcs", type: "QUANTITY", status: "ACTIVE" },
    { id: "UOM-002", name: "Kilogram", symbol: "Kg", type: "WEIGHT", status: "ACTIVE" },
    { id: "UOM-003", name: "Meter", symbol: "m", type: "LENGTH", status: "ACTIVE" },
    { id: "UOM-004", name: "Liter", symbol: "L", type: "VOLUME", status: "ACTIVE" },
    { id: "UOM-005", name: "Box", symbol: "Box", type: "QUANTITY", status: "ACTIVE" },
];

export const mockWarehouses: Warehouse[] = [
    { id: "WH-001", name: "Gudang Utama", code: "WH-MAIN", location: "Jakarta Utara", capacity: 10000, manager: "Budi Santoso", status: "ACTIVE" },
    { id: "WH-002", name: "Gudang Distribusi", code: "WH-DIST", location: "Surabaya", capacity: 5000, manager: "Siti Aminah", status: "ACTIVE" },
    { id: "WH-003", name: "Gudang Bahan Baku", code: "WH-RAW", location: "Cikarang", capacity: 8000, manager: "Rudi Hermawan", status: "MAINTENANCE" },
];
