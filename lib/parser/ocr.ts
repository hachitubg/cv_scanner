import { createCanvas } from "@napi-rs/canvas";
import { createWorker, OEM } from "tesseract.js";

const OCR_LANGUAGES = "eng+vie";
const OCR_PDF_SCALE = 2;
const OCR_MAX_PDF_PAGES = 3;

let workerPromise: Promise<Awaited<ReturnType<typeof createWorker>>> | null = null;

function normalizeOcrText(value: string) {
  return value
    .replace(/\r/g, "\n")
    .replace(/[|]{2,}/g, "|")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function getWorker() {
  if (!workerPromise) {
    workerPromise = createWorker(OCR_LANGUAGES, OEM.LSTM_ONLY, {
      logger: () => undefined,
    });
  }

  return workerPromise;
}

export async function extractTextFromImageWithOCR(buffer: Buffer) {
  const worker = await getWorker();
  const {
    data: { text },
  } = await worker.recognize(buffer);

  return normalizeOcrText(text);
}

export async function extractTextFromPdfWithOCR(buffer: Buffer) {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(buffer),
    useWorkerFetch: false,
    isEvalSupported: false,
    disableFontFace: true,
  });

  const pdf = await loadingTask.promise;
  const pagesToScan = Math.min(pdf.numPages, OCR_MAX_PDF_PAGES);
  const pageTexts: string[] = [];

  try {
    for (let pageNumber = 1; pageNumber <= pagesToScan; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const viewport = page.getViewport({ scale: OCR_PDF_SCALE });
      const width = Math.max(1, Math.ceil(viewport.width));
      const height = Math.max(1, Math.ceil(viewport.height));
      const canvas = createCanvas(width, height);
      const context = canvas.getContext("2d");

      await page.render({
        canvas: canvas as never,
        canvasContext: context as never,
        viewport,
      }).promise;

      const imageBuffer = canvas.toBuffer("image/png");
      const ocrText = await extractTextFromImageWithOCR(imageBuffer);
      if (ocrText) {
        pageTexts.push(ocrText);
      }

      page.cleanup();
    }
  } finally {
    await loadingTask.destroy();
  }

  return normalizeOcrText(pageTexts.join("\n\n"));
}
