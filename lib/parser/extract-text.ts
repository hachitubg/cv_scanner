import mammoth from "mammoth";
import { PDFParse } from "pdf-parse";

import { extractTextFromImageWithOCR, extractTextFromPdfWithOCR } from "@/lib/parser/ocr";
import { needsOCR, selectPageText } from "@/lib/parser/text-quality";

const IMAGE_EXTENSIONS = new Set(["png", "jpg", "jpeg", "webp", "bmp", "tif", "tiff"]);
const IMAGE_MIME_PREFIXES = ["image/"];

export function normalizeText(rawText: string) {
  return rawText
    .normalize("NFKC")
    .replace(/\r\n?/g, "\n")
    .replace(/[\u200B\uFEFF\u00AD]/g, "")
    .replace(/([\w.+-]+)[ \t]*@[ \t]*((?:[\w-]+[ \t]*\.[ \t]*)+[a-z]{2,})/gi,
      (_match, local: string, domain: string) => `${local}@${domain.replace(/[ \t]/g, "")}`)
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
  if (!buffer.length) throw new Error("EMPTY_FILE");
  const text = await extractFile(fileName, buffer, mimeType);
  if (!(text.match(/\p{L}|\p{N}/gu)?.length)) throw new Error("NO_READABLE_TEXT");
  return text;
}

async function extractFile(fileName: string, buffer: Buffer, mimeType?: string) {
  const extension = fileName.split(".").pop()?.toLowerCase();
  const isImageFile =
    Boolean(extension && IMAGE_EXTENSIONS.has(extension)) ||
    IMAGE_MIME_PREFIXES.some((prefix) => mimeType?.startsWith(prefix));

  if (extension === "pdf" || mimeType === "application/pdf") {
    const parser = new PDFParse({ data: buffer });
    let pages: Array<{ num: number; text: string }> = [];
    try {
      const parsed = await parser.getText({ pageJoiner: "" });
      pages = parsed.pages.map((page) => ({ ...page, text: normalizeText(page.text) }));
    } catch (error) {
      if (error instanceof Error && /password/i.test(error.name + error.message)) {
        throw new Error("PDF_PASSWORD_REQUIRED");
      }
      // Rendering may still recover documents whose text layer cannot be decoded.
    } finally {
      await parser.destroy();
    }

    if (!pages.length) return normalizeText(await extractTextFromPdfWithOCR(buffer));
    const missing = pages.filter((page) => needsOCR(page.text)).map((page) => page.num);
    if (!missing.length) return normalizeText(pages.map((page) => page.text).join("\n\n"));
    const recognized = new Map<number, string>();
    await extractTextFromPdfWithOCR(buffer, missing, (page, text) => recognized.set(page, text));
    return normalizeText(pages.map((page) => selectPageText(page.text, recognized.get(page.num) ?? "")).join("\n\n"));
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
    const encoding = buffer[0] === 0xff && buffer[1] === 0xfe ? "utf-16le"
      : buffer[0] === 0xfe && buffer[1] === 0xff ? "utf-16be" : "utf-8";
    return normalizeText(new TextDecoder(encoding).decode(buffer));
  }

  if (isImageFile) {
    const ocrText = await extractTextFromImageWithOCR(buffer);
    return normalizeText(ocrText);
  }

  throw new Error("UNSUPPORTED_FILE_TYPE");
}
