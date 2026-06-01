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
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  ClipboardCheck,
  Eye,
  EyeOff,
  FilterX,
  GripVertical,
  Maximize2,
  Minimize2,
  Pin,
  PinOff,
  Settings2,
  Table2,
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
  type WorkspaceDropdownOption,
  type WorkspaceRoleType,
} from "@/types";
import {
  candidateStatusMeta,
  cn,
  formatDate,
  formatDateTime,
  getCandidateStatusOptions,
  managerDecisionMeta,
  managerFinalStatusMeta,
  normalizeCandidateStatus,
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
  updatedAt: Date | string;
  interviewDate: string | null;
  interviewerName: string | null;
  projectName: string | null;
  managerDecision: string;
  managerOfferSalary: string | null;
  managerReviewNote: string | null;
  managerReviewedAt: Date | string | null;
  managerReviewedByName: string | null;
  noHireReason: string | null;
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
  noHireReason: string;
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
  | "updatedAt"
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

const INTERVIEW_REQUIRED_STATUSES: CandidateStatusType[] = ["INTERVIEW"];

const statusSurfaceMap: Record<CandidateStatusType, string> = {
  NEW: "bg-[linear-gradient(145deg,rgba(255,231,237,0.72),rgba(255,255,255,0.97))] border-primary/15",
  INTERVIEW:
    "bg-[linear-gradient(145deg,rgba(170,237,255,0.46),rgba(255,255,255,0.97))] border-secondary/20",
  OFFER:
    "bg-[linear-gradient(145deg,rgba(255,217,227,0.82),rgba(255,255,255,0.96)_52%,rgba(170,237,255,0.24))] border-primary/20",
  HIRE:
    "bg-[linear-gradient(145deg,rgba(171,239,231,0.5),rgba(255,255,255,0.97))] border-tertiary/25",
  ONBOARDED:
    "bg-[linear-gradient(145deg,rgba(171,239,231,0.58),rgba(255,255,255,0.98))] border-emerald-200/80",
  PERMANENT:
    "bg-[linear-gradient(145deg,rgba(205,250,230,0.72),rgba(255,255,255,0.98))] border-emerald-300/80",
  NO_HIRE:
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
  updatedAt: "Cập nhật",
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
  "updatedAt",
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
  membershipRole: WorkspaceRoleType,
) {
  return membershipRole === "HR_ADMIN" || membershipRole === "HR";
}

function canReviewCandidate(membershipRole: WorkspaceRoleType) {
  return membershipRole === "MANAGER";
}

function getNextHrStatuses(status: string) {
  return getCandidateStatusOptions(status, "hr").filter(
    (option) => option !== normalizeCandidateStatus(status),
  );
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
  membershipRole,
  candidates,
  noHireReasonOptions,
}: {
  workspaceId: string;
  membershipRole: WorkspaceRoleType;
  candidates: CandidateListItem[];
  noHireReasonOptions: WorkspaceDropdownOption[];
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
          status: normalizeCandidateStatus(candidate.status),
          statusNote: "",
          interviewDate: toDateTimeLocalValue(candidate.interviewDate),
          interviewerName: candidate.interviewerName ?? "",
          noHireReason: candidate.noHireReason ?? "",
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
          finalStatus:
            normalizeCandidateStatus(candidate.status) === "OFFER" ? "HIRE" : "",
        },
      ]),
    ),
  );
  const [messages, setMessages] = useState<
    Record<string, { text: string; tone: "success" | "error" | "muted" }>
  >({});
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [activeModal, setActiveModal] = useState<ModalState>(null);
  const [isPending, startTransition] = useTransition();

  const stats = useMemo(() => {
    const total = items.length;
    const pipeline = items.filter((candidate) =>
      ["NEW", "INTERVIEW", "OFFER", "HIRE", "ONBOARDED"].includes(
        normalizeCandidateStatus(candidate.status),
      ),
    ).length;
    const interviewing = items.filter(
      (candidate) => normalizeCandidateStatus(candidate.status) === "INTERVIEW",
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
    if (draft.status === "NO_HIRE" && !draft.noHireReason.trim()) {
      setMessages((current) => ({
        ...current,
        [candidateId]: {
          text: "Cần chọn lý do không tuyển trước khi lưu.",
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
          noHireReason:
            draft.status === "NO_HIRE" ? draft.noHireReason.trim() : "",
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
                noHireReason:
                  draft.status === "NO_HIRE"
                    ? draft.noHireReason.trim()
                    : null,
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
          managerDecision: "APPROVED",
          managerReviewNote: draft.managerReviewNote.trim(),
          status: "HIRE",
          statusNote: "Sếp chốt tuyển từ danh sách ứng viên",
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
                managerDecision: "APPROVED",
                managerReviewNote: draft.managerReviewNote.trim() || null,
                managerReviewedAt: new Date().toISOString(),
                managerReviewedByName: "Bạn",
                status: "HIRE",
              }
            : item,
        ),
      );

      setReviewDrafts((current) => ({
        ...current,
        [candidateId]: {
          ...current[candidateId],
          finalStatus: "HIRE",
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
          Chưa có ứng viên trong kho CV
        </h3>
        <p className="mt-3 text-sm font-medium leading-7 text-on-surface-variant">
          Hãy upload CV mới để bắt đầu quản lý danh sách ứng viên bằng bảng
          Excel.
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

        <CandidatesTable
          workspaceId={workspaceId}
          candidates={items}
          membershipRole={membershipRole}
          messages={messages}
          onEditStatus={(candidateId) =>
            setActiveModal({ candidateId, mode: "status" })
          }
          onReview={(candidateId) =>
            setActiveModal({ candidateId, mode: "review" })
          }
        />
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
              statusOptions={getCandidateStatusOptions(
                activeCandidate.status,
                "hr",
              )}
              noHireReasonOptions={noHireReasonOptions}
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
  membershipRole,
  messages,
  onEditStatus,
  onReview,
}: {
  workspaceId: string;
  candidates: CandidateListItem[];
  membershipRole: WorkspaceRoleType;
  messages: Record<
    string,
    { text: string; tone: "success" | "error" | "muted" }
  >;
  onEditStatus: (candidateId: string) => void;
  onReview: (candidateId: string) => void;
}) {
  const [sorting, setSorting] = useState<SortingState>([
    { id: "updatedAt", desc: true },
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
  const [statusSettingsOpen, setStatusSettingsOpen] = useState(false);
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
        membershipRole,
        messages,
        onEditStatus,
        onReview,
      }),
    [
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
        !hiddenStatusSet.has(normalizeCandidateStatus(candidate.status)),
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
      const status = normalizeCandidateStatus(row.original.status);
      groups.get(status)?.push(row);
    });

    return CANDIDATE_STATUSES.map((status) => ({
      status,
      rows: groups.get(status) ?? [],
    })).filter((group) => group.rows.length > 0);
  }, [tableRows]);

  function resetTableControls() {
    setSorting([{ id: "updatedAt", desc: true }]);
    setColumnFilters([]);
  }

  function resetColumnLayout() {
    setColumnOrder(defaultCandidateColumnOrder);
    setColumnVisibility(defaultColumnVisibility);
    setColumnPinning(defaultColumnPinning);
  }

  function toggleHiddenStatus(status: CandidateStatusType) {
    setHiddenStatuses((current) =>
      current.includes(status)
        ? current.filter((item) => item !== status)
        : [...current, status],
    );
  }

  function selectAllHiddenStatuses() {
    setHiddenStatuses([...CANDIDATE_STATUSES]);
  }

  function clearHiddenStatuses() {
    setHiddenStatuses([]);
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
    if (!settingsOpen && !statusSettingsOpen && !isTableFullscreen) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        if (settingsOpen) {
          setSettingsOpen(false);
        } else if (statusSettingsOpen) {
          setStatusSettingsOpen(false);
        } else {
          setIsTableFullscreen(false);
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isTableFullscreen, settingsOpen, statusSettingsOpen]);

  useEffect(() => {
    if (!isTableFullscreen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isTableFullscreen]);

  function renderCandidateTableRow(row: Row<CandidateListItem>) {
    const status = normalizeCandidateStatus(row.original.status);

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
              minWidth: cell.column.getSize(),
              maxWidth: cell.column.getSize(),
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
            onClick={() => setStatusSettingsOpen(true)}
          >
            <EyeOff className="size-4" />
            Ẩn trạng thái
            {hiddenStatuses.length ? (
              <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-black text-white">
                {hiddenStatuses.length}
              </span>
            ) : null}
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
          className="w-full min-w-[1900px] table-fixed border-separate border-spacing-0 text-left"
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
                      minWidth: header.getSize(),
                      maxWidth: header.getSize(),
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
                onReorderColumn={reorderColumn}
                onMoveColumn={moveColumn}
                onReset={resetColumnLayout}
              />
            </div>
          </div>
        </div>
  ) : null;

  const statusSettingsDialog = statusSettingsOpen ? (
        <StatusVisibilityDialog
          hiddenStatuses={hiddenStatuses}
          tableSettingsStatus={tableSettingsStatus}
          onClose={() => setStatusSettingsOpen(false)}
          onToggleHiddenStatus={toggleHiddenStatus}
          onSelectAll={selectAllHiddenStatuses}
          onClearAll={clearHiddenStatuses}
        />
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
      {statusSettingsDialog && portalReady
        ? createPortal(statusSettingsDialog, document.body)
        : statusSettingsDialog}
    </>
  );
}

function buildCandidateColumns({
  workspaceId,
  membershipRole,
  messages,
  onEditStatus,
  onReview,
}: {
  workspaceId: string;
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
      size: 220,
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
      accessorFn: (candidate) => normalizeCandidateStatus(candidate.status),
      header: candidateColumnLabels.status,
      size: 180,
      cell: ({ row }) => {
        const status = normalizeCandidateStatus(row.original.status);
        const statusMeta = candidateStatusMeta[status];
        return (
          <div className="space-y-1">
            <Badge
              className={cn(
                statusMeta.className,
                "whitespace-nowrap px-2 py-0.5 text-[10px] leading-4 tracking-[0.08em]",
              )}
            >
              {statusMeta.label}
            </Badge>
            {status === "NO_HIRE" && row.original.noHireReason ? (
              <p className="text-xs font-semibold text-rose-700">
                {row.original.noHireReason}
              </p>
            ) : null}
          </div>
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
      id: "updatedAt",
      accessorFn: (candidate) => formatDateTime(candidate.updatedAt),
      sortingFn: (left, right) =>
        getTime(left.original.updatedAt) - getTime(right.original.updatedAt),
      header: candidateColumnLabels.updatedAt,
      size: 170,
      cell: ({ row }) => (
        <p className="font-semibold text-on-surface">
          {formatDateTime(row.original.updatedAt)}
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
        const editable = canEditCandidate(membershipRole);
        const reviewable = canReviewCandidate(membershipRole);
        const status = normalizeCandidateStatus(candidate.status);
        const editableStatus = Boolean(getNextHrStatuses(status).length);
        const message = messages[candidate.id];

        return (
          <div className="space-y-2">
            <div className="flex flex-wrap justify-end gap-2">
              {editable && editableStatus ? (
                <Button
                  variant="secondary"
                  className="h-9 gap-1.5 rounded-[0.85rem] px-3 text-xs"
                  onClick={() => onEditStatus(candidate.id)}
                >
                  <CheckCircle2 className="size-3.5" />
                  Trạng thái
                </Button>
              ) : null}
              {reviewable && status === "OFFER" ? (
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

function StatusVisibilityDialog({
  hiddenStatuses,
  tableSettingsStatus,
  onClose,
  onToggleHiddenStatus,
  onSelectAll,
  onClearAll,
}: {
  hiddenStatuses: CandidateStatusType[];
  tableSettingsStatus: TableSettingsStatus;
  onClose: () => void;
  onToggleHiddenStatus: (status: CandidateStatusType) => void;
  onSelectAll: () => void;
  onClearAll: () => void;
}) {
  const allStatusesSelected =
    hiddenStatuses.length === CANDIDATE_STATUSES.length;
  const statusText = getTableSettingsStatusText(tableSettingsStatus);

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/35 px-4 py-6 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="candidate-status-visibility-title"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="relative flex max-h-[88vh] w-full max-w-3xl flex-col overflow-hidden rounded-[1.8rem] border border-white/75 bg-white shadow-[0_30px_90px_rgba(15,23,42,0.28)]">
        <div className="flex flex-col gap-4 border-b border-primary/10 bg-[linear-gradient(135deg,rgba(255,231,237,0.78),rgba(255,255,255,0.97))] px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p
              id="candidate-status-visibility-title"
              className="text-lg font-black text-on-surface"
            >
              Ẩn trạng thái khỏi bảng Excel
            </p>
            <p className="mt-1 text-sm font-medium leading-6 text-on-surface-variant">
              Chọn các trạng thái không cần hiển thị trong danh sách CV dạng
              bảng.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {statusText ? (
              <span
                className={cn(
                  "rounded-full bg-white/80 px-3 py-2 text-xs font-black uppercase tracking-[0.12em]",
                  tableSettingsStatus === "error"
                    ? "text-rose-600"
                    : "text-outline",
                )}
              >
                {statusText}
              </span>
            ) : null}
            <button
              type="button"
              onClick={onClose}
              className="inline-flex size-10 items-center justify-center rounded-full bg-white text-on-surface transition hover:bg-primary-container/70 hover:text-primary"
              aria-label="Đóng cài đặt ẩn trạng thái"
            >
              <X className="size-5" />
            </button>
          </div>
        </div>

        <div className="overflow-y-auto px-5 py-5">
          <div className="flex flex-col gap-3 rounded-[1.4rem] border border-primary/10 bg-surface-container-low p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-black text-on-surface">
                {hiddenStatuses.length
                  ? `Đang ẩn ${hiddenStatuses.length} trạng thái`
                  : "Chưa ẩn trạng thái nào"}
              </p>
              <p className="mt-1 text-sm font-medium leading-6 text-on-surface-variant">
                Cài đặt này được lưu riêng theo từng tài khoản.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="ghost"
                className="h-10 bg-white px-4"
                onClick={onSelectAll}
                disabled={allStatusesSelected}
              >
                Chọn tất cả
              </Button>
              <Button
                variant="ghost"
                className="h-10 bg-white px-4"
                onClick={onClearAll}
                disabled={!hiddenStatuses.length}
              >
                Bỏ tất cả
              </Button>
            </div>
          </div>

          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {CANDIDATE_STATUSES.map((status) => {
              const meta = candidateStatusMeta[status];
              const hidden = hiddenStatuses.includes(status);

              return (
                <label
                  key={status}
                  className={cn(
                    "flex cursor-pointer items-center justify-between gap-3 rounded-[1rem] border px-3 py-3 transition",
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
      </div>
    </div>
  );
}

function ColumnSettingsPanel({
  columns,
  onReorderColumn,
  onMoveColumn,
  onReset,
}: {
  columns: Column<CandidateListItem, unknown>[];
  onReorderColumn: (draggedColumnId: string, targetColumnId: string) => void;
  onMoveColumn: (columnId: string, direction: -1 | 1) => void;
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

      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
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
  statusOptions,
  noHireReasonOptions,
  isSaving,
  onChange,
  onSave,
}: {
  draft: StatusDraftState;
  statusOptions: CandidateStatusType[];
  noHireReasonOptions: WorkspaceDropdownOption[];
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
        {statusOptions.map((statusOption) => (
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

      {draft.status === "NO_HIRE" ? (
        <select
          className="field bg-surface-container-low"
          value={draft.noHireReason}
          onChange={(event) =>
            onChange({
              noHireReason: event.target.value,
            })
          }
          disabled={isSaving}
          required
        >
          <option value="">Chọn lý do không tuyển</option>
          {noHireReasonOptions.map((reason) => (
            <option key={reason.id} value={reason.name}>
              {reason.name}
            </option>
          ))}
        </select>
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
      <textarea
        rows={5}
        className="field-textarea min-h-32 resize-none bg-surface-container-low"
        placeholder="Ghi chú của sếp (không bắt buộc)"
        value={draft.managerReviewNote}
        onChange={(event) =>
          onChange({
            managerReviewNote: event.target.value,
          })
        }
        disabled={isSaving}
      />

      <p className="rounded-[1.1rem] bg-surface-container-low px-4 py-3 text-sm font-semibold text-on-surface-variant">
        Khi lưu, hồ sơ sẽ chuyển sang trạng thái Đã tuyển.
      </p>

      <div className="flex flex-wrap gap-3">
        <Button onClick={onSave} disabled={isSaving}>
          {isSaving ? "Đang lưu..." : "Chuyển sang Đã tuyển"}
        </Button>
      </div>
    </div>
  );
}
