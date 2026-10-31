import { route } from "@/lib/api/handler";
import { prisma } from "@/lib/prisma";
import { idParamsSchema } from "@/lib/validation/common";
import { badRequest, notFound } from "@/lib/errors";
import { getLineCredentials } from "@/services/line-account.service";
import { syncCustomerProfile } from "@/services/customer.service";

export const POST = route<{ id: string }>({ permission: "customers:edit", rateLimitPerMinute: 30 }, async ({ params }) => {
  const { id } = idParamsSchema.parse(params);
  const customer = await prisma.customer.findUnique({ where: { id } });
  if (!customer) throw notFound("ไม่พบลูกค้า");
  const creds = await getLineCredentials();
  if (!creds.channelAccessToken) throw badRequest("ยังไม่ได้ตั้งค่า Channel Access Token");
  return syncCustomerProfile(customer, creds.channelAccessToken);
});
