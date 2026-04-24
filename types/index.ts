export const ROLES = ["ADMIN", "USER"] as const;
export const WORKSPACE_ROLES = ["HR_ADMIN", "HR", "MANAGER"] as const;
export const CANDIDATE_STATUSES = [
  "NEW",
  "REVIEWING",
  "PASS_CV",
  "FAIL_CV",
  "INTERVIEW",
  "INTERVIEWED",
  "PASSED",
  "INTERVIEW_FAILED",
  "OFFERED",
  "OFFER_DECLINED",
  "ONBOARDED",
  "REJECTED",
] as const;
export const MANAGER_DECISIONS = ["PENDING", "APPROVED", "REJECTED"] as const;
export const MANAGER_FINAL_STATUSES = ["OFFERED", "OFFER_DECLINED", "ONBOARDED", "REJECTED"] as const;

export type RoleType = (typeof ROLES)[number];
export type WorkspaceRoleType = (typeof WORKSPACE_ROLES)[number];
export type CandidateStatusType = (typeof CANDIDATE_STATUSES)[number];
export type ManagerDecisionType = (typeof MANAGER_DECISIONS)[number];
export type ManagerFinalStatusType = (typeof MANAGER_FINAL_STATUSES)[number];

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  role: RoleType;
};

export type ParsedCVResult = {
  fullName?: string;
  email?: string;
  phone?: string;
  dateOfBirth?: string;
  address?: string;
  hometown?: string;
  school?: string;
  graduationYear?: string;
  yearsOfExperience?: number;
  position?: string;
  summary?: string;
  skills?: string[];
  notes?: string;
  rawText: string;
};

export type CandidateFormPayload = {
  fullName?: string;
  email?: string;
  phone?: string;
  dateOfBirth?: string;
  address?: string;
  hometown?: string;
  school?: string;
  graduationYear?: string;
  yearsOfExperience?: number | null;
  skills?: string[];
  summary?: string;
  position?: string;
  source?: string;
  offerSalary?: string;
  notes?: string;
  interviewDate?: string;
  interviewerName?: string;
  interviewFeedback?: string;
  hrId?: string;
  projectId?: string;
  status?: CandidateStatusType;
  managerDecision?: ManagerDecisionType | "";
  managerOfferSalary?: string;
  managerReviewNote?: string;
};

export type WorkspaceMemberOption = {
  id: string;
  name: string;
  email: string;
  role: WorkspaceRoleType;
};

export type ProjectOption = {
  id: string;
  name: string;
  description?: string | null;
};
