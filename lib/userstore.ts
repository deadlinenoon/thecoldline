import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { kvAvailable, kvHGetAll, kvHSet, kvSMembers, kvSAdd } from './kv';
import { kvSRem, kvDel } from './kv';

export type User = {
  email: string;
  salt: string;
  hash: string; // sha256(salt + password)
  role: 'admin'|'user';
  createdAt: string;
};

// Prefer writeable tmp storage in serverless environments; allow override via DATA_DIR
const DATA_DIR = process.env.DATA_DIR || '/tmp/data';
const USERS_PATH = path.join(DATA_DIR, 'users.json');

function ensureDir() {
  try { if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true }); }
  catch { /* best-effort; serverless may be read-only */ }
}

export function readUsers(): User[] {
  if (kvAvailable()) {
    // This is a sync wrapper; in KV mode, fall back to reading nothing here.
    return [];
  }
  try{
    if (!fs.existsSync(USERS_PATH)) return [];
    const txt = fs.readFileSync(USERS_PATH,'utf8');
    const j = JSON.parse(txt); return Array.isArray(j)? j as User[] : [];
  }catch{ return []; }
}

export function writeUsers(users: User[]) {
  try{
    ensureDir();
    const tmp = USERS_PATH + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(users, null, 2));
    fs.renameSync(tmp, USERS_PATH);
  }catch{ /* ignore write errors on read-only FS; caller may continue with session-only */ }
}

export function findUser(email: string): User | undefined {
  if (kvAvailable()) {
    // KV: HGETALL user:{email}
    // Synchronous API expected by callers — we can't await here, so this path isn't used directly.
    return undefined;
  }
  const u = readUsers(); return u.find(x => x.email.toLowerCase() === email.toLowerCase());
}

export async function createUser(email: string, password: string, role: 'admin'|'user' = 'user'): Promise<User> {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.createHash('sha256').update(salt + password).digest('hex');
  const user: User = { email, salt, hash, role, createdAt: new Date().toISOString() };
  if (kvAvailable()) {
    try{
      await kvHSet(`user:${email.toLowerCase()}`, { email: user.email, salt: user.salt, hash: user.hash, role: user.role, createdAt: user.createdAt });
      await kvSAdd('users:index', email.toLowerCase());
    }catch{}
  } else {
    const all = readUsers();
    all.push(user); writeUsers(all);
  }
  return user;
}

// Async helpers for KV consumers
export async function findUserKV(email: string): Promise<User | undefined> {
  if (!kvAvailable()) return findUser(email);
  try{
    const h = await kvHGetAll(`user:${email.toLowerCase()}`);
    if (!h) return undefined;
    return { email: h.email, salt: h.salt, hash: h.hash, role: (h.role as any) || 'user', createdAt: h.createdAt } as User;
  }catch{ return undefined; }
}

export async function readUsersKV(): Promise<User[]> {
  // Prefer KV, but include any filesystem users as a safety net if KV is empty/misconfigured
  if (!kvAvailable()) return readUsers();
  try{
    const emails = await kvSMembers('users:index');
    const out: User[] = [];
    for (const e of emails) {
      const h = await kvHGetAll(`user:${e}`);
      if (h) out.push({ email: h.email, salt: h.salt, hash: h.hash, role: (h.role as any)||'user', createdAt: h.createdAt });
    }
    // If KV returned nothing, merge with any local file users (e.g., created pre-KV or in dev)
    if (out.length === 0) {
      const fileUsers = readUsers();
      // Deduplicate by email
      const seen = new Set(out.map(u=>u.email.toLowerCase()));
      for (const u of fileUsers) {
        const key = u.email.toLowerCase();
        if (!seen.has(key)) { out.push(u); seen.add(key); }
      }
    }
    return out;
  }catch{
    // On any KV error, fall back to file users
    return readUsers();
  }
}

export async function setUserRole(email: string, role: 'admin'|'user'){
  if (kvAvailable()){
    try{ await kvHSet(`user:${email.toLowerCase()}`, { role }); }catch{}
    return;
  }
  const all = readUsers();
  const i = all.findIndex(u => u.email.toLowerCase()===email.toLowerCase());
  if (i>=0){ all[i] = { ...all[i], role }; writeUsers(all); }
}

export async function deleteUser(email: string){
  if (kvAvailable()){
    try{ await kvDel(`user:${email.toLowerCase()}`); await kvSRem('users:index', email.toLowerCase()); }catch{}
    return;
  }
  const all = readUsers().filter(u => u.email.toLowerCase()!==email.toLowerCase());
  writeUsers(all);
}

export function verifyUserPassword(email: string, password: string): User | null {
  // In environments where KV is configured but may be empty or out-of-sync,
  // we still allow verifying against any filesystem users to avoid lockouts.
  let u: User | undefined = undefined;
  if (kvAvailable()) {
    try {
      const all = readUsers();
      u = all.find(x => x.email.toLowerCase() === email.toLowerCase());
    } catch {
      u = undefined;
    }
  } else {
    u = findUser(email);
  }
  if (!u) return null;
  const hash = crypto.createHash('sha256').update(u.salt + password).digest('hex');
  // timingSafeEqual throws on length mismatch; guard for safety
  const ok = (hash.length === u.hash.length)
    ? crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(u.hash))
    : (hash === u.hash);
  return ok ? u : null;
}

// Update or set a user's password (used by upsert with invite code or admin flows)
export async function setUserPassword(email: string, newPassword: string){
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.createHash('sha256').update(salt + newPassword).digest('hex');
  if (kvAvailable()){
    try{ await kvHSet(`user:${email.toLowerCase()}`, { salt, hash }); return; }catch{}
  }
  const users = readUsers();
  const i = users.findIndex(u=> u.email.toLowerCase()===email.toLowerCase());
  if (i>=0){ users[i] = { ...users[i], salt, hash }; writeUsers(users); }
}
