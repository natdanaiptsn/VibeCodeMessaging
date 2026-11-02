import { z } from "zod";
import { projectRoute, readJson, searchParamsObject } from "@/lib/api/handler";
import { prisma } from "@/lib/prisma";
import { dateStringSchema, emptyToUndefined, idParamsSchema, searchSchema } from "@/lib/validation/common";
import { sendMessageSchema } from "@/lib/validation/line";
import { badRequest, notFound } from "@/lib/errors";
import { listCustomerMessages } from "@/services/message.service";
import { getSettings } from "@/services/settings.service";
import { getLineCredentials, requireAccessToken } from "@/services/line-account.service";
import { sendAdminPush } from "@/services/reply.service";
import { renderTextMessage } from "@/services/text-template.service";
import { renderFlexMessage } from "@/services/flex-message.service";
import { buildTemplateValues } from "@/lib/templates/variables";
import { dateRange } from "@/lib/dates";
import { auditFromCtx } from "@/lib/audit";
import { stripControlChars } from "@/lib/utils";
import type { LineOutgoingMessage } from "@/lib/line/types";

const MESSAGE_TYPES = ["TEXT", "IMAGE", "VIDEO", "AUDIO", "FILE", "STICKER", "LOCATION", "POSTBACK", "FOLLOW", "UNFOLLOW", "FLEX", "OTHER"] as const;

const querySchema = z.object({
  before: z.preprocess(emptyToUndefined, z.iso.datetime().optional()),
  limit: z.coerce.number().int().min(1).max(100).default(40),
  type: z.preprocess(emptyToUndefined, z.enum(MESSAGE_TYPES).optional()),
  search: z.preprocess(emptyToUndefined, searchSchema),
  from: z.preprocess(emptyToUndefined, dateStringSchema),
  to: z.preprocess(emptyToUndefined, dateStringSchema),
});

export const GET = projectRoute<{ id: string }>({ permission: "inbox:view" }, async ({ req, params, project }) => {
  const { id } = idParamsSchema.parse(params);
  const q = querySchema.parse(searchParamsObject(req));
  const exists = await prisma.customer.findFirst({ where: { id, projectId: project.id }, select: { id: true } });
  if (!exists) throw notFound("ไม่พบลูกค้า");
  const { general } = await getSettings(project.id);
  const range = dateRange(q.from, q.to, general.timezone);
  return listCustomerMessages(id, { ...q, before: q.before ? new Date(q.before) : undefined, ...range });
});

/** Admin ส่งข้อความหาลูกค้า (Push Message — นับโควตาข้อความของ LINE OA) */
export const POST = projectRoute<{ id: string }>({ permission: "inbox:send", rateLimitPerMinute: 30 }, async (ctx) => {
  const { id } = idParamsSchema.parse(ctx.params);
  const input = sendMessageSchema.parse(await readJson(ctx.req));
  const customer = await prisma.customer.findFirst({ where: { id, projectId: ctx.project.id } });
  if (!customer) throw notFound("ไม่พบลูกค้า");
  const [settings, creds] = await Promise.all([getSettings(ctx.project.id), getLineCredentials(ctx.project.id)]);
  const token = requireAccessToken(creds);

  const values = buildTemplateValues({
    displayName: customer.displayName,
    userId: customer.lineUserId,
    timezone: settings.general.timezone,
  });
  let message: LineOutgoingMessage;
  if (input.type === "text") {
    message = { type: "text", text: stripControlChars(input.text ?? "").slice(0, 5000) };
  } else if (input.type === "textTemplate") {
    const t = await prisma.replyTemplate.findFirst({ where: { id: input.templateId!, projectId: ctx.project.id } });
    if (!t) throw notFound("ไม่พบข้อความ Template");
    message = renderTextMessage(t.content, values);
  } else {
    const f = await prisma.flexTemplate.findFirst({ where: { id: input.templateId!, projectId: ctx.project.id } });
    if (!f) throw notFound("ไม่พบ Flex Template");
    const r = renderFlexMessage(f, values);
    if (!r.ok) throw badRequest(r.error, r.validation.errors);
    message = r.message;
  }

  const log = await sendAdminPush({
    customer,
    messages: [message],
    token,
    userId: ctx.session.user.id,
    clientRequestId: input.clientRequestId,
    settings,
  });
  await auditFromCtx(ctx)({
    action: "message.send",
    entityType: "Customer",
    entityId: customer.id,
    summary: `ส่งข้อความ (${input.type}) — ${log.status}`,
    metadata: { replyLogId: log.id },
  });
  if (log.status === "FAILED") throw badRequest(`ส่งข้อความไม่สำเร็จ: ${log.errorMessage ?? "ไม่ทราบสาเหตุ"}`);
  return log;
});
