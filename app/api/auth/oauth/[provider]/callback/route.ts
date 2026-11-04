import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSession, getSession } from "@/lib/auth/session";
import { getProvider, type ProviderId } from "@/lib/auth/oauth/providers";
import { consumeFlow, exchangeCode, OAuthFlowError } from "@/lib/auth/oauth/flow";
import { redirectTo } from "@/lib/auth/oauth/redirect";
import { linkIdentity, profileFromClaims, signInWithProvider } from "@/services/sso.service";
import { claimOrphanProjects } from "@/services/project.service";
import { isEnvAdminUser } from "@/lib/auth/env-admin";
import { ApiError } from "@/lib/errors";
import { writeAudit } from "@/lib/audit";
import { getClientIp, getUserAgent } from "@/lib/request";
import { rateLimit } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";

/** ผู้ให้บริการส่งผู้ใช้กลับมาที่นี่หลังยืนยันตัวตน: GET /api/auth/oauth/{google|line}/callback?code=...&state=... */
export async function GET(req: NextRequest, ctx: { params: Promise<{ provider: string }> }) {
  const { provider: id } = await ctx.params;
  const provider = getProvider(id);
  if (!provider) return redirectTo(req, "/login?error=config");
  const ip = getClientIp(req);
  const userAgent = getUserAgent(req);
  const rl = rateLimit(`oauth:cb:${ip ?? "anon"}`, 30, 60_000);
  if (!rl.allowed) return redirectTo(req, "/login?error=rate");

  const sp = req.nextUrl.searchParams;
  let flow;
  try {
    flow = await consumeFlow(id as ProviderId, sp.get("state"));
  } catch {
    return redirectTo(req, "/login?error=state");
  }
  const fail = (code: string) =>
    redirectTo(req, flow.mode === "link" ? `/settings?tab=account&sso_error=${code}` : `/login?error=${code}`);

  const providerError = sp.get("error");
  if (providerError) return fail(providerError === "access_denied" ? "cancelled" : "provider");
  const code = sp.get("code");
  if (!code || code.length > 4000) return fail("provider");

  let profile;
  try {
    profile = profileFromClaims(provider, await exchangeCode(provider, code, flow));
  } catch (err) {
    logger.warn("OAuth callback failed", { provider: id, error: (err as Error).message });
    return fail(err instanceof OAuthFlowError ? err.code : "provider");
  }

  if (flow.mode === "link") {
    const session = await getSession();
    if (!session || session.user.id !== flow.userId) return redirectTo(req, "/login?error=state");
    try {
      await linkIdentity(session.user.id, profile);
    } catch (err) {
      return fail(err instanceof ApiError && err.status === 409 ? "taken" : "provider");
    }
    await writeAudit({
      userId: session.user.id,
      action: "auth.link_identity",
      entityType: "User",
      entityId: session.user.id,
      summary: `ผูกบัญชี ${provider.label}`,
      ip,
      userAgent,
    });
    return redirectTo(req, `/settings?tab=account&linked=${id}`);
  }

  const result = await signInWithProvider(profile);
  if (!result.ok) return fail(result.reason);
  const user = await prisma.user.update({
    where: { id: result.user.id },
    data: {
      failedLoginCount: 0,
      lockedUntil: null,
      lastLoginAt: new Date(),
      ...(profile.picture && !result.user.avatarUrl ? { avatarUrl: profile.picture } : {}),
    },
  });
  if (isEnvAdminUser(user)) await claimOrphanProjects(user.id);
  await createSession(user.id, { ip, userAgent });
  await writeAudit({
    userId: user.id,
    action: result.created ? "auth.signup" : "auth.login",
    entityType: "User",
    entityId: user.id,
    summary: `${result.created ? "สมัครและเข้าสู่ระบบ" : "เข้าสู่ระบบ"}ด้วย ${provider.label}`,
    ip,
    userAgent,
  });
  return redirectTo(req, flow.next);
}
