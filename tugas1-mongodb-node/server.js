import express from 'express';
import dotenv from 'dotenv';
import { MongoClient, ObjectId } from 'mongodb';

dotenv.config();

const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017';
const dbName = process.env.MONGODB_DATABASE || 'perpustakaan_db';
const client = new MongoClient(uri);

let db;
let col;

const app = express();
app.use(express.json());

// ==========================================
// 1. GET /api/buku (Read All + Filter)
// ==========================================
app.get('/api/buku', async (req, res) => {
  try {
    const filter = {};

    if (req.query.kategori) {
      filter.kategori = req.query.kategori;
    }

    if (req.query.pengarang) {
      filter.pengarang = { $regex: req.query.pengarang, $options: 'i' };
    }

    const hasil = await col.find(filter).toArray();

    return res.status(200).json({
      status: 'success',
      total: hasil.length,
      data: hasil
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 2. GET /api/buku/laporan/kategori
// Agregasi $group + $sum + $avg (Slide 24)
// ==========================================
app.get('/api/buku/laporan/kategori', async (req, res) => {
  try {
    const laporan = await col.aggregate([
      {
        $group: {
          _id: '$kategori',
          total_judul: { $sum: 1 },
          total_stok: { $sum: '$stok' },
          rata_rata_harga_sewa: { $avg: '$harga_sewa' }
        }
      },
      {
        $project: {
          kategori: '$_id',
          _id: 0,
          total_judul: 1,
          total_stok: 1,
          rata_rata_harga_sewa: { $round: ['$rata_rata_harga_sewa', 0] }
        }
      },
      {
        $sort: { total_stok: -1 }
      }
    ]).toArray();

    return res.status(200).json({
      status: 'success',
      keterangan: 'Laporan Agregasi $group per Kategori di MongoDB',
      data: laporan
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 3. GET /api/buku/:id (Read One dengan ObjectId)
// Mengatasi Bug 1 di Slide 25
// ==========================================
app.get('/api/buku/:id', async (req, res) => {
  try {
    if (!ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Format ID tidak valid' });
    }

    const doc = await col.findOne({ _id: new ObjectId(req.params.id) });

    if (!doc) {
      return res.status(404).json({ error: 'Buku tidak ditemukan' });
    }

    return res.status(200).json({
      status: 'success',
      data: doc
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 4. POST /api/buku (Create)
// ==========================================
app.post('/api/buku', async (req, res) => {
  try {
    const { judul, pengarang, kategori, tahun_terbit, harga_sewa, stok, tags } = req.body;

    if (!judul || !kategori) {
      return res.status(400).json({ error: 'Field judul dan kategori wajib diisi' });
    }

    const dataBuku = {
      judul: String(judul),
      pengarang: pengarang ? String(pengarang) : 'Anonim',
      kategori: String(kategori),
      tahun_terbit: tahun_terbit ? Number(tahun_terbit) : new Date().getFullYear(),
      harga_sewa: harga_sewa ? Number(harga_sewa) : 0,
      stok: stok !== undefined ? Number(stok) : 1,
      tags: Array.isArray(tags) ? tags : [],
      riwayat_peminjaman: [],
      dibuat_pada: new Date()
    };

    const hasil = await col.insertOne(dataBuku);

    return res.status(201).json({
      status: 'success',
      pesan: 'Buku berhasil ditambahkan ke MongoDB',
      insertedId: hasil.insertedId,
      data: { _id: hasil.insertedId, ...dataBuku }
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 5. PUT /api/buku/:id (Update dengan Whitelist)
// ==========================================
app.put('/api/buku/:id', async (req, res) => {
  try {
    if (!ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Format ID tidak valid' });
    }

    // Whitelist field (Slide 24)
    const allowed = ['judul', 'pengarang', 'kategori', 'tahun_terbit', 'harga_sewa', 'stok'];
    const perubahan = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        perubahan[key] = req.body[key];
      }
    }

    perubahan.diperbarui_pada = new Date();

    const hasil = await col.updateOne(
      { _id: new ObjectId(req.params.id) },
      { $set: perubahan }
    );

    if (hasil.matchedCount === 0) {
      return res.status(404).json({ error: 'Buku tidak ditemukan' });
    }

    const docUpdated = await col.findOne({ _id: new ObjectId(req.params.id) });

    return res.status(200).json({
      status: 'success',
      pesan: 'Data buku berhasil diperbarui',
      data: docUpdated
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 6. POST /api/buku/:id/pinjam (Operasi $push)
// ==========================================
app.post('/api/buku/:id/pinjam', async (req, res) => {
  try {
    if (!ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Format ID tidak valid' });
    }

    const { nama_peminjam } = req.body;
    if (!nama_peminjam) {
      return res.status(400).json({ error: 'nama_peminjam wajib diisi' });
    }

    const entriPinjam = {
      nama_peminjam: String(nama_peminjam),
      tanggal_pinjam: new Date(),
      status: 'dipinjam'
    };

    // Operasi $push untuk menambahkan elemen ke array
    const hasil = await col.updateOne(
      { _id: new ObjectId(req.params.id) },
      { $push: { riwayat_peminjaman: entriPinjam } }
    );

    if (hasil.matchedCount === 0) {
      return res.status(404).json({ error: 'Buku tidak ditemukan' });
    }

    const docUpdated = await col.findOne({ _id: new ObjectId(req.params.id) });

    return res.status(200).json({
      status: 'success',
      pesan: `Peminjaman atas nama '${nama_peminjam}' berhasil dicatat dengan operator $push`,
      data: docUpdated
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 7. DELETE /api/buku/:id (Delete)
// ==========================================
app.delete('/api/buku/:id', async (req, res) => {
  try {
    if (!ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Format ID tidak valid' });
    }

    const hasil = await col.deleteOne({ _id: new ObjectId(req.params.id) });

    if (hasil.deletedCount === 0) {
      return res.status(404).json({ error: 'Buku tidak ditemukan' });
    }

    return res.status(200).json({
      status: 'success',
      pesan: `Buku dengan ID ${req.params.id} berhasil dihapus dari MongoDB`
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 4000;

async function startServer() {
  try {
    await client.connect();
    db = client.db(dbName);
    col = db.collection('buku');

    app.listen(PORT, () => {
      console.log(`====================================================`);
      console.log(`[MONGODB API] Server berjalan di http://localhost:${PORT}`);
      console.log(`[MONGODB API] Terhubung ke Database: ${dbName}`);
      console.log(`====================================================`);
    });
  } catch (err) {
    console.error('[ERROR] Gagal terhubung ke MongoDB server:', err.message);
    process.exit(1);
  }
}

startServer();

