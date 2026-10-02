// Daftar jaringan toko yang dikenali. Key >= 6 huruf dicocokkan tanpa spasi dan
// toleran 1 huruf salah baca OCR; key pendek harus cocok sebagai kata utuh.
// `category` (opsional) = kategori bawaan untuk item yang tidak dikenali di toko tsb.
const KNOWN_MERCHANTS = [
  { name: 'Indomaret', keys: ['INDOMARET', 'INDOMARCO'] },
  { name: 'Alfamart', keys: ['ALFAMART', 'SUMBERALFARIA'] },
  { name: 'Alfamidi', keys: ['ALFAMIDI', 'MIDIUTAMA'] },
  { name: 'Alfa Express', keys: ['ALFAEXPRESS'] },
  { name: 'Allomart', keys: ['ALLOMART', 'ALLOSUMBERBERKAT'] },
  { name: 'Lokal Mart', keys: ['LOKALMART'] },
  // Logo "LOKAL MART" sering hanya terbaca "LOKAL"; hanya dicari di header agar item "Beras Lokal" aman.
  { name: 'Lokal Mart', keys: ['LOKAL'], headOnly: true },
  { name: 'Indogrosir', keys: ['INDOGROSIR'] },
  { name: 'Lulu Hypermarket', keys: ['LULUHYPERMARKET'] },
  { name: 'Superindo', keys: ['SUPERINDO', 'LIONSUPERINDO'] },
  { name: 'Hypermart', keys: ['HYPERMART', 'MATAHARIPUTRA'] },
  { name: 'Hero Supermarket', keys: ['HEROSUPERMARKET'] },
  { name: 'Giant', keys: ['GIANTEXTRA', 'GIANTEKSPRES'] },
  { name: 'Transmart', keys: ['TRANSMART', 'CARREFOUR', 'TRANSRETAIL'] },
  { name: 'Lotte Mart', keys: ['LOTTEMART', 'LOTTEGROSIR'] },
  { name: 'Yogya', keys: ['TOSERBAYOGYA', 'YOGYAGROUP', 'GRIYAYOGYA'] },
  { name: 'Ramayana', keys: ['RAMAYANA'] },
  { name: 'Circle K', keys: ['CIRCLEK'] },
  { name: 'Lawson', keys: ['LAWSON'] },
  { name: 'FamilyMart', keys: ['FAMILYMART'] },
  { name: 'Farmers Market', keys: ['FARMERSMARKET'] },
  { name: 'Ranch Market', keys: ['RANCHMARKET'] },
  { name: 'Grand Lucky', keys: ['GRANDLUCKY'] },
  { name: 'Foodmart', keys: ['FOODMART'] },
  { name: 'Borma', keys: ['BORMA'] },
  { name: 'Tip Top', keys: ['TIPTOP'] },
  { name: 'Guardian', keys: ['GUARDIAN'] },
  { name: 'Watsons', keys: ['WATSONS'] },
  { name: 'Century', keys: ['CENTURYHEALTH', 'APOTEKCENTURY'], category: 'Kesehatan' },
  { name: 'Kimia Farma', keys: ['KIMIAFARMA'], category: 'Kesehatan' },
  { name: 'Ace Hardware', keys: ['ACEHARDWARE', 'KAWANLAMA'] },
  { name: 'Informa', keys: ['INFORMA'] },
  { name: 'Mr. DIY', keys: ['MR DIY'] },
  { name: 'Miniso', keys: ['MINISO'] },
  { name: 'Gramedia', keys: ['GRAMEDIA'] },
  { name: 'IKEA', keys: ['IKEA'] },
  { name: 'KFC', keys: ['KFC', 'FASTFOODINDONESIA'], category: 'Makanan & Cemilan' },
  { name: "McDonald's", keys: ['MCDONALD', 'REKSOYASA'], category: 'Makanan & Cemilan' },
  { name: 'Starbucks', keys: ['STARBUCKS'], category: 'Minuman' },
  { name: 'Kopi Kenangan', keys: ['KOPIKENANGAN'], category: 'Minuman' },
  { name: 'Janji Jiwa', keys: ['JANJIJIWA'], category: 'Minuman' },
  { name: 'Chatime', keys: ['CHATIME'], category: 'Minuman' },
  { name: 'BreadTalk', keys: ['BREADTALK'], category: 'Makanan & Cemilan' },
  { name: 'Holland Bakery', keys: ['HOLLANDBAKERY'], category: 'Makanan & Cemilan' },
  { name: 'J.CO', keys: ['JCO DONUTS', 'JCODONUTS'], category: 'Makanan & Cemilan' },
  { name: 'Roti O', keys: ['ROTIO'], category: 'Makanan & Cemilan' },
  { name: 'Dunkin', keys: ['DUNKIN'], category: 'Makanan & Cemilan' },
  { name: 'Pizza Hut', keys: ['PIZZAHUT'], category: 'Makanan & Cemilan' },
  { name: 'Burger King', keys: ['BURGERKING'], category: 'Makanan & Cemilan' },
  { name: 'Richeese Factory', keys: ['RICHEESEFACTORY'], category: 'Makanan & Cemilan' },
  { name: 'Solaria', keys: ['SOLARIA'], category: 'Makanan & Cemilan' },
  { name: 'Hokben', keys: ['HOKBEN', 'HOKABEN'], category: 'Makanan & Cemilan' },
  { name: 'Mixue', keys: ['MIXUE'], category: 'Minuman' },
  { name: 'Point Coffee', keys: ['POINTCOFFEE'], category: 'Minuman' },
];

