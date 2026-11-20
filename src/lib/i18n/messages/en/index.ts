import type { MessageKey } from '../id'
import { approvals } from './approvals'
import { auth } from './auth'
import { bookings } from './bookings'
import { common } from './common'
import { dashboard } from './dashboard'
import { dock } from './dock'
import { history } from './history'
import { master } from './master'
import { ops } from './ops'
import { queue } from './queue'
import { reports } from './reports'
import { settings } from './settings'
import { ticket } from './ticket'
import { users } from './users'

export const en: Record<MessageKey, string> = {
  ...common,
  ...auth,
  ...approvals,
  ...bookings,
  ...ticket,
  ...reports,
  ...dashboard,
  ...history,
  ...queue,
  ...dock,
  ...master,
  ...ops,
  ...users,
  ...settings,
}
