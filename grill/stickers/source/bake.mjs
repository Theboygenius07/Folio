// Bake the stickers into the grill close-up. Needs the portfolio served at http://localhost:8765 and Google Chrome.
// Usage (from the Portfolio folder): node grill/stickers/source/bake.mjs
import { spawn } from 'node:child_process'
import { writeFileSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
const CH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const port = 9390
const chrome = spawn(CH, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${mkdtempSync(join(tmpdir(), 'bake-'))}`, 'about:blank'], { stdio: 'ignore' })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
let ws, id = 0; const pending = new Map()
const send = (method, params = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })) })
try {
  let t; for (let i = 0; i < 40 && !t; i++) { await sleep(250); try { t = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find((x) => x.type === 'page') } catch {} }
  ws = new WebSocket(t.webSocketDebuggerUrl); await new Promise((r) => ws.addEventListener('open', r))
  ws.addEventListener('message', (m) => { const d = JSON.parse(m.data); if (d.id && pending.has(d.id)) { pending.get(d.id)(d); pending.delete(d.id) } })
  await send('Runtime.enable'); await send('Page.enable')
  await send('Page.navigate', { url: 'http://localhost:8765/grill/stickers/source/bake.html' }); await sleep(1500)
  const r = await send('Runtime.evaluate', { expression: 'bake()', returnByValue: true, awaitPromise: true })
  const v = r.result?.result?.value
  if (!v) throw new Error('bake failed: ' + JSON.stringify(r.result?.exceptionDetails || r.result).slice(0, 400))
  for (const [k, url] of Object.entries(v)) writeFileSync(`grill/assets/closeup-${k}.webp`, Buffer.from(url.split(',')[1], 'base64'))
  console.log('baked grill/assets/closeup-full.webp and closeup-half.webp')
} finally { ws?.close(); chrome.kill() }
