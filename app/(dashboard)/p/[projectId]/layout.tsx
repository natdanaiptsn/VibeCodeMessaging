import { notFound } from "next/navigation";
import { requirePageUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/prisma";
import { uuidSchema } from "@/lib/validation/common";
import { AppShell } from "@/components/layout/app-shell";
import { Providers } from "@/components/providers";
import { getSettings } from "@/services/settings.service";

/** โครงหน้าภายในโปรเจกต์ — ข้อมูลทุกหน้าเป็นของโปรเจกต์นี้เท่านั้น */
export default async function ProjectLayout({ children, params }: { children: React.ReactNode; params: Promise<{ projectId: string }> }) {
  const user = await requirePageUser();
  const { projectId } = await params;
  if (!uuidSchema.safeParse(projectId).success) notFound();
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true, name: true, isDefault: true, displayName: true, pictureUrl: true },
  });
  if (!project) notFound();
  const settings = await getSettings(project.id);
  return (
    // key: แยก cache ข้อมูลของแต่ละโปรเจกต์ (เปลี่ยนโปรเจกต์แล้วไม่เห็นข้อมูลของโปรเจกต์เดิม)
    <Providers key={project.id}>
      <AppShell user={user} timezone={settings.general.timezone} project={project}>
        {children}
      </AppShell>
    </Providers>
  );
}
