import { PrismaClient, type Prisma } from '@prisma/client'
import { env } from '../config/env'

/**
 * Log query dimatikan secara bawaan karena satu request bisa menghasilkan
 * puluhan baris dan menenggelamkan log lain. Nyalakan hanya saat menelusuri
 * masalah: `PRISMA_QUERY_LOG=1 npm run dev`.
 */
const log: Prisma.LogLevel[] = ['warn', 'error']
if (!env.isProduction && process.env.PRISMA_QUERY_LOG === '1') log.push('query')

export const prisma = new PrismaClient({ log })

export type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0]
