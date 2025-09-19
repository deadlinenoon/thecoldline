"use client";
import Image from 'next/image';
import Link from 'next/link';
import React, { useEffect, useRef, useState } from 'react';

export default function Header(){
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement|null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string|null>(null);
  const [logoSrc, setLogoSrc] = useState('/logo-ice-script.svg');
  useEffect(()=>{
    function onDoc(e: MouseEvent){ if (!box.current) return; if (!box.current.contains(e.target as any)) setOpen(false); }
    document.addEventListener('mousedown', onDoc); return ()=> document.removeEventListener('mousedown', onDoc);
  },[]);
  useEffect(()=>{
    // Try to load avatar; use blob URL for caching
    let aborted = false;
    (async()=>{
      try{
        const r = await fetch('/api/profile/avatar', { cache:'no-store' });
        if (!r.ok || r.status===204) { if(!aborted) setAvatarUrl(null); return; }
        const b = await r.blob(); const url = URL.createObjectURL(b); if(!aborted) setAvatarUrl(url);
      }catch{ if(!aborted) setAvatarUrl(null); }
    })();
    return ()=>{ aborted = true; };
  },[]);
  return (
    <header className="w-full sticky top-0 z-50 border-b border-cl-border/80 bg-[#0b141e]/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        {/* Left: hamburger menu + logo */}
        <div className="flex items-center gap-2">
          <div className="relative" ref={box}>
            <button
              aria-label="Menu"
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-cl-border/70 bg-[#101b27]/80 text-cyan-200 transition hover:border-cyan-400/50 hover:text-cyan-100"
              onClick={()=> setOpen(v=>!v)}
            >
              <span className="inline-block align-middle" aria-hidden>≡</span>
            </button>
            {open && (
              <div className="absolute left-0 mt-2 w-48 rounded-lg border border-cl-border/70 bg-[#0f1720] p-2 shadow-xl shadow-black/40">
                <Link href="/account" className="block rounded px-3 py-2 text-sm text-cyan-100 hover:bg-[#122233]">Account</Link>
                <Link href="/account#password" className="block rounded px-3 py-2 text-sm text-cyan-100 hover:bg-[#122233]">Change Password</Link>
                <button
                  onClick={async()=>{ try{ await fetch('/api/auth/logout',{method:'POST'});}catch{} finally{ window.location.href='/login'; } }}
                  className="mt-1 block w-full rounded px-3 py-2 text-left text-sm text-rose-300 hover:bg-[#24141f]"
                >
                  Log out
                </button>
              </div>
            )}
          </div>
          <Link href="/" className="flex items-center gap-2 site-logo text-cyan-200">
            <Image
              src={logoSrc}
              alt="The Cold Line"
              width={120}
              height={28}
              className="h-7 w-auto"
              priority
              onError={() => setLogoSrc('/logo-coldline-home.svg')}
            />
            <span className="sr-only">Home</span>
          </Link>
        </div>
        {/* Right: inline links + profile avatar slot */}
        <nav className="flex items-center gap-4 text-sm">
          <Link href="/coldline" className="text-cyan-200 transition hover:text-white">Cold Line</Link>
          <Link href="/oddsboard" className="text-cyan-200 transition hover:text-white">Odds</Link>
          <Link href="/weather" className="text-cyan-200 transition hover:text-white">Weather</Link>
          <Link href="/tutorial" className="text-cyan-200 transition hover:text-white">Tutorial</Link>
          {/* Profile photo placeholder */}
          <Link href="/account" aria-label="Account" className="ml-1">
            {avatarUrl ? (
              <Image
                src={avatarUrl}
                alt="Profile"
                width={36}
                height={36}
                className="h-9 w-9 rounded-full border border-cyan-400/50 object-cover shadow shadow-cyan-500/10"
                unoptimized
              />
            ) : (
              <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border border-cl-border bg-[#101b27] text-xs font-semibold text-cyan-200">You</div>
            )}
          </Link>
        </nav>
      </div>
    </header>
  );
}
