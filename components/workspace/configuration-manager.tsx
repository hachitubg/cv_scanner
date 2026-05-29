"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  BriefcaseBusiness,
  ListChecks,
  PencilLine,
  Plus,
  Settings2,
  Trash2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type {
  ProjectOption,
  WorkspaceDropdownOption,
  WorkspaceDropdownType,
} from "@/types";

type ConfigGroupId = "projects" | "positions" | "noHireReasons";

type ConfigItem = {
  id: string;
  name: string;
  description: string | null;
};

type ConfigGroup = {
  id: ConfigGroupId;
  title: string;
  eyebrow: string;
  description: string;
  emptyTitle: string;
  emptyDescription: string;
  createLabel: string;
  placeholder: string;
  descriptionPlaceholder: string;
  icon: typeof BriefcaseBusiness;
  items: ConfigItem[];
  createRequest: (value: { name: string; description: string }) => {
    url: string;
    body: Record<string, string>;
  };
  updateRequest: (
    itemId: string,
    value: { name: string; description: string },
  ) => {
    url: string;
    body: Record<string, string>;
  };
  deleteUrl: (itemId: string) => string;
  deleteConfirm: string;
};

export function ConfigurationManager({
  workspaceId,
  projects,
  positionOptions,
  noHireReasonOptions,
}: {
  workspaceId: string;
  projects: ProjectOption[];
  positionOptions: WorkspaceDropdownOption[];
  noHireReasonOptions: WorkspaceDropdownOption[];
}) {
  const groups = useMemo<ConfigGroup[]>(
    () => [
      {
        id: "projects",
        title: "Dự án tuyển dụng",
        eyebrow: "Dropdown dự án",
        description:
          "Các dự án được tạo ở đây sẽ xuất hiện trong dropdown Dự án khi upload hoặc chỉnh sửa CV.",
        emptyTitle: "Chưa có dự án",
        emptyDescription:
          "Tạo trước các dự án đang tuyển để HR gắn đúng ứng viên ngay từ lúc upload CV.",
        createLabel: "Tạo dự án",
        placeholder: "Ví dụ: Data Foundation, Mobile Commerce",
        descriptionPlaceholder: "Mô tả ngắn để HR chọn đúng dự án",
        icon: BriefcaseBusiness,
        items: projects.map((project) => ({
          id: project.id,
          name: project.name,
          description: project.description ?? null,
        })),
        createRequest: ({ name, description }) => ({
          url: `/api/workspaces/${workspaceId}/projects`,
          body: { name, description },
        }),
        updateRequest: (itemId, { name, description }) => ({
          url: `/api/workspaces/${workspaceId}/projects/${itemId}`,
          body: { name, description },
        }),
        deleteUrl: (itemId) =>
          `/api/workspaces/${workspaceId}/projects/${itemId}`,
        deleteConfirm:
          "Xóa dự án này? Ứng viên đang gắn dự án sẽ được bỏ liên kết.",
      },
      {
        id: "positions",
        title: "Vị trí ứng tuyển",
        eyebrow: "Dropdown vị trí",
        description:
          "Các vị trí được tạo ở đây sẽ xuất hiện trong dropdown Vị trí ứng tuyển khi upload hoặc chỉnh sửa CV.",
        emptyTitle: "Chưa có vị trí ứng tuyển",
        emptyDescription:
          "Tạo danh sách vị trí chuẩn để dữ liệu CV đồng nhất hơn và lọc bảng Excel dễ hơn.",
        createLabel: "Tạo vị trí",
        placeholder: "Ví dụ: Frontend Developer, Data Analyst",
        descriptionPlaceholder: "Ghi chú ngắn về vị trí nếu cần",
        icon: ListChecks,
        items: positionOptions.map((option) => ({
          id: option.id,
          name: option.name,
          description: option.description ?? null,
        })),
        createRequest: ({ name, description }) => ({
          url: `/api/workspaces/${workspaceId}/dropdown-options`,
          body: {
            type: "POSITION" satisfies WorkspaceDropdownType,
            name,
            description,
          },
        }),
        updateRequest: (itemId, { name, description }) => ({
          url: `/api/workspaces/${workspaceId}/dropdown-options/${itemId}`,
          body: {
            type: "POSITION" satisfies WorkspaceDropdownType,
            name,
            description,
          },
        }),
        deleteUrl: (itemId) =>
          `/api/workspaces/${workspaceId}/dropdown-options/${itemId}`,
        deleteConfirm: "Xóa vị trí ứng tuyển này?",
      },
      {
        id: "noHireReasons",
        title: "Lý do không tuyển",
        eyebrow: "Dropdown lý do",
        description:
          "Các lý do này bắt buộc phải chọn khi chuyển ứng viên sang trạng thái Không tuyển.",
        emptyTitle: "Chưa có lý do không tuyển",
        emptyDescription:
          "Hệ thống mặc định có các lý do chuẩn: Không đạt CV, Không đạt phỏng vấn, Từ chối Offer và Không qua thử việc.",
        createLabel: "Tạo lý do",
        placeholder: "Ví dụ: Không phù hợp ngân sách",
        descriptionPlaceholder: "Ghi chú nội bộ nếu cần",
        icon: ListChecks,
        items: noHireReasonOptions.map((option) => ({
          id: option.id,
          name: option.name,
          description: option.description ?? null,
        })),
        createRequest: ({ name, description }) => ({
          url: `/api/workspaces/${workspaceId}/dropdown-options`,
          body: {
            type: "NO_HIRE_REASON" satisfies WorkspaceDropdownType,
            name,
            description,
          },
        }),
        updateRequest: (itemId, { name, description }) => ({
          url: `/api/workspaces/${workspaceId}/dropdown-options/${itemId}`,
          body: {
            type: "NO_HIRE_REASON" satisfies WorkspaceDropdownType,
            name,
            description,
          },
        }),
        deleteUrl: (itemId) =>
          `/api/workspaces/${workspaceId}/dropdown-options/${itemId}`,
        deleteConfirm: "Xóa lý do không tuyển này?",
      },
    ],
    [noHireReasonOptions, positionOptions, projects, workspaceId],
  );

  const [activeGroupId, setActiveGroupId] =
    useState<ConfigGroupId>("projects");
  const activeGroup =
    groups.find((group) => group.id === activeGroupId) ?? groups[0];

  return (
    <div className="grid gap-6 xl:grid-cols-[300px_minmax(0,1fr)]">
      <aside className="bubbly-card h-fit p-3">
        <div className="px-3 py-3">
          <div className="inline-flex rounded-[1rem] bg-primary/10 p-3 text-primary">
            <Settings2 className="size-5" />
          </div>
          <p className="mt-3 text-sm font-black text-on-surface">
            Nhóm cấu hình
          </p>
          <p className="mt-1 text-sm font-medium leading-6 text-on-surface-variant">
            Chọn nhóm dữ liệu dropdown cần quản lý.
          </p>
        </div>

        <div className="mt-2 space-y-2">
          {groups.map((group) => {
            const Icon = group.icon;
            const active = group.id === activeGroup.id;

            return (
              <button
                key={group.id}
                type="button"
                onClick={() => setActiveGroupId(group.id)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-[1.1rem] px-3 py-3 text-left transition",
                  active
                    ? "bg-primary text-white shadow-[0_16px_36px_rgba(160,57,100,0.18)]"
                    : "bg-white/70 text-on-surface hover:bg-white",
                )}
              >
                <Icon className="size-4 shrink-0" />
                <span className="min-w-0">
                  <span className="block text-sm font-black">
                    {group.title}
                  </span>
                  <span
                    className={cn(
                      "block text-xs font-semibold",
                      active ? "text-white/82" : "text-on-surface-variant",
                    )}
                  >
                    {group.items.length} mục
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </aside>

      <ConfigGroupPanel group={activeGroup} />
    </div>
  );
}

function ConfigGroupPanel({ group }: { group: ConfigGroup }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [editingDescription, setEditingDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const Icon = group.icon;

  function createItem() {
    setError(null);

    startTransition(async () => {
      const request = group.createRequest({ name, description });
      const response = await fetch(request.url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request.body),
      });

      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(data.error || "Không thể tạo cấu hình.");
        return;
      }

      setName("");
      setDescription("");
      router.refresh();
    });
  }

  function startEdit(item: ConfigItem) {
    setEditingId(item.id);
    setEditingName(item.name);
    setEditingDescription(item.description ?? "");
    setError(null);
  }

  function saveEdit(itemId: string) {
    setError(null);

    startTransition(async () => {
      const request = group.updateRequest(itemId, {
        name: editingName,
        description: editingDescription,
      });
      const response = await fetch(request.url, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request.body),
      });

      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(data.error || "Không thể cập nhật cấu hình.");
        return;
      }

      setEditingId(null);
      router.refresh();
    });
  }

  function removeItem(itemId: string) {
    if (!window.confirm(group.deleteConfirm)) return;

    setError(null);
    startTransition(async () => {
      const response = await fetch(group.deleteUrl(itemId), {
        method: "DELETE",
      });

      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(data.error || "Không thể xóa cấu hình.");
        return;
      }

      router.refresh();
    });
  }

  return (
    <div className="space-y-5">
      <section className="bubbly-card p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-start gap-3">
            <div className="rounded-[1.2rem] bg-primary/10 p-3 text-primary">
              <Icon className="size-5" />
            </div>
            <div>
              <p className="text-sm font-black uppercase tracking-[0.18em] text-primary">
                {group.eyebrow}
              </p>
              <h2 className="mt-2 text-2xl font-black text-on-surface">
                {group.title}
              </h2>
              <p className="mt-2 max-w-3xl text-sm font-medium leading-7 text-on-surface-variant">
                {group.description}
              </p>
            </div>
          </div>
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-[1.2fr_1.2fr_auto]">
          <Input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder={group.placeholder}
          />
          <Textarea
            rows={2}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder={group.descriptionPlaceholder}
          />
          <Button
            className="self-start gap-2"
            onClick={createItem}
            disabled={isPending || !name.trim()}
          >
            <Plus className="size-4" />
            {isPending ? "Đang lưu..." : group.createLabel}
          </Button>
        </div>

        {error ? (
          <p className="mt-4 text-sm font-semibold text-rose-600">{error}</p>
        ) : null}
      </section>

      <section className="grid gap-4">
        {group.items.map((item) => {
          const isEditing = editingId === item.id;

          return (
            <article key={item.id} className="bubbly-card p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0 flex-1 space-y-2">
                  {isEditing ? (
                    <>
                      <Input
                        value={editingName}
                        onChange={(event) => setEditingName(event.target.value)}
                      />
                      <Textarea
                        rows={3}
                        value={editingDescription}
                        onChange={(event) =>
                          setEditingDescription(event.target.value)
                        }
                        placeholder="Mô tả"
                      />
                    </>
                  ) : (
                    <>
                      <h3 className="text-xl font-black text-on-surface">
                        {item.name}
                      </h3>
                      <p className="text-sm font-medium leading-7 text-on-surface-variant">
                        {item.description || "Chưa có mô tả."}
                      </p>
                    </>
                  )}
                </div>

                <div className="flex flex-wrap gap-3">
                  {isEditing ? (
                    <>
                      <Button
                        onClick={() => saveEdit(item.id)}
                        disabled={isPending || !editingName.trim()}
                      >
                        Lưu
                      </Button>
                      <Button
                        variant="ghost"
                        onClick={() => setEditingId(null)}
                        disabled={isPending}
                      >
                        Hủy
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button
                        variant="ghost"
                        className="gap-2 bg-white"
                        onClick={() => startEdit(item)}
                      >
                        <PencilLine className="size-4" />
                        Sửa
                      </Button>
                      <Button
                        variant="danger"
                        className="gap-2"
                        onClick={() => removeItem(item.id)}
                      >
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

        {!group.items.length ? (
          <div className="bubbly-card p-8 text-center">
            <p className="text-sm font-black uppercase tracking-[0.18em] text-primary">
              {group.emptyTitle}
            </p>
            <p className="mt-3 text-sm font-medium leading-7 text-on-surface-variant">
              {group.emptyDescription}
            </p>
          </div>
        ) : null}
      </section>
    </div>
  );
}
