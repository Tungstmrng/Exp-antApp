const test = require('node:test');
const assert = require('node:assert/strict');
const { parseReceipt } = require('../src/parser');
const { detectCategory } = require('../src/categories');

const names = (r) => r.items.map((i) => i.name);

test('format Indomaret: qty + harga satuan + subtotal per baris, potongan item', () => {
  const r = parseReceipt(`
INDOMARET
PT. INDOMARCO PRISMATAMA
JL. KALIURANG KM 5 NO 12
NPWP 01.337.994.6-092.000
10.10.24-12:30 2.0.31 1234567/ADI/01
INDOMIE GRG SPC 2 3,100 6,200
AQUA 600ML 1 3,500 3,500
SARI ROTI TAWAR 1 16,000 16,000
POTONGAN -2,000
SUNLIGHT JRK 755 1 15,900 15,900
HARGA JUAL : 41,600
TOTAL : 39,600
TUNAI : 50,000
KEMBALI : 10,400
TERIMA KASIH
`);
  assert.equal(r.merchant_name, 'Indomaret');
  assert.deepEqual(names(r), ['INDOMIE GRG SPC', 'AQUA 600ML', 'SARI ROTI TAWAR', 'SUNLIGHT JRK 755']);
  assert.equal(r.items[0].qty, 2);
  assert.equal(r.items[0].unit_price, 3100);
  assert.equal(r.items[2].discount, 2000);
  assert.equal(r.items[2].price, 14000);
  assert.deepEqual(r.items.map((i) => i.category), ['Makanan & Cemilan', 'Minuman', 'Makanan & Cemilan', 'Perlengkapan Mandi & Cuci']);
  assert.equal(r.subtotal, 41600);
  assert.equal(r.discount_total, 2000);
  assert.equal(r.total_amount, 39600);
  assert.equal(r.receipt_total, 39600);
  assert.deepEqual(r.warnings, []);
});

test('format Alfamart: disc item, voucher setelah total, total disc diabaikan', () => {
  const r = parseReceipt(`
ALFAMART
PT. SUMBER ALFARIA TRIJAYA, TBK
ALFAMART JL. MAGELANG 21
Bon 1A2B-3-456 Kasir : SITI
GULAKU 1KG 1 17,500 17,500
RINSO CAIR 800ML 1 22,900 22,900
Disc -3,000
TELUR AYAM 10S 1 25,000 25,000
Total Item 3 62,400
Total Disc. 3,000
Total Belanja 62,400
Voucher Belanja -10,000
Tunai 60,000
Kembalian 7,600
`);
  assert.equal(r.merchant_name, 'Alfamart');
  assert.deepEqual(names(r), ['GULAKU 1KG', 'RINSO CAIR 800ML', 'TELUR AYAM 10S']);
  assert.equal(r.items[1].discount, 3000);
  assert.deepEqual(r.discounts, [{ id: 1, name: 'Voucher Belanja', amount: 10000 }]);
  assert.equal(r.total_amount, 52400);
  assert.equal(r.discount_total, 13000);
  assert.deepEqual(r.items.map((i) => i.category), ['Kebutuhan Pokok', 'Perlengkapan Mandi & Cuci', 'Kebutuhan Pokok']);
});

test('format supermarket 2 baris: nama di atas, "qty x harga" di bawah', () => {
  const r = parseReceipt(`
SUPERINDO
JL. GEJAYAN 10
INDOMIE GORENG
  5 X 3.100        15.500
PAMPERS BABY DRY M
  1 X 89.900       89.900
  DISKON           -9.900
OBAT NYAMUK BAYGON
  2 X 12.500
SUB TOTAL         120.500
TOTAL             120.500
DEBIT BCA         120.500
`);
  assert.equal(r.merchant_name, 'Superindo');
  assert.deepEqual(names(r), ['INDOMIE GORENG', 'PAMPERS BABY DRY M', 'OBAT NYAMUK BAYGON']);
  assert.equal(r.items[0].qty, 5);
  assert.equal(r.items[1].price, 80000);
  assert.equal(r.items[2].price, 25000);
  assert.equal(r.items[2].unit_price, 12500);
  assert.deepEqual(r.items.map((i) => i.category), ['Makanan & Cemilan', 'Kebutuhan Bayi', 'Rumah Tangga']);
  assert.equal(r.total_amount, 120500);
  assert.deepEqual(r.warnings, []);
});

