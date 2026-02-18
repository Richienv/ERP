import { describe, it, expect } from 'vitest';
import { calculateProductStatus } from '../lib/inventory-logic';

describe('Inventory Kanban Logic', () => {

    it('should return HEALTHY when stock is sufficient even if manualAlert is true', () => {
        // manualAlert should NOT override healthy stock levels
        expect(calculateProductStatus({
            totalStock: 100, minStock: 10, manualAlert: true
        })).toBe('HEALTHY');
    });

    it('should return CRITICAL if manualAlert is true AND stock is 0', () => {
        expect(calculateProductStatus({
            totalStock: 0, minStock: 10, manualAlert: true
        })).toBe('CRITICAL');
    });

    it('should elevate LOW_STOCK to CRITICAL when manualAlert is true', () => {
        // Stock is low (5 < minStock 10), manualAlert makes it CRITICAL
        expect(calculateProductStatus({
            totalStock: 5, minStock: 10, manualAlert: true
        })).toBe('CRITICAL');
    });

    it('should return CRITICAL if stock is 0 (and not manual alert)', () => {
        expect(calculateProductStatus({
            totalStock: 0, minStock: 10, manualAlert: false
        })).toBe('CRITICAL');
    });

    it('should return LOW_STOCK if stock is below minStock', () => {
        expect(calculateProductStatus({
            totalStock: 5, minStock: 10, manualAlert: false
        })).toBe('LOW_STOCK');
    });

    it('should return LOW_STOCK if stock is below reorderLevel (Gap > 0)', () => {
        // e.g. Min=10, Reorder=20, Stock=15. Gap = 5.
        expect(calculateProductStatus({
            totalStock: 15, minStock: 10, reorderLevel: 20, manualAlert: false
        })).toBe('LOW_STOCK');
    });

    it('should return HEALTHY if stock is sufficient', () => {
        expect(calculateProductStatus({
            totalStock: 50, minStock: 10, reorderLevel: 20, manualAlert: false
        })).toBe('HEALTHY');
    });

});
