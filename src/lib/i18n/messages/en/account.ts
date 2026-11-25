import type { MessageKey } from '../id'

export const account: Record<Extract<MessageKey, `account.${string}`>, string> = {
  'account.title': 'Account Settings',
  'account.description': 'Manage your profile, email, and password.',
  'account.role': 'Role',
  'account.company': 'Company',
  'account.memberSince': 'Member since',

  'account.profile.title': 'Profile',
  'account.profile.description':
    'The name and phone number your colleagues use to recognise you. Email and role live in their own sections.',
  'account.profile.name': 'Full name',
  'account.profile.nameHint': 'At least 2 characters.',
  'account.profile.phone': 'Phone number',
  'account.profile.phoneHint':
    'Optional. Used by the Admin to reach you about scheduling.',
  'account.profile.saved': 'Profile updated.',

  'account.email.title': 'Email',
  'account.email.description':
    'This email is your sign-in identity. Once changed, other devices still signed in to this account are signed out.',
  'account.email.current': 'Current email',
  'account.email.new': 'New email',
  'account.email.repeat': 'Repeat new email',
  'account.email.password': 'Current password',
  'account.email.passwordHint':
    'Required so that whoever finds your device cannot change the email.',
  'account.email.saved': 'Email updated. Other devices were signed out.',
  'account.email.invalid': 'That email address is not valid.',
  'account.email.same': 'The new email is the same as the current one.',
  'account.email.mismatch': 'The two email addresses do not match.',
  'account.email.passwordMissing': 'Enter your current password.',

  'account.password.title': 'Password',
  'account.password.description':
    'At least 7 characters. After changing it, other devices are signed out and must sign in again; this device stays signed in.',
  'account.password.current': 'Current password',
  'account.password.new': 'New password',
  'account.password.repeat': 'Repeat new password',
  'account.password.savedNone': 'Password updated.',
  'account.password.savedRevoked':
    'Password updated. {count} other devices were signed out.',
  'account.password.currentMissing': 'Enter your current password.',
  'account.password.tooShort': 'The new password must be at least 7 characters.',
  'account.password.same': 'The new password is the same as the current one.',
  'account.password.mismatch': 'The two new passwords do not match.',

  'account.sessions.title': 'Devices & sessions',
  'account.sessions.description':
    'How many devices are still signed in to this account. If you see a device you do not recognise, sign them all out and then change your password.',
  'account.sessions.count': '{count} devices are signed in',
  'account.sessions.countOne': '1 device is signed in',
  'account.sessions.onlyThis': 'Just this device.',
  'account.sessions.revoke': 'Sign out other devices',
  'account.sessions.revokeHint':
    'This device stays signed in. The rest must sign in again with their password.',
  'account.sessions.confirmTitle': 'Sign out other devices?',
  'account.sessions.confirmBody':
    'Every session except this device will end. This device stays signed in.',
  'account.sessions.confirm': 'Yes, sign them out',
  'account.sessions.cancel': 'Cancel',
  'account.sessions.revoked': '{count} devices signed out.',
  'account.sessions.revokedNone': 'No other devices are signed in.',

  'account.help.title': 'Need help?',
  'account.help.body':
    'An account cannot be deleted from here. Contact the warehouse Admin if you need to deactivate it or restore access.',
  'account.help.warehouseSettings': 'Open Warehouse Settings',
}