import mammoth from "mammoth";
import { PDFParse } from "pdf-parse";

import { extractTextFromImageWithOCR, extractTextFromPdfWithOCR } from "@/lib/parser/ocr";

const IMAGE_EXTENSIONS = new Set(["png", "jpg", "jpeg", "webp", "bmp", "tif", "tiff"]);
const IMAGE_MIME_PREFIXES = ["image/"];
const MIN_PARSED_PDF_TEXT_LENGTH = 80;

export function normalizeText(rawText: string) {
  return rawText
    .normalize("NFKC")
    .replace(/\r/g, "\n")
    .replace(/[•●▪◦·]/g, "\n- ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/[‐‑‒–—]/g, "-")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

export async function extractTextFromFile(
  fileName: string,
  buffer: Buffer,
  mimeType?: string,
) {
  const extension = fileName.split(".").pop()?.toLowerCase();
  const isImageFile =
    Boolean(extension && IMAGE_EXTENSIONS.has(extension)) ||
    IMAGE_MIME_PREFIXES.some((prefix) => mimeType?.startsWith(prefix));

  if (extension === "pdf" || mimeType === "application/pdf") {
    const parser = new PDFParse({ data: buffer });
    try {
      const parsed = await parser.getText();
      const normalized = normalizeText(parsed.text);
      if (normalized.length >= MIN_PARSED_PDF_TEXT_LENGTH) {
        return normalized;
      }
    } finally {
      await parser.destroy();
    }

    const ocrText = await extractTextFromPdfWithOCR(buffer);
    return normalizeText(ocrText);
  }

  if (
    extension === "docx" ||
    mimeType ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    const parsed = await mammoth.extractRawText({ buffer });
    return normalizeText(parsed.value);
  }

  if (extension === "txt" || mimeType?.startsWith("text/")) {
    return normalizeText(buffer.toString("utf8"));
  }

  if (isImageFile) {
    const ocrText = await extractTextFromImageWithOCR(buffer);
    return normalizeText(ocrText);
  }

  throw new Error("UNSUPPORTED_FILE_TYPE");
}
