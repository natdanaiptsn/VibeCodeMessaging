"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { LogOut, Menu, MessageCircle, UserCircle2 } from "lucide-react";
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
import { AppContextProvider, type AppUser } from "@/hooks/use-app-context";
import { apiFetch } from "@/hooks/use-api";
import { can, ROLE_LABELS } from "@/lib/auth/permissions";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

function Brand() {
  return (
    <Link href="/dashboard" className="flex items-center gap-2.5 px-2">
      <span className="flex size-9 items-center justify-center rounded-xl bg-primary text-white shadow-sm">
        <MessageCircle className="size-5" fill="currentColor" />
      </span>
      <span className="leading-tight">
        <span className="block text-sm font-bold">LINE OA</span>
        <span className="block text-xs text-muted-foreground">Auto Reply Manager</span>
      </span>
    </Link>
  );
}

function NavList({ user, onNavigate }: { user: AppUser; onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav className="flex flex-col gap-0.5">
      {NAV_ITEMS.filter((item) => can(user.role, item.permission)).map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
              active ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-gray-100",
            )}
          >
            <Icon className={cn("size-[18px]", active ? "text-primary" : "text-gray-500")} />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

function UserMenu({ user }: { user: AppUser }) {
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
        <button className="flex w-full items-center gap-3 rounded-lg border bg-white px-3 py-2 text-left hover:bg-gray-50">
          <UserCircle2 className="size-8 text-gray-400" />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium">{user.name}</span>
            <span className="block truncate text-xs text-muted-foreground">{ROLE_LABELS[user.role]}</span>
          </span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="truncate">{user.email}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => router.push("/settings?tab=account")}>เปลี่ยนรหัสผ่าน</DropdownMenuItem>
        <DropdownMenuItem variant="destructive" onSelect={logout}>
          <LogOut /> ออกจากระบบ
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function SidebarContent({ user, onNavigate }: { user: AppUser; onNavigate?: () => void }) {
  return (
    <div className="flex h-full flex-col gap-6 p-4">
      <Brand />
      <div className="thin-scrollbar flex-1 overflow-y-auto">
        <NavList user={user} onNavigate={onNavigate} />
      </div>
      <UserMenu user={user} />
    </div>
  );
}

export function AppShell({ user, timezone, children }: { user: AppUser; timezone: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <AppContextProvider value={{ user, timezone }}>
      <div className="min-h-dvh">
        <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r bg-sidebar lg:block">
          <SidebarContent user={user} />
        </aside>
        <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b bg-white/95 px-4 backdrop-blur lg:hidden">
          <Button variant="ghost" size="icon" onClick={() => setOpen(true)} aria-label="เปิดเมนู">
            <Menu />
          </Button>
          <Brand />
        </header>
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetContent side="left" className="w-72 p-0">
            <SheetTitle className="sr-only">เมนู</SheetTitle>
            <SidebarContent user={user} onNavigate={() => setOpen(false)} />
          </SheetContent>
        </Sheet>
        <main className="lg:pl-64">
          <div className="mx-auto w-full max-w-[1600px] p-4 sm:p-6">{children}</div>
        </main>
      </div>
    </AppContextProvider>
  );
}
