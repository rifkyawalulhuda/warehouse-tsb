import { useEffect, useState } from 'react'

/**
 * Menunda nilai sampai ketikan berhenti.
 *
 * Dipakai untuk kotak pencarian supaya setiap huruf tidak langsung menjadi satu
 * permintaan ke server: mengetik plat nomor "B 1234 TSB" akan mengirim 10
 * kueri bila tanpa jeda.
 */
export function useDebouncedValue<T>(value: T, delayMs = 350): T {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs)
    return () => clearTimeout(timer)
  }, [value, delayMs])

  return debounced
}
