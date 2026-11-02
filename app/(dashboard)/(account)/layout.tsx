import { requirePageUser } from "@/lib/auth/current-user";
import { AccountShell } from "@/components/layout/app-shell";
import { Providers } from "@/components/providers";

/** หน้าระดับบัญชี: รายการโปรเจกต์ และตั้งค่าบัญชี/ผู้ใช้งาน */
export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const user = await requirePageUser();
  return (
    <Providers>
      <AccountShell user={user}>{children}</AccountShell>
    </Providers>
  );
}