test('koreksi digit tidak dipakai bila total struk = subtotal sebelum diskon', () => {
  const r = parseReceipt(`
TOKO MAJU
PAMPERS BABY DRY M 1 89.900 89.900
DISKON -9.900
SABUN LIFEBUOY 1 5.000 5.000
TOTAL 94.900
`);
  assert.deepEqual(r.items.map((i) => i.price), [80000, 5000]);
  assert.equal(r.total_amount, 85000);
  assert.equal(r.warnings.length, 1);
});

test('toko lokal tak dikenal: nama dari header, kesalahan OCR pada angka', () => {
  const r = parseReceipt(`
TOKO SUMBER REJEKI
Jl. Pasar Baru No. 5 Telp 0274-555123
2 KOPI KAPAL API 3.OOO
BERAS PANDAN WANGI 5KG 72.5OO
MINYAK GORENG 2L 34 000
TOTAL 112.500
`);
  assert.equal(r.merchant_name, 'Toko Sumber Rejeki');
  assert.deepEqual(names(r), ['KOPI KAPAL API', 'BERAS PANDAN WANGI 5KG', 'MINYAK GORENG 2L']);
  assert.equal(r.items[0].qty, 2);
  assert.deepEqual(r.items.map((i) => i.price), [3000, 72500, 34000]);
  assert.deepEqual(r.items.map((i) => i.category), ['Minuman', 'Kebutuhan Pokok', 'Kebutuhan Pokok']);
  // "PANDAN" tidak boleh dibuang karena mengandung "ANDA"
  assert.equal(r.items.length, 3);
});

test('struk asli Alfamart Jogja: koreksi ejaan OCR & harga salah baca', () => {
  // Teks OCR dari foto beresolusi rendah, dengan salah baca yang terlihat di aplikasi.
  const r = parseReceipt(`
ami pengin
Alfamart mi MPA 4
Be Anya pa
Alfanart Jogja
Jl. Kenangan
Jogja
08897482739
18.71.2024 08:49 un BA
Cinory
ix 2.000 2.000
Cinory hazeInut
1x 9.000 8.000
Frestea madu
1x 8.000 8.000
Ice crean aice
1x 5.000 5.000
Kang ler
1x 10.000 10.000
Le Hinerale
1x 4.000 4.000 1
Total Rp38.000 Ll.
Tunai Rp38.000
Lunas li
Barang yang sudah dibeli tidak pi.
isa dikenbalikan lagi
Kasir : Sinta |
Terina kasih
`);
  assert.equal(r.merchant_name, 'Alfamart');
  assert.deepEqual(names(r), ['Cimory', 'Cimory hazelnut', 'Frestea madu', 'Ice cream aice', 'Kanzler', 'Le Minerale']);
  assert.deepEqual(r.items.map((i) => i.price), [2000, 9000, 8000, 5000, 10000, 4000]);
  assert.deepEqual(r.items.map((i) => i.category), [
    'Minuman', 'Minuman', 'Minuman', 'Makanan & Cemilan', 'Makanan & Cemilan', 'Minuman',
  ]);
  assert.equal(r.total_amount, 38000);
  assert.deepEqual(r.warnings, []);
});

test('struk asli BreadTalk: label total hilang, angka salah baca, kategori dari toko', () => {
  // Teks OCR asli dari foto struk BreadTalk (label Subtotal/Total/Payment tidak terbaca).
  const r = parseReceipt(`
BreadTalk
RUKO SUMMARECON BEKASI
JL.BOULEVARD BARU SUMMARECON
(021)
1 POS    WWW. Dtdel1very.COM
ni       1506551 WINDA APRIANI FP
Check No : mm Mi
“Aa       10 May 19 16:32:47
1 Bread Butter Pudding      11,500
1 Cream Bruille            14,000
1 Choco Croissant          10,500
1 Bank Of Chocolat        71,500
:               43,500
.                 43,500
aa    sa
Denit BCA          ay 19 16:33:20-—
——— 31506501 CLOSED 10 May     Sea
v          Tnark YOU.
n            Pl     Come Adall
`);
  assert.equal(r.merchant_name, 'BreadTalk');
  assert.deepEqual(names(r), ['Bread Butter Pudding', 'Cream Bruille', 'Choco Croissant', 'Bank Of Chocolat']);
  assert.deepEqual(r.items.map((i) => i.price), [11500, 14000, 10500, 7500]);
  assert.ok(r.items.every((i) => i.category === 'Makanan & Cemilan'));
  assert.equal(r.receipt_total, 43500);
  assert.equal(r.total_amount, 43500);
  assert.deepEqual(r.warnings, []);
});

