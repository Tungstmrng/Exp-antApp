# Arsitektur

## Gambaran Umum

```
┌──────────────────────── HP (Expo Go) ────────────────────────┐
│                                                               │
│  Scan Struk ──(foto)──┐                                       │
│                       │ POST /api/scan (multipart)            │
│                       ▼                                       │
│              ┌─────────────────┐    ┌──────────────────────┐  │
│              │ Form validasi   │──▶ │ FinanceContext       │  │
│              │ (edit manual)   │    │  └─ AsyncStorage     │  │
│              └─────────────────┘    └──────────┬───────────┘  │
│                                                │              │
│                         Dashboard ◀────────────┼──▶ Analitik  │
└───────────────────────────────────────────────────────────────┘
                        │ Wi-Fi / LAN
                        ▼
┌──────────────────── Backend (Node.js) ───────────────────────┐
│  Multer → Sharp (preprocess) → Tesseract (OCR, ind)          │
│        → Parser (toko, total, item) → detectCategory()       │
└───────────────────────────────────────────────────────────────┘
```

## Alur Scan Struk

1. Pengguna memilih gambar dari kamera/galeri di layar **Scan**.
2. Frontend mengirim gambar ke backend `POST /api/scan`.
3. Backend:
   1. Preprocessing gambar dengan Sharp (resize, grayscale, normalize, sharpen) untuk meningkatkan akurasi OCR.
   2. OCR dengan Tesseract.js menggunakan model bahasa Indonesia (`ind.traineddata`).
   3. Parsing teks berbasis heuristik (regex + blacklist kata) untuk mendapatkan nama toko, total, dan item.
   4. Kategorisasi item berbasis kata kunci.
4. Frontend menampilkan hasil sebagai form yang bisa diedit — OCR struk jarang 100% akurat, jadi **validasi manual oleh pengguna adalah bagian inti alur**.
5. Saat disimpan, total dihitung ulang dari item yang sudah divalidasi, lalu transaksi ditambahkan ke `FinanceContext` dan dipersist ke AsyncStorage.
6. **Dashboard** dan **Analitik** membaca dari context yang sama sehingga langsung ter-update.

## Keputusan Desain

| Keputusan | Alasan |
|---|---|
| OCR di server, bukan di HP | Tesseract + Sharp butuh native/WASM berat; lebih mudah dijalankan di Node.js |
| Parsing heuristik, bukan ML/LLM | Sederhana, gratis, berjalan offline di jaringan lokal |
| Penyimpanan lokal (AsyncStorage) | Belum perlu akun/sinkronisasi; data tetap di perangkat |
| Total dihitung ulang di frontend | Angka yang disimpan selalu konsisten dengan item hasil koreksi pengguna |

## Batasan Saat Ini

- Backend harus berada di jaringan yang sama dengan HP (IP diatur lewat `EXPO_PUBLIC_BACKEND_URL`).
- Tidak ada autentikasi, multi-user, atau sinkronisasi antar perangkat.
- Kategori ditentukan saat scan; bila salah, pengguna memilih ulang secara manual.
- Pajak/service restoran belum dihitung sebagai biaya tambahan.
- Akurasi parsing bergantung pada format struk; kamus kata di `backend/src/parser.js`, `merchants.js`, dan `categories.js` perlu ditambah seiring jenis struk baru.

## Ide Pengembangan

- Edit tanggal & kategori transaksi, hapus transaksi satuan.
- Filter analitik per bulan dan grafik tren.
- Sinkronisasi data ke database server untuk berbagi antar anggota keluarga.
