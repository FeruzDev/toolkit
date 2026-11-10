# cx-variants

[![npm](https://img.shields.io/npm/v/cx-variants.svg)](https://www.npmjs.com/package/cx-variants)
[![size](https://img.shields.io/bundlephobia/minzip/cx-variants)](https://bundlephobia.com/package/cx-variants)
[![license](https://img.shields.io/npm/l/cx-variants.svg)](./LICENSE)

**`clsx` + `cva` + `tailwind-merge` in one tiny, zero-dependency package.**
Conditional class names, type-safe component variants and built-in Tailwind conflict resolution — and a drop-in `cn()` for shadcn/ui.

```bash
npm install cx-variants
```

Instead of:

```bash
npm install clsx class-variance-authority tailwind-merge
```

## `cn` / `cx` — conditional classes that resolve Tailwind conflicts

```ts
import { cn } from 'cx-variants';

cn('px-2 py-1 bg-red-500', isLarge && 'p-4', { 'opacity-50': disabled }, className);
// isLarge → 'p-4 bg-red-500 …' (px-2 py-1 removed because p-4 comes later)
```

**shadcn/ui users:** replace `lib/utils.ts` with

```ts
export { cn } from 'cx-variants';
```

## `variants` — type-safe component variants (cva / tailwind-variants API)

```tsx
import { variants, type VariantProps } from 'cx-variants';

const button = variants({
  base: 'inline-flex items-center justify-center rounded-md font-medium transition-colors',
  variants: {
    intent: {
      primary: 'bg-blue-600 text-white hover:bg-blue-700',
      outline: 'border border-gray-300 bg-transparent hover:bg-gray-50',
      ghost: 'bg-transparent hover:bg-gray-100',
    },
    size: {
      sm: 'h-8 px-3 text-sm',
      md: 'h-10 px-4',
      lg: 'h-12 px-6 text-lg',
    },
    disabled: { true: 'opacity-50 pointer-events-none' },
  },
  compoundVariants: [{ intent: ['outline', 'ghost'], size: 'lg', class: 'font-semibold' }],
  defaultVariants: { intent: 'primary', size: 'md' },
});

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof button>;

export function Button({ intent, size, disabled, className, ...props }: ButtonProps) {
  return <button className={button({ intent, size, disabled, className })} disabled={disabled} {...props} />;
}

<Button size="lg" className="px-10" />; // px-10 overrides px-6 automatically
```

- Boolean variants: keys `true` / `false` → prop type `boolean`.
- `compoundVariants` accept arrays of values.
- `null` disables a default variant; `undefined` uses it.
- `button.variantKeys` → `{ intent: ['primary', 'outline', 'ghost'], size: [...] }` (Storybook controls).

## Tailwind merge — what's covered

The built-in merge (≈ 2 KB) understands the utilities used in day-to-day components: spacing (`p`, `m` with axis/side conflicts), sizing, display, position/inset, flex & grid, gap, typography (size vs. color vs. alignment), font weight/family, background (color vs. size/position/image), border width vs. color vs. style, rounded corners, shadow, ring, outline, opacity, z-index, overflow, transitions, transforms, variants (`hover:`, `md:`, `dark:` — order-independent), important (`!p-2`, `p-2!`), negative values and arbitrary values/properties.

Unknown classes are **always kept**, so it never removes your custom classes.

Need 100% of Tailwind's edge cases? Plug in `tailwind-merge` — the API stays the same:

```ts
import { twMerge } from 'tailwind-merge';
import { createCx } from 'cx-variants';

export const { cn, variants } = createCx({ merge: twMerge });
```

Not using Tailwind? `createCx({ merge: false })` or the exported `clsx()`.

## API

| Export | Description |
| --- | --- |
| `cn(...inputs)` / `cx(...inputs)` | clsx + Tailwind merge |
| `clsx(...inputs)` | clsx without merging |
| `twMerge(classString)` | Merge only |
| `variants(config)` | `{ base, variants, compoundVariants, defaultVariants }` → `(props) => string` |
| `VariantProps<typeof fn>` | Props type of a variants function |
| `createCx({ merge })` | Bind `cn` / `variants` to another merge function |

## Comparison

| | cx-variants | clsx | cva | tailwind-merge | tailwind-variants |
| --- | --- | --- | --- | --- | --- |
| Conditional classes | ✅ | ✅ | via clsx | ❌ | ✅ |
| Variants + types | ✅ | ❌ | ✅ | ❌ | ✅ |
| Tailwind conflict merge | ✅ built-in | ❌ | ❌ | ✅ | needs tailwind-merge |
| Dependencies | 0 | 0 | 1 | 0 | 1 |

## License

MIT
