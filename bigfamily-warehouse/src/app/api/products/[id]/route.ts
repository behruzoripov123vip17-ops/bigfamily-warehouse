import { withStore } from "@/db";
import { respond, body, pathId } from "@/lib/validate";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { patchProduct, archiveProduct } from "@/lib/inventory";
type Ctx = { params: Promise<{ id: string }> };
export function PATCH(req: Request, ctx: Ctx) {
  return respond(async () => {
    const id = pathId((await ctx.params).id);
    const b = await body(req);
    return withStore(req, true, (tx) => patchProduct(tx, id, b));
  });
}
export function DELETE(req: Request, ctx: Ctx) {
  return respond(async () => {
    const id = pathId((await ctx.params).id);
    return withStore(req, true, (tx) => archiveProduct(tx, id));
  });
}
