# BOM Revamp Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the basic BOM CRUD with a visual production flow canvas using React Flow, supporting drag-drop material assignment, production splitting, SPK auto-generation, and PDF reports.

**Architecture:** New Prisma models (ProcessStation, ProductionBOM + 5 related tables) alongside existing BOM tables. Full-page canvas editor at `/manufacturing/bom/[id]` with React Flow. Left panel for materials, bottom panel for step details. API routes follow existing patterns.

**Tech Stack:** Next.js 16, @xyflow/react, Prisma 6, Supabase Storage, Typst PDF, TanStack Query, react-hook-form + zod, NB dialog styles

---

## Task 1: Install @xyflow/react

**Files:**
- Modify: `package.json`

**Step 1: Install the package**

Run: `npm install @xyflow/react`

**Step 2: Verify installation**

Run: `node -e "require('@xyflow/react')"`
Expected: No error

**Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: install @xyflow/react for BOM canvas"
```

---

## Task 2: Prisma Schema — New Models

**Files:**
- Modify: `prisma/schema.prisma`

**Step 1: Add enums and ProcessStation model**

Add after the existing `GarmentStage` enum block in `prisma/schema.prisma`:

```prisma
enum StationType {
  CUTTING
  SEWING
  WASHING
  PRINTING
  EMBROIDERY
  QC
  PACKING
  FINISHING
  OTHER
}

enum OperationType {
  IN_HOUSE
  SUBCONTRACTOR
}
```

Add the ProcessStation model:

```prisma
model ProcessStation {
  id              String         @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid
  code            String         @unique
  name            String
  stationType     StationType
  operationType   OperationType
  subcontractorId String?        @db.Uuid
  subcontractor   Subcontractor? @relation(fields: [subcontractorId], references: [id])
  machineId       String?        @db.Uuid
  machine         Machine?       @relation(fields: [machineId], references: [id])
  costPerUnit     Decimal        @default(0) @db.Decimal(12, 2)
  description     String?
  isActive        Boolean        @default(true)
  parentStationId String?        @db.Uuid
  parentStation   ProcessStation?  @relation("StationHierarchy", fields: [parentStationId], references: [id])
  childStations   ProcessStation[] @relation("StationHierarchy")
  bomSteps        ProductionBOMStep[]
  allocations     ProductionBOMAllocation[]
  createdAt       DateTime       @default(now())
  updatedAt       DateTime       @updatedAt

  @@map("process_stations")
}
```

**Step 2: Add ProductionBOM and ProductionBOMItem models**

```prisma
model ProductionBOM {
  id                 String   @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid
  productId          String   @db.Uuid
  product            Product  @relation(fields: [productId], references: [id])
  version            String   @default("v1")
  isActive           Boolean  @default(true)
  totalProductionQty Int      @default(0)
  notes              String?
  items              ProductionBOMItem[]
  steps              ProductionBOMStep[]
  workOrders         WorkOrder[]
  createdAt          DateTime @default(now())
  updatedAt          DateTime @updatedAt

  @@unique([productId, version])
  @@map("production_boms")
}

model ProductionBOMItem {
  id              String        @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid
  bomId           String        @db.Uuid
  bom             ProductionBOM @relation(fields: [bomId], references: [id], onDelete: Cascade)
  materialId      String        @db.Uuid
  material        Product       @relation("ProductionBOMMaterial", fields: [materialId], references: [id])
  quantityPerUnit Decimal       @db.Decimal(10, 4)
  unit            String?
  wastePct        Decimal       @default(0) @db.Decimal(5, 2)
  notes           String?
  stepMaterials   ProductionBOMStepMaterial[]

  @@map("production_bom_items")
}
```

**Step 3: Add ProductionBOMStep, StepMaterial, Allocation, Attachment models**

```prisma
model ProductionBOMStep {
  id              String        @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid
  bomId           String        @db.Uuid
  bom             ProductionBOM @relation(fields: [bomId], references: [id], onDelete: Cascade)
  stationId       String        @db.Uuid
  station         ProcessStation @relation(fields: [stationId], references: [id])
  sequence        Int
  durationMinutes Int?
  notes           String?
  materials       ProductionBOMStepMaterial[]
  allocations     ProductionBOMAllocation[]
  attachments     ProductionBOMAttachment[]
  workOrders      WorkOrder[]

  @@unique([bomId, sequence])
  @@map("production_bom_steps")
}

model ProductionBOMStepMaterial {
  id        String            @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid
  stepId    String            @db.Uuid
  step      ProductionBOMStep @relation(fields: [stepId], references: [id], onDelete: Cascade)
  bomItemId String            @db.Uuid
  bomItem   ProductionBOMItem @relation(fields: [bomItemId], references: [id], onDelete: Cascade)

  @@unique([stepId, bomItemId])
  @@map("production_bom_step_materials")
}

model ProductionBOMAllocation {
  id        String            @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid
  stepId    String            @db.Uuid
  step      ProductionBOMStep @relation(fields: [stepId], references: [id], onDelete: Cascade)
  stationId String            @db.Uuid
  station   ProcessStation    @relation(fields: [stationId], references: [id])
  quantity  Int
  notes     String?

  @@map("production_bom_allocations")
}

model ProductionBOMAttachment {
  id         String            @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid
  stepId     String            @db.Uuid
  step       ProductionBOMStep @relation(fields: [stepId], references: [id], onDelete: Cascade)
  fileName   String
  fileUrl    String
  fileType   String
  fileSize   Int
  uploadedAt DateTime          @default(now())

  @@map("production_bom_attachments")
}
```

**Step 4: Add relation fields to existing models**

Add to `WorkOrder` model:
```prisma
productionBomId      String?            @db.Uuid
productionBom        ProductionBOM?     @relation(fields: [productionBomId], references: [id])
productionBomStepId  String?            @db.Uuid
productionBomStep    ProductionBOMStep? @relation(fields: [productionBomStepId], references: [id])
dependsOnWorkOrderId String?            @db.Uuid
dependsOnWorkOrder   WorkOrder?         @relation("WODependency", fields: [dependsOnWorkOrderId], references: [id])
dependentWorkOrders  WorkOrder[]        @relation("WODependency")
```

Add to `Product` model:
```prisma
productionBOMs         ProductionBOM[]
productionBOMItems     ProductionBOMItem[] @relation("ProductionBOMMaterial")
```

Add to `Subcontractor` model:
```prisma
processStations ProcessStation[]
```

Add to `Machine` model:
```prisma
processStations ProcessStation[]
```

**Step 5: Run migration**

Run: `npx prisma migrate dev --name add_production_bom_tables`
Expected: Migration created and applied successfully

Run: `npx prisma generate`
Expected: Prisma client regenerated

**Step 6: Commit**

```bash
git add prisma/
git commit -m "feat: add ProductionBOM schema — 7 new models + WO dependency fields"
```

---

## Task 3: Add Query Keys for New Entities

**Files:**
- Modify: `lib/query-keys.ts`

**Step 1: Add new query keys**

Add these entries to the `queryKeys` object:

```ts
processStations: {
    all: ["processStations"] as const,
    list: () => [...queryKeys.processStations.all, "list"] as const,
},
productionBom: {
    all: ["productionBom"] as const,
    list: () => [...queryKeys.productionBom.all, "list"] as const,
    detail: (id: string) => [...queryKeys.productionBom.all, "detail", id] as const,
},
```

**Step 2: Commit**

```bash
git add lib/query-keys.ts
git commit -m "feat: add query keys for processStations and productionBom"
```

---

## Task 4: ProcessStation API — GET + POST

**Files:**
- Create: `app/api/manufacturing/process-stations/route.ts`

**Step 1: Create the route file**

```ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'

async function requireAuth() {
    const supabase = await createClient()
    const { data: { user }, error } = await supabase.auth.getUser()
    if (error || !user) throw new Error('Unauthorized')
    return user
}

// GET /api/manufacturing/process-stations
export async function GET(request: NextRequest) {
    try {
        await requireAuth()
        const { searchParams } = new URL(request.url)
        const activeOnly = searchParams.get('activeOnly') !== 'false'

        const stations = await prisma.processStation.findMany({
            where: activeOnly ? { isActive: true } : undefined,
            include: {
                subcontractor: { select: { id: true, name: true } },
                machine: { select: { id: true, code: true, name: true } },
                childStations: {
                    include: {
                        subcontractor: { select: { id: true, name: true } },
                    },
                },
            },
            orderBy: [{ stationType: 'asc' }, { name: 'asc' }],
        })

        return NextResponse.json({ success: true, data: stations })
    } catch (error) {
        console.error('Error fetching process stations:', error)
        return NextResponse.json(
            { success: false, error: 'Failed to fetch process stations' },
            { status: 500 }
        )
    }
}

