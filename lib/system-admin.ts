import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import bcrypt from "bcryptjs";
import { z } from "zod";

import { deleteUploadedFile, getPathSize } from "@/lib/files";
import { cleanupOldLogs, deleteLogFile, getLogFile, listLogFiles } from "@/lib/logs";
import { prisma } from "@/lib/prisma";
import { CANDIDATE_STATUSES, MANAGER_DECISIONS, ROLES } from "@/types";

export const adminResourceNames = ["users", "workspaces", "candidates", "projects", "files", "logs"] as const;
export type AdminResourceName = (typeof adminResourceNames)[number];

const userCreateSchema = z.object({
  name: z.string().trim().min(2),
  email: z.string().trim().email(),
  password: z.string().min(8),
  role: z.enum(ROLES).default("USER"),
});

const userUpdateSchema = z.object({
  name: z.string().trim().min(2).optional(),
  email: z.string().trim().email().optional(),
  password: z.string().min(8).optional(),
  role: z.enum(ROLES).optional(),
});

const workspaceUpdateSchema = z.object({
  name: z.string().trim().min(2),
});

const projectUpdateSchema = z.object({
  name: z.string().trim().min(2),
  description: z.string().trim().nullable().optional(),
});

const candidateUpdateSchema = z.object({
  fullName: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  position: z.string().nullable().optional(),
  source: z.string().nullable().optional(),
  offerSalary: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  status: z.enum(CANDIDATE_STATUSES).optional(),
  managerDecision: z.union([z.enum(MANAGER_DECISIONS), z.literal(""), z.null()]).optional(),
  managerOfferSalary: z.string().nullable().optional(),
  managerReviewNote: z.string().nullable().optional(),
});

