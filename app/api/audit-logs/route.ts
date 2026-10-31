import { z } from "zod";
import { route, searchParamsObject } from "@/lib/api/handler";
import { prisma } from "@/lib/prisma";
import { emptyToUndefined, paginationSchema, searchSchema } from "@/lib/validation/common";

const querySchema = paginationSchema.extend({
  entityType: z.preprocess(emptyToUndefined, z.string().max(50).optional()),
  search: z.preprocess(emptyToUndefined, searchSchema),
});

export const GET = route({ permission: "audit:view" }, async ({ req }) => {
  const q = querySchema.parse(searchParamsObject(req));
  const where = {
    ...(q.entityType ? { entityType: q.entityType } : {}),
    ...(q.search
      ? {
          OR: [
            { summary: { contains: q.search, mode: "insensitive" as const } },
            { action: { contains: q.search, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };
  const [items, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (q.page - 1) * q.pageSize,
      take: q.pageSize,
      include: { user: { select: { name: true, email: true } } },
    }),
    prisma.auditLog.count({ where }),
  ]);
  return { items, total, page: q.page, pageSize: q.pageSize };
});
