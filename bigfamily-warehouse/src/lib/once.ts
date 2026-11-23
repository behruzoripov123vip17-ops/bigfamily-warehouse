import "server-only";
import { createHash } from "node:crypto";
import type { Store } from "@/db";
import { fail } from "./validate";
// The unique key serializes identical retries even across concurrent PostgreSQL clients.
// A failed business write rolls back its receipt. Old API clients without a key still work.
export async function once<T>(
  tx: Store,
  req: Request,
  route: string,
  body: Record<string, unknown>,
  write: () => Promise<T>,
): Promise<T> {
  const key = req.headers.get("Idempotency-Key");
  if (key === null) return write();
  if (!/^[a-f0-9]{32}$/.test(key))
    fail("Некорректный ключ повторной отправки.");
  const hash = createHash("sha256")
    .update(
      JSON.stringify([
        route,
        Object.entries(body).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)),
      ]),
    )
    .digest("hex");
  const inserted = await tx.rows(
    "INSERT INTO write_receipts(request_key,payload_hash) VALUES($1,$2) ON CONFLICT DO NOTHING RETURNING request_key",
    [key, hash],
  );
  if (!inserted.length) {
    const [row] = await tx.rows<{ payload_hash: string; response_body: T }>(
      "SELECT payload_hash,response_body FROM write_receipts WHERE request_key=$1",
      [key],
    );
    if (!row || row.payload_hash !== hash)
      fail(
        "Эта отправка уже использована для других данных. Обновите журнал.",
        409,
      );
    return row.response_body;
  }
  const result = await write();
  await tx.rows(
    "UPDATE write_receipts SET response_body=$2::jsonb WHERE request_key=$1",
    [key, JSON.stringify(result)],
  );
  return result;
}
