// Live-DOM perception + action executor for the Super Agent.
// Runs in the browser only — operates on the current page.

export type DomElement = {
  ref: number; // stable index into the snapshot for selector fallback
  tag: string;
  type?: string;
  role?: string;
  id?: string;
  name?: string;
  placeholder?: string;
  text?: string;
  ariaLabel?: string;
  href?: string;
  options?: string[]; // for <select>
  checked?: boolean;
  visible: boolean;
};

export type DomSnapshot = {
  url: string;
  title: string;
  elements: DomElement[];
};

export type AgentAction = {
  type: "click" | "type" | "fill" | "select" | "submit";
  selector: string;
  value?: string;
};

const INTERACTIVE_SELECTOR = [
  "a[href]",
  "button",
  "input:not([type=hidden])",
  "textarea",
  "select",
  "[role=button]",
  "[role=link]",
  "[role=textbox]",
  "[role=checkbox]",
  "[role=combobox]",
  "[contenteditable=true]",
].join(",");

function isVisible(el: Element): boolean {
  if (!(el instanceof HTMLElement)) return true;
  const rect = el.getBoundingClientRect();
  if (rect.width === 0 && rect.height === 0) return false;
  const style = window.getComputedStyle(el);
  if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0") {
    return false;
  }
  return true;
}

function shortText(el: Element, max = 80): string {
  const t = (el.textContent ?? "").replace(/\s+/g, " ").trim();
  return t.length > max ? `${t.slice(0, max)}…` : t;
}

let snapshotCache: { snapshot: DomSnapshot; nodes: Element[] } | null = null;

export function snapshotPage(): DomSnapshot {
  if (typeof document === "undefined") {
    return { url: "", title: "", elements: [] };
  }
  const nodes = Array.from(document.querySelectorAll(INTERACTIVE_SELECTOR));
  const elements: DomElement[] = [];
  const kept: Element[] = [];

  nodes.forEach((node) => {
    const visible = isVisible(node);
    if (!visible) return;
    const ref = kept.length;
    kept.push(node);
    const e = node as HTMLElement;
    const tag = e.tagName.toLowerCase();
    const item: DomElement = {
      ref,
      tag,
      visible: true,
    };
    if (e.id) item.id = e.id;
    const role = e.getAttribute("role");
    if (role) item.role = role;
    const aria = e.getAttribute("aria-label");
    if (aria) item.ariaLabel = aria;

    if (e instanceof HTMLAnchorElement) {
      item.href = e.getAttribute("href") ?? undefined;
      item.text = shortText(e);
    } else if (e instanceof HTMLButtonElement) {
      item.text = shortText(e);
      item.type = e.type || "button";
    } else if (e instanceof HTMLInputElement) {
      item.type = e.type;
      if (e.name) item.name = e.name;
      if (e.placeholder) item.placeholder = e.placeholder;
      if (e.type === "checkbox" || e.type === "radio") item.checked = e.checked;
    } else if (e instanceof HTMLTextAreaElement) {
      item.type = "textarea";
      if (e.name) item.name = e.name;
      if (e.placeholder) item.placeholder = e.placeholder;
    } else if (e instanceof HTMLSelectElement) {
      item.type = "select";
      if (e.name) item.name = e.name;
      item.options = Array.from(e.options)
        .slice(0, 25)
        .map((o) => o.text || o.value);
    } else {
      item.text = shortText(e);
    }

    elements.push(item);
  });

  const snapshot: DomSnapshot = {
    url: window.location.pathname + window.location.search,
    title: document.title,
    elements,
  };
  snapshotCache = { snapshot, nodes: kept };
  return snapshot;
}

