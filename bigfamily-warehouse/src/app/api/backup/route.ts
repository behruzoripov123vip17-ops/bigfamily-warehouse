import { withStore } from "@/db";
import { respond, body } from "@/lib/validate";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { exportBackup, importBackup } from "@/lib/backup";
export function GET(req: Request) {
  return respond(() =>
    withStore(req, false, async (tx) => ({
      ...(await exportBackup(tx)),
      source:
        req.headers.get("x-bf-workspace") === "demo" ? "demo" : "warehouse",
    })),
  );
}
export function POST(req: Request) {
  return respond(async () => {
    const b = await body(req);
    return withStore(req, true, (tx) => importBackup(tx, b));
  }, 201);
}
