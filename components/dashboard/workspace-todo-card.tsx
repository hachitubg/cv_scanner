"use client";

import { useMemo, useState, type FormEvent } from "react";
import {
  CheckCircle2,
  Circle,
  ClipboardList,
  Plus,
  Trash2,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { WorkspaceTodo } from "@/types";

type WorkspaceTodoCardProps = {
  workspaceId: string;
  initialTodos: WorkspaceTodo[];
  canManage: boolean;
};

export function WorkspaceTodoCard({
  workspaceId,
  initialTodos,
  canManage,
}: WorkspaceTodoCardProps) {
  const [todos, setTodos] = useState(initialTodos);
  const [isOpen, setIsOpen] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const pendingTodos = useMemo(() => todos.filter((todo) => !todo.done), [todos]);
  const completedTodos = todos.length - pendingTodos.length;
  const completionPercent = todos.length
    ? Math.round((completedTodos / todos.length) * 100)
    : 0;

  const openCreateDialog = () => {
    if (!canManage) return;
    setError("");
    setIsOpen(true);
    setIsCreateOpen(true);
  };

  const closeCreateDialog = () => {
    setIsCreateOpen(false);
    setTitle("");
    setDescription("");
    setError("");
  };

  const handleCreateTodo = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canManage || !title.trim()) return;

    setBusyId("create");
    setError("");

    try {
      const response = await fetch(`/api/workspaces/${workspaceId}/todos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description,
        }),
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || "Không thể thêm báo cáo công việc.");
      }

      setTodos((current) => [payload, ...current]);
      closeCreateDialog();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể thêm báo cáo công việc.");
    } finally {
      setBusyId(null);
    }
  };

  const handleToggleTodo = async (todo: WorkspaceTodo) => {
    if (!canManage) return;

    const nextDone = !todo.done;
    const previousTodos = todos;
    setTodos((current) =>
      current.map((item) =>
        item.id === todo.id ? { ...item, done: nextDone } : item,
      ),
    );
    setBusyId(todo.id);
    setError("");

    try {
      const response = await fetch(
        `/api/workspaces/${workspaceId}/todos/${todo.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ done: nextDone }),
        },
      );
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || "Không thể cập nhật trạng thái.");
      }

      setTodos((current) =>
        current.map((item) => (item.id === todo.id ? payload : item)),
      );
    } catch (err) {
      setTodos(previousTodos);
      setError(err instanceof Error ? err.message : "Không thể cập nhật trạng thái.");
    } finally {
      setBusyId(null);
    }
  };

  const handleDeleteTodo = async (todoId: string) => {
    if (!canManage) return;

    const previousTodos = todos;
    setTodos((current) => current.filter((todo) => todo.id !== todoId));
    setBusyId(todoId);
    setError("");

    try {
      const response = await fetch(
        `/api/workspaces/${workspaceId}/todos/${todoId}`,
        { method: "DELETE" },
      );
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || "Không thể xóa báo cáo công việc.");
      }
    } catch (err) {
      setTodos(previousTodos);
      setError(err instanceof Error ? err.message : "Không thể xóa báo cáo công việc.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <>
      <article className="group rounded-[1.8rem] border border-primary/15 bg-[linear-gradient(145deg,rgba(255,246,249,0.98),rgba(255,255,255,0.96))] p-5 shadow-[0_18px_45px_rgba(160,57,100,0.08)] transition hover:-translate-y-0.5 hover:border-primary/25 hover:shadow-[0_24px_55px_rgba(160,57,100,0.14)]">
        <div className="flex items-start justify-between gap-4">
          <button
            type="button"
            onClick={() => setIsOpen(true)}
            className="min-w-0 flex-1 text-left"
          >
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-primary">
              Báo cáo công việc
            </p>
            <p className="mt-3 text-3xl font-black tracking-tight text-primary sm:text-[2.15rem]">
              {pendingTodos.length}
            </p>
          </button>

          {canManage ? (
            <button
              type="button"
              onClick={openCreateDialog}
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[1.1rem] bg-primary/12 text-primary transition hover:bg-primary hover:text-white"
              aria-label="Thêm báo cáo công việc"
            >
              <Plus className="h-5 w-5" />
            </button>
          ) : (
            <div className="rounded-[1.1rem] bg-primary/12 p-2.5 text-primary">
              <ClipboardList className="size-[18px]" />
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="mt-4 w-full text-left"
        >
          <p className="text-sm font-semibold leading-6 text-on-surface-variant">
            {todos.length
              ? `${completedTodos}/${todos.length} mục đã xong`
              : "Thêm báo cáo để theo dõi công việc hằng ngày"}
          </p>
          <div className="mt-4 h-2 rounded-full bg-primary/10">
            <div
              className="h-full rounded-full bg-cta-gradient transition-all"
              style={{ width: `${completionPercent}%` }}
            />
          </div>
        </button>
      </article>

      {isOpen ? (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-on-surface/35 px-4 py-6 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setIsOpen(false);
          }}
        >
          <div className="max-h-[88vh] w-full max-w-2xl overflow-hidden rounded-[2rem] border border-white/70 bg-white shadow-[0_34px_90px_rgba(70,20,45,0.24)]">
            <div className="flex items-start justify-between gap-4 border-b border-primary/10 bg-[linear-gradient(145deg,rgba(255,239,245,0.95),rgba(255,255,255,0.98))] px-5 py-5 sm:px-6">
              <div className="min-w-0">
                <p className="text-xs font-black uppercase tracking-[0.2em] text-primary">
                  Workspace report
                </p>
                <h2 className="mt-2 text-2xl font-black tracking-tight text-on-surface">
                  Báo cáo công việc
                </h2>
                <p className="mt-2 text-sm font-medium text-on-surface-variant">
                  Theo dõi các đầu việc cần xử lý và đánh dấu khi đã hoàn tất.
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {canManage ? (
                  <button
                    type="button"
                    onClick={openCreateDialog}
                    className="inline-flex h-10 items-center gap-2 rounded-full bg-primary px-4 text-sm font-black text-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-ambient"
                  >
                    <Plus className="h-4 w-4" />
                    Thêm việc
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white text-on-surface shadow-sm transition hover:bg-primary hover:text-white"
                  aria-label="Đóng popup"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div className="max-h-[calc(88vh-132px)] overflow-y-auto p-5 sm:p-6">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-[1.4rem] bg-surface-container-low px-4 py-3">
                <p className="text-sm font-black text-on-surface">
                  {pendingTodos.length} mục chưa xong
                </p>
                <span className="rounded-full bg-primary-fixed px-3 py-1 text-xs font-black text-on-primary-container">
                  {completionPercent}% done
                </span>
              </div>

              {error ? (
                <p className="mb-4 rounded-2xl bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-600">
                  {error}
                </p>
              ) : null}

              <div className="space-y-3">
                {todos.length ? (
                  todos.map((todo) => (
                    <div
                      key={todo.id}
                      className={`rounded-[1.4rem] border px-4 py-3 transition ${
                        todo.done
                          ? "border-tertiary/15 bg-tertiary/5"
                          : "border-primary/10 bg-white"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <button
                          type="button"
                          onClick={() => handleToggleTodo(todo)}
                          disabled={!canManage || busyId === todo.id}
                          className={`mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition ${
                            todo.done
                              ? "bg-tertiary/12 text-tertiary"
                              : "bg-primary/10 text-primary hover:bg-primary hover:text-white"
                          } disabled:opacity-60`}
                          aria-label={todo.done ? "Bỏ hoàn thành" : "Đánh dấu hoàn thành"}
                        >
                          {todo.done ? (
                            <CheckCircle2 className="h-5 w-5" />
                          ) : (
                            <Circle className="h-5 w-5" />
                          )}
                        </button>
                        <div className="min-w-0 flex-1">
                          <p
                            className={`text-sm font-black leading-6 ${
                              todo.done
                                ? "text-on-surface-variant line-through"
                                : "text-on-surface"
                            }`}
                          >
                            {todo.title}
                          </p>
                          {todo.description ? (
                            <p className="mt-1 text-sm font-medium leading-6 text-on-surface-variant">
                              {todo.description}
                            </p>
                          ) : null}
                        </div>
                        {canManage ? (
                          <button
                            type="button"
                            onClick={() => handleDeleteTodo(todo.id)}
                            disabled={busyId === todo.id}
                            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-outline transition hover:bg-rose-50 hover:text-rose-600 disabled:opacity-60"
                            aria-label="Xóa việc"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        ) : null}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-[1.5rem] border border-dashed border-primary/20 bg-white px-5 py-8 text-center">
                    <ClipboardList className="mx-auto h-8 w-8 text-primary" />
                    <p className="mt-3 text-sm font-bold text-on-surface">
                      Chưa có báo cáo công việc nào.
                    </p>
                    {canManage ? (
                      <Button
                        type="button"
                        onClick={openCreateDialog}
                        className="mt-4 gap-2"
                      >
                        <Plus className="h-4 w-4" />
                        Thêm việc
                      </Button>
                    ) : null}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {isCreateOpen ? (
        <div
          className="fixed inset-0 z-[90] flex items-center justify-center bg-on-surface/45 px-4 py-6 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeCreateDialog();
          }}
        >
          <form
            onSubmit={handleCreateTodo}
            className="w-full max-w-md rounded-[1.7rem] border border-white/70 bg-white p-5 shadow-[0_30px_75px_rgba(70,20,45,0.24)] sm:p-6"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-primary">
                  Thêm mới
                </p>
                <h3 className="mt-2 text-xl font-black text-on-surface">
                  Thêm báo cáo công việc
                </h3>
              </div>
              <button
                type="button"
                onClick={closeCreateDialog}
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-container-low text-on-surface transition hover:bg-primary hover:text-white"
                aria-label="Đóng popup thêm mới"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-5 space-y-3">
              <Input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="VD: Follow JD Backend, gửi báo cáo tuyển dụng..."
                disabled={!canManage || busyId === "create"}
                autoFocus
              />
              <Textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Ghi chú thêm nếu cần..."
                disabled={!canManage || busyId === "create"}
                className="min-h-24"
              />
            </div>

            {error ? (
              <p className="mt-3 rounded-2xl bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-600">
                {error}
              </p>
            ) : null}

            <div className="mt-5 flex justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={closeCreateDialog}
                disabled={busyId === "create"}
              >
                Hủy
              </Button>
              <Button
                type="submit"
                className="gap-2"
                disabled={!canManage || !title.trim() || busyId === "create"}
              >
                <Plus className="h-4 w-4" />
                Thêm việc
              </Button>
            </div>
          </form>
        </div>
      ) : null}
    </>
  );
}
