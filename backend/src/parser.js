const { detectCategory, DEFAULT_CATEGORY } = require('./categories');
const { findKnownMerchant } = require('./merchants');
const { correctItemName, levenshtein, isDictionaryWord } = require('./spelling');

const DEFAULT_MERCHANT = 'Toko / Minimarket Umum';
const MIN_PRICE = 100;
const MAX_PRICE = 10000000;

// --- Kamus kata (dicocokkan sebagai kata utuh pada baris huruf besar) ---------

const TOTAL_WORDS = ['TOTAL', 'SUBTOTAL', 'SUB TOTAL', 'GRAND TOTAL', 'JUMLAH', 'HARGA JUAL', 'TAGIHAN', 'NETTO'];
const SUBTOTAL_WORDS = ['SUBTOTAL', 'SUB TOTAL', 'HARGA JUAL'];
const TOTAL_EXCLUDE_WORDS = ['ITEM', 'ITEMS', 'QTY', 'JML ITEM', 'PPN', 'DPP', 'PAJAK'];

const DISCOUNT_WORDS = [
  'DISC', 'DISK', 'DISKON', 'DISCOUNT', 'POTONGAN', 'POT', 'HEMAT',
  'VOUCHER', 'VOUCER', 'VOCHER', 'VOUCH', 'KUPON', 'COUPON', 'CASHBACK',
];
// Potongan level transaksi (tidak ditempel ke item sebelumnya).
const VOUCHER_WORDS = ['VOUCHER', 'VOUCER', 'VOCHER', 'VOUCH', 'KUPON', 'COUPON', 'CASHBACK'];
// "PROMO" hanya dianggap potongan bila nominalnya bertanda minus.
const WEAK_DISCOUNT_WORDS = ['PROMO', 'PROMOSI'];
// Baris ringkasan potongan (mis. "TOTAL DISC", "ANDA HEMAT") — informasi saja.
const DISCOUNT_SUMMARY_WORDS = ['TOTAL', 'ANDA', 'JUMLAH'];

const PAYMENT_WORDS = [
  'TUNAI', 'CASH', 'KEMBALI', 'KEMBALIAN', 'CHANGE', 'DEBIT', 'KREDIT', 'CREDIT', 'BAYAR', 'PEMBAYARAN',
  'DIBAYAR', 'PAYMENT', 'PAID', 'TENDER', 'QRIS', 'ORIS', 'GRIS', 'QR1S', 'OVO', 'GOPAY', 'DANA', 'SHOPEEPAY', 'LINKAJA', 'EDC',
  'KARTU', 'CARD', 'VISA', 'MASTERCARD', 'LUNAS',
];

// Baris header/footer yang bukan item belanja.
const BOILERPLATE_WORDS = [
  'PT', 'CV', 'TBK', 'NPWP', 'JL', 'JLN', 'JALAN', 'TELP', 'TLP', 'TELEPON', 'PHONE', 'FAX',
  'KASIR', 'CASHIER', 'CASHIE', 'NO', 'NOMOR', 'TGL', 'TANGGAL', 'DATE', 'JAM', 'WAKTU', 'STRUK', 'BON', 'NOTA',
  'INVOICE', 'MEMBER', 'POIN', 'POINT', 'TERIMA KASIH', 'THANK', 'THANKS', 'SARAN', 'KRITIK',
  'LAYANAN', 'KONSUMEN', 'CUSTOMER', 'CALL', 'SMS', 'WHATSAPP', 'WA', 'EMAIL', 'WWW', 'COM',
  'DITUKAR', 'DIKEMBALIKAN', 'PERUMAHAN', 'KEL', 'KEC', 'KOTA', 'KAB', 'RT', 'RW', 'PENGUKUHAN',
  'PKP', 'BKP', 'BTKP', 'DPP', 'PPN', 'TERMASUK', 'INCLUDE', 'PERIODE', 'DESKRIPSI', 'QTY', 'HARGA',
  'SHIFT', 'TRX', 'REF', 'APPROVAL', 'BATCH', 'TID', 'MID', 'PULSA', 'STICKER',
  // e-receipt / belanja online
  'RECEIPT', 'STATUS', 'ORDER', 'PESANAN', 'MAKS', 'KIRIM', 'ALAMAT', 'PENERIMA', 'INDONESIA', 'PROVINSI',
  'JAWA', 'AVAILABLE', 'DOWNLOAD', 'SHARE', 'TRANSACTION',
];

// Biaya tambahan yang menambah total (ongkir, layanan, pajak restoran) -> dicatat sebagai item.
const CHARGE_WORDS = [
  'BIAYA PENGIRIMAN', 'ONGKIR', 'ONGKOS KIRIM', 'BIAYA KIRIM', 'BIAYA LAYANAN', 'BIAYA ADMIN', 'BIAYA APLIKASI',
  'BIAYA KEMASAN', 'SERVICE CHARGE', 'PB1', 'PAJAK RESTORAN', 'PAJAK RESTO',
];

