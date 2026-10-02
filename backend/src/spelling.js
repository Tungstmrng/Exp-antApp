const { KEYWORD_WORDS } = require('./categories');

// Kata umum pada nama produk. Ikut masuk kamus supaya kata yang sudah benar
// tidak "dikoreksi" ke merek yang mirip (mis. "sari" -> "sapi").
const COMMON_WORDS = [
  'tawar', 'goreng', 'rebus', 'pedas', 'manis', 'asin', 'gurih', 'original', 'rasa', 'madu', 'sari', 'murni',
  'coklat', 'cokelat', 'keju', 'susu', 'ayam', 'sapi', 'ikan', 'mini', 'jumbo', 'besar', 'kecil', 'sedang',
  'botol', 'kaleng', 'sachet', 'pack', 'pouch', 'refill', 'cair', 'bubuk', 'segar', 'putih', 'hitam', 'merah',
  'hijau', 'kuning', 'biru', 'strawberry', 'stroberi', 'vanilla', 'vanila', 'mangga', 'jeruk', 'lemon', 'leci',
  'melon', 'anggur', 'hazelnut', 'almond', 'kacang', 'extra', 'ekstra', 'super', 'special', 'spesial',
  'premium', 'classic', 'klasik', 'light', 'zero', 'plus', 'gold', 'fresh', 'cream', 'krim', 'wangi', 'harum',
  'lembut', 'anak', 'dewasa', 'liter', 'gram', 'isi', 'free', 'gratis', 'bonus', 'baru', 'aroma', 'fruit',
  'green', 'black', 'white', 'milk', 'choco', 'chocolate', 'cheese', 'blueberry', 'matcha', 'kopi', 'latte',
  'mocca', 'mocha', 'caramel', 'karamel', 'pandan', 'kelapa', 'durian', 'pisang', 'nanas', 'jambu', 'apel',
  'tropical', 'family', 'pocket', 'stick', 'cone', 'cup', 'jar', 'tube', 'spray', 'lotion', 'wash', 'body',
  'face', 'hair', 'baby', 'kids', 'cool', 'mint', 'fruity', 'sweet', 'soft', 'hard', 'crispy', 'crunchy',
  'ball', 'balls', 'ringan', 'makanan', 'minuman', 'celup', 'ketombe', 'anti', 'refreshing', 'crafty',
  'take', 'sticks', 'rolls', 'roll', 'chips', 'crackers', 'cracker', 'bites', 'cups', 'bars', 'tabs',
  'kotak', 'karton', 'renceng', 'bungkus', 'kantong', 'sedap', 'lezat', 'enak', 'spicy', 'salted', 'salty',
];

const DICTIONARY = new Set([...KEYWORD_WORDS, ...COMMON_WORDS].filter((w) => w.length >= 4));
const DICTIONARY_LIST = [...DICTIONARY];

function levenshtein(a, b, max) {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const curr = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      rowMin = Math.min(rowMin, curr[j]);
    }
    if (rowMin > max) return max + 1;
    prev = curr;
  }
  return prev[b.length];
}

// Batas jarak edit: kata pendek tidak dikoreksi, kata panjang boleh 2 huruf salah.
// (Kata pendek hanya lewat confusableVariant(), mis. "alce" -> "aice".)
function maxDistance(word) {
  if (word.length < 5) return 0;
  if (word.length <= 6) return 1;
  return 2;
}

// Kata kamus terdekat, atau null bila tidak ada / ambigu.
function nearestWord(word, max) {
  let best = null;
  let bestDist = max + 1;
  let ambiguous = false;
  for (const candidate of DICTIONARY_LIST) {
    const dist = levenshtein(word, candidate, max);
    if (dist < bestDist) {
      best = candidate;
      bestDist = dist;
      ambiguous = false;
    } else if (dist === bestDist && dist <= max) {
      ambiguous = true;
    }
  }
  if (!best || bestDist > max || ambiguous) return null;
  return best;
}

