import { withStore } from "@/db";
import { respond } from "@/lib/validate";
export const dynamic = "force-dynamic";
export function GET(req: Request) {
  return respond(() =>
    withStore(req, false, async (tx) => {
      await tx.rows("SELECT id FROM products LIMIT 1");
      return { ok: true };
    }),
  );
}
