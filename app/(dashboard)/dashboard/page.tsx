import type { Metadata } from "next";
import { requirePageUser } from "@/lib/auth/current-user";
import { DashboardView } from "@/components/dashboard/dashboard-view";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  await requirePageUser("dashboard:view");
  return <DashboardView />;
}
