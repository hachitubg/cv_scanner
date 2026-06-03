import { format } from "date-fns";
import { vi } from "date-fns/locale";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

import {
  CANDIDATE_STATUSES,
  type CandidateStatusType,
  type ManagerDecisionType,
  type ManagerFinalStatusType,
  type WorkspaceRoleType,
} from "@/types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: Date | string) {
  return format(new Date(date), "dd/MM/yyyy", { locale: vi });
}

export function formatDateTime(date: Date | string) {
  return format(new Date(date), "dd/MM/yyyy HH:mm", { locale: vi });
}

export function toDateTimeLocalValue(value?: string | null) {
  if (!value) return "";

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;

  const offset = parsed.getTimezoneOffset();
  const local = new Date(parsed.getTime() - offset * 60 * 1000);
  return local.toISOString().slice(0, 16);
}

export function toBirthYear(value?: string | null) {
  if (!value) return "";

  const trimmed = value.trim();
  const matchedYear = trimmed.match(/\b(?:19|20)\d{2}\b/)?.[0];
  if (matchedYear) return matchedYear;

  const parsed = new Date(trimmed);
  if (!Number.isNaN(parsed.getTime())) {
    return String(parsed.getFullYear());
  }

  return trimmed.slice(0, 4);
}

export const candidateStatusMeta: Record<
  CandidateStatusType,
  { label: string; className: string; shortLabel: string }
> = {
  NEW: {
    label: "Mới nhận",
    shortLabel: "Mới",
    className: "bg-primary-fixed text-on-primary-container",
  },
  INTERVIEW: {
    label: "Mời phỏng vấn",
    shortLabel: "Phỏng vấn",
    className: "bg-secondary-fixed text-on-secondary-container",
  },
  OFFER: {
    label: "Đã Offer",
    shortLabel: "Offer",
    className: "bg-primary text-white",
  },
  HIRE: {
    label: "Đã tuyển",
    shortLabel: "Tuyển",
    className: "bg-tertiary-container text-on-tertiary-container",
  },
  ONBOARDED: {
    label: "Nhận việc",
    shortLabel: "Nhận việc",
    className: "bg-emerald-100 text-emerald-800",
  },
  PERMANENT: {
    label: "Chính thức",
    shortLabel: "Chính thức",
    className: "bg-emerald-200 text-emerald-900",
  },
  NO_HIRE: {
    label: "Không tuyển",
    shortLabel: "Không tuyển",
    className: "bg-rose-100 text-rose-700",
  },
};

export function getCandidateStatusOptions(
  _currentStatus: string,
  _actor: "hr" | "manager",
) {
  return CANDIDATE_STATUSES.filter(
    (status, index, statuses) => statuses.indexOf(status) === index,
  );
}

export function normalizeCandidateStatus(value?: string | null): CandidateStatusType {
  switch (value) {
    case "INTERVIEW":
    case "INTERVIEWED":
      return "INTERVIEW";
    case "OFFER":
    case "OFFERED":
    case "PASSED":
      return "OFFER";
    case "HIRE":
      return "HIRE";
    case "ONBOARDED":
      return "ONBOARDED";
    case "PERMANENT":
      return "PERMANENT";
    case "NO_HIRE":
    case "FAIL_CV":
    case "INTERVIEW_FAILED":
    case "OFFER_DECLINED":
    case "REJECTED":
      return "NO_HIRE";
    case "NEW":
    case "REVIEWING":
    case "PASS_CV":
    default:
      return "NEW";
  }
}

export const workspaceRoleMeta: Record<WorkspaceRoleType, string> = {
  HR_ADMIN: "HR Admin",
  HR: "HR",
  MANAGER: "Quản lý",
};

export const managerDecisionMeta: Record<
  ManagerDecisionType,
  { label: string; className: string; shortLabel: string }
> = {
  PENDING: {
    label: "Chờ duyệt",
    shortLabel: "Chờ duyệt",
    className: "bg-surface-container-high text-on-surface",
  },
  APPROVED: {
    label: "Đã duyệt",
    shortLabel: "Duyệt",
    className: "bg-emerald-100 text-emerald-700",
  },
  REJECTED: {
    label: "Không duyệt",
    shortLabel: "Không duyệt",
    className: "bg-rose-100 text-rose-700",
  },
};

export const managerFinalStatusMeta: Record<
  ManagerFinalStatusType,
  { label: string; className: string }
> = {
  HIRE: {
    label: "Đã tuyển",
    className: "bg-primary text-white",
  },
};

export function parseSkills(value?: string | null) {
  if (!value) return [];

  try {
    const parsed = JSON.parse(value) as string[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function stringifySkills(skills?: string[]) {
  return JSON.stringify(
    (skills ?? [])
      .map((item) => item.trim())
      .filter(Boolean)
      .slice(0, 20),
  );
}

export function assertNever(_: never) {
  throw new Error("Unexpected value");
}