// POST /api/manufacturing/process-stations
export async function POST(request: NextRequest) {
    try {
        await requireAuth()
        const body = await request.json()
        const { code, name, stationType, operationType, subcontractorId, machineId, costPerUnit, description, parentStationId } = body

        if (!code || !name || !stationType || !operationType) {
            return NextResponse.json(
                { success: false, error: 'code, name, stationType, operationType are required' },
                { status: 400 }
            )
        }

        const station = await prisma.processStation.create({
            data: {
                code,
                name,
                stationType,
                operationType,
                subcontractorId: subcontractorId || null,
                machineId: machineId || null,
                costPerUnit: costPerUnit || 0,
                description: description || null,
                parentStationId: parentStationId || null,
            },
            include: {
                subcontractor: { select: { id: true, name: true } },
                machine: { select: { id: true, code: true, name: true } },
            },
        })

        return NextResponse.json({ success: true, data: station }, { status: 201 })
    } catch (error: any) {
        if (error?.code === 'P2002') {
            return NextResponse.json(
                { success: false, error: 'Station code already exists' },
                { status: 409 }
            )
        }
        console.error('Error creating process station:', error)
        return NextResponse.json(
            { success: false, error: 'Failed to create process station' },
            { status: 500 }
        )
    }
}
```

**Step 2: Commit**

```bash
git add app/api/manufacturing/process-stations/route.ts
git commit -m "feat: ProcessStation API — GET list + POST create"
```

---

## Task 5: ProcessStation API — PATCH + DELETE

**Files:**
- Create: `app/api/manufacturing/process-stations/[id]/route.ts`

**Step 1: Create the route file**

```ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'

async function requireAuth() {
    const supabase = await createClient()
    const { data: { user }, error } = await supabase.auth.getUser()
    if (error || !user) throw new Error('Unauthorized')
    return user
}

// GET /api/manufacturing/process-stations/[id]
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        await requireAuth()
        const { id } = await params

        const station = await prisma.processStation.findUnique({
            where: { id },
            include: {
                subcontractor: { select: { id: true, name: true } },
                machine: { select: { id: true, code: true, name: true } },
                childStations: {
                    include: {
                        subcontractor: { select: { id: true, name: true } },
                    },
                },
            },
        })

        if (!station) {
            return NextResponse.json({ success: false, error: 'Station not found' }, { status: 404 })
        }

        return NextResponse.json({ success: true, data: station })
    } catch (error) {
        console.error('Error fetching process station:', error)
        return NextResponse.json({ success: false, error: 'Failed to fetch station' }, { status: 500 })
    }
}

// PATCH /api/manufacturing/process-stations/[id]
export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        await requireAuth()
        const { id } = await params
        const body = await request.json()

        const station = await prisma.processStation.update({
            where: { id },
            data: {
                ...(body.code !== undefined && { code: body.code }),
                ...(body.name !== undefined && { name: body.name }),
                ...(body.stationType !== undefined && { stationType: body.stationType }),
                ...(body.operationType !== undefined && { operationType: body.operationType }),
                ...(body.subcontractorId !== undefined && { subcontractorId: body.subcontractorId || null }),
                ...(body.machineId !== undefined && { machineId: body.machineId || null }),
                ...(body.costPerUnit !== undefined && { costPerUnit: body.costPerUnit }),
                ...(body.description !== undefined && { description: body.description }),
                ...(body.isActive !== undefined && { isActive: body.isActive }),
                ...(body.parentStationId !== undefined && { parentStationId: body.parentStationId || null }),
            },
            include: {
                subcontractor: { select: { id: true, name: true } },
                machine: { select: { id: true, code: true, name: true } },
            },
        })

        return NextResponse.json({ success: true, data: station })
    } catch (error: any) {
        if (error?.code === 'P2002') {
            return NextResponse.json({ success: false, error: 'Station code already exists' }, { status: 409 })
        }
        console.error('Error updating process station:', error)
        return NextResponse.json({ success: false, error: 'Failed to update station' }, { status: 500 })
    }
}

// DELETE /api/manufacturing/process-stations/[id]
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        await requireAuth()
        const { id } = await params

        // Check if station is used in any BOM steps
        const usedInSteps = await prisma.productionBOMStep.count({ where: { stationId: id } })
        if (usedInSteps > 0) {
            return NextResponse.json(
                { success: false, error: `Station is used in ${usedInSteps} BOM step(s). Deactivate instead.` },
                { status: 400 }
            )
        }

        await prisma.processStation.delete({ where: { id } })
        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('Error deleting process station:', error)
        return NextResponse.json({ success: false, error: 'Failed to delete station' }, { status: 500 })
    }
}
```

**Step 2: Commit**

```bash
git add app/api/manufacturing/process-stations/
git commit -m "feat: ProcessStation API — GET detail, PATCH, DELETE"
```

---

## Task 6: ProcessStation Hook + Create Dialog

**Files:**
- Create: `hooks/use-process-stations.ts`
- Create: `components/manufacturing/bom/create-station-dialog.tsx`

**Step 1: Create the hook**

Create `hooks/use-process-stations.ts`:

```ts
"use client"

import { useQuery } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"

export function useProcessStations() {
    return useQuery({
        queryKey: queryKeys.processStations.list(),
        queryFn: async () => {
            const res = await fetch("/api/manufacturing/process-stations")
            if (!res.ok) return []
            const result = await res.json()
            return result.success ? result.data : []
        },
    })
}
```

**Step 2: Create the station dialog**

Create `components/manufacturing/bom/create-station-dialog.tsx`:

```tsx
"use client"

import { useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Button } from "@/components/ui/button"
import {
    Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import {
    Form, FormControl, FormField, FormItem, FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { ScrollArea } from "@/components/ui/scroll-area"
import { toast } from "sonner"
import { queryKeys } from "@/lib/query-keys"
import { NB } from "@/lib/dialog-styles"
import { Loader2, Cog } from "lucide-react"

const STATION_TYPES = [
    { value: "CUTTING", label: "Potong (Cutting)" },
    { value: "SEWING", label: "Jahit (Sewing)" },
    { value: "WASHING", label: "Cuci (Washing)" },
    { value: "PRINTING", label: "Sablon (Printing)" },
    { value: "EMBROIDERY", label: "Bordir (Embroidery)" },
    { value: "QC", label: "Quality Control" },
    { value: "PACKING", label: "Packing" },
    { value: "FINISHING", label: "Finishing" },
    { value: "OTHER", label: "Lainnya" },
]

const OPERATION_TYPES = [
    { value: "IN_HOUSE", label: "In-House" },
    { value: "SUBCONTRACTOR", label: "Subkontraktor" },
]

const formSchema = z.object({
    code: z.string().min(1, "Kode wajib diisi"),
    name: z.string().min(1, "Nama wajib diisi"),
    stationType: z.string().min(1, "Tipe stasiun wajib dipilih"),
    operationType: z.string().min(1, "Tipe operasi wajib dipilih"),
    subcontractorId: z.string().optional(),
    costPerUnit: z.coerce.number().min(0).default(0),
    description: z.string().optional(),
})

interface CreateStationDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    onCreated?: (station: any) => void
    subcontractors?: { id: string; name: string }[]
}

export function CreateStationDialog({ open, onOpenChange, onCreated, subcontractors = [] }: CreateStationDialogProps) {
    const queryClient = useQueryClient()
    const [loading, setLoading] = useState(false)

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema) as any,
        defaultValues: {
            code: "",
            name: "",
            stationType: "",
            operationType: "IN_HOUSE",
            subcontractorId: "",
            costPerUnit: 0,
            description: "",
        },
    })

    const operationType = form.watch("operationType")

    const onSubmit = async (values: z.infer<typeof formSchema>) => {
        setLoading(true)
        try {
            const res = await fetch("/api/manufacturing/process-stations", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(values),
            })
            const result = await res.json()

            if (result.success) {
                toast.success("Stasiun proses berhasil dibuat")
                queryClient.invalidateQueries({ queryKey: queryKeys.processStations.all })
                form.reset()
                onOpenChange(false)
                onCreated?.(result.data)
            } else {
                toast.error(result.error || "Gagal membuat stasiun")
            }
        } catch {
            toast.error("Terjadi kesalahan")
        } finally {
            setLoading(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className={NB.contentNarrow}>
                <DialogHeader className={NB.header}>
                    <DialogTitle className={NB.title}>
                        <Cog className="h-5 w-5" /> Tambah Stasiun Proses
                    </DialogTitle>
                    <p className={NB.subtitle}>Buat stasiun produksi baru (potong, jahit, QC, dll)</p>
                </DialogHeader>

                <ScrollArea className={NB.scroll}>
                    <div className="p-5">
                        <Form {...form}>
                            <form onSubmit={form.handleSubmit(onSubmit as any)} className="space-y-4">
                                <div className="grid grid-cols-2 gap-3">
                                    <FormField control={form.control as any} name="code" render={({ field }) => (
                                        <FormItem>
                                            <label className={NB.label}>Kode <span className={NB.labelRequired}>*</span></label>
                                            <FormControl><Input {...field} placeholder="STN-CUT-01" className={NB.inputMono} /></FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )} />
                                    <FormField control={form.control as any} name="name" render={({ field }) => (
                                        <FormItem>
                                            <label className={NB.label}>Nama <span className={NB.labelRequired}>*</span></label>
                                            <FormControl><Input {...field} placeholder="Potong Utama" className={NB.input} /></FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )} />
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <FormField control={form.control as any} name="stationType" render={({ field }) => (
                                        <FormItem>
                                            <label className={NB.label}>Tipe Stasiun <span className={NB.labelRequired}>*</span></label>
                                            <Select onValueChange={field.onChange} value={field.value}>
                                                <FormControl><SelectTrigger className={NB.select}><SelectValue placeholder="Pilih tipe" /></SelectTrigger></FormControl>
                                                <SelectContent>
                                                    {STATION_TYPES.map((t) => (
                                                        <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                            <FormMessage />
                                        </FormItem>
                                    )} />
                                    <FormField control={form.control as any} name="operationType" render={({ field }) => (
                                        <FormItem>
                                            <label className={NB.label}>Tipe Operasi <span className={NB.labelRequired}>*</span></label>
                                            <Select onValueChange={field.onChange} value={field.value}>
                                                <FormControl><SelectTrigger className={NB.select}><SelectValue /></SelectTrigger></FormControl>
                                                <SelectContent>
                                                    {OPERATION_TYPES.map((t) => (
                                                        <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                            <FormMessage />
                                        </FormItem>
                                    )} />
                                </div>

                                {operationType === "SUBCONTRACTOR" && subcontractors.length > 0 && (
                                    <FormField control={form.control as any} name="subcontractorId" render={({ field }) => (
                                        <FormItem>
                                            <label className={NB.label}>Subkontraktor</label>
                                            <Select onValueChange={field.onChange} value={field.value}>
                                                <FormControl><SelectTrigger className={NB.select}><SelectValue placeholder="Pilih subkontraktor" /></SelectTrigger></FormControl>
                                                <SelectContent>
                                                    {subcontractors.map((s) => (
                                                        <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                            <FormMessage />
                                        </FormItem>
                                    )} />
                                )}

                                <FormField control={form.control as any} name="costPerUnit" render={({ field }) => (
                                    <FormItem>
                                        <label className={NB.label}>Biaya per Unit (Rp)</label>
                                        <FormControl><Input type="number" {...field} className={NB.inputMono} /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )} />

                                <FormField control={form.control as any} name="description" render={({ field }) => (
                                    <FormItem>
                                        <label className={NB.label}>Deskripsi</label>
                                        <FormControl><Textarea {...field} placeholder="Catatan opsional..." className={NB.textarea} /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )} />

                                <div className={NB.footer}>
                                    <Button type="button" variant="outline" className={NB.cancelBtn} onClick={() => onOpenChange(false)}>Batal</Button>
                                    <Button type="submit" disabled={loading} className={NB.submitBtn}>
                                        {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Menyimpan...</> : "Simpan Stasiun"}
                                    </Button>
                                </div>
                            </form>
                        </Form>
                    </div>
                </ScrollArea>
            </DialogContent>
        </Dialog>
    )
}
```

**Step 3: Commit**

```bash
git add hooks/use-process-stations.ts components/manufacturing/bom/create-station-dialog.tsx
git commit -m "feat: ProcessStation hook + create dialog"
```

---

## Task 7: ProductionBOM API — GET list + POST create

**Files:**
- Create: `app/api/manufacturing/production-bom/route.ts`

**Step 1: Create the route file**

```ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'

async function requireAuth() {
    const supabase = await createClient()
    const { data: { user }, error } = await supabase.auth.getUser()
    if (error || !user) throw new Error('Unauthorized')
    return user
}

function resolveMaterialUnitCost(material: any): number {
    const directCost = Number(material.costPrice || 0)
    if (directCost > 0) return directCost
    const preferred = material.supplierItems?.find((s: any) => s.isPreferred)?.price
    if (preferred != null) return Number(preferred || 0)
    return Number(material.supplierItems?.[0]?.price || 0)
}

// GET /api/manufacturing/production-bom
export async function GET(request: NextRequest) {
    try {
        await requireAuth()
        const { searchParams } = new URL(request.url)
        const search = searchParams.get('search') || ''
        const activeOnly = searchParams.get('activeOnly') !== 'false'

        const boms = await prisma.productionBOM.findMany({
            where: {
                ...(activeOnly ? { isActive: true } : {}),
                ...(search ? {
                    product: {
                        OR: [
                            { name: { contains: search, mode: 'insensitive' as any } },
                            { code: { contains: search, mode: 'insensitive' as any } },
                        ],
                    },
                } : {}),
            },
            include: {
                product: { select: { id: true, code: true, name: true, unit: true, sellingPrice: true } },
                items: {
                    include: {
                        material: {
                            select: { id: true, code: true, name: true, unit: true, costPrice: true, supplierItems: { select: { price: true, isPreferred: true } } },
                        },
                    },
                },
                steps: {
                    include: {
                        station: { select: { id: true, code: true, name: true, stationType: true, operationType: true, costPerUnit: true } },
                    },
                    orderBy: { sequence: 'asc' },
                },
            },
            orderBy: { updatedAt: 'desc' },
        })

        const enriched = boms.map((bom) => {
            const totalMaterialCost = bom.items.reduce((sum, item) => {
                const unitCost = resolveMaterialUnitCost(item.material)
                const qty = Number(item.quantityPerUnit)
                const waste = Number(item.wastePct || 0)
                return sum + unitCost * qty * (1 + waste / 100)
            }, 0)

            const totalLaborCost = bom.steps.reduce((sum, step) => {
                return sum + Number(step.station.costPerUnit || 0)
            }, 0)

            return {
                ...bom,
                totalMaterialCost,
                totalLaborCost,
                totalCostPerUnit: totalMaterialCost + totalLaborCost,
                materialCount: bom.items.length,
                stepCount: bom.steps.length,
            }
        })

        return NextResponse.json({ success: true, data: enriched })
    } catch (error) {
        console.error('Error fetching production BOMs:', error)
        return NextResponse.json({ success: false, error: 'Failed to fetch production BOMs' }, { status: 500 })
    }
}

// POST /api/manufacturing/production-bom
export async function POST(request: NextRequest) {
    try {
        await requireAuth()
        const body = await request.json()
        const { productId, version = 'v1', totalProductionQty = 0, notes } = body

        if (!productId) {
            return NextResponse.json({ success: false, error: 'productId is required' }, { status: 400 })
        }

        const bom = await prisma.productionBOM.create({
            data: {
                productId,
                version,
                totalProductionQty,
                notes: notes || null,
            },
            include: {
                product: { select: { id: true, code: true, name: true, unit: true } },
            },
        })

        return NextResponse.json({ success: true, data: bom }, { status: 201 })
    } catch (error: any) {
        if (error?.code === 'P2002') {
            return NextResponse.json({ success: false, error: 'BOM with this product + version already exists' }, { status: 409 })
        }
        console.error('Error creating production BOM:', error)
        return NextResponse.json({ success: false, error: 'Failed to create production BOM' }, { status: 500 })
    }
}
```

**Step 2: Commit**

```bash
git add app/api/manufacturing/production-bom/route.ts
git commit -m "feat: ProductionBOM API — GET list + POST create"
```

---

## Task 8: ProductionBOM API — GET/PATCH/DELETE detail

**Files:**
- Create: `app/api/manufacturing/production-bom/[id]/route.ts`

**Step 1: Create the detail route**

```ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'

async function requireAuth() {
    const supabase = await createClient()
    const { data: { user }, error } = await supabase.auth.getUser()
    if (error || !user) throw new Error('Unauthorized')
    return user
}

// GET /api/manufacturing/production-bom/[id]
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        await requireAuth()
        const { id } = await params

        const bom = await prisma.productionBOM.findUnique({
            where: { id },
            include: {
                product: {
                    select: { id: true, code: true, name: true, unit: true, sellingPrice: true, costPrice: true },
                },
                items: {
                    include: {
                        material: {
                            select: {
                                id: true, code: true, name: true, unit: true, costPrice: true,
                                supplierItems: { select: { price: true, isPreferred: true } },
                            },
                        },
                        stepMaterials: { select: { stepId: true } },
                    },
                },
                steps: {
                    include: {
                        station: {
                            select: {
                                id: true, code: true, name: true, stationType: true,
                                operationType: true, costPerUnit: true,
                                subcontractor: { select: { id: true, name: true } },
                            },
                        },
                        materials: {
                            include: {
                                bomItem: {
                                    include: {
                                        material: { select: { id: true, code: true, name: true, unit: true } },
                                    },
                                },
                            },
                        },
                        allocations: {
                            include: {
                                station: {
                                    select: { id: true, code: true, name: true, operationType: true, subcontractor: { select: { name: true } } },
                                },
                            },
                        },
                        attachments: true,
                    },
                    orderBy: { sequence: 'asc' },
                },
            },
        })

        if (!bom) {
            return NextResponse.json({ success: false, error: 'Production BOM not found' }, { status: 404 })
        }

        return NextResponse.json({ success: true, data: bom })
    } catch (error) {
        console.error('Error fetching production BOM:', error)
        return NextResponse.json({ success: false, error: 'Failed to fetch production BOM' }, { status: 500 })
    }
}

// PATCH /api/manufacturing/production-bom/[id] — full save of canvas state
export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        await requireAuth()
        const { id } = await params
        const body = await request.json()
        const { version, isActive, totalProductionQty, notes, items, steps } = body

        const result = await prisma.$transaction(async (tx) => {
            // Update BOM metadata
            await tx.productionBOM.update({
                where: { id },
                data: {
                    ...(version !== undefined && { version }),
                    ...(isActive !== undefined && { isActive }),
                    ...(totalProductionQty !== undefined && { totalProductionQty }),
                    ...(notes !== undefined && { notes }),
                },
            })

            // If items provided, replace all items
            if (items) {
                await tx.productionBOMItem.deleteMany({ where: { bomId: id } })
                for (const item of items) {
                    await tx.productionBOMItem.create({
                        data: {
                            bomId: id,
                            materialId: item.materialId,
                            quantityPerUnit: item.quantityPerUnit,
                            unit: item.unit || null,
                            wastePct: item.wastePct || 0,
                            notes: item.notes || null,
                        },
                    })
                }
            }

            // If steps provided, replace all steps (cascade deletes materials, allocations, attachments)
            if (steps) {
                // Delete step materials, allocations, attachments first (cascade should handle but be explicit)
                const existingSteps = await tx.productionBOMStep.findMany({ where: { bomId: id }, select: { id: true } })
                const stepIds = existingSteps.map((s) => s.id)
                if (stepIds.length > 0) {
                    await tx.productionBOMStepMaterial.deleteMany({ where: { stepId: { in: stepIds } } })
                    await tx.productionBOMAllocation.deleteMany({ where: { stepId: { in: stepIds } } })
                    await tx.productionBOMAttachment.deleteMany({ where: { stepId: { in: stepIds } } })
                }
                await tx.productionBOMStep.deleteMany({ where: { bomId: id } })

                // Re-fetch items to map material names to IDs
                const currentItems = await tx.productionBOMItem.findMany({ where: { bomId: id } })

                for (const step of steps) {
                    const createdStep = await tx.productionBOMStep.create({
                        data: {
                            bomId: id,
                            stationId: step.stationId,
                            sequence: step.sequence,
                            durationMinutes: step.durationMinutes || null,
                            notes: step.notes || null,
                        },
                    })

                    // Create step materials
                    if (step.materialIds && step.materialIds.length > 0) {
                        for (const bomItemId of step.materialIds) {
                            await tx.productionBOMStepMaterial.create({
                                data: { stepId: createdStep.id, bomItemId },
                            })
                        }
                    }

                    // Create allocations
                    if (step.allocations && step.allocations.length > 0) {
                        for (const alloc of step.allocations) {
                            await tx.productionBOMAllocation.create({
                                data: {
                                    stepId: createdStep.id,
                                    stationId: alloc.stationId,
                                    quantity: alloc.quantity,
                                    notes: alloc.notes || null,
                                },
                            })
                        }
                    }
                }
            }

            // Return updated BOM
            return tx.productionBOM.findUnique({
                where: { id },
                include: {
                    product: { select: { id: true, code: true, name: true } },
                    items: { include: { material: { select: { id: true, code: true, name: true } } } },
                    steps: {
                        include: {
                            station: { select: { id: true, name: true, stationType: true } },
                            materials: true,
                            allocations: true,
                        },
                        orderBy: { sequence: 'asc' },
                    },
                },
            })
        })

        return NextResponse.json({ success: true, data: result })
    } catch (error) {
        console.error('Error updating production BOM:', error)
        return NextResponse.json({ success: false, error: 'Failed to update production BOM' }, { status: 500 })
    }
}

// DELETE /api/manufacturing/production-bom/[id]
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        await requireAuth()
        const { id } = await params

        await prisma.productionBOM.delete({ where: { id } })
        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('Error deleting production BOM:', error)
        return NextResponse.json({ success: false, error: 'Failed to delete production BOM' }, { status: 500 })
    }
}
```

**Step 2: Commit**

```bash
git add app/api/manufacturing/production-bom/[id]/route.ts
git commit -m "feat: ProductionBOM detail API — GET/PATCH/DELETE with full canvas save"
```

---

## Task 9: ProductionBOM Hook + Create Dialog

**Files:**
- Create: `hooks/use-production-bom.ts`
- Modify: `components/manufacturing/bom/create-bom-dialog.tsx`

**Step 1: Create the hook**

Create `hooks/use-production-bom.ts`:

```ts
"use client"

import { useQuery } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"

export function useProductionBOMs() {
    return useQuery({
        queryKey: queryKeys.productionBom.list(),
        queryFn: async () => {
            const res = await fetch("/api/manufacturing/production-bom")
            if (!res.ok) return []
            const result = await res.json()
            return result.success ? result.data : []
        },
    })
}

export function useProductionBOM(id: string | null) {
    return useQuery({
        queryKey: queryKeys.productionBom.detail(id || ""),
        queryFn: async () => {
            if (!id) return null
            const res = await fetch(`/api/manufacturing/production-bom/${id}`)
            if (!res.ok) return null
            const result = await res.json()
            return result.success ? result.data : null
        },
        enabled: !!id,
    })
}
```

**Step 2: Rewrite create-bom-dialog for ProductionBOM**

Completely replace `components/manufacturing/bom/create-bom-dialog.tsx` — now creates a ProductionBOM (product + version only, materials added on canvas):

```tsx
"use client"

import { useState, useEffect } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Button } from "@/components/ui/button"
import {
    Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import {
    Form, FormControl, FormField, FormItem, FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { ScrollArea } from "@/components/ui/scroll-area"
import { toast } from "sonner"
import { queryKeys } from "@/lib/query-keys"
import { NB } from "@/lib/dialog-styles"
import { Loader2, Package } from "lucide-react"

const formSchema = z.object({
    productId: z.string().min(1, "Produk wajib dipilih"),
    version: z.string().min(1, "Versi wajib diisi").default("v1"),
    totalProductionQty: z.coerce.number().min(0).default(0),
    notes: z.string().optional(),
})

interface CreateBOMDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    onCreated?: (bom: any) => void
}

export function CreateBOMDialog({ open, onOpenChange, onCreated }: CreateBOMDialogProps) {
    const queryClient = useQueryClient()
    const [loading, setLoading] = useState(false)
    const [products, setProducts] = useState<any[]>([])

    useEffect(() => {
        if (open) {
            fetch("/api/products?limit=500&status=active")
                .then((r) => r.json())
                .then((data) => {
                    const items = data.products || data.data || []
                    // Only show MANUFACTURED products for BOM
                    setProducts(items.filter((p: any) => p.productType === "MANUFACTURED"))
                })
                .catch(() => setProducts([]))
        }
    }, [open])

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema) as any,
        defaultValues: { productId: "", version: "v1", totalProductionQty: 0, notes: "" },
    })

    const onSubmit = async (values: z.infer<typeof formSchema>) => {
        setLoading(true)
        try {
            const res = await fetch("/api/manufacturing/production-bom", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(values),
            })
            const result = await res.json()

            if (result.success) {
                toast.success("Production BOM berhasil dibuat")
                queryClient.invalidateQueries({ queryKey: queryKeys.productionBom.all })
                form.reset()
                onOpenChange(false)
                onCreated?.(result.data)
            } else {
                toast.error(result.error || "Gagal membuat BOM")
            }
        } catch {
            toast.error("Terjadi kesalahan")
        } finally {
            setLoading(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className={NB.contentNarrow}>
                <DialogHeader className={NB.header}>
                    <DialogTitle className={NB.title}>
                        <Package className="h-5 w-5" /> Buat Production BOM Baru
                    </DialogTitle>
                    <p className={NB.subtitle}>Pilih produk dan versi. Material & alur produksi diatur di canvas.</p>
                </DialogHeader>

                <ScrollArea className={NB.scroll}>
                    <div className="p-5">
                        <Form {...form}>
                            <form onSubmit={form.handleSubmit(onSubmit as any)} className="space-y-4">
                                <FormField control={form.control as any} name="productId" render={({ field }) => (
                                    <FormItem>
                                        <label className={NB.label}>Produk <span className={NB.labelRequired}>*</span></label>
                                        <Select onValueChange={field.onChange} value={field.value}>
                                            <FormControl><SelectTrigger className={NB.select}><SelectValue placeholder="Pilih produk..." /></SelectTrigger></FormControl>
                                            <SelectContent>
                                                {products.map((p) => (
                                                    <SelectItem key={p.id} value={p.id}>[{p.code}] {p.name}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )} />

                                <div className="grid grid-cols-2 gap-3">
                                    <FormField control={form.control as any} name="version" render={({ field }) => (
                                        <FormItem>
                                            <label className={NB.label}>Versi <span className={NB.labelRequired}>*</span></label>
                                            <FormControl><Input {...field} placeholder="v1" className={NB.inputMono} /></FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )} />
                                    <FormField control={form.control as any} name="totalProductionQty" render={({ field }) => (
                                        <FormItem>
                                            <label className={NB.label}>Target Produksi (pcs)</label>
                                            <FormControl><Input type="number" {...field} className={NB.inputMono} /></FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )} />
                                </div>

                                <FormField control={form.control as any} name="notes" render={({ field }) => (
                                    <FormItem>
                                        <label className={NB.label}>Catatan</label>
                                        <FormControl><Textarea {...field} placeholder="Catatan opsional..." className={NB.textarea} /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )} />

                                <div className={NB.footer}>
                                    <Button type="button" variant="outline" className={NB.cancelBtn} onClick={() => onOpenChange(false)}>Batal</Button>
                                    <Button type="submit" disabled={loading} className={NB.submitBtn}>
                                        {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Membuat...</> : "Buat BOM & Buka Canvas"}
                                    </Button>
                                </div>
                            </form>
                        </Form>
                    </div>
                </ScrollArea>
            </DialogContent>
        </Dialog>
    )
}
```

**Step 3: Commit**

```bash
git add hooks/use-production-bom.ts components/manufacturing/bom/create-bom-dialog.tsx
git commit -m "feat: ProductionBOM hooks + create dialog (product+version only)"
```

---

## Task 10: BOM List Page — Card Grid

**Files:**
- Modify: `app/manufacturing/bom/page.tsx`
- Modify: `app/manufacturing/bom/bom-client.tsx`

**Step 1: Rewrite page.tsx**

Replace `app/manufacturing/bom/page.tsx` entirely:

```tsx
"use client"

import { useProductionBOMs } from "@/hooks/use-production-bom"
import { BOMListClient } from "./bom-client"
import { TablePageSkeleton } from "@/components/ui/page-skeleton"

export const dynamic = "force-dynamic"

export default function BOMPage() {
    const { data, isLoading } = useProductionBOMs()

    if (isLoading) {
        return <TablePageSkeleton accentColor="bg-orange-400" />
    }

    return <BOMListClient boms={data ?? []} />
}
```

**Step 2: Rewrite bom-client.tsx as a card grid listing**

This is a large file. Replace `app/manufacturing/bom/bom-client.tsx` entirely with a card grid that links to `/manufacturing/bom/[id]` for the canvas editor. The file should follow the pattern from `app/sales/customers/page.tsx` — search bar, KPI strip, card grid. Each card shows: product name+code, version badge, material count, step count, total cost, active/inactive status. Click navigates to the canvas. "Buat BOM Baru" button opens CreateBOMDialog.

_(Full code for this component will be generated during execution — it follows the exact same pattern as the customers page but with BOM data. Key imports: `useProductionBOMs`, `CreateBOMDialog`, Link from next/link, search/filter state.)_

**Step 3: Create the [id] page stub**

Create `app/manufacturing/bom/[id]/page.tsx`:

```tsx
"use client"

import { use } from "react"
import { useProductionBOM } from "@/hooks/use-production-bom"
import { TablePageSkeleton } from "@/components/ui/page-skeleton"

export const dynamic = "force-dynamic"

export default function BOMCanvasPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params)
    const { data: bom, isLoading } = useProductionBOM(id)

    if (isLoading) {
        return <TablePageSkeleton accentColor="bg-orange-400" />
    }

    if (!bom) {
        return <div className="p-10 text-center font-bold text-zinc-400">BOM tidak ditemukan</div>
    }

    return (
        <div className="h-screen flex flex-col">
            <div className="border-b-2 border-black bg-white px-6 py-3 flex items-center justify-between">
                <div>
                    <h1 className="font-black text-lg uppercase">{bom.product?.name}</h1>
                    <p className="text-xs font-bold text-zinc-400">{bom.product?.code} | {bom.version}</p>
                </div>
                <p className="text-sm font-bold text-zinc-500">Canvas editor — coming next</p>
            </div>
            <div className="flex-1 bg-zinc-100 flex items-center justify-center">
                <p className="text-zinc-400 font-bold">React Flow canvas will be rendered here</p>
            </div>
        </div>
    )
}
```

**Step 4: Commit**

```bash
git add app/manufacturing/bom/
git commit -m "feat: BOM list page refresh + canvas page stub"
```

---

## Task 11: React Flow Canvas — Core Component

**Files:**
- Create: `components/manufacturing/bom/bom-canvas.tsx`
- Create: `components/manufacturing/bom/station-node.tsx`
- Create: `components/manufacturing/bom/material-panel.tsx`

This is the core visual component. Due to its size, implementation is split across sub-steps.

**Step 1: Create station-node.tsx (custom React Flow node)**

```tsx
"use client"

import { memo } from "react"
import { Handle, Position } from "@xyflow/react"
import { Scissors, Shirt, Droplets, Printer, Sparkles, ShieldCheck, Package, Wrench, Cog, X } from "lucide-react"

const STATION_ICONS: Record<string, any> = {
    CUTTING: Scissors, SEWING: Shirt, WASHING: Droplets,
    PRINTING: Printer, EMBROIDERY: Sparkles, QC: ShieldCheck,
    PACKING: Package, FINISHING: Wrench, OTHER: Cog,
}

interface StationNodeData {
    station: any
    sequence: number
    materials: any[]
    isSelected: boolean
    onRemoveMaterial: (bomItemId: string) => void
}

function StationNodeComponent({ data }: { data: StationNodeData }) {
    const { station, sequence, materials, isSelected, onRemoveMaterial } = data
    const Icon = STATION_ICONS[station.stationType] || Cog
    const isSubcon = station.operationType === "SUBCONTRACTOR"

    return (
        <div
            className={`bg-white border-2 ${isSelected ? "border-orange-500 shadow-[4px_4px_0px_0px_rgba(249,115,22,1)]" : "border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]"} w-[220px] transition-all`}
            onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add("ring-2", "ring-orange-400") }}
            onDragLeave={(e) => { e.currentTarget.classList.remove("ring-2", "ring-orange-400") }}
        >
            <Handle type="target" position={Position.Left} className="!bg-black !w-3 !h-3 !border-2 !border-white" />

            {/* Header */}
            <div className={`px-3 py-2 border-b-2 border-black flex items-center gap-2 ${isSubcon ? "bg-amber-50" : "bg-emerald-50"}`}>
                <div className="bg-black text-white p-1 shrink-0"><Icon className="h-3.5 w-3.5" /></div>
                <div className="min-w-0 flex-1">
                    <p className="font-black text-xs uppercase truncate">{station.name}</p>
                    <p className={`text-[9px] font-bold ${isSubcon ? "text-amber-600" : "text-emerald-600"}`}>
                        {isSubcon ? `Subkon: ${station.subcontractor?.name || "-"}` : "In-House"}
                    </p>
                </div>
                <span className="bg-black text-white text-[10px] font-black px-1.5 py-0.5 shrink-0">{sequence}</span>
            </div>

            {/* Materials drop zone */}
            <div className="p-2 min-h-[40px]">
                {materials.length === 0 ? (
                    <p className="text-[10px] text-zinc-300 font-bold text-center py-2">Drop material di sini</p>
                ) : (
                    <div className="space-y-1">
                        {materials.map((m) => (
                            <div key={m.bomItemId} className="flex items-center gap-1.5 bg-zinc-50 border border-zinc-200 px-2 py-1 group">
                                <span className="w-1.5 h-1.5 bg-black rounded-full shrink-0" />
                                <span className="text-[10px] font-bold truncate flex-1">{m.materialName}</span>
                                <button
                                    onClick={(e) => { e.stopPropagation(); onRemoveMaterial(m.bomItemId) }}
                                    className="opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                    <X className="h-3 w-3 text-zinc-400 hover:text-red-500" />
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Cost footer */}
            <div className="px-3 py-1.5 border-t border-zinc-100 bg-zinc-50">
                <p className="text-[9px] font-bold text-zinc-400">
                    Rp {Number(station.costPerUnit || 0).toLocaleString("id-ID")}/unit
                </p>
            </div>

            <Handle type="source" position={Position.Right} className="!bg-black !w-3 !h-3 !border-2 !border-white" />
        </div>
    )
}

export const StationNode = memo(StationNodeComponent)
```

**Step 2: Create material-panel.tsx (left sidebar)**

```tsx
"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Plus, Search, GripVertical, X, Package } from "lucide-react"

interface MaterialPanelProps {
    items: any[]
    onAddItem: () => void
    onRemoveItem: (id: string) => void
}

export function MaterialPanel({ items, onAddItem, onRemoveItem }: MaterialPanelProps) {
    const [search, setSearch] = useState("")

    const filtered = items.filter((item) =>
        item.material?.name?.toLowerCase().includes(search.toLowerCase()) ||
        item.material?.code?.toLowerCase().includes(search.toLowerCase())
    )

    return (
        <div className="w-[280px] border-r-2 border-black bg-white flex flex-col h-full">
            {/* Header */}
            <div className="px-4 py-3 border-b-2 border-black bg-zinc-50">
                <h3 className="text-xs font-black uppercase tracking-widest">Material</h3>
                <p className="text-[9px] font-bold text-zinc-400 mt-0.5">Drag ke stasiun proses</p>
            </div>

            {/* Search */}
            <div className="p-3 border-b border-zinc-200">
                <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400" />
                    <Input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Cari material..."
                        className="pl-8 h-8 text-xs border-zinc-200 rounded-none"
                    />
                </div>
            </div>

            {/* Material list */}
            <ScrollArea className="flex-1">
                <div className="p-2 space-y-1">
                    {filtered.map((item) => (
                        <div
                            key={item.id}
                            draggable
                            onDragStart={(e) => {
                                e.dataTransfer.setData("application/bom-item-id", item.id)
                                e.dataTransfer.effectAllowed = "copy"
                            }}
                            className="flex items-center gap-2 p-2 border border-zinc-200 bg-white hover:border-black hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all cursor-grab active:cursor-grabbing group"
                        >
                            <GripVertical className="h-3.5 w-3.5 text-zinc-300 shrink-0" />
                            <div className="min-w-0 flex-1">
                                <p className="text-xs font-bold truncate">{item.material?.name}</p>
                                <p className="text-[9px] text-zinc-400 font-mono">{item.material?.code} · {Number(item.quantityPerUnit)} {item.unit || item.material?.unit || "pcs"}</p>
                            </div>
                            <button
                                onClick={() => onRemoveItem(item.id)}
                                className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                            >
                                <X className="h-3.5 w-3.5 text-zinc-400 hover:text-red-500" />
                            </button>
                        </div>
                    ))}

                    {filtered.length === 0 && (
                        <div className="text-center py-6">
                            <Package className="h-8 w-8 text-zinc-200 mx-auto mb-2" />
                            <p className="text-[10px] font-bold text-zinc-300">Belum ada material</p>
                        </div>
                    )}
                </div>
            </ScrollArea>

            {/* Add button */}
            <div className="p-3 border-t-2 border-black">
                <Button onClick={onAddItem} className="w-full h-8 bg-black text-white font-black uppercase text-[10px] tracking-wider rounded-none shadow-[2px_2px_0px_0px_rgba(0,0,0,0.3)]">
                    <Plus className="mr-1.5 h-3.5 w-3.5" /> Tambah Material
                </Button>
            </div>
        </div>
    )
}
```

**Step 3: Create bom-canvas.tsx (React Flow wrapper)**

```tsx
"use client"

import { useCallback, useMemo, useState } from "react"
import {
    ReactFlow, Background, Controls, MiniMap,
    useNodesState, useEdgesState, addEdge,
    type Node, type Edge, type Connection,
} from "@xyflow/react"
import "@xyflow/react/dist/style.css"
import { StationNode } from "./station-node"

interface BOMCanvasProps {
    steps: any[]
    items: any[]
    onStepSelect: (stepId: string | null) => void
    onDropMaterial: (stepId: string, bomItemId: string) => void
    onRemoveMaterial: (stepId: string, bomItemId: string) => void
    selectedStepId: string | null
}

export function BOMCanvas({ steps, items, onStepSelect, onDropMaterial, onRemoveMaterial, selectedStepId }: BOMCanvasProps) {
    const nodeTypes = useMemo(() => ({ station: StationNode }), [])

    const nodes: Node[] = useMemo(() => {
        return steps.map((step, index) => ({
            id: step.id,
            type: "station",
            position: { x: 80 + index * 300, y: 100 },
            data: {
                station: step.station,
                sequence: step.sequence,
                materials: (step.materials || []).map((m: any) => ({
                    bomItemId: m.bomItemId,
                    materialName: m.bomItem?.material?.name || "Unknown",
                })),
                isSelected: step.id === selectedStepId,
                onRemoveMaterial: (bomItemId: string) => onRemoveMaterial(step.id, bomItemId),
            },
        }))
    }, [steps, selectedStepId, onRemoveMaterial])

    const edges: Edge[] = useMemo(() => {
        return steps.slice(1).map((step, index) => ({
            id: `e-${steps[index].id}-${step.id}`,
            source: steps[index].id,
            target: step.id,
            style: { strokeWidth: 2, stroke: "#000" },
            animated: true,
        }))
    }, [steps])

    const [nodesState, setNodes, onNodesChange] = useNodesState(nodes)
    const [edgesState, setEdges, onEdgesChange] = useEdgesState(edges)

    // Sync when steps change
    useMemo(() => {
        setNodes(nodes)
        setEdges(edges)
    }, [nodes, edges, setNodes, setEdges])

    const onNodeClick = useCallback((_: any, node: Node) => {
        onStepSelect(node.id)
    }, [onStepSelect])

    const onPaneClick = useCallback(() => {
        onStepSelect(null)
    }, [onStepSelect])

    const onDrop = useCallback((event: React.DragEvent) => {
        event.preventDefault()
        const bomItemId = event.dataTransfer.getData("application/bom-item-id")
        if (!bomItemId) return

        // Find which node was dropped on (closest node to drop position)
        const reactFlowBounds = event.currentTarget.getBoundingClientRect()
        const x = event.clientX - reactFlowBounds.left
        const y = event.clientY - reactFlowBounds.top

        // Find target node — simplistic: find node whose bounds contain the drop point
        for (const node of nodesState) {
            const nx = node.position.x
            const ny = node.position.y
            if (x >= nx && x <= nx + 220 && y >= ny && y <= ny + 200) {
                onDropMaterial(node.id, bomItemId)
                return
            }
        }
    }, [nodesState, onDropMaterial])

    const onDragOver = useCallback((event: React.DragEvent) => {
        event.preventDefault()
        event.dataTransfer.dropEffect = "copy"
    }, [])

    return (
        <div className="flex-1 h-full" onDrop={onDrop} onDragOver={onDragOver}>
            <ReactFlow
                nodes={nodesState}
                edges={edgesState}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onNodeClick={onNodeClick}
                onPaneClick={onPaneClick}
                nodeTypes={nodeTypes}
                fitView
                minZoom={0.3}
                maxZoom={2}
                proOptions={{ hideAttribution: true }}
            >
                <Background gap={20} size={1} color="#e4e4e7" />
                <Controls className="!border-2 !border-black !rounded-none !shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]" />
                <MiniMap className="!border-2 !border-black !rounded-none" />
            </ReactFlow>
        </div>
    )
}
```

**Step 4: Commit**

```bash
git add components/manufacturing/bom/station-node.tsx components/manufacturing/bom/material-panel.tsx components/manufacturing/bom/bom-canvas.tsx
git commit -m "feat: React Flow canvas components — station node, material panel, canvas wrapper"
```

---

## Task 12: Detail Panel (Bottom — Allocations + Attachments)

**Files:**
- Create: `components/manufacturing/bom/detail-panel.tsx`
- Create: `components/manufacturing/bom/allocation-editor.tsx`

**Step 1: Create allocation-editor.tsx**

```tsx
"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { Plus, Trash2 } from "lucide-react"

interface Allocation {
    stationId: string
    quantity: number
    notes: string
}

interface AllocationEditorProps {
    allocations: Allocation[]
    totalQty: number
    stations: any[] // child stations or all subcontractor stations
    onChange: (allocations: Allocation[]) => void
}

export function AllocationEditor({ allocations, totalQty, stations, onChange }: AllocationEditorProps) {
    const allocated = allocations.reduce((sum, a) => sum + a.quantity, 0)
    const remaining = totalQty - allocated

    const addAllocation = () => {
        onChange([...allocations, { stationId: "", quantity: 0, notes: "" }])
    }

    const updateAllocation = (index: number, field: string, value: any) => {
        const updated = [...allocations]
        updated[index] = { ...updated[index], [field]: value }
        onChange(updated)
    }

    const removeAllocation = (index: number) => {
        onChange(allocations.filter((_, i) => i !== index))
    }

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <h4 className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Alokasi Produksi</h4>
                <div className="text-[10px] font-bold">
                    <span className={remaining === 0 ? "text-emerald-600" : remaining < 0 ? "text-red-600" : "text-amber-600"}>
                        {allocated}/{totalQty} pcs
                    </span>
                    {remaining > 0 && <span className="text-zinc-400 ml-1">({remaining} sisa)</span>}
                </div>
            </div>

            {allocations.map((alloc, index) => (
                <div key={index} className="flex items-center gap-2">
                    <Select value={alloc.stationId} onValueChange={(v) => updateAllocation(index, "stationId", v)}>
                        <SelectTrigger className="h-8 text-xs border-zinc-200 rounded-none flex-1">
                            <SelectValue placeholder="Pilih stasiun..." />
                        </SelectTrigger>
                        <SelectContent>
                            {stations.map((s) => (
                                <SelectItem key={s.id} value={s.id}>
                                    {s.name} {s.subcontractor ? `(${s.subcontractor.name})` : ""}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <Input
                        type="number"
                        value={alloc.quantity}
                        onChange={(e) => updateAllocation(index, "quantity", parseInt(e.target.value) || 0)}
                        className="h-8 w-20 text-xs font-mono border-zinc-200 rounded-none"
                        placeholder="Qty"
                    />
                    <span className="text-[10px] font-bold text-zinc-400 shrink-0">pcs</span>
                    <Button variant="ghost" size="sm" onClick={() => removeAllocation(index)} className="h-8 w-8 p-0 rounded-none">
                        <Trash2 className="h-3.5 w-3.5 text-zinc-400 hover:text-red-500" />
                    </Button>
                </div>
            ))}

            <Button onClick={addAllocation} variant="outline" size="sm" className="h-7 text-[10px] font-bold rounded-none border-dashed w-full">
                <Plus className="mr-1 h-3 w-3" /> Tambah Alokasi
            </Button>
        </div>
    )
}
```

**Step 2: Create detail-panel.tsx**

```tsx
"use client"

import { AllocationEditor } from "./allocation-editor"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Paperclip, Upload, X, Clock, Cog } from "lucide-react"

interface DetailPanelProps {
    step: any
    totalQty: number
    stations: any[]
    onUpdateStep: (field: string, value: any) => void
    onUpdateAllocations: (allocations: any[]) => void
    onUploadAttachment: () => void
    onDeleteAttachment: (id: string) => void
}

export function DetailPanel({
    step, totalQty, stations,
    onUpdateStep, onUpdateAllocations,
    onUploadAttachment, onDeleteAttachment,
}: DetailPanelProps) {
    if (!step) return null

    const isSubcon = step.station?.operationType === "SUBCONTRACTOR"

    return (
        <div className="border-t-2 border-black bg-white px-6 py-4">
            <div className="flex items-start gap-6">
                {/* Step info */}
                <div className="space-y-3 flex-1">
                    <div className="flex items-center gap-2 mb-2">
                        <Cog className="h-4 w-4" />
                        <h3 className="font-black text-sm uppercase">{step.station?.name}</h3>
                        <span className={`text-[9px] font-black uppercase px-2 py-0.5 ${isSubcon ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"}`}>
                            {isSubcon ? `Subkon: ${step.station?.subcontractor?.name}` : "In-House"}
                        </span>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-[9px] font-black uppercase tracking-widest text-zinc-400 mb-1 block">
                                <Clock className="h-3 w-3 inline mr-1" /> Durasi (menit)
                            </label>
                            <Input
                                type="number"
                                value={step.durationMinutes || ""}
                                onChange={(e) => onUpdateStep("durationMinutes", parseInt(e.target.value) || null)}
                                className="h-8 text-xs font-mono border-zinc-200 rounded-none"
                            />
                        </div>
                        <div>
                            <label className="text-[9px] font-black uppercase tracking-widest text-zinc-400 mb-1 block">Catatan</label>
                            <Textarea
                                value={step.notes || ""}
                                onChange={(e) => onUpdateStep("notes", e.target.value)}
                                className="text-xs border-zinc-200 rounded-none min-h-[32px] h-8"
                            />
                        </div>
                    </div>
                </div>

                {/* Allocations */}
                {isSubcon && (
                    <div className="w-[320px] border-l-2 border-zinc-100 pl-6">
                        <AllocationEditor
                            allocations={step.allocations || []}
                            totalQty={totalQty}
                            stations={stations.filter((s) => s.operationType === "SUBCONTRACTOR")}
                            onChange={onUpdateAllocations}
                        />
                    </div>
                )}

                {/* Attachments */}
                <div className="w-[240px] border-l-2 border-zinc-100 pl-6">
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-2">
                        <Paperclip className="h-3 w-3 inline mr-1" /> Lampiran
                    </h4>
                    <div className="space-y-1.5">
                        {(step.attachments || []).map((att: any) => (
                            <div key={att.id} className="flex items-center gap-2 text-xs group">
                                <Paperclip className="h-3 w-3 text-zinc-400 shrink-0" />
                                <a href={att.fileUrl} target="_blank" rel="noreferrer" className="font-bold truncate flex-1 hover:underline">{att.fileName}</a>
                                <span className="text-[9px] text-zinc-400">{(att.fileSize / 1024).toFixed(0)}KB</span>
                                <button onClick={() => onDeleteAttachment(att.id)} className="opacity-0 group-hover:opacity-100">
                                    <X className="h-3 w-3 text-zinc-400 hover:text-red-500" />
                                </button>
                            </div>
                        ))}
                    </div>
                    <Button onClick={onUploadAttachment} variant="outline" size="sm" className="h-7 text-[10px] font-bold rounded-none border-dashed w-full mt-2">
                        <Upload className="mr-1 h-3 w-3" /> Upload File
                    </Button>
                </div>
            </div>
        </div>
    )
}
```

**Step 3: Commit**

```bash
git add components/manufacturing/bom/detail-panel.tsx components/manufacturing/bom/allocation-editor.tsx
git commit -m "feat: detail panel with allocation editor + attachment list"
```

---

## Task 13: Full Canvas Editor Page

**Files:**
- Modify: `app/manufacturing/bom/[id]/page.tsx`

**Step 1: Wire up the canvas page**

Replace `app/manufacturing/bom/[id]/page.tsx` with the full canvas editor that integrates MaterialPanel + BOMCanvas + DetailPanel. This page:

1. Fetches ProductionBOM detail via `useProductionBOM(id)`
2. Manages local state for items, steps, selected step
3. Toolbar: Back button, product name, version, qty input, Save, Add Station, Generate SPK
4. Left: MaterialPanel (280px)
5. Center: BOMCanvas (React Flow)
6. Bottom: DetailPanel (when step selected)
7. Save: PATCH /api/manufacturing/production-bom/[id] with full state

_(Full component code generated during execution — integrates all canvas components created in Task 11-12 with save/add-station/add-material handlers)_

**Step 2: Commit**

```bash
git add app/manufacturing/bom/[id]/page.tsx
git commit -m "feat: full canvas editor page — BOM visual flow editor"
```

---

## Task 14: Add Material Dialog (for canvas)

**Files:**
- Create: `components/manufacturing/bom/add-material-dialog.tsx`

**Step 1: Create the dialog**

A dialog that lets users search and add a material (Product with type RAW_MATERIAL) to the BOM's items list. Shows product code, name, unit. User enters quantityPerUnit and wastePct. On submit, adds to local items state (not yet saved to DB until user clicks Save).

```tsx
"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { NB } from "@/lib/dialog-styles"
import { Loader2, Search, Package } from "lucide-react"

interface AddMaterialDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    existingMaterialIds: string[]
    onAdd: (item: { materialId: string; material: any; quantityPerUnit: number; unit: string; wastePct: number }) => void
}

export function AddMaterialDialog({ open, onOpenChange, existingMaterialIds, onAdd }: AddMaterialDialogProps) {
    const [products, setProducts] = useState<any[]>([])
    const [search, setSearch] = useState("")
    const [selected, setSelected] = useState<any>(null)
    const [qty, setQty] = useState(1)
    const [waste, setWaste] = useState(0)
    const [loading, setLoading] = useState(false)

    useEffect(() => {
        if (open) {
            setLoading(true)
            fetch("/api/products?limit=500&status=active")
                .then((r) => r.json())
                .then((data) => {
                    const items = data.products || data.data || []
                    setProducts(items.filter((p: any) => p.productType === "RAW_MATERIAL" && !existingMaterialIds.includes(p.id)))
                })
                .catch(() => setProducts([]))
                .finally(() => setLoading(false))
        } else {
            setSelected(null)
            setSearch("")
            setQty(1)
            setWaste(0)
        }
    }, [open, existingMaterialIds])

    const filtered = products.filter((p) =>
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.code.toLowerCase().includes(search.toLowerCase())
    )

    const handleAdd = () => {
        if (!selected) return
        onAdd({
            materialId: selected.id,
            material: { id: selected.id, code: selected.code, name: selected.name, unit: selected.unit, costPrice: selected.costPrice },
            quantityPerUnit: qty,
            unit: selected.unit,
            wastePct: waste,
        })
        onOpenChange(false)
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className={NB.contentNarrow}>
                <DialogHeader className={NB.header}>
                    <DialogTitle className={NB.title}><Package className="h-5 w-5" /> Tambah Material</DialogTitle>
                </DialogHeader>
                <div className="p-4 space-y-3">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari material..." className="pl-9 h-9 rounded-none border-2 border-black" />
                    </div>

                    <ScrollArea className="h-[200px] border-2 border-zinc-200">
                        {loading ? (
                            <div className="flex items-center justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-zinc-300" /></div>
                        ) : (
                            <div className="divide-y">
                                {filtered.map((p) => (
                                    <button
                                        key={p.id}
                                        onClick={() => setSelected(p)}
                                        className={`w-full text-left px-3 py-2 hover:bg-zinc-50 ${selected?.id === p.id ? "bg-orange-50 border-l-4 border-l-orange-500" : ""}`}
                                    >
                                        <p className="text-xs font-bold">{p.name}</p>
                                        <p className="text-[10px] text-zinc-400 font-mono">{p.code} · {p.unit}</p>
                                    </button>
                                ))}
                            </div>
                        )}
                    </ScrollArea>

                    {selected && (
                        <div className="grid grid-cols-2 gap-3 border-2 border-black p-3 bg-zinc-50">
                            <div>
                                <label className={NB.label}>Qty per Unit</label>
                                <Input type="number" value={qty} onChange={(e) => setQty(parseFloat(e.target.value) || 0)} className="h-8 text-xs font-mono rounded-none border-zinc-300" />
                            </div>
                            <div>
                                <label className={NB.label}>Waste %</label>
                                <Input type="number" value={waste} onChange={(e) => setWaste(parseFloat(e.target.value) || 0)} className="h-8 text-xs font-mono rounded-none border-zinc-300" />
                            </div>
                        </div>
                    )}

                    <div className={NB.footer}>
                        <Button variant="outline" className={NB.cancelBtn} onClick={() => onOpenChange(false)}>Batal</Button>
                        <Button disabled={!selected} onClick={handleAdd} className={NB.submitBtn}>Tambah Material</Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}
```

**Step 2: Commit**

```bash
git add components/manufacturing/bom/add-material-dialog.tsx
git commit -m "feat: add material dialog for canvas — search + select raw materials"
```

---

## Task 15: SPK Generation API

**Files:**
- Create: `app/api/manufacturing/production-bom/[id]/generate-spk/route.ts`

**Step 1: Create the route**

```ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'

async function requireAuth() {
    const supabase = await createClient()
    const { data: { user }, error } = await supabase.auth.getUser()
    if (error || !user) throw new Error('Unauthorized')
    return user
}

// POST /api/manufacturing/production-bom/[id]/generate-spk
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        await requireAuth()
        const { id } = await params
        const body = await request.json().catch(() => ({}))
        const { priority = 'NORMAL', dueDate } = body

        const bom = await prisma.productionBOM.findUnique({
            where: { id },
            include: {
                product: { select: { id: true, code: true, name: true, unit: true } },
                steps: {
                    include: {
                        station: { select: { id: true, name: true, operationType: true } },
                        materials: {
                            include: { bomItem: { include: { material: { select: { id: true, name: true } } } } },
                        },
                        allocations: {
                            include: { station: { select: { id: true, name: true, operationType: true } } },
                        },
                    },
                    orderBy: { sequence: 'asc' },
                },
            },
        })

        if (!bom) {
            return NextResponse.json({ success: false, error: 'Production BOM not found' }, { status: 404 })
        }

        if (bom.totalProductionQty <= 0) {
            return NextResponse.json({ success: false, error: 'Total produksi harus > 0' }, { status: 400 })
        }

        // Validate: all steps must have materials
        const emptySteps = bom.steps.filter((s) => s.materials.length === 0)
        if (emptySteps.length > 0) {
            return NextResponse.json({
                success: false,
                error: `Step ${emptySteps.map((s) => s.sequence).join(', ')} belum ada material`,
            }, { status: 400 })
        }

        // Validate: subcontractor steps must have allocations totaling totalProductionQty
        for (const step of bom.steps) {
            if (step.station.operationType === 'SUBCONTRACTOR') {
                const totalAlloc = step.allocations.reduce((sum, a) => sum + a.quantity, 0)
                if (totalAlloc !== bom.totalProductionQty) {
                    return NextResponse.json({
                        success: false,
                        error: `Alokasi step ${step.sequence} (${step.station.name}): ${totalAlloc}/${bom.totalProductionQty} pcs`,
                    }, { status: 400 })
                }
            }
        }

        // Generate in transaction
        const createdWOs = await prisma.$transaction(async (tx) => {
            const today = new Date()
            const prefix = `MO-${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}`

            const lastWO = await tx.workOrder.findFirst({
                where: { number: { startsWith: prefix } },
                orderBy: { number: 'desc' },
            })

            let sequence = 1
            if (lastWO) {
                const lastSeq = parseInt(lastWO.number.split('-').pop() || '0')
                sequence = lastSeq + 1
            }

            const results: any[] = []
            let prevStepWOIds: string[] = []

            for (const step of bom.steps) {
                const currentStepWOIds: string[] = []

                if (step.station.operationType === 'SUBCONTRACTOR' && step.allocations.length > 0) {
                    // Create one WO per allocation
                    for (const alloc of step.allocations) {
                        const woNumber = `${prefix}-${String(sequence).padStart(4, '0')}`
                        const wo = await tx.workOrder.create({
                            data: {
                                number: woNumber,
                                productId: bom.productId,
                                productionBomId: bom.id,
                                productionBomStepId: step.id,
                                priority,
                                plannedQty: alloc.quantity,
                                dueDate: dueDate ? new Date(dueDate) : null,
                                status: 'PLANNED',
                                dependsOnWorkOrderId: prevStepWOIds.length === 1 ? prevStepWOIds[0] : null,
                            },
                        })
                        currentStepWOIds.push(wo.id)
                        results.push({ ...wo, stepSequence: step.sequence, stationName: step.station.name })
                        sequence++
                    }
                } else {
                    // In-house: single WO
                    const woNumber = `${prefix}-${String(sequence).padStart(4, '0')}`
                    const wo = await tx.workOrder.create({
                        data: {
                            number: woNumber,
                            productId: bom.productId,
                            productionBomId: bom.id,
                            productionBomStepId: step.id,
                            priority,
                            plannedQty: bom.totalProductionQty,
                            dueDate: dueDate ? new Date(dueDate) : null,
                            status: 'PLANNED',
                            dependsOnWorkOrderId: prevStepWOIds.length === 1 ? prevStepWOIds[0] : null,
                        },
                    })
                    currentStepWOIds.push(wo.id)
                    results.push({ ...wo, stepSequence: step.sequence, stationName: step.station.name })
                    sequence++
                }

                prevStepWOIds = currentStepWOIds
            }

            return results
        })

        return NextResponse.json({
            success: true,
            message: `Berhasil membuat ${createdWOs.length} SPK`,
            data: createdWOs.map((wo) => ({
                id: wo.id,
                number: wo.number,
                plannedQty: wo.plannedQty,
                stepSequence: wo.stepSequence,
                stationName: wo.stationName,
                status: wo.status,
            })),
        }, { status: 201 })
    } catch (error) {
        console.error('Error generating SPK:', error)
        return NextResponse.json({ success: false, error: 'Gagal membuat SPK' }, { status: 500 })
    }
}
```

**Step 2: Commit**

```bash
git add app/api/manufacturing/production-bom/[id]/generate-spk/route.ts
git commit -m "feat: SPK generation API — auto-create work orders from production BOM"
```

---

## Task 16: Attachment Upload API

**Files:**
- Create: `app/api/manufacturing/production-bom/[id]/attachments/route.ts`
- Create: `app/api/manufacturing/production-bom-attachments/[id]/route.ts`

**Step 1: Create upload route**

```ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'

// POST /api/manufacturing/production-bom/[id]/attachments
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const supabase = await createClient()
        const { data: { user }, error: authError } = await supabase.auth.getUser()
        if (authError || !user) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
        }

        const { id } = await params
        const formData = await request.formData()
        const file = formData.get('file') as File
        const stepId = formData.get('stepId') as string

        if (!file || !stepId) {
            return NextResponse.json({ success: false, error: 'file and stepId are required' }, { status: 400 })
        }

        // Upload to Supabase Storage
        const fileName = `${Date.now()}-${file.name}`
        const filePath = `bom-attachments/${id}/${stepId}/${fileName}`

        const { error: uploadError } = await supabase.storage
            .from('documents')
            .upload(filePath, file)

        if (uploadError) {
            return NextResponse.json({ success: false, error: 'Upload failed: ' + uploadError.message }, { status: 500 })
        }

        const { data: urlData } = supabase.storage.from('documents').getPublicUrl(filePath)

        const attachment = await prisma.productionBOMAttachment.create({
            data: {
                stepId,
                fileName: file.name,
                fileUrl: urlData.publicUrl,
                fileType: file.type,
                fileSize: file.size,
            },
        })

        return NextResponse.json({ success: true, data: attachment }, { status: 201 })
    } catch (error) {
        console.error('Error uploading attachment:', error)
        return NextResponse.json({ success: false, error: 'Failed to upload' }, { status: 500 })
    }
}
```

**Step 2: Create delete route**

Create `app/api/manufacturing/production-bom-attachments/[id]/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'

