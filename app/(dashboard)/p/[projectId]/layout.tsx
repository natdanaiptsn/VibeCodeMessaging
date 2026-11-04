import { requireProjectPage } from "@/lib/auth/current-user";
import { AppShell } from "@/components/layout/app-shell";
import { Providers } from "@/components/providers";
import { getSettings } from "@/services/settings.service";

/** โครงหน้าภายในโปรเจกต์ — เฉพาะสมาชิกของโปรเจกต์ และข้อมูลทุกหน้าเป็นของโปรเจกต์นี้เท่านั้น */
export default async function ProjectLayout({ children, params }: { children: React.ReactNode; params: Promise<{ projectId: string }> }) {
  const { user, project } = await requireProjectPage(params);
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
