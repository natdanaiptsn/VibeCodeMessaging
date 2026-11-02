"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { Check, ChevronsUpDown, FolderKanban, LayoutGrid, LogOut, Menu, MessageCircle, Plus, Settings, UserCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { NAV_ITEMS } from "@/components/layout/nav-items";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { TestChatWidget } from "@/components/test-chat/test-chat-widget";
import { ProjectAvatar } from "@/components/projects/project-avatar";
import { AppContextProvider, useAppContext, type AppProject, type AppUser } from "@/hooks/use-app-context";
import { apiFetch, useApiQuery } from "@/hooks/use-api";
import { can, ROLE_LABELS } from "@/lib/auth/permissions";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

function Brand({ compact }: { compact?: boolean }) {
  return (
    <Link href="/projects" className="flex items-center gap-2.5 px-2" title="โปรเจกต์ทั้งหมด">
      <span className="flex size-9 items-center justify-center rounded-xl bg-primary text-white shadow-sm">
        <MessageCircle className="size-5" fill="currentColor" />
      </span>
      <span className={cn("leading-tight", compact && "hidden sm:block")}>
        <span className="block text-sm font-bold">LINE OA</span>
        <span className="block text-xs text-muted-foreground">Auto Reply Manager</span>
      </span>
    </Link>
  );
}

type ProjectListItem = { id: string; name: string; pictureUrl: string | null; connectionStatus: string };

