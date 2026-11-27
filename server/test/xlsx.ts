import type ExcelJS from 'exceljs'

/**
 * Membaca berkas XLSX dari isi respons HTTP.
 *
 * Cast-nya bukan karena bentuk datanya berbeda, melainkan karena `exceljs`
 * mengetik `load(buffer: Buffer)` dengan `Buffer` yang tidak dapat dipertukarkan
 * dengan `Buffer` global dari `@types/node` 25: parameter generiknya
 * (`ArrayBuffer` vs `ArrayBufferLike`) bersifat invarian lewat `slice()`, jadi
 * dua tipe yang identik saat dijalankan tetap ditolak compiler. Tanpa helper ini
 * setiap berkas tes harus menulis cast yang sama.
 */
export function loadWorkbook(workbook: ExcelJS.Workbook, bytes: Buffer) {
  return workbook.xlsx.load(bytes as unknown as Parameters<ExcelJS.Xlsx['load']>[0])
}
