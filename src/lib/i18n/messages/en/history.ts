import type { MessageKey } from '../id'

export const history: Record<Extract<MessageKey, `history.${string}`>, string> =
  {
    'history.title': 'Gate history',
    'history.description':
      'Trucks that have entered and left the gate, in the order they happened.',
    'history.from': 'From date',
    'history.to': 'To date',
    'history.search': 'Search',
    'history.searchPlaceholder': 'Booking code, plate, or driver',
    'history.searchAria': 'Search booking code, license plate, or driver name',
    'history.today': 'Today',
    'history.refresh': 'Reload history',
    'history.rangeInvalid': 'The start date cannot be after the end date.',
    'history.loading': 'Loading gate history…',
    'history.truncated':
      'Showing the {count} most recent events. Narrow the date range to see the rest — the totals above only count the rows shown.',
    'history.timeline': 'Timeline',
    'history.emptyTitle': 'No gate activity yet',
    'history.emptyBody': 'No trucks entered or left during this range.',
    'history.emptyTable': 'No gate events in this range.',

    'history.event.GATE_IN': 'Entry',
    'history.event.GATE_OUT': 'Exit',

    'history.col.time': 'Time',
    'history.col.event': 'Event',
    'history.col.code': 'Code',
    'history.col.customer': 'Customer',
    'history.col.vehicle': 'Vehicle',
    'history.col.dock': 'Dock',
    'history.col.officer': 'Officer',
    'history.col.description': 'Details',

    'history.minutesInside': '{count} minutes inside',
    'history.gateOutAt': 'Exited {time}',
    'history.stillInside': 'Still inside',
  }
