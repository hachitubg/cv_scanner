import assert from "node:assert/strict";
import { after, test } from "node:test";
import { createCanvas } from "@napi-rs/canvas";

import { extractFields } from "../lib/parser/extract-fields";
import { extractTextFromFile, normalizeText } from "../lib/parser/extract-text";
import { terminateOCRWorker } from "../lib/parser/ocr";
import { needsOCR, selectPageText } from "../lib/parser/text-quality";

// Small, synthetic PDFs keep private candidate data out of regression fixtures.
function makePDF(pages: Array<{ text?: string; image?: Buffer }>) {
  const objects: Buffer[] = [];
  const add = (value: string | Buffer) => objects.push(Buffer.isBuffer(value) ? value : Buffer.from(value));
  const stream = (dictionary: string, bytes: Buffer) => Buffer.concat([
    Buffer.from(`<< ${dictionary} /Length ${bytes.length} >>\nstream\n`), bytes, Buffer.from("\nendstream"),
  ]);
  add("<< /Type /Catalog /Pages 2 0 R >>");
  add(`<< /Type /Pages /Count ${pages.length} /Kids [${pages.map((_, i) => `${4 + i * 3} 0 R`).join(" ")}] >>`);
  add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  pages.forEach((page, i) => {
    const id = 4 + i * 3;
    add(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 600 800] /Resources << /Font << /F1 3 0 R >> /XObject << /Im ${id + 2} 0 R >> >> /Contents ${id + 1} 0 R >>`);
    const command = page.image ? "q 600 0 0 800 0 0 cm /Im Do Q" : `BT /F1 12 Tf 40 740 Td (${page.text}) Tj ET`;
    add(stream("", Buffer.from(command)));
    add(page.image ? stream("/Type /XObject /Subtype /Image /Width 1200 /Height 1600 /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode", page.image) : "null");
  });
  const chunks = [Buffer.from("%PDF-1.4\n")];
  const offsets = [0];
  let position = chunks[0].length;
  objects.forEach((object, index) => {
    offsets.push(position);
    const chunk = Buffer.concat([Buffer.from(`${index + 1} 0 obj\n`), object, Buffer.from("\nendobj\n")]);
    chunks.push(chunk);
    position += chunk.length;
  });
  chunks.push(Buffer.from(`xref\n0 ${offsets.length}\n0000000000 65535 f \n${offsets.slice(1).map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`).join("")}trailer\n<< /Size ${offsets.length} /Root 1 0 R >>\nstartxref\n${position}\n%%EOF`));
  return Buffer.concat(chunks);
}

test("normalization preserves Vietnamese and CRLF paragraphs", () => {
  assert.equal(normalizeText("NGUYỄN VĂN AN\r\nEmail: an@example.com"), "NGUYỄN VĂN AN\nEmail: an@example.com");
});

test("extract full email domains and do not mistake job title for name", () => {
  const fields = extractFields("Software Engineer\nNGUYỄN VĂN AN\nEmail: an@company.com.vn\nĐiện thoại: 0901234567");
  assert.equal(fields.fullName, "Nguyễn Văn An");
  assert.equal(fields.email, "an@company.com.vn");
});

test("poor text triggers OCR without losing a better native layer", () => {
  assert.equal(needsOCR("Page 1"), true);
  assert.equal(needsOCR("\uFFFD".repeat(30) + "a".repeat(80)), true);
  assert.equal(selectPageText("Original contact details", ""), "Original contact details");
});

test("text-only PDF preserves every page without page-number artifacts", async () => {
  const input = makePDF(Array.from({ length: 4 }, (_, i) => ({ text: `Candidate page ${i + 1} Software Engineer experience education projects skills email candidate@example.com` })));
  const text = await extractTextFromFile("cv.pdf", input);
  assert.match(text, /Candidate page 1/);
  assert.match(text, /Candidate page 4/);
  assert.doesNotMatch(text, /-- \d of \d --/);
});

test("empty and unsupported documents fail explicitly", async () => {
  await assert.rejects(extractTextFromFile("cv.txt", Buffer.alloc(0)), /EMPTY_FILE/);
  await assert.rejects(extractTextFromFile("cv.txt", Buffer.from(" \n ")), /NO_READABLE_TEXT/);
  await assert.rejects(extractTextFromFile("cv.doc", Buffer.from("legacy")), /UNSUPPORTED_FILE_TYPE/);
});

test("TXT supports Vietnamese UTF-16 exports", async () => {
  const input = Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from("Họ và tên: Nguyễn Văn An", "utf16le")]);
  const text = await extractTextFromFile("cv.txt", input);
  assert.equal(extractFields(text).fullName, "Nguyễn Văn An");
});

