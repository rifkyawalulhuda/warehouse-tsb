import { createContext, useContext, useEffect, useState } from 'react'

/**
 * Judul halaman yang sedang tampil, dipakai bilah atas mobile.
 *
 * Sumbernya halaman itu sendiri (lewat `PageHeader`), bukan daftar judul per
 * rute yang terpisah: dua daftar seperti itu pasti melenceng begitu salah
 * satunya diubah, dan yang salah akan langsung terlihat di layar.
 */
type PageTitleContextType = {
  title: string
  setTitle: React.Dispatch<React.SetStateAction<string>>
}

const PageTitleContext = createContext<PageTitleContextType | null>(null)

export function PageTitleProvider({ children }: { children: React.ReactNode }) {
  const [title, setTitle] = useState('')

  return (
    <PageTitleContext value={{ title, setTitle }}>{children}</PageTitleContext>
  )
}

/**
 * Dipanggil halaman untuk mendaftarkan judulnya. Cleanup mengosongkannya saat
 * halaman ditinggalkan, supaya halaman berikutnya tidak sempat menampilkan
 * judul halaman sebelumnya.
 *
 * Sengaja tidak melempar error di luar provider: komponen halaman harus tetap
 * bisa dirender sendiri, hanya tanpa bilah atas yang ikut terisi.
 */
// eslint-disable-next-line react-refresh/only-export-components
export const useSetPageTitle = (title: string) => {
  const setTitle = useContext(PageTitleContext)?.setTitle

  useEffect(() => {
    if (!setTitle) return
    setTitle(title)
    return () => setTitle('')
  }, [setTitle, title])
}

// eslint-disable-next-line react-refresh/only-export-components
export const usePageTitle = () => {
  return useContext(PageTitleContext)?.title ?? ''
}
