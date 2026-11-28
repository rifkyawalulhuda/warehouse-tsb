export const ops = {
  'ops.scanTitle': 'Pindai tiket',
  'ops.scanChecking': 'Memeriksa tiket...',
  'ops.scanHint': 'Arahkan kamera ke QR, atau ketik token / kode booking.',
  'ops.scanAnother': 'Pindai tiket lain',
  'ops.scanCameraOn': 'Nyalakan kamera',
  'ops.scanCameraOff': 'Matikan kamera',
  'ops.scanCameraError': 'Kamera tidak bisa dibuka',
  'ops.scanCameraFallback': '{error}. Gunakan input manual di bawah.',
  'ops.scanInputPlaceholder': 'Token QR atau kode booking',
  'ops.scanCheck': 'Cek',
  'ops.scanInvalid':
    'Kode tidak dikenali. Tempel token QR dari e-tiket (32 karakter), atau ketik kode booking seperti TSB-20261111-003.',
  'ops.scanManualHint':
    'QR tiket berisi token acak. Bila kamera tidak bisa dipakai, ketik token itu atau kode booking yang tercetak di tiket (mis. TSB-20261111-003).',
  'ops.scanQrAlt': 'Kode QR tiket',

  'ops.field.activity': 'Aktivitas',
  'ops.field.schedule': 'Jadwal',
  'ops.field.plate': 'Plat nomor',
  'ops.field.driver': 'Supir',
  'ops.field.dock': 'Dock',
  'ops.field.truckType': 'Jenis truk',
  'ops.field.document': 'Dokumen',
  'ops.field.grace': 'Masa tenggang',
  'ops.field.gateInAt': 'Masuk gate',
  'ops.field.waitPosition': 'Urutan tunggu',
  'ops.graceMinutes': '{count} menit',
  'ops.waitPosition': 'Ke-{position} dari truk yang menunggu',
  'ops.notGatedIn': 'Belum masuk',
  'ops.dockUnassigned': 'Belum ditugaskan',
  'ops.notFilled': 'Belum diisi',

  'ops.gate.title': 'Gate',
  'ops.gate.description':
    'Pindai QR tiket atau ketik kode booking untuk check-in dan check-out.',
  'ops.gate.successIn': 'Gate-in berhasil',
  'ops.gate.successOut': 'Gate-out berhasil',
  'ops.gate.tooEarlyTitle': 'Datang terlalu awal',
  'ops.gate.tooEarlyBody':
    'Truk datang {early} menit lebih awal. Batas kedatangan awal {limit} menit.',
  'ops.gate.approvalPendingTitle': 'Menunggu persetujuan Admin',
  'ops.gate.approvalPendingBody':
    'Booking ini belum disetujui Admin gudang, jadi truk belum boleh masuk.',
  'ops.gate.vehicleIncompleteTitle': 'Data kendaraan belum lengkap',
  'ops.gate.vehicleIncompleteBody':
    'Plat nomor dan nama supir wajib diisi sebelum gate-in.',
  'ops.gate.lateTitle': 'Terlambat — masuk antrean',
  'ops.gate.onTimeTitle': 'Tepat waktu',
  'ops.gate.lateBody':
    'Terlambat {count} menit. Truk akan masuk waiting list sampai dock kosong.',
  'ops.gate.onTimeBody': 'Truk boleh masuk dan menunggu penugasan dock.',
  'ops.gate.ticketUsed': 'Tiket sudah selesai dipakai.',
  'ops.gate.confirmInTitle': 'Konfirmasi gate-in?',
  'ops.gate.confirmOutTitle': 'Konfirmasi gate-out?',
  'ops.gate.confirmInLate':
    'Waktu masuk dicatat, dan karena sudah melewati masa tenggang truk masuk waiting list sampai ada dock kosong.',
  'ops.gate.confirmInOnTime':
    'Waktu masuk dicatat dan truk masuk daftar tunggu dock.',
  'ops.gate.confirmOutBody':
    'Tiket ditutup dan slotnya dilepas. Tindakan ini tidak bisa dibatalkan.',
  'ops.gate.plateEmpty': 'Plat belum diisi',
  'ops.gate.confirmIn': 'Ya, gate-in',
  'ops.gate.confirmOut': 'Ya, gate-out',

  'ops.checker.title': 'Scan Checker',
  'ops.checker.description':
    'Pindai QR tiket atau ketik kode booking untuk menugaskan dock, memulai, atau menyelesaikan proses.',
  'ops.checker.assignedAndStarted': 'Truk ditugaskan dan proses dimulai',
  'ops.checker.started': 'Proses dimulai',
  'ops.checker.finished': 'Proses selesai, dock kembali tersedia',
  'ops.checker.pickDock': 'Pilih dock',
  'ops.checker.pickDockHint':
    'Hanya dock kosong yang melayani {activity} yang bisa dipilih.',
  'ops.checker.noDockTitle': 'Tidak ada dock kosong',
  'ops.checker.noDockBody':
    'Semua dock sedang terpakai atau tidak melayani {activity}. Selesaikan proses truk lain lebih dulu.',
  'ops.checker.blocked': 'Tidak bisa dipilih: {list}',
  'ops.checker.blockedMaintenance': 'perawatan',
  'ops.checker.blockedOccupied': 'terpakai',
  'ops.checker.blockedOtherActivity': 'aktivitas berbeda',
  'ops.checker.blockedWarehouse': 'Bukan area customer ini: {list}',
  'ops.checker.noDockWarehouseTitle': 'Tidak ada dock di area customer ini',
  'ops.checker.noDockWarehouseBody':
    'Dock {activity} yang kosong ada di gudang lain. Hubungi Admin kalau customer ini memang boleh memakai gudang tersebut.',
  'ops.checker.assignAndStart': 'Tugaskan & mulai proses',
  'ops.checker.assignedTo': 'Sudah ditugaskan ke {dock}',
  'ops.checker.startBody':
    'Mulai proses saat truk benar-benar siap dibongkar atau dimuat.',
  'ops.checker.start': 'Mulai proses',
  'ops.checker.inProgressAt': 'Sedang diproses di {dock}',
  'ops.checker.startedAt': 'Mulai {time}.',
  'ops.checker.finishBody': 'Selesaikan saat bongkar/muat benar-benar tuntas.',
  'ops.checker.finish': 'Selesaikan proses',
  'ops.checker.confirmAssignTitle': 'Tugaskan dan mulai proses?',
  'ops.checker.confirmStartTitle': 'Mulai proses di dock ini?',
  'ops.checker.confirmFinishTitle': 'Selesaikan proses ini?',
  'ops.checker.confirmAssignBody':
    '{dock} dikunci untuk truk ini, lalu waktu mulai proses dicatat sekarang.',
  'ops.checker.confirmStartBody':
    'Waktu mulai proses dicatat sebagai sekarang dan dock ditandai sedang dipakai.',
  'ops.checker.confirmFinishBody':
    'Waktu selesai dicatat dan dock langsung dibebaskan untuk truk berikutnya.',
  'ops.checker.confirmAssign': 'Ya, tugaskan & mulai',
  'ops.checker.confirmStart': 'Ya, mulai proses',
  'ops.checker.confirmFinish': 'Ya, selesaikan',
  'ops.checker.plateEmpty': 'plat belum diisi',

  'ops.checker.inactiveApprovalTitle': 'Menunggu persetujuan Admin',
  'ops.checker.inactiveApprovalBody':
    'Booking belum disetujui Admin gudang, jadi belum boleh ditugaskan ke dock.',
  'ops.checker.inactiveNotGatedTitle': 'Truk belum check-in di gate',
  'ops.checker.inactiveNotGatedBody':
    'Arahkan supir ke gate untuk check-in. Setelah tercatat masuk, truk muncul di sini dan di antrean dock.',
  'ops.checker.inactiveCompletedTitle': 'Proses sudah selesai',
  'ops.checker.inactiveCompletedBody':
    'Tinggal gate-out di pos gate. Tidak ada lagi yang perlu dikerjakan di dock.',
  'ops.checker.inactiveCheckedOutTitle': 'Tiket sudah selesai dipakai',
  'ops.checker.inactiveCheckedOutBody':
    'Truk sudah keluar dan slotnya dilepas. Pindai tiket lain.',
  'ops.checker.inactiveNoShowTitle': 'Booking ditandai no-show',
  'ops.checker.inactiveNoShowBody':
    'Admin menandai booking ini tidak hadir. Hubungi Admin bila truk ternyata ada.',
  'ops.checker.inactiveCancelledTitle': 'Booking sudah dibatalkan',
  'ops.checker.inactiveCancelledBody':
    'Slotnya sudah dilepas dan tiket ini tidak bisa dipakai. Minta customer membuat booking baru.',
  'ops.checker.inactiveDefaultTitle': 'Belum ada tindakan untuk tiket ini',
  'ops.checker.inactiveDefaultBody': 'Periksa status tiket di Papan Dock.',
} as const
