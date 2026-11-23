import { once } from "@/lib/once";
import { withStore } from "@/db";
import { respond, body } from "@/lib/validate";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { products, addProduct } from "@/lib/inventory";
export function GET(req: Request) {
  return respond(() =>
    withStore(req, false, async (tx) => ({ items: await products(tx) })),
  );
}
export function POST(req: Request) {
  return respond(async () => {
    const b = await body(req);
    return withStore(req, true, (tx) =>
      once(tx, req, "products", b, () => addProduct(tx, b)),
    );
  }, 201);
}
