import { describe, expect, it } from 'vitest'
import {
  defaultDockView,
  dockViewStorageKey,
  isDockView,
  readDockView,
  writeDockView,
} from './dock-view'

function memoryStorage(initial: Record<string, string> = {}) {
  const map = new Map(Object.entries(initial))
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => {
      map.set(key, value)
    },
    dump: () => Object.fromEntries(map),
  }
}

describe('dock view preference', () => {
  it('falls back to cards when nothing is stored', () => {
    expect(readDockView('user-1', memoryStorage())).toBe(defaultDockView)
  })

  it('reads back what was written for the same user', () => {
    const storage = memoryStorage()
    writeDockView('user-1', 'table', storage)

    expect(readDockView('user-1', storage)).toBe('table')
  })

  it('keeps each user preference separate', () => {
    const storage = memoryStorage()
    writeDockView('user-1', 'grid', storage)

    expect(readDockView('user-2', storage)).toBe(defaultDockView)
    expect(storage.dump()).toEqual({ [dockViewStorageKey('user-1')]: 'grid' })
  })

  it('ignores an unknown stored value', () => {
    const storage = memoryStorage({ [dockViewStorageKey('user-1')]: 'kartu' })

    expect(readDockView('user-1', storage)).toBe(defaultDockView)
  })

  it('does not touch storage without a signed-in user', () => {
    const storage = memoryStorage()
    writeDockView('', 'table', storage)

    expect(storage.dump()).toEqual({})
    expect(readDockView('', storage)).toBe(defaultDockView)
  })

  it('survives storage that throws, as in private mode', () => {
    const broken = {
      getItem: () => {
        throw new Error('denied')
      },
      setItem: () => {
        throw new Error('denied')
      },
    }

    expect(readDockView('user-1', broken)).toBe(defaultDockView)
    expect(() => writeDockView('user-1', 'table', broken)).not.toThrow()
  })

  it('accepts only the three known views', () => {
    expect(isDockView('cards')).toBe(true)
    expect(isDockView('table')).toBe(true)
    expect(isDockView('grid')).toBe(true)
    expect(isDockView('list')).toBe(false)
    expect(isDockView(null)).toBe(false)
  })
})
