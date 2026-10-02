const express = require('express');
const multer = require('multer');
const cors = require('cors');
const { getWorker } = require('./src/ocr');
const { scanReceipt } = require('./src/scan');
const { parseReceipt } = require('./src/parser');
const { CATEGORY_NAMES } = require('./src/categories');

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

app.post('/api/scan', upload.single('receipt'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Tidak ada file gambar struk.' });
    }

    console.log('Menjalankan OCR struk...');
    const { result, text, variant } = await scanReceipt(req.file.buffer);

    console.log(`--- HASIL MENTAH OCR (${variant}) ---`);
    console.log(text);
    console.log('------------------------');

    return res.json({
      success: true,
      message: 'Struk berhasil diproses.',
      data: { ...result, raw_text: text },
    });
  } catch (error) {
    console.error('Error OCR:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

// Untuk debugging/tuning parser tanpa OCR: kirim teks mentah struk.
app.post('/api/parse-text', (req, res) => {
  const text = req.body && req.body.text;
  if (typeof text !== 'string' || !text.trim()) {
    return res.status(400).json({ success: false, message: 'Field "text" wajib diisi.' });
  }
  return res.json({ success: true, data: parseReceipt(text) });
});

app.get('/api/categories', (req, res) => {
  res.json({ success: true, data: CATEGORY_NAMES });
});

app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    const message = err.code === 'LIMIT_FILE_SIZE' ? 'Ukuran gambar maksimal 10 MB.' : err.message;
    return res.status(400).json({ success: false, message });
  }
  console.error(err);
  return res.status(500).json({ success: false, message: err.message });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Backend OCR berjalan di port ${PORT}`);
  // Siapkan worker Tesseract di awal agar scan pertama tidak lambat.
  getWorker().then(() => console.log('Tesseract siap.')).catch((err) => console.error('Gagal memuat Tesseract:', err));
});
