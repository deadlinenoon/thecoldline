const path = require('path');
const fs = require('fs');
const os = require('os');
const http = require('http');
const { spawn } = require('child_process');

async function wait(ms){ return new Promise(r => setTimeout(r, ms)); }

async function waitForUrl(url, timeoutMs=60000){
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const tick = () => {
      const req = http.get(url, res => {
        if (res.statusCode === 200) { res.resume(); resolve(); }
        else { res.resume(); retry(); }
      });
      req.on('error', retry);
      function retry(){
        if (Date.now() - start > timeoutMs) return reject(new Error('Timeout waiting for '+url));
        setTimeout(tick, 500);
      }
    };
    tick();
  });
}

function run(cmd, args, opts={}){
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: 'inherit', ...opts });
    child.on('exit', code => code===0 ? resolve() : reject(new Error(cmd+" exited "+code)) );
    child.on('error', reject);
  });
}

async function buildAndStart(port){
  const env = { ...process.env, PORT: String(port) };
  await run(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['next', 'build'], { env });
  const started = spawn(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['next', 'start', '-p', String(port)], { env, stdio: 'inherit' });
  return started;
}

function startFallbackServer(port){
  const html = `<!DOCTYPE html>
  <html lang="en">
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>The Cold Line – Tutorial (Fallback)</title>
  <style>
    body{ margin:0; background:#0b1220; color:#e5f9f2; font:16px/1.4 -apple-system, system-ui, Segoe UI, Roboto, 'Helvetica Neue', Arial; }
    header{ position:sticky; top:0; z-index:10; background:linear-gradient(90deg,#0b1220,#0a101a,#0b1220); border-bottom:1px solid rgba(0,224,164,.35); padding:12px 20px; display:flex; align-items:center; justify-content:space-between; }
    h1,h2{ margin:0 0 8px; }
    main{ max-width:980px; margin:0 auto; padding:20px; }
    .card{ border:1px solid #e5e7eb; background:#fff; color:#111827; border-radius:10px; padding:12px; box-shadow:0 1px 2px rgba(0,0,0,.05); margin:0 0 16px; }
    .bar{ height:8px; border-radius:6px; background:linear-gradient(90deg,#e5e7eb,#6ee7b7,#10b981); }
    .row{ display:flex; align-items:center; justify-content:space-between; }
    .muted{ color:#6b7280; font-size:12px; }
  </style>
  <body>
    <header>
      <strong>The Cold Line</strong>
      <nav style="display:flex; gap:8px; align-items:center;">
        <a href="#video" style="color:#00e0a4; text-decoration:none; padding:6px 10px; border:1px solid rgba(0,224,164,.35); border-radius:8px; background:rgba(16,185,129,.12)">Intro Video</a>
        <a href="/tutorial.pdf" style="color:#00e0a4; text-decoration:none; padding:6px 10px; border:1px solid rgba(0,224,164,.35); border-radius:8px; background:rgba(16,185,129,.12)">PDF</a>
      </nav>
    </header>
    <main>
      <section id="video" class="card">
        <h2>Intro Video</h2>
        <p class="muted">A short walkthrough of key parts.</p>
        <div style="background:#000; height:300px; border-radius:8px; border:1px solid #e5e7eb"></div>
      </section>
      <div class="card">
        <h2>1) Market vs Cold Line</h2>
        <div class="row"><strong>Chiefs -3.5</strong><span style="color:#6b7280">→</span><strong>Bears +3.5</strong></div>
        <div class="muted">Cold example: Chiefs -2.0 (delta +1.5 to Bears)</div>
      </div>
      <div class="card">
        <h2>2) Sliders</h2>
        <div class="bar"></div>
        <div class="muted" style="margin-top:8px;">Running total: +1.5 to home</div>
      </div>
      <div class="card" id="verdict">
        <h2>5) Verdict Scale</h2>
        <div class="bar"></div>
        <div class="muted" style="margin-top:8px;">🤝 Pass 0.00–1.49 • 🙂 Lean / 🎯 Play 1.50–4.99 • 🔨 5.00+</div>
      </div>
      <div class="card">
        <h2>6) Weather</h2>
        <div class="muted">Cards appear inside the 8 day window.</div>
      </div>
    </main>
  </body>
  </html>`;
  const srv = http.createServer((req,res)=>{
    res.writeHead(200, {'content-type':'text/html; charset=utf-8'});
    res.end(html);
  });
  srv.listen(port);
  return srv;
}

