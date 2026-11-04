import { route, readJson } from "@/lib/api/handler";
import { can, type Permission } from "@/lib/auth/permissions";
import { idParamsSchema } from "@/lib/validation/common";
import { projectUpdateSchema } from "@/lib/validation/projects";
import { forbidden, notFound } from "@/lib/errors";
import { deleteProject, getMembership, getProjectBasic, updateProject } from "@/services/project.service";
import { auditFromCtx } from "@/lib/audit";

/** ต้องเป็นสมาชิก และมีสิทธิ์ตามบทบาทในโปรเจกต์ */
async function requireProjectRole(projectId: string, userId: string, permission?: Permission) {
  const membership = await getMembership(projectId, userId);
  if (!membership) throw notFound("ไม่พบโปรเจกต์");
  if (permission && !can(membership.role, permission)) throw forbidden();
  return membership.role;
}

export const GET = route<{ id: string }>({}, async ({ params, session }) => {
  const { id } = idParamsSchema.parse(params);
  const role = await requireProjectRole(id, session.user.id);
  const project = await getProjectBasic(id);
  if (!project) throw notFound("ไม่พบโปรเจกต์");
  return { ...project, role };
});

export const PATCH = route<{ id: string }>({ rateLimitPerMinute: 30 }, async (ctx) => {
  const { id } = idParamsSchema.parse(ctx.params);
  await requireProjectRole(id, ctx.session.user.id, "projects:manage");
  const input = projectUpdateSchema.parse(await readJson(ctx.req, 4096));
  const project = await updateProject(id, input);
  await auditFromCtx(ctx)({
    projectId: id,
    action: "project.update",
    entityType: "Project",
    entityId: id,
    summary: `แก้ไขโปรเจกต์ "${project.name}"`,
    metadata: input,
  });
  return project;
});

/** ลบโปรเจกต์และข้อมูลทั้งหมดของโปรเจกต์ (เฉพาะเจ้าของโปรเจกต์) */
export const DELETE = route<{ id: string }>({ rateLimitPerMinute: 10 }, async (ctx) => {
  const { id } = idParamsSchema.parse(ctx.params);
  await requireProjectRole(id, ctx.session.user.id, "projects:delete");
  const project = await deleteProject(id);
  await auditFromCtx(ctx)({
    action: "project.delete",
    entityType: "Project",
    entityId: id,
    summary: `ลบโปรเจกต์ "${project.name}" และข้อมูลทั้งหมดของโปรเจกต์`,
  });
  return { ok: true };
});
