/** Read-only snapshot of the original BIGFAMILY PostgreSQL tables. Never runs DDL. */
import "dotenv/config";
import { Client } from "pg";
import { writeFile } from "node:fs/promises";
const url = process.env.LEGACY_DATABASE_URL;
const output = process.argv[2];
if (!url || !output) {
  console.error(
    "Задайте LEGACY_DATABASE_URL локально и укажите имя НОВОГО JSON-файла. Пароли не пересылайте.",
  );
  process.exit(2);
}
const client = new Client({
  connectionString: url,
  connectionTimeoutMillis: 8000,
  application_name: "bigfamily_readonly_export",
});
try {
  await client.connect();
  await client.query(
    "BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY",
  );
  await client.query("SET LOCAL TIME ZONE 'UTC'");
  const existing = await client.query(
    "SELECT to_regclass('public.order_batches')::text AS orders_table",
  );
  if (existing.rows[0].orders_table) throw new Error("USE_FULL_EXPORT");
  const opts = await client.query(
    "SELECT table_name,column_name FROM information_schema.columns WHERE table_schema='public' AND table_name IN ('products','movements')",
  );
  const has = (table, column) =>
    opts.rows.some((v) => v.table_name === table && v.column_name === column);
  const optional = (t, k) => (has(t, k) ? `${k}::text` : `NULL::text AS ${k}`);
  const p = await client.query(
    `SELECT id,article,size,color,name,created_at::text,${optional("products", "archived_at")} FROM public.products ORDER BY id`,
  );
  const m = await client.query(
    `SELECT id,product_id,type,qty,channel,note,day::text,created_at::text,${optional("movements", "cancelled_at")} FROM public.movements ORDER BY id`,
  );
  // Do not silently omit extra columns added by the owner of a newer project.
  for (const { table_name: t, column_name: k } of opts.rows) {
    const expected =
      t === "products"
        ? [
            "id",
            "article",
            "size",
            "color",
            "name",
            "created_at",
            "archived_at",
          ]
        : [
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
    if (!expected.includes(k)) throw new Error("ADDITIONAL_COLUMNS");
  }
  await client.query("COMMIT");
  const doc = {
    format: "bigfamily.inventory",
    version: 1,
    source: "legacy-postgres",
    exportedAt: new Date().toISOString(),
    warehouseZone: process.env.NEXT_PUBLIC_WAREHOUSE_TZ || "Asia/Tashkent",
    products: p.rows,
    movements: m.rows,
  };
  await writeFile(output, JSON.stringify(doc, null, 2), {
    flag: "wx",
    mode: 0o600,
  });
  console.log(
    `Скопировано товаров: ${p.rowCount}; операций: ${m.rowCount}. Исходная база не изменена.`,
  );
} catch (e) {
  process.exitCode = 1;
  console.error(
    e?.code === "EEXIST"
      ? "Файл уже существует. Укажите другое имя — исходный файл оставлен без изменений."
      : e?.message === "USE_FULL_EXPORT"
        ? "Обнаружен журнал заказов. Используйте полную JSON-копию из сайта или pg_dump: старый экспорт не включает эти данные."
        : e?.message === "ADDITIONAL_COLUMNS"
          ? "Схема содержит дополнительные поля. Экспорт остановлен, чтобы не пропустить информацию. Сделайте полный pg_dump и адаптируйте перенос."
          : "Экспорт не выполнен. Проверьте ещё раз доступ только на чтение, наличие исходных таблиц и путь к файлу.",
  );
} finally {
  await client.end().catch(() => {});
}
