"use client";

import { useState } from "react";
import {
  Bot,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  CircleAlert,
  Copy,
  ExternalLink,
  Eye,
  EyeOff,
  FlaskConical,
  Info,
  Lightbulb,
  Loader2,
  MessagesSquare,
  MinusCircle,
  PlugZap,
  RefreshCw,
  Send,
  Smartphone,
  Trash2,
  Webhook,
  XCircle,
} from "lucide-react";
import { openTestChat } from "@/components/test-chat/test-chat-widget";
import Link from "next/link";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/common/page-header";
import { Field } from "@/components/common/field";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { CustomerAvatar } from "@/components/common/customer-avatar";
import { ErrorState, LoadingState } from "@/components/common/states";
import { LineTextBubble } from "@/components/text-messages/line-text-bubble";
import { ChatBackdrop, FlexPreview } from "@/components/flex/flex-preview";
import { renderFlexVariables } from "@/lib/flex/render";
import { buildTemplateValues, renderTemplate } from "@/lib/templates/variables";
import { apiFetch, ApiClientError, useApiQuery } from "@/hooks/use-api";
import { useAppContext, useCan, useProjectPath, useProject } from "@/hooks/use-app-context";
import { formatDateTime, formatNumber, formatRelative } from "@/lib/format";
import { cn } from "@/lib/utils";

const OA_MANAGER_URL = "https://manager.line.biz/";
const DEVELOPERS_CONSOLE_URL = "https://developers.line.biz/console/";

type Source = "env" | "database" | null;

type Account = {
  id: string;
  name: string;
  channelId: string | null;
  channelIdSource: Source;
  botUserId: string | null;
  basicId: string | null;
  displayName: string | null;
  pictureUrl: string | null;
  hasChannelSecret: boolean;
  hasChannelAccessToken: boolean;
  canConnect: boolean;
  secretSource: Source;
  tokenSource: "env" | "database" | "stateless" | null;
  addFriendUrl: string | null;
  credentialsUpdatedAt: string | null;
  connectionStatus: "UNKNOWN" | "CONNECTED" | "FAILED";
  connectionError: string | null;
  lastVerifiedAt: string | null;
  lastWebhookAt: string | null;
  webhookUrl: string | null;
  legacyWebhookUrl: string | null;
  isDefault: boolean;
  lastInbound: { at: string; text: string | null; type: string } | null;
};

type WebhookInfo = { expected: string | null; configured: string | null; active: boolean; matches?: boolean; error: string | null };
type Quota = { available: boolean; type?: string; limit?: number | null; used?: number; error?: string };
type ConnectStep = { key: string; label: string; status: "success" | "failed" | "warning" | "skipped"; message: string; hint?: string };
type TestRuleStatus = {
  rules: { text: { id: string; isActive: boolean } | null; flex: { id: string; isActive: boolean } | null };
  text: { ruleName: string; keywords: string[]; reply: string };
  flex: { ruleName: string; keywords: string[]; altText: string; contents: Record<string, unknown> };
  autoReplyEnabled: boolean;
};
const TEST_RULE_LABEL = "ทดสอบระบบ (พิมพ์ test)";
const TEST_FLEX_RULE_LABEL = "ทดสอบ Flex (พิมพ์ TestFlex)";

type ConnectResult = { ok: boolean; steps: ConnectStep[]; webhookActive?: boolean | null; account: Account };

// ───────────────────────── ส่วนประกอบย่อย ─────────────────────────

function StepCard({
  number,
  title,
  subtitle,
  done,
  children,
}: {
  number: number;
  title: string;
  subtitle?: string;
  done: boolean;
  children: React.ReactNode;
}) {
  return (
    <Card className={cn("gap-4", done && "border-emerald-200 dark:border-emerald-500/30")}>
      <CardHeader className="grid-cols-[auto_1fr] items-start gap-x-3">
        <span
          className={cn(
            "row-span-2 flex size-9 items-center justify-center rounded-full text-sm font-bold",
            done ? "bg-emerald-500 text-white" : "bg-accent text-primary",
          )}
        >
          {done ? <CheckCircle2 className="size-5" /> : number}
        </span>
        <CardTitle className="flex flex-wrap items-center gap-2 text-base">
          ขั้นตอนที่ {number}: {title}
          {done && <Badge variant="success">เสร็จแล้ว</Badge>}
        </CardTitle>
        {subtitle && <CardDescription className="col-start-2">{subtitle}</CardDescription>}
      </CardHeader>
      <CardContent className="space-y-4 text-sm">{children}</CardContent>
    </Card>
  );
}

function Steps({ children }: { children: React.ReactNode }) {
  return <ol className="list-decimal space-y-2 pl-5 marker:font-semibold marker:text-primary">{children}</ol>;
}

function Ui({ children }: { children: React.ReactNode }) {
  // ชื่อปุ่ม/เมนูบนหน้าจอ LINE
  return <span className="rounded bg-gray-100 dark:bg-white/10 px-1.5 py-0.5 font-medium text-gray-900 dark:text-gray-100">{children}</span>;
}

