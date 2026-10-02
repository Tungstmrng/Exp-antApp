# API Reference

Base URL: `http://<host>:5000` (port bisa diubah lewat env `PORT`).

CORS terbuka untuk semua origin. Belum ada autentikasi.

---

## `POST /api/scan`

Menerima foto struk dan mengembalikan hasil ekstraksi OCR.

### Request

`Content-Type: multipart/form-data`

| Field | Tipe | Wajib | Keterangan |
|---|---|---|---|
| `receipt` | file (gambar JPG/PNG/WebP) | ya | Foto struk belanja |

```bash
curl -F "receipt=@struk.jpg" http://localhost:5000/api/scan
```

### Response `200 OK`

```json
{
  "success": true,
  "message": "Struk berhasil diproses.",
  "data": {
    "merchant_name": "Alfamart",
    "total_amount": 52400,
    "receipt_total": 62400,
    "subtotal": 65400,
    "discount_total": 13000,
    "items": [
      { "id": 1, "name": "GULAKU 1KG", "qty": 1, "unit_price": 17500, "price": 17500, "discount": 0, "category": "Kebutuhan Pokok" },
      { "id": 2, "name": "RINSO CAIR 800ML", "qty": 1, "unit_price": 22900, "price": 19900, "discount": 3000, "category": "Perlengkapan Mandi & Cuci" }
    ],
    "discounts": [
      { "id": 1, "name": "Voucher Belanja", "amount": 10000 }
    ],
    "warnings": ["Total hasil hitung berbeda dengan total di struk. Periksa kembali item dan diskon."],
    "raw_text": "ALFAMART\n..."
  }
}
```

| Field | Tipe | Keterangan |
|---|---|---|
| `merchant_name` | string | Nama toko (jaringan toko dikenal → nama resmi, mis. "Indomaret"); default `"Toko / Minimarket Umum"` |
| `total_amount` | number | Total bayar hasil hitung = Σ `items[].price` − Σ `discounts[].amount` |
| `receipt_total` | number \| null | Total yang tertulis di struk (baris `TOTAL`), sebagai pembanding |
| `subtotal` | number | Σ harga item sebelum diskon item |
| `discount_total` | number | Seluruh potongan (diskon item + diskon/voucher transaksi) |
| `items[].qty` | number | Jumlah barang |
| `items[].unit_price` | number | Harga satuan |
| `items[].price` | number | Harga akhir item = qty × harga satuan − `discount` |
| `items[].discount` | number | Diskon/potongan yang tercetak tepat di bawah item |
| `items[].category` | string | `Kebutuhan Pokok`, `Makanan & Cemilan`, `Minuman`, `Perlengkapan Mandi & Cuci`, `Kebutuhan Bayi`, `Kesehatan`, `Rumah Tangga`, `Kebutuhan Umum` |
| `items[].ocr_price` | number (opsional) | Ada bila harga item dikoreksi otomatis: harga asli yang terbaca OCR |
| `suggestions[]` | `{ item_id, price }[]` | Saran koreksi harga yang tidak bisa dipastikan (ditampilkan sebagai tombol di aplikasi) |
| `discounts[]` | array | Potongan level transaksi: voucher, kupon, cashback, atau diskon setelah baris total |
| `warnings[]` | string[] | Peringatan untuk pengguna (struk tidak terbaca, total tidak cocok, dsb.) |
| `raw_text` | string | Teks mentah hasil OCR (untuk debugging) |

Biaya tambahan seperti ongkir, biaya layanan, atau PB1 (bila > 0) dikembalikan sebagai item dengan kategori `Kebutuhan Umum`.

Jika item tidak terbaca tetapi total struk ada, dikembalikan satu item `"Belanjaan Umum"` seharga total. Jika tidak ada yang terbaca, `items` kosong dan `total_amount` = 0.

### Response Error

| Status | Kondisi | Body |
|---|---|---|
| `400` | Field `receipt` tidak dikirim | `{ "success": false, "message": "Tidak ada file gambar struk." }` |
| `500` | Gagal preprocessing / OCR | `{ "success": false, "message": "<pesan error>" }` |

---

## `POST /api/parse-text`

Menjalankan parser pada teks struk tanpa OCR — berguna untuk menguji/menyetel parser memakai `raw_text` dari hasil scan.

```bash
curl -X POST http://localhost:5000/api/parse-text \
  -H "Content-Type: application/json" \
  -d '{"text":"INDOMARET\nAQUA 600ML 1 3,500 3,500\nTOTAL 3,500"}'
```

Response: `{ "success": true, "data": { ... } }` — sama seperti `/api/scan` tanpa `raw_text`.

---

## `GET /api/categories`

Daftar nama kategori yang dipakai parser.
