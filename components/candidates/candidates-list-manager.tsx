"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  BriefcaseBusiness,
  CalendarDays,
  CircleUserRound,
  FolderSearch,
  LayoutGrid,
  Search,
  SlidersHorizontal,
  Sparkles,
  Table2,
  UserRoundSearch,
  X,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  CANDIDATE_STATUSES,
  MANAGER_DECISIONS,
  MANAGER_FINAL_STATUSES,
  type CandidateStatusType,
  type ManagerDecisionType,
  type ManagerFinalStatusType,
  type WorkspaceRoleType,
} from "@/types";
import {
  candidateStatusMeta,
  cn,
  formatDate,
  formatDateTime,
  managerDecisionMeta,
  managerFinalStatusMeta,
  toDateTimeLocalValue,
} from "@/lib/utils";

type CandidateListItem = {
  id: string;
  fullName: string | null;
  email: string | null;
  phone: string | null;
  summary: string | null;
  position: string | null;
  source: string | null;
  expectedSalary: string | null;
  offerSalary: string | null;
  notes: string | null;
  status: string;
  createdAt: Date | string;
  interviewDate: string | null;
  interviewerName: string | null;
  projectName: string | null;
  managerDecision: string;
  managerOfferSalary: string | null;
  managerReviewNote: string | null;
  managerReviewedAt: Date | string | null;
  managerReviewedByName: string | null;
  hrId: string;
  hr: {
    name: string;
  };
};

type StatusDraftState = {
  status: CandidateStatusType;
  statusNote: string;
  interviewDate: string;
  interviewerName: string;
};

type ReviewDraftState = {
  managerDecision: ManagerDecisionType;
  managerOfferSalary: string;
  managerReviewNote: string;
  finalStatus: ManagerFinalStatusType | "";
};

type ModalState =
  | { candidateId: string; mode: "status" }
  | { candidateId: string; mode: "review" }
  | null;

type ViewMode = "table" | "cards";
type CardSortMode =
  | "newest"
  | "oldest"
  | "nameAsc"
  | "statusAsc"
  | "interviewSoonest";

type CardFilterState = {
  search: string;
  status: string;
  managerDecision: string;
  hrName: string;
  projectName: string;
  sort: CardSortMode;
};

const INTERVIEW_REQUIRED_STATUSES: CandidateStatusType[] = [
  "INTERVIEW",
  "INTERVIEWED",
];

const statusSurfaceMap: Record<CandidateStatusType, string> = {
  NEW: "bg-[linear-gradient(145deg,rgba(255,231,237,0.72),rgba(255,255,255,0.97))] border-primary/15",
  REVIEWING:
    "bg-[linear-gradient(145deg,rgba(170,237,255,0.36),rgba(255,255,255,0.97))] border-secondary/15",
  PASS_CV:
    "bg-[linear-gradient(145deg,rgba(171,239,231,0.44),rgba(255,255,255,0.97))] border-tertiary/20",
  FAIL_CV:
    "bg-[linear-gradient(145deg,rgba(255,231,237,0.58),rgba(255,255,255,0.97))] border-rose-200/70",
  INTERVIEW:
    "bg-[linear-gradient(145deg,rgba(170,237,255,0.46),rgba(255,255,255,0.97))] border-secondary/20",
  INTERVIEWED:
    "bg-[linear-gradient(145deg,rgba(241,237,238,0.88),rgba(255,255,255,0.97))] border-outline-variant/80",
  PASSED:
    "bg-[linear-gradient(145deg,rgba(171,239,231,0.5),rgba(255,255,255,0.97))] border-tertiary/25",
  INTERVIEW_FAILED:
    "bg-[linear-gradient(145deg,rgba(255,242,230,0.78),rgba(255,255,255,0.97))] border-orange-200/80",
  OFFERED:
    "bg-[linear-gradient(145deg,rgba(255,217,227,0.82),rgba(255,255,255,0.96)_52%,rgba(170,237,255,0.24))] border-primary/20",
  OFFER_DECLINED:
    "bg-[linear-gradient(145deg,rgba(255,245,216,0.82),rgba(255,255,255,0.97))] border-amber-200/80",
  ONBOARDED:
    "bg-[linear-gradient(145deg,rgba(171,239,231,0.58),rgba(255,255,255,0.98))] border-emerald-200/80",
  REJECTED:
    "bg-[linear-gradient(145deg,rgba(255,231,237,0.68),rgba(255,255,255,0.97))] border-rose-200/80",
};

function needsInterviewDetails(status: CandidateStatusType) {
  return INTERVIEW_REQUIRED_STATUSES.includes(status);
}

function canEditCandidate(
  candidate: CandidateListItem,
  currentUserId: string,
  membershipRole: WorkspaceRoleType,
) {
  return (
    membershipRole === "HR_ADMIN" ||
    (membershipRole === "HR" && candidate.hrId === currentUserId)
  );
}

function canReviewCandidate(membershipRole: WorkspaceRoleType) {
  return membershipRole === "MANAGER" || membershipRole === "HR_ADMIN";
}

