"use client";

import {
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Search,
  Undo2,
  CalendarDays,
  Check,
  ClipboardList,
} from "lucide-react";
import {
  Marketplace,
  MARKETPLACES,
  CHANNEL_LABEL,
  MovementRow,
  MovementType,
  ProductWithStock,
  formatDateRu,
} from "@/lib/types";
import {
  Modal,
  ChannelPicker,
  LoadError,
  ChannelBadge,
  EmptyState,
  Field,
  Spinner,
  inputCls,
  useToast,
} from "@/components/ui";

import Link from "next/link";
import {
  api,
  message,
  useDemo,
  useResource,
  useSafePost,
  useBusinessDate,
} from "@/lib/client";
export default function MovementsPage() {
  const toast = useToast();
  const post = useSafePost();
  const demo = useDemo();
  const catalog = useResource<{ items: ProductWithStock[] }>("/api/products");
  const products = useMemo(
    () => catalog.data?.items.filter((p) => !p.archivedAt) ?? [],
    [catalog.data],
  );
  const [confirm, setConfirm] = useState<MovementRow | null>(null);
  const [cancelError, setCancelError] = useState("");
  const [undoBusy, setUndoBusy] = useState(false);
  // форма
  const [type, setType] = useState<MovementType>("in");
  const [productQuery, setProductQuery] = useState("");
  const [choice, setChoice] = useState<number | null>(null);
  const selected = products.find((p) => p.id === choice) ?? null;
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [qty, setQty] = useState("");
  const [channel, setChannel] = useState<Marketplace>("wb");
  const { day, setDay, today } = useBusinessDate();
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  // фильтры истории
  const [fType, setFType] = useState<"all" | MovementType>("all");
  const [fChannel, setFChannel] = useState<"all" | Marketplace>("all");
  const [fQuery, setFQuery] = useState("");

  const [page, setPage] = useState(1);
  const q = useDeferredValue(fQuery);
  const params = new URLSearchParams({
    type: fType,
    channel: fChannel,
    q,
    page: String(page),
  });
  const hist = useResource<{
    items: MovementRow[];
    total: number;
    page: number;
    pageSize: number;
  }>("/api/movements?" + params);
  const history = hist.data?.items;
  const filteredHistory = history ?? [];
  function refresh() {
    catalog.reload();
    hist.reload();
  }
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const suggestions = useMemo(() => {
    const q = productQuery.trim().toLowerCase();
    const base = q
      ? products.filter((p) =>
          [p.article, p.name, p.size, p.color]
            .join(" ")
            .toLowerCase()
            .includes(q),
        )
      : products;
    return base.slice(0, 8);
  }, [products, productQuery]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!selected) {
      toast("error", "Выбери вещь из списка.");
      return;
    }
    if (saving || demo) return;
    setSaving(true);
    try {
      const r = await post<{ stockAfter: number }>("/api/movements", {
        method: "POST",
        body: JSON.stringify({
          productId: selected.id,
          type,
          qty: Number(qty),
          channel,
          day,
          note,
        }),
      });
      toast(
        "success",
        `Запись записана. Сейчас есть «${selected.name}»: ${r.stockAfter} вещей`,
      );
      setQty("");
      setNote("");
      setChoice(null);
      setProductQuery("");
      setPage(1);
      refresh();
    } catch (e) {
      toast("error", message(e));
    } finally {
      setSaving(false);
    }
  }
  async function undo() {
    if (!confirm || undoBusy || demo) return;
    setUndoBusy(true);
    setCancelError("");
    try {
      await api("/api/movements/" + confirm.id, { method: "DELETE" });
      setConfirm(null);
      toast("success", "Запись отменена. Запись сохранена в журнале.");
      refresh();
    } catch (e) {
      setCancelError(message(e));
    } finally {
      setUndoBusy(false);
    }
  }
  return (
    <div className="animate-rise space-y-6">
      <header className="page-intro">
        <p className="font-mono text-xs font-bold uppercase tracking-[0.25em] text-moss">
          журнал записей · остатки считаются автоматически
        </p>
        <h1 className="mt-1 font-display text-3xl font-black sm:text-4xl">
          Пришло вещей / Ушло вещей
        </h1>
      </header>

      {catalog.error && (
        <LoadError text={catalog.error} retry={catalog.reload} />
      )}
      {/* ---------- форма записи ---------- */}
      {!demo && (
        <form
          onSubmit={submit}
          className="rounded-2xl border border-ink/8 bg-white p-5 shadow-sm sm:p-6"
        >
          {/* тип */}
          <div className="mb-5 grid grid-cols-2 gap-2 rounded-2xl bg-paper p-1.5">
            <button
              type="button"
              aria-pressed={type === "in"}
              onClick={() => setType("in")}
              className={`flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold transition ${
                type === "in"
                  ? "bg-moss text-white shadow-lg shadow-moss/25"
                  : "text-ink/50 hover:text-ink"
              }`}
            >
              <ArrowDownToLine className="h-4.5 w-4.5" />
              Пришло вещей — пришло на склад
            </button>
            <button
              type="button"
              aria-pressed={type === "out"}
              onClick={() => setType("out")}
              className={`flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold transition ${
                type === "out"
                  ? "bg-rust text-white shadow-lg shadow-rust/25"
                  : "text-ink/50 hover:text-ink"
              }`}
            >
              <ArrowUpFromLine className="h-4.5 w-4.5" />
              Ушло вещей — использовали / отгрузили
            </button>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            {/* выбор товара */}
            <div ref={boxRef} className="relative lg:col-span-2">
              <Field label="Какая вещь (начните вводить артикул или имя)">
                <div className="relative">
                  <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/35" />
                  <input
                    className={`${inputCls} pl-10`}
                    placeholder="BF-1024 или Худи оверсайз…"
                    value={
                      selected
                        ? `${selected.article} · ${selected.name} · ${selected.size} · ${selected.color}`
                        : productQuery
                    }
                    onChange={(e) => {
                      setChoice(null);
                      setProductQuery(e.target.value);
                      setDropdownOpen(true);
                    }}
                    onFocus={() => setDropdownOpen(true)}
                  />
                  {selected && (
                    <Check className="absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-moss" />
                  )}
                </div>
              </Field>
              {dropdownOpen && !selected && (
                <div className="absolute z-30 mt-1.5 max-h-72 w-full overflow-auto rounded-xl border border-ink/10 bg-white shadow-xl">
                  {suggestions.length === 0 ? (
                    <p className="px-4 py-4 text-sm text-ink/50">
                      Ничего не найдено. Добавьте товар в разделе «Какая вещьы».
                    </p>
                  ) : (
                    suggestions.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => {
                          setChoice(p.id);
                          setDropdownOpen(false);
                        }}
                        className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition hover:bg-leaf/10"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-bold">{p.name}</p>
                          <p className="font-mono text-[11px] text-ink/50">
                            {p.article} · {p.size} · {p.color}
                          </p>
                        </div>
                        <span
                          className={`font-mono text-xs font-bold ${p.stock <= 0 ? "text-rust" : "text-moss"}`}
                        >
                          {p.stock} шт
                        </span>
                      </button>
                    ))
                  )}
                </div>
              )}
              {selected && type === "out" && (
                <p className="mt-1.5 text-xs font-semibold text-ink/55">
                  Доступно к списанию:{" "}
                  <b className="font-mono text-moss">{selected.stock} шт</b>
                </p>
              )}
            </div>

            <Field label="Количество вещей, шт">
              <input
                className={`${inputCls} font-mono text-base`}
                type="number"
                step={1}
                max={type === "out" ? selected?.stock : 2147483647}
                min={1}
                placeholder={type === "in" ? "500" : "120"}
                value={qty}
                onChange={(e) => setQty(e.target.value)}
                required
              />
            </Field>

            <Field label="Дата">
              <div className="relative">
                <CalendarDays className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/35" />
                <input
                  className={`${inputCls} pl-10 font-mono`}
                  type="date"
                  value={day}
                  max={today}
                  onChange={(e) => setDay(e.target.value)}
                  required
                />
              </div>
            </Field>

            <ChannelPicker value={channel} onChange={setChannel} />

            <Field label="Примечание (если нужно)">
              <input
                className={inputCls}
                placeholder="Поставка №12 / отгрузка FBO / брак…"
                maxLength={2000}
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </Field>
          </div>

          <button
            type="submit"
            disabled={saving || !products.length}
            className={`mt-5 flex w-full items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-bold text-white transition disabled:opacity-60 sm:w-auto sm:px-10 ${
              type === "in"
                ? "bg-moss shadow-lg shadow-moss/25 hover:bg-pine"
                : "bg-rust shadow-lg shadow-rust/25 hover:bg-[#c44520]"
            }`}
          >
            {saving ? (
              <Spinner className="h-4 w-4" />
            ) : type === "in" ? (
              <ArrowDownToLine className="h-4 w-4" />
            ) : (
              <ArrowUpFromLine className="h-4 w-4" />
            )}
            {type === "in"
              ? "Сохранить запись приход"
              : "Сохранить запись расход"}
          </button>
          {!catalog.loading && !catalog.error && !products.length && (
            <p className="operation-hint">
              Сначала{" "}
              <Link className="no-data-link" href="/products">
                добавьте товар в каталог
              </Link>
              , затем запишите приход или расход.
            </p>
          )}
        </form>
      )}

      {/* ---------- история ---------- */}
      <section
        id="history"
        className="rounded-2xl border border-ink/8 bg-white shadow-sm"
      >
        <div className="flex flex-wrap items-center gap-2 border-b border-ink/8 p-4">
          <h2 className="mr-auto flex items-center gap-2 font-display text-base font-bold">
            <ClipboardList className="h-4.5 w-4.5 text-moss" /> История
          </h2>
          <select
            className="rounded-lg border border-ink/15 bg-white px-2.5 py-2 text-xs font-bold outline-none focus:border-moss"
            aria-label="Фильтр по типу"
            value={fType}
            onChange={(e) => {
              setFType(e.target.value as typeof fType);
              setPage(1);
            }}
          >
            <option value="all">Все типы</option>
            <option value="in">Только приход</option>
            <option value="out">Только расход</option>
          </select>
          <div
            role="group"
            aria-label="Фильтр по маркетплейсу"
            className="flex gap-1 rounded-lg border border-ink/15 p-1"
          >
            {MARKETPLACES.map((ch) => (
              <button
                key={ch}
                type="button"
                aria-label={`Фильтр: ${CHANNEL_LABEL[ch]}`}
                aria-pressed={fChannel === ch}
                title={
                  fChannel === ch
                    ? "Показать весь журнал"
                    : `Показать записи ${CHANNEL_LABEL[ch]}`
                }
                className={`rounded-md px-2.5 py-1 text-xs font-bold ${fChannel === ch ? "bg-pine text-white" : "text-ink/70 hover:bg-paper"}`}
                onClick={() => {
                  setFChannel((previous) => (previous === ch ? "all" : ch));
                  setPage(1);
                }}
              >
                {CHANNEL_LABEL[ch]}
              </button>
            ))}
          </div>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink/35" />
            <input
              className="w-44 rounded-lg border border-ink/15 py-2 pl-8 pr-2 text-xs font-semibold outline-none focus:border-moss"
              aria-label="Поиск в истории"
              placeholder="Поиск…"
              value={fQuery}
              onChange={(e) => {
                setFQuery(e.target.value);
                setPage(1);
              }}
            />
          </div>
        </div>

        {hist.error ? (
          <LoadError text={hist.error} retry={hist.reload} />
        ) : !history ? (
          <div className="flex justify-center py-16 text-moss">
            <Spinner className="h-7 w-7" />
          </div>
        ) : filteredHistory.length === 0 ? (
          <div className="p-6">
            <EmptyState
              icon={<ClipboardList className="h-10 w-10" />}
              title="Операций нет"
              hint={
                fQuery || fType !== "all" || fChannel !== "all"
                  ? "По этим фильтрам нет совпадений. Попробуйте другой поиск."
                  : "Запишите приход или расход через форму выше."
              }
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[780px] text-sm">
              <thead>
                <tr className="border-b border-ink/8 text-left text-[11px] font-bold uppercase tracking-wider text-ink/45">
                  <th className="px-4 py-3">Дата</th>
                  <th className="px-3 py-3">Тип записи</th>
                  <th className="px-3 py-3">Какая вещь</th>
                  <th className="px-3 py-3 text-right">Кол-во</th>
                  <th className="px-3 py-3">Канал</th>
                  <th className="px-3 py-3">Комментарий</th>
                  <th className="px-4 py-3 text-right">Отмена</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink/5">
                {filteredHistory.map((m) => (
                  <tr key={m.id} className="transition hover:bg-leaf/5">
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-xs font-semibold text-ink/60">
                      {formatDateRu(m.day)}
                    </td>
                    <td className="px-3 py-3">
                      <span
                        className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-bold ${
                          m.type === "in"
                            ? "bg-leaf/10 text-moss"
                            : "bg-rust/10 text-rust"
                        }`}
                      >
                        {m.type === "in" ? (
                          <ArrowDownToLine className="h-3 w-3" />
                        ) : (
                          <ArrowUpFromLine className="h-3 w-3" />
                        )}
                        {m.cancelledAt
                          ? "Отменена"
                          : m.type === "in"
                            ? "Пришло вещей"
                            : "Ушло вещей"}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <p className="font-bold">{m.productName}</p>
                      <p className="font-mono text-[11px] text-ink/45">
                        {m.article} · {m.size} · {m.color}
                      </p>
                    </td>
                    <td
                      className={`px-3 py-3 text-right font-mono text-base font-bold ${m.type === "in" ? "text-moss" : "text-rust"}`}
                    >
                      {m.type === "in" ? "+" : "−"}
                      {m.qty}
                    </td>
                    <td className="px-3 py-3">
                      <ChannelBadge channel={m.channel} />
                    </td>
                    <td className="table-notes max-w-[260px] px-3 py-3 text-xs text-ink/55">
                      {m.note || "—"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        title="Отменить запись"
                        disabled={demo || !!m.cancelledAt}
                        onClick={() => {
                          setCancelError("");
                          setConfirm(m);
                        }}
                        className="rounded-lg bg-ink/5 p-2 text-ink/50 transition hover:bg-rust hover:text-white"
                      >
                        <Undo2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {hist.data && hist.data.total > 0 && (
          <div className="pager">
            <span>
              Записей: {hist.data.total} · Стр. {hist.data.page} из{" "}
              {Math.ceil(hist.data.total / hist.data.pageSize)}
            </span>
            <button
              className="icon-button"
              aria-label="Предыдущая страница"
              disabled={hist.data.page === 1}
              onClick={() => setPage(hist.data!.page - 1)}
            >
              ←
            </button>
            <button
              className="icon-button"
              aria-label="Следующая страница"
              disabled={hist.data.page * hist.data.pageSize >= hist.data.total}
              onClick={() => setPage(hist.data!.page + 1)}
            >
              →
            </button>
          </div>
        )}
      </section>
      <Modal
        open={!!confirm}
        title="Отменить запись?"
        onClose={() => !undoBusy && setConfirm(null)}
      >
        {confirm && (
          <>
            <p className="text-sm leading-relaxed">
              {confirm.productName} · {confirm.type === "in" ? "+" : "−"}
              {confirm.qty} вещей · {formatDateRu(confirm.day)}. Остатки
              пересчитаются, а сама запись останется в журнале с пометкой
              «Отменена».
            </p>
            {cancelError && (
              <p className="form-error" role="alert">
                {cancelError}
              </p>
            )}
            <div className="mt-4 flex justify-end gap-2">
              <button
                className="btn light"
                onClick={() => setConfirm(null)}
                disabled={undoBusy}
              >
                Нет, оставить
              </button>
              <button
                className="btn primary"
                onClick={undo}
                disabled={undoBusy}
              >
                Да, отменить
              </button>
            </div>
          </>
        )}
      </Modal>
    </div>
  );
}
