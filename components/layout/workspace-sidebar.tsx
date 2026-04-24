"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BriefcaseBusiness,
  ChevronDown,
  FolderOpen,
  LayoutDashboard,
  Menu,
  UploadCloud,
  Users,
  X,
} from "lucide-react";

import { NavIcon } from "@/components/layout/nav-icon";
import { LogoutButton } from "@/components/layout/logout-button";
import { cn, workspaceRoleMeta } from "@/lib/utils";
import type { WorkspaceRoleType } from "@/types";

type SidebarProps = {
  workspaceId: string;
  workspaceName: string;
  userName: string;
  userEmail: string;
  membershipRole: WorkspaceRoleType;
};

function getInitials(name: string) {
  return name
    .split(" ")
    .map((part) => part.trim()[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function WorkspaceSidebar({
  workspaceId,
  workspaceName,
  userName,
  userEmail,
  membershipRole,
}: SidebarProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement | null>(null);
  const isManager = membershipRole === "MANAGER";
  const isHrAdmin = membershipRole === "HR_ADMIN";

  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }

    function handleClickOutside(event: MouseEvent) {
      if (!profileRef.current?.contains(event.target as Node)) {
        setProfileOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const items = [
    { label: "Trang chủ", href: `/workspace/${workspaceId}/dashboard`, icon: LayoutDashboard },
    { label: "Kho CV", href: `/workspace/${workspaceId}/candidates`, icon: FolderOpen },
    ...(!isManager ? [{ label: "Upload CV", href: `/workspace/${workspaceId}/candidates/upload`, icon: UploadCloud }] : []),
    ...(isHrAdmin ? [{ label: "Dự án", href: `/workspace/${workspaceId}/projects`, icon: BriefcaseBusiness }] : []),
    ...(isHrAdmin ? [{ label: "Thành viên", href: `/workspace/${workspaceId}/members`, icon: Users }] : []),
  ];

  return (
    <header className="sticky top-0 z-50 w-full bg-white/85 backdrop-blur-xl shadow-[0_4px_40px_-12px_rgba(160,57,100,0.10)]">
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <div className="flex shrink-0 items-center gap-3">
          <Link href="/workspaces" className="inline-flex items-center gap-2 text-lg font-black tracking-tight text-primary">
            <NavIcon className="size-9 rounded-[0.9rem]" />
            <span>Quét CV</span>
          </Link>
          <div className="hidden items-center gap-2 rounded-full bg-surface-container-low px-3 py-1.5 sm:flex">
            <span className="text-[0.65rem] font-black uppercase tracking-[0.18em] text-primary">WS</span>
            <span className="max-w-[160px] truncate text-sm font-bold text-on-surface">{workspaceName}</span>
          </div>
        </div>

        <nav className="hidden flex-1 items-center justify-center gap-1 md:flex">
          {items.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold transition-all",
                  active
                    ? "bg-primary text-white shadow-bubbly"
                    : "text-on-surface-variant hover:bg-surface-container-low hover:text-primary",
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="hidden shrink-0 md:flex" ref={profileRef}>
          <div className="relative">
            <button
              type="button"
              onClick={() => setProfileOpen((current) => !current)}
              className={cn(
                "inline-flex items-center gap-2 rounded-full border border-white/75 bg-white/82 px-2.5 py-2 shadow-[0_10px_24px_rgba(15,23,42,0.06)] transition",
                profileOpen && "bg-white shadow-[0_14px_30px_rgba(15,23,42,0.10)]",
              )}
              aria-haspopup="menu"
              aria-expanded={profileOpen}
              aria-label="Mở menu tài khoản"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[linear-gradient(145deg,rgba(191,82,125,0.16),rgba(255,255,255,0.98))] text-sm font-black text-primary">
                {getInitials(userName)}
              </span>
              <ChevronDown
                className={cn(
                  "h-4 w-4 text-on-surface-variant transition-transform",
                  profileOpen && "rotate-180",
                )}
              />
            </button>

            {profileOpen ? (
              <div className="absolute right-0 top-[calc(100%+0.75rem)] w-72 rounded-[1.6rem] border border-white/80 bg-white/95 p-4 shadow-[0_22px_60px_rgba(15,23,42,0.14)] backdrop-blur-xl">
                <div className="flex items-center gap-3">
                  <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[linear-gradient(145deg,rgba(191,82,125,0.16),rgba(255,255,255,0.98))] text-sm font-black text-primary">
                    {getInitials(userName)}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-black text-on-surface">{userName}</p>
                    <p className="truncate text-xs font-medium text-on-surface-variant">{userEmail}</p>
                  </div>
                </div>

                <div className="mt-4 rounded-[1.2rem] bg-surface-container-low px-3 py-3">
                  <p className="text-[11px] font-black uppercase tracking-[0.16em] text-primary">Vai trò workspace</p>
                  <p className="mt-1 text-sm font-bold text-on-surface">{workspaceRoleMeta[membershipRole]}</p>
                </div>

                <div className="mt-4">
                  <LogoutButton compact />
                </div>
              </div>
            ) : null}
          </div>
        </div>

        <button
          onClick={() => setOpen(!open)}
          aria-label="Toggle menu"
          className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-container-low text-on-surface-variant transition hover:text-primary md:hidden"
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {open && (
        <div className="bg-white/95 pb-4 shadow-[0_8px_40px_-8px_rgba(160,57,100,0.12)] backdrop-blur-xl md:hidden">
          <div className="mx-auto w-full max-w-7xl space-y-3 px-4 pt-2 sm:px-6 lg:px-8">
            <div className="rounded-[1.5rem] bg-surface-container-low px-4 py-3">
              <p className="text-[0.65rem] font-black uppercase tracking-[0.18em] text-primary">Workspace</p>
              <p className="mt-1 text-sm font-bold text-on-surface">{workspaceName}</p>
              <p className="text-xs font-medium text-on-surface-variant">{userName}</p>
              <p className="text-xs font-medium text-on-surface-variant">{userEmail}</p>
              <p className="mt-2 text-[11px] font-black uppercase tracking-[0.16em] text-primary">
                {workspaceRoleMeta[membershipRole]}
              </p>
            </div>

            <nav className="space-y-1">
              {items.map((item) => {
                const Icon = item.icon;
                const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className={cn(
                      "flex items-center gap-3 rounded-full px-4 py-3 text-sm font-bold transition-all",
                      active
                        ? "bg-primary text-white shadow-bubbly"
                        : "text-on-surface-variant hover:bg-surface-container-low hover:text-primary",
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>

            <LogoutButton />
          </div>
        </div>
      )}
    </header>
  );
}