function matchCase(original, corrected) {
  if (original === original.toUpperCase()) return corrected.toUpperCase();
  if (original[0] === original[0].toUpperCase()) return corrected[0].toUpperCase() + corrected.slice(1);
  return corrected;
}

const isWord = (token) => /^[A-Za-z]+$/.test(token);

// Huruf yang terbaca angka di tengah kata: "a1ce" -> "aice", "c0kelat" -> "cokelat".
// Token yang diawali angka (ukuran "50g", "4F", "600ML") tidak disentuh.
const DIGIT_AS_LETTER = { 0: ['o'], 1: ['i', 'l'], 5: ['s'] };

function fixDigitsInWord(token) {
  if (!/^[A-Za-z][A-Za-z015]*$/.test(token) || !/[015]/.test(token)) return null;
  let variants = [''];
  for (const ch of token.toLowerCase()) {
    const options = DIGIT_AS_LETTER[ch] || [ch];
    variants = variants.flatMap((v) => options.map((o) => v + o));
  }
  const exact = variants.find((v) => DICTIONARY.has(v));
  if (exact) return exact;
  const near = variants.map((v) => nearestWord(v, maxDistance(v))).filter(Boolean);
  return new Set(near).size === 1 ? near[0] : null;
}

// Kata pendek yang tidak ada di kamus: coba tukar huruf yang mirip bentuknya bagi OCR.
// Hanya diterima bila hasilnya tepat ada di kamus ("alce" -> "aice", tetapi "lada" tetap).
const CONFUSABLE = [['l', 'i'], ['i', 'l'], ['c', 'e'], ['e', 'c'], ['rn', 'm'], ['m', 'rn']];

function confusableVariant(lower) {
  const found = new Set();
  for (const [from, to] of CONFUSABLE) {
    for (let i = lower.indexOf(from); i !== -1; i = lower.indexOf(from, i + 1)) {
      const variant = lower.slice(0, i) + to + lower.slice(i + from.length);
      if (DICTIONARY.has(variant)) found.add(variant);
    }
  }
  return found.size === 1 ? [...found][0] : null;
}

function correctToken(token) {
  const digitFixed = fixDigitsInWord(token);
  if (digitFixed) return matchCase(token.replace(/[015]/g, 'x'), digitFixed);
  if (!isWord(token)) return token;
  const lower = token.toLowerCase();
  if (DICTIONARY.has(lower)) return token;
  const corrected = nearestWord(lower, maxDistance(lower)) || (lower.length >= 4 ? confusableVariant(lower) : null);
  return corrected ? matchCase(token, corrected) : token;
}

// Perbaiki salah baca OCR pada nama item berdasarkan kamus merek/kata produk.
// "Le Hinerale" -> "Le Minerale", "Kang ler" -> "Kanzler", "Ice crean" -> "Ice cream".
function correctItemName(name) {
  const tokens = name.split(' ').filter(Boolean);
  const merged = [];

  // Kata yang terpotong spasi oleh OCR: gabungkan bila hasilnya (hampir) ada di kamus.
  for (let i = 0; i < tokens.length; i++) {
    const a = tokens[i];
    const b = tokens[i + 1];
    if (b && isWord(a) && isWord(b) && !(DICTIONARY.has(a.toLowerCase()) && DICTIONARY.has(b.toLowerCase()))) {
      const joined = (a + b).toLowerCase();
      const target = DICTIONARY.has(joined) ? joined : nearestWord(joined, joined.length >= 7 ? 1 : 0);
      if (target) {
        merged.push(matchCase(a, target));
        i++;
        continue;
      }
    }
    merged.push(a);
  }

  const corrected = merged.map(correctToken).join(' ');
  return corrected.charAt(0).toUpperCase() + corrected.slice(1);
}

module.exports = { correctItemName, levenshtein, isDictionaryWord: (w) => DICTIONARY.has(w.toLowerCase()) };
