/**
 * Audit trail helpers for tracking entity changes.
 * Pure functions (computeChanges, generateNarrative) + DB functions (logAudit, getAuditLog).
 */

const IGNORED_FIELDS = new Set(["updatedAt", "createdAt", "id"])

export interface FieldChange {
  from: unknown
  to: unknown
}

export type ChangeMap = Record<string, FieldChange>

export function computeChanges(
  before: Record<string, unknown>,
  after: Record<string, unknown>
): ChangeMap {
  const changes: ChangeMap = {}

  for (const key of Object.keys(after)) {
    if (IGNORED_FIELDS.has(key)) continue
    const oldVal = before[key]
    const newVal = after[key]

    const oldStr = JSON.stringify(oldVal)
    const newStr = JSON.stringify(newVal)

    if (oldStr !== newStr) {
      changes[key] = { from: oldVal, to: newVal }
    }
  }

  return changes
}

export function generateNarrative(
  entityType: string,
  action: string,
  userName: string,
  changes: ChangeMap
): string {
  const actor = userName || "Sistem"

  switch (action) {
    case "CREATE":
      return `${actor} membuat ${entityType} baru`
    case "DELETE":
      return `${actor} menghapus ${entityType}`
    case "STATUS_CHANGE": {
      const statusChange = changes.status
      if (statusChange) {
        return `${actor} mengubah status ${entityType} dari ${statusChange.from} ke ${statusChange.to}`
      }
      return `${actor} mengubah status ${entityType}`
    }
    case "UPDATE": {
      const fields = Object.keys(changes)
      if (fields.length === 0) return `${actor} memperbarui ${entityType}`
      if (fields.length <= 3) {
        return `${actor} memperbarui ${fields.join(", ")} pada ${entityType}`
      }
      return `${actor} memperbarui ${fields.length} field pada ${entityType}`
    }
    default:
      return `${actor} melakukan ${action} pada ${entityType}`
  }
}

/**
 * Log an audit entry. Accepts a Prisma client or transaction client.
 */
export async function logAudit(
  tx: { auditLog: { create: (args: any) => Promise<any> } },
  params: {
    entityType: string
    entityId: string
    action: string
    userId: string
    userName?: string
    changes?: ChangeMap
  }
) {
  const narrative = generateNarrative(
    params.entityType,
    params.action,
    params.userName || params.userId,
    params.changes || {}
  )

  await tx.auditLog.create({
    data: {
      entityType: params.entityType,
      entityId: params.entityId,
      action: params.action,
      userId: params.userId,
      userName: params.userName,
      changes: params.changes ? JSON.parse(JSON.stringify(params.changes)) : undefined,
      narrative,
    },
  })
}

/**
 * Fetch audit log for an entity. Used by detail pages via API route.
 */
export async function getAuditLog(entityType: string, entityId: string) {
  const prisma = (await import("@/lib/db")).default
  return prisma.auditLog.findMany({
    where: { entityType, entityId },
    orderBy: { createdAt: "desc" },
    take: 50,
  })
}
