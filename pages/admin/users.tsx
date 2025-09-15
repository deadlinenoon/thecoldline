import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';

type Row = { email:string; role:string; createdAt?:string };

export default function Users(){
  const router = useRouter();
  const [rows,setRows] = useState<Row[]|null>(null);
  const [filter,setFilter] = useState('');
  const [err,setErr] = useState<string|null>(null);
  useEffect(()=>{(async()=>{
    try{
      const me = await fetch('/api/auth/me', { credentials: 'include' as RequestCredentials }); if(!me.ok){ router.replace('/login?next=/admin/users'); return; }
      const mj = await me.json(); const allow = new Set(['garitar@gmail.com','georgesantiago55@me.com','betsharp@icloud.com']); const email=String(mj?.email||'').trim().toLowerCase(); if(!allow.has(email)){ router.replace('/'); return; }
      const r = await fetch('/api/auth/users', { credentials: 'include' as RequestCredentials }); const j = await r.json(); if(!r.ok) throw new Error(j?.error||'error'); setRows(j.users||[]);
    }catch(e:any){ setErr(e?.message||'error'); }
  })();},[router]);

  if (err) return <div className="min-h-screen bg-cl-bg text-white flex items-center justify-center">{err}</div>;
  if (!rows) return <div className="min-h-screen bg-cl-bg text-white flex items-center justify-center">Loading…</div>;
  return (
    <div className="min-h-screen bg-cl-bg text-white p-6">
      <div className="max-w-4xl mx-auto space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <a href="/admin" aria-label="Admin Home"><img src="/logo-ice-script.svg" className="h-8 w-auto" /></a>
            <div className="text-xl font-semibold">Users</div>
          </div>
          <div className="flex items-center gap-2">
            <a href="/" className="px-3 py-2 rounded bg-[#1a2330] hover:bg-[#202c3b] text-sm">Frontend</a>
            <a href="/admin" className="px-3 py-2 rounded bg-[#1a2330] hover:bg-[#202c3b] text-sm">Admin</a>
          </div>
        </div>
        <div className="p-4 rounded-lg border border-[#1b2735] bg-[#0f1720]">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm font-semibold text-gray-200">All signups</div>
            <input value={filter} onChange={e=>setFilter(e.target.value)} placeholder="Search email" className="bg-[#0e1520] border border-[#233041] rounded px-2 py-1 text-xs text-gray-200" />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-gray-400">
                <tr>
                  <th className="py-2 pr-3">Email</th>
                  <th className="py-2 pr-3">Role</th>
                  <th className="py-2 pr-3">Created</th>
                  <th className="py-2 pr-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="text-gray-200">
                {rows.filter(r=> r.email.toLowerCase().includes(filter.toLowerCase())).map((r)=> (
                  <tr key={r.email} className="border-t border-[#1b2735]">
                    <td className="py-2 pr-3">{r.email}</td>
                    <td className="py-2 pr-3">{r.role}</td>
                    <td className="py-2 pr-3">{r.createdAt? new Date(r.createdAt).toLocaleString() : '—'}</td>
                    <td className="py-2 pr-3">
                      <div className="flex items-center gap-2 justify-end">
                        {r.role!=='admin' ? (
                          <button onClick={async()=>{ await fetch('/api/auth/user-role',{method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ email: r.email, role:'admin' })}); location.reload(); }} className="px-2 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-xs">Promote</button>
                        ) : (
                          <button onClick={async()=>{ await fetch('/api/auth/user-role',{method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ email: r.email, role:'user' })}); location.reload(); }} className="px-2 py-1 rounded bg-[#1a2330] hover:bg-[#202c3b] text-xs">Demote</button>
                        )}
                        <button onClick={async()=>{ if(confirm('Delete user '+r.email+'?')){ await fetch('/api/auth/user-delete',{method:'DELETE', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ email: r.email })}); location.reload(); } }} className="px-2 py-1 rounded bg-rose-600 hover:bg-rose-500 text-xs">Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
                {rows.length===0 && (
                  <tr><td className="py-3 text-gray-400" colSpan={3}>No users persisted yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
