# Rencana: pindah penyimpanan ke Google Sheets

Status: **rencana, belum dikerjakan.** Mulai setelah demo ke customer.
Dibuat: 23 November 2026.

## Tujuan

- Hapus layar login. Satu perangkat kasir, satu pemilik.
- Data tersimpan sebagai spreadsheet di Google Drive pemilik: bisa dibuka, dibaca, dan dicadangkan langsung.
- Supabase tidak lagi dipakai (tetap utuh sebagai cadangan sampai semuanya terbukti jalan).

## Keputusan yang dibutuhkan dari pemilik

| # | Pertanyaan | Pilihan | Rekomendasi |
|---|---|---|---|
| 1 | Pengaman akses | (a) kunci rahasia sederhana di `config.js` (b) tanpa pengaman | (a). Tanpa kunci, siapa pun yang tahu URL Apps Script bisa baca dan tulis. |
| 2 | Supabase setelah selesai | (a) dibiarkan sebagai cadangan (b) dihapus | (a) selama 1-2 minggu pertama, lalu hapus. |
| 3 | Foto produk | (a) simpan di Google Drive (b) tetap di Supabase Storage | (a). Unggah ke Storage sekarang butuh login, jadi tidak bisa dipertahankan tanpa login. |
| 4 | Nama toko di app, judul tab, home screen | "Warkop POS" atau "Warung Kopi Fauget" | Mengikuti logo. |

## Arsitektur

```
HP kasir (PWA)
  localStorage = sumber data utama + antrean (outbox)
        |  kirim batch di latar belakang (fetch POST)
        v
Google Apps Script (web app, di dalam spreadsheet)
        |  tulis/baca baris
        v
Google Sheets di Drive pemilik: Produk | Transaksi | Item | Pengeluaran
```

Prinsip tidak berubah dari sekarang: app tetap offline-first. Setiap perubahan masuk antrean lokal, lalu dikirim dengan retry 5 dtk, 15 dtk, 60 dtk. Item antrean dihapus hanya setelah server menjawab sukses. Kasir tidak pernah menunggu Google.

## Struktur spreadsheet

Satu file Google Sheets, empat tab. Baris pertama adalah header. Kolom `id` (UUID dari app) dipakai untuk upsert.

- **Produk:** id, nama, harga_jual, modal, kategori, aktif, foto_url, dibuat, diubah, dihapus
- **Transaksi:** id, tanggal, waktu, metode, total, diterima, kembalian, modal_total, laba_kotor, diubah
- **Item:** id_transaksi, produk_id, nama, harga, modal, qty (satu baris per item, supaya mudah dibuat pivot)
- **Pengeluaran:** id, tanggal, kategori, nominal, catatan, diubah, dihapus

Transaksi dan item disimpan terpisah di sheet agar enak dianalisis. Di app, item tetap satu paket di dalam transaksi seperti sekarang.

## Apps Script (ditulis saya, ditempel pemilik sekali)

- `doPost(e)`: menerima `{token, table, rows[]}`. Cek token, lalu upsert per `id` di dalam `LockService` (mencegah dua tulis bersamaan merusak baris). Mengembalikan `{ok:true, saved:n}`.
- `doGet(e)`: menerima `?token=...&table=...&since=...`. Dipakai untuk memulihkan data di HP baru atau setelah data lokal hilang.
- Upsert cepat: baca kolom `id` sekali, buat peta id ke nomor baris, lalu tulis batch dengan `setValues`, bukan sel satu per satu.
- Foto: menerima gambar base64, menyimpannya ke folder Drive "Foto Produk" (publik hanya-baca), lalu mengembalikan tautan gambar.
- Dipublikasikan sebagai Web app: *Execute as: Me*, *Who has access: Anyone*.
- Batasan Apps Script: permintaan dari browser memakai `Content-Type: text/plain` agar tidak memicu preflight CORS. Jawaban melewati satu pengalihan (redirect) yang diikuti otomatis oleh `fetch`.

## Perubahan di app

