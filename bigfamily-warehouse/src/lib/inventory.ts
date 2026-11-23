import "server-only";
import { orderDay } from "./orders";
import type { Store } from "@/db";
import {
  LOW_STOCK_THRESHOLD,
  WAREHOUSE_ZONE,
  todayISO,
  shiftDay,
  type ProductWithStock,
  type MovementRow,
  type DailyReport,
  type DashboardStats,
  type ReportLine,
  type StoredChannel,
  MARKETPLACES,
  isMarketplace,
} from "./types";
import {
  businessDay,
  fail,
  integer,
  text,
  requiredMarketplace,
} from "./validate";

const columns = `p.id, p.article, p.size, p.color, p.name, p.created_at AS "createdAt", p.archived_at AS "archivedAt",
 COALESCE(sum(m.qty) FILTER(WHERE m.type='in'),0)::float8 AS received,
 COALESCE(sum(m.qty) FILTER(WHERE m.type='out'),0)::float8 AS used,
 COALESCE(sum(CASE WHEN m.type='in' THEN m.qty ELSE -m.qty END),0)::float8 AS stock,
 (SELECT m2.channel FROM movements m2 WHERE m2.product_id=p.id AND m2.cancelled_at IS NULL AND m2.type='in' ORDER BY m2.created_at DESC, m2.id DESC LIMIT 1) AS "lastChannel"`;
