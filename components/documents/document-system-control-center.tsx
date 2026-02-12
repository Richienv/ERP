"use client"

import { useEffect, useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import {
    createDocumentCategory,
    createDocumentSystemRole,
    createDocumentWarehouse,
    updateDocumentCategory,
    updateDocumentSystemRole,
    updateDocumentWarehouse,
    updateRolePermissionsFromDocuments,
} from "@/app/actions/documents-system"
import { useWorkflowConfig } from "@/components/workflow/workflow-config-context"
import {
    Download,
    FileText,
    FolderKanban,
    Layers,
    Pencil,
    Plus,
    ShieldCheck,
    Warehouse,
} from "lucide-react"

type CategoryItem = {
    id: string
    code: string
    name: string
    description: string
    isActive: boolean
    parentId?: string | null
    parentName?: string | null
    itemCount: number
    updatedAt: string | Date
}

type WarehouseItem = {
    id: string
    code: string
    name: string
    address: string
    city: string
    province: string
    capacity: number
    isActive: boolean
    managerId?: string | null
    managerName?: string
    managerCode?: string
    updatedAt: string | Date
}

type SystemRoleItem = {
    id: string
    code: string
    name: string
    description: string
    isSystem: boolean
    permissions: string[]
    updatedAt: string | Date
}

type PermissionOption = {
    key: string
    label: string
    group: string
}

type DocumentRow = {
    id: string
    number?: string
    status: string
    date?: string | Date
    updatedAt: string | Date
    partnerName?: string
    totalAmount?: number
    viewUrl: string
    warehouse?: string
    purchaseOrderNumber?: string
    period?: string
    periodLabel?: string
    type?: string
}

type ModuleCatalogItem = {
    key: string
    name: string
    model: string
    action: string
    roleRequired: string
    description: string
}

type DocumentsSystemData = {
    categories: CategoryItem[]
    warehouses: WarehouseItem[]
    roles: SystemRoleItem[]
    roleAuditEvents: {
        id: string
        roleId: string
        roleCode: string
        roleName: string | null
        eventType: string
        actorLabel: string | null
        beforePermissions: string[]
        afterPermissions: string[]
        changedPermissions: string[]
        createdAt: string | Date
    }[]
    documents: {
        purchaseOrders: DocumentRow[]
        invoices: DocumentRow[]
        goodsReceipts: DocumentRow[]
        payrollRuns: DocumentRow[]
    }
    permissionOptions: PermissionOption[]
    moduleCatalog: ModuleCatalogItem[]
    managerOptions: {
        id: string
        employeeCode: string
        name: string
        department: string
        position: string
    }[]
    currentUserRole: string
    currentSystemRoleCode: string | null
    canManage: boolean
}

type CategoryFormState = {
    code: string
    name: string
    description: string
    isActive: boolean
    parentId: string
}

type WarehouseFormState = {
    code: string
    name: string
    address: string
    city: string
    province: string
    capacity: string
    managerId: string
    isActive: boolean
}

type RoleFormState = {
    code: string
    name: string
    description: string
    permissions: string[]
}

const emptyCategoryForm: CategoryFormState = {
    code: "",
    name: "",
    description: "",
    isActive: true,
    parentId: "",
}

const emptyWarehouseForm: WarehouseFormState = {
    code: "",
    name: "",
    address: "",
    city: "",
    province: "",
    capacity: "",
    managerId: "",
    isActive: true,
}

const emptyRoleForm: RoleFormState = {
    code: "",
    name: "",
    description: "",
    permissions: [],
}

const formatDateTime = (value: string | Date | undefined) => {
    if (!value) return "-"
    const date = value instanceof Date ? value : new Date(value)
    if (Number.isNaN(date.getTime())) return "-"
    return date.toLocaleString("id-ID", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    })
}

const formatCurrency = (amount?: number) => {
    const safeAmount = Number(amount || 0)
    return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(safeAmount)
}

const isInDateRange = (value: string | Date | undefined, startDate: string, endDate: string) => {
    const date = value ? new Date(value) : null
    if (!date || Number.isNaN(date.getTime())) return false
    if (startDate) {
        const start = new Date(`${startDate}T00:00:00`)
        if (date < start) return false
    }
    if (endDate) {
        const end = new Date(`${endDate}T23:59:59.999`)
        if (date > end) return false
    }
    return true
}

const downloadCsv = (filename: string, headers: string[], rows: Array<Array<string | number>>) => {
    const escapeCell = (value: string) => `"${value.replace(/"/g, '""')}"`
    const csvContent = [headers, ...rows]
        .map((row) => row.map((cell) => escapeCell(String(cell ?? ""))).join(","))
        .join("\n")

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
}

