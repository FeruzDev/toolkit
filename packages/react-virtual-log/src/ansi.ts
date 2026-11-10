export interface Segment {
  text: string;
  color?: string;
  background?: string;
  bold?: boolean;
  dim?: boolean;
  italic?: boolean;
  underline?: boolean;
}

const COLORS = ['#3b3f45', '#f14c4c', '#23d18b', '#f5f543', '#3b8eea', '#d670d6', '#29b8db', '#e5e5e5'];
const BRIGHT = ['#666666', '#ff6b6b', '#5af78e', '#f4f99d', '#57c7ff', '#ff6ac1', '#9aedfe', '#ffffff'];

function color256(n: number): string {
  if (n < 8) return COLORS[n];
  if (n < 16) return BRIGHT[n - 8];
  if (n < 232) {
    const i = n - 16;
    const c = (v: number) => (v === 0 ? 0 : 55 + v * 40);
    return `rgb(${c(Math.floor(i / 36))},${c(Math.floor(i / 6) % 6)},${c(i % 6)})`;
  }
  const g = 8 + (n - 232) * 10;
  return `rgb(${g},${g},${g})`;
}

// eslint-disable-next-line no-control-regex
const ANSI_RE = /\x1b\[([0-9;]*)m/g;
// eslint-disable-next-line no-control-regex
const OTHER_ESCAPES = /\x1b\[[0-9;?]*[A-Za-z]|\x1b\][^\x07]*\x07/g;

export const hasAnsi = (text: string) => text.includes('\x1b[');

/** Remove ANSI escape codes. */
export function stripAnsi(text: string): string {
  return text.replace(ANSI_RE, '').replace(OTHER_ESCAPES, '');
}

/** Split a line with ANSI SGR codes into styled segments. */
export function parseAnsi(text: string): Segment[] {
  if (!hasAnsi(text)) return [{ text }];
  const out: Segment[] = [];
  let style: Omit<Segment, 'text'> = {};
  let last = 0;
  let m: RegExpExecArray | null;
  ANSI_RE.lastIndex = 0;
  while ((m = ANSI_RE.exec(text))) {
    if (m.index > last) out.push({ text: text.slice(last, m.index).replace(OTHER_ESCAPES, ''), ...style });
    last = ANSI_RE.lastIndex;
    const codes = m[1] === '' ? [0] : m[1].split(';').map(Number);
    for (let i = 0; i < codes.length; i++) {
      const c = codes[i];
      if (c === 0) style = {};
      else if (c === 1) style = { ...style, bold: true };
      else if (c === 2) style = { ...style, dim: true };
      else if (c === 3) style = { ...style, italic: true };
      else if (c === 4) style = { ...style, underline: true };
      else if (c === 22) style = { ...style, bold: false, dim: false };
      else if (c === 23) style = { ...style, italic: false };
      else if (c === 24) style = { ...style, underline: false };
      else if (c >= 30 && c <= 37) style = { ...style, color: COLORS[c - 30] };
      else if (c >= 90 && c <= 97) style = { ...style, color: BRIGHT[c - 90] };
      else if (c === 39) style = { ...style, color: undefined };
      else if (c >= 40 && c <= 47) style = { ...style, background: COLORS[c - 40] };
      else if (c >= 100 && c <= 107) style = { ...style, background: BRIGHT[c - 100] };
      else if (c === 49) style = { ...style, background: undefined };
      else if ((c === 38 || c === 48) && codes[i + 1] === 5) {
        const col = color256(codes[i + 2] ?? 0);
        style = c === 38 ? { ...style, color: col } : { ...style, background: col };
        i += 2;
      } else if ((c === 38 || c === 48) && codes[i + 1] === 2) {
        const col = `rgb(${codes[i + 2] ?? 0},${codes[i + 3] ?? 0},${codes[i + 4] ?? 0})`;
        style = c === 38 ? { ...style, color: col } : { ...style, background: col };
        i += 4;
      }
    }
  }
  if (last < text.length) out.push({ text: text.slice(last).replace(OTHER_ESCAPES, ''), ...style });
  return out.filter((s) => s.text.length > 0);
}