function parseFilter(url: URL) {
  const raw = url.searchParams.get("filter");
  if (!raw) return {};

  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function parseListQuery(url: URL) {
  const page = Number(url.searchParams.get("page") ?? "1");
  const perPage = Number(url.searchParams.get("perPage") ?? "25");
  const sort = url.searchParams.get("sort") ?? "createdAt";
  const order = url.searchParams.get("order") === "ASC" ? "asc" : "desc";
  const filter = parseFilter(url);

  return {
    page: Number.isFinite(page) && page > 0 ? page : 1,
    perPage: Number.isFinite(perPage) && perPage > 0 ? Math.min(perPage, 100) : 25,
    sort,
    order: order as "asc" | "desc",
    filter,
  };
}

function asNullableString(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  return String(value);
}

function hasResourceName(resource: string): resource is AdminResourceName {
  return adminResourceNames.includes(resource as AdminResourceName);
}

async function countAdmins() {
  return prisma.user.count({
    where: { role: "ADMIN" },
  });
}

export async function listAdminResource(resource: string, url: URL) {
  if (!hasResourceName(resource)) {
    throw new Error("NOT_FOUND");
  }

  if (resource === "logs") {
    return listLogFiles(url);
  }

  const { page, perPage, sort, order, filter } = parseListQuery(url);
  const skip = (page - 1) * perPage;
  const q = String(filter.q ?? "").trim();

  switch (resource) {
    case "users": {
      const where = q
        ? {
            OR: [{ name: { contains: q } }, { email: { contains: q } }],
          }
        : {};
      const [items, total] = await Promise.all([
        prisma.user.findMany({
          where,
          orderBy: {
            [sort === "name" || sort === "email" || sort === "role" ? sort : "createdAt"]: order,
          },
          skip,
          take: perPage,
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            createdAt: true,
            _count: {
              select: {
                workspaceMembers: true,
              },
            },
          },
        }),
        prisma.user.count({ where }),
      ]);

      return {
        data: items.map((item) => ({
          ...item,
          workspaceCount: item._count.workspaceMembers,
        })),
        total,
      };
    }
    case "workspaces": {
      const where = q ? { name: { contains: q } } : {};
      const [items, total] = await Promise.all([
        prisma.workspace.findMany({
          where,
          orderBy: {
            [sort === "name" ? sort : "createdAt"]: order,
          },
          skip,
          take: perPage,
          include: {
            owner: true,
            members: true,
            candidates: true,
            cvFiles: true,
          },
        }),
        prisma.workspace.count({ where }),
      ]);

      return {
        data: items.map((item) => ({
          id: item.id,
          name: item.name,
          ownerId: item.ownerId,
          ownerName: item.owner.name,
          createdAt: item.createdAt,
          memberCount: item.members.length,
          candidateCount: item.candidates.length,
          fileCount: item.cvFiles.length,
        })),
        total,
      };
    }
    case "candidates": {
      const where = q
        ? {
            OR: [
              { fullName: { contains: q } },
              { email: { contains: q } },
              { position: { contains: q } },
            ],
          }
        : {};
      const [items, total] = await Promise.all([
        prisma.candidate.findMany({
          where,
          orderBy: {
            [sort === "fullName" || sort === "status" || sort === "updatedAt" ? sort : "createdAt"]: order,
          },
          skip,
          take: perPage,
          include: {
            workspace: true,
            hr: true,
            project: true,
          },
        }),
        prisma.candidate.count({ where }),
      ]);

      return {
        data: items.map((item) => ({
          id: item.id,
          fullName: item.fullName,
          email: item.email,
          phone: item.phone,
          position: item.position,
          source: item.source,
          status: item.status,
          workspaceId: item.workspaceId,
          workspaceName: item.workspace.name,
          hrId: item.hrId,
          hrName: item.hr.name,
          projectId: item.projectId,
          projectName: item.project?.name ?? null,
          offerSalary: item.offerSalary,
          notes: item.notes,
          managerDecision: item.managerDecision,
          managerOfferSalary: item.managerOfferSalary,
          managerReviewNote: item.managerReviewNote,
          createdAt: item.createdAt,
          updatedAt: item.updatedAt,
        })),
        total,
      };
    }
    case "projects": {
      const where = q ? { name: { contains: q } } : {};
      const [items, total] = await Promise.all([
        prisma.project.findMany({
          where,
          orderBy: {
            [sort === "name" || sort === "updatedAt" ? sort : "createdAt"]: order,
          },
          skip,
          take: perPage,
          include: {
            workspace: true,
          },
        }),
        prisma.project.count({ where }),
      ]);

      return {
        data: items.map((item) => ({
          id: item.id,
          name: item.name,
          description: item.description,
          workspaceId: item.workspaceId,
          workspaceName: item.workspace.name,
          createdAt: item.createdAt,
          updatedAt: item.updatedAt,
        })),
        total,
      };
    }
    case "files": {
      const where = q ? { fileName: { contains: q } } : {};
      const [items, total] = await Promise.all([
        prisma.cVFile.findMany({
          where,
          orderBy: {
            [sort === "fileName" || sort === "fileSize" ? sort : "uploadedAt"]: order,
          },
          skip,
          take: perPage,
          include: {
            workspace: true,
            uploader: true,
          },
        }),
        prisma.cVFile.count({ where }),
      ]);

      return {
        data: items.map((item) => ({
          id: item.id,
          fileName: item.fileName,
          filePath: item.filePath,
          mimeType: item.mimeType,
          fileSize: item.fileSize,
          workspaceId: item.workspaceId,
          workspaceName: item.workspace.name,
          uploadedBy: item.uploadedBy,
          uploaderName: item.uploader.name,
          uploadedAt: item.uploadedAt,
        })),
        total,
      };
    }
  }
}

