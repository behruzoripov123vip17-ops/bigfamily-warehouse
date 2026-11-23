import { NextRequest, NextResponse } from "next/server";
import { ownerAuthorized } from "@/lib/owner-auth";
export function proxy(req: NextRequest) {
  if (process.env.BIGFAMILY_SHARED !== "1") return NextResponse.next();
  const pass = process.env.BIGFAMILY_PASSWORD;
  if (!pass)
    return new NextResponse("Сначала настрой пароль владельца на сервере.", {
      status: 503,
    });
  if (!ownerAuthorized(req))
    return new NextResponse("Войдите в склад BIGFAMILY.", {
      status: 401,
      headers: {
        "WWW-Authenticate": 'Basic realm="BIGFAMILY", charset="UTF-8"',
      },
    });
  return NextResponse.next();
}
export const config = {
  matcher: ["/((?!_next/static|_next/image|icon.svg).*)"],
};
