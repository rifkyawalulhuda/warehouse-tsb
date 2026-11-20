import type { MessageKey } from '../id'

export const users: Record<Extract<MessageKey, `users.${string}`>, string> = {
  'users.title': 'User Management',
  'users.description':
    'Admin, Security, and Checker accounts. Customer accounts are managed in Customer Master Data.',
  'users.openMasterData': 'Customer Master Data',
  'users.create': 'Add user',
  'users.listTitle': 'Staff accounts',
  'users.count': '{count} accounts registered.',
  'users.loading': 'Loading users…',
  'users.searchPlaceholder': 'Search name or email',
  'users.allRoles': 'All roles',
  'users.empty': 'No staff accounts yet. Add a user to get started.',
  'users.you': 'You',
  'users.notFilled': 'Not filled',
  'users.auto': 'Automatic',
  'users.approveTitle': 'Allow this user to approve bookings',
  'users.deactivateSelf': 'You cannot deactivate your own account',
  'users.editBlocked': 'Customer accounts are edited in Customer Master Data',
  'users.edit': 'Edit user details',
  'users.action': 'Edit',

  'users.col.name': 'Name',
  'users.col.email': 'Email',
  'users.col.phone': 'Phone',
  'users.col.role': 'Role',
  'users.col.approve': 'Can approve',
  'users.col.created': 'Created',
  'users.col.actions': 'Actions',
  'users.col.active': 'Active',

  'users.createTitle': 'Add user',
  'users.createDesc':
    'Warehouse staff account. For Customer accounts, open the Customer tab.',
  'users.label.name': 'Name',
  'users.label.email': 'Email',
  'users.label.phone': 'Phone',
  'users.label.role': 'Role',
  'users.label.initialPassword': 'Initial password',
  'users.label.newPassword': 'New password (optional)',
  'users.passwordPlaceholder': 'At least 7 characters',
  'users.passwordKeepPlaceholder': 'Leave blank to keep the current one',
  'users.passwordTooShort': 'At least 7 characters.',
  'users.created': 'Account {email} created',

  'users.editTitle': 'Edit user',
  'users.editDesc':
    'Update the account details for {email}{self}. Leave the password blank to keep it unchanged.',
  'users.editDescSelf': ' (your own account)',
  'users.emailIsLogin': 'Email is the login identity.',
  'users.roleSelfLocked': 'You cannot change your own role.',
  'users.roleLastAdminLocked':
    'This is the only active Admin; the role cannot be downgraded.',
  'users.activeLabel': 'Active',
  'users.activeOn': 'This account can sign in and use the app.',
  'users.activeOff': 'This account cannot sign in.',
  'users.saved': 'User details updated',
} as const
