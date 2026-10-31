import { z } from "zod";
import { route, searchParamsObject } from "@/lib/api/handler";
import { prisma } from "@/lib/prisma";
import { dateStringSchema, emptyToUndefined, paginationSchema, searchSchema } from "@/lib/validation/common";
import { getSettings } from "@/services/settings.service";
import { dateRange } from "@/lib/dates";
import type { Prisma } from "@/lib/generated/prisma/client";

const querySchema = paginationSchema.extend({
  status: z.preprocess(emptyToUndefined, z.enum(["PENDING", "PROCESSING", "SUCCESS", "FAILED"]).optional()),
  source: z.preprocess(emptyToUndefined, z.enum(["RULE", "DEFAULT", "ADMIN", "RETRY"]).optional()),
  replyType: z.preprocess(emptyToUndefined, z.enum(["TEXT", "FLEX", "MIXED"]).optional()),
  ruleId: z.preprocess(emptyToUndefined, z.uuid().optional()),
  customerId: z.preprocess(emptyToUndefined, z.uuid().optional()),
  search: z.preprocess(emptyToUndefined, searchSchema),
  from: z.preprocess(emptyToUndefined, dateStringSchema),
  to: z.preprocess(emptyToUndefined, dateStringSchema),
});

export const GET = route({ permission: "logs:view" }, async ({ req }) => {
  const q = querySchema.parse(searchParamsObject(req));
  const { general } = await getSettings();
  const range = dateRange(q.from, q.to, general.timezone);
  const where: Prisma.ReplyLogWhereInput = {
    ...(q.status ? { status: q.status } : {}),
    ...(q.source ? { source: q.source } : {}),
    ...(q.replyType ? { replyType: q.replyType } : {}),
    ...(q.ruleId ? { ruleId: q.ruleId } : {}),
    ...(q.customerId ? { customerId: q.customerId } : {}),
    ...(range.from || range.to ? { createdAt: { ...(range.from ? { gte: range.from } : {}), ...(range.to ? { lt: range.to } : {}) } } : {}),
    ...(q.search
      ? {
          OR: [
            { ruleName: { contains: q.search, mode: "insensitive" } },
            { errorMessage: { contains: q.search, mode: "insensitive" } },
            { customer: { displayName: { contains: q.search, mode: "insensitive" } } },
            { sourceMessage: { text: { contains: q.search, mode: "insensitive" } } },
          ],
        }
      : {}),
  };
  const [items, total, counts] = await Promise.all([
    prisma.replyLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (q.page - 1) * q.pageSize,
      take: q.pageSize,
      select: {
        id: true,
        createdAt: true,
        completedAt: true,
        status: true,
        source: true,
        method: true,
        replyType: true,
        ruleId: true,
        ruleName: true,
        matchedKeyword: true,
        errorMessage: true,
        responseStatus: true,
        customer: { select: { id: true, displayName: true, pictureUrl: true, lineUserId: true } },
        sourceMessage: { select: { id: true, type: true, text: true } },
        triggeredBy: { select: { name: true } },
      },
    }),
    prisma.replyLog.count({ where }),
    prisma.replyLog.groupBy({ by: ["status"], where, _count: { _all: true } }),
  ]);
  return {
    items,
    total,
    page: q.page,
    pageSize: q.pageSize,
    counts: Object.fromEntries(counts.map((c) => [c.status, c._count._all])),
  };
});
