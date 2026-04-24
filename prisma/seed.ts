import fs from "node:fs/promises";
import path from "node:path";

import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

import { saveUploadedFile } from "../lib/files";

const prisma = new PrismaClient();

type SeedUserKey =
  | "admin"
  | "opsAdmin"
  | "thao"
  | "quan"
  | "linh"
  | "nam"
  | "ha"
  | "duyManager"
  | "hungManager";

type SeedWorkspaceKey = "talentOps" | "creativeLab" | "enterpriseHub";
type SeedProjectKey =
  | "talentFrontend"
  | "talentBackend"
  | "talentData"
  | "creativeBrand"
  | "creativeGrowth"
  | "enterpriseERP"
  | "enterpriseSupport";

type CandidateSeed = {
  workspace: SeedWorkspaceKey;
  hr: SeedUserKey;
  uploadedBy?: SeedUserKey;
  managerReviewedBy?: SeedUserKey;
  project?: SeedProjectKey;
  fileName?: string;
  mimeType?: string;
  rawText?: string;
  fullName: string;
  email: string;
  phone: string;
  dateOfBirth?: string;
  address?: string;
  hometown?: string;
  school?: string;
  graduationYear?: string;
  yearsOfExperience?: number;
  skills: string[];
  summary: string;
  position: string;
  source: string;
  offerSalary?: string;
  notes?: string;
  interviewDate?: string;
  interviewerName?: string;
  interviewFeedback?: string;
  managerDecision?: string;
  managerOfferSalary?: string;
  managerReviewNote?: string;
  managerReviewedAt?: Date;
  status: string;
  history: Array<{
    fromStatus: string | null;
    toStatus: string;
    changedBy: SeedUserKey;
    note: string;
  }>;
};

async function resetUploadsDirectory() {
  const uploadsRoot = path.join(process.cwd(), "public", "uploads");
  await fs.rm(uploadsRoot, { recursive: true, force: true });
  await fs.mkdir(uploadsRoot, { recursive: true });
}

async function createCvFile(params: {
  workspaceId: string;
  uploadedBy: string;
  fileName: string;
  mimeType?: string;
  rawText: string;
}) {
  const buffer = Buffer.from(params.rawText, "utf8");
  const filePath = await saveUploadedFile(params.workspaceId, params.fileName, buffer);

  return prisma.cVFile.create({
    data: {
      workspaceId: params.workspaceId,
      uploadedBy: params.uploadedBy,
      fileName: params.fileName,
      filePath,
      mimeType: params.mimeType ?? "text/plain",
      fileSize: buffer.byteLength,
      rawText: params.rawText,
    },
  });
}

async function seedCandidate(
  candidate: CandidateSeed,
  users: Record<SeedUserKey, { id: string }>,
  workspaces: Record<SeedWorkspaceKey, { id: string }>,
  projects: Partial<Record<SeedProjectKey, { id: string }>>,
) {
  const workspace = workspaces[candidate.workspace];
  const hr = users[candidate.hr];
  const uploadedBy = users[candidate.uploadedBy ?? candidate.hr];
  const managerReviewedBy = candidate.managerReviewedBy ? users[candidate.managerReviewedBy] : undefined;

  const cvFile =
    candidate.fileName && candidate.rawText
      ? await createCvFile({
          workspaceId: workspace.id,
          uploadedBy: uploadedBy.id,
          fileName: candidate.fileName,
          mimeType: candidate.mimeType,
          rawText: candidate.rawText,
        })
      : null;

  const createdCandidate = await prisma.candidate.create({
    data: {
      workspaceId: workspace.id,
      hrId: hr.id,
      cvFileId: cvFile?.id,
      projectId: candidate.project ? projects[candidate.project]?.id : null,
      fullName: candidate.fullName,
      email: candidate.email,
      phone: candidate.phone,
      dateOfBirth: candidate.dateOfBirth,
      address: candidate.address,
      hometown: candidate.hometown,
      school: candidate.school,
      graduationYear: candidate.graduationYear,
      yearsOfExperience: candidate.yearsOfExperience,
      skillsJson: JSON.stringify(candidate.skills),
      summary: candidate.summary,
      position: candidate.position,
      source: candidate.source,
      offerSalary: candidate.offerSalary,
      notes: candidate.notes,
      interviewDate: candidate.interviewDate,
      interviewerName: candidate.interviewerName,
      interviewFeedback: candidate.interviewFeedback,
      managerDecision: candidate.managerDecision,
      managerOfferSalary: candidate.managerOfferSalary,
      managerReviewNote: candidate.managerReviewNote,
      managerReviewedAt: candidate.managerReviewedAt,
      managerReviewedById: managerReviewedBy?.id,
      status: candidate.status,
    },
  });

  await prisma.statusHistory.createMany({
    data: candidate.history.map((item) => ({
      candidateId: createdCandidate.id,
      fromStatus: item.fromStatus,
      toStatus: item.toStatus,
      changedBy: users[item.changedBy].id,
      note: item.note,
    })),
  });
}

