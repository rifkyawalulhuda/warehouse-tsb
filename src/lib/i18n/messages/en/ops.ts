import type { MessageKey } from '../id'

export const ops: Record<Extract<MessageKey, `ops.${string}`>, string> = {
  'ops.scanTitle': 'Scan ticket',
  'ops.scanChecking': 'Checking ticket…',
  'ops.scanHint': 'Point the camera at the QR, or type the token / booking code.',
  'ops.scanAnother': 'Scan another ticket',
  'ops.scanCameraOn': 'Turn camera on',
  'ops.scanCameraOff': 'Turn camera off',
  'ops.scanCameraError': 'Cannot open the camera',
  'ops.scanCameraFallback': '{error}. Use the manual input below.',
  'ops.scanInputPlaceholder': 'QR token or booking code',
  'ops.scanCheck': 'Check',
  'ops.scanInvalid':
    'Code not recognised. Paste the QR token from the e-ticket (32 characters), or type a booking code such as TSB-20261111-003.',
  'ops.scanQrAlt': 'Ticket QR code',
  'ops.scanManualHint':
    'The ticket QR holds a random token. If the camera is unavailable, type that token or the booking code printed on the ticket (e.g. TSB-20261111-003).',

  'ops.field.activity': 'Activity',
  'ops.field.schedule': 'Schedule',
  'ops.field.plate': 'License plate',
  'ops.field.driver': 'Driver',
  'ops.field.dock': 'Dock',
  'ops.field.truckType': 'Truck type',
  'ops.field.document': 'Document',
  'ops.field.grace': 'Grace period',
  'ops.field.gateInAt': 'Gate-in',
  'ops.field.waitPosition': 'Waiting position',
  'ops.graceMinutes': '{count} minutes',
  'ops.waitPosition': '#{position} of the waiting trucks',
  'ops.notGatedIn': 'Not checked in',
  'ops.dockUnassigned': 'Not assigned',
  'ops.notFilled': 'Not filled in',

  'ops.gate.title': 'Gate',
  'ops.gate.description':
    'Scan the ticket QR or type the booking code to check in and check out.',
  'ops.gate.successIn': 'Gate-in recorded',
  'ops.gate.successOut': 'Gate-out recorded',
  'ops.gate.tooEarlyTitle': 'Arrived too early',
  'ops.gate.tooEarlyBody':
    'The truck is {early} minutes early. The earliest allowed arrival is {limit} minutes before the slot.',
  'ops.gate.approvalPendingTitle': 'Waiting for Admin approval',
  'ops.gate.approvalPendingBody':
    'The warehouse Admin has not approved this booking, so the truck may not enter yet.',
  'ops.gate.vehicleIncompleteTitle': 'Vehicle details incomplete',
  'ops.gate.vehicleIncompleteBody':
    'The license plate and driver name are required before gate-in.',
  'ops.gate.lateTitle': 'Late — added to the queue',
  'ops.gate.onTimeTitle': 'On time',
  'ops.gate.lateBody':
    'Late by {count} minutes. The truck joins the waiting list until a dock is free.',
  'ops.gate.onTimeBody': 'The truck may enter and wait for a dock assignment.',
  'ops.gate.ticketUsed': 'This ticket has already been used.',
  'ops.gate.confirmInTitle': 'Confirm gate-in?',
  'ops.gate.confirmOutTitle': 'Confirm gate-out?',
  'ops.gate.confirmInLate':
    'Entry time is recorded; because the grace period has passed, the truck joins the waiting list until a dock frees up.',
  'ops.gate.confirmInOnTime':
    'Entry time is recorded and the truck joins the dock waiting list.',
  'ops.gate.confirmOutBody':
    'The ticket is closed and its slot released. This cannot be undone.',
  'ops.gate.plateEmpty': 'Plate not filled in',
  'ops.gate.confirmIn': 'Yes, gate-in',
  'ops.gate.confirmOut': 'Yes, gate-out',

  'ops.checker.title': 'Checker scan',
  'ops.checker.description':
    'Scan the ticket QR or type the booking code to assign a dock, start, or finish processing.',
  'ops.checker.assignedAndStarted': 'Truck assigned and processing started',
  'ops.checker.started': 'Processing started',
  'ops.checker.finished': 'Processing finished, dock is free again',
  'ops.checker.pickDock': 'Choose a dock',
  'ops.checker.pickDockHint':
    'Only free docks that handle {activity} can be selected.',
  'ops.checker.noDockTitle': 'No free dock',
  'ops.checker.noDockBody':
    'Every dock is busy or does not handle {activity}. Finish another truck first.',
  'ops.checker.blocked': 'Unavailable: {list}',
  'ops.checker.blockedMaintenance': 'maintenance',
  'ops.checker.blockedOccupied': 'occupied',
  'ops.checker.blockedOtherActivity': 'different activity',
  'ops.checker.blockedWarehouse': 'Outside this customer’s area: {list}',
  'ops.checker.noDockWarehouseTitle': 'No dock in this customer’s area',
  'ops.checker.noDockWarehouseBody':
    'The free {activity} docks are in another warehouse. Ask the Admin if this customer may use that warehouse.',
  'ops.checker.assignAndStart': 'Assign & start processing',
  'ops.checker.assignedTo': 'Already assigned to {dock}',
  'ops.checker.startBody':
    'Start processing once the truck is really ready to load or unload.',
  'ops.checker.start': 'Start processing',
  'ops.checker.inProgressAt': 'Processing at {dock}',
  'ops.checker.startedAt': 'Started {time}.',
  'ops.checker.finishBody':
    'Finish once loading/unloading is completely done.',
  'ops.checker.finish': 'Finish processing',
  'ops.checker.confirmAssignTitle': 'Assign and start processing?',
  'ops.checker.confirmStartTitle': 'Start processing at this dock?',
  'ops.checker.confirmFinishTitle': 'Finish this processing?',
  'ops.checker.confirmAssignBody':
    '{dock} is locked for this truck, and the processing start time is recorded now.',
  'ops.checker.confirmStartBody':
    'The processing start time is recorded as now and the dock is marked busy.',
  'ops.checker.confirmFinishBody':
    'The finish time is recorded and the dock is freed for the next truck.',
  'ops.checker.confirmAssign': 'Yes, assign & start',
  'ops.checker.confirmStart': 'Yes, start processing',
  'ops.checker.confirmFinish': 'Yes, finish',
  'ops.checker.plateEmpty': 'plate not filled in',

  'ops.checker.inactiveApprovalTitle': 'Waiting for Admin approval',
  'ops.checker.inactiveApprovalBody':
    'The warehouse Admin has not approved this booking, so it cannot be assigned to a dock yet.',
  'ops.checker.inactiveNotGatedTitle': 'Truck has not checked in at the gate',
  'ops.checker.inactiveNotGatedBody':
    'Send the driver to the gate to check in. Once the entry is recorded, the truck appears here and in the dock queue.',
  'ops.checker.inactiveCompletedTitle': 'Processing already finished',
  'ops.checker.inactiveCompletedBody':
    'Only the gate-out is left at the gate post. Nothing else is needed at the dock.',
  'ops.checker.inactiveCheckedOutTitle': 'Ticket already closed',
  'ops.checker.inactiveCheckedOutBody':
    'The truck has left and its slot is released. Scan another ticket.',
  'ops.checker.inactiveNoShowTitle': 'Booking marked as no-show',
  'ops.checker.inactiveNoShowBody':
    'An Admin marked this booking as not arriving. Contact the Admin if the truck is in fact there.',
  'ops.checker.inactiveDefaultTitle': 'No action available for this ticket',
  'ops.checker.inactiveDefaultBody': 'Check the ticket status on the Dock board.',
}
