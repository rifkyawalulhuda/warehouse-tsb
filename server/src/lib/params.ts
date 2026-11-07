import type { Request } from 'express'
import { badRequest } from './http-error'

/** Express 5 mengetik req.params sebagai string | string[]; ambil satu nilai string. */
export function pathParam(req: Request, name: string): string {
  const raw = (req.params as Record<string, string | string[] | undefined>)[name]
  const value = Array.isArray(raw) ? raw[0] : raw
  if (!value) throw badRequest('INVALID_PARAM', `Parameter ${name} tidak valid`)
  return value
}
