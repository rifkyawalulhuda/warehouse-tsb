import type { auth as idAuth } from '../id/auth'

export const auth: Record<keyof typeof idAuth, string> = {
  'auth.title': 'Sign in',
  'auth.subtitle': 'Use the email and password given by the warehouse admin.',
  'auth.noAccount': "No account yet? Ask the warehouse admin to register you.",
  'auth.email': 'Email',
  'auth.password': 'Password',
  'auth.emailPlaceholder': 'name@company.com',
  'auth.emailInvalid': 'Enter a valid email address.',
  'auth.passwordRequired': 'Enter your password.',
  'auth.submit': 'Sign in',
  'auth.submitting': 'Checking…',
  'auth.welcome': 'Welcome, {name}',
  'auth.defaultLoginDescription':
    'Manage unloading schedules, dock queues, and driver tickets in one place.',
}
