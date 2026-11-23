"use client";
import {
  useCallback,
  useEffect,
  useState,
  useRef,
  useSyncExternalStore,
} from "react";
import { todayISO } from "./types";
const REV = "bigfamily.revision.v2";
const PREF = "bigfamily.mode.v1",
  KEY = "bigfamily.workspace.v1";
export function isDemo() {
  try {
    return localStorage.getItem(PREF) === "demo";
  } catch {
    return false;
  }
}
const subscribe = (cb: () => void) => {
  window.addEventListener("storage", cb);
  return () => window.removeEventListener("storage", cb);
};
export function useDemo() {
  return useSyncExternalStore(subscribe, isDemo, () => false);
}
export function switchMode(demo: boolean) {
  if (demo === isDemo()) return;
  try {
    localStorage.setItem(PREF, demo ? "demo" : "mine");
  } catch {
    throw new Error(
      "Для переключения склада разрешите хранение данных в этом браузере.",
    );
  }
  window.location.reload();
}
function key() {
  if (isDemo()) return "demo";
  if (document.documentElement.dataset.storageScope === "owner") return "owner";
  try {
    let k = localStorage.getItem(KEY);
    if (!k) {
      k = Array.from(crypto.getRandomValues(new Uint8Array(32)), (x) =>
        x.toString(16).padStart(2, "0"),
      ).join("");
      localStorage.setItem(KEY, k);
    }
    return k;
  } catch {
    throw new Error(
      "Разрешите локальное хранилище браузера или откройте сайт в отдельной вкладке. Без ключа запись отключена.",
    );
  }
}
export function message(e: unknown) {
  return e instanceof Error
    ? e.message
    : "Не удалось выполнить запрос. Попробуйте ещё раз.";
}
export async function api<T>(
  url: string,
  options: RequestInit = {},
): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set("X-BF-Workspace", key());
  if (options.body) headers.set("Content-Type", "application/json");
  let r: Response;
  try {
    r = await fetch(url, { ...options, headers, cache: "no-store" });
  } catch (e) {
    if (options.signal?.aborted) throw e;
    throw new Error(
      "Нет связи с сервером. Проверьте соединение. Перед повторной записью обновите журнал.",
    );
  }
  const data = await r.json().catch(() => {
    throw new Error("Сервер временно недоступен. Повторите загрузку.");
  });
  if (!r.ok) throw new Error(data?.error || `Ошибка загрузки (${r.status}).`);
  if (
    options.method &&
    !["GET", "HEAD"].includes(options.method.toUpperCase())
  ) {
    try {
      localStorage.setItem(
        REV,
        `${Date.now()}-${crypto.getRandomValues(new Uint32Array(1))[0]}`,
      );
    } catch {
      /* Storage notification is optional; owner views also revalidate on focus. */
    }
  }
  return data as T;
}
export function useResource<T>(url: string) {
  const demo = useDemo();
  const [version, bump] = useState(0);
  const id = `${url}/${version}/${demo}`;
  const [result, set] = useState<{
    id: string;
    data?: T;
    error?: string;
  } | null>(null);
  const reload = useCallback(() => bump((n) => n + 1), []);
  useEffect(() => {
    const a = new AbortController();
    let active = true;
    let inFlight = false,
      again = false;
    const read = () => {
      if (!active) return;
      if (inFlight) {
        again = true;
        return;
      }
      inFlight = true;
      api<T>(url, { signal: a.signal })
        .then((data) => {
          if (active) set({ id, data });
        })
        .catch((e) => {
          if (active) set({ id, error: message(e) });
        })
        .finally(() => {
          inFlight = false;
          if (active && again) {
            again = false;
            read();
          }
        });
    };
    const visible = () => {
      if (document.visibilityState !== "hidden") read();
    };
    const changed = (event: StorageEvent) => {
      if (event.key === REV) read();
    };
    read();
    const timer = window.setInterval(visible, 45000);
    window.addEventListener("storage", changed);
    window.addEventListener("focus", visible);
    document.addEventListener("visibilitychange", visible);
    return () => {
      active = false;
      a.abort();
      clearInterval(timer);
      window.removeEventListener("storage", changed);
      window.removeEventListener("focus", visible);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [url, id]);
  return {
    data: result?.id === id ? result.data : undefined,
    error: result?.id === id ? result.error : undefined,
    loading: result?.id !== id,
    reload,
  };
}

// Keep one intent key for an unchanged form after a connection failure; a confirmed
// success starts a new intent, even if the user deliberately enters the same numbers.
export function useSafePost() {
  const pending = useRef<{ signature: string; token: string } | null>(null);
  return useCallback(async function post<T>(
    url: string,
    options: RequestInit,
  ): Promise<T> {
    const signature = JSON.stringify([key(), url, options.body]);
    if (!pending.current || pending.current.signature !== signature) {
      pending.current = {
        signature,
        token: Array.from(crypto.getRandomValues(new Uint8Array(16)), (v) =>
          v.toString(16).padStart(2, "0"),
        ).join(""),
      };
    }
    const intent = pending.current;
    const h = new Headers(options.headers);
    h.set("Idempotency-Key", intent.token);
    const r = await api<T>(url, { ...options, method: "POST", headers: h });
    if (pending.current === intent) pending.current = null;
    return r;
  }, []);
}
// A view left on «Сегодня» follows the warehouse's date, not the server's UTC date.
export function useBusinessDate() {
  const [today, setToday] = useState(todayISO);
  const [chosen, choose] = useState<string | null>(null);
  useEffect(() => {
    const tick = () => setToday(todayISO());
    const t = window.setInterval(tick, 15000);
    document.addEventListener("visibilitychange", tick);
    window.addEventListener("focus", tick);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", tick);
      window.removeEventListener("focus", tick);
    };
  }, []);
  return {
    day: chosen ?? today,
    today,
    setDay: (v: string) => choose(v === today ? null : v),
  };
}
