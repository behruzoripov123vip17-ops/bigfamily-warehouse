export const MARKETPLACES = ["wb", "ozon"] as const;
export type Marketplace = (typeof MARKETPLACES)[number];
// The storage value for an unassigned marketplace is kept for backup compatibility.
export type StoredChannel = Marketplace | "other";
export function isMarketplace(value: unknown): value is Marketplace {
  return MARKETPLACES.some((channel) => channel === value);
}
export type MovementType = "in" | "out";

export interface ProductWithStock {
  id: number;
  article: string;
  size: string;
  color: string;
  name: string;
  archivedAt: string | null;
  received: number;
  used: number;
  stock: number;
  createdAt: string;
  lastChannel: StoredChannel | null;
}

export interface MovementRow {
  id: number;
  productId: number;
  type: MovementType;
  qty: number;
  channel: StoredChannel;
  note: string;
  day: string;
  createdAt: string;
  cancelledAt: string | null;
  productName: string;
  article: string;
  size: string;
  color: string;
}

export interface ReportLine {
  productId: number;
  article: string;
  name: string;
  size: string;
  color: string;
  opening: number;
  received: number;
  used: number;
  closing: number;
}

export interface OrderDay {
  total: number;
  wb: number;
  ozon: number;
  batches: number;
}
export interface OrderBatch {
  id: number;
  day: string;
  channel: Marketplace;
  ordersCount: number;
  note: string;
  createdAt: string;
  cancelledAt: string | null;
}
export interface OrdersList {
  day: string;
  total: number;
  page: number;
  pageSize: number;
  items: OrderBatch[];
  summary: OrderDay;
}
export interface DailyReport {
  orders: OrderDay;
  day: string;
  lines: ReportLine[];
  totals: {
    opening: number;
    received: number;
    used: number;
    closing: number;
  };
  channels: { channel: Marketplace; received: number; used: number }[];
  legacyMovementsCount: number;
  movementsCount: number;
}

export interface DashboardStats {
  ordersToday: OrderDay;
  today: string;
  productsCount: number;
  totalStock: number;
  todayReceived: number;
  todayUsed: number;
  lowStockCount: number;
  lowStock: ProductWithStock[];
  recent: MovementRow[];
  series: { day: string; received: number; used: number }[];
}

export const CHANNEL_LABEL: Record<Marketplace, string> = {
  wb: "Wildberries",
  ozon: "Ozon",
};

export const LOW_STOCK_THRESHOLD = 10;

export const WAREHOUSE_ZONE =
  process.env.NEXT_PUBLIC_WAREHOUSE_TZ || "Asia/Tashkent";
export function todayISO(): string {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: WAREHOUSE_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}
export function shiftDay(iso: string, delta: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}
export function validDay(value: unknown): value is string {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    value.startsWith("0000")
  )
    return false;
  const d = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(d.valueOf()) && d.toISOString().slice(0, 10) === value;
}
export function formatDateRu(iso: string): string {
  return iso.split("-").reverse().join(".");
}
export const num = (v: number) => v.toLocaleString("ru-RU");
