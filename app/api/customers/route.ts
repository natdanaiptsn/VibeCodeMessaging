import { z } from "zod";
import { projectRoute, searchParamsObject } from "@/lib/api/handler";
import { listCustomers } from "@/services/customer.service";
import { emptyToUndefined, paginationSchema, searchSchema } from "@/lib/validation/common";

const querySchema = paginationSchema.extend({
  search: z.preprocess(emptyToUndefined, searchSchema),
  following: z.preprocess(emptyToUndefined, z.enum(["all", "following", "unfollowed"]).default("all")),
});

export const GET = projectRoute({ permission: "customers:view" }, async ({ req, project }) => {
  return listCustomers(project.id, querySchema.parse(searchParamsObject(req)));
});
