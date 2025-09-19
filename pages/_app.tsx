import "@/styles/globals.css";
import Header from '@/components/Header';
import { assertRequiredEnv } from '@/lib/env';
import type { AppProps } from 'next/app';
import Head from 'next/head';
import { useEffect } from 'react';
import { useRouter } from 'next/router';

assertRequiredEnv();

export default function App({ Component, pageProps }: AppProps){
  const router = useRouter();
  useEffect(() => {
    let cancelled = false;
    try{
      const m = document.cookie.match(/(?:^|; )cid=([^;]+)/);
      let cid = m ? decodeURIComponent(m[1]) : '';
      if (!cid){
        cid = Math.random().toString(36).slice(2,10);
        document.cookie = `cid=${encodeURIComponent(cid)}; Path=/; Max-Age=${60*60*24*365}; SameSite=Lax`;
      }
      fetch('/api/analytics/event', { method:'POST', headers:{ 'x-client-id': cid } as any }).catch(()=>{});
    }catch{}
    async function send(pathname: string){
      try{
        if (cancelled) return;
        await fetch('/api/analytics/event', {
          method: 'POST', headers: { 'Content-Type':'application/json' },
          body: JSON.stringify({ path: pathname, title: document.title }),
          credentials: 'include' as RequestCredentials, cache:'no-store'
        });
      }catch{}
    }
    send(window.location.pathname + window.location.search);
    const onRoute = (url: string)=> send(url);
    router.events.on('routeChangeComplete', onRoute);
    return ()=>{ cancelled = true; router.events.off('routeChangeComplete', onRoute); };
  }, [router.events]);
  return (
    <div className="flex min-h-screen flex-col">
      <Head>
        <title>The Cold Line</title>
        <meta name="description" content="Pro grade NFL handicapping dashboard that compresses every factor into one Cold Line number" />
        <meta property="og:title" content="The Cold Line" />
        <meta property="og:description" content="Pro grade NFL handicapping dashboard that compresses every factor into one Cold Line number" />
        <meta property="og:image" content="/icons/frost-line.svg" />
        <meta name="twitter:card" content="summary_large_image" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <Header />
      <main className="flex-1 min-h-[calc(100vh-4rem)] bg-transparent">
        <div className="mx-auto w-full max-w-6xl px-4 py-8">
          <Component {...pageProps} />
        </div>
      </main>
    </div>
  );
}
