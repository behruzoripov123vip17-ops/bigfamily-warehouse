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
  // Connecting to an external PostgreSQL database is ALWAYS an explicit opt-in.
  if (
    !demo &&
    shared &&
    process.env.BIGFAMILY_OWNER_LOCAL !== "1" &&
    process.env.DATABASE_URL
  ) {
    const pool = (g.bigfamilyPool ??= new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 5,
    }));
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