| Bagian | Perubahan |
|---|---|
| `app.js` sinkronisasi | Ganti pemanggilan `supabase-js` dengan `sheets-sync.js` (kirim batch outbox, pulihkan data). Logika outbox, retry, dan last-write-wins berdasarkan `updated_at` dipertahankan. |
| Login | Hapus layar login, deteksi sesi, dan tombol keluar. Pengaturan tinggal status sinkron dan cadangan. |
| `config.js` | Isi `SHEETS_URL` dan `SHEETS_TOKEN`. Hapus kunci Supabase. |
| Foto produk | Unggah ke Apps Script, simpan tautan di `foto_url` (kolom `image_url` di data lokal). |
| Service worker | Jangan cache panggilan ke `script.google.com`. |
| Skema `supabase/` dan `schema.sql` | Dipertahankan di repo sebagai arsip. |
| Status sinkron | Teks "Tersinkron" mengikuti jawaban Apps Script. |

## Memindahkan data yang sudah ada

1. Di Supabase, ekspor tabel `products`, `transactions`, `expenses` (saya yang menjalankan lewat koneksi yang sudah ada).
2. Format ke bentuk sheet di atas dan impor ke spreadsheet baru.
3. Cocokkan jumlah baris dan total omzet antara Supabase dan sheet sebelum cutover.
4. Hapus transaksi uji demo dari kedua sisi.

## Urutan pengerjaan

1. Pemilik membuat Google Sheets kosong. Saya siapkan skrip Apps Script lengkap, pemilik menempel dan men-deploy, lalu memberi saya URL web app. (Token dibuat bersama-sama.)
2. Uji Apps Script terpisah: tulis, baca, upsert id yang sama, tulis banyak, token salah ditolak.
3. Tulis `sheets-sync.js` dan sambungkan ke outbox. Hapus login. Ini dikerjakan di cabang `sheets` dulu, bukan di `main`.
4. Uji di browser: transaksi, edit produk, pengeluaran, matikan internet lalu hidupkan lagi (antrean terkirim), ekspor PDF dan Excel, unggah foto.
5. Migrasi data lama dan cocokkan total.
6. Gabungkan ke `main`, deploy ke Netlify, uji sekali lagi di HP kasir.
7. Siapkan rollback: tag git versi Supabase terakhir (`v-supabase`), dan Supabase tidak dihapus.

## Pengujian yang harus lolos sebelum cutover

- Transaksi tunai dan QRIS muncul di sheet dalam waktu singkat setelah dibuat.
- Offline: 10 transaksi dibuat tanpa internet, lalu semuanya masuk setelah online, tanpa duplikat.
- Mengirim batch yang sama dua kali tidak membuat baris dobel (idempoten).
- Token salah ditolak dan app menampilkan pesan yang jelas.
- Total omzet, modal, dan laba di Logbook sama dengan jumlah di sheet.
- Hapus data lokal, buka app, lalu data pulih dari sheet.
- Foto produk tampil setelah unggah dan tetap tampil setelah muat ulang.
- Ekspor PDF dan Excel tidak berubah dibanding sekarang.

## Risiko dan mitigasi

| Risiko | Mitigasi |
|---|---|
| URL dan token terbaca dari kode situs | Terima risikonya (satu toko), pakai token acak panjang, dan jangan sebar URL situs. Token bisa diganti kapan saja di skrip dan `config.js`. |
| Kuota harian Apps Script | Kirim per batch (maksimal 200 baris per permintaan). Kebutuhan warkop jauh di bawah batas. |
| Google mengubah kebijakan Apps Script | Data tetap ada di Sheets dan di HP. Ekspor Excel selalu tersedia. |
| Sheet diedit manual dan merusak format | Lindungi baris header. App hanya menulis berdasarkan nama kolom. |
| Data lokal hilang sebelum sempat terkirim | Antrean disimpan di HP dan tombol cadangan JSON tetap ada. |

## Perkiraan waktu

Sekitar 3-4 jam kerja, di luar waktu pemilik membuat sheet dan men-deploy skrip (sekitar 10 menit dengan panduan).

## Yang saya butuhkan dari pemilik setelah demo

1. Jawaban untuk 4 keputusan di atas.
2. Spreadsheet Google kosong, lalu URL web app Apps Script setelah skrip ditempel.
