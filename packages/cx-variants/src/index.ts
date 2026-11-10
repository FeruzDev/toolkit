import { twMerge } from './merge';

export { twMerge } from './merge';

export type ClassDictionary = Record<string, unknown>;
export type ClassValue = string | number | bigint | boolean | null | undefined | ClassDictionary | ClassValue[];

function toVal(value: ClassValue, out: string[]): void {
  if (!value) return;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'bigint') {
    out.push(String(value));
  } else if (Array.isArray(value)) {
    for (const v of value) toVal(v, out);
  } else if (typeof value === 'object') {
    for (const key in value) if (value[key]) out.push(key);
  }
}

/**
 * Join class names conditionally — same API as `clsx`, **without** Tailwind merging.
 *
 * @example
 * clsx('btn', { active: isActive }, ['a', false && 'b']) // 'btn active a'
 */
export function clsx(...inputs: ClassValue[]): string {
  const out: string[] = [];
  for (const input of inputs) toVal(input, out);
  return out.join(' ');
}

export interface CxConfig {
  /** Conflict resolver. Defaults to the built-in lightweight merge; pass `twMerge` from `tailwind-merge` for full coverage, or `false` to disable. */
  merge?: ((classes: string) => string) | false;
}

/* ------------------------------------------------------------------ */
/* variants                                                            */
/* ------------------------------------------------------------------ */

type VariantShape = Record<string, Record<string, ClassValue>>;
type StringToBoolean<T> = T extends 'true' | 'false' ? boolean : T;
type VariantKeys<V extends VariantShape> = { [K in keyof V]?: StringToBoolean<keyof V[K]> | null | undefined };

export interface VariantsConfig<V extends VariantShape> {
  /** Classes always applied. */
  base?: ClassValue;
  /** Variant groups: `{ size: { sm: '...', lg: '...' }, disabled: { true: '...' } }`. */
  variants?: V;
  /** Classes applied when several variants match together. */
  compoundVariants?: Array<{ [K in keyof V]?: StringToBoolean<keyof V[K]> | Array<StringToBoolean<keyof V[K]>> } & { class?: ClassValue; className?: ClassValue }>;
  /** Variant values used when a prop is not given. */
  defaultVariants?: VariantKeys<V>;
}

export type VariantsProps<V extends VariantShape> = VariantKeys<V> & { class?: ClassValue; className?: ClassValue };

export type VariantsFunction<V extends VariantShape> = ((props?: VariantsProps<V>) => string) & {
  /** Variant names and their options (handy for Storybook controls). */
  variantKeys: { [K in keyof V]: Array<keyof V[K]> };
};

/** Props type of a `variants()` function, without `class` / `className`. */
export type VariantProps<F> = F extends (props?: infer P) => string ? Omit<P, 'class' | 'className'> : never;

/**
 * Create helpers bound to a custom merge function.
 *
 * @example
 * import { twMerge } from 'tailwind-merge';
 * export const { cn, variants } = createCx({ merge: twMerge });
 */
export function createCx(config: CxConfig = {}) {
  const merge = config.merge === false ? (s: string) => s : config.merge ?? twMerge;

  /** `clsx` + Tailwind conflict resolution. Same as shadcn/ui's `cn()`. */
  const cx = (...inputs: ClassValue[]): string => merge(clsx(inputs));

  function variants<V extends VariantShape = {}>(cfg: VariantsConfig<V>): VariantsFunction<V> {
    const groups = (cfg.variants ?? {}) as V;
    const fn = ((props: VariantsProps<V> = {}) => {
      const classes: ClassValue[] = [cfg.base];
      const selected: Record<string, unknown> = {};

      for (const name of Object.keys(groups)) {
        const p = props[name as keyof V];
        // `null` explicitly disables the default; `undefined` falls back to it
        const value = p !== undefined ? p : cfg.defaultVariants?.[name as keyof V];
        if (value === null || value === undefined) continue;
        selected[name] = value;
        classes.push(groups[name][String(value)]);
      }

      for (const compound of cfg.compoundVariants ?? []) {
        const { class: c, className: cn, ...conditions } = compound as Record<string, unknown> & { class?: ClassValue; className?: ClassValue };
        const matches = Object.entries(conditions).every(([k, expected]) =>
          Array.isArray(expected) ? expected.includes(selected[k] as never) : selected[k] === expected,
        );
        if (matches) classes.push(c, cn);
      }

      classes.push(props.class, props.className);
      return cx(classes);
    }) as VariantsFunction<V>;

    fn.variantKeys = Object.fromEntries(Object.entries(groups).map(([k, v]) => [k, Object.keys(v)])) as VariantsFunction<V>['variantKeys'];
    return fn;
  }

  return { cx, cn: cx, variants };
}

const defaults = createCx();

/**
 * Conditional class names **with Tailwind conflict resolution** (clsx + tailwind-merge).
 *
 * @example
 * cx('px-2 py-1', isLarge && 'p-4', { 'bg-red-500': error }, className)
 */
export const cx = defaults.cx;

/** Alias of `cx` — drop-in replacement for shadcn/ui's `cn()` in `lib/utils.ts`. */
export const cn = defaults.cn;

/**
 * Type-safe variants, like `cva` / `tailwind-variants`, with Tailwind merging built in.
 *
 * @example
 * const button = variants({
 *   base: 'inline-flex items-center rounded-md font-medium',
 *   variants: {
 *     intent: { primary: 'bg-blue-600 text-white', ghost: 'bg-transparent' },
 *     size: { sm: 'h-8 px-3 text-sm', lg: 'h-12 px-6 text-lg' },
 *     disabled: { true: 'opacity-50 pointer-events-none' },
 *   },
 *   compoundVariants: [{ intent: 'ghost', size: 'lg', class: 'underline' }],
 *   defaultVariants: { intent: 'primary', size: 'sm' },
 * });
 *
 * type ButtonProps = VariantProps<typeof button>; // { intent?: 'primary' | 'ghost'; size?: 'sm' | 'lg'; disabled?: boolean }
 * button({ size: 'lg', className: 'px-10' }) // px-10 wins over px-6
 */
export const variants = defaults.variants;
