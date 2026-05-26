"use client";

import Link from "next/link";
import { Fragment, useEffect, useMemo, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
  type Column,
  type ColumnDef,
  type ColumnFiltersState,
  type ColumnOrderState,
  type ColumnPinningState,
  type Row,
  type SortingState,
  type VisibilityState,
} from "@tanstack/react-table";
import {
  ArrowDown,
  ArrowUp,
  BriefcaseBusiness,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  ClipboardCheck,
  CircleUserRound,
  Eye,
  FilterX,
  FolderSearch,
  GripVertical,
  LayoutGrid,
  Maximize2,
  Minimize2,
  Pin,
  PinOff,
  Settings2,
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

type CandidateColumnId =
  | "candidate"
  | "contact"
  | "position"
  | "cvInfo"
  | "expectedSalary"
  | "status"
  | "hr"
  | "source"
  | "project"
  | "createdAt"
  | "interview"
  | "managerDecision"
  | "managerOfferSalary"
  | "actions";

type CandidateTableColumnSettings = {
  columnVisibility: VisibilityState;
  columnOrder: ColumnOrderState;
  columnPinning: ColumnPinningState;
  hiddenStatuses: CandidateStatusType[];
};

type TableSettingsStatus = "loading" | "idle" | "saving" | "saved" | "error";

const CANDIDATE_TABLE_SETTINGS_KEY = "candidates-table-columns";

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

const candidateColumnLabels: Record<CandidateColumnId, string> = {
  candidate: "Ứng viên",
  contact: "Liên hệ",
  position: "Vị trí",
  cvInfo: "Thông tin CV",
  expectedSalary: "Lương mong muốn",
  status: "Trạng thái",
  hr: "HR",
  source: "Nguồn",
  project: "Dự án",
  createdAt: "Ngày nhận",
  interview: "Phỏng vấn",
  managerDecision: "Quản lý",
  managerOfferSalary: "Offer",
  actions: "Thao tác",
};

const defaultCandidateColumnOrder: CandidateColumnId[] = [
  "candidate",
  "status",
  "contact",
  "position",
  "hr",
  "project",
  "createdAt",
  "interview",
  "managerDecision",
  "expectedSalary",
  "managerOfferSalary",
  "source",
  "cvInfo",
  "actions",
];

const defaultColumnVisibility: VisibilityState = {
  cvInfo: false,
  source: false,
};

const defaultColumnPinning: ColumnPinningState = {
  left: ["candidate", "status"],
  right: ["actions"],
};

const candidateColumnIdSet = new Set<string>(defaultCandidateColumnOrder);
const candidateStatusSet = new Set<string>(CANDIDATE_STATUSES);

function isCandidateColumnId(value: unknown): value is CandidateColumnId {
  return typeof value === "string" && candidateColumnIdSet.has(value);
}

function isCandidateStatus(value: unknown): value is CandidateStatusType {
  return typeof value === "string" && candidateStatusSet.has(value);
}

function normalizeColumnOrder(value: unknown): ColumnOrderState {
  if (!Array.isArray(value)) return defaultCandidateColumnOrder;

  const seen = new Set<string>();
  const ordered = value.filter((columnId): columnId is CandidateColumnId => {
    if (!isCandidateColumnId(columnId) || seen.has(columnId)) return false;
    seen.add(columnId);
    return true;
  });

  return [
    ...ordered,
    ...defaultCandidateColumnOrder.filter((columnId) => !seen.has(columnId)),
  ];
}

function normalizeColumnVisibility(value: unknown): VisibilityState {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return defaultColumnVisibility;
  }

  return Object.fromEntries(
    Object.entries(value)
      .filter(([columnId, visible]) => isCandidateColumnId(columnId) && typeof visible === "boolean")
      .map(([columnId, visible]) => [columnId, visible]),
  );
}

function normalizePinnedColumnIds(
  value: unknown,
  usedColumnIds: Set<string>,
): string[] {
  if (!Array.isArray(value)) return [];

  return value.filter((columnId): columnId is CandidateColumnId => {
    if (!isCandidateColumnId(columnId) || usedColumnIds.has(columnId)) return false;
    usedColumnIds.add(columnId);
    return true;
  });
}

function normalizeColumnPinning(value: unknown): ColumnPinningState {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return defaultColumnPinning;
  }

  const pinning = value as { left?: unknown; right?: unknown };
  const usedColumnIds = new Set<string>();

  return {
    left: normalizePinnedColumnIds(pinning.left, usedColumnIds),
    right: normalizePinnedColumnIds(pinning.right, usedColumnIds),
  };
}

function normalizeHiddenStatuses(value: unknown): CandidateStatusType[] {
  if (!Array.isArray(value)) return [];

  const seen = new Set<string>();
  return value.filter((status): status is CandidateStatusType => {
    if (!isCandidateStatus(status) || seen.has(status)) return false;
    seen.add(status);
    return true;
  });
}

function normalizeCandidateTableColumnSettings(
  value: unknown,
): CandidateTableColumnSettings | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;

  const settings = value as {
    columnVisibility?: unknown;
    columnOrder?: unknown;
    columnPinning?: unknown;
    hiddenStatuses?: unknown;
  };

  return {
    columnVisibility: normalizeColumnVisibility(settings.columnVisibility),
    columnOrder: normalizeColumnOrder(settings.columnOrder),
    columnPinning: normalizeColumnPinning(settings.columnPinning),
    hiddenStatuses: normalizeHiddenStatuses(settings.hiddenStatuses),
  };
}

