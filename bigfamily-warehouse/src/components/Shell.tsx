"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  PanelsTopLeft,
  Layers3,
  ArrowLeftRight,
  FileBarChart2,
  DatabaseBackup,
  ChevronRight,
  Box,
  FlaskConical,
  Menu,
  X,
  CalendarDays,
  Plus,
} from "lucide-react";
import { message, switchMode, useDemo } from "@/lib/client";
import { formatDateRu, todayISO } from "@/lib/types";
import Backup from "./Backup";
import { useToast } from "./ui";
const nav = [
  { href: "/", label: "Главная", icon: PanelsTopLeft },
  { href: "/products", label: "Мои товары", icon: Layers3 },
  { href: "/movements", label: "Пришло / ушло вещей", icon: ArrowLeftRight },
  { href: "/reports", label: "Отчёт за день / печать", icon: FileBarChart2 },
];
function Mark() {
  return (
    <svg width="36" height="40" viewBox="0 0 36 40" fill="none" aria-hidden>
      <path d="M18 1 34 10.2v19.2L18 39 2 29.4V10.2Z" fill="#D7F877" />
      <path d="m7 12 11-6.2L29 12l-11 6.2z" fill="#214236" />
      <path
        d="m7 15 9 5.2v12L7 27zM20 20l9-5v5.8l-4.8 2.8v6L20 32z"
        fill="#214236"
      />
    </svg>
  );
}
export default function Shell({
  children,
  shared = false,
}: {
  children: ReactNode;
  shared?: boolean;
}) {
  const path = usePathname();
  const active = nav.find((n) => n.href === path);
  const [backup, setBackup] = useState(false);
  const [mobile, setMobile] = useState(false);
  const demo = useDemo();
  const toast = useToast();
  const menuRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!mobile) return;
    const returnFocus = menuRef.current;
    const old = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobile(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = old;
      returnFocus?.focus();
    };
  }, [mobile]);
  const change = (v: boolean) => {
    try {
      switchMode(v);
    } catch (e) {
      toast("error", message(e));
    }
  };
  return (
    <div className="app-frame">
      <a className="skip-link" href="#content">
        К содержимому
      </a>
      {mobile && (
        <button
          className="mobile-menu-overlay no-print"
          aria-hidden
          onClick={() => setMobile(false)}
        />
      )}
      <aside
        className={"rail no-print " + (mobile ? "rail-open" : "")}
        aria-label="Меню"
      >
        <div className="rail-top">
          <div className="rail-top-row">
            <Link
              href="/"
              className="brand"
              onClick={() => setMobile(false)}
              aria-label="BIGFAMILY, на главную"
            >
              <Mark />
              <div>
                <b>BIGFAMILY</b>
                <small>{shared ? "Склад владельца" : "Мой склад"}</small>
              </div>
            </Link>
            <button
              ref={closeRef}
              className="icon-button mobile-only"
              onClick={() => setMobile(false)}
              aria-label="Закрыть меню"
            >
              <X size={18} />
            </button>
          </div>
          <p className="rail-subtitle">Простой учёт одежды для WB и Ozon</p>
        </div>
        <nav className="rail-nav" aria-label="Разделы сайта">
          <p className="rail-label">Разделы</p>
          <ul>
            {nav.map((n) => (
              <li key={n.href}>
                <Link
                  href={n.href}
                  className={"rail-link " + (path === n.href ? "current" : "")}
                  aria-current={path === n.href ? "page" : undefined}
                  onClick={() => setMobile(false)}
                >
                  <n.icon size={18} />
                  <span>{n.label}</span>
                  <ChevronRight size={14} className="nav-pip-arrow" />
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className="rail-card">
          <p className="rail-card-title">Как работать</p>
          <ol className="rail-steps">
            <li>Добавь вещь в «Мои товары».</li>
            <li>Когда одежда пришла или ушла — записывай это.</li>
            <li>В конце дня открывай отчёт и печатай.</li>
          </ol>
        </div>
        <div className="rail-bottom">
          <button
            className="btn backup-btn w-full"
            onClick={() => setBackup(true)}
            disabled={demo}
          >
            <DatabaseBackup size={15} />
            Сохранить / загрузить копию
          </button>
          <div className="mode-pick" role="group" aria-label="Режим работы">
            <button aria-pressed={!demo} onClick={() => change(false)}>
              <Box size={14} />
              {shared ? "Вход владельца" : "Мой склад"}
            </button>
            <button aria-pressed={demo} onClick={() => change(true)}>
              <FlaskConical size={14} />
              Пример
            </button>
          </div>
          <p className="rail-note">
            {shared
              ? "Вход по логину владельца. Не пересылай пароль."
              : "Записи хранятся в базе сайта. Делай копию на всякий случай."}
          </p>
        </div>
      </aside>
      <div className="work-area">
        <header className="topbar no-print">
          <div className="topbar-left">
            <button
              ref={menuRef}
              className="icon-button mobile-only"
              onClick={() => setMobile(true)}
              aria-label="Открыть меню"
            >
              <Menu size={18} />
            </button>
            <div className="crumbs">
              <strong>{active?.label || "BIGFAMILY"}</strong>
              {active?.href !== "/" ? <Link href="/">Главная</Link> : null}
              <span className="today-chip">
                <CalendarDays size={13} />
                Сегодня {formatDateRu(todayISO())}
              </span>
            </div>
          </div>
        </header>
        <main id="content" className="content">
          {children}
        </main>
      </div>
      {backup ? (
        <Backup open={backup} close={() => setBackup(false)} shared={shared} />
      ) : null}
    </div>
  );
}
