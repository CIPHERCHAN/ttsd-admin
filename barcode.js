/**
 * T3CHS receipt barcode module
 * ------------------------------------------------------------------
 * Generation: JsBarcode draws straight onto a <canvas> element. This
 * matters — a screenshot library (html2canvas) captures <canvas> content
 * by copying its pixel buffer directly, which is exact. It captures <svg>
 * content by re-parsing and re-rendering the SVG tree, which historically
 * is not always exact (anti-aliasing / sub-pixel bar widths can shift
 * slightly). Code128 decoders rely on precise bar-width ratios, so that
 * small a wobble is enough to make a barcode unreadable to a strict
 * decoder (like ZXing) even though it still looks fine to the eye and
 * even though a tolerant ML-based scanner (like Google Lens) can still
 * read it. Canvas output avoids that step entirely.
 *
 * Decoding: reads an uploaded receipt photo back with ZXing, looking
 * specifically for a Code128 barcode. Requires jsbarcode and @zxing/library
 * to already be loaded on the page (see index.html <head>).
 *
 * Exposes on window: renderReceiptBarcode(code), decodeBarcodeFromImage(file)
 */

function renderReceiptBarcode(code) {
  const canvas = document.getElementById('receipt-barcode-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (!code) return;
  try {
    JsBarcode(canvas, code, {
      format: 'CODE128',
      displayValue: false,
      background: '#ffffff',
      lineColor: '#0a0a12',
      width: 2.6,     // wider bars — more tolerant of any residual compression
      height: 60,
      margin: 16,     // generous quiet zone, required for reliable decoding
    });
  } catch (e) {
    console.warn('Barcode render failed:', e.message);
  }
}

function loadImageFromFile(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => resolve(img);
    img.onerror = (e) => { URL.revokeObjectURL(url); reject(e); };
    img.src = url;
  });
}

async function decodeBarcodeFromImage(file) {
  const hints = new Map();
  hints.set(ZXing.DecodeHintType.POSSIBLE_FORMATS, [ZXing.BarcodeFormat.CODE_128]);
  hints.set(ZXing.DecodeHintType.TRY_HARDER, true);
  const reader = new ZXing.BrowserMultiFormatReader(hints);
  const errors = [];

  // Attempt 1: bottom half of the image — the barcode always sits there in
  // our template, so this is a simple, robust way to cut out header/text
  // clutter without needing fragile pixel-region detection.
  try {
    const img = await loadImageFromFile(file);
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    canvas.getContext('2d').drawImage(img, 0, 0);
    const cropTop = Math.floor(canvas.height * 0.5);
    const cropH = canvas.height - cropTop;
    const crop = document.createElement('canvas');
    crop.width = canvas.width;
    crop.height = cropH;
    crop.getContext('2d').drawImage(canvas, 0, cropTop, canvas.width, cropH, 0, 0, canvas.width, cropH);
    const result = await reader.decodeFromImageUrl(crop.toDataURL('image/png'));
    return result.getText();
  } catch (e) {
    errors.push('bottom-half: ' + (e && e.message ? e.message : e));
  }

  // Attempt 2: the full original image, unmodified.
  const fullUrl = URL.createObjectURL(file);
  try {
    const result = await reader.decodeFromImageUrl(fullUrl);
    return result.getText();
  } catch (e) {
    errors.push('full-image: ' + (e && e.message ? e.message : e));
    throw new Error(errors.join(' | '));
  } finally {
    URL.revokeObjectURL(fullUrl);
  }
}