function getTableSettingsStatusText(status: TableSettingsStatus) {
  if (status === "loading") return "Đang tải cài đặt";
  if (status === "saving") return "Đang lưu cài đặt";
  if (status === "saved") return "Đã lưu cài đặt";
  if (status === "error") return "Lỗi lưu cài đặt";
  return null;
}

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
  const [isPending, startTransition] = useTransition();

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
          <MetricCard label="Tổng ứng viên" value={stats.total} tone="primary" />
          <MetricCard label="Đang trong pipeline" value={stats.pipeline} tone="secondary" />
          <MetricCard label="Có lịch phỏng vấn" value={stats.interviewing} tone="primary" />
          <MetricCard label="Đã duyệt" value={stats.approved} tone="tertiary" />
        </div>

        <div className="flex flex-col gap-3 rounded-[1.6rem] border border-white/70 bg-white/82 p-4 shadow-[0_18px_45px_rgba(160,57,100,0.08)] backdrop-blur-xl md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-black text-on-surface">
              Chế độ hiển thị
            </p>
            <p className="mt-1 text-sm font-medium leading-6 text-on-surface-variant">
              Bảng Excel dùng cho thao tác nhanh; dạng thẻ dùng để đọc hồ sơ
              trực quan.
            </p>
          </div>

          <div className="inline-flex rounded-[1.1rem] bg-surface-container-low p-1">
            <button
              type="button"
              onClick={() => setViewMode("table")}
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
              onClick={() => setViewMode("cards")}
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
          <CandidatesCardView
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

function MetricCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "primary" | "secondary" | "tertiary";
}) {
  const toneClass = {
    primary: "text-primary",
    secondary: "text-secondary",
    tertiary: "text-tertiary",
  }[tone];

  return (
    <div className="soft-panel border border-white/60 bg-white/80">
      <p className={cn("text-xs font-black uppercase tracking-[0.18em]", toneClass)}>
        {label}
      </p>
      <p className="mt-2 text-3xl font-black text-on-surface">{value}</p>
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
  const [sorting, setSorting] = useState<SortingState>([
    { id: "createdAt", desc: true },
  ]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(
    defaultColumnVisibility,
  );
  const [columnOrder, setColumnOrder] = useState<ColumnOrderState>(
    defaultCandidateColumnOrder,
  );
  const [columnPinning, setColumnPinning] = useState<ColumnPinningState>(
    defaultColumnPinning,
  );
  const [hiddenStatuses, setHiddenStatuses] = useState<CandidateStatusType[]>(
    [],
  );
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [isTableFullscreen, setIsTableFullscreen] = useState(false);
  const [groupByStatus, setGroupByStatus] = useState(false);
  const [collapsedStatusGroups, setCollapsedStatusGroups] = useState<
    CandidateStatusType[]
  >([]);
  const [portalReady, setPortalReady] = useState(false);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [tableSettingsStatus, setTableSettingsStatus] =
    useState<TableSettingsStatus>("loading");

  const columns = useMemo<ColumnDef<CandidateListItem>[]>(
    () =>
      buildCandidateColumns({
        workspaceId,
        currentUserId,
        membershipRole,
        messages,
        onEditStatus,
        onReview,
      }),
    [
      currentUserId,
      membershipRole,
      messages,
      onEditStatus,
      onReview,
      workspaceId,
    ],
  );

  const tableColumnSettingsPayload = useMemo<CandidateTableColumnSettings>(
    () => ({
      columnVisibility,
      columnOrder,
      columnPinning,
      hiddenStatuses,
    }),
    [columnOrder, columnPinning, columnVisibility, hiddenStatuses],
  );

  useEffect(() => {
    setPortalReady(true);
  }, []);

  useEffect(() => {
    let active = true;

    async function loadColumnSettings() {
      setTableSettingsStatus("loading");

      try {
        const response = await fetch(
          `/api/preferences/${CANDIDATE_TABLE_SETTINGS_KEY}`,
        );
        if (!response.ok) throw new Error("Failed to load table settings.");

        const data = (await response.json()) as { value?: unknown };
        const settings = normalizeCandidateTableColumnSettings(data.value);

        if (!active) return;

        if (settings) {
          setColumnVisibility(settings.columnVisibility);
          setColumnOrder(settings.columnOrder);
          setColumnPinning(settings.columnPinning);
          setHiddenStatuses(settings.hiddenStatuses);
          setTableSettingsStatus("saved");
        } else {
          setTableSettingsStatus("idle");
        }
      } catch {
        if (active) setTableSettingsStatus("error");
      } finally {
        if (active) setSettingsLoaded(true);
      }
    }

    loadColumnSettings();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!settingsLoaded) return;

    const controller = new AbortController();
    const timeoutId = window.setTimeout(async () => {
      setTableSettingsStatus("saving");

      try {
        const response = await fetch(
          `/api/preferences/${CANDIDATE_TABLE_SETTINGS_KEY}`,
          {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ value: tableColumnSettingsPayload }),
            signal: controller.signal,
          },
        );

        if (!response.ok) throw new Error("Failed to save table settings.");
        setTableSettingsStatus("saved");
      } catch (error) {
        if (controller.signal.aborted) return;
        setTableSettingsStatus("error");
      }
    }, 500);

    return () => {
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [settingsLoaded, tableColumnSettingsPayload]);

  const tableCandidates = useMemo(() => {
    if (!hiddenStatuses.length) return candidates;

    const hiddenStatusSet = new Set(hiddenStatuses);
    return candidates.filter(
      (candidate) =>
        !hiddenStatusSet.has(candidate.status as CandidateStatusType),
    );
  }, [candidates, hiddenStatuses]);

  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: tableCandidates,
    columns,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      columnOrder,
      columnPinning,
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onColumnOrderChange: setColumnOrder,
    onColumnPinningChange: setColumnPinning,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    enableColumnPinning: true,
    enableSortingRemoval: true,
  });

  const orderedColumns = columnOrder
    .map((columnId) => table.getColumn(columnId))
    .filter((column): column is Column<CandidateListItem, unknown> =>
      Boolean(column),
    );
  const tableRows = table.getRowModel().rows;
  const visibleColumnCount = table.getVisibleLeafColumns().length;
  const groupedStatusRows = useMemo(() => {
    const groups = new Map<CandidateStatusType, Row<CandidateListItem>[]>();

    CANDIDATE_STATUSES.forEach((status) => groups.set(status, []));

    tableRows.forEach((row) => {
      const status = row.original.status as CandidateStatusType;
      groups.get(status)?.push(row);
    });

    return CANDIDATE_STATUSES.map((status) => ({
      status,
      rows: groups.get(status) ?? [],
    })).filter((group) => group.rows.length > 0);
  }, [tableRows]);

  function resetTableControls() {
    setSorting([{ id: "createdAt", desc: true }]);
    setColumnFilters([]);
  }

  function resetColumnLayout() {
    setColumnOrder(defaultCandidateColumnOrder);
    setColumnVisibility(defaultColumnVisibility);
    setColumnPinning(defaultColumnPinning);
    setHiddenStatuses([]);
  }

  function toggleHiddenStatus(status: CandidateStatusType) {
    setHiddenStatuses((current) =>
      current.includes(status)
        ? current.filter((item) => item !== status)
        : [...current, status],
    );
  }

  function toggleStatusGroup(status: CandidateStatusType) {
    setCollapsedStatusGroups((current) =>
      current.includes(status)
        ? current.filter((item) => item !== status)
        : [...current, status],
    );
  }

  function reorderColumn(draggedColumnId: string, targetColumnId: string) {
    if (draggedColumnId === targetColumnId) return;

    setColumnOrder((current) => {
      const next = current.length ? [...current] : [...defaultCandidateColumnOrder];
      const from = next.indexOf(draggedColumnId);
      const to = next.indexOf(targetColumnId);

      if (from < 0 || to < 0) return next;

      const [column] = next.splice(from, 1);
      next.splice(to, 0, column);
      return next;
    });

    setColumnPinning((current) => {
      const left = [...(current.left ?? [])].filter(
        (id) => id !== draggedColumnId,
      );
      const right = [...(current.right ?? [])].filter(
        (id) => id !== draggedColumnId,
      );
      const targetLeftIndex = left.indexOf(targetColumnId);
      const targetRightIndex = right.indexOf(targetColumnId);

      if (targetLeftIndex >= 0) {
        left.splice(targetLeftIndex, 0, draggedColumnId);
      } else if (targetRightIndex >= 0) {
        right.splice(targetRightIndex, 0, draggedColumnId);
      }

      return { left, right };
    });
  }

  function moveColumn(columnId: string, direction: -1 | 1) {
    const current = columnOrder.length
      ? columnOrder
      : defaultCandidateColumnOrder;
    const from = current.indexOf(columnId);
    const targetColumnId = current[from + direction];

    if (!targetColumnId) return;
    reorderColumn(columnId, targetColumnId);
  }

  useEffect(() => {
    if (!settingsOpen && !isTableFullscreen) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        if (settingsOpen) {
          setSettingsOpen(false);
        } else {
          setIsTableFullscreen(false);
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isTableFullscreen, settingsOpen]);

  useEffect(() => {
    if (!isTableFullscreen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isTableFullscreen]);

  function renderCandidateTableRow(row: Row<CandidateListItem>) {
    const status = row.original.status as CandidateStatusType;

    return (
      <tr
        key={row.id}
        className={cn(
          "group align-top transition hover:brightness-[0.985]",
          statusSurfaceMap[status],
        )}
      >
        {row.getVisibleCells().map((cell) => (
          <td
            key={cell.id}
            className={cn(
              "border-b border-white/75 px-4 py-4 text-sm shadow-[inset_0_-1px_0_rgba(255,255,255,0.6)]",
              cell.column.getIsPinned() && "bg-white/95",
            )}
            style={{
              width: cell.column.getSize(),
              ...getPinnedColumnStyle(cell.column),
            }}
          >
            {flexRender(cell.column.columnDef.cell, cell.getContext())}
          </td>
        ))}
      </tr>
    );
  }

  const tableShell = (
    <div
      className={cn(
        "overflow-hidden rounded-[1.8rem] border border-white/70 bg-white/92 shadow-[0_24px_65px_rgba(160,57,100,0.1)] backdrop-blur-xl",
        isTableFullscreen &&
          "fixed inset-0 z-[60] flex h-screen w-screen flex-col rounded-none border-0 bg-white shadow-none",
      )}
    >
      <div className="flex flex-col gap-4 border-b border-primary/10 bg-[linear-gradient(135deg,rgba(255,231,237,0.72),rgba(255,255,255,0.95))] px-5 py-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <p className="text-sm font-black text-on-surface">
            Danh sách CV dạng bảng
          </p>
          <p className="mt-1 text-xs font-semibold uppercase tracking-[0.16em] text-outline">
            {table.getFilteredRowModel().rows.length}/{candidates.length} hồ sơ
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {getTableSettingsStatusText(tableSettingsStatus) ? (
            <span
              className={cn(
                "rounded-full bg-white/75 px-3 py-2 text-xs font-black uppercase tracking-[0.12em]",
                tableSettingsStatus === "error"
                  ? "text-rose-600"
                  : "text-outline",
              )}
            >
              {getTableSettingsStatusText(tableSettingsStatus)}
            </span>
          ) : null}
          <Button
            variant="ghost"
            className="h-10 gap-2 bg-white px-4"
            onClick={resetTableControls}
          >
            <FilterX className="size-4" />
            Xóa lọc/sắp xếp
          </Button>
          <Button
            variant="ghost"
            className={cn(
              "h-10 gap-2 px-4 shadow-[0_10px_24px_rgba(15,23,42,0.06)]",
              groupByStatus
                ? "bg-primary text-white hover:bg-primary/90 hover:text-white"
                : "bg-white",
            )}
            onClick={() => setGroupByStatus((current) => !current)}
          >
            <Table2 className="size-4" />
            {groupByStatus ? "Đang gom trạng thái" : "Gom trạng thái"}
          </Button>
          <Button
            variant="ghost"
            className="h-10 gap-2 bg-white px-4"
            onClick={() => setSettingsOpen(true)}
          >
            <Settings2 className="size-4" />
            Cài đặt cột
          </Button>
          <button
            type="button"
            onClick={() => setIsTableFullscreen((current) => !current)}
            className="inline-flex size-10 items-center justify-center rounded-full bg-white text-on-surface shadow-[0_10px_24px_rgba(15,23,42,0.08)] transition hover:bg-primary-container/70 hover:text-primary"
            aria-label={
              isTableFullscreen
                ? "Thu nhỏ bảng CV"
                : "Mở bảng CV toàn màn hình"
            }
            title={
              isTableFullscreen
                ? "Thu nhỏ bảng CV"
                : "Mở bảng CV toàn màn hình"
            }
          >
            {isTableFullscreen ? (
              <Minimize2 className="size-4" />
            ) : (
              <Maximize2 className="size-4" />
            )}
          </button>
        </div>
      </div>

      <div
        className={cn(
          "max-h-[72vh] overflow-auto",
          isTableFullscreen && "min-h-0 flex-1 max-h-none",
        )}
      >
        <table
          className="w-full min-w-[1900px] border-separate border-spacing-0 text-left"
          style={{ width: table.getTotalSize() }}
        >
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    className="sticky top-0 z-20 border-b border-primary/10 bg-white/95 px-4 py-3 align-top shadow-[inset_0_-1px_0_rgba(160,57,100,0.08)] backdrop-blur"
                    style={{
                      width: header.getSize(),
                      ...getPinnedColumnStyle(header.column, true),
                    }}
                  >
                    <div className="space-y-2">
                      <button
                        type="button"
                        onClick={header.column.getToggleSortingHandler()}
                        disabled={!header.column.getCanSort()}
                        className={cn(
                          "flex w-full items-center justify-between gap-2 text-left text-xs font-black uppercase tracking-[0.14em] text-outline",
                          header.column.getCanSort() &&
                            "cursor-pointer transition hover:text-primary",
                        )}
                      >
                        <span>
                          {flexRender(
                            header.column.columnDef.header,
                            header.getContext(),
                          )}
                        </span>
                        <SortIcon state={header.column.getIsSorted()} />
                      </button>
                      <ColumnFilter column={header.column} />
                    </div>
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {groupByStatus
              ? groupedStatusRows.map((group) => {
                  const meta = candidateStatusMeta[group.status];
                  const collapsed = collapsedStatusGroups.includes(
                    group.status,
                  );

                  return (
                    <Fragment key={group.status}>
                      <tr>
                        <td
                          colSpan={visibleColumnCount}
                          className={cn(
                            "sticky left-0 z-10 border-b border-white/80 p-0",
                            statusSurfaceMap[group.status],
                          )}
                        >
                          <button
                            type="button"
                            onClick={() => toggleStatusGroup(group.status)}
                            className="flex w-full items-center justify-between gap-4 bg-white/55 px-4 py-3 text-left transition hover:bg-white/85"
                          >
                            <span className="flex min-w-0 flex-wrap items-center gap-3">
                              <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-white text-primary shadow-[0_8px_20px_rgba(15,23,42,0.08)]">
                                {collapsed ? (
                                  <ChevronRight className="size-4" />
                                ) : (
                                  <ChevronDown className="size-4" />
                                )}
                              </span>
                              <Badge className={meta.className}>
                                {meta.label}
                              </Badge>
                              <span className="text-sm font-black text-on-surface">
                                {group.rows.length} hồ sơ
                              </span>
                            </span>
                            <span className="shrink-0 text-xs font-black uppercase tracking-[0.14em] text-outline">
                              {collapsed ? "Mở nhóm" : "Thu nhóm"}
                            </span>
                          </button>
                        </td>
                      </tr>
                      {collapsed
                        ? null
                        : group.rows.map((row) => renderCandidateTableRow(row))}
                    </Fragment>
                  );
                })
              : tableRows.map((row) => renderCandidateTableRow(row))}
            {!tableRows.length ? (
              <tr>
                <td
                  colSpan={visibleColumnCount}
                  className="bg-white px-6 py-10 text-center text-sm font-semibold text-on-surface-variant"
                >
                  Không có hồ sơ phù hợp bộ lọc đang chọn.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );

  const settingsDialog = settingsOpen ? (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/35 px-4 py-6 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="candidate-column-settings-title"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setSettingsOpen(false);
            }
          }}
        >
          <div className="relative flex max-h-[88vh] w-full max-w-6xl flex-col overflow-hidden rounded-[1.8rem] border border-white/75 bg-white shadow-[0_30px_90px_rgba(15,23,42,0.28)]">
            <div className="flex flex-col gap-4 border-b border-primary/10 bg-[linear-gradient(135deg,rgba(255,231,237,0.78),rgba(255,255,255,0.97))] px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p
                  id="candidate-column-settings-title"
                  className="text-lg font-black text-on-surface"
                >
                  Cài đặt cột bảng CV
                </p>
                <p className="mt-1 text-sm font-medium leading-6 text-on-surface-variant">
                  Kéo thả để đổi thứ tự, bật/tắt cột và ghim cột quan trọng.
                </p>
              </div>
              <div className="flex items-center gap-2">
                {getTableSettingsStatusText(tableSettingsStatus) ? (
                  <span
                    className={cn(
                      "rounded-full bg-white/80 px-3 py-2 text-xs font-black uppercase tracking-[0.12em]",
                      tableSettingsStatus === "error"
                        ? "text-rose-600"
                        : "text-outline",
                    )}
                  >
                    {getTableSettingsStatusText(tableSettingsStatus)}
                  </span>
                ) : null}
                <button
                  type="button"
                  onClick={() => setSettingsOpen(false)}
                  className="inline-flex size-10 items-center justify-center rounded-full bg-white text-on-surface transition hover:bg-primary-container/70 hover:text-primary"
                  aria-label="Đóng cài đặt cột"
                >
                  <X className="size-5" />
                </button>
              </div>
            </div>
            <div className="overflow-y-auto">
              <ColumnSettingsPanel
                columns={orderedColumns}
                hiddenStatuses={hiddenStatuses}
                onReorderColumn={reorderColumn}
                onMoveColumn={moveColumn}
                onToggleHiddenStatus={toggleHiddenStatus}
                onReset={resetColumnLayout}
              />
            </div>
          </div>
        </div>
  ) : null;

  return (
    <>
      {isTableFullscreen && portalReady
        ? createPortal(
            <>
              <div className="fixed inset-0 z-[55] bg-white" />
              {tableShell}
            </>,
            document.body,
          )
        : tableShell}
      {settingsDialog && portalReady
        ? createPortal(settingsDialog, document.body)
        : settingsDialog}
    </>
  );
}

