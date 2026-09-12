// Build da Landing Page: inlina o styles.css nos HTML (elimina o CSS como
// recurso que bloqueia a renderização → melhora FCP/LCP no Lighthouse).
// Você continua editando styles.css normalmente; este script gera o /dist.
// Uso local: `node build.mjs`  ·  Vercel roda automático (buildCommand).
import { readFileSync, writeFileSync, mkdirSync, cpSync, rmSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const dir = dirname(fileURLToPath(import.meta.url));
const dist = join(dir, 'dist');

// dist limpo
if (existsSync(dist)) rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });

// Estáticos (o CSS NÃO vai avulso — é inlinado nos HTML). main.js segue externo (defer, não bloqueia).
for (const f of ['assets', 'robots.txt', 'sitemap.xml', 'main.js']) {
  const src = join(dir, f);
  if (existsSync(src)) cpSync(src, join(dist, f), { recursive: true });
}

const css = readFileSync(join(dir, 'styles.css'), 'utf8');
const styleTag = `<style>\n${css}\n</style>`;

let n = 0;
for (const page of ['index.html', 'privacidade.html', 'termos.html']) {
  const srcPage = join(dir, page);
  if (!existsSync(srcPage)) continue;
  let html = readFileSync(srcPage, 'utf8');
  // Troca o <link rel="stylesheet" .../styles.css?v=N> por <style> inline.
  html = html.replace(/<link rel="stylesheet" href="\/styles\.css\?v=\d+"\s*\/?>/, styleTag);
  writeFileSync(join(dist, page), html);
  n++;
}

console.log(`LP build OK → dist/ (${n} páginas com CSS inlinado)`);
