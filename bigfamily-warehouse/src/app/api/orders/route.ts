import { withStore } from "@/db";
import { body, respond } from "@/lib/validate";
import { addOrders, listOrders } from "@/lib/orders";
import { once } from "@/lib/once";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export function GET(req: Request) {
  return respond(() =>
    withStore(req, false, (tx) =>
      listOrders(tx, new URL(req.url).searchParams),
    ),
  );
}
export function POST(req: Request) {
  return respond(async () => {
    const b = await body(req);
    return withStore(req, true, (tx) =>
      once(tx, req, "orders", b, () => addOrders(tx, b)),
    );
  }, 201);
}
