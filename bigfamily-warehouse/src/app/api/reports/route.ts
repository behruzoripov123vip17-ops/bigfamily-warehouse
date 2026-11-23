import { withStore } from "@/db";
import { respond } from "@/lib/validate";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { report } from "@/lib/inventory";
import { todayISO } from "@/lib/types";
export function GET(req: Request) {
  return respond(() =>
    withStore(req, false, async (tx) => ({
      report: await report(
        tx,
        new URL(req.url).searchParams.get("date") ?? todayISO(),
      ),
    })),
  );
}