function buildCandidateColumns({
  workspaceId,
  currentUserId,
  membershipRole,
  messages,
  onEditStatus,
  onReview,
}: {
  workspaceId: string;
  currentUserId: string;
  membershipRole: WorkspaceRoleType;
  messages: Record<
    string,
    { text: string; tone: "success" | "error" | "muted" }
  >;
  onEditStatus: (candidateId: string) => void;
  onReview: (candidateId: string) => void;
}): ColumnDef<CandidateListItem>[] {
  return [
    {
      id: "candidate",
      accessorFn: (candidate) => candidate.fullName ?? "",
      header: candidateColumnLabels.candidate,
      size: 260,
      enableHiding: false,
      cell: ({ row }) => {
        const candidate = row.original;
        return (
          <div className="space-y-1">
            <Link
              href={`/workspace/${workspaceId}/candidates/${candidate.id}`}
              className="font-black leading-6 text-on-surface underline-offset-4 transition hover:text-primary hover:underline"
            >
              {candidate.fullName || "Chưa có tên ứng viên"}
            </Link>
          </div>
        );
      },
    },
    {
      id: "contact",
      accessorFn: (candidate) =>
        `${candidate.email ?? ""} ${candidate.phone ?? ""}`,
      header: candidateColumnLabels.contact,
      size: 240,
      cell: ({ row }) => (
        <div className="space-y-1">
          <p className="font-semibold text-on-surface">
            {row.original.email || "Chưa có email"}
          </p>
          <p className="text-xs font-semibold text-on-surface-variant">
            {row.original.phone || "Chưa có SĐT"}
          </p>
        </div>
      ),
    },
    {
      id: "position",
      accessorFn: (candidate) => candidate.position ?? "",
      header: candidateColumnLabels.position,
      size: 220,
      cell: ({ getValue }) => (
        <p className="font-semibold text-on-surface">
          {getValue<string>() || "Chưa có vị trí"}
        </p>
      ),
    },
    {
      id: "cvInfo",
      accessorFn: (candidate) => getCandidateCvInfo(candidate) ?? "",
      header: candidateColumnLabels.cvInfo,
      size: 320,
      cell: ({ getValue }) => (
        <p className="line-clamp-3 text-sm font-medium leading-6 text-on-surface-variant">
          {shortenText(getValue<string>(), 150) || "Chưa có thông tin thêm"}
        </p>
      ),
    },
    {
      id: "expectedSalary",
      accessorFn: (candidate) => candidate.expectedSalary ?? "",
      header: candidateColumnLabels.expectedSalary,
      size: 180,
      cell: ({ getValue }) => (
        <p className="font-semibold text-on-surface">
          {getValue<string>() || "Chưa nhập"}
        </p>
      ),
    },
    {
      id: "status",
      accessorFn: (candidate) => candidate.status,
      header: candidateColumnLabels.status,
      size: 180,
      cell: ({ row }) => {
        const status = row.original.status as CandidateStatusType;
        const statusMeta = candidateStatusMeta[status];
        return (
          <Badge
            className={cn(
              statusMeta.className,
              "whitespace-nowrap px-2 py-0.5 text-[10px] leading-4 tracking-[0.08em]",
            )}
          >
            {statusMeta.label}
          </Badge>
        );
      },
    },
    {
      id: "hr",
      accessorFn: (candidate) => candidate.hr.name,
      header: candidateColumnLabels.hr,
      size: 170,
      cell: ({ getValue }) => (
        <p className="font-semibold text-on-surface">{getValue<string>()}</p>
      ),
    },
    {
      id: "source",
      accessorFn: (candidate) => candidate.source ?? "",
      header: candidateColumnLabels.source,
      size: 160,
      cell: ({ getValue }) => (
        <p className="font-semibold text-on-surface-variant">
          {getValue<string>() || "Chưa rõ"}
        </p>
      ),
    },
    {
      id: "project",
      accessorFn: (candidate) => candidate.projectName ?? "",
      header: candidateColumnLabels.project,
      size: 220,
      cell: ({ getValue }) => (
        <p className="font-semibold text-on-surface">
          {getValue<string>() || "Chưa gắn dự án"}
        </p>
      ),
    },
    {
      id: "createdAt",
      accessorFn: (candidate) => formatDate(candidate.createdAt),
      sortingFn: (left, right) =>
        getTime(left.original.createdAt) - getTime(right.original.createdAt),
      header: candidateColumnLabels.createdAt,
      size: 150,
      cell: ({ row }) => (
        <p className="font-semibold text-on-surface">
          {formatDate(row.original.createdAt)}
        </p>
      ),
    },
    {
      id: "interview",
      accessorFn: (candidate) =>
        `${candidate.interviewDate ? formatDateTime(candidate.interviewDate) : ""} ${candidate.interviewerName ?? ""}`,
      sortingFn: (left, right) =>
        getTime(left.original.interviewDate) -
        getTime(right.original.interviewDate),
      header: candidateColumnLabels.interview,
      size: 240,
      cell: ({ row }) => (
        <div className="space-y-1">
          <p className="font-semibold text-on-surface">
            {row.original.interviewDate
              ? formatDateTime(row.original.interviewDate)
              : "Chưa lên lịch"}
          </p>
          <p className="text-xs font-semibold text-on-surface-variant">
            {row.original.interviewerName || "Chưa có người phỏng vấn"}
          </p>
        </div>
      ),
    },
    {
      id: "managerDecision",
      accessorFn: (candidate) => candidate.managerDecision || "PENDING",
      header: candidateColumnLabels.managerDecision,
      size: 230,
      cell: ({ row }) => {
        const reviewMeta =
          managerDecisionMeta[
            (row.original.managerDecision as ManagerDecisionType) || "PENDING"
          ];
        return (
          <div className="space-y-2">
            <Badge className={reviewMeta.className}>{reviewMeta.label}</Badge>
            <p className="text-xs font-semibold leading-5 text-on-surface-variant">
              {row.original.managerReviewedByName
                ? `${row.original.managerReviewedByName}${row.original.managerReviewedAt ? ` • ${formatDateTime(row.original.managerReviewedAt)}` : ""}`
                : "Chưa có đánh giá"}
            </p>
          </div>
        );
      },
    },
    {
      id: "managerOfferSalary",
      accessorFn: (candidate) => candidate.managerOfferSalary ?? "",
      header: candidateColumnLabels.managerOfferSalary,
      size: 180,
      cell: ({ getValue }) => (
        <p className="font-semibold text-on-surface">
          {getValue<string>() || "Chưa đề xuất"}
        </p>
      ),
    },
    {
      id: "actions",
      header: candidateColumnLabels.actions,
      size: 260,
      enableColumnFilter: false,
      enableHiding: false,
      enableSorting: false,
      cell: ({ row }) => {
        const candidate = row.original;
        const editable = canEditCandidate(
          candidate,
          currentUserId,
          membershipRole,
        );
        const reviewable = canReviewCandidate(membershipRole);
        const message = messages[candidate.id];

        return (
          <div className="space-y-2">
            <div className="flex flex-wrap justify-end gap-2">
              {editable ? (
                <Button
                  variant="secondary"
                  className="h-9 gap-1.5 rounded-[0.85rem] px-3 text-xs"
                  onClick={() => onEditStatus(candidate.id)}
                >
                  <CheckCircle2 className="size-3.5" />
                  Trạng thái
                </Button>
              ) : null}
              {reviewable ? (
                <Button
                  className="h-9 gap-1.5 rounded-[0.85rem] px-3 text-xs"
                  onClick={() => onReview(candidate.id)}
                >
                  <ClipboardCheck className="size-3.5" />
                  Đánh giá
                </Button>
              ) : null}
              <Link href={`/workspace/${workspaceId}/candidates/${candidate.id}`}>
                <Button
                  variant="ghost"
                  className="h-9 gap-1.5 rounded-[0.85rem] border-primary/15 bg-surface-container-low/90 px-3 text-xs shadow-[0_10px_26px_rgba(160,57,100,0.08)] hover:bg-primary-container/70"
                >
                  <Eye className="size-3.5" />
                  Chi tiết
                </Button>
              </Link>
            </div>
            {message?.text ? (
              <p
                className={cn(
                  "text-right text-xs font-semibold",
                  message.tone === "success" && "text-emerald-600",
                  message.tone === "error" && "text-rose-600",
                  message.tone === "muted" && "text-on-surface-variant",
                )}
              >
                {message.text}
              </p>
            ) : null}
          </div>
        );
      },
    },
  ];
}