test('BreadTalk dengan label terbaca: Payment / Debit bukan item', () => {
  const r = parseReceipt(`
BreadTalk
Check No : 3059689
10 May 19 16:32:47
1 Bread Butter Pudding 11,500
1 Cream Bruille 14,000
1 Choco Croissant 10,500
1 Bank Of Chocolat 7,500
Subtotal : 43,500
Total: 43,500
Payment : 43,500
Debit BCA 43,500
`);
  assert.equal(r.items.length, 4);
  assert.ok(!names(r).some((n) => /payment|debit/i.test(n)));
  assert.equal(r.total_amount, 43500);
});

test('Payment tanpa baris total tetap bukan item', () => {
  const r = parseReceipt(`
TOKO ROTI ENAK
1 Roti Coklat 12,000
1 Donat Gula 8,000
Payment : 20,000
`);
  assert.deepEqual(names(r), ['Roti Coklat', 'Donat Gula']);
});

test('kata kunci salah baca 1 huruf ("Paymeng") tetap dikenali, bukan item', () => {
  const r = parseReceipt(`
BreadTalk
1 Bread Butter Pudding 11,500
1 Choco Croissant 10,500
Paymeng : 22,000
Debit BCA
`);
  assert.deepEqual(names(r), ['Bread Butter Pudding', 'Choco Croissant']);
  assert.equal(r.receipt_total, 22000);
});

test('total struk salah baca: cocokkan dengan nominal ringkasan lain (subtotal/bayar)', () => {
  const r = parseReceipt(`
BreadTalk
1 Bread Butter Pudding 11,500
1 Cream Bruille 14,000
1 Choco Croissant 10,500
1 Bank Of Chocolat 7,500
Subtotal : 43,200
Total: 43,900
Payment : 43,500
Debit BCA 43,500
`);
  assert.deepEqual(r.items.map((i) => i.price), [11500, 14000, 10500, 7500]);
  assert.equal(r.receipt_total, 43500);
  assert.deepEqual(r.warnings, []);
});

test('e-receipt belanja online: nama multi-baris, diskon item, voucher, header & alamat diabaikan', () => {
  // Teks OCR asli dari screenshot e-receipt.
  const r = parseReceipt(`
20.51 1! O
Xx E-RECEIPT
ota Malang, Jawa Timur 65149, Indonesia
Maks Kirim : Selasa, 29 September 2026
07:00 - 22:00
Status Order : Selesai
VILLA TIDAR MALANG
081294670414
KARANGWIDORO, DAU
JL. PERUM VILLA TIDAR ESTATE KEL. KARANGWIDORO KEC. DAU MALANG
Ref. $-260928-AGOSSYW
Zinc Sampo Anti Ketombe
Refreshing Cool Green Tea Mint 1 25,500 25,500
Botol 170 ml
Disc. -6,300
Jetz Makanan Ringan Choco 1 7,400 7,400
Fiesta 65 g
Delfi Take-It Ovaltine Cokelat
Susu Wafer 4F 35 g ! 15.000 13.000
Disc. -5,100
Kepala Djenggot Teh Hijau 1 21,500 21,500
Celup 25 pcs
Chiki Balls Makanan Ringan
Crafty Cheese 50 g 1 7.000 7.600
Subtotal 5 77,000
Total Diskon -11,400
Voucher -25,000
Biaya Pengiriman 0
Total 40,600
Harga yang tertera sudah termasuk PPN
LUNAS
E-receipt available for 90 days since transaction date
`);
  assert.equal(r.merchant_name, 'Villa Tidar Malang');
  assert.deepEqual(names(r), [
    'Zinc Sampo Anti Ketombe Refreshing Cool Green Tea Mint Botol 170 ml',
    'Jetz Makanan Ringan Choco Fiesta 65 g',
    'Delfi Take-It Ovaltine Cokelat Susu Wafer 4F 35 g',
    'Kepala Djenggot Teh Hijau Celup 25 pcs',
    'Chiki Balls Makanan Ringan Crafty Cheese 50 g',
  ]);
  assert.deepEqual(r.items.map((i) => i.discount), [6300, 0, 5100, 0, 0]);
  assert.deepEqual(r.items.map((i) => i.price), [19200, 7400, 9900, 21500, 7600]);
  assert.deepEqual(r.items.map((i) => i.category), [
    'Perlengkapan Mandi & Cuci', 'Makanan & Cemilan', 'Makanan & Cemilan', 'Minuman', 'Makanan & Cemilan',
  ]);
  assert.deepEqual(r.discounts, [{ id: 1, name: 'Voucher', amount: 25000 }]);
  assert.equal(r.subtotal, 77000);
  assert.equal(r.total_amount, 40600);
  assert.equal(r.receipt_total, 40600);
  assert.deepEqual(r.warnings, []);
});

