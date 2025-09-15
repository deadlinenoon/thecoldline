import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';

export default function Signup() {
  const router = useRouter();
  const next = typeof router.query.next === 'string' ? router.query.next : '/';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [err, setErr] = useState<string|null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      try{ const r = await fetch('/api/auth/me'); if (r.ok) router.replace(next); }catch{}
    })();
  }, [next, router]);

  // Prefill invite code from URL if present (supports code, invite, promo)
  useEffect(() => {
    const q = router.query;
    const fromQuery = (typeof q.code==='string' && q.code)
      || (typeof q.invite==='string' && q.invite)
      || (typeof q.promo==='string' && q.promo)
      || '';
    if (fromQuery && !code) setCode(fromQuery);
  }, [router.query, code]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true); setErr(null);
    try{
      const r = await fetch('/api/auth/signup', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ email, password, code }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error || 'Signup error');
      router.replace(next || '/');
    }catch(e:any){ setErr(e?.message||'Signup error'); }
    finally{ setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-cl-bg text-white flex items-center justify-center p-6">
      <div className="relative w-full max-w-sm bg-[#0f1720] border border-[#1b2735] rounded-xl p-6 shadow-[0_10px_28px_rgba(0,0,0,0.35)]">
        <button
          aria-label="Close"
          onClick={() => router.replace(`/login?next=${encodeURIComponent(next)}`)}
          className="absolute top-2 right-2 text-gray-400 hover:text-gray-200"
        >
          ✕
        </button>
        <div className="text-lg font-semibold mb-4">Create account</div>
        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="block text-sm text-gray-300 mb-1">Email</label>
            <input type="email" required value={email} onChange={e=>setEmail(e.target.value)} className="w-full bg-[#0e1520] border border-[#233041] rounded px-3 py-2 text-white" />
          </div>
          <div>
            <label className="block text-sm text-gray-300 mb-1">Password</label>
            <input type="password" required value={password} onChange={e=>setPassword(e.target.value)} className="w-full bg-[#0e1520] border border-[#233041] rounded px-3 py-2 text-white" />
          </div>
          <div>
            <label className="block text-sm text-gray-300 mb-1">Invite code</label>
            <input type="text" required value={code} onChange={e=>setCode(e.target.value)} className="w-full bg-[#0e1520] border border-[#233041] rounded px-3 py-2 text-white" />
          </div>
          {err && <div className="text-sm text-rose-400">{err}</div>}
          <button disabled={loading} className="w-full mt-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 rounded px-3 py-2 font-semibold">{loading? 'Creating…' : 'Sign up'}</button>
        </form>
        <div className="mt-4 text-center text-xs text-gray-400">
          Already have an account?&nbsp;
          <a href={`/login?next=${encodeURIComponent(next)}`} className="text-cyan-300 underline">Sign in</a>
        </div>
      </div>
    </div>
  );
}