function getPinnedColumnStyle(
  column: Column<CandidateListItem, unknown>,
  isHeader = false,
) {
  const pinned = column.getIsPinned();
  const isLastLeftPinned = pinned === "left" && column.getIsLastColumn("left");
  const isFirstRightPinned =
    pinned === "right" && column.getIsFirstColumn("right");

  return {
    boxShadow: isLastLeftPinned
      ? "8px 0 18px -18px rgba(15,23,42,0.45)"
      : isFirstRightPinned
        ? "-8px 0 18px -18px rgba(15,23,42,0.45)"
        : undefined,
    left: pinned === "left" ? `${column.getStart("left")}px` : undefined,
    right: pinned === "right" ? `${column.getAfter("right")}px` : undefined,
    opacity: pinned ? 0.98 : 1,
    position: pinned ? ("sticky" as const) : undefined,
    zIndex: pinned ? (isHeader ? 45 : 25) : isHeader ? 35 : undefined,
  };
}

function SortIcon({ state }: { state: false | "asc" | "desc" }) {
  if (state === "asc") return <ArrowUp className="size-3.5 text-primary" />;
  if (state === "desc") return <ArrowDown className="size-3.5 text-primary" />;
  return <span className="size-3.5 rounded-full border border-outline/30" />;
}

function ColumnFilter({
  column,
}: {
  column: Column<CandidateListItem, unknown>;
}) {
  if (!column.getCanFilter()) {
    return <div className="h-9" />;
  }

  const value = (column.getFilterValue() ?? "") as string;

  if (column.id === "status") {
    return (
      <select
        value={value}
        onChange={(event) => column.setFilterValue(event.target.value || undefined)}
        className="h-9 w-full rounded-[0.85rem] border border-primary/10 bg-white px-3 text-xs font-semibold text-on-surface outline-none transition focus:border-primary/25 focus:ring-4 focus:ring-primary/10"
      >
        <option value="">Tất cả</option>
        {CANDIDATE_STATUSES.map((status) => (
          <option key={status} value={status}>
            {candidateStatusMeta[status].label}
          </option>
        ))}
      </select>
    );
  }

  if (column.id === "managerDecision") {
    return (
      <select
        value={value}
        onChange={(event) => column.setFilterValue(event.target.value || undefined)}
        className="h-9 w-full rounded-[0.85rem] border border-primary/10 bg-white px-3 text-xs font-semibold text-on-surface outline-none transition focus:border-primary/25 focus:ring-4 focus:ring-primary/10"
      >
        <option value="">Tất cả</option>
        {MANAGER_DECISIONS.map((decision) => (
          <option key={decision} value={decision}>
            {managerDecisionMeta[decision].label}
          </option>
        ))}
      </select>
    );
  }

  return (
    <input
      value={value}
      onChange={(event) => column.setFilterValue(event.target.value || undefined)}
      placeholder="Lọc..."
      className="h-9 w-full rounded-[0.85rem] border border-primary/10 bg-white px-3 text-xs font-semibold text-on-surface placeholder:text-outline outline-none transition focus:border-primary/25 focus:ring-4 focus:ring-primary/10"
    />
  );
}

