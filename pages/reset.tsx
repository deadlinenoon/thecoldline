import { useRouter } from 'next/router';
import { useState } from 'react';

export default function Reset(){
  const router = useRouter();
  const { token } = router.query as { token?: string };
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [newPw, setNewPw] = useState('');
  const [confirm, setConfirm] = useState('');
  const [msg, setMsg] = useState<string|null>(null);
  const [loading, setLoading] = useState(false);

  const requestReset = async (e: React.FormEvent)=>{
    e.preventDefault(); setMsg(null); setLoading(true);
    try{
      await fetch('/api/auth/reset-request',{ method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ email }) });
      setSent(true);
    }catch(e:any){ setMsg(e?.message||'Error'); } finally{ setLoading(false); }
  };

  const submitNew = async (e: React.FormEvent)=>{
    e.preventDefault(); setMsg(null);
    if (newPw !== confirm) { setMsg('Passwords do not match'); return; }
    setLoading(true);
    try{
      const r = await fetch('/api/auth/reset',{ method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ token, newPassword: newPw }) });
      const j = await r.json(); if(!r.ok) throw new Error(j?.error||'Error');
      router.replace('/login');
    }catch(e:any){ setMsg(e?.message||'Error'); } finally{ setLoading(false); }
  };

  const hasToken = typeof token==='string' && token.length>0;

  return (
    <div className="min-h-screen bg-cl-bg text-white flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="p-6 rounded-xl border border-[#1b2735] bg-[#0f1720] shadow-[0_10px_28px_rgba(0,0,0,0.35)]">
          {!hasToken ? (
            <>
              <div className="text-lg font-semibold mb-1">Forgot your password?</div>
              <div className="text-sm text-gray-400 mb-4">Enter your email and we’ll send a reset link if an account exists.</div>
              {sent ? (
                <div className="text-sm text-emerald-300">If an account exists for {email}, a reset link has been sent.</div>
              ) : (
                <form onSubmit={requestReset} className="space-y-3">
                  <div>
                    <label className="block text-sm text-gray-300 mb-1">Email</label>
                    <input type="email" required value={email} onChange={e=>setEmail(e.target.value)} className="w-full bg-[#0e1520] border border-[#233041] rounded px-3 py-2 text-white" />
                  </div>
                  {msg && <div className="text-xs text-rose-400">{msg}</div>}
                  <button disabled={loading} className="w-full mt-2 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-60 rounded px-3 py-2 font-semibold">{loading? 'Sending…' : 'Send reset link'}</button>
                </form>
              )}
            </>
          ) : (
            <>
              <div className="text-lg font-semibold mb-1">Set a new password</div>
              <div className="text-sm text-gray-400 mb-4">Enter a new password for your account.</div>
              <form onSubmit={submitNew} className="space-y-3">
                <div>
                  <label className="block text-sm text-gray-300 mb-1">New password</label>
                  <input type="password" required value={newPw} onChange={e=>setNewPw(e.target.value)} className="w-full bg-[#0e1520] border border-[#233041] rounded px-3 py-2 text-white" />
                </div>
                <div>
                  <label className="block text-sm text-gray-300 mb-1">Confirm password</label>
                  <input type="password" required value={confirm} onChange={e=>setConfirm(e.target.value)} className="w-full bg-[#0e1520] border border-[#233041] rounded px-3 py-2 text-white" />
                </div>
                {msg && <div className="text-xs text-rose-400">{msg}</div>}
                <button disabled={loading} className="w-full mt-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 rounded px-3 py-2 font-semibold">{loading? 'Updating…' : 'Update password'}</button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
