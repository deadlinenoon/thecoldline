import { useEffect, useState } from 'react';

export default function AdminStatus(){
  const [ok, setOk] = useState<boolean|null>(null);
  const [kv, setKv] = useState<boolean>(false);
  const [auth, setAuth] = useState<boolean>(false);
  const [err, setErr] = useState<string|null>(null);
  useEffect(()=>{(async()=>{ try{ const r=await fetch('/api/admin/status'); const j=await r.json(); if(!r.ok) throw new Error(j?.error||'error'); setOk(!!j.ok); setKv(!!j.kv); setAuth(!!j.auth); }catch(e:any){ setErr(e?.message||'error'); } })();},[]);
  return (
    <div className="min-h-screen bg-cl-bg text-white p-6">
      <div className="max-w-xl mx-auto">
        <div className="text-xl font-semibold mb-4">Admin Status</div>
        {err && <div className="text-rose-400 text-sm mb-2">{err}</div>}
        <div className="p-4 rounded border border-[#233041] bg-[#0e1520] text-sm">
          <div className="mb-2">KV: <span className={kv? 'text-emerald-300':'text-rose-300'}>{kv? 'Connected':'Not Connected'}</span></div>
          <div>Auth secret: <span className={auth? 'text-emerald-300':'text-rose-300'}>{auth? 'Present':'Missing'}</span></div>
        </div>
      </div>
    </div>
  );
}

