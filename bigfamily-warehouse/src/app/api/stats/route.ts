import { withStore } from "@/db";
import { respond } from "@/lib/validate";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { stats } from "@/lib/inventory";
export function GET(req: Request) {
  return respond(() =>
    withStore(req, false, async (tx) => ({ stats: await stats(tx) })),
  );
}
