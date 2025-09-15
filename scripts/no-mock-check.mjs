import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
const ROOT = process.cwd();
const BANNED = [/\bplaceholder\b/i,/\bplace holder\b/i,/\blorem\b/i,/\bipsum\b/i,/\bmock\b/i,/\bsample data\b/i,/\bfake\b/i,/\bstub\b/i];
const ALLOW = [/^\s*\/\/.*$/,/no-mock-check/]; // allow in single-line comments and guard filename refs

function lineAllowed(line){
  if (ALLOW.some(a=>a.test(line))) return true;
  // allow HTML/JSX attribute placeholder= for inputs; policy targets content, not attribute name
  if (/\bplaceholder\s*=/.test(line)) return true;
  return false;
}

function walk(d){
  for(const f of readdirSync(d)){
    if(f==='.next'||f==='node_modules'||f==='.git') continue;
    const p = join(d,f); const s = statSync(p);
    if(s.isDirectory()) walk(p); else if(/\.(ts|tsx|js|jsx|json|md)$/i.test(f)){
      const txt = readFileSync(p,'utf8');
      for(const rx of BANNED){
        if(rx.test(txt)){
          const lines = txt.split('\n').filter(l=>!lineAllowed(l));
          if(lines.some(l=>rx.test(l))){
            console.error(`[NO-MOCK] Banned token ${rx} found in ${p}`);
            process.exit(1);
          }
        }
      }
    }
  }
}
walk(ROOT);
console.log('[NO-MOCK] check passed');
