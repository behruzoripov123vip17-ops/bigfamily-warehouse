import { withStore } from "@/db";
import { respond, pathId } from "@/lib/validate";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { cancelMovement } from "@/lib/inventory";
export function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return respond(async () => {
    const id = pathId((await ctx.params).id);
    return withStore(req, true, (tx) => cancelMovement(tx, id));
  });
}
