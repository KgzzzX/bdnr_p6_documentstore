<?php

namespace App\Http\Controllers;

use App\Models\Buku;
use Illuminate\Http\Request;

class BukuController extends Controller
{
    /**
     * GET /api/buku
     * Menampilkan semua buku, mendukung filter kategori dan pengarang.
     */
    public function index(Request $request)
    {
        $query = Buku::query();

        if ($request->filled('kategori')) {
            $query->where('kategori', $request->query('kategori'));
        }

        if ($request->filled('pengarang')) {
            $query->where('pengarang', 'like', '%' . $request->query('pengarang') . '%');
        }

        $buku = $query->get();

        return response()->json([
            'status' => 'success',
            'total' => $buku->count(),
            'data' => $buku
        ], 200);
    }

    /**
     * POST /api/buku
     * Menambahkan buku baru dengan validasi input.
     */
    public function store(Request $request)
    {
        $data = $request->validate([
            'judul' => 'required|string|max:255',
            'pengarang' => 'required|string|max:255',
            'kategori' => 'required|string|max:100',
            'tahun_terbit' => 'nullable|integer',
            'harga_sewa' => 'nullable|integer|min:0',
            'stok' => 'nullable|integer|min:0',
            'tags' => 'nullable|array',
        ]);

        $data['riwayat_peminjaman'] = [];

        $buku = Buku::create($data);

        return response()->json([
            'status' => 'success',
            'message' => 'Buku berhasil ditambahkan ke MongoDB',
            'data' => $buku
        ], 201);
    }

    /**
     * GET /api/buku/{id}
     * Menampilkan detail satu buku.
     */
    public function show($id)
    {
        $buku = Buku::find($id);

        if (!$buku) {
            return response()->json([
                'status' => 'error',
                'message' => 'Buku tidak ditemukan'
            ], 404);
        }

        return response()->json([
            'status' => 'success',
            'data' => $buku
        ], 200);
    }

    /**
     * PUT /api/buku/{id}
     * Memperbarui informasi buku dengan whitelist field yang aman.
     */
    public function update(Request $request, $id)
    {
        $buku = Buku::find($id);

        if (!$buku) {
            return response()->json([
                'status' => 'error',
                'message' => 'Buku tidak ditemukan'
            ], 404);
        }

        $allowedData = $request->only([
            'judul', 'pengarang', 'kategori', 'tahun_terbit', 'harga_sewa', 'stok'
        ]);

        $buku->update($allowedData);

        return response()->json([
            'status' => 'success',
            'message' => 'Data buku berhasil diperbarui',
            'data' => $buku
        ], 200);
    }

    /**
     * DELETE /api/buku/{id}
     * Menghapus buku dari koleksi.
     */
    public function destroy($id)
    {
        $buku = Buku::find($id);

        if (!$buku) {
            return response()->json([
                'status' => 'error',
                'message' => 'Buku tidak ditemukan'
            ], 404);
        }

        $buku->delete();

        return response()->json([
            'status' => 'success',
            'message' => 'Buku berhasil dihapus dari MongoDB'
        ], 200);
    }

    /**
     * POST /api/buku/{id}/pinjam
     * Menambahkan entri riwayat peminjaman menggunakan operator $push MongoDB.
     */
    public function pinjam(Request $request, $id)
    {
        $request->validate([
            'nama_peminjam' => 'required|string|max:255'
        ]);

        $buku = Buku::find($id);

        if (!$buku) {
            return response()->json([
                'status' => 'error',
                'message' => 'Buku tidak ditemukan'
            ], 404);
        }

        $entriPinjam = [
            'nama_peminjam' => $request->input('nama_peminjam'),
            'tanggal_pinjam' => now()->toIso8601String(),
            'status' => 'dipinjam'
        ];

        // Eksekusi operator $push khas MongoDB pada array riwayat_peminjaman
        $buku->push('riwayat_peminjaman', $entriPinjam);

        return response()->json([
            'status' => 'success',
            'message' => 'Riwayat peminjaman berhasil dicatat menggunakan operator $push',
            'data' => $buku->fresh()
        ], 200);
    }

    /**
     * GET /api/buku/laporan/kategori
     * Agregasi MongoDB ($group, $sum, $avg) untuk rekapitulasi data per kategori.
     */
    public function laporanKategori()
    {
        // Menggunakan raw aggregation pipeline MongoDB
        $laporan = Buku::raw(function ($collection) {
            return $collection->aggregate([
                [
                    '$group' => [
                        '_id' => '$kategori',
                        'total_judul' => ['$sum' => 1],
                        'total_stok' => ['$sum' => '$stok'],
                        'rata_rata_harga_sewa' => ['$avg' => '$harga_sewa']
                    ]
                ],
                [
                    '$sort' => ['total_stok' => -1]
                ]
            ]);
        });

        return response()->json([
            'status' => 'success',
            'keterangan' => 'Laporan Agregasi $group per Kategori di MongoDB',
            'data' => $laporan
        ], 200);
    }
}

