import { projectRoute, readJson } from "@/lib/api/handler";
import { memberAddSchema } from "@/lib/validation/projects";
import { addMember, listMembers } from "@/services/project.service";
import { auditFromCtx } from "@/lib/audit";
import { ROLE_LABELS } from "@/lib/auth/permissions";

/** สมาชิกของโปรเจกต์ปัจจุบัน */
export const GET = projectRoute({}, async ({ project, session }) => ({
  myRole: project.role,
  myUserId: session.user.id,
  members: await listMembers(project.id),
}));

/** เพิ่มสมาชิกด้วยอีเมลหรือชื่อผู้ใช้ของบัญชีที่มีในระบบ */
export const POST = projectRoute({ permission: "members:manage", rateLimitPerMinute: 20 }, async (ctx) => {
  const input = memberAddSchema.parse(await readJson(ctx.req, 2048));
  const user = await addMember(ctx.project.id, input.identifier, input.role, ctx.project.role);
  await auditFromCtx(ctx)({
    action: "project.member_add",
    entityType: "Project",
    entityId: ctx.project.id,
    summary: `เพิ่ม ${user.name} เป็น${ROLE_LABELS[input.role]}ของโปรเจกต์`,
  });
  return { ok: true };
});
