# REFLEKSI & DOKUMENTASI TUGAS PERTEMUAN 06
**Mata Kuliah:** Basis Data Non Relasional (IF611344)  
**Materi:** Document Store dalam Aplikasi (MongoDB & Firebase Firestore pada Laravel dan Node.js)  
**Program Studi:** Teknik Informatika - Universitas Jenderal Achmad Yani  

---

## DAFTAR ISI
1. [Bagian A: Studi Kasus & Temukan Bugnya](#bagian-a-studi-kasus--temukan-bugnya)
   - [1.1 Studi Kasus Aplikasi Tiket Konser](#11-studi-kasus-aplikasi-tiket-konser)
   - [1.2 Analisis & Perbaikan Bug 1 (Node.js MongoDB Driver)](#12-analisis--perbaikan-bug-1-nodejs-mongodb-driver)
   - [1.3 Analisis & Perbaikan Bug 2 (Laravel MongoDB Session)](#13-analisis--perbaikan-bug-2-laravel-mongodb-session)
2. [Tugas 1: API Perpustakaan Buku dengan MongoDB](#tugas-1-api-perpustakaan-buku-dengan-mongodb)
   - [2.1 Deskripsi & Arsitektur](#21-deskripsi--arsitektur)
   - [2.2 Struktur Dokumen BSON Buku](#22-struktur-dokumen-bson-buku)
   - [2.3 Daftar Endpoint & Implementasi Kode](#23-daftar-endpoint--implementasi-kode)
   - [2.4 Operasi Khusus: $push dan Agregasi $group](#24-operasi-khusus-push-dan-agregasi-group)
3. [Tugas 2: API Perpustakaan Buku dengan Firebase Firestore](#tugas-2-api-perpustakaan-buku-dengan-firebase-firestore)
   - [3.1 Deskripsi & Arsitektur](#31-deskripsi--arsitektur)
   - [3.2 Struktur Dokumen Firestore](#32-struktur-dokumen-firestore)
   - [3.3 Daftar Endpoint & Implementasi Kode](#33-daftar-endpoint--implementasi-kode)
   - [3.4 Operasi Khusus: arrayUnion dan Laporan per Kategori](#34-operasi-khusus-arrayunion-dan-laporan-per-kategori)
4. [Refleksi Pembelajaran & Best Practices](#refleksi-pembelajaran--best-practices)
   - [4.1 Perbandingan Karakteristik MongoDB vs Firestore](#41-perbandingan-karakteristik-mongodb-vs-firestore)
   - [4.2 Manajemen Kredensial dan Keamanan (.env)](#42-manajemen-kredensial-dan-keamanan-env)
   - [4.3 Penanganan Error dan Kode Status HTTP](#43-penanganan-error-dan-kode-status-http)
5. [Lampiran Bukti Pengujian (Screenshots)](#lampiran-bukti-pengujian-screenshots)

---

## BAGIAN A: STUDI KASUS & TEMUKAN BUGNYA

### 1.1 Studi Kasus Aplikasi Tiket Konser
**Skenario:**  
Sebuah aplikasi pemesanan tiket membutuhkan dua hal sekaligus:
- **Kebutuhan A:** Laporan penjualan per kategori tiket setiap hari.
- **Kebutuhan B:** Notifikasi real-time ke aplikasi mobile saat tiket hampir habis.

**Pertanyaan:** *MongoDB, Firestore, atau keduanya? Berikan alasan.*

**Analisis & Jawaban:**  
Pilihan paling tepat dan direkomendasikan untuk arsitektur produksi modern adalah **Keduanya (Hybrid Architecture)**, dengan pembagian peran sesuai keunggulan masing-masing database:

1. **Kebutuhan A ditangani oleh MongoDB:**
   - **Kekuatan Agregasi (MQL Pipeline):** MongoDB memiliki *Aggregation Framework* yang sangat kaya (`$match`, `$group`, `$sum`, `$avg`, `$sort`). Penghitungan laporan penjualan harian per kategori (omzet, kuota tiket terjual, sisa kuota, rata-rata nominal transaksi) dapat diproses langsung di level database server secara cepat dan efisien.
   - **Model Biaya & Skalabilitas Transaksi:** Transaksi tiket dalam jumlah puluhan ribu atau ratusan ribu per hari lebih hemat diproses pada MongoDB karena biaya dihitung berdasarkan kapasitas server/cluster (fixed cost), bukan dihitung per jumlah pembacaan/penulisan dokumen seperti Firestore.

2. **Kebutuhan B ditangani oleh Firebase Firestore:**
   - **Kemampuan Real-time Terbawa (Built-in Listeners):** Firestore memiliki fitur bawaan *real-time updates* (`onSnapshot`) yang dapat langsung terhubung ke SDK aplikasi mobile (Android, iOS, Flutter) tanpa perlu membangun infrastruktur WebSocket atau Redis Pub/Sub terpisah.
   - **Notifikasi Push & Status Ketersediaan:** Ketika stok tiket suatu kategori mencapai ambang batas menipis (misal sisa < 10 tiket), trigger Firestore dapat langsung memperbarui UI jutaan pengguna ponsel secara instan.

**Kesimpulan Arsitektur:**  
Gunakan MongoDB sebagai database transaksional inti (*core backend*) dan pemrosesan analitik/laporan harian, kemudian sinkronisasikan status kuota tiket ke Firestore agar aplikasi mobile dapat memantau ketersediaan tiket secara *real-time*.

---

### 1.2 Analisis & Perbaikan Bug 1 (Node.js MongoDB Driver)

**Potongan Kode:**
```javascript
const doc = await db
  .collection('produk')
  .findOne({ _id: req.params.id });
```
**Gejala:** Data ada di database, tetapi hasilnya selalu `null`. Mengapa?

**Penyebab:**
- Parameter URL `req.params.id` bertipe **String** (misal `"66f1a23b4c9e123456789abc"`).
- Secara default pada MongoDB, field `_id` disimpan dalam format biner **BSON `ObjectId`**, bukan string polos.
- Driver MongoDB bersifat *type-sensitive*; pencarian string `{ _id: "66f1..." }` tidak akan pernah cocok dengan BSON `{ _id: ObjectId("66f1...") }`. Akibatnya, query selalu mengembalikan `null`.

**Solusi & Perbaikan:**
Import class `ObjectId` dari driver `mongodb`, lalu bungkus parameter string tersebut ke objek `new ObjectId()`:
```javascript
import { ObjectId } from 'mongodb';

// Perbaikan:
const doc = await db
  .collection('produk')
  .findOne({ _id: new ObjectId(req.params.id) });

if (!doc) {
  return res.status(404).json({ error: 'Produk tidak ditemukan' });
}
```

---

### 1.3 Analisis & Perbaikan Bug 2 (Laravel MongoDB Session)

**Potongan Kode / Konfigurasi:**
```ini
# .env Laravel
DB_CONNECTION=mongodb
```
**Gejala:** Menjalankan `php artisan serve` menampilkan error: *tabel sessions tidak ditemukan*. Mengapa?

**Penyebab:**
- Secara default, konfigurasi session driver pada Laravel versi modern diset ke `database` (`SESSION_DRIVER=database`).
- Driver session database bawaan Laravel dirancang untuk database relasional (SQL) berbasis PDO, yang mengharapkan adanya tabel bernama `sessions`.
- Ketika `DB_CONNECTION` default diubah menjadi `mongodb`, framework mencoba mengeksekusi query SQL migration/session pada koneksi MongoDB yang tidak memiliki tabel relasional tersebut, sehingga memicu exception error.

**Solusi & Perbaikan:**
Terdapat dua pendekatan perbaikan sesuai rekomendasi di slide perkuliahan:
1. **Pendekatan Rekomendasi (Slide 16):**
   Biarkan `DB_CONNECTION` default Laravel tetap relasional (misal `sqlite` atau `mysql`). Model MongoDB akan memanggil koneksinya sendiri:
   ```php
   // Pada Model app/Models/Buku.php:
   protected $connection = 'mongodb';
   protected $collection = 'buku';
   ```
2. **Pendekatan Alternatif:**
   Ubah session driver di `.env` agar tidak menggunakan database SQL, melainkan penyimpanan file:
   ```ini
   SESSION_DRIVER=file
   ```

---

## TUGAS 1: API PERPUSTAKAAN BUKU DENGAN MONGODB

### 2.1 Deskripsi & Arsitektur
API ini menyediakan manajemen katalog buku perpustakaan menggunakan MongoDB Document Store dengan fitur CRUD, filter kategori/pengarang, penambahan riwayat peminjaman dengan operator `$push`, serta pembuatan laporan statistik menggunakan agregasi `$group`.

### 2.2 Struktur Dokumen BSON Buku
```json
{
  "_id": "ObjectId('672b1234abcd5678ef012345')",
  "judul": "Clean Code",
  "pengarang": "Robert C. Martin",
  "kategori": "Teknologi",
  "tahun_terbit": 2008,
  "harga_sewa": 5000,
  "stok": 10,
  "tags": ["programming", "best-practices", "software"],
  "riwayat_peminjaman": [
    {
      "nama_peminjam": "Aji",
      "tanggal_pinjam": "2026-11-10T05:00:00.000Z",
      "status": "dipinjam"
    }
  ],
  "dibuat_pada": "2026-11-10T05:00:00.000Z"
}
```

### 2.3 Daftar Endpoint API
| Method | Endpoint | Fungsi |
| :--- | :--- | :--- |
| `GET` | `/api/buku` | Mendapatkan seluruh daftar buku (Mendukung query parameter: `?kategori=Teknologi` dan `?pengarang=Robert`) |
| `POST` | `/api/buku` | Menambahkan data buku baru (Validasi input lengkap, status 201 Created) |
| `GET` | `/api/buku/:id` | Mengambil detail buku berdasarkan ObjectId (Status 404 bila tidak ada) |
| `PUT` | `/api/buku/:id` | Mengubah informasi buku dengan whitelist field yang aman |
| `DELETE` | `/api/buku/:id` | Menghapus buku dari koleksi |
| `POST` | `/api/buku/:id/pinjam` | Menambahkan entri riwayat peminjaman menggunakan operator **`$push`** |
| `GET` | `/api/buku/laporan/kategori` | Menampilkan laporan ringkasan per kategori menggunakan agregasi **`$group`** |

### 2.4 Operasi Khusus: $push dan Agregasi $group
1. **Operasi `$push`:**
   Menyisipkan objek peminjam ke dalam array `riwayat_peminjaman`:
   ```javascript
   await col.updateOne(
     { _id: new ObjectId(id) },
     {
       $push: {
         riwayat_peminjaman: {
           nama_peminjam: req.body.nama_peminjam,
           tanggal_pinjam: new Date(),
           status: 'dipinjam'
         }
       }
     }
   );
   ```

2. **Agregasi `$group`:**
   Merekap total buku, akumulasi stok, dan rata-rata harga sewa per kategori buku:
   ```javascript
   const laporan = await col.aggregate([
     {
       $group: {
         _id: '$kategori',
         total_judul_buku: { $sum: 1 },
         total_stok: { $sum: '$stok' },
         rata_rata_harga: { $avg: '$harga_sewa' }
       }
     },
     { $sort: { total_stok: -1 } }
   ]).toArray();
   ```

---

## TUGAS 2: API PERPUSTAKAAN BUKU DENGAN FIREBASE FIRESTORE

### 3.1 Deskripsi & Arsitektur
API ini mengelola data buku pada Google Cloud Firestore menggunakan Firebase Admin SDK di Node.js (Express.js). Mengimplementasikan operasi atomic `arrayUnion` untuk penambahan tag/ulasan, query `where` untuk filtering, serta kalkulasi laporan kategori.

### 3.2 Daftar Endpoint API
| Method | Endpoint | Fungsi |
| :--- | :--- | :--- |
| `GET` | `/api/firestore/buku` | Menampilkan semua buku atau filter dengan `?kategori=Sains` |
| `POST` | `/api/firestore/buku` | Menambah dokumen buku baru dengan serverTimestamp |
| `GET` | `/api/firestore/buku/:id` | Mengambil satu buku berdasarkan Document ID |
| `PUT` | `/api/firestore/buku/:id` | Mengubah dokumen dengan opsi `{ merge: true }` |
| `DELETE` | `/api/firestore/buku/:id` | Menghapus dokumen buku |
| `POST` | `/api/firestore/buku/:id/tags` | Menambahkan tag buku menggunakan **`FieldValue.arrayUnion()`** |
| `GET` | `/api/firestore/buku/laporan/kategori` | Menghasilkan rekapitulasi buku per kategori |

### 3.3 Operasi Khusus: arrayUnion
Operasi `arrayUnion` memastikan elemen ditambahkan ke dalam array tanpa menduplikasi data yang identik:
```javascript
import { FieldValue } from 'firebase-admin/firestore';

await docRef.update({
  tags: FieldValue.arrayUnion(req.body.tag)
});
```

---

## REFLEKSI PEMBELAJARAN & BEST PRACTICES

### 4.1 Perbandingan Karakteristik MongoDB vs Firestore
| Aspek | MongoDB | Firebase Firestore |
| :--- | :--- | :--- |
| **Model Layanan** | Self-hosted lokal / Cloud Atlas | Fully Managed Serverless oleh Google Cloud |
| **Struktur Data** | Database $\rightarrow$ Collection $\rightarrow$ Document (BSON) | Collection $\rightarrow$ Document $\rightarrow$ Subcollection |
| **Kemampuan Kueri** | Sangat kuat: Rich Query Language + Aggregation Pipeline | Terbatas pada filter indeks (`where`, `orderBy`, `limit`) |
| **Kemampuan Real-time** | Membutuhkan MongoDB Change Streams / socket manual | Bawaan (*out-of-the-box*) melalui snapshot listener |
| **Model Biaya** | Berdasarkan spesifikasi server/RAM | Dihitung per operasi (jumlah Read, Write, Delete dokumen) |

### 4.2 Manajemen Kredensial dan Keamanan (.env)
1. **Prinsip Least Privilege:** Gunakan user database dengan hak akses secukupnya, bukan user superadmin / root.
2. **Jangan Lakukan Hardcode:** File kredensial sensitif seperti connection string MongoDB dan `serviceAccountKey.json` Firestore wajib dimasukkan ke dalam `.gitignore` dan dimuat melalui variabel lingkungan (`process.env`).
3. **Penyediaan File Template:** Sediakan file `.env.example` yang mencantumkan nama variabel tanpa memuat rahasia asli, agar mempermudah tim pengembang lain menjalankan proyek.

### 4.3 Penanganan Error dan Kode Status HTTP
- `200 OK`: Permintaan berhasil (GET, PUT, DELETE).
- `201 Created`: Dokumen baru berhasil dibuat (POST).
- `400 Bad Request`: Format payload JSON atau validasi input gagal.
- `404 Not Found`: Dokumen dengan ID yang diminta tidak ditemukan di database.
- `500 Internal Server Error`: Terjadi kesalahan pada server atau kegagalan koneksi database.

---

## LAMPIRAN BUKTI PENGUJIAN & OUTPUT EKSEKUSI

### 5.1 Output Eksekusi Tugas 1: MongoDB
Pengujian dijalankan pada MongoDB lokal (`mongodb://127.0.0.1:27017/perpustakaan_db`) mencakup seluruh operasi yang diwajibkan:
```text
[INIT] Menghubungkan ke MongoDB di mongodb://127.0.0.1:27017...

============================================================
>>> 1. OPERASI CREATE: Menambahkan Buku dengan insertOne()
============================================================
[SUCCESS] Buku 1 berhasil ditambahkan dengan insertedId: 6af25550cec2f83fdf6a746e
[SUCCESS] Buku 2 berhasil ditambahkan dengan insertedId: 6af25550cec2f83fdf6a746f
[SUCCESS] Buku 3 berhasil ditambahkan dengan insertedId: 6af25550cec2f83fdf6a7470

============================================================
>>> 2. OPERASI READ: Menampilkan Semua Buku dengan find().toArray()
============================================================
Total buku di database: 3
- [ID: 6af25550cec2f83fdf6a746e] Pemrograman Web Modern dengan Node.js (Teknologi) - Stok: 10
- [ID: 6af25550cec2f83fdf6a746f] Arsitektur Basis Data Non Relasional (Teknologi) - Stok: 5
- [ID: 6af25550cec2f83fdf6a7470] Sejarah Peradaban Kuno Dunia (Sejarah) - Stok: 14

============================================================
>>> 3. OPERASI FILTER: find({ kategori: 'Teknologi' })
============================================================
Ditemukan 2 buku kategori 'Teknologi':
  * Pemrograman Web Modern dengan Node.js oleh Budi Raharjo (Harga: Rp5000)
  * Arsitektur Basis Data Non Relasional oleh Indra Hermawan (Harga: Rp6000)

============================================================
>>> 4. OPERASI $push: Menambahkan Riwayat Peminjaman ke Buku 1
============================================================
Menjalankan $push peminjaman atas nama 'Aji' ke ID: 6af25550cec2f83fdf6a746e...
[SUCCESS] Data riwayat_peminjaman Buku 1 setelah $push:
[
  {
    "nama_peminjam": "Aji Pratama",
    "tanggal_pinjam": "2026-11-09T23:20:48.171Z",
    "status": "dipinjam"
  }
]

============================================================
>>> 5. OPERASI UPDATE: Mengubah Stok Buku 2 dengan updateOne()
============================================================
[SUCCESS] Stok Buku 2 setelah di-update: 15

============================================================
>>> 6. OPERASI AGREGASI $group + $sum + $avg (Slide 24 & 29)
============================================================
Hasil Agregasi MongoDB:
┌─────────┬─────────────┬────────────┬─────────────┬──────────────────────┐
│ (index) │ total_judul │ total_stok │ kategori    │ rata_rata_harga_sewa │
├─────────┼─────────────┼────────────┼─────────────┼──────────────────────┤
│ 0       │ 2           │ 25         │ 'Teknologi' │ 5500                 │
│ 1       │ 1           │ 14         │ 'Sejarah'   │ 4000                 │
└─────────┴─────────────┴────────────┴─────────────┴──────────────────────┘

============================================================
>>> 7. OPERASI DELETE: Menghapus Buku 3 dengan deleteOne()
============================================================
[SUCCESS] deletedCount: 1
Verifikasi keberadaan Buku 3 setelah dihapus: null

============================================================
>>> SEMUA PENGUJIAN MONGODB SELESAI DENGAN SUKSES!
============================================================
```

---

### 5.2 Output Eksekusi Tugas 2: Firebase Firestore
Pengujian dijalankan pada Google Cloud Firestore secara live pada proyek `perpustakaan-app-140a2`:
```text
[INIT] Terhubung ke Firebase Project: perpustakaan-app-140a2

============================================================
>>> 1. OPERASI CREATE: Menambahkan Data Buku ke Firestore
============================================================
[SUCCESS] Buku 1 berhasil dibuat dengan ID: FoZqHu1eLkHcVvI6SNSX
[SUCCESS] Buku 2 berhasil dibuat dengan ID: 6JLK9ClIsNxOTjeWYciF
[SUCCESS] Buku 3 berhasil dibuat dengan ID: YSQJoYUu0E65XcZAXlEc

============================================================
>>> 2. OPERASI READ: Membaca Semua Buku
============================================================
Total dokumen di koleksi 'buku': 3
- [ID: 6JLK9ClIsNxOTjeWYciF] Design Patterns: Elements of Reusable Object-Oriented Software (Teknologi) - Stok: 8
- [ID: FoZqHu1eLkHcVvI6SNSX] Clean Code: A Handbook of Agile Software Craftsmanship (Teknologi) - Stok: 12
- [ID: YSQJoYUu0E65XcZAXlEc] Sapiens: Riwayat Singkat Umat Manusia (Sejarah) - Stok: 15

============================================================
>>> 3. OPERASI FILTER: where('kategori', '==', 'Teknologi')
============================================================
Ditemukan 2 buku pada kategori 'Teknologi':
  * Design Patterns: Elements of Reusable Object-Oriented Software oleh Erich Gamma, dkk
  * Clean Code: A Handbook of Agile Software Craftsmanship oleh Robert C. Martin

============================================================
>>> 4. OPERASI arrayUnion(): Menambahkan Tag & Riwayat Peminjaman
============================================================
Menambahkan tag 'best-seller' dan entri peminjam ke Buku 1 (FoZqHu1eLkHcVvI6SNSX)...
[SUCCESS] Data setelah arrayUnion:
Tags: [ 'programming', 'software-engineering', 'best-seller', 'refactoring' ]
Riwayat Peminjaman: [ { nama_peminjam: 'Aji', tanggal: '2026-11-09', status: 'dipinjam' } ]

============================================================
>>> 5. OPERASI UPDATE: Mengubah Stok Buku 2
============================================================
[SUCCESS] Stok Buku 2 setelah di-update: 20

============================================================
>>> 6. LAPORAN PER KATEGORI (Agregasi Data di Firestore)
============================================================
┌───────────┬─────────────┬────────────┐
│ (index)   │ total_judul │ total_stok │
├───────────┼─────────────┼────────────┤
│ Teknologi │ 2           │ 32         │
│ Sejarah   │ 1           │ 15         │
└───────────┴─────────────┴────────────┘

============================================================
>>> 7. OPERASI DELETE: Menghapus Buku 3
============================================================
[SUCCESS] Buku 3 (YSQJoYUu0E65XcZAXlEc) berhasil dihapus.
Verifikasi keberadaan Buku 3 (exists): false

============================================================
>>> SEMUA PENGUJIAN FIRESTORE SELESAI DENGAN SUKSES!
============================================================
```

---

### 5.3 Panduan Mengambil Screenshot untuk Laporan

1. **Screenshot 1 (Dashboard Firestore Firebase Console):**
   - Buka browser pada tab Firebase Console Firestore Anda: `https://console.firebase.google.com/project/perpustakaan-app-140a2/firestore/databases/-default-/data`
   - Refresh halaman. Anda akan melihat koleksi **`buku`** berisi dokumen-dokumen buku lengkap dengan field array `tags` dan `riwayat_peminjaman`.
   - Ambil screenshot halaman ini sebagai bukti data berhasil tersimpan di Cloud Firestore.

2. **Screenshot 2 (Hasil Eksekusi Terminal Tugas 2 - Firestore):**
   - Buka terminal PowerShell di folder `tugas2-firestore-node`:
     ```powershell
     cd "D:\AAA_kuliah_temp\Basis Data Non Relasional\pert6\tugas2-firestore-node"
     node test-demo.js
     ```
   - Ambil screenshot terminal yang menampilkan output pengujian (Create, Read, Filter, arrayUnion, Laporan).

3. **Screenshot 3 (Hasil Eksekusi Terminal Tugas 1 - MongoDB):**
   - Buka terminal PowerShell di folder `tugas1-mongodb-node`:
     ```powershell
     cd "D:\AAA_kuliah_temp\Basis Data Non Relasional\pert6\tugas1-mongodb-node"
     node test-demo.js
     ```
   - Ambil screenshot terminal yang menampilkan output pengujian MongoDB (Create, Read, Filter, $push, Agregasi $group).


