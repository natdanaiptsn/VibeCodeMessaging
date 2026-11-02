import "server-only";
import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";
import { notFound } from "@/lib/errors";
import { DEFAULT_SETTINGS } from "@/lib/validation/settings";
import { invalidateRuleCache } from "@/services/auto-reply-engine.service";
import { invalidateSettingsCache } from "@/services/settings.service";
import type { ProjectCreateInput, ProjectUpdateInput } from "@/lib/validation/projects";

/**
 * โปรเจกต์ — แต่ละโปรเจกต์เชื่อมต่อ LINE OA ได้ 1 บัญชี และมีลูกค้า/ข้อความ/กฎ/Template/การตั้งค่าแยกกัน
 */

export type ProjectSummary = Awaited<ReturnType<typeof listProjects>>[number];

/** รายการโปรเจกต์พร้อมสถิติย่อ (ไม่มี Token/Secret) */
export async function listProjects() {
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const [projects, customers, rules, messages] = await Promise.all([
    prisma.project.findMany({
      orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
      select: {
        id: true,
        name: true,
        description: true,
        isDefault: true,
        settings: true,
        channelId: true,
        channelSecretEnc: true,
        basicId: true,
        displayName: true,
        pictureUrl: true,
        connectionStatus: true,
        lastWebhookAt: true,
        createdAt: true,
      },
    }),
    prisma.customer.groupBy({ by: ["projectId"], _count: { _all: true } }),
    prisma.replyRule.groupBy({ by: ["projectId"], where: { isActive: true }, _count: { _all: true } }),
    prisma.message.groupBy({ by: ["projectId"], where: { direction: "INBOUND", timestamp: { gte: since } }, _count: { _all: true } }),
  ]);
  const count = (rows: { projectId: string; _count: { _all: number } }[], id: string) => rows.find((r) => r.projectId === id)?._count._all ?? 0;
  const envSecret = Boolean(env().LINE_CHANNEL_SECRET?.trim());
  return projects.map(({ channelSecretEnc, settings, ...p }) => ({
    ...p,
    /** กรอก Channel secret แล้วหรือยัง (ไม่ส่งค่าจริงออกไป) */
    hasCredentials: Boolean(channelSecretEnc) || (p.isDefault && envSecret),
    autoReplyEnabled:
      ((settings as { general?: { autoReplyEnabled?: boolean } } | null)?.general?.autoReplyEnabled ??
        DEFAULT_SETTINGS.general.autoReplyEnabled) !== false,
    addFriendUrl: p.basicId ? `https://line.me/R/ti/p/${encodeURIComponent(p.basicId)}` : null,
    stats: {
      customers: count(customers, p.id),
      activeRules: count(rules, p.id),
      messages7d: count(messages, p.id),
    },
  }));
}

export async function getProjectBasic(id: string) {
  return prisma.project.findUnique({
    where: { id },
    select: { id: true, name: true, description: true, isDefault: true, displayName: true, pictureUrl: true, connectionStatus: true },
  });
}

export async function createProject(input: ProjectCreateInput) {
  const hasDefault = await prisma.project.count({ where: { isDefault: true } });
  return prisma.project.create({
    data: { name: input.name, description: input.description || null, isDefault: hasDefault === 0 },
    select: { id: true, name: true },
  });
}

export async function updateProject(id: string, input: ProjectUpdateInput) {
  const exists = await prisma.project.findUnique({ where: { id }, select: { id: true } });
  if (!exists) throw notFound("ไม่พบโปรเจกต์");
  return prisma.project.update({
    where: { id },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.description !== undefined ? { description: input.description || null } : {}),
    },
    select: { id: true, name: true, description: true },
  });
}

/**
 * ลบโปรเจกต์พร้อมข้อมูลทั้งหมดของโปรเจกต์ (ลูกค้า ข้อความ กฎ Template ประวัติการตอบกลับ)
 * ถ้าลบโปรเจกต์หลัก โปรเจกต์ที่สร้างก่อนสุดที่เหลือจะเป็นโปรเจกต์หลักแทน
 */
export async function deleteProject(id: string) {
  const project = await prisma.project.findUnique({ where: { id }, select: { id: true, name: true, isDefault: true } });
  if (!project) throw notFound("ไม่พบโปรเจกต์");
  await prisma.$transaction(async (tx) => {
    // ลบกฎก่อน Template (กฎอ้างอิง Template แบบ Restrict)
    await tx.replyRule.deleteMany({ where: { projectId: id } });
    await tx.replyTemplate.deleteMany({ where: { projectId: id } });
    await tx.flexTemplate.deleteMany({ where: { projectId: id } });
    await tx.replyLog.deleteMany({ where: { projectId: id } });
    await tx.project.delete({ where: { id } }); // ลูกค้า ข้อความ และ Webhook Event ถูกลบตาม (cascade)
    if (project.isDefault) {
      const next = await tx.project.findFirst({ orderBy: { createdAt: "asc" }, select: { id: true } });
      if (next) await tx.project.update({ where: { id: next.id }, data: { isDefault: true } });
    }
  });
  invalidateRuleCache(id);
  invalidateSettingsCache(id);
  return project;
}