export async function getAdminResource(resource: string, id: string) {
  if (!hasResourceName(resource)) {
    throw new Error("NOT_FOUND");
  }

  if (resource === "logs") {
    return getLogFile(id);
  }

  switch (resource) {
    case "users": {
      const item = await prisma.user.findUnique({
        where: { id },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          createdAt: true,
          _count: {
            select: {
              workspaceMembers: true,
            },
          },
        },
      });
      if (!item) throw new Error("NOT_FOUND");
      return { ...item, workspaceCount: item._count.workspaceMembers };
    }
    case "workspaces": {
      const item = await prisma.workspace.findUnique({
        where: { id },
        include: {
          owner: true,
          members: true,
          candidates: true,
          cvFiles: true,
        },
      });
      if (!item) throw new Error("NOT_FOUND");
      return {
        id: item.id,
        name: item.name,
        ownerId: item.ownerId,
        ownerName: item.owner.name,
        createdAt: item.createdAt,
        memberCount: item.members.length,
        candidateCount: item.candidates.length,
        fileCount: item.cvFiles.length,
      };
    }
    case "candidates": {
      const item = await prisma.candidate.findUnique({
        where: { id },
        include: {
          workspace: true,
          hr: true,
          project: true,
        },
      });
      if (!item) throw new Error("NOT_FOUND");
      return {
        id: item.id,
        fullName: item.fullName,
        email: item.email,
        phone: item.phone,
        position: item.position,
        source: item.source,
        status: item.status,
        workspaceId: item.workspaceId,
        workspaceName: item.workspace.name,
        hrId: item.hrId,
        hrName: item.hr.name,
        projectId: item.projectId,
        projectName: item.project?.name ?? null,
        offerSalary: item.offerSalary,
        notes: item.notes,
        managerDecision: item.managerDecision,
        managerOfferSalary: item.managerOfferSalary,
        managerReviewNote: item.managerReviewNote,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      };
    }
    case "projects": {
      const item = await prisma.project.findUnique({
        where: { id },
        include: {
          workspace: true,
        },
      });
      if (!item) throw new Error("NOT_FOUND");
      return {
        id: item.id,
        name: item.name,
        description: item.description,
        workspaceId: item.workspaceId,
        workspaceName: item.workspace.name,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      };
    }
    case "files": {
      const item = await prisma.cVFile.findUnique({
        where: { id },
        include: {
          workspace: true,
          uploader: true,
        },
      });
      if (!item) throw new Error("NOT_FOUND");
      return {
        id: item.id,
        fileName: item.fileName,
        filePath: item.filePath,
        mimeType: item.mimeType,
        fileSize: item.fileSize,
        workspaceId: item.workspaceId,
        workspaceName: item.workspace.name,
        uploadedBy: item.uploadedBy,
        uploaderName: item.uploader.name,
        uploadedAt: item.uploadedAt,
      };
    }
  }
}

export async function createAdminResource(resource: string, body: unknown) {
  if (resource !== "users") {
    throw new Error("METHOD_NOT_ALLOWED");
  }

  const parsed = userCreateSchema.safeParse(body);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message || "INVALID");
  }

  const email = parsed.data.email.toLowerCase();
  const existingUser = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });

  if (existingUser) {
    throw new Error("EMAIL_EXISTS");
  }

  const hashedPassword = await bcrypt.hash(parsed.data.password, 10);

  const user = await prisma.user.create({
    data: {
      name: parsed.data.name,
      email,
      password: hashedPassword,
      role: parsed.data.role,
      emailVerifiedAt: new Date(),
      emailVerificationTokenHash: null,
      emailVerificationTokenExpiresAt: null,
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      createdAt: true,
      _count: {
        select: {
          workspaceMembers: true,
        },
      },
    },
  });

  return {
    ...user,
    workspaceCount: user._count.workspaceMembers,
  };
}

