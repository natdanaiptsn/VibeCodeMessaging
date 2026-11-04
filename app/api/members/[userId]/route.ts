import { z } from "zod";
import { projectRoute, readJson } from "@/lib/api/handler";
import { uuidSchema } from "@/lib/validation/common";
import { memberUpdateSchema } from "@/lib/validation/projects";
import { removeMember, updateMemberRole } from "@/services/project.service";
import { auditFromCtx } from "@/lib/audit";
import { can, ROLE_LABELS } from "@/lib/auth/permissions";
import { forbidden } from "@/lib/errors";

const paramsSchema = z.object({ userId: uuidSchema });

export const PATCH = projectRoute<{ userId: string }>({ permission: "members:manage", rateLimitPerMinute: 30 }, async (ctx) => {
  const { userId } = paramsSchema.parse(ctx.params);
  const { role } = memberUpdateSchema.parse(await readJson(ctx.req, 1024));
  await updateMemberRole(ctx.project.id, userId, role, ctx.project.role);
  await auditFromCtx(ctx)({
    action: "project.member_role",
    entityType: "Project",
    entityId: ctx.project.id,
    summary: `เปลี่ยนบทบาทสมาชิกเป็น${ROLE_LABELS[role]}`,
    metadata: { userId, role },
  });
  return { ok: true };
});

/** นำสมาชิกออก (ผู้ดูแลขึ้นไป) หรือออกจากโปรเจกต์เอง (ทุกคน) */
export const DELETE = projectRoute<{ userId: string }>({ rateLimitPerMinute: 30 }, async (ctx) => {
  const { userId } = paramsSchema.parse(ctx.params);
  const self = userId === ctx.session.user.id;
  if (!self && !can(ctx.project.role, "members:manage")) throw forbidden();
  await removeMember(ctx.project.id, userId, { userId: ctx.session.user.id, role: ctx.project.role });
  await auditFromCtx(ctx)({
    action: self ? "project.member_leave" : "project.member_remove",
    entityType: "Project",
    entityId: ctx.project.id,
    summary: self ? "ออกจากโปรเจกต์" : "นำสมาชิกออกจากโปรเจกต์",
    metadata: { userId },
  });
  return { ok: true };
});