function shortenText(value: string | null | undefined, maxLength = 120) {
  if (!value) return null;
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength).trim()}...`;
}

function getCandidateCvInfo(candidate: CandidateListItem) {
  return candidate.summary || candidate.notes || null;
}

function getTime(value: Date | string | null | undefined) {
  if (!value) return 0;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : 0;
}

function sortCandidates(
  candidates: CandidateListItem[],
  sortMode: CardSortMode,
) {
  return [...candidates].sort((left, right) => {
    if (sortMode === "oldest") {
      return getTime(left.createdAt) - getTime(right.createdAt);
    }

    if (sortMode === "nameAsc") {
      return (left.fullName || "").localeCompare(right.fullName || "", "vi");
    }

    if (sortMode === "statusAsc") {
      return candidateStatusMeta[
        left.status as CandidateStatusType
      ].label.localeCompare(
        candidateStatusMeta[right.status as CandidateStatusType].label,
        "vi",
      );
    }

    if (sortMode === "interviewSoonest") {
      const leftTime = getTime(left.interviewDate) || Number.MAX_SAFE_INTEGER;
      const rightTime = getTime(right.interviewDate) || Number.MAX_SAFE_INTEGER;
      return leftTime - rightTime;
    }

    return getTime(right.createdAt) - getTime(left.createdAt);
  });
}

export function CandidatesListManager({
  workspaceId,
  currentUserId,
  membershipRole,
  candidates,
}: {
  workspaceId: string;
  currentUserId: string;
  membershipRole: WorkspaceRoleType;
  candidates: CandidateListItem[];
}) {
  const router = useRouter();
  const [items, setItems] = useState(candidates);
  const [statusDrafts, setStatusDrafts] = useState<
    Record<string, StatusDraftState>
  >(
    Object.fromEntries(
      candidates.map((candidate) => [
        candidate.id,
        {
          status: candidate.status as CandidateStatusType,
          statusNote: "",
          interviewDate: toDateTimeLocalValue(candidate.interviewDate),
          interviewerName: candidate.interviewerName ?? "",
        },
      ]),
    ),
  );
  const [reviewDrafts, setReviewDrafts] = useState<
    Record<string, ReviewDraftState>
  >(
    Object.fromEntries(
      candidates.map((candidate) => [
        candidate.id,
        {
          managerDecision:
            (candidate.managerDecision as ManagerDecisionType) || "PENDING",
          managerOfferSalary: candidate.managerOfferSalary ?? "",
          managerReviewNote: candidate.managerReviewNote ?? "",
          finalStatus: "",
        },
      ]),
    ),
  );
  const [messages, setMessages] = useState<
    Record<string, { text: string; tone: "success" | "error" | "muted" }>
  >({});
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [activeModal, setActiveModal] = useState<ModalState>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("table");
  const [cardFilters, setCardFilters] = useState<CardFilterState>({
    search: "",
    status: "",
    managerDecision: "",
    hrName: "",
    projectName: "",
    sort: "newest",
  });
  const [isPending, startTransition] = useTransition();

  const cardFilterOptions = useMemo(
    () => ({
      hrs: Array.from(new Set(items.map((candidate) => candidate.hr.name)))
        .filter(Boolean)
        .sort((left, right) => left.localeCompare(right, "vi")),
      projects: Array.from(
        new Set(
          items
            .map((candidate) => candidate.projectName)
            .filter((projectName): projectName is string => Boolean(projectName)),
        ),
      ).sort((left, right) => left.localeCompare(right, "vi")),
    }),
    [items],
  );

  const cardItems = useMemo(() => {
    const search = cardFilters.search.trim().toLowerCase();
    const filtered = items.filter((candidate) => {
      const matchesSearch = search
        ? [
            candidate.fullName,
            candidate.email,
            candidate.phone,
            candidate.position,
            candidate.source,
            candidate.expectedSalary,
            candidate.offerSalary,
            candidate.summary,
            candidate.notes,
          ]
            .filter(Boolean)
            .some((value) => value!.toLowerCase().includes(search))
        : true;
      const matchesStatus = cardFilters.status
        ? candidate.status === cardFilters.status
        : true;
      const matchesDecision = cardFilters.managerDecision
        ? candidate.managerDecision === cardFilters.managerDecision
        : true;
      const matchesHr = cardFilters.hrName
        ? candidate.hr.name === cardFilters.hrName
        : true;
      const matchesProject = cardFilters.projectName
        ? candidate.projectName === cardFilters.projectName
        : true;

      return (
        matchesSearch &&
        matchesStatus &&
        matchesDecision &&
        matchesHr &&
        matchesProject
      );
    });

    return sortCandidates(filtered, cardFilters.sort);
  }, [cardFilters, items]);

  const stats = useMemo(() => {
    const total = items.length;
    const pipeline = items.filter((candidate) =>
      [
        "NEW",
        "REVIEWING",
        "PASS_CV",
        "INTERVIEW",
        "INTERVIEWED",
        "PASSED",
        "OFFERED",
      ].includes(candidate.status),
    ).length;
    const interviewing = items.filter((candidate) =>
      ["INTERVIEW", "INTERVIEWED"].includes(candidate.status),
    ).length;
    const approved = items.filter(
      (candidate) => candidate.managerDecision === "APPROVED",
    ).length;

    return { total, pipeline, interviewing, approved };
  }, [items]);

  const activeCandidate = activeModal
    ? (items.find((candidate) => candidate.id === activeModal.candidateId) ??
      null)
    : null;

  function changeViewMode(mode: ViewMode) {
    setViewMode(mode);
  }

  function updateCardFilter<K extends keyof CardFilterState>(
    key: K,
    value: CardFilterState[K],
  ) {
    setCardFilters((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function resetCardFilters() {
    setCardFilters({
      search: "",
      status: "",
      managerDecision: "",
      hrName: "",
      projectName: "",
      sort: "newest",
    });
  }

  function updateStatusDraft(
    candidateId: string,
    patch: Partial<StatusDraftState>,
  ) {
    setStatusDrafts((current) => ({
      ...current,
      [candidateId]: {
        ...current[candidateId],
        ...patch,
      },
    }));
  }

  function updateReviewDraft(
    candidateId: string,
    patch: Partial<ReviewDraftState>,
  ) {
    setReviewDrafts((current) => ({
      ...current,
      [candidateId]: {
        ...current[candidateId],
        ...patch,
      },
    }));
  }

  function closeModal() {
    if (isPending) return;
    setActiveModal(null);
  }

  function saveStatus(candidateId: string) {
    const candidate = items.find((item) => item.id === candidateId);
    const draft = statusDrafts[candidateId];

    if (!candidate || !draft) return;

    if (
      needsInterviewDetails(draft.status) &&
      (!draft.interviewDate.trim() || !draft.interviewerName.trim())
    ) {
      setMessages((current) => ({
        ...current,
        [candidateId]: {
          text: "Cần nhập ngày phỏng vấn và người phỏng vấn trước khi lưu.",
          tone: "error",
        },
      }));
      return;
    }

    setPendingId(candidateId);
    startTransition(async () => {
      const response = await fetch(`/api/candidates/${candidateId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          status: draft.status,
          statusNote:
            draft.statusNote.trim() || "Cập nhật nhanh từ danh sách ứng viên",
          interviewDate: draft.interviewDate
            ? new Date(draft.interviewDate).toISOString()
            : "",
          interviewerName: draft.interviewerName.trim(),
        }),
      });

      const data = (await response.json()) as { error?: string };

      if (!response.ok) {
        setMessages((current) => ({
          ...current,
          [candidateId]: {
            text: data.error || "Không thể cập nhật trạng thái.",
            tone: "error",
          },
        }));
        setPendingId(null);
        return;
      }

      setItems((current) =>
        current.map((item) =>
          item.id === candidateId
            ? {
                ...item,
                status: draft.status,
                interviewDate: draft.interviewDate
                  ? new Date(draft.interviewDate).toISOString()
                  : null,
                interviewerName: draft.interviewerName.trim() || null,
              }
            : item,
        ),
      );

      setMessages((current) => ({
        ...current,
        [candidateId]: {
          text: "Đã lưu trạng thái ứng viên.",
          tone: "success",
        },
      }));
      setPendingId(null);
      setActiveModal(null);
      router.refresh();
    });
  }

  function saveReview(candidateId: string) {
    const draft = reviewDrafts[candidateId];
    if (!draft) return;

    setPendingId(candidateId);
    startTransition(async () => {
      const response = await fetch(`/api/candidates/${candidateId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          managerDecision: draft.managerDecision,
          managerOfferSalary: draft.managerOfferSalary.trim(),
          managerReviewNote: draft.managerReviewNote.trim(),
          status: draft.finalStatus || undefined,
          statusNote: draft.finalStatus
            ? "Quản lý chốt nhanh từ danh sách ứng viên"
            : undefined,
        }),
      });

      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setMessages((current) => ({
          ...current,
          [candidateId]: {
            text: data.error || "Không thể lưu đánh giá của quản lý.",
            tone: "error",
          },
        }));
        setPendingId(null);
        return;
      }

      setItems((current) =>
        current.map((item) =>
          item.id === candidateId
            ? {
                ...item,
                managerDecision: draft.managerDecision,
                managerOfferSalary: draft.managerOfferSalary.trim() || null,
                managerReviewNote: draft.managerReviewNote.trim() || null,
                managerReviewedAt: new Date().toISOString(),
                managerReviewedByName: "Bạn",
                status: draft.finalStatus || item.status,
              }
            : item,
        ),
      );

      setReviewDrafts((current) => ({
        ...current,
        [candidateId]: {
          ...current[candidateId],
          finalStatus: "",
        },
      }));

      setMessages((current) => ({
        ...current,
        [candidateId]: {
          text: "Đã lưu đánh giá của quản lý.",
          tone: "success",
        },
      }));
      setPendingId(null);
      setActiveModal(null);
      router.refresh();
    });
  }

  if (!items.length) {
    return (
      <div className="bubbly-card p-8 text-center">
        <p className="text-sm font-black uppercase tracking-[0.18em] text-primary">
          Danh sách rỗng
        </p>
        <h3 className="mt-3 text-2xl font-black text-on-surface">
          Chưa có ứng viên phù hợp bộ lọc
        </h3>
        <p className="mt-3 text-sm font-medium leading-7 text-on-surface-variant">
          Hãy thử đổi từ khóa tìm kiếm, trạng thái, HR phụ trách hoặc dự án để
          xem thêm kết quả.
        </p>
      </div>
    );
  }

  return (
    <>
      <section className="space-y-5">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="soft-panel border border-white/60 bg-white/80">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-primary">
              Tổng ứng viên
            </p>
            <p className="mt-2 text-3xl font-black text-on-surface">
              {stats.total}
            </p>
          </div>
          <div className="soft-panel border border-white/60 bg-white/80">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-secondary">
              Đang trong pipeline
            </p>
            <p className="mt-2 text-3xl font-black text-on-surface">
              {stats.pipeline}
            </p>
          </div>
          <div className="soft-panel border border-white/60 bg-white/80">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-primary">
              Có lịch phỏng vấn
            </p>
            <p className="mt-2 text-3xl font-black text-on-surface">
              {stats.interviewing}
            </p>
          </div>
          <div className="soft-panel border border-white/60 bg-white/80">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-tertiary">
              Đã duyệt
            </p>
            <p className="mt-2 text-3xl font-black text-on-surface">
              {stats.approved}
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-3 rounded-[1.6rem] border border-white/70 bg-white/82 p-4 shadow-[0_18px_45px_rgba(160,57,100,0.08)] backdrop-blur-xl md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-black text-on-surface">
              Chế độ hiển thị
            </p>
            <p className="mt-1 text-sm font-medium leading-6 text-on-surface-variant">
              Bảng Excel là mặc định để quản lý nhanh; có thể chuyển về giao
              diện thẻ khi cần xem chi tiết trực quan.
            </p>
          </div>

          <div className="inline-flex rounded-[1.1rem] bg-surface-container-low p-1">
            <button
              type="button"
              onClick={() => changeViewMode("table")}
              className={cn(
                "inline-flex h-10 items-center gap-2 rounded-[0.9rem] px-4 text-sm font-black transition",
                viewMode === "table"
                  ? "bg-white text-primary shadow-[0_10px_24px_rgba(160,57,100,0.12)]"
                  : "text-on-surface-variant hover:bg-white/60",
              )}
            >
              <Table2 className="size-4" />
              Bảng Excel
            </button>
            <button
              type="button"
              onClick={() => changeViewMode("cards")}
              className={cn(
                "inline-flex h-10 items-center gap-2 rounded-[0.9rem] px-4 text-sm font-black transition",
                viewMode === "cards"
                  ? "bg-white text-primary shadow-[0_10px_24px_rgba(160,57,100,0.12)]"
                  : "text-on-surface-variant hover:bg-white/60",
              )}
            >
              <LayoutGrid className="size-4" />
              Dạng thẻ
            </button>
          </div>
        </div>

        {viewMode === "table" ? (
          <CandidatesTable
            workspaceId={workspaceId}
            candidates={items}
            currentUserId={currentUserId}
            membershipRole={membershipRole}
            messages={messages}
            onEditStatus={(candidateId) =>
              setActiveModal({ candidateId, mode: "status" })
            }
            onReview={(candidateId) =>
              setActiveModal({ candidateId, mode: "review" })
            }
          />
        ) : (
          <div className="space-y-4">
            <CardGridControls
              filters={cardFilters}
              totalCount={items.length}
              visibleCount={cardItems.length}
              hrOptions={cardFilterOptions.hrs}
              projectOptions={cardFilterOptions.projects}
              onChange={updateCardFilter}
              onReset={resetCardFilters}
            />

            {!cardItems.length ? (
              <div className="rounded-[1.8rem] border border-white/70 bg-white/88 p-8 text-center shadow-[0_18px_45px_rgba(160,57,100,0.08)]">
                <p className="text-sm font-black uppercase tracking-[0.18em] text-primary">
                  Không có kết quả trong Grid
                </p>
                <p className="mt-3 text-sm font-medium leading-7 text-on-surface-variant">
                  Hãy đổi từ khóa, trạng thái, HR, dự án hoặc xóa bộ lọc Grid
                  để xem lại toàn bộ hồ sơ.
                </p>
                <Button className="mt-5" variant="ghost" onClick={resetCardFilters}>
                  Xóa lọc Grid
                </Button>
              </div>
            ) : null}

            {cardItems.map((candidate) => {
              const status = candidate.status as CandidateStatusType;
              const meta = candidateStatusMeta[status];
              const reviewMeta =
                managerDecisionMeta[
                  (candidate.managerDecision as ManagerDecisionType) ||
                    "PENDING"
                ];
              const message = messages[candidate.id];
              const editable = canEditCandidate(
                candidate,
                currentUserId,
                membershipRole,
              );
              const reviewable = canReviewCandidate(membershipRole);
              const cvInfo = getCandidateCvInfo(candidate);

              return (
                <article
                  key={candidate.id}
                  className={cn(
                    "overflow-hidden rounded-[2rem] border p-0 shadow-[0_22px_60px_rgba(160,57,100,0.08)]",
                    statusSurfaceMap[status],
                  )}
                >
                  <div className="space-y-5 p-5 lg:p-6">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="max-w-3xl">
                        <p className="text-xs font-black uppercase tracking-[0.18em] text-primary">
                          {meta.label}
                        </p>
                        <h3 className="mt-2 text-2xl font-black tracking-tight text-on-surface">
                          {candidate.fullName || "Chưa có tên ứng viên"}
                        </h3>
                        <p className="mt-2 text-base font-semibold leading-7 text-on-surface-variant">
                          {candidate.position || "Chưa có vị trí ứng tuyển"}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge className={meta.className}>{meta.label}</Badge>
                        <Badge className={reviewMeta.className}>
                          {reviewMeta.label}
                        </Badge>
                      </div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                      <InfoCard
                        icon={CircleUserRound}
                        label="HR phụ trách"
                        value={candidate.hr.name}
                      />
                      <InfoCard
                        icon={FolderSearch}
                        label="Nguồn"
                        value={candidate.source || "Chưa rõ"}
                      />
                      <InfoCard
                        icon={CalendarDays}
                        label="Ngày nhận"
                        value={formatDate(candidate.createdAt)}
                      />
                      <InfoCard
                        icon={UserRoundSearch}
                        label="Người phỏng vấn"
                        value={candidate.interviewerName || "Chưa có lịch"}
                      />
                      <InfoCard
                        icon={BriefcaseBusiness}
                        label="Dự án"
                        value={candidate.projectName || "Chưa gắn dự án"}
                      />
                    </div>

                    <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.9fr)]">
                      <div className="grid gap-3 xl:grid-cols-3">
                        <div className="rounded-[1.6rem] border border-white/70 bg-white/80 p-4 shadow-[0_12px_28px_rgba(15,23,42,0.06)]">
                          <p className="text-sm font-black text-on-surface">
                            Thông tin CV
                          </p>
                          <div className="mt-3 grid gap-3">
                            <MiniInfo
                              label="Lương mong muốn"
                              value={candidate.expectedSalary || "Chưa nhập"}
                            />
                            <MiniInfo
                              label="Ghi chú / tóm tắt"
                              value={
                                shortenText(cvInfo, 120) ||
                                "Chưa có thông tin thêm"
                              }
                            />
                          </div>
                        </div>

                        <div className="rounded-[1.6rem] border border-white/70 bg-white/80 p-4 shadow-[0_12px_28px_rgba(15,23,42,0.06)]">
                          <div className="flex items-center gap-3">
                            <Sparkles className="size-4 text-primary" />
                            <p className="text-sm font-black text-on-surface">
                              Thông tin phỏng vấn
                            </p>
                          </div>
                          <div className="mt-3 grid gap-3">
                            <MiniInfo
                              label="Lịch phỏng vấn"
                              value={
                                candidate.interviewDate
                                  ? formatDateTime(candidate.interviewDate)
                                  : "Chưa lên lịch"
                              }
                            />
                            <MiniInfo
                              label="Trạng thái quản lý"
                              value={reviewMeta.label}
                            />
                          </div>
                        </div>

                        <div className="rounded-[1.6rem] border border-white/70 bg-white/80 p-4 shadow-[0_12px_28px_rgba(15,23,42,0.06)]">
                          <div className="flex items-center justify-between gap-3">
                            <p className="text-sm font-black text-on-surface">
                              Đánh giá quản lý
                            </p>
                            <Badge className={reviewMeta.className}>
                              {reviewMeta.shortLabel}
                            </Badge>
                          </div>
                          <div className="mt-3 grid gap-3">
                            <MiniInfo
                              label="Offer đề xuất"
                              value={
                                candidate.managerOfferSalary || "Chưa đề xuất"
                              }
                            />
                            <MiniInfo
                              label="Người duyệt"
                              value={
                                candidate.managerReviewedByName
                                  ? `${candidate.managerReviewedByName}${candidate.managerReviewedAt ? ` • ${formatDateTime(candidate.managerReviewedAt)}` : ""}`
                                  : "Chưa có đánh giá"
                              }
                            />
                          </div>
                          <p className="mt-3 text-sm font-medium leading-7 text-on-surface-variant">
                            {shortenText(candidate.managerReviewNote, 110) ||
                              "Chưa có ghi chú đánh giá."}
                          </p>
                        </div>
                      </div>

                      <div className="rounded-[1.6rem] border border-white/70 bg-white/80 p-4 shadow-[0_12px_28px_rgba(15,23,42,0.06)]">
                        <p className="text-xs font-black uppercase tracking-[0.18em] text-primary">
                          Thao tác nhanh
                        </p>
                        <p className="mt-2 text-sm font-medium leading-6 text-on-surface-variant">
                          Chỉnh nhanh bằng popup hoặc mở hồ sơ để xem chi tiết.
                        </p>

                        <div className="mt-4 flex flex-wrap gap-3">
                          {editable ? (
                            <Button
                              variant="secondary"
                              onClick={() =>
                                setActiveModal({
                                  candidateId: candidate.id,
                                  mode: "status",
                                })
                              }
                            >
                              Chỉnh trạng thái
                            </Button>
                          ) : null}

                          {reviewable ? (
                            <Button
                              onClick={() =>
                                setActiveModal({
                                  candidateId: candidate.id,
                                  mode: "review",
                                })
                              }
                            >
                              Đánh giá quản lý
                            </Button>
                          ) : null}

                          <Link
                            href={`/workspace/${workspaceId}/candidates/${candidate.id}`}
                          >
                            <Button
                              variant="ghost"
                              className="border-primary/15 bg-surface-container-low/90 shadow-[0_10px_26px_rgba(160,57,100,0.08)] hover:bg-primary-container/70"
                            >
                              Xem chi tiết
                            </Button>
                          </Link>
                        </div>

                        {!editable && !reviewable ? (
                          <p className="mt-4 text-sm font-semibold leading-7 text-on-surface-variant">
                            HR này không phụ trách hồ sơ này nên chỉ có quyền
                            xem.
                          </p>
                        ) : null}

                        {message?.text ? (
                          <p
                            className={cn(
                              "mt-4 text-sm font-semibold",
                              message.tone === "success" && "text-emerald-600",
                              message.tone === "error" && "text-rose-600",
                              message.tone === "muted" &&
                                "text-on-surface-variant",
                            )}
                          >
                            {message.text}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {activeModal && activeCandidate ? (
        <QuickEditModal
          title={
            activeModal.mode === "status"
              ? "Chỉnh trạng thái nhanh"
              : "Đánh giá tuyển dụng"
          }
          description={
            activeModal.mode === "status"
              ? "Cập nhật trạng thái vận hành, lịch phỏng vấn hoặc ghi chú thay đổi."
              : "Điền đánh giá của quản lý và chốt trạng thái cuối nếu cần."
          }
          candidateName={activeCandidate.fullName || "Ứng viên chưa có tên"}
          onClose={closeModal}
        >
          {activeModal.mode === "status" ? (
            <StatusEditForm
              draft={statusDrafts[activeCandidate.id]}
              isSaving={Boolean(isPending && pendingId === activeCandidate.id)}
              onChange={(patch) => updateStatusDraft(activeCandidate.id, patch)}
              onSave={() => saveStatus(activeCandidate.id)}
            />
          ) : (
            <ReviewEditForm
              draft={reviewDrafts[activeCandidate.id]}
              isSaving={Boolean(isPending && pendingId === activeCandidate.id)}
              onChange={(patch) => updateReviewDraft(activeCandidate.id, patch)}
              onSave={() => saveReview(activeCandidate.id)}
            />
          )}
        </QuickEditModal>
      ) : null}
    </>
  );
}

function CardGridControls({
  filters,
  totalCount,
  visibleCount,
  hrOptions,
  projectOptions,
  onChange,
  onReset,
}: {
  filters: CardFilterState;
  totalCount: number;
  visibleCount: number;
  hrOptions: string[];
  projectOptions: string[];
  onChange: <K extends keyof CardFilterState>(
    key: K,
    value: CardFilterState[K],
  ) => void;
  onReset: () => void;
}) {
  return (
    <div className="rounded-[1.8rem] border border-white/70 bg-white/88 p-4 shadow-[0_18px_45px_rgba(160,57,100,0.08)] backdrop-blur-xl">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="size-4 text-primary" />
            <p className="text-sm font-black text-on-surface">
              Sắp xếp và lọc Grid
            </p>
          </div>
          <p className="mt-1 text-xs font-semibold uppercase tracking-[0.16em] text-outline">
            {visibleCount}/{totalCount} hồ sơ, mặc định CV mới nhất lên đầu
          </p>
        </div>

        <Button variant="ghost" className="h-10 bg-white" onClick={onReset}>
          Xóa lọc Grid
        </Button>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-[1.45fr_1fr_1fr_1fr_1fr_1fr]">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-outline" />
          <input
            value={filters.search}
            onChange={(event) => onChange("search", event.target.value)}
            placeholder="Tìm trong Grid..."
            className="h-12 w-full rounded-[1.1rem] border border-primary/10 bg-white pl-10 pr-4 text-sm font-medium text-on-surface outline-none transition focus:border-primary/20 focus:ring-4 focus:ring-primary/10"
          />
        </div>

        <select
          value={filters.sort}
          onChange={(event) =>
            onChange("sort", event.target.value as CardSortMode)
          }
          className="h-12 rounded-[1.1rem] border border-primary/10 bg-white px-4 text-sm font-medium text-on-surface outline-none transition focus:border-primary/20 focus:ring-4 focus:ring-primary/10"
        >
          <option value="newest">Mới nhất trước</option>
          <option value="oldest">Cũ nhất trước</option>
          <option value="nameAsc">Tên A-Z</option>
          <option value="statusAsc">Trạng thái A-Z</option>
          <option value="interviewSoonest">Lịch PV gần nhất</option>
        </select>

        <select
          value={filters.status}
          onChange={(event) => onChange("status", event.target.value)}
          className="h-12 rounded-[1.1rem] border border-primary/10 bg-white px-4 text-sm font-medium text-on-surface outline-none transition focus:border-primary/20 focus:ring-4 focus:ring-primary/10"
        >
          <option value="">Tất cả trạng thái</option>
          {CANDIDATE_STATUSES.map((status) => (
            <option key={status} value={status}>
              {candidateStatusMeta[status].label}
            </option>
          ))}
        </select>

        <select
          value={filters.managerDecision}
          onChange={(event) =>
            onChange("managerDecision", event.target.value)
          }
          className="h-12 rounded-[1.1rem] border border-primary/10 bg-white px-4 text-sm font-medium text-on-surface outline-none transition focus:border-primary/20 focus:ring-4 focus:ring-primary/10"
        >
          <option value="">Tất cả đánh giá</option>
          {MANAGER_DECISIONS.map((decision) => (
            <option key={decision} value={decision}>
              {managerDecisionMeta[decision].label}
            </option>
          ))}
        </select>

        <select
          value={filters.hrName}
          onChange={(event) => onChange("hrName", event.target.value)}
          className="h-12 rounded-[1.1rem] border border-primary/10 bg-white px-4 text-sm font-medium text-on-surface outline-none transition focus:border-primary/20 focus:ring-4 focus:ring-primary/10"
        >
          <option value="">Tất cả HR</option>
          {hrOptions.map((hrName) => (
            <option key={hrName} value={hrName}>
              {hrName}
            </option>
          ))}
        </select>

        <select
          value={filters.projectName}
          onChange={(event) => onChange("projectName", event.target.value)}
          className="h-12 rounded-[1.1rem] border border-primary/10 bg-white px-4 text-sm font-medium text-on-surface outline-none transition focus:border-primary/20 focus:ring-4 focus:ring-primary/10"
        >
          <option value="">Tất cả dự án</option>
          {projectOptions.map((projectName) => (
            <option key={projectName} value={projectName}>
              {projectName}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

function CandidatesTable({
  workspaceId,
  candidates,
  currentUserId,
  membershipRole,
  messages,
  onEditStatus,
  onReview,
}: {
  workspaceId: string;
  candidates: CandidateListItem[];
  currentUserId: string;
  membershipRole: WorkspaceRoleType;
  messages: Record<
    string,
    { text: string; tone: "success" | "error" | "muted" }
  >;
  onEditStatus: (candidateId: string) => void;
  onReview: (candidateId: string) => void;
}) {
  return (
    <div className="overflow-hidden rounded-[1.8rem] border border-white/70 bg-white/90 shadow-[0_24px_65px_rgba(160,57,100,0.1)] backdrop-blur-xl">
      <div className="flex flex-col gap-2 border-b border-primary/10 bg-[linear-gradient(135deg,rgba(255,231,237,0.72),rgba(255,255,255,0.95))] px-5 py-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm font-black text-on-surface">
            Danh sách CV dạng bảng
          </p>
          <p className="mt-1 text-xs font-semibold uppercase tracking-[0.16em] text-outline">
            {candidates.length} hồ sơ
          </p>
        </div>
        <p className="text-sm font-medium leading-6 text-on-surface-variant">
          Cuộn ngang để xem đủ cột trên màn hình nhỏ.
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-[1560px] w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-primary/10 bg-surface-container-low/70">
              <TableHead>Ứng viên</TableHead>
              <TableHead>Liên hệ</TableHead>
              <TableHead>Vị trí</TableHead>
              <TableHead>Thông tin CV</TableHead>
              <TableHead>Lương mong muốn</TableHead>
              <TableHead>Trạng thái</TableHead>
              <TableHead>HR</TableHead>
              <TableHead>Nguồn</TableHead>
              <TableHead>Dự án</TableHead>
              <TableHead>Ngày nhận</TableHead>
              <TableHead>Phỏng vấn</TableHead>
              <TableHead>Quản lý</TableHead>
              <TableHead>Offer</TableHead>
              <TableHead className="text-right">Thao tác</TableHead>
            </tr>
          </thead>
          <tbody>
            {candidates.map((candidate, index) => {
              const status = candidate.status as CandidateStatusType;
              const statusMeta = candidateStatusMeta[status];
              const reviewMeta =
                managerDecisionMeta[
                  (candidate.managerDecision as ManagerDecisionType) ||
                    "PENDING"
                ];
              const editable = canEditCandidate(
                candidate,
                currentUserId,
                membershipRole,
              );
              const reviewable = canReviewCandidate(membershipRole);
              const message = messages[candidate.id];
              const cvInfo = getCandidateCvInfo(candidate);

              return (
                <tr
                  key={candidate.id}
                  className={cn(
                    "border-b border-primary/8 align-top transition hover:bg-primary-fixed/18",
                    index % 2 === 0
                      ? "bg-white/80"
                      : "bg-surface-container-low/35",
                  )}
                >
                  <TableCell className="min-w-56">
                    <Link
                      href={`/workspace/${workspaceId}/candidates/${candidate.id}`}
                      className="font-black text-on-surface underline-offset-4 transition hover:text-primary hover:underline"
                    >
                      {candidate.fullName || "Chưa có tên ứng viên"}
                    </Link>
                    <p className="mt-1 text-xs font-semibold text-on-surface-variant">
                      ID: {candidate.id.slice(0, 8)}
                    </p>
                  </TableCell>
                  <TableCell className="min-w-56">
                    <p className="font-semibold text-on-surface">
                      {candidate.email || "Chưa có email"}
                    </p>
                    <p className="mt-1 text-xs font-semibold text-on-surface-variant">
                      {candidate.phone || "Chưa có SĐT"}
                    </p>
                  </TableCell>
                  <TableCell className="min-w-52 font-semibold text-on-surface">
                    {candidate.position || "Chưa có vị trí"}
                  </TableCell>
                  <TableCell className="min-w-72">
                    <p className="line-clamp-3 text-sm font-medium leading-6 text-on-surface-variant">
                      {shortenText(cvInfo, 150) || "Chưa có thông tin thêm"}
                    </p>
                  </TableCell>
                  <TableCell className="min-w-40 font-semibold text-on-surface">
                    {candidate.expectedSalary || "Chưa nhập"}
                  </TableCell>
                  <TableCell>
                    <Badge
                      className={cn(
                        statusMeta.className,
                        "whitespace-nowrap px-2 py-0.5 text-[10px] leading-4 tracking-[0.08em]",
                      )}
                    >
                      {statusMeta.label}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-semibold text-on-surface">
                    {candidate.hr.name}
                  </TableCell>
                  <TableCell className="font-semibold text-on-surface-variant">
                    {candidate.source || "Chưa rõ"}
                  </TableCell>
                  <TableCell className="min-w-48 font-semibold text-on-surface">
                    {candidate.projectName || "Chưa gắn dự án"}
                  </TableCell>
                  <TableCell className="font-semibold text-on-surface">
                    {formatDate(candidate.createdAt)}
                  </TableCell>
                  <TableCell className="min-w-52">
                    <p className="font-semibold text-on-surface">
                      {candidate.interviewDate
                        ? formatDateTime(candidate.interviewDate)
                        : "Chưa lên lịch"}
                    </p>
                    <p className="mt-1 text-xs font-semibold text-on-surface-variant">
                      {candidate.interviewerName || "Chưa có người phỏng vấn"}
                    </p>
                  </TableCell>
                  <TableCell className="min-w-48">
                    <Badge className={reviewMeta.className}>
                      {reviewMeta.label}
                    </Badge>
                    <p className="mt-2 text-xs font-semibold leading-5 text-on-surface-variant">
                      {candidate.managerReviewedByName
                        ? `${candidate.managerReviewedByName}${candidate.managerReviewedAt ? ` • ${formatDateTime(candidate.managerReviewedAt)}` : ""}`
                        : "Chưa có đánh giá"}
                    </p>
                  </TableCell>
                  <TableCell className="min-w-40 font-semibold text-on-surface">
                    {candidate.managerOfferSalary || "Chưa đề xuất"}
                  </TableCell>
                  <TableCell className="min-w-72">
                    <div className="flex justify-end gap-2">
                      {editable ? (
                        <Button
                          variant="secondary"
                          className="h-9 px-3 text-xs"
                          onClick={() => onEditStatus(candidate.id)}
                        >
                          Trạng thái
                        </Button>
                      ) : null}
                      {reviewable ? (
                        <Button
                          className="h-9 px-3 text-xs"
                          onClick={() => onReview(candidate.id)}
                        >
                          Đánh giá
                        </Button>
                      ) : null}
                      <Link
                        href={`/workspace/${workspaceId}/candidates/${candidate.id}`}
                      >
                        <Button
                          variant="ghost"
                          className="h-9 border-primary/15 bg-surface-container-low/90 px-3 text-xs shadow-[0_10px_26px_rgba(160,57,100,0.08)] hover:bg-primary-container/70"
                        >
                          Chi tiết
                        </Button>
                      </Link>
                    </div>
                    {message?.text ? (
                      <p
                        className={cn(
                          "mt-2 text-right text-xs font-semibold",
                          message.tone === "success" && "text-emerald-600",
                          message.tone === "error" && "text-rose-600",
                          message.tone === "muted" && "text-on-surface-variant",
                        )}
                      >
                        {message.text}
                      </p>
                    ) : null}
                  </TableCell>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TableHead({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <th
      className={cn(
        "px-4 py-3 text-xs font-black uppercase tracking-[0.14em] text-outline",
        className,
      )}
    >
      {children}
    </th>
  );
}

function TableCell({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <td className={cn("px-4 py-4 text-sm", className)}>{children}</td>;
}

function InfoCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof CircleUserRound;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-[1.5rem] border border-white/70 bg-white/88 px-4 py-4 shadow-[0_12px_28px_rgba(15,23,42,0.06)] backdrop-blur-sm">
      <div className="flex items-center gap-2 text-slate-600">
        <Icon className="size-4" />
        <p className="text-[11px] font-black uppercase tracking-[0.16em]">
          {label}
        </p>
      </div>
      <p className="mt-3 text-sm font-black text-on-surface">{value}</p>
    </div>
  );
}

function MiniInfo({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[1.2rem] border border-white/85 bg-white/96">
      <p className="text-[11px] font-black uppercase tracking-[0.16em] leading-5 text-slate-600">
        {label}
      </p>
      <p className="mt-1.5 text-sm font-semibold leading-6 text-on-surface">
        {value}
      </p>
    </div>
  );
}

function QuickEditModal({
  title,
  description,
  candidateName,
  children,
  onClose,
}: {
  title: string;
  description: string;
  candidateName: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 px-4 py-8 backdrop-blur-sm">
      <div className="relative max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-[2rem] border border-white/70 bg-white p-6 shadow-[0_30px_80px_rgba(15,23,42,0.22)]">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 inline-flex size-11 items-center justify-center rounded-full bg-surface-container-low text-on-surface transition hover:bg-surface-container-high"
          aria-label="Đóng popup"
        >
          <X className="size-5" />
        </button>

        <div className="pr-12">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-primary">
            {title}
          </p>
          <h3 className="mt-2 text-2xl font-black tracking-tight text-on-surface">
            {candidateName}
          </h3>
          <p className="mt-2 text-sm font-medium leading-6 text-on-surface-variant">
            {description}
          </p>
        </div>

        <div className="mt-6">{children}</div>
      </div>
    </div>
  );
}

function StatusEditForm({
  draft,
  isSaving,
  onChange,
  onSave,
}: {
  draft: StatusDraftState;
  isSaving: boolean;
  onChange: (patch: Partial<StatusDraftState>) => void;
  onSave: () => void;
}) {
  return (
    <div className="space-y-4">
      <select
        className="field bg-surface-container-low"
        value={draft.status}
        onChange={(event) =>
          onChange({
            status: event.target.value as CandidateStatusType,
          })
        }
        disabled={isSaving}
      >
        {CANDIDATE_STATUSES.map((statusOption) => (
          <option key={statusOption} value={statusOption}>
            {candidateStatusMeta[statusOption].label}
          </option>
        ))}
      </select>

      {needsInterviewDetails(draft.status) ? (
        <div className="grid gap-3 md:grid-cols-2">
          <input
            type="datetime-local"
            className="field bg-surface-container-low"
            value={draft.interviewDate}
            onChange={(event) =>
              onChange({
                interviewDate: event.target.value,
              })
            }
            disabled={isSaving}
          />
          <input
            type="text"
            className="field bg-surface-container-low"
            placeholder="Người phỏng vấn"
            value={draft.interviewerName}
            onChange={(event) =>
              onChange({
                interviewerName: event.target.value,
              })
            }
            disabled={isSaving}
          />
        </div>
      ) : null}

      <textarea
        rows={4}
        className="field-textarea min-h-28 resize-none bg-surface-container-low"
        placeholder="Ghi chú thay đổi"
        value={draft.statusNote}
        onChange={(event) =>
          onChange({
            statusNote: event.target.value,
          })
        }
        disabled={isSaving}
      />

      <div className="flex flex-wrap gap-3">
        <Button onClick={onSave} disabled={isSaving}>
          {isSaving ? "Đang lưu..." : "Lưu trạng thái"}
        </Button>
      </div>
    </div>
  );
}

function ReviewEditForm({
  draft,
  isSaving,
  onChange,
  onSave,
}: {
  draft: ReviewDraftState;
  isSaving: boolean;
  onChange: (patch: Partial<ReviewDraftState>) => void;
  onSave: () => void;
}) {
  return (
    <div className="space-y-4">
      <select
        className="field bg-surface-container-low"
        value={draft.managerDecision}
        onChange={(event) =>
          onChange({
            managerDecision: event.target.value as ManagerDecisionType,
          })
        }
        disabled={isSaving}
      >
        {MANAGER_DECISIONS.map((decision) => (
          <option key={decision} value={decision}>
            {managerDecisionMeta[decision].label}
          </option>
        ))}
      </select>

      <input
        type="text"
        className="field bg-surface-container-low"
        placeholder="Offer đề xuất"
        value={draft.managerOfferSalary}
        onChange={(event) =>
          onChange({
            managerOfferSalary: event.target.value,
          })
        }
        disabled={isSaving}
      />

      <textarea
        rows={5}
        className="field-textarea min-h-32 resize-none bg-surface-container-low"
        placeholder="Nhận xét của quản lý"
        value={draft.managerReviewNote}
        onChange={(event) =>
          onChange({
            managerReviewNote: event.target.value,
          })
        }
        disabled={isSaving}
      />

      <select
        className="field bg-surface-container-low"
        value={draft.finalStatus}
        onChange={(event) =>
          onChange({
            finalStatus: event.target.value as ManagerFinalStatusType | "",
          })
        }
        disabled={isSaving}
      >
        <option value="">Không đổi trạng thái</option>
        {MANAGER_FINAL_STATUSES.map((statusOption) => (
          <option key={statusOption} value={statusOption}>
            {managerFinalStatusMeta[statusOption].label}
          </option>
        ))}
      </select>

      <div className="flex flex-wrap gap-3">
        <Button onClick={onSave} disabled={isSaving}>
          {isSaving ? "Đang lưu..." : "Lưu đánh giá"}
        </Button>
      </div>
    </div>
  );
}
