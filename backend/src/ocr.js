const path = require('path');
const sharp = require('sharp');
const { createWorker, PSM } = require('tesseract.js');

// ind.traineddata ada di root folder backend, apa pun working directory-nya.
const CACHE_PATH = path.join(__dirname, '..');

let workerPromise = null;

// Satu worker dipakai ulang untuk semua request (inisialisasi Tesseract mahal).
function getWorker() {
  if (!workerPromise) {
    workerPromise = (async () => {
      const worker = await createWorker('ind', 1, { cachePath: CACHE_PATH });
      await worker.setParameters({
        tessedit_pageseg_mode: PSM.SINGLE_BLOCK,
        preserve_interword_spaces: '1',
      });
      return worker;
    })().catch((err) => {
      workerPromise = null;
      throw err;
    });
  }
  return workerPromise;
}

// Variasi preprocessing. Hasil OCR sangat bergantung pada ukuran huruf & kompresi foto,
// jadi bila hasil pertama tidak konsisten, variasi berikutnya dicoba (lihat scan.js).
// Tesseract butuh huruf yang cukup besar: gambar kecil diperbesar, foto besar dikecilkan.
const VARIANTS = [
  { name: 'w1500', width: 1500 },
  { name: 'w2000', width: 2000 },
  { name: 'w1200-threshold', width: 1200, threshold: true },
  { name: 'w2400', width: 2400 },
  { name: 'w1800-threshold', width: 1800, threshold: true },
];

function preprocess(buffer, variant) {
  let image = sharp(buffer)
    .rotate() // ikuti orientasi EXIF dari kamera
    .resize({ width: variant.width })
    .grayscale()
    .normalize();
  image = variant.threshold ? image.median(3).threshold(150) : image.sharpen();
  return image.toBuffer();
}

async function recognizeText(buffer, variant = VARIANTS[0]) {
  const image = await preprocess(buffer, variant);
  const worker = await getWorker();
  const { data } = await worker.recognize(image);
  return data.text;
}

module.exports = { recognizeText, getWorker, VARIANTS };
