/**
 * Membuktikan realtime bekerja pada server yang sedang berjalan.
 *
 *   node scripts/verify-realtime.cjs [base-url]
 *
 * Skenario: satu petugas (cookie sesi) dan satu tamu anonim menyambung ke
 * Socket.io. Lalu satu booking diubah statusnya lewat API. Petugas harus
 * menerima booking.updated; tamu hanya boleh menerima ping kosong.
 */
const { io } = require('socket.io-client')

const BASE = process.argv[2] ?? 'http://localhost:4000'
const PASSWORD = 'Rahasia123'

async function login(email) {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: PASSWORD }),
  })
  if (!res.ok) throw new Error(`login ${email} gagal ${res.status}`)
  return res.headers
    .getSetCookie()
    .map((c) => c.split(';')[0])
    .join('; ')
}

function connect(options) {
  const socket = io(BASE, { transports: ['websocket'], forceNew: true, ...options })
  return new Promise((resolve, reject) => {
    socket.on('connect', () => resolve(socket))
    socket.on('connect_error', reject)
    setTimeout(() => reject(new Error('connect timeout')), 5000)
  })
}

async function main() {
  const checker = await login('checker@tsb.test')

  const events = { staff: [], guest: [] }
  const sockets = []
  for (const [name, options] of [
    ['staff', { extraHeaders: { cookie: checker } }],
    ['guest', {}],
  ]) {
    const socket = await connect(options)
    sockets.push(socket)
    for (const ev of ['booking.updated', 'dock.updated', 'queue.updated']) {
      socket.on(ev, (payload) => events[name].push({ ev, payload }))
    }
  }
  console.log('terhubung: petugas + tamu')

  // Cari booking yang bisa diproses: yang sedang IN_PROGRESS, atau mulai dulu.
  const docksRes = await fetch(`${BASE}/api/ops/docks`, { headers: { cookie: checker } })
  const docks = (await docksRes.json()).data
  const occupied = docks.find((d) => d.currentBooking)
  if (!occupied) throw new Error('tidak ada truk di dock; jalankan seed ulang')

  let target = occupied.currentBooking
  if (target.status === 'DOCK_ASSIGNED') {
    const started = await fetch(`${BASE}/api/ops/start-process`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', cookie: checker },
      body: JSON.stringify({ bookingId: target.id }),
    })
    if (!started.ok) throw new Error(`start-process ${started.status}: ${await started.text()}`)
  }

  console.log('target:', target.bookingCode, 'di dock', occupied.dockCode)

  const done = await fetch(`${BASE}/api/ops/finish-process`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', cookie: checker },
    body: JSON.stringify({ bookingId: target.id }),
  })
  console.log('finish-process:', done.status)

  await new Promise((r) => setTimeout(r, 2500))
  sockets.forEach((s) => s.close())

  const staffGot = events.staff.filter((e) => e.ev === 'booking.updated')
  const guestGot = events.guest.filter((e) => e.ev === 'booking.updated')

  console.log('event petugas:', events.staff.map((e) => e.ev).join(', ') || '(tidak ada)')
  console.log('event tamu   :', events.guest.map((e) => e.ev).join(', ') || '(tidak ada)')

  const pass = staffGot.length > 0 && guestGot.length === 0
  console.log(pass ? 'LULUS: petugas menerima update, tamu tidak' : 'GAGAL')
  process.exit(pass ? 0 : 1)
}

main().catch((error) => {
  console.error('ERROR', error.message)
  process.exit(1)
})
