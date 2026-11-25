/**
 * Pengaturan Akun — halaman milik setiap peran, bukan hanya Admin.
 *
 * Kalimatnya ditulis dari sudut pandang pengguna ("perangkat ini tetap masuk"),
 * bukan dari sudut pandang mesin ("sesi lain dicabut"), karena halaman ini
 * dibuka justru saat orang ingin tahu apa yang akan terjadi pada akunnya.
 *
 * Berkas ini adalah SUMBER kunci, jadi tipenya objek biasa — bukan
 * `Record<Extract<MessageKey, ...>>`. `MessageKey` diturunkan dari kamus ini,
 * sehingga menautkannya ke sini membuat lingkaran dan seluruh kunci hilang.
 */
export const account = {
  'account.title': 'Pengaturan Akun',
  'account.description': 'Kelola profil, email, dan kata sandi Anda.',
  'account.role': 'Peran',
  'account.company': 'Perusahaan',
  'account.memberSince': 'Terdaftar sejak',

  'account.profile.title': 'Profil',
  'account.profile.description':
    'Nama dan nomor HP yang dipakai rekan kerja untuk mengenali Anda. Email dan peran diatur di seksi lain.',
  'account.profile.name': 'Nama lengkap',
  'account.profile.nameHint': 'Minimal 2 karakter.',
  'account.profile.phone': 'Nomor HP',
  'account.profile.phoneHint':
    'Opsional. Dipakai Admin bila perlu menghubungi Anda soal jadwal.',
  'account.profile.saved': 'Profil diperbarui.',

  'account.email.title': 'Email',
  'account.email.description':
    'Email ini dipakai untuk masuk. Setelah diganti, perangkat lain yang masih masuk ke akun ini akan dikeluarkan.',
  'account.email.current': 'Email sekarang',
  'account.email.new': 'Email baru',
  'account.email.repeat': 'Ulangi email baru',
  'account.email.password': 'Kata sandi saat ini',
  'account.email.passwordHint':
    'Diperlukan supaya orang yang menemukan perangkat Anda tidak bisa mengganti emailnya.',
  'account.email.saved': 'Email diperbarui. Perangkat lain sudah dikeluarkan.',
  'account.email.invalid': 'Format email tidak valid.',
  'account.email.same': 'Email baru sama dengan email sekarang.',
  'account.email.mismatch': 'Kedua email belum sama.',
  'account.email.passwordMissing': 'Masukkan kata sandi Anda saat ini.',

  'account.password.title': 'Kata sandi',
  'account.password.description':
    'Minimal 7 karakter. Setelah diganti, perangkat lain dikeluarkan dan harus masuk ulang; perangkat ini tetap masuk.',
  'account.password.current': 'Kata sandi sekarang',
  'account.password.new': 'Kata sandi baru',
  'account.password.repeat': 'Ulangi kata sandi baru',
  'account.password.savedNone': 'Kata sandi diperbarui.',
  'account.password.savedRevoked':
    'Kata sandi diperbarui. {count} perangkat lain dikeluarkan.',
  'account.password.currentMissing': 'Masukkan kata sandi Anda sekarang.',
  'account.password.tooShort': 'Kata sandi baru minimal 7 karakter.',
  'account.password.same': 'Kata sandi baru sama dengan yang sekarang.',
  'account.password.mismatch': 'Kedua kata sandi baru belum sama.',

  'account.sessions.title': 'Perangkat & sesi',
  'account.sessions.description':
    'Jumlah perangkat yang masih masuk ke akun ini. Bila Anda melihat perangkat yang tidak Anda kenali, keluarkan semuanya lalu ganti kata sandi.',
  'account.sessions.count': '{count} perangkat sedang masuk',
  'account.sessions.countOne': '1 perangkat sedang masuk',
  'account.sessions.onlyThis': 'Hanya perangkat ini.',
  'account.sessions.revoke': 'Keluarkan perangkat lain',
  'account.sessions.revokeHint':
    'Perangkat ini tetap masuk. Sisanya harus masuk ulang dengan kata sandi.',
  'account.sessions.confirmTitle': 'Keluarkan perangkat lain?',
  'account.sessions.confirmBody':
    'Semua sesi selain perangkat ini akan berakhir. Perangkat ini tetap masuk.',
  'account.sessions.confirm': 'Ya, keluarkan',
  'account.sessions.cancel': 'Batal',
  'account.sessions.revoked': '{count} perangkat dikeluarkan.',
  'account.sessions.revokedNone': 'Tidak ada perangkat lain yang sedang masuk.',

  'account.help.title': 'Butuh bantuan?',
  'account.help.body':
    'Akun tidak bisa dihapus sendiri. Hubungi Admin gudang bila Anda perlu menonaktifkan akun atau memulihkan akses.',
  'account.help.warehouseSettings': 'Buka Pengaturan Gudang',
}