/**
 * Lightweight Tailwind CSS class conflict resolution.
 * Later classes win over earlier classes of the same utility group, per variant (`hover:`, `md:` …).
 * Covers the commonly used utilities; unknown classes are always kept.
 */

type Rule = [group: string, test: RegExp, conflicts?: string[]];

const SIDES = ['t', 'r', 'b', 'l', 's', 'e'];
const sized = (p: string) => new RegExp(`^${p}-`);

const spacing = (p: string): Rule[] => [
  [p, sized(p), [`${p}x`, `${p}y`, ...SIDES.map((s) => p + s)]],
  [`${p}x`, sized(`${p}x`), [`${p}r`, `${p}l`, `${p}s`, `${p}e`]],
  [`${p}y`, sized(`${p}y`), [`${p}t`, `${p}b`]],
  ...SIDES.map((s): Rule => [p + s, sized(p + s)]),
];

const ROUND = '(?:-(?:none|xs|sm|md|lg|xl|2xl|3xl|4xl|full|\\[.+\\]|\\(.+\\)))?$';
const BORDER_W = '(?:-(?:\\d+|px|\\[\\d.*\\]|\\[length:.+\\]))?$';
const COLOR_FREE = (p: string) => new RegExp(`^${p}-`);

const RULES: Rule[] = [
  ['display', /^(block|inline-block|inline|flex|inline-flex|grid|inline-grid|table|table-row|table-cell|table-caption|contents|flow-root|list-item|hidden)$/],
  ['position', /^(static|fixed|absolute|relative|sticky)$/],
  ['visibility', /^(visible|invisible|collapse)$/],
  ['sr', /^(sr-only|not-sr-only)$/],
  ['box', /^box-(border|content)$/],
  ['float', /^float-/],
  ['clear', /^clear-/],
  ['isolation', /^(isolate|isolation-auto)$/],

  ...spacing('p'),
  ...spacing('m'),
  ['space-x', /^space-x-/],
  ['space-y', /^space-y-/],
  ['gap', /^gap-(?!x-|y-)/, ['gap-x', 'gap-y']],
  ['gap-x', /^gap-x-/],
  ['gap-y', /^gap-y-/],

  ['size', /^size-/, ['w', 'h']],
  ['min-w', /^min-w-/],
  ['max-w', /^max-w-/],
  ['min-h', /^min-h-/],
  ['max-h', /^max-h-/],
  ['w', /^w-/],
  ['h', /^h-/],

  ['inset', /^inset-(?!x-|y-)/, ['inset-x', 'inset-y', 'top', 'right', 'bottom', 'left', 'start', 'end']],
  ['inset-x', /^inset-x-/, ['left', 'right']],
  ['inset-y', /^inset-y-/, ['top', 'bottom']],
  ['top', /^top-/],
  ['right', /^right-/],
  ['bottom', /^bottom-/],
  ['left', /^left-/],
  ['start', /^start-/],
  ['end', /^end-/],
  ['z', /^z-/],
  ['order', /^order-/],
  ['opacity', /^opacity-/],

  ['flex-direction', /^flex-(row|row-reverse|col|col-reverse)$/],
  ['flex-wrap', /^flex-(wrap|wrap-reverse|nowrap)$/],
  ['flex', /^flex-(\d+|auto|initial|none|\[.+\])$/],
  ['grow', /^grow(-.+)?$/],
  ['shrink', /^shrink(-.+)?$/],
  ['basis', /^basis-/],
  ['items', /^items-/],
  ['justify-items', /^justify-items-/],
  ['justify-self', /^justify-self-/],
  ['justify', /^justify-/],
  ['content', /^content-(start|end|center|between|around|evenly|stretch|normal|baseline)$/],
  ['self', /^self-/],
  ['place-content', /^place-content-/],
  ['place-items', /^place-items-/],
  ['place-self', /^place-self-/],
  ['grid-cols', /^grid-cols-/],
  ['grid-rows', /^grid-rows-/],
  ['grid-flow', /^grid-flow-/],
  ['col', /^col-(span-.+|auto)$/],
  ['col-start', /^col-start-/],
  ['col-end', /^col-end-/],
  ['row', /^row-(span-.+|auto)$/],
  ['row-start', /^row-start-/],
  ['row-end', /^row-end-/],

  ['overflow', /^overflow-(auto|hidden|clip|visible|scroll)$/, ['overflow-x', 'overflow-y']],
  ['overflow-x', /^overflow-x-/],
  ['overflow-y', /^overflow-y-/],
  ['overscroll', /^overscroll-/],

  ['rounded', new RegExp(`^rounded${ROUND}`), ['rounded-t', 'rounded-r', 'rounded-b', 'rounded-l', 'rounded-s', 'rounded-e', 'rounded-tl', 'rounded-tr', 'rounded-br', 'rounded-bl', 'rounded-ss', 'rounded-se', 'rounded-ee', 'rounded-es']],
  ...['t', 'r', 'b', 'l', 's', 'e'].map((s): Rule => [
    `rounded-${s}`,
    new RegExp(`^rounded-${s}${ROUND}`),
    { t: ['rounded-tl', 'rounded-tr'], r: ['rounded-tr', 'rounded-br'], b: ['rounded-br', 'rounded-bl'], l: ['rounded-tl', 'rounded-bl'], s: ['rounded-ss', 'rounded-es'], e: ['rounded-se', 'rounded-ee'] }[s],
  ]),
  ...['tl', 'tr', 'br', 'bl', 'ss', 'se', 'ee', 'es'].map((c): Rule => [`rounded-${c}`, new RegExp(`^rounded-${c}${ROUND}`)]),

  ['border-w', new RegExp(`^border${BORDER_W}`), ['border-w-x', 'border-w-y', 'border-w-t', 'border-w-r', 'border-w-b', 'border-w-l', 'border-w-s', 'border-w-e']],
  ['border-w-x', new RegExp(`^border-x${BORDER_W}`), ['border-w-r', 'border-w-l']],
  ['border-w-y', new RegExp(`^border-y${BORDER_W}`), ['border-w-t', 'border-w-b']],
  ...SIDES.map((s): Rule => [`border-w-${s}`, new RegExp(`^border-${s}${BORDER_W}`)]),
  ['border-style', /^border-(solid|dashed|dotted|double|hidden|none)$/],
  ['border-collapse', /^border-(collapse|separate)$/],
  ['border-spacing', /^border-spacing-/],
  ...['x', 'y', ...SIDES].map((s): Rule => [`border-color-${s}`, new RegExp(`^border-${s}-`)]),
  ['border-color', /^border-/, ['border-color-x', 'border-color-y', ...SIDES.map((s) => `border-color-${s}`)]],

  ['divide-x', /^divide-x(-.+)?$/],
  ['divide-y', /^divide-y(-.+)?$/],
  ['divide-style', /^divide-(solid|dashed|dotted|double|none)$/],
  ['divide-color', /^divide-/],

  ['bg-size', /^bg-(auto|cover|contain|size-.+)$/],
  ['bg-position', /^bg-(bottom|center|left|left-bottom|left-top|right|right-bottom|right-top|top|position-.+)$/],
  ['bg-repeat', /^bg-(repeat|no-repeat|repeat-x|repeat-y|repeat-round|repeat-space)$/],
  ['bg-attachment', /^bg-(fixed|local|scroll)$/],
  ['bg-clip', /^bg-clip-/],
  ['bg-origin', /^bg-origin-/],
  ['bg-image', /^bg-(none|gradient-.+|linear-.+|radial.*|conic.*|\[url.+\]|\[image:.+\])$/],
  ['bg-color', /^bg-/],
  ['from', /^from-/],
  ['via', /^via-/],
  ['to', /^to-/],

  ['text-align', /^text-(left|center|right|justify|start|end)$/],
  ['text-wrap', /^text-(wrap|nowrap|balance|pretty)$/],
  ['text-overflow', /^(truncate|text-ellipsis|text-clip)$/],
  ['text-size', /^text-((xs|sm|base|lg|\d*xl)(\/.+)?|\[(length:)?\d.*\]|\[length:.+\])$/],
  ['text-color', /^text-/],
  ['font-weight', /^font-(thin|extralight|light|normal|medium|semibold|bold|extrabold|black|\[\d+\])$/],
  ['font-family', /^font-/],
  ['font-style', /^(italic|not-italic)$/],
  ['text-transform', /^(uppercase|lowercase|capitalize|normal-case)$/],
  ['text-decoration', /^(underline|overline|line-through|no-underline)$/],
  ['decoration-style', /^decoration-(solid|double|dotted|dashed|wavy)$/],
  ['decoration-w', /^decoration-(\d+|auto|from-font)$/],
  ['decoration-color', /^decoration-/],
  ['underline-offset', /^underline-offset-/],
  ['leading', /^leading-/],
  ['tracking', /^tracking-/],
  ['whitespace', /^whitespace-/],
  ['break', /^break-(normal|words|all|keep)$/],
  ['align', /^align-/],
  ['list-type', /^list-(none|disc|decimal|\[.+\])$/],
  ['list-position', /^list-(inside|outside)$/],

  ['shadow', /^shadow(-(2xs|xs|sm|md|lg|xl|2xl|inner|none|\[.+\]))?$/],
  ['shadow-color', COLOR_FREE('shadow')],
  ['ring-w', /^ring(-(\d+|inset|\[\d.*\]))?$/],
  ['ring-offset-w', /^ring-offset-(\d+|\[\d.*\])$/],
  ['ring-offset-color', /^ring-offset-/],
  ['ring-color', /^ring-/],
  ['outline-style', /^outline(-(none|dashed|dotted|double|hidden|solid))?$/],
  ['outline-w', /^outline-(\d+|\[\d.*\])$/],
  ['outline-offset', /^outline-offset-/],
  ['outline-color', /^outline-/],

  ['object-fit', /^object-(contain|cover|fill|none|scale-down)$/],
  ['object-position', /^object-/],
  ['aspect', /^aspect-/],
  ['columns', /^columns-/],

  ['cursor', /^cursor-/],
  ['select', /^select-/],
  ['pointer-events', /^pointer-events-/],
  ['resize', /^resize(-.+)?$/],
  ['appearance', /^appearance-/],
  ['will-change', /^will-change-/],
  ['accent', /^accent-/],
  ['caret', /^caret-/],
  ['fill', /^fill-/],
  ['stroke-w', /^stroke-(\d+|\[\d.*\])$/],
  ['stroke', /^stroke-/],

  ['transition', /^transition(-.+)?$/],
  ['duration', /^duration-/],
  ['ease', /^ease-/],
  ['delay', /^delay-/],
  ['animate', /^animate-/],
  ['scale', /^scale-(?!x-|y-)/, ['scale-x', 'scale-y']],
  ['scale-x', /^scale-x-/],
  ['scale-y', /^scale-y-/],
  ['rotate', /^rotate-/],
  ['translate-x', /^translate-x-/],
  ['translate-y', /^translate-y-/],
  ['skew-x', /^skew-x-/],
  ['skew-y', /^skew-y-/],
  ['origin', /^origin-/],
  ['blur', /^blur(-.+)?$/],
  ['backdrop-blur', /^backdrop-blur(-.+)?$/],
  ['brightness', /^brightness-/],
  ['mix-blend', /^mix-blend-/],
];

