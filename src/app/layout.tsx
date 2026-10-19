import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { themeInitScript } from "@/components/layout/ThemeToggle";
import { ToastProvider } from "@/components/ui/Toast";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "O‘zbegim — O‘zbek tili yordamchisi", template: "%s · O‘zbegim" },
  description: "Lotin ↔ kirill konvertori, iboralar ma’nosi, imlo tekshiruvi va o‘zlashma so‘zlarning o‘zbekcha muqobillari.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#eef4f7" },
    { media: "(prefers-color-scheme: dark)", color: "#07131f" },
  ],
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="uz" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>
        <ToastProvider>
          <AppShell>{children}</AppShell>
        </ToastProvider>
      </body>
    </html>
  );
}
