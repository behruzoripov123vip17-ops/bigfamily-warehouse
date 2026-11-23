"use client";
import { useRef, useState } from "react";
import { Download, Upload, DatabaseBackup } from "lucide-react";
import { api, message, useDemo } from "@/lib/client";
import { todayISO } from "@/lib/types";
import { Modal, useToast } from "./ui";
export default function Backup({
  open,
  close,
  shared,
}: {
  open: boolean;
  close: () => void;
  shared: boolean;
}) {
  const toast = useToast(),
    demo = useDemo();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, error] = useState("");
  const [file, select] = useState<File | null>(null);
  async function download() {
    setBusy(true);
    error("");
    try {
      const data = await api<object>("/api/backup");
      const url = URL.createObjectURL(
        new Blob([JSON.stringify(data, null, 2)], {
          type: "application/json;charset=utf-8",
        }),
      );
      const a = document.createElement("a");
      a.href = url;
      a.download = `BIGFAMILY-${demo ? "demo-" : ""}${todayISO()}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
      toast("success", "Файл резервной копии подготовлен.");
    } catch (e) {
      error(message(e));
    } finally {
      setBusy(false);
    }
  }
  async function restore() {
    if (!file) return;
    setBusy(true);
    error("");
    try {
      const result = await api<{
        products: number;
        movements: number;
        orderBatches: number;
      }>("/api/backup", { method: "POST", body: await file.text() });
      toast(
        "success",
        `Восстановлено товаров: ${result.products}, записей по вещам: ${result.movements}; записей заказов: ${result.orderBatches}.`,
      );
      select(null);
      window.location.reload();
    } catch (e) {
      error(message(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      open={open}
      onClose={() => {
        if (!busy) {
          select(null);
          error("");
          close();
        }
      }}
      title="Резервная копия"
    >
      <div className="backup-intro">
        <DatabaseBackup size={30} />
        <div>
          <b>
            {demo
              ? "Демонстрационный склад"
              : shared
                ? "Общий склад"
                : "Мой склад"}
          </b>
          <p>
            {demo
              ? "Здесь только примеры, отдельно от ваших записей."
              : shared
                ? "Если включён режим владельца — все данные лежат в базе на сервере и доступны после входа."
                : "Записи хранятся на сервере, ключ доступа — в этом браузере. Скачайте копию для переноса или восстановления."}
          </p>
        </div>
      </div>
      <p className="mb-3 text-sm text-ink/70">
        JSON включает карточки одежды, записей по вещам вещей и журнал заказов,
        в том числе архивные товары, комментарии и отмены.
      </p>
      <button className="btn primary w-full" onClick={download} disabled={busy}>
        <Download size={16} />
        Скачать копию всех записей
      </button>
      {!demo && (
        <div className="mt-5 border-t border-ink/10 pt-4">
          <h4 className="font-bold">Вернуть из файла</h4>
          <p className="my-2 text-xs leading-relaxed text-ink/65">
            Только для пустого склада. Если в каталоге или журналах уже есть
            записи, импорт не заменит их.
          </p>
          <input
            ref={input}
            type="file"
            accept=".json,application/json"
            aria-label="Файл резервной копии"
            onChange={(e) => {
              select(e.target.files?.[0] ?? null);
              error("");
            }}
            disabled={busy}
            className="backup-file"
          />
          {file && (
            <button
              className="btn primary mt-3 w-full"
              disabled={busy}
              onClick={restore}
            >
              <Upload size={15} />
              {busy ? "Проверяем…" : "Проверить и восстановить"}
            </button>
          )}
        </div>
      )}
      {err && (
        <p className="form-error" role="alert">
          {err}
        </p>
      )}
    </Modal>
  );
}
