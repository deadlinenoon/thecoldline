import { Html, Head, Main, NextScript } from 'next/document';
import { inter } from '@/lib/fonts';

export default function Document() {
  return (
    <Html lang="en">
      <Head />
      <body className={`bg-[#0b1116] text-slate-200 antialiased ${inter.className}`}>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
