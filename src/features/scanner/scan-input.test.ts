import { describe, expect, it } from 'vitest'
import { parseScanInput } from './scan-input'

const TOKEN = 'Xk3pQ9rT2mZ7vB1nL5wY8cD4'

describe('parseScanInput', () => {
  it('menerima kode booking dan menormalkannya ke huruf besar', () => {
    expect(parseScanInput('TSB-20261111-003')).toEqual({
      kind: 'booking-code',
      value: 'TSB-20261111-003',
    })
    expect(parseScanInput('  tsb-20261111-003  ')).toEqual({
      kind: 'booking-code',
      value: 'TSB-20261111-003',
    })
  })

  it('menerima kode booking lama yang urutannya kurang dari tiga digit', () => {
    expect(parseScanInput('TSB-20261111-92')).toEqual({
      kind: 'booking-code',
      value: 'TSB-20261111-92',
    })
    expect(parseScanInput('tsb-20261111-9')).toEqual({
      kind: 'booking-code',
      value: 'TSB-20261111-9',
    })
  })

  it('menerima token QR apa adanya', () => {
    expect(parseScanInput(TOKEN)).toEqual({ kind: 'token', value: TOKEN })
  })

  it('menolak masukan kosong atau berbentuk lain', () => {
    expect(parseScanInput('')).toBeNull()
    expect(parseScanInput('   ')).toBeNull()
    expect(parseScanInput('12345')).toBeNull()
    expect(parseScanInput('TSB-2026-003')).toBeNull()
    expect(parseScanInput('kode tiket saya')).toBeNull()
  })
})
