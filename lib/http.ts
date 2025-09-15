export async function getJson<T=any>(url: string, retries = 2, timeoutMs = 10000): Promise<T|any>{
  for (let i=0;i<=retries;i++){
    try{
      const ac = new AbortController();
      const t = setTimeout(()=> ac.abort(), timeoutMs);
      const r = await fetch(url, { headers:{ Accept:'application/json','User-Agent':'Mozilla/5.0 (TCL)' }, cache:'no-store', signal: ac.signal as any });
      clearTimeout(t);
      const j = await r.json().catch(()=>({}));
      if (!r.ok) throw new Error(String(j?.error||`HTTP ${r.status}`));
      return j;
    }catch(e){ if(i===retries) return {}; }
  }
  return {};
}

