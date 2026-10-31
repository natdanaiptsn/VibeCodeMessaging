import { NextResponse, type NextRequest } from "next/server";

const SESSION_COOKIE = "lineoa_session";
const PUBLIC_PATHS = ["/login"];

/**
 * ตรวจสอบเบื้องต้น (optimistic): ถ้าไม่มี session cookie ให้ไปหน้า Login
 * การตรวจสอบสิทธิ์จริงทำที่ Server Component / Route Handler ทุกครั้ง
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSession = Boolean(request.cookies.get(SESSION_COOKIE)?.value);
  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return NextResponse.next();
  if (!hasSession) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = pathname && pathname !== "/" ? `?next=${encodeURIComponent(pathname)}` : "";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|robots.txt|.*\\.(?:png|jpg|jpeg|svg|ico|webp|woff2?)$).*)"],
};
