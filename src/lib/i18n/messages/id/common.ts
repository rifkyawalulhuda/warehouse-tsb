export const common = {
  'common.save': 'Simpan',
  'common.saving': 'Menyimpan…',
  'common.cancel': 'Batal',
  'common.close': 'Tutup',
  'common.delete': 'Hapus',
  'common.edit': 'Ubah',
  'common.back': 'Kembali',
  'common.retry': 'Coba lagi',
  'common.loading': 'Memuat…',
  'common.search': 'Cari',
  'common.all': 'Semua',
  'common.yes': 'Ya',
  'common.no': 'Tidak',
  'common.optional': 'opsional',
  'common.required': 'wajib diisi',
  'common.unknownError': 'Terjadi kesalahan yang tidak diketahui',
  'common.pendingApproval': 'menunggu persetujuan',
  'common.pendingApprovalTooltip': '{count} menunggu persetujuan',

  'locale.label': 'Bahasa',
  'locale.description':
    'Berlaku di perangkat ini saja. Ponsel dan komputer bisa memakai bahasa berbeda.',
  'locale.switch': 'Ganti bahasa',
  'locale.id': 'Bahasa Indonesia',
  'locale.en': 'English',

  'error.UNAUTHORIZED': 'Sesi tidak valid atau sudah berakhir',
  'error.FORBIDDEN': 'Anda tidak punya akses ke aksi ini',
  'error.NOT_FOUND': 'Data tidak ditemukan',
  'error.DUPLICATE': 'Data serupa sudah ada',
  'error.VALIDATION_ERROR': 'Ada isian yang belum benar',
  'error.INVALID_PARAM': 'Parameter tidak valid',
  'error.INVALID_ID': 'ID tidak valid',
  'error.INVALID_QR': 'QR Code tidak dikenali',
  'error.QR_NOT_FOUND':
    'QR Code tidak dikenali. Pastikan itu QR tiket, bukan kode lain.',
  'error.BOOKING_NOT_FOUND':
    'Kode booking itu tidak ada. Periksa lagi angka dan tanggalnya.',
  'error.DATE_IN_PAST': 'Tanggal yang dipilih sudah lewat',
  'error.SLOT_IN_PAST': 'Jam tersebut sudah lewat',
  'error.EMAIL_TAKEN': 'Email sudah dipakai akun lain',
  'error.EMAIL_UNCHANGED': 'Email baru sama dengan email sekarang.',
  'error.INVALID_PASSWORD': 'Kata sandi saat ini tidak cocok.',
  'error.PASSWORD_UNCHANGED': 'Kata sandi baru sama dengan yang sekarang.',
  'error.NO_CHANGES': 'Tidak ada perubahan',
  'error.CUSTOMER_INACTIVE': 'Akun customer ini sedang nonaktif.',
  'error.UPLOAD_EMPTY': 'Berkas gambar kosong.',
  'error.UPLOAD_TOO_LARGE': 'Gambar maksimal 2 MB.',
  'error.UPLOAD_TYPE': 'Gambar harus PNG atau JPG.',
  'error.INVALID_CREDENTIALS':
    'Email atau kata sandi tidak cocok. Periksa kembali, atau hubungi Admin gudang kalau Anda yakin akun ini sudah terdaftar.',
  'error.TOO_MANY_REQUESTS':
    'Terlalu banyak permintaan. Tunggu sebentar, lalu coba lagi.',
  'error.NETWORK': 'Tidak bisa menghubungi server. Periksa koneksi Anda.',
  'error.APPROVAL_ALREADY_DECIDED':
    'Booking ini sudah diputuskan atau kedaluwarsa.',
  'error.APPROVAL_NOT_APPLICABLE':
    'Booking ini sudah dibatalkan atau diproses, jadi tidak bisa disetujui.',
  'error.APPROVAL_PENDING':
    'Booking belum disetujui Admin, jadi belum bisa diproses.',
  'error.CANCEL_NOT_ALLOWED':
    'Booking tidak bisa dibatalkan karena truk sudah masuk gerbang.',
  'error.CANNOT_DEACTIVATE_SELF':
    'Anda tidak bisa menonaktifkan akun Anda sendiri.',
  'error.CANNOT_DEMOTE_SELF':
    'Anda tidak bisa menurunkan peran akun Anda sendiri.',
  'error.CUSTOMER_NAME_TAKEN': 'Nama customer sudah dipakai.',
  'error.CUSTOMER_VIA_MASTER':
    'Akun Customer dibuat dari Master Data Customer, bukan dari halaman Pengguna.',
  'error.CUSTOMER_REQUIRED':
    'Akun ini belum terhubung ke customer. Hubungi Admin gudang.',
  'error.DOCK_CODE_TAKEN': 'Kode dock sudah dipakai.',
  'error.FLAG_NOT_APPLICABLE':
    'Admin sudah otomatis berhak menyetujui, jadi flag ini tidak diperlukan.',
  'error.INVALID_TRANSITION':
    'Status booking sudah berubah. Muat ulang lalu coba lagi.',
  'error.INVALID_WINDOW':
    'Jam buka dan jam tutup tidak masuk akal. Periksa lagi.',
  'error.LAST_ADMIN':
    'Harus ada minimal satu Admin aktif. Angkat Admin lain lebih dulu.',
  'error.NO_DOCK':
    'Belum ada dock aktif untuk aktivitas ini. Hubungi Admin gudang.',
  'error.QUOTA_FULL':
    'Kuota pada jam tersebut baru saja terisi. Silakan pilih jam lain.',
  'error.SLOT_UNAVAILABLE':
    'Jadwal belum tersedia untuk jam tersebut. Muat ulang halaman lalu coba lagi.',
  'error.VEHICLE_INCOMPLETE':
    'Plat nomor dan nama supir belum lengkap. Minta customer atau supir melengkapinya.',
  'error.VEHICLE_LOCKED':
    'Data kendaraan tidak bisa diubah karena truk sudah masuk gerbang.',
  'error.WAREHOUSE_NAME_TAKEN': 'Nama gudang sudah dipakai.',
  'error.TOO_MANY_ATTEMPTS':
    'Terlalu banyak percobaan masuk. Tunggu 15 menit, lalu coba lagi.',
  'error.TOO_MANY_PASSWORD_ATTEMPTS':
    'Terlalu banyak percobaan kata sandi. Tunggu 15 menit, lalu coba lagi.',
  'error.TOO_EARLY': 'Terlalu awal untuk aksi ini.',
  'error.ALREADY_CHECKED_OUT': 'Truk ini sudah tercatat keluar.',
  'error.WRONG_STATUS': 'Status booking tidak mendukung aksi ini.',
  'error.DOCK_OCCUPIED': 'Dock tersebut sedang dipakai.',
  'error.DOCK_MAINTENANCE': 'Dock tersebut sedang dalam perbaikan.',
  'error.DOCK_ACTIVITY_MISMATCH':
    'Aktivitas booking tidak sesuai dengan dock yang dipilih.',
  'error.DOCK_WAREHOUSE_FORBIDDEN':
    'Dock itu ada di gudang yang bukan area customer ini. Pilih dock di gudang area customer, atau minta Admin menambahkannya.',
  'error.WAREHOUSE_NOT_FOUND': 'Gudang yang dipilih tidak ditemukan.',
  'error.SLOT_OVERFLOW':
    'Durasi truk melewati jam operasional. Pilih jam lain.',
  'error.SLOT_NOT_ALIGNED': 'Jam mulai harus kelipatan satuan blok.',
  'error.SLOT_BEFORE_OPENING': 'Jam mulai sebelum gudang buka.',
  'error.SLOT_AFTER_CLOSING': 'Jam selesai melewati jam tutup gudang.',
  'error.DATE_TOO_FAR': 'Tanggal melewati batas jendela pemesanan.',
  'error.EARLY_ARRIVAL': 'Truk datang terlalu awal untuk slot ini.',
  'error.CUSTOMER_IN_USE':
    'Customer ini masih punya data terkait, jadi tidak bisa dihapus.',
  'error.WAREHOUSE_IN_USE':
    'Gudang ini masih punya data terkait, jadi tidak bisa dihapus.',
  'error.APPROVAL_MODE_CHANGED':
    'Mode persetujuan baru saja berubah. Muat ulang halaman.',
  'error.USER_ACCESS_CHANGED':
    'Akses akun ini baru saja berubah. Muat ulang halaman.',
  'error.PAYLOAD_TOO_LARGE': 'Data yang dikirim terlalu besar.',
  'error.INVALID_REQUEST': 'Permintaan tidak valid.',
  'error.INTERNAL_ERROR': 'Terjadi kesalahan di server. Coba lagi nanti.',

  'nav.openMenu': 'Buka menu navigasi',
  'nav.toggleSidebar': 'Buka/tutup sidebar',
  'nav.toggleNavigation': 'Buka/tutup menu navigasi',
  'nav.openMenuPending': 'Buka menu navigasi, {count} menunggu persetujuan',
  'nav.back': 'Kembali ke halaman sebelumnya',
  'nav.searchTitle': 'Palet perintah',
  'nav.searchDescription': 'Ketik perintah yang ingin dijalankan...',

  'status.BOOKED_INCOMPLETE': 'Menunggu data kendaraan',
  'status.BOOKED_READY': 'Siap masuk',
  'status.CHECKED_IN_ON_TIME': 'Check-in tepat waktu',
  'status.LATE_WAITING_LIST': 'Antrean terlambat',
  'status.DOCK_ASSIGNED': 'Dapat dock',
  'status.IN_PROGRESS': 'Sedang diproses',
  'status.COMPLETED': 'Selesai bongkar/muat',
  'status.CHECKED_OUT': 'Sudah keluar',
  'status.CANCELLED': 'Dibatalkan',
  'status.NO_SHOW': 'Tidak datang',

  'approval.PENDING': 'Menunggu persetujuan',
  'approval.APPROVED': 'Disetujui',
  'approval.REJECTED': 'Ditolak',
  'approval.EXPIRED': 'Kedaluwarsa',

  'role.ADMIN': 'Admin Gudang',
  'role.CUSTOMER': 'Customer',
  'role.GATE_OFFICER': 'Petugas Gate',
  'role.CHECKER': 'Checker Dock',

  'activity.LOADING': 'Loading (muat)',
  'activity.UNLOADING': 'Unloading (bongkar)',
  'activity.BOTH': 'Loading & Unloading',

  'duration.minutes': '{count} menit',
  'duration.minutesShort': 'mnt',
  'duration.hours': '{count} jam',
  'duration.hoursMinutes': '{hours} jam {minutes} menit',

  'common.loadingData': 'Memuat data...',
  'common.learnMore': 'Pelajari lebih lanjut',
  'common.noResults': 'Tidak ada hasil.',
  'password.show': 'Tampilkan password',
  'password.hide': 'Sembunyikan password',
  'password.capsLock': 'Caps Lock menyala — password jadi huruf besar.',
  'comingSoon.title': 'Segera hadir!',
  'comingSoon.body':
    'Halaman ini belum dibuat. Nantikan pembaruannya, ya.',
  'team.label': 'Tim',
  'team.add': 'Tambah tim',

  'nav.accountSettings': 'Pengaturan Akun',
  'nav.signOut': 'Keluar',
  'nav.defaultUser': 'Pengguna',
  'nav.booking': 'Booking',
  'nav.myBookings': 'Jadwal Saya',
  'nav.newBooking': 'Buat Booking',
  'nav.reports': 'Laporan',
  'nav.gate': 'Gate',
  'nav.scanGate': 'Scan Gate',
  'nav.gateHistory': 'Riwayat Gate',
  'nav.operations': 'Operasional',
  'nav.checkerScan': 'Scan Checker',
  'nav.todayQueue': 'Antrean Hari Ini',
  'nav.dockBoard': 'Papan Dock',
  'nav.other': 'Lainnya',
  'nav.dashboard': 'Dashboard',
  'nav.management': 'Manajemen',
  'nav.masterData': 'Master Data',
  'nav.settings': 'Pengaturan',

  'theme.label': 'Tampilan',
  'theme.current': 'Tema: {theme}',
  'theme.appearance': 'Tampilan',
  'theme.light': 'Terang',
  'theme.dark': 'Gelap',
  'theme.system': 'Ikuti sistem',
  'theme.switchLabel': 'Ubah tema tampilan',

  'common.columns': 'Kolom',
  'common.showColumns': 'Tampilkan kolom',

  'command.placeholder': 'Cari menu atau perintah...',
  'command.empty': 'Tidak ada hasil.',

  'table.empty': 'Tidak ada data.',
  'table.rowsPerPage': 'Baris per halaman',
  'table.pageFirst': 'Halaman pertama',
  'table.pagePrevious': 'Halaman sebelumnya',
  'table.pageNext': 'Halaman berikutnya',
  'table.pageLast': 'Halaman terakhir',
  'table.page': 'Halaman {page}',
  'table.sort': 'Urutkan {column}',
  'table.sortAria':
    'Urutkan {column}, {dir}; tekan untuk mengubah arah urutan',
  'table.sortAsc': 'menaik',
  'table.sortDesc': 'menurun',
  'table.sortNone': 'belum diurutkan',
  'table.selected': 'dipilih',
  'table.selectedCount': '{count} dipilih',
  'table.bulkAnnounce': '{count} {entity} dipilih. Bilah aksi massal tersedia.',
  'table.bulkAria': 'Aksi massal untuk {count} {entity} terpilih',
  'table.clearSelection': 'Kosongkan pilihan',
  'table.clearSelectionHint': 'Kosongkan pilihan (Escape)',
  'table.entityRows': 'baris',

  'picker.selectDate': 'Pilih tanggal',
  'picker.previousMonth': 'Bulan sebelumnya',
  'picker.nextMonth': 'Bulan berikutnya',
  'picker.selectMonth': 'Pilih bulan',
  'picker.selectYear': 'Pilih tahun',
  'picker.today': 'Hari ini, {date}',
  'picker.selectDock': 'Pilih dock',
  'picker.searchDock': 'Cari dock, area, atau gudang…',
  'picker.noDock': 'Tidak ada dock yang cocok.',
  'picker.blockedWarehouseGroup': 'Gudang lain — bukan area customer ini',
  'picker.dockLabel': '{label}: {dock}',

  'signOut.title': 'Keluar dari akun',
  'signOut.body':
    'Anda perlu masuk kembali untuk melanjutkan. Lanjutkan keluar?',
  'signOut.warning': 'Sesi lokal dihapus, tetapi server tidak merespons.',

  'errors.unauthorized': 'Tidak Terautentikasi',
  'errors.forbidden': 'Akses Ditolak',
  'errors.notFound': 'Halaman Tidak Ditemukan',
  'errors.notFoundTitle': 'Halaman Tidak Ditemukan',
  'errors.notFoundBody':
    'Halaman yang Anda cari tidak ada atau sudah dihapus.',
  'errors.forbiddenBody':
    'Anda tidak punya izin yang diperlukan untuk membuka halaman ini.',
  'errors.unauthorizedBody':
    'Silakan masuk dengan akun yang sesuai untuk membuka halaman ini.',
  'errors.maintenanceBody':
    'Situs sedang tidak tersedia. Kami akan kembali segera.',
  'errors.general': 'Terjadi Kesalahan',
  'errors.generalTitle': 'Terjadi kesalahan',
  'errors.generalBody': 'Maaf atas ketidaknyamanannya. Silakan coba lagi nanti.',
  'errors.goBack': 'Kembali',
  'errors.backHome': 'Ke beranda',
  'errors.maintenance': 'Dalam Perbaikan',

  'footer.company':
    'TSB · Warehouse Time Slot Booking — PT Sankyu Indonesia',
  'footer.location': 'Gudang Cikarang · Shift 1',
} as const
