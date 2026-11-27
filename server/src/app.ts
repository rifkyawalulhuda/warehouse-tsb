import express from 'express'
import cookieParser from 'cookie-parser'
import cors from 'cors'
import helmet from 'helmet'
import { env } from './config/env'
import { authRouter } from './modules/auth/routes'
import { accountRouter } from './modules/account/routes'
import { usersRouter } from './modules/users/routes'
import { settingsRouter } from './modules/settings/routes'
import { brandingRouter } from './modules/settings/branding'
import { uploadsRouter, uploadsDir, UPLOAD_PATH } from './modules/settings/uploads'
import { masterRouter } from './modules/master/routes'
import { bookingsRouter } from './modules/bookings/routes'
import { approvalsRouter } from './modules/approvals/routes'
import { customersRouter } from './modules/customers/routes'
import { publicTicketRouter } from './modules/public-ticket/routes'
import { opsRouter } from './modules/ops/routes'
import { reportsRouter } from './modules/reports/routes'
import { errorHandler, notFoundHandler } from './middleware/error'
import { apiLimiter, floodLimiter } from './middleware/rate-limit'

export function createApp() {
  const app = express()

  app.set('trust proxy', 1)
  app.use(helmet({ crossOriginResourcePolicy: false }))
  app.use(
    cors({
      origin: env.appOrigin,
      credentials: true,
    })
  )
  app.use(cookieParser())

  // Pembatas dipasang SEBELUM parser badan. Kalau tidak, permintaan yang akan
  // ditolak batas tetap lebih dulu mengisi buffer badan (JSON 1 MB, gambar 3 MB)
  // sehingga membanjiri server dengan permintaan yang seharusnya murah menjadi
  // cara murah menghabiskan memori proses. `cookieParser` di atasnya karena
  // kunci pembatas per sesi membaca cookie.
  app.use('/api', floodLimiter)
  app.use('/api', apiLimiter)

  // Parser biner untuk unggahan gambar dipasang di `uploadsRouter`, setelah
  // `requireAuth`: permintaan tanpa sesi ditolak sebelum satu byte pun dibaca.
  app.use(express.json({ limit: '1mb' }))

  app.get('/api/health', (_req, res) => {
    res.json({
      data: { status: 'ok', env: env.nodeEnv, time: new Date().toISOString() },
    })
  })

  app.use('/api/auth', authRouter)
  app.use('/api/account', accountRouter)
  app.use('/api/users', usersRouter)
  app.use('/api/settings', settingsRouter)
  app.use('/api/branding', brandingRouter)
  app.use(UPLOAD_PATH, uploadsRouter)
  // Berkasnya publik karena dipakai halaman masuk sebelum ada sesi; namanya
  // acak sehingga tidak bisa ditebak, dan tidak ada data operasional di sini.
  app.use(UPLOAD_PATH, express.static(uploadsDir(), { maxAge: '7d', index: false }))
  app.use('/api/master', masterRouter)
  app.use('/api/bookings', bookingsRouter)
  app.use('/api/approvals', approvalsRouter)
  app.use('/api/customers', customersRouter)
  app.use('/api/tickets', publicTicketRouter)
  app.use('/api/ops', opsRouter)
  app.use('/api/reports', reportsRouter)

  app.use(notFoundHandler)
  app.use(errorHandler)

  return app
}
