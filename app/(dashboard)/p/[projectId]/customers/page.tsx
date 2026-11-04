import type { Metadata } from "next";
import { requireProjectPage } from "@/lib/auth/current-user";
import { CustomersView } from "@/components/customers/customers-view";

export const metadata: Metadata = { title: "ลูกค้า" };

export default async function CustomersPage({ params }: { params: Promise<{ projectId: string }> }) {
  await requireProjectPage(params, "customers:view");
  return <CustomersView />;
}
