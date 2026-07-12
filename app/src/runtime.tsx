// Minimal renderer for the recovered HOWie templates. The bundles use a tiny
// declarative engine — `{{ path }}` bindings, `<sc-if value="{{ cond }}">`,
// `<sc-for list="{{ items }}" as="x">`, and `onclick/oninput/onsubmit` handlers.
// We render the EXACT recovered markup (every inline style intact) against a
// context object of data + handler functions, so the UI is pixel-identical to
// the real app while the data comes from our live backend.
import { useEffect, useRef } from "react";

export type Ctx = Record<string, unknown>;

function resolve(expr: string, ctx: Ctx): unknown {
  const e = expr.trim();
  if (e === "true") return true;
  if (e === "false") return false;
  if (e === "null" || e === "") return null;
  let cur: unknown = ctx;
  for (const part of e.split(".")) {
    if (cur == null) return undefined;
    cur = (cur as Record<string, unknown>)[part];
  }
  return cur;
}

function interp(text: string, ctx: Ctx): string {
  return text.replace(/\{\{([^}]+)\}\}/g, (_m, e) => {
    const v = resolve(e, ctx);
    return v == null ? "" : String(v);
  });
}

const EVT: Record<string, string> = { onclick: "click", oninput: "input", onsubmit: "submit", onchange: "change", onkeydown: "keydown" };

const SVG_NS = "http://www.w3.org/2000/svg";

function build(src: Node, ctx: Ctx, out: Node[], ns?: string): void {
  if (src.nodeType === Node.TEXT_NODE) {
    const t = src.textContent ?? "";
    out.push(document.createTextNode(t.includes("{{") ? interp(t, ctx) : t));
    return;
  }
  if (src.nodeType !== Node.ELEMENT_NODE) return;
  const el = src as Element;
  const tag = el.tagName.toLowerCase();
  // The original bundle's runtime scripts/links aren't needed — we render the
  // markup ourselves and bundle the styles/fonts via howie.css.
  if (tag === "script" || tag === "style" || tag === "link" || tag === "meta" || tag === "title" || tag === "helmet") return;
  // Unwrap the demo-page chrome: the bundle wraps the app in <x-dc>, a page
  // backdrop (min-height:100vh centering) and <x-import component="IOSDevice">
  // (their bezel). Our shell provides the device frame, so these must be
  // pass-throughs — rendering them as unsized elements breaks the app root's
  // height:100% chain (the app grows into one long page and bottom sheets
  // anchor below the visible frame).
  if (tag === "x-dc" || tag === "x-import" || (el.getAttribute("style") ?? "").includes("min-height:100vh")) {
    el.childNodes.forEach((c) => build(c, ctx, out, ns));
    return;
  }

  if (tag === "sc-if") {
    const m = (el.getAttribute("value") ?? "").match(/\{\{([^}]+)\}\}/);
    if (!(m && resolve(m[1], ctx))) return;
    el.childNodes.forEach((c) => build(c, ctx, out, ns));
    return;
  }
  if (tag === "sc-for") {
    const m = (el.getAttribute("list") ?? "").match(/\{\{([^}]+)\}\}/);
    const as = el.getAttribute("as") ?? "item";
    const list = m ? resolve(m[1], ctx) : null;
    if (!Array.isArray(list)) return;
    list.forEach((item) => {
      const cctx: Ctx = { ...ctx, [as]: item };
      el.childNodes.forEach((c) => build(c, cctx, out, ns));
    });
    return;
  }

  // Once inside <svg>, every descendant must be created in the SVG namespace,
  // or the browser renders inert HTML elements (collapsed gauges/icons).
  const elemNs = tag === "svg" ? SVG_NS : ns;
  const node = elemNs ? document.createElementNS(elemNs, tag) : document.createElement(tag);
  for (const a of Array.from(el.attributes)) {
    const whole = a.value.match(/^\{\{([^}]+)\}\}$/);
    const ev = EVT[a.name];
    if (ev && whole) {
      const fn = resolve(whole[1], ctx);
      if (typeof fn === "function") {
        node.addEventListener(ev, (e) => {
          if (ev === "submit") e.preventDefault();
          (fn as (x: unknown) => void)(e);
        });
      }
      continue;
    }
    if (a.name === "value" && whole && !elemNs) {
      (node as HTMLInputElement).value = String(resolve(whole[1], ctx) ?? "");
      continue;
    }
    if (a.name.startsWith("hint-placeholder")) continue;
    node.setAttribute(a.name, a.value.includes("{{") ? interp(a.value, ctx) : a.value);
  }
  const kids: Node[] = [];
  el.childNodes.forEach((c) => build(c, ctx, kids, elemNs));
  kids.forEach((k) => node.appendChild(k));
  out.push(node);
}

export function HowieTemplate({ html, ctx, rev }: { html: string; ctx: Ctx; rev: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const ctxRef = useRef(ctx);
  ctxRef.current = ctx;
  useEffect(() => {
    const host = ref.current;
    if (!host) return;
    const doc = new DOMParser().parseFromString(html, "text/html");
    const out: Node[] = [];
    doc.body.childNodes.forEach((c) => build(c, ctxRef.current, out));
    host.replaceChildren(...out);
  }, [html, rev]);
  return <div ref={ref} style={{ height: "100%", width: "100%" }} />;
}
