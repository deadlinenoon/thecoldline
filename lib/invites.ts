import { kvAvailable, kvHGetAll, kvHSet, kvSMembers, kvSAdd, kvSRem, kvIncrBy, kvDel, getKV } from './kv';

export type Invite = { code: string; label?: string; createdAt?: string; createdBy?: string; uses?: number };

export async function listInvites(): Promise<Invite[]>{
  if (!kvAvailable()) return [];
  try{
    const codes = await kvSMembers('invites:index');
    const out: Invite[] = [];
    const kv = await getKV();
    for (const c of codes){
      const h = await kvHGetAll(`invite:${c}`);
      let uses = h?.uses? Number(h.uses) : 0;
      try{ const u = await kv?.get(`invite:${c}:uses`); if (u!=null) uses = Number(u)||0; }catch{}
      out.push({ code: c, label: h?.label, createdAt: h?.createdAt, createdBy: h?.createdBy, uses });
    }
    return out.sort((a,b)=> String(a.createdAt||'').localeCompare(String(b.createdAt||'')));
  }catch{ return []; }
}

export async function addInvite(code: string, label?: string, createdBy?: string){
  if (!kvAvailable()) return;
  const c = String(code||'').trim(); if (!c) return;
  try{
    await kvSAdd('invites:index', c.toLowerCase());
    await kvHSet(`invite:${c.toLowerCase()}`, { code: c.toLowerCase(), label: label||'', createdAt: new Date().toISOString(), createdBy: createdBy||'' , uses: 0 });
  }catch{}
}

export async function removeInvite(code: string){
  if (!kvAvailable()) return;
  const c = String(code||'').trim().toLowerCase(); if (!c) return;
  try{ await kvSRem('invites:index', c); await kvDel(`invite:${c}`); }catch{}
}

export async function markInviteUsed(code: string){
  if (!kvAvailable()) return;
  const c = String(code||'').trim().toLowerCase(); if (!c) return;
  try{ await kvIncrBy(`invite:${c}:uses`, 1); }catch{}
}
