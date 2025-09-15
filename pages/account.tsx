import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';

export default function Account(){
  const router = useRouter();
  const [me,setMe] = useState<{email:string,role?:string}|null>(null);
  const [avatar,setAvatar] = useState<string|null>(null);
  const [pending,setPending] = useState<string|null>(null);
  const [uploading,setUploading] = useState(false);
  const [upMsg,setUpMsg] = useState<string|null>(null);
  const [oldPw,setOldPw] = useState('');
  const [newPw,setNewPw] = useState('');
  const [pwMsg,setPwMsg] = useState<string|null>(null);
  const [inviteLink,setInviteLink] = useState<string>('');
  const [inviteErr,setInviteErr] = useState<string|null>(null);
  const [copied,setCopied] = useState(false);

  useEffect(()=>{(async()=>{
    const r = await fetch('/api/auth/me'); if (!r.ok){ router.replace('/login?next=/account'); return; }
    const j = await r.json(); setMe(j);
    try{ const inv = await fetch('/api/auth/invite'); if(inv.ok){ const ij = await inv.json(); setInviteLink(ij.link); } }catch{}
    try{ const a = await fetch('/api/profile/avatar', { cache:'no-store' }); if(a.ok && a.status!==204){ const b=await a.blob(); setAvatar(URL.createObjectURL(b)); } }catch{}
  })();},[router]);

  const changePw = async (e: React.FormEvent)=>{
    e.preventDefault(); setPwMsg(null);
    try{
      const r = await fetch('/api/auth/change-password',{ method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ oldPassword: oldPw, newPassword: newPw })});
      const j = await r.json(); if(!r.ok) throw new Error(j?.error||'error'); setPwMsg('Password updated'); setOldPw(''); setNewPw('');
    }catch(e:any){ setPwMsg(e?.message||'Error'); }
  };

  if (!me) return <div className="min-h-screen bg-cl-bg text-white flex items-center justify-center">Loading…</div>;
  return (
    <div className="min-h-screen bg-cl-bg text-white p-6">
      <div className="max-w-lg mx-auto space-y-6">
        <div className="p-5 rounded-xl border border-[#1b2735] bg-[#0f1720]">
          <div className="text-sm font-semibold text-gray-200 mb-2">Profile photo</div>
          <div className="flex items-center gap-3">
            {pending ? (
              <img src={pending} alt="Pending profile" className="h-12 w-12 rounded-full object-cover border border-amber-500/50" />
            ) : avatar ? (
              <img src={avatar} alt="Profile" className="h-12 w-12 rounded-full object-cover border border-[#233041]" />
            ) : (
              <div className="h-12 w-12 rounded-full bg-slate-800 border border-[#233041] flex items-center justify-center text-xs text-gray-300">You</div>
            )}
            <label className="px-3 py-2 rounded bg-cyan-600 hover:bg-cyan-500 text-sm cursor-pointer">
              <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={async(e)=>{
                const f = e.target.files?.[0]; if(!f) return; setUpMsg(null);
                try{
                  // Resize large images client-side for performance (~256px square)
                  const dataUrl = await (async()=>{
                    try{
                      const img = document.createElement('img'); img.src = URL.createObjectURL(f);
                      await new Promise(r=>{ img.onload=()=>r(null); img.onerror=()=>r(null); });
                      const c = document.createElement('canvas'); const ctx = c.getContext('2d'); if(!ctx) throw new Error('no ctx');
                      const size = 256; const s = Math.min(img.width, img.height);
                      const sx = (img.width - s)/2; const sy = (img.height - s)/2;
                      c.width = size; c.height = size; ctx.drawImage(img, sx, sy, s, s, 0, 0, size, size);
                      return c.toDataURL('image/webp', 0.9);
                    }catch{
                      return await new Promise<string>((resolve)=>{ const reader=new FileReader(); reader.onload=()=>resolve(String(reader.result)); reader.readAsDataURL(f); });
                    }
                  })();
                  setPending(dataUrl);
                  setUpMsg('Ready to save');
                }catch(e:any){ setUpMsg(e?.message||'Error'); }
                finally{ e.currentTarget.value=''; }
              }} />
              Choose photo
            </label>
            <button
              disabled={!pending || uploading}
              onClick={async()=>{
                if (!pending) return; setUploading(true); setUpMsg(null);
                try{
                  const r = await fetch('/api/profile/avatar', { method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify({ dataUrl: pending }) });
                  const j = await r.json().catch(()=>({})); if(!r.ok) throw new Error(j?.error||'save failed');
                  setUpMsg('Saved'); setPending(null);
                  try{ const a = await fetch('/api/profile/avatar', { cache:'no-store' }); if(a.ok && a.status!==204){ const b=await a.blob(); setAvatar(URL.createObjectURL(b)); } }catch{}
                }catch(e:any){ setUpMsg(e?.message||'Error'); }
                finally{ setUploading(false); }
              }}
              className={`px-3 py-2 rounded text-sm ${(!pending||uploading)?'bg-[#1a2330] text-gray-400':'bg-emerald-600 hover:bg-emerald-500 text-white'}`}
            >
              {uploading? 'Saving…' : 'Save'}
            </button>
            {pending && (
              <button onClick={()=>{ setPending(null); setUpMsg(null); }} className="px-3 py-2 rounded bg-[#1a2330] hover:bg-[#202c3b] text-sm">Cancel</button>
            )}
          </div>
          {upMsg && <div className="mt-2 text-xs text-gray-400">{upMsg}</div>}
        </div>
        <div className="p-5 rounded-xl border border-[#1b2735] bg-[#0f1720]">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-gray-400">Signed in as</div>
              <div className="text-lg font-semibold">{me.email}</div>
            </div>
            <button
              onClick={async()=>{ try{ await fetch('/api/auth/logout',{method:'POST'});}catch{} finally{ router.replace('/login'); } }}
              className="px-3 py-2 rounded bg-[#1a2330] hover:bg-[#202c3b] text-sm"
            >
              Log out
            </button>
          </div>
        </div>
        <div className="p-5 rounded-xl border border-[#1b2735] bg-[#0f1720]">
          <div className="text-sm font-semibold text-gray-200 mb-2">Change password</div>
          <form onSubmit={changePw} className="space-y-3">
            <input value={oldPw} onChange={e=>setOldPw(e.target.value)} type="password" placeholder="Current password" className="w-full bg-[#0e1520] border border-[#233041] rounded px-3 py-2 text-white" />
            <input value={newPw} onChange={e=>setNewPw(e.target.value)} type="password" placeholder="New password" className="w-full bg-[#0e1520] border border-[#233041] rounded px-3 py-2 text-white" />
            {pwMsg && <div className="text-xs text-gray-300">{pwMsg}</div>}
            <button className="bg-emerald-600 hover:bg-emerald-500 rounded px-3 py-2 text-sm">Update password</button>
          </form>
          {me.role==='admin' && (
            <div className="mt-2 text-[11px] text-gray-400">Admin password is env-managed; use ADMIN_SALT/ADMIN_PWHASH to rotate.</div>
          )}
        </div>
        <div className="p-5 rounded-xl border border-[#1b2735] bg-[#0f1720]">
          <div className="text-sm font-semibold text-gray-200 mb-2">Invite link</div>
          <p className="text-xs text-gray-400 mb-2">Share with a friend to sign up (requires valid INVITE_CODE and may be admin-only).</p>
          {inviteErr ? (
            <div className="text-xs text-rose-400">{inviteErr}</div>
          ) : (
            <div className="flex items-center gap-2">
              <input value={inviteLink} readOnly className="flex-1 bg-[#0e1520] border border-[#233041] rounded px-3 py-2 text-xs text-gray-200" />
              <button onClick={()=>{ navigator.clipboard.writeText(inviteLink); setCopied(true); setTimeout(()=>setCopied(false),1500); }} className="px-3 py-2 rounded bg-cyan-600 hover:bg-cyan-500 text-sm">{copied? 'Copied' : 'Copy'}</button>
            </div>
          )}
          <div className="mt-2 text-[11px] text-gray-400">If you get a forbidden error, an admin can enable user invites by setting <code className="text-gray-300">INVITES_ALLOW_USERS=1</code>.</div>
        </div>
      </div>
    </div>
  );
}
