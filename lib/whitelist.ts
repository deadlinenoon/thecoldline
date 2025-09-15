import fs from 'fs';
import path from 'path';
import { kvAvailable, kvSMembers, kvSAdd, kvSRem } from './kv';

const DATA_DIR = process.env.DATA_DIR || '/tmp/data';
const WL_PATH = path.join(DATA_DIR, 'whitelist.json');

function ensureDirSafe(){ try{ if(!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR,{recursive:true}); }catch{} }

export function readWhitelist(): string[] {
  if (kvAvailable()) { return []; }
  try{ if(!fs.existsSync(WL_PATH)) return []; const txt=fs.readFileSync(WL_PATH,'utf8'); const j=JSON.parse(txt); return Array.isArray(j)? j as string[] : []; }catch{ return []; }
}

export function writeWhitelist(list: string[]){ try{ ensureDirSafe(); fs.writeFileSync(WL_PATH, JSON.stringify(list, null, 2)); }catch{} }

export function addWhitelistEmail(email: string){ const e=email.trim().toLowerCase(); if(!e) return; const list=readWhitelist(); if(!list.includes(e)){ list.push(e); writeWhitelist(list); } }

export function removeWhitelistEmail(email: string){ const e=email.trim().toLowerCase(); const list=readWhitelist().filter(x=>x!==e); writeWhitelist(list); }

export function isWhitelisted(email: string){ const e=email.trim().toLowerCase(); return readWhitelist().includes(e); }

// Async helpers for KV
export async function readWhitelistKV(): Promise<string[]>{ if (!kvAvailable()) return readWhitelist(); try{ return await kvSMembers('whitelist'); }catch{ return []; } }
export async function addWhitelistEmailKV(email:string){ const e=email.trim().toLowerCase(); if(!kvAvailable()) return addWhitelistEmail(e); try{ await kvSAdd('whitelist', e); }catch{} }
export async function removeWhitelistEmailKV(email:string){ const e=email.trim().toLowerCase(); if(!kvAvailable()) return removeWhitelistEmail(e); try{ await kvSRem('whitelist', e); }catch{} }
