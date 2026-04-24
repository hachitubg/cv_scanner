"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, RefreshCcw, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { ParsedCVResult, ProjectOption, WorkspaceMemberOption, WorkspaceRoleType } from "@/types";

const GEMINI_KEY_STORAGE = "cv_scanner_gemini_api_key";
const GEMINI_MODEL_STORAGE = "cv_scanner_gemini_model";

type GeminiModelOption = {
  id: string;
  displayName: string;
  description: string;
  inputTokenLimit: number;
  outputTokenLimit: number;
};

const EMPTY_FORM = {
  fullName: "",
  email: "",
  phone: "",
  dateOfBirth: "",
  address: "",
  hometown: "",
  school: "",
  graduationYear: "",
  yearsOfExperience: "",
  summary: "",
  position: "",
  source: "",
  offerSalary: "",
  notes: "",
  interviewFeedback: "",
  skills: "",
  hrId: "",
  projectId: "",
  status: "NEW",
};

function maskApiKey(value: string) {
  if (value.length <= 8) return "••••••••";
  return `${value.slice(0, 4)}••••${value.slice(-4)}`;
}

function formatTokenLimit(value: number) {
  if (!value) return "N/A";
  return new Intl.NumberFormat("vi-VN").format(value);
}

export function UploadCandidateForm({
  workspaceId,
  currentUserId,
  membershipRole,
  members,
  projects,
}: {
  workspaceId: string;
  currentUserId: string;
  membershipRole: WorkspaceRoleType;
  members: WorkspaceMemberOption[];
  projects: ProjectOption[];
}) {
  const router = useRouter();
  const assignableMembers = useMemo(() => {
    const hrMembers = members.filter((member) => member.role !== "MANAGER");
    if (membershipRole === "HR") {
      return hrMembers.filter((member) => member.id === currentUserId);
    }
    return hrMembers;
  }, [currentUserId, members, membershipRole]);
  const [file, setFile] = useState<File | null>(null);
  const [form, setForm] = useState({
    ...EMPTY_FORM,
    hrId: assignableMembers[0]?.id ?? "",
  });
  const [geminiApiKey, setGeminiApiKey] = useState("");
  const [geminiApiKeyDraft, setGeminiApiKeyDraft] = useState("");
  const [geminiModel, setGeminiModel] = useState("");
  const [geminiModelDraft, setGeminiModelDraft] = useState("");
  const [geminiModels, setGeminiModels] = useState<GeminiModelOption[]>([]);
  const [modelsError, setModelsError] = useState<string | null>(null);
  const [isGeminiModalOpen, setIsGeminiModalOpen] = useState(false);
  const [shouldRunAiScanAfterSave, setShouldRunAiScanAfterSave] = useState(false);
  const [scanMessage, setScanMessage] = useState<string | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isScanning, startScan] = useTransition();
  const [isSaving, startSave] = useTransition();
  const [isLoadingModels, startLoadModels] = useTransition();

  useEffect(() => {
    const storedGeminiApiKey = window.localStorage.getItem(GEMINI_KEY_STORAGE) ?? "";
    const storedGeminiModel = window.localStorage.getItem(GEMINI_MODEL_STORAGE) ?? "";
    const timer = window.setTimeout(() => {
      setGeminiApiKey(storedGeminiApiKey);
      setGeminiApiKeyDraft(storedGeminiApiKey);
      setGeminiModel(storedGeminiModel);
      setGeminiModelDraft(storedGeminiModel);
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  const hasScannedData = useMemo(() => {
    return Boolean(form.fullName || form.email || form.phone || form.position || form.summary || form.notes);
  }, [form]);

  const selectedGeminiModel = useMemo(
    () => geminiModels.find((item) => item.id === geminiModel) ?? geminiModels.find((item) => item.id === geminiModelDraft),
    [geminiModel, geminiModelDraft, geminiModels],
  );

  function updateField(name: string, value: string) {
    setForm((current) => ({ ...current, [name]: value }));
  }

  function applyParsedResult(data: ParsedCVResult) {
    setForm((current) => ({
      ...current,
      fullName: data.fullName ?? current.fullName,
      email: data.email ?? current.email,
      phone: data.phone ?? current.phone,
      dateOfBirth: data.dateOfBirth ?? current.dateOfBirth,
      address: data.address ?? current.address,
      hometown: data.hometown ?? current.hometown,
      school: data.school ?? current.school,
      graduationYear: data.graduationYear ?? current.graduationYear,
      yearsOfExperience:
        data.yearsOfExperience !== undefined ? String(data.yearsOfExperience) : current.yearsOfExperience,
      position: data.position ?? current.position,
      summary: data.summary ?? current.summary,
      skills: data.skills?.join(", ") ?? current.skills,
      notes: data.notes ?? current.notes,
    }));
  }

  function loadGeminiModels(apiKey: string, preferredModelId?: string) {
    const trimmedKey = apiKey.trim();
    if (!trimmedKey) {
      setModelsError("Vui lòng nhập Gemini API Key trước khi tải model.");
      return;
    }

    setModelsError(null);

    startLoadModels(async () => {
      const response = await fetch("/api/gemini/models", {
        headers: {
          "x-gemini-api-key": trimmedKey,
        },
      });

      const data = (await response.json()) as { error?: string; models?: GeminiModelOption[] };

      if (!response.ok || !data.models?.length) {
        setGeminiModels([]);
        setModelsError(data.error || "Không thể tải danh sách model từ Gemini.");
        return;
      }

      setGeminiModels(data.models);

      const matchedModel =
        data.models.find((item) => item.id === preferredModelId) ??
        data.models.find((item) => item.id === geminiModel) ??
        data.models[0];

      if (matchedModel) {
        setGeminiModelDraft(matchedModel.id);
      }
    });
  }

  function openGeminiModal(runAiAfterSave = false) {
    setShouldRunAiScanAfterSave(runAiAfterSave);
    setGeminiApiKeyDraft(geminiApiKey);
    setGeminiModelDraft(geminiModel);
    setIsGeminiModalOpen(true);

    if (geminiApiKey.trim()) {
      loadGeminiModels(geminiApiKey, geminiModel);
    }
  }

  function performScan(mode: "basic" | "ai", options?: { apiKey?: string; model?: string }) {
    if (!file) {
      setScanError("Hãy chọn file CV trước khi scan.");
      return;
    }

    setScanError(null);
    setScanMessage(null);

    startScan(async () => {
      const body = new FormData();
      body.append("file", file);
      body.append("scanMode", mode);
      if (mode === "ai" && options?.model) {
        body.append("geminiModel", options.model);
      }

      const response = await fetch("/api/scan", {
        method: "POST",
        headers: mode === "ai" && options?.apiKey ? { "x-gemini-api-key": options.apiKey } : undefined,
        body,
      });

      const data = (await response.json()) as ParsedCVResult & { error?: string };

      if (!response.ok) {
        setScanError(data.error || "Không thể scan CV.");
        return;
      }

      applyParsedResult(data);
      setScanMessage(
        mode === "ai"
          ? `AI Scan bằng Gemini đã hoàn tất${options?.model ? ` với model ${options.model}` : ""}.`
          : "Đã scan CV bằng bộ parser mặc định.",
      );
    });
  }

  function handleAiScan() {
    if (!file) {
      setScanError("Hãy chọn file CV trước khi AI Scan.");
      return;
    }

    if (!geminiApiKey.trim() || !geminiModel.trim()) {
      openGeminiModal(true);
      return;
    }

    performScan("ai", { apiKey: geminiApiKey, model: geminiModel });
  }

  function handleSaveGeminiConfig() {
    const trimmedKey = geminiApiKeyDraft.trim();
    const trimmedModel = geminiModelDraft.trim();

    if (!trimmedKey) {
      setModelsError("Vui lòng nhập Gemini API Key.");
      return;
    }

    if (!trimmedModel) {
      setModelsError("Vui lòng chọn model Gemini.");
      return;
    }

    window.localStorage.setItem(GEMINI_KEY_STORAGE, trimmedKey);
    window.localStorage.setItem(GEMINI_MODEL_STORAGE, trimmedModel);
    setGeminiApiKey(trimmedKey);
    setGeminiModel(trimmedModel);
    setIsGeminiModalOpen(false);
    setModelsError(null);
    setScanError(null);

    if (shouldRunAiScanAfterSave) {
      setShouldRunAiScanAfterSave(false);
      performScan("ai", { apiKey: trimmedKey, model: trimmedModel });
    }
  }

  function handleSubmit() {
    setSubmitError(null);

    if (!file) {
      setSubmitError("Vui lòng chọn file CV.");
      return;
    }

    startSave(async () => {
      const body = new FormData();
      body.append("workspaceId", workspaceId);
      body.append("file", file);

      Object.entries(form).forEach(([key, value]) => {
        body.append(key, value);
      });

      const response = await fetch("/api/candidates", {
        method: "POST",
        body,
      });

      const data = (await response.json()) as { id?: string; error?: string };

      if (!response.ok || !data.id) {
        setSubmitError(data.error || "Không thể lưu hồ sơ ứng viên.");
        return;
      }

      router.push(`/workspace/${workspaceId}/candidates/${data.id}`);
      router.refresh();
    });
  }

  return (
    <>
      <div className="grid gap-8 xl:grid-cols-[0.95fr_1.05fr]">
        <div className="space-y-6">
          <div className="bubbly-card border-dashed p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-sm font-black uppercase tracking-[0.18em] text-primary">Bước 1</p>
                <h3 className="mt-3 text-2xl font-black text-on-surface">Tải lên CV</h3>
                <p className="mt-2 text-sm font-medium text-on-surface-variant">
                  Hỗ trợ PDF, DOCX, TXT và ảnh PNG/JPG/JPEG/WEBP. OCR được dùng cho file ảnh và PDF scan không có text
                  layer.
                </p>
              </div>

              <button
                type="button"
                onClick={() => openGeminiModal(false)}
                className="inline-flex items-center gap-2 rounded-full border border-primary/15 bg-white px-4 py-2 text-sm font-bold text-primary shadow-sm transition hover:bg-primary/5"
              >
                <KeyRound className="size-4" />
                Gemini Config
              </button>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-[1.4rem] bg-surface-container-low px-4 py-3">
                <p className="text-[11px] font-black uppercase tracking-[0.16em] text-outline">Gemini API Key</p>
                <p className="mt-2 text-sm font-semibold text-on-surface">
                  {geminiApiKey ? `Đã cấu hình: ${maskApiKey(geminiApiKey)}` : "Chưa cấu hình API Key"}
                </p>
              </div>
              <div className="rounded-[1.4rem] bg-surface-container-low px-4 py-3">
                <p className="text-[11px] font-black uppercase tracking-[0.16em] text-outline">Model đang chọn</p>
                <p className="mt-2 text-sm font-semibold text-on-surface">
                  {selectedGeminiModel?.displayName || geminiModel || "Chưa chọn model"}
                </p>
              </div>
            </div>

            <label className="mt-6 block cursor-pointer rounded-[2rem] border-2 border-dashed border-primary-container bg-surface-container-low px-6 py-10 text-center">
              <input
                type="file"
                accept=".pdf,.docx,.txt,.png,.jpg,.jpeg,.webp"
                className="hidden"
                onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              />
              <p className="text-lg font-black text-on-surface">{file?.name || "Chọn file từ máy"}</p>
              <p className="mt-2 text-sm font-medium text-on-surface-variant">
                {file ? `${Math.round(file.size / 1024)} KB` : "Kéo thả hoặc click để chọn"}
              </p>
            </label>

            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              <Button className="w-full" onClick={() => performScan("basic")} disabled={isScanning}>
                {isScanning ? "Đang scan..." : "Scan CV"}
              </Button>
              <Button variant="secondary" className="w-full gap-2" onClick={handleAiScan} disabled={isScanning}>
                <Sparkles className="size-4" />
                {isScanning ? "Đang AI Scan..." : "AI Scan"}
              </Button>
              <Button variant="ghost" className="w-full" onClick={handleSubmit} disabled={isSaving}>
                {isSaving ? "Đang lưu..." : "Lưu hồ sơ"}
              </Button>
            </div>

            {scanMessage ? <p className="mt-4 text-sm font-semibold text-emerald-700">{scanMessage}</p> : null}
            {scanError ? <p className="mt-2 text-sm font-semibold text-rose-600">{scanError}</p> : null}
            {submitError ? <p className="mt-2 text-sm font-semibold text-rose-600">{submitError}</p> : null}
          </div>

          <div className="soft-panel">
            <p className="text-sm font-black uppercase tracking-[0.18em] text-secondary">Bước 2</p>
            <h3 className="mt-3 text-xl font-black text-on-surface">Kết quả scan</h3>
            <p className="mt-2 text-sm font-medium text-on-surface-variant">
              {hasScannedData
                ? "Hệ thống đã điền sẵn một phần thông tin. Bạn có thể kiểm tra và chỉnh lại trước khi lưu."
                : "Sau khi scan CV, thông tin tự động sẽ xuất hiện ở form bên phải."}
            </p>
          </div>
        </div>

        <div className="bubbly-card p-6">
          <div className="grid gap-5 md:grid-cols-2">
            <div>
              <label className="label">Họ và tên</label>
              <Input value={form.fullName} onChange={(e) => updateField("fullName", e.target.value)} />
            </div>
            <div>
              <label className="label">Email</label>
              <Input value={form.email} onChange={(e) => updateField("email", e.target.value)} />
            </div>
            <div>
              <label className="label">Số điện thoại</label>
              <Input value={form.phone} onChange={(e) => updateField("phone", e.target.value)} />
            </div>
            <div>
              <label className="label">Ngày sinh / Năm sinh</label>
              <Input value={form.dateOfBirth} onChange={(e) => updateField("dateOfBirth", e.target.value)} />
            </div>
            <div>
              <label className="label">Trường học</label>
              <Input value={form.school} onChange={(e) => updateField("school", e.target.value)} />
            </div>
            <div>
              <label className="label">Năm tốt nghiệp</label>
              <Input value={form.graduationYear} onChange={(e) => updateField("graduationYear", e.target.value)} />
            </div>
            <div>
              <label className="label">Số năm kinh nghiệm</label>
              <Input value={form.yearsOfExperience} onChange={(e) => updateField("yearsOfExperience", e.target.value)} />
            </div>
            <div>
              <label className="label">Quê quán</label>
              <Input value={form.hometown} onChange={(e) => updateField("hometown", e.target.value)} />
            </div>
          </div>

          <div className="mt-5">
            <label className="label">Địa chỉ</label>
            <Input value={form.address} onChange={(e) => updateField("address", e.target.value)} />
          </div>

          <div className="mt-5 grid gap-5 md:grid-cols-2">
            <div>
              <label className="label">Vị trí ứng tuyển</label>
              <Input value={form.position} onChange={(e) => updateField("position", e.target.value)} />
            </div>
            <div>
              <label className="label">Nguồn</label>
              <Input value={form.source} onChange={(e) => updateField("source", e.target.value)} />
            </div>
            <div>
              <label className="label">Dự án tuyển dụng</label>
              <select className="field" value={form.projectId} onChange={(e) => updateField("projectId", e.target.value)}>
                <option value="">Chưa gắn dự án</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">HR phụ trách</label>
              <select
                className="field"
                value={form.hrId}
                onChange={(e) => updateField("hrId", e.target.value)}
                disabled={membershipRole === "HR"}
              >
                {assignableMembers.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Mức offer dự kiến</label>
              <Input value={form.offerSalary} onChange={(e) => updateField("offerSalary", e.target.value)} />
            </div>
          </div>

          <div className="mt-5">
            <label className="label">Kỹ năng chính</label>
            <Input
              value={form.skills}
              onChange={(e) => updateField("skills", e.target.value)}
              placeholder="React, Next.js, TypeScript"
            />
          </div>

          <div className="mt-5">
            <label className="label">Tóm tắt ứng viên</label>
            <Textarea rows={4} value={form.summary} onChange={(e) => updateField("summary", e.target.value)} />
          </div>

          <div className="mt-5">
            <label className="label">Ghi chú nội bộ / gợi ý scan</label>
            <Textarea rows={4} value={form.notes} onChange={(e) => updateField("notes", e.target.value)} />
          </div>
        </div>
      </div>

      {isGeminiModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 px-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-[2rem] border border-white/70 bg-white p-6 shadow-[0_28px_70px_rgba(15,23,42,0.22)]">
            <div className="flex items-start gap-3">
              <div className="rounded-[1.2rem] bg-primary/10 p-3 text-primary">
                <KeyRound className="size-5" />
              </div>
              <div>
                <p className="text-sm font-black uppercase tracking-[0.18em] text-primary">Gemini Config</p>
                <h3 className="mt-2 text-2xl font-black text-on-surface">Cấu hình AI Scan</h3>
                <p className="mt-2 text-sm font-medium leading-7 text-on-surface-variant">
                  Danh sách model được tải động từ Gemini API theo API key hiện tại. Khi Google thêm model mới, popup
                  này sẽ tự lấy được mà không cần hardcode lại.
                </p>
              </div>
            </div>

            <div className="mt-5">
              <label className="label">Gemini API Key</label>
              <Input
                type="password"
                value={geminiApiKeyDraft}
                onChange={(e) => setGeminiApiKeyDraft(e.target.value)}
                placeholder="Nhập Gemini API Key"
              />
            </div>

            <div className="mt-5">
              <div className="flex items-center justify-between gap-3">
                <label className="label mb-0">Gemini Model</label>
                <button
                  type="button"
                  onClick={() => loadGeminiModels(geminiApiKeyDraft, geminiModelDraft)}
                  className="inline-flex items-center gap-2 text-sm font-bold text-primary transition hover:opacity-80"
                >
                  <RefreshCcw className={cn("size-4", isLoadingModels && "animate-spin")} />
                  Tải model
                </button>
              </div>

              <select
                className="field"
                value={geminiModelDraft}
                onChange={(e) => setGeminiModelDraft(e.target.value)}
                disabled={isLoadingModels || !geminiModels.length}
              >
                <option value="">
                  {isLoadingModels ? "Đang tải model..." : geminiModels.length ? "Chọn model Gemini" : "Chưa có model"}
                </option>
                {geminiModels.map((model) => (
                  <option key={model.id} value={model.id}>
                    {model.displayName} ({model.id})
                  </option>
                ))}
              </select>

              {selectedGeminiModel ? (
                <div className="mt-3 rounded-[1.4rem] bg-surface-container-low p-4">
                  <p className="text-sm font-black text-on-surface">{selectedGeminiModel.displayName}</p>
                  <p className="mt-2 text-sm leading-6 text-on-surface-variant">
                    {selectedGeminiModel.description || "Model hỗ trợ generateContent cho AI Scan CV."}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-3 text-xs font-bold text-on-surface-variant">
                    <span>Input: {formatTokenLimit(selectedGeminiModel.inputTokenLimit)} tokens</span>
                    <span>Output: {formatTokenLimit(selectedGeminiModel.outputTokenLimit)} tokens</span>
                  </div>
                </div>
              ) : null}

              {modelsError ? <p className="mt-3 text-sm font-semibold text-rose-600">{modelsError}</p> : null}
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <Button onClick={handleSaveGeminiConfig}>Lưu cấu hình</Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setIsGeminiModalOpen(false);
                  setShouldRunAiScanAfterSave(false);
                }}
              >
                Đóng
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
