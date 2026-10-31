import type { Metadata } from "next";
import { requirePageUser } from "@/lib/auth/current-user";
import { FlexTemplatesList } from "@/components/flex-builder/flex-templates-list";

export const metadata: Metadata = { title: "Flex Message Builder" };

export default async function FlexBuilderListPage() {
  await requirePageUser("templates:view");
  return <FlexTemplatesList />;
}