async function main() {
  await resetUploadsDirectory();

  await prisma.statusHistory.deleteMany();
  await prisma.candidate.deleteMany();
  await prisma.project.deleteMany();
  await prisma.cVFile.deleteMany();
  await prisma.workspaceMember.deleteMany();
  await prisma.workspace.deleteMany();
  await prisma.user.deleteMany();

  const adminPassword = await bcrypt.hash("Admin@123", 10);
  const userPassword = await bcrypt.hash("User@123", 10);
  const verifiedAt = new Date();

  const users = {
    admin: await prisma.user.create({
      data: {
        name: "CV Scanner Admin",
        email: "admin@cvscanner.local",
        password: adminPassword,
        role: "ADMIN",
        emailVerifiedAt: verifiedAt,
      },
    }),
    opsAdmin: await prisma.user.create({
      data: {
        name: "Operations Admin",
        email: "ops-admin@cvscanner.local",
        password: adminPassword,
        role: "ADMIN",
        emailVerifiedAt: verifiedAt,
      },
    }),
    thao: await prisma.user.create({
      data: {
        name: "Lê Thu Thảo",
        email: "thao@cvscanner.local",
        password: userPassword,
        emailVerifiedAt: verifiedAt,
      },
    }),
    quan: await prisma.user.create({
      data: {
        name: "Nguyễn Minh Quân",
        email: "quan@cvscanner.local",
        password: userPassword,
        emailVerifiedAt: verifiedAt,
      },
    }),
    linh: await prisma.user.create({
      data: {
        name: "Phạm Ngọc Linh",
        email: "linh@cvscanner.local",
        password: userPassword,
        emailVerifiedAt: verifiedAt,
      },
    }),
    nam: await prisma.user.create({
      data: {
        name: "Trần Hoài Nam",
        email: "nam@cvscanner.local",
        password: userPassword,
        emailVerifiedAt: verifiedAt,
      },
    }),
    ha: await prisma.user.create({
      data: {
        name: "Vũ Thu Hà",
        email: "ha@cvscanner.local",
        password: userPassword,
        emailVerifiedAt: verifiedAt,
      },
    }),
    duyManager: await prisma.user.create({
      data: {
        name: "Trần Quốc Duy",
        email: "manager@cvscanner.local",
        password: userPassword,
        emailVerifiedAt: verifiedAt,
      },
    }),
    hungManager: await prisma.user.create({
      data: {
        name: "Lê Hùng",
        email: "hung.manager@cvscanner.local",
        password: userPassword,
        emailVerifiedAt: verifiedAt,
      },
    }),
  } satisfies Record<SeedUserKey, { id: string }>;

  const workspaces = {
    talentOps: await prisma.workspace.create({
      data: {
        name: "Talent Ops Vietnam",
        ownerId: users.admin.id,
        members: {
          create: [
            { userId: users.admin.id, role: "HR_ADMIN" },
            { userId: users.thao.id, role: "HR_ADMIN" },
            { userId: users.quan.id, role: "HR" },
            { userId: users.linh.id, role: "HR" },
            { userId: users.duyManager.id, role: "MANAGER" },
          ],
        },
      },
    }),
    creativeLab: await prisma.workspace.create({
      data: {
        name: "Creative Hiring Lab",
        ownerId: users.thao.id,
        members: {
          create: [
            { userId: users.thao.id, role: "HR_ADMIN" },
            { userId: users.ha.id, role: "HR" },
            { userId: users.hungManager.id, role: "MANAGER" },
            { userId: users.admin.id, role: "HR" },
          ],
        },
      },
    }),
    enterpriseHub: await prisma.workspace.create({
      data: {
        name: "Enterprise Hiring Hub",
        ownerId: users.opsAdmin.id,
        members: {
          create: [
            { userId: users.opsAdmin.id, role: "HR_ADMIN" },
            { userId: users.nam.id, role: "HR" },
            { userId: users.quan.id, role: "HR" },
            { userId: users.duyManager.id, role: "MANAGER" },
            { userId: users.hungManager.id, role: "MANAGER" },
          ],
        },
      },
    }),
  } satisfies Record<SeedWorkspaceKey, { id: string }>;

  const projects = {
    talentFrontend: await prisma.project.create({
      data: {
        workspaceId: workspaces.talentOps.id,
        name: "Mobile Commerce Frontend",
        description: "Tuyển React và UX cho squad commerce.",
      },
    }),
    talentBackend: await prisma.project.create({
      data: {
        workspaceId: workspaces.talentOps.id,
        name: "Platform Backend",
        description: "Bổ sung backend engineer cho nền tảng thanh toán.",
      },
    }),
    talentData: await prisma.project.create({
      data: {
        workspaceId: workspaces.talentOps.id,
        name: "Data Foundation",
        description: "Tuyển analyst và data engineer cho team tăng trưởng.",
      },
    }),
    creativeBrand: await prisma.project.create({
      data: {
        workspaceId: workspaces.creativeLab.id,
        name: "Brand Refresh 2026",
        description: "Dự án tuyển designer và content lead cho chiến dịch tái định vị.",
      },
    }),
    creativeGrowth: await prisma.project.create({
      data: {
        workspaceId: workspaces.creativeLab.id,
        name: "Growth Studio",
        description: "Nhóm performance và product marketing cho scale-up campaign.",
      },
    }),
    enterpriseERP: await prisma.project.create({
      data: {
        workspaceId: workspaces.enterpriseHub.id,
        name: "ERP Modernization",
        description: "Tuyển kỹ sư và BA cho dự án ERP nội bộ.",
      },
    }),
    enterpriseSupport: await prisma.project.create({
      data: {
        workspaceId: workspaces.enterpriseHub.id,
        name: "Customer Support AI",
        description: "Bổ sung nhân sự vận hành và tích hợp AI hỗ trợ khách hàng.",
      },
    }),
  } satisfies Record<SeedProjectKey, { id: string }>;

  const now = new Date();
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
  const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);

  const candidates: CandidateSeed[] = [
    {
      workspace: "talentOps",
      hr: "thao",
      uploadedBy: "thao",
      managerReviewedBy: "duyManager",
      project: "talentFrontend",
      fileName: "nguyen-minh-anh.pdf",
      mimeType: "application/pdf",
      rawText:
        "Nguyễn Minh Anh | UI/UX Designer | Email: minhanh.design@gmail.com | Phone: 0901234567 | Skills: Figma, React, Tailwind CSS, User Research",
      fullName: "Nguyễn Minh Anh",
      email: "minhanh.design@gmail.com",
      phone: "0901 234 567",
      dateOfBirth: "1998-07-12",
      address: "Quận 3, TP.HCM",
      hometown: "Đà Nẵng",
      school: "RMIT Vietnam",
      graduationYear: "2020",
      yearsOfExperience: 5,
      skills: ["Figma", "React", "Tailwind CSS", "User Research"],
      summary: "Senior UI/UX Designer có kinh nghiệm xây design system và phối hợp chặt với product squad.",
      position: "Senior UI/UX Designer",
      source: "LinkedIn",
      offerSalary: "45.000.000 VND",
      notes: "Portfolio mạnh, giao tiếp tốt, phù hợp team sản phẩm.",
      interviewDate: "2026-04-25 09:00",
      interviewerName: "Trần Quốc Duy",
      interviewFeedback: "Trả lời tốt phần case study về design system.",
      managerDecision: "APPROVED",
      managerOfferSalary: "42.000.000 VND",
      managerReviewNote: "Có thể tiến tới chốt offer sau vòng final.",
      managerReviewedAt: yesterday,
      status: "INTERVIEWED",
      history: [
        { fromStatus: null, toStatus: "NEW", changedBy: "thao", note: "Tiếp nhận CV từ LinkedIn." },
        { fromStatus: "NEW", toStatus: "REVIEWING", changedBy: "thao", note: "Đánh giá portfolio." },
        { fromStatus: "REVIEWING", toStatus: "INTERVIEW", changedBy: "thao", note: "Đặt lịch phỏng vấn vòng 1." },
        { fromStatus: "INTERVIEW", toStatus: "INTERVIEWED", changedBy: "thao", note: "Đã hoàn tất phỏng vấn." },
      ],
    },
    {
      workspace: "talentOps",
      hr: "quan",
      uploadedBy: "quan",
      project: "talentFrontend",
      fileName: "tran-van-hoang.docx",
      mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      rawText:
        "Trần Văn Hoàng | Frontend Developer | Email: hoang.tv@company.vn | Skills: React, Next.js, TypeScript | 4 years experience",
      fullName: "Trần Văn Hoàng",
      email: "hoang.tv@company.vn",
      phone: "0988 223 114",
      dateOfBirth: "1996-04-03",
      address: "Thủ Đức, TP.HCM",
      hometown: "Nam Định",
      school: "Đại học Bách Khoa Hà Nội",
      graduationYear: "2019",
      yearsOfExperience: 4,
      skills: ["React", "Next.js", "TypeScript"],
      summary: "Frontend Developer tập trung vào SaaS B2B, có nền tảng tốt về component architecture.",
      position: "Frontend Developer",
      source: "Referral",
      notes: "Cần thêm vòng đánh giá coding.",
      managerDecision: "PENDING",
      status: "NEW",
      history: [{ fromStatus: null, toStatus: "NEW", changedBy: "quan", note: "Referral từ team kỹ thuật." }],
    },
    {
      workspace: "talentOps",
      hr: "linh",
      uploadedBy: "linh",
      managerReviewedBy: "duyManager",
      project: "talentBackend",
      fileName: "pham-gia-linh.pdf",
      mimeType: "application/pdf",
      rawText:
        "Phạm Gia Linh | Backend Engineer | Email: linh.backend@gmail.com | Skills: Java, Spring Boot, PostgreSQL, Kafka",
      fullName: "Phạm Gia Linh",
      email: "linh.backend@gmail.com",
      phone: "0918 771 223",
      dateOfBirth: "1995-10-21",
      address: "Cầu Giấy, Hà Nội",
      hometown: "Hà Nội",
      school: "Posts and Telecommunications Institute of Technology",
      graduationYear: "2018",
      yearsOfExperience: 6,
      skills: ["Java", "Spring Boot", "PostgreSQL", "Kafka"],
      summary: "Backend Engineer mạnh về distributed systems và tối ưu dữ liệu giao dịch.",
      position: "Senior Backend Engineer",
      source: "TopCV",
      offerSalary: "50.000.000 VND",
      notes: "Kỳ vọng lương cao nhưng hợp năng lực.",
      interviewDate: "2026-04-24 14:00",
      interviewerName: "Trần Quốc Duy",
      interviewFeedback: "Thiết kế hệ thống tốt, trả lời sâu về transaction processing.",
      managerDecision: "APPROVED",
      managerOfferSalary: "48.000.000 VND",
      managerReviewNote: "Đồng ý phát hành offer trong tuần này.",
      managerReviewedAt: now,
      status: "OFFERED",
      history: [
        { fromStatus: null, toStatus: "NEW", changedBy: "linh", note: "CV từ TopCV." },
        { fromStatus: "NEW", toStatus: "REVIEWING", changedBy: "linh", note: "Sàng lọc hồ sơ backend." },
        { fromStatus: "REVIEWING", toStatus: "INTERVIEW", changedBy: "linh", note: "Chuyển vòng technical interview." },
        { fromStatus: "INTERVIEW", toStatus: "INTERVIEWED", changedBy: "linh", note: "Hoàn tất technical panel." },
        { fromStatus: "INTERVIEWED", toStatus: "OFFERED", changedBy: "duyManager", note: "Manager chốt phát hành offer." },
      ],
    },
    {
      workspace: "talentOps",
      hr: "quan",
      uploadedBy: "quan",
      managerReviewedBy: "duyManager",
      project: "talentData",
      fileName: "do-khanh-vy.pdf",
      mimeType: "application/pdf",
      rawText:
        "Đỗ Khánh Vy | Data Analyst | Email: vy.analytics@gmail.com | Skills: SQL, Power BI, Python | 3 years experience",
      fullName: "Đỗ Khánh Vy",
      email: "vy.analytics@gmail.com",
      phone: "0907 234 112",
      dateOfBirth: "1999-01-16",
      address: "Bình Thạnh, TP.HCM",
      hometown: "Khánh Hòa",
      school: "Đại học Kinh tế TP.HCM",
      graduationYear: "2021",
      yearsOfExperience: 3,
      skills: ["SQL", "Power BI", "Python"],
      summary: "Data Analyst có kinh nghiệm dashboard và phân tích cohort cho e-commerce.",
      position: "Data Analyst",
      source: "VietnamWorks",
      notes: "CV tốt nhưng chưa phù hợp nhu cầu seniority hiện tại.",
      managerDecision: "REJECTED",
      managerReviewNote: "Kỹ năng tốt nhưng chưa đủ sâu cho vị trí cần tuyển.",
      managerReviewedAt: twoDaysAgo,
      status: "REJECTED",
      history: [
        { fromStatus: null, toStatus: "NEW", changedBy: "quan", note: "Nhận CV từ VietnamWorks." },
        { fromStatus: "NEW", toStatus: "REVIEWING", changedBy: "quan", note: "Đã sàng lọc CV." },
        { fromStatus: "REVIEWING", toStatus: "INTERVIEW_FAILED", changedBy: "quan", note: "Fail sau vòng phỏng vấn với HR." },
        { fromStatus: "INTERVIEW_FAILED", toStatus: "REJECTED", changedBy: "duyManager", note: "Manager chốt từ chối ứng viên." },
      ],
    },
    {
      workspace: "talentOps",
      hr: "thao",
      uploadedBy: "admin",
      managerReviewedBy: "duyManager",
      project: "talentBackend",
      fileName: "vo-quoc-bao.pdf",
      mimeType: "application/pdf",
      rawText:
        "Võ Quốc Bảo | Engineering Manager | Email: bao.vm@gmail.com | Skills: Java, AWS, Team Leadership | 9 years experience",
      fullName: "Võ Quốc Bảo",
      email: "bao.vm@gmail.com",
      phone: "0938 666 111",
      dateOfBirth: "1991-02-14",
      address: "Phú Nhuận, TP.HCM",
      hometown: "Cần Thơ",
      school: "Đại học Khoa học Tự nhiên TP.HCM",
      graduationYear: "2014",
      yearsOfExperience: 9,
      skills: ["Java", "AWS", "Team Leadership"],
      summary: "Engineering Manager có kinh nghiệm dẫn dắt squad backend và tích hợp cloud.",
      position: "Engineering Manager",
      source: "Headhunt",
      offerSalary: "75.000.000 VND",
      notes: "Ứng viên senior, đã đồng ý mức offer.",
      interviewDate: "2026-04-18 10:00",
      interviewerName: "Trần Quốc Duy",
      interviewFeedback: "Leadership tốt, phù hợp vai trò mở rộng team.",
      managerDecision: "APPROVED",
      managerOfferSalary: "72.000.000 VND",
      managerReviewNote: "Đã nhận offer và hoàn tất onboard.",
      managerReviewedAt: threeDaysAgo,
      status: "ONBOARDED",
      history: [
        { fromStatus: null, toStatus: "NEW", changedBy: "thao", note: "Headhunt profile." },
        { fromStatus: "NEW", toStatus: "REVIEWING", changedBy: "thao", note: "Screening với HR Admin." },
        { fromStatus: "REVIEWING", toStatus: "INTERVIEW", changedBy: "thao", note: "Đặt lịch interview với leadership." },
        { fromStatus: "INTERVIEW", toStatus: "INTERVIEWED", changedBy: "thao", note: "Hoàn tất vòng panel." },
        { fromStatus: "INTERVIEWED", toStatus: "OFFERED", changedBy: "duyManager", note: "Manager duyệt offer." },
        { fromStatus: "OFFERED", toStatus: "ONBOARDED", changedBy: "thao", note: "Ứng viên bắt đầu ngày làm việc đầu tiên." },
      ],
    },
    {
      workspace: "talentOps",
      hr: "linh",
      uploadedBy: "linh",
      project: "talentData",
      fileName: "le-ngoc-ha.txt",
      mimeType: "text/plain",
      rawText:
        "Lê Ngọc Hà | Data Engineer | Email: ha.de@gmail.com | Skills: Python, Airflow, BigQuery | 5 years experience",
      fullName: "Lê Ngọc Hà",
      email: "ha.de@gmail.com",
      phone: "0902 889 773",
      dateOfBirth: "1997-09-09",
      address: "Tân Bình, TP.HCM",
      hometown: "Bình Định",
      school: "Đại học CNTT TP.HCM",
      graduationYear: "2020",
      yearsOfExperience: 5,
      skills: ["Python", "Airflow", "BigQuery"],
      summary: "Data Engineer có kinh nghiệm xây pipeline và data warehouse cho growth analytics.",
      position: "Data Engineer",
      source: "TopDev",
      notes: "Đang chờ technical interview.",
      status: "INTERVIEW",
      history: [
        { fromStatus: null, toStatus: "NEW", changedBy: "linh", note: "Ứng viên từ TopDev." },
        { fromStatus: "NEW", toStatus: "REVIEWING", changedBy: "linh", note: "CV phù hợp JD." },
        { fromStatus: "REVIEWING", toStatus: "INTERVIEW", changedBy: "linh", note: "Đã xếp lịch technical interview." },
      ],
    },
    {
      workspace: "creativeLab",
      hr: "thao",
      uploadedBy: "thao",
      project: "creativeBrand",
      fileName: "mai-thu-trang.pdf",
      mimeType: "application/pdf",
      rawText:
        "Mai Thu Trang | Brand Designer | Email: trang.brand@gmail.com | Skills: Illustrator, Figma, Branding | 6 years experience",
      fullName: "Mai Thu Trang",
      email: "trang.brand@gmail.com",
      phone: "0973 999 334",
      dateOfBirth: "1994-12-08",
      address: "Quận 1, TP.HCM",
      hometown: "Huế",
      school: "Đại học Mỹ thuật TP.HCM",
      graduationYear: "2017",
      yearsOfExperience: 6,
      skills: ["Illustrator", "Figma", "Branding"],
      summary: "Brand Designer có kinh nghiệm dẫn visual refresh cho nhiều campaign lớn.",
      position: "Senior Brand Designer",
      source: "Behance",
      notes: "Ứng viên pass screening và đang chờ final round.",
      status: "PASSED",
      history: [
        { fromStatus: null, toStatus: "NEW", changedBy: "thao", note: "Ứng viên từ Behance." },
        { fromStatus: "NEW", toStatus: "REVIEWING", changedBy: "thao", note: "Đã review portfolio." },
        { fromStatus: "REVIEWING", toStatus: "PASSED", changedBy: "thao", note: "Pass screening round." },
      ],
    },
    {
      workspace: "creativeLab",
      hr: "ha",
      uploadedBy: "ha",
      project: "creativeGrowth",
      fileName: "nguyen-nhat-nam.pdf",
      mimeType: "application/pdf",
      rawText:
        "Nguyễn Nhật Nam | Performance Marketing Specialist | Email: nam.pm@gmail.com | Skills: Google Ads, Meta Ads, Analytics",
      fullName: "Nguyễn Nhật Nam",
      email: "nam.pm@gmail.com",
      phone: "0905 622 144",
      dateOfBirth: "1998-05-27",
      address: "Quận 7, TP.HCM",
      hometown: "Quảng Nam",
      school: "UEH",
      graduationYear: "2020",
      yearsOfExperience: 4,
      skills: ["Google Ads", "Meta Ads", "Analytics"],
      summary: "Performance marketer tập trung vào lead generation và tối ưu ngân sách campaign.",
      position: "Performance Marketing Specialist",
      source: "LinkedIn",
      notes: "CV ổn, đang chờ manager xem thêm portfolio campaign.",
      managerDecision: "PENDING",
      status: "REVIEWING",
      history: [
        { fromStatus: null, toStatus: "NEW", changedBy: "ha", note: "Tiếp nhận từ LinkedIn." },
        { fromStatus: "NEW", toStatus: "REVIEWING", changedBy: "ha", note: "Đã chuyển manager review." },
      ],
    },
    {
      workspace: "creativeLab",
      hr: "ha",
      uploadedBy: "ha",
      managerReviewedBy: "hungManager",
      project: "creativeGrowth",
      fileName: "bui-hoai-an.docx",
      mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      rawText:
        "Bùi Hoài An | Content Strategist | Email: hoai.an@gmail.com | Skills: Editorial Planning, SEO, Storytelling",
      fullName: "Bùi Hoài An",
      email: "hoai.an@gmail.com",
      phone: "0914 564 239",
      dateOfBirth: "1997-11-19",
      address: "Gò Vấp, TP.HCM",
      hometown: "Đồng Nai",
      school: "Đại học KHXH&NV TP.HCM",
      graduationYear: "2019",
      yearsOfExperience: 5,
      skills: ["Editorial Planning", "SEO", "Storytelling"],
      summary: "Content Strategist mạnh về editorial calendar và phối hợp brand-performance.",
      position: "Content Strategist",
      source: "Glints",
      notes: "Nội dung tốt nhưng chưa phù hợp tốc độ đội growth.",
      interviewDate: "2026-04-22 15:00",
      interviewerName: "Lê Hùng",
      interviewFeedback: "Kinh nghiệm branding ổn nhưng thiếu mindset performance.",
      managerDecision: "REJECTED",
      managerReviewNote: "Không phù hợp nhu cầu growth execution hiện tại.",
      managerReviewedAt: yesterday,
      status: "INTERVIEW_FAILED",
      history: [
        { fromStatus: null, toStatus: "NEW", changedBy: "ha", note: "Nguồn ứng viên từ Glints." },
        { fromStatus: "NEW", toStatus: "REVIEWING", changedBy: "ha", note: "Đã lọc CV." },
        { fromStatus: "REVIEWING", toStatus: "INTERVIEW", changedBy: "ha", note: "Mời phỏng vấn với growth lead." },
        { fromStatus: "INTERVIEW", toStatus: "INTERVIEW_FAILED", changedBy: "ha", note: "Không đạt vòng phỏng vấn." },
      ],
    },
    {
      workspace: "creativeLab",
      hr: "thao",
      uploadedBy: "admin",
      managerReviewedBy: "hungManager",
      project: "creativeBrand",
      fileName: "trinh-minh-khoa.pdf",
      mimeType: "application/pdf",
      rawText:
        "Trịnh Minh Khoa | Art Director | Email: minhkhoa.ad@gmail.com | Skills: Visual Direction, Campaign Art, Team Mentoring",
      fullName: "Trịnh Minh Khoa",
      email: "minhkhoa.ad@gmail.com",
      phone: "0977 502 818",
      dateOfBirth: "1992-03-11",
      address: "Quận 10, TP.HCM",
      hometown: "Bến Tre",
      school: "Arena Multimedia",
      graduationYear: "2015",
      yearsOfExperience: 8,
      skills: ["Visual Direction", "Campaign Art", "Team Mentoring"],
      summary: "Art Director nhiều kinh nghiệm campaign lớn và quản lý nhóm thiết kế.",
      position: "Art Director",
      source: "Agency Network",
      offerSalary: "58.000.000 VND",
      notes: "Ứng viên đạt kỳ vọng nhưng từ chối offer vì chưa phù hợp thời gian join.",
      interviewDate: "2026-04-19 13:30",
      interviewerName: "Lê Hùng",
      interviewFeedback: "Phù hợp về chuyên môn và level seniority.",
      managerDecision: "APPROVED",
      managerOfferSalary: "55.000.000 VND",
      managerReviewNote: "Offer đã phát hành nhưng ứng viên decline.",
      managerReviewedAt: twoDaysAgo,
      status: "OFFER_DECLINED",
      history: [
        { fromStatus: null, toStatus: "NEW", changedBy: "thao", note: "Agency giới thiệu hồ sơ." },
        { fromStatus: "NEW", toStatus: "REVIEWING", changedBy: "thao", note: "Đã review portfolio." },
        { fromStatus: "REVIEWING", toStatus: "INTERVIEW", changedBy: "thao", note: "Mời phỏng vấn với creative lead." },
        { fromStatus: "INTERVIEW", toStatus: "INTERVIEWED", changedBy: "thao", note: "Phỏng vấn đạt." },
        { fromStatus: "INTERVIEWED", toStatus: "OFFERED", changedBy: "hungManager", note: "Manager duyệt offer." },
        { fromStatus: "OFFERED", toStatus: "OFFER_DECLINED", changedBy: "thao", note: "Ứng viên từ chối do chưa sẵn sàng chuyển việc." },
      ],
    },
    {
      workspace: "enterpriseHub",
      hr: "nam",
      uploadedBy: "nam",
      project: "enterpriseERP",
      fileName: "phan-duc-long.pdf",
      mimeType: "application/pdf",
      rawText:
        "Phan Đức Long | Business Analyst | Email: long.ba@gmail.com | Skills: BPMN, SQL, Requirement Gathering",
      fullName: "Phan Đức Long",
      email: "long.ba@gmail.com",
      phone: "0932 775 820",
      dateOfBirth: "1994-06-17",
      address: "Hải Châu, Đà Nẵng",
      hometown: "Đà Nẵng",
      school: "Đại học Kinh tế Đà Nẵng",
      graduationYear: "2016",
      yearsOfExperience: 6,
      skills: ["BPMN", "SQL", "Requirement Gathering"],
      summary: "Business Analyst từng tham gia triển khai ERP nhưng CV chưa đủ rõ domain accounting.",
      position: "Business Analyst",
      source: "CareerBuilder",
      notes: "Không phù hợp JD hiện tại.",
      status: "FAIL_CV",
      history: [
        { fromStatus: null, toStatus: "NEW", changedBy: "nam", note: "Ứng viên từ CareerBuilder." },
        { fromStatus: "NEW", toStatus: "FAIL_CV", changedBy: "nam", note: "Loại từ vòng CV vì thiếu domain phù hợp." },
      ],
    },
    {
      workspace: "enterpriseHub",
      hr: "quan",
      uploadedBy: "quan",
      project: "enterpriseERP",
      fileName: "hoang-yen-nhi.pdf",
      mimeType: "application/pdf",
      rawText:
        "Hoàng Yến Nhi | QA Lead | Email: yennhi.qa@gmail.com | Skills: Test Strategy, Cypress, Jira",
      fullName: "Hoàng Yến Nhi",
      email: "yennhi.qa@gmail.com",
      phone: "0908 114 225",
      dateOfBirth: "1993-08-02",
      address: "Thanh Xuân, Hà Nội",
      hometown: "Nghệ An",
      school: "Học viện Công nghệ Bưu chính Viễn thông",
      graduationYear: "2015",
      yearsOfExperience: 8,
      skills: ["Test Strategy", "Cypress", "Jira"],
      summary: "QA Lead có kinh nghiệm thiết lập test process cho hệ thống nhiều module.",
      position: "QA Lead",
      source: "LinkedIn",
      notes: "Pass vòng CV, chuẩn bị phỏng vấn technical.",
      status: "PASS_CV",
      history: [
        { fromStatus: null, toStatus: "NEW", changedBy: "quan", note: "CV từ LinkedIn." },
        { fromStatus: "NEW", toStatus: "PASS_CV", changedBy: "quan", note: "Pass vòng CV." },
      ],
    },
    {
      workspace: "enterpriseHub",
      hr: "nam",
      uploadedBy: "opsAdmin",
      project: "enterpriseSupport",
      fileName: "nguyen-tuan-kiet.txt",
      mimeType: "text/plain",
      rawText:
        "Nguyễn Tuấn Kiệt | AI Support Specialist | Email: kiet.ai@gmail.com | Skills: Prompting, Customer Ops, SQL",
      fullName: "Nguyễn Tuấn Kiệt",
      email: "kiet.ai@gmail.com",
      phone: "0963 998 117",
      dateOfBirth: "1998-10-10",
      address: "Long Biên, Hà Nội",
      hometown: "Hải Phòng",
      school: "FPT University",
      graduationYear: "2021",
      yearsOfExperience: 3,
      skills: ["Prompting", "Customer Ops", "SQL"],
      summary: "Ứng viên phù hợp mảng vận hành AI support, nền tảng tốt về process và data.",
      position: "AI Support Specialist",
      source: "Internal Referral",
      notes: "Đang ở bước review với HR.",
      status: "REVIEWING",
      history: [
        { fromStatus: null, toStatus: "NEW", changedBy: "nam", note: "Referral từ team nội bộ." },
        { fromStatus: "NEW", toStatus: "REVIEWING", changedBy: "nam", note: "HR đang review kinh nghiệm hỗ trợ AI." },
      ],
    },
    {
      workspace: "enterpriseHub",
      hr: "quan",
      uploadedBy: "quan",
      managerReviewedBy: "hungManager",
      project: "enterpriseSupport",
      fileName: "tran-gia-han.pdf",
      mimeType: "application/pdf",
      rawText:
        "Trần Gia Hân | Customer Success Manager | Email: giahan.csm@gmail.com | Skills: Onboarding, Escalation, CRM",
      fullName: "Trần Gia Hân",
      email: "giahan.csm@gmail.com",
      phone: "0909 828 303",
      dateOfBirth: "1994-01-29",
      address: "Thành phố Thủ Đức, TP.HCM",
      hometown: "Phú Yên",
      school: "Đại học Ngoại thương",
      graduationYear: "2017",
      yearsOfExperience: 7,
      skills: ["Onboarding", "Escalation", "CRM"],
      summary: "Customer Success Manager phù hợp triển khai quy trình onboarding và quản lý khách hàng enterprise.",
      position: "Customer Success Manager",
      source: "LinkedIn",
      offerSalary: "38.000.000 VND",
      notes: "Ứng viên đã nhận việc.",
      interviewDate: "2026-04-17 16:00",
      interviewerName: "Lê Hùng",
      interviewFeedback: "Tư duy dịch vụ tốt, giao tiếp chắc chắn.",
      managerDecision: "APPROVED",
      managerOfferSalary: "36.000.000 VND",
      managerReviewNote: "Đã onboard, có thể dùng làm mẫu happy path.",
      managerReviewedAt: threeDaysAgo,
      status: "ONBOARDED",
      history: [
        { fromStatus: null, toStatus: "NEW", changedBy: "quan", note: "Ứng viên tự nộp qua LinkedIn." },
        { fromStatus: "NEW", toStatus: "REVIEWING", changedBy: "quan", note: "Đã qua vòng CV." },
        { fromStatus: "REVIEWING", toStatus: "INTERVIEW", changedBy: "quan", note: "Lên lịch phỏng vấn manager." },
        { fromStatus: "INTERVIEW", toStatus: "INTERVIEWED", changedBy: "quan", note: "Hoàn tất phỏng vấn." },
        { fromStatus: "INTERVIEWED", toStatus: "OFFERED", changedBy: "hungManager", note: "Manager duyệt và gửi offer." },
        { fromStatus: "OFFERED", toStatus: "ONBOARDED", changedBy: "quan", note: "Ứng viên đã onboard." },
      ],
    },
  ];

  for (const candidate of candidates) {
    await seedCandidate(candidate, users, workspaces, projects);
  }

  console.log("Seed completed.");
  console.log(`Users: ${Object.keys(users).length}`);
  console.log(`Workspaces: ${Object.keys(workspaces).length}`);
  console.log(`Projects: ${Object.keys(projects).length}`);
  console.log(`Candidates: ${candidates.length}`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
