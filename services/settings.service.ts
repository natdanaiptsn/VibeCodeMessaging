import "server-only";
import { prisma } from "@/lib/prisma";
import {
  DEFAULT_SETTINGS,
  defaultReplySchema,
  generalSettingsSchema,
  loggingSchema,
  type SystemSettings,
} from "@/lib/validation/settings";
import { setLogLevel } from "@/lib/logger";
import type { Prisma } from "@/lib/generated/prisma/client";

const SECTION_SCHEMAS = {
  general: generalSettingsSchema,
  defaultReply: defaultReplySchema,
  logging: loggingSchema,
} as const;

const CACHE_TTL_MS = 5_000;
let cache: { at: number; value: SystemSettings } | null = null;

export function invalidateSettingsCache() {
  cache = null;
}

/** อ่านการตั้งค่าระบบ (รวมกับค่าเริ่มต้น และตรวจสอบรูปแบบทุกครั้ง) */
export async function getSettings(): Promise<SystemSettings> {
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) return cache.value;
  const rows = await prisma.systemSetting.findMany({ where: { key: { in: Object.keys(SECTION_SCHEMAS) } } });
  const value = structuredClone(DEFAULT_SETTINGS) as SystemSettings;
  for (const row of rows) {
    const key = row.key as keyof SystemSettings;
    const schema = SECTION_SCHEMAS[key];
    if (!schema) continue;
    const merged = { ...(DEFAULT_SETTINGS[key] as object), ...(row.value as object) };
    const parsed = schema.safeParse(merged);
    if (parsed.success) (value as Record<string, unknown>)[key] = parsed.data;
  }
  setLogLevel(value.logging.logLevel);
  cache = { at: Date.now(), value };
  return value;
}

export async function updateSettings(update: Partial<SystemSettings>, userId: string | null) {
  const entries = Object.entries(update).filter(([, v]) => v !== undefined) as [keyof SystemSettings, unknown][];
  await prisma.$transaction(
    entries.map(([key, value]) =>
      prisma.systemSetting.upsert({
        where: { key },
        create: { key, value: value as Prisma.InputJsonValue, updatedById: userId },
        update: { value: value as Prisma.InputJsonValue, updatedById: userId },
      }),
    ),
  );
  invalidateSettingsCache();
  return getSettings();
}
