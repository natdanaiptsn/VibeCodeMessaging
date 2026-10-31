import { route } from "@/lib/api/handler";
import { prisma } from "@/lib/prisma";
import { idParamsSchema } from "@/lib/validation/common";
import { notFound } from "@/lib/errors";

export const GET = route<{ id: string }>({ permission: "logs:view" }, async ({ params }) => {
  const { id } = idParamsSchema.parse(params);
  const log = await prisma.replyLog.findUnique({
    where: { id },
    include: {
      customer: { select: { id: true, displayName: true, pictureUrl: true, lineUserId: true, isFollowing: true } },
      sourceMessage: { select: { id: true, type: true, text: true, payload: true, timestamp: true } },
      rule: { select: { id: true, name: true, isActive: true } },
      triggeredBy: { select: { id: true, name: true } },
      webhookEvent: { select: { id: true, webhookEventId: true, type: true, isRedelivery: true, eventTimestamp: true } },
    },
  });
  if (!log) throw notFound("ไม่พบประวัติการตอบกลับ");
  const retries = await prisma.replyLog.findMany({
    where: { retryOfId: id },
    orderBy: { createdAt: "desc" },
    select: { id: true, status: true, createdAt: true, errorMessage: true },
  });
  return { ...log, retries };
});