function splitVariants(token: string): { variants: string; utility: string } {
  let depth = 0;
  let last = -1;
  for (let i = 0; i < token.length; i++) {
    const ch = token[i];
    if (ch === '[' || ch === '(') depth++;
    else if (ch === ']' || ch === ')') depth--;
    else if (ch === ':' && depth === 0) last = i;
  }
  if (last < 0) return { variants: '', utility: token };
  const variants = token
    .slice(0, last)
    .split(':')
    // order of plain variants does not matter (hover:focus: == focus:hover:)
    .sort()
    .join(':');
  return { variants, utility: token.slice(last + 1) };
}

function classify(utility: string): Rule | undefined {
  let u = utility;
  if (u.startsWith('!')) u = u.slice(1);
  if (u.endsWith('!')) u = u.slice(0, -1);
  if (u.startsWith('-')) u = u.slice(1);
  const arbitraryProp = /^\[([a-z-]+):.+\]$/.exec(u);
  if (arbitraryProp) return [`arbitrary:${arbitraryProp[1]}`, /./];
  return RULES.find(([, test]) => test.test(u));
}

/**
 * Removes conflicting Tailwind classes — the last one wins.
 *
 * @example
 * twMerge('px-2 py-1 p-4 text-sm text-lg hover:bg-red-500 bg-blue-500') // 'p-4 text-lg hover:bg-red-500 bg-blue-500'
 */
export function twMerge(classes: string): string {
  const tokens = classes.trim().split(/\s+/);
  const seen = new Set<string>();
  const kept: string[] = [];

  for (let i = tokens.length - 1; i >= 0; i--) {
    const token = tokens[i];
    if (!token) continue;
    const { variants, utility } = splitVariants(token);
    const rule = classify(utility);
    if (!rule) {
      if (!seen.has(`raw:${token}`)) {
        seen.add(`raw:${token}`);
        kept.push(token);
      }
      continue;
    }
    const important = utility.startsWith('!') || utility.endsWith('!') ? '!' : '';
    const prefix = `${variants}|${important}|`;
    const key = prefix + rule[0];
    if (seen.has(key)) continue;
    seen.add(key);
    for (const c of rule[2] ?? []) seen.add(prefix + c);
    kept.push(token);
  }
  return kept.reverse().join(' ');
}
