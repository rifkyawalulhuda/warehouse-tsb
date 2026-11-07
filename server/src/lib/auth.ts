import { createHash, randomBytes } from 'node:crypto'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { env } from '../config/env'
import type { Role } from '@prisma/client'

export type AccessClaims = {
  sub: string
  role: Role
  name: string
  email: string
}

export type RefreshClaims = {
  sub: string
  tokenId: string
}

const ACCESS_COOKIE = 'tsb_at'
const REFRESH_COOKIE = 'tsb_rt'

export const cookieNames = { access: ACCESS_COOKIE, refresh: REFRESH_COOKIE }

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10)
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash)
}

export function signAccessToken(claims: AccessClaims): string {
  return jwt.sign(claims, env.jwt.accessSecret, {
    expiresIn: `${env.jwt.accessTtlMinutes}m`,
  })
}

export function signRefreshToken(claims: RefreshClaims): string {
  return jwt.sign(claims, env.jwt.refreshSecret, {
    expiresIn: `${env.jwt.refreshTtlDays}d`,
  })
}

export function verifyAccessToken(token: string): AccessClaims {
  return jwt.verify(token, env.jwt.accessSecret) as AccessClaims
}

export function verifyRefreshToken(token: string): RefreshClaims {
  return jwt.verify(token, env.jwt.refreshSecret) as RefreshClaims
}

/** Token opaque untuk URL tiket supir. Tidak bisa ditebak, tidak memuat data. */
export function generateQrToken(): string {
  return randomBytes(24).toString('base64url')
}

/** Token acak untuk refresh yang disimpan sebagai hash, bukan plaintext. */
export function generateRefreshId(): string {
  return randomBytes(24).toString('base64url')
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

export const cookieOptions = (maxAgeMs: number) => ({
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: env.isProduction,
  path: '/',
  maxAge: maxAgeMs,
})
