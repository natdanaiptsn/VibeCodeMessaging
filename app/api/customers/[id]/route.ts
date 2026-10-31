import { z } from "zod";
import { route, readJson } from "@/lib/api/handler";
import { prisma } from "@/lib/prisma";
import { idParamsSchema } from "@/lib/validation/common";
import { notFound } from "@/lib/errors";
import { auditFromCtx } from "@/lib/audit";

export const GET = route<{ id: string }>({ permission: "customers:view" }, async ({ params }) => {
  const { id } = idParamsSchema.parse(params);
  const customer = await prisma.customer.findUnique({ where: { id } });
  if (!customer) throw notFound("ไม่พบลูกค้า");
  const [inbound, outbound, replies] = await Promise.all([
    prisma.message.count({ where: { customerId: id, direction: "INBOUND" } }),
    prisma.message.count({ where: { customerId: id, direction: "OUTBOUND" } }),
    prisma.replyLog.groupBy({ by: ["status"], where: { customerId: id }, _count: { _all: true } }),
  ]);
  return {
    ...customer,
    stats: {
      inbound,
      outbound,
      replies: Object.fromEntries(replies.map((r) => [r.status, r._count._all])),
    },
  };
});

const patchSchema = z.object({
  note: z.string().max(2000, "บันทึกยาวเกิน 2000 ตัวอักษร").nullable(),
});

export const PATCH = route<{ id: string }>({ permission: "customers:edit" }, async (ctx) => {
  const { id } = idParamsSchema.parse(ctx.params);
  const input = patchSchema.parse(await readJson(ctx.req));
  const customer = await prisma.customer.update({ where: { id }, data: { note: input.note?.trim() || null } });
  await auditFromCtx(ctx)({ action: "customer.update_note", entityType: "Customer", entityId: id });
  return customer;
});
