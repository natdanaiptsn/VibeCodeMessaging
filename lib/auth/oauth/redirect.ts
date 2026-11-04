import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { appUrl } from "@/lib/env";

/** redirect ภายในระบบ (ใช้โดเมนหลักของระบบ เพื่อให้ cookie อยู่โดเมนเดียวกับ callback) */
export function redirectTo(req: NextRequest, path: string) {
  return NextResponse.redirect(new URL(path, appUrl() ?? req.nextUrl.origin));
}
