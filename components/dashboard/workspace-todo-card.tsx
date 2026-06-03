"use client";

import { useMemo, useState, type FormEvent } from "react";
import {
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Circle,
  ClipboardList,
  EyeOff,
  Pencil,
  Plus,
  Save,
  Trash2,
  Undo2,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { WorkspaceTodo } from "@/types";

type HrMemberOption = {
  id: string;
  name: string;
};

type WorkspaceTodoCardProps = {
  workspaceId: string;
  initialTodos: WorkspaceTodo[];
  hrMembers: HrMemberOption[];
  canManage: boolean;
};

const weekOptions = [1, 2, 3, 4, 5, 6];

function getMonthInputValue(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

function getWeekInMonth(date = new Date()) {
  return Math.max(1, Math.min(6, Math.ceil(date.getDate() / 7)));
}

function getFallbackDate(todo: WorkspaceTodo) {
  if (todo.workDate) return todo.workDate;
  const date = new Date(todo.createdAt);
  if (Number.isNaN(date.getTime())) return `${getMonthInputValue()}-01`;
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getTodoMonth(todo: WorkspaceTodo) {
  return todo.workMonth || getFallbackDate(todo).slice(0, 7);
}

function getTodoWeek(todo: WorkspaceTodo) {
  if (todo.workWeek) return todo.workWeek;
  const day = Number(getFallbackDate(todo).slice(8, 10));
  if (!Number.isFinite(day)) return 1;
  return Math.max(1, Math.min(6, Math.ceil(day / 7)));
}

function getTimestamp(value: Date | string) {
  return new Date(value).getTime() || 0;
}

function sortTodos(todos: WorkspaceTodo[]) {
  return [...todos].sort((left, right) => {
    const monthDiff = getTodoMonth(right).localeCompare(getTodoMonth(left));
    if (monthDiff !== 0) return monthDiff;

    const weekDiff = getTodoWeek(left) - getTodoWeek(right);
    if (weekDiff !== 0) return weekDiff;

    return getTimestamp(right.updatedAt) - getTimestamp(left.updatedAt);
  });
}

function formatMonthLabel(monthValue: string) {
  const [year, month] = monthValue.split("-");
  if (!year || !month) return monthValue;
  return `Tháng ${Number(month)}/${year}`;
}

export function WorkspaceTodoCard({
  workspaceId,
  initialTodos,
  hrMembers,
  canManage,
}: WorkspaceTodoCardProps) {
  const currentMonth = getMonthInputValue();
  const currentWeek = getWeekInMonth();
  const [todos, setTodos] = useState(() => sortTodos(initialTodos));
  const [isOpen, setIsOpen] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [hideCompleted, setHideCompleted] = useState(false);
  const [collapsedWeeks, setCollapsedWeeks] = useState<number[]>([]);
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [workMonth, setWorkMonth] = useState(currentMonth);
  const [workWeek, setWorkWeek] = useState(currentWeek);
  const [assignedToId, setAssignedToId] = useState(hrMembers[0]?.id ?? "");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [editingTodoId, setEditingTodoId] = useState<string | null>(null);
  const [editWorkMonth, setEditWorkMonth] = useState(currentMonth);
  const [editWorkWeek, setEditWorkWeek] = useState(currentWeek);
  const [editAssignedToId, setEditAssignedToId] = useState("");
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const hrNameById = useMemo(
    () => new Map(hrMembers.map((member) => [member.id, member.name])),
    [hrMembers],
  );
  const pendingTodos = useMemo(() => todos.filter((todo) => !todo.done), [todos]);
  const completedTodos = todos.length - pendingTodos.length;
  const completionPercent = todos.length ? Math.round((completedTodos / todos.length) * 100) : 0;
  const selectedMonthTodos = useMemo(
    () => todos.filter((todo) => getTodoMonth(todo) === selectedMonth),
    [selectedMonth, todos],
  );
  const visibleWeekGroups = useMemo(() => {
    const weekGroups = new Map<number, WorkspaceTodo[]>();

    sortTodos(selectedMonthTodos).forEach((todo) => {
      if (hideCompleted && todo.done) return;

      const week = getTodoWeek(todo);
      weekGroups.set(week, [...(weekGroups.get(week) ?? []), todo]);
    });

    return Array.from(weekGroups.entries())
      .sort(([leftWeek], [rightWeek]) => leftWeek - rightWeek)
      .map(([week, items]) => ({
      week,
      items,
      total: items.length,
      done: items.filter((todo) => todo.done).length,
    }));
  }, [hideCompleted, selectedMonthTodos]);

  function toggleWeekGroup(week: number) {
    setCollapsedWeeks((current) =>
      current.includes(week)
        ? current.filter((item) => item !== week)
        : [...current, week],
    );
  }

  const openCreateDialog = () => {
    if (!canManage) return;
    setError("");
    setWorkMonth(selectedMonth);
    setIsOpen(true);
    setIsCreateOpen(true);
  };

  const closeCreateDialog = () => {
    setIsCreateOpen(false);
    setWorkMonth(selectedMonth);
    setWorkWeek(currentWeek);
    setAssignedToId(hrMembers[0]?.id ?? "");
    setTitle("");
    setDescription("");
    setError("");
  };

  const handleCreateTodo = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canManage || !workMonth || !workWeek || !assignedToId || !title.trim()) return;

    setBusyId("create");
    setError("");

    try {
      const response = await fetch(`/api/workspaces/${workspaceId}/todos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workMonth,
          workWeek,
          assignedToId,
          title,
          description,
        }),
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || "Không thể thêm báo cáo công việc.");
      }

      setSelectedMonth(workMonth);
      setTodos((current) => sortTodos([payload, ...current]));
      closeCreateDialog();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể thêm báo cáo công việc.");
    } finally {
      setBusyId(null);
    }
  };

  const handleToggleTodo = async (todo: WorkspaceTodo) => {
    if (!canManage) return;

    setBusyId(todo.id);
    setError("");

    try {
      const response = await fetch(`/api/workspaces/${workspaceId}/todos/${todo.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ done: !todo.done }),
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || "Không thể cập nhật trạng thái.");
      }

      setTodos((current) => sortTodos(current.map((item) => (item.id === todo.id ? payload : item))));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể cập nhật trạng thái.");
    } finally {
      setBusyId(null);
    }
  };

  function startEditTodo(todo: WorkspaceTodo) {
    if (!canManage) return;
    setError("");
    setEditingTodoId(todo.id);
    setEditWorkMonth(getTodoMonth(todo));
    setEditWorkWeek(getTodoWeek(todo));
    setEditAssignedToId(todo.assignedToId ?? "");
    setEditTitle(todo.title);
    setEditDescription(todo.description ?? "");
  }

  function cancelEditTodo() {
    setEditingTodoId(null);
    setEditWorkMonth(currentMonth);
    setEditWorkWeek(currentWeek);
    setEditAssignedToId("");
    setEditTitle("");
    setEditDescription("");
  }

  const handleUpdateTodo = async (todo: WorkspaceTodo) => {
    if (
      !canManage ||
      !editingTodoId ||
      !editWorkMonth ||
      !editWorkWeek ||
      !editAssignedToId ||
      !editTitle.trim()
    ) {
      return;
    }

    setBusyId(todo.id);
    setError("");

    try {
      const response = await fetch(`/api/workspaces/${workspaceId}/todos/${todo.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workMonth: editWorkMonth,
          workWeek: editWorkWeek,
          assignedToId: editAssignedToId,
          title: editTitle,
          description: editDescription,
        }),
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || "Không thể cập nhật báo cáo công việc.");
      }

      setSelectedMonth(editWorkMonth);
      setTodos((current) => sortTodos(current.map((item) => (item.id === todo.id ? payload : item))));
      cancelEditTodo();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể cập nhật báo cáo công việc.");
    } finally {
      setBusyId(null);
    }
  };

  const handleDeleteTodo = async (todoId: string) => {
    if (!canManage) return;

    const previousTodos = todos;
    setTodos((current) => current.filter((todo) => todo.id !== todoId));
    if (editingTodoId === todoId) {
      cancelEditTodo();
    }
    setBusyId(todoId);
    setError("");

    try {
      const response = await fetch(`/api/workspaces/${workspaceId}/todos/${todoId}`, {
        method: "DELETE",
      });
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
          <button type="button" onClick={() => setIsOpen(true)} className="min-w-0 flex-1 text-left">
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

        <button type="button" onClick={() => setIsOpen(true)} className="mt-4 w-full text-left">
          <p className="text-sm font-semibold leading-6 text-on-surface-variant">
            {todos.length ? `${completedTodos}/${todos.length} mục đã xong` : "Chưa có báo cáo công việc"}
          </p>
          <div className="mt-4 h-2 rounded-full bg-primary/10">
            <div className="h-full rounded-full bg-cta-gradient transition-all" style={{ width: `${completionPercent}%` }} />
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
          <div className="max-h-[88vh] w-full max-w-[92rem] overflow-hidden rounded-[2rem] border border-white/70 bg-white shadow-[0_34px_90px_rgba(70,20,45,0.24)]">
            <div className="flex flex-col gap-4 border-b border-primary/10 bg-[linear-gradient(145deg,rgba(255,239,245,0.95),rgba(255,255,255,0.98))] px-5 py-5 sm:flex-row sm:items-start sm:justify-between sm:px-6">
              <div className="min-w-0">
                <p className="text-xs font-black uppercase tracking-[0.2em] text-primary">Workspace report</p>
                <h2 className="mt-2 text-2xl font-black tracking-tight text-on-surface">Báo cáo công việc</h2>
                <p className="mt-2 text-sm font-medium text-on-surface-variant">
                  Theo dõi công việc theo tháng, tuần và người phụ trách.
                </p>
              </div>
              <div className="flex shrink-0 flex-wrap items-center gap-2">
                <Input
                  type="month"
                  value={selectedMonth}
                  onChange={(event) => setSelectedMonth(event.target.value || currentMonth)}
                  className="h-10 w-40 rounded-full bg-white text-sm font-black"
                />
                <button
                  type="button"
                  onClick={() => setHideCompleted((current) => !current)}
                  className={`inline-flex h-10 items-center gap-2 rounded-full px-4 text-sm font-black shadow-sm transition ${
                    hideCompleted
                      ? "bg-tertiary text-white"
                      : "bg-white text-on-surface hover:bg-primary-container/70"
                  }`}
                >
                  <EyeOff className="h-4 w-4" />
                  Ẩn việc đã xong
                </button>
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

            <div className="max-h-[calc(88vh-132px)] overflow-auto p-5 sm:p-6">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-[1.3rem] bg-surface-container-low px-4 py-3">
                <p className="text-sm font-black text-on-surface">{formatMonthLabel(selectedMonth)}</p>
                <p className="text-xs font-black uppercase tracking-[0.14em] text-outline">
                  {selectedMonthTodos.length} việc trong tháng
                </p>
              </div>

              {error ? (
                <p className="mb-4 rounded-2xl bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-600">{error}</p>
              ) : null}

              {visibleWeekGroups.length ? (
                <table className="w-full min-w-[1180px] border-separate border-spacing-0 overflow-hidden rounded-[1.3rem] border border-primary/10 text-left">
                  <thead>
                    <tr>
                      <th className="w-52 border-b border-r border-primary/10 bg-surface-container-low px-4 py-3 text-xs font-black uppercase tracking-[0.14em] text-outline">
                        Người phụ trách
                      </th>
                      <th className="w-[34%] border-b border-r border-primary/10 bg-surface-container-low px-4 py-3 text-xs font-black uppercase tracking-[0.14em] text-outline">
                        Công việc
                      </th>
                      <th className="border-b border-r border-primary/10 bg-surface-container-low px-4 py-3 text-xs font-black uppercase tracking-[0.14em] text-outline">
                        Ghi chú
                      </th>
                      <th className="w-40 border-b border-primary/10 bg-surface-container-low px-4 py-3 text-right text-xs font-black uppercase tracking-[0.14em] text-outline">
                        Thao tác
                      </th>
                    </tr>
                  </thead>
                  {visibleWeekGroups.map((group) => {
                    const collapsed = collapsedWeeks.includes(group.week);

                    return (
                      <tbody key={group.week}>
                        <tr>
                          <td colSpan={4} className="border-b border-primary/10 bg-primary-fixed/45 p-0">
                            <button
                              type="button"
                              onClick={() => toggleWeekGroup(group.week)}
                              className="flex w-full items-center justify-between gap-4 px-4 py-3 text-left transition hover:bg-white/45"
                            >
                              <span className="flex items-center gap-3">
                                <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white text-primary shadow-[0_8px_20px_rgba(15,23,42,0.08)]">
                                  {collapsed ? (
                                    <ChevronRight className="h-4 w-4" />
                                  ) : (
                                    <ChevronDown className="h-4 w-4" />
                                  )}
                                </span>
                                <span className="text-sm font-black text-on-surface">Tuần {group.week}</span>
                                <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-outline">
                                  {group.done}/{group.total} đã xong
                                </span>
                              </span>
                              <span className="text-xs font-black uppercase tracking-[0.14em] text-outline">
                                {collapsed ? "Mở nhóm" : "Thu nhóm"}
                              </span>
                            </button>
                          </td>
                        </tr>
                        {collapsed
                          ? null
                          : group.items.map((todo) => {
                              const isEditing = editingTodoId === todo.id;
                              const isBusy = busyId === todo.id;

                              return (
                                <tr key={todo.id} className="align-top">
                                  <td className="border-b border-r border-primary/10 bg-white px-4 py-4">
                                    {isEditing ? (
                                      <div className="space-y-2">
                                        <select
                                          value={editAssignedToId}
                                          onChange={(event) => setEditAssignedToId(event.target.value)}
                                          disabled={isBusy}
                                          className="field h-10 text-sm"
                                        >
                                          {hrMembers.map((hr) => (
                                            <option key={hr.id} value={hr.id}>
                                              {hr.name}
                                            </option>
                                          ))}
                                        </select>
                                        <div className="grid grid-cols-[1fr_92px] gap-2">
                                          <Input
                                            type="month"
                                            value={editWorkMonth}
                                            onChange={(event) => setEditWorkMonth(event.target.value || currentMonth)}
                                            disabled={isBusy}
                                            className="h-10 text-sm"
                                          />
                                          <select
                                            value={editWorkWeek}
                                            onChange={(event) => setEditWorkWeek(Number(event.target.value))}
                                            disabled={isBusy}
                                            className="field h-10 text-sm"
                                          >
                                            {weekOptions.map((week) => (
                                              <option key={week} value={week}>
                                                Tuần {week}
                                              </option>
                                            ))}
                                          </select>
                                        </div>
                                      </div>
                                    ) : (
                                      <span className="inline-flex rounded-full bg-surface-container-low px-3 py-1 text-sm font-black text-on-surface">
                                        {hrNameById.get(todo.assignedToId ?? "") ?? "Chưa phân công"}
                                      </span>
                                    )}
                                  </td>
                                  <td className="border-b border-r border-primary/10 bg-white px-4 py-4">
                                    {isEditing ? (
                                      <Input
                                        value={editTitle}
                                        onChange={(event) => setEditTitle(event.target.value)}
                                        disabled={isBusy}
                                        className="h-10 text-sm font-semibold"
                                        autoFocus
                                      />
                                    ) : (
                                      <div className="flex items-start gap-2">
                                        <button
                                          type="button"
                                          onClick={() => handleToggleTodo(todo)}
                                          disabled={!canManage || isBusy}
                                          className="mt-0.5 text-primary disabled:opacity-50"
                                          aria-label={todo.done ? "Bỏ hoàn thành" : "Đánh dấu hoàn thành"}
                                        >
                                          {todo.done ? (
                                            <CheckCircle2 className="h-4 w-4" />
                                          ) : (
                                            <Circle className="h-4 w-4" />
                                          )}
                                        </button>
                                        <div className="min-w-0 flex-1">
                                          <p
                                            className={`text-sm font-semibold leading-5 ${
                                              todo.done
                                                ? "text-on-surface-variant line-through"
                                                : "text-on-surface"
                                            }`}
                                          >
                                            {todo.title}
                                          </p>
                                        </div>
                                      </div>
                                    )}
                                  </td>
                                  <td className="border-b border-r border-primary/10 bg-white px-4 py-4">
                                    {isEditing ? (
                                      <Textarea
                                        value={editDescription}
                                        onChange={(event) => setEditDescription(event.target.value)}
                                        disabled={isBusy}
                                        className="min-h-20 text-sm"
                                        placeholder="Ghi chú thêm nếu cần..."
                                      />
                                    ) : (
                                      <p className="text-sm font-medium leading-6 text-on-surface-variant">
                                        {todo.description || "Chưa có ghi chú"}
                                      </p>
                                    )}
                                  </td>
                                  <td className="border-b border-primary/10 bg-white px-4 py-4">
                                    <div className="flex justify-end gap-2">
                                      {canManage && isEditing ? (
                                        <>
                                          <button
                                            type="button"
                                            onClick={() => handleUpdateTodo(todo)}
                                            disabled={isBusy || !editTitle.trim() || !editAssignedToId}
                                            className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-primary text-white transition hover:bg-primary/90 disabled:opacity-50"
                                            aria-label="Lưu công việc"
                                          >
                                            <Save className="h-4 w-4" />
                                          </button>
                                          <button
                                            type="button"
                                            onClick={cancelEditTodo}
                                            disabled={isBusy}
                                            className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-surface-container-low text-on-surface transition hover:bg-primary-container/70 disabled:opacity-50"
                                            aria-label="Hủy sửa"
                                          >
                                            <Undo2 className="h-4 w-4" />
                                          </button>
                                        </>
                                      ) : null}
                                      {canManage && !isEditing ? (
                                        <>
                                          <button
                                            type="button"
                                            onClick={() => startEditTodo(todo)}
                                            disabled={isBusy}
                                            className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-surface-container-low text-on-surface transition hover:bg-primary-container/70 disabled:opacity-50"
                                            aria-label="Sửa công việc"
                                          >
                                            <Pencil className="h-4 w-4" />
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => handleDeleteTodo(todo.id)}
                                            disabled={isBusy}
                                            className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-surface-container-low text-outline transition hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50"
                                            aria-label="Xóa việc"
                                          >
                                            <Trash2 className="h-4 w-4" />
                                          </button>
                                        </>
                                      ) : null}
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                      </tbody>
                    );
                  })}
                </table>
              ) : (
                <div className="rounded-[1.5rem] border border-dashed border-primary/20 bg-white px-5 py-8 text-center">
                  <ClipboardList className="mx-auto h-8 w-8 text-primary" />
                  <p className="mt-3 text-sm font-bold text-on-surface">
                    {selectedMonthTodos.length && hideCompleted
                      ? "Tất cả công việc trong tháng này đã hoàn thành và đang được ẩn."
                      : "Chưa có báo cáo công việc trong tháng này."}
                  </p>
                  {canManage ? (
                    <Button type="button" onClick={openCreateDialog} className="mt-4 gap-2">
                      <Plus className="h-4 w-4" />
                      Thêm việc
                    </Button>
                  ) : null}
                </div>
              )}
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
            className="w-full max-w-xl rounded-[1.7rem] border border-white/70 bg-white p-5 shadow-[0_30px_75px_rgba(70,20,45,0.24)] sm:p-6"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-primary">Thêm mới</p>
                <h3 className="mt-2 text-xl font-black text-on-surface">Thêm công việc</h3>
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
                type="month"
                value={workMonth}
                onChange={(event) => setWorkMonth(event.target.value || currentMonth)}
                disabled={!canManage || busyId === "create"}
              />
              <select
                value={workWeek}
                onChange={(event) => setWorkWeek(Number(event.target.value))}
                disabled={!canManage || busyId === "create"}
                className="field"
              >
                {weekOptions.map((week) => (
                  <option key={week} value={week}>
                    Tuần {week}
                  </option>
                ))}
              </select>
              <select
                value={assignedToId}
                onChange={(event) => setAssignedToId(event.target.value)}
                disabled={!canManage || busyId === "create"}
                className="field"
              >
                {hrMembers.length ? (
                  hrMembers.map((hr) => (
                    <option key={hr.id} value={hr.id}>
                      {hr.name}
                    </option>
                  ))
                ) : (
                  <option value="">Chưa có HR</option>
                )}
              </select>
              <Input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Nhập công việc cần xử lý..."
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
              <p className="mt-3 rounded-2xl bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-600">{error}</p>
            ) : null}

            <div className="mt-5 flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={closeCreateDialog} disabled={busyId === "create"}>
                Hủy
              </Button>
              <Button type="submit" className="gap-2" disabled={!canManage || !workMonth || !workWeek || !assignedToId || !title.trim() || busyId === "create"}>
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
