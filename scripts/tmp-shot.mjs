import { chromium } from 'playwright'

const browser = await chromium.launch({ channel: 'chrome' })
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1.5 })
await page.goto('http://localhost:5173/sign-in', { waitUntil: 'networkidle' })
await page.fill('input[type=email]', 'admin@tsb.test')
await page.fill('input[type=password]', 'Rahasia123')
await page.getByRole('button', { name: 'Masuk' }).click()
await page.waitForTimeout(2500)
await page.evaluate(() => {
  localStorage.setItem('vite-ui-theme', 'dark')
  document.cookie = 'vite-ui-theme=dark; path=/'
})
await page.goto('http://localhost:5173/settings', { waitUntil: 'networkidle' })
await page.waitForTimeout(1200)
await page.screenshot({ path: 'tmp-dark-2.png' })
await browser.close()
