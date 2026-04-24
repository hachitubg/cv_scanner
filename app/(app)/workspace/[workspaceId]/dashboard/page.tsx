import {
  endOfDay,
  endOfMonth,
  endOfQuarter,
  endOfWeek,
  endOfYear,
  format,
  startOfDay,
  startOfMonth,
  startOfQuarter,
  startOfWeek,
  startOfYear,
  subMonths,
} from "date-fns";
import { vi } from "date-fns/locale";
import {
  Activity,
  BriefcaseBusiness,
  CalendarRange,
  CheckCheck,
  HandHeart,
  ScanSearch,
  Sparkles,
  UsersRound,
} from "lucide-react";
import { notFound, redirect } from "next/navigation";

import { DashboardCharts } from "@/components/dashboard/dashboard-charts";
import { Badge } from "@/components/ui/badge";
import { auth } from "@/lib/auth";
import { requireWorkspaceAccess } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

function getPeriodRange(period: string) {
  const now = new Date();

  switch (period) {
    case "today":
      return { start: startOfDay(now), end: endOfDay(now) };
    case "week":
      return { start: startOfWeek(now, { weekStartsOn: 1 }), end: endOfWeek(now, { weekStartsOn: 1 }) };
    case "quarter":
      return { start: startOfQuarter(now), end: endOfQuarter(now) };
    case "year":
      return { start: startOfYear(now), end: endOfYear(now) };
    case "month":
    default:
      return { start: startOfMonth(now), end: endOfMonth(now) };
  }
}

