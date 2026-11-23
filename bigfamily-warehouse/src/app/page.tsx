"use client";
import Link from "next/link";
import { useState } from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
} from "chart.js";
import { Bar } from "react-chartjs-2";
import {
  ArrowDownLeft,
  ArrowUpRight,
  ArrowLeftRight,
  ArrowRight,
  Plus,
  Layers3,
  Package,
  Boxes,
  RefreshCw,
  CalendarDays,
  History,
  FileText,
  ChartNoAxesColumn,
  FlaskConical,
} from "lucide-react";
import {
  formatDateRu,
  num,
  todayISO,
  type DashboardStats,
} from "@/lib/types";
import { useResource, useDemo, switchMode, message } from "@/lib/client";
import {
  LoadError,
  ChannelBadge,
  StockBadge,
  useToast,
  Spinner,
} from "@/components/ui";
ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip);
export default function Dashboard() {
  const { data, loading, error, reload } = useResource<{
    stats: DashboardStats;
  }>("/api/stats");
  const stats = data?.stats;
  const demo = useDemo();
  const toast = useToast();
  const [period, setPeriod] = useState(14);
  const chart = stats?.series.slice(-period) ?? [];
  const hasChart = chart.some((s) => s.received || s.used);
  const day = stats?.today || todayISO();
  const empty = stats?.productsCount === 0;
  const cards = [
    {
      name: "Вещей осталось всего",
      n: stats?.totalStock,
      unit: "вещей",
      icon: Boxes,
      cls: "sage",
      detail: "Сколько одежды сейчас есть на складе",
    },
    {
      name: "Разных карточек одежды",
      n: stats?.productsCount,
      unit: "",
      icon: Layers3,
      cls: "slate",
      detail: "Артикул + размер + цвет = отдельная карточка",
    },
    {
      name: "Пришло вещей сегодня",
      n: stats?.todayReceived,
      unit: "вещей",
      icon: ArrowDownLeft,
      cls: "green",
      detail: "Сколько одежды добавили за день",
    },
    {
      name: "Ушло вещей сегодня",
      n: stats?.todayUsed,
      unit: "вещей",
      icon: ArrowUpRight,
      cls: "orange",
      detail: "Сколько одежды отгрузили или использовали",
    },
  ];
  return (
    <div className="dashboard">
      <section className="overview-hero">
        <div className="hero-copy">
          <div className="hero-eyebrow">
            <span />
            ПРОСТОЙ УЧЁТ ОДЕЖДЫ
            <i /> WB / OZON
          </div>
          <h1>Главная</h1>
          <p>
            Веди одежду, приход и отгрузки по WB и Ozon в одном месте — сайт
            всё посчитает сам.
          </p>
          <div className="hero-actions">
            <Link
              href={
                empty ? "/products" : demo ? "/movements#history" : "/movements"
              }
              className="btn acid"
            >
              {demo ? <History size={16} /> : <Plus size={17} />}
              {empty
                ? "Сохранить вещь"
                : demo
                  ? "История по вещам"
                  : "Сохранить запись приход или отгрузку"}
            </Link>
            {!demo && empty ? (
              <button
                className="hero-alt"
                onClick={() => {
                  try {
                    switchMode(true);
                  } catch (e) {
                    toast("error", message(e));
                  }
                }}
              >
                Посмотреть пример без записей <ArrowUpRight size={14} />
              </button>
            ) : (
              <Link className="hero-alt" href="/products">
                В каталог <ArrowRight size={14} />
              </Link>
            )}
          </div>
        </div>
        <div className="hero-art" aria-hidden="true" />
      </section>
      <div className="section-kicker">
        <span>
          <i />
          Сейчас на складе
        </span>
        <div>
          <CalendarDays size={13} />
          {new Date(day + "T12:00:00Z").toLocaleDateString("ru-RU", {
            day: "numeric",
            month: "long",
            year: "numeric",
            timeZone: "UTC",
          })}
          <button
            className="tiny-action"
            onClick={reload}
            aria-label="Обновить сводку"
            disabled={loading}
          >
            <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>
      {error && <LoadError text={error} retry={reload} />}
      <section className="metrics" aria-label="Ключевые показатели">
        {cards.map(({ name, n, unit, icon: Icon, cls, detail }) => (
          <article key={name} className="metric">
            <div className="metric-top">
              <h2>{name}</h2>
              <span className={"metric-icon " + cls}>
                <Icon size={17} strokeWidth={1.8} />
              </span>
            </div>
            <p className="metric-value">
              {n != null ? num(n) : "—"} {!!unit && <small>{unit}</small>}
            </p>
            <p className="metric-caption">{detail}</p>
          </article>
        ))}
      </section>
      <section className="big-actions big-actions-two">
        <Link href="/products" className="big-action moss">
          <Layers3 size={22} />
          <span>
            <b>1. Добавить вещь</b>
            <small>Артикул, размер, цвет, количество, название</small>
          </span>
          <ArrowRight size={18} />
        </Link>
        <Link href="/movements" className="big-action pine">
          <ArrowLeftRight size={22} />
          <span>
            <b>2. Записать приход или отгрузку</b>
            <small>Сколько вещей пришло или ушло по WB или Ozon</small>
          </span>
          <ArrowRight size={18} />
        </Link>
      </section>
      <div className="dashboard-mid">
        <section className="panel chart-panel">
          <div className="panel-title">
            <div>
              <p className="eyebrow">Аналитика</p>
              <h2>Приход и отгрузка по дням</h2>
            </div>
            <div className="periods">
              {[7, 14].map((p) => (
                <button
                  key={p}
                  aria-pressed={period === p}
                  onClick={() => setPeriod(p)}
                >
                  {p} дн.
                </button>
              ))}
            </div>
          </div>
          <div className="legend">
            <span>
              <i />
              Пришло вещей
            </span>
            <span>
              <i />
              Ушло вещей
            </span>
            <small>вещей</small>
          </div>
          <div className="stock-chart">
            <Bar
              aria-label={
                "График: что приходило и уходило за " + period + " дней"
              }
              data={{
                labels: chart.map(
                  (s) => s.day.slice(8) + "." + s.day.slice(5, 7),
                ),
                datasets: [
                  {
                    label: "Пришло вещей",
                    data: chart.map((s) => s.received),
                    backgroundColor: "#649971",
                    borderRadius: 3,
                    maxBarThickness: 14,
                    categoryPercentage: 0.72,
                    barPercentage: 0.9,
                  },
                  {
                    label: "Ушло вещей",
                    data: chart.map((s) => s.used),
                    backgroundColor: "#e7a676",
                    borderRadius: 3,
                    maxBarThickness: 14,
                    categoryPercentage: 0.72,
                    barPercentage: 0.9,
                  },
                ],
              }}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                animation: false,
                plugins: {
                  legend: { display: false },
                  tooltip: { displayColors: true },
                },
                scales: {
                  x: {
                    border: { display: false },
                    grid: { display: false },
                    ticks: {
                      font: { size: 10 },
                      color: "#737d74",
                      maxRotation: 0,
                      maxTicksLimit: 8,
                    },
                  },
                  y: {
                    border: { display: false },
                    beginAtZero: true,
                    suggestedMax: hasChart ? undefined : 10,
                    grid: { color: "#edf0e9" },
                    ticks: {
                      font: { size: 10 },
                      color: "#92998e",
                      precision: 0,
                      maxTicksLimit: 5,
                      padding: 7,
                    },
                  },
                },
              }}
            />
            {!hasChart && (
              <div className="chart-empty">
                {loading ? (
                  <Spinner />
                ) : (
                  <>
                    <ChartNoAxesColumn size={20} />
                    <strong>
                      {error ? "Данные недоступны" : "За период нет записей"}
                    </strong>
                  </>
                )}
              </div>
            )}
          </div>
        </section>
      </div>
      <section className="panel recent-panel">
        <div className="panel-title">
          <div>
            <p className="eyebrow">История склада</p>
            <h2>Последние записи</h2>
          </div>
          <Link href="/movements#history" className="text-link">
            Все записи <ArrowRight size={15} />
          </Link>
        </div>
        {stats?.recent.length ? (
          <div className="recent-wrap">
            <table className="recent-table">
              <thead>
                <tr>
                  <th>Какая вещь</th>
                  <th>Запись</th>
                  <th>Канал</th>
                  <th className="right">Количество вещей</th>
                  <th className="right">Дата</th>
                </tr>
              </thead>
              <tbody>
                {stats.recent.map((m) => (
                  <tr key={m.id} className={m.cancelledAt ? "voided" : ""}>
                    <td>
                      <b>{m.productName}</b>
                      <small>
                        {m.article} · {m.size} · {m.color}
                      </small>
                    </td>
                    <td>
                      <span className={"op-badge " + m.type}>
                        {m.cancelledAt
                          ? "Отменена"
                          : m.type === "in"
                            ? "Пришло вещей"
                            : "Ушло вещей"}
                      </span>
                    </td>
                    <td>
                      <ChannelBadge channel={m.channel} />
                    </td>
                    <td className={"right amount " + m.type}>
                      {m.type === "in" ? "+" : "−"}
                      {num(m.qty)}
                    </td>
                    <td className="right day-cell">{formatDateRu(m.day)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="recent-empty">
            <span className="empty-icon">
              <Package size={23} />
            </span>
            <div>
              <b>
                {loading
                  ? "Загружаем журнал…"
                  : error
                    ? "История недоступен"
                    : "Записей пока нет"}
              </b>
              <p>Приходы и расходы появятся здесь после записи в журнал.</p>
            </div>
          </div>
        )}
      </section>
      <Link href="/reports" className="report-link">
        <span className="report-icon">
          <FileText size={21} />
        </span>
        <div>
          <b>Отчёт за день</b>
          <small>
            Сейчас есть на утро, приход, расход и итог дня — в формате A4.
          </small>
        </div>
        <ArrowRight size={19} />
      </Link>
      {demo && (
        <p className="demo-caption">
          <FlaskConical size={13} /> Все показатели на этой странице —
          демонстрационные.
        </p>
      )}
    </div>
  );
}
