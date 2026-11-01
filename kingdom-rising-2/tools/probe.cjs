const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: 1100, height: 620 } });
  const errs = []; p.on('pageerror', e => errs.push('PAGEERROR ' + e.message + (e.stack || '').slice(0, 500)));
  p.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 300)); });
  await p.goto('http://localhost:8765/kingdom-rising-2/index.html');
  await p.waitForFunction(() => document.getElementById('loading').hidden, null, { timeout: 180000 });
  const script = process.argv[2];
  const res = await p.evaluate(script);
  console.log(JSON.stringify(res, null, 1));
  if (process.argv[3]) { await p.waitForTimeout(+process.argv[4] || 1500); await p.screenshot({ path: process.argv[3], timeout: 180000 }); }
  if (process.argv[5]) { console.log(JSON.stringify(await p.evaluate(process.argv[5]), null, 1)); }
  console.log(errs.join('\n'));
  await b.close();
})();
