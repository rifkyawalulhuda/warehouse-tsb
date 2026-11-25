import { describe, expect, it } from 'vitest'
import {
  anyFilled,
  emailProblem,
  looksLikeEmail,
  passwordProblem,
  profileChanged,
  profileProblem,
} from './form'

describe('looksLikeEmail', () => {
  it('menerima bentuk yang wajar', () => {
    expect(looksLikeEmail('admin@gudang.id')).toBe(true)
    expect(looksLikeEmail('  nama.belakang@sub.domain.co.id  ')).toBe(true)
  })

  it('menolak salah ketik yang jelas', () => {
    expect(looksLikeEmail('')).toBe(false)
    expect(looksLikeEmail('admin')).toBe(false)
    expect(looksLikeEmail('admin@')).toBe(false)
    expect(looksLikeEmail('admin@gudang')).toBe(false)
    expect(looksLikeEmail('ad min@gudang.id')).toBe(false)
  })
})

describe('emailProblem', () => {
  const current = 'admin@gudang.id'

  it('menerima email baru yang sah dan berbeda', () => {
    expect(
      emailProblem(
        { email: 'baru@gudang.id', repeat: 'baru@gudang.id', password: 'rahasia' },
        current
      )
    ).toBeNull()
  })

  it('menolak email yang sama tanpa peduli huruf besar-kecil', () => {
    // Server menyimpan email dalam huruf kecil, jadi perbedaan kapitalisasi
    // bukan perubahan — kalau lolos, server akan menolaknya dengan kode lain
    // dan pesannya jadi membingungkan.
    expect(
      emailProblem(
        { email: 'ADMIN@Gudang.id', repeat: 'ADMIN@Gudang.id', password: 'rahasia' },
        current
      )
    ).toBe('same')
  })

  it('menolak kedua email yang belum sama', () => {
    expect(
      emailProblem(
        { email: 'baru@gudang.id', repeat: 'baru@gudang.com', password: 'rahasia' },
        current
      )
    ).toBe('mismatch')
  })

  it('menolak bila kata sandi belum diisi', () => {
    expect(
      emailProblem(
        { email: 'baru@gudang.id', repeat: 'baru@gudang.id', password: '' },
        current
      )
    ).toBe('passwordMissing')
  })

  it('mendahulukan format salah daripada urutan pemeriksaan lain', () => {
    expect(
      emailProblem({ email: 'bukan-email', repeat: '', password: '' }, current)
    ).toBe('invalid')
  })
})

describe('passwordProblem', () => {
  it('menerima kata sandi baru yang cukup panjang dan berbeda', () => {
    expect(
      passwordProblem({ current: 'lama123', next: 'baru12345', repeat: 'baru12345' })
    ).toBeNull()
  })

  it('menolak bila kata sandi sekarang kosong', () => {
    expect(
      passwordProblem({ current: '', next: 'baru12345', repeat: 'baru12345' })
    ).toBe('currentMissing')
  })

  it('menolak kata sandi baru di bawah 7 karakter', () => {
    expect(
      passwordProblem({ current: 'lama123', next: 'baru12', repeat: 'baru12' })
    ).toBe('short')
  })

  it('menolak kata sandi baru yang sama dengan yang sekarang', () => {
    expect(
      passwordProblem({ current: 'lama123', next: 'lama123', repeat: 'lama123' })
    ).toBe('same')
  })

  it('menolak ulangan yang tidak sama', () => {
    expect(
      passwordProblem({ current: 'lama123', next: 'baru12345', repeat: 'baru12346' })
    ).toBe('mismatch')
  })
})

describe('profileProblem', () => {
  it('menerima nama dan nomor yang wajar', () => {
    expect(profileProblem({ name: 'Budi', phone: '0812 3456 7890' })).toBeNull()
  })

  it('menerima nomor HP kosong', () => {
    expect(profileProblem({ name: 'Budi', phone: '   ' })).toBeNull()
  })

  it('menolak nama yang terlalu pendek', () => {
    expect(profileProblem({ name: ' A ', phone: '' })).toBe('name')
  })

  it('menolak nomor HP yang kepanjangan', () => {
    expect(profileProblem({ name: 'Budi', phone: '0'.repeat(25) })).toBe('phone')
  })
})

describe('profileChanged', () => {
  it('menganggap nomor kosong dan null sebagai sama', () => {
    // Tanpa ini, pengguna yang tidak punya nomor HP akan melihat tombol simpan
    // menyala sejak halaman dibuka.
    expect(
      profileChanged({ name: 'Budi', phone: '' }, { name: 'Budi', phone: null })
    ).toBe(false)
  })

  it('mengabaikan spasi di ujung', () => {
    expect(
      profileChanged(
        { name: ' Budi ', phone: '0812 ' },
        { name: 'Budi', phone: '0812' }
      )
    ).toBe(false)
  })

  it('mendeteksi perubahan nama dan nomor', () => {
    expect(
      profileChanged({ name: 'Budi', phone: '' }, { name: 'Budi Santoso', phone: null })
    ).toBe(true)
    expect(
      profileChanged({ name: 'Budi', phone: '0812' }, { name: 'Budi', phone: null })
    ).toBe(true)
  })
})

describe('anyFilled', () => {
  it('hanya benar bila ada isian', () => {
    expect(anyFilled({ a: '', b: '' })).toBe(false)
    expect(anyFilled({ a: '', b: 'x' })).toBe(true)
  })
})