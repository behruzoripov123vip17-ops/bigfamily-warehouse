import "server-only";
import type { Store } from "@/db";
import { fail, integer, object } from "./validate";
import { WAREHOUSE_ZONE, validDay, isMarketplace } from "./types";
export async function exportBackup(tx: Store) {
  const products = await tx.rows(
    "SELECT id,article,size,color,name,created_at::text,archived_at::text FROM products ORDER BY id",
  );
  const movements = await tx.rows(
    "SELECT id,product_id,type,qty,channel,note,day::text,created_at::text,cancelled_at::text FROM movements ORDER BY id",
  );
  const order_batches = await tx.rows(
    "SELECT id,day::text,channel,orders_count,note,created_at::text,cancelled_at::text FROM order_batches ORDER BY id",
  );
  return {
    format: "bigfamily.inventory",
    version: 2,
    warehouseZone: WAREHOUSE_ZONE,
    exportedAt: new Date().toISOString(),
    products,
    movements,
    order_batches,
  };
}
const pKeys = [
  "id",
  "article",
  "size",
  "color",
  "name",
  "created_at",
  "archived_at",
];
const mKeys = [
  "id",
  "product_id",
  "type",
  "qty",
  "channel",
  "note",
  "day",
  "created_at",
  "cancelled_at",
];
const oKeys = [
  "id",
  "day",
  "channel",
  "orders_count",
  "note",
  "created_at",
  "cancelled_at",
];
function record(v: unknown, keys: string[]) {
  const r = object(v);
  if (
    Object.keys(r).some((k) => !keys.includes(k)) ||
    keys.some((k) => !(k in r))
  )
    fail(
      "Набор полей копии не соответствует её версии. Ничего не импортировано.",
    );
  return r;
}
function stamp(v: unknown) {
  if (typeof v !== "string" || !v.trim() || !Number.isFinite(Date.parse(v)))
    fail("В копии некорректная метка времени.");
}
export async function importBackup(tx: Store, b: Record<string, unknown>) {
  if (b.source === "demo")
    fail(
      "Это демонстрационный файл. Для своего склада выберите копию рабочих данных.",
    );
  if (
    b.format !== "bigfamily.inventory" ||
    (b.version !== 1 && b.version !== 2) ||
    (b.version === 1 && b.order_batches !== undefined) ||
    (b.version === 2 && !Array.isArray(b.order_batches)) ||
    !Array.isArray(b.products) ||
    !Array.isArray(b.movements)
  )
    fail("Нужна полная JSON-копия BIGFAMILY версии 1 или 2.");
  await tx.rows(
    "LOCK TABLE products,movements,order_batches IN SHARE ROW EXCLUSIVE MODE",
  );
  const [ex] = await tx.rows<{ used: boolean }>(
    "SELECT EXISTS(SELECT 1 FROM products) OR EXISTS(SELECT 1 FROM movements) OR EXISTS(SELECT 1 FROM order_batches) AS used",
  );
  if (ex.used)
    fail(
      "Импорт возможен только в пустой склад. Существующие записи не заменены.",
      409,
    );
  const ids = new Set<number>();
  const mids = new Set<number>();
  const pp = b.products.map((v) => {
    const r = record(v, pKeys);
    const id = integer(r.id, "ID товара");
    if (ids.has(id)) fail("В файле повторяются номера вещей.");
    ids.add(id);
    for (const k of ["name", "article", "size", "color"])
      if (typeof r[k] !== "string" || !(r[k] as string).trim())
        fail("Неполная карточка товара в копии.");
    stamp(r.created_at);
    if (r.archived_at !== null) stamp(r.archived_at);
    return r;
  });
  const mm = b.movements.map((v) => {
    const r = record(v, mKeys);
    const id = integer(r.id, "ID операции");
    if (mids.has(id)) fail("В файле повторяются номера записей.");
    mids.add(id);
    if (!ids.has(integer(r.product_id, "ID товара")))
      fail("В операции указан отсутствующий товар.");
    integer(r.qty, "Количество вещей");
    if (
      !validDay(r.day) ||
      typeof r.note !== "string" ||
      !["in", "out"].includes(String(r.type)) ||
      (!isMarketplace(r.channel) && r.channel !== "other")
    )
      fail("Некорректные поля операции в копии.");
    stamp(r.created_at);
    if (r.cancelled_at !== null) stamp(r.cancelled_at);
    return r;
  });
  const oids = new Set<number>();
  const oo = (b.version === 2 ? (b.order_batches as unknown[]) : []).map(
    (v) => {
      const r = record(v, oKeys);
      const id = integer(r.id, "ID записи заказов");
      if (oids.has(id)) fail("В файле повторяются номера заказов.");
      oids.add(id);
      if (
        !isMarketplace(r.channel) ||
        !validDay(r.day) ||
        typeof r.note !== "string"
      )
        fail("В копии есть неправильная запись заказов.");
      integer(r.orders_count, "Сколько заказов пришло");
      stamp(r.created_at);
      if (r.cancelled_at !== null) stamp(r.cancelled_at);
      return r;
    },
  );
  // Bulk insert in bounded batches; preserve even microsecond timestamps and original IDs.
  for (const [table, rows, keys] of [
    ["products", pp, pKeys],
    ["movements", mm, mKeys],
    ["order_batches", oo, oKeys],
  ] as const) {
    for (let i = 0; i < rows.length; i += 400) {
      const block = rows.slice(i, i + 400);
      const values = block.flatMap((r) => keys.map((k) => r[k]));
      const groups = block.map(
        (_, n) =>
          `(${keys.map((__, j) => `$${n * keys.length + j + 1}`).join(",")})`,
      );
      await tx.rows(
        `INSERT INTO ${table}(${keys.join(",")}) VALUES ${groups.join(",")}`,
        values,
      );
    }
    if (rows.length)
      await tx.rows(
        `SELECT setval(pg_get_serial_sequence('${table}','id'),(SELECT max(id) FROM ${table}),true)`,
      );
  }
  return {
    ok: true,
    products: pp.length,
    movements: mm.length,
    orderBatches: oo.length,
  };
}
