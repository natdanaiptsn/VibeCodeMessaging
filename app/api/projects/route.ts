import { route, readJson } from "@/lib/api/handler";
import { projectCreateSchema } from "@/lib/validation/projects";
import { createProject, listProjects } from "@/services/project.service";
import { auditFromCtx } from "@/lib/audit";

/** โปรเจกต์ที่ผู้ใช้เป็นสมาชิก (ของฉัน + ที่มีคนเชิญ) */
export const GET = route({}, async ({ session }) => listProjects(session.user.id));

/** ทุกบัญชีสร้างโปรเจกต์ของตัวเองได้ — ผู้สร้างเป็นเจ้าของ */
export const POST = route({ permission: "projects:create", rateLimitPerMinute: 20 }, async (ctx) => {
  const input = projectCreateSchema.parse(await readJson(ctx.req, 4096));
  const project = await createProject(ctx.session.user.id, input);
  await auditFromCtx(ctx)({
    projectId: project.id,
    action: "project.create",
    entityType: "Project",
    entityId: project.id,
    summary: `สร้างโปรเจกต์ "${project.name}"`,
  });
  return project;
});
