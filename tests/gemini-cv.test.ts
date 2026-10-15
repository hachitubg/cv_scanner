import assert from "node:assert/strict";
import { test } from "node:test";
import { extractFieldsWithGemini } from "../lib/ai/gemini-cv-review";

test("AI receives original PDF, validates fields and does not replace transcript with empty OCR", async (t) => {
  let sent: { contents: Array<{ parts: Array<{ inlineData?: { data: string; mimeType: string } }> }> } | undefined;
  t.mock.method(globalThis, "fetch", async (_url: string, options: RequestInit) => {
    sent = JSON.parse(String(options.body));
    return Response.json({ candidates: [{ content: { parts: [{ text: JSON.stringify({
      fullName: "Nguyễn Thu Hà", school: "Đại học Tài chính", source: "portal.example.com",
      position: "Kế toán trưởng", scanWarnings: ["Chức danh gợi ý cần xác nhận."], rawText: "Original transcript",
    }) }] } }] });
  });
  const input = Buffer.from("synthetic-pdf-content");
  const parsed = await extractFieldsWithGemini("", "test-key", "test-model", { fileName: "cv.pdf", buffer: input });
  assert.equal(sent?.contents[0].parts[1].inlineData?.mimeType, "application/pdf");
  assert.equal(sent?.contents[0].parts[1].inlineData?.data, input.toString("base64"));
  assert.equal(parsed.rawText, "Original transcript");
  assert.equal(parsed.source, "portal.example.com");
  assert.equal(parsed.scanWarnings?.length, 1);
});

test("AI text extraction retains server transcript and rejects invalid field types", async (t) => {
  const response = (text: unknown) => Response.json({ candidates: [{ content: { parts: [{ text: JSON.stringify(text) }] } }] });
  const mock = t.mock.method(globalThis, "fetch", async () => response({ school: null, rawText: "preserved_by_server" }));
  const parsed = await extractFieldsWithGemini("Original DOCX text", "test-key", "test-model");
  assert.equal(parsed.rawText, "Original DOCX text");
  assert.equal(parsed.school, undefined);
  mock.mock.mockImplementation(async () => response({ fullName: 123 }));
  await assert.rejects(extractFieldsWithGemini("text", "test-key", "test-model"), /INVALID_GEMINI_RESPONSE/);
});
