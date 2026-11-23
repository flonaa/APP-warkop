# Warkop HCR

Aplikasi Point of Sale sederhana untuk warkop berbasis HTML, CSS, dan JavaScript vanilla. Aplikasi memakai Supabase untuk autentikasi dan sinkronisasi, tetap dapat dipakai saat offline melalui cache lokal, dan dapat dipasang sebagai PWA di Android maupun iOS tanpa build step.

## Fitur

- Kasir dengan filter kategori, keranjang, pembayaran tunai, dan QRIS.
- Manajemen produk, kategori, harga, dan status tampil di kasir.
- Pencatatan pengeluaran bulanan.
- Logbook per hari dengan filter tanggal dan ringkasan laba.
- Ekspor PDF dan Excel.
- Login email dan kata sandi melalui Supabase Auth.
- Sinkronisasi otomatis dua arah dengan Supabase.
- Antrean outbox lokal, retry backoff, dan status sinkron di antarmuka.
- Soft delete produk dan pengeluaran.
- Backup JSON dari seluruh cache lokal.
- Service worker untuk pemakaian tanpa jaringan.
- Tema gelap bernuansa kopi, mobile-first, dan aman untuk safe area iPhone.

## Struktur File

```text
warkop-pos/
  index.html
  styles.css
  app.js
  sw.js
  manifest.webmanifest
  config.js
  supabase/
    schema.sql
  icons/
    logo-badge.png
    icon-192.png
    icon-512.png
  tools/
    generate-icons.py
```

## Konfigurasi Supabase

### 1. Buat proyek Supabase

