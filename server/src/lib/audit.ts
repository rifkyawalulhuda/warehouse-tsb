import type { Prisma, Role } from '@prisma/client'
import { prisma } from '../lib/prisma'

type DbClient = Pick<typeof prisma, 'auditLog'>

export type AuditInput = {
  userId: string | null
  userRole: Role
  actingAsRole?: Role | null
  action: string
  bookingId?: string | null
  meta?: Prisma.InputJsonValue
}

export async function writeAudit(input: AuditInput, db: DbClient = prisma): Promise<void> {
  await db.auditLog.create({
    data: {
      userId: input.userId,
      userRole: input.userRole,
      actingAsRole: input.actingAsRole ?? input.userRole,
      action: input.action,
      bookingId: input.bookingId ?? null,
      meta: input.meta,
    },
  })
}
