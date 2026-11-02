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

/**
 * การตั้งค่า
 * - general / defaultReply: เป็นของแต่ละโปรเจกต์ (เก็บใน Project.settings)
 * - logging: ใช้ร่วมกันทั้งระบบ (เก็บใน SystemSetting key "logging")
 */
const PROJECT_SECTIONS = {
  general: generalSettingsSchema,
  defaultReply: defaultReplySchema,
} as const;

type ProjectSection = keyof typeof PROJECT_SECTIONS;

const CACHE_TTL_MS = 5_000;
const projectCache = new Map<string, { at: number; value: Pick<SystemSettings, ProjectSection> }>();
let loggingCache: { at: number; value: SystemSettings["logging"] } | null = null;

export function invalidateSettingsCache(projectId?: string) {
  if (projectId) projectCache.delete(projectId);
  else projectCache.clear();
  loggingCache = null;
}

/** การตั้งค่า Log (ใช้ร่วมกันทุกโปรเจกต์) */
export async function getLoggingSettings(): Promise<SystemSettings["logging"]> {
  if (loggingCache && Date.now() - loggingCache.at < CACHE_TTL_MS) return loggingCache.value;
  const row = await prisma.systemSetting.findUnique({ where: { key: "logging" } });
  const parsed = loggingSchema.safeParse({ ...DEFAULT_SETTINGS.logging, ...((row?.value as object | null) ?? {}) });
  const value = parsed.success ? parsed.data : structuredClone(DEFAULT_SETTINGS.logging);
  setLogLevel(value.logLevel);
  loggingCache = { at: Date.now(), value };
  return value;
}

async function getProjectSections(projectId: string): Promise<Pick<SystemSettings, ProjectSection>> {
  const cached = projectCache.get(projectId);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.value;
  const project = await prisma.project.findUnique({ where: { id: projectId }, select: { settings: true } });
  const stored = (project?.settings ?? {}) as Partial<Record<ProjectSection, unknown>>;
  const value = {
    general: structuredClone(DEFAULT_SETTINGS.general),
    defaultReply: structuredClone(DEFAULT_SETTINGS.defaultReply),
  } as Pick<SystemSettings, ProjectSection>;
  for (const key of Object.keys(PROJECT_SECTIONS) as ProjectSection[]) {
    const merged = { ...(DEFAULT_SETTINGS[key] as object), ...((stored[key] as object | undefined) ?? {}) };
    const parsed = PROJECT_SECTIONS[key].safeParse(merged);
    if (parsed.success) (value as Record<string, unknown>)[key] = parsed.data;
  }
  if (projectCache.size > 200) projectCache.clear();
  projectCache.set(projectId, { at: Date.now(), value });
  return value;
}

/** อ่านการตั้งค่าของโปรเจกต์ (รวมกับค่าเริ่มต้น และตรวจสอบรูปแบบทุกครั้ง) */
export async function getSettings(projectId: string): Promise<SystemSettings> {
  const [sections, logging] = await Promise.all([getProjectSections(projectId), getLoggingSettings()]);
  return { ...sections, logging };
}

export async function updateSettings(projectId: string, update: Partial<SystemSettings>, userId: string | null) {
  const projectPart: Partial<Record<ProjectSection, unknown>> = {};
  if (update.general !== undefined) projectPart.general = update.general;
  if (update.defaultReply !== undefined) projectPart.defaultReply = update.defaultReply;

  await prisma.$transaction(async (tx) => {
    if (Object.keys(projectPart).length > 0) {
      const project = await tx.project.findUnique({ where: { id: projectId }, select: { settings: true } });
      const current = (project?.settings ?? {}) as Record<string, unknown>;
      await tx.project.update({
        where: { id: projectId },
        data: { settings: { ...current, ...projectPart } as Prisma.InputJsonValue },
      });
    }
    if (update.logging !== undefined) {
      await tx.systemSetting.upsert({
        where: { key: "logging" },
        create: { key: "logging", value: update.logging as Prisma.InputJsonValue, updatedById: userId },
        update: { value: update.logging as Prisma.InputJsonValue, updatedById: userId },
      });
    }
  });
  invalidateSettingsCache(projectId);
  return getSettings(projectId);
}
