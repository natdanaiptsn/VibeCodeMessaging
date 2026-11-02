import "server-only";
import { prisma } from "@/lib/prisma";
import { redact, logger } from "@/lib/logger";
import type { Prisma } from "@/lib/generated/prisma/client";

export type AuditInput = {
  projectId?: string | null;
  userId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  summary?: string;
  metadata?: unknown;
  ip?: string | null;
  userAgent?: string | null;
};

/** บันทึก Audit Log (ไม่ทำให้คำขอหลักล้มเหลวหากบันทึกไม่สำเร็จ) */
export async function writeAudit(input: AuditInput) {
  try {
    await prisma.auditLog.create({
      data: {
        projectId: input.projectId ?? null,
        userId: input.userId ?? null,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId ?? null,
        summary: input.summary?.slice(0, 500),
        metadata: input.metadata === undefined ? undefined : (redact(input.metadata) as Prisma.InputJsonValue),
        ipAddress: input.ip ?? null,
        userAgent: input.userAgent ?? null,
      },
    });
  } catch (err) {
    logger.error("Failed to write audit log", err);
  }
}

/** helper สำหรับ RouteContext (ผูกกับโปรเจกต์อัตโนมัติเมื่อเรียกจาก projectRoute) */
export function auditFromCtx(ctx: {
  session: { user: { id: string } };
  ip: string | null;
  userAgent: string | null;
  project?: { id: string };
}) {
  return (input: Omit<AuditInput, "userId" | "ip" | "userAgent">) =>
    writeAudit({ projectId: ctx.project?.id ?? null, ...input, userId: ctx.session.user.id, ip: ctx.ip, userAgent: ctx.userAgent });
}
