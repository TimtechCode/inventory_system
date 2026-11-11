import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Suspense } from "react";

import { MainNav, NavLinks } from "@/components/main-nav";
import { NoticeToast } from "@/components/notice-toast";

import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "People's Shop Inventory", template: "%s · People's Shop Inventory" },
  description: "Catalogue and stock levels for People's Shop.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en-NG" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-control focus:bg-surface focus:px-4 focus:py-2 focus:shadow"
        >
          Skip to content
        </a>
        <header className="border-b border-line bg-surface">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-8 gap-y-2 px-4 py-3 sm:px-6">
            <span className="flex items-center gap-2 font-semibold tracking-tight">
              <span aria-hidden className="grid size-7 place-items-center rounded-control bg-sage text-sm text-white">
                P
              </span>
              People&apos;s Shop
            </span>
            <Suspense fallback={<NavLinks pathname={null} />}>
              <MainNav />
            </Suspense>
          </div>
        </header>
        <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">
          {children}
        </main>
        <Suspense>
          <NoticeToast />
        </Suspense>
      </body>
    </html>
  );
}
