# Backend — Smart Expense OCR

Server Express yang menerima foto struk, menjalankan OCR (bahasa Indonesia), dan mengembalikan nama toko, total, serta daftar item yang sudah dikategorikan.

## Menjalankan

```bash
npm install
npm start
```

| Variabel env | Default | Keterangan |
|---|---|---|
| `PORT` | `5000` | Port server |

File `ind.traineddata` adalah model bahasa Indonesia untuk Tesseract dan dibaca dari folder `backend/`. Worker Tesseract disiapkan sekali saat server start (log: `Tesseract siap.`) lalu dipakai ulang untuk semua request.

```bash
npm test     # menjalankan unit test parser (test/parser.test.js)
```

## Struktur

```
backend/
├── server.js            # Express: endpoint & error handling
├── src/
│   ├── scan.js          # OCR multi-percobaan: pilih hasil yang konsisten
│   ├── ocr.js           # Variasi preprocessing Sharp + worker Tesseract (PSM 6)
│   ├── parser.js        # Teks OCR -> toko, item, diskon, total
│   ├── merchants.js     # Daftar jaringan toko yang dikenali
│   ├── spelling.js      # Koreksi ejaan nama item hasil OCR
│   └── categories.js    # Kata kunci kategori item
├── test/parser.test.js  # Contoh struk (Indomaret, Alfamart, supermarket, toko lokal)
└── ind.traineddata
```

## Endpoint

| Method | Path | Fungsi |
|---|---|---|
| `POST` | `/api/scan` | Upload foto struk (field `receipt`, maks. 10 MB) |
| `POST` | `/api/parse-text` | Parse teks struk tanpa OCR (untuk tuning) |
| `GET` | `/api/categories` | Daftar kategori |

Spesifikasi lengkap: [docs/API.md](../docs/API.md).

## Pipeline Pemrosesan

1. **Preprocessing (Sharp)** — rotasi sesuai EXIF, skala ulang (gambar kecil **diperbesar** agar huruf cukup besar untuk OCR), grayscale, normalize, lalu sharpen atau threshold (hitam-putih).
2. **OCR multi-percobaan (`scan.js`)** — hasil Tesseract sangat dipengaruhi resolusi & kompresi foto (struk yang sama bisa terbaca `7,500` atau `1,900`). Karena itu OCR dicoba dengan beberapa variasi (`VARIANTS` di `ocr.js`: lebar 1500, 2000, 1200+threshold, 2400, 1800+threshold) **sampai hasilnya konsisten** (jumlah item = total struk). Bila hasil pertama sudah konsisten langsung dikembalikan (~2 detik); terburuk ~10 detik. Bila tidak ada yang konsisten, semua teks di-parse ulang dengan **"suara" harga dari semua percobaan** (harga yang dibaca sama oleh banyak percobaan dianggap benar, sehingga koreksi digit diarahkan ke item yang paling meragukan), lalu dipilih hasil dengan skor terbaik. Tesseract memakai bahasa `ind`, `PSM 6`, `preserve_interword_spaces`. Teks mentah varian terpilih dicetak di konsol.
3. **Normalisasi baris** — sampah OCR per kolom (kolom = teks yang dipisah ≥ 5 spasi) dibuang: noda 1-2 karakter di margin kiri, kolom teks ≤ 4 huruf tanpa angka, teks pendek di depan kolom harga (`Kn Sa... 2.000`); `16 000` digabung jadi `16.000` hanya bila dipisah satu spasi (dua kolom `300      300` tidak digabung); teks pendek yang terpisah jauh di kanan dibuang (sampah OCR); kata kunci salah 1 huruf dikembalikan (`Paymeng` → `PAYMENT`, `T0TAL` → `TOTAL`), perbaiki salah baca angka (`3.1OO` → `3.100`, `ix` → `1x`), gabungkan angka terpisah (`16 000` → `16000`), buang `Rp`.
4. **Klasifikasi tiap baris** (urutan prioritas):

   | Jenis | Ciri | Perlakuan |
   |---|---|---|
   | Diskon | `DISC`, `DISKON`, `POTONGAN`, `POT`, `HEMAT`, atau `PROMO` dengan nominal minus | Tepat di bawah item → **diskon item**; selain itu → **diskon transaksi** |
   | Voucher | `VOUCHER`, `KUPON`, `CASHBACK` | Selalu **diskon transaksi** |
   | Ringkasan diskon | `TOTAL DISC`, `ANDA HEMAT` | Tidak dihitung ulang; hanya dipakai bila struk tidak merinci diskon dan totalnya cocok |
   | Total | `TOTAL`, `GRAND TOTAL`, `HARGA JUAL`, `SUBTOTAL` (bukan `TOTAL ITEM`) | Disimpan sebagai `receipt_total`; baris item sesudahnya diabaikan |
   | Pembayaran | `TUNAI`, `KEMBALI`, `DEBIT`, `PAYMENT`, `QRIS`, dll. | Akhir daftar item; nominalnya jadi cadangan total struk |
   | "Item" yang harganya = jumlah semua item sebelumnya | label Total/QRIS tidak terbaca | Dipindah menjadi kandidat total struk |
   | Nominal tanpa label setelah item | `: 43,500` (label Subtotal/Total tidak terbaca) | Dianggap kolom total; nilai yang paling sering muncul dipakai sebagai `receipt_total` |
   | Biaya tambahan | `BIAYA PENGIRIMAN`, `ONGKIR`, `BIAYA LAYANAN`, `PB1`, `SERVICE CHARGE` | Dicatat sebagai item bila > 0 |
   | Header/footer | alamat, NPWP, kasir, tanggal/jam, status/maks kirim e-receipt, dsb. | Diabaikan |
   | Nominal minus tanpa label | `-2,000` di bawah item | Diskon item |
   | Item | teks + nominal | Lihat format di bawah |