export function products(tx: Store) {
  return tx.rows<ProductWithStock>(
    `SELECT ${columns} FROM products p LEFT JOIN movements m ON m.product_id=p.id AND m.cancelled_at IS NULL GROUP BY p.id ORDER BY p.article,p.size,p.color,p.id`,
  );
}
const moveCols = `m.id,m.product_id AS "productId",m.type,m.qty,m.channel,m.note,m.day::text,m.created_at AS "createdAt",m.cancelled_at AS "cancelledAt",p.name AS "productName",p.article,p.size,p.color`;
export async function journal(tx: Store, params: URLSearchParams) {
  const where: string[] = [];
  const values: unknown[] = [];
  for (const [k, choices] of [
    ["type", ["in", "out"]],
    ["channel", MARKETPLACES],
  ] as const) {
    const v = params.get(k);
    if (v && v !== "all") {
      if (!(choices as readonly string[]).includes(v))
        fail("Некорректный фильтр.");
      where.push(`m.${k}=$${values.push(v)}`);
    }
  }
  const q = params.get("q")?.trim();
  if (q) {
    where.push(
      `strpos(lower(concat_ws(' ',p.article,p.name,p.size,p.color,m.note)),lower($${values.push(q)}))>0`,
    );
  }
  const part = `FROM movements m JOIN products p ON p.id=m.product_id ${where.length ? "WHERE " + where.join(" AND ") : ""}`;
  const [{ n: total }] = await tx.rows<{ n: number }>(
    `SELECT count(*)::int n ${part}`,
    values,
  );
  const requested = integer(Number(params.get("page") ?? 1), "Страница");
  const pageSize = 40;
  const page = Math.min(requested, Math.max(1, Math.ceil(total / pageSize)));
  const items = await tx.rows<MovementRow>(
    `SELECT ${moveCols} ${part} ORDER BY m.created_at DESC,m.id DESC LIMIT ${pageSize} OFFSET $${values.length + 1}`,
    [...values, (page - 1) * pageSize],
  );
  return { items, total, page, pageSize };
}
export async function report(tx: Store, date: string): Promise<DailyReport> {
  const day = businessDay(date);
  const rows = await tx.rows<ReportLine & { archived: boolean }>(
    `SELECT p.id AS "productId",p.article,p.name,p.size,p.color,
    (p.archived_at AT TIME ZONE $2)::date < $1::date AS archived,
    COALESCE(sum(CASE WHEN m.type='in' THEN m.qty ELSE -m.qty END) FILTER(WHERE m.day < $1),0)::float8 AS opening,
    COALESCE(sum(m.qty) FILTER(WHERE m.day=$1 AND m.type='in'),0)::float8 AS received,
    COALESCE(sum(m.qty) FILTER(WHERE m.day=$1 AND m.type='out'),0)::float8 AS used
    FROM products p LEFT JOIN movements m ON m.product_id=p.id AND m.cancelled_at IS NULL AND m.day<=$1
    GROUP BY p.id HAVING (p.created_at AT TIME ZONE $2)::date <= $1 OR count(m.id)>0 ORDER BY p.name,p.article,p.size,p.color`,
    [day, WAREHOUSE_ZONE],
  );
  const lines = rows
    .filter(
      (l) => !l.archived || l.opening !== 0 || l.received !== 0 || l.used !== 0,
    )
    .map(({ archived: _, ...l }) => ({
      ...l,
      closing: l.opening + l.received - l.used,
    }));
  const totals = sumLines(lines);
  const ch = await tx.rows<{
    channel: StoredChannel;
    received: number;
    used: number;
    n: number;
  }>(
    `SELECT channel, count(*)::int n,COALESCE(sum(qty) FILTER(WHERE type='in'),0)::float8 received,COALESCE(sum(qty) FILTER(WHERE type='out'),0)::float8 used FROM movements WHERE day=$1 AND cancelled_at IS NULL GROUP BY channel ORDER BY channel`,
    [day],
  );
  return {
    day,
    lines,
    totals,
    orders: await orderDay(tx, day),
    movementsCount: ch.reduce((n, c) => n + c.n, 0),
    channels: MARKETPLACES.map((channel) => {
      const current = ch.find((c) => c.channel === channel);
      return {
        channel,
        received: current?.received ?? 0,
        used: current?.used ?? 0,
      };
    }),
    legacyMovementsCount: ch
      .filter((c) => !isMarketplace(c.channel))
      .reduce((sum, c) => sum + c.n, 0),
  };
}
function sumLines(lines: ReportLine[]) {
  return lines.reduce(
    (a, b) => ({
      opening: a.opening + b.opening,
      received: a.received + b.received,
      used: a.used + b.used,
      closing: a.closing + b.closing,
    }),
    { opening: 0, received: 0, used: 0, closing: 0 },
  );
}
export async function stats(tx: Store): Promise<DashboardStats> {
  const today = todayISO();
  const active = (await products(tx)).filter((p) => !p.archivedAt);
  const low = active
    .filter((p) => p.stock <= LOW_STOCK_THRESHOLD)
    .sort((a, b) => a.stock - b.stock || a.id - b.id);
  const days = Array.from({ length: 14 }, (_, i) => shiftDay(today, i - 13));
  const sums = await tx.rows<{ day: string; received: number; used: number }>(
    `SELECT day::text,COALESCE(sum(qty) FILTER(WHERE type='in'),0)::float8 received,COALESCE(sum(qty) FILTER(WHERE type='out'),0)::float8 used FROM movements WHERE day BETWEEN $1 AND $2 AND cancelled_at IS NULL GROUP BY day`,
    [days[0], today],
  );
  const series = days.map(
    (day) => sums.find((v) => v.day === day) || { day, received: 0, used: 0 },
  );
  const recent = await tx.rows<MovementRow>(
    `SELECT ${moveCols} FROM movements m JOIN products p ON p.id=m.product_id ORDER BY m.created_at DESC,m.id DESC LIMIT 6`,
  );
  return {
    today,
    ordersToday: await orderDay(tx, today),
    productsCount: active.length,
    totalStock: active.reduce((s, p) => s + p.stock, 0),
    todayReceived: series[13].received,
    todayUsed: series[13].used,
    lowStockCount: low.length,
    lowStock: low.slice(0, 4),
    recent,
    series,
  };
}
const fieldNames = {
  article: "Артикул",
  size: "Размер",
  color: "Цвет",
  name: "Название вещи",
};
export async function addProduct(tx: Store, b: Record<string, unknown>) {
  const fields = Object.entries(fieldNames).map(([k, l]) => text(b[k], l));
  const qty = integer(b.qty ?? 0, "Количество вещей", 0);
  const openingChannel =
    qty > 0 || b.channel !== undefined
      ? requiredMarketplace(b.channel)
      : undefined;
  const [product] = await tx.rows<{ id: number }>(
    "INSERT INTO products(article,size,color,name) VALUES ($1,$2,$3,$4) RETURNING id,article,size,color,name",
    fields,
  );
  if (qty)
    await tx.rows(
      `INSERT INTO movements(product_id,type,qty,channel,note,day) VALUES($1,'in',$2,$3,'Начальный остаток при добавлении товара',$4)`,
      [product.id, qty, openingChannel, todayISO()],
    );
  return { product };
}
async function lockProduct(tx: Store, id: number) {
  const [p] = await tx.rows<{ id: number; archived_at: string | null }>(
    "SELECT id,archived_at FROM products WHERE id=$1 FOR UPDATE",
    [id],
  );
  if (!p) fail("Какая вещь не найден.", 404);
  return p;
}
async function balance(tx: Store, id: number) {
  const [r] = await tx.rows<{ stock: number }>(
    `SELECT COALESCE(sum(CASE WHEN type='in' THEN qty ELSE -qty END),0)::float8 stock FROM movements WHERE product_id=$1 AND cancelled_at IS NULL`,
    [id],
  );
  return r.stock;
}
export async function patchProduct(
  tx: Store,
  id: number,
  b: Record<string, unknown>,
) {
  const p = await lockProduct(tx, id);
  if (b.archived === false) {
    await tx.rows("UPDATE products SET archived_at=NULL WHERE id=$1", [id]);
    return { ok: true };
  }
  if (p.archived_at) fail("Сначала верните товар из архива.", 409);
  const fields = Object.entries(fieldNames).filter(([k]) => b[k] !== undefined);
  if (!fields.length) fail("Нет изменений для сохранения.");
  const values = fields.map(([k, l]) => text(b[k], l));
  const [product] = await tx.rows(
    `UPDATE products SET ${fields.map(([k], i) => `${k}=$${i + 1}`).join(",")} WHERE id=$${fields.length + 1} RETURNING id,article,size,color,name`,
    [...values, id],
  );
  return { product };
}
export async function archiveProduct(tx: Store, id: number) {
  await lockProduct(tx, id);
  if ((await balance(tx, id)) !== 0)
    fail(
      "Скрыть можно убрать только товар с нулевым остатком. История не изменена.",
      409,
    );
  await tx.rows(
    "UPDATE products SET archived_at=COALESCE(archived_at,now()) WHERE id=$1",
    [id],
  );
  return { ok: true };
}
async function checkHistory(tx: Store, id: number) {
  const [neg] = await tx.rows<{ day: string }>(
    `SELECT day::text FROM (SELECT day,sum(sum(CASE WHEN type='in' THEN qty ELSE -qty END)) OVER(ORDER BY day) stock FROM movements WHERE product_id=$1 AND cancelled_at IS NULL GROUP BY day) s WHERE stock<0 ORDER BY day LIMIT 1`,
    [id],
  );
  if (neg)
    fail(
      `Недостаточно остатка на ${neg.day.split("-").reverse().join(".")}. Изменение не записано: склад в этот день ушёл бы в минус.`,
      409,
    );
}
export async function addMovement(tx: Store, b: Record<string, unknown>) {
  const id = integer(b.productId, "Какая вещь");
  const qty = integer(b.qty, "Количество вещей");
  const { type } = b;
  const channel = requiredMarketplace(b.channel);
  const note = b.note ?? "";
  if (type !== "in" && type !== "out") fail("Выберите приход или расход.");
  if (typeof note !== "string" || note.length > 2000)
    fail("Комментарий должен быть строкой до 2 000 символов.");
  const day = businessDay(b.day ?? todayISO());
  const p = await lockProduct(tx, id);
  if (p.archived_at)
    fail("Какая вещь в архиве. Сначала восстановите карточку.", 409);
  const stock = await balance(tx, id);
  if (type === "out" && qty > stock)
    fail(
      `Недостаточно товара: доступно ${stock} вещей, запрошено ${qty} вещей`,
      409,
    );
  const [movement] = await tx.rows(
    `INSERT INTO movements(product_id,type,qty,channel,note,day) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
    [id, type, qty, channel, note, day],
  );
  if (type === "out") await checkHistory(tx, id);
  return { movement, stockAfter: stock + (type === "in" ? qty : -qty) };
}
export async function cancelMovement(tx: Store, id: number) {
  const [ref] = await tx.rows<{ product_id: number }>(
    "SELECT product_id FROM movements WHERE id=$1",
    [id],
  );
  if (!ref) fail("Запись не найдена.", 404);
  const p = await lockProduct(tx, ref.product_id);
  if (p.archived_at)
    fail("Чтобы изменить запись, сначала верните товар из архива.", 409);
  const [m] = await tx.rows<{ type: string; cancelled_at: string | null }>(
    "SELECT type,cancelled_at FROM movements WHERE id=$1 FOR UPDATE",
    [id],
  );
  if (m.cancelled_at) fail("Эта запись уже отменена.", 409);
  await tx.rows("UPDATE movements SET cancelled_at=now() WHERE id=$1", [id]);
  if (m.type === "in") await checkHistory(tx, p.id);
  return { ok: true };
}
