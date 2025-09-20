import { kvAvailable, kvHSet, kvHGetAll } from './kv';

export async function getFlag(key: string, def=false): Promise<boolean>{
  try{
    if (kvAvailable()){
      const h = await kvHGetAll('flags');
      const v = h?.[key]; if (v==null) return def; return v==='1' || v==='true';
    }
  }catch{}
  const env = process.env[`FLAG_${key.toUpperCase()}`];
  if (env!=null) return env==='1' || env==='true';
  return def;
}

export async function setFlag(key: string, val: boolean){
  try{ if (kvAvailable()) await kvHSet('flags', { [key]: val ? '1':'0' }); }catch{}
}
