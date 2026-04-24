"use client";

import { useEffect, useMemo, useState } from "react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, PieChart, Pie, Cell } from "recharts";

type MonitorPayload = {
  counts: {
    users: number;
    workspaces: number;
    candidates: number;
    projects: number;
    files: number;
  };
  storage: {
    uploadsBytes: number;
    sqliteBytes: number;
    freeBytes: number;
    totalBytes: number;
  };
  vps: {
    hostname: string;
    platform: string;
    arch: string;
    uptimeSeconds: number;
    processUptimeSeconds: number;
    cpu: {
      usagePercent: number;
      coreCount: number;
      model: string;
      loadAverage1m: number;
      loadAverage5m: number;
      loadAverage15m: number;
    };
    memory: {
      totalBytes: number;
      freeBytes: number;
      usedBytes: number;
      usagePercent: number;
    };
    process: {
      rssBytes: number;
      heapTotalBytes: number;
      heapUsedBytes: number;
      externalBytes: number;
    };
  };
  topWorkspacesByStorage: Array<{
    workspaceId: string;
    workspaceName: string;
    bytes: number;
  }>;
  statusDistribution: Array<{
    status: string;
    count: number;
  }>;
  recentUploads: Array<{
    id: string;
    fileName: string;
    fileSize: number;
    uploadedAt: string;
    workspaceName: string;
  }>;
};

const PIE_COLORS = ["#a03964", "#006879", "#2b8a78", "#f59e0b", "#ef4444", "#6b7280"];

function formatBytes(bytes: number) {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** index;
  return `${value.toFixed(value >= 100 || index === 0 ? 0 : value >= 10 ? 1 : 2)} ${units[index]}`;
}

function formatPercent(value: number) {
  return `${Math.max(0, Math.min(100, value)).toFixed(1)}%`;
}

function formatDuration(totalSeconds: number) {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (days > 0) return `${days} ngày ${hours} giờ`;
  if (hours > 0) return `${hours} giờ ${minutes} phút`;
  return `${minutes} phút`;
}

