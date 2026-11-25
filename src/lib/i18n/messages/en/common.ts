import type { common as idCommon } from '../id/common'

export const common: Record<keyof typeof idCommon, string> = {
  'common.save': 'Save',
  'common.saving': 'Saving…',
  'common.cancel': 'Cancel',
  'common.close': 'Close',
  'common.delete': 'Delete',
  'common.edit': 'Edit',
  'common.back': 'Back',
  'common.retry': 'Try again',
  'common.loading': 'Loading…',
  'common.search': 'Search',
  'common.all': 'All',
  'common.yes': 'Yes',
  'common.no': 'No',
  'common.optional': 'optional',
  'common.required': 'required',
  'common.unknownError': 'Something went wrong',
  'common.pendingApproval': 'awaiting approval',
  'common.pendingApprovalTooltip': '{count} awaiting approval',

  'locale.label': 'Language',
  'locale.description':
    'Applies to this device only. Your phone and computer can use different languages.',
  'locale.switch': 'Change language',
  'locale.id': 'Bahasa Indonesia',
  'locale.en': 'English',

  'error.UNAUTHORIZED': 'Your session is invalid or has expired',
  'error.FORBIDDEN': "You don't have access to this action",
  'error.NOT_FOUND': 'Data not found',
  'error.DUPLICATE': 'A similar record already exists',
  'error.VALIDATION_ERROR': 'Some fields are not valid',
  'error.INVALID_PARAM': 'Invalid parameter',
  'error.INVALID_ID': 'Invalid ID',
  'error.INVALID_QR': 'QR code not recognised',
  'error.QR_NOT_FOUND':
    'QR code not recognised. Make sure it is a ticket QR, not another code.',
  'error.BOOKING_NOT_FOUND':
    'That booking code does not exist. Check the number and the date again.',
  'error.DATE_IN_PAST': 'That date has already passed',
  'error.SLOT_IN_PAST': 'That time has already passed',
  'error.EMAIL_TAKEN': 'This email is already used by another account',
  'error.NO_CHANGES': 'Nothing changed',
  'error.CUSTOMER_INACTIVE': 'This customer account is inactive.',
  'error.UPLOAD_EMPTY': 'The image file is empty.',
  'error.UPLOAD_TOO_LARGE': 'Image must be 2 MB or smaller.',
  'error.UPLOAD_TYPE': 'Image must be PNG or JPG.',
  'error.INVALID_CREDENTIALS':
    'Email or password does not match. Check it again, or ask the warehouse Admin if you are sure this account is registered.',
  'error.TOO_MANY_REQUESTS': 'Too many requests. Wait a moment, then try again.',
  'error.NETWORK': "Can't reach the server. Check your connection.",
  'error.APPROVAL_ALREADY_DECIDED':
    'This booking has already been decided or has expired.',
  'error.APPROVAL_NOT_APPLICABLE':
    'This booking was cancelled or processed, so it cannot be approved.',
  'error.APPROVAL_PENDING':
    'The booking is not approved by an Admin yet, so it cannot be processed.',
  'error.CANCEL_NOT_ALLOWED':
    'The booking cannot be cancelled because the truck already checked in.',
  'error.CANNOT_DEACTIVATE_SELF': 'You cannot deactivate your own account.',
  'error.CANNOT_DEMOTE_SELF': 'You cannot lower the role of your own account.',
  'error.CUSTOMER_NAME_TAKEN': 'That customer name is already used.',
  'error.CUSTOMER_VIA_MASTER':
    'Customer accounts are created from Customer master data, not from the Users page.',
  'error.CUSTOMER_REQUIRED':
    'This account is not linked to a customer yet. Contact the warehouse Admin.',
  'error.DOCK_CODE_TAKEN': 'That dock code is already used.',
  'error.FLAG_NOT_APPLICABLE':
    'Admins can always approve, so this flag is not needed.',
  'error.INVALID_TRANSITION':
    'The booking status already changed. Reload and try again.',
  'error.INVALID_WINDOW':
    'The opening and closing times do not make sense. Please check them.',
  'error.LAST_ADMIN':
    'At least one active Admin is required. Promote another Admin first.',
  'error.NO_DOCK':
    'No active dock for this activity yet. Contact the warehouse Admin.',
  'error.QUOTA_FULL':
    'The quota for that hour was just taken. Please pick another time.',
  'error.SLOT_UNAVAILABLE':
    'That time is not available yet. Reload the page and try again.',
  'error.VEHICLE_INCOMPLETE':
    'The plate number and driver name are incomplete. Ask the customer or driver to fill them in.',
  'error.VEHICLE_LOCKED':
    'Vehicle details cannot be changed because the truck already checked in.',
  'error.WAREHOUSE_NAME_TAKEN': 'That warehouse name is already used.',
  'error.TOO_MANY_ATTEMPTS': 'Too many sign-in attempts. Wait 15 minutes, then try again.',
  'error.TOO_EARLY': 'Too early for this action.',
  'error.ALREADY_CHECKED_OUT': 'This truck is already checked out.',
  'error.WRONG_STATUS': 'The booking status does not allow this action.',
  'error.DOCK_OCCUPIED': 'That dock is busy.',
  'error.DOCK_MAINTENANCE': 'That dock is under maintenance.',
  'error.DOCK_ACTIVITY_MISMATCH':
    'The booking activity does not match the selected dock.',
  'error.SLOT_OVERFLOW':
    'The truck duration runs past closing time. Pick another time.',
  'error.SLOT_NOT_ALIGNED': 'The start time must be a multiple of the block unit.',
  'error.SLOT_BEFORE_OPENING': 'The start time is before the warehouse opens.',
  'error.SLOT_AFTER_CLOSING': 'The end time runs past closing time.',
  'error.DATE_TOO_FAR': 'That date is beyond the booking window.',
  'error.EARLY_ARRIVAL': 'The truck arrived too early for this slot.',
  'error.CUSTOMER_IN_USE':
    'This customer still has related data, so it cannot be deleted.',
  'error.WAREHOUSE_IN_USE':
    'This warehouse still has related data, so it cannot be deleted.',
  'error.APPROVAL_MODE_CHANGED':
    'The approval mode just changed. Reload the page.',
  'error.USER_ACCESS_CHANGED':
    "This account's access just changed. Reload the page.",
  'error.PAYLOAD_TOO_LARGE': 'The data sent is too large.',
  'error.INVALID_REQUEST': 'Invalid request.',
  'error.INTERNAL_ERROR': 'The server ran into a problem. Try again later.',

  'nav.openMenu': 'Open navigation menu',
  'nav.toggleSidebar': 'Toggle sidebar',
  'nav.toggleNavigation': 'Toggle navigation menu',
  'nav.openMenuPending': 'Open navigation menu, {count} awaiting approval',
  'nav.back': 'Back to previous page',
  'nav.searchTitle': 'Command palette',
  'nav.searchDescription': 'Search for a command to run...',

  'status.BOOKED_INCOMPLETE': 'Awaiting vehicle data',
  'status.BOOKED_READY': 'Ready to enter',
  'status.CHECKED_IN_ON_TIME': 'Checked in on time',
  'status.LATE_WAITING_LIST': 'Late queue',
  'status.DOCK_ASSIGNED': 'Dock assigned',
  'status.IN_PROGRESS': 'In progress',
  'status.COMPLETED': 'Loading/unloading done',
  'status.CHECKED_OUT': 'Already left',
  'status.CANCELLED': 'Cancelled',
  'status.NO_SHOW': 'Did not show',

  'approval.PENDING': 'Waiting for approval',
  'approval.APPROVED': 'Approved',
  'approval.REJECTED': 'Rejected',
  'approval.EXPIRED': 'Expired',

  'role.ADMIN': 'Warehouse admin',
  'role.CUSTOMER': 'Customer',
  'role.GATE_OFFICER': 'Gate officer',
  'role.CHECKER': 'Dock checker',

  'activity.LOADING': 'Loading',
  'activity.UNLOADING': 'Unloading',
  'activity.BOTH': 'Loading & Unloading',

  'duration.minutes': '{count} min',
  'duration.minutesShort': 'min',
  'duration.hours': '{count} h',
  'duration.hoursMinutes': '{hours} h {minutes} min',

  'common.loadingData': 'Loading data...',
  'common.learnMore': 'Learn more',
  'common.noResults': 'No results found.',
  'password.show': 'Show password',
  'password.hide': 'Hide password',
  'password.capsLock': 'Caps Lock is on — the password will be in capitals.',
  'comingSoon.title': 'Coming soon!',
  'comingSoon.body':
    'This page has not been created yet. Stay tuned though!',
  'team.label': 'Teams',
  'team.add': 'Add team',

  'nav.accountSettings': 'Account settings',
  'nav.signOut': 'Sign out',
  'nav.defaultUser': 'User',
  'nav.booking': 'Booking',
  'nav.myBookings': 'My Schedule',
  'nav.newBooking': 'New Booking',
  'nav.reports': 'Reports',
  'nav.gate': 'Gate',
  'nav.scanGate': 'Gate Scan',
  'nav.gateHistory': 'Gate History',
  'nav.operations': 'Operations',
  'nav.checkerScan': 'Checker Scan',
  'nav.todayQueue': "Today's Queue",
  'nav.dockBoard': 'Dock Board',
  'nav.other': 'Other',
  'nav.dashboard': 'Dashboard',
  'nav.management': 'Management',
  'nav.masterData': 'Master Data',
  'nav.settings': 'Settings',

  'theme.label': 'Appearance',
  'theme.current': 'Theme: {theme}',
  'theme.appearance': 'Appearance',
  'theme.light': 'Light',
  'theme.dark': 'Dark',
  'theme.system': 'Follow system',
  'theme.switchLabel': 'Change theme',

  'common.columns': 'Columns',
  'common.showColumns': 'Show columns',

  'command.placeholder': 'Search menus or commands...',
  'command.empty': 'No results.',

  'table.empty': 'No data.',
  'table.rowsPerPage': 'Rows per page',
  'table.pageFirst': 'First page',
  'table.pagePrevious': 'Previous page',
  'table.pageNext': 'Next page',
  'table.pageLast': 'Last page',
  'table.page': 'Page {page}',
  'table.sort': 'Sort {column}',
  'table.sortAria': 'Sort {column}, {dir}; press to change direction',
  'table.sortAsc': 'ascending',
  'table.sortDesc': 'descending',
  'table.sortNone': 'not sorted',
  'table.selected': 'selected',
  'table.selectedCount': '{count} selected',
  'table.bulkAnnounce': '{count} {entity} selected. Bulk action bar available.',
  'table.bulkAria': 'Bulk actions for {count} selected {entity}',
  'table.clearSelection': 'Clear selection',
  'table.clearSelectionHint': 'Clear selection (Escape)',
  'table.entityRows': 'rows',

  'picker.selectDate': 'Pick a date',
  'picker.previousMonth': 'Previous month',
  'picker.nextMonth': 'Next month',
  'picker.selectMonth': 'Pick a month',
  'picker.selectYear': 'Pick a year',
  'picker.today': 'Today, {date}',
  'picker.selectDock': 'Pick a dock',
  'picker.searchDock': 'Search dock, area, or warehouse…',
  'picker.noDock': 'No matching dock.',
  'picker.dockLabel': '{label}: {dock}',

  'signOut.title': 'Sign out',
  'signOut.body': 'You need to sign in again to continue. Sign out anyway?',
  'signOut.warning': 'The local session was cleared, but the server did not respond.',

  'errors.unauthorized': 'Not Authenticated',
  'errors.forbidden': 'Access Denied',
  'errors.notFound': 'Page Not Found',
  'errors.notFoundTitle': 'Page Not Found',
  'errors.notFoundBody':
    'The page you are looking for does not exist or may have been removed.',
  'errors.forbiddenBody':
    'You do not have the necessary permission to open this page.',
  'errors.unauthorizedBody':
    'Please sign in with the appropriate account to open this page.',
  'errors.maintenanceBody':
    'The site is not available right now. We will be back shortly.',
  'errors.general': 'Something Went Wrong',
  'errors.generalTitle': 'Something went wrong',
  'errors.generalBody': 'We apologise for the inconvenience. Please try again later.',
  'errors.goBack': 'Go Back',
  'errors.backHome': 'Back to Home',
  'errors.maintenance': 'Under Maintenance',

  'footer.company':
    'TSB · Warehouse Time Slot Booking — PT Sankyu Indonesia',
  'footer.location': 'Cikarang Warehouse · Shift 1',
}
