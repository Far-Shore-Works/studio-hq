// Headless Chrome (throwaway profile) screenshots via CDP, real-time animations.
// node cdpshot.mjs URL OUT W H [dark|light] [mobile] [fullpage] [waitMs]
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
const [url, out, W, H, scheme = "dark", mobile = "0", full = "1", wait = "4500"] = process.argv.slice(2);
const prof = mkdtempSync(process.env.TMPDIR_SHOT + "/prof-");
const port = 9300 + Math.floor(Math.random() * 500);
const chrome = spawn("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", [
  "--headless=new", "--no-first-run", "--no-default-browser-check", "--hide-scrollbars",
  `--user-data-dir=${prof}`, `--remote-debugging-port=${port}`, "--remote-debugging-address=127.0.0.1", "about:blank"], { stdio: "ignore" });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let ws, id = 0; const pending = new Map();
const send = (method, params = {}, sessionId) => new Promise((res, rej) => { const i = ++id; pending.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method, params, sessionId })); });
try {
  let ver; for (let k = 0; k < 50; k++) { try { ver = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json(); break; } catch { await sleep(150); } }
  ws = new WebSocket(ver.webSocketDebuggerUrl);
  await new Promise((r) => (ws.onopen = r));
  ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && pending.has(d.id)) { const p = pending.get(d.id); pending.delete(d.id); d.error ? p.rej(new Error(d.error.message)) : p.res(d.result); } };
  const { targetId } = await send("Target.createTarget", { url: "about:blank" });
  const { sessionId } = await send("Target.attachToTarget", { targetId, flatten: true });
  const s = (m, p) => send(m, p, sessionId);
  await s("Page.enable");
  const mob = mobile === "1";
  await s("Emulation.setDeviceMetricsOverride", { width: +W, height: +H, deviceScaleFactor: 2, mobile: mob });
  if (mob) await s("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 });
  await s("Emulation.setEmulatedMedia", { features: [{ name: "prefers-color-scheme", value: scheme }] });
  await s("Page.navigate", { url });
  await sleep(+wait);
  let clip;
  if (full === "2") {
    // Grow the viewport to the page height so fixed bars sit at the true bottom.
    const m0 = await s("Page.getLayoutMetrics");
    await s("Emulation.setDeviceMetricsOverride", { width: +W, height: Math.ceil(m0.cssContentSize.height), deviceScaleFactor: 2, mobile: mob });
    await sleep(800);
  }
  if (full === "1") {
    const m = await s("Page.getLayoutMetrics");
    const h = Math.ceil(m.cssContentSize.height);
    clip = { x: 0, y: 0, width: +W, height: h, scale: 1 };
  }
  const shot = await s("Page.captureScreenshot", { format: "png", captureBeyondViewport: full === "1", ...(clip ? { clip } : {}) });
  writeFileSync(out, Buffer.from(shot.data, "base64"));
  console.log("wrote", out);
} finally { try { ws && ws.close(); } catch {} chrome.kill(); await sleep(300); rmSync(prof, { recursive: true, force: true }); process.exit(0); }
