const { recognizeText, VARIANTS } = require('./ocr');
const { parseReceipt, itemKey } = require('./parser');

// Hasil dianggap konsisten bila jumlah item (setelah diskon) sama dengan total di struk.
const isConsistent = (r) =>
  r.receipt_total !== null && r.items.length > 0 && Math.abs(r.total_amount - r.receipt_total) <= 1;

// Jumlah harga yang dikoreksi otomatis oleh parser (koreksi digit).
const fixCount = (r) => r.items.filter((item) => item.ocr_price !== undefined).length;

// Makin besar makin baik: konsisten tanpa/sedikit koreksi > item banyak & selisih kecil.
// Hasil tanpa total struk mendapat penalti besar (baris total/pembayaran ikut terbaca sebagai item).
function score(r) {
  if (isConsistent(r)) return 1e9 - fixCount(r) * 1e6 + r.items.length;
  const gap = r.receipt_total !== null ? Math.min(Math.abs(r.total_amount - r.receipt_total) / r.receipt_total, 1) : 1;
  return r.items.length * 1000 - gap * 3000;
}

function pickBest(runs) {
  return runs.reduce((best, run) => (!best || score(run.result) > score(best.result) ? run : best), null);
}

// Berapa kali tiap harga item dibaca sama oleh semua percobaan OCR.
function collectPriceReadings(runs) {
  const readings = new Map();
  for (const { result } of runs) {
    for (const item of result.items) {
      const key = itemKey(item.name);
      if (!readings.has(key)) readings.set(key, new Map());
      const prices = readings.get(key);
      const gross = item.price + item.discount;
      prices.set(gross, (prices.get(gross) || 0) + 1);
    }
  }
  return readings;
}

// OCR + parsing. Jalankan variasi preprocessing satu per satu sampai hasilnya konsisten.
// Bila tidak ada yang konsisten, parse ulang semua teks dengan bantuan "suara" harga dari
// semua percobaan (mis. harga yang dibaca sama 5x hampir pasti benar), lalu pilih yang terbaik.
async function scanReceipt(buffer) {
  const runs = [];
  for (const variant of VARIANTS) {
    const text = await recognizeText(buffer, variant);
    const result = parseReceipt(text);
    console.log(`[OCR ${variant.name}] ${result.items.length} item, total ${result.total_amount}, struk ${result.receipt_total}`);
    const run = { result, text, variant: variant.name };
    // Konsisten dengan <= 1 koreksi: langsung pakai. Konsisten berkat 2 koreksi bisa jadi
    // kebetulan pada hasil OCR yang kacau, jadi percobaan lain tetap dijalankan.
    if (isConsistent(result) && fixCount(result) <= 1) return run;
    runs.push(run);
  }

  const priceReadings = collectPriceReadings(runs);
  const reparsed = runs.map((run) => ({ ...run, result: parseReceipt(run.text, { priceReadings }) }));
  const best = pickBest([...reparsed, ...runs]);
  console.log(`[OCR terpilih] ${best.variant}, konsisten: ${isConsistent(best.result)}`);
  return best;
}

module.exports = { scanReceipt };