export function DocumentSystemControlCenter({ initialData }: { initialData: DocumentsSystemData }) {
    const router = useRouter()
    const { refreshFromServer } = useWorkflowConfig()
    const [isPending, startTransition] = useTransition()

    const [data, setData] = useState<DocumentsSystemData>(initialData)
    const [categorySearch, setCategorySearch] = useState("")
    const [warehouseSearch, setWarehouseSearch] = useState("")
    const [roleSearch, setRoleSearch] = useState("")
    const [auditSearch, setAuditSearch] = useState("")
    const [auditRoleFilter, setAuditRoleFilter] = useState("__all__")
    const [auditEventFilter, setAuditEventFilter] = useState("__all__")
    const [auditActorFilter, setAuditActorFilter] = useState("__all__")
    const [auditStartDate, setAuditStartDate] = useState("")
    const [auditEndDate, setAuditEndDate] = useState("")
    const [auditPage, setAuditPage] = useState(1)
    const [auditPageSize, setAuditPageSize] = useState("20")

    const [poSearch, setPoSearch] = useState("")
    const [poStatusFilter, setPoStatusFilter] = useState("__all__")
    const [poStartDate, setPoStartDate] = useState("")
    const [poEndDate, setPoEndDate] = useState("")
    const [poPage, setPoPage] = useState(1)
    const [poPageSize, setPoPageSize] = useState("20")

    const [invoiceSearch, setInvoiceSearch] = useState("")
    const [invoiceStatusFilter, setInvoiceStatusFilter] = useState("__all__")
    const [invoiceTypeFilter, setInvoiceTypeFilter] = useState("__all__")
    const [invoiceStartDate, setInvoiceStartDate] = useState("")
    const [invoiceEndDate, setInvoiceEndDate] = useState("")
    const [invoicePage, setInvoicePage] = useState(1)
    const [invoicePageSize, setInvoicePageSize] = useState("20")

    const [grnSearch, setGrnSearch] = useState("")
    const [grnStatusFilter, setGrnStatusFilter] = useState("__all__")
    const [grnStartDate, setGrnStartDate] = useState("")
    const [grnEndDate, setGrnEndDate] = useState("")
    const [grnPage, setGrnPage] = useState(1)
    const [grnPageSize, setGrnPageSize] = useState("20")

    const [payrollSearch, setPayrollSearch] = useState("")
    const [payrollStatusFilter, setPayrollStatusFilter] = useState("__all__")
    const [payrollStartDate, setPayrollStartDate] = useState("")
    const [payrollEndDate, setPayrollEndDate] = useState("")
    const [payrollPage, setPayrollPage] = useState(1)
    const [payrollPageSize, setPayrollPageSize] = useState("20")

    const [categoryModalOpen, setCategoryModalOpen] = useState(false)
    const [editingCategory, setEditingCategory] = useState<CategoryItem | null>(null)
    const [categoryForm, setCategoryForm] = useState<CategoryFormState>(emptyCategoryForm)

    const [warehouseModalOpen, setWarehouseModalOpen] = useState(false)
    const [editingWarehouse, setEditingWarehouse] = useState<WarehouseItem | null>(null)
    const [warehouseForm, setWarehouseForm] = useState<WarehouseFormState>(emptyWarehouseForm)

    const [roleModalOpen, setRoleModalOpen] = useState(false)
    const [editingRole, setEditingRole] = useState<SystemRoleItem | null>(null)
    const [roleForm, setRoleForm] = useState<RoleFormState>(emptyRoleForm)

    const [permissionModalOpen, setPermissionModalOpen] = useState(false)
    const [permissionRole, setPermissionRole] = useState<SystemRoleItem | null>(null)
    const [selectedPermissions, setSelectedPermissions] = useState<string[]>([])

    useEffect(() => {
        setData(initialData)
    }, [initialData])

    const permissionOptionsByGroup = useMemo(() => {
        return data.permissionOptions.reduce<Record<string, PermissionOption[]>>((groups, option) => {
            if (!groups[option.group]) groups[option.group] = []
            groups[option.group].push(option)
            return groups
        }, {})
    }, [data.permissionOptions])

    const filteredCategories = useMemo(() => {
        const query = categorySearch.trim().toLowerCase()
        if (!query) return data.categories
        return data.categories.filter((category) =>
            `${category.code} ${category.name} ${category.description}`.toLowerCase().includes(query)
        )
    }, [data.categories, categorySearch])

    const filteredWarehouses = useMemo(() => {
        const query = warehouseSearch.trim().toLowerCase()
        if (!query) return data.warehouses
        return data.warehouses.filter((warehouse) =>
            `${warehouse.code} ${warehouse.name} ${warehouse.city} ${warehouse.province} ${warehouse.managerName || ""}`.toLowerCase().includes(query)
        )
    }, [data.warehouses, warehouseSearch])

    const filteredRoles = useMemo(() => {
        const query = roleSearch.trim().toLowerCase()
        if (!query) return data.roles
        return data.roles.filter((role) =>
            `${role.code} ${role.name} ${role.description} ${role.permissions.join(" ")}`.toLowerCase().includes(query)
        )
    }, [data.roles, roleSearch])

    const availableParentCategories = useMemo(() => {
        if (!editingCategory) return data.categories
        return data.categories.filter((category) => category.id !== editingCategory.id)
    }, [data.categories, editingCategory])

    const auditRoleOptions = useMemo(() => (
        Array.from(new Set(data.roleAuditEvents.map((event) => event.roleCode).filter(Boolean))).sort((a, b) => a.localeCompare(b))
    ), [data.roleAuditEvents])

    const auditEventOptions = useMemo(() => (
        Array.from(new Set(data.roleAuditEvents.map((event) => event.eventType).filter(Boolean))).sort((a, b) => a.localeCompare(b))
    ), [data.roleAuditEvents])

    const auditActorOptions = useMemo(() => (
        Array.from(new Set(data.roleAuditEvents.map((event) => event.actorLabel || "System"))).sort((a, b) => a.localeCompare(b))
    ), [data.roleAuditEvents])

    const filteredRoleAuditEvents = useMemo(() => {
        const query = auditSearch.trim().toLowerCase()
        const hasStartDate = Boolean(auditStartDate)
        const hasEndDate = Boolean(auditEndDate)
        const startDate = hasStartDate ? new Date(`${auditStartDate}T00:00:00`) : null
        const endDate = hasEndDate ? new Date(`${auditEndDate}T23:59:59.999`) : null
        return data.roleAuditEvents.filter((event) => {
            if (auditRoleFilter !== "__all__" && event.roleCode !== auditRoleFilter) return false
            if (auditEventFilter !== "__all__" && event.eventType !== auditEventFilter) return false
            if (auditActorFilter !== "__all__" && (event.actorLabel || "System") !== auditActorFilter) return false
            const eventDate = new Date(event.createdAt)
            if (hasStartDate && startDate && eventDate < startDate) return false
            if (hasEndDate && endDate && eventDate > endDate) return false
            if (!query) return true
            const haystack = [
                event.roleCode,
                event.roleName || "",
                event.eventType,
                event.actorLabel || "System",
                ...(event.changedPermissions || []),
            ].join(" ").toLowerCase()
            return haystack.includes(query)
        })
    }, [data.roleAuditEvents, auditSearch, auditRoleFilter, auditEventFilter, auditActorFilter, auditStartDate, auditEndDate])

    useEffect(() => {
        setAuditPage(1)
    }, [auditSearch, auditRoleFilter, auditEventFilter, auditActorFilter, auditStartDate, auditEndDate, auditPageSize])

    const totalAuditPages = useMemo(() => {
        const pageSize = Number(auditPageSize) || 20
        return Math.max(1, Math.ceil(filteredRoleAuditEvents.length / pageSize))
    }, [filteredRoleAuditEvents.length, auditPageSize])

    useEffect(() => {
        setAuditPage((prev) => Math.min(Math.max(1, prev), totalAuditPages))
    }, [totalAuditPages])

    const paginatedRoleAuditEvents = useMemo(() => {
        const pageSize = Number(auditPageSize) || 20
        const safePage = Math.min(Math.max(1, auditPage), totalAuditPages)
        const start = (safePage - 1) * pageSize
        return filteredRoleAuditEvents.slice(start, start + pageSize)
    }, [filteredRoleAuditEvents, auditPage, auditPageSize, totalAuditPages])

    const auditRangeLabel = useMemo(() => {
        if (filteredRoleAuditEvents.length === 0) return "0-0"
        const pageSize = Number(auditPageSize) || 20
        const safePage = Math.min(Math.max(1, auditPage), totalAuditPages)
        const start = (safePage - 1) * pageSize + 1
        const end = Math.min(filteredRoleAuditEvents.length, start + pageSize - 1)
        return `${start}-${end}`
    }, [filteredRoleAuditEvents.length, auditPage, auditPageSize, totalAuditPages])

    const getRangeLabel = (total: number, page: number, pageSize: string) => {
        if (total === 0) return "0-0"
        const size = Number(pageSize) || 20
        const start = (page - 1) * size + 1
        const end = Math.min(total, start + size - 1)
        return `${start}-${end}`
    }

    const exportRoleAuditCsv = () => {
        if (filteredRoleAuditEvents.length === 0) {
            toast.error("Tidak ada data audit untuk diexport")
            return
        }

        downloadCsv(
            `role-permission-audit-${new Date().toISOString().slice(0, 10)}.csv`,
            ["Timestamp", "Role Code", "Role Name", "Event", "Actor", "Changed Permissions", "Before Permissions", "After Permissions"],
            filteredRoleAuditEvents.map((event) => [
                new Date(event.createdAt).toISOString(),
                event.roleCode,
                event.roleName || "",
                event.eventType,
                event.actorLabel || "System",
                (event.changedPermissions || []).join(" | "),
                (event.beforePermissions || []).join(" | "),
                (event.afterPermissions || []).join(" | "),
            ])
        )
        toast.success("Audit CSV berhasil diunduh")
    }

    const poStatusOptions = useMemo(
        () => Array.from(new Set(data.documents.purchaseOrders.map((row) => row.status).filter(Boolean))).sort((a, b) => a.localeCompare(b)),
        [data.documents.purchaseOrders]
    )
    const invoiceStatusOptions = useMemo(
        () => Array.from(new Set(data.documents.invoices.map((row) => row.status).filter(Boolean))).sort((a, b) => a.localeCompare(b)),
        [data.documents.invoices]
    )
    const invoiceTypeOptions = useMemo(
        () => Array.from(new Set(data.documents.invoices.map((row) => row.type || "-").filter(Boolean))).sort((a, b) => a.localeCompare(b)),
        [data.documents.invoices]
    )
    const grnStatusOptions = useMemo(
        () => Array.from(new Set(data.documents.goodsReceipts.map((row) => row.status).filter(Boolean))).sort((a, b) => a.localeCompare(b)),
        [data.documents.goodsReceipts]
    )
    const payrollStatusOptions = useMemo(
        () => Array.from(new Set(data.documents.payrollRuns.map((row) => row.status).filter(Boolean))).sort((a, b) => a.localeCompare(b)),
        [data.documents.payrollRuns]
    )

    const filteredPoRows = useMemo(() => {
        const query = poSearch.trim().toLowerCase()
        return data.documents.purchaseOrders.filter((row) => {
            if (poStatusFilter !== "__all__" && row.status !== poStatusFilter) return false
            if (!isInDateRange(row.updatedAt, poStartDate, poEndDate)) return false
            if (!query) return true
            return `${row.number || ""} ${row.partnerName || ""} ${row.status}`.toLowerCase().includes(query)
        })
    }, [data.documents.purchaseOrders, poSearch, poStatusFilter, poStartDate, poEndDate])

    const filteredInvoiceRows = useMemo(() => {
        const query = invoiceSearch.trim().toLowerCase()
        return data.documents.invoices.filter((row) => {
            if (invoiceStatusFilter !== "__all__" && row.status !== invoiceStatusFilter) return false
            if (invoiceTypeFilter !== "__all__" && (row.type || "-") !== invoiceTypeFilter) return false
            if (!isInDateRange(row.updatedAt, invoiceStartDate, invoiceEndDate)) return false
            if (!query) return true
            return `${row.number || ""} ${row.partnerName || ""} ${row.status} ${row.type || "-"}`.toLowerCase().includes(query)
        })
    }, [data.documents.invoices, invoiceSearch, invoiceStatusFilter, invoiceTypeFilter, invoiceStartDate, invoiceEndDate])

    const filteredGrnRows = useMemo(() => {
        const query = grnSearch.trim().toLowerCase()
        return data.documents.goodsReceipts.filter((row) => {
            if (grnStatusFilter !== "__all__" && row.status !== grnStatusFilter) return false
            if (!isInDateRange(row.updatedAt, grnStartDate, grnEndDate)) return false
            if (!query) return true
            return `${row.number || ""} ${row.purchaseOrderNumber || ""} ${row.warehouse || ""} ${row.status}`.toLowerCase().includes(query)
        })
    }, [data.documents.goodsReceipts, grnSearch, grnStatusFilter, grnStartDate, grnEndDate])

    const filteredPayrollRows = useMemo(() => {
        const query = payrollSearch.trim().toLowerCase()
        return data.documents.payrollRuns.filter((row) => {
            if (payrollStatusFilter !== "__all__" && row.status !== payrollStatusFilter) return false
            if (!isInDateRange(row.updatedAt, payrollStartDate, payrollEndDate)) return false
            if (!query) return true
            return `${row.periodLabel || ""} ${row.period || ""} ${row.status}`.toLowerCase().includes(query)
        })
    }, [data.documents.payrollRuns, payrollSearch, payrollStatusFilter, payrollStartDate, payrollEndDate])

    useEffect(() => {
        setPoPage(1)
    }, [poSearch, poStatusFilter, poStartDate, poEndDate, poPageSize])
    useEffect(() => {
        setInvoicePage(1)
    }, [invoiceSearch, invoiceStatusFilter, invoiceTypeFilter, invoiceStartDate, invoiceEndDate, invoicePageSize])
    useEffect(() => {
        setGrnPage(1)
    }, [grnSearch, grnStatusFilter, grnStartDate, grnEndDate, grnPageSize])
    useEffect(() => {
        setPayrollPage(1)
    }, [payrollSearch, payrollStatusFilter, payrollStartDate, payrollEndDate, payrollPageSize])

    const poTotalPages = useMemo(() => Math.max(1, Math.ceil(filteredPoRows.length / (Number(poPageSize) || 20))), [filteredPoRows.length, poPageSize])
    const invoiceTotalPages = useMemo(() => Math.max(1, Math.ceil(filteredInvoiceRows.length / (Number(invoicePageSize) || 20))), [filteredInvoiceRows.length, invoicePageSize])
    const grnTotalPages = useMemo(() => Math.max(1, Math.ceil(filteredGrnRows.length / (Number(grnPageSize) || 20))), [filteredGrnRows.length, grnPageSize])
    const payrollTotalPages = useMemo(() => Math.max(1, Math.ceil(filteredPayrollRows.length / (Number(payrollPageSize) || 20))), [filteredPayrollRows.length, payrollPageSize])

    useEffect(() => setPoPage((prev) => Math.min(Math.max(1, prev), poTotalPages)), [poTotalPages])
    useEffect(() => setInvoicePage((prev) => Math.min(Math.max(1, prev), invoiceTotalPages)), [invoiceTotalPages])
    useEffect(() => setGrnPage((prev) => Math.min(Math.max(1, prev), grnTotalPages)), [grnTotalPages])
    useEffect(() => setPayrollPage((prev) => Math.min(Math.max(1, prev), payrollTotalPages)), [payrollTotalPages])

    const paginatedPoRows = useMemo(() => {
        const size = Number(poPageSize) || 20
        const start = (poPage - 1) * size
        return filteredPoRows.slice(start, start + size)
    }, [filteredPoRows, poPage, poPageSize])
    const paginatedInvoiceRows = useMemo(() => {
        const size = Number(invoicePageSize) || 20
        const start = (invoicePage - 1) * size
        return filteredInvoiceRows.slice(start, start + size)
    }, [filteredInvoiceRows, invoicePage, invoicePageSize])
    const paginatedGrnRows = useMemo(() => {
        const size = Number(grnPageSize) || 20
        const start = (grnPage - 1) * size
        return filteredGrnRows.slice(start, start + size)
    }, [filteredGrnRows, grnPage, grnPageSize])
    const paginatedPayrollRows = useMemo(() => {
        const size = Number(payrollPageSize) || 20
        const start = (payrollPage - 1) * size
        return filteredPayrollRows.slice(start, start + size)
    }, [filteredPayrollRows, payrollPage, payrollPageSize])

    const exportPoCsv = () => {
        if (filteredPoRows.length === 0) return toast.error("Tidak ada dokumen PO untuk diexport")
        downloadCsv(
            `po-registry-${new Date().toISOString().slice(0, 10)}.csv`,
            ["PO Number", "Vendor", "Status", "Total", "Updated At"],
            filteredPoRows.map((row) => [row.number || "", row.partnerName || "", row.status, row.totalAmount || 0, new Date(row.updatedAt).toISOString()])
        )
        toast.success("PO registry CSV berhasil diunduh")
    }

    const exportInvoiceCsv = () => {
        if (filteredInvoiceRows.length === 0) return toast.error("Tidak ada dokumen invoice untuk diexport")
        downloadCsv(
            `invoice-registry-${new Date().toISOString().slice(0, 10)}.csv`,
            ["Invoice Number", "Partner", "Type", "Status", "Total", "Updated At"],
            filteredInvoiceRows.map((row) => [row.number || "", row.partnerName || "", row.type || "-", row.status, row.totalAmount || 0, new Date(row.updatedAt).toISOString()])
        )
        toast.success("Invoice registry CSV berhasil diunduh")
    }

    const exportGrnCsv = () => {
        if (filteredGrnRows.length === 0) return toast.error("Tidak ada dokumen GRN untuk diexport")
        downloadCsv(
            `grn-registry-${new Date().toISOString().slice(0, 10)}.csv`,
            ["GRN Number", "PO Number", "Warehouse", "Status", "Updated At"],
            filteredGrnRows.map((row) => [row.number || "", row.purchaseOrderNumber || "", row.warehouse || "", row.status, new Date(row.updatedAt).toISOString()])
        )
        toast.success("GRN registry CSV berhasil diunduh")
    }

    const exportPayrollCsv = () => {
        if (filteredPayrollRows.length === 0) return toast.error("Tidak ada dokumen payroll untuk diexport")
        downloadCsv(
            `payroll-registry-${new Date().toISOString().slice(0, 10)}.csv`,
            ["Period", "Status", "Updated At"],
            filteredPayrollRows.map((row) => [row.periodLabel || row.period || "", row.status, new Date(row.updatedAt).toISOString()])
        )
        toast.success("Payroll registry CSV berhasil diunduh")
    }

    const openCreateCategory = () => {
        setEditingCategory(null)
        setCategoryForm(emptyCategoryForm)
        setCategoryModalOpen(true)
    }

    const openEditCategory = (category: CategoryItem) => {
        setEditingCategory(category)
        setCategoryForm({
            code: category.code,
            name: category.name,
            description: category.description || "",
            isActive: category.isActive,
            parentId: category.parentId || "",
        })
        setCategoryModalOpen(true)
    }

    const submitCategory = () => {
        startTransition(async () => {
            const payload = {
                ...categoryForm,
                parentId: categoryForm.parentId || null,
            }

            const result = editingCategory
                ? await updateDocumentCategory(editingCategory.id, payload)
                : await createDocumentCategory(payload)

            if (!result.success) {
                toast.error(result.error || "Gagal menyimpan kategori")
                return
            }

            toast.success(editingCategory ? "Kategori berhasil diperbarui" : "Kategori berhasil dibuat")
            setCategoryModalOpen(false)
            router.refresh()
        })
    }

    const openCreateWarehouse = () => {
        setEditingWarehouse(null)
        setWarehouseForm(emptyWarehouseForm)
        setWarehouseModalOpen(true)
    }

    const openEditWarehouse = (warehouse: WarehouseItem) => {
        setEditingWarehouse(warehouse)
        setWarehouseForm({
            code: warehouse.code,
            name: warehouse.name,
            address: warehouse.address || "",
            city: warehouse.city || "",
            province: warehouse.province || "",
            capacity: warehouse.capacity ? String(warehouse.capacity) : "",
            managerId: warehouse.managerId || "",
            isActive: warehouse.isActive,
        })
        setWarehouseModalOpen(true)
    }

    const submitWarehouse = () => {
        startTransition(async () => {
            const payload = {
                ...warehouseForm,
                managerId: warehouseForm.managerId || null,
                capacity: warehouseForm.capacity ? Number(warehouseForm.capacity) : undefined,
            }

            const result = editingWarehouse
                ? await updateDocumentWarehouse(editingWarehouse.id, payload)
                : await createDocumentWarehouse(payload)

            if (!result.success) {
                toast.error(result.error || "Gagal menyimpan gudang")
                return
            }

            toast.success(editingWarehouse ? "Gudang berhasil diperbarui" : "Gudang berhasil dibuat")
            setWarehouseModalOpen(false)
            router.refresh()
        })
    }

    const openCreateRole = () => {
        setEditingRole(null)
        setRoleForm(emptyRoleForm)
        setRoleModalOpen(true)
    }

    const openEditRole = (role: SystemRoleItem) => {
        setEditingRole(role)
        setRoleForm({
            code: role.code,
            name: role.name,
            description: role.description || "",
            permissions: role.permissions || [],
        })
        setRoleModalOpen(true)
    }

    const submitRole = () => {
        startTransition(async () => {
            const payload = {
                ...roleForm,
                permissions: roleForm.permissions,
            }

            const result = editingRole
                ? await updateDocumentSystemRole(editingRole.id, payload)
                : await createDocumentSystemRole(payload)

            if (!result.success) {
                toast.error(result.error || "Gagal menyimpan role")
                return
            }

            toast.success(editingRole ? "Role berhasil diperbarui" : "Role baru berhasil dibuat")
            setRoleModalOpen(false)
            router.refresh()
        })
    }

    const openPermissionManager = (role: SystemRoleItem) => {
        setPermissionRole(role)
        setSelectedPermissions(role.permissions || [])
        setPermissionModalOpen(true)
    }

    const togglePermission = (permission: string) => {
        setSelectedPermissions((prev) =>
            prev.includes(permission)
                ? prev.filter((item) => item !== permission)
                : [...prev, permission]
        )
    }

    const savePermissions = () => {
        if (!permissionRole) return
        startTransition(async () => {
            const result = await updateRolePermissionsFromDocuments(permissionRole.id, { permissions: selectedPermissions })
            if (!result.success) {
                toast.error(result.error || "Gagal memperbarui permission")
                return
            }

            toast.success("Hak akses role berhasil diperbarui")
            setPermissionModalOpen(false)

            if (data.currentSystemRoleCode && permissionRole.code === data.currentSystemRoleCode) {
                await refreshFromServer()
            }
            router.refresh()
        })
    }

    const totalDocumentCount =
        data.documents.purchaseOrders.length +
        data.documents.invoices.length +
        data.documents.goodsReceipts.length +
        data.documents.payrollRuns.length

    return (
        <div className="space-y-6 p-4 md:p-8">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                    <h1 className="text-3xl font-black tracking-tight">Dokumen & Sistem Control Center</h1>
                    <p className="text-muted-foreground">
                        Satu pusat data master, modul, role, dan dokumen operasional lintas ERP.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Badge variant={data.canManage ? "default" : "secondary"}>
                        {data.canManage ? "Mode Kelola Aktif" : "Mode View Only"}
                    </Badge>
                    <Badge variant="outline">Role Login: {data.currentUserRole}</Badge>
                </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-semibold">Kategori Master</CardTitle>
                        <CardDescription>Terhubung ke produk & inventori</CardDescription>
                    </CardHeader>
                    <CardContent className="flex items-end justify-between">
                        <div className="text-2xl font-black">{data.categories.length}</div>
                        <FolderKanban className="h-5 w-5 text-blue-600" />
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-semibold">Gudang Aktif</CardTitle>
                        <CardDescription>Sumber stock & receiving</CardDescription>
                    </CardHeader>
                    <CardContent className="flex items-end justify-between">
                        <div className="text-2xl font-black">{data.warehouses.filter((item) => item.isActive).length}</div>
                        <Warehouse className="h-5 w-5 text-emerald-600" />
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-semibold">Role Sistem</CardTitle>
                        <CardDescription>Kontrol akses modul</CardDescription>
                    </CardHeader>
                    <CardContent className="flex items-end justify-between">
                        <div className="text-2xl font-black">{data.roles.length}</div>
                        <ShieldCheck className="h-5 w-5 text-amber-600" />
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-semibold">Registry Dokumen</CardTitle>
                        <CardDescription>PO, Invoice, GRN, Payroll</CardDescription>
                    </CardHeader>
                    <CardContent className="flex items-end justify-between">
                        <div className="text-2xl font-black">{totalDocumentCount}</div>
                        <FileText className="h-5 w-5 text-violet-600" />
                    </CardContent>
                </Card>
            </div>

            <Tabs defaultValue="master" className="space-y-4">
                <TabsList className="h-auto flex-wrap gap-2 bg-white border p-1">
                    <TabsTrigger value="master">Master Data</TabsTrigger>
                    <TabsTrigger value="roles">Role & Modules</TabsTrigger>
                    <TabsTrigger value="documents">Document Registry</TabsTrigger>
                    <TabsTrigger value="catalog">Workflow Module Catalog</TabsTrigger>
                </TabsList>

                <TabsContent value="master" className="space-y-6">
                    <Card>
                        <CardHeader>
                            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                                <div>
                                    <CardTitle>Kategori Produk Master</CardTitle>
                                    <CardDescription>
                                        Perubahan di sini langsung berdampak ke Inventori, Manufaktur, Pengadaan, dan Finance posting.
                                    </CardDescription>
                                </div>
                                <div className="flex gap-2">
                                    <Input
                                        placeholder="Cari kategori..."
                                        value={categorySearch}
                                        onChange={(event) => setCategorySearch(event.target.value)}
                                        className="w-[260px]"
                                    />
                                    <Button onClick={openCreateCategory} disabled={!data.canManage}>
                                        <Plus className="mr-2 h-4 w-4" />
                                        Tambah Kategori
                                    </Button>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Kode</TableHead>
                                        <TableHead>Nama</TableHead>
                                        <TableHead>Parent</TableHead>
                                        <TableHead>Item</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead>Update</TableHead>
                                        <TableHead className="text-right">Aksi</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredCategories.map((category) => (
                                        <TableRow key={category.id}>
                                            <TableCell className="font-mono">{category.code}</TableCell>
                                            <TableCell>
                                                <div className="font-semibold">{category.name}</div>
                                                <div className="text-xs text-muted-foreground">{category.description || "-"}</div>
                                            </TableCell>
                                            <TableCell>{category.parentName || "-"}</TableCell>
                                            <TableCell>{category.itemCount}</TableCell>
                                            <TableCell>
                                                <Badge variant={category.isActive ? "default" : "secondary"}>
                                                    {category.isActive ? "Active" : "Inactive"}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>{formatDateTime(category.updatedAt)}</TableCell>
                                            <TableCell className="text-right">
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => openEditCategory(category)}
                                                    disabled={!data.canManage}
                                                >
                                                    <Pencil className="mr-2 h-3.5 w-3.5" />
                                                    Edit
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                                <div>
                                    <CardTitle>Master Gudang & Lokasi Operasional</CardTitle>
                                    <CardDescription>
                                        Dipakai oleh stok, pergerakan, receiving, transfer, stock opname, dan planning material.
                                    </CardDescription>
                                </div>
                                <div className="flex gap-2">
                                    <Input
                                        placeholder="Cari gudang..."
                                        value={warehouseSearch}
                                        onChange={(event) => setWarehouseSearch(event.target.value)}
                                        className="w-[260px]"
                                    />
                                    <Button onClick={openCreateWarehouse} disabled={!data.canManage}>
                                        <Plus className="mr-2 h-4 w-4" />
                                        Tambah Gudang
                                    </Button>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Kode</TableHead>
                                        <TableHead>Nama Gudang</TableHead>
                                        <TableHead>Lokasi</TableHead>
                                        <TableHead>Kapasitas</TableHead>
                                        <TableHead>Manager</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead className="text-right">Aksi</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredWarehouses.map((warehouse) => (
                                        <TableRow key={warehouse.id}>
                                            <TableCell className="font-mono">{warehouse.code}</TableCell>
                                            <TableCell className="font-semibold">{warehouse.name}</TableCell>
                                            <TableCell>{[warehouse.city, warehouse.province].filter(Boolean).join(", ") || warehouse.address || "-"}</TableCell>
                                            <TableCell>{warehouse.capacity > 0 ? warehouse.capacity.toLocaleString("id-ID") : "-"}</TableCell>
                                            <TableCell>{warehouse.managerName || "-"}</TableCell>
                                            <TableCell>
                                                <Badge variant={warehouse.isActive ? "default" : "secondary"}>
                                                    {warehouse.isActive ? "Active" : "Inactive"}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => openEditWarehouse(warehouse)}
                                                    disabled={!data.canManage}
                                                >
                                                    <Pencil className="mr-2 h-3.5 w-3.5" />
                                                    Edit
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="roles" className="space-y-6">
                    <Card>
                        <CardHeader>
                            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                                <div>
                                    <CardTitle>Role Sistem & Modul</CardTitle>
                                    <CardDescription>
                                        Kelola role dan permission modul. Saat permission role login berubah, tampilan ERP akan menyesuaikan.
                                    </CardDescription>
                                </div>
                                <div className="flex gap-2">
                                    <Input
                                        placeholder="Cari role..."
                                        value={roleSearch}
                                        onChange={(event) => setRoleSearch(event.target.value)}
                                        className="w-[260px]"
                                    />
                                    <Button onClick={openCreateRole} disabled={!data.canManage}>
                                        <Plus className="mr-2 h-4 w-4" />
                                        Tambah Role
                                    </Button>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Code</TableHead>
                                        <TableHead>Role Name</TableHead>
                                        <TableHead>Deskripsi</TableHead>
                                        <TableHead>Permissions</TableHead>
                                        <TableHead>Type</TableHead>
                                        <TableHead className="text-right">Aksi</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredRoles.map((role) => (
                                        <TableRow key={role.id}>
                                            <TableCell className="font-mono">{role.code}</TableCell>
                                            <TableCell className="font-semibold">{role.name}</TableCell>
                                            <TableCell>{role.description || "-"}</TableCell>
                                            <TableCell>
                                                <div className="flex flex-wrap gap-1">
                                                    {role.permissions.slice(0, 4).map((permission) => (
                                                        <Badge key={permission} variant="outline" className="font-mono text-[10px]">
                                                            {permission}
                                                        </Badge>
                                                    ))}
                                                    {role.permissions.length > 4 && (
                                                        <Badge variant="secondary">+{role.permissions.length - 4}</Badge>
                                                    )}
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant={role.isSystem ? "secondary" : "default"}>
                                                    {role.isSystem ? "System" : "Custom"}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex justify-end gap-2">
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => openPermissionManager(role)}
                                                        disabled={!data.canManage}
                                                    >
                                                        <Layers className="mr-2 h-3.5 w-3.5" />
                                                        Permissions
                                                    </Button>
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => openEditRole(role)}
                                                        disabled={!data.canManage || role.isSystem}
                                                    >
                                                        <Pencil className="mr-2 h-3.5 w-3.5" />
                                                        Edit
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <div className="flex flex-col gap-3">
                                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                                    <div>
                                        <CardTitle>Riwayat Perubahan Hak Akses</CardTitle>
                                        <CardDescription>
                                            Audit trail perubahan role dan permission modul agar governance tetap terpantau.
                                        </CardDescription>
                                    </div>
                                    <Button variant="outline" onClick={exportRoleAuditCsv}>
                                        <Download className="mr-2 h-4 w-4" />
                                        Export CSV
                                    </Button>
                                </div>
                                <div className="grid gap-2 md:grid-cols-6">
                                    <Input
                                        placeholder="Cari role/event/permission..."
                                        value={auditSearch}
                                        onChange={(event) => setAuditSearch(event.target.value)}
                                    />
                                    <Select value={auditRoleFilter} onValueChange={setAuditRoleFilter}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Filter role" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="__all__">Semua Role</SelectItem>
                                            {auditRoleOptions.map((roleCode) => (
                                                <SelectItem key={roleCode} value={roleCode}>{roleCode}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <Select value={auditEventFilter} onValueChange={setAuditEventFilter}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Filter event" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="__all__">Semua Event</SelectItem>
                                            {auditEventOptions.map((eventType) => (
                                                <SelectItem key={eventType} value={eventType}>{eventType}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <Select value={auditActorFilter} onValueChange={setAuditActorFilter}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Filter actor" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="__all__">Semua Aktor</SelectItem>
                                            {auditActorOptions.map((actor) => (
                                                <SelectItem key={actor} value={actor}>{actor}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <Input
                                        type="date"
                                        value={auditStartDate}
                                        onChange={(event) => setAuditStartDate(event.target.value)}
                                    />
                                    <Input
                                        type="date"
                                        value={auditEndDate}
                                        onChange={(event) => setAuditEndDate(event.target.value)}
                                    />
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Waktu</TableHead>
                                        <TableHead>Role</TableHead>
                                        <TableHead>Event</TableHead>
                                        <TableHead>Aktor</TableHead>
                                        <TableHead>Perubahan</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {paginatedRoleAuditEvents.length > 0 ? paginatedRoleAuditEvents.map((event) => (
                                        <TableRow key={event.id}>
                                            <TableCell>{formatDateTime(event.createdAt)}</TableCell>
                                            <TableCell>
                                                <div className="font-mono text-xs">{event.roleCode}</div>
                                                <div className="text-xs text-muted-foreground">{event.roleName || "-"}</div>
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant="secondary">{event.eventType}</Badge>
                                            </TableCell>
                                            <TableCell>{event.actorLabel || "System"}</TableCell>
                                            <TableCell>
                                                {event.changedPermissions.length > 0 ? (
                                                    <div className="flex flex-wrap gap-1">
                                                        {event.changedPermissions.slice(0, 6).map((permission) => (
                                                            <Badge key={`${event.id}-${permission}`} variant="outline" className="font-mono text-[10px]">
                                                                {permission}
                                                            </Badge>
                                                        ))}
                                                        {event.changedPermissions.length > 6 && (
                                                            <Badge variant="secondary">+{event.changedPermissions.length - 6}</Badge>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <span className="text-muted-foreground">Tidak ada perubahan permission</span>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    )) : (
                                        <TableRow>
                                            <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                                                Tidak ada event audit sesuai filter.
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                            <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                                <div className="text-sm text-muted-foreground">
                                    Menampilkan {auditRangeLabel} dari {filteredRoleAuditEvents.length} event
                                </div>
                                <div className="flex items-center gap-2">
                                    <Select value={auditPageSize} onValueChange={setAuditPageSize}>
                                        <SelectTrigger className="w-[130px]">
                                            <SelectValue placeholder="Rows/page" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="10">10 / halaman</SelectItem>
                                            <SelectItem value="20">20 / halaman</SelectItem>
                                            <SelectItem value="50">50 / halaman</SelectItem>
                                            <SelectItem value="100">100 / halaman</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setAuditPage((prev) => Math.max(1, prev - 1))}
                                        disabled={auditPage <= 1}
                                    >
                                        Sebelumnya
                                    </Button>
                                    <div className="min-w-[84px] text-center text-sm font-medium">
                                        Hal {Math.min(auditPage, totalAuditPages)} / {totalAuditPages}
                                    </div>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setAuditPage((prev) => Math.min(totalAuditPages, prev + 1))}
                                        disabled={auditPage >= totalAuditPages}
                                    >
                                        Selanjutnya
                                    </Button>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="documents" className="space-y-6">
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm">Purchase Order PDF</CardTitle>
                            </CardHeader>
                            <CardContent className="text-2xl font-black">{data.documents.purchaseOrders.length}</CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm">Invoice Documents</CardTitle>
                            </CardHeader>
                            <CardContent className="text-2xl font-black">{data.documents.invoices.length}</CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm">GRN Records</CardTitle>
                            </CardHeader>
                            <CardContent className="text-2xl font-black">{data.documents.goodsReceipts.length}</CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm">Payroll PDFs</CardTitle>
                            </CardHeader>
                            <CardContent className="text-2xl font-black">{data.documents.payrollRuns.length}</CardContent>
                        </Card>
                    </div>

                    <Card>
                        <CardHeader>
                            <div className="flex flex-col gap-3">
                                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                                    <CardTitle>Dokumen Purchase Order</CardTitle>
                                    <Button variant="outline" onClick={exportPoCsv}>
                                        <Download className="mr-2 h-4 w-4" />
                                        Export CSV
                                    </Button>
                                </div>
                                <div className="grid gap-2 md:grid-cols-4">
                                    <Input
                                        placeholder="Cari PO / vendor..."
                                        value={poSearch}
                                        onChange={(event) => setPoSearch(event.target.value)}
                                    />
                                    <Select value={poStatusFilter} onValueChange={setPoStatusFilter}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Filter status" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="__all__">Semua Status</SelectItem>
                                            {poStatusOptions.map((status) => (
                                                <SelectItem key={status} value={status}>{status}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <Input type="date" value={poStartDate} onChange={(event) => setPoStartDate(event.target.value)} />
                                    <Input type="date" value={poEndDate} onChange={(event) => setPoEndDate(event.target.value)} />
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>PO Number</TableHead>
                                        <TableHead>Vendor</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead>Total</TableHead>
                                        <TableHead>Update</TableHead>
                                        <TableHead className="text-right">Aksi</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {paginatedPoRows.map((row) => (
                                        <TableRow key={row.id}>
                                            <TableCell className="font-mono">{row.number}</TableCell>
                                            <TableCell>{row.partnerName || "-"}</TableCell>
                                            <TableCell><Badge variant="outline">{row.status}</Badge></TableCell>
                                            <TableCell>{formatCurrency(row.totalAmount)}</TableCell>
                                            <TableCell>{formatDateTime(row.updatedAt)}</TableCell>
                                            <TableCell className="text-right">
                                                <a href={row.viewUrl} target="_blank" rel="noreferrer">
                                                    <Button size="sm" variant="outline">Buka PDF</Button>
                                                </a>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                    {filteredPoRows.length === 0 && (
                                        <TableRow>
                                            <TableCell colSpan={6} className="py-6 text-center text-muted-foreground">
                                                Belum ada dokumen PO.
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                            <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                                <div className="text-sm text-muted-foreground">
                                    Menampilkan {getRangeLabel(filteredPoRows.length, poPage, poPageSize)} dari {filteredPoRows.length} dokumen
                                </div>
                                <div className="flex items-center gap-2">
                                    <Select value={poPageSize} onValueChange={setPoPageSize}>
                                        <SelectTrigger className="w-[130px]">
                                            <SelectValue placeholder="Rows/page" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="10">10 / halaman</SelectItem>
                                            <SelectItem value="20">20 / halaman</SelectItem>
                                            <SelectItem value="50">50 / halaman</SelectItem>
                                            <SelectItem value="100">100 / halaman</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <Button variant="outline" size="sm" onClick={() => setPoPage((prev) => Math.max(1, prev - 1))} disabled={poPage <= 1}>
                                        Sebelumnya
                                    </Button>
                                    <div className="min-w-[84px] text-center text-sm font-medium">
                                        Hal {poPage} / {poTotalPages}
                                    </div>
                                    <Button variant="outline" size="sm" onClick={() => setPoPage((prev) => Math.min(poTotalPages, prev + 1))} disabled={poPage >= poTotalPages}>
                                        Selanjutnya
                                    </Button>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <div className="flex flex-col gap-3">
                                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                                    <CardTitle>Dokumen Invoice</CardTitle>
                                    <Button variant="outline" onClick={exportInvoiceCsv}>
                                        <Download className="mr-2 h-4 w-4" />
                                        Export CSV
                                    </Button>
                                </div>
                                <div className="grid gap-2 md:grid-cols-5">
                                    <Input
                                        placeholder="Cari invoice / partner..."
                                        value={invoiceSearch}
                                        onChange={(event) => setInvoiceSearch(event.target.value)}
                                    />
                                    <Select value={invoiceStatusFilter} onValueChange={setInvoiceStatusFilter}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Filter status" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="__all__">Semua Status</SelectItem>
                                            {invoiceStatusOptions.map((status) => (
                                                <SelectItem key={status} value={status}>{status}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <Select value={invoiceTypeFilter} onValueChange={setInvoiceTypeFilter}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Filter tipe" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="__all__">Semua Tipe</SelectItem>
                                            {invoiceTypeOptions.map((type) => (
                                                <SelectItem key={type} value={type}>{type}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <Input type="date" value={invoiceStartDate} onChange={(event) => setInvoiceStartDate(event.target.value)} />
                                    <Input type="date" value={invoiceEndDate} onChange={(event) => setInvoiceEndDate(event.target.value)} />
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Invoice Number</TableHead>
                                        <TableHead>Partner</TableHead>
                                        <TableHead>Tipe</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead>Total</TableHead>
                                        <TableHead>Update</TableHead>
                                        <TableHead className="text-right">Aksi</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {paginatedInvoiceRows.map((row) => (
                                        <TableRow key={row.id}>
                                            <TableCell className="font-mono">{row.number}</TableCell>
                                            <TableCell>{row.partnerName || "-"}</TableCell>
                                            <TableCell><Badge variant="secondary">{row.type || "-"}</Badge></TableCell>
                                            <TableCell><Badge variant="outline">{row.status}</Badge></TableCell>
                                            <TableCell>{formatCurrency(row.totalAmount)}</TableCell>
                                            <TableCell>{formatDateTime(row.updatedAt)}</TableCell>
                                            <TableCell className="text-right">
                                                <a href={row.viewUrl} target="_blank" rel="noreferrer">
                                                    <Button size="sm" variant="outline">Buka Modul</Button>
                                                </a>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                    {filteredInvoiceRows.length === 0 && (
                                        <TableRow>
                                            <TableCell colSpan={7} className="py-6 text-center text-muted-foreground">
                                                Belum ada dokumen invoice.
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                            <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                                <div className="text-sm text-muted-foreground">
                                    Menampilkan {getRangeLabel(filteredInvoiceRows.length, invoicePage, invoicePageSize)} dari {filteredInvoiceRows.length} dokumen
                                </div>
                                <div className="flex items-center gap-2">
                                    <Select value={invoicePageSize} onValueChange={setInvoicePageSize}>
                                        <SelectTrigger className="w-[130px]">
                                            <SelectValue placeholder="Rows/page" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="10">10 / halaman</SelectItem>
                                            <SelectItem value="20">20 / halaman</SelectItem>
                                            <SelectItem value="50">50 / halaman</SelectItem>
                                            <SelectItem value="100">100 / halaman</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <Button variant="outline" size="sm" onClick={() => setInvoicePage((prev) => Math.max(1, prev - 1))} disabled={invoicePage <= 1}>
                                        Sebelumnya
                                    </Button>
                                    <div className="min-w-[84px] text-center text-sm font-medium">
                                        Hal {invoicePage} / {invoiceTotalPages}
                                    </div>
                                    <Button variant="outline" size="sm" onClick={() => setInvoicePage((prev) => Math.min(invoiceTotalPages, prev + 1))} disabled={invoicePage >= invoiceTotalPages}>
                                        Selanjutnya
                                    </Button>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <div className="flex flex-col gap-3">
                                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                                    <CardTitle>Dokumen Penerimaan Barang (GRN)</CardTitle>
                                    <Button variant="outline" onClick={exportGrnCsv}>
                                        <Download className="mr-2 h-4 w-4" />
                                        Export CSV
                                    </Button>
                                </div>
                                <div className="grid gap-2 md:grid-cols-4">
                                    <Input
                                        placeholder="Cari GRN / PO / warehouse..."
                                        value={grnSearch}
                                        onChange={(event) => setGrnSearch(event.target.value)}
                                    />
                                    <Select value={grnStatusFilter} onValueChange={setGrnStatusFilter}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Filter status" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="__all__">Semua Status</SelectItem>
                                            {grnStatusOptions.map((status) => (
                                                <SelectItem key={status} value={status}>{status}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <Input type="date" value={grnStartDate} onChange={(event) => setGrnStartDate(event.target.value)} />
                                    <Input type="date" value={grnEndDate} onChange={(event) => setGrnEndDate(event.target.value)} />
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>GRN Number</TableHead>
                                        <TableHead>PO Number</TableHead>
                                        <TableHead>Warehouse</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead>Update</TableHead>
                                        <TableHead className="text-right">Aksi</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {paginatedGrnRows.map((row) => (
                                        <TableRow key={row.id}>
                                            <TableCell className="font-mono">{row.number}</TableCell>
                                            <TableCell className="font-mono">{row.purchaseOrderNumber || "-"}</TableCell>
                                            <TableCell>{row.warehouse || "-"}</TableCell>
                                            <TableCell><Badge variant="outline">{row.status}</Badge></TableCell>
                                            <TableCell>{formatDateTime(row.updatedAt)}</TableCell>
                                            <TableCell className="text-right">
                                                <a href={row.viewUrl} target="_blank" rel="noreferrer">
                                                    <Button size="sm" variant="outline">Buka Modul</Button>
                                                </a>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                    {filteredGrnRows.length === 0 && (
                                        <TableRow>
                                            <TableCell colSpan={6} className="py-6 text-center text-muted-foreground">
                                                Belum ada dokumen GRN.
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                            <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                                <div className="text-sm text-muted-foreground">
                                    Menampilkan {getRangeLabel(filteredGrnRows.length, grnPage, grnPageSize)} dari {filteredGrnRows.length} dokumen
                                </div>
                                <div className="flex items-center gap-2">
                                    <Select value={grnPageSize} onValueChange={setGrnPageSize}>
                                        <SelectTrigger className="w-[130px]">
                                            <SelectValue placeholder="Rows/page" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="10">10 / halaman</SelectItem>
                                            <SelectItem value="20">20 / halaman</SelectItem>
                                            <SelectItem value="50">50 / halaman</SelectItem>
                                            <SelectItem value="100">100 / halaman</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <Button variant="outline" size="sm" onClick={() => setGrnPage((prev) => Math.max(1, prev - 1))} disabled={grnPage <= 1}>
                                        Sebelumnya
                                    </Button>
                                    <div className="min-w-[84px] text-center text-sm font-medium">
                                        Hal {grnPage} / {grnTotalPages}
                                    </div>
                                    <Button variant="outline" size="sm" onClick={() => setGrnPage((prev) => Math.min(grnTotalPages, prev + 1))} disabled={grnPage >= grnTotalPages}>
                                        Selanjutnya
                                    </Button>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <div className="flex flex-col gap-3">
                                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                                    <CardTitle>Dokumen Payroll Period</CardTitle>
                                    <Button variant="outline" onClick={exportPayrollCsv}>
                                        <Download className="mr-2 h-4 w-4" />
                                        Export CSV
                                    </Button>
                                </div>
                                <div className="grid gap-2 md:grid-cols-4">
                                    <Input
                                        placeholder="Cari periode payroll..."
                                        value={payrollSearch}
                                        onChange={(event) => setPayrollSearch(event.target.value)}
                                    />
                                    <Select value={payrollStatusFilter} onValueChange={setPayrollStatusFilter}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Filter status" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="__all__">Semua Status</SelectItem>
                                            {payrollStatusOptions.map((status) => (
                                                <SelectItem key={status} value={status}>{status}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <Input type="date" value={payrollStartDate} onChange={(event) => setPayrollStartDate(event.target.value)} />
                                    <Input type="date" value={payrollEndDate} onChange={(event) => setPayrollEndDate(event.target.value)} />
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Periode</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead>Update</TableHead>
                                        <TableHead className="text-right">Aksi</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {paginatedPayrollRows.map((row) => (
                                        <TableRow key={row.id}>
                                            <TableCell className="font-semibold">{row.periodLabel || row.period}</TableCell>
                                            <TableCell><Badge variant="outline">{row.status}</Badge></TableCell>
                                            <TableCell>{formatDateTime(row.updatedAt)}</TableCell>
                                            <TableCell className="text-right">
                                                <a href={row.viewUrl} target="_blank" rel="noreferrer">
                                                    <Button size="sm" variant="outline">Buka PDF</Button>
                                                </a>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                    {filteredPayrollRows.length === 0 && (
                                        <TableRow>
                                            <TableCell colSpan={4} className="py-6 text-center text-muted-foreground">
                                                Belum ada dokumen payroll.
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                            <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                                <div className="text-sm text-muted-foreground">
                                    Menampilkan {getRangeLabel(filteredPayrollRows.length, payrollPage, payrollPageSize)} dari {filteredPayrollRows.length} dokumen
                                </div>
                                <div className="flex items-center gap-2">
                                    <Select value={payrollPageSize} onValueChange={setPayrollPageSize}>
                                        <SelectTrigger className="w-[130px]">
                                            <SelectValue placeholder="Rows/page" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="10">10 / halaman</SelectItem>
                                            <SelectItem value="20">20 / halaman</SelectItem>
                                            <SelectItem value="50">50 / halaman</SelectItem>
                                            <SelectItem value="100">100 / halaman</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <Button variant="outline" size="sm" onClick={() => setPayrollPage((prev) => Math.max(1, prev - 1))} disabled={payrollPage <= 1}>
                                        Sebelumnya
                                    </Button>
                                    <div className="min-w-[84px] text-center text-sm font-medium">
                                        Hal {payrollPage} / {payrollTotalPages}
                                    </div>
                                    <Button variant="outline" size="sm" onClick={() => setPayrollPage((prev) => Math.min(payrollTotalPages, prev + 1))} disabled={payrollPage >= payrollTotalPages}>
                                        Selanjutnya
                                    </Button>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="catalog">
                    <Card>
                        <CardHeader>
                            <CardTitle>Katalog Workflow Module</CardTitle>
                            <CardDescription>
                                Katalog ini dipakai sebagai referensi permission role untuk seluruh modul ERP.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Key</TableHead>
                                        <TableHead>Nama</TableHead>
                                        <TableHead>Model</TableHead>
                                        <TableHead>Action</TableHead>
                                        <TableHead>Role Required</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {data.moduleCatalog.map((module) => (
                                        <TableRow key={module.key}>
                                            <TableCell className="font-mono text-xs">{module.key}</TableCell>
                                            <TableCell>
                                                <div className="font-semibold">{module.name}</div>
                                                <div className="text-xs text-muted-foreground">{module.description}</div>
                                            </TableCell>
                                            <TableCell>{module.model}</TableCell>
                                            <TableCell>{module.action}</TableCell>
                                            <TableCell>{module.roleRequired}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            <Dialog open={categoryModalOpen} onOpenChange={setCategoryModalOpen}>
                <DialogContent className="max-w-xl">
                    <DialogHeader>
                        <DialogTitle>{editingCategory ? "Edit Kategori" : "Tambah Kategori Baru"}</DialogTitle>
                        <DialogDescription>
                            Data kategori ini akan dipakai lintas modul (inventory, procurement, manufacturing, finance).
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-2">
                        <div className="grid gap-2">
                            <Label>Kode</Label>
                            <Input value={categoryForm.code} onChange={(event) => setCategoryForm((prev) => ({ ...prev, code: event.target.value }))} />
                        </div>
                        <div className="grid gap-2">
                            <Label>Nama</Label>
                            <Input value={categoryForm.name} onChange={(event) => setCategoryForm((prev) => ({ ...prev, name: event.target.value }))} />
                        </div>
                        <div className="grid gap-2">
                            <Label>Deskripsi</Label>
                            <Textarea
                                value={categoryForm.description}
                                onChange={(event) => setCategoryForm((prev) => ({ ...prev, description: event.target.value }))}
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label>Parent Category (Opsional)</Label>
                            <Select
                                value={categoryForm.parentId || "__none__"}
                                onValueChange={(value) => setCategoryForm((prev) => ({ ...prev, parentId: value === "__none__" ? "" : value }))}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Pilih parent category" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="__none__">Tanpa Parent</SelectItem>
                                    {availableParentCategories.map((category) => (
                                        <SelectItem key={category.id} value={category.id}>
                                            {category.code} - {category.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="flex items-center gap-2">
                            <Checkbox
                                checked={categoryForm.isActive}
                                onCheckedChange={(checked) => setCategoryForm((prev) => ({ ...prev, isActive: Boolean(checked) }))}
                            />
                            <Label>Aktif</Label>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setCategoryModalOpen(false)}>Batal</Button>
                        <Button onClick={submitCategory} disabled={isPending || !data.canManage}>Simpan</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={warehouseModalOpen} onOpenChange={setWarehouseModalOpen}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>{editingWarehouse ? "Edit Gudang" : "Tambah Gudang Baru"}</DialogTitle>
                        <DialogDescription>
                            Master gudang menentukan transaksi receiving, transfer, stock opname, dan valuation.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-2 md:grid-cols-2">
                        <div className="grid gap-2">
                            <Label>Kode</Label>
                            <Input value={warehouseForm.code} onChange={(event) => setWarehouseForm((prev) => ({ ...prev, code: event.target.value }))} />
                        </div>
                        <div className="grid gap-2">
                            <Label>Nama</Label>
                            <Input value={warehouseForm.name} onChange={(event) => setWarehouseForm((prev) => ({ ...prev, name: event.target.value }))} />
                        </div>
                        <div className="grid gap-2 md:col-span-2">
                            <Label>Alamat</Label>
                            <Input value={warehouseForm.address} onChange={(event) => setWarehouseForm((prev) => ({ ...prev, address: event.target.value }))} />
                        </div>
                        <div className="grid gap-2">
                            <Label>Kota</Label>
                            <Input value={warehouseForm.city} onChange={(event) => setWarehouseForm((prev) => ({ ...prev, city: event.target.value }))} />
                        </div>
                        <div className="grid gap-2">
                            <Label>Provinsi</Label>
                            <Input value={warehouseForm.province} onChange={(event) => setWarehouseForm((prev) => ({ ...prev, province: event.target.value }))} />
                        </div>
                        <div className="grid gap-2">
                            <Label>Kapasitas</Label>
                            <Input value={warehouseForm.capacity} onChange={(event) => setWarehouseForm((prev) => ({ ...prev, capacity: event.target.value }))} />
                        </div>
                        <div className="grid gap-2">
                            <Label>Manager Gudang</Label>
                            <Select
                                value={warehouseForm.managerId || "__none__"}
                                onValueChange={(value) => setWarehouseForm((prev) => ({ ...prev, managerId: value === "__none__" ? "" : value }))}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Pilih manager" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="__none__">Tanpa Manager</SelectItem>
                                    {data.managerOptions.map((manager) => (
                                        <SelectItem key={manager.id} value={manager.id}>
                                            {manager.employeeCode} - {manager.name} ({manager.department})
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="flex items-center gap-2 md:col-span-2">
                            <Checkbox
                                checked={warehouseForm.isActive}
                                onCheckedChange={(checked) => setWarehouseForm((prev) => ({ ...prev, isActive: Boolean(checked) }))}
                            />
                            <Label>Aktif</Label>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setWarehouseModalOpen(false)}>Batal</Button>
                        <Button onClick={submitWarehouse} disabled={isPending || !data.canManage}>Simpan</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={roleModalOpen} onOpenChange={setRoleModalOpen}>
                <DialogContent className="max-w-xl">
                    <DialogHeader>
                        <DialogTitle>{editingRole ? "Edit Role Sistem" : "Tambah Role Sistem"}</DialogTitle>
                        <DialogDescription>
                            Role ini mengatur modul yang terlihat di ERP dan alur kerja yang bisa dijalankan user.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-2">
                        <div className="grid gap-2">
                            <Label>Role Code</Label>
                            <Input
                                value={roleForm.code}
                                onChange={(event) => setRoleForm((prev) => ({ ...prev, code: event.target.value }))}
                                disabled={Boolean(editingRole?.isSystem)}
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label>Role Name</Label>
                            <Input
                                value={roleForm.name}
                                onChange={(event) => setRoleForm((prev) => ({ ...prev, name: event.target.value }))}
                                disabled={Boolean(editingRole?.isSystem)}
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label>Deskripsi</Label>
                            <Textarea
                                value={roleForm.description}
                                onChange={(event) => setRoleForm((prev) => ({ ...prev, description: event.target.value }))}
                                disabled={Boolean(editingRole?.isSystem)}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setRoleModalOpen(false)}>Batal</Button>
                        <Button onClick={submitRole} disabled={isPending || !data.canManage}>Simpan</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={permissionModalOpen} onOpenChange={setPermissionModalOpen}>
                <DialogContent className="max-w-4xl">
                    <DialogHeader>
                        <DialogTitle>Kelola Permission Role: {permissionRole?.code}</DialogTitle>
                        <DialogDescription>
                            Pilih permission modul untuk role ini. Perubahan akan direfleksikan ke navigasi ERP.
                        </DialogDescription>
                    </DialogHeader>
                    <ScrollArea className="max-h-[60vh] pr-4">
                        <div className="space-y-5 py-2">
                            {Object.entries(permissionOptionsByGroup).map(([group, options]) => (
                                <div key={group} className="rounded-lg border p-4">
                                    <div className="mb-3 text-sm font-semibold">{group}</div>
                                    <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                                        {options.map((option) => {
                                            const checked = selectedPermissions.includes(option.key)
                                            return (
                                                <label
                                                    key={option.key}
                                                    className="flex cursor-pointer items-start gap-2 rounded border p-2 hover:bg-zinc-50"
                                                >
                                                    <Checkbox
                                                        checked={checked}
                                                        onCheckedChange={() => togglePermission(option.key)}
                                                    />
                                                    <span className="text-sm">
                                                        <span className="block font-medium">{option.label}</span>
                                                        <span className="font-mono text-xs text-muted-foreground">{option.key}</span>
                                                    </span>
                                                </label>
                                            )
                                        })}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </ScrollArea>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setPermissionModalOpen(false)}>Batal</Button>
                        <Button onClick={savePermissions} disabled={isPending || !data.canManage}>
                            Simpan Permission
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
