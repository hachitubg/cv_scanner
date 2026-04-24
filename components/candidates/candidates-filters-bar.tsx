"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Copy, Filter, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { candidateStatusMeta, cn } from "@/lib/utils";
import type { ProjectOption, WorkspaceMemberOption } from "@/types";

type FilterValues = {
  search?: string;
  status?: string;
  hrId?: string;
  position?: string;
  projectId?: string;
};

export function CandidatesFiltersBar({
  members,
  projects,
  initialFilters,
}: {
  members: WorkspaceMemberOption[];
  projects: ProjectOption[];
  initialFilters: FilterValues;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [filters, setFilters] = useState({
    search: initialFilters.search ?? "",
    status: initialFilters.status ?? "",
    hrId: initialFilters.hrId ?? "",
    position: initialFilters.position ?? "",
    projectId: initialFilters.projectId ?? "",
  });
  const [copyMessage, setCopyMessage] = useState<string | null>(null);

  function updateField(name: keyof typeof filters, value: string) {
    setFilters((current) => ({
      ...current,
      [name]: value,
    }));
  }

  function applyFilters() {
    const params = new URLSearchParams();

    Object.entries(filters).forEach(([key, value]) => {
      if (value.trim()) {
        params.set(key, value.trim());
      }
    });

    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  }

  async function copyCurrentLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopyMessage("Đã copy đường dẫn bộ lọc hiện tại.");
      window.setTimeout(() => setCopyMessage(null), 2200);
    } catch {
      setCopyMessage("Không thể copy đường dẫn trên trình duyệt này.");
      window.setTimeout(() => setCopyMessage(null), 2200);
    }
  }

  function resetFilters() {
    setFilters({
      search: "",
      status: "",
      hrId: "",
      position: "",
      projectId: "",
    });
    router.push(pathname);
  }

  return (
    <div className="relative mt-6 rounded-[1.8rem] bg-[rgba(248,243,245,0.84)] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.85)]">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[1.35fr_1fr_1fr_1fr_1fr_auto]">
        <input
          value={filters.search}
          onChange={(event) => updateField("search", event.target.value)}
          placeholder="Tìm theo tên, vị trí, email..."
          className="h-12 rounded-[1.1rem] border border-primary/10 bg-white px-4 text-sm font-medium text-on-surface outline-none transition focus:border-primary/20 focus:ring-4 focus:ring-primary/10"
        />

        <select
          value={filters.status}
          onChange={(event) => updateField("status", event.target.value)}
          className="h-12 rounded-[1.1rem] border border-primary/10 bg-white px-4 text-sm font-medium text-on-surface outline-none transition focus:border-primary/20 focus:ring-4 focus:ring-primary/10"
        >
          <option value="">Tất cả trạng thái</option>
          {Object.entries(candidateStatusMeta).map(([value, meta]) => (
            <option key={value} value={value}>
              {meta.label}
            </option>
          ))}
        </select>

        <select
          value={filters.hrId}
          onChange={(event) => updateField("hrId", event.target.value)}
          className="h-12 rounded-[1.1rem] border border-primary/10 bg-white px-4 text-sm font-medium text-on-surface outline-none transition focus:border-primary/20 focus:ring-4 focus:ring-primary/10"
        >
          <option value="">Tất cả HR</option>
          {members.map((member) => (
            <option key={member.id} value={member.id}>
              {member.name}
            </option>
          ))}
        </select>

        <select
          value={filters.projectId}
          onChange={(event) => updateField("projectId", event.target.value)}
          className="h-12 rounded-[1.1rem] border border-primary/10 bg-white px-4 text-sm font-medium text-on-surface outline-none transition focus:border-primary/20 focus:ring-4 focus:ring-primary/10"
        >
          <option value="">Tất cả dự án</option>
          {projects.map((project) => (
            <option key={project.id} value={project.id}>
              {project.name}
            </option>
          ))}
        </select>

        <input
          value={filters.position}
          onChange={(event) => updateField("position", event.target.value)}
          placeholder="Vị trí"
          className="h-12 rounded-[1.1rem] border border-primary/10 bg-white px-4 text-sm font-medium text-on-surface outline-none transition focus:border-primary/20 focus:ring-4 focus:ring-primary/10"
        />

        <Button className="h-12 gap-2 px-5" onClick={applyFilters}>
          <Filter className="size-4" />
          Lọc
        </Button>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button variant="ghost" className="h-11 gap-2 bg-white" onClick={copyCurrentLink}>
          <Copy className="size-4" />
          Copy link bộ lọc
        </Button>
        <Button variant="ghost" className="h-11 gap-2 bg-white" onClick={resetFilters}>
          <RotateCcw className="size-4" />
          Xóa lọc
        </Button>
        {copyMessage ? (
          <p className={cn("text-sm font-semibold", copyMessage.startsWith("Đã") ? "text-emerald-600" : "text-rose-600")}>
            {copyMessage}
          </p>
        ) : null}
      </div>
    </div>
  );
}
