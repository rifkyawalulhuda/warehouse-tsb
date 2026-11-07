import { createFileRoute } from '@tanstack/react-router'
import { TicketPage } from '@/features/ticket'

/** Halaman publik untuk supir — tidak butuh sesi. */
export const Route = createFileRoute('/t/$token')({
  component: TicketPage,
})
