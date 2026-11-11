import "server-only";
import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";
import { badRequest, conflict, forbidden, notFound } from "@/lib/errors";
import { DEFAULT_SETTINGS } from "@/lib/validation/settings";
import { invalidateRuleCache } from "@/services/auto-reply-engine.service";
import { invalidateSettingsCache } from "@/services/settings.service";
import type { ProjectCreateInput, ProjectUpdateInput } from "@/lib/validation/projects";
import type { UserRole } from "@/lib/generated/prisma/client";

/**
 * โปรเจกต์ — แต่ละโปรเจกต์เชื่อมต่อ LINE OA ได้ 1 บัญชี และมีลูกค้า/ข้อความ/กฎ/Template/การตั้งค่าแยกกัน
 * ผู้ใช้เห็นเฉพาะโปรเจกต์ที่ตัวเองเป็นสมาชิก (ProjectMember) — ผู้สร้างเป็น OWNER ของโปรเจกต์
 */

export async function getMembership(projectId: string, userId: string) {
  return prisma.projectMember.findUnique({ where: { projectId_userId: { projectId, userId } }, select: { role: true } });
}

/** โปรเจกต์ที่ยังไม่มีสมาชิก (เช่น โปรเจกต์แรกของฐานข้อมูลใหม่) ให้ผู้ดูแลหลักเป็นเจ้าของ */
export async function claimOrphanProjects(userId: string) {
  const orphans = await prisma.project.findMany({ where: { members: { none: {} } }, select: { id: true } });
  if (orphans.length === 0) return;
  await prisma.projectMember.createMany({
    data: orphans.map((p) => ({ projectId: p.id, userId, role: "OWNER" as const })),
    skipDuplicates: true,
  });
}

export type ProjectSummary = Awaited<ReturnType<typeof listProjects>>[number];

