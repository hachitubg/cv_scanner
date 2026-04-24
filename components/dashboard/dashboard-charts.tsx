"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const PIE_COLORS = ["#a03964", "#006879", "#206963", "#ffb0ca", "#85d2e6"];
const FUNNEL_COLORS = ["#a03964", "#c54a7b", "#e27ca4", "#5ab9ca", "#206963"];

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ name?: string; value?: number; payload?: { label?: string; name?: string } }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;

  const point = payload[0];
  const title = label || point.payload?.label || point.payload?.name || point.name;

  return (
    <div className="rounded-[1.5rem] bg-white/95 px-4 py-3 shadow-[0_18px_45px_rgba(160,57,100,0.18)] backdrop-blur">
      <p className="text-[11px] font-black uppercase tracking-[0.16em] text-outline">{title}</p>
      <p className="mt-2 text-lg font-black text-on-surface">{point.value ?? 0}</p>
    </div>
  );
}

export function DashboardCharts({
  volumeData,
  hrDistribution,
  funnelData,
}: {
  volumeData: { label: string; total: number }[];
  hrDistribution: { name: string; value: number }[];
  funnelData: { name: string; value: number }[];
}) {
  const pieData = hrDistribution.length ? hrDistribution : [{ name: "Chưa có dữ liệu", value: 1 }];
  const totalAssigned = hrDistribution.reduce((sum, item) => sum + item.value, 0);
  const bestMonth = [...volumeData].sort((left, right) => right.total - left.total)[0];
  const biggestOwner = [...hrDistribution].sort((left, right) => right.value - left.value)[0];
  const funnelPeak = funnelData[0]?.value ?? 0;
  const funnelWithRate = funnelData.map((item) => ({
    ...item,
    rate: funnelPeak ? Math.round((item.value / funnelPeak) * 100) : 0,
  }));

  return (
    <section className="grid gap-6 xl:grid-cols-[1.18fr_0.82fr]">
      <div className="chart-panel overflow-hidden p-0">
        <div className="relative overflow-hidden px-6 pb-4 pt-6 sm:px-8 sm:pt-8">
          <div className="absolute -right-16 top-0 h-40 w-40 rounded-full bg-primary/10 blur-3xl" />
          <div className="absolute bottom-0 left-12 h-24 w-24 rounded-full bg-secondary/10 blur-3xl" />

          <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.18em] text-primary">Nhịp nhận CV</p>
              <h3 className="mt-2 text-3xl font-black tracking-tight text-on-surface">
                Luồng CV 6 tháng gần nhất
              </h3>
              <p className="mt-3 max-w-2xl text-sm font-medium leading-7 text-on-surface-variant">
                Biểu đồ volume được làm mềm hơn để nhìn ra chu kỳ tăng trưởng thay vì chỉ xem cột số.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-[1.6rem] bg-surface-container-low px-4 py-3">
                <p className="text-[11px] font-black uppercase tracking-[0.16em] text-outline">Tháng cao nhất</p>
                <p className="mt-2 text-lg font-black text-on-surface">{bestMonth?.label ?? "N/A"}</p>
              </div>
              <div className="rounded-[1.6rem] bg-surface-container-low px-4 py-3">
                <p className="text-[11px] font-black uppercase tracking-[0.16em] text-outline">Số CV</p>
                <p className="mt-2 text-lg font-black text-on-surface">{bestMonth?.total ?? 0}</p>
              </div>
            </div>
          </div>

          <div className="mt-8 h-[22rem] sm:h-[26rem]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={volumeData} margin={{ top: 12, right: 8, left: -18, bottom: 0 }}>
                <defs>
                  <linearGradient id="volumeFill" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="#a03964" stopOpacity={0.36} />
                    <stop offset="58%" stopColor="#ffb0ca" stopOpacity={0.18} />
                    <stop offset="100%" stopColor="#ffffff" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="label"
                  tickLine={false}
                  axisLine={false}
                  stroke="#8e6f78"
                  tickMargin={12}
                  fontSize={12}
                />
                <YAxis
                  allowDecimals={false}
                  tickLine={false}
                  axisLine={false}
                  stroke="#8e6f78"
                  width={36}
                  fontSize={12}
                />
                <Tooltip content={<ChartTooltip />} />
                <Area
                  type="monotone"
                  dataKey="total"
                  stroke="#a03964"
                  strokeWidth={4}
                  fill="url(#volumeFill)"
                  dot={{ r: 0 }}
                  activeDot={{ r: 7, fill: "#ffffff", stroke: "#a03964", strokeWidth: 4 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid gap-6">
        <div className="chart-panel overflow-hidden p-0">
          <div className="px-6 pb-5 pt-6 sm:px-8 sm:pt-8">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-black uppercase tracking-[0.18em] text-secondary">Phân bổ HR</p>
                <h3 className="mt-2 text-3xl font-black tracking-tight text-on-surface">CV theo người phụ trách</h3>
              </div>
              <div className="rounded-[1.6rem] bg-surface-container-low px-4 py-3">
                <p className="text-[11px] font-black uppercase tracking-[0.16em] text-outline">Top owner</p>
                <p className="mt-2 text-lg font-black text-on-surface">{biggestOwner?.name ?? "Chưa có"}</p>
              </div>
            </div>

            <div className="mt-4 grid items-center gap-2 lg:grid-cols-[0.95fr_1.05fr]">
              <div className="h-72 sm:h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={62}
                      outerRadius={94}
                      paddingAngle={2}
                      stroke="none"
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`${entry.name}-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip content={<ChartTooltip />} />
                    <text
                      x="50%"
                      y="46%"
                      textAnchor="middle"
                      className="fill-on-surface text-[12px] font-black uppercase tracking-[0.16em]"
                    >
                      Tổng CV
                    </text>
                    <text
                      x="50%"
                      y="58%"
                      textAnchor="middle"
                      className="fill-on-surface text-[32px] font-black tracking-tight"
                    >
                      {totalAssigned}
                    </text>
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="space-y-3">
                {hrDistribution.length ? (
                  hrDistribution.map((item, index) => (
                    <div key={item.name} className="rounded-[1.4rem] bg-surface-container-low px-4 py-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <span
                            className="h-3.5 w-3.5 rounded-full"
                            style={{ backgroundColor: PIE_COLORS[index % PIE_COLORS.length] }}
                          />
                          <p className="text-sm font-black text-on-surface">{item.name}</p>
                        </div>
                        <p className="text-sm font-black text-on-surface">{item.value}</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-[1.6rem] bg-surface-container-low px-4 py-4 text-sm font-medium text-on-surface-variant">
                    Chưa có dữ liệu phân bổ HR trong kỳ này.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="chart-panel overflow-hidden p-0">
          <div className="px-6 pb-6 pt-6 sm:px-8 sm:pt-8">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-black uppercase tracking-[0.18em] text-tertiary">Hành trình CV</p>
                <h3 className="mt-2 text-3xl font-black tracking-tight text-on-surface">Funnel từ tiếp nhận tới onboard</h3>
              </div>
              <div className="rounded-[1.6rem] bg-surface-container-low px-4 py-3">
                <p className="text-[11px] font-black uppercase tracking-[0.16em] text-outline">Tỷ lệ cuối</p>
                <p className="mt-2 text-lg font-black text-on-surface">
                  {funnelWithRate[funnelWithRate.length - 1]?.rate ?? 0}%
                </p>
              </div>
            </div>

            <div className="mt-8 h-[19rem] sm:h-[20rem]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={funnelWithRate}
                  layout="vertical"
                  margin={{ top: 0, right: 16, left: 12, bottom: 0 }}
                  barCategoryGap={18}
                >
                  <XAxis type="number" hide />
                  <YAxis
                    dataKey="name"
                    type="category"
                    tickLine={false}
                    axisLine={false}
                    stroke="#8e6f78"
                    width={86}
                    fontSize={12}
                  />
                  <Tooltip content={<ChartTooltip />} />
                  <Bar dataKey="value" radius={[0, 18, 18, 0]} barSize={26}>
                    {funnelWithRate.map((entry, index) => (
                      <Cell key={`${entry.name}-${index}`} fill={FUNNEL_COLORS[index % FUNNEL_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              {funnelWithRate.slice(0, 3).map((item, index) => (
                <div key={item.name} className="rounded-[1.4rem] bg-surface-container-low px-4 py-3">
                  <p className="text-[11px] font-black uppercase tracking-[0.16em] text-outline">{item.name}</p>
                  <div className="mt-2 flex items-end justify-between gap-2">
                    <p className="text-lg font-black text-on-surface">{item.value}</p>
                    <p
                      className="rounded-full px-2.5 py-1 text-[11px] font-black uppercase tracking-[0.12em]"
                      style={{
                        backgroundColor: `${FUNNEL_COLORS[index % FUNNEL_COLORS.length]}1A`,
                        color: FUNNEL_COLORS[index % FUNNEL_COLORS.length],
                      }}
                    >
                      {item.rate}%
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
