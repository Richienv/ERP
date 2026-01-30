export type KanbanStatus = 'HEALTHY' | 'LOW_STOCK' | 'CRITICAL';

export interface ProductStockInfo {
    totalStock: number;
    minStock: number;
    reorderLevel?: number;
    manualAlert: boolean;
}

export function calculateProductStatus(product: ProductStockInfo): KanbanStatus {
    const { totalStock, minStock, reorderLevel = 0, manualAlert } = product;

    // Priority 1: Manual Alert
    if (manualAlert) {
        return 'CRITICAL';
    }

    // Priority 2: Out of Stock
    if (totalStock === 0) {
        return 'CRITICAL';
    }

    const reorderPoint = reorderLevel || minStock || 0;
    const gap = reorderPoint - totalStock;

    // Priority 3: Low Stock (Gap exists OR below minStock)
    // "Low stock is stock that almost run out... critical is when is almost 0"
    if (gap > 0) {
        return 'LOW_STOCK';
    }

    if (totalStock <= minStock) {
        return 'LOW_STOCK';
    }

    return 'HEALTHY';
}
