export type WorkflowModel =
    | 'SalesOrder'
    | 'Quotation'
    | 'Customer'
    | 'Lead'
    | 'StockLevel'
    | 'StockMovement'
    | 'Product'
    | 'Warehouse'
    | 'CreditNote';

export type WorkflowAction =
    | 'CREATE'
    | 'UPDATE'
    | 'DELETE'
    | 'APPROVE'
    | 'REJECT'
    | 'CHECK_STOCK'
    | 'RESERVE'
    | 'SHIP'
    | 'INVOICE'
    | 'PAY';

export interface WorkflowStep {
    id: string;
    label: string;
    model: WorkflowModel;
    action: WorkflowAction;
    description?: string;

    // New fields for Excel/CSV Mapping
    role?: string;
    moduleKey?: string;
    condition?: string;
    dataInput?: string[];
    isGap?: boolean;



    // IDs of the next steps. If empty, it's an end node.
    next?: string[];
    // If this step is a decision (e.g., Stock > 0?), these are the conditions
    conditions?: {
        field: string;
        operator: 'equals' | 'greaterThan' | 'lessThan' | 'contains';
        value: string | number | boolean;
        nextId: string;
    }[];
}

export interface WorkflowDefinition {
    workflowName: string;
    description: string;
    version: string;
    steps: WorkflowStep[];
}

export interface WorkflowValidationResult {
    isValid: boolean;
    errors: string[];
}