function ColumnSettingsPanel({
  columns,
  hiddenStatuses,
  onReorderColumn,
  onMoveColumn,
  onToggleHiddenStatus,
  onReset,
}: {
  columns: Column<CandidateListItem, unknown>[];
  hiddenStatuses: CandidateStatusType[];
  onReorderColumn: (draggedColumnId: string, targetColumnId: string) => void;
  onMoveColumn: (columnId: string, direction: -1 | 1) => void;
  onToggleHiddenStatus: (status: CandidateStatusType) => void;
  onReset: () => void;
}) {
  const [draggingColumnId, setDraggingColumnId] = useState<string | null>(null);
  const [dropTargetColumnId, setDropTargetColumnId] = useState<string | null>(
    null,
  );

  function clearDragState() {
    setDraggingColumnId(null);
    setDropTargetColumnId(null);
  }

  return (
    <div className="px-5 py-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-sm font-black text-on-surface">Cài đặt bảng</p>
          <p className="mt-1 text-sm font-medium leading-6 text-on-surface-variant">
            Bật/tắt cột, đổi thứ tự hiển thị và ghim cột quan trọng sang trái
            hoặc phải.
          </p>
        </div>
        <Button variant="ghost" className="h-10 bg-white px-4" onClick={onReset}>
          Khôi phục mặc định
        </Button>
      </div>

      <div className="mt-5 rounded-[1.4rem] border border-primary/10 bg-surface-container-low p-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-black text-on-surface">
              Ẩn trạng thái khỏi bảng Excel
            </p>
            <p className="mt-1 text-sm font-medium leading-6 text-on-surface-variant">
              Các trạng thái được chọn sẽ không xuất hiện trong danh sách bảng.
            </p>
          </div>
          {hiddenStatuses.length ? (
            <p className="text-xs font-black uppercase tracking-[0.14em] text-primary">
              Đang ẩn {hiddenStatuses.length} trạng thái
            </p>
          ) : null}
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {CANDIDATE_STATUSES.map((status) => {
            const meta = candidateStatusMeta[status];
            const hidden = hiddenStatuses.includes(status);

            return (
              <label
                key={status}
                className={cn(
                  "flex cursor-pointer items-center justify-between gap-3 rounded-[1rem] border px-3 py-2 transition",
                  hidden
                    ? "border-primary/30 bg-white shadow-[0_10px_24px_rgba(160,57,100,0.08)]"
                    : "border-white/70 bg-white/65 hover:bg-white",
                )}
              >
                <span className="flex min-w-0 items-center gap-2">
                  <input
                    type="checkbox"
                    checked={hidden}
                    onChange={() => onToggleHiddenStatus(status)}
                    className="size-4 accent-primary"
                  />
                  <span className="truncate text-sm font-black text-on-surface">
                    {meta.label}
                  </span>
                </span>
                <span
                  className={cn(
                    "rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.08em]",
                    hidden
                      ? "bg-primary text-white"
                      : "bg-surface-container-high text-outline",
                  )}
                >
                  {hidden ? "Ẩn" : "Hiện"}
                </span>
              </label>
            );
          })}
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {columns.map((column, index) => {
          const id = column.id as CandidateColumnId;
          const pinned = column.getIsPinned();
          const isDragging = draggingColumnId === column.id;
          const isDropTarget =
            dropTargetColumnId === column.id && draggingColumnId !== column.id;

          return (
            <div
              key={column.id}
              draggable
              onDragStart={(event) => {
                event.dataTransfer.effectAllowed = "move";
                event.dataTransfer.setData("text/plain", column.id);
                setDraggingColumnId(column.id);
              }}
              onDragOver={(event) => {
                event.preventDefault();
                event.dataTransfer.dropEffect = "move";
                setDropTargetColumnId(column.id);
              }}
              onDragLeave={() => {
                setDropTargetColumnId((current) =>
                  current === column.id ? null : current,
                );
              }}
              onDrop={(event) => {
                event.preventDefault();
                const draggedId =
                  event.dataTransfer.getData("text/plain") || draggingColumnId;
                if (draggedId) {
                  onReorderColumn(draggedId, column.id);
                }
                clearDragState();
              }}
              onDragEnd={clearDragState}
              className={cn(
                "cursor-grab rounded-[1.2rem] border bg-surface-container-low px-3 py-3 transition active:cursor-grabbing",
                isDragging
                  ? "border-primary/40 opacity-55 shadow-[0_18px_38px_rgba(160,57,100,0.16)]"
                  : "border-primary/10",
                isDropTarget &&
                  "border-primary bg-primary-container/55 shadow-[0_18px_38px_rgba(160,57,100,0.16)]",
              )}
            >
              <div className="flex items-center justify-between gap-3">
                <GripVertical className="size-4 shrink-0 text-outline" />
                <label className="flex min-w-0 items-center gap-2 text-sm font-black text-on-surface">
                  <input
                    type="checkbox"
                    checked={column.getIsVisible()}
                    disabled={!column.getCanHide()}
                    onChange={column.getToggleVisibilityHandler()}
                    className="size-4 accent-primary"
                  />
                  <span className="truncate">
                    {candidateColumnLabels[id] ?? column.id}
                  </span>
                </label>
                <div className="flex shrink-0 gap-1">
                  <IconButton
                    label="Đưa lên trước"
                    disabled={index === 0}
                    onClick={() => onMoveColumn(column.id, -1)}
                  >
                    <ArrowUp className="size-3.5" />
                  </IconButton>
                  <IconButton
                    label="Đưa xuống sau"
                    disabled={index === columns.length - 1}
                    onClick={() => onMoveColumn(column.id, 1)}
                  >
                    <ArrowDown className="size-3.5" />
                  </IconButton>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => column.pin(pinned === "left" ? false : "left")}
                  className={cn(
                    "inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-black transition",
                    pinned === "left"
                      ? "bg-primary text-white"
                      : "bg-white text-on-surface hover:text-primary",
                  )}
                >
                  <Pin className="size-3.5" />
                  Trái
                </button>
                <button
                  type="button"
                  onClick={() => column.pin(pinned === "right" ? false : "right")}
                  className={cn(
                    "inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-black transition",
                    pinned === "right"
                      ? "bg-primary text-white"
                      : "bg-white text-on-surface hover:text-primary",
                  )}
                >
                  <Pin className="size-3.5" />
                  Phải
                </button>
                {pinned ? (
                  <button
                    type="button"
                    onClick={() => column.pin(false)}
                    className="inline-flex h-8 items-center gap-1.5 rounded-full bg-white px-3 text-xs font-black text-on-surface transition hover:text-primary"
                  >
                    <PinOff className="size-3.5" />
                    Bỏ ghim
                  </button>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function IconButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="inline-flex size-8 items-center justify-center rounded-full bg-white text-on-surface transition hover:text-primary disabled:pointer-events-none disabled:opacity-35"
    >
      {children}
    </button>
  );
}

function CandidatesCardView({
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
    <div className="space-y-4">
      {candidates.map((candidate) => {
        const status = candidate.status as CandidateStatusType;
        const meta = candidateStatusMeta[status];
        const reviewMeta =
          managerDecisionMeta[
            (candidate.managerDecision as ManagerDecisionType) || "PENDING"
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
                <InfoCard icon={CircleUserRound} label="HR phụ trách" value={candidate.hr.name} />
                <InfoCard icon={FolderSearch} label="Nguồn" value={candidate.source || "Chưa rõ"} />
                <InfoCard icon={CalendarDays} label="Ngày nhận" value={formatDate(candidate.createdAt)} />
                <InfoCard icon={UserRoundSearch} label="Người phỏng vấn" value={candidate.interviewerName || "Chưa có lịch"} />
                <InfoCard icon={BriefcaseBusiness} label="Dự án" value={candidate.projectName || "Chưa gắn dự án"} />
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
                        value={candidate.managerOfferSalary || "Chưa đề xuất"}
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
                        onClick={() => onEditStatus(candidate.id)}
                      >
                        Chỉnh trạng thái
                      </Button>
                    ) : null}

                    {reviewable ? (
                      <Button onClick={() => onReview(candidate.id)}>
                        Đánh giá quản lý
                      </Button>
                    ) : null}

                    <Link href={`/workspace/${workspaceId}/candidates/${candidate.id}`}>
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
                      HR này không phụ trách hồ sơ này nên chỉ có quyền xem.
                    </p>
                  ) : null}

                  {message?.text ? (
                    <p
                      className={cn(
                        "mt-4 text-sm font-semibold",
                        message.tone === "success" && "text-emerald-600",
                        message.tone === "error" && "text-rose-600",
                        message.tone === "muted" && "text-on-surface-variant",
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
  );
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
    <div className="rounded-[1.2rem] border border-white/85 bg-white/96 p-3">
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
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/35 px-4 py-8 backdrop-blur-sm">
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
