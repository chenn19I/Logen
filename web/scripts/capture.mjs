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
      // Walk the page once so scroll-triggered reveals are settled before the
      // full-page capture. Then return to the top for a stable sticky layout.
      await cdp.evaluate(`(async () => {
        const step = Math.max(240, Math.round(window.innerHeight * 0.7));
        const height = document.documentElement.scrollHeight;
        for (let y = 0; y < height; y += step) {
          window.scrollTo(0, y);
          await new Promise((resolve) => setTimeout(resolve, 110));
        }
        window.scrollTo(0, height);
        await new Promise((resolve) => setTimeout(resolve, 260));
        window.scrollTo(0, 0);
        await new Promise((resolve) => setTimeout(resolve, 320));
      })()`);
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

    if (scenario === "landing") {
      await nav("http://localhost:3000/?demo=0");
      await waitForText(cdp, "Sell the seat.");
      await sleep(1200);
      const file = await shot(`landing-${width}`);
      return { files: [file], errors: errors.slice(0, 20) };
    }

    if (scenario === "mint") {
      const files = [];
      await nav("http://localhost:3000/mint?demo=1");
      await waitForText(cdp, "Give a seat a face.");
      await sleep(700);
      files.push(await shot(`mint-empty-${width}`));

      const dropped = await cdp.evaluate(`(async () => {
        const response = await fetch("/logen-mascot.png");
        const blob = await response.blob();
        const file = new File([blob], "logen-mascot.png", { type: blob.type || "image/png" });
        const transfer = new DataTransfer();
        transfer.items.add(file);
        const zone = document.querySelector(".dropzone");
        if (!zone) return { ok: false, reason: "no dropzone" };
        zone.dispatchEvent(new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer: transfer }));
        return { ok: true, bytes: file.size };
      })()`);

      const ready = await waitForText(cdp, "PORTRAIT SET", 20000);
      await sleep(500);

      const filled = await cdp.evaluate(`(() => {
        const setValue = (selector, value) => {
          const el = document.querySelector(selector);
          if (!el) return false;
          const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
          const setter = Object.getOwnPropertyDescriptor(proto, "value").set;
          setter.call(el, value);
          el.dispatchEvent(new Event("input", { bubbles: true }));
          return true;
        };
        return {
          name: setValue('input[placeholder="The Blue Cube"]', "The Blue Cube"),
          handle: setValue('input[placeholder="blue-cube"]', "blue-cube"),
          story: setValue('textarea[placeholder="Why this seat exists, in one or two lines."]', "A portrait seat for the keeper of the cube."),
        };
      })()`);
      await sleep(500);
      files.push(await shot(`mint-filled-${width}`));

      const minted = await clickText(cdp, "Mint this seat", "button");
      const success = await waitForText(cdp, "Seat minted.", 20000);
      await sleep(900);
      files.push(await shot(`mint-success-${width}`));

      return { files, dropped, ready, filled, minted, success, errors: errors.slice(0, 20) };
    }

    if (scenario === "seat") {
      await nav("http://localhost:3000/seat/s007.logen.testnet?demo=1");
      await waitForText(cdp, "Every credit and every handoff");
      await sleep(700);
      const file = await shot(`seat-${width}`);
      return { files: [file], errors: errors.slice(0, 20) };
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
