"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PencilLine, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type ProjectItem = {
  id: string;
  name: string;
  description: string | null;
  createdAt: Date | string;
};

export function ProjectsManager({
  workspaceId,
  projects,
}: {
  workspaceId: string;
  projects: ProjectItem[];
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [editingDescription, setEditingDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function createProject() {
    setError(null);

    startTransition(async () => {
      const response = await fetch(`/api/workspaces/${workspaceId}/projects`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description,
        }),
      });

      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(data.error || "Không thể tạo dự án.");
        return;
      }

      setName("");
      setDescription("");
      router.refresh();
    });
  }

  function startEdit(project: ProjectItem) {
    setEditingId(project.id);
    setEditingName(project.name);
    setEditingDescription(project.description ?? "");
    setError(null);
  }

  function saveEdit(projectId: string) {
    setError(null);

    startTransition(async () => {
      const response = await fetch(`/api/workspaces/${workspaceId}/projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editingName,
          description: editingDescription,
        }),
      });

      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(data.error || "Không thể cập nhật dự án.");
        return;
      }

      setEditingId(null);
      router.refresh();
    });
  }

  function removeProject(projectId: string) {
    if (!window.confirm("Xóa dự án này? Ứng viên đang gắn dự án sẽ được bỏ liên kết.")) return;

    setError(null);
    startTransition(async () => {
      const response = await fetch(`/api/workspaces/${workspaceId}/projects/${projectId}`, {
        method: "DELETE",
      });

      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(data.error || "Không thể xóa dự án.");
        return;
      }

      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <div className="bubbly-card p-6">
        <div className="flex items-center gap-3">
          <div className="rounded-[1.2rem] bg-primary/10 p-3 text-primary">
            <Plus className="size-5" />
          </div>
          <div>
            <p className="text-sm font-black uppercase tracking-[0.18em] text-primary">Dự án tuyển dụng</p>
            <h2 className="mt-2 text-2xl font-black text-on-surface">Thêm dự án mới</h2>
          </div>
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-[1.2fr_1.2fr_auto]">
          <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Ví dụ: ABC, Internal ERP" />
          <Textarea
            rows={2}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Mô tả ngắn để HR dễ chọn đúng dự án"
          />
          <Button className="self-start" onClick={createProject} disabled={isPending || !name.trim()}>
            {isPending ? "Đang lưu..." : "Tạo dự án"}
          </Button>
        </div>

        {error ? <p className="mt-4 text-sm font-semibold text-rose-600">{error}</p> : null}
      </div>

      <div className="space-y-4">
        {projects.map((project) => {
          const isEditing = editingId === project.id;

          return (
            <article key={project.id} className="bubbly-card p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="space-y-2">
                  {isEditing ? (
                    <>
                      <Input value={editingName} onChange={(event) => setEditingName(event.target.value)} />
                      <Textarea
                        rows={3}
                        value={editingDescription}
                        onChange={(event) => setEditingDescription(event.target.value)}
                        placeholder="Mô tả dự án"
                      />
                    </>
                  ) : (
                    <>
                      <h3 className="text-xl font-black text-on-surface">{project.name}</h3>
                      <p className="text-sm font-medium leading-7 text-on-surface-variant">
                        {project.description || "Chưa có mô tả dự án."}
                      </p>
                    </>
                  )}
                </div>

                <div className="flex flex-wrap gap-3">
                  {isEditing ? (
                    <>
                      <Button onClick={() => saveEdit(project.id)} disabled={isPending || !editingName.trim()}>
                        Lưu
                      </Button>
                      <Button variant="ghost" onClick={() => setEditingId(null)} disabled={isPending}>
                        Hủy
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button variant="ghost" className="gap-2 bg-white" onClick={() => startEdit(project)}>
                        <PencilLine className="size-4" />
                        Sửa
                      </Button>
                      <Button variant="danger" className="gap-2" onClick={() => removeProject(project.id)}>
                        <Trash2 className="size-4" />
                        Xóa
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </article>
          );
        })}

        {!projects.length ? (
          <div className="bubbly-card p-8 text-center">
            <p className="text-sm font-black uppercase tracking-[0.18em] text-primary">Chưa có dự án</p>
            <p className="mt-3 text-sm font-medium leading-7 text-on-surface-variant">
              Tạo trước các dự án đang tuyển để HR gắn đúng ứng viên ngay từ lúc upload CV.
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
