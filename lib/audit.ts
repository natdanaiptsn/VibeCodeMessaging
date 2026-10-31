import "server-only";
import { prisma } from "@/lib/prisma";
import { redact, logger } from "@/lib/logger";
import type { Prisma } from "@/lib/generated/prisma/client";

export type AuditInput = {
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

/** helper สำหรับ RouteContext */
export function auditFromCtx(ctx: { session: { user: { id: string } }; ip: string | null; userAgent: string | null }) {
  return (input: Omit<AuditInput, "userId" | "ip" | "userAgent">) =>
    writeAudit({ ...input, userId: ctx.session.user.id, ip: ctx.ip, userAgent: ctx.userAgent });
}
