export const approvals = {
  'approvals.note':
    'Booking yang menunggu keputusan Admin. Slot sudah tergenggam sampai tenggat.',
  'approvals.loading': 'Memuat antrean persetujuan...',
  'approvals.cardTitle': 'Menunggu persetujuan',
  'approvals.approvedToast': 'Booking {code} disetujui',
  'approvals.batchApproved': '{count} booking disetujui',
  'approvals.batchApprovedSkipped':
    '{approved} disetujui, {skipped} dilewati (sudah diputuskan)',
  'approvals.searchPlaceholder': 'Cari kode atau customer',
  'approvals.empty': 'Tidak ada booking yang menunggu persetujuan.',
  'approvals.approveSelected': 'Setujui {count} terpilih',
  'approvals.selectAll': 'Pilih semua',
  'approvals.selectRow': 'Pilih {code}',

  'approvals.col.select': 'Pilih',
  'approvals.col.code': 'Kode',
  'approvals.col.customer': 'Customer',
  'approvals.col.schedule': 'Jadwal',
  'approvals.col.deadline': 'Tenggat',
  'approvals.col.status': 'Status',
  'approvals.col.actions': 'Aksi',

  'approvals.reject': 'Tolak',
  'approvals.approve': 'Setujui',
  'approvals.copyMessage': 'Salin pesan WhatsApp',
  'approvals.copied': 'Pesan disalin ke papan klip',
  'approvals.copyDenied': 'Peramban menolak akses papan klip',
  'approvals.vehicleIncomplete': 'Data kendaraan belum lengkap',
  'approvals.urgent': 'MENDESAK',
  'approvals.deadlineOverdue': 'Sudah lewat tenggat',
  'approvals.deadlineMinutes': '{count} menit lagi',
  'approvals.deadlineHours': '{count} jam lagi',
  'approvals.deadlineDays': '{count} hari lagi',

  'approvals.rejectTitle': 'Tolak booking {code}?',
  'approvals.rejectDesc':
    'Booking dibatalkan, kuota dikembalikan, dan customer melihat alasan ini.',
  'approvals.rejectReason': 'Alasan penolakan',
  'approvals.rejectReasonPlaceholder':
    'Contoh: dokumen DO tidak sesuai dengan barang yang dikirim',
  'approvals.rejectReasonHint':
    'Minimal 5 karakter. Alasan tampil di halaman customer dan tiket supir.',
  'approvals.rejectConfirm': 'Tolak booking',
  'approvals.rejectedToast': 'Booking ditolak dan kuota dikembalikan',

  'approvalMsg.pendingBody':
    'Booking {code} ({when}) masih MENUNGGU PERSETUJUAN admin gudang.',
  'approvalMsg.docLine': 'Dokumen: {doc}.',
  'approvalMsg.qrPending': 'QR Code baru aktif setelah disetujui.',
  'approvalMsg.approvedBody': 'Booking {code} ({when}) telah DISETUJUI.',
  'approvalMsg.qrActive':
    'QR Code sudah aktif — tunjukkan di gerbang gudang.',
  'approvalMsg.rejectedBody': 'Booking {code} ({when}) DITOLAK.',
  'approvalMsg.reasonLine': 'Alasan: {reason}.',
  'approvalMsg.createNew': 'Silakan buat booking baru.',
  'approvalMsg.expiredBody':
    'Booking {code} ({when}) KEDALUWARSA karena tidak diputuskan sampai tenggat.',
  'approvalMsg.at': 'pukul',
} as const
