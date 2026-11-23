"use client";

import { useState } from "react";
import {
  Printer,
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  Boxes,
  PackagePlus,
  PackageMinus,
  Warehouse,
} from "lucide-react";
import {
  CHANNEL_LABEL,
  DailyReport,
  formatDateRu,
  shiftDay,
  validDay,
  WAREHOUSE_ZONE,
} from "@/lib/types";
import { ChannelBadge, Spinner, inputCls, LoadError } from "@/components/ui";

import ReportLedger from "@/components/ReportLedger";
import { useBusinessDate, useDemo, useResource } from "@/lib/client";
export default function ReportsPage() {
  const { day, setDay, today } = useBusinessDate();
  const archive = useResource<{ days: string[] }>("/api/reports/days");
  const demo = useDemo();
  const { data, loading, error, reload } = useResource<{ report: DailyReport }>(
    "/api/reports?date=" + encodeURIComponent(day),
  );
  const report = data?.report;
  const [onlyActive, setOnlyActive] = useState(false);
  const isToday = day === today;
  return (
    <div className="animate-rise space-y-6">
      {/* ---------- панель управления (не печатается) ---------- */}
      <header className="page-intro no-print flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-xs font-bold uppercase tracking-[0.25em] text-moss">
            Отчёт за день
          </p>
          <h1 className="mt-1 font-display text-3xl font-black sm:text-4xl">
            Отчёт за день
          </h1>
        </div>
        <button
          onClick={() => window.print()}
          disabled={!report || loading}
          className="flex items-center gap-2 rounded-xl bg-pine px-6 py-3 text-sm font-bold text-lime shadow-lg shadow-pine/20 transition hover:bg-pine-2 disabled:opacity-50"
        >
          <Printer className="h-4.5 w-4.5" />
          Напечатать / сохранить PDF
        </button>
      </header>

      <div className="no-print flex flex-wrap items-center gap-3 rounded-2xl border border-ink/8 bg-white p-4 shadow-sm">
        <button
          disabled={day <= "0001-01-01"}
          onClick={() => setDay(shiftDay(day, -1))}
          className="rounded-xl border border-ink/15 p-2.5 transition hover:border-moss hover:text-moss"
          title="Предыдущий день"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <div className="relative">
          <CalendarDays className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/35" />
          <input
            type="date"
            min="0001-01-01"
            aria-label="Какой день показать"
            className={`${inputCls} w-48 pl-10 font-mono`}
            value={day}
            max={today}
            onChange={(e) =>
              validDay(e.target.value) &&
              e.target.value <= today &&
              setDay(e.target.value)
            }
          />
        </div>
        <button
          onClick={() => setDay(shiftDay(day, 1))}
          disabled={isToday}
          className="rounded-xl border border-ink/15 p-2.5 transition hover:border-moss hover:text-moss disabled:opacity-40"
          title="Следующий день"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
        <button
          onClick={() => setDay(today)}
          className={`rounded-xl px-4 py-2.5 text-sm font-bold transition ${
            isToday
              ? "bg-lime text-pine"
              : "border border-ink/15 hover:border-moss hover:text-moss"
          }`}
        >
          Сегодня
        </button>
        {!!archive.data?.days.length && (
          <select
            aria-label="Дни, где есть записи"
            value=""
            className="report-dates-select"
            onChange={(e) => {
              if (validDay(e.target.value)) setDay(e.target.value);
            }}
          >
            <option value="" disabled>
              Дни, где есть записи
            </option>
            {archive.data.days.map((d) => (
              <option key={d} value={d}>
                {formatDateRu(d)}
              </option>
            ))}
          </select>
        )}
        <label className="ml-auto flex cursor-pointer items-center gap-2 text-sm font-semibold text-ink/60">
          <input
            type="checkbox"
            checked={onlyActive}
            onChange={(e) => setOnlyActive(e.target.checked)}
            className="h-4 w-4 accent-[#1c6b52]"
          />
          На экране показать только вещи, по которым было запись
        </label>
      </div>

      <p className="report-print-note no-print">
        <Printer size={14} />
        На печать выходят все позиции за выбранный день, даже если на экране
        включён фильтр.
      </p>
      {/* ---------- печатная область ---------- */}
      {error ? (
        <LoadError text={error} retry={reload} />
      ) : loading || !report ? (
        <div className="no-print flex h-64 items-center justify-center text-moss">
          <Spinner className="h-8 w-8" />
        </div>
      ) : (
        <div className="print-root print-card rounded-2xl border border-ink/8 bg-white p-6 shadow-sm sm:p-8">
          {/* шапка отчёта */}
          <div className="flex flex-wrap items-start justify-between gap-4 border-b-2 border-ink pb-5">
            <div className="flex items-center gap-3">
              <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-pine text-lime">
                <Boxes className="h-7 w-7" />
              </span>
              <div>
                <p className="font-display text-lg font-black tracking-wide">
                  BIGFAMILY
                </p>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-ink/50">
                  {demo ? "Пример отчёта · " : "Учёт BIGFAMILY · "}WB / Ozon
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="font-display text-base font-bold">
                Отчёт за {formatDateRu(report.day)}
              </p>
              <p className="font-mono text-xs text-ink/50">
                записей по вещам: {report.movementsCount}
              </p>
            </div>
          </div>

          {/* Главные цифры не зависит от фильтра строк ниже. */}
          <h2 className="mt-5 mb-2 text-xs font-bold uppercase tracking-wider text-ink/60">
            Главные цифры за день
          </h2>
          <div className="report-metrics grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              {
                label: "Сейчас есть на утро",
                value: report.totals.opening,
                icon: Warehouse,
                cls: "text-ink",
              },
              {
                label: "Пришло за день, вещей",
                value: report.totals.received,
                icon: PackagePlus,
                cls: "text-moss",
              },
              {
                label: "Отгружено / использовано, вещей",
                value: report.totals.used,
                icon: PackageMinus,
                cls: "text-rust",
              },
              {
                label: "Сейчас есть на вечер",
                value: report.totals.closing,
                icon: Boxes,
                cls: "text-pine",
              },
            ].map((c) => (
              <div
                key={c.label}
                className="rounded-xl border border-ink/10 px-4 py-3"
              >
                <c.icon className={`mb-1.5 h-4.5 w-4.5 ${c.cls}`} />
                <p
                  className={`font-display text-xl font-black tabular-nums ${c.cls}`}
                >
                  {c.value} <span className="text-xs font-bold">шт</span>
                </p>
                <p className="text-[11px] font-bold uppercase tracking-wider text-ink/50">
                  {c.label}
                </p>
              </div>
            ))}
          </div>

          <ReportLedger report={report} onlyActive={onlyActive} />
          {report.legacyMovementsCount > 0 && (
            <p className="report-source-note">
              В общих итогах учтены старые записи без указанного маркетплейса:{" "}
              {report.legacyMovementsCount}. Они не распределены между
              площадками.
            </p>
          )}
          {/* подписи — видны только при печати */}
          <div className="print-sign mt-12 justify-between gap-8 text-sm">
            <div className="flex-1">
              <p className="border-t border-black pt-1">
                Составил: ______________________
              </p>
            </div>
            <div className="flex-1">
              <p className="border-t border-black pt-1">
                Проверил: ______________________
              </p>
            </div>
            <div>
              <p className="border-t border-black pt-1">
                Дата: {formatDateRu(report.day)}
              </p>
            </div>
          </div>

          <p className="mt-6 border-t border-ink/10 pt-3 font-mono text-[10px] text-ink/40">
            BIGFAMILY · отчёт сформирован автоматически{" "}
            {new Date().toLocaleString("ru-RU", { timeZone: WAREHOUSE_ZONE })} ·
            все остатки рассчитаны из журнала записей
          </p>
        </div>
      )}
    </div>
  );
}
