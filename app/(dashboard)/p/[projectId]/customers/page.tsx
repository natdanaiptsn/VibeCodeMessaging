import type { Metadata } from "next";
import { requirePageUser } from "@/lib/auth/current-user";
import { CustomersView } from "@/components/customers/customers-view";

export const metadata: Metadata = { title: "ลูกค้า" };

export default async function CustomersPage() {
  await requirePageUser("customers:view");
  return <CustomersView />;
}
