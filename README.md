# Smart Expense App

Aplikasi pencatat pengeluaran keluarga berbasis **scan struk belanja**. Foto struk dibaca dengan OCR, item dan harganya diekstrak serta dikategorikan otomatis, lalu pengguna memvalidasi hasilnya sebelum disimpan.

## Struktur Project

```
ExpenseApp/
├── backend/     # Server OCR — Node.js, Express, Tesseract.js, Sharp
├── frontend/    # Aplikasi mobile — Expo (React Native), expo-router
├── docs/        # Dokumentasi arsitektur & API
└── README.md
```

| Bagian | Teknologi | Dokumentasi |
|---|---|---|
| Backend | Express 5, Multer, Sharp, Tesseract.js 7 | [backend/README.md](backend/README.md) |
| Frontend | Expo SDK 57, React Native 0.86, expo-router, AsyncStorage | [frontend/README.md](frontend/README.md) |
| Arsitektur | Alur data & keputusan desain | [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) |
| API | Spesifikasi endpoint | [docs/API.md](docs/API.md) |

## Quick Start

Prasyarat: Node.js 20+, npm, dan aplikasi **Expo Go** di HP (HP dan komputer berada di jaringan Wi-Fi yang sama).

**1. Jalankan backend**

```bash
cd backend
npm install
npm start          # http://0.0.0.0:5000
```

**2. Jalankan frontend**

```bash
cd frontend
npm install
cp .env.example .env   # lalu isi EXPO_PUBLIC_BACKEND_URL dengan IP komputer Anda
npm start              # scan QR code dengan Expo Go
```

Cari IP komputer dengan `ipconfig` (Windows) atau `ifconfig` / `ip a` (macOS/Linux).

## Fitur

- **Dashboard** — total pengeluaran dan riwayat transaksi, tombol reset data.
- **Scan Struk** — ambil foto dari kamera/galeri, hasil OCR bisa diedit (nama toko, nama & harga item, hapus item) sebelum disimpan.
- **Analitik** — total dan persentase pengeluaran per kategori.

Data disimpan **lokal di perangkat** (AsyncStorage); belum ada sinkronisasi ke server.
