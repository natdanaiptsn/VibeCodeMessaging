import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/auth/current-user";
import { LoginForm } from "@/components/auth/login-form";
import { Providers } from "@/components/providers";

export const metadata: Metadata = { title: "เข้าสู่ระบบ" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const session = await getCurrentSession();
  const { next } = await searchParams;
  const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
  if (session) redirect(safeNext);
  return (
    <Providers>
      <div className="flex min-h-dvh items-center justify-center bg-gradient-to-br from-[#e9f9ef] via-white to-gray-50 p-4">
        <LoginForm next={safeNext} />
      </div>
    </Providers>
  );
}
