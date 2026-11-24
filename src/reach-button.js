/*!
 * reach-button: buttons that turn into your logo and reach for the cursor.
 * MIT licence. No dependencies.
 */

/**
 * Ready-made looks. Any option can override them.
 * @type {Record<string, object>}
 */
export const presets = {
  paper: { arm: "squiggle", hand: "paper", armColor: "#ff5a36", inkColor: "#17152e", handColor: "#ffffff", cuffColor: "#3440ff" },
  goo: { arm: "goo", hand: "claw", armColor: "#0b0b10", inkColor: "#0b0b10", handColor: "#14141c", cuffColor: "#0b0b10", shineColor: "#8b93b8" },
  robot: { arm: "spring", hand: "robot", armColor: "#8a93a6", inkColor: "#1c2230", handColor: "#dfe4ee", cuffColor: "#ffb000" },
};

/** The logo used when none is given. Plain on purpose: bring your own. */
const DEFAULT_LOGO =
  '<svg viewBox="0 0 48 48" fill="currentColor"><rect x="21" y="6" width="6" height="36" rx="3"/><rect x="21" y="6" width="6" height="36" rx="3" transform="rotate(60 24 24)"/><rect x="21" y="6" width="6" height="36" rx="3" transform="rotate(120 24 24)"/></svg>';

export const defaults = {
  /** "paper", "goo" or "robot". */
  preset: "paper",
  /** SVG markup, an image URL, or an Element. */
  logo: DEFAULT_LOGO,
  /** Size of the logo in pixels. 0 picks one from the button's height. */
  logoSize: 0,
  /** What the button folds into behind the logo. "button" keeps the button's own colour, "none" hides it. */
  badgeColor: "button",
  /** Corner radius of that badge, in pixels. */
  badgeRadius: 16,
  /** How close the cursor must be (px from the button's edge) before the arm comes out. */
  ring: 190,
  /** How close it must be before the button turns into the logo. */
  morphAt: 138,
  /** How far the hand can stretch, in pixels. */
  reach: 168,
  /** Size of the hand. 1 is about 45px long. */
  handSize: 1.18,
  /** Arm thickness multiplier. */
  thickness: 1,
  /** Degrees the button leans towards the cursor. 0 turns it off. */
  tilt: 15,
  /** Fold into the logo when the cursor is near. */
  morph: true,
  /** Wave on arrival, beckon when the cursor stalls, shake hands, thumbs-up on the button. */
  wave: true,
  beckon: true,
  shake: true,
  thumbsUp: true,
  /** On touch screens, say hello once when the button is first seen. */
  greet: true,
  /** Stacking order of the arm. */
  zIndex: 2147483000,
  /** Called with "near", "touch", "over" or "away" as the cursor moves. */
  onChange: null,
  /** Draw your own: (ctx, { from, to, time, options }) => void */
  drawArm: null,
  /** Draw your own, in local space pointing along +x: (ctx, { curl, thumb, time, options }) => void */
  drawHand: null,
};

const CSS = `
.rb{position:relative;isolation:isolate;--rb-m:0}
.rb.rb-on{background:transparent!important;border-color:transparent!important;box-shadow:none!important;transition:none!important}
.rb.rb-on{color:color-mix(in srgb,var(--rb-fg) calc((1 - clamp(0,var(--rb-m)*2.4,1))*100%),transparent)!important}
.rb.rb-on>:not(.rb-layer){opacity:clamp(0,1 - var(--rb-m)*2.4,1)}
.rb-layer{position:absolute;pointer-events:none;visibility:hidden}
.rb.rb-on>.rb-layer{visibility:visible}
.rb-skin{z-index:-1;box-sizing:border-box;transform:perspective(520px) rotateX(var(--rb-rx,0deg)) rotateY(var(--rb-ry,0deg))}
.rb-skin>i{position:absolute;box-sizing:border-box;left:calc(var(--rb-k)*(50% - var(--rb-s)/2));top:calc(var(--rb-k)*(50% - var(--rb-s)/2));width:calc((1 - var(--rb-k))*100% + var(--rb-k)*var(--rb-s));height:calc((1 - var(--rb-k))*100% + var(--rb-k)*var(--rb-s))}
.rb-skin>i::after{content:"";position:absolute;inset:0;border-radius:inherit;background:radial-gradient(circle at var(--rb-gx,50%) var(--rb-gy,50%),rgb(255 255 255/var(--rb-gl,0)),transparent 62%)}
.rb-logo{color:var(--rb-fg);left:50%;top:50%;width:var(--rb-l);height:var(--rb-l);margin:calc(var(--rb-l)/-2) 0 0 calc(var(--rb-l)/-2);display:grid;place-items:center;opacity:clamp(0,(var(--rb-m) - .35)*5,1);transform:perspective(520px) rotateX(var(--rb-rx,0deg)) rotateY(var(--rb-ry,0deg)) rotate(var(--rb-lr,0deg)) scale(clamp(.2,var(--rb-m),1.15))}
.rb-logo>*{width:100%;height:100%;object-fit:contain;display:block}
.rb-canvas{position:fixed;left:0;top:0;pointer-events:none;visibility:hidden}
@media print{.rb-canvas{display:none}}
`;

