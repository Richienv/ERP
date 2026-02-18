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

    // Priority 1: New Product (Created within last 24 hours with zero stock)
    if (createdAt) {
        const createdDate = new Date(createdAt);
        const now = new Date();
        const diffInHours = (now.getTime() - createdDate.getTime()) / (1000 * 60 * 60);

        if (diffInHours < 24 && totalStock === 0) {
            return 'NEW';
        }
    }

    // Priority 2: Out of Stock
    if (totalStock === 0) {
        return 'CRITICAL';
    }

    const reorderPoint = reorderLevel || minStock || 0;
    const gap = reorderPoint - totalStock;

    // Priority 3: Stock-based status (actual stock always takes precedence)
    if (gap > 0 || totalStock <= minStock) {
        // Stock is actually low — manualAlert elevates LOW_STOCK to CRITICAL
        return manualAlert ? 'CRITICAL' : 'LOW_STOCK';
    }

    // Stock is above all thresholds — product is healthy regardless of manualAlert
    return 'HEALTHY';
}
