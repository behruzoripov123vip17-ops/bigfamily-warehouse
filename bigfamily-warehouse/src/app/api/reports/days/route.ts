import { withStore } from "@/db";
import { respond } from "@/lib/validate";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// A shortcut to recent active dates, not a limit on available reports.
export function GET(req: Request) {
  return respond(() =>
    withStore(req, false, async (tx) => ({
      days: (
        await tx.rows<{ day: string }>(
          `SELECT day::text FROM (SELECT day FROM movements UNION SELECT day FROM order_batches) d ORDER BY day DESC LIMIT 60`,
        )
      ).map((r) => r.day),
    })),
  );
}