/** เลือกโปรเจกต์ (แสดงที่ด้านบนของแถบเมนู) */
function ProjectSwitcher({ project, onNavigate }: { project: AppProject; onNavigate?: () => void }) {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const canCreate = can(useAppContext().user.role, "projects:manage");
  const projects = useApiQuery<ProjectListItem[]>(["projects"], open ? "/api/projects" : null);
  // เปลี่ยนโปรเจกต์แล้วอยู่หน้าเมนูเดิม (เช่น กำลังดูกฎ → ไปหน้ากฎของอีกโปรเจกต์)
  const section = pathname.split("/")[3] ?? "inbox";
  const go = (href: string) => {
    onNavigate?.();
    router.push(href);
  };
  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button
          className="flex w-full items-center gap-2.5 rounded-lg border bg-card px-2.5 py-2 text-left transition hover:bg-gray-50 dark:hover:bg-white/5"
          aria-label="เปลี่ยนโปรเจกต์"
        >
          <ProjectAvatar name={project.name} pictureUrl={project.pictureUrl} className="size-8" />
          <span className="min-w-0 flex-1">
            <span className="block text-[11px] text-muted-foreground">โปรเจกต์</span>
            <span className="block truncate text-sm font-semibold">{project.name}</span>
          </span>
          <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel className="text-xs text-muted-foreground">เปลี่ยนโปรเจกต์</DropdownMenuLabel>
        <div className="thin-scrollbar max-h-72 overflow-y-auto">
          {projects.isLoading && <p className="px-2 py-1.5 text-sm text-muted-foreground">กำลังโหลด...</p>}
          {(projects.data ?? []).map((p) => (
            <DropdownMenuItem key={p.id} onSelect={() => p.id !== project.id && go(`/p/${p.id}/${section}`)}>
              <ProjectAvatar name={p.name} pictureUrl={p.pictureUrl} className="size-6 rounded-md text-[11px]" />
              <span className="min-w-0 flex-1 truncate">{p.name}</span>
              {p.id === project.id && <Check className="text-primary" />}
            </DropdownMenuItem>
          ))}
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => go("/projects")}>
          <LayoutGrid /> โปรเจกต์ทั้งหมด
        </DropdownMenuItem>
        {canCreate && (
          <DropdownMenuItem onSelect={() => go("/projects?create=1")}>
            <Plus /> สร้างโปรเจกต์ใหม่
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function NavList({ user, project, onNavigate }: { user: AppUser; project: AppProject; onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav className="flex flex-col gap-0.5">
      {NAV_ITEMS.filter((item) => can(user.role, item.permission)).map((item) => {
        const href = `/p/${project.id}${item.href}`;
        const active = pathname === href || pathname.startsWith(`${href}/`);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={href}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
              active ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-gray-100 dark:hover:bg-white/5",
            )}
          >
            <Icon className={cn("size-[18px]", active ? "text-primary" : "text-gray-500 dark:text-gray-400")} />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

/** เมนูผู้ใช้ (บัญชี, ตั้งค่าที่ใช้ร่วมกันทุกโปรเจกต์, ออกจากระบบ) */
export function UserMenu({ user, compact }: { user: AppUser; compact?: boolean }) {
  const router = useRouter();
  const logout = async () => {
    try {
      await apiFetch("/api/auth/logout", { method: "POST" });
    } catch {
      /* ignore */
    }
    toast.success("ออกจากระบบแล้ว");
    router.replace("/login");
    router.refresh();
  };
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {compact ? (
          <Button variant="ghost" size="icon" aria-label="บัญชีผู้ใช้">
            <UserCircle2 className="size-6 text-gray-500 dark:text-gray-400" />
          </Button>
        ) : (
          <button className="flex w-full items-center gap-3 rounded-lg border bg-card px-3 py-2 text-left hover:bg-gray-50 dark:hover:bg-white/5">
            <UserCircle2 className="size-8 text-gray-400 dark:text-gray-500" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">{user.name}</span>
              <span className="block truncate text-xs text-muted-foreground">{ROLE_LABELS[user.role]}</span>
            </span>
          </button>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="truncate">
          {user.name}
          <span className="block text-xs font-normal text-muted-foreground">{user.username ?? user.email}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => router.push("/projects")}>
          <LayoutGrid /> โปรเจกต์ทั้งหมด
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => router.push("/settings")}>
          <Settings /> บัญชีและผู้ใช้งาน
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onSelect={logout}>
          <LogOut /> ออกจากระบบ
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function SidebarContent({ user, project, onNavigate }: { user: AppUser; project: AppProject; onNavigate?: () => void }) {
  return (
    <div className="flex h-full flex-col gap-4 p-4">
      <Brand />
      <ProjectSwitcher project={project} onNavigate={onNavigate} />
      <div className="thin-scrollbar flex-1 overflow-y-auto">
        <NavList user={user} project={project} onNavigate={onNavigate} />
      </div>
      <div className="flex flex-col gap-2">
        <ThemeToggle />
        <UserMenu user={user} />
      </div>
    </div>
  );
}

/** โครงหน้าภายในโปรเจกต์ (แถบเมนูซ้าย + แชททดสอบ) */
export function AppShell({
  user,
  timezone,
  project,
  children,
}: {
  user: AppUser;
  timezone: string;
  project: AppProject;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  // เว้นที่ด้านล่างให้ปุ่มแชททดสอบ (ยกเว้นหน้ากล่องข้อความที่ใช้ความสูงเต็มจอ)
  const roomForChatButton = can(user.role, "rules:view") && !pathname.startsWith(`/p/${project.id}/inbox`);
  return (
    <AppContextProvider value={{ user, timezone, project }}>
      <div className="min-h-dvh">
        <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r bg-sidebar lg:block">
          <SidebarContent user={user} project={project} />
        </aside>
        <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b bg-card/95 px-4 backdrop-blur lg:hidden">
          <Button variant="ghost" size="icon" onClick={() => setOpen(true)} aria-label="เปิดเมนู">
            <Menu />
          </Button>
          <ProjectAvatar name={project.name} pictureUrl={project.pictureUrl} className="size-8" />
          <span className="min-w-0 truncate text-sm font-semibold">{project.name}</span>
        </header>
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetContent side="left" className="w-72 p-0">
            <SheetTitle className="sr-only">เมนู</SheetTitle>
            <SidebarContent user={user} project={project} onNavigate={() => setOpen(false)} />
          </SheetContent>
        </Sheet>
        <main className="lg:pl-64">
          <div className={cn("mx-auto w-full max-w-[1600px] p-4 sm:p-6", roomForChatButton && "pb-24 sm:pb-24")}>{children}</div>
        </main>
        <TestChatWidget />
      </div>
    </AppContextProvider>
  );
}

/** โครงหน้าระดับบัญชี (รายการโปรเจกต์ / ตั้งค่าบัญชีและผู้ใช้งาน) */
export function AccountShell({ user, children }: { user: AppUser; children: React.ReactNode }) {
  const pathname = usePathname();
  const links = [
    { href: "/projects", label: "โปรเจกต์", icon: FolderKanban },
    { href: "/settings", label: "บัญชีและผู้ใช้งาน", icon: Settings },
  ];
  return (
    <AppContextProvider value={{ user, timezone: "Asia/Bangkok", project: null }}>
      <div className="min-h-dvh">
        <header className="sticky top-0 z-20 border-b bg-card/95 backdrop-blur">
          <div className="mx-auto flex h-16 w-full max-w-6xl items-center gap-2 px-4 sm:gap-4 sm:px-6">
            <Brand compact />
            <nav className="ml-1 flex items-center gap-1 sm:ml-4">
              {links.map(({ href, label, icon: Icon }) => {
                const active = pathname === href || pathname.startsWith(`${href}/`);
                return (
                  <Link
                    key={href}
                    href={href}
                    className={cn(
                      "flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors",
                      active ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
                    )}
                  >
                    <Icon className="size-4" />
                    <span className={cn(href === "/settings" && "hidden sm:inline")}>{label}</span>
                  </Link>
                );
              })}
            </nav>
            <div className="ml-auto flex items-center gap-2">
              <ThemeToggle className="hidden w-52 md:grid" />
              <UserMenu user={user} compact />
            </div>
          </div>
        </header>
        <main className="mx-auto w-full max-w-6xl p-4 sm:p-6">{children}</main>
      </div>
    </AppContextProvider>
  );
}