const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const smooth = (a, b, v) => {
  const t = clamp((v - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const edgeDistance = (p, r) => Math.hypot(Math.max(r.left - p.x, 0, p.x - r.right), Math.max(r.top - p.y, 0, p.y - r.bottom));

/* ───────── Drawing ───────── */

function strand(ctx, s, e, wave) {
  const dx = e.x - s.x;
  const dy = e.y - s.y;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  ctx.beginPath();
  const n = 48;
  for (let i = 0; i <= n; i++) {
    const f = i / n;
    const [along, side] = wave(f);
    const x = s.x + dx * f + ux * along - uy * side;
    const y = s.y + dy * f + uy * along + ux * side;
    if (i) ctx.lineTo(x, y);
    else ctx.moveTo(x, y);
  }
}

const arms = {
  /** A hand-drawn wave that pulls straight as it stretches. */
  squiggle(ctx, { from, to, time, options: o }) {
    const len = Math.hypot(to.x - from.x, to.y - from.y);
    const slack = clamp(1 - len / o.reach, 0.06, 1);
    const amp = (4 + slack * 20) * clamp(len / 70);
    const draw = (phase, k) => {
      strand(ctx, from, to, (f) => [0, Math.sin(f * Math.PI * 5 + phase - time * 0.0032) * amp * k * Math.sin(Math.PI * Math.min(1, f * 1.02)) ** 0.7]);
      ctx.stroke();
    };
    ctx.strokeStyle = o.inkColor;
    ctx.lineWidth = 1.6 * o.thickness;
    draw(2.2, 0.72);
    draw(-1.4, 0.5);
    ctx.strokeStyle = o.armColor;
    ctx.lineWidth = 5.5 * o.thickness;
    draw(0, 0.8);
  },

  /** Glossy strands that are thick at the root and thin out as they stretch. */
  goo(ctx, { from, to, time, options: o }) {
    const len = Math.hypot(to.x - from.x, to.y - from.y);
    if (len < 2) return;
    const ang = Math.atan2(to.y - from.y, to.x - from.x);
    const stretch = clamp(len / o.reach);
    const cos = Math.cos(ang);
    const sin = Math.sin(ang);
    const at = (f, side) => ({ x: from.x + cos * len * f - sin * side, y: from.y + sin * len * f + cos * side });
    const mass = clamp(len / 60);
    // Gathers at the root, swells, then draws together towards the wrist.
    const spread = (f) => (11 * (1 - f) ** 1.5 + 3) * smooth(-0.1, 0.24, f);
    ctx.fillStyle = o.armColor;
    ctx.beginPath();
    ctx.arc(from.x, from.y, 9.5 * o.thickness * mass, 0, Math.PI * 2);
    ctx.fill();
    for (let k = 0; k < 5; k++) {
      const lane = (k - 2) / 2;
      const left = [];
      const right = [];
      for (let i = 0; i <= 26; i++) {
        const f = i / 26;
        const sway = Math.sin(f * 4.4 + k * 1.7 - time * 0.0024) * (9 - stretch * 5) * Math.sin(Math.PI * f) * mass;
        const centre = lane * spread(f) * mass + sway;
        const pulse = 1 + Math.sin(f * 11 - time * 0.006 + k) * 0.16;
        const w = (6.2 * (1 - f) ** 2 + 2.1 - stretch * 0.5) * smooth(-0.12, 0.14, f) * o.thickness * pulse * mass;
        left.push(at(f, centre - w));
        right.push(at(f, centre + w));
      }
      ctx.beginPath();
      left.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
      right.reverse().forEach((p) => ctx.lineTo(p.x, p.y));
      ctx.closePath();
      ctx.fill();
    }
    ctx.lineWidth = 1.3 * o.thickness;
    ctx.strokeStyle = o.shineColor || "#8b93b8";
    ctx.globalAlpha = 0.75;
    for (const k of [0, 3]) {
      ctx.beginPath();
      for (let i = 2; i <= 22; i++) {
        const f = i / 26;
        const sway = Math.sin(f * 4.4 + k * 1.7 - time * 0.0024) * (9 - stretch * 5) * Math.sin(Math.PI * f) * mass;
        const p = at(f, ((k - 2) / 2) * spread(f) * mass + sway - 1.6);
        if (i > 2) ctx.lineTo(p.x, p.y);
        else ctx.moveTo(p.x, p.y);
      }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  },

  /** A coil spring. */
  spring(ctx, { from, to, time, options: o }) {
    const len = Math.hypot(to.x - from.x, to.y - from.y);
    const k = clamp(len / 50);
    const turns = 9;
    const wave = (f) => {
      const a = f * Math.PI * 2 * turns;
      const ends = clamp(f * 9) * clamp((1 - f) * 9);
      return [Math.cos(a) * 4.5 * ends * k, Math.sin(a) * 8.5 * ends * k + Math.sin(f * 3 - time * 0.004) * 4 * Math.sin(Math.PI * f) * k];
    };
    strand(ctx, from, to, wave);
    ctx.strokeStyle = o.inkColor;
    ctx.lineWidth = 6.4 * o.thickness;
    ctx.stroke();
    strand(ctx, from, to, wave);
    ctx.strokeStyle = o.armColor;
    ctx.lineWidth = 3.6 * o.thickness;
    ctx.stroke();
  },
};

const limb = (ctx, a, b, w, colour) => {
  ctx.strokeStyle = colour;
  ctx.lineWidth = w;
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.stroke();
};
const box = (ctx, x, y, w, h, r, colour) => {
  ctx.fillStyle = colour;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fill();
};

/** Finger and thumb positions shared by every hand. */
function pose(curl, thumb, time) {
  const open = 1 - curl;
  const fingers = [
    { y: -8.4, l: 17 },
    { y: -2.9, l: 21 },
    { y: 2.9, l: 20 },
    { y: 8.4, l: 15 },
  ].map((f, i) => {
    const a = (f.y / 8.4) * (0.1 + 0.2 * open) + Math.sin(time * 0.005 + i * 0.9) * 0.05 * open;
    const l = f.l * (1 - 0.66 * curl) + 3;
    return { b: { x: 20, y: f.y }, e: { x: 20 + Math.cos(a) * l, y: f.y + Math.sin(a) * l }, a, l };
  });
  const ta = -(0.95 + thumb * 0.62) + curl * (1 - thumb) * 0.7;
  const tl = 15 + thumb * 5 - curl * (1 - thumb) * 4;
  const tb = { x: 8, y: -9 };
  return { fingers, tb, tt: { x: tb.x + Math.cos(ta) * tl, y: tb.y + Math.sin(ta) * tl }, ta, tl };
}

const hands = {
  /** White paper, ink outline, a cuff. */
  paper(ctx, { curl, thumb, time, options: o }) {
    const p = pose(curl, thumb, time);
    const w = 1.7;
    limb(ctx, p.tb, p.tt, 7.4 + w * 2, o.inkColor);
    box(ctx, -1 - w, -12.5 - w, 26 + w * 2, 25 + w * 2, 10, o.inkColor);
    for (const f of p.fingers) {
      limb(ctx, f.b, f.e, 6.6 + w * 2, o.inkColor);
      limb(ctx, f.b, f.e, 6.6, o.handColor);
    }
    box(ctx, -1, -12.5, 25, 25, 9, o.handColor);
    limb(ctx, p.tb, p.tt, 7.4, o.handColor);
    ctx.strokeStyle = o.inkColor;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(7, 5);
    ctx.quadraticCurveTo(13, 1.5, 18, 5.5);
    ctx.stroke();
    box(ctx, -12 - w, -10 - w, 12 + w * 2, 20 + w * 2, 5, o.inkColor);
    box(ctx, -12, -10, 12, 20, 4, o.cuffColor);
  },

  /** Dark, glossy, pointed fingers. */
  claw(ctx, { curl, thumb, time, options: o }) {
    const p = pose(curl, thumb, time);
    const spike = (b, a, l, w) => {
      const tip = { x: b.x + Math.cos(a) * l * 1.28, y: b.y + Math.sin(a) * l * 1.28 };
      const mid = { x: b.x + Math.cos(a) * l * 0.62, y: b.y + Math.sin(a) * l * 0.62 };
      const nx = -Math.sin(a) * w;
      const ny = Math.cos(a) * w;
      ctx.beginPath();
      ctx.moveTo(b.x + nx, b.y + ny);
      ctx.quadraticCurveTo(mid.x + nx * 1.12, mid.y + ny * 1.12, tip.x, tip.y);
      ctx.quadraticCurveTo(mid.x - nx * 1.12, mid.y - ny * 1.12, b.x - nx, b.y - ny);
      ctx.closePath();
      ctx.fillStyle = o.handColor;
      ctx.fill();
      ctx.strokeStyle = o.shineColor || "#8b93b8";
      ctx.globalAlpha = 0.8;
      ctx.lineWidth = 0.9;
      ctx.beginPath();
      ctx.moveTo(b.x - nx * 0.4, b.y - ny * 0.4);
      ctx.lineTo(mid.x - nx * 0.35, mid.y - ny * 0.35);
      ctx.stroke();
      ctx.globalAlpha = 1;
    };
    ctx.fillStyle = o.handColor;
    ctx.beginPath();
    ctx.moveTo(-13, -4);
    ctx.bezierCurveTo(-2, -6, 2, -13, 14, -13);
    ctx.bezierCurveTo(26, -13, 27, 13, 14, 13);
    ctx.bezierCurveTo(2, 13, -2, 6, -13, 4);
    ctx.closePath();
    ctx.fill();
    for (const f of p.fingers) spike(f.b, f.a, f.l * (1 - 0.25 * curl), 3.5);
    spike(p.tb, p.ta, p.tl, 3.8);
    ctx.strokeStyle = o.shineColor || "#8b93b8";
    ctx.lineWidth = 1.2;
    ctx.globalAlpha = 0.7;
    ctx.beginPath();
    ctx.moveTo(2, -7);
    ctx.quadraticCurveTo(10, -11, 18, -8);
    ctx.stroke();
    ctx.globalAlpha = 1;
  },

  /** Plates and joints. */
  robot(ctx, { curl, thumb, time, options: o }) {
    const p = pose(curl, thumb, time);
    const w = 1.6;
    const finger = (b, e) => {
      const m = { x: (b.x + e.x) / 2, y: (b.y + e.y) / 2 };
      limb(ctx, b, e, 5.4 + w * 2, o.inkColor);
      limb(ctx, b, e, 5.4, o.handColor);
      for (const j of [b, m]) {
        ctx.fillStyle = o.inkColor;
        ctx.beginPath();
        ctx.arc(j.x, j.y, 2.1, 0, Math.PI * 2);
        ctx.fill();
      }
    };
    finger(p.tb, p.tt);
    for (const f of p.fingers) finger(f.b, f.e);
    box(ctx, -1 - w, -12 - w, 23 + w * 2, 24 + w * 2, 5, o.inkColor);
    box(ctx, -1, -12, 23, 24, 4, o.handColor);
    box(ctx, 4, -5, 10, 10, 5, o.inkColor);
    box(ctx, 6.5, -2.5, 5, 5, 2.5, o.cuffColor);
    box(ctx, -12 - w, -9 - w, 11 + w * 2, 18 + w * 2, 3, o.inkColor);
    box(ctx, -12, -9, 11, 18, 2, o.cuffColor);
  },
};

/* ───────── One stage for the whole page ───────── */

/** @type {Map<HTMLElement, any>} */
const registry = new Map();
let stage = null;

function createStage() {
  const style = document.createElement("style");
  style.textContent = CSS;
  document.head.append(style);
  const canvas = document.createElement("canvas");
  canvas.className = "rb-canvas";
  canvas.setAttribute("aria-hidden", "true");
  document.body.append(canvas);
  const ctx = canvas.getContext("2d");

  const pointer = { x: -9999, y: -9999, busy: false, moved: 0 };
  let active = null;
  let frame = 0;
  let last = 0;
  let woke = 0;
  let side = 0;
  let dpr = 1;
  let m = 0;
  let mv = 0;
  let out = 0;
  let tx = 0;
  let ty = 0;
  let angle = 0;
  let flip = 1;
  let curl = 0;
  let thumb = 0;
  let folded = false;
  let wasOver = false;
  let below = false;
  let mood = "away";
  let greetFrame = 0;
  const hand = { x: 0, y: 0 };
  const handV = { x: 0, y: 0 };

  const say = (next) => {
    if (next === mood || !active) return;
    mood = next;
    registry.get(active)?.options.onChange?.(next, active);
  };

  const release = () => {
    if (!active) return;
    say("away");
    active.classList.remove("rb-on");
    for (const k of ["m", "k", "rx", "ry", "gx", "gy", "gl", "lr"]) active.style.removeProperty(`--rb-${k}`);
    active = null;
  };

  const pick = () => {
    let best = null;
    let bestD = Infinity;
    for (const [el, item] of registry) {
      const r = el.getBoundingClientRect();
      if (!r.width || r.bottom < 0 || r.top > innerHeight) continue;
      const d = edgeDistance(pointer, r);
      if (d < item.options.ring && d < bestD) {
        bestD = d;
        best = el;
      }
    }
    return best;
  };

  const activate = (el) => {
    release();
    const item = registry.get(el);
    item.measure();
    active = el;
    el.classList.add("rb-on");
    const o = item.options;
    dpr = Math.min(devicePixelRatio || 1, 2);
    side = Math.round((o.reach + 80 * o.handSize) * 2 + Math.max(el.offsetWidth, el.offsetHeight));
    canvas.width = canvas.height = side * dpr;
    canvas.style.width = canvas.style.height = `${side}px`;
    canvas.style.zIndex = String(o.zIndex);
    const r = el.getBoundingClientRect();
    hand.x = r.left + r.width / 2;
    hand.y = r.top + r.height / 2;
    handV.x = handV.y = m = mv = out = curl = thumb = 0;
    folded = wasOver = false;
    mood = "away";
    angle = Math.atan2(pointer.y - hand.y, pointer.x - hand.x);
    flip = Math.cos(angle) >= 0 ? 1 : -1;
    woke = performance.now();
  };

  const wake = () => {
    if (frame) return;
    last = performance.now();
    frame = requestAnimationFrame(tick);
  };

  const sleep = () => {
    release();
    frame = 0;
    canvas.style.visibility = "hidden";
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  const tick = (now) => {
    const dt = Math.min(32, now - last) / 16.67;
    last = now;
    const near = pick();
    if (near && near !== active && (!active || out < 0.12)) activate(near);
    const el = active;
    if (!el || !el.isConnected || !registry.has(el)) return sleep();

    const { options: o, size: mark } = registry.get(el);
    const r = el.getBoundingClientRect();
    const c = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    const d = edgeDistance(pointer, r);
    const over = d === 0;
    const here = near === el && (!pointer.busy || over);

    // Near: become the logo. On the button: open back into the label.
    folded = o.morph && here && !over && d < (folded ? o.morphAt + 20 : o.morphAt);
    mv += ((folded ? 1 : 0) - m) * 0.2 * dt;
    mv *= Math.pow(0.66, dt);
    m += mv * dt;
    const goalOut = here ? (over ? (o.thumbsUp ? 1 : 0) : smooth(o.ring, o.ring * 0.63, d)) : 0;
    out += (goalOut - out) * Math.min(1, (goalOut > out ? 0.12 : 0.2) * dt);

    const pull = here ? smooth(o.ring, 20, d) : 0;
    ty += (clamp((pointer.x - c.x) / (r.width * 0.9), -1, 1) * o.tilt * pull - ty) * 0.16 * dt;
    tx += (-clamp((pointer.y - c.y) / 120, -1, 1) * o.tilt * pull - tx) * 0.16 * dt;
    const set = (k, v) => el.style.setProperty(`--rb-${k}`, v);
    set("m", m.toFixed(4));
    set("k", clamp(m).toFixed(4));
    set("rx", `${tx.toFixed(2)}deg`);
    set("ry", `${ty.toFixed(2)}deg`);
    set("gx", `${(clamp((pointer.x - r.left) / r.width) * 100).toFixed(1)}%`);
    set("gy", `${(clamp((pointer.y - r.top) / r.height) * 100).toFixed(1)}%`);
    set("gl", (over ? 0.14 : pull * 0.38).toFixed(3));
    set("lr", `${(Math.sin(now * 0.004) * 5 * clamp(m)).toFixed(2)}deg`);

    const toP = Math.atan2(pointer.y - c.y, pointer.x - c.x);
    // The arm grows from the logo's edge, so it never covers the logo.
    const fold = clamp(m);
    const root = fold * mark * 0.46 + (1 - fold) * 28;
    const from = { x: c.x + Math.cos(toP) * root * (0.6 + 0.4 * fold), y: c.y + Math.sin(toP) * root };
    const grip = 34 * o.handSize;
    let goal;
    let goalAngle;
    let goalCurl = 0;
    let goalThumb = 0;
    let next = here ? "near" : "away";
    if (over) {
      next = "over";
      if (!wasOver) {
        const under = document.elementFromPoint(r.left + 40, r.bottom + 44);
        below = r.top < 110 || (innerHeight - r.bottom > 92 && !under?.closest("a,button,p,li,h1,h2,h3"));
      }
      const palm = r.left + Math.min(62, r.width * 0.45);
      from.x = below ? palm + Math.min(40, r.width * 0.2) : r.right - Math.min(26, r.width * 0.3);
      from.y = below ? r.bottom - 4 : r.top + 4;
      goal = { x: below ? palm + 4 : from.x + 16, y: below ? r.bottom + 46 * o.handSize : r.top - 26 * o.handSize };
      goalAngle = Math.PI + Math.sin(now * 0.006) * 0.09;
      goalCurl = goalThumb = 1;
    } else {
      const gap = Math.hypot(pointer.x - from.x, pointer.y - from.y);
      const stretch = Math.min(o.reach, Math.max(0, gap - grip));
      goal = { x: from.x + Math.cos(toP) * stretch, y: from.y + Math.sin(toP) * stretch };
      goalAngle = Math.atan2(pointer.y - hand.y, pointer.x - hand.x);
      const touching = Math.hypot(pointer.x - hand.x, pointer.y - hand.y) < grip + 14;
      const since = now - woke;
      if (touching) {
        if (here) next = "touch";
        goalCurl = 0.72;
        if (o.shake) {
          const s = Math.sin(now * 0.016) * 5;
          goal.x += -Math.sin(toP) * s;
          goal.y += Math.cos(toP) * s;
        }
      } else if (o.wave && since < 1100) {
        goalAngle += Math.sin(since * 0.014) * 0.5;
      } else if (o.beckon && now - pointer.moved > 900) {
        goalCurl = 0.38 + Math.sin(now * 0.008) * 0.38;
      }
    }
    wasOver = over;
    if (!here) goal = c;
    say(next);

    const k = 0.16 * dt;
    handV.x = (handV.x + (goal.x - hand.x) * k) * Math.pow(0.66, dt);
    handV.y = (handV.y + (goal.y - hand.y) * k) * Math.pow(0.66, dt);
    hand.x += handV.x * dt;
    hand.y += handV.y * dt;
    angle += Math.atan2(Math.sin(goalAngle - angle), Math.cos(goalAngle - angle)) * 0.22 * dt;
    flip += ((Math.cos(angle) >= 0 ? 1 : -1) - flip) * 0.2 * dt;
    curl += (goalCurl - curl) * 0.24 * dt;
    thumb += (goalThumb - thumb) * 0.2 * dt;

    const ox = c.x - side / 2;
    const oy = c.y - side / 2;
    const shown = out > 0.01;
    canvas.style.visibility = shown ? "visible" : "hidden";
    canvas.style.transform = `translate(${ox}px,${oy}px)`;
    ctx.setTransform(dpr, 0, 0, dpr, -ox * dpr, -oy * dpr);
    ctx.clearRect(ox, oy, side, side);
    if (shown) {
      ctx.lineCap = ctx.lineJoin = "round";
      const size = o.handSize * Math.max(0.02, smooth(0.02, 0.55, out));
      const tip = { x: from.x + (hand.x - from.x) * out, y: from.y + (hand.y - from.y) * out };
      const wrist = { x: tip.x - Math.cos(angle) * 12 * size, y: tip.y - Math.sin(angle) * 12 * size };
      const arm = o.drawArm || arms[o.arm] || arms.squiggle;
      const draw = o.drawHand || hands[o.hand] || hands.paper;
      ctx.save();
      if (Math.hypot(wrist.x - from.x, wrist.y - from.y) > 4) arm(ctx, { from, to: wrist, time: now, options: o });
      ctx.restore();
      ctx.save();
      ctx.lineCap = ctx.lineJoin = "round";
      ctx.translate(tip.x, tip.y);
      ctx.rotate(angle);
      ctx.scale(size, size * (Math.abs(flip) < 0.12 ? 0.12 * Math.sign(flip || 1) : flip));
      draw(ctx, { curl: clamp(curl), thumb: clamp(thumb), time: now, options: o });
      ctx.restore();
    }

    if (!here && out < 0.012 && Math.abs(m) < 0.004 && Math.abs(mv) < 0.004 && Math.abs(tx) + Math.abs(ty) < 0.05) return sleep();
    frame = requestAnimationFrame(tick);
  };

  /* Input */
  const onMove = (e) => {
    if (e.pointerType === "touch") return;
    pointer.x = e.clientX;
    pointer.y = e.clientY;
    pointer.moved = performance.now();
    const t = e.target instanceof Element ? e.target : null;
    // Busy with something else clickable: stay out of the way.
    const other = t?.closest("a,button,input,textarea,select,label,summary,[role=button]");
    const mine = t?.closest(".rb");
    pointer.busy = Boolean((other && !(mine && registry.has(mine))) || document.querySelector("dialog[open]"));
    if (frame || pick()) wake();
  };
  const onScroll = () => {
    if (!frame && pointer.x > -9000 && pick()) wake();
  };
  const onLeave = () => {
    pointer.x = pointer.y = -9999;
  };
  addEventListener("pointermove", onMove, { passive: true });
  addEventListener("scroll", onScroll, { passive: true, capture: true });
  document.documentElement.addEventListener("pointerleave", onLeave);

  /* Touch screens: one hello per button */
  const greeted = new WeakSet();
  const hello = (el) => {
    const t0 = performance.now();
    const run = (now) => {
      const t = now - t0;
      const r = el.getBoundingClientRect();
      if (t > 4200 || !registry.has(el) || r.bottom < 0 || r.top > innerHeight) return onLeave();
      const up = r.top > innerHeight / 2 ? -1 : 1;
      pointer.x = r.left + r.width / 2 + (t < 2700 ? 40 + Math.sin(t * 0.0026) * 26 : 0);
      pointer.y = t < 2700 ? (up < 0 ? r.top : r.bottom) + up * (70 - smooth(1200, 2400, t) * 22) : r.top + r.height / 2;
      pointer.busy = false;
      pointer.moved = now;
      wake();
      greetFrame = requestAnimationFrame(run);
    };
    greetFrame = requestAnimationFrame(run);
  };
  const touch = matchMedia("(hover: none)").matches;
  const seen = touch
    ? new IntersectionObserver(
        (entries) => {
          for (const e of entries) {
            if (!e.isIntersecting || frame || greeted.has(e.target) || !registry.get(e.target)?.options.greet) continue;
            greeted.add(e.target);
            hello(e.target);
          }
        },
        { threshold: 1, rootMargin: "-40px 0px -40px 0px" },
      )
    : null;

  return {
    watch: (el) => seen?.observe(el),
    drop(el) {
      seen?.unobserve(el);
      if (active === el) sleep();
    },
    destroy() {
      cancelAnimationFrame(frame);
      cancelAnimationFrame(greetFrame);
      sleep();
      removeEventListener("pointermove", onMove);
      removeEventListener("scroll", onScroll, { capture: true });
      document.documentElement.removeEventListener("pointerleave", onLeave);
      seen?.disconnect();
      canvas.remove();
      style.remove();
    },
  };
}

/* ───────── Setting up a button ───────── */

function resolve(options) {
  const merged = { ...defaults, ...(presets[options.preset || defaults.preset] || presets.paper) };
  for (const [k, v] of Object.entries(options)) if (v !== undefined && v !== null) merged[k] = v;
  return merged;
}

function logoNode(logo) {
  if (logo instanceof Element) return logo.cloneNode(true);
  const text = String(logo).trim();
  if (text.startsWith("<")) {
    const t = document.createElement("template");
    t.innerHTML = text;
    return t.content.firstElementChild || document.createElement("span");
  }
  const img = new Image();
  img.src = text;
  img.alt = "";
  return img;
}

function attach(el, options) {
  const skin = document.createElement("span");
  skin.className = "rb-layer rb-skin";
  skin.setAttribute("aria-hidden", "true");
  const face = document.createElement("i");
  skin.append(face);
  const logo = document.createElement("span");
  logo.className = "rb-layer rb-logo";
  logo.setAttribute("aria-hidden", "true");
  if (getComputedStyle(el).display === "inline") el.style.display = "inline-block";
  el.classList.add("rb");
  el.append(skin, logo);

  const item = {
    options: resolve(options),
    size: 60,
    /** Copies the button's current look, so themes and hover states stay yours. */
    measure() {
      const o = item.options;
      const s = getComputedStyle(el);
      const size = o.logoSize || Math.round(clamp(el.offsetHeight * 1.2, 44, 76));
      const bare = o.badgeColor === "none";
      item.size = size;
      el.style.setProperty("--rb-fg", s.color);
      el.style.setProperty("--rb-l", `${Math.round(size * (bare ? 1 : 0.62))}px`);
      el.style.setProperty("--rb-s", `${size}px`);
      skin.style.inset = `-${s.borderTopWidth} -${s.borderRightWidth} -${s.borderBottomWidth} -${s.borderLeftWidth}`;
      const fill = o.badgeColor === "button" ? s.backgroundColor : bare ? "transparent" : o.badgeColor;
      const round = parseFloat(s.borderTopLeftRadius) || 0;
      const from = Math.min(round, el.offsetHeight / 2);
      face.style.cssText = `background-color:color-mix(in srgb,${fill} calc(var(--rb-k)*100%),${s.backgroundColor});background-image:${s.backgroundImage.replaceAll('"', "'")};border:${s.borderTopWidth} ${s.borderTopStyle} ${s.borderTopColor};border-radius:calc((1 - var(--rb-k))*${from}px + var(--rb-k)*${o.badgeRadius}px);box-shadow:${s.boxShadow}`;
      if (bare) face.style.opacity = "calc(1 - var(--rb-k))";
    },
  };
  logo.append(logoNode(item.options.logo));
  item.setLogo = () => logo.replaceChildren(logoNode(item.options.logo));
  item.detach = () => {
    stage?.drop(el);
    skin.remove();
    logo.remove();
    el.classList.remove("rb", "rb-on");
    for (const k of ["fg", "l", "s"]) el.style.removeProperty(`--rb-${k}`);
  };
  return item;
}

/**
 * Give one or more buttons or links the effect.
 *
 * @param {string | Element | Iterable<Element>} target
 * @param {Partial<typeof defaults> & Record<string, unknown>} [options]
 * @returns {{ update(options: object): void, destroy(): void }}
 */
export function reach(target, options = {}) {
  const idle = { update() {}, destroy() {} };
  if (typeof window === "undefined") return idle;
  // People who ask for less motion get their normal button.
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return idle;
  const els = typeof target === "string" ? [...document.querySelectorAll(target)] : target instanceof Element ? [target] : [...target];
  const mine = [];
  for (const el of els) {
    if (registry.has(el)) continue;
    stage ||= createStage();
    registry.set(el, attach(el, options));
    stage.watch(el);
    mine.push(el);
  }
  let current = options;
  return {
    update(next) {
      current = { ...current, ...next };
      for (const el of mine) {
        const item = registry.get(el);
        if (!item) continue;
        item.options = resolve(current);
        item.setLogo();
      }
    },
    destroy() {
      for (const el of mine.splice(0)) {
        registry.get(el)?.detach();
        registry.delete(el);
      }
      if (!registry.size && stage) {
        stage.destroy();
        stage = null;
      }
    },
  };
}

export default reach;
