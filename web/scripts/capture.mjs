import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";

const EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const PORT = 9333;
const PROFILE = path.join(process.env.TEMP ?? "C:\\Windows\\Temp", "logen-edge-profile");
const OUT = path.resolve("screenshots");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitForEndpoint(url, tries = 60) {
  for (let i = 0; i < tries; i += 1) {
    try {
      const res = await fetch(url);
      if (res.ok) return await res.json();
    } catch {}
    await sleep(200);
  }
  throw new Error(`Endpoint not ready: ${url}`);
}

class CDP {
  constructor(ws) {
    this.ws = ws;
    this.id = 0;
    this.pending = new Map();
    this.events = new Map();
    ws.addEventListener("message", (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) reject(new Error(JSON.stringify(msg.error)));
        else resolve(msg.result);
      } else if (msg.method) {
        const listeners = this.events.get(msg.method) ?? [];
        listeners.forEach((listener) => listener(msg.params));
      }
    });
  }
  send(method, params = {}) {
    const id = (this.id += 1);
    this.ws.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
    });
  }
  once(method, timeout = 15000) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`Timeout ${method}`)), timeout);
      const listener = (params) => {
        clearTimeout(timer);
        const arr = this.events.get(method) ?? [];
        this.events.set(method, arr.filter((l) => l !== listener));
        resolve(params);
      };
      const arr = this.events.get(method) ?? [];
      arr.push(listener);
      this.events.set(method, arr);
    });
  }
  async evaluate(script) {
    const result = await this.send("Runtime.evaluate", {
      expression: script,
      awaitPromise: true,
      returnByValue: true,
    });
    if (result.exceptionDetails) {
      throw new Error(result.exceptionDetails.text + " " + JSON.stringify(result.exceptionDetails.exception));
    }
    return result.result.value;
  }
}

async function clickText(cdp, text, selector = "button, a") {
  return cdp.evaluate(`(() => {
    const nodes = [...document.querySelectorAll(${JSON.stringify(selector)})];
    const node = nodes.find((n) => (n.textContent || "").replace(/\\s+/g, " ").trim().includes(${JSON.stringify(text)}));
    if (!node) return { ok: false, found: nodes.map(n => (n.textContent || "").replace(/\\s+/g, " ").trim()).slice(0, 40) };
    node.click();
    return { ok: true };
  })()`);
}

async function waitForText(cdp, text, timeout = 12000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const found = await cdp.evaluate(`document.body ? document.body.innerText.includes(${JSON.stringify(text)}) : false`);
    if (found) return true;
    await sleep(200);
  }
  return false;
}

