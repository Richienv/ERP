import type { Prisma, PrismaClient } from "@prisma/client"

type TxClient = Prisma.TransactionClient | PrismaClient

/**
 * Atomic per-prefix sequential document number generator.
 *
 * Replaces the racy `count() + 1` pattern. Two concurrent callers each get
 * a distinct value because PostgreSQL serializes the upsert on the unique
 * `prefix` index — there's no read-then-write window.
 *
 * Pass the active `tx` client when called inside a `$transaction` so the
 * counter increment commits / rolls back with the document creation.
 *
 * @example
 *   const number = await getNextDocNumber(tx, "GRN-202604")
 *   // → "GRN-202604-00001", next call → "GRN-202604-00002"
 */
export async function getNextDocNumber(
    tx: TxClient,
    prefix: string,
    pad = 5,
): Promise<string> {
    const counter = await tx.documentCounter.upsert({
        where: { prefix },
        create: { prefix, value: 1 },
        update: { value: { increment: 1 } },
    })
    return `${prefix}-${String(counter.value).padStart(pad, "0")}`
}