function resolveBySelector(selector: string): Element | null {
  if (!selector) return null;
  const trimmed = selector.trim();

  // Numeric ref into last snapshot ("ref:12" or "12")
  const refMatch = trimmed.match(/^(?:ref[:=])?(\d+)$/i);
  if (refMatch && snapshotCache) {
    const idx = Number(refMatch[1]);
    return snapshotCache.nodes[idx] ?? null;
  }

  // Try as a CSS selector first
  try {
    const el = document.querySelector(trimmed);
    if (el) return el;
  } catch {
    // invalid CSS selector — fall through to other strategies
  }

  // #id
  if (trimmed.startsWith("#")) {
    const el = document.getElementById(trimmed.slice(1));
    if (el) return el;
  }

  // [name=foo] style fallbacks
  const byName = document.querySelector(`[name="${cssEscape(trimmed)}"]`);
  if (byName) return byName;

  const byPlaceholder = document.querySelector(`[placeholder="${cssEscape(trimmed)}"]`);
  if (byPlaceholder) return byPlaceholder;

  const byAria = document.querySelector(`[aria-label="${cssEscape(trimmed)}"]`);
  if (byAria) return byAria;

  // Match by visible text on snapshot nodes
  if (snapshotCache) {
    const lower = trimmed.toLowerCase();
    for (const node of snapshotCache.nodes) {
      const t = (node.textContent ?? "").trim().toLowerCase();
      if (t && (t === lower || t.includes(lower))) return node;
      if (node instanceof HTMLElement) {
        const aria = (node.getAttribute("aria-label") ?? "").toLowerCase();
        if (aria && aria.includes(lower)) return node;
      }
    }
  }

  return null;
}

function cssEscape(s: string): string {
  return s.replace(/(["\\])/g, "\\$1");
}

function setReactInputValue(el: HTMLInputElement | HTMLTextAreaElement, value: string) {
  const proto = el instanceof HTMLTextAreaElement
    ? HTMLTextAreaElement.prototype
    : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
  if (setter) setter.call(el, value);
  else el.value = value;
  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.dispatchEvent(new Event("change", { bubbles: true }));
}

export function executeAction(action: AgentAction): { ok: boolean; detail: string } {
  const target = resolveBySelector(action.selector);
  if (!target) {
    return { ok: false, detail: `selector not found: "${action.selector}"` };
  }

  try {
    switch (action.type) {
      case "click": {
        (target as HTMLElement).scrollIntoView({ block: "center", behavior: "instant" as ScrollBehavior });
        (target as HTMLElement).click();
        return { ok: true, detail: `clicked ${describe(target)}` };
      }
      case "type":
      case "fill": {
        if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
          target.focus();
          setReactInputValue(target, action.value ?? "");
          return { ok: true, detail: `filled ${describe(target)} with "${action.value ?? ""}"` };
        }
        if ((target as HTMLElement).isContentEditable) {
          (target as HTMLElement).innerText = action.value ?? "";
          target.dispatchEvent(new Event("input", { bubbles: true }));
          return { ok: true, detail: `wrote into contenteditable` };
        }
        return { ok: false, detail: "target is not a text field" };
      }
      case "select": {
        if (target instanceof HTMLSelectElement) {
          const value = action.value ?? "";
          const opt = Array.from(target.options).find(
            (o) => o.value === value || o.text === value,
          );
          if (!opt) return { ok: false, detail: `option "${value}" not in select` };
          target.value = opt.value;
          target.dispatchEvent(new Event("change", { bubbles: true }));
          return { ok: true, detail: `selected "${opt.text}"` };
        }
        return { ok: false, detail: "target is not a <select>" };
      }
      case "submit": {
        const form = target.closest("form") ?? (target instanceof HTMLFormElement ? target : null);
        if (!form) return { ok: false, detail: "no enclosing form" };
        if (typeof (form as HTMLFormElement).requestSubmit === "function") {
          (form as HTMLFormElement).requestSubmit();
        } else {
          (form as HTMLFormElement).submit();
        }
        return { ok: true, detail: `submitted form` };
      }
      default:
        return { ok: false, detail: `unknown action type: ${action.type}` };
    }
  } catch (err) {
    return { ok: false, detail: err instanceof Error ? err.message : String(err) };
  }
}

function describe(el: Element): string {
  const tag = el.tagName.toLowerCase();
  if (el.id) return `${tag}#${el.id}`;
  const name = el.getAttribute("name");
  if (name) return `${tag}[name=${name}]`;
  const text = (el.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 40);
  return text ? `${tag} "${text}"` : tag;
}
