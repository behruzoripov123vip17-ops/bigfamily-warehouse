import {
  pgTable,
  jsonb,
  serial,
  text,
  integer,
  timestamp,
  date,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";

/** Какая вещь на складе: артикул + размер + цвет = уникальная позиция */
export const products = pgTable(
  "products",
  {
    id: serial("id").primaryKey(),
    article: text("article").notNull(),
    size: text("size").notNull(),
    color: text("color").notNull(),
    name: text("name").notNull(),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("products_article_size_color_uq").on(
      t.article,
      t.size,
      t.color,
    ),
  ],
);

/**
 * Записи по вещам товара:
 *  - type "in"  — приход (поставка, возврат)
 *  - type "out" — расход (отгрузка на WB / Ozon, списание)
 * Сейчас есть всегда считается автоматически: SUM(in) - SUM(out)
 */
export const movements = pgTable(
  "movements",
  {
    id: serial("id").primaryKey(),
    productId: integer("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "restrict" }),
    type: text("type").notNull(), // "in" | "out"
    qty: integer("qty").notNull(),
    channel: text("channel").notNull(), // Explicit marketplace on all new business operations; legacy codes are preserved on restore.
    note: text("note").notNull().default(""),
    day: date("day").notNull(),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("movements_product_idx").on(t.productId),
    index("movements_day_idx").on(t.day),
  ],
);

export type Product = typeof products.$inferSelect;
export type Movement = typeof movements.$inferSelect;

export const orderBatches = pgTable(
  "order_batches",
  {
    id: serial("id").primaryKey(),
    day: date("day").notNull(),
    channel: text("channel").notNull(),
    ordersCount: integer("orders_count").notNull(),
    note: text("note").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
  },
  (t) => [index("order_batches_day_idx").on(t.day, t.id.desc())],
);
export const writeReceipts = pgTable("write_receipts", {
  requestKey: text("request_key").primaryKey(),
  payloadHash: text("payload_hash").notNull(),
  responseBody: jsonb("response_body"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
