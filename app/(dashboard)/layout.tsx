import { requirePageUser } from "@/lib/auth/current-user";

/** ทุกหน้าในกลุ่มนี้ต้องเข้าสู่ระบบ */
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  await requirePageUser();
  return children;
}
