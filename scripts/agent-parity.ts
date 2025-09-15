// Simple parity checker for /api/agent
const matchups = [
  { home: 'CHI', away: 'GB', kickoff: '2025-09-14T17:00:00Z' },
  { home: 'NE', away: 'NYJ', kickoff: '2025-09-14T17:00:00Z' },
];

function isNum(x:any){ return typeof x==='number' && Number.isFinite(x); }

async function run(){
  const base = process.env.BASE_URL || 'http://localhost:3000';
  let failed = 0;
  for (const m of matchups){
    const u = `${base}/api/agent?home=${encodeURIComponent(m.home)}&away=${encodeURIComponent(m.away)}&kickoff=${encodeURIComponent(m.kickoff)}&force=1`;
    try{
      const r = await fetch(u); const j = await r.json();
      const keys = ['odds','weather','injuries','plays','travel','redzone','h2h','notes','consensus','mov'];
      const missing = keys.filter(k => !(k in j));
      const numsOk = [
        isNum(j?.weather?.temp_f), isNum(j?.weather?.wind_mph),
        isNum(j?.plays?.home?.offense), isNum(j?.plays?.home?.defense),
        isNum(j?.travel?.home?.milesSeasonToDate),
        isNum(j?.redzone?.home?.offensePct), isNum(j?.redzone?.home?.defensePct)
      ].every(Boolean);
      if (missing.length || !numsOk){
        failed++;
        console.log('FAIL', m.home,'vs',m.away, 'missing:', missing.join(','), 'numsOk:', numsOk);
      } else {
        console.log('OK  ', m.home,'vs',m.away);
      }
    }catch(e:any){ failed++; console.log('ERR ', m.home,'vs',m.away, e?.message||e); }
  }
  if (failed){ process.exitCode = 1; }
}

run();

