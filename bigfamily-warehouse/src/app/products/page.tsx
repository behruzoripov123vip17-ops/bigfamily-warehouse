"use client";

import { useMemo, useState, type FormEvent } from "react";
import {
  Shirt,
  Plus,
  Search,
  PackagePlus,
  PackageMinus,
  Pencil,
  Archive,
  ArchiveRestore,
  RefreshCw,
} from "lucide-react";
import { ProductWithStock, Marketplace, isMarketplace } from "@/lib/types";
import {
  ChannelBadge,
  ChannelPicker,
  LoadError,
  EmptyState,
  Field,
  Modal,
  Spinner,
  StockBadge,
  inputCls,
  useToast,
} from "@/components/ui";

import { api, message, useDemo, useResource, useSafePost } from "@/lib/client";
const SIZES = [
  "XS",
  "S",
  "M",
  "L",
  "XL",
  "2XL",
  "3XL",
  "42",
  "44",
  "46",
  "48",
  "50",
  "52",
  "54",
  "56",
];
const COLORS = [
  "Чёрный",
  "Белый",
  "Серый",
  "Бежевый",
  "Синий",
  "Голубой",
  "Зелёный",
  "Красный",
  "Розовый",
  "Жёлтый",
  "Коричневый",
  "Молочный",
  "Хаки",
];

type QuickOp = { product: ProductWithStock; type: "in" | "out" } | null;

