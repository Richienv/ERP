
export interface PriceBook {
    id: string;
    title: string;
    subtitle: string;
    coverParams: {
        color: string;
        pattern: string; // "dots", "grid", "waves", "solid"
        icon: string; // Using lucide-react names or similar simple identifiers
    };
    items: PriceItem[];
    validUntil: string;
}

export interface PriceItem {
    id: string;
    code: string;
    name: string;
    spec: string; // e.g., "100% Cotton, 30s"
    price: number;
    minQty: number;
    unit: string;
}

export const PRICE_BOOKS: PriceBook[] = [
    {
        id: "pb-001",
        title: "Export Collection",
        subtitle: "Spring/Summer 2025",
        validUntil: "2025-06-30",
        coverParams: {
            color: "bg-orange-500",
            pattern: "waves",
            icon: "globe",
        },
        items: [
            { id: "item-e1", code: "EXP-C30", name: "Premium Cotton 30s", spec: "Combed, Reactive Dye", price: 85000, minQty: 1000, unit: "kg" },
            { id: "item-e2", code: "EXP-R40", name: "Rayon Twill", spec: "High Twist, Soft Finish", price: 62000, minQty: 2000, unit: "m" },
            { id: "item-e3", code: "EXP-L10", name: "Linen Blend", spec: "55% Linen, 45% Cotton", price: 110000, minQty: 500, unit: "m" },
        ]
    },
    {
        id: "pb-002",
        title: "Local Wholesale",
        subtitle: "Java & Bali Market",
        validUntil: "2024-12-31",
        coverParams: {
            color: "bg-blue-600",
            pattern: "grid",
            icon: "store",
        },
        items: [
            { id: "item-l1", code: "LOC-P20", name: "Polyester PE", spec: "20s, Standard Grade", price: 28000, minQty: 100, unit: "kg" },
            { id: "item-l2", code: "LOC-TC", name: "TC 65/35", spec: "Tetoron Cotton", price: 35000, minQty: 100, unit: "kg" },
            { id: "item-l3", code: "LOC-DF", name: "Dry Fit Mesh", spec: "Sports Active Wear", price: 42000, minQty: 50, unit: "kg" },
        ]
    },
    {
        id: "pb-003",
        title: "Industrial Tech",
        subtitle: "Safety & Heavy Duty",
        validUntil: "2025-12-31",
        coverParams: {
            color: "bg-zinc-800",
            pattern: "dots",
            icon: "shield",
        },
        items: [
            { id: "item-i1", code: "IND-AR", name: "Aramid Fiber", spec: "Fire Resistant Level 4", price: 450000, minQty: 10, unit: "m" },
            { id: "item-i2", code: "IND-WP", name: "Waterproof Canvas", spec: "600D PVC Coated", price: 55000, minQty: 100, unit: "m" },
        ]
    },
    {
        id: "pb-004",
        title: "Clearance Sale",
        subtitle: "Q1 2024 Overstock",
        validUntil: "2024-04-01",
        coverParams: {
            color: "bg-red-500",
            pattern: "solid",
            icon: "tag",
        },
        items: [
            { id: "item-c1", code: "CLR-N70", name: "Nylon 70D", spec: "Old Stock (Good Cond)", price: 15000, minQty: 1000, unit: "m" },
            { id: "item-c2", code: "CLR-PR", name: "Print Misrun", spec: "Various Patterns", price: 12000, minQty: 500, unit: "kg" },
        ]
    }
];
