import dotenv from 'dotenv';
import { MongoClient, ObjectId } from 'mongodb';

dotenv.config();

const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017';
const dbName = process.env.MONGODB_DATABASE || 'perpustakaan_db';
const client = new MongoClient(uri);

const printHeader = (title) => {
  console.log('\n' + '='.repeat(60));
  console.log(`>>> ${title}`);
  console.log('='.repeat(60));
};

async function runDemo() {
  console.log(`[INIT] Menghubungkan ke MongoDB di ${uri}...`);
  await client.connect();
  const db = client.db(dbName);
  const col = db.collection('buku');

  // Bersihkan data lama agar bersih
  await col.deleteMany({});

  // 1. CREATE (Insert Data Buku)
  printHeader('1. OPERASI CREATE: Menambahkan Buku dengan insertOne()');
  const buku1 = {
    judul: 'Pemrograman Web Modern dengan Node.js',
    pengarang: 'Budi Raharjo',
    kategori: 'Teknologi',
    tahun_terbit: 2022,
    harga_sewa: 5000,
    stok: 10,
    tags: ['nodejs', 'express', 'javascript'],
    riwayat_peminjaman: [],
    dibuat_pada: new Date()
  };
  const res1 = await col.insertOne(buku1);
  console.log(`[SUCCESS] Buku 1 berhasil ditambahkan dengan insertedId: ${res1.insertedId}`);

  const buku2 = {
    judul: 'Arsitektur Basis Data Non Relasional',
    pengarang: 'Indra Hermawan',
    kategori: 'Teknologi',
    tahun_terbit: 2023,
    harga_sewa: 6000,
    stok: 5,
    tags: ['nosql', 'mongodb', 'database'],
    riwayat_peminjaman: [],
    dibuat_pada: new Date()
  };
  const res2 = await col.insertOne(buku2);
  console.log(`[SUCCESS] Buku 2 berhasil ditambahkan dengan insertedId: ${res2.insertedId}`);

  const buku3 = {
    judul: 'Sejarah Peradaban Kuno Dunia',
    pengarang: 'Siti Aminah',
    kategori: 'Sejarah',
    tahun_terbit: 2019,
    harga_sewa: 4000,
    stok: 14,
    tags: ['sejarah', 'peradaban'],
    riwayat_peminjaman: [],
    dibuat_pada: new Date()
  };
  const res3 = await col.insertOne(buku3);
  console.log(`[SUCCESS] Buku 3 berhasil ditambahkan dengan insertedId: ${res3.insertedId}`);

  // 2. READ ALL
  printHeader('2. OPERASI READ: Menampilkan Semua Buku dengan find().toArray()');
  const semuaBuku = await col.find({}).toArray();
  console.log(`Total buku di database: ${semuaBuku.length}`);
  semuaBuku.forEach((b) => {
    console.log(`- [ID: ${b._id}] ${b.judul} (${b.kategori}) - Stok: ${b.stok}`);
  });

  // 3. FILTER
  printHeader("3. OPERASI FILTER: find({ kategori: 'Teknologi' })");
  const filtered = await col.find({ kategori: 'Teknologi' }).toArray();
  console.log(`Ditemukan ${filtered.length} buku kategori 'Teknologi':`);
  filtered.forEach((b) => {
    console.log(`  * ${b.judul} oleh ${b.pengarang} (Harga: Rp${b.harga_sewa})`);
  });

  // 4. OPERASI $push
  printHeader('4. OPERASI $push: Menambahkan Riwayat Peminjaman ke Buku 1');
  console.log(`Menjalankan $push peminjaman atas nama 'Aji' ke ID: ${res1.insertedId}...`);
  await col.updateOne(
    { _id: res1.insertedId },
    {
      $push: {
        riwayat_peminjaman: {
          nama_peminjam: 'Aji Pratama',
          tanggal_pinjam: new Date(),
          status: 'dipinjam'
        }
      }
    }
  );
  const updatedBuku1 = await col.findOne({ _id: res1.insertedId });
  console.log('[SUCCESS] Data riwayat_peminjaman Buku 1 setelah $push:');
  console.log(JSON.stringify(updatedBuku1.riwayat_peminjaman, null, 2));

  // 5. UPDATE FIELD BIASA
  printHeader('5. OPERASI UPDATE: Mengubah Stok Buku 2 dengan updateOne()');
  await col.updateOne(
    { _id: res2.insertedId },
    { $set: { stok: 15, diperbarui_pada: new Date() } }
  );
  const updatedBuku2 = await col.findOne({ _id: res2.insertedId });
  console.log(`[SUCCESS] Stok Buku 2 setelah di-update: ${updatedBuku2.stok}`);

  // 6. AGREGASI $group
  printHeader('6. OPERASI AGREGASI $group + $sum + $avg (Slide 24 & 29)');
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

  console.log('Hasil Agregasi MongoDB:');
  console.table(laporan);

  // 7. DELETE
  printHeader('7. OPERASI DELETE: Menghapus Buku 3 dengan deleteOne()');
  const resDel = await col.deleteOne({ _id: res3.insertedId });
  console.log(`[SUCCESS] deletedCount: ${resDel.deletedCount}`);
  const cekDel = await col.findOne({ _id: res3.insertedId });
  console.log(`Verifikasi keberadaan Buku 3 setelah dihapus: ${cekDel}`);

  printHeader('SEMUA PENGUJIAN MONGODB SELESAI DENGAN SUKSES!');
  await client.close();
}

runDemo().catch((err) => {
  console.error('[ERROR] Pengujian gagal:', err);
  process.exit(1);
});

