import { z } from "zod";
import { route, searchParamsObject } from "@/lib/api/handler";
import { listCustomers } from "@/services/customer.service";
import { emptyToUndefined, paginationSchema, searchSchema } from "@/lib/validation/common";

const querySchema = paginationSchema.extend({
  search: z.preprocess(emptyToUndefined, searchSchema),
  following: z.preprocess(emptyToUndefined, z.enum(["all", "following", "unfollowed"]).default("all")),
});

export const GET = route({ permission: "customers:view" }, async ({ req }) => {
  return listCustomers(querySchema.parse(searchParamsObject(req)));
});
