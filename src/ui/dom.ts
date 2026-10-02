import { COIN, GEM } from './icons';

type Child = Node | string | number | null | undefined | false;
type Props = Record<string, unknown> & { class?: string; style?: string; onClick?: (e: MouseEvent) => void };

/** Minimal element builder: h('div', { class: 'x', onClick }, 'text', child). */
export function h<K extends keyof HTMLElementTagNameMap>(tag: K, props: Props | null = null, ...children: Child[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (props) {
    for (const [k, v] of Object.entries(props)) {
      if (v === undefined || v === null || v === false) continue;
      if (k === 'class') el.className = String(v);
      else if (k === 'style') el.setAttribute('style', String(v));
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v as EventListener);
      else if (k in el) (el as unknown as Record<string, unknown>)[k] = v;
      else el.setAttribute(k, String(v));
    }
  }
  for (const c of children) {
    if (c === null || c === undefined || c === false) continue;
    el.append(c instanceof Node ? c : String(c));
  }
  return el;
}

export function fmtDuration(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${String(s % 60).padStart(2, '0')}s`;
  const hr = Math.floor(m / 60);
  return `${hr}h ${m % 60}m`;
}

/** Text with inline currency icons: "{coin}" and "{gem}" become the 8-bit coin and the gem. */
export function rich(text: string): DocumentFragment {
  const frag = document.createDocumentFragment();
  for (const part of text.split(/(\{coin\}|\{gem\})/)) {
    if (part === '{coin}' || part === '{gem}') {
      const s = document.createElement('span');
      s.className = 'icon';
      s.innerHTML = part === '{coin}' ? COIN : GEM;
      frag.append(s);
    } else if (part) frag.append(part);
  }
  return frag;
}

export function img(src: string, cls = ''): HTMLImageElement {
  const i = h('img', { class: cls, alt: '', draggable: false });
  i.src = src;
  return i;
}