test("school abbreviations, wrapped city names and explicit source do not require a fixed CV template", () => {
  const fields = extractFields([
    "NỀN TẢNG CÔNG NGHỆ TUYỂN DỤNG THÔNG MINH",
    "Ứng viên: Nguyễn Thu Hà | Nguồn: tuyendung.topcv.vn",
    "CÔNG TY TNHH ĐẦU TƯ", "s ĐH Tài Chính Ngân Hàng", "Hà Nội", "s Kế toán - Kiểm Toán",
    "s Chứng chỉ kế toán trưởng", "s IT BA: Business analyst",
    "Nhân viên xuất sắc của", "năm tại Công ty CP kết nối tài chính",
    "CÔNG TY TNHH THƯƠNG MẠI", "Trưởng nhóm kế toán - Phụ trách kế toán",
  ].join("\n"));
  assert.equal(fields.fullName, "Nguyễn Thu Hà");
  assert.equal(fields.school, "Đại học Tài Chính Ngân Hàng Hà Nội");
  assert.equal(fields.source, "tuyendung.topcv.vn");
  assert.equal(fields.position, "Trưởng nhóm kế toán - Phụ trách kế toán");
  assert.ok(fields.scanWarnings?.length);
});

test("explicit target position wins over job history and source is not inferred from branding", () => {
  const fields = extractFields("Nguyễn Văn An\nVị trí ứng tuyển: Kế toán trưởng\nPhụ trách kế toán\nTopCV - Nền tảng công nghệ tuyển dụng thông minh");
  assert.equal(fields.position, "Kế toán trưởng");
  assert.equal(fields.source, undefined);
  assert.equal(fields.scanWarnings, undefined);
});

test("OCR preserves exact short native metadata", () => {
  const native = "Ứng viên: Nguyễn Thu Hà | Nguồn: portal.example.com";
  const recognized = "Ung vien Nguyen Thu Ha\nEducation Experience Software Engineer";
  const text = selectPageText(native, recognized);
  assert.match(text, /Nguyễn Thu Hà/);
  assert.match(text, /Software Engineer/);
});

test("simultaneous image uploads keep their OCR results separate", { skip: !process.env.CV_TEST_OCR }, async () => {
  const image = (label: string) => {
    const canvas = createCanvas(1000, 200);
    const context = canvas.getContext("2d");
    context.fillStyle = "white";
    context.fillRect(0, 0, 1000, 200);
    context.fillStyle = "black";
    context.font = "48px Arial";
    context.fillText(label, 40, 100);
    return canvas.toBuffer("image/png");
  };
  const results = await Promise.all([
    extractTextFromFile("first.png", image("ALPHA ENGINEER")),
    extractTextFromFile("second.png", image("BETA DESIGNER")),
  ]);
  assert.match(results[0], /ALPHA ENGINEER/);
  assert.match(results[1], /BETA DESIGNER/);
});

test("mixed PDF OCR reads the fourth page and preserves native pages", { skip: !process.env.CV_TEST_OCR }, async () => {
  const canvas = createCanvas(1200, 1600);
  const context = canvas.getContext("2d");
  context.fillStyle = "white";
  context.fillRect(0, 0, 1200, 1600);
  context.fillStyle = "black";
  context.font = "36px Arial";
  ["FOURTH PAGE EXPERIENCE", "Software Engineer", "candidate@example.com", "React TypeScript SQL Docker", "Education University Computer Science"].forEach((line, i) => context.fillText(line, 80, 140 + i * 90));
  const native = "Native candidate native@example.com Software Engineer education experience projects";
  const input = makePDF([{ text: native }, { text: native }, { text: native }, { image: canvas.toBuffer("image/jpeg") }]);
  const text = await extractTextFromFile("mixed.pdf", input);
  assert.match(text, /native@example.com/);
  assert.match(text, /FOURTH PAGE EXPERIENCE/);
  assert.match(text, /candidate@example.com/);
});

after(terminateOCRWorker);
