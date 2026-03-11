"use client"

import { useCallback, useEffect, useRef } from "react"
import {
    ReactFlow, Background, Controls, MiniMap,
    useNodesState, useEdgesState, reconnectEdge,
    type Node, type Edge, type Connection,
} from "@xyflow/react"
import "@xyflow/react/dist/style.css"
import { StationNode, type StationNodeData } from "./station-node"
import { calcAllStepTargets, detectSplitGroups } from "./bom-step-helpers"
import { calcStepMaterialCost, type BOMItemWithCost } from "./bom-cost-helpers"

interface BOMCanvasProps {
    steps: any[]
    items: any[]
    totalProductionQty?: number
    onStepSelect: (stepId: string | null) => void
    onDropMaterial: (stepId: string, bomItemId: string) => void
    onRemoveMaterial: (stepId: string, bomItemId: string) => void
    onRemoveStep?: (stepId: string) => void
    selectedStepId: string | null
    onConnectSteps?: (sourceStepId: string, targetStepId: string) => void
    onDisconnectSteps?: (sourceStepId: string, targetStepId: string) => void
    onNodeContextMenu?: (stepId: string, pos: { clientX: number; clientY: number }) => void
    onAddParallel?: (stepId: string) => void
    onAddSequential?: (stepId: string) => void
    onNodePositionChange?: (stepId: string, x: number, y: number) => void
    onPctChange?: (stepId: string, newPct: number) => void
    criticalStepIds?: Set<string>
}

const nodeTypes = { station: StationNode }

/** BFS-based tree layout from parentStepIds DAG.
 *  Parallel siblings get staggered diagonally (offset X + Y) for clear separation. */
function layoutNodes(steps: any[]): Map<string, { x: number; y: number }> {
    const positions = new Map<string, { x: number; y: number }>()
    const childrenMap = new Map<string, string[]>()

    const COL_GAP = 380      // horizontal gap between sequential columns
    const ROW_GAP = 420      // vertical gap between parallel siblings (nodes are ~350px tall)
    const PARALLEL_X_OFFSET = 120  // extra X stagger per parallel sibling for diagonal spread

    for (const step of steps) {
        for (const pid of (step.parentStepIds || [])) {
            const children = childrenMap.get(pid) || []
            children.push(step.id)
            childrenMap.set(pid, children)
        }
    }

    // Find roots (no parents)
    const roots = steps.filter(s => !(s.parentStepIds?.length > 0))

    const visited = new Set<string>()
    const queue: { id: string; col: number }[] = roots.map((r) => ({ id: r.id, col: 0 }))
    const columns = new Map<number, string[]>()

    while (queue.length > 0) {
        const { id, col } = queue.shift()!
        if (visited.has(id)) continue
        visited.add(id)

        const colItems = columns.get(col) || []
        colItems.push(id)
        columns.set(col, colItems)

        for (const childId of (childrenMap.get(id) || [])) {
            if (!visited.has(childId)) {
                queue.push({ id: childId, col: col + 1 })
            }
        }
    }

    // Handle orphans
    for (const step of steps) {
        if (!visited.has(step.id)) {
            const maxCol = columns.size > 0 ? Math.max(...columns.keys()) + 1 : 0
            const colItems = columns.get(maxCol) || []
            colItems.push(step.id)
            columns.set(maxCol, colItems)
        }
    }

    // Position nodes — parallel siblings get diagonal stagger
    for (const [col, ids] of columns) {
        const isParallel = ids.length > 1
        const totalHeight = (ids.length - 1) * ROW_GAP
        const startY = 80 - totalHeight / 2
        ids.forEach((id, i) => {
            const baseX = 80 + col * COL_GAP
            // Stagger parallel siblings diagonally: each one shifts right
            const xOffset = isParallel ? i * PARALLEL_X_OFFSET : 0
            positions.set(id, {
                x: baseX + xOffset,
                y: Math.max(20, startY + i * ROW_GAP),
            })
        })
    }

    return positions
}

