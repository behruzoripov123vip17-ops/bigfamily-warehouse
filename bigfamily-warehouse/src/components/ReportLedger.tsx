import type { DailyReport, ReportLine } from "@/lib/types";
const headings = [
  "№",
  "Артикул",
  "Название вещи",
  "Размер",
  "Цвет",
  "Было утром",
  "Пришло вещей",
  "Ушло вещей",
  "Осталось",
];
const cols = ["opening", "received", "used", "closing"] as const;
const signed = (key: (typeof cols)[number], n: number) =>
  key === "received" ? "+" + n : key === "used" ? "−" + n : String(n);
function Split({
  screen,
  paper,
}: {
  screen: string | number;
  paper: string | number;
}) {
  return screen === paper ? (
    <>{screen}</>
  ) : (
    <>
      <span className="no-print">{screen}</span>
      <span className="only-on-paper">{paper}</span>
    </>
  );
}
export default function ReportLedger({
  report,
  onlyActive,
}: {
  report: DailyReport;
  onlyActive: boolean;
}) {
  const active = (l: ReportLine) => l.received > 0 || l.used > 0;
  const shown = onlyActive ? report.lines.filter(active) : report.lines;
  const index = new Map(shown.map((r, i) => [r.productId, i + 1]));
  const sums = shown.reduce(
    (a, r) => {
      for (const k of cols) a[k] += r[k];
      return a;
    },
    { opening: 0, received: 0, used: 0, closing: 0 },
  );
  return (
    <div className="mt-6 overflow-x-auto">
      <table className="print-table stock-report-table w-full min-w-[760px] text-sm">
        <caption className="sr-only">
          Остатки и запись по каждой позиции одежды
        </caption>
        <thead>
          <tr>
            {headings.map((v, i) => (
              <th key={v} scope="col" className={i > 4 ? "right" : ""}>
                {v}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {report.lines.length === 0 ? (
            <tr>
              <td colSpan={9} className="empty-report">
                На выбранную дату в каталоге не было позиций.
              </td>
            </tr>
          ) : (
            <>
              {!shown.length && (
                <tr className="no-print">
                  <td colSpan={9} className="empty-report">
                    В этот день записей по вещам по товарам не было.
                  </td>
                </tr>
              )}
              {report.lines.map((r, i) => (
                <tr
                  key={r.productId}
                  className={
                    index.has(r.productId) ? "" : "ledger-screen-filtered"
                  }
                >
                  <td>
                    <Split
                      screen={index.get(r.productId) ?? ""}
                      paper={i + 1}
                    />
                  </td>
                  <td className="font-mono text-xs">{r.article}</td>
                  <td className="font-bold">{r.name}</td>
                  <td>{r.size}</td>
                  <td>{r.color}</td>
                  {cols.map((k) => (
                    <td
                      key={k}
                      className={
                        "right font-mono " +
                        (k === "closing"
                          ? "font-bold"
                          : k === "received"
                            ? "text-moss"
                            : k === "used"
                              ? "text-rust"
                              : "")
                      }
                    >
                      {(k === "received" || k === "used") && !r[k]
                        ? "—"
                        : signed(k, r[k])}
                    </td>
                  ))}
                </tr>
              ))}
            </>
          )}
        </tbody>
        {report.lines.length > 0 && (
          <tfoot>
            <tr className={shown.length ? "" : "ledger-screen-filtered"}>
              <td colSpan={5}>
                Итого
                {onlyActive && (
                  <span className="no-print"> (показанные позиции)</span>
                )}
              </td>
              {cols.map((k) => (
                <td key={k} className="right font-mono">
                  <Split
                    screen={signed(k, sums[k])}
                    paper={signed(k, report.totals[k])}
                  />
                </td>
              ))}
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}