// Cocok bila `key` muncul di `text` dengan maksimal 1 karakter berbeda.
function fuzzyContains(text, key) {
  if (text.includes(key)) return true;
  for (let start = 0; start + key.length <= text.length; start++) {
    let diff = 0;
    for (let i = 0; i < key.length && diff <= 1; i++) {
      if (text[start + i] !== key[i]) diff++;
    }
    if (diff <= 1) return true;
  }
  return false;
}

function matchesKey(line, key) {
  const compactKey = key.replace(/ /g, '');
  if (compactKey.length >= 6) {
    return fuzzyContains(line.toUpperCase().replace(/[^A-Z]/g, ''), compactKey);
  }
  const words = ` ${line.toUpperCase().replace(/[^A-Z]+/g, ' ').trim()} `;
  return words.includes(` ${key} `);
}

// Cari di header (8 baris pertama) dulu, baru seluruh struk (mis. footer "PT INDOMARCO").
function findKnownMerchant(lines) {
  // Header = baris sebelum harga pertama (maks. 8 baris); key `headOnly` hanya dicari di sini.
  const firstPrice = lines.findIndex((l) => /\d[.,]\d{3}(?!\d)/.test(l) && !/\d[-/.]\d{1,2}[-/.]\d/.test(l));
  const headerEnd = Math.min(8, firstPrice === -1 ? lines.length : firstPrice);
  for (const [scope, isHeader] of [[lines.slice(0, headerEnd), true], [lines.slice(0, 8), false], [lines, false]]) {
    for (const line of scope) {
      const merchant = KNOWN_MERCHANTS.find((m) => (isHeader || !m.headOnly) && m.keys.some((key) => matchesKey(line, key)));
      if (merchant) return { ...merchant, line };
    }
  }
  // Logo yang terbaca terpecah 2 baris ("fo LOKAL" / "al MART"); potongan <= 2 huruf diabaikan.
  const head = lines.slice(0, 8);
  const withoutShortTokens = (line) => line.split(/\s+/).filter((t) => t.replace(/[^A-Za-z]/g, '').length > 2).join(' ');
  for (let i = 0; i + 1 < head.length; i++) {
    const joined = `${withoutShortTokens(head[i])} ${withoutShortTokens(head[i + 1])}`;
    const merchant = KNOWN_MERCHANTS.find((m) => m.keys.some((key) => key.replace(/ /g, '').length >= 6 && matchesKey(joined, key)));
    if (merchant) return { ...merchant, line: head[i] };
  }
  return null;
}

module.exports = { findKnownMerchant };