test('biaya tambahan (ongkir / PB1) masuk sebagai item & total', () => {
  const r = parseReceipt(`
WARUNG MAKAN SEDERHANA
2 Nasi Goreng 50.000
1 Es Teh 5.000
PB1 10% 5.500
Total 60.500
`);
  assert.deepEqual(names(r), ['Nasi Goreng', 'Es Teh', 'PB1 10%']);
  assert.equal(r.total_amount, 60500);
  assert.deepEqual(r.warnings, []);
});

test('koreksi digit ambigu: pilih harga yang paling jarang terkonfirmasi percobaan OCR lain', () => {
  // 1.600 -> 7.600 dan 21.500 -> 27.500 sama-sama menutup selisih 6.000.
  const text = `
Kepala Djenggot Teh Hijau 1 21,500 21,500
Chiki Balls Crafty Cheese 50 g 1 1.600 1.600
Total 29,100
`;
  // Tanpa data percobaan lain: perubahan di digit pertama diutamakan (1.600 -> 7.600).
  const plain = parseReceipt(text);
  assert.deepEqual(plain.items.map((i) => i.price), [21500, 7600]);
  assert.equal(plain.items[1].ocr_price, 1600);

  // Harga Kepala Djenggot dibaca 21.500 oleh 5 percobaan, Chiki 1.600 hanya oleh 1.
  const priceReadings = new Map([
    ['kepala djenggot', new Map([[21500, 5]])],
    ['chiki balls', new Map([[1600, 1]])],
  ]);
  const r = parseReceipt(text, { priceReadings });
  assert.deepEqual(r.items.map((i) => i.price), [21500, 7600]);
  assert.deepEqual(r.warnings, []);
});

test('struk asli Allomart: format 2 baris dengan baris qty kotor, harga 300, total tanpa pemisah', () => {
  // Teks OCR asli dari foto struk Allomart (logo terbaca "Pe", baris qty "1 PCS X" terbaca kotor).
  const r = parseReceipt(`
Pe Grosir & Retail
PT ALLO SUMBER BERKAT
NPWP:0623725389623000
Jl. Raya Candi V no 758 , Malang
Telp./wa 082 335 665 607
No           : MLG-TKO-0100100/01/03/2/260731
Kasir      : RIAS, Kassa : 3
Tanggal :31-07-2026 18:19:53
Transaksi : RTL
Customer :                                                   aan    Kara
FESTIVAL STIKBALADO 200GRE Me 2     Nas
1       PCS            X             8,500          8,500
BROOKFARM UHT ALMOND SALTED CARAMEL 200ML                            DN,
In es            X             7,700          7,700                       :
SAGIKO LYCHEE CAN 320ML
1       PCS            X             9,500          9,500
RITZ SANDWICH CHEESE 91GR
in PCS            X             8,000          8,000                    :
KRESEK POLOS                                                    Sea
il    PES Kisa 300       300
:    x aer         Total      :      1       P.  ki Mai.     34000.
|     GRIS BCA               ———    Pan ana pa   h 34,00 0        00
 Total Oty:5    —.—.—.—.—.—
`);
  assert.equal(r.merchant_name, 'Allomart');
  assert.deepEqual(names(r), [
    'FESTIVAL STIKBALADO 200GRE', 'BROOKFARM UHT ALMOND SALTED CARAMEL 200ML', 'SAGIKO LYCHEE CAN 320ML',
    'RITZ SANDWICH CHEESE 91GR', 'KRESEK POLOS',
  ]);
  assert.deepEqual(r.items.map((i) => i.price), [8500, 7700, 9500, 8000, 300]);
  assert.deepEqual(r.items.map((i) => i.category), [
    'Makanan & Cemilan', 'Minuman', 'Minuman', 'Makanan & Cemilan', 'Rumah Tangga',
  ]);
  assert.equal(r.total_amount, 34000);
  assert.equal(r.receipt_total, 34000);
  assert.deepEqual(r.warnings, []);
});

