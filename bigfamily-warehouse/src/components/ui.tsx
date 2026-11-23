"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Info,
  RefreshCw,
  X,
} from "lucide-react";
import {
  CHANNEL_LABEL,
  MARKETPLACES,
  LOW_STOCK_THRESHOLD,
  num,
  type Marketplace,
  type StoredChannel,
} from "@/lib/types";
type Kind = "success" | "error" | "info";
const ToastCtx = createContext<(kind: Kind, text: string) => void>(() => {});
export const useToast = () => useContext(ToastCtx);
export function ToastProvider({ children }: { children: ReactNode }) {
  const [list, set] = useState<{ id: number; kind: Kind; text: string }[]>([]);
  const seq = useRef(0);
  const push = useCallback((kind: Kind, text: string) => {
    const id = ++seq.current;
    set((v) => [...v, { id, kind, text }]);
    setTimeout(() => set((v) => v.filter((t) => t.id !== id)), 5500);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="no-print toast-stack" aria-live="polite">
        {list.map((t) => (
          <div
            key={t.id}
            className={"toast " + t.kind}
            role={t.kind === "error" ? "alert" : "status"}
          >
            {t.kind === "error" ? (
              <AlertTriangle />
            ) : t.kind === "success" ? (
              <CheckCircle2 />
            ) : (
              <Info />
            )}
            <span>{t.text}</span>
            <button
              onClick={() => set((v) => v.filter((x) => x.id !== t.id))}
              aria-label="Закрыть сообщение"
            >
              <X size={15} />
            </button>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
export function ChannelPicker({
  value,
  onChange,
  label = "Маркетплейс",
}: {
  value: Marketplace;
  onChange: (value: Marketplace) => void;
  label?: string;
}) {
  return (
    <fieldset>
      <legend className="field-label">{label}</legend>
      <div className="grid grid-cols-2 gap-2">
        {MARKETPLACES.map((ch) => (
          <button
            key={ch}
            type="button"
            aria-pressed={value === ch}
            onClick={() => onChange(ch)}
            className={`rounded-xl border py-2.5 text-sm font-bold transition ${value === ch ? (ch === "wb" ? "border-wb bg-wb text-white" : "border-ozon bg-ozon text-white") : "border-ink/15 text-ink/60 hover:border-ink/40"}`}
          >
            {CHANNEL_LABEL[ch]}
          </button>
        ))}
      </div>
    </fieldset>
  );
}
export function ChannelBadge({ channel }: { channel: StoredChannel }) {
  if (channel === "other")
    return (
      <span
        className="text-ink/55"
        title="В исходной записи маркетплейс не указан"
      >
        <span aria-hidden="true">—</span>
        <span className="sr-only">В исходной записи маркетплейс не указан</span>
      </span>
    );
  return (
    <span className={"channel-badge " + channel} title={CHANNEL_LABEL[channel]}>
      {channel === "wb" ? "WB" : CHANNEL_LABEL[channel]}
    </span>
  );
}
export function StockBadge({ stock }: { stock: number }) {
  return (
    <span
      className={
        "stock-badge " +
        (stock <= 0 ? "zero" : stock <= LOW_STOCK_THRESHOLD ? "low" : "ok")
      }
    >
      {num(stock)} вещей
    </span>
  );
}
export function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const d = ref.current;
    if (!d || !open) return;
    const before = document.activeElement as HTMLElement | null;
    d.showModal();
    const was = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      d.close();
      document.body.style.overflow = was;
      before?.focus();
    };
  }, [open]);
  return open ? (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      className="bf-dialog no-print"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current) {
          const b = ref.current!.getBoundingClientRect();
          if (
            e.clientX < b.left ||
            e.clientX > b.right ||
            e.clientY < b.top ||
            e.clientY > b.bottom
          )
            onClose();
        }
      }}
    >
      <div className="mb-4 flex items-center justify-between gap-2">
        <h3 id={titleId} className="text-lg font-extrabold">
          {title}
        </h3>
        <button
          className="icon-button"
          aria-label="Закрыть окно"
          onClick={onClose}
        >
          <X size={17} />
        </button>
      </div>
      {children}
    </dialog>
  ) : null;
}
export function Field({
  label,
  step,
  children,
}: {
  label: string;
  step?: number;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="field-label">
        {step && <small>{step}</small>}
        {label}
      </span>
      {children}
    </label>
  );
}
export const inputCls =
  "w-full min-w-0 rounded-xl border border-ink/15 bg-white px-3.5 py-2.5 text-sm font-medium outline-none transition placeholder:text-ink/40 focus:border-moss focus:ring-2 focus:ring-leaf/20";
export function Spinner({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <span
      role="status"
      aria-label="Загрузка"
      className={`inline-block animate-spin rounded-full border-2 border-current border-t-transparent ${className}`}
    />
  );
}
export function EmptyState({
  icon,
  title,
  hint,
}: {
  icon: ReactNode;
  title: string;
  hint: string;
}) {
  return (
    <div className="empty-state">
      <span className="empty-icon">{icon}</span>
      <strong>{title}</strong>
      <p>{hint}</p>
    </div>
  );
}
export function LoadError({
  text,
  retry,
}: {
  text: string;
  retry: () => void;
}) {
  return (
    <div className="load-error" role="alert">
      <AlertCircle size={18} />
      <span>{text}</span>
      <button onClick={retry}>
        <RefreshCw size={14} /> Повторить
      </button>
    </div>
  );
}
