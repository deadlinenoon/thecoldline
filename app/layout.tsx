import "@/styles/globals.css";
import type { ReactNode } from "react";
import { Analytics } from "@vercel/analytics/react";
import Header from "@/components/Header";
import { inter } from "@/lib/fonts";
import { assertRequiredEnv } from "@/lib/env";
import Providers from "./providers";

assertRequiredEnv();

export const metadata = { title: "The Cold Line" } as const;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className={`${inter.className} bg-[#0b1116] text-slate-200 antialiased`}>
        <Providers>
          <div className="flex min-h-screen flex-col">
            <Header />
            <main className="flex-1 min-h-[calc(100vh-4rem)] bg-transparent">
              <div className="mx-auto w-full max-w-6xl px-4 py-8">
                {children}
              </div>
            </main>
            <Analytics />
          </div>
        </Providers>
      </body>
    </html>
  );
}
