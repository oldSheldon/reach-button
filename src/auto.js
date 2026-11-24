/*!
 * reach-button/auto: no JavaScript to write. Add data-reach to any button:
 *   <a href="/contact" data-reach data-reach-preset="goo" data-reach-logo="/logo.svg">Contact</a>
 * Every option works as an attribute: data-reach-arm-color, data-reach-hand-size…
 */
import { defaults, presets, reach } from "./reach-button.js";

const known = new Set([...Object.keys(defaults), ...Object.values(presets).flatMap(Object.keys)]);

function read(el) {
  const out = {};
  for (const key of known) {
    const name = "data-reach-" + key.replace(/[A-Z]/g, (c) => "-" + c.toLowerCase());
    const raw = el.getAttribute(name);
    if (raw === null || typeof defaults[key] === "function") continue;
    if (key === "onChange" || key === "drawArm" || key === "drawHand") continue;
    if (typeof defaults[key] === "number") {
      const n = Number(raw);
      if (Number.isFinite(n)) out[key] = n;
    } else if (typeof defaults[key] === "boolean") out[key] = raw !== "false";
    else out[key] = raw;
  }
  return out;
}

const live = new Map();
function scan() {
  for (const [el, handle] of live) {
    if (!el.isConnected || !el.hasAttribute("data-reach")) {
      handle.destroy();
      live.delete(el);
    }
  }
  for (const el of document.querySelectorAll("[data-reach]")) if (!live.has(el)) live.set(el, reach(el, read(el)));
}

if (typeof document !== "undefined") {
  let queued = false;
  const start = () => {
    scan();
    // Buttons added later, by a framework or a page change.
    new MutationObserver(() => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => {
        queued = false;
        scan();
      });
    }).observe(document.body, { childList: true, subtree: true });
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
}