test('baris total tanpa label yang terbaca sebagai item dipindah ke total struk', () => {
  const r = parseReceipt(`
TOKO ABC
SAGIKO LYCHEE CAN 320ML
1 PCS X 9,500 9,500
RITZ SANDWICH CHEESE 91GR
1 PCS X 8,000 8,000
1 TOK sesar DE ren 17,500
FP ORISBCA ne 17,500
`);
  assert.deepEqual(r.items.map((i) => i.price), [9500, 8000]);
  assert.equal(r.receipt_total, 17500);
  assert.deepEqual(r.warnings, []);
});

test('Allomart dari HP: satuan qty salah baca ("1 PG X ...... 300 300"), label Total hilang', () => {
  // Teks OCR asli dari log backend saat scan lewat aplikasi.
  const r = parseReceipt(`
ALLOMART
O Grosir & Retail

PT ALLO SUMBER BERKAT
NPWP:0623725389623000
Jl. Raya Candi V no 758 , Malang
Telp./wa 082 335 665 607
No           :MLG-TKO-0100100/01/03/2/260731
Kasir      : RIAS, Kassa : 3
Tanggal :31-07-2026 18:19:53
Transaksi : RTL
Customer :
“ESTIVAL STIK BALADO 200GR           —   Bet

1       PCS           Xx            8,500          8,500                     '
EROOKFARM UHT ALMOND SALTED CARAMEL 200ML            N,

1 PS           X            7,700          7,700                     h
SAGIKO LYCHEE CAN 320ML

1       PCS           X            9,500          9,500
RITZ SANDWICH CHEESE 91GR

1 PCS           Xx            8,000         8,000                  .
KRESEK POLOS

1 PG X ...... 300      300

34,000

------------------------
`);
  assert.equal(r.merchant_name, 'Allomart');
  assert.deepEqual(names(r), [
    'FESTIVAL STIK BALADO 200GR', 'BROOKFARM UHT ALMOND SALTED CARAMEL 200ML', 'SAGIKO LYCHEE CAN 320ML',
    'RITZ SANDWICH CHEESE 91GR', 'KRESEK POLOS',
  ]);
  assert.deepEqual(r.items.map((i) => i.price), [8500, 7700, 9500, 8000, 300]);
  assert.equal(r.receipt_total, 34000);
  assert.deepEqual(r.warnings, []);
});

test('dua kolom harga "300   300" tidak digabung jadi 300300', () => {
  const { normalizeLine } = require('../src/parser');
  assert.equal(normalizeLine('1 PCS X 300       300'), '1 PCS X 300 300');
  assert.equal(normalizeLine('MINYAK GORENG 2L 34 000'), 'MINYAK GORENG 2L 34.000');
});

test('struk asli Lokal Mart: logo 2 baris, sampah kolom, angka 7 terbaca 1', () => {
  // Teks OCR asli (Chiki 7.200 terbaca 1.200 di semua percobaan OCR).
  const r = parseReceipt(`
1 7  1               &                     SEAT
m
fo LOKAL
MART
1             0.0. “Ta
Jl Raya Candi VI C no 1 , Karanghesuk1 , Sukur ,
Kota HA LaNg
              Receipt No.  LKMb-25281
DD
”   Order Date             04/05/2026 18.20.0656
-         Cashie!                          Jeni Vika Sari
ad    Customer               ms Aldo
Ap         Customer Phone                    H62877742A FX 4
p        1 SARIWANGI MELATI SUPREME TB (25X1,9G). 11.200
|            1 Chiki Balls Crafty Cheese bogr           1.200
1 Nissin Walens Soes 10091 Cheese         13.000
1 Strawberry Guava Smooth1es              23.000
1 Kresek Belanja         Kn Sa... 2.000
Subtotal                                96.400
10TAL                                     56.400
GRIS BCA                          96. 400
Loyalty Port Reward :                      251
en    Current Loyalty Point :     Na.        500
`);
  assert.equal(r.merchant_name, 'Lokal Mart');
  assert.deepEqual(names(r), [
    'SARIWANGI MELATI SUPREME TB (25X1,9G)', 'Chiki Balls Crafty Cheese bogr', 'Nissin Walens Soes 10091 Cheese',
    'Strawberry Guava Smoothies', 'Kresek Belanja',
  ]);
  assert.deepEqual(r.items.map((i) => i.price), [11200, 7200, 13000, 23000, 2000]);
  assert.equal(r.items[1].ocr_price, 1200);
  assert.deepEqual(r.items.map((i) => i.category), [
    'Minuman', 'Makanan & Cemilan', 'Makanan & Cemilan', 'Minuman', 'Rumah Tangga',
  ]);
  assert.equal(r.total_amount, 56400);
  assert.deepEqual(r.warnings, []);
});

