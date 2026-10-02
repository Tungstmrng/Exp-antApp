// Kategori ditentukan dari kata kunci (huruf kecil) pada nama item.
// Kata kunci <= 3 huruf harus cocok satu kata utuh; yang lebih panjang cukup
// cocok di awal kata (mis. "sabun" cocok dengan "SABUNCUCI").
// Bila beberapa kata kunci cocok, yang terpanjang menang
// (mis. "obat nyamuk" -> Rumah Tangga, bukan "obat" -> Kesehatan).

const CATEGORIES = {
  'Kebutuhan Pokok': [
    'beras', 'minyak', 'minyak goreng', 'migor', 'bimoli', 'sania', 'filma', 'fortune', 'tropical', 'sunco',
    'rose brand', 'rosebrand', 'gula', 'gulaku', 'telur', 'telor', 'tepung', 'terigu', 'segitiga biru', 'maizena',
    'garam', 'susu', 'susu kental', 'kental manis', 'frisian', 'indomilk', 'dancow', 'bendera',
    'daging', 'ayam', 'sapi', 'ikan', 'udang', 'sayur', 'sayuran', 'kol', 'kubis', 'wortel', 'kentang',
    'bawang', 'cabe', 'cabai', 'tomat', 'tahu', 'tempe', 'kecap', 'bango', 'saos', 'saus', 'sambal',
    'masako', 'royco', 'sasa', 'ajinomoto', 'micin', 'penyedap', 'bumbu', 'santan', 'kara',
    'mentega', 'margarin', 'blue band', 'palmia',
  ],
  'Makanan & Cemilan': [
    'roti', 'sari roti', 'snack', 'biskuit', 'biscuit', 'wafer', 'chiki', 'chitato', 'lays', 'qtela', 'taro',
    'piattos', 'potabee', 'kusuka', 'oreo', 'roma', 'khong guan', 'malkist', 'tango', 'nabati', 'richeese',
    'beng beng', 'silverqueen', 'cadbury', 'delfi', 'coklat', 'cokelat', 'chocolatos', 'permen', 'mentos',
    'relaxa', 'yupi', 'kacang', 'garuda', 'dua kelinci', 'mie', 'mi', 'indomie', 'sedaap', 'supermi', 'sarimi',
    'pop mie', 'mie gelas', 'bihun', 'kwetiau', 'sosis', 'kanzler', 'champ', 'belfoods', 'nugget', 'kornet',
    'sarden', 'pronas', 'so good', 'roti o', 'sandwich', 'onigiri', 'hokkaido', 'mochi',
    'fiesta', 'bakso', 'es krim', 'ice cream', 'walls', 'aice', 'campina', 'inaco', 'puding', 'agar', 'jelly',
    'keju', 'kraft', 'cheese', 'selai', 'nutella', 'sereal', 'koko krunch', 'quaker', 'oat',
    'semangka', 'buah', 'apel', 'jeruk', 'pisang', 'mangga', 'anggur', 'melon', 'pepaya', 'salak',
    'bebek', 'nasi', 'ayam goreng', 'martabak', 'gorengan', 'kue', 'cake', 'donat', 'burger', 'pizza',
    'kentang goreng', 'french fries', 'bread', 'butter', 'croissant', 'pudding', 'muffin', 'brownies',
    'brownie', 'cookies', 'cookie', 'pastry', 'toast', 'bun', 'tart', 'pie', 'waffle', 'pancake', 'bolu',
    'lapis', 'bakpia', 'onde', 'risoles', 'pastel', 'lemper', 'chocolate', 'chocolat', 'choco', 'brulee',
    'bruille', 'creme brulee', 'tiramisu', 'cheesecake', 'red velvet', 'sourdough', 'bagel', 'baguette',
    'walens', 'nissin', 'soes', 'stik', 'stick', 'balado', 'ritz', 'festival', 'krupuk', 'kerupuk', 'keripik', 'kripik', 'makaroni',
    'danish', 'floss', 'abon', 'mentai', 'dimsum', 'siomay', 'gyoza', 'ramen', 'sushi', 'kebab', 'sate',
    'soto', 'bakmi', 'nasi goreng', 'mie goreng', 'chicken', 'fried', 'wings', 'paha', 'dada',
  ],
  'Minuman': [
    'aqua', 'air mineral', 'mineral', 'le minerale', 'cleo', 'club', 'ades', 'vit', 'teh', 'tea', 'teh botol',
    'sosro', 'frestea', 'fruit tea', 'ichi ocha', 'pucuk', 'nu green', 'kopi', 'coffee', 'kapal api',
    'good day', 'nescafe', 'torabika', 'indocafe', 'luwak', 'kopiko 78', 'latte', 'soda', 'coca cola', 'coke',
    'sprite', 'fanta', 'pepsi', 'big cola', 'pocari', 'mizone', 'hydro coco', 'isoplus', 'jus', 'juice',
    'jus jeruk', 'buavita', 'nutrisari', 'marimas', 'jasjus', 'yakult', 'ultra milk', 'ultramilk', 'susu uht',
    'milo', 'energen', 'bear brand', 'cimory', 'hilo', 'kratingdaeng', 'extra joss', 'kuku bima', 'marjan',
    'sirup', 'syrup', 'es teh', 'boba', 'milk tea', 'larutan', 'cap kaki tiga', 'yogurt',
    'smoothies', 'smoothie', 'sariwangi', 'teh celup', 'sosro', 'tong tji', 'uht', 'brookfarm', 'almond milk', 'oat milk', 'lychee', 'sagiko', 'okky', 'teh gelas', 'golda', 'nescafe can',
  ],
  'Perlengkapan Mandi & Cuci': [
    'sabun', 'soap', 'shampoo', 'shampo', 'sampo', 'conditioner', 'sunsilk', 'pantene', 'clear', 'dove',
    'lifebuoy', 'lux', 'giv', 'nuvo', 'dettol', 'biore', 'citra', 'nivea', 'vaseline', 'ponds', 'garnier',
    'wardah', 'rexona', 'deodorant', 'pasta gigi', 'odol', 'pepsodent', 'close up', 'formula', 'sensodyne',
    'ciptadent', 'colgate', 'sikat', 'sikat gigi', 'listerine', 'deterjen', 'detergen', 'rinso', 'attack',
    'so klin', 'soklin', 'daia', 'boom', 'surf', 'molto', 'downy', 'softener', 'pewangi', 'sunlight',
    'mama lemon', 'pembersih', 'wipol', 'super pell', 'superpell', 'porstex', 'harpic', 'bayclin', 'vixal',
    'cling', 'laurier', 'charm', 'softex', 'pembalut', 'rejoice', 'head shoulders', 'tresemme', 'makarizo',
    'gillette', 'cukur',
  ],
  'Kebutuhan Bayi': [
    'popok', 'diapers', 'pampers', 'mamypoko', 'mamy poko', 'sweety', 'merries', 'huggies', 'goon',
    'baby happy', 'zwitsal', 'cussons', 'my baby', 'johnson', 'bebelac', 'sgm', 'lactogen', 'chil kid',
    'chilkid', 'morinaga', 'susu formula', 'bubur bayi', 'promina', 'milna',
  ],
  'Kesehatan': [
    'obat', 'paracetamol', 'panadol', 'bodrex', 'paramex', 'promag', 'mylanta', 'tolak angin', 'antangin',
    'vitamin', 'enervon', 'redoxon', 'imboost', 'cdr', 'sangobion', 'masker', 'plester', 'hansaplast',
    'betadine', 'kayu putih', 'minyak kayu putih', 'freshcare', 'fresh care', 'balsem', 'geliga',
    'counterpain', 'salonpas', 'koyo', 'insto', 'rohto', 'oskadon', 'decolgen', 'neozep', 'komix', 'woods',
    'kiranti', 'termometer', 'sanitizer', 'hand sanitizer', 'antis',
  ],
  'Rumah Tangga': [
    'tisu', 'tissue', 'paseo', 'nice', 'tessa', 'baterai', 'batre', 'battery', 'alkaline', 'eveready',
    'lampu', 'korek', 'gas', 'elpiji', 'lpg', 'plastik', 'kantong', 'kresek', 'kantong belanja',
    'obat nyamuk', 'baygon', 'hit', 'vape', 'autan', 'soffell', 'stella', 'kamper', 'kapur barus', 'sapu',
    'pel', 'alat pel', 'ember', 'spons', 'sponge', 'scotch brite', 'kain lap', 'lap', 'aluminium foil',
    'sendok', 'piring', 'gelas', 'lilin', 'sabut', 'hanger', 'pewangi ruangan', 'glade', 'bayfresh',
  ],
};

