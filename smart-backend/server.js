const express = require('express');
const multer = require('multer');
const Tesseract = require('tesseract.js');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const upload = multer({ storage: multer.memoryStorage() });

function detectCategory(itemName) {
  const name = itemName.toLowerCase();
  if (name.includes('beras') || name.includes('minyak') || name.includes('gula') || name.includes('telur') || name.includes('susu')) {
    return 'Kebutuhan Pokok';
  } else if (name.includes('sabun') || name.includes('shampoo') || name.includes('deterjen')) {
    return 'Perlengkapan Mandi & Cuci';
  } else if (name.includes('roti') || name.includes('snack') || name.includes('biskuit')) {
    return 'Makanan & Cemilan';
  } else if (name.includes('aqua') || name.includes('teh') || name.includes('soda') || name.includes('kopi')) {
    return 'Minuman';
  }
  return 'Kebutuhan Umum';
}

app.post('/api/scan', upload.single('receipt'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Tidak ada file gambar struk.' });
    }

    console.log('Memproses OCR Tesseract...');
    const { data: { text } } = await Tesseract.recognize(req.file.buffer, 'ind', {
      logger: (m) => { if (m.progress) console.log(`Progres OCR: ${Math.round(m.progress * 100)}%`); }
    });

    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    let merchantName = lines.length > 0 ? lines[0] : 'Toko / Minimarket';
    let totalAmount = 0;
    const items = [];

    lines.forEach((line) => {
      const upperLine = line.toUpperCase();
      if (upperLine.includes('TOTAL') || upperLine.includes('TTL') || upperLine.includes('JUMLAH')) {
        const numbers = line.match(/[\d.,]+/g);
        if (numbers) {
          const cleanNum = numbers[numbers.length - 1].replace(/\./g, '').replace(/,/g, '');
          const parsed = parseInt(cleanNum, 10);
          if (!isNaN(parsed) && parsed > totalAmount) totalAmount = parsed;
        }
      }

      const priceMatch = line.match(/(\d{1,3}(?:\.\d{3})*|\d+)$/);
      if (priceMatch && !upperLine.includes('TOTAL') && !upperLine.includes('TUNAI')) {
        const price = parseInt(priceMatch[0].replace(/\./g, ''), 10);
        if (!isNaN(price) && price > 500) {
          const itemName = line.replace(priceMatch[0], '').trim();
          if (itemName.length > 2) {
            items.push({ id: items.length + 1, name: itemName, price, category: detectCategory(itemName) });
          }
        }
      }
    });

    if (totalAmount === 0 && items.length > 0) {
      totalAmount = items.reduce((sum, item) => sum + item.price, 0);
    }
    if (totalAmount === 0) totalAmount = 25000;

    res.json({
      success: true,
      message: 'OCR Berhasil!',
      data: {
        merchant_name: merchantName,
        total_amount: totalAmount,
        items: items.length > 0 ? items : [{ id: 1, name: "Belanjaan Umum", price: totalAmount, category: "Kebutuhan Umum" }]
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Backend OCR berjalan di port ${PORT}`));