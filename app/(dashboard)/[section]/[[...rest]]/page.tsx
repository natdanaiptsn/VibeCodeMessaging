import { notFound, redirect } from "next/navigation";
import { getDefaultProject } from "@/services/line-account.service";

/** ลิงก์เดิมก่อนมีระบบโปรเจกต์ (เช่น /inbox, /auto-reply) — พาไปหน้าเดียวกันของโปรเจกต์หลัก */
const LEGACY_SECTIONS = new Set(["inbox", "customers", "auto-reply", "text-messages", "flex-builder", "line-settings"]);

export default async function LegacyRedirect({
  params,
  searchParams,
}: {
  params: Promise<{ section: string; rest?: string[] }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { section, rest } = await params;
  if (!LEGACY_SECTIONS.has(section)) notFound();
  const project = await getDefaultProject();
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(await searchParams)) {
    if (typeof v === "string") qs.set(k, v);
  }
  const tail = rest?.length ? `/${rest.map(encodeURIComponent).join("/")}` : "";
  redirect(`/p/${project.id}/${section}${tail}${qs.size ? `?${qs}` : ""}`);
}
