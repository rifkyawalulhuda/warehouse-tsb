import { chromium } from 'playwright'

const browser = await chromium.launch({ channel: 'chrome' })
const page = await browser.newPage()
await page.goto('http://localhost:5173/sign-in', { waitUntil: 'networkidle' })
await page.fill('input[type=email]', 'admin@tsb.test')
await page.fill('input[type=password]', 'Rahasia123')
await page.getByRole('button', { name: 'Masuk' }).click()
await page.waitForTimeout(2500)

const body = await page.evaluate(async () => {
  const res = await fetch('/api/ops/activity?limit=14', {
    credentials: 'include',
  })
  return { status: res.status, text: (await res.text()).slice(0, 1500) }
})
console.log(JSON.stringify(body, null, 2))
await browser.close()