const wordRegex = (words) =>
  new RegExp(`(?:^|[^A-Z])(?:${words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})(?=[^A-Z]|$)`);

const RE = {
  total: wordRegex(TOTAL_WORDS),
  subtotal: wordRegex(SUBTOTAL_WORDS),
  totalExclude: wordRegex(TOTAL_EXCLUDE_WORDS),
  discount: wordRegex(DISCOUNT_WORDS),
  voucher: wordRegex(VOUCHER_WORDS),
  weakDiscount: wordRegex(WEAK_DISCOUNT_WORDS),
  discountSummary: wordRegex(DISCOUNT_SUMMARY_WORDS),
  payment: wordRegex(PAYMENT_WORDS),
  charge: wordRegex(CHARGE_WORDS),
  // Baris qty format 2 baris: "1 PCS X ...", juga bila satuannya salah baca ("1 PG X", "1 PS X").
  qtyLine: /^\s*\d{1,3}\s+(?:\S{1,4}\s+)?[xX×]{1,2}(?=\s|$)|(?:^|\s)[xX×*]\s*$|(?:^|[^A-Za-z])(?:PCS|PES|PC|PCE|BH|BKS|PAK|PACK|UNIT|BTL|LBR|SCT|RTG)(?=[^A-Za-z]|$)/i,
  boilerplate: wordRegex(BOILERPLATE_WORDS),
  date: /\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}|\d{1,2}:\d{2}/,
  // Nama produk biasanya diakhiri ukuran: "Botol 170 ml", "65 g", "25 pcs", "10S"
  sizeEnd: /\d+(?:[.,]\d+)?\s?(?:ml|l|lt|ltr|liter|g|gr|gram|kg|mg|pcs|pc|s|sachet|sct|btl|pack|pak|lbr|lembar|cm|mm|oz|tab|tablet|kapsul|caps)\.?$/i,
};

// Kata kunci ringkasan/pembayaran yang salah 1 huruf oleh OCR ("Paymeng", "T0TAL", "Kenbali")
// dikembalikan ke bentuk aslinya agar baris tersebut tidak terbaca sebagai item.
const FUZZY_KEYWORDS = [
  'TOTAL', 'SUBTOTAL', 'PAYMENT', 'KEMBALI', 'KEMBALIAN', 'TUNAI', 'DEBIT', 'KREDIT', 'CHANGE',
  'DISKON', 'DISCOUNT', 'POTONGAN', 'VOUCHER', 'CASHBACK', 'PEMBAYARAN', 'BELANJA',
];

function fixKeywords(upperLine) {
  return upperLine.replace(/[A-Z0-9]{5,}/g, (word) => {
    if (FUZZY_KEYWORDS.includes(word) || isDictionaryWord(word) || !/[A-Z]{3}/.test(word)) return word;
    const fixed = word.replace(/0/g, 'O').replace(/1/g, 'I');
    const match = FUZZY_KEYWORDS.find((kw) => levenshtein(fixed, kw, 1) <= 1);
    return match || word;
  });
}

// --- Normalisasi & angka -------------------------------------------------------

