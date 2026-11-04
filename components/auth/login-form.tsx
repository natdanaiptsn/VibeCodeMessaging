"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Loader2, LockKeyhole, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field } from "@/components/common/field";
import { GoogleIcon, LineIcon } from "@/components/auth/provider-icons";
import { apiFetch, ApiClientError } from "@/hooks/use-api";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type Provider = { id: "google" | "line"; label: string };

/** ข้อความเมื่อเข้าสู่ระบบด้วย Google / LINE ไม่สำเร็จ (?error=...) */
const SSO_ERRORS: Record<string, string> = {
  cancelled: "ยกเลิกการเข้าสู่ระบบแล้ว",
  state: "หมดเวลาหรือเริ่มเข้าสู่ระบบจากหน้าต่างอื่น กรุณากดปุ่มเข้าสู่ระบบอีกครั้ง",
  provider: "ผู้ให้บริการยืนยันตัวตนไม่สำเร็จ กรุณาลองใหม่",
  config: "ยังไม่ได้ตั้งค่าการเข้าสู่ระบบด้วยบัญชีนี้ (ติดต่อผู้ดูแลระบบ)",
  disabled: "บัญชีนี้ถูกปิดการใช้งาน กรุณาติดต่อผู้ดูแลระบบ",
  signup_closed: "ยังไม่เปิดรับสมัครบัญชีใหม่ — ให้ผู้ดูแลเพิ่มบัญชีให้ก่อน",
  rate: "พยายามเข้าสู่ระบบบ่อยเกินไป กรุณารอสักครู่",
};

export function LoginForm({ next, providers, error: ssoError }: { next: string; providers: Provider[]; error?: string | null }) {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(ssoError ? (SSO_ERRORS[ssoError] ?? SSO_ERRORS.provider!) : null);
  // มีปุ่ม Google/LINE แล้ว ซ่อนช่องรหัสผ่านไว้ก่อน (กดเปิดได้)
  const [showPassword, setShowPassword] = useState(providers.length === 0);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await apiFetch("/api/auth/login", { method: "POST", body: { username, password } });
      toast.success("เข้าสู่ระบบสำเร็จ");
      router.replace(next);
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "เข้าสู่ระบบไม่สำเร็จ");
      setLoading(false);
    }
  };

  const href = (id: string) => `/api/auth/oauth/${id}?next=${encodeURIComponent(next)}`;

  return (
    <Card className="w-full max-w-sm shadow-lg">
      <CardHeader className="text-center">
        <div className="mx-auto mb-2 flex size-14 items-center justify-center rounded-2xl bg-primary text-white shadow">
          <MessageCircle className="size-7" fill="currentColor" />
        </div>
        <CardTitle className="text-xl">LINE OA Auto Reply Manager</CardTitle>
        <CardDescription>{providers.length ? "เข้าสู่ระบบหรือสมัครใช้งานด้วยบัญชีของคุณ" : "เข้าสู่ระบบสำหรับผู้ดูแล"}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        {error && (
          <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-500/15 dark:text-red-300">
            {error}
          </p>
        )}
        {providers.length > 0 && (
          <div className="grid gap-2.5">
            {providers.map((p) =>
              p.id === "google" ? (
                <a
                  key={p.id}
                  href={href(p.id)}
                  className="flex h-11 items-center justify-center gap-2.5 rounded-md border bg-white text-sm font-medium text-[#1f1f1f] shadow-xs transition hover:bg-gray-50 dark:border-white/20"
                >
                  <GoogleIcon className="size-5" /> เข้าสู่ระบบด้วย Google
                </a>
              ) : (
                <a
                  key={p.id}
                  href={href(p.id)}
                  className="flex h-11 items-center justify-center gap-2.5 rounded-md bg-[#06C755] text-sm font-medium text-white shadow-xs transition hover:bg-[#05b04b]"
                >
                  <LineIcon className="size-6" /> เข้าสู่ระบบด้วย LINE
                </a>
              ),
            )}
            <p className="text-center text-xs text-muted-foreground">ยังไม่มีบัญชี? กดปุ่มด้านบนเพื่อสมัครอัตโนมัติ</p>
          </div>
        )}
        {providers.length > 0 && (
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            aria-expanded={showPassword}
            className="flex items-center gap-3 text-xs text-muted-foreground hover:text-foreground"
          >
            <span className="h-px flex-1 bg-border" />
            <span className="flex items-center gap-1">
              เข้าสู่ระบบด้วยชื่อผู้ใช้และรหัสผ่าน
              <ChevronDown className={cn("size-3.5 transition-transform", showPassword && "rotate-180")} />
            </span>
            <span className="h-px flex-1 bg-border" />
          </button>
        )}
        {showPassword && (
          <form onSubmit={submit} className="grid gap-4">
            <Field label="ชื่อผู้ใช้" htmlFor="username">
              <Input
                id="username"
                type="text"
                autoComplete="username"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                required
                autoFocus={providers.length === 0}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </Field>
            <Field label="รหัสผ่าน" htmlFor="password">
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </Field>
            <Button type="submit" size="lg" variant={providers.length ? "outline" : "default"} disabled={loading}>
              {loading ? <Loader2 className="animate-spin" /> : <LockKeyhole />}
              เข้าสู่ระบบ
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
