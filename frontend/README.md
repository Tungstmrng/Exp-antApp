# Frontend — Smart Expense App

Aplikasi mobile Expo (React Native) untuk scan struk, validasi hasil OCR, dan melihat ringkasan pengeluaran keluarga.

## Menjalankan

```bash
npm install
cp .env.example .env
npm start            # atau: npm run android / npm run ios / npm run web
```

| Variabel env | Keterangan |
|---|---|
| `EXPO_PUBLIC_BACKEND_URL` | URL backend OCR, mis. `http://192.168.1.10:5000`. Pakai IP LAN, bukan `localhost`, saat dijalankan di HP. |

Setelah mengubah `.env`, restart Metro (`npm start -- --clear`).

> Untuk menambah library gunakan `npx expo install <paket>` agar versinya cocok dengan SDK 57. Lihat juga [AGENTS.md](AGENTS.md).

## Struktur

```
frontend/
├── app/                        # Routing berbasis file (expo-router)
│   ├── _layout.tsx             # Root Stack, dibungkus FinanceProvider
│   ├── (tabs)/
│   │   ├── _layout.tsx         # Tab bar: Dashboard, Scan Struk, Analitik
│   │   ├── index.tsx           # Dashboard
│   │   ├── scan.tsx            # Scan & validasi struk
│   │   ├── analytics.tsx       # Analitik per kategori
│   │   └── two.tsx             # sisa template Expo (tampil sebagai tab ekstra) — bisa dihapus
│   ├── modal.tsx               # sisa template Expo — bisa dihapus
│   ├── +html.tsx               # Template HTML (web)
│   └── +not-found.tsx          # Halaman 404
├── context/
│   └── FinanceContext.tsx      # State global transaksi + persistensi AsyncStorage
├── components/                 # Komponen tema (Themed, useColorScheme)
├── constants/Colors.ts
├── assets/                     # Ikon, splash, font
└── app.json                    # Konfigurasi Expo
```

## Layar

### Dashboard — `app/(tabs)/index.tsx`
Menampilkan total seluruh pengeluaran, jumlah struk, dan riwayat transaksi (terbaru di atas). Tombol **Reset Data** menghapus semua transaksi setelah konfirmasi.

### Scan Struk — `app/(tabs)/scan.tsx`
1. Ambil gambar dari **Kamera** atau **Galeri** (`expo-image-picker`, kualitas penuh (1.0) — kompresi ulang JPEG terbukti menambah salah baca OCR).
2. Gambar dikirim sebagai `multipart/form-data` (field `receipt`) ke `POST {BACKEND_URL}/api/scan`.
3. Hasil OCR ditampilkan dalam form yang bisa diedit:
   - nama toko, peringatan dari backend (mis. total tidak cocok);
   - tiap item: nama, harga akhir, kategori (ketuk label kategori untuk mengganti), info qty × harga satuan dan diskon item;
   - item yang harganya dikoreksi otomatis diberi catatan oranye "dikoreksi otomatis dari Rp…"; bila backend ragu, muncul tombol saran "Mungkin Rp…? Ketuk untuk pakai";
   - tambah/hapus item;
   - **Diskon / Voucher** transaksi: tambah, edit, hapus.
4. Ringkasan: subtotal item − diskon/voucher = **Total Bayar**, dibandingkan dengan total yang tertulis di struk (✓ cocok / selisih).
5. **Simpan ke Pengeluaran** — disimpan lewat `addTransaction`.

### Analitik — `app/(tabs)/analytics.tsx`
Menjumlahkan harga item dari semua transaksi per kategori, ditampilkan dengan nominal, progress bar, dan persentase. Di atasnya ditampilkan total hemat dari diskon item dan voucher.

Daftar kategori ada di `constants/Categories.ts` dan harus sama dengan `backend/src/categories.js`.

## State & Penyimpanan — `context/FinanceContext.tsx`

```ts
interface ExpenseItem {
  id: number; name: string; category: string;
  price: number;         // harga akhir (setelah diskon item)
  qty?: number; discount?: number;
}
interface TransactionDiscount { name: string; amount: number } // voucher, kupon, cashback
interface Transaction {
  id: string;            // Date.now()
  merchant_name: string;
  total_amount: number;  // Σ item.price − Σ discounts.amount
  items: ExpenseItem[];
  discounts?: TransactionDiscount[];
  date: string;          // ISO 8601
}
```

| API (`useFinance()`) | Fungsi |
|---|---|
| `transactions` | Daftar transaksi, terbaru di depan |
| `addTransaction(tx)` | Menambah transaksi & menyimpan ke AsyncStorage |
| `clearTransactions()` | Menghapus semua transaksi |

Data disimpan di AsyncStorage dengan key `@family_expense_transactions` dan dimuat sekali saat aplikasi dibuka.

## Catatan

- Kategori tidak dihitung ulang otomatis ketika nama item diedit; pilih manual lewat label kategori.
- Upload memakai `fetch(uri).blob()`; jika upload gagal di Android/iOS, ganti dengan format React Native `{ uri, name, type }`.
