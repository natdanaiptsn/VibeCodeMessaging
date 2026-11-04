import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireProjectPage } from "@/lib/auth/current-user";
import { prisma } from "@/lib/prisma";
import { uuidSchema } from "@/lib/validation/common";
import { FlexBuilder } from "@/components/flex-builder/flex-builder";

export const metadata: Metadata = { title: "แก้ไข Flex Message" };

export default async function EditFlexPage({ params }: { params: Promise<{ projectId: string; id: string }> }) {
  await requireProjectPage(params, "templates:view");
  const { projectId, id } = await params;
  if (!uuidSchema.safeParse(id).success) notFound();
  const t = await prisma.flexTemplate.findFirst({
    where: { id, projectId },
    select: { id: true, name: true, description: true, altText: true, contents: true },
  });
  if (!t) notFound();
  return <FlexBuilder key={t.id} template={t} />;
}
