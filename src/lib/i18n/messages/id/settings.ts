export const settings = {
  'settings.title': 'Pengaturan',
  'settings.description':
    'Semua di sini langsung memengaruhi kuota slot dan kebijakan booking. Simpan per seksi agar perubahan kecil tidak menimpa yang lain.',
  'settings.allSaved': 'Semua tersimpan',
  'settings.dirtyCount': '{count} seksi belum disimpan',
  'settings.loading': 'Memuat pengaturan...',
  'settings.navAria': 'Seksi pengaturan',
  'settings.navEmpty':
    'Tidak ada perubahan tertunda. Setiap seksi disimpan sendiri.',
  'settings.navDirty': '{count} seksi berubah dan belum dikirim ke server.',
  'settings.manualModeOn': 'Mode manual aktif',
  'settings.unsaved': 'Belum disimpan',

  'settings.group.warehouse': 'Gudang',
  'settings.group.brand': 'Merek',
  'settings.group.operations': 'Operasional',
  'settings.group.policy': 'Kebijakan',
  'settings.group.preferences': 'Preferensi',

  'settings.tab.identity': 'Identitas gudang',
  'settings.tab.brand': 'Identitas merek',
  'settings.tab.login': 'Halaman masuk',
  'settings.tab.hours': 'Jam operasional',
  'settings.tab.arrival': 'Aturan kedatangan',
  'settings.tab.window': 'Jendela pemesanan',
  'settings.tab.approval': 'Persetujuan booking',
  'settings.tab.language': 'Bahasa',
  'settings.tab.ticket': 'Desain tiket',
  'settings.tab.appearance': 'Tampilan',

  'settings.saved.identity': 'Identitas gudang disimpan',
  'settings.saved.brand': 'Identitas merek disimpan',
  'settings.saved.login': 'Halaman masuk disimpan',
  'settings.saved.hours': 'Jam operasional disimpan',
  'settings.saved.arrival': 'Aturan kedatangan disimpan',
  'settings.saved.window': 'Jendela pemesanan disimpan',
  'settings.saved.approval': 'Kebijakan persetujuan disimpan',
  'settings.saved.ticket': 'Desain tiket disimpan',

  'settings.panel.dirty': 'Perubahan di seksi ini belum dikirim ke server.',
  'settings.panel.clean': 'Tidak ada perubahan pada seksi ini.',
  'settings.panel.save': 'Simpan',
  'settings.panel.reset': 'Batalkan',
  'settings.panel.saving': 'Menyimpan',
  'settings.panel.unsaved': 'Belum disimpan',

  'settings.identity.title': 'Identitas gudang',
  'settings.identity.description':
    'Nama ini tercetak di tiket supir dan dipakai sebagai nama gudang pertama di Master Data. Keduanya ditulis bersamaan oleh server, jadi tidak mungkin berbeda.',
  'settings.identity.name': 'Nama gudang',
  'settings.identity.nameHint':
    'Minimal 2 karakter, maksimal 120. Nama gudang lain di Master Data tidak boleh sama.',
  'settings.identity.codePrefix': 'Awalan kode booking',
  'settings.identity.codePrefixHint':
    'Tepat 3 huruf atau angka, misalnya TSB atau TKT. Hanya kode booking yang dibuat setelah ini yang memakai awalan baru; tiket yang sudah tercetak tetap bisa dipindai karena kode dikenali dari bentuknya, bukan dari awalannya.',

  'settings.brand.title': 'Identitas merek',
  'settings.brand.description':
    'Logo, judul, dan subjudul yang tampil di kepala sidebar, halaman masuk, dan judul tab peramban. Bukan nama gudang — identitas gudang tetap di seksi Identitas gudang.',
  'settings.brand.footer':
    'Berlaku untuk semua pengguna setelah disimpan. Halaman tiket supir tetap memakai nama perusahaan customer, bukan judul ini.',
  'settings.brand.appName': 'Judul aplikasi',
  'settings.brand.appNameHint':
    '1–60 karakter. Huruf pertama dipakai sebagai lencana saat logo belum diunggah.',
  'settings.brand.tagline': 'Subjudul',
  'settings.brand.taglineHint':
    'Baris kecil di bawah judul. Boleh dikosongkan untuk menampilkan judul saja.',
  'settings.brand.shortName': 'Nama pendek',
  'settings.brand.shortNameHint':
    'Untuk judul tab peramban dan layar sempit. Kosongkan agar memakai judul aplikasi.',
  'settings.brand.optional': 'Opsional',
  'settings.brand.footerCompany': 'Teks footer · baris pertama',
  'settings.brand.footerCompanyHint':
    'Tampil setelah tahun berjalan. Kosongkan agar memakai teks bawaan sesuai bahasa aktif.',
  'settings.brand.footerLocation': 'Teks footer · baris kedua',
  'settings.brand.footerLocationHint':
    'Lokasi dan shift di ujung footer. Kosongkan agar memakai teks bawaan.',
  'settings.brand.footerShowLocation': 'Tampilkan baris lokasi',
  'settings.brand.footerShowLocationHint':
    'Matikan bila lokasi sudah Anda tulis di baris pertama, supaya tidak tampil dua kali.',
  'settings.brand.preview': 'Pratinjau',
  'settings.brand.previewNote':
    'Nama pendek dipakai sebagai judul tab; kalau kosong, judul aplikasi yang dipakai.',

  'settings.logo.label': 'Logo aplikasi',
  'settings.logo.hint':
    'PNG atau JPG, maksimal 2 MB. Latar transparan paling aman. Kosongkan untuk memakai huruf pertama judul.',
  'settings.logo.sidebar': 'Sidebar',
  'settings.logo.tabIcon': 'Ikon tab',
  'settings.logo.uploading': 'Mengunggah…',
  'settings.logo.replace': 'Ganti logo',
  'settings.logo.upload': 'Unggah logo',
  'settings.logo.remove': 'Hapus',

  'settings.login.title': 'Halaman masuk',
  'settings.login.description':
    'Kalimat sambutan dan tampilan panel kanan di halaman masuk. Yang diubah di sini hanya yang dilihat sebelum masuk.',
  'settings.login.footer':
    'Teks sambutan tampil juga di ponsel di bawah nama aplikasi; gambar panel hanya di layar lebar.',
  'settings.login.descriptionLabel': 'Teks sambutan',
  'settings.login.descriptionHint':
    '1–{max} karakter. Kosongkan untuk memakai teks bawaan.',
  'settings.login.cover': 'Gambar panel masuk',
  'settings.login.coverHint':
    'PNG atau JPG, maksimal 2 MB. Hanya tampil di layar lebar — di ponsel formulir memakai seluruh layar.',
  'settings.login.coverPreviewAlt': 'Pratinjau gambar panel masuk',
  'settings.login.noImage': 'Belum ada gambar',
  'settings.login.replaceImage': 'Ganti gambar',
  'settings.login.uploadImage': 'Unggah gambar',
  'settings.login.brandColor': 'Warna aksen',
  'settings.login.brandColorHint':
    'Dipakai sebagai warna dasar panel dan lapisan gelap di atas gambar. Kosongkan untuk memakai warna tema.',
  'settings.login.pickColor': 'Pilih warna aksen',
  'settings.login.useColor': 'Pakai warna {color}',
  'settings.login.clearColor': 'Kosongkan',
  'settings.login.previewMobile': 'Pratinjau di ponsel',
  'settings.login.previewSignIn': 'Masuk',
  'settings.login.previewHint':
    'Gunakan email dan password yang diberikan Admin gudang.',
  'settings.login.previewWide':
    'Di layar lebar, kalimat yang sama tampil di panel kanan bersama gambar.',

  'settings.hours.title': 'Jam operasional',
  'settings.hours.description':
    'Menentukan slot mana yang bisa dipesan hari ini. Setiap blok dimulai dari jam buka, jadi rentangnya wajib habis dibagi satuan blok.',
  'settings.hours.footer':
    'Kapasitas per blok saat ini {loading} loading dan {unloading} unloading — mengikuti jumlah dock aktif di Master Data, bukan diatur di sini.',
  'settings.hours.open': 'Jam buka',
  'settings.hours.openHint': 'Blok pertama dimulai tepat pada jam ini.',
  'settings.hours.close': 'Jam tutup',
  'settings.hours.closeHint':
    'Tidak ada blok yang dimulai setelah jam ini; blok terakhir harus selesai tepat waktu.',
  'settings.hours.unit': 'Satuan blok',
  'settings.hours.unitHint':
    'Ukuran satu slot. Mengubahnya mengubah jumlah blok per hari dan seluruh ketersediaan; booking lama tetap memakai blok yang sudah dikunci.',
  'settings.hours.summary': 'Rentang {hours} = {duration}, berisi {blocks}.',

  'settings.arrival.title': 'Aturan kedatangan',
  'settings.arrival.description':
    'Dua ambang ini dipakai petugas gate dan cron penanda tidak datang. Keduanya soal toleransi waktu, bukan kuota.',
  'settings.arrival.grace': 'Masa tenggang',
  'settings.arrival.graceHint':
    'Truk yang datang dalam {minutes} menit setelah jadwal masih dihitung tepat waktu. Lewat dari itu masuk antrean terlambat.',
  'settings.arrival.early': 'Batas datang awal',
  'settings.arrival.earlyHint':
    'Gate-in ditolak bila truk datang lebih awal dari {minutes} menit sebelum jadwal.',
  'settings.arrival.warning':
    'Batas datang awal jauh lebih longgar dari masa tenggang. Truk bisa menumpuk di area tunggu sebelum slotnya dimulai.',

  'settings.window.title': 'Jendela pemesanan',
  'settings.window.description':
    'Seberapa jauh ke depan customer boleh memesan. Semakin panjang, semakin banyak slot yang harus disiapkan untuk setiap jenis aktivitas.',
  'settings.window.days': 'Hari ke depan',
  'settings.window.daysHint':
    'Hari ini ikut dihitung. Customer tidak bisa memesan di luar rentang ini, termasuk lewat tautan langsung.',
  'settings.window.today': 'Hari ini',
  'settings.window.thisWeek': 'Minggu ini',
  'settings.window.thisMonth': 'Se bulan',
  'settings.window.daysUnit': '{count} hari',

  'settings.approval.title': 'Persetujuan booking',
  'settings.approval.description':
    'Mengubah siapa yang boleh booking tanpa antre. Setiap perubahan mode dicatat di jejak audit beserta admin yang melakukannya.',
  'settings.approval.mode': 'Mode',
  'settings.approval.modeAutoHint':
    'Setiap booking langsung sah dan langsung mengunci kuota slot.',
  'settings.approval.modeManualHint':
    'Hanya customer bertanda "booking otomatis" di halaman Pengguna yang lolos; sisanya menunggu keputusan Admin.',
  'settings.approval.modeAuto': 'Otomatis — semua langsung disetujui',
  'settings.approval.modeManual': 'Manual — perlu persetujuan Admin',
  'settings.approval.lead': 'Tenggat sebelum kedatangan',
  'settings.approval.leadHint':
    'Keputusan harus selesai sekian menit sebelum jam kedatangan, kalau tidak booking kedaluwarsa dan kuotanya dilepas.',
  'settings.approval.minDecision': 'Jendela keputusan minimum',
  'settings.approval.minDecisionHint':
    'Booking mendesak tetap punya sekian menit untuk diputuskan, meski tenggat di atas sudah lewat.',
  'settings.approval.urgent': 'Ambang label mendesak',
  'settings.approval.urgentHint':
    'Hanya memengaruhi penanda di antrean admin, bukan keputusan atau kuota.',
  'settings.approval.autoFlag': 'Booking langsung sah',
  'settings.approval.manualFlag': 'Sebagian booking menunggu admin',
  'settings.approval.auto': 'Otomatis',
  'settings.approval.manual': 'Manual',
  'settings.impact.blocks': '{count} blok',

  'settings.language.title': 'Bahasa',
  'settings.language.description':
    'Pilih bahasa antarmuka. Tanggal, angka, dan label status ikut menyesuaikan bahasa yang aktif.',
  'settings.language.footer':
    'Bisa juga diubah dari pengalih bahasa di kepala sidebar dan bilah atas ponsel.',

  'settings.appearance.title': 'Tampilan',
  'settings.appearance.description':
    'Preferensi peramban ini, bukan bagian dari pengaturan gudang. Tersimpan di perangkat Anda dan tidak ikut terkirim saat seksi lain disimpan.',
  'settings.appearance.footer':
    'Bisa juga diubah dari menu Tema di kaki sidebar.',
  'settings.appearance.aria': 'Tema tampilan',
  'settings.appearance.light': 'Terang',
  'settings.appearance.lightDesc': 'Latar putih, nyaman di ruangan terang.',
  'settings.appearance.dark': 'Gelap',
  'settings.appearance.darkDesc':
    'Latar gelap, mengurangi silau di malam hari.',
  'settings.appearance.system': 'Ikuti sistem',
  'settings.appearance.systemDesc': 'Menyesuaikan pengaturan perangkat Anda.',
  'settings.appearance.active': 'Aktif sekarang {theme}',
  'settings.appearance.followSystem': ' — mengikuti perangkat',

  'settings.ticket.title': 'Desain tiket',
  'settings.ticket.description':
    'Tampilan kartu tiket supir. Desain yang dipilih berlaku untuk semua tiket — yang tampil di layar, hasil cetak, dan PNG yang dikirim lewat WhatsApp.',
  'settings.ticket.footer':
    'Isi tiket tidak berubah karena desain: delapan nilai dan QR tetap ada. Tiket yang tautannya dibuka ulang juga ikut desain terpilih.',
  'settings.ticket.legend': 'Pilih desain tiket',
  'settings.ticket.preview': 'Pratinjau desain',
  'settings.ticket.previewNote':
    'Data di atas hanya contoh, bukan booking sungguhan. Nama aplikasi dan logo mengikuti seksi Identitas merek.',
  'settings.ticket.classic': 'Klasik Biru',
  'settings.ticket.classicHint':
    'Biru penuh dengan pita sobek. Paling akrab bagi supir yang sudah biasa dengan tiket lama.',
  'settings.ticket.minimal': 'Minimal Putih',
  'settings.ticket.minimalHint':
    'Putih bersih dengan tanggal besar di samping QR. Paling terbaca saat dicetak hitam-putih.',
  'settings.ticket.navy': 'Navy Resmi',
  'settings.ticket.navyHint':
    'Pita navy dan kartu QR yang menonjol. Paling tegas untuk gudang dengan banyak dokumen.',
  'settings.ticket.groupStandard': 'Tampilan standar',
  'settings.ticket.groupSpecial': 'Untuk kondisi tertentu',
  'settings.ticket.thermal': 'Termal Mono',
  'settings.ticket.thermalHint':
    'Hitam putih tanpa warna. Untuk printer thermal dan fotokopi yang pudar.',
  'settings.ticket.largeCode': 'Kode Besar',
  'settings.ticket.largeCodeHint':
    'Kode booking paling besar di kartu. Untuk petugas yang mengetik kode saat QR gagal dipindai.',
  'settings.ticket.night': 'Malam',
  'settings.ticket.nightHint':
    'Kartu gelap agar tidak menyilaukan di gerbang malam. QR tetap di alas putih.',
  'settings.ticket.tearoff': 'Pita Sobek',
  'settings.ticket.tearoffHint':
    'Stub bawah berisi kode, tanggal, dock, dan plat untuk disobek petugas gate.',
  'settings.ticket.brand': 'Warna Merek',
  'settings.ticket.brandHint':
    'Pita atas memakai warna merek dari halaman masuk. Warna terang digelapkan agar teks tetap terbaca.',

  'settings.summary.aria': 'Ringkasan operasional',
  'settings.summary.title': 'Berlaku di mesin kuota',
  'settings.summary.saved': 'Sesuai pengaturan tersimpan',
  'settings.summary.dirty': '{count} seksi diubah, belum disimpan',
  'settings.summary.hours': 'Jam operasional',
  'settings.summary.blocks': 'Blok per hari',
  'settings.summary.grace': 'Masa tenggang',
  'settings.summary.window': 'Jendela pesan',
  'settings.summary.approval': 'Persetujuan',
  'settings.summary.unsavedOne': 'belum disimpan',
  'settings.summary.range': '{open} sampai {close}',
  'settings.summary.rangeInvalid': 'Rentang jam belum valid',
  'settings.summary.blocksFilled': '{count} blok terisi',
  'settings.summary.noBlocks': 'Tidak ada blok',
  'settings.summary.timelineAria':
    'Jendela operasional {open} sampai {close}, {count} blok',
  'settings.summary.timelineAriaInvalid': 'Jendela operasional belum valid',

  'settings.unit.minutes': 'menit',
  'settings.unit.days': 'hari',

  'settings.error.warehouseMin': 'Nama gudang minimal 2 karakter.',
  'settings.error.warehouseMax': 'Nama gudang maksimal 120 karakter.',
  'settings.error.bookingCodePrefix':
    'Awalan kode booking harus tepat 3 huruf atau angka, misalnya TSB.',
  'settings.error.appNameRequired': 'Judul aplikasi wajib diisi.',
  'settings.error.appNameMax': 'Judul aplikasi maksimal 60 karakter.',
  'settings.error.taglineMax': 'Subjudul maksimal 80 karakter.',
  'settings.error.shortNameMax': 'Nama pendek maksimal 20 karakter.',
  'settings.error.footerCompanyMax': 'Teks footer maksimal 200 karakter.',
  'settings.error.footerLocationMax': 'Lokasi footer maksimal 120 karakter.',
  'settings.error.logo':
    'Logo harus PNG atau JPG yang diunggah dari sini, atau alamat https.',
  'settings.error.loginMax': 'Teks sambutan maksimal {max} karakter.',
  'settings.error.image':
    'Gambar harus PNG atau JPG yang diunggah dari sini, atau alamat https.',
  'settings.error.color': 'Warna aksen harus format #RRGGBB.',
  'settings.error.unitRange': 'Satuan blok harus angka 15–120 menit.',
  'settings.error.hoursRequired': 'Jam buka dan jam tutup wajib diisi.',
  'settings.error.hoursOrder': 'Jam tutup harus setelah jam buka.',
  'settings.error.unitRemainder':
    'Rentang {span} menit tidak habis dibagi satuan blok {unit} menit.',
  'settings.error.graceRange': 'Masa tenggang harus 0–240 menit.',
  'settings.error.earlyRange': 'Batas datang awal harus 0–480 menit.',
  'settings.error.windowRange': 'Jendela pemesanan harus 1–90 hari.',
  'settings.error.leadRange': 'Tenggat keputusan harus 5–2880 menit.',
  'settings.error.minDecisionRange':
    'Jendela keputusan minimum harus 5–1440 menit.',
  'settings.error.urgentRange': 'Ambang label mendesak harus 0–14400 menit.',

  'settings.note.hours':
    '{minutes} menit di ujung jam operasional tidak masuk blok mana pun, jadi tidak bisa dipesan.',
} as const
