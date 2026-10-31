import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { ZodError } from "zod";
import { ApiError, forbidden, tooManyRequests, unauthorized } from "@/lib/errors";
import { getSession, type AuthSession } from "@/lib/auth/session";
import { can, type Permission } from "@/lib/auth/permissions";
import { getClientIp, getUserAgent, isSameOrigin } from "@/lib/request";
import { rateLimit } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";

type RouteOptions = {
  /** ต้องมีสิทธิ์นี้จึงเรียกได้ (ถ้าไม่ระบุ = ต้องเข้าสู่ระบบเท่านั้น) */
  permission?: Permission;
  /** false = ไม่ต้องเข้าสู่ระบบ */
  auth?: boolean;
  /** จำนวนคำขอสูงสุดต่อนาที (ต่อผู้ใช้หรือ IP) */
  rateLimitPerMinute?: number;
  /** อนุญาต multipart/form-data (เช่น อัปโหลดไฟล์) */
  allowMultipart?: boolean;
};

export type RouteContext<P> = {
  req: NextRequest;
  params: P;
  session: AuthSession;
  ip: string | null;
  userAgent: string | null;
};

type PublicRouteContext<P> = Omit<RouteContext<P>, "session"> & { session: AuthSession | null };

const MUTATING = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export function jsonOk<T>(data: T, init?: ResponseInit) {
  return NextResponse.json({ data }, init);
}

export function jsonError(status: number, message: string, code = "ERROR", details?: unknown) {
  return NextResponse.json({ error: { message, code, ...(details !== undefined ? { details } : {}) } }, { status });
}

function formatZod(error: ZodError) {
  return error.issues.map((i) => ({ path: i.path.join("."), message: i.message }));
}

function isPrismaError(err: unknown): err is { code: string; meta?: Record<string, unknown> } {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    typeof (err as { code: unknown }).code === "string" &&
    /^P\d{4}$/.test((err as { code: string }).code)
  );
}

export function handleError(err: unknown) {
  if (err instanceof ApiError) return jsonError(err.status, err.message, err.code, err.details);
  if (err instanceof ZodError) return jsonError(400, "ข้อมูลไม่ถูกต้อง", "VALIDATION_ERROR", formatZod(err));
  if (isPrismaError(err)) {
    if (err.code === "P2002") return jsonError(409, "ข้อมูลซ้ำกับที่มีอยู่แล้ว", "DUPLICATE");
    if (err.code === "P2025") return jsonError(404, "ไม่พบข้อมูล", "NOT_FOUND");
    if (err.code === "P2003") return jsonError(409, "ไม่สามารถดำเนินการได้ เนื่องจากข้อมูลถูกใช้งานอยู่", "IN_USE");
  }
  if (err instanceof SyntaxError) return jsonError(400, "รูปแบบ JSON ไม่ถูกต้อง", "INVALID_JSON");
  if (err instanceof Error && err.name === "LineApiError") {
    const status = (err as Error & { status?: number }).status;
    return jsonError(status === 404 ? 404 : 502, err.message, "LINE_API_ERROR");
  }
  logger.error("Unhandled API error", err);
  return jsonError(500, "เกิดข้อผิดพลาดภายในระบบ", "INTERNAL_ERROR");
}

async function runChecks(req: NextRequest, opts: RouteOptions, session: AuthSession | null, ip: string | null) {
  if (MUTATING.has(req.method)) {
    if (!isSameOrigin(req)) throw forbidden("คำขอไม่ได้มาจากต้นทางที่อนุญาต (CSRF)");
    const contentType = req.headers.get("content-type") ?? "";
    const hasBody = req.headers.get("content-length") !== "0" && req.method !== "DELETE";
    if (hasBody && contentType) {
      const okType =
        contentType.includes("application/json") || (opts.allowMultipart && contentType.includes("multipart/form-data"));
      if (!okType) throw new ApiError(415, "Content-Type ไม่รองรับ", "UNSUPPORTED_MEDIA_TYPE");
    }
  }
  const who = session?.user.id ?? ip ?? "anon";
  // bucket รวมต่อผู้ใช้ (อ่าน/เขียน) + bucket แยกต่อ endpoint เมื่อกำหนด limit เฉพาะ
  const global = rateLimit(`api:${who}:${MUTATING.has(req.method) ? "w" : "r"}`, MUTATING.has(req.method) ? 120 : 600, 60_000);
  if (!global.allowed) throw tooManyRequests(undefined, global.retryAfterSec);
  if (opts.rateLimitPerMinute) {
    const scoped = rateLimit(`api:${who}:${req.method}:${req.nextUrl.pathname}`, opts.rateLimitPerMinute, 60_000);
    if (!scoped.allowed) throw tooManyRequests(undefined, scoped.retryAfterSec);
  }
}

/** Route Handler ที่ต้องเข้าสู่ระบบ — ตรวจสิทธิ์, CSRF, Rate limit และจัดการ Error ให้อัตโนมัติ */
export function route<P = Record<string, never>>(
  opts: RouteOptions,
  handler: (ctx: RouteContext<P>) => Promise<Response | unknown>,
) {
  return async (req: NextRequest, context: { params: Promise<P> }) => {
    try {
      const ip = getClientIp(req);
      const session = await getSession();
      if (!session) throw unauthorized();
      if (opts.permission && !can(session.user.role, opts.permission)) throw forbidden();
      await runChecks(req, opts, session, ip);
      const params = (await context?.params) ?? ({} as P);
      const result = await handler({ req, params, session, ip, userAgent: getUserAgent(req) });
      if (result instanceof Response) return result;
      return jsonOk(result ?? null);
    } catch (err) {
      return handleError(err);
    }
  };
}

/** Route Handler สาธารณะ (ไม่บังคับเข้าสู่ระบบ) */
export function publicRoute<P = Record<string, never>>(
  opts: Omit<RouteOptions, "permission" | "auth">,
  handler: (ctx: PublicRouteContext<P>) => Promise<Response | unknown>,
) {
  return async (req: NextRequest, context: { params: Promise<P> }) => {
    try {
      const ip = getClientIp(req);
      await runChecks(req, opts, null, ip);
      const params = (await context?.params) ?? ({} as P);
      const result = await handler({ req, params, session: null, ip, userAgent: getUserAgent(req) });
      if (result instanceof Response) return result;
      return jsonOk(result ?? null);
    } catch (err) {
      return handleError(err);
    }
  };
}

/** อ่าน JSON body พร้อมจำกัดขนาด */
export async function readJson(req: NextRequest, maxBytes = 512 * 1024): Promise<unknown> {
  const length = Number(req.headers.get("content-length") ?? "0");
  if (length > maxBytes) throw new ApiError(413, "ข้อมูลมีขนาดใหญ่เกินไป", "PAYLOAD_TOO_LARGE");
  const text = await req.text();
  if (Buffer.byteLength(text) > maxBytes) throw new ApiError(413, "ข้อมูลมีขนาดใหญ่เกินไป", "PAYLOAD_TOO_LARGE");
  if (!text) return {};
  return JSON.parse(text);
}

export function searchParamsObject(req: NextRequest): Record<string, string> {
  return Object.fromEntries(req.nextUrl.searchParams.entries());
}
