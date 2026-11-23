import { defineConfig } from "drizzle-kit";
// Introspection/development only. Never points at a database implicitly.
const url = process.env.BIGFAMILY_DEV_DATABASE_URL;
if (!url)
  throw new Error(
    "Укажите адрес отдельной тестовой базы в BIGFAMILY_DEV_DATABASE_URL.",
  );
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  dbCredentials: { url },
});
