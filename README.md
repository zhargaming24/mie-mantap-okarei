# Mie Mantap Okarei

Website pemesanan makanan dan minuman untuk lingkungan Asrama Telkom. Dibangun dengan Next.js App Router, TypeScript, Tailwind CSS, Supabase, dan Vercel.

## Yang tersedia

- Halaman toko responsif dengan pencarian, filter kategori, status toko, menu, keranjang, dan pilihan ambil langsung / disiapkan.
- Checkout tanpa akun pelanggan. Harga, biaya seduh, stok produk, stok topping, nomor order, dan nomor antrean dihitung ulang secara atomik oleh PostgreSQL.
- Pembayaran Cash dan QRIS manual. Bukti QRIS disimpan di bucket privat dan tidak dianggap lunas sebelum owner menyetujuinya.
- Tautan status pesanan memakai token acak, bukan data pesanan publik.
- Dashboard owner dengan Supabase Auth, antrian, manajemen produk/kategori/topping, stok, laporan, ekspor CSV, pengaturan toko, dan notifikasi Realtime.
- SQL migration mengaktifkan RLS dan bucket Storage. Data menu kosong sampai owner mengisinya; tidak ada transaksi produksi buatan.

## Menjalankan lokal

1. Gunakan Node.js 22 atau lebih baru.
2. Pasang dependency dengan `npm install`.
3. Salin `.env.example` menjadi `.env.local`, lalu isi variabel Supabase.
4. Jalankan `supabase/migrations/202610300001_initial_schema.sql` di Supabase Dashboard → SQL Editor.
5. Buat user owner lewat Supabase Authentication → Users. Setelah itu jalankan SQL berikut dengan email akun owner tersebut:

   ```sql
   insert into public.profiles (id, full_name, role)
   select id, coalesce(raw_user_meta_data->>'full_name', 'Owner'), 'owner'
   from auth.users
   where email = 'email-owner@example.com'
   on conflict (id) do update set role = 'owner';
   ```

6. Jalankan `npm run dev` dan buka `http://localhost:3000`.

Gunakan email owner untuk masuk di `/admin/login`. Situs mulai dalam status **tutup** dan tidak menerima checkout sampai owner mengaktifkannya di Pengaturan.

## Environment variables

| Nama | Kegunaan | Rahasia? |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | URL proyek Supabase | Tidak |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Kunci publishable Supabase untuk data publik dan Auth | Tidak |
| `SUPABASE_SERVICE_ROLE_KEY` | Upload bukti ke bucket privat di server | Ya, server only |
| `NEXT_PUBLIC_SITE_URL` | URL situs untuk link absolut/integrasi | Tidak |

Jangan menaruh service role key di variabel `NEXT_PUBLIC_*`, GitHub, atau browser. Buat bucket dan kebijakan storage lewat migration; jangan mengubah `payment-proofs` menjadi public.

## Deployment Vercel

1. Impor repository GitHub ini sebagai project Next.js di Vercel.
2. Tambahkan environment variables di atas di **Project Settings → Environment Variables** untuk Production dan Preview.
3. Terapkan migration pada proyek Supabase, buat akun owner, dan isi profil owner seperti langkah lokal.
4. Deploy branch `main`. Push berikutnya akan memicu deployment otomatis melalui Git integration.
5. Masuk sebagai owner, isi produk dan stok, unggah gambar QRIS milik toko, lalu aktifkan toko setelah jam operasional dan katalog siap.

## Alur QRIS dan stok

Checkout mengunci baris produk dan topping, memeriksa harga/stok terbaru, lalu membuat order dan mengurangi stok dalam satu transaksi database. Order QRIS berstatus `PENDING_VERIFICATION`; bukti pembayaran masuk ke bucket privat. Owner dapat membuat signed URL dari dashboard dan menyetujui atau menolak bukti. Penolakan mengembalikan stok; unggah bukti ulang akan mencoba mencadangkan kembali stok secara atomik. Pembatalan order juga mengembalikan stok satu kali.

## Catatan operasional

- QRIS tidak terhubung ke payment gateway. Verifikasi dilakukan owner berdasarkan bukti yang diunggah.
- Tanpa konfigurasi Supabase, storefront hanya menampilkan instruksi setup; order, autentikasi owner, upload, dan dashboard tidak berpura-pura berjalan.
- Sebelum menerima transaksi nyata, periksa nilai biaya seduh, daftar harga/stok, nomor toko, QRIS, dan jam operasional.
- Supabase Realtime memerlukan migration berhasil diterapkan dan tabel `orders`, `payments`, `queue` ada di publication `supabase_realtime`.
