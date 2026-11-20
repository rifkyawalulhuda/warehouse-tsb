import type { MessageKey } from '../id'

export const approvals: Record<
  Extract<MessageKey, `approvals.${string}` | `approvalMsg.${string}`>,
  string
> = {
  'approvals.note':
    'Bookings waiting for an Admin decision. The slot stays held until the deadline.',
  'approvals.loading': 'Loading approval queue…',
  'approvals.cardTitle': 'Awaiting approval',
  'approvals.approvedToast': 'Booking {code} approved',
  'approvals.batchApproved': '{count} bookings approved',
  'approvals.batchApprovedSkipped':
    '{approved} approved, {skipped} skipped (already decided)',
  'approvals.searchPlaceholder': 'Search code or customer',
  'approvals.empty': 'No bookings are waiting for approval.',
  'approvals.approveSelected': 'Approve {count} selected',
  'approvals.selectAll': 'Select all',
  'approvals.selectRow': 'Select {code}',

  'approvals.col.select': 'Select',
  'approvals.col.code': 'Code',
  'approvals.col.customer': 'Customer',
  'approvals.col.schedule': 'Schedule',
  'approvals.col.deadline': 'Deadline',
  'approvals.col.status': 'Status',
  'approvals.col.actions': 'Actions',

  'approvals.reject': 'Reject',
  'approvals.approve': 'Approve',
  'approvals.copyMessage': 'Copy WhatsApp message',
  'approvals.copied': 'Message copied to clipboard',
  'approvals.copyDenied': 'The browser denied clipboard access',
  'approvals.vehicleIncomplete': 'Vehicle details incomplete',
  'approvals.urgent': 'URGENT',
  'approvals.deadlineOverdue': 'Deadline passed',
  'approvals.deadlineMinutes': '{count} minutes left',
  'approvals.deadlineHours': '{count} hours left',
  'approvals.deadlineDays': '{count} days left',

  'approvals.rejectTitle': 'Reject booking {code}?',
  'approvals.rejectDesc':
    'The booking is cancelled, the quota is released, and the customer sees this reason.',
  'approvals.rejectReason': 'Rejection reason',
  'approvals.rejectReasonPlaceholder':
    'Example: the delivery order does not match the goods shipped',
  'approvals.rejectReasonHint':
    'At least 5 characters. The reason appears on the customer page and the driver ticket.',
  'approvals.rejectConfirm': 'Reject booking',
  'approvals.rejectedToast': 'Booking rejected and quota released',

  'approvalMsg.pendingBody':
    'Booking {code} ({when}) is still AWAITING APPROVAL from the warehouse admin.',
  'approvalMsg.docLine': 'Document: {doc}.',
  'approvalMsg.qrPending': 'The QR code only becomes active once approved.',
  'approvalMsg.approvedBody': 'Booking {code} ({when}) has been APPROVED.',
  'approvalMsg.qrActive':
    'The QR code is now active — show it at the warehouse gate.',
  'approvalMsg.rejectedBody': 'Booking {code} ({when}) was REJECTED.',
  'approvalMsg.reasonLine': 'Reason: {reason}.',
  'approvalMsg.createNew': 'Please create a new booking.',
  'approvalMsg.expiredBody':
    'Booking {code} ({when}) EXPIRED because it was not decided before the deadline.',
  'approvalMsg.at': 'at',
}
