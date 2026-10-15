import { PDFParse } from "pdf-parse";
import { createWorker, OEM, PSM } from "tesseract.js";

const OCR_LANGUAGES = "eng+vie";
const OCR_PDF_SCALE = 3;
const MAX_RENDER_PIXELS = 16_000_000;

let workerPromise: Promise<Awaited<ReturnType<typeof createWorker>>> | null = null;
let recognitionQueue: Promise<unknown> = Promise.resolve();

export async function terminateOCRWorker() {
  await recognitionQueue;
  const pending = workerPromise;
  workerPromise = null;
  if (pending) await (await pending).terminate();
}

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
    }).then(async (worker) => {
      await worker.setParameters({ tessedit_pageseg_mode: PSM.AUTO, user_defined_dpi: "300" });
      return worker;
    }).catch((error) => {
      workerPromise = null;
      throw error;
    });
  }

  return workerPromise;
}

export async function extractTextFromImageWithOCR(buffer: Buffer) {
  // A worker must finish its current image before accepting another upload.
  const job = recognitionQueue.then(async () => {
    const worker = await getWorker();
    try {
      const { data: { text } } = await worker.recognize(buffer);
      return normalizeOcrText(text);
    } catch (error) {
      workerPromise = null;
      await worker.terminate().catch(() => undefined);
      throw error;
    }
  });
  recognitionQueue = job.catch(() => undefined);
  return job;
}

export async function extractTextFromPdfWithOCR(
  buffer: Buffer,
  selectedPages?: number[],
  onPage?: (page: number, text: string) => void,
) {
  const parser = new PDFParse({ data: buffer });
  const pageTexts: string[] = [];

  try {
    const info = await parser.getInfo({ parsePageInfo: true });
    for (let pageNumber = 1; pageNumber <= info.total; pageNumber += 1) {
      if (selectedPages && !selectedPages.includes(pageNumber)) continue;
      const page = info.pages.find((item) => item.pageNumber === pageNumber);
      const scale = page ? Math.min(OCR_PDF_SCALE, Math.sqrt(MAX_RENDER_PIXELS / (page.width * page.height))) : OCR_PDF_SCALE;
      const screenshot = await parser.getScreenshot({ partial: [pageNumber], scale, imageDataUrl: false, imageBuffer: true });
      const image = screenshot.pages[0];
      if (!image) throw new Error("PDF_RENDER_FAILED");
      const ocrText = await extractTextFromImageWithOCR(Buffer.from(image.data));
      onPage?.(pageNumber, ocrText);
      if (ocrText) {
        pageTexts.push(ocrText);
      }

    }
  } finally {
    await parser.destroy();
  }

  return normalizeOcrText(pageTexts.join("\n\n"));
}
