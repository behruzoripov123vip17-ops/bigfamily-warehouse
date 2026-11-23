import { once } from "@/lib/once";
import { withStore } from "@/db";
import { respond, body } from "@/lib/validate";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { journal, addMovement } from "@/lib/inventory";
export function GET(req: Request) {
  return respond(() =>
    withStore(req, false, (tx) => journal(tx, new URL(req.url).searchParams)),
  );
}
export function POST(req: Request) {
  return respond(async () => {
    const b = await body(req);
    return withStore(req, true, (tx) =>
      once(tx, req, "movements", b, () => addMovement(tx, b)),
    );
  }, 201);
}
