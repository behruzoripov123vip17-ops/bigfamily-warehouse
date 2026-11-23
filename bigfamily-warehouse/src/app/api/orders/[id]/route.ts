import { withStore } from "@/db";
import { respond, pathId } from "@/lib/validate";
import { cancelOrders } from "@/lib/orders";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return respond(async () => {
    const id = pathId((await ctx.params).id);
    return withStore(req, true, (tx) => cancelOrders(tx, id));
  });
}
