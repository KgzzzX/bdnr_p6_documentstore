import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const keyPath = path.resolve(__dirname, '../serviceAccountKey.json');
if (!fs.existsSync(keyPath)) {
  console.error('[ERROR] serviceAccountKey.json tidak ditemukan di:', keyPath);
  process.exit(1);
}

const serviceAccount = JSON.parse(fs.readFileSync(keyPath, 'utf8'));

initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore();
const col = db.collection('buku');

const printHeader = (title) => {
  console.log('\n' + '='.repeat(60));
  console.log(`>>> ${title}`);
  console.log('='.repeat(60));
};

async function runDemo() {
  console.log(`[INIT] Terhubung ke Firebase Project: ${serviceAccount.project_id}`);

  // 1. CREATE (Tambah Buku Contoh)
  printHeader('1. OPERASI CREATE: Menambahkan Data Buku ke Firestore');
  const buku1 = {
    judul: 'Clean Code: A Handbook of Agile Software Craftsmanship',
    pengarang: 'Robert C. Martin',
    kategori: 'Teknologi',
    tahun_terbit: 2008,
    harga_sewa: 5000,
    stok: 12,
    tags: ['programming', 'software-engineering'],
    riwayat_peminjaman: [],
    dibuat_pada: FieldValue.serverTimestamp()
  };
  const docRef1 = await col.add(buku1);
  console.log(`[SUCCESS] Buku 1 berhasil dibuat dengan ID: ${docRef1.id}`);

  const buku2 = {
    judul: 'Design Patterns: Elements of Reusable Object-Oriented Software',
    pengarang: 'Erich Gamma, dkk',
    kategori: 'Teknologi',
    tahun_terbit: 1994,
    harga_sewa: 6000,
    stok: 8,
    tags: ['design-patterns', 'oop'],
    riwayat_peminjaman: [],
    dibuat_pada: FieldValue.serverTimestamp()
  };
  const docRef2 = await col.add(buku2);
  console.log(`[SUCCESS] Buku 2 berhasil dibuat dengan ID: ${docRef2.id}`);

  const buku3 = {
    judul: 'Sapiens: Riwayat Singkat Umat Manusia',
    pengarang: 'Yuval Noah Harari',
    kategori: 'Sejarah',
    tahun_terbit: 2011,
    harga_sewa: 4000,
    stok: 15,
    tags: ['history', 'humanity'],
    riwayat_peminjaman: [],
    dibuat_pada: FieldValue.serverTimestamp()
  };
  const docRef3 = await col.add(buku3);
  console.log(`[SUCCESS] Buku 3 berhasil dibuat dengan ID: ${docRef3.id}`);

  // 2. READ ALL
  printHeader('2. OPERASI READ: Membaca Semua Buku');
  const allSnap = await col.get();
  console.log(`Total dokumen di koleksi 'buku': ${allSnap.size}`);
  allSnap.forEach((doc) => {
    const d = doc.data();
    console.log(`- [ID: ${doc.id}] ${d.judul} (${d.kategori}) - Stok: ${d.stok}`);
  });

  // 3. FILTER WHERE (kategori == 'Teknologi')
  printHeader("3. OPERASI FILTER: where('kategori', '==', 'Teknologi')");
  const filterSnap = await col.where('kategori', '==', 'Teknologi').get();
  console.log(`Ditemukan ${filterSnap.size} buku pada kategori 'Teknologi':`);
  filterSnap.forEach((doc) => {
    const d = doc.data();
    console.log(`  * ${d.judul} oleh ${d.pengarang}`);
  });

  // 4. ARRAYUNION (Tambah tag dan riwayat peminjam)
  printHeader('4. OPERASI arrayUnion(): Menambahkan Tag & Riwayat Peminjaman');
  console.log(`Menambahkan tag 'best-seller' dan entri peminjam ke Buku 1 (${docRef1.id})...`);
  await docRef1.update({
    tags: FieldValue.arrayUnion('best-seller', 'refactoring'),
    riwayat_peminjaman: FieldValue.arrayUnion({
      nama_peminjam: 'Aji',
      tanggal: new Date().toISOString().split('T')[0],
      status: 'dipinjam'
    })
  });
  const updatedDoc1 = await docRef1.get();
  console.log('[SUCCESS] Data setelah arrayUnion:');
  console.log('Tags:', updatedDoc1.data().tags);
  console.log('Riwayat Peminjaman:', updatedDoc1.data().riwayat_peminjaman);

  // 5. UPDATE FIELD BIASA ({ merge: true })
  printHeader('5. OPERASI UPDATE: Mengubah Stok Buku 2');
  await docRef2.set({ stok: 20 }, { merge: true });
  const updatedDoc2 = await docRef2.get();
  console.log(`[SUCCESS] Stok Buku 2 setelah di-update: ${updatedDoc2.data().stok}`);

  // 6. LAPORAN PER KATEGORI
  printHeader('6. LAPORAN PER KATEGORI (Agregasi Data di Firestore)');
  const reportSnap = await col.get();
  const summary = {};
  reportSnap.forEach((doc) => {
    const d = doc.data();
    const kat = d.kategori || 'Lainnya';
    if (!summary[kat]) summary[kat] = { total_judul: 0, total_stok: 0 };
    summary[kat].total_judul += 1;
    summary[kat].total_stok += (d.stok || 0);
  });
  console.table(summary);

  // 7. DELETE (Hapus Buku 3 sebagai demo)
  printHeader('7. OPERASI DELETE: Menghapus Buku 3');
  await docRef3.delete();
  console.log(`[SUCCESS] Buku 3 (${docRef3.id}) berhasil dihapus.`);
  const checkDelete = await docRef3.get();
  console.log(`Verifikasi keberadaan Buku 3 (exists): ${checkDelete.exists}`);

  printHeader('SEMUA PENGUJIAN FIRESTORE SELESAI DENGAN SUKSES!');
}

runDemo().catch((err) => {
  console.error('[ERROR] Pengujian gagal:', err);
});

