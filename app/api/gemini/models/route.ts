import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";

type GeminiModelResponse = {
  models?: Array<{
    name?: string;
    baseModelId?: string;
    displayName?: string;
    description?: string;
    inputTokenLimit?: number;
    outputTokenLimit?: number;
    supportedGenerationMethods?: string[];
  }>;
  nextPageToken?: string;
};

function supportsGenerateContent(methods?: string[]) {
  return (methods ?? []).some((method) => method.toLowerCase() === "generatecontent");
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

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Bạn chưa đăng nhập." }, { status: 401 });
  }

  const apiKey = request.headers.get("x-gemini-api-key")?.trim();
  if (!apiKey) {
    return errorResponse(400, "Thiếu Gemini API Key.");
  }

  try {
    let pageToken = "";
    const collected: NonNullable<GeminiModelResponse["models"]> = [];

    do {
      const url = new URL("https://generativelanguage.googleapis.com/v1beta/models");
      url.searchParams.set("pageSize", "1000");
      if (pageToken) {
        url.searchParams.set("pageToken", pageToken);
      }

      const response = await fetch(url, {
        headers: {
          "x-goog-api-key": apiKey,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        const error = new Error(errorText || "GEMINI_MODELS_REQUEST_FAILED");
        (error as Error & { status?: number }).status = response.status;
        throw error;
      }

      const payload = (await response.json()) as GeminiModelResponse;
      collected.push(...(payload.models ?? []));
      pageToken = payload.nextPageToken ?? "";
    } while (pageToken);

    const models = collected
      .filter((model) => {
        const modelId = model.baseModelId ?? model.name?.replace(/^models\//, "") ?? "";
        return modelId.startsWith("gemini") && supportsGenerateContent(model.supportedGenerationMethods);
      })
      .map((model) => ({
        id: model.baseModelId ?? model.name?.replace(/^models\//, "") ?? "",
        displayName: model.displayName ?? model.baseModelId ?? model.name?.replace(/^models\//, "") ?? "Gemini",
        description: model.description ?? "",
        inputTokenLimit: model.inputTokenLimit ?? 0,
        outputTokenLimit: model.outputTokenLimit ?? 0,
      }))
      .filter((model) => Boolean(model.id))
      .sort((left, right) => left.displayName.localeCompare(right.displayName, "vi"));

    return NextResponse.json({ models });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const detail = formatGeminiErrorDetail(message);
    const status =
      typeof error === "object" && error && "status" in error ? Number((error as { status?: number }).status) : 0;

    if (status === 429 || message.includes("TooManyRequests") || message.includes("Too Many Requests")) {
      if (isNoFreeTierQuotaError(message)) {
        return errorResponse(429, "Project/API key hiện không có free-tier quota cho model Gemini đang chọn.", detail);
      }

      return errorResponse(429, "Gemini đã hết token hoặc vượt quota.", detail);
    }

    if (message.includes("API_KEY") || message.includes("API key") || message.includes("x-goog-api-key")) {
      return errorResponse(400, "Gemini API Key không hợp lệ.", detail);
    }

    if (message.includes("503") || message.includes("ServiceUnavailable") || message.includes("SERVICE_UNAVAILABLE")) {
      return errorResponse(503, "Gemini đang tạm thời không khả dụng.", detail);
    }

    return errorResponse(400, "Không thể tải danh sách model từ Gemini.", detail);
  }
}
