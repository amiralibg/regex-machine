/**
 * Permalinks: pattern, flags, input and view encoded in the URL fragment.
 * Nothing leaves the browser — the fragment is never sent to any server.
 */

export type PermalinkView = 'nfa' | 'dfa';

export interface Permalink {
  pattern: string;
  flags: string;
  input: string;
  view: PermalinkView;
}

export function readPermalink(): Partial<Permalink> {
  const out: Partial<Permalink> = {};
  if (typeof window === 'undefined') return out;
  const h = window.location.hash.replace(/^#/, '');
  if (!h) return out;
  for (const part of h.split('&')) {
    const eq = part.indexOf('=');
    if (eq < 0) continue;
    const k = part.slice(0, eq);
    const v = decodeURIComponent(part.slice(eq + 1));
    if (k === 'p') out.pattern = v;
    else if (k === 'f') out.flags = v.replace(/[^igms]/g, '').slice(0, 4);
    else if (k === 'i') out.input = v;
    else if (k === 'v' && (v === 'nfa' || v === 'dfa')) out.view = v;
  }
  return out;
}

export function writePermalink(p: Permalink): void {
  if (typeof window === 'undefined') return;
  const enc = encodeURIComponent;
  window.history.replaceState(null, '', `#p=${enc(p.pattern)}&f=${enc(p.flags)}&i=${enc(p.input)}&v=${p.view}`);
}