test('koreksi digit yang benar-benar ambigu dikembalikan sebagai saran, harga tidak diubah', () => {
  // 1.200 -> 7.200 dan 1.500 -> 7.500 sama-sama di digit pertama & sama-sama menutup selisih.
  const r = parseReceipt(`
TOKO X
ROTI TAWAR 1.200
SUSU KOTAK 1.500
Total 8.700
`);
  assert.deepEqual(r.items.map((i) => i.price), [1200, 1500]);
  assert.deepEqual(r.suggestions, [{ item_id: 1, price: 7200 }, { item_id: 2, price: 7500 }]);
  assert.equal(r.warnings.length, 1);
});

test('Lokal Mart dari HP: dua harga salah baca (7.200 -> 1.200, 13.000 -> 13.900) dikoreksi', () => {
  // Teks OCR asli dari log backend saat scan lewat aplikasi.
  const r = parseReceipt(`
an. 1          hi               ST
r
fo LOKAL
4                 5 Dana
Jl Raya Candi V1 C no 1 , Karanghesuki , Sukun ,
— Kota Halang
                       Receipt No.  LKMb-25281
MM   Order Date                  04/05/2026 18.20.0656
3     Cashie!                           Jeni Vika Sari
P        1 SARIWANGI MELATI SUPREME TR (25X1,9G) 11.200
1 Chiki Balls Crafty Cheese 59gr           1.200
1 Nissin Walens Soes LOOP Cheese         13.900
1 Strawberry Guava Smooth1es             23.000
1 Kresek Belanja          B4... 2.000
Subtotal                                26.400
TOTAL                                   56.400
ORIS BCA                          96. 400
`);
  assert.equal(r.merchant_name, 'Lokal Mart');
  assert.deepEqual(r.items.map((i) => i.price), [11200, 7200, 13000, 23000, 2000]);
  assert.deepEqual(r.items.map((i) => i.ocr_price), [undefined, 1200, 13900, undefined, undefined]);
  assert.equal(r.total_amount, 56400);
  // Dua koreksi sekaligus: tetap diminta diperiksa pengguna.
  assert.equal(r.warnings.length, 1);
});

test('koreksi dua harga tidak dipakai pada hasil OCR kacau (tanpa perubahan digit pertama)', () => {
  // Baris Subtotal terbaca sebagai item 26.400; selisih 2.600 bisa "ditutup" 13.000->13.600 &
  // 26.400->28.400, tetapi itu kebetulan -> harus tetap diberi peringatan.
  const r = parseReceipt(`
LOKAL MART
1 SARIWANGI MELATI SUPREME TE 11.200
1 Chiki Balls Craftiy Cheese 55gr 1.200
1 Nizsin Walenu Sous Cheese 13.000
1 Kresek Belanja 2.000
Suhtota 26. 4y0 26.400
TOTAL 56.400
`);
  assert.ok(r.items.every((i) => i.ocr_price === undefined));
  assert.equal(r.warnings.length, 1);
});

test('kata "LOKAL" hanya dipakai sebagai nama toko bila ada di header', () => {
  const r = parseReceipt(`
TOKO SEMBAKO MURAH
Jl. Pasar No. 1
BERAS LOKAL 5KG 1 65.000 65.000
TOTAL 65.000
`);
  assert.equal(r.merchant_name, 'Toko Sembako Murah');
});

