"use client";

import { useState } from "react";
import {
  CheckCircle2,
  CircleAlert,
  Copy,
  KeyRound,
  Loader2,
  PlugZap,
  RefreshCw,
  Save,
  Send,
  ShieldCheck,
  Trash2,
  Webhook,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/common/page-header";
import { Field } from "@/components/common/field";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { CustomerAvatar } from "@/components/common/customer-avatar";
import { ErrorState, LoadingState } from "@/components/common/states";
import { apiFetch, ApiClientError, useApiQuery } from "@/hooks/use-api";
import { useAppContext, useCan } from "@/hooks/use-app-context";
import { formatDateTime, formatNumber } from "@/lib/format";

type Account = {
  id: string;
  name: string;
  channelId: string | null;
  botUserId: string | null;
  basicId: string | null;
  displayName: string | null;
  pictureUrl: string | null;
  hasChannelSecret: boolean;
  hasChannelAccessToken: boolean;
  secretSource: "env" | "database" | null;
  tokenSource: "env" | "database" | null;
  credentialsUpdatedAt: string | null;
  connectionStatus: "UNKNOWN" | "CONNECTED" | "FAILED";
  connectionError: string | null;
  lastVerifiedAt: string | null;
  lastWebhookAt: string | null;
  webhookUrl: string | null;
};

type WebhookInfo = { expected: string | null; configured: string | null; active: boolean; matches?: boolean; error: string | null };
type Quota = { available: boolean; type?: string; limit?: number | null; used?: number; error?: string };

function SourceBadge({ source }: { source: "env" | "database" | null }) {
  if (source === "env") return <Badge variant="info">จาก Environment</Badge>;
  if (source === "database") return <Badge variant="success">เข้ารหัสในฐานข้อมูล</Badge>;
  return <Badge variant="warning">ยังไม่ได้ตั้งค่า</Badge>;
}

export function LineSettingsView() {
  const { timezone } = useAppContext();
  const canManage = useCan("line:manage");
  const qc = useQueryClient();
  const account = useApiQuery<Account>(["line-account"], "/api/line/account");
  const webhook = useApiQuery<WebhookInfo>(["line-webhook"], "/api/line/webhook", { enabled: Boolean(account.data?.hasChannelAccessToken) });
  const quota = useApiQuery<Quota>(["line-quota"], "/api/line/quota", { enabled: account.data?.connectionStatus === "CONNECTED" });

  const [form, setForm] = useState({ channelId: "", channelSecret: "", channelAccessToken: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [clearOpen, setClearOpen] = useState(false);

  const refreshAll = () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: ["line-account"] }),
      qc.invalidateQueries({ queryKey: ["line-webhook"] }),
      qc.invalidateQueries({ queryKey: ["line-quota"] }),
      qc.invalidateQueries({ queryKey: ["dashboard"] }),
    ]);

  const run = async <T,>(key: string, fn: () => Promise<T>) => {
    setBusy(key);
    try {
      return await fn();
    } catch (err) {
      if (err instanceof ApiClientError) {
        setErrors(err.fieldErrors);
        toast.error(err.message);
      }
      return null;
    } finally {
      setBusy(null);
    }
  };

  const saveCredentials = () =>
    run("save", async () => {
      setErrors({});
      const body: Record<string, string> = {};
      if (form.channelId !== "") body.channelId = form.channelId.trim();
      if (form.channelSecret) body.channelSecret = form.channelSecret.trim();
      if (form.channelAccessToken) body.channelAccessToken = form.channelAccessToken.trim();
      if (!Object.keys(body).length) return toast.info("ไม่มีข้อมูลที่เปลี่ยนแปลง");
      await apiFetch("/api/line/credentials", { method: "PUT", body });
      setForm({ channelId: "", channelSecret: "", channelAccessToken: "" });
      toast.success("บันทึก LINE Credentials แล้ว (เข้ารหัสก่อนจัดเก็บ)");
      await refreshAll();
    });

  const testConnection = () =>
    run("test", async () => {
      const r = await apiFetch<{ ok: boolean; message: string; warnings?: string[] }>("/api/line/test-connection", { method: "POST" });
      if (r.ok) toast.success(r.message);
      else toast.error(r.message);
      r.warnings?.forEach((w) => toast.warning(w));
      await refreshAll();
    });

  const setWebhook = () =>
    run("webhook", async () => {
      const endpoint = account.data?.webhookUrl;
      if (!endpoint) return toast.error("ยังไม่ได้ตั้งค่า APP_URL ใน Environment");
      await apiFetch("/api/line/webhook", { method: "PUT", body: { endpoint } });
      toast.success("ตั้งค่า Webhook URL ไปยัง LINE แล้ว");
      await refreshAll();
    });

  const testWebhook = () =>
    run("webhook-test", async () => {
      const r = await apiFetch<{ ok: boolean; message: string }>("/api/line/webhook/test", { method: "POST" });
      if (r.ok) toast.success(r.message);
      else toast.error(r.message);
      await refreshAll();
    });

  const clearCredentials = () =>
    run("clear", async () => {
      await apiFetch("/api/line/credentials?which=all", { method: "DELETE" });
      toast.success("ลบ Credentials ในฐานข้อมูลแล้ว");
      setClearOpen(false);
      await refreshAll();
    });

  if (account.error) return <ErrorState message={account.error.message} onRetry={() => account.refetch()} />;
  if (account.isLoading || !account.data) return <LoadingState />;
  const a = account.data;
  const httpsOk = a.webhookUrl?.startsWith("https://");

  return (
    <>
      <PageHeader
        title="LINE OA Settings"
        description="เชื่อมต่อ LINE Official Account ผ่าน LINE Messaging API"
        actions={
          <Button onClick={testConnection} disabled={busy !== null || !a.hasChannelAccessToken}>
            {busy === "test" ? <Loader2 className="animate-spin" /> : <PlugZap />} ทดสอบการเชื่อมต่อ
          </Button>
        }
      />
      <div className="grid gap-4 xl:grid-cols-3">
        <div className="space-y-4 xl:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><KeyRound className="size-4 text-primary" /> Channel Credentials</CardTitle>
              <CardDescription>
                ค่าจาก LINE Developers Console → Messaging API channel ระบบจะเข้ารหัสด้วย AES-256-GCM และไม่ส่งค่ากลับมาที่หน้าเว็บ
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="grid gap-3 rounded-lg bg-gray-50 p-3 text-sm sm:grid-cols-2">
                <div className="flex items-center justify-between gap-2">
                  <span>Channel Secret</span>
                  <SourceBadge source={a.secretSource} />
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span>Channel Access Token</span>
                  <SourceBadge source={a.tokenSource} />
                </div>
                {a.credentialsUpdatedAt && <p className="text-xs text-muted-foreground sm:col-span-2">อัปเดตล่าสุด {formatDateTime(a.credentialsUpdatedAt, timezone)}</p>}
              </div>
              {canManage ? (
                <>
                  <Field label="Channel ID" htmlFor="channel-id" error={errors.channelId} hint={a.channelId ? `ปัจจุบัน: ${a.channelId}` : "ไม่บังคับ — ใช้สำหรับอ้างอิง"}>
                    <Input id="channel-id" inputMode="numeric" value={form.channelId} onChange={(e) => setForm((f) => ({ ...f, channelId: e.target.value }))} placeholder={a.channelId ?? "เช่น 1234567890"} />
                  </Field>
                  <Field
                    label="Channel Secret"
                    htmlFor="channel-secret"
                    error={errors.channelSecret}
                    hint={a.secretSource === "env" ? "กำหนดผ่าน Environment Variable (LINE_CHANNEL_SECRET) — ค่านี้มีลำดับความสำคัญสูงกว่า" : "ใช้ตรวจสอบ X-Line-Signature ของ Webhook"}
                  >
                    <Input
                      id="channel-secret"
                      type="password"
                      autoComplete="off"
                      value={form.channelSecret}
                      onChange={(e) => setForm((f) => ({ ...f, channelSecret: e.target.value }))}
                      placeholder={a.hasChannelSecret ? "•••••••••••• (ตั้งค่าแล้ว — กรอกเพื่อเปลี่ยน)" : "กรอก Channel Secret 32 ตัวอักษร"}
                    />
                  </Field>
                  <Field
                    label="Channel Access Token (long-lived)"
                    htmlFor="channel-token"
                    error={errors.channelAccessToken}
                    hint={a.tokenSource === "env" ? "กำหนดผ่าน Environment Variable (LINE_CHANNEL_ACCESS_TOKEN)" : "ใช้เรียก Messaging API สำหรับตอบกลับและส่งข้อความ"}
                  >
                    <Textarea
                      id="channel-token"
                      rows={3}
                      autoComplete="off"
                      spellCheck={false}
                      className="font-mono text-xs [-webkit-text-security:disc]"
                      value={form.channelAccessToken}
                      onChange={(e) => setForm((f) => ({ ...f, channelAccessToken: e.target.value }))}
                      placeholder={a.hasChannelAccessToken ? "•••••••••••• (ตั้งค่าแล้ว — กรอกเพื่อเปลี่ยน)" : "วาง Channel Access Token"}
                    />
                  </Field>
                  <div className="flex flex-wrap gap-2">
                    <Button onClick={saveCredentials} disabled={busy !== null}>
                      {busy === "save" ? <Loader2 className="animate-spin" /> : <Save />} บันทึก Credentials
                    </Button>
                    {(a.secretSource === "database" || a.tokenSource === "database") && (
                      <Button variant="ghost" className="text-destructive hover:text-destructive" onClick={() => setClearOpen(true)}>
                        <Trash2 /> ลบ Credentials
                      </Button>
                    )}
                  </div>
                </>
              ) : (
                <p className="flex items-center gap-2 text-sm text-muted-foreground"><ShieldCheck className="size-4" /> เฉพาะเจ้าของระบบ (OWNER) เท่านั้นที่แก้ไข Credentials ได้</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Webhook className="size-4 text-primary" /> Webhook</CardTitle>
              <CardDescription>LINE จะส่ง Event มาที่ URL นี้ (ต้องเป็น HTTPS)</CardDescription>
              <CardAction>
                <Button variant="ghost" size="icon-sm" onClick={() => webhook.refetch()} aria-label="รีเฟรช"><RefreshCw className={webhook.isFetching ? "animate-spin" : ""} /></Button>
              </CardAction>
            </CardHeader>
            <CardContent className="grid gap-4">
              <Field label="Webhook URL">
                <div className="flex gap-2">
                  <Input readOnly value={a.webhookUrl ?? "ยังไม่ได้ตั้งค่า APP_URL"} className="font-mono text-xs" />
                  <Button
                    variant="outline"
                    size="icon"
                    disabled={!a.webhookUrl}
                    onClick={() => a.webhookUrl && navigator.clipboard?.writeText(a.webhookUrl).then(() => toast.success("คัดลอก Webhook URL แล้ว"))}
                    aria-label="คัดลอก"
                  >
                    <Copy />
                  </Button>
                </div>
              </Field>
              {!httpsOk && (
                <p className="flex items-start gap-2 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
                  <CircleAlert className="mt-0.5 size-4 shrink-0" /> ตั้งค่า APP_URL เป็นโดเมน HTTPS จริงใน Environment (เช่น https://bot.example.com) เพื่อให้ LINE ส่ง Webhook ได้
                </p>
              )}
              {webhook.data && (
                <div className="rounded-lg border p-3 text-sm">
                  <p className="text-xs text-muted-foreground">ค่าที่ตั้งไว้ใน LINE Platform</p>
                  {webhook.data.error ? (
                    <p className="mt-1 text-destructive">{webhook.data.error}</p>
                  ) : (
                    <div className="mt-1 space-y-1">
                      <p className="font-mono text-xs break-all">{webhook.data.configured || "-"}</p>
                      <div className="flex flex-wrap gap-2">
                        {webhook.data.matches ? <Badge variant="success"><CheckCircle2 /> ตรงกับระบบนี้</Badge> : <Badge variant="warning"><CircleAlert /> ไม่ตรงกับระบบนี้</Badge>}
                        {webhook.data.active ? <Badge variant="success">Use webhook: เปิด</Badge> : <Badge variant="destructive">Use webhook: ปิด</Badge>}
                      </div>
                    </div>
                  )}
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                {canManage && (
                  <Button variant="outline" onClick={setWebhook} disabled={busy !== null || !a.hasChannelAccessToken || !httpsOk}>
                    {busy === "webhook" ? <Loader2 className="animate-spin" /> : <Webhook />} ตั้งค่า Webhook URL ไปยัง LINE
                  </Button>
                )}
                <Button variant="outline" onClick={testWebhook} disabled={busy !== null || !a.hasChannelAccessToken}>
                  {busy === "webhook-test" ? <Loader2 className="animate-spin" /> : <Send />} ทดสอบ Webhook
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Webhook ล่าสุดที่ได้รับ: {a.lastWebhookAt ? formatDateTime(a.lastWebhookAt, timezone) : "ยังไม่เคยได้รับ"} · แนะนำให้เปิด “Webhook redelivery” ใน LINE Developers Console
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>สถานะการเชื่อมต่อ</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <CustomerAvatar name={a.displayName ?? "LINE"} pictureUrl={a.pictureUrl} className="size-14" />
                <div className="min-w-0">
                  <p className="truncate font-semibold">{a.displayName ?? "ยังไม่ทราบชื่อบัญชี"}</p>
                  <p className="text-sm text-muted-foreground">{a.basicId ?? "-"}</p>
                </div>
              </div>
              {a.connectionStatus === "CONNECTED" ? (
                <Badge variant="success"><CheckCircle2 /> เชื่อมต่อแล้ว</Badge>
              ) : a.connectionStatus === "FAILED" ? (
                <Badge variant="destructive"><XCircle /> เชื่อมต่อไม่สำเร็จ</Badge>
              ) : (
                <Badge variant="muted"><CircleAlert /> ยังไม่ได้ทดสอบ</Badge>
              )}
              {a.connectionError && <p className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">{a.connectionError}</p>}
              <dl className="grid gap-2 text-sm">
                <div className="flex justify-between gap-2"><dt className="text-muted-foreground">ตรวจสอบล่าสุด</dt><dd>{formatDateTime(a.lastVerifiedAt, timezone)}</dd></div>
                <div className="flex justify-between gap-2"><dt className="text-muted-foreground">Bot User ID</dt><dd className="truncate font-mono text-xs">{a.botUserId ?? "-"}</dd></div>
              </dl>
            </CardContent>
          </Card>
          {quota.data && (
            <Card>
              <CardHeader>
                <CardTitle>โควตาข้อความเดือนนี้</CardTitle>
                <CardDescription>Push Message (การตอบกลับด้วย Reply API ไม่นับโควตา)</CardDescription>
              </CardHeader>
              <CardContent>
                {quota.data.available ? (
                  <div className="space-y-2">
                    <p className="text-2xl font-semibold tabular-nums">
                      {formatNumber(quota.data.used ?? 0)}
                      <span className="text-base font-normal text-muted-foreground"> / {quota.data.type === "limited" ? formatNumber(quota.data.limit ?? 0) : "ไม่จำกัด"}</span>
                    </p>
                    {quota.data.type === "limited" && quota.data.limit ? (
                      <div className="h-2 overflow-hidden rounded-full bg-gray-100">
                        <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, ((quota.data.used ?? 0) / quota.data.limit) * 100)}%` }} />
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">{quota.data.error}</p>
                )}
              </CardContent>
            </Card>
          )}
          <Card>
            <CardHeader>
              <CardTitle>ขั้นตอนการตั้งค่า</CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
                <li>สร้าง Messaging API channel ที่ LINE Developers Console</li>
                <li>คัดลอก Channel Secret (แท็บ Basic settings)</li>
                <li>ออก Channel Access Token (long-lived) ที่แท็บ Messaging API</li>
                <li>บันทึกค่าในหน้านี้ แล้วกด “ทดสอบการเชื่อมต่อ”</li>
                <li>กด “ตั้งค่า Webhook URL ไปยัง LINE” และเปิด Use webhook</li>
                <li>ปิด Auto-reply messages / Greeting ของ LINE OA Manager เพื่อไม่ให้ตอบซ้ำ</li>
              </ol>
            </CardContent>
          </Card>
        </div>
      </div>
      <ConfirmDialog
        open={clearOpen}
        onOpenChange={setClearOpen}
        title="ลบ LINE Credentials"
        description="ระบบจะไม่สามารถรับ Webhook และตอบกลับข้อความได้จนกว่าจะตั้งค่าใหม่ (ค่าจาก Environment ไม่ได้รับผลกระทบ)"
        confirmLabel="ลบ"
        destructive
        loading={busy === "clear"}
        onConfirm={clearCredentials}
      />
    </>
  );
}
