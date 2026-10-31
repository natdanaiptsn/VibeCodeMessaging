import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requirePageUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/prisma";
import { uuidSchema } from "@/lib/validation/common";
import { FlexBuilder } from "@/components/flex-builder/flex-builder";

export const metadata: Metadata = { title: "แก้ไข Flex Message" };

export default async function EditFlexPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePageUser("templates:view");
  const { id } = await params;
  if (!uuidSchema.safeParse(id).success) notFound();
  const t = await prisma.flexTemplate.findUnique({
    where: { id },
    select: { id: true, name: true, description: true, altText: true, contents: true },
  });
  if (!t) notFound();
  return <FlexBuilder key={t.id} template={t} />;
}
