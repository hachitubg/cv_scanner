"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { History, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  candidateStatusMeta,
  formatDateTime,
  managerDecisionMeta,
  managerFinalStatusMeta,
  parseSkills,
  toDateTimeLocalValue,
} from "@/lib/utils";
import {
  CANDIDATE_STATUSES,
  MANAGER_DECISIONS,
  MANAGER_FINAL_STATUSES,
  type ManagerDecisionType,
  type ManagerFinalStatusType,
  type ProjectOption,
  type WorkspaceMemberOption,
  type WorkspaceRoleType,
} from "@/types";

type CandidateDetailFormProps = {
  workspaceId: string;
  currentUserId: string;
  membershipRole: WorkspaceRoleType;
  candidate: {
    id: string;
    fullName: string | null;
    email: string | null;
    phone: string | null;
    dateOfBirth: string | null;
    address: string | null;
    hometown: string | null;
    school: string | null;
    graduationYear: string | null;
    yearsOfExperience: number | null;
    skillsJson: string | null;
    summary: string | null;
    position: string | null;
    source: string | null;
    offerSalary: string | null;
    notes: string | null;
    interviewDate: string | null;
    interviewerName: string | null;
    interviewFeedback: string | null;
    managerDecision: string | null;
    managerOfferSalary: string | null;
    managerReviewNote: string | null;
    managerReviewedAt: Date | string | null;
    managerReviewedBy: { name: string } | null;
    status: string;
    hrId: string;
    projectId: string | null;
    project: { id: string; name: string } | null;
    cvFile: { fileName: string; filePath: string | null } | null;
    statusHistory: {
      id: string;
      fromStatus: string | null;
      toStatus: string;
      note: string | null;
      changedAt: Date;
      changedByUser: { name: string };
    }[];
  };
  members: WorkspaceMemberOption[];
  projects: ProjectOption[];
  canDelete: boolean;
  canEditCandidateData: boolean;
  canReviewCandidate: boolean;
};

function needsInterviewDetails(status: string) {
  return status === "INTERVIEW" || status === "INTERVIEWED";
}

