import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Resolusi path file serviceAccountKey.json
const keyPath = process.env.FIREBASE_KEY_PATH 
  ? path.resolve(__dirname, process.env.FIREBASE_KEY_PATH)
  : path.resolve(__dirname, '../serviceAccountKey.json');

if (!fs.existsSync(keyPath)) {
  console.error(`[ERROR] File kredensial tidak ditemukan di: ${keyPath}`);
  console.error('Pastikan serviceAccountKey.json berada di folder pert6/');
  process.exit(1);
}

const serviceAccount = JSON.parse(fs.readFileSync(keyPath, 'utf8'));

initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore();
const col = db.collection('buku');

const app = express();
app.use(express.json());

// Helper untuk format data dokumen (menggabungkan id dokumen)
const formatDoc = (doc) => ({
  id: doc.id,
  ...doc.data()
});

// ==========================================
// 1. GET /api/firestore/buku (Read All + Filter)
// ==========================================
app.get('/api/firestore/buku', async (req, res) => {
  try {
    let q = col;

    // Filter berdasarkan query param 'kategori'
    if (req.query.kategori) {
      q = q.where('kategori', '==', req.query.kategori);
    }

    // Filter berdasarkan query param 'pengarang'
    if (req.query.pengarang) {
      q = q.where('pengarang', '==', req.query.pengarang);
    }

    const snap = await q.get();
    const hasil = snap.docs.map(formatDoc);

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
// 2. GET /api/firestore/buku/laporan/kategori
// (Laporan ringkasan per kategori)
// ==========================================
app.get('/api/firestore/buku/laporan/kategori', async (req, res) => {
  try {
    const snap = await col.get();
    const kategoriMap = {};

    snap.forEach((doc) => {
      const data = doc.data();
      const kat = data.kategori || 'Tanpa Kategori';
      const stok = Number(data.stok) || 0;
      const harga = Number(data.harga_sewa) || 0;

      if (!kategoriMap[kat]) {
        kategoriMap[kat] = {
          kategori: kat,
          total_judul: 0,
          total_stok: 0,
          total_harga: 0
        };
      }
      kategoriMap[kat].total_judul += 1;
      kategoriMap[kat].total_stok += stok;
      kategoriMap[kat].total_harga += harga;
    });

    const laporan = Object.values(kategoriMap).map((k) => ({
      kategori: k.kategori,
      total_judul: k.total_judul,
      total_stok: k.total_stok,
      rata_rata_harga_sewa: Math.round(k.total_harga / k.total_judul)
    }));

    return res.status(200).json({
      status: 'success',
      keterangan: 'Laporan Agregasi Buku per Kategori di Firestore',
      data: laporan
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 3. GET /api/firestore/buku/:id (Read One)
// ==========================================
app.get('/api/firestore/buku/:id', async (req, res) => {
  try {
    const docRef = col.doc(req.params.id);
    const doc = await docRef.get();

    // doc.exists di Node.js adalah properti boolean
    if (!doc.exists) {
      return res.status(404).json({ error: 'Buku tidak ditemukan' });
    }

    return res.status(200).json({
      status: 'success',
      data: formatDoc(doc)
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 4. POST /api/firestore/buku (Create)
// ==========================================
app.post('/api/firestore/buku', async (req, res) => {
  try {
    const { judul, pengarang, kategori, tahun_terbit, harga_sewa, stok, tags } = req.body;

    // Validasi input
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
      dibuat_pada: FieldValue.serverTimestamp()
    };

    const docRef = await col.add(dataBuku);
    const createdDoc = await docRef.get();

    return res.status(201).json({
      status: 'success',
      pesan: 'Buku berhasil ditambahkan ke Firestore',
      data: formatDoc(createdDoc)
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 5. PUT /api/firestore/buku/:id (Update)
// ==========================================
app.put('/api/firestore/buku/:id', async (req, res) => {
  try {
    const docRef = col.doc(req.params.id);
    const doc = await docRef.get();

    if (!doc.exists) {
      return res.status(404).json({ error: 'Buku tidak ditemukan' });
    }

    // Whitelist field yang boleh diubah
    const allowed = ['judul', 'pengarang', 'kategori', 'tahun_terbit', 'harga_sewa', 'stok'];
    const updateData = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        updateData[key] = req.body[key];
      }
    }

    updateData.diperbarui_pada = FieldValue.serverTimestamp();

    await docRef.set(updateData, { merge: true });
    const updatedDoc = await docRef.get();

    return res.status(200).json({
      status: 'success',
      pesan: 'Data buku berhasil diperbarui',
      data: formatDoc(updatedDoc)
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 6. POST /api/firestore/buku/:id/tags (Operasi arrayUnion)
// Menambahkan tag atau ulasan baru ke array
// ==========================================
app.post('/api/firestore/buku/:id/tags', async (req, res) => {
  try {
    const { tag } = req.body;
    if (!tag) {
      return res.status(400).json({ error: 'Field tag wajib diisi' });
    }

    const docRef = col.doc(req.params.id);
    const doc = await docRef.get();

    if (!doc.exists) {
      return res.status(404).json({ error: 'Buku tidak ditemukan' });
    }

    // Menjalankan operasi arrayUnion untuk menambahkan elemen tanpa duplikasi
    await docRef.update({
      tags: FieldValue.arrayUnion(tag)
    });

    const updatedDoc = await docRef.get();

    return res.status(200).json({
      status: 'success',
      pesan: `Tag '${tag}' berhasil ditambahkan dengan FieldValue.arrayUnion()`,
      data: formatDoc(updatedDoc)
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 7. POST /api/firestore/buku/:id/pinjam (arrayUnion objek)
// ==========================================
app.post('/api/firestore/buku/:id/pinjam', async (req, res) => {
  try {
    const { nama_peminjam } = req.body;
    if (!nama_peminjam) {
      return res.status(400).json({ error: 'nama_peminjam wajib diisi' });
    }

    const docRef = col.doc(req.params.id);
    const doc = await docRef.get();

    if (!doc.exists) {
      return res.status(404).json({ error: 'Buku tidak ditemukan' });
    }

    const entriPinjam = {
      nama_peminjam: String(nama_peminjam),
      tanggal: new Date().toISOString().split('T')[0],
      status: 'dipinjam'
    };

    await docRef.update({
      riwayat_peminjaman: FieldValue.arrayUnion(entriPinjam)
    });

    const updatedDoc = await docRef.get();

    return res.status(200).json({
      status: 'success',
      pesan: `Riwayat peminjaman '${nama_peminjam}' berhasil dicatat dengan arrayUnion()`,
      data: formatDoc(updatedDoc)
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 8. DELETE /api/firestore/buku/:id (Delete)
// ==========================================
app.delete('/api/firestore/buku/:id', async (req, res) => {
  try {
    const docRef = col.doc(req.params.id);
    const doc = await docRef.get();

    if (!doc.exists) {
      return res.status(404).json({ error: 'Buku tidak ditemukan' });
    }

    await docRef.delete();

    return res.status(200).json({
      status: 'success',
      pesan: `Buku dengan ID ${req.params.id} berhasil dihapus dari Firestore`
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`[FIRESTORE API] Server berjalan di http://localhost:${PORT}`);
  console.log(`[FIRESTORE API] Terhubung ke project: ${serviceAccount.project_id}`);
  console.log(`====================================================`);
});

