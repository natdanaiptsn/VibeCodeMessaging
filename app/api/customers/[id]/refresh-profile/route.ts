import { route } from "@/lib/api/handler";
import { prisma } from "@/lib/prisma";
import { idParamsSchema } from "@/lib/validation/common";
import { notFound } from "@/lib/errors";
import { getLineCredentials, requireAccessToken } from "@/services/line-account.service";
import { syncCustomerProfile } from "@/services/customer.service";

export const POST = route<{ id: string }>({ permission: "customers:edit", rateLimitPerMinute: 30 }, async ({ params }) => {
  const { id } = idParamsSchema.parse(params);
  const customer = await prisma.customer.findUnique({ where: { id } });
  if (!customer) throw notFound("ไม่พบลูกค้า");
  const creds = await getLineCredentials();
  return syncCustomerProfile(customer, requireAccessToken(creds));
});
