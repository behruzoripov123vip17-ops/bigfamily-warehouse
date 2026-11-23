// Local setup only. Never sends the password elsewhere or overwrites previous configuration.
import { randomBytes } from "node:crypto";
import { writeFile } from "node:fs/promises";
const password = randomBytes(24).toString("base64url");
try {
  await writeFile(
    ".env.local",
    `# Private owner configuration – do not share this file.\nBIGFAMILY_SHARED=1\nBIGFAMILY_OWNER_LOCAL=1\nBIGFAMILY_PASSWORD=${password}\nNEXT_PUBLIC_WAREHOUSE_TZ=Asia/Tashkent\n`,
    { flag: "wx", mode: 0o600 },
  );
  console.log(
    "Создан локальный .env.local. При запуске заработает единый защищённый склад с базой на диске.\nЛогин: owner\nПароль: " +
      password +
      "\nСохраните пароль в менеджере паролей. Не пересылайте .env.local.\nЗапуск: npm run build && npm start. Для доступа через интернет нужен HTTPS.",
  );
} catch (e) {
  console.error(
    e?.code === "EEXIST"
      ? "Файл .env.local уже существует — настройки и пароль не изменены."
      : "Не удалось сохранить локальную конфигурацию.",
  );
  process.exitCode = 1;
}
