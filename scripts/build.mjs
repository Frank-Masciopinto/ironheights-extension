import { build } from 'esbuild';
import { cpSync, rmSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const r = (p) => fileURLToPath(new URL('../' + p, import.meta.url));
rmSync(r('dist'), { recursive: true, force: true });
mkdirSync(r('dist'));
cpSync(r('static'), r('dist'), { recursive: true });
cpSync(r('vendor/ironheights/LICENSE'), r('dist/LICENSE-ironheights.txt'));
const alias = { 'node:path': r('src/shims/path.ts'), 'node:fs': r('src/shims/fs.ts'), 'node:fs/promises': r('src/shims/fs.ts'), 'node:os': r('src/shims/os.ts'), path: r('src/shims/path.ts') };
for (const [entry, format] of [['background', 'esm'], ['content', 'iife'], ['popup', 'iife'], ['results', 'iife']]) {
  await build({ entryPoints: [r(`src/${entry}.ts`)], outfile: r(`dist/${entry}.js`), bundle: true, format, platform: 'browser', target: 'chrome120', minify: false, legalComments: 'inline', alias, logLevel: 'warning' });
}
console.log('built dist/');
