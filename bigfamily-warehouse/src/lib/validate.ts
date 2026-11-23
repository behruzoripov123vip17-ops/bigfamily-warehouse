import { validDay, todayISO, isMarketplace, type Marketplace } from "./types";
export class Fault extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export function fail(message: string, status = 400): never {
  throw new Fault(status, message);
}
export function object(v: unknown): Record<string, unknown> {
  if (!v || typeof v !== "object" || Array.isArray(v))
    fail("Ожидался объект с полями.");
  return v as Record<string, unknown>;
}
export async function body(req: Request) {
  try {
    return object(await req.json());
  } catch (e) {
    if (e instanceof Fault) throw e;
    return fail("Не удалось прочитать JSON.");
  }
}
export function text(v: unknown, label: string, limit = 240) {
  if (typeof v !== "string" || !v.trim()) fail(`Заполните поле «${label}».`);
  if (v.trim().length > limit) fail(`«${label}»: не более ${limit} символов.`);
  return v.trim();
}
export function requiredMarketplace(value: unknown): Marketplace {
  if (!isMarketplace(value))
    fail("Выберите маркетплейс: Wildberries или Ozon.");
  return value;
}
export function integer(v: unknown, label: string, min = 1) {
  if (
    typeof v !== "number" ||
    !Number.isSafeInteger(v) ||
    v < min ||
    v > 2147483647
  )
    fail(`«${label}»: укажите целое число от ${min} до 2 147 483 647.`);
  return v;
}
export function pathId(s: string) {
  if (!/^[1-9]\d*$/.test(s)) fail("Некорректный номер записи.");
  return integer(Number(s), "Номер");
}
export function businessDay(v: unknown) {
  if (!validDay(v)) fail("Укажите существующую календарную дату.");
  if (v > todayISO()) fail("Дата не может быть в будущем.");
  return v;
}
export function respond(call: () => Promise<unknown>, status = 200) {
  return call()
    .then((v) =>
      Response.json(v, {
        status,
        headers: {
          "Cache-Control": "private, no-store",
          Vary: "X-BF-Workspace",
        },
      }),
    )
    .catch((e: unknown) => {
      const code = (e as { code?: string })?.code;
      if (e instanceof Fault)
        return Response.json({ error: e.message }, { status: e.status });
      if (code === "23505")
        return Response.json(
          {
            error:
              "Такая запись уже существует. Для товара проверьте сочетание артикула, размера и цвета, в том числе в архиве.",
          },
          { status: 409 },
        );
      // Keep production diagnostics useful without ever logging request bodies,
      // connection strings, passwords, or query parameter values.
      const dbError = e as {
        code?: string;
        message?: string;
        severity?: string;
        detail?: string;
        hint?: string;
        where?: string;
        routine?: string;
      };
      const safeText = (value: unknown) =>
        typeof value === "string"
          ? value
              .replace(/postgres(?:ql)?:\/\/[^\s]+/gi, "[redacted-connection]")
              .replace(/password\s*[=:]\s*[^\s,;]+/gi, "password=[redacted]")
              .slice(0, 500)
          : undefined;
      console.error("[BIGFAMILY]", {
        code: code || "store-error",
        message: safeText(dbError.message || (e instanceof Error ? e.name : "store-error")),
        severity: safeText(dbError.severity),
        detail: safeText(dbError.detail),
        hint: safeText(dbError.hint),
        where: safeText(dbError.where),
        routine: safeText(dbError.routine),
      });
      return Response.json(
        {
          error:
            "Не удалось обратиться к хранилищу. Введённые поля сохранены в форме. Проверьте соединение и повторите запрос.",
        },
        { status: 503 },
      );
    });
}
