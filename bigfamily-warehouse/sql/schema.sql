-- Additive only. Run against a backup/clone first, never against an unknown database.
CREATE TABLE IF NOT EXISTS products (
  id serial PRIMARY KEY, article text NOT NULL, size text NOT NULL, color text NOT NULL,
  name text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), archived_at timestamptz
);
CREATE UNIQUE INDEX IF NOT EXISTS products_article_size_color_uq ON products(article,size,color);
CREATE TABLE IF NOT EXISTS movements (
  id serial PRIMARY KEY, product_id integer NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  type text NOT NULL CHECK(type IN ('in','out')), qty integer NOT NULL CHECK(qty>0),
  -- The old storage code is accepted only for lossless restoration of historical rows.
  channel text NOT NULL CHECK(channel IN ('wb','ozon','other')),
  note text NOT NULL DEFAULT '', day date NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
  cancelled_at timestamptz
);
ALTER TABLE products ADD COLUMN IF NOT EXISTS archived_at timestamptz;
ALTER TABLE movements ADD COLUMN IF NOT EXISTS cancelled_at timestamptz;
CREATE INDEX IF NOT EXISTS movements_product_idx ON movements(product_id);
CREATE INDEX IF NOT EXISTS movements_day_idx ON movements(day);

-- Orders are counts of customer orders, never pieces of inventory.
CREATE TABLE IF NOT EXISTS order_batches (
  id serial PRIMARY KEY,
  day date NOT NULL, channel text NOT NULL CHECK(channel IN ('wb','ozon')),
  orders_count integer NOT NULL CHECK(orders_count>0), note text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(), cancelled_at timestamptz
);
CREATE INDEX IF NOT EXISTS order_batches_day_idx ON order_batches(day,id DESC);
-- Technical retry journal; committed in the same transaction as the business write.
CREATE TABLE IF NOT EXISTS write_receipts (
  request_key text PRIMARY KEY, payload_hash text NOT NULL,
  response_body jsonb, created_at timestamptz NOT NULL DEFAULT now()
);
