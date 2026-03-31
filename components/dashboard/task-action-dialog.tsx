"use client"

import dynamic from "next/dynamic"

const POApprovalPopup = dynamic(
    () => import("./popups/po-approval-popup").then((m) => ({ default: m.POApprovalPopup })),
    { ssr: false }
)
const InvoiceApprovalPopup = dynamic(
    () => import("./popups/invoice-approval-popup").then((m) => ({ default: m.InvoiceApprovalPopup })),
    { ssr: false }
)
const PRApprovalPopup = dynamic(
    () => import("./popups/pr-approval-popup").then((m) => ({ default: m.PRApprovalPopup })),
    { ssr: false }
)
const VendorQuickEditPopup = dynamic(
    () => import("./popups/vendor-quick-edit-popup").then((m) => ({ default: m.VendorQuickEditPopup })),
    { ssr: false }
)
const ProductQuickEditPopup = dynamic(
    () => import("./popups/product-quick-edit-popup").then((m) => ({ default: m.ProductQuickEditPopup })),
    { ssr: false }
)
const LowStockPopup = dynamic(
    () => import("./popups/low-stock-popup").then((m) => ({ default: m.LowStockPopup })),
    { ssr: false }
)

export type TaskType =
    | "low-stock"
    | "pending-approvals"
    | "pending-pr"
    | "vendors-incomplete"
    | "products-incomplete"
    | "customers-incomplete"
    | "pending-invoices"

interface TaskActionDialogProps {
    taskType: TaskType | null
    open: boolean
    onClose: () => void
    onTaskActioned?: (taskType: TaskType) => void
}

export function TaskActionDialog({ taskType, open, onClose, onTaskActioned }: TaskActionDialogProps) {
    if (!taskType || !open) return null

    const handleAllActioned = () => onTaskActioned?.(taskType)

    switch (taskType) {
        case "pending-approvals":
            return <POApprovalPopup open={open} onClose={onClose} onAllActioned={handleAllActioned} />
        case "pending-invoices":
            return <InvoiceApprovalPopup open={open} onClose={onClose} onAllActioned={handleAllActioned} />
        case "pending-pr":
            return <PRApprovalPopup open={open} onClose={onClose} onAllActioned={handleAllActioned} />
        case "vendors-incomplete":
            return <VendorQuickEditPopup open={open} onClose={onClose} onAllActioned={handleAllActioned} />
        case "products-incomplete":
        case "customers-incomplete":
            return <ProductQuickEditPopup open={open} onClose={onClose} taskType={taskType} onAllActioned={handleAllActioned} />
        case "low-stock":
            return <LowStockPopup open={open} onClose={onClose} onAllActioned={handleAllActioned} />
        default:
            return null
    }
}