async function makeVideo(){
  const port = 4321;
  const base = `http://localhost:${port}`;
  const outDir = path.join(__dirname, '..', 'public');
  const outFile = path.join(outDir, 'tutorial.mp4');
  const framesDir = path.join(os.tmpdir(), 'coldline-frames-'+Date.now());
  fs.mkdirSync(framesDir, { recursive: true });
  fs.mkdirSync(outDir, { recursive: true });

  console.log('Building and starting Next.js…');
  let server;
  let fallbackSrv;
  try {
    server = await buildAndStart(port);
  } catch (e) {
    console.warn('Next.js build failed; using fallback static tutorial page for capture.');
    fallbackSrv = startFallbackServer(port);
  }
  try {
    await waitForUrl(base + '/tutorial');
    console.log('App is up, launching browser…');

    const puppeteer = require('puppeteer');
    const browser = await puppeteer.launch({ headless: true, defaultViewport: { width: 1280, height: 720 } });
    const page = await browser.newPage();
    await page.goto(base + '/tutorial', { waitUntil: 'networkidle2' });

    let frameIndex = 0;
    async function snap(){
      frameIndex++;
      const fp = path.join(framesDir, `frame-${String(frameIndex).padStart(4,'0')}.png`);
      await page.screenshot({ path: fp });
    }
    async function pause(frames){ for(let i=0;i<frames;i++){ await snap(); } }

    // Scene 1: title hero
    await pause(24); // ~2s at 12 fps

    // Scene 2: slow scroll through cards
    const fps = 12;
    const steps = 90; // ~7.5s
    const total = await page.evaluate(() => document.body.scrollHeight - window.innerHeight);
    for(let i=0;i<=steps;i++){
      const y = Math.round(total * (i/steps));
      await page.evaluate(yy => window.scrollTo({ top: yy, behavior: 'instant' }), y);
      await snap();
      await wait(1000/fps);
    }

    // Scene 3: focus Verdict Scale
    await page.evaluate(() => {
      const card = Array.from(document.querySelectorAll('h2'))
        .find(h => /Verdict Scale/i.test(h.textContent||''))?.parentElement;
      if (!card) return;
      const rect = card.getBoundingClientRect();
      const overlay = document.createElement('div');
      overlay.id = 'auto-highlight';
      overlay.style.position = 'fixed';
      overlay.style.left = rect.left + 'px';
      overlay.style.top = rect.top + 'px';
      overlay.style.width = rect.width + 'px';
      overlay.style.height = rect.height + 'px';
      overlay.style.border = '3px solid #00e0a4';
      overlay.style.borderRadius = '10px';
      overlay.style.boxShadow = '0 0 0 9999px rgba(11,18,32,0.35)';
      overlay.style.pointerEvents = 'none';
      document.body.appendChild(overlay);
    });
    await pause(36); // 3s
    await page.evaluate(() => document.getElementById('auto-highlight')?.remove());

    // Scene 4: scroll to weather
    await page.evaluate(() => {
      const h = Array.from(document.querySelectorAll('h2')).find(n => /Weather/i.test(n.textContent||''));
      if (h) h.scrollIntoView({ behavior: 'instant', block: 'start' });
    });
    await pause(24);

    // Encode with ffmpeg
    console.log('Encoding video…');
    const ffmpegPath = require('ffmpeg-static');
    const ffmpeg = require('fluent-ffmpeg');
    ffmpeg.setFfmpegPath(ffmpegPath);
    await new Promise((resolve, reject) => {
      ffmpeg(path.join(framesDir, 'frame-%04d.png'))
        .inputOptions(['-framerate 12'])
        .outputOptions([
          '-c:v libx264',
          '-pix_fmt yuv420p',
          '-movflags +faststart',
          '-r 24'
        ])
        .on('error', reject)
        .on('end', resolve)
        .save(outFile);
    });

    await browser.close();
    console.log('Wrote', outFile);
  } finally {
    try { server && server.kill(); } catch {}
    try { fallbackSrv && fallbackSrv.close(); } catch {}
  }

  // cleanup
  try { fs.rmSync(framesDir, { recursive: true, force: true }); } catch {}
}

makeVideo().catch(err => {
  console.error(err);
  process.exit(1);
});
