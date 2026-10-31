"use client";

import { useRef, useState } from "react";
import { Info, Loader2, SendHorizontal } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { apiFetch, ApiClientError, useApiQuery } from "@/hooks/use-api";
import { clientUuid } from "@/lib/client-uuid";

type TemplateItem = { id: string; name: string };

export function Composer({ customerId, disabled, onSent }: { customerId: string; disabled?: boolean; onSent: () => void }) {
  const [mode, setMode] = useState<"text" | "textTemplate" | "flexTemplate">("text");
  const [text, setText] = useState("");
  const [templateId, setTemplateId] = useState<string>("");
  const [sending, setSending] = useState(false);
  // ใช้ requestId เดิมเมื่อส่งซ้ำหลังล้มเหลว เพื่อไม่ให้ข้อความซ้ำ (X-Line-Retry-Key)
  const requestId = useRef(clientUuid());
  const texts = useApiQuery<TemplateItem[]>(["text-templates"], mode === "textTemplate" ? "/api/text-templates" : null);
  const flexes = useApiQuery<TemplateItem[]>(["flex-templates"], mode === "flexTemplate" ? "/api/flex-templates" : null);
  const options = mode === "textTemplate" ? texts.data : flexes.data;

  const canSend = !disabled && !sending && (mode === "text" ? text.trim().length > 0 : Boolean(templateId));

  const send = async () => {
    if (!canSend) return;
    setSending(true);
    try {
      await apiFetch(`/api/customers/${customerId}/messages`, {
        method: "POST",
        body: { type: mode, text: mode === "text" ? text : undefined, templateId: mode !== "text" ? templateId : undefined, clientRequestId: requestId.current },
      });
      toast.success("ส่งข้อความแล้ว");
      setText("");
      setTemplateId("");
      requestId.current = clientUuid();
      onSent();
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "ส่งข้อความไม่สำเร็จ");
      if (err instanceof ApiClientError && err.status >= 400 && err.status < 500 && err.status !== 409) requestId.current = clientUuid();
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="border-t bg-white p-3">
      {disabled ? (
        <p className="flex items-center gap-2 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
          <Info className="size-4 shrink-0" /> ลูกค้าเลิกติดตามหรือบล็อกบัญชี จึงไม่สามารถส่งข้อความได้
        </p>
      ) : (
        <div className="space-y-2">
          <Tabs value={mode} onValueChange={(v) => { setMode(v as typeof mode); setTemplateId(""); }}>
            <TabsList className="h-8">
              <TabsTrigger value="text" className="text-xs">พิมพ์ข้อความ</TabsTrigger>
              <TabsTrigger value="textTemplate" className="text-xs">Text Template</TabsTrigger>
              <TabsTrigger value="flexTemplate" className="text-xs">Flex Message</TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="flex items-end gap-2">
            {mode === "text" ? (
              <Textarea
                value={text}
                maxLength={5000}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                    e.preventDefault();
                    void send();
                  }
                }}
                placeholder="พิมพ์ข้อความ... (Enter เพื่อส่ง, Shift+Enter ขึ้นบรรทัดใหม่)"
                className="max-h-40 min-h-11 resize-none"
                rows={1}
              />
            ) : (
              <Select value={templateId} onValueChange={setTemplateId}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder={(mode === "textTemplate" ? texts : flexes).isLoading ? "กำลังโหลด..." : "เลือก Template"} />
                </SelectTrigger>
                <SelectContent>
                  {(options ?? []).length === 0 && <div className="px-2 py-3 text-sm text-muted-foreground">ยังไม่มี Template</div>}
                  {(options ?? []).map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Button onClick={send} disabled={!canSend} size="icon" className="size-11 shrink-0" aria-label="ส่งข้อความ">
              {sending ? <Loader2 className="animate-spin" /> : <SendHorizontal />}
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground">
            การส่งโดยแอดมินใช้ LINE Push API ซึ่งนับรวมในโควตาข้อความรายเดือนของ LINE OA
            {mode === "text" && text.length > 4500 && <span className="ml-1 text-amber-600">({text.length}/5000)</span>}
          </p>
        </div>
      )}
    </div>
  );
}
