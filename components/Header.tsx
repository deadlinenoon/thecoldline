import Link from 'next/link';
import React, { useEffect, useRef, useState } from 'react';

export default function Header(){
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement|null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string|null>(null);
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
    <header className="w-full sticky top-0 z-50 bg-slate-900/80 backdrop-blur border-b border-[#1e2a3a]">
      <div className="max-w-6xl mx-auto px-4 py-2 flex items-center justify-between">
        {/* Left: hamburger menu + logo */}
        <div className="flex items-center gap-2">
          <div className="relative" ref={box}>
            <button
              aria-label="Menu"
              className="h-8 w-8 inline-flex items-center justify-center rounded hover:bg-slate-800/60 border border-slate-700/60 text-cyan-200"
              onClick={()=> setOpen(v=>!v)}
            >
              <span className="inline-block align-middle" aria-hidden>≡</span>
            </button>
            {open && (
              <div className="absolute left-0 mt-2 w-48 rounded-lg border border-[#1e2a3a] bg-[#0f1720] shadow-xl p-2">
                <Link href="/account" className="block px-2 py-1 rounded text-sm text-cyan-200 hover:bg-slate-800/60">Account</Link>
                <a href="/account#password" className="block px-2 py-1 rounded text-sm text-cyan-200 hover:bg-slate-800/60">Change Password</a>
                <button
                  onClick={async()=>{ try{ await fetch('/api/auth/logout',{method:'POST'});}catch{} finally{ window.location.href='/login'; } }}
                  className="w-full text-left block px-2 py-1 rounded text-sm text-rose-300 hover:bg-slate-800/60"
                >
                  Log out
                </button>
              </div>
            )}
          </div>
          <Link href="/" className="flex items-center gap-2 site-logo">
            <img src="/logo-ice-script.svg" alt="The Cold Line" className="h-6 md:h-7 w-auto block" onError={(e)=>{ (e.currentTarget as HTMLImageElement).src='/logo-coldline-home.svg'; }} />
            <span className="sr-only">Home</span>
          </Link>
        </div>
        {/* Right: inline links + profile avatar slot */}
        <nav className="flex items-center gap-3">
          <Link href="/oddsboard" className="text-cyan-200 text-sm hover:underline">Odds</Link>
          <Link href="/weather" className="text-cyan-200 text-sm hover:underline">Weather</Link>
          <Link href="/tutorial" className="text-cyan-200 text-sm hover:underline">Tutorial</Link>
          {/* Profile photo placeholder */}
          <Link href="/account" aria-label="Account" className="ml-1">
            {avatarUrl ? (
              <img src={avatarUrl} alt="Profile" className="h-8 w-8 rounded-full object-cover border border-slate-600" />
            ) : (
              <div className="h-8 w-8 rounded-full bg-slate-800 border border-slate-600 overflow-hidden flex items-center justify-center text-xs text-gray-300">You</div>
            )}
          </Link>
        </nav>
      </div>
    </header>
  );
}