export default function ProductsPage() {
  const toast = useToast();
  const post = useSafePost();
  const demo = useDemo();
  const {
    data,
    loading,
    error,
    reload: load,
  } = useResource<{ items: ProductWithStock[] }>("/api/products");
  const [archived, showArchive] = useState(false);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState("");
  const items = useMemo(
    () =>
      data?.items.filter((p) => (archived ? !!p.archivedAt : !p.archivedAt)) ??
      null,
    [data, archived],
  );
  const [query, setQuery] = useState("");

  // форма добавления
  const [form, setForm] = useState({
    article: "",
    size: "",
    color: "",
    qty: "",
    name: "",
  });
  const [openingChannel, setOpeningChannel] = useState<Marketplace>("wb");
  const [saving, setSaving] = useState(false);

  const [quickOp, setQuickOp] = useState<QuickOp>(null);
  const [opQty, setOpQty] = useState("");
  const [opChannel, setOpChannel] = useState<Marketplace>("wb");
  const [opNote, setOpNote] = useState("");
  const [opSaving, setOpSaving] = useState(false);

  const [editing, setEditing] = useState<ProductWithStock | null>(null);
  const [editForm, setEditForm] = useState({
    article: "",
    size: "",
    color: "",
    name: "",
  });
  const [deleting, setDeleting] = useState<ProductWithStock | null>(null);

  const filtered = useMemo(() => {
    if (!items) return [];
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((p) =>
      [p.article, p.name, p.size, p.color].join(" ").toLowerCase().includes(q),
    );
  }, [items, query]);

  function failure(e: unknown) {
    const t = message(e);
    setActionError(t);
    toast("error", t);
  }
  async function addProduct(e: FormEvent) {
    e.preventDefault();
    if (saving || demo) return;
    setSaving(true);
    setActionError("");
    try {
      await post("/api/products", {
        method: "POST",
        body: JSON.stringify({
          ...form,
          qty: Number(form.qty || 0),
          ...(Number(form.qty) > 0 ? { channel: openingChannel } : {}),
        }),
      });
      toast(
        "success",
        `Вещь «${form.name}» сохранена${Number(form.qty) > 0 ? ` на ${openingChannel === "wb" ? "Wildberries" : "Ozon"}` : ""}. Сейчас есть: ${form.qty || 0} вещей`,
      );
      setForm({ article: "", size: "", color: "", qty: "", name: "" });
      showArchive(false);
      setQuery("");
      load();
    } catch (e) {
      failure(e);
    } finally {
      setSaving(false);
    }
  }
  async function submitQuickOp(e: FormEvent) {
    e.preventDefault();
    if (!quickOp || opSaving || demo) return;
    setOpSaving(true);
    setActionError("");
    try {
      const r = await post<{ stockAfter: number }>("/api/movements", {
        method: "POST",
        body: JSON.stringify({
          productId: quickOp.product.id,
          type: quickOp.type,
          qty: Number(opQty),
          channel: opChannel,
          note: opNote,
        }),
      });
      toast("success", `Запись сохранена. Сейчас есть: ${r.stockAfter} вещей`);
      setQuickOp(null);
      load();
    } catch (e) {
      failure(e);
    } finally {
      setOpSaving(false);
    }
  }
  async function submitEdit(e: FormEvent) {
    e.preventDefault();
    if (!editing || busy || demo) return;
    setBusy(true);
    setActionError("");
    try {
      await api(`/api/products/${editing.id}`, {
        method: "PATCH",
        body: JSON.stringify(editForm),
      });
      setEditing(null);
      toast("success", "Карточка вещи обновлена.");
      load();
    } catch (e) {
      failure(e);
    } finally {
      setBusy(false);
    }
  }
  async function confirmDelete() {
    if (!deleting || busy || demo) return;
    setBusy(true);
    setActionError("");
    try {
      await api(`/api/products/${deleting.id}`, { method: "DELETE" });
      setDeleting(null);
      toast("success", "Вещь скрыта. История сохранена.");
      load();
    } catch (e) {
      failure(e);
    } finally {
      setBusy(false);
    }
  }
  async function restore(id: number) {
    if (busy || demo) return;
    setBusy(true);
    setActionError("");
    try {
      await api(`/api/products/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ archived: false }),
      });
      toast("success", "Вещь возвращена в список.");
      load();
    } catch (e) {
      failure(e);
    } finally {
      setBusy(false);
    }
  }
  const totalStock = (data?.items.filter((p) => !p.archivedAt) ?? []).reduce(
    (s, p) => s + p.stock,
    0,
  );

  return (
    <div className="animate-rise space-y-6">
      <header className="page-intro flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-xs font-bold uppercase tracking-[0.25em] text-moss">
            Мои вещи ·{" "}
            {data ? data.items.filter((p) => !p.archivedAt).length : "…"}{" "}
            позиций · {data ? totalStock : "…"} вещей на складе
          </p>
          <h1 className="mt-1 font-display text-3xl font-black sm:text-4xl">
            Вещи на складе
          </h1>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-2 rounded-xl border border-ink/15 bg-white px-4 py-2.5 text-sm font-bold transition hover:border-moss hover:text-moss"
        >
          <RefreshCw className="h-4 w-4" /> Обновить
        </button>
      </header>

      {error && <LoadError text={error} retry={load} />}
      {/* -------- форма добавления: 1 артикул → 2 размер → 3 цвет → 4 количество → 5 имя -------- */}
      {!demo && (
        <form
          onSubmit={addProduct}
          className="rounded-2xl border border-ink/8 bg-white p-5 shadow-sm sm:p-6"
        >
          <h2 className="mb-1 flex items-center gap-2 font-display text-base font-bold">
            <span className="rounded-lg bg-lime p-1.5 text-pine">
              <Plus className="h-4 w-4" strokeWidth={3} />
            </span>
            Добавить вещь
          </h2>
          <p className="mb-5 text-sm text-ink/50">
            Заполните поля по порядку. Сколько таких вещей уже есть сейчас сразу
            попадёт в приход — повторно записывать эту поставку не нужно.
          </p>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            <Field label="Артикул" step={1}>
              <input
                className={`${inputCls} font-mono`}
                placeholder="BF-1024"
                value={form.article}
                onChange={(e) => setForm({ ...form, article: e.target.value })}
                required
              />
            </Field>
            <Field label="Размер" step={2}>
              <input
                className={inputCls}
                placeholder="M / 46"
                list="sizes-list"
                value={form.size}
                onChange={(e) => setForm({ ...form, size: e.target.value })}
                required
              />
              <datalist id="sizes-list">
                {SIZES.map((s) => (
                  <option key={s} value={s} />
                ))}
              </datalist>
            </Field>
            <Field label="Цвет" step={3}>
              <input
                className={inputCls}
                placeholder="Чёрный"
                list="colors-list"
                value={form.color}
                onChange={(e) => setForm({ ...form, color: e.target.value })}
                required
              />
              <datalist id="colors-list">
                {COLORS.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </Field>
            <Field label="Количество вещей, шт" step={4}>
              <input
                className={`${inputCls} font-mono`}
                type="number"
                step={1}
                min={0}
                placeholder="500"
                value={form.qty}
                onChange={(e) => setForm({ ...form, qty: e.target.value })}
                required
              />
            </Field>
            <Field label="Название вещи" step={5}>
              <input
                className={inputCls}
                placeholder="Худи оверсайз"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
            </Field>
          </div>
          {Number(form.qty) > 0 && (
            <div className="mt-4 max-w-sm">
              <ChannelPicker
                value={openingChannel}
                onChange={setOpeningChannel}
                label="Маркетплейс начального остатка"
              />
            </div>
          )}
          <button
            type="submit"
            disabled={saving}
            className="mt-5 flex items-center gap-2 rounded-xl bg-pine px-6 py-3 text-sm font-bold text-lime shadow-lg shadow-pine/20 transition hover:bg-pine-2 disabled:opacity-60"
          >
            {saving ? (
              <Spinner className="h-4 w-4" />
            ) : (
              <Plus className="h-4 w-4" strokeWidth={3} />
            )}
            Сохранить вещь
          </button>
        </form>
      )}

      {/* -------- таблица -------- */}
      <section className="rounded-2xl border border-ink/8 bg-white shadow-sm">
        <div className="catalog-tabs" aria-label="Набор товаров">
          <button aria-pressed={!archived} onClick={() => showArchive(false)}>
            На складе · {data?.items.filter((p) => !p.archivedAt).length ?? "…"}
          </button>
          <button aria-pressed={archived} onClick={() => showArchive(true)}>
            Скрытые · {data?.items.filter((p) => p.archivedAt).length ?? "…"}
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-3 border-b border-ink/8 p-4">
          <div className="relative min-w-[220px] flex-1">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/35" />
            <input
              className={`${inputCls} pl-10`}
              aria-label="Поиск по каталогу"
              placeholder="Поиск: артикул, имя, размер, цвет…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <span className="font-mono text-xs font-bold text-ink/45">
            найдено: {filtered.length}
          </span>
        </div>

        {error ? (
          <p className="p-4 text-sm text-ink/60">Каталог не загружен.</p>
        ) : !items ? (
          <div className="flex justify-center py-16 text-moss">
            <Spinner className="h-7 w-7" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-6">
            <EmptyState
              icon={<Shirt className="h-10 w-10" />}
              title={
                items.length === 0
                  ? archived
                    ? "Скрытые пуст"
                    : "Список вещей пуст"
                  : "Ничего не найдено"
              }
              hint={
                items.length === 0 && archived
                  ? "Здесь будут карточки, убранные из каталога. История по ним сохраняется."
                  : items.length === 0
                    ? "Добавьте первую позицию через форму выше — например: BF-1024, M, Чёрный, 500, Худи оверсайз."
                    : "Попробуйте изменить поисковый запрос."
              }
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-sm">
              <thead>
                <tr className="border-b border-ink/8 text-left text-[11px] font-bold uppercase tracking-wider text-ink/45">
                  <th className="px-4 py-3">Какая вещь</th>
                  <th className="px-3 py-3">Размер</th>
                  <th className="px-3 py-3">Цвет</th>
                  <th className="px-3 py-3">Площадка</th>
                  <th className="px-3 py-3 text-right">Пришло вещей</th>
                  <th className="px-3 py-3 text-right">Ушло вещей</th>
                  <th className="px-3 py-3 text-center">Сейчас есть</th>
                  <th className="px-4 py-3 text-right">Действия</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink/5">
                {filtered.map((p) => (
                  <tr key={p.id} className="group transition hover:bg-leaf/5">
                    <td className="px-4 py-3">
                      <p className="font-bold">{p.name}</p>
                      <p className="font-mono text-[11px] font-semibold text-moss">
                        {p.article}
                      </p>
                    </td>
                    <td className="px-3 py-3">
                      <span className="rounded-md bg-ink/5 px-2 py-1 font-mono text-xs font-bold">
                        {p.size}
                      </span>
                    </td>
                    <td className="px-3 py-3 font-medium">{p.color}</td>
                    <td className="px-3 py-3">
                      {p.lastChannel && isMarketplace(p.lastChannel) ? (
                        <ChannelBadge channel={p.lastChannel as Marketplace} />
                      ) : (
                        <span className="text-xs text-ink/40">—</span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-right font-mono font-semibold text-moss">
                      +{p.received}
                    </td>
                    <td className="px-3 py-3 text-right font-mono font-semibold text-rust">
                      −{p.used}
                    </td>
                    <td className="px-3 py-3 text-center">
                      <StockBadge stock={p.stock} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1.5">
                        {archived ? (
                          <button
                            disabled={busy || demo}
                            title="Вернуть из архива"
                            className="btn light"
                            onClick={() => restore(p.id)}
                          >
                            <ArchiveRestore size={14} />
                            Вернуть
                          </button>
                        ) : (
                          <>
                            <button
                              disabled={demo}
                              title="Сохранить запись приход"
                              onClick={() => {
                                setActionError("");
                                setQuickOp({ product: p, type: "in" });
                                setOpQty("");
                                setOpNote("");
                              }}
                              className="rounded-lg bg-leaf/10 p-2 text-moss transition hover:bg-leaf hover:text-white"
                            >
                              <PackagePlus className="h-4 w-4" />
                            </button>
                            <button
                              disabled={demo || p.stock <= 0}
                              title="Сохранить запись расход"
                              onClick={() => {
                                setActionError("");
                                setQuickOp({ product: p, type: "out" });
                                setOpQty("");
                                setOpNote("");
                              }}
                              className="rounded-lg bg-rust/10 p-2 text-rust transition hover:bg-rust hover:text-white"
                            >
                              <PackageMinus className="h-4 w-4" />
                            </button>
                            <button
                              disabled={demo}
                              title="Изменить"
                              onClick={() => {
                                setActionError("");
                                setEditing(p);
                                setEditForm({
                                  article: p.article,
                                  size: p.size,
                                  color: p.color,
                                  name: p.name,
                                });
                              }}
                              className="rounded-lg bg-ink/5 p-2 text-ink/60 transition hover:bg-ink hover:text-white"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button
                              disabled={demo}
                              title="Скрыть"
                              onClick={() => {
                                setActionError("");
                                setDeleting(p);
                              }}
                              className="rounded-lg bg-ink/5 p-2 text-ink/60 transition hover:bg-rust hover:text-white"
                            >
                              <Archive className="h-4 w-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* -------- модалка приход/расход -------- */}
      <Modal
        open={!!quickOp}
        onClose={() => !opSaving && setQuickOp(null)}
        title={
          quickOp?.type === "in" ? "Пришло вещей товара" : "Ушло вещей товара"
        }
      >
        {quickOp && (
          <form onSubmit={submitQuickOp} className="space-y-4">
            {actionError && (
              <p role="alert" className="form-error">
                {actionError}
              </p>
            )}
            <div className="rounded-xl bg-paper px-4 py-3">
              <p className="text-sm font-bold">{quickOp.product.name}</p>
              <p className="font-mono text-xs text-ink/50">
                {quickOp.product.article} · {quickOp.product.size} ·{" "}
                {quickOp.product.color}
              </p>
              <p className="mt-1 text-xs font-semibold text-ink/60">
                Текущий остаток:{" "}
                <span className="font-mono">{quickOp.product.stock} шт</span>
              </p>
            </div>
            <Field label="Количество вещей, шт">
              <input
                className={`${inputCls} font-mono`}
                type="number"
                step={1}
                min={1}
                max={quickOp.type === "out" ? quickOp.product.stock : undefined}
                placeholder="100"
                value={opQty}
                onChange={(e) => setOpQty(e.target.value)}
                required
                autoFocus
              />
            </Field>
            <ChannelPicker value={opChannel} onChange={setOpChannel} />
            <Field label="Примечание (если нужно)">
              <input
                className={inputCls}
                placeholder="Например: поставка №12 / отгрузка FBO"
                maxLength={2000}
                value={opNote}
                onChange={(e) => setOpNote(e.target.value)}
              />
            </Field>
            <button
              type="submit"
              disabled={opSaving}
              className={`w-full rounded-xl py-3 text-sm font-bold text-white transition disabled:opacity-60 ${
                quickOp.type === "in"
                  ? "bg-moss hover:bg-pine"
                  : "bg-rust hover:bg-[#c44520]"
              }`}
            >
              {opSaving
                ? "Сохраняем…"
                : quickOp.type === "in"
                  ? "Сохранить запись приход"
                  : "Сохранить запись расход"}
            </button>
          </form>
        )}
      </Modal>

      {/* -------- модалка редактирования -------- */}
      <Modal
        open={!!editing}
        onClose={() => !busy && setEditing(null)}
        title="Изменить товар"
      >
        <form onSubmit={submitEdit} className="space-y-4">
          {actionError && (
            <p role="alert" className="form-error">
              {actionError}
            </p>
          )}
          <Field label="Артикул">
            <input
              className={`${inputCls} font-mono`}
              value={editForm.article}
              onChange={(e) =>
                setEditForm({ ...editForm, article: e.target.value })
              }
              required
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Размер">
              <input
                className={inputCls}
                value={editForm.size}
                onChange={(e) =>
                  setEditForm({ ...editForm, size: e.target.value })
                }
                required
              />
            </Field>
            <Field label="Цвет">
              <input
                className={inputCls}
                value={editForm.color}
                onChange={(e) =>
                  setEditForm({ ...editForm, color: e.target.value })
                }
                required
              />
            </Field>
          </div>
          <Field label="Название вещи">
            <input
              className={inputCls}
              value={editForm.name}
              onChange={(e) =>
                setEditForm({ ...editForm, name: e.target.value })
              }
              required
            />
          </Field>
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-xl bg-pine py-3 text-sm font-bold text-lime transition hover:bg-pine-2"
          >
            Сохранить
          </button>
        </form>
      </Modal>

      {/* -------- модалка удаления -------- */}
      <Modal
        open={!!deleting}
        onClose={() => !busy && setDeleting(null)}
        title="Переместить в архив?"
      >
        {deleting && (
          <div className="space-y-4">
            {actionError && (
              <p role="alert" className="form-error">
                {actionError}
              </p>
            )}
            <p className="text-sm leading-relaxed text-ink/70">
              Карточка <b>«{deleting.name}»</b>{" "}
              <span className="font-mono text-xs">
                ({deleting.article}, {deleting.size}, {deleting.color})
              </span>{" "}
              будет скрыта из активного каталога. История сохранится, а товар
              можно вернуть из вкладки «Скрытые». Сейчас есть должен быть
              нулевым.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setDeleting(null)}
                className="rounded-xl border border-ink/15 py-3 text-sm font-bold transition hover:bg-ink/5"
              >
                Отмена
              </button>
              <button
                onClick={confirmDelete}
                disabled={busy}
                className="rounded-xl bg-rust py-3 text-sm font-bold text-white transition hover:bg-[#c44520]"
              >
                Скрыть
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