// Perbaiki huruf yang sering salah dibaca OCR di dalam token angka ("3.1OO" -> "3.100").
function fixNumericToken(token) {
  if (!/^[(\-]?\d/.test(token)) return token;
  const fixed = token.replace(/[Oo]/g, '0').replace(/[Il|]/g, '1');
  return /^[(\-]?\d[\d.,]*[)\-]?$/.test(fixed) ? fixed : token;
}

function normalizeLine(raw) {
  // Spasi asli dipertahankan dulu: kolom harga dipisah banyak spasi ("300       300").
  let line = raw.replace(/\t/g, '    ').trim();
  line = line.split(/(\s+)/).map((part) => (/\s/.test(part) ? part : fixNumericToken(part))).join('');
  line = line.replace(/\bRp\.?\s*(?=[\d(-])/gi, '');
  // qty "1x" sering terbaca "ix" / "Ix" / "lx"
  line = line.replace(/(^|\s)[iIl|]\s?[xX](?=\s*\d)/g, '$11x');
  // "3 . 100" / "3, 100" / "3 ,100" -> "3.100"
  line = line.replace(/(\d)\s*([.,])\s*(\d{3})(?!\d)/g, '$1$2$3');
  // "16 000" -> "16.000" (hanya satu spasi; dua kolom "300   300" tidak digabung)
  line = line.replace(/(?<![\d.,])(\d{1,3}) (\d{3})(?![\d.,A-Za-z])/g, '$1.$2');
  line = removeColumnJunk(line);
  return line.replace(/\s+/g, ' ').trim();
}

// Struk dicetak berkolom; OCR sering membaca noda/lipatan di kolom kosong sebagai huruf
// pendek ("p        1 SARIWANGI", "KRESEK POLOS        Sea", "Belanja      Kn Sa... 2.000").
// Kolom = potongan teks yang dipisah >= 5 spasi.
function removeColumnJunk(line) {
  const segments = line.split(/\s{5,}/);
  if (segments.length < 2) return line;
  const isMarker = (seg) => /^[xX×@*]$/.test(seg) || RE.qtyLine.test(seg);
  const kept = segments.map((seg, i) => {
    const hasDigit = /\d/.test(seg);
    // Kolom pertama 1-2 karakter tanpa angka di depan kolom lain: noda di margin kiri.
    if (i === 0 && !hasDigit && seg.length <= 2) return '';
    if (i === 0 || isMarker(seg)) return seg;
    // Kolom tanpa angka dengan <= 4 huruf: sampah.
    if (!hasDigit) return letterCount(seg) <= 4 ? '' : seg;
    // Kolom berisi angka yang diawali teks pendek ("Kn Sa... 2.000"): buang teksnya.
    const prefix = seg.match(/^([^\d(-]*)(?=[(-]?\d)/);
    return prefix && letterCount(prefix[1]) <= 4 ? seg.slice(prefix[1].length) : seg;
  });
  return kept.filter(Boolean).join('     ');
}

// Nominal: "3,100", "25.700", "25.700,00", "6200". Angka polos dibatasi 4-6 digit
// agar barcode / nomor transaksi tidak terbaca sebagai harga.
const AMOUNT_RE = /(?<![\dA-Za-z.,])(\d{1,3}(?:[.,]\d{3})+(?:[.,]\d{2})?|\d{4,6}(?:[.,]\d{2})?)(?![\dA-Za-z]|[.,]\d)/g;

function parseAmount(raw) {
  const withoutCents = /[.,]\d{3}/.test(raw) || /^\d{4,6}[.,]\d{2}$/.test(raw)
    ? raw.replace(/[.,]\d{2}$/, '')
    : raw;
  return parseInt(withoutCents.replace(/[.,]/g, ''), 10);
}

// allowPlain = false: abaikan angka tanpa pemisah ribuan (kode pos, tahun) pada struk
// yang harganya selalu ditulis dengan pemisah ("25,500").
function findAmounts(line, allowPlain = true) {
  const amounts = [];
  for (const match of line.matchAll(AMOUNT_RE)) {
    const value = parseAmount(match[1]);
    if (!value) continue;
    const plain = !/[.,]\d{3}/.test(match[1]);
    if (plain && !allowPlain) continue;
    const start = match.index;
    const end = start + match[0].length;
    const negative = /[-(]\s?$/.test(line.slice(Math.max(0, start - 2), start)) || /^[-)]/.test(line.slice(end));
    amounts.push({ value, start, end, negative, plain });
  }
  return amounts;
}

function findSmallAmounts(line) {
  return [...line.matchAll(/(?<![\d.,A-Za-z])([1-9]\d{2})(?![\d.,A-Za-z])/g)].map((m) => ({
    value: parseInt(m[1], 10), start: m.index, end: m.index + m[0].length, negative: false, plain: true,
  }));
}

const letterCount = (s) => (s.match(/[A-Za-z]/g) || []).length;

function cleanName(text) {
  return text
    .replace(/^\s*\d{5,}\s*/, '') // kode PLU / barcode di depan
    .replace(/[|\\_"'„“”`~*#=<>!?]+/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^[\s\-.:,;/]+|[\s\-.:,;/@]+$/g, '')
    .trim();
}

const SIZE_UNIT_RE = /^(?:ml|l|lt|ltr|liter|g|gr|gram|kg|mg|pcs|pc|s|sachet|sct|btl|pack|pak|lbr|cm|mm|oz)$/i;

// Buang sisa OCR di ujung nama: angka harga tanpa pemisah ("1 15000"), tanda baca, digit
// tunggal, atau huruf tunggal setelah ukuran ("35 g L"). Ukuran ("35 g") & huruf varian ("DRY M") tetap.
function trimNameTail(name) {
  const tokens = name.split(' ').filter(Boolean);
  // Setelah token ukuran ("200ML", "200GR", "35 g"), sisa token pendek (<= 3 huruf) adalah sampah OCR.
  const sizeIndex = tokens.findLastIndex((t, i) => /^\d+(?:[.,]\d+)?[A-Za-z]{1,3}$/.test(t)
    || (SIZE_UNIT_RE.test(t) && /^\d/.test(tokens[i - 1] || '')));
  if (sizeIndex > 0 && sizeIndex < tokens.length - 1
      && tokens.slice(sizeIndex + 1).every((t) => t.replace(/[^A-Za-z0-9]/g, '').length <= 3)) {
    tokens.length = sizeIndex + 1;
  }
  while (tokens.length > 1) {
    const last = tokens[tokens.length - 1];
    const prev = tokens[tokens.length - 2];
    const junk = /^\d{4,}$/.test(last)
      || /^[^A-Za-z0-9]+$/.test(last)
      || /^\d$/.test(last)
      || (/^[A-Za-z]$/.test(last) && SIZE_UNIT_RE.test(prev) && /^\d/.test(tokens[tokens.length - 3] || ''));
    if (!junk) break;
    tokens.pop();
  }
  return tokens.join(' ');
}

function toTitleCase(text) {
  if (text !== text.toUpperCase()) return text;
  return text.toLowerCase().replace(/\b[a-z]/g, (c) => c.toUpperCase());
}

// --- Nama toko ---------------------------------------------------------------

function detectMerchant(lines) {
  const known = findKnownMerchant(lines);
  if (known) return { name: known.name, category: known.category || null, sourceLine: known.line };

  const head = lines.slice(0, 10);
  const isCandidate = (line) => {
    const upper = line.toUpperCase();
    const letters = letterCount(line);
    return letters >= 4
      && /[A-Za-z]{3,}/.test(line) // minimal satu kata utuh, bukan sampah OCR ("AN aa")
      && letters / line.replace(/\s/g, '').length >= 0.6
      && !RE.date.test(line)
      && !findAmounts(line).length
      && !RE.total.test(upper)
      && !RE.payment.test(upper);
  };

  // Utamakan baris yang bukan alamat/PT/telepon, lalu terima baris "PT/CV ..." sebagai cadangan.
  const plain = head.find((l) => isCandidate(l) && !RE.boilerplate.test(l.toUpperCase()));
  const company = head.find((l) => isCandidate(l) && /^(PT|CV)\b/i.test(l));
  const chosen = plain || company;
  return { name: chosen ? toTitleCase(cleanName(chosen)) : DEFAULT_MERCHANT, category: null, sourceLine: chosen || null };
}

// --- Item ----------------------------------------------------------------------

const UNIT_RE = '(?:PCS|PC|PCE|BH|BKS|PAK|PACK|UNIT|BTL|LBR|SCT|RTG)';

function parseItemLine(line, amounts) {
  const priceToken = amounts[amounts.length - 1];
  if (priceToken.negative) return null;

  let price = priceToken.value;
  if (price < MIN_PRICE || price > MAX_PRICE) return null;

  let namePart = line.slice(0, amounts[0].start);
  let qty = 1;
  let unitPrice = price;
  let explicitMultiply = false;

  // "2 x 3.100 6.200" / "2 @ 3.100"
  const multiply = line.match(new RegExp(`(?:^|\\s)(\\d{1,3})\\s*${UNIT_RE}?\\s*[xX@*]\\s*(?=\\d)`, 'i'));
  if (multiply && multiply.index <= amounts[0].start) {
    qty = parseInt(multiply[1], 10);
    namePart = line.slice(0, multiply.index);
    explicitMultiply = true;
  } else {
    // "INDOMIE GORENG 2 3,100 6,200" (qty sebelum kolom harga)
    const trailingQty = namePart.match(new RegExp(`\\s(\\d{1,3})\\s*${UNIT_RE}?\\s*$`, 'i'));
    const leadingQty = namePart.match(/^(\d{1,2})\s*[xX]?\s+(?=[A-Za-z])/);
    if (trailingQty && amounts.length >= 2) {
      qty = parseInt(trailingQty[1], 10);
      namePart = namePart.slice(0, trailingQty.index);
    } else if (leadingQty) {
      // "2 NASI GORENG 50.000" (format restoran)
      qty = parseInt(leadingQty[1], 10);
      namePart = namePart.slice(leadingQty[0].length);
    }
  }
  qty = Math.max(qty, 1);

  // Harga alternatif bila qty x harga satuan tidak cocok dengan harga baris
  // (salah satunya salah baca OCR, mis. 9.000 -> 8.000). Dipilih nanti memakai total struk.
  let altPrice = null;
  let verified = false; // kolom harga satuan & total saling cocok
  if (amounts.length >= 2) {
    const candidateUnit = amounts[amounts.length - 2].value;
    if (Math.abs(candidateUnit * qty - price) <= qty) {
      unitPrice = candidateUnit;
      verified = true;
    } else {
      unitPrice = Math.round(price / qty);
      if (candidateUnit * qty <= MAX_PRICE) altPrice = { price: candidateUnit * qty, unitPrice: candidateUnit };
    }
  } else if (explicitMultiply && qty > 1) {
    // Hanya harga satuan yang tercetak: "2 x 3.100"
    unitPrice = price;
    price = unitPrice * qty;
  } else {
    unitPrice = Math.round(price / qty);
  }

  return { name: cleanName(namePart), qty, unitPrice, price, altPrice, verified };
}

// --- Koreksi angka ---------------------------------------------------------------

// Digit yang sering tertukar oleh OCR pada font struk.
const DIGIT_CONFUSIONS = {
  0: '869', 1: '74', 3: '8', 4: '1', 5: '6', 6: '58', 7: '1', 8: '0369', 9: '80',
};

// Kemungkinan nilai asli bila satu digit salah baca, terselip, atau tertukar.
// Hasil: [{ value, leading }] — leading = digit pertama yang berubah. Pada struk-struk nyata
// salah baca paling sering terjadi di digit pertama harga (7.200 -> 1.200, 7.500 -> 71.500).
function digitVariants(value) {
  const s = String(value);
  const variants = new Map();
  const add = (v, pos) => {
    if (!v.startsWith('0')) variants.set(v, variants.get(v) || pos === 0);
  };
  for (let i = 0; i < s.length; i++) {
    add(s.slice(0, i) + s.slice(i + 1), i); // digit terselip
    for (const d of DIGIT_CONFUSIONS[s[i]] || '') add(s.slice(0, i) + d + s.slice(i + 1), i);
  }
  return [...variants.entries()]
    .map(([v, leading]) => ({ value: Number(v), leading }))
    .filter((v) => v.value >= MIN_PRICE && v.value % 100 === 0 && v.value !== value)
    // 1.200 -> 200 hampir selalu keliru: harga >= 1.000 tidak dikoreksi menjadi < 1.000.
    .filter((v) => value < 1000 || v.value >= 1000);
}

// Semua pasangan koreksi satu digit pada dua item berbeda yang bersama-sama menutup selisih.
function findPairFixes(items, gap) {
  const options = items.map((item) => {
    const gross = item.price + item.discount;
    return digitVariants(gross).map(({ value, leading }) => ({ item, gross: value, leading, delta: value - gross }));
  });
  const pairs = [];
  for (let i = 0; i < options.length; i++) {
    for (let j = i + 1; j < options.length; j++) {
      for (const a of options[i]) {
        for (const b of options[j]) {
          if (a.delta + b.delta === gap) pairs.push([a, b]);
        }
      }
    }
  }
  return pairs;
}

// Pilih total struk dari beberapa nominal ringkasan ({ value, rank }: TOTAL=2, tanpa label=1,
// SUBTOTAL=0) yang sebagian mungkin salah baca. Urutan: sama dengan jumlah item > paling sering
// muncul > rank tertinggi (TOTAL akhir, bukan subtotal) > paling dekat ke jumlah item.
function pickReceiptTotal(candidates, computedTotal) {
  if (!candidates.length) return null;
  if (candidates.some((c) => c.value === computedTotal)) return computedTotal;
  const stats = new Map();
  for (const { value, rank } of candidates) {
    const stat = stats.get(value) || { value, count: 0, rank: 0 };
    stat.count++;
    stat.rank = Math.max(stat.rank, rank);
    stats.set(value, stat);
  }
  return [...stats.values()].sort((a, b) => b.count - a.count || b.rank - a.rank
    || Math.abs(a.value - computedTotal) - Math.abs(b.value - computedTotal))[0].value;
}

// --- Parser utama --------------------------------------------------------------

// Kunci pencocokan item antar hasil OCR yang berbeda: dua kata pertama nama, huruf saja.
function itemKey(name) {
  return name.toLowerCase().replace(/[^a-z ]+/g, '').split(' ').filter(Boolean).slice(0, 2).join(' ');
}

// options.priceReadings: Map itemKey -> Map(harga kotor -> jumlah percobaan OCR yang membacanya),
// dipakai untuk memilih koreksi digit saat ada beberapa kemungkinan (lihat scan.js).
function parseReceipt(rawText, options = {}) {
  const lines = String(rawText || '')
    .split(/\r?\n/)
    .map(normalizeLine)
    .filter((l) => l.length > 0);

  const merchant = detectMerchant(lines);

  // Bila harga di struk ini ditulis dengan pemisah ribuan, angka polos (kode pos 65149,
  // tahun 2026) bukan harga.
  const allAmounts = lines.flatMap((l) => findAmounts(l));
  const separated = allAmounts.filter((a) => !a.plain).length;
  const allowPlain = !(separated >= 2 && separated >= allAmounts.length - separated);
  // Item yang tidak dikenali memakai kategori bawaan toko (mis. toko roti -> Makanan & Cemilan).
  const categorize = (name) => {
    const category = detectCategory(name);
    return category === DEFAULT_CATEGORY && merchant.category ? merchant.category : category;
  };
  const items = [];
  const discounts = [];
  const totals = []; // { value, rank } -- lihat pickReceiptTotal()
  const warnings = [];
  let reportedDiscount = 0;
  let stage = 'items'; // items -> summary (setelah baris TOTAL) -> payment (setelah TUNAI/DEBIT)
  let pendingLines = []; // baris nama item yang harganya ada di baris berikutnya (maks. 2)
  let continuation = null; // item yang namanya boleh disambung baris berikutnya
  let lastItem = null;
  const resetNameState = () => {
    pendingLines = [];
    continuation = null;
  };
  const altPrices = new Map(); // item -> { price, unitPrice } kandidat koreksi harga
  const suggestions = []; // { item_id, price } saran koreksi harga yang tidak bisa dipastikan
  let pairWarning = false;
  const verifiedItems = new Set();
  const unlabeledTotals = [];
  const summaryAmounts = []; // semua nominal di bagian total/pembayaran, untuk validasi
  const paymentAmounts = [];

  const applyItemDiscount = (item, amount) => {
    item.discount += amount;
    item.price = Math.max(0, item.price - amount);
  };

  for (const line of lines) {
    const upper = fixKeywords(line.toUpperCase());
    let amounts = findAmounts(line, allowPlain || RE.total.test(upper));
    // Harga < 1.000 ("1 PCS X 300 300", mis. kantong plastik) hanya dikenali di baris qty
    // tepat di bawah nama produk, agar nomor/kode 3 digit lain tidak terbaca sebagai harga.
    if (!amounts.length && pendingLines.length && RE.qtyLine.test(line)) amounts = findSmallAmounts(line);
    const lastAmount = amounts[amounts.length - 1];

    // 1. Diskon / potongan / voucher
    const isDiscount = RE.discount.test(upper) || (RE.weakDiscount.test(upper) && lastAmount && lastAmount.negative);
    if (isDiscount) {
      resetNameState();
      if (!lastAmount) continue;
      const amount = lastAmount.value;
      if (RE.discountSummary.test(upper) || stage === 'payment') {
        reportedDiscount = Math.max(reportedDiscount, amount);
        continue;
      }
      const isVoucher = RE.voucher.test(upper);
      if (!isVoucher && stage === 'items' && lastItem && amount <= lastItem.price) {
        applyItemDiscount(lastItem, amount);
      } else {
        const label = cleanName(line.slice(0, amounts[0].start)) || 'Diskon';
        discounts.push({ id: discounts.length + 1, name: toTitleCase(label), amount });
      }
      continue;
    }

    // 2. Biaya tambahan (ongkir, layanan, PB1) -> dicatat sebagai item bila > 0
    if (RE.charge.test(upper)) {
      resetNameState();
      if (lastAmount && !lastAmount.negative) {
        const label = cleanName(line.slice(0, amounts[0].start)) || 'Biaya Tambahan';
        items.push({
          id: items.length + 1, name: label, qty: 1, unit_price: lastAmount.value, price: lastAmount.value,
          discount: 0, category: DEFAULT_CATEGORY,
        });
      }
      continue;
    }

    // 3. Baris total ("TOTAL ITEM", "TOTAL PPN" dsb. dilewati)
    if (RE.total.test(upper)) {
      resetNameState();
      if (lastAmount && !lastAmount.negative && !RE.totalExclude.test(upper)) {
        totals.push({ value: lastAmount.value, rank: RE.subtotal.test(upper) ? 0 : 2 });
        summaryAmounts.push(lastAmount.value);
        if (stage === 'items') stage = 'summary';
      }
      continue;
    }

    // 4. Pembayaran: setelah ini tidak ada item lagi
    if (RE.payment.test(upper)) {
      resetNameState();
      if (lastAmount && !/KEMBALI|CHANGE/.test(upper)) {
        summaryAmounts.push(lastAmount.value);
        paymentAmounts.push(lastAmount.value);
      }
      if (lastAmount && items.length) stage = 'payment';
      continue;
    }

    if (stage !== 'items') continue;

    if (RE.boilerplate.test(upper) || RE.date.test(line)) {
      resetNameState();
      continue;
    }

    const nameOnly = amounts.length ? line.slice(0, amounts[0].start) : line;

    // 5. Nominal minus tanpa label tepat di bawah item -> potongan item tsb.
    if (lastAmount && lastAmount.negative && letterCount(nameOnly) < 3) {
      if (lastItem && lastAmount.value <= lastItem.price) applyItemDiscount(lastItem, lastAmount.value);
      resetNameState();
      continue;
    }

    // 6. Item
    // Nominal tanpa label setelah daftar item (label "Subtotal/Total" tidak terbaca OCR):
    // anggap kolom ringkasan, bukan item.
    if (amounts.length && !pendingLines.length && items.length && letterCount(nameOnly) < 2 && !lastAmount.negative) {
      unlabeledTotals.push(lastAmount.value);
      summaryAmounts.push(lastAmount.value);
      stage = 'summary';
      continue;
    }

    if (amounts.length) {
      const parsed = parseItemLine(line, amounts);
      // Baris qty format 2 baris: "1 PCS X 8,500 8,500" (sering terbaca kotor: "In es X 7,700",
      // "il PES Kisa 300 300"). Bila ada nama di baris sebelumnya, teks di baris ini bukan nama.
      const isQtyLine = pendingLines.length > 0 && RE.qtyLine.test(nameOnly);
      const ownName = parsed && !isQtyLine && letterCount(parsed.name) >= 3 ? parsed.name : null;
      // Baris nama sebelumnya ikut jadi nama item ("Zinc Sampo Anti Ketombe" + "Refreshing ... 25,500"),
      // kecuali baris itu adalah nama toko di header.
      const prefix = pendingLines.filter((l) => l !== merchant.sourceLine);
      let name = [...prefix, ownName].filter(Boolean).join(' ') || null;
      resetNameState();
      if (parsed && name) {
        name = correctItemName(trimNameTail(name));
        lastItem = {
          id: items.length + 1,
          name,
          qty: parsed.qty,
          unit_price: parsed.unitPrice,
          price: parsed.price,
          discount: 0,
          category: categorize(name),
        };
        items.push(lastItem);
        if (parsed.altPrice) altPrices.set(lastItem, parsed.altPrice);
        if (parsed.verified) verifiedItems.add(lastItem);
        // Nama boleh berlanjut ke baris berikutnya hanya bila harga ada di baris bernama
        // (format 2 baris "nama" lalu "2 x 3.100" justru memulai item baru setelahnya).
        if (ownName) continuation = lastItem;
      }
      continue;
    }

    // 7. Baris teks saja
    if (letterCount(line) < 3) {
      resetNameState();
      continue;
    }
    const text = cleanName(line);
    // Lanjutan nama item sebelumnya bila diakhiri ukuran ("Botol 170 ml") dan nama item
    // tersebut belum berukuran; selain itu dianggap awal nama item berikutnya.
    if (continuation && RE.sizeEnd.test(text) && !RE.sizeEnd.test(continuation.name)) {
      continuation.name = correctItemName(trimNameTail(`${continuation.name} ${text}`));
      continuation.category = categorize(continuation.name);
      continuation = null;
      continue;
    }
    continuation = null;
    pendingLines = [...pendingLines, text].slice(-2);
  }

  // Baris total/pembayaran yang labelnya tidak terbaca bisa ikut menjadi "item". Cirinya:
  // harganya tepat sama dengan jumlah semua item sebelumnya -> pindahkan ke kandidat total.
  for (let k = 2; k < items.length; k++) {
    const sumBefore = items.slice(0, k).reduce((sum, item) => sum + item.price, 0);
    if (items[k].price === sumBefore && !items[k].discount) {
      const totalLike = items.slice(k).filter((item) => item.price === sumBefore);
      totalLike.forEach(() => unlabeledTotals.push(sumBefore));
      items.splice(0, items.length, ...items.filter((item) => !totalLike.includes(item)));
      items.forEach((item, i) => { item.id = i + 1; });
      break;
    }
  }

  const subtotal = items.reduce((sum, item) => sum + item.price, 0);
  let discountTotal = discounts.reduce((sum, d) => sum + d.amount, 0);

  // Total struk: dari baris TOTAL/SUBTOTAL atau nominal tanpa label; bila tidak ada,
  // dari nominal pembayaran (mis. "Payment 43,500"). Lihat pickReceiptTotal().
  const preliminaryTotal = subtotal - discountTotal;
  let receiptTotal = pickReceiptTotal([...totals, ...unlabeledTotals.map((value) => ({ value, rank: 1 }))], preliminaryTotal)
    ?? pickReceiptTotal(paymentAmounts.map((value) => ({ value, rank: 1 })), preliminaryTotal);

  // Struk hanya mencetak "TOTAL DISKON" tanpa rincian: pakai bila cocok dengan total struk.
  const itemDiscountTotal = items.reduce((sum, item) => sum + item.discount, 0);
  if (reportedDiscount && !discountTotal && !itemDiscountTotal && receiptTotal
      && Math.abs(subtotal - reportedDiscount - receiptTotal) <= 1) {
    discounts.push({ id: 1, name: 'Diskon', amount: reportedDiscount });
    discountTotal = reportedDiscount;
  }

  if (!items.length && receiptTotal) {
    items.push({
      id: 1, name: 'Belanjaan Umum', qty: 1, unit_price: receiptTotal, price: receiptTotal,
      discount: 0, category: DEFAULT_CATEGORY,
    });
    warnings.push('Item belanja tidak terbaca, hanya total struk yang terdeteksi.');
  }

  // Salah baca angka (mis. "9.000" -> "8.000"): bila memakai qty x harga satuan
  // membuat jumlah item tepat sama dengan total struk, pakai harga tersebut.
  // Struk sering mencetak total berkali-kali (subtotal, total, bayar, debit) dan salah satunya
  // bisa salah baca. Bila jumlah item cocok dengan salah satu nominal itu, anggap itulah totalnya.
  const computedTotal = items.reduce((sum, item) => sum + item.price, 0) - discountTotal;
  if (receiptTotal !== computedTotal && summaryAmounts.includes(computedTotal)) receiptTotal = computedTotal;

  const gapToReceipt = () => receiptTotal - (items.reduce((sum, item) => sum + item.price, 0) - discountTotal);
  if (receiptTotal && gapToReceipt() !== 0) {
    const gap = gapToReceipt();
    for (const [item, alt] of altPrices) {
      const newPrice = Math.max(0, alt.price - item.discount);
      if (Math.abs(newPrice - item.price - gap) <= 1) {
        item.ocr_price = item.price;
        item.price = newPrice;
        item.unit_price = alt.unitPrice;
        break;
      }
    }
  }

  // Masih selisih: coba perbaiki satu digit salah baca pada satu item (mis. "7,500" -> "71,500").
  // Dipakai bila tepat satu kemungkinan yang membuat total cocok, atau bila ada beberapa
  // kemungkinan tetapi satu item jelas paling meragukan (harganya paling jarang dibaca sama
  // oleh percobaan OCR lain & kolom harganya tidak saling cocok).
  // Tidak dipakai bila total struk sama dengan subtotal sebelum diskon (selisihnya karena diskon).
  const grossBeforeFix = items.reduce((sum, item) => sum + item.price + item.discount, 0);
  if (receiptTotal && gapToReceipt() !== 0 && grossBeforeFix !== receiptTotal) {
    const gap = gapToReceipt();
    const fixes = [];
    for (const item of items) {
      const gross = item.price + item.discount;
      for (const { value, leading } of digitVariants(gross)) {
        if (value - gross === gap) fixes.push({ item, gross: value, leading });
      }
    }
    const confidence = (item) => {
      const readings = options.priceReadings && options.priceReadings.get(itemKey(item.name));
      return (readings ? readings.get(item.price + item.discount) || 0 : 0) + (verifiedItems.has(item) ? 0.5 : 0);
    };
    // Urutan: paling jarang terkonfirmasi percobaan OCR lain, lalu perubahan di digit pertama.
    const rank = (f) => [confidence(f.item), f.leading ? 0 : 1];
    const compare = (a, b) => rank(a)[0] - rank(b)[0] || rank(a)[1] - rank(b)[1];
    fixes.sort(compare);
    const applyFix = (f) => {
      f.item.ocr_price = f.item.price;
      f.item.price = f.gross - f.item.discount;
      f.item.unit_price = Math.round(f.gross / f.item.qty);
    };
    const [best, second] = fixes;
    if (best && (!second || compare(best, second) < 0)) {
      applyFix(best);
    } else if (best) {
      // Tidak bisa dipastikan: serahkan ke pengguna sebagai saran per item.
      for (const f of fixes) suggestions.push({ item_id: f.item.id, price: f.gross - f.item.discount });
    } else if (items.length >= 3) {
      // Tidak ada satu koreksi yang cukup: dua item sekaligus salah baca satu digit
      // (mis. 7.200 -> 1.200 dan 13.000 -> 13.900). Syarat ketat agar hasil OCR yang kacau tidak
      // "dipaksa" cocok: minimal satu perubahan di digit pertama & satu pasangan jelas paling mungkin.
      const pairs = findPairFixes(items, gap)
        .filter((pair) => pair.some((f) => f.leading));
      const pairRank = (pair) => [
        confidence(pair[0].item) + confidence(pair[1].item),
        pair.filter((f) => !f.leading).length,
      ];
      const comparePairs = (p, q) => pairRank(p)[0] - pairRank(q)[0] || pairRank(p)[1] - pairRank(q)[1];
      pairs.sort(comparePairs);
      if (pairs.length && (pairs.length === 1 || comparePairs(pairs[0], pairs[1]) < 0)) {
        pairs[0].forEach(applyFix);
        // Dua koreksi bisa juga "menutupi" item yang tidak terbaca, jadi pengguna tetap diminta memeriksa.
        pairWarning = true;
      } else {
        for (const pair of pairs.slice(0, 3)) {
          for (const f of pair) suggestions.push({ item_id: f.item.id, price: f.gross - f.item.discount });
        }
      }
    }
  }

  const itemsSum = items.reduce((sum, item) => sum + item.price, 0);
  const totalAmount = Math.max(0, itemsSum - discountTotal);
  const grossSubtotal = items.reduce((sum, item) => sum + item.price + item.discount, 0);

  if (!items.length) {
    warnings.push('Struk tidak terbaca. Coba foto ulang dengan cahaya cukup dan struk lurus.');
  } else if (!receiptTotal) {
    warnings.push('Total di struk tidak terbaca. Periksa kembali daftar item.');
  } else if (pairWarning) {
    warnings.push('Dua harga dikoreksi otomatis (ditandai oranye). Pastikan sesuai struk dan tidak ada item yang terlewat.');
  } else if (receiptTotal && Math.abs(totalAmount - receiptTotal) > 1) {
    warnings.push('Total hasil hitung berbeda dengan total di struk. Periksa kembali item dan diskon.');
  }

  return {
    merchant_name: merchant.name,
    total_amount: totalAmount,
    receipt_total: receiptTotal,
    subtotal: grossSubtotal,
    discount_total: grossSubtotal - totalAmount,
    items,
    discounts,
    suggestions,
    warnings,
  };
}

module.exports = { parseReceipt, itemKey, normalizeLine, findAmounts, findPairFixes };