export async function updateAdminResource(
  resource: string,
  id: string,
  body: unknown,
  currentUserId: string,
) {
  if (!hasResourceName(resource)) {
    throw new Error("NOT_FOUND");
  }

  switch (resource) {
    case "users": {
      const parsed = userUpdateSchema.safeParse(body);
      if (!parsed.success) {
        throw new Error(parsed.error.issues[0]?.message || "INVALID");
      }

      const existingUser = await prisma.user.findUnique({
        where: { id },
        select: { id: true, role: true },
      });
      if (!existingUser) throw new Error("NOT_FOUND");

      if (existingUser.id === currentUserId && parsed.data.role && parsed.data.role !== "ADMIN") {
        throw new Error("CANNOT_DEMOTE_SELF");
      }

      if (
        existingUser.role === "ADMIN" &&
        parsed.data.role &&
        parsed.data.role !== "ADMIN" &&
        (await countAdmins()) <= 1
      ) {
        throw new Error("LAST_ADMIN");
      }

      const email = parsed.data.email?.toLowerCase();
      if (email) {
        const duplicateUser = await prisma.user.findUnique({
          where: { email },
          select: { id: true },
        });
        if (duplicateUser && duplicateUser.id !== id) {
          throw new Error("EMAIL_EXISTS");
        }
      }

      const user = await prisma.user.update({
        where: { id },
        data: {
          name: parsed.data.name,
          email,
          role: parsed.data.role,
          password: parsed.data.password ? await bcrypt.hash(parsed.data.password, 10) : undefined,
          emailVerifiedAt: email ? new Date() : undefined,
          emailVerificationTokenHash: email ? null : undefined,
          emailVerificationTokenExpiresAt: email ? null : undefined,
        },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          createdAt: true,
          _count: {
            select: {
              workspaceMembers: true,
            },
          },
        },
      });

      return {
        ...user,
        workspaceCount: user._count.workspaceMembers,
      };
    }
    case "workspaces": {
      const parsed = workspaceUpdateSchema.safeParse(body);
      if (!parsed.success) {
        throw new Error(parsed.error.issues[0]?.message || "INVALID");
      }

      const workspace = await prisma.workspace.update({
        where: { id },
        data: {
          name: parsed.data.name,
        },
        include: {
          owner: true,
          members: true,
          candidates: true,
          cvFiles: true,
        },
      });

      return {
        id: workspace.id,
        name: workspace.name,
        ownerId: workspace.ownerId,
        ownerName: workspace.owner.name,
        createdAt: workspace.createdAt,
        memberCount: workspace.members.length,
        candidateCount: workspace.candidates.length,
        fileCount: workspace.cvFiles.length,
      };
    }
    case "candidates": {
      const parsed = candidateUpdateSchema.safeParse(body);
      if (!parsed.success) {
        throw new Error(parsed.error.issues[0]?.message || "INVALID");
      }

      const existing = await prisma.candidate.findUnique({
        where: { id },
        select: {
          id: true,
          status: true,
        },
      });
      if (!existing) throw new Error("NOT_FOUND");

      const candidate = await prisma.candidate.update({
        where: { id },
        data: {
          fullName: asNullableString(parsed.data.fullName),
          email: asNullableString(parsed.data.email),
          phone: asNullableString(parsed.data.phone),
          position: asNullableString(parsed.data.position),
          source: asNullableString(parsed.data.source),
          offerSalary: asNullableString(parsed.data.offerSalary),
          notes: asNullableString(parsed.data.notes),
          status: parsed.data.status,
          managerDecision:
            parsed.data.managerDecision === undefined
              ? undefined
              : parsed.data.managerDecision === ""
                ? "PENDING"
                : parsed.data.managerDecision,
          managerOfferSalary: asNullableString(parsed.data.managerOfferSalary),
          managerReviewNote: asNullableString(parsed.data.managerReviewNote),
        },
        include: {
          workspace: true,
          hr: true,
          project: true,
        },
      });

      if (parsed.data.status && parsed.data.status !== existing.status) {
        await prisma.statusHistory.create({
          data: {
            candidateId: id,
            fromStatus: existing.status,
            toStatus: parsed.data.status,
            changedBy: currentUserId,
            note: "System admin update",
          },
        });
      }

      return {
        id: candidate.id,
        fullName: candidate.fullName,
        email: candidate.email,
        phone: candidate.phone,
        position: candidate.position,
        source: candidate.source,
        status: candidate.status,
        workspaceId: candidate.workspaceId,
        workspaceName: candidate.workspace.name,
        hrId: candidate.hrId,
        hrName: candidate.hr.name,
        projectId: candidate.projectId,
        projectName: candidate.project?.name ?? null,
        offerSalary: candidate.offerSalary,
        notes: candidate.notes,
        managerDecision: candidate.managerDecision,
        managerOfferSalary: candidate.managerOfferSalary,
        managerReviewNote: candidate.managerReviewNote,
        createdAt: candidate.createdAt,
        updatedAt: candidate.updatedAt,
      };
    }
    case "projects": {
      const parsed = projectUpdateSchema.safeParse(body);
      if (!parsed.success) {
        throw new Error(parsed.error.issues[0]?.message || "INVALID");
      }

      const project = await prisma.project.update({
        where: { id },
        data: {
          name: parsed.data.name,
          description: parsed.data.description ?? null,
        },
        include: {
          workspace: true,
        },
      });

      return {
        id: project.id,
        name: project.name,
        description: project.description,
        workspaceId: project.workspaceId,
        workspaceName: project.workspace.name,
        createdAt: project.createdAt,
        updatedAt: project.updatedAt,
      };
    }
    case "files": {
      throw new Error("METHOD_NOT_ALLOWED");
    }
    case "logs": {
      throw new Error("METHOD_NOT_ALLOWED");
    }
  }
}

