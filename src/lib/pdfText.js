// Client-side PDF -> text extraction via OCR (Tesseract.js, Hindi + English).
// Tesseract is loaded from a CDN UMD bundle to avoid the `require is not defined`
// CommonJS issue that hits its npm package under Vite's browser ESM.
import * as pdfjsLib from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

const TESSERACT_CDN = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';
const OCR_MAX_PAGES = 8;
const OCR_RENDER_SCALE = 1.5;
const OCR_LANGS = 'hin+eng';

let tesseractLoadingPromise = null;
async function loadTesseract() {
  if (typeof window === 'undefined') throw new Error('OCR is browser-only');
  if (window.Tesseract) return window.Tesseract;
  if (tesseractLoadingPromise) return tesseractLoadingPromise;
  tesseractLoadingPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[data-tesseract="1"]`);
    if (existing) {
      existing.addEventListener('load', () => resolve(window.Tesseract));
      existing.addEventListener('error', () => reject(new Error('Failed to load Tesseract.js from CDN')));
      return;
    }
    const script = document.createElement('script');
    script.src = TESSERACT_CDN;
    script.async = true;
    script.dataset.tesseract = '1';
    script.onload = () => {
      if (window.Tesseract) resolve(window.Tesseract);
      else reject(new Error('Tesseract loaded but window.Tesseract is missing'));
    };
    script.onerror = () => reject(new Error(`Could not load Tesseract.js from ${TESSERACT_CDN}. Check your internet connection.`));
    document.head.appendChild(script);
  });
  return tesseractLoadingPromise;
}

async function renderPageToCanvas(page) {
  const viewport = page.getViewport({ scale: OCR_RENDER_SCALE });
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  const ctx = canvas.getContext('2d');
  await page.render({ canvasContext: ctx, viewport }).promise;
  return canvas;
}

async function ocrPdf(doc, onProgress) {
  const Tesseract = await loadTesseract();
  const total = Math.min(doc.numPages, OCR_MAX_PAGES);
  if (doc.numPages > OCR_MAX_PAGES) {
    console.warn(`[pdfText] OCR limited to first ${OCR_MAX_PAGES} of ${doc.numPages} pages`);
  }
  onProgress?.({ stage: 'ocr-init', total });
  const worker = await Tesseract.createWorker(OCR_LANGS, 1, {
    logger: (m) => {
      if (m.status === 'recognizing text') {
        onProgress?.({ stage: 'ocr-progress', progress: Math.round(m.progress * 100) });
      } else if (m.status) {
        onProgress?.({ stage: 'ocr-info', info: m.status });
      }
    },
  });
  try {
    const pages = [];
    for (let i = 1; i <= total; i++) {
      onProgress?.({ stage: 'ocr-render', page: i, total });
      const page = await doc.getPage(i);
      const canvas = await renderPageToCanvas(page);
      onProgress?.({ stage: 'ocr-recognize', page: i, total });
      const { data } = await worker.recognize(canvas);
      pages.push(String(data?.text || '').trim());
    }
    return pages.filter(Boolean).join('\n\n').trim();
  } finally {
    await worker.terminate().catch(() => {});
  }
}

export async function extractPdfText(file, { onProgress } = {}) {
  if (!file) return { text: '', source: 'none', pageCount: 0 };
  const arrayBuffer = await file.arrayBuffer();
  const doc = await pdfjsLib.getDocument({ data: arrayBuffer, isEvalSupported: false }).promise;
  const text = await ocrPdf(doc, onProgress);
  return { text, source: 'ocr', pageCount: doc.numPages, ocrLangs: OCR_LANGS };
}

export function isPdfFile(file) {
  if (!file) return false;
  if (file.type === 'application/pdf') return true;
  return /\.pdf$/i.test(file.name || '');
}
