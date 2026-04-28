import { cleanupOldCvFiles } from "@/lib/jobs/cleanup-old-cv-files";
import { prisma } from "@/lib/prisma";

function readNumberEnv(name: string, fallback: number) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

async function main() {
  const result = await cleanupOldCvFiles({
    retentionMonths: readNumberEnv("CV_FILE_RETENTION_MONTHS", 3),
    batchSize: readNumberEnv("CV_FILE_CLEANUP_BATCH_SIZE", 100),
  });

  console.info(
    [
      "Old CV file cleanup completed.",
      `cutoff=${result.cutoff.toISOString()}`,
      `scanned=${result.scanned}`,
      `archived=${result.archived}`,
      `deleted=${result.deleted}`,
      `missing=${result.missing}`,
      `failed=${result.failed}`,
      `vacuumed=${result.vacuumed}`,
    ].join(" "),
  );

  if (result.failed > 0) {
    process.exitCode = 1;
  }
}

main()
  .catch((error) => {
    console.error("Old CV file cleanup failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