export function CandidateDetailForm({
  workspaceId,
  candidate,
  members,
  projects,
  canDelete,
  canEditCandidateData,
  canReviewCandidate,
}: CandidateDetailFormProps) {
  const router = useRouter();
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [form, setForm] = useState({
    fullName: candidate.fullName ?? "",
    email: candidate.email ?? "",
    phone: candidate.phone ?? "",
    dateOfBirth: candidate.dateOfBirth ?? "",
    address: candidate.address ?? "",
    hometown: candidate.hometown ?? "",
    school: candidate.school ?? "",
    graduationYear: candidate.graduationYear ?? "",
    yearsOfExperience: candidate.yearsOfExperience?.toString() ?? "",
    skills: parseSkills(candidate.skillsJson).join(", "),
    summary: candidate.summary ?? "",
    position: candidate.position ?? "",
    source: candidate.source ?? "",
    offerSalary: candidate.offerSalary ?? "",
    notes: candidate.notes ?? "",
    interviewDate: toDateTimeLocalValue(candidate.interviewDate),
    interviewerName: candidate.interviewerName ?? "",
    interviewFeedback: candidate.interviewFeedback ?? "",
    hrId: candidate.hrId,
    projectId: candidate.projectId ?? "",
    status: candidate.status,
    statusNote: "",
    managerDecision: (candidate.managerDecision as ManagerDecisionType) || "PENDING",
    managerOfferSalary: candidate.managerOfferSalary ?? "",
    managerReviewNote: candidate.managerReviewNote ?? "",
    managerFinalStatus: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const statusLabel = useMemo(
    () => candidateStatusMeta[(form.status as keyof typeof candidateStatusMeta) || "NEW"],
    [form.status],
  );

  const reviewMeta = useMemo(
    () => managerDecisionMeta[(form.managerDecision as ManagerDecisionType) || "PENDING"],
    [form.managerDecision],
  );

  function updateField(name: string, value: string) {
    setForm((current) => ({ ...current, [name]: value }));
  }

  function saveGeneral() {
    setError(null);

    if (!canEditCandidateData) return;

    if (needsInterviewDetails(form.status) && (!form.interviewDate.trim() || !form.interviewerName.trim())) {
      setError("Khi chuyển sang trạng thái phỏng vấn, cần nhập ngày phỏng vấn và người phỏng vấn.");
      return;
    }

    startTransition(async () => {
      const response = await fetch(`/api/candidates/${candidate.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: form.fullName,
          email: form.email,
          phone: form.phone,
          dateOfBirth: form.dateOfBirth,
          address: form.address,
          hometown: form.hometown,
          school: form.school,
          graduationYear: form.graduationYear,
          summary: form.summary,
          position: form.position,
          source: form.source,
          offerSalary: form.offerSalary,
          notes: form.notes,
          interviewFeedback: form.interviewFeedback,
          hrId: form.hrId,
          projectId: form.projectId || null,
          status: form.status,
          statusNote: form.statusNote,
          interviewDate: form.interviewDate ? new Date(form.interviewDate).toISOString() : "",
          interviewerName: form.interviewerName.trim(),
          skills: form.skills
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean),
          yearsOfExperience: form.yearsOfExperience ? Number(form.yearsOfExperience) : null,
        }),
      });

      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(data.error || "Không thể cập nhật ứng viên.");
        return;
      }

      router.refresh();
    });
  }

  function saveManagerReview() {
    setError(null);

    if (!canReviewCandidate) return;

    startTransition(async () => {
      const response = await fetch(`/api/candidates/${candidate.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          managerDecision: form.managerDecision,
          managerOfferSalary: form.managerOfferSalary,
          managerReviewNote: form.managerReviewNote,
          status: form.managerFinalStatus || undefined,
          statusNote: form.managerFinalStatus ? "Quản lý chốt trên màn hình chi tiết" : undefined,
        }),
      });

      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(data.error || "Không thể lưu đánh giá tuyển dụng.");
        return;
      }

      router.refresh();
    });
  }

  function remove() {
    if (!window.confirm("Xóa ứng viên này?")) return;

    startTransition(async () => {
      const response = await fetch(`/api/candidates/${candidate.id}`, {
        method: "DELETE",
      });

      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(data.error || "Không thể xóa ứng viên.");
        return;
      }

      router.push(`/workspace/${workspaceId}/candidates`);
      router.refresh();
    });
  }

  const fieldsDisabled = !canEditCandidateData;
  const latestHistory = candidate.statusHistory[0] ?? null;

  return (
    <>
      <div className="grid gap-8 xl:grid-cols-[1.08fr_0.92fr]">
        <div className="space-y-6">
          <div className="bubbly-card p-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-sm font-black uppercase tracking-[0.18em] text-primary">Thông tin ứng viên</p>
                <h2 className="mt-2 text-3xl font-black text-on-surface">{form.fullName || "Chưa đặt tên"}</h2>
                <p className="mt-2 text-sm font-medium text-on-surface-variant">
                  {form.position || "Chưa có vị trí ứng tuyển"}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge className={statusLabel.className}>{statusLabel.label}</Badge>
                <Badge className={reviewMeta.className}>{reviewMeta.label}</Badge>
              </div>
            </div>

            <div className="mt-6 grid gap-5 md:grid-cols-2">
              <FormInput label="Email" value={form.email} onChange={(value) => updateField("email", value)} disabled={fieldsDisabled} />
              <FormInput label="Số điện thoại" value={form.phone} onChange={(value) => updateField("phone", value)} disabled={fieldsDisabled} />
              <FormInput label="Ngày sinh / Năm sinh" value={form.dateOfBirth} onChange={(value) => updateField("dateOfBirth", value)} disabled={fieldsDisabled} />
              <FormInput
                label="Số năm kinh nghiệm"
                value={form.yearsOfExperience}
                onChange={(value) => updateField("yearsOfExperience", value)}
                disabled={fieldsDisabled}
              />
              <FormInput label="Trường học" value={form.school} onChange={(value) => updateField("school", value)} disabled={fieldsDisabled} />
              <FormInput
                label="Năm tốt nghiệp"
                value={form.graduationYear}
                onChange={(value) => updateField("graduationYear", value)}
                disabled={fieldsDisabled}
              />
            </div>

            <div className="mt-5">
              <label className="label">Địa chỉ</label>
              <Input value={form.address} onChange={(e) => updateField("address", e.target.value)} disabled={fieldsDisabled} />
            </div>

            <div className="mt-5">
              <label className="label">Quê quán</label>
              <Input value={form.hometown} onChange={(e) => updateField("hometown", e.target.value)} disabled={fieldsDisabled} />
            </div>

            <div className="mt-5 grid gap-5 md:grid-cols-2">
              <FormInput label="Vị trí ứng tuyển" value={form.position} onChange={(value) => updateField("position", value)} disabled={fieldsDisabled} />
              <FormInput label="Nguồn" value={form.source} onChange={(value) => updateField("source", value)} disabled={fieldsDisabled} />
              <FormInput
                label="Mức offer nội bộ"
                value={form.offerSalary}
                onChange={(value) => updateField("offerSalary", value)}
                disabled={fieldsDisabled}
              />
              <div>
                <label className="label">Dự án</label>
                <select
                  className="field"
                  value={form.projectId}
                  onChange={(e) => updateField("projectId", e.target.value)}
                  disabled={fieldsDisabled}
                >
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
                <select className="field" value={form.hrId} onChange={(e) => updateField("hrId", e.target.value)} disabled={fieldsDisabled}>
                  {members.map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-5">
              <label className="label">Kỹ năng chính</label>
              <Input value={form.skills} onChange={(e) => updateField("skills", e.target.value)} disabled={fieldsDisabled} />
            </div>

            <div className="mt-5">
              <label className="label">Tóm tắt ứng viên</label>
              <Textarea rows={4} value={form.summary} onChange={(e) => updateField("summary", e.target.value)} disabled={fieldsDisabled} />
            </div>

            <div className="mt-5">
              <label className="label">Ghi chú nội bộ</label>
              <Textarea rows={4} value={form.notes} onChange={(e) => updateField("notes", e.target.value)} disabled={fieldsDisabled} />
            </div>

            {error ? <p className="mt-4 text-sm font-semibold text-rose-600">{error}</p> : null}

            <div className="mt-6 flex flex-wrap gap-3">
              {canEditCandidateData ? (
                <Button onClick={saveGeneral} disabled={isPending}>
                  {isPending ? "Đang lưu..." : "Lưu cập nhật"}
                </Button>
              ) : null}
              {canDelete ? (
                <Button variant="danger" onClick={remove} disabled={isPending}>
                  Xóa ứng viên
                </Button>
              ) : null}
              {candidate.cvFile?.filePath ? (
                <Link
                  href={candidate.cvFile.filePath}
                  target="_blank"
                  className="inline-flex h-12 items-center justify-center rounded-full border border-white/80 bg-surface-container-low px-6 text-sm font-extrabold text-on-surface shadow-sm transition hover:bg-white hover:shadow-[0_10px_22px_rgba(15,23,42,0.08)]"
                >
                  Xem file CV
                </Link>
              ) : null}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          {canEditCandidateData ? (
            <div className="bubbly-card p-6">
              <p className="text-sm font-black uppercase tracking-[0.18em] text-secondary">Pipeline</p>
              <div className="mt-4">
                <label className="label">Trạng thái hiện tại</label>
                <select className="field" value={form.status} onChange={(e) => updateField("status", e.target.value)}>
                  {CANDIDATE_STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {candidateStatusMeta[status].label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="mt-5 grid gap-5 md:grid-cols-2">
                <div>
                  <label className="label">Ngày phỏng vấn</label>
                  <Input
                    type="datetime-local"
                    value={form.interviewDate}
                    onChange={(e) => updateField("interviewDate", e.target.value)}
                  />
                </div>
                <div>
                  <label className="label">Người phỏng vấn</label>
                  <Input
                    value={form.interviewerName}
                    onChange={(e) => updateField("interviewerName", e.target.value)}
                    placeholder="Ví dụ: Anh Minh, Chị Thảo"
                  />
                </div>
              </div>

              {needsInterviewDetails(form.status) ? (
                <p className="mt-3 text-sm font-semibold text-primary">
                  Trạng thái này yêu cầu nhập đủ ngày phỏng vấn và người phỏng vấn.
                </p>
              ) : null}

              <div className="mt-5">
                <label className="label">Nhận xét phỏng vấn</label>
                <Textarea
                  rows={4}
                  value={form.interviewFeedback}
                  onChange={(e) => updateField("interviewFeedback", e.target.value)}
                />
              </div>

              <div className="mt-5">
                <label className="label">Ghi chú khi đổi trạng thái</label>
                <Textarea
                  rows={3}
                  value={form.statusNote}
                  onChange={(e) => updateField("statusNote", e.target.value)}
                  placeholder="Ví dụ: đã phỏng vấn xong, chờ feedback từ manager"
                />
              </div>
            </div>
          ) : null}

          <div className="bubbly-card p-6">
            <p className="text-sm font-black uppercase tracking-[0.18em] text-primary">Đánh giá của quản lý</p>
            {canReviewCandidate ? (
              <>
                <div className="mt-4">
                  <label className="label">Quyết định duyệt</label>
                  <select className="field" value={form.managerDecision} onChange={(e) => updateField("managerDecision", e.target.value)}>
                    {MANAGER_DECISIONS.map((decision) => (
                      <option key={decision} value={decision}>
                        {managerDecisionMeta[decision].label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="mt-5">
                  <label className="label">Offer manager đề xuất</label>
                  <Input
                    value={form.managerOfferSalary}
                    onChange={(e) => updateField("managerOfferSalary", e.target.value)}
                    placeholder="Ví dụ: 25.000.000 VND"
                  />
                </div>

                <div className="mt-5">
                  <label className="label">Nhận xét duyệt tuyển</label>
                  <Textarea
                    rows={4}
                    value={form.managerReviewNote}
                    onChange={(e) => updateField("managerReviewNote", e.target.value)}
                    placeholder="Ví dụ: phù hợp dự án ABC, có thể đi tiếp offer"
                  />
                </div>

                <div className="mt-5">
                  <label className="label">Chốt trạng thái cuối</label>
                  <select
                    className="field"
                    value={form.managerFinalStatus}
                    onChange={(e) => updateField("managerFinalStatus", e.target.value)}
                  >
                    <option value="">Không đổi trạng thái</option>
                    {MANAGER_FINAL_STATUSES.map((status) => (
                      <option key={status} value={status}>
                        {managerFinalStatusMeta[status].label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="mt-5">
                  <Button onClick={saveManagerReview} disabled={isPending}>
                    {isPending ? "Đang lưu..." : "Lưu đánh giá tuyển dụng"}
                  </Button>
                </div>
              </>
            ) : (
              <>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <SummaryCard label="Quyết định" value={reviewMeta.label} />
                  <SummaryCard label="Offer đề xuất" value={candidate.managerOfferSalary || "Chưa có"} />
                </div>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <SummaryCard
                    label="Lần duyệt gần nhất"
                    value={candidate.managerReviewedAt ? formatDateTime(candidate.managerReviewedAt) : "Chưa có"}
                  />
                  <SummaryCard label="Người duyệt" value={candidate.managerReviewedBy?.name || "Chưa có"} />
                </div>
                {candidate.managerReviewNote ? (
                  <p className="mt-4 text-sm font-medium leading-7 text-on-surface-variant">{candidate.managerReviewNote}</p>
                ) : null}
              </>
            )}
          </div>

          <div className="bubbly-card p-6">
            <p className="text-sm font-black uppercase tracking-[0.18em] text-tertiary">Lịch sử thay đổi</p>
            <div className="mt-5 rounded-[1.5rem] bg-surface-container-low p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-black text-on-surface">Xem lịch sử trong popup</p>
                  <p className="mt-2 text-sm font-medium leading-6 text-on-surface-variant">
                    Mở popup để xem đầy đủ các lần đổi trạng thái, thời gian cập nhật và ghi chú nội bộ.
                  </p>
                </div>
                <Button variant="ghost" onClick={() => setIsHistoryOpen(true)}>
                  <History className="mr-2 size-4" />
                  Mở lịch sử
                </Button>
              </div>

              {latestHistory ? (
                <div className="mt-4 rounded-[1.35rem] border border-white/75 bg-white/80 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge className={candidateStatusMeta[latestHistory.toStatus as keyof typeof candidateStatusMeta].className}>
                      {candidateStatusMeta[latestHistory.toStatus as keyof typeof candidateStatusMeta].label}
                    </Badge>
                    <span className="text-xs font-bold text-on-surface-variant">
                      {candidate.statusHistory.length} lần thay đổi
                    </span>
                  </div>
                  <p className="mt-3 text-sm font-semibold text-on-surface">
                    {latestHistory.changedByUser.name} • {formatDateTime(latestHistory.changedAt)}
                  </p>
                  {latestHistory.note ? (
                    <p className="mt-2 text-sm font-medium leading-6 text-on-surface-variant">{latestHistory.note}</p>
                  ) : null}
                </div>
              ) : (
                <p className="mt-4 text-sm font-medium text-on-surface-variant">Chưa có lịch sử thay đổi.</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {isHistoryOpen ? (
        <HistoryModal entries={candidate.statusHistory} onClose={() => setIsHistoryOpen(false)} />
      ) : null}
    </>
  );
}

function FormInput({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <div>
      <label className="label">{label}</label>
      <Input value={value} onChange={(event) => onChange(event.target.value)} disabled={disabled} />
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[1.4rem] bg-surface-container-low p-4">
      <p className="text-[11px] font-black uppercase tracking-[0.16em] text-outline">{label}</p>
      <p className="mt-2 text-sm font-semibold text-on-surface">{value}</p>
    </div>
  );
}

function HistoryModal({
  entries,
  onClose,
}: {
  entries: CandidateDetailFormProps["candidate"]["statusHistory"];
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 px-4 py-8 backdrop-blur-sm">
      <div className="relative max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-[2rem] border border-white/70 bg-white p-6 shadow-[0_30px_80px_rgba(15,23,42,0.22)]">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 inline-flex size-11 items-center justify-center rounded-full bg-surface-container-low text-on-surface transition hover:bg-surface-container-high"
          aria-label="Đóng lịch sử"
        >
          <X className="size-5" />
        </button>

        <div className="pr-12">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-tertiary">Lịch sử thay đổi</p>
          <h3 className="mt-2 text-2xl font-black tracking-tight text-on-surface">
            {entries.length ? `${entries.length} lần cập nhật` : "Chưa có thay đổi"}
          </h3>
          <p className="mt-2 text-sm font-medium leading-6 text-on-surface-variant">
            Theo dõi toàn bộ các lần đổi trạng thái, thời gian cập nhật và ghi chú nội bộ của hồ sơ này.
          </p>
        </div>

        <div className="mt-6 space-y-4">
          {entries.length ? (
            entries.map((entry) => (
              <div key={entry.id} className="rounded-[1.5rem] bg-surface-container-low p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className={candidateStatusMeta[entry.toStatus as keyof typeof candidateStatusMeta].className}>
                    {candidateStatusMeta[entry.toStatus as keyof typeof candidateStatusMeta].label}
                  </Badge>
                  {entry.fromStatus ? (
                    <span className="text-xs font-bold text-on-surface-variant">
                      từ {candidateStatusMeta[entry.fromStatus as keyof typeof candidateStatusMeta].shortLabel}
                    </span>
                  ) : null}
                </div>
                <p className="mt-3 text-sm font-semibold text-on-surface">
                  {entry.changedByUser.name} • {formatDateTime(entry.changedAt)}
                </p>
                {entry.note ? (
                  <p className="mt-2 text-sm font-medium leading-6 text-on-surface-variant">{entry.note}</p>
                ) : null}
              </div>
            ))
          ) : (
            <div className="rounded-[1.5rem] bg-surface-container-low p-5 text-sm font-medium text-on-surface-variant">
              Chưa có lịch sử thay đổi cho hồ sơ này.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
