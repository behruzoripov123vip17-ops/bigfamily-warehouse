import type { Metadata } from "next";
import type { ReactNode } from "react";
import "@fontsource-variable/manrope";
import "@fontsource-variable/unbounded";
import "./globals.css";
import Shell from "@/components/Shell";
import { ToastProvider } from "@/components/ui";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "BIGFAMILY · Склад WB / Ozon",
  description:
    "Складской учёт одежды: каталог, приход и отгрузки по Wildberries и Ozon, остатки и ежедневные отчёты.",
  robots: { index: false, follow: false },
};
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="ru"
      data-storage-scope={
        process.env.BIGFAMILY_SHARED === "1" ? "owner" : "personal"
      }
    >
      <body>
        <ToastProvider>
          <Shell shared={process.env.BIGFAMILY_SHARED === "1"}>
            {children}
          </Shell>
        </ToastProvider>
      </body>
    </html>
  );
}
