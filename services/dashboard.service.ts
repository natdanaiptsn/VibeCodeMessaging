import "server-only";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/services/settings.service";
import { getLineAccountPublic } from "@/services/line-account.service";
import { queueStats } from "@/services/queue.service";

export async function getDashboardData(days = 14) {
  const settings = await getSettings();
  const tz = settings.general.timezone;
  const [{ start }] = await prisma.$queryRaw<{ start: Date }[]>`
    SELECT (date_trunc('day', now() AT TIME ZONE ${tz}::text) AT TIME ZONE ${tz}::text) AS "start"`;

  const [receivedToday, successToday, failedToday, totalCustomers, followingCustomers, activeRules, chart, recent, line, queue] =
    await Promise.all([
      prisma.message.count({ where: { direction: "INBOUND", timestamp: { gte: start } } }),
      prisma.replyLog.count({ where: { status: "SUCCESS", createdAt: { gte: start } } }),
      prisma.replyLog.count({ where: { status: "FAILED", createdAt: { gte: start } } }),
      prisma.customer.count(),
      prisma.customer.count({ where: { isFollowing: true } }),
      prisma.replyRule.count({ where: { isActive: true } }),
      prisma.$queryRaw<{ day: string; inbound: number; success: number; failed: number }[]>`
        WITH bounds AS (
          SELECT date_trunc('day', now() AT TIME ZONE ${tz}::text) AS today
        ),
        days AS (
          SELECT generate_series((SELECT today FROM bounds) - (${days}::int - 1) * interval '1 day',
                                 (SELECT today FROM bounds), interval '1 day')::date AS day
        ),
        inbound AS (
          SELECT ("timestamp" AT TIME ZONE ${tz}::text)::date AS day, count(*)::int AS c
            FROM "Message"
           WHERE "direction" = 'INBOUND'
             AND "timestamp" >= ((SELECT today FROM bounds) - (${days}::int - 1) * interval '1 day') AT TIME ZONE ${tz}::text
           GROUP BY 1
        ),
        replies AS (
          SELECT ("createdAt" AT TIME ZONE ${tz}::text)::date AS day,
                 count(*) FILTER (WHERE "status" = 'SUCCESS')::int AS success,
                 count(*) FILTER (WHERE "status" = 'FAILED')::int AS failed
            FROM "ReplyLog"
           WHERE "createdAt" >= ((SELECT today FROM bounds) - (${days}::int - 1) * interval '1 day') AT TIME ZONE ${tz}::text
           GROUP BY 1
        )
        SELECT to_char(d.day, 'YYYY-MM-DD') AS day,
               COALESCE(i.c, 0)::int AS inbound,
               COALESCE(r.success, 0)::int AS success,
               COALESCE(r.failed, 0)::int AS failed
          FROM days d
          LEFT JOIN inbound i ON i.day = d.day
          LEFT JOIN replies r ON r.day = d.day
         ORDER BY d.day`,
      prisma.message.findMany({
        where: { direction: "INBOUND" },
        orderBy: { timestamp: "desc" },
        take: 8,
        select: {
          id: true,
          type: true,
          text: true,
          status: true,
          timestamp: true,
          customer: { select: { id: true, displayName: true, pictureUrl: true, lineUserId: true } },
        },
      }),
      getLineAccountPublic(),
      queueStats(),
    ]);

  return {
    stats: { receivedToday, successToday, failedToday, totalCustomers, followingCustomers, activeRules },
    chart,
    recent,
    line: {
      connectionStatus: line.connectionStatus,
      connectionError: line.connectionError,
      lastVerifiedAt: line.lastVerifiedAt,
      lastWebhookAt: line.lastWebhookAt,
      displayName: line.displayName,
      pictureUrl: line.pictureUrl,
      basicId: line.basicId,
      configured: line.hasChannelAccessToken && line.hasChannelSecret,
    },
    autoReplyEnabled: settings.general.autoReplyEnabled,
    queue: { pending: queue.PENDING + queue.PROCESSING, failed: queue.FAILED },
    timezone: tz,
  };
}
