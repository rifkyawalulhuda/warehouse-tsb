import { createFileRoute, Outlet } from '@tanstack/react-router'
import { RequireAuth } from '@/components/require-auth'

/**
 * Layout tanpa isi: halaman staf dan halaman customer berbagi prefiks
 * `/reports`, tetapi masing-masing dijaga sendiri oleh `RequireAuth` di rute
 * anaknya. Tanpa layout ini, rute `/reports/customer` tidak punya tempat
 * merender.
 */
export const Route = createFileRoute('/_authenticated/reports')({
  component: () => (
    <RequireAuth>
      <Outlet />
    </RequireAuth>
  ),
})
