import { describe, expect, it } from 'vitest'
import { navGroupsForRole } from './sidebar-data'

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
})
