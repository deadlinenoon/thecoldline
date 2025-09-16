import "./globals.css";
import Link from "next/link";
import { Analytics } from "@vercel/analytics/react";

export const metadata = { title: "The Cold Line" } as const;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header style={{ borderBottom: '1px solid #e5e7eb', padding: '0.5rem 1rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <Link href="/" className="text-blue-600 hover:underline">Home</Link>
          <nav style={{ display: 'flex', gap: '0.75rem' }}>
            <Link href="/tutorial" className="hover:underline">Tutorial</Link>
            <Link href="/api/auth/me" className="hover:underline">Me</Link>
            <Link href="/(admin)/travel" className="hover:underline">Travel</Link>
          </nav>
        </header>
        <main>
          {children}
        </main>
        <Analytics />
      </body>
    </html>
  );
}
