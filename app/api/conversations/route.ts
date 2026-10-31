import { z } from "zod";
import { route, searchParamsObject } from "@/lib/api/handler";
import { listConversations } from "@/services/message.service";
import { getSettings } from "@/services/settings.service";
import { dateRange } from "@/lib/dates";
import { dateStringSchema, emptyToUndefined, paginationSchema, searchSchema } from "@/lib/validation/common";

const MESSAGE_TYPES = ["TEXT", "IMAGE", "VIDEO", "AUDIO", "FILE", "STICKER", "LOCATION", "POSTBACK", "FOLLOW", "UNFOLLOW", "FLEX", "OTHER"] as const;

const querySchema = paginationSchema.extend({
  search: z.preprocess(emptyToUndefined, searchSchema),
  messageSearch: z.preprocess(emptyToUndefined, searchSchema),
  type: z.preprocess(emptyToUndefined, z.enum(MESSAGE_TYPES).optional()),
  from: z.preprocess(emptyToUndefined, dateStringSchema),
  to: z.preprocess(emptyToUndefined, dateStringSchema),
});

export const GET = route({ permission: "inbox:view" }, async ({ req }) => {
  const q = querySchema.parse(searchParamsObject(req));
  const { general } = await getSettings();
  const range = dateRange(q.from, q.to, general.timezone);
  return listConversations({ ...q, ...range });
});
