import { route, readJson } from "@/lib/api/handler";
import { projectCreateSchema } from "@/lib/validation/projects";
import { createProject, listProjects } from "@/services/project.service";
import { auditFromCtx } from "@/lib/audit";

/** รายการโปรเจกต์ทั้งหมด (ผู้ใช้ทุกคนเห็นทุกโปรเจกต์) */
export const GET = route({}, async () => listProjects());

export const POST = route({ permission: "projects:manage", rateLimitPerMinute: 20 }, async (ctx) => {
  const input = projectCreateSchema.parse(await readJson(ctx.req, 4096));
  const project = await createProject(input);
  await auditFromCtx(ctx)({
    projectId: project.id,
    action: "project.create",
    entityType: "Project",
    entityId: project.id,
    summary: `สร้างโปรเจกต์ "${project.name}"`,
  });
  return project;
});