// DELETE /api/manufacturing/production-bom-attachments/[id]
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const supabase = await createClient()
        const { data: { user }, error: authError } = await supabase.auth.getUser()
        if (authError || !user) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
        }

        const { id } = await params

        const attachment = await prisma.productionBOMAttachment.findUnique({ where: { id } })
        if (!attachment) {
            return NextResponse.json({ success: false, error: 'Attachment not found' }, { status: 404 })
        }

        // Delete from Supabase Storage
        const urlPath = new URL(attachment.fileUrl).pathname
        const storagePath = urlPath.split('/documents/')[1]
        if (storagePath) {
            await supabase.storage.from('documents').remove([storagePath])
        }

        await prisma.productionBOMAttachment.delete({ where: { id } })

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('Error deleting attachment:', error)
        return NextResponse.json({ success: false, error: 'Failed to delete' }, { status: 500 })
    }
}
```

**Step 3: Commit**

```bash
git add app/api/manufacturing/production-bom/[id]/attachments/ app/api/manufacturing/production-bom-attachments/
git commit -m "feat: attachment upload + delete APIs — Supabase Storage"
```

---

## Task 17: PDF Report (Typst Template + API)

**Files:**
- Create: `templates/production_bom/main.typ`
- Create: `app/api/manufacturing/production-bom/[id]/pdf/route.ts`

**Step 1: Create Typst template**

Create `templates/production_bom/main.typ` with a production BOM report template covering: cover page with product info, steps detail with materials table per step, and summary page with cost breakdown.

_(Template follows same pattern as existing `templates/purchase_order/main.typ` — parameterized Typst template that receives JSON data)_

**Step 2: Create PDF generation route**

The route fetches full BOM data, formats it for Typst, calls Typst CLI to generate PDF, and returns the PDF response.

_(Follows same pattern as `app/api/documents/purchase-order/[id]/route.ts`)_

**Step 3: Commit**

```bash
git add templates/production_bom/ app/api/manufacturing/production-bom/[id]/pdf/
git commit -m "feat: production BOM PDF report — Typst template + API"
```

---

## Task 18: Integration Testing + Cleanup

**Step 1: Delete old mock data file**

Delete `components/manufacturing/bom/data.ts` (contains stale mock types).

**Step 2: Verify build**

Run: `npm run build`
Expected: Build succeeds (TypeScript errors allowed per next.config.ts, but no runtime crashes)

**Step 3: Manual testing checklist**

1. Navigate to `/manufacturing/bom` — card grid loads
2. Click "Buat BOM Baru" — dialog opens, select MANUFACTURED product, create
3. Redirected to `/manufacturing/bom/[id]` — canvas editor loads
4. Click "Tambah Material" — add raw materials from left panel
5. Click "Tambah Stasiun" — add process stations to canvas
6. Drag materials from left panel to station nodes
7. Click station node — detail panel appears at bottom
8. Set allocations for subcontractor stations
9. Click "Save" — saves without error
10. Click "Generate SPK" — creates work orders
11. Verify work orders appear in `/manufacturing/orders`

**Step 4: Final commit**

```bash
git add -A
git commit -m "feat: BOM revamp complete — visual canvas editor with React Flow"
```
