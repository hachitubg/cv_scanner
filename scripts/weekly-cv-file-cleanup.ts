import { cleanupOldCvFiles } from "@/lib/jobs/cleanup-old-cv-files";
import { prisma } from "@/lib/prisma";

const SUNDAY = 0;
const DEFAULT_HOUR = 2;
const DEFAULT_MINUTE = 0;

function readNumberEnv(name: string, fallback: number) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}

function getNextSundayRun(now = new Date()) {
  const hour = Math.min(23, readNumberEnv("CV_FILE_CLEANUP_HOUR", DEFAULT_HOUR));
  const minute = Math.min(59, readNumberEnv("CV_FILE_CLEANUP_MINUTE", DEFAULT_MINUTE));
  const next = new Date(now);

  next.setHours(hour, minute, 0, 0);

  const daysUntilSunday = (SUNDAY - now.getDay() + 7) % 7;
  next.setDate(now.getDate() + daysUntilSunday);

  if (next <= now) {
    next.setDate(next.getDate() + 7);
  }

  return next;
}

async function runCleanup() {
  const result = await cleanupOldCvFiles({
    retentionMonths: Math.max(1, readNumberEnv("CV_FILE_RETENTION_MONTHS", 3)),
    batchSize: Math.max(1, readNumberEnv("CV_FILE_CLEANUP_BATCH_SIZE", 100)),
  });

  console.info(
    [
      "Weekly old CV file cleanup completed.",
      `cutoff=${result.cutoff.toISOString()}`,
      `scanned=${result.scanned}`,
      `archived=${result.archived}`,
      `deleted=${result.deleted}`,
      `missing=${result.missing}`,
      `failed=${result.failed}`,
      `vacuumed=${result.vacuumed}`,
    ].join(" "),
  );
}

function scheduleNextRun() {
  const nextRun = getNextSundayRun();
  const delayMs = nextRun.getTime() - Date.now();

  console.info(`Next old CV file cleanup scheduled at ${nextRun.toISOString()}.`);

  setTimeout(async () => {
    try {
      await runCleanup();
    } catch (error) {
      console.error("Weekly old CV file cleanup failed:", error);
    } finally {
      scheduleNextRun();
    }
  }, delayMs);
}

process.on("SIGINT", async () => {
  await prisma.$disconnect();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  await prisma.$disconnect();
  process.exit(0);
});

scheduleNextRun();
