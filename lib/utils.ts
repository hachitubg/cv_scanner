import { format } from "date-fns";
import { vi } from "date-fns/locale";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

import type {
  CandidateStatusType,
  ManagerDecisionType,
  ManagerFinalStatusType,
  WorkspaceRoleType,
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

export const candidateStatusMeta: Record<
  CandidateStatusType,
  { label: string; className: string; shortLabel: string }
> = {
  NEW: {
    label: "Mới nhận",
    shortLabel: "Mới",
    className: "bg-primary-fixed text-on-primary-container",
  },
  REVIEWING: {
    label: "Đang review",
    shortLabel: "Review",
    className: "bg-secondary-container text-on-secondary-container",
  },
  PASS_CV: {
    label: "Pass CV",
    shortLabel: "Pass CV",
    className: "bg-emerald-100 text-emerald-700",
  },
  FAIL_CV: {
    label: "Fail CV",
    shortLabel: "Fail CV",
    className: "bg-rose-100 text-rose-700",
  },
  INTERVIEW: {
    label: "Mời phỏng vấn",
    shortLabel: "Phỏng vấn",
    className: "bg-secondary-fixed text-on-secondary-container",
  },
  INTERVIEWED: {
    label: "Đã phỏng vấn",
    shortLabel: "Đã PV",
    className: "bg-surface-container-high text-on-surface",
  },
  PASSED: {
    label: "Pass phỏng vấn",
    shortLabel: "Pass PV",
    className: "bg-tertiary-container text-on-tertiary-container",
  },
  INTERVIEW_FAILED: {
    label: "Phỏng vấn fail",
    shortLabel: "Fail PV",
    className: "bg-orange-100 text-orange-700",
  },
  OFFERED: {
    label: "Đã offer",
    shortLabel: "Offer",
    className: "bg-primary text-white",
  },
  OFFER_DECLINED: {
    label: "Từ chối offer",
    shortLabel: "Declined",
    className: "bg-amber-100 text-amber-800",
  },
  ONBOARDED: {
    label: "Đã onboard",
    shortLabel: "Onboard",
    className: "bg-emerald-100 text-emerald-800",
  },
  REJECTED: {
    label: "Từ chối",
    shortLabel: "Reject",
    className: "bg-rose-100 text-rose-700",
  },
};

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
    label: "Chưa duyệt",
    shortLabel: "Chưa duyệt",
    className: "bg-surface-container-high text-on-surface",
  },
  APPROVED: {
    label: "Đã duyệt",
    shortLabel: "Duyệt",
    className: "bg-emerald-100 text-emerald-700",
  },
  REJECTED: {
    label: "Không duyệt",
    shortLabel: "Từ chối",
    className: "bg-rose-100 text-rose-700",
  },
};

export const managerFinalStatusMeta: Record<
  ManagerFinalStatusType,
  { label: string; className: string }
> = {
  OFFERED: {
    label: "Chốt offer",
    className: "bg-primary text-white",
  },
  OFFER_DECLINED: {
    label: "Từ chối offer",
    className: "bg-amber-100 text-amber-800",
  },
  ONBOARDED: {
    label: "Nhận việc",
    className: "bg-emerald-100 text-emerald-800",
  },
  REJECTED: {
    label: "Không nhận",
    className: "bg-rose-100 text-rose-700",
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
