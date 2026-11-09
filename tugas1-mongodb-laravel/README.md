# Tugas 1: API Perpustakaan Buku dengan MongoDB (Laravel)

Implementasi REST API katalog buku perpustakaan menggunakan Laravel dan Document Store MongoDB (`mongodb/laravel-mongodb`).

## Daftar Endpoint
- `GET    /api/buku` : Menampilkan seluruh koleksi buku (Mendukung filter `?kategori=Teknologi` dan `?pengarang=Robert`)
- `POST   /api/buku` : Menambahkan buku baru dengan validasi
- `GET    /api/buku/{id}` : Menampilkan detail buku berdasarkan ID
- `PUT    /api/buku/{id}` : Memperbarui data buku dengan field whitelist
- `DELETE /api/buku/{id}` : Menghapus buku
- `POST   /api/buku/{id}/pinjam` : Mencatat riwayat peminjam ke dalam array menggunakan operator **`$push`**
- `GET    /api/buku/laporan/kategori` : Laporan agregasi **`$group`** (total judul, total stok, rata-rata harga)