export function SystemAdminDashboard() {
  const [data, setData] = useState<MonitorPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    fetch("/api/admin/monitor")
      .then(async (response) => {
        const payload = (await response.json()) as MonitorPayload & { error?: string };
        if (!response.ok) {
          throw new Error(payload.error || "Không thể tải monitor.");
        }
        return payload;
      })
      .then((payload) => {
        if (active) {
          setData(payload);
          setError(null);
        }
      })
      .catch((err: unknown) => {
        if (active) {
          setError(err instanceof Error ? err.message : "Không thể tải monitor.");
        }
      });

    return () => {
      active = false;
    };
  }, []);

  const diskUsagePercent = useMemo(() => {
    if (!data?.storage.totalBytes) return 0;
    return ((data.storage.totalBytes - data.storage.freeBytes) / data.storage.totalBytes) * 100;
  }, [data]);

  if (error) {
    return <div style={{ padding: 24, color: "#b91c1c", fontWeight: 700 }}>{error}</div>;
  }

  if (!data) {
    return <div style={{ padding: 24, fontWeight: 700 }}>Đang tải monitor...</div>;
  }

  return (
    <div style={{ padding: 24, display: "grid", gap: 24 }}>
      <div>
        <div style={{ fontSize: 12, fontWeight: 900, letterSpacing: "0.12em", textTransform: "uppercase", color: "#a03964" }}>
          System Admin
        </div>
        <h2 style={{ marginTop: 8, marginBottom: 8, fontSize: 36, lineHeight: 1.05 }}>Tổng quan hệ thống CV Scanner</h2>
        <p style={{ margin: 0, maxWidth: 960, color: "#475569", fontWeight: 500 }}>
          Dashboard này tách riêng cho admin toàn hệ thống: theo dõi dữ liệu, dung lượng uploads, SQLite, disk và tài nguyên VPS đang chạy ứng dụng.
        </p>
      </div>

      <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
        <MetricCard label="Users" value={String(data.counts.users)} note="Tài khoản hệ thống" />
        <MetricCard label="Workspaces" value={String(data.counts.workspaces)} note="Không gian HR" />
        <MetricCard label="Candidates" value={String(data.counts.candidates)} note="Hồ sơ ứng viên" />
        <MetricCard label="Uploads" value={String(data.counts.files)} note="File CV đang lưu" />
        <MetricCard label="CPU Used" value={formatPercent(data.vps.cpu.usagePercent)} note={`${data.vps.cpu.coreCount} cores`} />
        <MetricCard label="RAM Used" value={formatPercent(data.vps.memory.usagePercent)} note={formatBytes(data.vps.memory.usedBytes)} />
        <MetricCard label="Disk Used" value={formatPercent(diskUsagePercent)} note="Ổ đĩa chứa project" />
        <MetricCard label="Uptime" value={formatDuration(data.vps.uptimeSeconds)} note={data.vps.hostname} />
      </div>

      <div style={{ display: "grid", gap: 24, gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))" }}>
        <Panel title="Monitor VPS">
          <div style={{ display: "grid", gap: 14 }}>
            <PercentRow label="CPU usage" value={data.vps.cpu.usagePercent} />
            <PercentRow label="RAM usage" value={data.vps.memory.usagePercent} />
            <PercentRow label="Disk usage" value={diskUsagePercent} />
            <StorageRow label="CPU model" value={data.vps.cpu.model} />
            <StorageRow label="Load average" value={`${data.vps.cpu.loadAverage1m.toFixed(2)} / ${data.vps.cpu.loadAverage5m.toFixed(2)} / ${data.vps.cpu.loadAverage15m.toFixed(2)}`} />
            <StorageRow label="Platform" value={`${data.vps.platform} ${data.vps.arch}`} />
          </div>
        </Panel>

        <Panel title="Bộ nhớ và process Node.js">
          <div style={{ display: "grid", gap: 12 }}>
            <StorageRow label="RAM đã dùng" value={formatBytes(data.vps.memory.usedBytes)} />
            <StorageRow label="RAM còn trống" value={formatBytes(data.vps.memory.freeBytes)} />
            <StorageRow label="Tổng RAM" value={formatBytes(data.vps.memory.totalBytes)} />
            <StorageRow label="Process RSS" value={formatBytes(data.vps.process.rssBytes)} />
            <StorageRow label="Heap used / total" value={`${formatBytes(data.vps.process.heapUsedBytes)} / ${formatBytes(data.vps.process.heapTotalBytes)}`} />
            <StorageRow label="Node uptime" value={formatDuration(data.vps.processUptimeSeconds)} />
          </div>
        </Panel>
      </div>

      <div style={{ display: "grid", gap: 24, gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))" }}>
        <Panel title="Top workspace theo dung lượng file CV">
          <div style={{ height: 320 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.topWorkspacesByStorage}>
                <XAxis dataKey="workspaceName" tick={{ fontSize: 12 }} interval={0} angle={-15} textAnchor="end" height={60} />
                <YAxis tickFormatter={(value) => formatBytes(Number(value))} width={90} />
                <Tooltip formatter={(value) => formatBytes(Number(value ?? 0))} />
                <Bar dataKey="bytes" fill="#a03964" radius={[10, 10, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel title="Phân bố trạng thái ứng viên">
          <div style={{ height: 320 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data.statusDistribution}
                  dataKey="count"
                  nameKey="status"
                  innerRadius={64}
                  outerRadius={104}
                  paddingAngle={3}
                >
                  {data.statusDistribution.map((entry, index) => (
                    <Cell key={entry.status} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Panel>
      </div>

      <Panel title="Monitor lưu trữ">
        <div style={{ display: "grid", gap: 12 }}>
          <StorageRow label="Thư mục uploads" value={formatBytes(data.storage.uploadsBytes)} />
          <StorageRow label="SQLite database" value={formatBytes(data.storage.sqliteBytes)} />
          <StorageRow label="Dung lượng trống" value={formatBytes(data.storage.freeBytes)} />
          <StorageRow label="Tổng dung lượng" value={formatBytes(data.storage.totalBytes)} />
        </div>
      </Panel>

      <Panel title="File upload gần đây">
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <TableHead>File</TableHead>
                <TableHead>Workspace</TableHead>
                <TableHead>Kích thước</TableHead>
                <TableHead>Uploaded</TableHead>
              </tr>
            </thead>
            <tbody>
              {data.recentUploads.map((item) => (
                <tr key={item.id}>
                  <TableCell>{item.fileName}</TableCell>
                  <TableCell>{item.workspaceName}</TableCell>
                  <TableCell>{formatBytes(item.fileSize)}</TableCell>
                  <TableCell>{new Date(item.uploadedAt).toLocaleString("vi-VN")}</TableCell>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}

function MetricCard({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div
      style={{
        padding: 18,
        borderRadius: 20,
        background: "linear-gradient(145deg, rgba(255,255,255,0.98), rgba(247,242,243,0.95))",
        boxShadow: "0 18px 40px rgba(160,57,100,0.10)",
      }}
    >
      <div style={{ fontSize: 11, fontWeight: 900, letterSpacing: "0.14em", textTransform: "uppercase", color: "#64748b" }}>{label}</div>
      <div style={{ marginTop: 10, fontSize: 30, fontWeight: 900, color: "#111827" }}>{value}</div>
      <div style={{ marginTop: 8, fontSize: 13, fontWeight: 600, color: "#64748b" }}>{note}</div>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        padding: 20,
        borderRadius: 24,
        background: "#ffffff",
        boxShadow: "0 20px 50px rgba(15,23,42,0.08)",
      }}
    >
      <div style={{ marginBottom: 16, fontSize: 16, fontWeight: 900 }}>{title}</div>
      {children}
    </div>
  );
}

function PercentRow({ label, value }: { label: string; value: number }) {
  const safeValue = Math.max(0, Math.min(100, value));

  return (
    <div style={{ display: "grid", gap: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
        <span style={{ fontWeight: 800 }}>{label}</span>
        <span style={{ color: "#475569", fontWeight: 800 }}>{formatPercent(safeValue)}</span>
      </div>
      <div style={{ height: 10, overflow: "hidden", borderRadius: 999, background: "#f1edee" }}>
        <div
          style={{
            width: `${safeValue}%`,
            height: "100%",
            borderRadius: 999,
            background: "linear-gradient(90deg, #a03964, #006879)",
          }}
        />
      </div>
    </div>
  );
}

function StorageRow({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        gap: 12,
        padding: "14px 16px",
        borderRadius: 16,
        background: "#f8fafc",
      }}
    >
      <span style={{ fontWeight: 800 }}>{label}</span>
      <span style={{ color: "#475569", fontWeight: 700, textAlign: "right" }}>{value}</span>
    </div>
  );
}

function TableHead({ children }: { children: React.ReactNode }) {
  return (
    <th
      style={{
        textAlign: "left",
        fontSize: 12,
        fontWeight: 900,
        letterSpacing: "0.12em",
        textTransform: "uppercase",
        color: "#64748b",
        padding: "0 0 12px",
      }}
    >
      {children}
    </th>
  );
}

function TableCell({ children }: { children: React.ReactNode }) {
  return (
    <td
      style={{
        padding: "12px 0",
        borderTop: "1px solid #e2e8f0",
        fontSize: 14,
        fontWeight: 600,
        color: "#334155",
      }}
    >
      {children}
    </td>
  );
}
