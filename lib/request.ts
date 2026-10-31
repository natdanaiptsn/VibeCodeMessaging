import "server-only";
import type { NextRequest } from "next/server";
import { env } from "@/lib/env";

export function getClientIp(req: NextRequest | Request): string | null {
  const headers = req.headers;
  if (env().TRUST_PROXY) {
    const xff = headers.get("x-forwarded-for");
    if (xff) return xff.split(",")[0]!.trim().slice(0, 64);
    const real = headers.get("x-real-ip");
    if (real) return real.trim().slice(0, 64);
  }
  return null;
}

export function getUserAgent(req: NextRequest | Request): string | null {
  return req.headers.get("user-agent")?.slice(0, 500) ?? null;
}

/**
 * ป้องกัน CSRF: คำขอที่เปลี่ยนแปลงข้อมูลต้องมาจาก origin เดียวกันเท่านั้น
 * (ใช้ร่วมกับ cookie SameSite=Lax และการบังคับ Content-Type: application/json)
 */
export function isSameOrigin(req: NextRequest | Request): boolean {
  const origin = req.headers.get("origin");
  const allowedHosts = new Set<string>();
  const host = req.headers.get("host");
  if (host) allowedHosts.add(host.toLowerCase());
  if (env().TRUST_PROXY) {
    const fwd = req.headers.get("x-forwarded-host");
    if (fwd) allowedHosts.add(fwd.split(",")[0]!.trim().toLowerCase());
  }
  const app = env().APP_URL;
  if (app) {
    try {
      allowedHosts.add(new URL(app).host.toLowerCase());
    } catch {
      /* ignore */
    }
  }
  if (origin) {
    if (origin === "null") return false;
    try {
      return allowedHosts.has(new URL(origin).host.toLowerCase());
    } catch {
      return false;
    }
  }
  return req.headers.get("sec-fetch-site") === "same-origin";
}
