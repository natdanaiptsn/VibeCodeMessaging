import { projectRoute } from "@/lib/api/handler";
import { idParamsSchema } from "@/lib/validation/common";
import { notFound } from "@/lib/errors";
import { getLineCredentials, requireAccessToken } from "@/services/line-account.service";
import { getCustomer, syncCustomerProfile } from "@/services/customer.service";

export const POST = projectRoute<{ id: string }>({ permission: "customers:edit", rateLimitPerMinute: 30 }, async ({ params, project }) => {
  const { id } = idParamsSchema.parse(params);
  const customer = await getCustomer(project.id, id);
  if (!customer) throw notFound("ไม่พบลูกค้า");
  const creds = await getLineCredentials(project.id);
  return syncCustomerProfile(customer, requireAccessToken(creds));
});
