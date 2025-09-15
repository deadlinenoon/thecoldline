import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';

export default function AdminHome(){
  const router = useRouter();
  const [me, setMe] = useState<{email:string}|null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string|null>(null);
  const [oldPw,setOldPw] = useState('');
  const [newPw,setNewPw] = useState('');
  const [pwMsg,setPwMsg] = useState<string|null>(null);

  useEffect(()=>{
    (async ()=>{
      try{
        const r = await fetch('/api/auth/me');
        if (!r.ok) { router.replace(`/login?next=${encodeURIComponent('/admin')}`); return; }
        const j = await r.json();
        const allow = new Set(['garitar@gmail.com','georgesantiago55@me.com','betsharp@icloud.com']);
        const email = String(j?.email||'').trim().toLowerCase();
        if (!allow.has(email)) { router.replace('/'); return; }
        setMe(j);
      }catch(e:any){ setErr(e?.message||'error'); }
      finally{ setLoading(false); }
    })();
  },[router]);

  if (loading) return <div className="min-h-screen bg-cl-bg text-white flex items-center justify-center">Loading…</div>;
  if (err) return <div className="min-h-screen bg-cl-bg text-white flex items-center justify-center">{err}</div>;
  if (!me) return null;
  return (
    <div className="min-h-screen bg-cl-bg text-white p-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <a href="/admin" aria-label="Admin Home"><img src="/logo-ice-script.svg" alt="The Cold Line" title="The Cold Line" className="h-8 w-auto" /></a>
            <div>
              <div className="text-xl font-semibold">Admin</div>
              <div className="text-xs text-gray-400">{me.email}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <a href="/" className="px-3 py-2 rounded bg-[#1a2330] hover:bg-[#202c3b] text-sm">Frontend</a>
            <button
              onClick={async()=>{ await fetch('/api/auth/logout',{method:'POST'}); router.replace('/login'); }}
              className="px-3 py-2 rounded bg-[#1a2330] hover:bg-[#202c3b] text-sm"
            >
              Log out
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <SiteStatus />
          <DataHealth />
          <div className="p-4 rounded-lg border border-[#1b2735] bg-[#0f1720]">
            <div className="text-sm font-semibold text-gray-200 mb-2">Next steps</div>
            <ul className="text-xs text-gray-300 list-disc pl-5 space-y-1">
              <li>Add middleware to gate all pages</li>
              <li>Extend admin for content/feature flags</li>
            </ul>
          </div>
          <a href="/admin/users" className="p-4 rounded-lg border border-[#1b2735] bg-[#0f1720] hover:bg-[#121a27] transition-colors" aria-label="Users">
            <div className="text-sm font-semibold text-gray-200 mb-2">Users</div>
            <div className="text-xs text-gray-400">View all signups</div>
          </a>
          <InviteCard />
          <WhitelistCard />
          <ConsensusFlagCard />
          <RecentErrors />
          <AIFallbackCard />
          <AnalyticsSummary />
          <TrendsCard />
          <HitsCard />
          <div className="p-4 rounded-lg border border-[#1b2735] bg-[#0f1720] md:col-span-2">
            <div className="text-sm font-semibold text-gray-200 mb-2">Change password</div>
            <form onSubmit={async(e)=>{ e.preventDefault(); setPwMsg(null); try{ const r=await fetch('/api/auth/change-password',{method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ oldPassword: oldPw, newPassword: newPw })}); const j=await r.json(); if(!r.ok) throw new Error(j?.error||'error'); setPwMsg('Password updated'); setOldPw(''); setNewPw(''); }catch(e:any){ setPwMsg(e?.message||'Error'); } }} className="space-y-3 max-w-md">
              <input type="password" value={oldPw} onChange={e=>setOldPw(e.target.value)} placeholder="Current password" className="w-full bg-[#0e1520] border border-[#233041] rounded px-3 py-2 text-white" />
              <input type="password" value={newPw} onChange={e=>setNewPw(e.target.value)} placeholder="New password" className="w-full bg-[#0e1520] border border-[#233041] rounded px-3 py-2 text-white" />
              {pwMsg && <div className="text-xs text-gray-300">{pwMsg}</div>}
              <button className="px-3 py-2 rounded bg-emerald-600 hover:bg-emerald-500 text-sm">Update password</button>
            </form>
            <div className="mt-2 text-[11px] text-gray-400">Tip: Once you change the password here, your admin account can sign in using the new password via the standard login form (we store an admin user record).</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function DataHealth(){
  const [home,setHome] = useState("");
  const [away,setAway] = useState("");
  const [kickoff,setKickoff] = useState("");
  const [loading,setLoading] = useState(false);
  const [result,setResult] = useState<any|null>(null);
  const [msg,setMsg] = useState<string|null>(null);
  const [err,setErr] = useState<string|null>(null);

  useEffect(()=>{
    try{
      const qs = new URLSearchParams(typeof window!=="undefined"? window.location.search : "");
      const h = qs.get('home')||''; const a = qs.get('away')||''; const k = qs.get('kickoff')||'';
      if (h) setHome(h); if (a) setAway(a); if (k) setKickoff(k);
    }catch{}
  },[]);

  async function check(){
    setErr(null); setMsg(null); setResult(null); setLoading(true);
    try{
      const qs = `home=${encodeURIComponent(home)}&away=${encodeURIComponent(away)}&kickoff=${encodeURIComponent(kickoff)}`;
      const r = await fetch(`/api/admin/data-health?${qs}`, { cache:'no-store' });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error||'error');
      setResult(j);
    }catch(e:any){ setErr(e?.message||'error'); }
    finally{ setLoading(false); }
  }

  async function bust(){
    setErr(null); setMsg(null);
    try{
      const qs = `home=${encodeURIComponent(home)}&away=${encodeURIComponent(away)}&kickoff=${encodeURIComponent(kickoff)}&force=1`;
      const r = await fetch(`/api/agent?${qs}`, { method:'GET', cache:'no-store' });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error||'error');
      setMsg('Inputs refreshed. Re-checking…');
      await check();
    }catch(e:any){ setErr(e?.message||'error'); }
  }

  const Badge=({ok,label}:{ok:boolean|null;label:string})=> (
    <span className={`px-2 py-1 rounded text-[11px] ${ok==null? 'bg-[#1a2330] text-gray-400' : (ok? 'bg-emerald-600/30 text-emerald-300' : 'bg-rose-600/30 text-rose-300')}`}>{label}</span>
  );

  return (
    <div className="p-4 rounded-lg border border-[#1b2735] bg-[#0f1720]">
      <div className="text-sm font-semibold text-gray-200 mb-2">Data health (by matchup)</div>
      <div className="grid grid-cols-1 gap-2 text-xs">
        <input value={home} onChange={e=>setHome(e.target.value)} placeholder="Home team (e.g., Detroit Lions)" className="w-full bg-[#0e1520] border border-[#233041] rounded px-3 py-2 text-white" />
        <input value={away} onChange={e=>setAway(e.target.value)} placeholder="Away team (e.g., Chicago Bears)" className="w-full bg-[#0e1520] border border-[#233041] rounded px-3 py-2 text-white" />
        <input value={kickoff} onChange={e=>setKickoff(e.target.value)} placeholder="Kickoff ISO (e.g., 2025-10-05T17:00:00Z)" className="w-full bg-[#0e1520] border border-[#233041] rounded px-3 py-2 text-white" />
        <div className="flex gap-2">
          <button onClick={check} className="px-3 py-2 rounded bg-cyan-600 hover:bg-cyan-500 text-sm" disabled={loading}>Check</button>
          <button onClick={bust} className="px-3 py-2 rounded bg-[#1a2330] hover:bg-[#202c3b] text-sm">Refresh inputs</button>
        </div>
      </div>
      {loading && <div className="mt-2 text-xs text-gray-400">Checking…</div>}
      {err && <div className="mt-2 text-xs text-rose-400">{err}</div>}
      {msg && <div className="mt-2 text-xs text-emerald-300">{msg}</div>}
      {result && (
        <div className="mt-3 text-xs text-gray-300">
          <div className="grid grid-cols-1 gap-1">
            {(result.items||[]).map((it:any)=> (
              <div key={it.name} className="flex items-center justify-between border border-[#233041] rounded px-2 py-1">
                <span>{it.name}</span>
                <span className={it.ok? 'text-emerald-300' : 'text-rose-300'}>{it.ok? '●' : '●'}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function RecentErrors(){
  const [items,setItems] = useState<{ts:number;slice:string;msg:string}[]>([]);
  const [err,setErr] = useState<string|null>(null);
  useEffect(()=>{
    let t:any; let stop=false;
    async function load(){
      try{ const r=await fetch('/api/admin/logs',{credentials:'include' as RequestCredentials, cache:'no-store'}); const j=await r.json(); if(!r.ok) throw new Error(j?.error||'error'); if(!stop) setItems(j.items||[]); }
      catch(e:any){ if(!stop) setErr(e?.message||'error'); }
    }
    load();
    t = setInterval(()=>{ if (typeof document==='undefined' || document.visibilityState==='visible') load(); }, 20000);
    return ()=>{ stop=true; if(t) clearInterval(t); };
  },[]);
  return (
    <div className="p-4 rounded-lg border border-[#1b2735] bg-[#0f1720]">
      <div className="text-sm font-semibold text-gray-200 mb-2">Recent errors</div>
      {err && <div className="text-xs text-rose-400 mb-1">{err}</div>}
      <div className="text-xs text-gray-300 space-y-1 max-h-48 overflow-auto pr-1">
        {items.length===0 ? (
          <div className="text-gray-500">No recent warnings.</div>
        ) : items.slice().reverse().map((it,i)=> (
          <div key={it.ts+':'+i} className="border border-[#233041] rounded px-2 py-1 flex items-center justify-between">
            <span className="text-gray-400">{new Date(it.ts).toLocaleTimeString()}</span>
            <span className="mx-2 text-gray-200">{it.slice}</span>
            <span className="text-rose-300 truncate">{it.msg}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function SiteStatus(){
  const [kv,setKv] = useState<boolean|null>(null);
  useEffect(()=>{(async()=>{ try{ const r=await fetch('/api/admin/status',{credentials:'include' as RequestCredentials}); const j=await r.json(); if(r.ok) setKv(!!j.kv); }catch{} })();},[]);
  return (
    <div className="p-4 rounded-lg border border-[#1b2735] bg-[#0f1720]">
      <div className="text-sm font-semibold text-gray-200 mb-2 flex items-center gap-3">
        <span>Site status</span>
        {kv===null ? null : (
          <span className={`px-2 py-0.5 rounded text-xs ${kv? 'bg-emerald-600/30 text-emerald-300 border border-emerald-500/50':'bg-rose-600/20 text-rose-300 border border-rose-500/40'}`}>
            KV: {kv? 'Connected':'Not connected'}
          </span>
        )}
      </div>
      <ul className="text-xs text-gray-300 list-disc pl-5 space-y-1">
        <li>Auth enabled with email + password</li>
        <li>Cookie-based session (7 days)</li>
      </ul>
    </div>
  );
}

function InviteCard(){
  const [link,setLink] = useState<string>('');
  const [code,setCode] = useState<string>('');
  const [newLink,setNewLink] = useState<string>('');
  const [err,setErr] = useState<string|null>(null);
  const [copied,setCopied] = useState(false);
  const [invites,setInvites] = useState<Array<{code:string;label?:string;uses?:number}>>([]);
  const [newCode,setNewCode] = useState('');
  const [newLabel,setNewLabel] = useState('');
  const loadInvites = async()=>{ try{ const r=await fetch('/api/auth/invites',{credentials:'include' as RequestCredentials, cache:'no-store'}); const j=await r.json(); if(r.ok) setInvites(j.invites||[]); }catch{} };
  useEffect(()=>{(async()=>{
    try{ const r=await fetch('/api/auth/invite', { credentials: 'include' as RequestCredentials }); const j=await r.json(); if(!r.ok) throw new Error(j?.error||'invite error'); setLink(j.link); setCode(j.code); }catch(e:any){ setErr(e?.message||'invite error'); }
    loadInvites();
  })();},[]);
  return (
    <div className="p-4 rounded-lg border border-[#1b2735] bg-[#0f1720] md:col-span-2">
      <div className="text-sm font-semibold text-gray-200 mb-2">Invite users</div>
      <p className="text-xs text-gray-400 mb-3">Share this link with people you want to invite. It includes your current invite code from <code className="text-gray-300">INVITE_CODE</code>. They will land on the signup page and can create an account.</p>
      {err ? (
        <div className="text-xs text-rose-400">{err}</div>
      ) : (
        <div className="flex items-center gap-2">
          <input value={link} readOnly className="flex-1 bg-[#0e1520] border border-[#233041] rounded px-3 py-2 text-xs text-gray-200" />
          <button onClick={()=>{ navigator.clipboard.writeText(link); setCopied(true); setTimeout(()=>setCopied(false),1500); }} className="px-3 py-2 rounded bg-cyan-600 hover:bg-cyan-500 text-sm">{copied? 'Copied' : 'Copy'}</button>
        </div>
      )}
      {code && (
        <div className="mt-2 text-[11px] text-gray-400">Invite code: <span className="text-gray-200 font-mono">{code}</span></div>
      )}
      <div className="mt-4">
        <div className="text-sm font-semibold text-gray-200 mb-1">Managed invites</div>
        <p className="text-xs text-gray-400 mb-2">Add multiple codes you can track. Signup accepts either the env code or any managed code below.</p>
        <div className="flex items-center gap-2 mb-2">
          <input value={newCode} onChange={e=>setNewCode(e.target.value)} placeholder="code (e.g., VIP2025)" className="bg-[#0e1520] border border-[#233041] rounded px-2 py-1 text-xs text-gray-200" />
          <input value={newLabel} onChange={e=>setNewLabel(e.target.value)} placeholder="label (source/campaign)" className="flex-1 bg-[#0e1520] border border-[#233041] rounded px-2 py-1 text-xs text-gray-200" />
          <button onClick={async()=>{ try{ const r=await fetch('/api/auth/invites',{method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ code:newCode, label:newLabel }), credentials:'include' as RequestCredentials}); const j=await r.json(); if(!r.ok) throw new Error(j?.error||'error'); setNewCode(''); setNewLabel(''); setInvites(j.invites||[]); if(j?.link) setNewLink(j.link); }catch(e:any){ setErr(e?.message||'error'); } }} className="px-3 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-xs">Add</button>
        </div>
        {newLink && (
          <div className="mb-2 flex items-center gap-2">
            <input value={newLink} readOnly className="flex-1 bg-[#0e1520] border border-[#233041] rounded px-2 py-1 text-xs text-gray-200" />
            <button onClick={()=>{ navigator.clipboard.writeText(newLink); setCopied(true); setTimeout(()=>setCopied(false),1500); }} className="px-2 py-1 rounded bg-cyan-600 hover:bg-cyan-500 text-xs">{copied? 'Copied' : 'Copy link'}</button>
          </div>
        )}
        <div className="text-xs text-gray-300 space-y-1">
          {invites.length===0 && <div className="text-gray-500">No managed invites.</div>}
          {invites.map((i)=> (
            <div key={i.code} className="flex items-center justify-between border border-[#233041] rounded px-2 py-1">
              <div className="flex items-center gap-3">
                <span className="font-mono">{i.code}</span>
                {i.label && <span className="text-gray-400">— {i.label}</span>}
                {typeof i.uses==='number' && <span className="text-gray-500">({i.uses} uses)</span>}
              </div>
              <div className="flex items-center gap-3">
                <button onClick={()=>{ const origin = (typeof window!=='undefined'? window.location.origin : ''); const l = `${origin}/signup?code=${encodeURIComponent(i.code)}`; navigator.clipboard.writeText(l); setCopied(true); setTimeout(()=>setCopied(false),1500); }} className="text-cyan-300 hover:underline">Copy link</button>
                <button onClick={async()=>{ if(!confirm('Remove invite '+i.code+'?')) return; try{ const r=await fetch('/api/auth/invites',{method:'DELETE', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ code:i.code }), credentials:'include' as RequestCredentials}); const j=await r.json(); if(r.ok) setInvites(j.invites||[]); }catch{} }} className="text-rose-300 hover:underline">Remove</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function WhitelistCard(){
  const [list,setList] = useState<string[]>([]);
  const [email,setEmail] = useState('');
  const [err,setErr] = useState<string|null>(null);
  const load = async()=>{ try{ const r=await fetch('/api/auth/whitelist', { credentials: 'include' as RequestCredentials }); const j=await r.json(); if(!r.ok) throw new Error(j?.error||'error'); setList(j.list||[]); }catch(e:any){ setErr(e?.message||'error'); } };
  useEffect(()=>{ load(); },[]);
  const add = async()=>{ try{ const r=await fetch('/api/auth/whitelist',{method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ email }), credentials: 'include' as RequestCredentials}); const j=await r.json(); if(!r.ok) throw new Error(j?.error||'error'); setEmail(''); load(); }catch(e:any){ setErr(e?.message||'error'); } };
  const del = async(e:string)=>{ try{ const r=await fetch('/api/auth/whitelist',{method:'DELETE', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ email:e }), credentials: 'include' as RequestCredentials}); const j=await r.json(); if(!r.ok) throw new Error(j?.error||'error'); load(); }catch(e:any){ setErr(e?.message||'error'); } };
  return (
    <div className="p-4 rounded-lg border border-[#1b2735] bg-[#0f1720] md:col-span-2">
      <div className="text-sm font-semibold text-gray-200 mb-2">Whitelist (bypass invite code)</div>
      <p className="text-xs text-gray-400 mb-2">Emails in this list can create accounts without an invite code. Others still need the current invite code.</p>
      {err && <div className="text-xs text-rose-400">{err}</div>}
      <div className="flex items-center gap-2">
        <input value={email} onChange={e=>setEmail(e.target.value)} placeholder="email@example.com" className="flex-1 bg-[#0e1520] border border-[#233041] rounded px-3 py-2 text-xs text-gray-200" />
        <button onClick={add} className="px-3 py-2 rounded bg-emerald-600 hover:bg-emerald-500 text-sm">Add</button>
      </div>
      <div className="mt-3 text-xs text-gray-300 space-y-1">
        {list.length===0 && <div className="text-gray-500">No whitelisted emails yet.</div>}
        {list.map((e)=> (
          <div key={e} className="flex items-center justify-between border border-[#233041] rounded px-2 py-1">
            <span>{e}</span>
            <button onClick={()=>del(e)} className="text-rose-300 hover:underline">Remove</button>
          </div>
        ))}
      </div>
    </div>
  );
}

function AIFallbackCard(){
  const [on,setOn] = useState<boolean|null>(null);
  const [err,setErr] = useState<string|null>(null);
  useEffect(()=>{(async()=>{ try{ const r=await fetch('/api/admin/flags',{credentials:'include' as RequestCredentials}); const j=await r.json(); if(!r.ok) throw new Error(j?.error||'error'); setOn(!!j.aiFallback);}catch(e:any){ setErr(e?.message||'error'); } })();},[]);
  const toggle = async()=>{ try{ const r=await fetch('/api/admin/flags',{method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ aiFallback: !on }), credentials:'include' as RequestCredentials}); const j=await r.json(); if(!r.ok) throw new Error(j?.error||'error'); setOn(prev=>!prev);}catch(e:any){ setErr(e?.message||'error'); } };
  return (
    <div className="p-4 rounded-lg border border-[#1b2735] bg-[#0f1720]">
      <div className="text-sm font-semibold text-gray-200 mb-2 flex items-center gap-2">
        <span>AI helper</span>
        <span className="text-xs text-gray-400">(uses a bot to fill gaps when scrapers fail)</span>
      </div>
      {err && <div className="text-xs text-rose-400 mb-2">{err}</div>}
      {on!==null && (
        <button onClick={toggle} className={`px-3 py-2 rounded text-sm flex items-center gap-2 ${on? 'bg-emerald-600 hover:bg-emerald-500 text-white':'bg-[#1a2330] hover:bg-[#202c3b] text-gray-400'}`}>
          <span>🤖</span>
          <span>{on? 'On':'Off'}</span>
        </button>
      )}
    </div>
  );
}

function ConsensusFlagCard(){
  const [on,setOn] = useState<boolean|null>(null);
  const [err,setErr] = useState<string|null>(null);
  useEffect(()=>{(async()=>{ try{ const r=await fetch('/api/admin/flags',{credentials:'include' as RequestCredentials}); const j=await r.json(); if(!r.ok) throw new Error(j?.error||'error'); setOn(!!j.consensusDerivedOnly);}catch(e:any){ setErr(e?.message||'error'); } })();},[]);
  const toggle = async()=>{ try{ const r=await fetch('/api/admin/flags',{method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ consensusDerivedOnly: !on }), credentials:'include' as RequestCredentials}); const j=await r.json(); if(!r.ok) throw new Error(j?.error||'error'); setOn(prev=>!prev);}catch(e:any){ setErr(e?.message||'error'); } };
  return (
    <div className="p-4 rounded-lg border border-[#1b2735] bg-[#0f1720]">
      <div className="text-sm font-semibold text-gray-200 mb-1">Consensus mode</div>
      <div className="text-xs text-gray-400 mb-2">Force derived consensus from odds (bypasses scrapers) for stability during spikes.</div>
      {err && <div className="text-xs text-rose-400 mb-2">{err}</div>}
      {on!==null && (
        <button onClick={toggle} className={`px-3 py-2 rounded text-sm ${on? 'bg-emerald-600 hover:bg-emerald-500 text-white':'bg-[#1a2330] hover:bg-[#202c3b] text-gray-400'}`}>
          {on? 'Derived-only (On)':'Derived-only (Off)'}
        </button>
      )}
    </div>
  );
}

function AnalyticsSummary(){
  const [data,setData] = useState<{total:number; uniqueSessions:number; uniqueUsers:number; daily:{date:string;count:number}[]} | null>(null);
  const [err,setErr] = useState<string|null>(null);
  const router = useRouter();
  useEffect(()=>{(async()=>{
    try{ const me=await fetch('/api/auth/me', { credentials: 'include' as RequestCredentials }); if(!me.ok){ router.replace('/login?next=/admin'); return; } const r=await fetch('/api/analytics/summary', { credentials: 'include' as RequestCredentials }); const j=await r.json(); if(!r.ok) throw new Error(j?.error||'error'); setData(j); }catch(e:any){ setErr(e?.message||'error'); }
  })();},[router]);
  return (
    <div className="p-4 rounded-lg border border-[#1b2735] bg-[#0f1720] md:col-span-2">
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm font-semibold text-gray-200">Analytics overview (14d)</div>
            <a href="/admin/analytics" className="text-xs text-cyan-300 underline" aria-label="Open full analytics">Open full</a>
      </div>
      {err && <div className="text-xs text-rose-400">{err}</div>}
      {data && (
        <>
          <div className="grid grid-cols-3 gap-4 text-center">
            <a href="/admin/analytics" className="block p-2 rounded hover:bg-[#121a27] transition-colors">
              <div className="text-xs text-gray-400">Total</div>
              <div className="text-xl font-bold">{data.total}</div>
            </a>
            <div className="p-2">
              <div className="text-xs text-gray-400">Sessions</div>
              <div className="text-xl font-bold">{data.uniqueSessions}</div>
            </div>
            <div className="p-2">
              <div className="text-xs text-gray-400">Users</div>
              <div className="text-xl font-bold">{data.uniqueUsers}</div>
            </div>
          </div>
          <AnalyticsTopPaths />
        </>
      )}
    </div>
  );
}

function TrendsCard(){
  const [data,setData] = useState<any|null>(null);
  const [err,setErr] = useState<string|null>(null);
  const router = useRouter();
  useEffect(()=>{(async()=>{
    try{ const me=await fetch('/api/auth/me', { credentials: 'include' as RequestCredentials }); if(!me.ok){ router.replace('/login?next=/admin'); return; } const r=await fetch('/api/analytics/trends', { credentials:'include' as RequestCredentials }); const j=await r.json(); if(!r.ok) throw new Error(j?.error||'error'); setData(j); }catch(e:any){ setErr(e?.message||'error'); }
  })();},[router]);
  function Spark({series}:{series:{date:string;count:number}[]}){
    if (!series || series.length===0) return null;
    const max = Math.max(...series.map(s=>s.count), 1);
    return (
      <div className="flex items-end gap-1 h-12">
        {series.slice(-28).map((s,i)=> (
          <div key={s.date+':'+i} className="w-2 bg-cyan-600 rounded-sm" style={{ height: `${Math.max(2, Math.round((s.count/max)*100))}%` }} title={`${s.date}: ${s.count}`} />
        ))}
      </div>
    );
  }
  const Badge=({label,val}:{label:string;val:number|null})=> (
    <div className={`px-2 py-1 rounded text-xs ${val==null? 'bg-[#1a2330] text-gray-400' : (val>=0? 'bg-emerald-600/30 text-emerald-300' : 'bg-rose-600/30 text-rose-300')}`}>{label}: {val==null? '—' : (val>0? '+'+val.toFixed(1) : val.toFixed(1))}%</div>
  );
  return (
    <div className="p-4 rounded-lg border border-[#1b2735] bg-[#0f1720] md:col-span-2">
      <div className="text-sm font-semibold text-gray-200 mb-2">Traffic trends</div>
      {err && <div className="text-xs text-rose-400">{err}</div>}
      {data && (
        <div className="flex flex-col md:flex-row gap-4 md:items-center md:justify-between">
          <Spark series={data.daily||[]} />
          <div className="flex flex-wrap gap-2">
            <Badge label="WoW" val={data?.deltas?.WoW ?? null} />
            <Badge label="MoM" val={data?.deltas?.MoM ?? null} />
            <Badge label="QoQ" val={data?.deltas?.QoQ ?? null} />
            <Badge label="YoY" val={data?.deltas?.YoY ?? null} />
          </div>
        </div>
      )}
    </div>
  );
}

function HitsCard(){
  const [tab,setTab] = useState<'today'|'month'>('today');
  const [data,setData] = useState<{today:number;month:number}|null>(null);
  const [err,setErr] = useState<string|null>(null);
  const router = useRouter();
  useEffect(()=>{(async()=>{
    try{ const me=await fetch('/api/auth/me',{credentials:'include' as RequestCredentials}); if(!me.ok){ router.replace('/login?next=/admin'); return; } const r=await fetch('/api/analytics/today-month',{credentials:'include' as RequestCredentials}); const j=await r.json(); if(!r.ok) throw new Error(j?.error||'error'); setData(j);}catch(e:any){ setErr(e?.message||'error'); }
  })();},[router]);
  return (
    <div className="p-4 rounded-lg border border-[#1b2735] bg-[#0f1720]">
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm font-semibold text-gray-200">Hits</div>
        <div className="flex gap-2 text-xs">
          <button onClick={()=>setTab('today')} className={`px-2 py-1 rounded ${tab==='today'?'bg-cyan-600 text-white':'bg-[#1a2330] text-gray-400'}`}>Today</button>
          <button onClick={()=>setTab('month')} className={`px-2 py-1 rounded ${tab==='month'?'bg-cyan-600 text-white':'bg-[#1a2330] text-gray-400'}`}>This month</button>
        </div>
      </div>
      {err && <div className="text-xs text-rose-400">{err}</div>}
      {data && (
        <div className="text-center py-4">
          <div className="text-xs text-gray-400 mb-1">{tab==='today'? 'Hits today' : 'Hits this month'}</div>
          <div className="text-3xl font-bold">{tab==='today'? data.today : data.month}</div>
        </div>
      )}
    </div>
  );
}

function AnalyticsTopPaths(){
  const [rows,setRows] = useState<{path:string;count:number}[]|null>(null);
  const [users,setUsers] = useState<string[]|null>(null);
  const [openUsers,setOpenUsers] = useState(false);
  useEffect(()=>{(async()=>{ try{ const r=await fetch('/api/analytics/detail', { credentials: 'include' as RequestCredentials }); const j=await r.json(); if(r.ok){ setRows(j.topPaths||[]); setUsers(j.usersList||[]);} }catch{} })();},[]);
  useEffect(()=>{ const t=setInterval(async()=>{ try{ const r=await fetch('/api/analytics/detail', { credentials: 'include' as RequestCredentials }); const j=await r.json(); if(r.ok){ setRows(j.topPaths||[]); setUsers(j.usersList||[]);} }catch{} }, 15000); return ()=>clearInterval(t); },[]);
  if (!rows) return null;
  return (
    <div className="mt-3 text-xs">
      <div className="text-gray-300 mb-1">Top paths</div>
      <div className="space-y-1">
        {rows.map(p=> (
          <div key={p.path} className="flex items-center justify-between border border-[#233041] rounded px-2 py-1">
            <span className="truncate mr-2">{p.path}</span>
            <span className="text-gray-400">{p.count}</span>
          </div>
        ))}
        {rows.length===0 && <div className="text-gray-500">No events yet.</div>}
      </div>
      {users && (
        <div className="mt-3">
          <div className="flex items-center justify-between">
            <div className="text-gray-300">Unique users ({users.length})</div>
            <button className="text-cyan-300" onClick={()=>setOpenUsers(v=>!v)}>{openUsers? 'Hide' : 'View'}</button>
          </div>
          {openUsers && (
            <div className="mt-1 space-y-1 max-h-32 overflow-auto">
              {users.map(u=> (
                <div key={u} className="border border-[#233041] rounded px-2 py-1 text-gray-200">{u}</div>
              ))}
              {users.length===0 && <div className="text-gray-500">No signed-in users yet.</div>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
