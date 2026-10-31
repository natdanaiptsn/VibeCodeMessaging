import type { Metadata } from "next";
import { requirePageUser } from "@/lib/auth/current-user";
import { FlexBuilder } from "@/components/flex-builder/flex-builder";
import { FLEX_PRESETS } from "@/lib/flex/presets";

export const metadata: Metadata = { title: "สร้าง Flex Message" };

export default async function NewFlexPage({ searchParams }: { searchParams: Promise<{ preset?: string }> }) {
  await requirePageUser("flex:manage");
  const { preset } = await searchParams;
  const p = FLEX_PRESETS.find((x) => x.key === preset);
  return (
    <FlexBuilder
      key={preset ?? "blank"}
      template={null}
      initialPreset={p ? { name: p.name, altText: p.altText, contents: p.contents } : undefined}
    />
  );
}
