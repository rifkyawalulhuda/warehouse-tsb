import { PrismaClient } from '@prisma/client'
import { env } from '../config/env'

export const prisma = new PrismaClient({
  log: env.isProduction ? ['warn', 'error'] : ['warn', 'error'],
})

export type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0]
