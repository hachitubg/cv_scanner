import { archiveRawTextFile, deleteUploadedFile } from "@/lib/files";
import { writeAppLog } from "@/lib/logs";
import { prisma } from "@/lib/prisma";

const DEFAULT_RETENTION_MONTHS = 3;
const DEFAULT_BATCH_SIZE = 100;

export type CleanupOldCvFilesResult = {
  cutoff: Date;
  scanned: number;
  archived: number;
  deleted: number;
  missing: number;
  failed: number;
  vacuumed: boolean;
};

function subtractMonths(date: Date, months: number) {
  const next = new Date(date);
  next.setMonth(next.getMonth() - months);
  return next;
}

async function vacuumSqliteIfNeeded(shouldVacuum: boolean) {
  if (!shouldVacuum) return false;
  await prisma.$executeRawUnsafe("VACUUM");
  return true;
}

export async function cleanupOldCvFiles({
  retentionMonths = DEFAULT_RETENTION_MONTHS,
  batchSize = DEFAULT_BATCH_SIZE,
}: {
  retentionMonths?: number;
  batchSize?: number;
} = {}): Promise<CleanupOldCvFilesResult> {
  const cutoff = subtractMonths(new Date(), Math.max(1, retentionMonths));
  let scanned = 0;
  let archived = 0;
  let deleted = 0;
  let missing = 0;
  let failed = 0;
  let changedDatabase = false;

  await writeAppLog("info", "job.cleanup_old_cv_files.start", "Starting old uploaded CV file cleanup and raw text archive.", {
    cutoff: cutoff.toISOString(),
    retentionMonths,
    batchSize,
  });

  while (true) {
    const files = await prisma.cVFile.findMany({
      where: {
        uploadedAt: {
          lt: cutoff,
        },
        OR: [
          {
            filePath: {
              not: null,
            },
          },
          {
            rawText: {
              not: "",
            },
            rawTextArchivedPath: null,
          },
        ],
      },
      select: {
        id: true,
        workspaceId: true,
        fileName: true,
        filePath: true,
        rawText: true,
        rawTextArchivedPath: true,
        uploadedAt: true,
      },
      orderBy: {
        uploadedAt: "asc",
      },
      take: Math.max(1, Math.min(batchSize, 500)),
    });

    if (!files.length) break;

    for (const file of files) {
      scanned += 1;

      try {
        let archivedPath = file.rawTextArchivedPath;
        let archivedAt: Date | undefined;

        if (file.rawText && !file.rawTextArchivedPath) {
          archivedPath = await archiveRawTextFile(file.workspaceId, file.id, file.rawText);
          archivedAt = new Date();
          archived += 1;
        }

        if (file.filePath) {
          const removed = await deleteUploadedFile(file.filePath);
          if (removed) {
            deleted += 1;
          } else {
            missing += 1;
          }
        }

        await prisma.cVFile.update({
          where: { id: file.id },
          data: {
            filePath: null,
            rawText: "",
            rawTextArchivedPath: archivedPath,
            rawTextArchivedAt: archivedAt,
          },
        });
        changedDatabase = true;
      } catch (error) {
        failed += 1;
        await writeAppLog("error", "job.cleanup_old_cv_files.archive_failed", "Failed to cleanup or archive old uploaded CV file.", {
          cvFileId: file.id,
          fileName: file.fileName,
          filePath: file.filePath,
          uploadedAt: file.uploadedAt.toISOString(),
          error,
        });
      }
    }
  }

  const vacuumed = await vacuumSqliteIfNeeded(changedDatabase);
  const result = {
    cutoff,
    scanned,
    archived,
    deleted,
    missing,
    failed,
    vacuumed,
  };

  await writeAppLog("info", "job.cleanup_old_cv_files.finish", "Finished old uploaded CV file cleanup and raw text archive.", {
    cutoff: cutoff.toISOString(),
    scanned,
    archived,
    deleted,
    missing,
    failed,
    vacuumed,
  });

  return result;
}
