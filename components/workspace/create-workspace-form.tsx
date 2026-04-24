"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function CreateWorkspaceForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function onSubmit() {
    setError(null);

    startTransition(async () => {
      const response = await fetch("/api/workspaces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });

      const data = (await response.json()) as { id?: string; error?: string };

      if (!response.ok || !data.id) {
        setError(data.error || "Không thể tạo workspace.");
        return;
      }

      setName("");
      router.push(`/workspace/${data.id}/dashboard`);
      router.refresh();
    });
  }

  return (
    <div className="soft-panel">
      <h3 className="text-xl font-black text-on-surface">Tạo workspace mới</h3>
      <p className="mt-2 text-sm font-medium text-on-surface-variant">
        Mỗi workspace là một không gian làm việc riêng cho team HR.
      </p>

      <div className="mt-5 flex flex-col gap-3 sm:flex-row">
        <Input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Ví dụ: Talent Ops Vietnam"
        />
        <Button onClick={onSubmit} disabled={isPending || !name.trim()}>
          {isPending ? "Đang tạo..." : "Tạo mới"}
        </Button>
      </div>

      {error ? <p className="mt-3 text-sm font-semibold text-rose-600">{error}</p> : null}
    </div>
  );
}