Buat proyek baru di [supabase.com](https://supabase.com). Frontend hanya memerlukan Project URL dan anon public key. Jangan pernah memakai service_role key di frontend.

### 2. Jalankan skema database

1. Buka proyek Supabase.
2. Masuk ke SQL Editor.
3. Buka [supabase/schema.sql](supabase/schema.sql), salin seluruh isinya, lalu jalankan.

Skema membuat tabel `products`, `transactions`, dan `expenses`, indeks, trigger `updated_at`, RLS, serta policy hanya untuk role `authenticated`.

### 3. Buat satu akun pemilik

1. Buka Authentication > Users.
2. Tambahkan user dengan email dan kata sandi pemilik warkop.
3. Pastikan email sudah dikonfirmasi agar bisa langsung masuk.
4. Nonaktifkan pendaftaran publik di pengaturan Authentication jika tidak diperlukan.

Aplikasi tidak menyediakan halaman daftar. Akun sengaja dibuat manual dari dashboard Supabase.

### 4. Isi config.js

Buka [config.js](config.js) dan isi:

```js
window.WARKOP_CONFIG = {
  SUPABASE_URL: 'https://PROJECT-REF.supabase.co',
  SUPABASE_ANON_KEY: 'ANON-PUBLIC-KEY'
};
```

Ambil kedua nilai dari Project Settings > API. Gunakan anon public key, bukan service_role key. Aplikasi akan menolak key yang terdeteksi sebagai service_role.

Jika `config.js` masih kosong, aplikasi berjalan dalam mode lokal tanpa login dan tanpa sinkronisasi. Mode ini berguna untuk mencoba antarmuka, tetapi data hanya tersimpan di perangkat.

## Cara Kerja Sinkronisasi

Cache lokal memakai localStorage dengan satu key:

```text
warkop-pos-v2
```

Isi cache:

```js
{
  products: [],
  trx: [],
  expenses: [],
  outbox: [],
  lastSyncAt: null
}
```

Alur perubahan:

1. Perubahan langsung ditulis ke cache lokal.
2. Perubahan masuk ke `outbox` sebagai `{ id, table, op: "upsert", payload, createdAt }`.
3. Jika online dan sudah login, item outbox dikirim dengan upsert `onConflict: "id"`.
4. Item outbox dihapus hanya setelah Supabase membalas sukses.
5. Jika gagal, aplikasi mencoba lagi setelah 5 detik, 15 detik, 60 detik, lalu setiap 60 detik.
6. Aplikasi menarik baris dengan `updated_at > lastSyncAt` saat dibuka, saat kembali online, dan saat kembali ke foreground.
7. Konflik data diselesaikan dengan last-write-wins berdasarkan `updated_at`. Data lokal yang masih menunggu di outbox tidak ditimpa oleh tarikan remote.
8. Produk dan pengeluaran memakai soft delete `deleted_at` agar penghapusan ikut tersinkron.
9. Transaksi menyimpan snapshot nama dan harga produk, sehingga rename atau perubahan harga tidak mengubah transaksi lama.

Transaksi tidak memiliki tombol edit atau hapus di UI. ID semua record dibuat di klien dengan `crypto.randomUUID()`.

### Status sinkron

- `Tersinkron` hijau: outbox kosong dan sinkron terakhir sukses.
- `Menunggu sinkron (N)` kuning: masih ada N item di outbox.
- `Offline` abu-abu: perangkat tidak memiliki koneksi.
- `Gagal sinkron` merah: error terakhir dari Supabase, ketuk untuk mencoba lagi.
- `Mode lokal` abu-abu: Supabase belum dikonfigurasi.

Tap status sinkron di bawah topbar untuk memicu sinkronisasi manual. Detail status dan akun tersedia lewat tombol pengaturan di kanan atas.

### Sesi dan keluar

- Session disimpan persisten dengan `persistSession: true`.
- Refresh token berjalan otomatis dengan `autoRefreshToken: true`.
- Jika sesi berakhir saat sinkronisasi, aplikasi mencoba refresh otomatis.
- Jika refresh gagal, layar login muncul. Cache dan outbox tetap tersimpan.
- Tombol Keluar ada di Pengaturan. Keluar tidak menghapus data lokal.

## Menjalankan Secara Lokal

Service worker membutuhkan HTTP atau HTTPS. Membuka `index.html` langsung lewat `file://` tidak akan mengaktifkan mode offline.

Dari folder `warkop-pos`, jalankan salah satu perintah berikut:

```bash
python -m http.server 8080
```

atau:

```bash
npx serve .
```

Lalu buka `http://localhost:8080`.

Isi [config.js](config.js) terlebih dahulu jika ingin menguji login dan sinkronisasi. Enam produk contoh akan diunggah ke Supabase pada sinkronisasi pertama jika database masih kosong. Pada perangkat kedua, data akan ditarik dari Supabase tanpa menggandakan produk contoh.

## Deploy Gratis dengan HTTPS

### GitHub Pages

1. Buat repository GitHub dan masukkan isi folder `warkop-pos` sebagai isi repository.
2. Buka `Settings > Pages`.
3. Pilih branch `main` dan folder `/ (root)`.
4. Simpan, lalu buka URL GitHub Pages yang diberikan.

### Netlify

1. Buka Netlify dan pilih `Add new site > Deploy manually`.
2. Tarik folder `warkop-pos` ke area deploy.
3. Netlify akan memberikan URL HTTPS otomatis.

### Vercel

1. Impor repository ke Vercel.
2. Pilih preset `Other` tanpa build command.
3. Gunakan root repository sebagai output directory.

## Install di Android

1. Buka aplikasi di Chrome melalui HTTPS.
2. Tekan menu tiga titik.
3. Pilih `Install app` atau `Add to Home screen`.
4. Buka dari ikon di layar utama.

## Install di iOS

1. Buka aplikasi di Safari melalui HTTPS.
2. Tekan tombol Share.
3. Pilih `Add to Home Screen`.
4. Buka dari ikon di layar utama.

iOS memakai `apple-touch-icon` yang disediakan di `index.html` karena ikon manifest tidak selalu dipakai untuk ikon home screen.

## Checklist Uji Manual

- Isi `config.js` dan pastikan layar login muncul.
- Masuk dengan akun pemilik dan pastikan status berubah menjadi Tersinkron.
- Matikan internet, buat transaksi, lalu nyalakan lagi. Cek tabel `transactions` di dashboard Supabase.
- Login di perangkat kedua dan pastikan produk serta transaksi sama.
- Rename produk dan pastikan transaksi lama tetap memakai nama lama.
- Ubah harga produk dan pastikan transaksi lama tidak berubah.
- Hapus produk, lalu pastikan produk hilang di perangkat lain tetapi barisnya masih ada dengan `deleted_at` terisi.
- Tambah dan hapus pengeluaran, lalu cek soft delete di tabel `expenses`.
- Coba uang tunai kurang dari total, lalu pastikan tombol Simpan nonaktif.
- Bayar dengan QRIS dan pastikan konfirmasi manual muncul.
- Cek logbook per hari, filter tanggal, dan tombol Hari ini, 7 hari, Bulan ini.
- Ekspor PDF dan Excel.
- Ekspor JSON dari Pengaturan, lalu coba pulihkan.
- Keluar dari akun, lalu masuk kembali dan pastikan outbox tidak hilang.
- Putuskan internet setelah aplikasi pernah dibuka, lalu refresh untuk memastikan mode offline bekerja.
- Buka di layar 360px, 430px, dan desktop untuk memastikan tidak ada overflow horizontal.

## Backup dan Keterbatasan

- Cache utama hanya tersimpan di localStorage perangkat.
- Sinkronisasi membutuhkan koneksi internet dan sesi login yang valid.
- Sinkronisasi tidak berjalan saat aplikasi benar-benar ditutup. Outbox akan dikirim saat aplikasi dibuka kembali dan online.
- Belum ada realtime subscription. Data remote ditarik saat aplikasi dibuka, kembali online, atau kembali ke foreground.
- Satu akun pemilik dipakai bersama oleh semua perangkat. Tidak ada pemisahan data per pengguna.
- Jam perangkat dipakai untuk `lastSyncAt`. Pastikan jam perangkat benar.
- Gunakan tombol Ekspor JSON di Pengaturan sebagai cadangan tambahan. Backup bukan pengganti sinkronisasi.
- Jika aplikasi di-deploy ulang dan service worker perlu diperbarui, naikkan `CACHE_VERSION` di [sw.js](sw.js) agar cache lama diganti dengan bersih. `config.js` selalu dicoba dari jaringan terlebih dahulu dengan fallback cache saat offline.

## Keamanan

- Hanya anon public key yang boleh berada di frontend.
- RLS aktif pada ketiga tabel.
- Semua policy select, insert, update, dan delete hanya untuk role `authenticated`.
- service_role key tidak boleh dimasukkan ke `config.js`. Aplikasi akan menolak key tersebut.
- Semua input pengguna di-escape sebelum dirender.
- Total transaksi dihitung ulang dari item sebelum dikirim ke Supabase.

## Membuat Ulang Ikon PNG

Script memakai modul standar Python tanpa pustaka eksternal.

```bash
python tools/generate-icons.py
```

File hasil akan ditulis ke `icons/icon-192.png` dan `icons/icon-512.png`.

## Pembaruan 1.2.0

- **Jalankan ulang `supabase/schema.sql`** di SQL Editor (aman diulang). Menambah kolom `synced_at`, trigger last-write-wins sungguhan, dan mengubah kolom uang ke `bigint`.
- Tarik data memakai `synced_at` (jam server), bukan `updated_at` (jam perangkat), sehingga data yang dibuat offline tetap sampai ke perangkat lain.
- Antrean dikirim per batch; item yang ditolak server (constraint) dipindah ke daftar "ditolak" dan tidak lagi memblokir antrean.
- File lokal memakai stale-while-revalidate: update aplikasi terambil otomatis pada pembukaan berikutnya.

## Pembaruan 1.3.0

- Harga modal per produk; laba bersih = omzet - modal (HPP) - pengeluaran. Modal disimpan sebagai snapshot di setiap item transaksi, jadi perubahan modal tidak mengubah laporan lama. Transaksi sebelum 1.3.0 tidak punya modal (dihitung 0).
- Foto produk contoh (dummy); kolom `image_url` sudah disiapkan untuk fitur unggah.
- Tema terang. Perbaikan kolom tanggal di Safari iOS.
- Jalankan ulang `supabase/schema.sql` (atau migrasi `cost` dan `image_url`) pada database baru.