export default async function WorkspaceDashboardPage({
  params,
  searchParams,
}: {
  params: Promise<{ workspaceId: string }>;
  searchParams: Promise<{ period?: string; hrId?: string }>;
}) {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const { workspaceId } = await params;
  const { period = "month", hrId = "" } = await searchParams;

  try {
    await requireWorkspaceAccess(workspaceId, session.user.id, session.user.role);
  } catch {
    notFound();
  }

  const range = getPeriodRange(period);

  const [workspace, candidates, members, monthlyCandidates] = await Promise.all([
    prisma.workspace.findUnique({ where: { id: workspaceId } }),
    prisma.candidate.findMany({
      where: {
        workspaceId,
        createdAt: {
          gte: range.start,
          lte: range.end,
        },
        ...(hrId ? { hrId } : {}),
      },
      include: {
        hr: true,
      },
    }),
    prisma.workspaceMember.findMany({
      where: { workspaceId },
      include: { user: true },
    }),
    prisma.candidate.findMany({
      where: {
        workspaceId,
        createdAt: {
          gte: subMonths(new Date(), 5),
        },
      },
      select: {
        createdAt: true,
      },
    }),
  ]);

  if (!workspace) notFound();

  const hrMembers = members.filter((member) => member.role !== "MANAGER");

  const total = candidates.length;
  const processing = candidates.filter((item) => ["NEW", "REVIEWING", "PASS_CV"].includes(item.status)).length;
  const interviewing = candidates.filter((item) => ["INTERVIEW", "INTERVIEWED"].includes(item.status)).length;
  const passed = candidates.filter((item) => item.status === "PASSED").length;
  const offered = candidates.filter((item) => item.status === "OFFERED").length;
  const onboarded = candidates.filter((item) => item.status === "ONBOARDED").length;
  const interviewScheduled = candidates.filter((item) => Boolean(item.interviewDate)).length;
  const managerApproved = candidates.filter((item) => item.managerDecision === "APPROVED").length;
  const managerPending = candidates.filter(
    (item) => !item.managerDecision || item.managerDecision === "PENDING",
  ).length;
  const managerReviewed = candidates.filter((item) => Boolean(item.managerReviewedAt)).length;
  const offerRate = total ? Math.round((((offered + onboarded) / total) * 100 + Number.EPSILON) * 10) / 10 : 0;

  const quickOverview = [
    {
      label: "Lịch phỏng vấn",
      value: interviewScheduled,
      note: "Đã có ngày giờ phỏng vấn",
      accentClassName: "bg-secondary/10 text-secondary",
    },
    {
      label: "Đang phỏng vấn",
      value: interviewing,
      note: "Ứng viên đang ở vòng interview",
      accentClassName: "bg-primary/10 text-primary",
    },
    {
      label: "QL đã duyệt",
      value: managerApproved,
      note: "Đã có đánh giá chốt từ quản lý",
      accentClassName: "bg-tertiary/12 text-tertiary",
    },
    {
      label: "Chờ quản lý",
      value: managerPending,
      note: `${managerReviewed} hồ sơ đã được quản lý xem`,
      accentClassName: "bg-[rgba(160,57,100,0.08)] text-primary",
    },
  ];

  const volumeData = Array.from({ length: 6 }).map((_, index) => {
    const date = subMonths(new Date(), 5 - index);
    const label = format(date, "MM/yyyy", { locale: vi });
    const totalInMonth = monthlyCandidates.filter(
      (item) => format(item.createdAt, "MM/yyyy", { locale: vi }) === label,
    ).length;
    return { label, total: totalInMonth };
  });

  const hrDistribution = hrMembers
    .map((member) => ({
      name: member.user.name,
      value: candidates.filter((candidate) => candidate.hrId === member.userId).length,
    }))
    .filter((item) => item.value > 0);

  const funnelData = [
    { name: "Nhận CV", value: total },
    { name: "Phỏng vấn", value: interviewing },
    { name: "Pass", value: passed },
    { name: "Offer", value: offered },
    { name: "Onboard", value: onboarded },
  ];

  const quickSummary = [
    {
      label: "Tổng CV nhận",
      value: total,
      note: "Hồ sơ vào hệ thống trong kỳ này",
      icon: ScanSearch,
      cardClassName: "bg-[linear-gradient(145deg,rgba(255,226,233,0.95),rgba(255,255,255,0.96))]",
      textClassName: "text-primary",
      iconClassName: "bg-primary/12 text-primary",
    },
    {
      label: "Đang xử lý",
      value: processing,
      note: "Cần follow-up sát",
      icon: Activity,
      cardClassName: "bg-[linear-gradient(145deg,rgba(222,245,252,0.98),rgba(255,255,255,0.96))]",
      textClassName: "text-secondary",
      iconClassName: "bg-secondary/12 text-secondary",
    },
    {
      label: "Mời phỏng vấn",
      value: interviewing,
      note: "Đang ở giữa funnel",
      icon: CalendarRange,
      cardClassName: "bg-[linear-gradient(145deg,rgba(213,239,247,0.98),rgba(255,255,255,0.96))]",
      textClassName: "text-secondary",
      iconClassName: "bg-secondary/12 text-secondary",
    },
    {
      label: "Pass phỏng vấn",
      value: passed,
      note: "Có thể đẩy sang offer",
      icon: CheckCheck,
      cardClassName: "bg-[linear-gradient(145deg,rgba(221,246,241,0.98),rgba(255,255,255,0.96))]",
      textClassName: "text-tertiary",
      iconClassName: "bg-tertiary/12 text-tertiary",
    },
    {
      label: "Đã offer",
      value: offered,
      note: "Nhóm sát đích",
      icon: HandHeart,
      cardClassName: "bg-[linear-gradient(145deg,rgba(189,75,121,0.94),rgba(210,101,144,0.95))] text-white",
      textClassName: "text-white",
      iconClassName: "bg-white/15 text-white",
    },
    {
      label: "Onboard",
      value: onboarded,
      note: "Kết quả đã chốt",
      icon: BriefcaseBusiness,
      cardClassName: "bg-[linear-gradient(145deg,rgba(39,126,119,0.94),rgba(59,149,141,0.94))] text-white",
      textClassName: "text-white",
      iconClassName: "bg-white/15 text-white",
    },
    {
      label: "Tỷ lệ CV → Offer",
      value: `${offerRate}%`,
      note: "Chỉ số hiệu quả tổng quan",
      icon: Sparkles,
      cardClassName: "bg-[linear-gradient(145deg,rgba(255,255,255,0.98),rgba(247,242,243,0.96))]",
      textClassName: "text-on-surface",
      iconClassName: "bg-primary/12 text-primary",
    },
  ];

  const selectedMember = hrId ? hrMembers.find((member) => member.userId === hrId)?.user.name : null;
  const filterSummary = [
    {
      label: "Khoảng thời gian",
      value: `${format(range.start, "dd/MM", { locale: vi })} - ${format(range.end, "dd/MM", { locale: vi })}`,
    },
    {
      label: "Thành viên",
      value: `${members.length} người`,
    },
    {
      label: "HR đang lọc",
      value: selectedMember ?? "Tất cả HR",
    },
  ];

  return (
    <main className="space-y-6">
      <section className="relative overflow-hidden rounded-[2.4rem] bg-white/82 px-5 py-6 shadow-[0_30px_80px_rgba(160,57,100,0.12)] backdrop-blur-xl sm:px-8 sm:py-8">
        <div className="absolute -left-14 top-0 h-40 w-40 rounded-full bg-primary/15 blur-3xl animate-float-slow" />
        <div className="absolute -right-10 top-16 h-44 w-44 rounded-full bg-secondary/12 blur-3xl animate-float-delay" />

        <div className="relative grid gap-6 xl:grid-cols-[1.15fr_0.85fr] xl:items-start">
          <div className="space-y-5">
            <div className="flex flex-wrap gap-3">
              <Badge className="bg-primary-fixed text-on-primary-container">Dashboard</Badge>
              <Badge className="bg-surface-container-low text-on-surface">Tổng quan dễ đọc</Badge>
            </div>

            <div className="max-w-3xl">
              <p className="text-sm font-black uppercase tracking-[0.22em] text-primary">Playful Professional</p>
              <h1 className="mt-4 text-4xl font-black tracking-tight text-on-surface sm:text-5xl xl:text-[4rem] xl:leading-[0.98]">
                {workspace.name}
              </h1>
              <p className="mt-4 max-w-2xl text-base font-medium leading-8 text-on-surface-variant sm:text-lg">
                Theo dõi nhịp tuyển dụng theo từng giai đoạn, nhìn nhanh đâu là phần việc cần xử lý trước mà không bị rối mắt.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              {filterSummary.map((item) => (
                <div key={item.label} className="rounded-[1.7rem] bg-surface-container-low px-4 py-4">
                  <p className="text-[11px] font-black uppercase tracking-[0.16em] text-outline">{item.label}</p>
                  <p className="mt-2 text-sm font-black text-on-surface">{item.value}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="glass-panel border border-white/60 p-5 sm:p-6">
            <div className="flex items-start gap-3">
              <div className="rounded-[1.4rem] bg-primary/10 p-3 text-primary">
                <UsersRound className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-black uppercase tracking-[0.18em] text-primary">Bộ lọc thông minh</p>
                <p className="mt-2 text-sm font-medium leading-7 text-on-surface-variant">
                  Chọn khoảng thời gian và HR để dashboard chỉ hiển thị phần dữ liệu bạn đang cần đọc.
                </p>
              </div>
            </div>

            <form className="mt-5 grid gap-3">
              <select
                name="period"
                defaultValue={period}
                className="h-12 rounded-[1.2rem] border border-primary/10 bg-[rgba(245,238,241,0.92)] px-4 text-sm font-semibold text-on-surface shadow-[inset_0_1px_0_rgba(255,255,255,0.85)] outline-none transition focus:border-primary/25 focus:bg-white focus:ring-4 focus:ring-primary/10"
              >
                <option value="today">Hôm nay</option>
                <option value="week">Tuần này</option>
                <option value="month">Tháng này</option>
                <option value="quarter">Quý này</option>
                <option value="year">Năm nay</option>
              </select>
              <select
                name="hrId"
                defaultValue={hrId}
                className="h-12 rounded-[1.2rem] border border-primary/10 bg-[rgba(245,238,241,0.92)] px-4 text-sm font-semibold text-on-surface shadow-[inset_0_1px_0_rgba(255,255,255,0.85)] outline-none transition focus:border-primary/25 focus:bg-white focus:ring-4 focus:ring-primary/10"
              >
                <option value="">Tất cả HR</option>
                {hrMembers.map((member) => (
                  <option key={member.userId} value={member.userId}>
                    {member.user.name}
                  </option>
                ))}
              </select>
              <button className="inline-flex h-12 items-center justify-center rounded-[1.2rem] bg-cta-gradient px-6 text-sm font-black text-white shadow-bubbly transition hover:-translate-y-0.5 hover:shadow-ambient">
                Lọc dashboard
              </button>
            </form>
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {quickSummary.map((item) => {
          const Icon = item.icon;

          return (
            <article
              key={item.label}
              className={`rounded-[1.8rem] border border-white/60 p-5 shadow-[0_18px_45px_rgba(160,57,100,0.08)] ${item.cardClassName}`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-3">
                  <p className="text-[11px] font-black uppercase tracking-[0.18em] opacity-80">{item.label}</p>
                  <p className={`text-3xl font-black tracking-tight sm:text-[2.15rem] ${item.textClassName}`}>
                    {item.value}
                  </p>
                </div>
                <div className={`rounded-[1.1rem] p-2.5 ${item.iconClassName}`}>
                  <Icon className="size-[18px]" />
                </div>
              </div>
              <p className="mt-4 text-sm font-medium leading-6 opacity-80">{item.note}</p>
            </article>
          );
        })}
      </section>

      <DashboardCharts volumeData={volumeData} hrDistribution={hrDistribution} funnelData={funnelData} />

      <section className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="chart-panel relative overflow-hidden p-6 sm:p-8">
          <div className="absolute -right-12 top-0 h-36 w-36 rounded-full bg-primary/10 blur-3xl" />
          <div className="relative">
            <p className="text-sm font-black uppercase tracking-[0.18em] text-primary">Tổng quan nhanh</p>
            <h3 className="mt-2 text-3xl font-black tracking-tight text-on-surface">Bản đồ kỳ hiện tại</h3>
            <p className="mt-4 text-base font-medium leading-8 text-on-surface-variant">
              Trong giai đoạn này có <span className="font-black text-on-surface">{total}</span> CV được ghi nhận.
              Nhóm đang xử lý là <span className="font-black text-on-surface">{processing}</span>, đã lên lịch phỏng vấn{" "}
              <span className="font-black text-on-surface">{interviewScheduled}</span>, quản lý đã duyệt{" "}
              <span className="font-black text-on-surface">{managerApproved}</span>, và đã chạm mốc offer hoặc onboard là{" "}
              <span className="font-black text-on-surface">{offered + onboarded}</span>.
            </p>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {quickOverview.map((item) => (
                <div
                  key={item.label}
                  className="rounded-[1.55rem] border border-white/65 bg-white/72 px-4 py-4 shadow-[0_16px_35px_rgba(160,57,100,0.07)] backdrop-blur-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[11px] font-black uppercase tracking-[0.18em] text-outline">{item.label}</p>
                      <p className="mt-2 text-2xl font-black tracking-tight text-on-surface">{item.value}</p>
                    </div>
                    <span
                      className={`inline-flex rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-[0.16em] ${item.accentClassName}`}
                    >
                      Live
                    </span>
                  </div>
                  <p className="mt-3 text-sm font-medium leading-6 text-on-surface-variant">{item.note}</p>
                </div>
              ))}
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <Badge className="bg-primary-fixed text-on-primary-container">{period}</Badge>
              {selectedMember ? (
                <Badge className="bg-secondary-container text-on-secondary-container">{selectedMember}</Badge>
              ) : null}
              <Badge className="bg-surface-container-low text-on-surface">{offerRate}% CV → Offer</Badge>
            </div>
          </div>
        </div>

        <div className="chart-panel p-6 sm:p-8">
          <p className="text-sm font-black uppercase tracking-[0.18em] text-tertiary">Gợi ý hành động</p>
          <div className="mt-5 grid gap-3">
            <div className="rounded-[1.7rem] bg-surface-container-low px-5 py-4">
              <p className="text-sm font-black text-on-surface">Ưu tiên nhóm phỏng vấn</p>
              <p className="mt-2 text-sm font-medium leading-7 text-on-surface-variant">
                Nếu nhóm INTERVIEW và INTERVIEWED đang tăng, hãy đẩy lịch feedback và kết quả trong 24 đến 48 giờ.
              </p>
            </div>
            <div className="rounded-[1.7rem] bg-surface-container-low px-5 py-4">
              <p className="text-sm font-black text-on-surface">Cảnh báo đầu funnel</p>
              <p className="mt-2 text-sm font-medium leading-7 text-on-surface-variant">
                Nếu tổng CV nhận ít nhưng mục tiêu offer cao, nên bổ sung sourcing ở đầu pipeline ngay trong tuần này.
              </p>
            </div>
            <div className="rounded-[1.7rem] bg-surface-container-low px-5 py-4">
              <p className="text-sm font-black text-on-surface">Cân bằng tải HR</p>
              <p className="mt-2 text-sm font-medium leading-7 text-on-surface-variant">
                Khi một HR đang ôm quá nhiều CV, nên phân lại owner sớm để tránh chậm toàn bộ chu kỳ tuyển dụng.
              </p>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
