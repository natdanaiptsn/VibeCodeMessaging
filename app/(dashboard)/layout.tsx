import { requirePageUser } from "@/lib/auth/current-user";
import { AppShell } from "@/components/layout/app-shell";
import { Providers } from "@/components/providers";
import { getSettings } from "@/services/settings.service";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await requirePageUser();
  const settings = await getSettings();
  return (
    <Providers>
      <AppShell user={user} timezone={settings.general.timezone}>
        {children}
      </AppShell>
    </Providers>
  );
}
