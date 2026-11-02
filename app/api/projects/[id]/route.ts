import { route, readJson } from "@/lib/api/handler";
import { idParamsSchema } from "@/lib/validation/common";
import { projectUpdateSchema } from "@/lib/validation/projects";
import { notFound } from "@/lib/errors";
import { deleteProject, getProjectBasic, updateProject } from "@/services/project.service";
import { auditFromCtx } from "@/lib/audit";

export const GET = route<{ id: string }>({}, async ({ params }) => {
  const { id } = idParamsSchema.parse(params);
  const project = await getProjectBasic(id);
  if (!project) throw notFound("ไม่พบโปรเจกต์");
  return project;
});

export const PATCH = route<{ id: string }>({ permission: "projects:manage", rateLimitPerMinute: 30 }, async (ctx) => {
  const { id } = idParamsSchema.parse(ctx.params);
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

/** ลบโปรเจกต์และข้อมูลทั้งหมดของโปรเจกต์ (เฉพาะเจ้าของระบบ) */
export const DELETE = route<{ id: string }>({ permission: "projects:delete", rateLimitPerMinute: 10 }, async (ctx) => {
  const { id } = idParamsSchema.parse(ctx.params);
  const project = await deleteProject(id);
  await auditFromCtx(ctx)({
    action: "project.delete",
    entityType: "Project",
    entityId: id,
    summary: `ลบโปรเจกต์ "${project.name}" และข้อมูลทั้งหมดของโปรเจกต์`,
  });
  return { ok: true };
});
