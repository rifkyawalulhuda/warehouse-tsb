import type { MessageKey } from '../id'

export const settings: Record<
  Extract<MessageKey, `settings.${string}`>,
  string
> = {
  'settings.title': 'Settings',
  'settings.description':
    'Everything here affects slot capacity and booking policy directly. Save section by section so a small change does not overwrite the rest.',
  'settings.allSaved': 'All saved',
  'settings.dirtyCount': '{count} sections not saved',
  'settings.loading': 'Loading settings...',
  'settings.navAria': 'Settings sections',
  'settings.navEmpty': 'No pending changes. Each section is saved on its own.',
  'settings.navDirty': '{count} sections changed and not sent to the server.',
  'settings.manualModeOn': 'Manual mode is on',
  'settings.unsaved': 'Not saved',

  'settings.group.warehouse': 'Warehouse',
  'settings.group.brand': 'Brand',
  'settings.group.operations': 'Operations',
  'settings.group.policy': 'Policy',
  'settings.group.preferences': 'Preferences',

  'settings.tab.identity': 'Warehouse identity',
  'settings.tab.brand': 'Brand identity',
  'settings.tab.login': 'Sign-in page',
  'settings.tab.hours': 'Operating hours',
  'settings.tab.arrival': 'Arrival rules',
  'settings.tab.window': 'Booking window',
  'settings.tab.approval': 'Booking approval',
  'settings.tab.language': 'Language',
  'settings.tab.appearance': 'Appearance',
  'settings.tab.ticket': 'Ticket design',

  'settings.saved.identity': 'Warehouse identity saved',
  'settings.saved.brand': 'Brand identity saved',
  'settings.saved.login': 'Sign-in page saved',
  'settings.saved.hours': 'Operating hours saved',
  'settings.saved.arrival': 'Arrival rules saved',
  'settings.saved.window': 'Booking window saved',
  'settings.saved.approval': 'Approval policy saved',
  'settings.saved.ticket': 'Ticket design saved',

  'settings.panel.dirty': 'Changes in this section are not sent yet.',
  'settings.panel.clean': 'No changes in this section.',
  'settings.panel.save': 'Save section',
  'settings.panel.reset': 'Discard',
  'settings.panel.saving': 'Saving',
  'settings.panel.unsaved': 'Not saved',

  'settings.identity.title': 'Warehouse identity',
  'settings.identity.description':
    'This name is printed on driver tickets and used as the first warehouse name in Master Data. The server writes both at once, so they cannot differ.',
  'settings.identity.name': 'Warehouse name',
  'settings.identity.nameHint':
    'At least 2 characters, at most 120. Other warehouse names in Master Data must be different.',

  'settings.brand.title': 'Brand identity',
  'settings.brand.description':
    'The logo, title, and tagline shown in the sidebar header, on the sign-in page, and in the browser tab title. This is not the warehouse name — that stays in the Warehouse identity section.',
  'settings.brand.footer':
    'Applies to every user once saved. Driver ticket pages keep using the customer company name, not this title.',
  'settings.brand.appName': 'App title',
  'settings.brand.appNameHint':
    '1–60 characters. The first letter becomes the badge while no logo is uploaded.',
  'settings.brand.tagline': 'Tagline',
  'settings.brand.taglineHint':
    'A small line under the title. Leave empty to show the title alone.',
  'settings.brand.shortName': 'Short name',
  'settings.brand.shortNameHint':
    'For the browser tab title and narrow screens. Leave empty to use the app title.',
  'settings.brand.optional': 'Optional',
  'settings.brand.preview': 'Preview',
  'settings.brand.previewNote':
    'The short name is used as the tab title; when empty, the app title is used.',

  'settings.logo.label': 'App logo',
  'settings.logo.hint':
    'PNG or JPG, at most 2 MB. A transparent background is safest. Leave empty to use the first letter of the title.',
  'settings.logo.sidebar': 'Sidebar',
  'settings.logo.tabIcon': 'Tab icon',
  'settings.logo.uploading': 'Uploading…',
  'settings.logo.replace': 'Replace logo',
  'settings.logo.upload': 'Upload logo',
  'settings.logo.remove': 'Remove',

  'settings.login.title': 'Sign-in page',
  'settings.login.description':
    'The welcome sentence and the right-hand panel on the sign-in page. Only what is visible before signing in changes here.',
  'settings.login.footer':
    'The welcome text also shows on phones under the app name; the panel image only on wide screens.',
  'settings.login.descriptionLabel': 'Welcome text',
  'settings.login.descriptionHint':
    '1–{max} characters. Leave empty to use the default text.',
  'settings.login.cover': 'Sign-in panel image',
  'settings.login.coverHint':
    'PNG or JPG, at most 2 MB. Only shown on wide screens — on phones the form takes the whole screen.',
  'settings.login.coverPreviewAlt': 'Sign-in panel image preview',
  'settings.login.noImage': 'No image yet',
  'settings.login.replaceImage': 'Replace image',
  'settings.login.uploadImage': 'Upload image',
  'settings.login.brandColor': 'Accent colour',
  'settings.login.brandColorHint':
    'Used as the panel base colour and the dark layer over the image. Leave empty to use the theme colour.',
  'settings.login.pickColor': 'Pick an accent colour',
  'settings.login.useColor': 'Use colour {color}',
  'settings.login.clearColor': 'Clear',
  'settings.login.previewMobile': 'Phone preview',
  'settings.login.previewSignIn': 'Sign in',
  'settings.login.previewHint':
    'Use the email and password given by the warehouse admin.',
  'settings.login.previewWide':
    'On wide screens the same sentence shows in the right panel with the image.',

  'settings.hours.title': 'Operating hours',
  'settings.hours.description':
    'Determines which slots can be booked today. Every block starts at the opening time, so the range must divide evenly by the slot unit.',
  'settings.hours.footer':
    'Capacity per block is currently {loading} loading and {unloading} unloading — it follows the active docks in Master Data and is not set here.',
  'settings.hours.open': 'Opening time',
  'settings.hours.openHint': 'The first block starts exactly at this time.',
  'settings.hours.close': 'Closing time',
  'settings.hours.closeHint':
    'No block starts after this time; the last block must finish on time.',
  'settings.hours.unit': 'Slot unit',
  'settings.hours.unitHint':
    'The size of one slot. Changing it changes the number of blocks per day and all availability; existing bookings keep the blocks they already locked.',
  'settings.hours.summary': 'Range {hours} = {duration}, holding {blocks}.',

  'settings.arrival.title': 'Arrival rules',
  'settings.arrival.description':
    'These two thresholds are used by gate officers and the no-show marker. Both are about time tolerance, not capacity.',
  'settings.arrival.grace': 'Grace period',
  'settings.arrival.graceHint':
    'A truck arriving within {minutes} minutes of its schedule still counts as on time. Later than that it joins the late queue.',
  'settings.arrival.early': 'Early arrival limit',
  'settings.arrival.earlyHint':
    'Gate-in is refused when a truck arrives more than {minutes} minutes before its schedule.',
  'settings.arrival.warning':
    'The early arrival limit is far looser than the grace period. Trucks can pile up in the waiting area before their slot starts.',

  'settings.window.title': 'Booking window',
  'settings.window.description':
    'How far ahead a customer may book. The longer it is, the more slots must be prepared for each activity type.',
  'settings.window.days': 'Days ahead',
  'settings.window.daysHint':
    'Today counts. Customers cannot book outside this range, including through a direct link.',
  'settings.window.today': 'Today',
  'settings.window.thisWeek': 'This week',
  'settings.window.thisMonth': 'A month',
  'settings.window.daysUnit': '{count} days',

  'settings.approval.title': 'Booking approval',
  'settings.approval.description':
    'Changes who may book without a queue. Every mode change is recorded in the audit trail together with the admin who made it.',
  'settings.approval.mode': 'Mode',
  'settings.approval.modeAutoHint':
    'Every booking is valid at once and locks slot capacity immediately.',
  'settings.approval.modeManualHint':
    'Only customers marked "auto booking" on the Users page pass; the rest wait for an admin decision.',
  'settings.approval.modeAuto': 'Automatic — all approved at once',
  'settings.approval.modeManual': 'Manual — needs admin approval',
  'settings.approval.lead': 'Deadline before arrival',
  'settings.approval.leadHint':
    'The decision must finish that many minutes before the arrival time, otherwise the booking expires and its capacity is released.',
  'settings.approval.minDecision': 'Minimum decision window',
  'settings.approval.minDecisionHint':
    'An urgent booking still gets that many minutes to be decided, even when the deadline above has passed.',
  'settings.approval.urgent': 'Urgent label threshold',
  'settings.approval.urgentHint':
    'Only affects the marker in the admin queue, not the decision or capacity.',
  'settings.approval.autoFlag': 'Bookings are valid at once',
  'settings.approval.manualFlag': 'Some bookings wait for an admin',
  'settings.approval.auto': 'Automatic',
  'settings.approval.manual': 'Manual',
  'settings.impact.blocks': '{count} blocks',

  'settings.language.title': 'Language',
  'settings.language.description':
    'Choose the interface language. Dates, numbers, and status labels follow the active language.',
  'settings.language.footer':
    'You can also change it from the language switch in the sidebar header and the mobile top bar.',

  'settings.appearance.title': 'Appearance',
  'settings.appearance.description':
    'A browser preference, not part of the warehouse settings. It is stored on your device and is not sent when another section is saved.',
  'settings.appearance.footer':
    'You can also change it from the Theme menu in the sidebar footer.',
  'settings.appearance.aria': 'Display theme',
  'settings.appearance.light': 'Light',
  'settings.appearance.lightDesc':
    'White background, comfortable in bright rooms.',
  'settings.appearance.dark': 'Dark',
  'settings.appearance.darkDesc': 'Dark background, less glare at night.',
  'settings.appearance.system': 'Follow system',
  'settings.appearance.systemDesc': 'Follows your device settings.',
  'settings.appearance.active': 'Active now {theme}',
  'settings.appearance.followSystem': ' — following the device',

  'settings.ticket.title': 'Ticket design',
  'settings.ticket.description':
    'The look of the driver ticket card. The chosen design applies to every ticket — on screen, in print, and in the PNG sent over WhatsApp.',
  'settings.ticket.footer':
    'Content does not change with the design: eight values and the QR stay. Tickets reopened from an old link also follow the selected design.',
  'settings.ticket.legend': 'Choose a ticket design',
  'settings.ticket.preview': 'Design preview',
  'settings.ticket.previewNote':
    'The data above is a sample, not a real booking. The app name and logo follow the Brand identity section.',
  'settings.ticket.classic': 'Classic Blue',
  'settings.ticket.classicHint':
    'Full blue with a torn seam. The most familiar for drivers used to the old ticket.',
  'settings.ticket.minimal': 'Minimal White',
  'settings.ticket.minimalHint':
    'Clean white with a large date beside the QR. The most legible in black-and-white print.',
  'settings.ticket.navy': 'Official Navy',
  'settings.ticket.navyHint':
    'A navy band with a prominent QR card. The boldest choice for warehouses with many documents.',
  'settings.ticket.groupStandard': 'Standard layouts',
  'settings.ticket.groupSpecial': 'For specific situations',
  'settings.ticket.thermal': 'Thermal Mono',
  'settings.ticket.thermalHint':
    'Black and white, no colour. For thermal printers and faded photocopies.',
  'settings.ticket.largeCode': 'Large Code',
  'settings.ticket.largeCodeHint':
    'The booking code is the biggest thing on the card. For officers typing the code when the QR will not scan.',
  'settings.ticket.night': 'Night',
  'settings.ticket.nightHint':
    'A dark card so it does not glare at the night gate. The QR stays on white.',
  'settings.ticket.tearoff': 'Tear-off',
  'settings.ticket.tearoffHint':
    'A bottom stub with code, date, dock and plate for the gate officer to tear off.',
  'settings.ticket.brand': 'Brand Colour',
  'settings.ticket.brandHint':
    'The top band uses the brand colour from the sign-in page. Bright colours are darkened so the text stays readable.',

  'settings.summary.aria': 'Operational summary',
  'settings.summary.title': 'Used by the capacity engine',
  'settings.summary.saved': 'Matches the saved settings',
  'settings.summary.dirty': '{count} sections changed, not saved',
  'settings.summary.hours': 'Operating hours',
  'settings.summary.blocks': 'Blocks per day',
  'settings.summary.grace': 'Grace period',
  'settings.summary.window': 'Booking window',
  'settings.summary.approval': 'Approval',
  'settings.summary.unsavedOne': 'not saved',
  'settings.summary.range': '{open} to {close}',
  'settings.summary.rangeInvalid': 'Hour range is not valid yet',
  'settings.summary.blocksFilled': '{count} blocks filled',
  'settings.summary.noBlocks': 'No blocks',
  'settings.summary.timelineAria':
    'Operating window {open} to {close}, {count} blocks',
  'settings.summary.timelineAriaInvalid': 'Operating window is not valid yet',

  'settings.unit.minutes': 'minutes',
  'settings.unit.days': 'days',

  'settings.error.warehouseMin':
    'Warehouse name must be at least 2 characters.',
  'settings.error.warehouseMax':
    'Warehouse name must be at most 120 characters.',
  'settings.error.appNameRequired': 'App title is required.',
  'settings.error.appNameMax': 'App title must be at most 60 characters.',
  'settings.error.taglineMax': 'Tagline must be at most 80 characters.',
  'settings.error.shortNameMax': 'Short name must be at most 20 characters.',
  'settings.error.logo':
    'The logo must be a PNG or JPG uploaded here, or an https address.',
  'settings.error.loginMax': 'Welcome text must be at most {max} characters.',
  'settings.error.image':
    'The image must be a PNG or JPG uploaded here, or an https address.',
  'settings.error.color': 'Accent colour must be in #RRGGBB format.',
  'settings.error.unitRange': 'Slot unit must be a number from 15–120 minutes.',
  'settings.error.hoursRequired': 'Opening and closing times are required.',
  'settings.error.hoursOrder': 'Closing time must be after opening time.',
  'settings.error.unitRemainder':
    'The {span} minute range does not divide evenly by the {unit} minute slot unit.',
  'settings.error.graceRange': 'Grace period must be 0–240 minutes.',
  'settings.error.earlyRange': 'Early arrival limit must be 0–480 minutes.',
  'settings.error.windowRange': 'Booking window must be 1–90 days.',
  'settings.error.leadRange': 'Decision deadline must be 5–2880 minutes.',
  'settings.error.minDecisionRange':
    'Minimum decision window must be 5–1440 minutes.',
  'settings.error.urgentRange':
    'Urgent label threshold must be 0–14400 minutes.',

  'settings.note.hours':
    '{minutes} minutes at the end of operating hours fall outside any block, so they cannot be booked.',
}