const DEFAULT_CATEGORY = 'Kebutuhan Umum';
const CATEGORY_NAMES = [...Object.keys(CATEGORIES), DEFAULT_CATEGORY];

// Bila tidak ada kata kunci yang cocok: barang berukuran ml/liter biasanya minuman,
// barang berukuran gram biasanya makanan ringan.
function categoryFromSize(norm) {
  if (/ \d+ ?(?:ml|ltr|liter|lt) /.test(norm)) return 'Minuman';
  if (/ \d+ ?(?:gr|gram|g) /.test(norm)) return 'Makanan & Cemilan';
  return null;
}

function detectCategory(itemName) {
  const norm = ` ${String(itemName).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()} `;
  let best = DEFAULT_CATEGORY;
  let bestLen = 0;

  for (const [category, keywords] of Object.entries(CATEGORIES)) {
    for (const keyword of keywords) {
      const pattern = keyword.length <= 3 ? ` ${keyword} ` : ` ${keyword}`;
      if (keyword.length > bestLen && norm.includes(pattern)) {
        best = category;
        bestLen = keyword.length;
      }
    }
  }
  if (best === DEFAULT_CATEGORY) {
    const spaced = ` ${String(itemName).toLowerCase().replace(/(\d)([a-z])/g, '$1 $2').replace(/[^a-z0-9]+/g, ' ').trim()} `;
    return categoryFromSize(spaced) || best;
  }
  return best;
}

// Semua kata (>= 4 huruf) dari kata kunci, dipakai sebagai kamus koreksi ejaan OCR.
const KEYWORD_WORDS = [...new Set(
  Object.values(CATEGORIES).flat().flatMap((kw) => kw.split(' ')).filter((w) => w.length >= 4)
)];

module.exports = { detectCategory, CATEGORY_NAMES, DEFAULT_CATEGORY, KEYWORD_WORDS };