export async function deleteAdminResource(resource: string, id: string, currentUserId: string) {
  if (!hasResourceName(resource)) {
    throw new Error("NOT_FOUND");
  }

  switch (resource) {
    case "users": {
      const existingUser = await prisma.user.findUnique({
        where: { id },
        select: {
          id: true,
          role: true,
        },
      });

      if (!existingUser) throw new Error("NOT_FOUND");
      if (existingUser.id === currentUserId) throw new Error("CANNOT_DELETE_SELF");
      if (existingUser.role === "ADMIN" && (await countAdmins()) <= 1) {
        throw new Error("LAST_ADMIN");
      }

      await prisma.user.delete({
        where: { id },
      });
      return { success: true };
    }
    case "workspaces": {
      await prisma.workspace.delete({
        where: { id },
      });
      return { success: true };
    }
    case "candidates": {
      await prisma.candidate.delete({
        where: { id },
      });
      return { success: true };
    }
    case "projects": {
      await prisma.project.delete({
        where: { id },
      });
      return { success: true };
    }
    case "files": {
      const file = await prisma.cVFile.findUnique({
        where: { id },
        select: {
          id: true,
          filePath: true,
        },
      });
      if (!file) throw new Error("NOT_FOUND");

      await prisma.cVFile.delete({
        where: { id },
      });
      await deleteUploadedFile(file.filePath);
      return { success: true };
    }
    case "logs": {
      return deleteLogFile(id);
    }
  }
}

type CpuSnapshot = {
  idle: number;
  total: number;
};

function getCpuSnapshot(): CpuSnapshot {
  return os.cpus().reduce(
    (snapshot, cpu) => {
      const total = Object.values(cpu.times).reduce((sum, value) => sum + value, 0);
      return {
        idle: snapshot.idle + cpu.times.idle,
        total: snapshot.total + total,
      };
    },
    { idle: 0, total: 0 },
  );
}

async function getCpuUsagePercent() {
  const start = getCpuSnapshot();
  await new Promise((resolve) => setTimeout(resolve, 120));
  const end = getCpuSnapshot();
  const idleDelta = end.idle - start.idle;
  const totalDelta = end.total - start.total;

  if (totalDelta <= 0) return 0;
  return Math.max(0, Math.min(100, (1 - idleDelta / totalDelta) * 100));
}

