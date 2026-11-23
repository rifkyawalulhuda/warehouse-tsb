import { useForm } from 'react-hook-form'
import { describe, expect, it } from 'vitest'
import { render } from 'vitest-browser-react'
import { userEvent } from 'vitest/browser'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
} from '@/components/ui/form'
import { PasswordInput } from './password-input'

/**
 * Menekan satu tombol pada elemen. Event dipakai langsung karena Caps Lock
 * tidak bisa dinyalakan pada papan ketik sungguhan di dalam test; yang diuji
 * di sini adalah bacaan hook atas event yang bentuknya sama dengan event asli
 * (huruf besar tanpa Shift, atau tombol Caps Lock ditekan lalu dilepas).
 */
function press(
  element: Element,
  init: KeyboardEventInit,
  type: 'keydown' | 'keyup' = 'keydown'
) {
  element.dispatchEvent(new KeyboardEvent(type, { bubbles: true, ...init }))
}

function pressCapsLock(element: Element) {
  press(element, { key: 'CapsLock' })
  press(element, { key: 'CapsLock' }, 'keyup')
}

describe('PasswordInput', () => {
  it('renders the password input correctly', async () => {
    const { getByPlaceholder, getByRole } = await render(
      <PasswordInput placeholder='password' />
    )

    const passwordInput = getByPlaceholder('password')
    const showPasswordButton = getByRole('button', {
      name: /Tampilkan password/i,
    })

    await expect.element(passwordInput).toBeInTheDocument()
    await expect.element(passwordInput).toHaveAttribute('type', 'password')
    await expect.element(showPasswordButton).toBeVisible()
  })

  it('toggles the password visibility when the Tampilkan password button is clicked', async () => {
    const { getByPlaceholder, getByRole } = await render(
      <PasswordInput placeholder='password' />
    )

    const passwordInput = getByPlaceholder('password')
    const showPasswordButton = getByRole('button', {
      name: /Tampilkan password/i,
    })

    await expect.element(passwordInput).toHaveAttribute('type', 'password')
    await expect.element(showPasswordButton).toBeInTheDocument()

    await userEvent.click(showPasswordButton)

    await expect.element(passwordInput).toHaveAttribute('type', 'text')
    const hidePasswordButton = getByRole('button', {
      name: /Sembunyikan password/i,
    })
    await expect.element(hidePasswordButton).toBeInTheDocument()

    await userEvent.click(hidePasswordButton)

    await expect.element(passwordInput).toHaveAttribute('type', 'password')
    await expect
      .element(getByRole('button', { name: /Tampilkan password/i }))
      .toBeInTheDocument()
  })

  it('disables the Tampilkan password button when the password input is disabled', async () => {
    const { getByPlaceholder, getByRole } = await render(
      <PasswordInput placeholder='password' disabled />
    )

    const passwordInput = getByPlaceholder('password')
    const showPasswordButton = getByRole('button', {
      name: /Tampilkan password/i,
    })
    await expect.element(showPasswordButton).toBeDisabled()
    await expect.element(passwordInput).toBeDisabled()
  })

  it('works with FormLabel and react-hook-form field spread', async () => {
    function PasswordInLabeledForm() {
      const form = useForm<{ password: string }>({
        defaultValues: { password: '' },
      })

      return (
        <Form {...form}>
          <form>
            <FormField
              control={form.control}
              name='password'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Password</FormLabel>
                  <FormControl>
                    <PasswordInput {...field} />
                  </FormControl>
                </FormItem>
              )}
            />
          </form>
        </Form>
      )
    }

    const { getByLabelText } = await render(<PasswordInLabeledForm />)

    const password = getByLabelText(/^Password$/i)
    await expect.element(password).toHaveAttribute('type', 'password')

    await userEvent.type(password, 'secret-value')

    await expect.element(password).toHaveValue('secret-value')
  })

  it('memperingatkan Caps Lock saat huruf besar keluar tanpa Shift', async () => {
    const { getByPlaceholder, getByRole } = await render(
      <PasswordInput placeholder='password' />
    )

    const password = getByPlaceholder('password').element()
    press(password, { key: 'A' })

    await expect.element(getByRole('status')).toBeInTheDocument()
    await expect.element(getByRole('status')).toHaveTextContent(/Caps Lock/)

    // Huruf kecil tanpa Shift hanya mungkin keluar saat Caps Lock dimatikan.
    press(password, { key: 'a' })

    await expect.element(getByRole('status')).not.toBeInTheDocument()
  })

  it('memperingatkan Caps Lock saat tombolnya ditekan', async () => {
    const { getByPlaceholder, getByRole } = await render(
      <PasswordInput placeholder='password' />
    )

    const password = getByPlaceholder('password').element()
    pressCapsLock(password)

    await expect.element(getByRole('status')).toBeInTheDocument()

    pressCapsLock(password)

    await expect.element(getByRole('status')).not.toBeInTheDocument()
  })

  it('tidak memperingatkan saat huruf besar diketik dengan Shift', async () => {
    const { getByPlaceholder, getByRole } = await render(
      <PasswordInput placeholder='password' />
    )

    // Shift menghasilkan huruf besar walau Caps Lock mati.
    press(getByPlaceholder('password').element(), { key: 'A', shiftKey: true })

    await expect.element(getByRole('status')).not.toBeInTheDocument()
  })

  it('membaca getModifierState untuk tombol selain huruf', async () => {
    const { getByPlaceholder, getByRole } = await render(
      <PasswordInput placeholder='password' />
    )

    const event = new KeyboardEvent('keydown', { key: '1', bubbles: true })
    Object.defineProperty(event, 'getModifierState', {
      value: (key: string) => key === 'CapsLock',
    })
    getByPlaceholder('password').element().dispatchEvent(event)

    await expect.element(getByRole('status')).toBeInTheDocument()
  })
})