export function BOMCanvas({
    steps, items, totalProductionQty, onStepSelect, onDropMaterial, onRemoveMaterial,
    onRemoveStep, selectedStepId, onConnectSteps, onDisconnectSteps, onNodeContextMenu,
    onAddParallel, onAddSequential, onNodePositionChange, onPctChange, criticalStepIds,
}: BOMCanvasProps) {
    const buildNodes = useCallback((): Node[] => {
        const layoutPositions = layoutNodes(steps)

        // Compute per-step production target
        const stepTargets = calcAllStepTargets(steps, totalProductionQty || 0)
        const splitGroups = detectSplitGroups(steps, totalProductionQty || 0)
        const stepPctMap = new Map<string, number>()
        for (const g of splitGroups) {
            for (const [sid, pct] of g.percentages) {
                stepPctMap.set(sid, pct)
            }
        }

        return steps.map((step, index) => {
            // Use saved position if available, otherwise use layout algorithm
            const hasSavedPosition = step.positionX != null && step.positionY != null
            const layoutPos = layoutPositions.get(step.id) || { x: 80 + index * 300, y: 100 }
            const position = hasSavedPosition
                ? { x: step.positionX, y: step.positionY }
                : layoutPos

            return {
            id: step.id,
            type: "station" as const,
            position,
            data: {
                station: step.station,
                sequence: step.sequence,
                materials: (step.materials || []).map((m: any) => ({
                    bomItemId: m.bomItemId,
                    materialName: m.bomItem?.material?.name || "Unknown",
                })),
                materialCost: (() => {
                    const stepCost = calcStepMaterialCost(step, items as BOMItemWithCost[], 1)
                    const laborCost = Number(step.station?.costPerUnit || 0)
                    return stepCost + laborCost
                })(),
                durationMinutes: step.durationMinutes || null,
                completedQty: step.completedQty || 0,
                totalProductionQty: totalProductionQty || 0,
                stepTarget: stepTargets.get(step.id) || totalProductionQty || 0,
                startedAt: step.startedAt || null,
                useSubkon: step.useSubkon ?? undefined,
                allocations: step.allocations || [],
                operatorName: step.operatorName || null,
                groupName: step.station?.group?.name || null,
                splitPct: stepPctMap.get(step.id),
                onPctChange: onPctChange ? (newPct: number) => onPctChange(step.id, newPct) : undefined,
                isSelected: step.id === selectedStepId,
                isCritical: criticalStepIds?.has(step.id) ?? false,
                onRemoveMaterial: (bomItemId: string) => onRemoveMaterial(step.id, bomItemId),
                onDrop: (bomItemId: string) => onDropMaterial(step.id, bomItemId),
                onRemoveStep: onRemoveStep ? () => onRemoveStep(step.id) : undefined,
                onContextMenu: onNodeContextMenu ? (pos: { clientX: number; clientY: number }) => onNodeContextMenu(step.id, pos) : undefined,
                onAddParallel: onAddParallel ? () => onAddParallel(step.id) : undefined,
                onAddSequential: onAddSequential ? () => onAddSequential(step.id) : undefined,
            } satisfies StationNodeData,
        }})
    }, [steps, items, selectedStepId, criticalStepIds, onRemoveMaterial, onDropMaterial, onRemoveStep, onNodeContextMenu, onAddParallel, onAddSequential, onPctChange])

    const buildEdges = useCallback((): Edge[] => {
        const edges: Edge[] = []

        for (const step of steps) {
            for (const parentId of (step.parentStepIds || [])) {
                edges.push({
                    id: `e-${parentId}-${step.id}`,
                    source: parentId,
                    target: step.id,
                    type: "smoothstep",
                    style: { strokeWidth: 2, stroke: "#000" },
                    animated: true,
                    deletable: true,
                    reconnectable: true,
                })
            }
        }

        // Split group bracket connectors (dashed orange, curved)
        const splitGroups = detectSplitGroups(steps, totalProductionQty || 0)
        for (const group of splitGroups) {
            for (let i = 0; i < group.stepIds.length - 1; i++) {
                edges.push({
                    id: `split-${group.stepIds[i]}-${group.stepIds[i + 1]}`,
                    source: group.stepIds[i],
                    target: group.stepIds[i + 1],
                    type: "smoothstep",
                    style: { strokeWidth: 2, stroke: "#f97316", strokeDasharray: "8 4" },
                    animated: false,
                    deletable: false,
                    selectable: false,
                })
            }
        }

        return edges
    }, [steps, totalProductionQty])

    const [nodes, setNodes, onNodesChange] = useNodesState(buildNodes())
    const [edges, setEdges, onEdgesChange] = useEdgesState(buildEdges())

    useEffect(() => {
        setNodes(buildNodes())
        setEdges(buildEdges())
    }, [buildNodes, buildEdges, setNodes, setEdges])

    const onNodeClick = useCallback((_: any, node: Node) => {
        onStepSelect(node.id)
    }, [onStepSelect])

    const onNodeDragStop = useCallback((_: any, node: Node) => {
        if (onNodePositionChange) {
            onNodePositionChange(node.id, node.position.x, node.position.y)
        }
    }, [onNodePositionChange])

    const onPaneClick = useCallback(() => {
        onStepSelect(null)
    }, [onStepSelect])

    const handleConnect = useCallback((connection: Connection) => {
        if (connection.source && connection.target && onConnectSteps) {
            onConnectSteps(connection.source, connection.target)
        }
    }, [onConnectSteps])

    const handleEdgesDelete = useCallback((deletedEdges: Edge[]) => {
        for (const edge of deletedEdges) {
            if (edge.source && edge.target && onDisconnectSteps) {
                onDisconnectSteps(edge.source, edge.target)
            }
        }
    }, [onDisconnectSteps])

    // Edge reconnection: drag an existing edge endpoint to a different node
    const edgeReconnectSuccessful = useRef(true)

    const handleReconnectStart = useCallback(() => {
        edgeReconnectSuccessful.current = false
    }, [])

    const handleReconnect = useCallback((oldEdge: Edge, newConnection: Connection) => {
        edgeReconnectSuccessful.current = true
        // Remove old connection, add new one
        if (oldEdge.source && oldEdge.target && onDisconnectSteps) {
            onDisconnectSteps(oldEdge.source, oldEdge.target)
        }
        if (newConnection.source && newConnection.target && onConnectSteps) {
            onConnectSteps(newConnection.source, newConnection.target)
        }
        setEdges((eds) => reconnectEdge(oldEdge, newConnection, eds))
    }, [onDisconnectSteps, onConnectSteps, setEdges])

    const handleReconnectEnd = useCallback((_: any, edge: Edge) => {
        // If reconnect was not successful (dropped in empty space), delete the edge
        if (!edgeReconnectSuccessful.current && onDisconnectSteps) {
            onDisconnectSteps(edge.source, edge.target)
        }
        edgeReconnectSuccessful.current = true
    }, [onDisconnectSteps])

    return (
        <div className="flex-1 h-full">
            <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onNodeClick={onNodeClick}
                onNodeDragStop={onNodeDragStop}
                onPaneClick={onPaneClick}
                onConnect={handleConnect}
                onEdgesDelete={handleEdgesDelete}
                onReconnect={handleReconnect}
                onReconnectStart={handleReconnectStart}
                onReconnectEnd={handleReconnectEnd}
                nodeTypes={nodeTypes}
                fitView
                minZoom={0.3}
                maxZoom={2}
                connectionLineType="smoothstep"
                connectionLineStyle={{ strokeWidth: 2, stroke: "#f97316" }}
                proOptions={{ hideAttribution: true }}
            >
                <Background gap={20} size={1} color="#e4e4e7" />
                <Controls className="!border-2 !border-black !rounded-none !shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]" />
                <MiniMap className="!border-2 !border-black !rounded-none" />
            </ReactFlow>
        </div>
    )
}