5. **Format item yang dikenali**
   - `INDOMIE GRG 2 3,100 6,200` — nama, qty, harga satuan, subtotal (Indomaret/Alfamart)
   - `AQUA 600ML 3.500` — nama + harga
   - `2 NASI GORENG 50.000` — qty di depan (restoran)
   - Dua baris: `INDOMIE GORENG` lalu `5 X 3.100 15.500` (supermarket), atau `RITZ SANDWICH 91GR` lalu `1 PCS X 8,000 8,000` (Allomart). Baris qty yang terbaca kotor (`In es X 7,700`, `il PES Kisa 300 300`) dikenali dari `X` / satuan (`PCS`, `PES`, …) sehingga teksnya tidak dianggap nama. Di baris qty seperti ini harga < 1.000 (mis. kresek `300`) juga dikenali.
   - Nama multi-baris (e-receipt belanja online), harga bisa di baris mana saja:
     ```
     Zinc Sampo Anti Ketombe                          <- awal nama (sebelum baris harga)
     Refreshing Cool Green Tea Mint   1  25,500  25,500
     Botol 170 ml                                     <- lanjutan: diakhiri ukuran (ml, g, pcs, ...)
     Disc. -6,300
     ```
     Baris teks setelah item dianggap **lanjutan nama** bila diakhiri ukuran dan nama item belum berukuran; selain itu dianggap **awal nama item berikutnya**.
   - **Angka tanpa pemisah ribuan** (kode pos `65149`, tahun `2026`) diabaikan bila harga di struk tersebut ditulis dengan pemisah (`25,500`).
6. **Nama toko** — dicocokkan dengan daftar jaringan toko di `merchants.js` (toko roti/restoran/kafe/apotek punya kategori bawaan untuk item yang tidak dikenali, mis. BreadTalk → Makanan & Cemilan). Pencocokan toleran 1 huruf salah OCR dan juga mengenali nama PT, mis. "INDOMARCO" → Indomaret. Jika tidak dikenal, dipakai baris teks pertama dari 10 baris teratas yang bukan alamat/telepon/header aplikasi (mis. `E-RECEIPT`).
7. **Kategori** — kata kunci di `categories.js`; kata kunci terpanjang yang cocok menang (mis. "obat nyamuk" → Rumah Tangga, bukan Kesehatan), kata kunci ≤ 3 huruf harus cocok sebagai kata utuh. Bila tidak ada yang cocok: kategori bawaan toko, lalu dari satuan ukuran (`ml`/`liter` → Minuman, `gr` → Makanan & Cemilan).
8. **Koreksi ejaan nama item** (`spelling.js`) — kata ≥ 5 huruf yang tidak ada di kamus dikoreksi ke kata kamus terdekat (jarak edit 1, atau 2 untuk kata panjang), kata yang terpotong spasi digabung. Contoh: `Le Hinerale` → `Le Minerale`, `Kang ler` → `Kanzler`, `Ice crean` → `Ice cream`. Kamus = kata kunci kategori + kata umum produk.
9. **Total** — `receipt_total` dipilih dari nominal ringkasan (subtotal/total/tanpa label, lalu pembayaran): yang sama dengan jumlah item > paling sering muncul > baris `TOTAL` akhir (bukan subtotal) > paling dekat ke jumlah item. `total_amount` = Σ harga item − diskon transaksi; dibandingkan dengan `receipt_total`. Bila berbeda dan ada item yang `qty × harga satuan`-nya tidak sama dengan harga barisnya (salah baca angka, mis. `1x 9.000  8.000`), harga item dikoreksi jika hasilnya tepat sama dengan total struk. Jika masih selisih, dicoba koreksi **satu digit** salah baca pada satu item (mis. `71,500` → `7,500`, `8` ↔ `9`, `1` ↔ `7`), kecuali bila total struk sama dengan subtotal sebelum diskon. Bila ada beberapa kemungkinan, diutamakan item yang harganya paling jarang terkonfirmasi percobaan OCR lain, lalu perubahan di **digit pertama** (pola salah baca paling umum: `7.200` → `1.200`). Item yang dikoreksi otomatis membawa `ocr_price` (harga asli terbaca) agar aplikasi bisa menandainya. Bila tetap tidak bisa dipastikan, harga tidak diubah dan kemungkinan koreksinya dikembalikan di `suggestions` untuk dipilih pengguna. Selain itu diberi peringatan.

## Menyetel Parser untuk Struk Baru

1. Scan struk, ambil teks mentah dari log konsol atau field `raw_text`.
2. Tambahkan sebagai kasus di `test/parser.test.js`, lalu `npm test`.
3. Sesuaikan kamus kata di `parser.js`, `merchants.js`, `categories.js`, atau `spelling.js` sampai test lolos. Menambah merek di `categories.js` otomatis juga menambah kamus koreksi ejaan.

## Catatan & Keterbatasan

- Parser berbasis aturan: struk dengan format sangat berbeda (mis. kolom harga di kiri) mungkin perlu aturan tambahan.
- PPN yang "sudah termasuk" tidak dihitung; pajak yang ditambahkan selain PB1/pajak restoran perlu dikoreksi manual.
- Nama multi-baris tanpa ukuran di akhir (mis. "Kepala Djenggot Teh Hijau" / "Celup") bisa terpecah ke item berikutnya.
- Foto yang buram/terkompres berat bisa butuh hingga 5 percobaan OCR (~10-15 detik) dan tetap bisa salah — pengguna tetap memvalidasi di aplikasi.
- Satu worker memproses request secara berurutan.
- Belum ada autentikasi — jangan diekspos ke internet publik.
