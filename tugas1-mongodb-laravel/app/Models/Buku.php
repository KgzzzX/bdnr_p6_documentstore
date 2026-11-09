<?php

namespace App\Models;

use MongoDB\Laravel\Eloquent\Model;

class Buku extends Model
{
    // Menggunakan koneksi 'mongodb' khusus sesuai Slide 14 & 16
    protected $connection = 'mongodb';
    protected $collection = 'buku';

    // Whitelist field yang dapat diisi secara mass-assignment
    protected $fillable = [
        'judul',
        'pengarang',
        'kategori',
        'tahun_terbit',
        'harga_sewa',
        'stok',
        'tags',
        'riwayat_peminjaman',
    ];

    // Konversi tipe data otomatis
    protected $casts = [
        'tahun_terbit' => 'integer',
        'harga_sewa' => 'integer',
        'stok' => 'integer',
        'tags' => 'array',
        'riwayat_peminjaman' => 'array',
    ];
}

