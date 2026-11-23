import "server-only";
import type { Store } from "@/db";
import { businessDay, requiredMarketplace, integer, fail } from "./validate";
import {
  todayISO,
  type Marketplace,
  type OrderDay,
  type OrderBatch,
  type OrdersList,
} from "./types";

export async function orderDay(tx: Store, day: string): Promise<OrderDay> {
  const rows = await tx.rows<{
    channel: Marketplace;
    orders: number;
    batches: number;
  }>(
    `SELECT channel,sum(orders_count)::float8 AS orders,count(*)::int AS batches FROM order_batches WHERE day=$1 AND cancelled_at IS NULL GROUP BY channel`,
    [day],
  );
  const wb = rows.find((r) => r.channel === "wb")?.orders ?? 0,
    ozon = rows.find((r) => r.channel === "ozon")?.orders ?? 0;
  return {
    wb,
    ozon,
    total: wb + ozon,
    batches: rows.reduce((s, r) => s + r.batches, 0),
  };
}
export async function listOrders(
  tx: Store,
  params: URLSearchParams,
): Promise<OrdersList> {
  const day = businessDay(params.get("date") ?? todayISO());
  const wanted = integer(Number(params.get("page") ?? 1), "Страница");
  const [{ n: total }] = await tx.rows<{ n: number }>(
    "SELECT count(*)::int n FROM order_batches WHERE day=$1",
    [day],
  );
  const pageSize = 40;
  const page = Math.min(wanted, Math.max(1, Math.ceil(total / pageSize)));
  const items = await tx.rows<OrderBatch>(
    `SELECT id,day::text,channel,orders_count AS "ordersCount",note,created_at AS "createdAt",cancelled_at AS "cancelledAt" FROM order_batches WHERE day=$1 ORDER BY id DESC LIMIT $2 OFFSET $3`,
    [day, pageSize, (page - 1) * pageSize],
  );
  return {
    day,
    total,
    page,
    pageSize,
    items,
    summary: await orderDay(tx, day),
  };
}
export async function addOrders(tx: Store, b: Record<string, unknown>) {
  const day = businessDay(b.day ?? todayISO()),
    channel = requiredMarketplace(b.channel),
    count = integer(b.ordersCount, "Сколько заказов пришло");
  const note = b.note ?? "";
  if (typeof note !== "string" || note.length > 2000)
    fail("Комментарий должен быть строкой до 2 000 символов.");
  const [batch] = await tx.rows<{ id: number }>(
    "INSERT INTO order_batches(day,channel,orders_count,note) VALUES($1,$2,$3,$4) RETURNING id",
    [day, channel, count, note],
  );
  return { batch, summary: await orderDay(tx, day) };
}
export async function cancelOrders(tx: Store, id: number) {
  const [row] = await tx.rows<{ cancelled_at: string | null }>(
    "SELECT cancelled_at FROM order_batches WHERE id=$1 FOR UPDATE",
    [id],
  );
  if (!row) fail("Запись заказов не найдена.", 404);
  if (row.cancelled_at) fail("Запись уже отменена.", 409);
  await tx.rows("UPDATE order_batches SET cancelled_at=now() WHERE id=$1", [
    id,
  ]);
  return { ok: true };
}