function Tip({ children, tone = "info" }: { children: React.ReactNode; tone?: "info" | "warn" }) {
  return (
    <div
      className={cn(
        "flex gap-2 rounded-lg px-3 py-2.5",
        tone === "info" ? "bg-blue-50 dark:bg-blue-500/15 text-blue-900 dark:text-blue-200" : "bg-amber-50 dark:bg-amber-500/15 text-amber-900 dark:text-amber-200",
      )}
    >
      {tone === "info" ? <Lightbulb className="mt-0.5 size-4 shrink-0" /> : <AlertTriangle className="mt-0.5 size-4 shrink-0" />}
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function ExternalButton({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Button asChild variant="outline" size="sm">
      <a href={href} target="_blank" rel="noopener noreferrer">
        {children} <ExternalLink className="size-3.5" />
      </a>
    </Button>
  );
}

function StepResultIcon({ status }: { status: ConnectStep["status"] }) {
  if (status === "success") return <CheckCircle2 className="size-5 shrink-0 text-emerald-600 dark:text-emerald-400" />;
  if (status === "failed") return <XCircle className="size-5 shrink-0 text-red-600 dark:text-red-400" />;
  if (status === "warning") return <AlertTriangle className="size-5 shrink-0 text-amber-600 dark:text-amber-300" />;
  return <MinusCircle className="size-5 shrink-0 text-gray-400 dark:text-gray-500" />;
}

function copy(text: string, label: string) {
  navigator.clipboard?.writeText(text).then(() => toast.success(`คัดลอก${label}แล้ว`));
}

// ───────────────────────── หน้าหลัก ─────────────────────────

export function LineSettingsView() {
  const projectPath = useProjectPath();
  const project = useProject();
  const { timezone } = useAppContext();
  const canManage = useCan("line:manage");
  const qc = useQueryClient();
  const account = useApiQuery<Account>(["line-account"], "/api/line/account", { refetchInterval: 8_000 });
  const connected = account.data?.connectionStatus === "CONNECTED";
  const webhook = useApiQuery<WebhookInfo>(["line-webhook"], "/api/line/webhook", { enabled: connected });
  const quota = useApiQuery<Quota>(["line-quota"], "/api/line/quota", { enabled: connected });
  const testRule = useApiQuery<TestRuleStatus>(["line-test-rule"], "/api/line/test-rule");
  const canManageRules = useCan("rules:manage");
  const testRulesReady = Boolean(testRule.data?.rules.text?.isActive && testRule.data?.rules.flex?.isActive);
  const sampleValues = buildTemplateValues({ displayName: "ชื่อของคุณ", userId: "U...", timezone });

  const [form, setForm] = useState({ channelId: "", channelSecret: "", channelAccessToken: "" });
  const [showSecret, setShowSecret] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [connecting, setConnecting] = useState(false);
  const [result, setResult] = useState<ConnectResult | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [clearOpen, setClearOpen] = useState<null | "token" | "all">(null);

  const refreshAll = () =>
    Promise.all(
      [["line-account"], ["line-webhook"], ["line-quota"]].map((queryKey) => qc.invalidateQueries({ queryKey })),
    );

  // ตรวจรูปแบบเบื้องต้นก่อนส่ง (ช่วยจับการคัดลอกไม่ครบ / มีช่องว่าง)
  const clientErrors: Record<string, string> = {};
  const idTrim = form.channelId.trim();
  const secretTrim = form.channelSecret.trim();
  if (idTrim && !/^\d{5,20}$/.test(idTrim)) clientErrors.channelId = "Channel ID ต้องเป็นตัวเลขเท่านั้น (ประมาณ 10 หลัก)";
  if (secretTrim && !/^[0-9a-fA-F]{32}$/.test(secretTrim)) {
    clientErrors.channelSecret = `Channel secret ต้องเป็นตัวอักษร a-f และตัวเลข 32 ตัว (ตอนนี้ ${secretTrim.length} ตัว) — ตรวจว่าคัดลอกมาครบ`;
  }

  const connect = async () => {
    if (Object.keys(clientErrors).length) return toast.error("กรุณาตรวจสอบข้อมูลที่กรอก");
    setConnecting(true);
    setErrors({});
    setResult(null);
    try {
      const body: Record<string, string> = {};
      if (idTrim) body.channelId = idTrim;
      if (secretTrim) body.channelSecret = secretTrim;
      if (form.channelAccessToken.trim()) body.channelAccessToken = form.channelAccessToken.trim();
      const r = await apiFetch<ConnectResult>("/api/line/connect", { method: "POST", body });
      setResult(r);
      setForm({ channelId: "", channelSecret: "", channelAccessToken: "" });
      if (r.ok) toast.success("เชื่อมต่อ LINE OA สำเร็จ");
      else toast.error("ยังเชื่อมต่อไม่สำเร็จ — ดูรายละเอียดในขั้นตอนที่ 3");
      await refreshAll();
    } catch (err) {
      if (err instanceof ApiClientError) {
        setErrors(err.fieldErrors);
        toast.error(err.message);
      }
    } finally {
      setConnecting(false);
    }
  };

  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(key);
    try {
      await fn();
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "ดำเนินการไม่สำเร็จ");
    } finally {
      setBusy(null);
    }
  };

  const recheckWebhook = () =>
    run("recheck", async () => {
      const r = await webhook.refetch();
      if (r.data?.active) toast.success("Webhook เปิดใช้งานแล้ว");
      else toast.warning("Webhook ยังปิดอยู่ — ทำตามขั้นตอนที่ 4");
    });

  const testWebhook = () =>
    run("webhook-test", async () => {
      const r = await apiFetch<{ ok: boolean; message: string }>("/api/line/webhook/test", { method: "POST" });
      if (r.ok) toast.success(r.message);
      else toast.error(r.message);
      await refreshAll();
    });

  const createTestRule = () =>
    run("test-rule", async () => {
      const r = await apiFetch<TestRuleStatus & { created: boolean }>("/api/line/test-rule", { method: "POST" });
      toast.success(r.created ? "สร้างกฎทดสอบแล้ว — ลองพิมพ์ test หรือ TestFlex ส่งหา LINE OA ได้เลย" : "เปิดใช้งานกฎทดสอบแล้ว");
      await Promise.all(
        [["line-test-rule"], ["rules"], ["flex-templates"], ["text-templates"]].map((queryKey) => qc.invalidateQueries({ queryKey })),
      );
    });

  const clearCredentials = (which: "token" | "all") =>
    run("clear", async () => {
      await apiFetch(`/api/line/credentials?which=${which}`, { method: "DELETE" });
      toast.success(which === "token" ? "ลบ token แล้ว — ระบบจะขอ token ให้อัตโนมัติ" : "ลบข้อมูลการเชื่อมต่อแล้ว");
      setClearOpen(null);
      setResult(null);
      await refreshAll();
    });

  if (account.error) return <ErrorState message={account.error.message} onRetry={() => account.refetch()} />;
  if (account.isLoading || !account.data) return <LoadingState />;
  const a = account.data;

  const webhookActive = result?.webhookActive ?? webhook.data?.active ?? null;
  const done = {
    1: a.canConnect || connected,
    2: a.canConnect,
    3: connected,
    4: webhookActive === true,
    5: Boolean(a.lastInbound),
  };
  const doneCount = Object.values(done).filter(Boolean).length;
  const httpsReady = Boolean(a.webhookUrl?.startsWith("https://"));
  const fromEnv = (s: Source) => s === "env";

  return (
    <>
      <PageHeader
        title="เชื่อมต่อ LINE OA"
        description={`โปรเจกต์ “${project.name}” เชื่อมต่อ LINE OA ได้ 1 บัญชี — ทำตาม 5 ขั้นตอนด้านล่างครั้งเดียว ใช้เวลาประมาณ 5 นาที ระบบจะทำส่วนที่ยุ่งยากให้อัตโนมัติ`}
      />

      {/* ─── สรุปสถานะ ─── */}
      <Card className="mb-4 py-4">
        <CardContent className="flex flex-col gap-4 px-4 sm:flex-row sm:items-center">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <CustomerAvatar name={a.displayName ?? "LINE"} pictureUrl={a.pictureUrl} className="size-12" />
            <div className="min-w-0">
              <p className="truncate font-semibold">{a.displayName ?? "ยังไม่ได้เชื่อมต่อบัญชี LINE OA"}</p>
              <p className="text-sm text-muted-foreground">{a.basicId ?? "ทำตามขั้นตอนด้านล่างเพื่อเริ่มต้น"}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {connected ? (
              <Badge variant="success"><CheckCircle2 /> เชื่อมต่อแล้ว</Badge>
            ) : a.connectionStatus === "FAILED" ? (
              <Badge variant="destructive"><XCircle /> เชื่อมต่อไม่สำเร็จ</Badge>
            ) : (
              <Badge variant="muted"><CircleAlert /> ยังไม่ได้เชื่อมต่อ</Badge>
            )}
            <span className="text-sm text-muted-foreground">ทำแล้ว {doneCount}/5 ขั้นตอน</span>
          </div>
        </CardContent>
        <div className="mx-4 h-2 overflow-hidden rounded-full bg-gray-100 dark:bg-white/10">
          <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${(doneCount / 5) * 100}%` }} />
        </div>
      </Card>

      {!canManage && (
        <Tip tone="warn">
          <p>บัญชีของคุณดูข้อมูลได้อย่างเดียว เฉพาะ<strong>เจ้าของระบบ (OWNER)</strong> เท่านั้นที่กรอกข้อมูลและกดเชื่อมต่อได้</p>
        </Tip>
      )}

      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-4">
          {/* ─── ขั้นตอนที่ 1 ─── */}
          <StepCard
            number={1}
            title="เปิดใช้ Messaging API ใน LINE Official Account Manager"
            subtitle="เพื่ออนุญาตให้ระบบนี้รับและตอบข้อความแทน LINE OA ของคุณ"
            done={done[1]}
          >
            <Steps>
              <li>
                เปิดเว็บ <strong>LINE Official Account Manager</strong> แล้วเข้าสู่ระบบด้วยบัญชี LINE ที่เป็นผู้ดูแล OA{" "}
                <span className="mt-1 block"><ExternalButton href={OA_MANAGER_URL}>เปิด LINE OA Manager</ExternalButton></span>
              </li>
              <li>คลิกเลือกบัญชี LINE OA ที่ต้องการเชื่อมต่อ</li>
              <li>กด <Ui>ตั้งค่า</Ui> (Settings) ที่มุมขวาบนของหน้า</li>
              <li>ที่เมนูด้านซ้าย เลือก <Ui>Messaging API</Ui></li>
              <li>กดปุ่ม <Ui>เปิดใช้ Messaging API</Ui> (Enable Messaging API)</li>
              <li>
                ระบบจะให้เลือก <strong>Provider</strong> (ผู้ให้บริการ) — ถ้ายังไม่เคยสร้าง ให้เลือก <Ui>สร้าง Provider ใหม่</Ui> แล้วตั้งชื่ออะไรก็ได้ เช่น
                ชื่อร้านของคุณ จากนั้นกด <Ui>ตกลง</Ui>
              </li>
              <li>ช่อง Privacy policy และ Terms of use <strong>เว้นว่างได้</strong> กด <Ui>ตกลง</Ui> เพื่อยืนยัน</li>
            </Steps>
            <Tip>
              <p>ถ้าหน้า Messaging API แสดงสถานะ <strong>“ใช้งานอยู่”</strong> (In use) แปลว่าเคยเปิดไว้แล้ว ข้ามไปขั้นตอนที่ 2 ได้เลย</p>
              <p>ชื่อเมนูอาจเป็นภาษาอังกฤษ ขึ้นกับภาษาที่ตั้งไว้ในบัญชี LINE (มีชื่อภาษาอังกฤษในวงเล็บให้แล้ว)</p>
            </Tip>
          </StepCard>

          {/* ─── ขั้นตอนที่ 2 ─── */}
          <StepCard
            number={2}
            title="คัดลอก Channel ID และ Channel secret มาวาง"
            subtitle="ใช้แค่ 2 ค่านี้ ไม่ต้องออก Access token เอง — ระบบจะขอจาก LINE ให้อัตโนมัติ"
            done={done[2]}
          >
            <Steps>
              <li>
                อยู่ที่หน้า <Ui>Messaging API</Ui> เดิมจากขั้นตอนที่ 1 จะเห็นข้อมูล 2 ค่า:
                <ul className="mt-1.5 list-disc space-y-1 pl-5 text-muted-foreground">
                  <li><strong className="text-foreground">Channel ID</strong> — ตัวเลขประมาณ 10 หลัก เช่น 1234567890</li>
                  <li><strong className="text-foreground">Channel secret</strong> — ตัวอักษรภาษาอังกฤษผสมตัวเลข 32 ตัว</li>
                </ul>
              </li>
              <li>กดไอคอน <Ui>คัดลอก</Ui> ข้างแต่ละค่า แล้วนำมาวางในช่องด้านล่าง (ระวังอย่าให้มีช่องว่างหรือขาดตัวอักษร)</li>
            </Steps>
            <Tip>
              <p>
                หาไม่เจอ? เปิด <a className="font-medium underline" href={DEVELOPERS_CONSOLE_URL} target="_blank" rel="noopener noreferrer">LINE Developers Console</a> →
                เลือก Provider ที่สร้างไว้ → เลือก Channel ที่มีชื่อเดียวกับ LINE OA → แท็บ <Ui>Basic settings</Ui> จะมีทั้ง Channel ID และ Channel secret
              </p>
              <p>Channel secret เป็นข้อมูลลับ ห้ามส่งให้คนอื่น — ระบบจะเข้ารหัสก่อนบันทึก และจะไม่แสดงค่ากลับมาให้เห็นอีก</p>
            </Tip>

            <div className="grid gap-4 md:grid-cols-2">
              <Field
                label="Channel ID"
                htmlFor="channel-id"
                error={clientErrors.channelId ?? errors.channelId}
                hint={
                  fromEnv(a.channelIdSource)
                    ? "กำหนดไว้ใน Environment Variable (LINE_CHANNEL_ID)"
                    : a.channelId
                      ? `บันทึกไว้แล้ว: ${a.channelId}`
                      : undefined
                }
              >
                <Input
                  id="channel-id"
                  inputMode="numeric"
                  autoComplete="off"
                  disabled={!canManage || fromEnv(a.channelIdSource)}
                  value={form.channelId}
                  onChange={(e) => setForm((f) => ({ ...f, channelId: e.target.value }))}
                  placeholder={a.channelId ?? "เช่น 1234567890"}
                />
              </Field>
              <Field
                label="Channel secret"
                htmlFor="channel-secret"
                error={clientErrors.channelSecret ?? errors.channelSecret}
                hint={
                  fromEnv(a.secretSource)
                    ? "กำหนดไว้ใน Environment Variable (LINE_CHANNEL_SECRET)"
                    : a.hasChannelSecret
                      ? "บันทึกไว้แล้ว — กรอกเฉพาะเมื่อต้องการเปลี่ยน"
                      : undefined
                }
              >
                <div className="flex gap-1.5">
                  <Input
                    id="channel-secret"
                    type={showSecret ? "text" : "password"}
                    autoComplete="off"
                    spellCheck={false}
                    className="font-mono"
                    disabled={!canManage || fromEnv(a.secretSource)}
                    value={form.channelSecret}
                    onChange={(e) => setForm((f) => ({ ...f, channelSecret: e.target.value }))}
                    placeholder={a.hasChannelSecret ? "•••••••••••••••• (บันทึกไว้แล้ว)" : "วาง Channel secret 32 ตัว"}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => setShowSecret((v) => !v)}
                    aria-label={showSecret ? "ซ่อน" : "แสดง"}
                  >
                    {showSecret ? <EyeOff /> : <Eye />}
                  </Button>
                </div>
              </Field>
            </div>

            <div className="rounded-lg border">
              <button
                type="button"
                className="flex w-full items-center justify-between px-3 py-2.5 text-left text-sm font-medium"
                onClick={() => setShowAdvanced((v) => !v)}
              >
                ตัวเลือกขั้นสูง: ใช้ Channel access token ของตัวเอง (ไม่จำเป็น)
                <ChevronDown className={cn("size-4 transition-transform", showAdvanced && "rotate-180")} />
              </button>
              {showAdvanced && (
                <div className="space-y-3 border-t px-3 py-3">
                  <p className="text-muted-foreground">
                    ปกติ<strong>ไม่ต้องกรอก</strong> — ระบบจะขอ Access token อายุ 15 นาทีจาก LINE ให้อัตโนมัติและต่ออายุเอง กรอกเฉพาะกรณีที่ต้องการใช้
                    token แบบ long-lived ที่ออกจากแท็บ <Ui>Messaging API</Ui> ใน LINE Developers Console
                  </p>
                  <Field label="Channel access token (long-lived)" htmlFor="channel-token" error={errors.channelAccessToken}>
                    <Textarea
                      id="channel-token"
                      rows={3}
                      autoComplete="off"
                      spellCheck={false}
                      className="font-mono text-xs [-webkit-text-security:disc]"
                      disabled={!canManage || a.tokenSource === "env"}
                      value={form.channelAccessToken}
                      onChange={(e) => setForm((f) => ({ ...f, channelAccessToken: e.target.value }))}
                      placeholder={a.hasChannelAccessToken ? "•••••••••••• (บันทึกไว้แล้ว)" : "เว้นว่างไว้ได้"}
                    />
                  </Field>
                  <p className="text-xs text-muted-foreground">
                    ตอนนี้ใช้:{" "}
                    <strong>
                      {a.tokenSource === "env"
                        ? "token จาก Environment Variable"
                        : a.tokenSource === "database"
                          ? "token ที่กรอกไว้ (long-lived)"
                          : a.tokenSource === "stateless"
                            ? "ขอ token อัตโนมัติ"
                            : "ยังไม่มี (กรอก Channel ID และ Channel secret)"}
                    </strong>
                  </p>
                  {canManage && a.tokenSource === "database" && (
                    <Button variant="outline" size="sm" onClick={() => setClearOpen("token")} disabled={busy !== null}>
                      <Trash2 /> ลบ token และให้ระบบขอให้อัตโนมัติ
                    </Button>
                  )}
                </div>
              )}
            </div>
          </StepCard>

          {/* ─── ขั้นตอนที่ 3 ─── */}
          <StepCard
            number={3}
            title="กดปุ่มเชื่อมต่อ"
            subtitle="ระบบจะตั้งค่าที่เหลือให้ทั้งหมด ไม่ต้องคัดลอก Webhook URL ไปวางเอง"
            done={done[3]}
          >
            <p>เมื่อกดปุ่ม ระบบจะทำให้อัตโนมัติตามลำดับ:</p>
            <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
              <li>บันทึก Channel ID / Channel secret (เข้ารหัส)</li>
              <li>ขอสิทธิ์เข้าใช้ (Access token) จาก LINE</li>
              <li>ตรวจสอบบัญชี LINE OA</li>
              <li>ตั้งค่า Webhook URL ที่ LINE ให้ส่งข้อความลูกค้ามาที่ระบบนี้</li>
              <li>ให้ LINE ทดสอบส่งข้อความมาหาระบบ</li>
              <li>ตรวจว่าเปิด Webhook แล้วหรือยัง</li>
            </ul>
            {!httpsReady && (
              <Tip tone="warn">
                <p>
                  ระบบยังไม่มี URL แบบ <strong>https://</strong> — LINE จะส่งข้อความมาไม่ได้ ถ้าใช้ Vercel ระบบตั้งให้อัตโนมัติ ถ้าติดตั้งเองให้ตั้งค่า
                  <code className="mx-1">APP_URL</code>
                </p>
              </Tip>
            )}
            {canManage && (
              <Button size="lg" className="w-full sm:w-auto" onClick={connect} disabled={connecting || (!a.canConnect && !(idTrim || secretTrim))}>
                {connecting ? <Loader2 className="animate-spin" /> : <PlugZap />}
                {connecting ? "กำลังเชื่อมต่อ..." : connected ? "เชื่อมต่อใหม่ / ตรวจสอบอีกครั้ง" : "เชื่อมต่อ LINE OA"}
              </Button>
            )}
            {result && (
              <ul className="space-y-2 rounded-lg border p-3">
                {result.steps.map((s) => (
                  <li key={s.key} className="flex gap-2.5">
                    <StepResultIcon status={s.status} />
                    <div className="min-w-0">
                      <p className="font-medium">{s.label}</p>
                      <p className="break-words text-muted-foreground">{s.message}</p>
                      {s.hint && <p className="mt-0.5 text-amber-700 dark:text-amber-300">วิธีแก้: {s.hint}</p>}
                    </div>
                  </li>
                ))}
              </ul>
            )}
            {!result && a.connectionStatus === "FAILED" && a.connectionError && (
              <p className="rounded-md bg-red-50 dark:bg-red-500/15 px-3 py-2 text-red-700 dark:text-red-300">ครั้งล่าสุดเชื่อมต่อไม่สำเร็จ: {a.connectionError}</p>
            )}
          </StepCard>

          {/* ─── ขั้นตอนที่ 4 ─── */}
          <StepCard
            number={4}
            title="ตั้งค่าการตอบกลับใน LINE Official Account Manager"
            subtitle="ส่วนนี้ LINE ไม่เปิดให้ระบบภายนอกตั้งค่าแทน ต้องกดเอง 2-3 สวิตช์"
            done={done[4]}
          >
            <Steps>
              <li>
                กลับไปที่ <strong>LINE OA Manager</strong> → กด <Ui>ตั้งค่า</Ui> → เมนูด้านซ้ายเลือก <Ui>การตอบกลับ</Ui> (Response settings){" "}
                <span className="mt-1 block"><ExternalButton href={OA_MANAGER_URL}>เปิด LINE OA Manager</ExternalButton></span>
              </li>
              <li>
                เปิดสวิตช์ <Ui>Webhook</Ui> ให้เป็น <strong>เปิด</strong>
                <span className="mt-1.5 flex flex-wrap items-center gap-2">
                  {webhookActive === true ? (
                    <Badge variant="success"><CheckCircle2 /> LINE ยืนยันว่าเปิดแล้ว</Badge>
                  ) : webhookActive === false ? (
                    <Badge variant="warning"><AlertTriangle /> ยังปิดอยู่</Badge>
                  ) : (
                    <Badge variant="muted">ยังตรวจสอบไม่ได้ (ทำขั้นตอนที่ 3 ก่อน)</Badge>
                  )}
                  {connected && (
                    <Button variant="ghost" size="sm" onClick={recheckWebhook} disabled={busy !== null}>
                      {busy === "recheck" ? <Loader2 className="animate-spin" /> : <RefreshCw />} ตรวจสอบอีกครั้ง
                    </Button>
                  )}
                </span>
              </li>
              <li>
                ปิด <Ui>ข้อความตอบกลับอัตโนมัติ</Ui> (Auto-response messages) — ถ้าเปิดไว้ ลูกค้าจะได้คำตอบซ้ำ 2 ข้อความ (จาก LINE และจากระบบนี้)
              </li>
              <li>
                ปิด <Ui>ข้อความทักทาย</Ui> (Greeting message) — ระบบนี้มีกฎ “ต้อนรับเพื่อนใหม่” ส่งข้อความทักทายให้แล้ว (ถ้าอยากใช้ข้อความทักทายของ LINE
                แทน ให้เปิดไว้และปิดกฎนั้นในหน้า “ระบบตอบกลับอัตโนมัติ”)
              </li>
              <li>
                สวิตช์ <Ui>แชท</Ui> (Chat) จะเปิดหรือปิดก็ได้ — ถ้าเปิดไว้ แอดมินยังตอบลูกค้าผ่านแอป LINE OA ได้ตามปกติควบคู่กับระบบนี้
              </li>
            </Steps>
            <Tip>
              <p>ข้อ 3-4 LINE ไม่เปิดให้ระบบภายนอกตรวจสอบ กรุณาตรวจด้วยตัวเองว่าปิดแล้ว</p>
            </Tip>
          </StepCard>

          {/* ─── ขั้นตอนที่ 5 ─── */}
          <StepCard number={5} title="ทดสอบส่งข้อความจริง" subtitle="ยืนยันว่าลูกค้าส่งข้อความแล้วได้รับคำตอบอัตโนมัติ" done={done[5]}>
            <Steps>
              <li>
                ใช้มือถือ เพิ่ม LINE OA ของคุณเป็นเพื่อน
                <span className="mt-1.5 flex flex-wrap items-center gap-2">
                  {a.addFriendUrl ? (
                    <ExternalButton href={a.addFriendUrl}>
                      <Smartphone className="size-4" /> เปิดลิงก์เพิ่มเพื่อน
                    </ExternalButton>
                  ) : null}
                  {a.basicId && (
                    <Button variant="ghost" size="sm" onClick={() => copy(a.basicId!, " LINE ID")}>
                      <Copy /> {a.basicId}
                    </Button>
                  )}
                </span>
                <span className="mt-1 block text-muted-foreground">
                  เปิดลิงก์บนมือถือ หรือค้นหา ID <strong>{a.basicId ?? "@..."}</strong> ในแอป LINE (เมนู เพิ่มเพื่อน → ค้นหา)
                </span>
              </li>
              <li>
                สร้างกฎทดสอบ: กดปุ่มด้านล่าง ระบบจะสร้างกฎให้ 2 กฎ (กดซ้ำได้ ไม่สร้างซ้ำ)
                <ul className="mt-1.5 list-disc space-y-1 pl-5 text-muted-foreground">
                  <li>
                    <strong className="text-foreground">“{TEST_RULE_LABEL}”</strong> — พิมพ์ <Ui>test</Ui> หรือ <Ui>ทดสอบ</Ui> → ตอบเป็นข้อความธรรมดา
                    (Text Message)
                  </li>
                  <li>
                    <strong className="text-foreground">“{TEST_FLEX_RULE_LABEL}”</strong> — พิมพ์ <Ui>TestFlex</Ui> → ตอบเป็นการ์ด Flex Message ชื่อ
                    “TestFlex”
                  </li>
                </ul>
                <span className="mt-1.5 flex flex-wrap items-center gap-2">
                  {testRulesReady ? (
                    <Badge variant="success"><CheckCircle2 /> กฎทดสอบพร้อมใช้งานครบ 2 กฎ</Badge>
                  ) : testRule.data && (testRule.data.rules.text || testRule.data.rules.flex) ? (
                    <Badge variant="warning"><AlertTriangle /> กฎทดสอบยังไม่ครบหรือถูกปิดอยู่ — กดปุ่มเพื่อแก้</Badge>
                  ) : null}
                  {canManageRules && (
                    <Button size="sm" variant={testRulesReady ? "outline" : "default"} onClick={createTestRule} disabled={busy !== null}>
                      {busy === "test-rule" ? <Loader2 className="animate-spin" /> : <FlaskConical />}
                      {testRulesReady ? "สร้างกฎทดสอบใหม่อีกครั้ง" : "สร้างกฎทดสอบ"}
                    </Button>
                  )}
                </span>
              </li>
              <li>
                (ไม่บังคับ) ลองในเว็บก่อน: กดปุ่ม <Ui>แชททดสอบ</Ui> (ไอคอนหุ่นยนต์มุมขวาล่าง) แล้วพิมพ์ <Ui>test</Ui> หรือ <Ui>TestFlex</Ui>{" "}
                ระบบจะแสดงคำตอบที่ LINE OA จะส่ง และบอกว่าตรงกับกฎไหน โดยไม่ส่งข้อความถึง LINE จริง
                <span className="mt-1.5 flex">
                  <Button size="sm" variant="outline" onClick={openTestChat}>
                    <Bot /> เปิดแชททดสอบ
                  </Button>
                </span>
              </li>
              <li>
                พิมพ์ <Ui>test</Ui> ส่งหา LINE OA จากมือถือ ควรได้รับคำตอบภายในไม่กี่วินาที หน้าตาประมาณนี้:
                <ChatBackdrop className="mt-2 max-w-md">
                  <LineTextBubble text={renderTemplate(testRule.data?.text.reply ?? "", sampleValues)} />
                </ChatBackdrop>
              </li>
              <li>
                พิมพ์ <Ui>TestFlex</Ui> ควรได้รับการ์ด Flex Message แบบนี้ (กดปุ่มในการ์ดเพื่อทดสอบต่อได้):
                {testRule.data && (
                  <ChatBackdrop className="mt-2 max-w-md overflow-hidden">
                    <FlexPreview contents={renderFlexVariables(testRule.data.flex.contents, sampleValues)} />
                  </ChatBackdrop>
                )}
              </li>
              <li>ข้อความที่ลูกค้าส่งและคำตอบของระบบจะแสดงในหน้า “กล่องข้อความ”</li>
            </Steps>
            {testRule.data && !testRule.data.autoReplyEnabled && (
              <Tip tone="warn">
                <p>
                  ระบบตอบกลับอัตโนมัติ<strong>ถูกปิดอยู่</strong> — ลูกค้าจะไม่ได้รับคำตอบ เปิดได้ที่หน้า{" "}
                  <Link className="font-medium underline" href={projectPath("/settings")}>ตั้งค่าโปรเจกต์</Link> → ทั่วไป → เปิด/ปิด Auto Reply
                </p>
              </Tip>
            )}
            <Tip>
              <p>
                ทดสอบเสร็จแล้ว จะเก็บกฎไว้ ปิด หรือลบก็ได้ที่หน้า <Link className="font-medium underline" href={projectPath("/auto-reply")}>ระบบตอบกลับอัตโนมัติ</Link>{" "}
                (ชื่อกฎ “{TEST_RULE_LABEL}” และ “{TEST_FLEX_RULE_LABEL}”) ส่วนการ์ด TestFlex แก้หน้าตาได้ที่หน้า{" "}
                <Link className="font-medium underline" href={projectPath("/flex-builder")}>Flex Message Builder</Link>
              </p>
            </Tip>
            <div className="rounded-lg border p-3">
              {a.lastInbound ? (
                <p className="flex flex-wrap items-center gap-2">
                  <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400" />
                  ได้รับข้อความล่าสุดจากลูกค้า <strong>{formatRelative(a.lastInbound.at, timezone)}</strong>
                  {a.lastInbound.text && <span className="text-muted-foreground">“{a.lastInbound.text.slice(0, 40)}”</span>}
                </p>
              ) : (
                <p className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" /> รอข้อความแรกจากลูกค้า... (หน้านี้อัปเดตอัตโนมัติ)
                </p>
              )}
              <div className="mt-2 flex flex-wrap gap-2">
                <Button asChild variant="outline" size="sm"><Link href={projectPath("/inbox")}><MessagesSquare /> เปิดกล่องข้อความ</Link></Button>
              </div>
            </div>
            <div>
              <p className="mb-1 font-medium">ส่งข้อความแล้วไม่ได้รับคำตอบ?</p>
              <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
                <li>ตรวจว่าเปิด <strong>Webhook</strong> แล้ว (ขั้นตอนที่ 4) — ถ้าหน้านี้ไม่แสดงว่าได้รับข้อความ แปลว่า LINE ยังไม่ได้ส่งมา</li>
                <li>
                  ได้รับข้อความแต่ไม่ตอบ: เปิดแชทนั้นในหน้า <Link className="underline" href={projectPath("/inbox")}>กล่องข้อความ</Link> — ถ้าส่งคำตอบไม่สำเร็จ
                  จะมีข้อความแจ้งข้อผิดพลาดสีแดงใต้ข้อความของลูกค้า หรือลองพิมพ์ข้อความเดียวกันใน <button type="button" className="underline" onClick={openTestChat}>แชททดสอบ</button> เพื่อดูว่าตรงกับกฎไหม
                </li>
                <li>ตรวจว่าเปิด “ระบบตอบกลับอัตโนมัติ” ไว้ที่หน้า <Link className="underline" href={projectPath("/settings")}>ตั้งค่าโปรเจกต์</Link> และพิมพ์ <Ui>test</Ui> หรือ <Ui>TestFlex</Ui> ตรงตัว (ไม่มีคำอื่นต่อท้าย)</li>
                <li>ได้คำตอบซ้ำ 2 ข้อความ: ปิด “ข้อความตอบกลับอัตโนมัติ” ใน LINE OA Manager (ขั้นตอนที่ 4 ข้อ 3)</li>
              </ul>
            </div>
          </StepCard>
        </div>

        {/* ─── ข้อมูลการเชื่อมต่อ ─── */}
        <div className="min-w-0 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base"><Webhook className="size-4 text-primary" /> Webhook</CardTitle>
              <CardDescription>ที่อยู่ที่ LINE ส่งข้อความลูกค้ามา (ตั้งให้อัตโนมัติในขั้นตอนที่ 3) — แต่ละโปรเจกต์มี URL ของตัวเอง</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex gap-1.5">
                <Input readOnly value={a.webhookUrl ?? "ยังไม่มี URL แบบ HTTPS"} className="font-mono text-xs" />
                <Button variant="outline" size="icon" disabled={!a.webhookUrl} onClick={() => a.webhookUrl && copy(a.webhookUrl, " Webhook URL")} aria-label="คัดลอก">
                  <Copy />
                </Button>
              </div>
              {a.legacyWebhookUrl && (
                <p className="text-xs text-muted-foreground">
                  โปรเจกต์หลักยังรับข้อความจาก URL เดิม <span className="font-mono break-all">{a.legacyWebhookUrl}</span> ได้ ไม่ต้องเปลี่ยน
                </p>
              )}
              {webhook.data && !webhook.data.error && (
                <div className="flex flex-wrap gap-1.5">
                  {webhook.data.matches ? <Badge variant="success">URL ที่ LINE ตรงกับระบบนี้</Badge> : <Badge variant="warning">URL ที่ LINE ไม่ตรงกับระบบนี้</Badge>}
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                ข้อมูลจาก LINE ล่าสุด: {a.lastWebhookAt ? formatDateTime(a.lastWebhookAt, timezone) : "ยังไม่เคยได้รับ"}
              </p>
              {connected && (
                <Button variant="outline" size="sm" onClick={testWebhook} disabled={busy !== null}>
                  {busy === "webhook-test" ? <Loader2 className="animate-spin" /> : <Send />} ให้ LINE ทดสอบส่งข้อความ
                </Button>
              )}
            </CardContent>
          </Card>

          {quota.data && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">โควตาข้อความเดือนนี้</CardTitle>
                <CardDescription>นับเฉพาะข้อความที่แอดมินส่งเอง (Push) — การตอบกลับอัตโนมัติไม่นับโควตา</CardDescription>
              </CardHeader>
              <CardContent>
                {quota.data.available ? (
                  <div className="space-y-2">
                    <p className="text-2xl font-semibold tabular-nums">
                      {formatNumber(quota.data.used ?? 0)}
                      <span className="text-base font-normal text-muted-foreground"> / {quota.data.type === "limited" ? formatNumber(quota.data.limit ?? 0) : "ไม่จำกัด"}</span>
                    </p>
                    {quota.data.type === "limited" && quota.data.limit ? (
                      <div className="h-2 overflow-hidden rounded-full bg-gray-100 dark:bg-white/10">
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
              <CardTitle className="flex items-center gap-2 text-base"><Info className="size-4 text-primary" /> ข้อมูลที่บันทึกไว้</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <dl className="grid gap-2">
                <div className="flex justify-between gap-2"><dt className="text-muted-foreground">Channel ID</dt><dd>{a.channelId ?? "-"}</dd></div>
                <div className="flex justify-between gap-2"><dt className="text-muted-foreground">Channel secret</dt><dd>{a.hasChannelSecret ? "บันทึกแล้ว (เข้ารหัส)" : "-"}</dd></div>
                <div className="flex justify-between gap-2">
                  <dt className="text-muted-foreground">Access token</dt>
                  <dd>{a.tokenSource === "stateless" ? "ขอให้อัตโนมัติ" : a.tokenSource ? "กรอกเอง (long-lived)" : "-"}</dd>
                </div>
                <div className="flex justify-between gap-2"><dt className="text-muted-foreground">ตรวจสอบล่าสุด</dt><dd>{formatDateTime(a.lastVerifiedAt, timezone)}</dd></div>
              </dl>
              {canManage && (a.secretSource === "database" || a.tokenSource === "database" || a.channelIdSource === "database") && (
                <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => setClearOpen("all")} disabled={busy !== null}>
                  <Trash2 /> ลบข้อมูลการเชื่อมต่อ
                </Button>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <ConfirmDialog
        open={clearOpen !== null}
        onOpenChange={(o) => !o && setClearOpen(null)}
        title={clearOpen === "token" ? "ลบ Access token ที่กรอกไว้" : "ลบข้อมูลการเชื่อมต่อ LINE"}
        description={
          clearOpen === "token"
            ? "ระบบจะเปลี่ยนไปขอ token จาก LINE ให้อัตโนมัติด้วย Channel ID และ Channel secret"
            : "ระบบจะรับและตอบข้อความไม่ได้จนกว่าจะเชื่อมต่อใหม่ (ค่าที่ตั้งใน Environment Variables ไม่ได้รับผลกระทบ)"
        }
        confirmLabel="ลบ"
        destructive
        loading={busy === "clear"}
        onConfirm={() => clearOpen && clearCredentials(clearOpen)}
      />
    </>
  );
}