async function main() {
  await fs.mkdir(OUT, { recursive: true });
  const edge = spawn(EDGE, [
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${PROFILE}`,
    "--headless=new",
    "--disable-gpu",
    "--hide-scrollbars",
    "--no-first-run",
    "--no-default-browser-check",
    "about:blank",
  ], { stdio: "ignore" });

  try {
    await waitForEndpoint(`http://127.0.0.1:${PORT}/json/version`);
    const target = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: "PUT" })).json();
    const ws = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => {
      ws.addEventListener("open", resolve, { once: true });
      ws.addEventListener("error", reject, { once: true });
    });
    const cdp = new CDP(ws);
    await cdp.send("Page.enable");
    await cdp.send("Runtime.enable");
    await cdp.send("Log.enable");

    const errors = [];
    cdp.events.set("Runtime.exceptionThrown", [() => errors.push("exception")]);
    cdp.events.set("Log.entryAdded", [(p) => { if (p.entry?.level === "error") errors.push(p.entry.text); }]);

    const scenario = process.argv[2] ?? "lounge";
    const width = Number(process.argv[3] ?? 1280);
    const height = Number(process.argv[4] ?? 900);
    const out = process.argv[5];

    await cdp.send("Emulation.setDeviceMetricsOverride", {
      width,
      height,
      deviceScaleFactor: 1,
      mobile: width < 600,
    });

    const nav = async (url) => {
      const loaded = cdp.once("Page.loadEventFired");
      await cdp.send("Page.navigate", { url });
      await loaded;
      await sleep(900);
    };

    const shot = async (name) => {
      const metrics = await cdp.send("Page.getLayoutMetrics");
      const size = metrics.cssContentSize ?? metrics.contentSize;
      const result = await cdp.send("Page.captureScreenshot", {
        format: "png",
        captureBeyondViewport: true,
        clip: {
          x: 0,
          y: 0,
          width: Math.max(size.width, width),
          height: Math.max(size.height, height),
          scale: 1,
        },
      });
      const file = path.join(OUT, `${name}.png`);
      await fs.writeFile(file, Buffer.from(result.data, "base64"));
      return file;
    };

    if (scenario === "lounge") {
      await nav("http://localhost:3000/lounge?demo=1");
      await waitForText(cdp, "Only the current holder can enter.");
      const closed = await shot(`lounge-closed-${width}`);

      const enter = await clickText(cdp, "Enter with seat");
      await waitForText(cdp, "The room is yours.");
      await sleep(700);
      const open = await shot(`lounge-open-${width}`);

      const sell = await clickText(cdp, "Sell this seat and lock the room");
      await waitForText(cdp, "This seat now belongs to someone else.");
      await sleep(700);
      const locked = await shot(`lounge-locked-${width}`);

      return { files: [closed, open, locked], enter, sell, errors: errors.slice(0, 20) };
    }

    if (scenario === "lab") {
      await nav("http://localhost:3000/lab?demo=1");
      await waitForText(cdp, "You are the villain.");
      const before = await shot(`lab-${width}`);

      const tried = await cdp.evaluate(`(() => {
        const btns = [...document.querySelectorAll("button")].filter((b) => (b.textContent || "").trim() === "Try it");
        btns.slice(0, 3).forEach((b) => b.click());
        return btns.length;
      })()`);
      await sleep(1400);
      const after = await shot(`lab-tried-${width}`);

      await clickText(cdp, "See the test");
      await waitForText(cdp, "The control");
      await sleep(400);
      const sheet = await shot(`lab-sheet-${width}`);

      return { files: [before, after, sheet], tried, errors: errors.slice(0, 20) };
    }

    if (scenario === "pages") {
      const files = [];
      await nav("http://localhost:3000/?demo=1");
      await waitForText(cdp, "Sell the seat.");
      files.push(await shot(`home-${width}`));

      await nav("http://localhost:3000/market?demo=1");
      await waitForText(cdp, "Seats for sale.");
      files.push(await shot(`market-${width}`));

      await clickText(cdp, "Buy this seat");
      await waitForText(cdp, "What will happen");
      await sleep(400);
      files.push(await shot(`market-sheet-${width}`));

      await clickText(cdp, "Buy for", "button");
      await waitForText(cdp, "is yours.");
      await sleep(1400);
      files.push(await shot(`handoff-${width}`));

      return { files, errors: errors.slice(0, 20) };
    }

    if (scenario === "verify") {
      const files = [];
      await nav("http://localhost:3000/verify?demo=1");
      await waitForText(cdp, "Five checks. One seat.");
      await sleep(600);
      files.push(await shot(`verify-${width}`));

      await clickText(cdp, "Open drawer");
      await waitForText(cdp, "Access keys");
      await sleep(400);
      files.push(await shot(`verify-drawer-${width}`));
      return { files, errors: errors.slice(0, 20) };
    }

    if (scenario === "inspect") {
      await nav("http://localhost:3000/lounge?demo=1");
      await waitForText(cdp, "Only the current holder can enter.");
      const info = await cdp.evaluate(`(() => {
        const active = document.querySelector('a[aria-current="page"]');
        const line = active?.querySelector("span");
        const rect = (el) => { if (!el) return null; const r = el.getBoundingClientRect(); return [r.x, r.y, r.width, r.height]; };
        return {
          dpr: devicePixelRatio,
          width: innerWidth,
          active: rect(active),
          activeLine: rect(line),
          activeLineBg: line ? getComputedStyle(line).backgroundColor : null,
          nav: rect(document.querySelector("nav")),
          header: rect(document.querySelector("header")),
          banner: rect(document.querySelector("header > div:last-child"))
        };
      })()`);
      return { info };
    }

    if (scenario === "kit") {
      await nav("http://localhost:3000/kit?demo=1");
      await waitForText(cdp, "The kit.");
      await sleep(400);
      const file = await shot(`kit-${width}`);
      return { files: [file], errors: errors.slice(0, 20) };
    }

    throw new Error(`Unknown scenario ${scenario} ${out ?? ""}`);
  } finally {
    edge.kill();
  }
}

main()
  .then((result) => {
    console.log(JSON.stringify(result, null, 2));
  })
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
