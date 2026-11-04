import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getProvider } from "@/lib/auth/oauth/providers";
import { OAuthFlowError, startFlow, type FlowMode } from "@/lib/auth/oauth/flow";
import { redirectTo } from "@/lib/auth/oauth/redirect";
import { rateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/request";
import { logger } from "@/lib/logger";

/**
 * เริ่มเข้าสู่ระบบด้วย Google / LINE: GET /api/auth/oauth/{google|line}?next=/projects
 * ผูกบัญชีกับผู้ใช้ที่เข้าสู่ระบบอยู่: ?mode=link (ต้องกดจากหน้าเว็บของระบบเท่านั้น)
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ provider: string }> }) {
  const { provider: id } = await ctx.params;
  const provider = getProvider(id);
  if (!provider) return redirectTo(req, "/login?error=config");

  const rl = rateLimit(`oauth:start:${getClientIp(req) ?? "anon"}`, 30, 60_000);
  if (!rl.allowed) return NextResponse.json({ message: "Too many requests" }, { status: 429 });

  const mode: FlowMode = req.nextUrl.searchParams.get("mode") === "link" ? "link" : "login";
  let userId: string | null = null;
  if (mode === "link") {
    const site = req.headers.get("sec-fetch-site");
    if (site && site !== "same-origin") return redirectTo(req, "/settings?tab=account");
    const session = await getSession();
    if (!session) return redirectTo(req, "/login");
    userId = session.user.id;
  }
  try {
    const url = await startFlow(provider, {
      next: req.nextUrl.searchParams.get("next") ?? (mode === "link" ? "/settings?tab=account" : "/projects"),
      mode,
      userId,
    });
    return NextResponse.redirect(url);
  } catch (err) {
    logger.error("OAuth start failed", { provider: id, error: (err as Error).message });
    return redirectTo(req, `/login?error=${err instanceof OAuthFlowError ? err.code : "provider"}`);
  }
}