test('koreksi ejaan tidak mengubah kata yang sudah benar', () => {
  const { correctItemName } = require('../src/spelling');
  assert.equal(correctItemName('SARI ROTI TAWAR'), 'SARI ROTI TAWAR');
  assert.equal(correctItemName('INDOMIE GRG SPC'), 'INDOMIE GRG SPC');
  assert.equal(correctItemName('RINSO CAIR 800ML'), 'RINSO CAIR 800ML');
  assert.equal(correctItemName('BERAS PANDAN WANGI 5KG'), 'BERAS PANDAN WANGI 5KG');
  assert.equal(correctItemName('PAMPERS BABY DRY M'), 'PAMPERS BABY DRY M');
  assert.equal(correctItemName('Bank Of Chocolat'), 'Bank Of Chocolat');
  assert.equal(correctItemName('Lada Hitam Bubuk'), 'Lada Hitam Bubuk');
  assert.equal(correctItemName('Susu Wafer 4F 35 g'), 'Susu Wafer 4F 35 g');
});

test('sisa OCR di ujung nama item dibuang, ukuran tetap', () => {
  const r = parseReceipt(`
TOKO X
Le Minerale 1 4.000 4.000
Delfi Wafer 4F 35 g L 1 15.000 15.000
Chiki Balls 50 g . 7100 1 7.600 7.600
PAMPERS BABY DRY M 1 89.900 89.900
SUNLIGHT JRK 755 1 15.900 15.900
Total 132.400
`);
  assert.deepEqual(names(r), ['Le Minerale', 'Delfi Wafer 4F 35 g', 'Chiki Balls 50 g', 'PAMPERS BABY DRY M', 'SUNLIGHT JRK 755']);
});

test('koreksi huruf yang terbaca angka / huruf mirip pada kata pendek', () => {
  const { correctItemName } = require('../src/spelling');
  assert.equal(correctItemName('Ice cream a1ce'), 'Ice cream aice');
  assert.equal(correctItemName('Ice cream alce'), 'Ice cream aice');
  assert.equal(correctItemName('Delfi C0kelat'), 'Delfi Cokelat');
  assert.equal(correctItemName('cimory hazelnut'), 'Cimory hazelnut');
});

test('hanya total diskon tercetak: dipakai bila cocok dengan total struk', () => {
  const r = parseReceipt(`
TOKO MAJU
SABUN LIFEBOUY 1 5,000 5,000
SHAMPOO CLEAR 1 20,000 20,000
ANDA HEMAT 4,000
TOTAL 21,000
`);
  assert.deepEqual(r.discounts, [{ id: 1, name: 'Diskon', amount: 4000 }]);
  assert.equal(r.total_amount, 21000);
});

test('item tidak terbaca: fallback ke total struk dengan peringatan', () => {
  const r = parseReceipt(`
WARUNG BU SRI
xx ## ..
TOTAL 45.000
`);
  assert.equal(r.items.length, 1);
  assert.equal(r.items[0].name, 'Belanjaan Umum');
  assert.equal(r.total_amount, 45000);
  assert.equal(r.warnings.length, 1);
});

test('struk kosong tidak memakai angka palsu', () => {
  const r = parseReceipt('');
  assert.equal(r.items.length, 0);
  assert.equal(r.total_amount, 0);
  assert.equal(r.merchant_name, 'Toko / Minimarket Umum');
});

test('kategori: kata kunci terpanjang menang & kata pendek harus utuh', () => {
  assert.equal(detectCategory('OBAT NYAMUK HIT'), 'Rumah Tangga');
  assert.equal(detectCategory('MINYAK KAYU PUTIH CAP LANG'), 'Kesehatan');
  assert.equal(detectCategory('TEH PUCUK HARUM'), 'Minuman');
  assert.equal(detectCategory('SUSU UHT ULTRA'), 'Minuman');
  assert.equal(detectCategory('SUSU KENTAL MANIS'), 'Kebutuhan Pokok');
  assert.equal(detectCategory('SARI ROTI SANDWICH'), 'Makanan & Cemilan');
  assert.equal(detectCategory('KOLAK PISANG'), 'Makanan & Cemilan'); // "kol" bukan sayur kol
  assert.equal(detectCategory('BARANG ACAK'), 'Kebutuhan Umum');
});
