import fs from "node:fs/promises";
import path from "node:path";

const LOG_RETENTION_DAYS = Number(process.env.LOG_RETENTION_DAYS ?? "7");
const LOG_TAIL_BYTES = Number(process.env.LOG_TAIL_BYTES ?? String(256 * 1024));
const CLEANUP_INTERVAL_MS = 6 * 60 * 60 * 1000;
const LOG_FILE_PATTERN = /^app-\d{4}-\d{2}-\d{2}\.log$/;

let lastCleanupAt = 0;

export type AppLogLevel = "debug" | "info" | "warn" | "error";

export type AppLogRecord = {
  timestamp: string;
  level: AppLogLevel;
  event: string;
  message: string;
  meta?: Record<string, unknown>;
};

function getLogsDirectory() {
  return path.join(process.cwd(), "logs");
}

function getLogFileName(date = new Date()) {
  return `app-${date.toISOString().slice(0, 10)}.log`;
}

function resolveLogFilePath(id: string) {
  if (!LOG_FILE_PATTERN.test(id)) {
    throw new Error("NOT_FOUND");
  }

  return path.join(getLogsDirectory(), id);
}

async function ensureLogsDirectory() {
  await fs.mkdir(getLogsDirectory(), { recursive: true });
}

function sanitizeMeta(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: value.stack?.slice(0, 4000),
    };
  }
  if (typeof value === "bigint") return value.toString();
  if (typeof value === "string") return value.length > 4000 ? `${value.slice(0, 4000)}...` : value;
  if (typeof value !== "object") return value;
  if (Array.isArray(value)) return value.slice(0, 50).map(sanitizeMeta);

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .slice(0, 50)
      .map(([key, item]) => [key, sanitizeMeta(item)]),
  );
}

async function cleanupOldLogs(force = false) {
  const now = Date.now();
  if (!force && now - lastCleanupAt < CLEANUP_INTERVAL_MS) return;

  lastCleanupAt = now;
  await ensureLogsDirectory();

  const retentionMs = Math.max(1, LOG_RETENTION_DAYS) * 24 * 60 * 60 * 1000;
  const entries = await fs.readdir(getLogsDirectory(), { withFileTypes: true });

  await Promise.all(
    entries
      .filter((entry) => entry.isFile() && LOG_FILE_PATTERN.test(entry.name))
      .map(async (entry) => {
        const filePath = path.join(getLogsDirectory(), entry.name);
        const stat = await fs.stat(filePath);
        if (now - stat.mtimeMs > retentionMs) {
          await fs.unlink(filePath);
        }
      }),
  );
}

export async function writeAppLog(
  level: AppLogLevel,
  event: string,
  message: string,
  meta?: Record<string, unknown>,
) {
  try {
    await ensureLogsDirectory();
    void cleanupOldLogs();

    const record: AppLogRecord = {
      timestamp: new Date().toISOString(),
      level,
      event,
      message,
      meta: sanitizeMeta(meta) as Record<string, unknown> | undefined,
    };
    const line = `${JSON.stringify(record)}\n`;

    await fs.appendFile(path.join(getLogsDirectory(), getLogFileName()), line, "utf8");
  } catch (error) {
    console.error("Failed to write app log:", error);
  }
}

export async function listLogFiles(url: URL) {
  await cleanupOldLogs();

  const page = Number(url.searchParams.get("page") ?? "1");
  const perPage = Number(url.searchParams.get("perPage") ?? "25");
  const safePage = Number.isFinite(page) && page > 0 ? page : 1;
  const safePerPage = Number.isFinite(perPage) && perPage > 0 ? Math.min(perPage, 100) : 25;
  const filterRaw = url.searchParams.get("filter");
  let query = "";
  if (filterRaw) {
    try {
      query = String((JSON.parse(filterRaw) as Record<string, unknown>).q ?? "").trim();
    } catch {
      query = "";
    }
  }

  const entries = await fs.readdir(getLogsDirectory(), { withFileTypes: true });
  const files = await Promise.all(
    entries
      .filter((entry) => entry.isFile() && LOG_FILE_PATTERN.test(entry.name))
      .map(async (entry) => {
        const filePath = path.join(getLogsDirectory(), entry.name);
        const stat = await fs.stat(filePath);
        return {
          id: entry.name,
          fileName: entry.name,
          sizeBytes: stat.size,
          updatedAt: stat.mtime.toISOString(),
          retainedUntil: new Date(stat.mtimeMs + Math.max(1, LOG_RETENTION_DAYS) * 24 * 60 * 60 * 1000).toISOString(),
        };
      }),
  );

  const filtered = query
    ? files.filter((file) => file.fileName.toLowerCase().includes(query.toLowerCase()))
    : files;
  const sorted = filtered.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  const start = (safePage - 1) * safePerPage;

  return {
    data: sorted.slice(start, start + safePerPage),
    total: filtered.length,
  };
}

export async function getLogFile(id: string) {
  await cleanupOldLogs();

  const filePath = resolveLogFilePath(id);
  const stat = await fs.stat(filePath).catch(() => null);
  if (!stat) throw new Error("NOT_FOUND");

  const bytesToRead = Math.min(Math.max(4096, LOG_TAIL_BYTES), stat.size);
  const handle = await fs.open(filePath, "r");

  try {
    const buffer = Buffer.alloc(bytesToRead);
    await handle.read(buffer, 0, bytesToRead, stat.size - bytesToRead);
    const tailText = buffer.toString("utf8").replace(/^\uFEFF/, "");

    return {
      id,
      fileName: id,
      sizeBytes: stat.size,
      updatedAt: stat.mtime.toISOString(),
      retainedUntil: new Date(stat.mtimeMs + Math.max(1, LOG_RETENTION_DAYS) * 24 * 60 * 60 * 1000).toISOString(),
      tailBytes: bytesToRead,
      tailText,
    };
  } finally {
    await handle.close();
  }
}

export async function deleteLogFile(id: string) {
  const filePath = resolveLogFilePath(id);
  await fs.unlink(filePath).catch((error: NodeJS.ErrnoException) => {
    if (error.code === "ENOENT") throw new Error("NOT_FOUND");
    throw error;
  });

  return { success: true };
}

export { cleanupOldLogs };
