export type KanbanStatus = 'HEALTHY' | 'LOW_STOCK' | 'CRITICAL' | 'NEW';

export interface ProductStockInfo {
    totalStock: number;
    minStock: number;
    reorderLevel?: number;
    manualAlert: boolean;
    createdAt?: Date | string; // Optional for backward compatibility
}

export function calculateProductStatus(product: ProductStockInfo): KanbanStatus {
    const { totalStock, minStock, reorderLevel = 0, manualAlert, createdAt } = product;

    // Priority 1: Manual Alert (Always overrides everything)
    if (manualAlert) {
        return 'CRITICAL';
    }

    // Priority 2: New Product (Created within last 24 hours AND has < 0 stock or just generally treated as new)
    // Actually, "New" is usually for setup. If stock is 0, it shouldn't be critical yet.
    if (createdAt) {
        const createdDate = new Date(createdAt);
        const now = new Date();
        const diffInHours = (now.getTime() - createdDate.getTime()) / (1000 * 60 * 60);

        if (diffInHours < 24 && totalStock === 0) {
            return 'NEW';
        }
    }

    // Priority 3: Out of Stock
    if (totalStock === 0) {
        return 'CRITICAL';
    }

    const reorderPoint = reorderLevel || minStock || 0;
    const gap = reorderPoint - totalStock;

    // Priority 4: Low Stock (Gap exists OR below minStock)
    if (gap > 0) {
        return 'LOW_STOCK';
    }

    if (totalStock <= minStock) {
        return 'LOW_STOCK';
    }

    return 'HEALTHY';
}
