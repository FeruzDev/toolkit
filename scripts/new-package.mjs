// Usage: node scripts/new-package.mjs <name> "<description>" "<kw1,kw2>" [react] [tsx]
import { mkdirSync, writeFileSync, copyFileSync, existsSync } from 'node:fs';
import path from 'node:path';

const [name, description, keywords = '', ...flags] = process.argv.slice(2);
if (!name || !description) {
  console.error('usage: new-package <name> <description> <keywords> [react] [tsx]');
  process.exit(1);
}
const react = flags.includes('react');
const entry = flags.includes('tsx') ? 'src/index.tsx' : 'src/index.ts';
const dir = path.join('packages', name);
mkdirSync(path.join(dir, 'src'), { recursive: true });
mkdirSync(path.join(dir, 'test'), { recursive: true });

const pkg = {
  name,
  version: '1.0.0',
  description,
  keywords: keywords.split(',').map((k) => k.trim()).filter(Boolean),
  license: 'MIT',
  author: 'FeruzDev',
  repository: { type: 'git', url: 'git+https://github.com/FeruzDev/toolkit.git', directory: `packages/${name}` },
  homepage: `https://github.com/FeruzDev/toolkit/tree/main/packages/${name}#readme`,
  bugs: { url: 'https://github.com/FeruzDev/toolkit/issues' },
  sideEffects: false,
  type: 'module',
  main: './dist/index.cjs',
  module: './dist/index.js',
  types: './dist/index.d.ts',
  exports: {
    '.': {
      import: { types: './dist/index.d.ts', default: './dist/index.js' },
      require: { types: './dist/index.d.cts', default: './dist/index.cjs' },
    },
    './llms.txt': './llms.txt',
    './package.json': './package.json',
  },
  files: ['dist', 'README.md', 'LICENSE', 'llms.txt'],
  scripts: {
    build: `tsup ${entry} --format esm,cjs --dts --clean --sourcemap --target es2020${react ? ' --external react' : ''}`,
  },
  ...(react ? { peerDependencies: { react: '>=16.8.0' } } : {}),
  publishConfig: { access: 'public' },
};

const file = path.join(dir, 'package.json');
if (existsSync(file)) {
  console.error(`${file} exists`);
  process.exit(1);
}
writeFileSync(file, JSON.stringify(pkg, null, 2) + '\n');
copyFileSync('LICENSE', path.join(dir, 'LICENSE'));
console.log(`created ${dir}`);
