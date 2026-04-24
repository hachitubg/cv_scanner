import { NextResponse } from "next/server";

import { extractFieldsWithGemini, GeminiApiError } from "@/lib/ai/gemini-cv-review";
import { auth } from "@/lib/auth";
import { extractFields } from "@/lib/parser/extract-fields";
import { extractTextFromFile } from "@/lib/parser/extract-text";
import type { ParsedCVResult } from "@/types";

function mergeParsedResults(base: ParsedCVResult, enriched: ParsedCVResult): ParsedCVResult {
  const mergedSkills = Array.from(new Set([...(enriched.skills ?? []), ...(base.skills ?? [])])).slice(0, 20);
  const mergedNotes = [enriched.notes, base.notes].filter(Boolean).join("\n\n").trim();

  return {
    fullName: enriched.fullName ?? base.fullName,
    email: enriched.email ?? base.email,
    phone: enriched.phone ?? base.phone,
    dateOfBirth: enriched.dateOfBirth ?? base.dateOfBirth,
    address: enriched.address ?? base.address,
    hometown: enriched.hometown ?? base.hometown,
    school: enriched.school ?? base.school,
    graduationYear: enriched.graduationYear ?? base.graduationYear,
    yearsOfExperience: enriched.yearsOfExperience ?? base.yearsOfExperience,
    position: enriched.position ?? base.position,
    summary: enriched.summary ?? base.summary,
    skills: mergedSkills.length ? mergedSkills : undefined,
    notes: mergedNotes || undefined,
    rawText: base.rawText,
  };
}

function formatGeminiErrorDetail(message: string) {
  const cleaned = message.replace(/\s+/g, " ").trim();
  return cleaned.slice(0, 1200) || "Không có thêm chi tiết từ Gemini.";
}

function isNoFreeTierQuotaError(message: string) {
  const normalized = message.toLowerCase();
  return normalized.includes("quota exceeded") && normalized.includes("free_tier") && normalized.includes("limit: 0");
}

function errorResponse(status: number, error: string, errorDetail?: string) {
  return NextResponse.json(errorDetail ? { error, errorDetail } : { error }, { status });
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Bạn chưa đăng nhập." }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("file");
  const scanMode = String(formData.get("scanMode") ?? "basic");
  const geminiModel = String(formData.get("geminiModel") ?? "").trim();

  if (!(file instanceof File)) {
    return errorResponse(400, "Vui lòng chọn file CV.");
  }

  if (file.size > 10 * 1024 * 1024) {
    return errorResponse(400, "File vượt quá 10MB.");
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const rawText = await extractTextFromFile(file.name, buffer, file.type);
    const parsed = extractFields(rawText);

    if (scanMode !== "ai") {
      return NextResponse.json(parsed);
    }

    const geminiApiKey = request.headers.get("x-gemini-api-key")?.trim();
    if (!geminiApiKey) {
      return errorResponse(400, "Thiếu Gemini API Key để thực hiện AI Scan.");
    }

    if (!geminiModel) {
      return errorResponse(400, "Thiếu Gemini model để thực hiện AI Scan.");
    }

    const aiParsed = await extractFieldsWithGemini(rawText, geminiApiKey, geminiModel);
    return NextResponse.json(mergeParsedResults(parsed, aiParsed));
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const detail = formatGeminiErrorDetail(message);

    if (error instanceof GeminiApiError && error.status === 429) {
      if (isNoFreeTierQuotaError(message)) {
        return errorResponse(
          429,
          "Project/API key hiện không có free-tier quota cho model Gemini đang chọn.",
          detail,
        );
      }

      return errorResponse(429, "Gemini đã hết token hoặc vượt quota.", detail);
    }

    if (message === "UNSUPPORTED_FILE_TYPE") {
      return errorResponse(400, "Chỉ hỗ trợ PDF, DOCX, TXT và ảnh PNG/JPG/JPEG/WEBP.");
    }

    if (message.includes("API_KEY") || message.includes("API key") || message.includes("x-goog-api-key")) {
      return errorResponse(400, "Gemini API Key không hợp lệ.", detail);
    }

    if (
      message.includes("quota") ||
      message.includes("RESOURCE_EXHAUSTED") ||
      message.includes("TooManyRequests") ||
      message.includes("Too Many Requests")
    ) {
      if (isNoFreeTierQuotaError(message)) {
        return errorResponse(
          429,
          "Project/API key hiện không có free-tier quota cho model Gemini đang chọn.",
          detail,
        );
      }

      return errorResponse(429, "Gemini đã hết token hoặc vượt quota.", detail);
    }

    if (message.includes("503") || message.includes("ServiceUnavailable") || message.includes("SERVICE_UNAVAILABLE")) {
      return errorResponse(503, "Gemini đang tạm thời không khả dụng.", detail);
    }

    if (message.includes("GEMINI_REQUEST_FAILED") || message.includes("EMPTY_GEMINI_RESPONSE") || message === "JSON") {
      return errorResponse(400, "Gemini không trả về kết quả hợp lệ.", detail);
    }

    return errorResponse(400, "Không thể đọc nội dung CV.", detail || "Unknown scan error");
  }
}
