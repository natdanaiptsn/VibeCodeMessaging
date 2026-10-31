import { z } from "zod";

function isValidTimeZone(tz: string) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export const defaultReplySchema = z
  .object({
    enabled: z.boolean(),
    replyType: z.enum(["TEXT", "FLEX"]),
    textTemplateId: z.uuid().nullable(),
    flexTemplateId: z.uuid().nullable(),
    applyToNonText: z.boolean(),
    cooldownMinutes: z.coerce.number().int().min(0).max(1440),
  })
  .superRefine((d, ctx) => {
    if (!d.enabled) return;
    if (d.replyType === "TEXT" && !d.textTemplateId) {
      ctx.addIssue({ code: "custom", path: ["textTemplateId"], message: "กรุณาเลือกข้อความสำหรับ Default Reply" });
    }
    if (d.replyType === "FLEX" && !d.flexTemplateId) {
      ctx.addIssue({ code: "custom", path: ["flexTemplateId"], message: "กรุณาเลือก Flex Message สำหรับ Default Reply" });
    }
  });

export const loggingSchema = z.object({
  logLevel: z.enum(["debug", "info", "warn", "error"]),
  replyLogRetentionDays: z.coerce.number().int().min(0).max(3650),
  webhookEventRetentionDays: z.coerce.number().int().min(1).max(365),
  storeLineResponse: z.boolean(),
});

export const generalSettingsSchema = z.object({
  autoReplyEnabled: z.boolean(),
  multiRuleMode: z.enum(["FIRST_MATCH", "ALL_MATCHES"]),
  maxMessagesPerReply: z.coerce.number().int().min(1).max(5),
  pushFallbackEnabled: z.boolean(),
  fetchProfileEnabled: z.boolean(),
  timezone: z.string().refine(isValidTimeZone, "Timezone ไม่ถูกต้อง"),
});

export const systemSettingsSchema = z.object({
  general: generalSettingsSchema,
  defaultReply: defaultReplySchema,
  logging: loggingSchema,
});

export type SystemSettings = z.infer<typeof systemSettingsSchema>;
export type SettingsKey = keyof SystemSettings;

export const DEFAULT_SETTINGS: SystemSettings = {
  general: {
    autoReplyEnabled: true,
    multiRuleMode: "FIRST_MATCH",
    maxMessagesPerReply: 5,
    pushFallbackEnabled: false,
    fetchProfileEnabled: true,
    timezone: "Asia/Bangkok",
  },
  defaultReply: {
    enabled: false,
    replyType: "TEXT",
    textTemplateId: null,
    flexTemplateId: null,
    applyToNonText: false,
    cooldownMinutes: 0,
  },
  logging: {
    logLevel: "info",
    replyLogRetentionDays: 180,
    webhookEventRetentionDays: 30,
    storeLineResponse: true,
  },
};

export const settingsUpdateSchema = z.object({
  general: generalSettingsSchema.optional(),
  defaultReply: defaultReplySchema.optional(),
  logging: loggingSchema.optional(),
});
