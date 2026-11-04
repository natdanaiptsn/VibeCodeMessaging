import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/auth/current-user";
import { LoginForm } from "@/components/auth/login-form";
import { enabledProviders } from "@/lib/auth/oauth/providers";
import { Providers } from "@/components/providers";
import { ThemeToggle } from "@/components/layout/theme-toggle";

export const metadata: Metadata = { title: "เข้าสู่ระบบ" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const session = await getCurrentSession();
  const { next, error } = await searchParams;
  const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : "/projects";
  if (session) redirect(safeNext);
  return (
    <Providers>
      <div className="relative flex min-h-dvh items-center justify-center bg-gradient-to-br from-[#e9f9ef] via-white to-gray-50 p-4 dark:from-[#0f2418] dark:via-background dark:to-background">
        <ThemeToggle className="absolute top-4 right-4 w-52 bg-card/70" />
        <div className="flex w-full flex-col items-center gap-4">
          <LoginForm next={safeNext} providers={enabledProviders()} error={error ?? null} />
          <p className="flex gap-3 text-xs text-muted-foreground">
            <Link href="/privacy" className="hover:text-foreground hover:underline">นโยบายความเป็นส่วนตัว</Link>
            <span aria-hidden="true">·</span>
            <Link href="/terms" className="hover:text-foreground hover:underline">ข้อกำหนดการใช้งาน</Link>
          </p>
        </div>
      </div>
    </Providers>
  );
}
