import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * `server/` bukan paket mandiri: instalasi, lockfile, dan Docker build semuanya
 * dari root. Tetapi manifest yang kosong membuat alat apa pun — IDE, audit
 * dependensi, `npm ls` di folder server — menyimpulkan modul ini tidak butuh
 * apa-apa.
 *
 * Solusinya: daftar dependensi ditulis di sini *dan* di root, lalu tes ini
 * menjaga keduanya tidak menyimpang. Tes pertama memastikan tidak ada paket
 * yang diimpor tetapi lupa dicatat; tes kedua memastikan versinya sama dengan
 * root, satu-satunya tempat yang benar-benar diinstal.
 */
const rootDir = process.cwd()
const serverDir = join(rootDir, 'server')

function manifest(path: string) {
  return JSON.parse(readFileSync(path, 'utf8')) as {
    dependencies?: Record<string, string>
    devDependencies?: Record<string, string>
  }
}

const root = manifest(join(rootDir, 'package.json'))
const server = manifest(join(serverDir, 'package.json'))

/** Paket yang benar-benar diimpor `server/src`, bukan sekadar tercatat. */
function importedPackages(): Set<string> {
  const files = readdirSync(join(serverDir, 'src'), { recursive: true, encoding: 'utf8' })
    .map((entry) => join(serverDir, 'src', entry))
    .filter((entry) => entry.endsWith('.ts'))

  const pattern = /(?:from\s+|import\s*\(\s*)['"]([^'"]+)['"]/g
  const packages = new Set<string>()

  for (const file of files) {
    const source = readFileSync(file, 'utf8')
    for (const match of source.matchAll(pattern)) {
      const specifier = match[1]
      if (specifier.startsWith('.') || specifier.startsWith('node:')) continue
      packages.add(
        specifier.startsWith('@') ? specifier.split('/').slice(0, 2).join('/') : specifier.split('/')[0]
      )
    }
  }

  return packages
}

describe('manifest server', () => {
  it('mencatat setiap paket yang diimpor', () => {
    const declared = new Set(Object.keys(server.dependencies ?? {}))
    const missing = [...importedPackages()].filter((name) => !declared.has(name)).sort()

    expect(missing).toEqual([])
  })

  it('memakai versi yang sama dengan root', () => {
    const mismatched = Object.entries(server.dependencies ?? {})
      .filter(([name, range]) => root.dependencies?.[name] !== range)
      .map(([name, range]) => `${name}: server ${range}, root ${root.dependencies?.[name] ?? 'tidak ada'}`)

    expect(mismatched).toEqual([])
  })
})
