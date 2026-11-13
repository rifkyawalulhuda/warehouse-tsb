import { describe, expect, it } from 'vitest'
import { buildSidebarData, navGroupsForRole } from './sidebar-data'

function links(role: Parameters<typeof navGroupsForRole>[0]) {
  return navGroupsForRole(role).flatMap((group) =>
    group.items.map((item) => item.url)
  )
}

describe('menu samping per peran', () => {
  it('memberi checker jalan langsung ke Scan Checker', () => {
    expect(links('CHECKER')).toEqual([
      '/checker/scan',
      '/queue',
      '/dock',
      '/history',
      '/reports',
    ])
  })

  it('tidak mencampurkan pemindai gate dan pemindai dock', () => {
    expect(links('GATE_OFFICER')).not.toContain('/checker/scan')
    expect(links('CHECKER')).not.toContain('/scan')
  })

  it('memberi admin kedua layar pindai', () => {
    expect(links('ADMIN')).toEqual(
      expect.arrayContaining(['/scan', '/checker/scan'])
    )
  })

  it('menaruh laporan customer di jalurnya sendiri', () => {
    expect(links('CUSTOMER')).toEqual([
      '/bookings',
      '/bookings/new',
      '/reports/customer',
    ])
    expect(links('CHECKER')).toContain('/reports')
    expect(links('CHECKER')).not.toContain('/reports/customer')
  })

  it('meneruskan nama perusahaan ke kartu pengguna di kaki sidebar', () => {
    const customer = buildSidebarData('CUSTOMER', {
      name: 'Budi Santoso',
      email: 'budi@sinarjaya.co.id',
      company: 'PT Sinar Jaya Logistik',
    })
    expect(customer.user.company).toBe('PT Sinar Jaya Logistik')

    // Staf tidak punya perusahaan; kartunya tetap memakai label peran.
    const admin = buildSidebarData('ADMIN', {
      name: 'Admin Gudang',
      email: 'admin@warehouse.test',
    })
    expect(admin.user.company).toBeUndefined()
  })
})

describe('penanda persetujuan di menu', () => {
  const user = { name: 'Admin', email: 'admin@tsb.test' }

  function items(
    role: Parameters<typeof buildSidebarData>[0],
    pending?: number
  ) {
    return buildSidebarData(role, user, {
      pendingApprovals: pending,
    }).navGroups.flatMap((group) => group.items)
  }

  it('tidak menandai menu apa pun saat antrean persetujuan kosong', () => {
    const queue = items('ADMIN').find((item) => item.url === '/queue')

    expect(queue?.attention).toBeUndefined()
  })

  it('menandai Antrean Hari Ini dengan jumlah yang menunggu', () => {
    const queue = items('ADMIN', 3).find((item) => item.url === '/queue')

    expect(queue?.attention).toBe(3)
  })

  it('hanya menandai Antrean Hari Ini, bukan menu lain', () => {
    const lain = items('ADMIN', 3).filter((item) => item.url !== '/queue')

    expect(lain.length).toBeGreaterThan(0)
    expect(lain.every((item) => item.attention === undefined)).toBe(true)
  })

  it('tidak mengubah tujuan menu, hanya menambah penanda', () => {
    // Penanda adalah isyarat, bukan pengalihan: menu "Antrean Hari Ini" harus
    // tetap membuka tab Antrean walau ada persetujuan yang menunggu. Karena
    // itu satu-satunya kunci tambahan adalah `attention`.
    const bertanda = items('ADMIN', 2).find((item) => item.url === '/queue')
    const polos = items('ADMIN').find((item) => item.url === '/queue')

    expect(bertanda?.url).toBe('/queue')
    expect(Object.keys(bertanda ?? {}).sort()).toEqual(
      [...Object.keys(polos ?? {}), 'attention'].sort()
    )
  })

  it('tidak menandai peran yang tidak punya menu Antrean Hari Ini', () => {
    // Gate officer memang tidak membuka layar antrean; penanda di sini akan
    // menunjuk halaman yang menolaknya.
    const gate = items('GATE_OFFICER', 5)

    expect(gate.some((item) => item.url === '/queue')).toBe(false)
    expect(gate.every((item) => item.attention === undefined)).toBe(true)
  })

  it('tidak mengubah menu asli saat menandai', () => {
    // `navGroupsForRole` mengembalikan larik tingkat modul; menandai menu tidak
    // boleh menulis ke sana, kalau tidak penanda terbawa ke sesi berikutnya.
    items('ADMIN', 4)
    const sesudahnya = items('ADMIN').find((item) => item.url === '/queue')

    expect(sesudahnya?.attention).toBeUndefined()
  })
})
