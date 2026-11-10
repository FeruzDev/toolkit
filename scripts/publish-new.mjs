// Publishes every workspace package whose current version is not on npm yet.
import { execSync } from 'node:child_process';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, '$1')), '..');
const dirs = readdirSync(path.join(root, 'packages')).map((d) => path.join(root, 'packages', d));
const extra = process.argv.slice(2).join(' ');
let failed = 0;

for (const dir of dirs) {
  const file = path.join(dir, 'package.json');
  if (!existsSync(file)) continue;
  const pkg = JSON.parse(readFileSync(file, 'utf8'));
  if (pkg.private) continue;
  let exists = true;
  try {
    execSync(`npm view ${pkg.name}@${pkg.version} version`, { stdio: 'pipe' });
  } catch {
    exists = false;
  }
  if (exists) {
    console.log(`skip ${pkg.name}@${pkg.version} (already published)`);
    continue;
  }
  console.log(`publish ${pkg.name}@${pkg.version}`);
  try {
    execSync(`npm publish --access public --ignore-scripts ${extra}`, { cwd: dir, stdio: 'inherit' });
  } catch {
    failed++;
    console.error(`FAILED ${pkg.name}`);
  }
}
process.exit(failed ? 1 : 0);
