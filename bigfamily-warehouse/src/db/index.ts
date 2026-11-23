import "server-only";
import { PGlite } from "@electric-sql/pglite";
import { Pool } from "pg";
import { createHash } from "node:crypto";
import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { ownerAuthorized } from "@/lib/owner-auth";
import { fail } from "@/lib/validate";
import { todayISO, shiftDay, type Marketplace } from "@/lib/types";

export interface Store {
  rows<T extends object>(sql: string, params?: unknown[]): Promise<T[]>;
}
const g = globalThis as typeof globalThis & {
  bigfamilyDb?: Promise<PGlite>;
  bigfamilyReady?: Set<string>;
  bigfamilyPool?: Pool;
  bigfamilyPgReady?: Promise<void>;
  bigfamilySchema?: Promise<string>;
};
async function localDB() {
  if (!g.bigfamilyDb)
    g.bigfamilyDb = (async () => {
      const dir = path.resolve(
        process.env.BIGFAMILY_DATA_DIR || "data/postgres",
      );
      await mkdir(path.dirname(dir), { recursive: true });
      return await PGlite.create(dir);
    })().catch((e) => {
      g.bigfamilyDb = undefined;
      throw e;
    });
  return g.bigfamilyDb;
}
// Isolated examples: seeded only in a dedicated read-only schema, never in a real catalogue.
async function example(tx: Store) {
  const today = todayISO();
  const catalogue = [
    ["BF-1024", "M", "Графит", "Худи оверсайз", 48],
    ["BF-1031", "S", "Молочный", "Футболка Basic", 94],
    ["BF-2015", "L", "Хаки", "Брюки карго", 45],
    ["BF-1024", "L", "Бежевый", "Худи оверсайз", 76],
    ["BF-3012", "M", "Голубой", "Рубашка из хлопка", 53],
    ["BF-2020", "46", "Синий", "Джинсы прямые", 34],
  ] as const;
  for (const [
    i,
    [article, size, color, name, opening],
  ] of catalogue.entries()) {
    const date = shiftDay(today, -16);
    const [p] = await tx.rows<{ id: number }>(
      "INSERT INTO products(article,size,color,name,created_at) VALUES($1,$2,$3,$4,$5) RETURNING id",
      [article, size, color, name, date + "T09:00:00Z"],
    );
    const move = async (
      t: string,
      q: number,
      ch: Marketplace,
      note: string,
      d: string,
      h: string,
    ) => {
      await tx.rows(
        "INSERT INTO movements(product_id,type,qty,channel,note,day,created_at) VALUES($1,$2,$3,$4,$5,$6,$7)",
        [p.id, t, q, ch, note, d, d + `T${h}:00:00Z`],
      );
    };
    const exampleChannel: Marketplace = i % 2 ? "ozon" : "wb";
    await move("in", opening, exampleChannel, "Начальный остаток", date, "10");
    let stock = opening;
    for (let offset = 13; offset >= 0; offset--) {
      const d = shiftDay(today, -offset);
      if ((offset + i) % 5 === 0) {
        const q = 4 + ((i * 7 + offset) % 16);
        await move("in", q, exampleChannel, "Поставка на склад", d, "08");
        stock += q;
      }
      if ((offset + i) % 3 === 0) {
        const q = Math.min(stock - 1, 3 + ((offset * 3 + i) % 8));
        if (q > 0) {
          await move(
            "out",
            q,
            i % 2 ? "ozon" : "wb",
            "Отгрузка на маркетплейс",
            d,
            "12",
          );
          stock -= q;
        }
      }
    }
    if (i === 0 || i === 4) {
      const q = stock - (i === 0 ? 7 : 4);
      if (q > 0) await move("out", q, "wb", "Поставка FBO", today, "14");
    }
  }
  for (let i = 6; i >= 0; i--) {
    const day = shiftDay(today, -i);
    await tx.rows(
      "INSERT INTO order_batches(day,channel,orders_count,note,created_at) VALUES($1,'wb',$2,'Заказы с маркетплейсов за день',$3),($1,'ozon',$4,'Заказы с маркетплейсов за день',$5)",
      [
        day,
        i === 0 ? 320 : 85 + i * 13,
        day + "T08:00:00Z",
        i === 0 ? 180 : 40 + i * 9,
        day + "T09:00:00Z",
      ],
    );
  }
}
export async function withStore<T>(
  req: Request,
  write: boolean,
  fn: (tx: Store) => Promise<T>,
): Promise<T> {
  const shared = process.env.BIGFAMILY_SHARED === "1";
  if (shared && !process.env.BIGFAMILY_PASSWORD)
    fail("Настройте пароль владельца на сервере.", 503);
  let key = req.headers.get("x-bf-workspace") || "";
  if (shared) {
    if (!ownerAuthorized(req)) fail("Требуется вход владельца.", 401);
    key = "owner";
  }
  const demo = key === "demo";
  if (!demo && !(shared && key === "owner") && !/^[a-f0-9]{64}$/.test(key))
    fail("Открой свой склад и повтори действие.", 401);
  if (demo && write)
    fail(
      "Сейчас открыт пример. Перейди в «Мой склад» или «Вход владельца», чтобы вести свои записи.",
      403,
    );
  // Vercel Marketplace integrations expose different variable names. Prefer the
  // canonical DATABASE_URL, then the standard Vercel Postgres aliases.
  const databaseUrl =
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.POSTGRES_URL_NON_POOLING;
  // Connecting to an external PostgreSQL database is ALWAYS an explicit opt-in.
  if (
    !demo &&
    shared &&
    process.env.BIGFAMILY_OWNER_LOCAL !== "1" &&
    databaseUrl
  ) {
    // Use the provider's connection string unchanged. Neon, Supabase and
    // other PostgreSQL providers have different TLS/pooler requirements;
    // rewriting query parameters can break valid Neon connection URLs.
    const pool = (g.bigfamilyPool ??= new Pool({
      connectionString: databaseUrl,
      max: 1,
    }));
    // Initialize the warehouse schema on the first serverless connection.
    // The DDL is additive/idempotent so repeated cold starts are safe.
    if (!g.bigfamilyPgReady) {
      g.bigfamilyPgReady = (async () => {
        const client = await pool.connect();
        try {
          await client.query("BEGIN");
          await client.query(
            "SELECT pg_advisory_xact_lock(hashtext('bigfamily-warehouse-schema-v1'))",
          );
          await client.query(`CREATE TABLE IF NOT EXISTS products (
            id serial PRIMARY KEY, article text NOT NULL, size text NOT NULL,
            color text NOT NULL, name text NOT NULL,
            created_at timestamptz NOT NULL DEFAULT now(), archived_at timestamptz
          )`);
          await client.query(`CREATE TABLE IF NOT EXISTS movements (
            id serial PRIMARY KEY,
            product_id integer NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
            type text NOT NULL CHECK(type IN ('in','out')),
            qty integer NOT NULL CHECK(qty>0),
            channel text NOT NULL CHECK(channel IN ('wb','ozon','other')),
            note text NOT NULL DEFAULT '', day date NOT NULL,
            created_at timestamptz NOT NULL DEFAULT now(), cancelled_at timestamptz
          )`);
          await client.query("ALTER TABLE products ADD COLUMN IF NOT EXISTS archived_at timestamptz");
          await client.query("ALTER TABLE movements ADD COLUMN IF NOT EXISTS cancelled_at timestamptz");
          await client.query("CREATE UNIQUE INDEX IF NOT EXISTS products_article_size_color_uq ON products(article,size,color)");
          await client.query("CREATE INDEX IF NOT EXISTS movements_product_idx ON movements(product_id)");
          await client.query("CREATE INDEX IF NOT EXISTS movements_day_idx ON movements(day)");
          await client.query(`CREATE TABLE IF NOT EXISTS order_batches (
            id serial PRIMARY KEY, day date NOT NULL,
            channel text NOT NULL CHECK(channel IN ('wb','ozon')),
            orders_count integer NOT NULL CHECK(orders_count>0),
            note text NOT NULL DEFAULT '', created_at timestamptz NOT NULL DEFAULT now(),
            cancelled_at timestamptz
          )`);
          await client.query("CREATE INDEX IF NOT EXISTS order_batches_day_idx ON order_batches(day,id DESC)");
          await client.query(`CREATE TABLE IF NOT EXISTS write_receipts (
            request_key text PRIMARY KEY, payload_hash text NOT NULL,
            response_body jsonb, created_at timestamptz NOT NULL DEFAULT now()
          )`);
          await client.query("COMMIT");
        } catch (error) {
          await client.query("ROLLBACK");
          throw error;
        } finally {
          client.release();
        }
      })().catch((error) => {
        g.bigfamilyPgReady = undefined;
        throw error;
      });
    }
    await g.bigfamilyPgReady;
    const c = await pool.connect();
    try {
      await c.query(
        write ? "BEGIN" : "BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY",
      );
      await c.query("SET LOCAL search_path TO public");
      const result = await fn({
        rows: async <T extends object>(s: string, p: unknown[] = []) =>
          (await c.query<T>(s, p)).rows,
      });
      await c.query("COMMIT");
      return result;
    } catch (e) {
      await c.query("ROLLBACK");
      throw e;
    } finally {
      c.release();
    }
  }
  // Vercel serverless instances have ephemeral filesystems. Never report a
  // successful write to a per-browser PGlite database that can disappear.
  // Demo data may remain ephemeral; every real Vercel workspace must use the
  // explicitly configured shared PostgreSQL owner store.
  if (
    process.env.VERCEL === "1" &&
    !demo &&
    !(
      shared &&
      process.env.BIGFAMILY_OWNER_LOCAL !== "1" &&
      Boolean(databaseUrl)
    )
  )
    fail(
      "Постоянная база склада ещё не подключена. Владелец должен настроить PostgreSQL в Vercel.",
      503,
    );

  const schema = demo
    ? `bf_demo_orders_${todayISO().replaceAll("-", "")}`
    : shared
      ? "bf_owner"
      : `bf_${createHash("sha256").update(key).digest("hex").slice(0, 40)}`;
  const db = await localDB();
  const ready = (g.bigfamilyReady ??= new Set());
  if (!ready.has(schema)) {
    const ddl = await (g.bigfamilySchema ??= readFile(
      path.join(process.cwd(), "sql/schema.sql"),
      "utf8",
    ));
    await db.transaction(async (tx) => {
      await tx.exec(
        `CREATE SCHEMA IF NOT EXISTS "${schema}"; SET LOCAL search_path TO "${schema}";`,
      );
      await tx.exec(ddl);
      if (
        demo &&
        !(await tx.query("SELECT id FROM products LIMIT 1")).rows.length
      )
        await example({
          rows: async <T extends object>(s: string, p: unknown[] = []) =>
            (await tx.query<T>(s, p)).rows,
        });
    });
    ready.add(schema);
  }
  return db.transaction(async (tx) => {
    await tx.exec(`SET LOCAL search_path TO "${schema}";`);
    return await fn({
      rows: async <T extends object>(s: string, p: unknown[] = []) =>
        (await tx.query<T>(s, p)).rows,
    });
  });
}
