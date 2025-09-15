export function pct(n:any){ const v=Number(n); if(!Number.isFinite(v)||v<0) return 0; if(v>100) return 100; return Math.round(v); }
export function num(n:any){ const v=Number(n); return Number.isFinite(v) ? v : 0; }
export function clamp(v:number,min:number,max:number){ return Math.min(Math.max(v,min),max); }
export function roundQuarter(v:number){ return Math.round(v*4)/4; }