/** รายการโปรเจกต์ของผู้ใช้ พร้อมสถิติย่อ (ไม่มี Token/Secret) */
export async function listProjects(userId: string) {
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const memberships = await prisma.projectMember.findMany({ where: { userId }, select: { projectId: true, role: true } });
  const ids = memberships.map((m) => m.projectId);
  const [projects, customers, rules, messages, memberCounts] = await Promise.all([
    prisma.project.findMany({
      where: { id: { in: ids } },
      orderBy: [{ createdAt: "asc" }],
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
    prisma.customer.groupBy({ by: ["projectId"], where: { projectId: { in: ids } }, _count: { _all: true } }),
    prisma.replyRule.groupBy({ by: ["projectId"], where: { projectId: { in: ids }, isActive: true }, _count: { _all: true } }),
    prisma.message.groupBy({
      by: ["projectId"],
      where: { projectId: { in: ids }, direction: "INBOUND", timestamp: { gte: since } },
      _count: { _all: true },
    }),
    prisma.projectMember.groupBy({ by: ["projectId"], where: { projectId: { in: ids } }, _count: { _all: true } }),
  ]);
  const count = (rows: { projectId: string; _count: { _all: number } }[], id: string) => rows.find((r) => r.projectId === id)?._count._all ?? 0;
  const envSecret = Boolean(env().LINE_CHANNEL_SECRET?.trim());
  return projects.map(({ channelSecretEnc, settings, ...p }) => ({
    ...p,
    /** บทบาทของผู้ใช้ในโปรเจกต์นี้ (OWNER = โปรเจกต์ของฉัน) */
    role: memberships.find((m) => m.projectId === p.id)!.role,
    members: count(memberCounts, p.id),
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

export async function createProject(userId: string, input: ProjectCreateInput) {
  const hasDefault = await prisma.project.count({ where: { isDefault: true } });
  return prisma.project.create({
    data: {
      name: input.name,
      description: input.description || null,
      isDefault: hasDefault === 0,
      members: { create: { userId, role: "OWNER" } },
    },
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

// ───────────────────────── สมาชิกโปรเจกต์ ─────────────────────────

export async function listMembers(projectId: string) {
  const members = await prisma.projectMember.findMany({
    where: { projectId },
    orderBy: [{ createdAt: "asc" }],
    select: {
      role: true,
      createdAt: true,
      user: {
        select: { id: true, name: true, username: true, email: true, avatarUrl: true, isActive: true, identities: { select: { provider: true, email: true } } },
      },
    },
  });
  return members.map((m) => ({
    userId: m.user.id,
    name: m.user.name,
    username: m.user.username,
    email: m.user.email ?? m.user.identities.find((i) => i.email)?.email ?? null,
    avatarUrl: m.user.avatarUrl,
    isActive: m.user.isActive,
    providers: m.user.identities.map((i) => i.provider),
    role: m.role,
    addedAt: m.createdAt,
  }));
}

/** ADMIN เพิ่มได้เฉพาะ ADMIN/AGENT — การให้หรือถอดสิทธิ์ OWNER ต้องเป็น OWNER */
function assertCanAssign(actorRole: UserRole, role: UserRole) {
  if (role === "OWNER" && actorRole !== "OWNER") throw forbidden("เฉพาะเจ้าของโปรเจกต์เท่านั้นที่ให้สิทธิ์เจ้าของได้");
}

async function ownerCount(projectId: string) {
  return prisma.projectMember.count({ where: { projectId, role: "OWNER" } });
}

/** เพิ่มสมาชิกด้วยอีเมลหรือชื่อผู้ใช้ของบัญชีที่มีในระบบแล้ว */
const MEMBER_USER_SELECT = { id: true, name: true, isActive: true } as const;

/**
 * หาบัญชีจากชื่อผู้ใช้หรืออีเมล — อีเมลดูทั้งอีเมลของบัญชี และอีเมลของบัญชี Google ที่ผูกไว้
 * (บัญชีที่สมัครด้วย LINE แล้วผูก Google ทีหลัง อาจยังไม่มีอีเมลของบัญชี)
 */
async function findUserByIdentifier(identifier: string) {
  const id = identifier.trim().toLowerCase();
  if (!id.includes("@")) return prisma.user.findUnique({ where: { username: id }, select: MEMBER_USER_SELECT });
  const byEmail = await prisma.user.findFirst({
    where: { email: { equals: id, mode: "insensitive" } },
    select: MEMBER_USER_SELECT,
  });
  if (byEmail) return byEmail;
  const linked = await prisma.userIdentity.findMany({
    where: { email: { equals: id, mode: "insensitive" } },
    select: { user: { select: MEMBER_USER_SELECT } },
    take: 2,
  });
  if (new Set(linked.map((i) => i.user.id)).size > 1) {
    throw conflict("มีหลายบัญชีที่ผูกอีเมลนี้ไว้ — กรุณาเพิ่มด้วยชื่อผู้ใช้แทน");
  }
  return linked[0]?.user ?? null;
}

export async function addMember(projectId: string, identifier: string, role: UserRole, actorRole: UserRole) {
  assertCanAssign(actorRole, role);
  const user = await findUserByIdentifier(identifier);
  if (!user || !user.isActive) {
    throw notFound("ไม่พบบัญชีนี้ในระบบ — ให้ผู้ใช้เข้าสู่ระบบด้วย Google หรือ LINE หนึ่งครั้งก่อน แล้วเพิ่มด้วยอีเมลของบัญชีนั้น");
  }
  const existing = await getMembership(projectId, user.id);
  if (existing) throw conflict(`${user.name} เป็นสมาชิกของโปรเจกต์นี้อยู่แล้ว`);
  await prisma.projectMember.create({ data: { projectId, userId: user.id, role } });
  return user;
}

export async function updateMemberRole(projectId: string, userId: string, role: UserRole, actorRole: UserRole) {
  const current = await getMembership(projectId, userId);
  if (!current) throw notFound("ไม่พบสมาชิก");
  assertCanAssign(actorRole, role);
  if (current.role === "OWNER") {
    assertCanAssign(actorRole, "OWNER");
    if (role !== "OWNER" && (await ownerCount(projectId)) <= 1) throw badRequest("โปรเจกต์ต้องมีเจ้าของอย่างน้อย 1 คน");
  }
  await prisma.projectMember.update({ where: { projectId_userId: { projectId, userId } }, data: { role } });
}

/** นำสมาชิกออก (หรือออกจากโปรเจกต์เอง) — เจ้าของคนสุดท้ายออกไม่ได้ */
export async function removeMember(projectId: string, userId: string, actor: { userId: string; role: UserRole }) {
  const current = await getMembership(projectId, userId);
  if (!current) throw notFound("ไม่พบสมาชิก");
  const self = actor.userId === userId;
  if (!self) {
    if (actor.role === "AGENT") throw forbidden();
    if (current.role === "OWNER") assertCanAssign(actor.role, "OWNER");
  }
  if (current.role === "OWNER" && (await ownerCount(projectId)) <= 1) {
    throw badRequest("เจ้าของคนสุดท้ายออกจากโปรเจกต์ไม่ได้ — ให้สิทธิ์เจ้าของกับสมาชิกอื่นก่อน หรือลบโปรเจกต์");
  }
  await prisma.projectMember.delete({ where: { projectId_userId: { projectId, userId } } });
}
