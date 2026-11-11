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
