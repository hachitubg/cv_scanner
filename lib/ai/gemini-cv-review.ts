import type { ParsedCVResult } from "@/types";

const MAX_PROMPT_TEXT_LENGTH = 24000;

export class GeminiApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "GeminiApiError";
    this.status = status;
  }
}

function truncateRawText(rawText: string) {
  if (rawText.length <= MAX_PROMPT_TEXT_LENGTH) return rawText;
  return `${rawText.slice(0, MAX_PROMPT_TEXT_LENGTH)}\n\n[TRUNCATED]`;
}

function extractJsonText(payload: unknown) {
  if (!payload || typeof payload !== "object") return "";

  const candidates = (payload as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> }).candidates;
  if (!Array.isArray(candidates) || !candidates.length) return "";

  return candidates[0]?.content?.parts?.map((part) => part.text ?? "").join("").trim() ?? "";
}

function parseJsonResponse(text: string) {
  if (!text) throw new Error("EMPTY_GEMINI_RESPONSE");

  const cleaned = text
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  return JSON.parse(cleaned) as ParsedCVResult;
}

function normalizeParsedResult(result: ParsedCVResult): ParsedCVResult {
  const uniqueSkills = Array.from(new Set((result.skills ?? []).map((item) => item.trim()).filter(Boolean))).slice(0, 20);

  return {
    fullName: result.fullName?.trim() || undefined,
    email: result.email?.trim() || undefined,
    phone: result.phone?.trim() || undefined,
    dateOfBirth: result.dateOfBirth?.trim() || undefined,
    address: result.address?.trim() || undefined,
    hometown: result.hometown?.trim() || undefined,
    school: result.school?.trim() || undefined,
    graduationYear: result.graduationYear?.trim() || undefined,
    yearsOfExperience:
      typeof result.yearsOfExperience === "number" && Number.isFinite(result.yearsOfExperience)
        ? result.yearsOfExperience
        : undefined,
    position: result.position?.trim() || undefined,
    summary: result.summary?.trim() || undefined,
    skills: uniqueSkills.length ? uniqueSkills : undefined,
    notes: result.notes?.trim() || undefined,
    rawText: result.rawText,
  };
}

export async function extractFieldsWithGemini(
  rawText: string,
  apiKey: string,
  model: string,
): Promise<ParsedCVResult> {
  const trimmedApiKey = apiKey.trim();
  if (!trimmedApiKey) {
    throw new Error("MISSING_GEMINI_API_KEY");
  }

  const trimmedModel = model.trim();
  if (!trimmedModel) {
    throw new Error("MISSING_GEMINI_MODEL");
  }

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${trimmedModel}:generateContent`;

  const prompt = [
    "Bạn là chuyên gia tuyển dụng và data extraction cho CV.",
    "Hãy đọc nội dung CV bên dưới và trích xuất dữ liệu ứng viên ra JSON theo schema đã yêu cầu.",
    "Quy tắc:",
    "- Chỉ điền trường khi thật sự tìm thấy hoặc suy luận rất chắc chắn.",
    "- Không bịa thông tin.",
    "- skills là mảng kỹ năng ngắn gọn, tối đa 20 mục.",
    "- summary là tóm tắt ngắn 2-4 câu về hồ sơ ứng viên.",
    "- notes là nhận xét nhanh để HR review CV tốt hơn, có thể gồm điểm mạnh, điểm cần lưu ý, link nổi bật hoặc khoảng trống dữ liệu.",
    "- yearsOfExperience là số nguyên nếu suy luận được khá chắc.",
    "- rawText giữ nguyên chuỗi 'preserved_by_server'.",
    "",
    "Nội dung CV:",
    truncateRawText(rawText),
  ].join("\n");

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": trimmedApiKey,
    },
    body: JSON.stringify({
      contents: [
        {
          parts: [{ text: prompt }],
        },
      ],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: {
          type: "object",
          properties: {
            fullName: { type: "string", nullable: true },
            email: { type: "string", nullable: true },
            phone: { type: "string", nullable: true },
            dateOfBirth: { type: "string", nullable: true },
            address: { type: "string", nullable: true },
            hometown: { type: "string", nullable: true },
            school: { type: "string", nullable: true },
            graduationYear: { type: "string", nullable: true },
            yearsOfExperience: { type: "integer", nullable: true },
            position: { type: "string", nullable: true },
            summary: { type: "string", nullable: true },
            skills: {
              type: "array",
              nullable: true,
              items: { type: "string" },
            },
            notes: { type: "string", nullable: true },
            rawText: { type: "string" },
          },
          required: ["rawText"],
        },
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new GeminiApiError(errorText || "GEMINI_REQUEST_FAILED", response.status);
  }

  const payload = (await response.json()) as unknown;
  const text = extractJsonText(payload);
  const parsed = parseJsonResponse(text);

  return normalizeParsedResult({
    ...parsed,
    rawText,
  });
}
