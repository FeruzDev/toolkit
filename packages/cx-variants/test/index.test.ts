import { clsx, cx, cn, twMerge, variants, createCx, type VariantProps } from '../src';

describe('clsx', () => {
  it('handles strings, objects, arrays and falsy values', () => {
    expect(clsx('a', { b: true, c: false }, ['d', ['e', null, undefined, 0, false]], 1)).toBe('a b d e 1');
    expect(clsx()).toBe('');
  });
});

describe('twMerge', () => {
  it.each([
    ['p-2 p-4', 'p-4'],
    ['px-2 py-1 p-4', 'p-4'],
    ['p-4 px-2', 'p-4 px-2'],
    ['pl-2 px-4', 'px-4'],
    ['m-2 -m-4', '-m-4'],
    ['text-sm text-lg', 'text-lg'],
    ['text-red-500 text-lg', 'text-red-500 text-lg'],
    ['text-red-500 text-blue-500/50', 'text-blue-500/50'],
    ['text-[14px] text-[#fff]', 'text-[14px] text-[#fff]'],
    ['text-left text-center', 'text-center'],
    ['bg-red-500 bg-[#fff]', 'bg-[#fff]'],
    ['bg-cover bg-red-500', 'bg-cover bg-red-500'],
    ['hover:bg-red-500 bg-blue-500', 'hover:bg-red-500 bg-blue-500'],
    ['hover:bg-red-500 hover:bg-blue-500', 'hover:bg-blue-500'],
    ['hover:focus:p-2 focus:hover:p-4', 'focus:hover:p-4'],
    ['md:p-2 lg:p-4', 'md:p-2 lg:p-4'],
    ['border border-red-500', 'border border-red-500'],
    ['border-2 border-4', 'border-4'],
    ['border-t-2 border', 'border'],
    ['border-t-red-500 border-red-500', 'border-red-500'],
    ['rounded-t-lg rounded-md', 'rounded-md'],
    ['rounded-md rounded-t-lg', 'rounded-md rounded-t-lg'],
    ['block flex hidden', 'hidden'],
    ['absolute relative', 'relative'],
    ['w-4 h-4 size-8', 'size-8'],
    ['font-bold font-semibold font-mono', 'font-semibold font-mono'],
    ['shadow-lg shadow-red-500 shadow-sm', 'shadow-red-500 shadow-sm'],
    ['ring ring-2 ring-blue-500', 'ring-2 ring-blue-500'],
    ['flex-row flex-col flex-wrap flex-1', 'flex-col flex-wrap flex-1'],
    ['gap-x-2 gap-4', 'gap-4'],
    ['inset-x-0 left-2', 'inset-x-0 left-2'],
    ['left-2 inset-0', 'inset-0'],
    ['!p-2 p-4', '!p-2 p-4'],
    ['p-2! p-4!', 'p-4!'],
    ['[mask-type:luminance] [mask-type:alpha]', '[mask-type:alpha]'],
    ['my-btn custom-thing my-btn', 'custom-thing my-btn'],
    ['opacity-50 opacity-100', 'opacity-100'],
    ['transition-colors duration-150 duration-300', 'transition-colors duration-300'],
  ])('%s -> %s', (input, expected) => {
    expect(twMerge(input)).toBe(expected);
  });
});

describe('cx / cn', () => {
  it('merges conditionally', () => {
    expect(cx('px-2 py-1', true && 'p-4', { 'bg-red-500': true }, ['bg-blue-500'])).toBe('p-4 bg-blue-500');
    expect(cn).toBe(cx);
  });
});

describe('variants', () => {
  const button = variants({
    base: 'inline-flex rounded-md font-medium',
    variants: {
      intent: { primary: 'bg-blue-600 text-white', ghost: 'bg-transparent text-blue-600' },
      size: { sm: 'h-8 px-3 text-sm', lg: 'h-12 px-6 text-lg' },
      disabled: { true: 'opacity-50 pointer-events-none', false: 'cursor-pointer' },
    },
    compoundVariants: [
      { intent: 'ghost', size: 'lg', class: 'underline' },
      { intent: ['primary', 'ghost'], disabled: true, className: 'grayscale' },
    ],
    defaultVariants: { intent: 'primary', size: 'sm', disabled: false },
  });

  it('applies defaults', () => {
    expect(button()).toBe('inline-flex rounded-md font-medium bg-blue-600 text-white h-8 px-3 text-sm cursor-pointer');
  });

  it('applies variants, compounds and merges className', () => {
    expect(button({ intent: 'ghost', size: 'lg', className: 'px-10 rounded-full' })).toBe(
      'inline-flex font-medium bg-transparent text-blue-600 h-12 text-lg cursor-pointer underline px-10 rounded-full',
    );
    expect(button({ disabled: true })).toContain('opacity-50 pointer-events-none grayscale');
  });

  it('null disables a default', () => {
    expect(button({ size: null })).not.toContain('h-8');
  });

  it('exposes typed props and variant keys', () => {
    type Props = VariantProps<typeof button>;
    const p: Props = { intent: 'ghost', size: 'lg', disabled: true };
    // @ts-expect-error invalid value
    const bad: Props = { size: 'xl' };
    expect([p, bad]).toBeTruthy();
    expect(button.variantKeys).toEqual({ intent: ['primary', 'ghost'], size: ['sm', 'lg'], disabled: ['true', 'false'] });
  });
});

describe('createCx', () => {
  it('accepts a custom merge or none', () => {
    expect(createCx({ merge: false }).cx('p-2', 'p-4')).toBe('p-2 p-4');
    expect(createCx({ merge: (s) => s.toUpperCase() }).cn('a', 'b')).toBe('A B');
  });
});
