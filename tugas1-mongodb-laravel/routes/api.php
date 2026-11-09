<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\BukuController;

/*
|--------------------------------------------------------------------------
| API Routes - Perpustakaan Buku MongoDB
|--------------------------------------------------------------------------
*/

Route::prefix('buku')->group(function () {
    // Agregasi & Laporan (Diletakkan sebelum parameter {id} agar tidak tertabrak route model binding)
    Route::get('/laporan/kategori', [BukuController::class, 'laporanKategori']);

    // Operasi CRUD Dasar
    Route::get('/', [BukuController::class, 'index']);
    Route::post('/', [BukuController::class, 'store']);
    Route::get('/{id}', [BukuController::class, 'show']);
    Route::put('/{id}', [BukuController::class, 'update']);
    Route::delete('/{id}', [BukuController::class, 'destroy']);

    // Operasi Khusus MongoDB ($push)
    Route::post('/{id}/pinjam', [BukuController::class, 'pinjam']);
});