export async function getAdminMonitor() {
  await cleanupOldLogs();

  const uploadsRoot = path.join(process.cwd(), "public", "uploads");
  const sqlitePath = path.join(process.cwd(), "prisma", "dev.db");

  const [users, workspaces, candidates, projects, files, uploadsBytes, sqliteBytes, cpuUsagePercent] = await Promise.all([
    prisma.user.count(),
    prisma.workspace.count(),
    prisma.candidate.count(),
    prisma.project.count(),
    prisma.cVFile.findMany({
      include: {
        workspace: true,
      },
      orderBy: {
        uploadedAt: "desc",
      },
    }),
    getPathSize(uploadsRoot),
    getPathSize(sqlitePath),
    getCpuUsagePercent(),
  ]);

  const workspaceStorageMap = new Map<string, { workspaceId: string; workspaceName: string; bytes: number }>();
  for (const file of files) {
    const existing = workspaceStorageMap.get(file.workspaceId) ?? {
      workspaceId: file.workspaceId,
      workspaceName: file.workspace.name,
      bytes: 0,
    };
    existing.bytes += file.fileSize;
    workspaceStorageMap.set(file.workspaceId, existing);
  }

  const statusMap = new Map<string, number>();
  const candidateStatuses = await prisma.candidate.findMany({
    select: {
      status: true,
    },
  });
  for (const item of candidateStatuses) {
    statusMap.set(item.status, (statusMap.get(item.status) ?? 0) + 1);
  }

  let disk = {
    freeBytes: 0,
    totalBytes: 0,
  };
  try {
    const stats = await fs.statfs(process.cwd());
    disk = {
      freeBytes: stats.bsize * stats.bavail,
      totalBytes: stats.bsize * stats.blocks,
    };
  } catch {}

  const memoryTotalBytes = os.totalmem();
  const memoryFreeBytes = os.freemem();
  const memoryUsedBytes = Math.max(0, memoryTotalBytes - memoryFreeBytes);
  const cpus = os.cpus();
  const loadAverage = os.loadavg();
  const processMemory = process.memoryUsage();

  return {
    counts: {
      users,
      workspaces,
      candidates,
      projects,
      files: files.length,
    },
    storage: {
      uploadsBytes,
      sqliteBytes,
      freeBytes: disk.freeBytes,
      totalBytes: disk.totalBytes,
    },
    vps: {
      hostname: os.hostname(),
      platform: os.platform(),
      arch: os.arch(),
      uptimeSeconds: os.uptime(),
      processUptimeSeconds: process.uptime(),
      cpu: {
        usagePercent: cpuUsagePercent,
        coreCount: cpus.length,
        model: cpus[0]?.model ?? "Unknown CPU",
        loadAverage1m: loadAverage[0] ?? 0,
        loadAverage5m: loadAverage[1] ?? 0,
        loadAverage15m: loadAverage[2] ?? 0,
      },
      memory: {
        totalBytes: memoryTotalBytes,
        freeBytes: memoryFreeBytes,
        usedBytes: memoryUsedBytes,
        usagePercent: memoryTotalBytes > 0 ? (memoryUsedBytes / memoryTotalBytes) * 100 : 0,
      },
      process: {
        rssBytes: processMemory.rss,
        heapTotalBytes: processMemory.heapTotal,
        heapUsedBytes: processMemory.heapUsed,
        externalBytes: processMemory.external,
      },
    },
    topWorkspacesByStorage: Array.from(workspaceStorageMap.values())
      .sort((left, right) => right.bytes - left.bytes)
      .slice(0, 8),
    statusDistribution: Array.from(statusMap.entries()).map(([status, count]) => ({
      status,
      count,
    })),
    recentUploads: files.slice(0, 8).map((file) => ({
      id: file.id,
      fileName: file.fileName,
      fileSize: file.fileSize,
      uploadedAt: file.uploadedAt,
      workspaceName: file.workspace.name,
    })),
  };
}
