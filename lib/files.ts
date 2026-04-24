import fs from "node:fs/promises";
import path from "node:path";

function slugifyFileName(fileName: string) {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, "-").replace(/-+/g, "-").toLowerCase();
}

export async function saveUploadedFile(workspaceId: string, fileName: string, buffer: Buffer) {
  const safeFileName = slugifyFileName(fileName);
  const timestamp = Date.now();
  const directory = path.join(process.cwd(), "public", "uploads", workspaceId);
  const absolutePath = path.join(directory, `${timestamp}-${safeFileName}`);

  await fs.mkdir(directory, { recursive: true });
  await fs.writeFile(absolutePath, buffer);

  return `/uploads/${workspaceId}/${timestamp}-${safeFileName}`;
}

export async function deleteUploadedFile(filePath?: string | null) {
  if (!filePath) return;

  const normalized = filePath.replace(/^\/+/, "");
  const absolutePath = path.join(process.cwd(), "public", normalized.replace(/^uploads[\\/]/, "uploads/"));

  try {
    await fs.unlink(absolutePath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }
  }
}

export async function getPathSize(targetPath: string): Promise<number> {
  try {
    const stats = await fs.stat(targetPath);
    if (stats.isFile()) return stats.size;

    if (!stats.isDirectory()) return 0;

    const entries = await fs.readdir(targetPath, { withFileTypes: true });
    const sizes = await Promise.all(
      entries.map((entry) => getPathSize(path.join(targetPath, entry.name))),
    );
    return sizes.reduce((sum, size) => sum + size, 0);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return 0;
    }
    throw error;
  }
}
